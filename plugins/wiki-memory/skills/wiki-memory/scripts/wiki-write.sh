#!/usr/bin/env bash
# wiki-write — Write a wiki page to a wiki-backed skill domain
#
# Usage: wiki-write <domain> <slug> --from <payload-file> [--scope project|user]
#                   [--update] [--json] [--quiet]
#        wiki-write -h|--help
#
# Exit codes (repo-local scheme — aligns with wiki-health.sh):
#   0 — success
#   1 — RESERVED (not used)
#   2 — user/argument error (bad args, invalid domain/slug, malformed frontmatter,
#         slug collision without --update, unknown flag)
#   3 — infra error (unreadable payload, filesystem error)

set -euo pipefail

# --- Resolve script directory through symlinks (MSYS-safe) ---
_resolve_script() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir
    dir="$(cd "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd "$(dirname "$src")" && pwd
}
SCRIPT_DIR="$(_resolve_script)"

# --- Usage / help ---
_usage() {
  cat <<'USAGE'
Usage: wiki-write <domain> <slug> --from <payload-file> [options]
       wiki-write -h|--help

Write a wiki page to a wiki-backed skill domain.

Arguments:
  <domain>    Wiki domain name (e.g. claude-code-ref-expert). Must not contain
              '/', '\', '..', or spaces.
  <slug>      Page filename without the .md extension (e.g. my-page). May contain
              at most one '/' subdir separator (e.g. backend/my-page). Must not
              contain '..', leading/trailing '/', or shell metacharacters.

Required flags:
  --from <path>     Path to a readable payload markdown file. The file must
                    begin with a YAML frontmatter block containing all three
                    required fields: tags:, summary:, code-cites:

Optional flags:
  --scope project|user   Target wiki scope. Default: project. With --scope user,
                         the target domain must already exist at user scope
                         (~/.claude/skills/{domain}-expert/); auto-init is
                         forbidden at user scope.
  --update               Allow overwriting an existing slug. Without this flag,
                         a slug collision exits 2. With this flag, action=updated.
  --json                 Emit JSON result on stdout: {"path":"...","domain":"...",
                         "slug":"...","scope":"project|user","action":"created|updated"}
  --quiet                Suppress stderr progress messages. Errors still emit.
  -h, --help             Print this usage and exit 0.

Payload frontmatter required fields:
  tags:         (list; e.g. [domain/page])
  summary:      (string; one-line description)
  code-cites:   (list; [] for principle pages that cite no source files)

Exit codes:
  0 — success
  1 — RESERVED (not used)
  2 — user/argument error
  3 — infra error
USAGE
}

# --- Helpers ---
_err() {
  echo "ERROR: $*" >&2
}

_info() {
  # Respects --quiet; call after quiet flag is parsed
  if [[ "${QUIET:-0}" != "1" ]]; then
    echo "$*" >&2
  fi
}

# --- Blocklist validation (matches wiki-resolve.sh:53-57 precedent, extended for security) ---
# Rejects chars that can cause path traversal, command injection, or JSON injection.
# Denylist approach preserves wiki-resolve.sh precedent; chars added here go beyond the
# original four to cover shell-special and JSON-special characters that would matter once
# Step 02b adds filesystem writes and the JSON output path is consumed by orchestrators.
_validate_name() {
  local label="$1"
  local value="$2"
  # Original four (wiki-resolve.sh precedent) + shell-special + JSON-special characters.
  # Checked as individual glob patterns to keep the logic readable without eval.
  if [[ "$value" == */* || "$value" == *\\* || "$value" == *..* || "$value" == *" "* || \
        "$value" == *'"'* || "$value" == *'`'* || "$value" == *'$'* || \
        "$value" == *'*'* || "$value" == *'?'* || "$value" == *';'* || \
        "$value" == *'&'* || "$value" == *'|'* || "$value" == *'<'* || \
        "$value" == *'>'* || "$value" == *'('* || "$value" == *')'* || \
        "$value" == *'{'* || "$value" == *'}'* || "$value" == *'['* || \
        "$value" == *']'* ]]; then
    _err "invalid chars in ${label}: ${value}"
    exit 2
  fi
  # Reject values containing newline (null bytes cannot be stored in bash variables and
  # are therefore implicitly rejected by the shell before this function is reached).
  if [[ "$value" == *$'\n'* ]]; then
    _err "invalid chars in ${label}: ${value}"
    exit 2
  fi
}

# --- Slug-specific validation: allows exactly one '/' subdir separator ---
# Each segment on either side of the '/' must pass _validate_name.
# Rejects: '..', leading/trailing '/', more than one '/'.
# Flat slugs (no '/') go through _validate_name directly — same behaviour as before.
_validate_slug() {
  local value="$1"
  # Reject '..' anywhere (belt-and-suspenders; _validate_name also catches this per-segment)
  if [[ "$value" == *..* ]]; then
    _err "invalid slug: '..' not allowed: ${value}"
    exit 2
  fi
  # Reject leading or trailing '/'
  if [[ "$value" == /* || "$value" == */ ]]; then
    _err "invalid slug: leading or trailing '/' not allowed: ${value}"
    exit 2
  fi
  # Count '/' — at most one subdir separator
  local _slashes="${value//[^\/]/}"
  if [[ ${#_slashes} -gt 1 ]]; then
    _err "invalid slug: at most one '/' subdir separator allowed: ${value}"
    exit 2
  fi
  # Validate each segment via _validate_name (handles all metacharacter checks)
  if [[ "$value" == */* ]]; then
    local _seg1="${value%%/*}"
    local _seg2="${value##*/}"
    _validate_name "slug segment" "$_seg1"
    _validate_name "slug segment" "$_seg2"
  else
    _validate_name "slug" "$value"
  fi
}

# --- Frontmatter field presence check (bash-only line-grep, per lint.md:23-26 precedent) ---
# Reads the YAML frontmatter block (between the first two '---' lines) from a file
# and verifies that each required field name appears as a key.
_check_frontmatter_field() {
  local file="$1"
  local field="$2"
  # Only scan within the frontmatter block (lines between first and second '---')
  local in_fm=0
  local found=0
  while IFS= read -r line; do
    if [[ $in_fm -eq 0 && "$line" == "---" ]]; then
      in_fm=1
      continue
    fi
    if [[ $in_fm -eq 1 && "$line" == "---" ]]; then
      break
    fi
    if [[ $in_fm -eq 1 && "$line" == "${field}:"* ]]; then
      found=1
      break
    fi
  done < "$file"
  return $((1 - found))
}

# --- Frontmatter field value reader (single-line scalar values only) ---
# Returns the trimmed value of a scalar frontmatter field on stdout, stripping
# the leading 'field:' prefix, surrounding whitespace, and a single pair of
# matched outer quotes ("..." or '...'). Returns 1 on miss. Multi-line YAML
# scalars (folded/literal blocks) are not supported — those return the first
# line only, which is acceptable for the summary: field by convention.
_read_frontmatter_field() {
  local file="$1"
  local field="$2"
  local in_fm=0
  local value=""
  while IFS= read -r line; do
    if [[ $in_fm -eq 0 && "$line" == "---" ]]; then in_fm=1; continue; fi
    if [[ $in_fm -eq 1 && "$line" == "---" ]]; then return 1; fi
    if [[ $in_fm -eq 1 && "$line" == "${field}:"* ]]; then
      value="${line#${field}:}"
      # Trim leading whitespace
      value="${value#"${value%%[![:space:]]*}"}"
      # Strip a single pair of matched outer quotes
      if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then
        value="${value:1:${#value}-2}"
      fi
      printf '%s\n' "$value"
      return 0
    fi
  done < "$file"
  return 1
}

# === Argument parsing ===
# Collect positional args and flags in a single while-loop pass so that
# unknown flags are rejected at ANY position (AC #3 requirement).

DOMAIN=""
SLUG=""
FROM_FILE=""
SCOPE="project"
UPDATE=0
JSON=0
QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      _usage
      exit 0
      ;;
    --from)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        _err "--from requires a path argument"
        exit 2
      fi
      FROM_FILE="$2"
      shift 2
      ;;
    --scope)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        _err "--scope requires a value: project|user"
        exit 2
      fi
      case "$2" in
        project|user) SCOPE="$2" ;;
        *)
          _err "--scope must be 'project' or 'user', got: $2"
          exit 2
          ;;
      esac
      shift 2
      ;;
    --update)
      UPDATE=1
      shift
      ;;
    --json)
      JSON=1
      shift
      ;;
    --quiet)
      QUIET=1
      shift
      ;;
    --)
      shift
      # Treat remaining args as positionals
      while [[ $# -gt 0 ]]; do
        if [[ -z "$DOMAIN" ]]; then
          DOMAIN="$1"
        elif [[ -z "$SLUG" ]]; then
          SLUG="$1"
        else
          _err "unexpected extra argument: $1"
          exit 2
        fi
        shift
      done
      break
      ;;
    -*)
      # Unknown flag — reject at any position
      _err "unknown option: $1"
      exit 2
      ;;
    *)
      # Positional argument
      if [[ -z "$DOMAIN" ]]; then
        DOMAIN="$1"
      elif [[ -z "$SLUG" ]]; then
        SLUG="$1"
      else
        _err "unexpected extra argument: $1"
        exit 2
      fi
      shift
      ;;
  esac
done

# === Validate required positionals ===
if [[ -z "$DOMAIN" ]]; then
  _err "<domain> is required"
  _usage >&2
  exit 2
fi

if [[ -z "$SLUG" ]]; then
  _err "<slug> is required"
  _usage >&2
  exit 2
fi

# === Validate required --from ===
if [[ -z "$FROM_FILE" ]]; then
  _err "--from <payload-file> is required"
  _usage >&2
  exit 2
fi

# === Blocklist validation for domain and slug ===
_validate_name "domain" "$DOMAIN"
_validate_slug "$SLUG"

# === Payload file path safety check (defensive hardening) ===
# Reject paths that contain '..' traversal segments after normalization, or that
# resolve into sensitive system directories. This prevents accidental (or deliberate)
# reads of /etc/passwd, ~/.ssh/id_rsa, etc. via the --from flag.
# Long-term containment policy (e.g., restrict to project root) is deferred to a
# future step; this check establishes the minimal defensive boundary.
_FROM_FILE_REAL="$(realpath -m "$FROM_FILE" 2>/dev/null || echo "$FROM_FILE")"
# Note: realpath -m collapses all '..' components before this point, so the
# normalized path will never literally contain '/../'. The sensitive-directory
# blocklist below is the actual security guard — it operates on the collapsed path.
# Reject sensitive system directories.
for _sensitive in /etc /root /proc /sys; do
  if [[ "$_FROM_FILE_REAL" == "${_sensitive}"/* || "$_FROM_FILE_REAL" == "$_sensitive" ]]; then
    _err "--from path resolves to a sensitive system directory: ${FROM_FILE}"
    exit 2
  fi
done
# Reject ~/.ssh and ~/.gnupg regardless of home expansion.
_HOME_REAL="$(realpath -m "$HOME" 2>/dev/null || echo "$HOME")"
for _sensitive_home in .ssh .gnupg; do
  if [[ "$_FROM_FILE_REAL" == "${_HOME_REAL}/${_sensitive_home}"/* || \
        "$_FROM_FILE_REAL" == "${_HOME_REAL}/${_sensitive_home}" ]]; then
    _err "--from path resolves to a sensitive home directory: ${FROM_FILE}"
    exit 2
  fi
done

# === Payload file readability ===
if [[ ! -f "$FROM_FILE" ]]; then
  _err "payload file not found: ${FROM_FILE}"
  exit 3
fi

if [[ ! -r "$FROM_FILE" ]]; then
  _err "payload file not readable: ${FROM_FILE}"
  exit 3
fi

# === Frontmatter field presence validation ===
# Required fields per spec.md §Component + D17 + D23:
#   tags:, summary:, code-cites:
for field in tags summary code-cites; do
  if ! _check_frontmatter_field "$FROM_FILE" "$field"; then
    _err "payload missing required frontmatter field '${field}' (use [] for principle pages)"
    exit 2
  fi
done

# === Step 02b: Write mechanics ===

# --- Triple-gate resolver (adapted from wiki-resolve.sh:69-88) ---
# Reuses the same probe logic (SKILL.md + '## Pages' + .mditerc entrypoint)
# but operates on the fully-qualified domain name (e.g. claude-code-ref-expert)
# rather than the bare wiki name. Sets SKILL_DIR on success; returns 0 on hit, 1 on miss.
# Never emits stderr. Never modifies the filesystem.
_probe_skill_as_wiki() {
  local domain="$1"
  local dir="${PWD%/}"
  while [ -n "$dir" ]; do
    local skill_dir="$dir/.claude/skills/$domain"
    local skill_md="$skill_dir/SKILL.md"
    local mditerc="$skill_dir/.mditerc"
    if [[ -f "$skill_md" ]]; then
      if grep -q '^## Pages' "$skill_md" 2>/dev/null; then
        if [[ -f "$mditerc" ]] && grep -q '^entrypoint:[[:space:]]*SKILL\.md' "$mditerc" 2>/dev/null; then
          SKILL_DIR="$skill_dir"
          return 0
        fi
      fi
    fi
    local parent="$(dirname "$dir")"
    [ "$parent" = "$dir" ] && break
    dir="$parent"
  done
  return 1
}

# --- Resolve scope-specific skill folder ---
# For project scope: walk up from $PWD via the triple-gate resolver.
# For user scope: check ~/.claude/skills/{domain}/ directly — no walk-up,
#                 no auto-init (forbidden per spec Invariants).
SKILL_DIR=""

if [[ "$SCOPE" == "user" ]]; then
  _user_skill_dir="$HOME/.claude/skills/$DOMAIN"
  if [[ -d "$_user_skill_dir" && -f "$_user_skill_dir/SKILL.md" ]]; then
    SKILL_DIR="$_user_skill_dir"
  else
    _err "auto-init at user scope is forbidden; ${DOMAIN} not found at ${_user_skill_dir}"
    exit 3
  fi
else
  # project scope: attempt triple-gate probe
  if ! _probe_skill_as_wiki "$DOMAIN"; then
    # Domain folder not found at project scope — auto-init permitted.
    # Locate the project root (first ancestor containing .claude/).
    _project_root=""
    _walk="$PWD"
    while [[ -n "$_walk" ]]; do
      if [[ -d "$_walk/.claude/skills" ]]; then
        _project_root="$_walk"
        break
      fi
      _walk_parent="$(dirname "$_walk")"
      [[ "$_walk_parent" == "$_walk" ]] && break
      _walk="$_walk_parent"
    done
    if [[ -z "$_project_root" ]]; then
      _err "cannot locate project .claude/skills/ directory from $PWD"
      exit 3
    fi

    # Determine project name for D26 scaffold (D27 protocol):
    # Primary: git remote origin url parse → repo basename
    # Fallback: git rev-parse --show-toplevel basename
    _project_name=""
    _origin_url="$(git config --get remote.origin.url 2>/dev/null || true)"
    if [[ -n "$_origin_url" ]]; then
      _project_name="$(basename "${_origin_url%.git}")"
    fi
    if [[ -z "$_project_name" ]]; then
      _toplevel="$(git rev-parse --show-toplevel 2>/dev/null || true)"
      if [[ -n "$_toplevel" ]]; then
        _project_name="$(basename "$_toplevel")"
      fi
    fi
    if [[ -z "$_project_name" ]]; then
      _project_name="$DOMAIN"  # last-resort: use domain name itself
    fi

    _new_skill_dir="$_project_root/.claude/skills/$DOMAIN"

    # Refuse to clobber a human-bootstrapped domain folder.
    # If SKILL.md already exists at the target path, this is not a brand-new
    # auto-init — it's a partial-init (missing .mditerc, missing ## Pages, or
    # similar gate failure). Silently scaffolding would destroy custom content.
    if [[ -f "$_new_skill_dir/SKILL.md" ]]; then
      _err "${DOMAIN} exists at ${_new_skill_dir} with an existing SKILL.md but failed the triple-gate probe (likely missing .mditerc with 'entrypoint: SKILL.md', or no '## Pages' line). Refusing to clobber. Run '/wiki-memory init ${DOMAIN}' to safely bootstrap, or hand-fix the missing gate."
      exit 3
    fi

    _info "wiki-write: auto-initializing ${DOMAIN} at project scope under $_new_skill_dir"
    mkdir -p "$_new_skill_dir"

    # Scaffold SKILL.md (D26 hardcoded description)
    cat > "$_new_skill_dir/SKILL.md" <<SKILLMD
---
name: ${DOMAIN}
description: "Project-scoped expert for ${_project_name} domain — populated by /wiki-memory ingest and the researcher agent. <!-- TODO: refine description before publishing -->"
---

## Pages

SKILLMD

    # Scaffold .mditerc
    printf 'entrypoint: SKILL.md\n' > "$_new_skill_dir/.mditerc"

    SKILL_DIR="$_new_skill_dir"
    _info "wiki-write: scaffolded ${DOMAIN} at ${SKILL_DIR}"
  fi
fi

# SKILL_DIR is now set to the resolved domain folder.
TARGET_PAGE="$SKILL_DIR/${SLUG}.md"
SKILL_MD="$SKILL_DIR/SKILL.md"

# --- Dual-scope collision check for project scope ---
# If writing to project scope and the page also exists at user scope, exit 2.
# Skip this check when project and user scope resolve to the same file (symlinked ~/.claude/).
if [[ "$SCOPE" == "project" ]]; then
  _user_twin="$HOME/.claude/skills/$DOMAIN/${SLUG}.md"
  if [[ -f "$_user_twin" && -f "$TARGET_PAGE" ]]; then
    # Resolve both to real paths; skip the collision error if they are the same file.
    _project_real="$(realpath -m "$TARGET_PAGE" 2>/dev/null || echo "$TARGET_PAGE")"
    _user_real="$(realpath -m "$_user_twin" 2>/dev/null || echo "$_user_twin")"
    if [[ "$_project_real" != "$_user_real" ]]; then
      _err "dual-scope collision: ${SLUG}.md exists at BOTH project (${TARGET_PAGE}) and user (${_user_twin}) scope; resolve manually"
      exit 2
    fi
  fi
fi

# --- Slug collision check ---
# Note: there is an inherent check-then-act race between this -f test and the
# mv below, but mv -f on Linux uses rename(2) which is atomic. If another process
# creates TARGET_PAGE after this check, the rename atomically replaces it — this
# is acceptable for a local dev-tool write where --update semantics apply to the
# caller's intent, not to an adversarial race.
ACTION=""
if [[ -f "$TARGET_PAGE" ]]; then
  if [[ "$UPDATE" -eq 0 ]]; then
    _err "slug collision: ${SLUG}.md already exists in ${SKILL_DIR}; use --update to overwrite"
    exit 2
  fi
  ACTION="updated"
else
  ACTION="created"
fi

# --- Atomic write ---
# tmpfile must be in the SAME directory as the target so that mv is an intra-fs rename.
_target_dir="$(dirname "$TARGET_PAGE")"
# Create subdir if needed (supports <subdir>/<slug> patterns; no-op for flat slugs)
if [[ ! -d "$_target_dir" ]]; then
  mkdir -p "$_target_dir" || { _err "cannot create target directory: ${_target_dir}"; exit 3; }
fi
if [[ ! -w "$_target_dir" ]]; then
  _err "target directory is not writable: ${_target_dir}"
  exit 3
fi

# Array of all tmpfiles created during this run; trap removes them all on any exit.
_tmpfiles=()

_cleanup_tmps() {
  local f
  for f in "${_tmpfiles[@]:-}"; do
    [[ -f "$f" ]] && rm -f "$f" || true
  done
}
trap '_cleanup_tmps' EXIT INT TERM

_tmp="$(mktemp "${TARGET_PAGE}.tmp.XXXXXXXXXX")"
_tmpfiles+=("$_tmp")

# Write payload to tmpfile first (never write directly to target).
if ! cp "$FROM_FILE" "$_tmp"; then
  _err "failed to write to tmpfile: ${_tmp}"
  exit 3
fi

# Cross-filesystem sanity check: compare device IDs of tmpfile and target directory.
# On Linux: stat -c '%d' returns device number.
# mv on cross-fs would copy+delete instead of rename, risking race window.
_tmp_dev="$(stat -c '%d' "$_tmp" 2>/dev/null || true)"
_dir_dev="$(stat -c '%d' "$_target_dir" 2>/dev/null || true)"
if [[ -n "$_tmp_dev" && -n "$_dir_dev" && "$_tmp_dev" != "$_dir_dev" ]]; then
  _err "cross-filesystem tmpfile detected (tmp dev=${_tmp_dev}, target dir dev=${_dir_dev}); cannot guarantee atomic rename"
  rm -f "$_tmp"
  exit 3
fi

# Atomic rename: replaces target atomically within same filesystem.
if ! mv -f "$_tmp" "$TARGET_PAGE" 2>/dev/null; then
  _err "atomic rename failed: ${_tmp} → ${TARGET_PAGE}"
  exit 3
fi

# Rename succeeded — remove $_tmp from the tracking array (mv moved it; rm -f is a no-op now).
# The trap stays active to cover any _pages_tmp created below.

_info "wiki-write: wrote ${TARGET_PAGE} (action=${ACTION})"

# --- ## Pages updater (action=created only) ---
if [[ "$ACTION" == "created" ]]; then
  _summary_text="$(_read_frontmatter_field "$FROM_FILE" summary)"
  if [[ -n "$_summary_text" ]]; then
    _new_entry="- [${SLUG}](${SLUG}.md) — ${_summary_text}"
  else
    _new_entry="- [${SLUG}](${SLUG}.md) — <!-- TODO: short description -->"
  fi

  # Read SKILL.md and detect format:
  #   Sub-sectioned: contains '### Standalone Pages' heading → append there.
  #   Flat list:     '## Pages' with direct bullet items → append to end of list.
  if grep -q '^### Standalone Pages' "$SKILL_MD" 2>/dev/null; then
    # Sub-sectioned layout: insert after '### Standalone Pages' heading,
    # after any existing bullets in that section.
    # Strategy: use awk to find the section and append at end of its bullet block.
    _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
    _tmpfiles+=("$_pages_tmp")
    awk -v entry="$_new_entry" '
      /^### Standalone Pages/ { in_sp=1 }
      in_sp && /^$/ && !done {
        # Blank line after section — insert entry before it if we have not yet
        print entry
        done=1
      }
      in_sp && /^##/ && !/^### Standalone Pages/ && !done {
        # A new section starts before a blank line — insert before it
        print entry
        done=1
      }
      { print }
      END { if (in_sp && !done) { print entry } }
    ' "$SKILL_MD" > "$_pages_tmp"
    mv -f "$_pages_tmp" "$SKILL_MD"
  else
    # Flat ## Pages layout: append new entry after the last bullet in the ## Pages section.
    _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
    _tmpfiles+=("$_pages_tmp")
    awk -v entry="$_new_entry" '
      /^## Pages/ { in_pages=1 }
      in_pages && /^## / && !/^## Pages/ { in_pages=0 }
      in_pages && /^- / { last_bullet=NR }
      { lines[NR]=$0 }
      END {
        if (last_bullet > 0) {
          for (i=1; i<=NR; i++) {
            print lines[i]
            if (i == last_bullet) { print entry }
          }
        } else {
          # No bullets yet under ## Pages — append right after the heading
          for (i=1; i<=NR; i++) {
            print lines[i]
            if (lines[i] ~ /^## Pages/) { print entry }
          }
        }
      }
    ' "$SKILL_MD" > "$_pages_tmp"
    mv -f "$_pages_tmp" "$SKILL_MD"
  fi

  _info "wiki-write: updated ## Pages in ${SKILL_MD}"
fi

# --- log.md append ---
_log_file="$SKILL_DIR/log.md"
_ts="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
_log_entry="${_ts} ${ACTION} ${SLUG}"

# Append to log.md; create with minimal header if it does not exist.
if [[ ! -f "$_log_file" ]]; then
  # code-cites: [] required per D23 (pure-principle/log pages get explicit empty list).
  printf -- '---\ntags: [%s/log]\nsummary: "Operations log"\ncode-cites: []\n---\n\n# Operations Log\n\n' \
    "$DOMAIN" > "$_log_file"
fi
printf '%s\n' "$_log_entry" >> "$_log_file"
_info "wiki-write: appended to ${_log_file}: ${_log_entry}"

# --- Output ---
_TARGET_ABS="$(cd "$(dirname "$TARGET_PAGE")" && pwd)/$(basename "$TARGET_PAGE")"

if [[ "$JSON" -eq 1 ]]; then
  # Values passed through denylist already (no '"', '$', '`'); escape as defense-in-depth.
  _DOMAIN_JSON="${DOMAIN//\"/\\\"}"
  _SLUG_JSON="${SLUG//\"/\\\"}"
  _SCOPE_JSON="${SCOPE//\"/\\\"}"
  _ACTION_JSON="${ACTION//\"/\\\"}"
  _PATH_JSON="${_TARGET_ABS//\"/\\\"}"
  printf '{"path":"%s","domain":"%s","slug":"%s","scope":"%s","action":"%s"}\n' \
    "$_PATH_JSON" "$_DOMAIN_JSON" "$_SLUG_JSON" "$_SCOPE_JSON" "$_ACTION_JSON"
else
  printf '%s\n' "$_TARGET_ABS"
fi

exit 0
