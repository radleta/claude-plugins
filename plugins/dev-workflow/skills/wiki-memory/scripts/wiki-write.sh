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
#         slug collision without --update, destructive --update without --replace,
#         --append-section on a page that does not exist, unknown flag)
#   3 — infra error (unreadable payload, filesystem error)
#
# ## Pages nav update has two paths (marker-fenced-regions-convention.md):
#   - Fenced domain (>=1 '<!-- BEGIN:PAGES -->' / '<!-- END:PAGES -->' pair):
#     whole-region regenerate -- every covered entry in every fenced region
#     is rebuilt from its page's current frontmatter summary:, via
#     _wiki_regen_pages_fences.
#   - Unfenced domain: the original per-entry transforms -- resync the one
#     changed entry in place, or insert a new entry (sub-sectioned or flat
#     layout). This path is a deliberate, permanent fallback (D9), not
#     vestigial code the fenced path superseded.

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
       wiki-write <domain> <slug> --append-section <heading> --from <fragment-file>
       wiki-write -h|--help

Write a wiki page to a wiki-backed skill domain.

Arguments:
  <domain>    Wiki domain name (e.g. claude-code-ref-expert). Must not contain
              '/', '\', '..', or spaces.
  <slug>      Page filename without the .md extension (e.g. my-page). May contain
              at most one '/' subdir separator (e.g. backend/my-page). Must not
              contain '..', leading/trailing '/', or shell metacharacters.

Required flags:
  --from <path>     Path to a readable payload markdown file. For a plain
                    create/update, the file must begin with a YAML frontmatter
                    block containing both required fields: tags:, summary:
                    (see below; code-cites: is tolerated if present but is no
                    longer required). For --append-section, the file is a
                    bare content fragment — no frontmatter block required
                    (see --append-section below).

Optional flags:
  --scope project|user   Target wiki scope. Default: project. With --scope user,
                         the target domain must already exist at user scope
                         (~/.claude/skills/{domain}-expert/); auto-init is
                         forbidden at user scope.
  --update               Allow overwriting an existing slug with the full
                         payload (whole-page replace). Without this flag, a
                         slug collision exits 2. With this flag, action=updated.
                         NO-SILENT-SECTION-LOSS GUARD: parses both the existing
                         page and the payload into a heading -> body map and
                         refuses (exit 2, naming the offending heading(s)) on
                         any of three legs, evaluated per existing '## '
                         heading regardless of section count on either side:
                         MISSING (the payload has no H2 with that heading at
                         all), EMPTIED (the payload has the heading but its
                         body lost every non-whitespace character), or SHRUNK
                         (the existing body is substantial and the payload's
                         body retains under 25% of its non-whitespace count).
                         Carrying the heading text alone — as a heading or as
                         prose — is not sufficient; the section's body must
                         survive intact or nearly so. This usually means the
                         caller meant --append-section instead of a full-page
                         overwrite, or that a read-merge-write dropped a
                         section's content while preserving its heading. Pass
                         --replace to force the overwrite anyway.
  --replace              Overrides the no-silent-section-loss guard above; use
                         only for an intentional full-page rewrite via --update.
  --append-section <heading>
                         Append the --from fragment as (if the heading is new)
                         or under (if the heading already exists) an H2
                         section named "## <heading>" in an EXISTING page.
                         All other content on the page is left untouched.
                         Requires the target <slug>.md to already exist (exit
                         2 if it does not — create the page first with a plain
                         write). The fragment file does NOT need frontmatter.
  --json                 Emit JSON result on stdout: {"path":"...","domain":"...",
                         "slug":"...","scope":"project|user",
                         "action":"created|updated|appended"}
  --quiet                Suppress stderr progress messages. Errors still emit.
  -h, --help             Print this usage and exit 0.

Payload frontmatter required fields (plain create/update only):
  tags:         (list; e.g. [domain/page])
  summary:      (string; one-line description)

Payload frontmatter optional fields:
  code-cites:   (list) — DEPRECATED (AD1); no longer required. Tolerated if
                present (AD9 union-read transition); prefer literal markdown
                links in the page body to cite sources instead.
  last-verified: (quoted YAML string, e.g. "2026-07-11") — verification-time
                metadata bumped by lint/groom deep-confirms; distinct from
                the barred edit-time updated: field. If present, MUST be
                quoted — a bare date value is REJECTED (exit 2) since it
                silently breaks the mdite frontmatter query. wiki-write never
                auto-quotes; construct the quoted form yourself.

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

# Restore the destination's file mode onto a tmpfile before it is renamed into
# place. mktemp creates at 0600 and mv is rename(2), which carries the source
# inode's mode to the destination -- so without this every atomic write below
# silently downgrades its target (pages AND SKILL.md) to 0600. Git tracks only
# the executable bit, so the drift never shows up in a diff.
#
# An existing destination keeps its current mode: a page deliberately
# restricted by an operator must not be silently widened. A new destination
# gets the mode a plain shell redirection would have produced (0666 & ~umask),
# which is why the other writers in this script were never affected.
#
# Best-effort by design: on filesystems without POSIX modes (WSL /mnt/c, MSYS)
# chmod is a no-op or an error, and degrading to the previous behaviour beats
# aborting the write under `set -e`.
_apply_target_mode() {
  local _tmpfile="$1" _dest="$2" _mode=""
  if [[ -e "$_dest" ]]; then
    _mode="$(stat -c '%a' "$_dest" 2>/dev/null || true)"
  fi
  if [[ -z "$_mode" ]]; then
    _mode="$(printf '%03o' "$(( 0666 & ~0$(umask) ))")"
  fi
  chmod "$_mode" "$_tmpfile" 2>/dev/null || true
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

# --- last-verified quoting gate (PD7 — validate-and-reject, never auto-quote) ---
# last-verified is verification-time metadata (D5/D17) and is optional — it is
# written only on substantive verification events (a clean deep-confirm or a
# drift correction), not on every write. When present, it MUST be a quoted
# YAML string: a bare (unquoted) date parses as a JS Date in the mdite
# frontmatter query and silently returns []. wiki-write is a pure payload
# passthrough — it never auto-quotes or normalizes a bare value; it rejects
# the payload instead, mirroring the required-field gate in
# _check_frontmatter_field above. Returns 0 if absent or quoted, 1 if present
# but unquoted.
_check_last_verified_quoted() {
  local file="$1"
  local in_fm=0
  local found=0
  local raw_value=""
  while IFS= read -r line; do
    if [[ $in_fm -eq 0 && "$line" == "---" ]]; then
      in_fm=1
      continue
    fi
    if [[ $in_fm -eq 1 && "$line" == "---" ]]; then
      break
    fi
    if [[ $in_fm -eq 1 && "$line" == "last-verified:"* ]]; then
      found=1
      raw_value="${line#last-verified:}"
      # Trim leading whitespace (same idiom as _read_frontmatter_field below)
      raw_value="${raw_value#"${raw_value%%[![:space:]]*}"}"
      break
    fi
  done < "$file"
  [[ $found -eq 0 ]] && return 0
  [[ "$raw_value" == \"*\" || "$raw_value" == \'*\' ]] && return 0
  return 1
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

# --- Fenced-bullet target realpath prescan (marker-fenced-regions-
# convention.md) ---
# Populates the global associative array _TARGET_REALPATH_MAP (bullet link
# target string -> its realpath) by scanning $1 in a single pass, BEFORE the
# nav-mutex critical section -- so _wiki_regen_pages_fences' containment
# check (CWE-22 hardening) below can do a pure-bash map lookup instead of
# spawning a `realpath` subprocess per bullet from inside the lock (D8: no
# subprocess call in the critical section). Requires $_SKILL_DIR_REAL
# (SKILL_DIR's own realpath) to already be set by the caller.
#
# Mirrors _wiki_regen_pages_fences' link-extraction regex and traversal
# denylist exactly (same CWE-22 rejection: '..' anywhere or a leading '/' is
# rejected before ever being stat'ed) -- these two implementations are a
# deliberate pair that must be kept in sync on any future edit to either,
# same as the writer/reader H2 parsers elsewhere in this file (see
# wiki-write-nav-insertion-archived-scoping.md for the sibling-drift bug
# class this kind of duplication risks). Scans every '- [' bullet in the
# whole file, not only lines currently inside a fence -- tracking fence
# state a second time here (duplicating _wiki_regen_pages_fences' own
# BEGIN/END state machine) would double that drift risk for a savings that
# does not matter at this file's realistic bullet counts; an out-of-fence
# target that ends up in the map and is never looked up is inert.
#
# Fail-closed: a target that fails the denylist, does not exist, or resolves
# outside $_SKILL_DIR_REAL is simply left OUT of the map -- never added with
# an empty or sentinel value. _wiki_regen_pages_fences' contract is "not in
# the map => leave the bullet verbatim", identical to today's
# target-does-not-exist and denylist-reject paths.
_wiki_prescan_fence_targets() {
  local _src="$1"
  local _line _target _target_real

  declare -gA _TARGET_REALPATH_MAP=()

  while IFS= read -r _line || [[ -n "$_line" ]]; do
    [[ "$_line" == "- "* ]] || continue
    [[ "$_line" =~ \]\(([^\)]+\.md)\) ]] || continue
    _target="${BASH_REMATCH[1]}"
    [[ "$_target" == *..* || "$_target" == /* ]] && continue
    [[ -n "${_TARGET_REALPATH_MAP[$_target]+x}" ]] && continue
    [[ -f "${SKILL_DIR}/${_target}" ]] || continue
    _target_real="$(realpath -e "${SKILL_DIR}/${_target}" 2>/dev/null || true)"
    if [[ -n "$_target_real" && -n "${_SKILL_DIR_REAL:-}" && \
          "$_target_real" == "${_SKILL_DIR_REAL}/"* ]]; then
      _TARGET_REALPATH_MAP["$_target"]="$_target_real"
    fi
  done < "$_src"
}

# --- Whole-region '## Pages' fence regenerator (marker-fenced-regions-
# convention.md) ---
# Rewrites the body of every '<!-- BEGIN:PAGES -->' / '<!-- END:PAGES -->'
# fenced region in $1 to stdout. For each '- ' bullet found inside a fence,
# the text after its first ' — ' separator is replaced with the linked
# page's CURRENT frontmatter summary: (via _read_frontmatter_field) --
# everything before the separator, including a decorated title's
# ' (archived)' suffix (AD8), survives untouched, mirroring the per-entry
# resync transform above. The separator search is scoped to the text AFTER
# the markdown link's closing ')', not the whole line -- a decorated title
# can itself contain an em dash (e.g. "local-memory vs handoff — Clear
# Boundary" in claude-code-ref-expert's real nav), and a whole-line search
# for the first ' — ' would match inside the title instead of the real
# separator, truncating the link itself. A bullet whose link target file
# does not exist, or whose target page has no summary: field, is left
# verbatim -- regeneration never deletes a nav entry. A bullet whose link
# target is a traversal ('..' anywhere) or an absolute path ('/...') is
# ALSO left verbatim, never dereferenced -- the target comes from arbitrary
# bullet text already sitting in SKILL.md, not from CLI-validated SLUG
# input, so it gets the same '..' rejection _validate_name applies to
# CLI-supplied names (:172-226) before it is ever stat'ed against
# SKILL_DIR (CWE-22). Every line outside a fence -- headings, blank lines,
# other sub-sections, the fence markers themselves -- passes through
# byte-identical. Strictly stronger than a per-entry patch: every entry in
# a touched region is repaired, not just the one entry the write is about
# (spec.md:21). In-process only: _read_frontmatter_field is pure bash with
# no subprocess spawned, so this never shells out (D8 -- never a call to
# `wiki-health fence-scan`). A bullet whose link target resolves (via
# realpath) outside SKILL_DIR is ALSO left verbatim -- the lexical '..'/
# absolute-path denylist below cannot see a same-directory symlink escape
# (e.g. SKILL_DIR/decoy.md -> /etc/passwd referenced as [x](decoy.md)), so
# every candidate is additionally required to resolve under
# $_SKILL_DIR_REAL (SKILL_DIR's own realpath). That containment check does
# NOT run here, though: this function does zero filesystem-resolution work
# and spawns no subprocess at all (D8 applies to the target side too, not
# just SKILL_DIR's own realpath) -- every candidate's realpath was already
# resolved and containment-checked exactly once, before the nav-mutex
# critical section, by _wiki_prescan_fence_targets, which populates the
# global _TARGET_REALPATH_MAP this function only reads via a pure-bash
# lookup below. A target missing from that map (denylist reject,
# resolution failure, containment failure, or a target that did not exist
# in SKILL_MD at prescan time) is treated identically to the
# target-does-not-exist case: left verbatim, never re-resolved here. Both
# the -f existence test and the frontmatter read that follow use the map's
# STORED VALUE (the already-resolved, already-containment-checked absolute
# path), never "${SKILL_DIR}/${_target}" again, PLUS a use-time pure-bash
# walk that `-L`-tests (lstat, no dereference, no subprocess) every path
# component from $_SKILL_DIR_REAL down to the leaf, rejecting the target
# if any of them became a symlink after prescan (CWE-367/CWE-59). That
# narrows the check/use window from the whole lock-hold duration down to
# fork-and-stat latency; it does not reduce it to zero. The inline comment
# at the containment-check block below spells out both why value-pinning
# alone is not sufficient and which residuals remain open.
_wiki_regen_pages_fences() {
  local _src="$1"
  local _line _in_fence=0 _target _link_match _after_link _decorator _summary _prefix
  local _target_verified _walk _rest

  while IFS= read -r _line || [[ -n "$_line" ]]; do
    if [[ "$_line" == '<!-- BEGIN:PAGES -->' ]]; then
      _in_fence=1
      printf '%s\n' "$_line"
      continue
    fi
    if [[ "$_line" == '<!-- END:PAGES -->' ]]; then
      _in_fence=0
      printf '%s\n' "$_line"
      continue
    fi
    if [[ "$_in_fence" -eq 1 && "$_line" == "- "* ]]; then
      _target="" _link_match=""
      if [[ "$_line" =~ \]\(([^\)]+\.md)\) ]]; then
        _target="${BASH_REMATCH[1]}"
        _link_match="${BASH_REMATCH[0]}"
        # Reject a traversal or absolute-path target BEFORE the -f test below
        # ever dereferences it -- this text came from a bullet already
        # sitting in SKILL.md, not from CLI-validated SLUG input, so it gets
        # no automatic trust (CWE-22). Falls through to "leave the bullet
        # verbatim" exactly like the target-does-not-exist case.
        if [[ "$_target" == *..* || "$_target" == /* ]]; then
          _target=""
        fi
      fi
      _target_verified=""
      if [[ -n "$_target" ]]; then
        # Containment check (CWE-22 hardening beyond the lexical denylist
        # above): pure-bash lookup against _TARGET_REALPATH_MAP, populated by
        # _wiki_prescan_fence_targets before the lock -- no `realpath` call
        # here (D8). Capturing the map's VALUE (not just testing the key)
        # matters: the value is the already-resolved, already-containment-
        # checked absolute path from prescan time, and both the -f test and
        # the frontmatter read below are pinned to read through THAT path,
        # never through "${SKILL_DIR}/${_target}" again. A key with no
        # stored value (never resolved, resolution failed, or resolved
        # outside $_SKILL_DIR_REAL) is rejected the same as the
        # target-does-not-exist case below.
        #
        # Pinning to the map's value is NOT sufficient by itself --
        # empirically verified (scratch/marker-fences learned file), not
        # just reasoned: when the target had no symlink anywhere in its
        # chain at prescan time (the common case), realpath's output is
        # BYTE-IDENTICAL to "${SKILL_DIR}/${_target}", so reading through
        # the "verified" value and reading through the original path are
        # the exact same open()-time resolution -- an attacker who swaps
        # something on that identical path for a symlink between prescan
        # and this read (bounded by the nav-lock wait, up to
        # _NAV_LOCK_TIMEOUT_SEC) is followed just the same either way.
        # Hence the walk below: starting AT $_SKILL_DIR_REAL it rebuilds
        # the verified path one component at a time and `-L`-tests each
        # accumulated prefix -- pure bash (lstat, never dereferences),
        # zero subprocess calls (D8). EVERY component is tested, not just
        # the leaf: `-L` on a whole path string lstats only the FINAL
        # component, so a leaf-only test misses an attacker who repoints
        # an intermediate directory instead ('sub' when the target is
        # 'sub/page.md' -- a supported, exercised slug shape, not a corner
        # case), which the kernel then follows transparently to a read
        # landing outside $_SKILL_DIR_REAL. Map values are realpath -e
        # output, canonical by construction, so NO component of a stored
        # value was a symlink at the moment it was captured; any `-L` hit
        # now means that component was replaced after prescan -- reject,
        # exactly like the target-does-not-exist case.
        #
        # Two residuals, documented rather than claimed closed:
        # (1) The walk STARTS at $_SKILL_DIR_REAL and does not re-check
        # SKILL_DIR's own ancestors. Swapping one of those needs write
        # access ABOVE SKILL_DIR, outside this mechanism's threat model
        # (an attacker who can already write inside it).
        # (2) A gap survives between the last `-L` here and the actual
        # open(): the -f test below stats the path again, and the
        # frontmatter read is a $( ) command substitution, which forks a
        # subshell (bash forks for $( ) regardless of the callee being a
        # pure-bash function) whose `< "$file"` open() re-resolves the
        # whole path from scratch. That residual gap is fork-and-stat
        # latency -- microsecond-scale, NOT the lock-hold-duration window
        # (up to _NAV_LOCK_TIMEOUT_SEC, deterministically winnable via
        # manufactured lock contention) the code was exposed to before
        # any of this hardening. Closing it outright means eliminating
        # the subshell, a materially larger change than this. Unaffected
        # either way: the verified file's CONTENTS changing between
        # prescan and read is not a containment escape -- same in-bounds
        # writable-file baseline the whole mechanism already assumes.
        _target_verified="${_TARGET_REALPATH_MAP[$_target]:-}"
        _walk="${_SKILL_DIR_REAL:-}"
        _rest="${_target_verified#"${_walk}/"}"
        if [[ -z "$_target_verified" || -z "$_walk" || "$_rest" == "$_target_verified" ]]; then
          # Not in the map, or -- fail-closed -- not expressible as a path
          # under $_SKILL_DIR_REAL, leaving nothing safe to walk.
          _target="" _target_verified=""
        else
          while [[ -n "$_rest" ]]; do
            _walk="${_walk}/${_rest%%/*}"
            if [[ "$_rest" == */* ]]; then _rest="${_rest#*/}"; else _rest=""; fi
            if [[ -L "$_walk" ]]; then
              _target="" _target_verified=""
              break
            fi
          done
        fi
      fi
      if [[ -n "$_target" && -f "$_target_verified" ]]; then
        _summary=""
        _summary="$(_read_frontmatter_field "$_target_verified" summary || true)"
        if [[ -n "$_summary" ]]; then
          # Everything strictly after the link's closing ')' -- quoted
          # operands below are literal-string matches, not glob patterns.
          _after_link="${_line#*"$_link_match"}"
          if [[ "$_after_link" == *" — "* ]]; then
            # The decorator (e.g. a ' (archived)' suffix, AD8) sits between
            # the link and the real separator -- it is whatever text in
            # _after_link comes BEFORE that separator's first occurrence,
            # scoped to text already past the link so a decorator can never
            # be confused with title content. Empty when there is no
            # decorator (the common case: _after_link starts with the
            # separator itself).
            _decorator="${_after_link%% — *}"
            _prefix="${_line%"$_after_link"}"
            printf '%s%s — %s\n' "$_prefix" "$_decorator" "$_summary"
            continue
          fi
        fi
      fi
    fi
    printf '%s\n' "$_line"
  done < "$_src"
}

# --- Shared H2 heading -> body non-whitespace-char-count parser ---
# Used by the no-silent-section-loss guard (below) on BOTH the existing page
# and the payload — one implementation, invoked twice, so the two sides can
# never drift apart (writer/reader format drift is a recurring pattern in
# this file; see wiki-write-nav-insertion-archived-scoping.md for the sibling
# bug this guards against).
#
# For each '## ' (H2) heading found outside a fenced code block, prints one
# line "<heading>\t<non-whitespace-char-count-of-its-body>" in order of first
# appearance. A heading's body runs until the next heading of the SAME OR
# HIGHER level ('# ' or '## ') outside a fence — a '### ' subsection is
# nested content and stays inside its parent H2's body, it is never itself
# treated as a section boundary. Repeated H2 keys have their bodies summed.
# Trims a single trailing \r before any matching (CRLF pages in the fleet
# would otherwise carry a residual \r into the heading key and never match
# an LF payload's key for the same heading — same idiom as
# _wiki_page_summary_value/_wiki_page_status_value in wiki-health.sh).
# Fence toggle reuses the AD5 idiom already used at wiki-health.sh:286-287,
# wiki-health.sh:627, wiki-health.sh:1822-1823, and churn-check:304-305 —
# inline single-backtick code spans are NOT fence-toggled, a documented,
# accepted limitation carried forward unchanged (see wiki-cites-groom-v2.md).
_wiki_h2_body_nonws() {
  local file="$1"
  awk '
    function bodyadd(line,    tmp) {
      if (key == "") return
      tmp = line
      gsub(/[ \t]/, "", tmp)
      body_nw[key] += length(tmp)
    }
    BEGIN { in_fence = 0; key = ""; n = 0 }
    { line = $0; sub(/\r$/, "", line) }
    line ~ /^```/ || line ~ /^~~~/ { in_fence = !in_fence; bodyadd(line); next }
    in_fence { bodyadd(line); next }
    line ~ /^## / {
      hkey = line
      sub(/[ \t]+$/, "", hkey)
      if (!(hkey in seen)) { seen[hkey] = 1; order[++n] = hkey }
      key = hkey
      next
    }
    line ~ /^# / { key = ""; next }
    { bodyadd(line) }
    END {
      for (i = 1; i <= n; i++) {
        k = order[i]
        print k "\t" (body_nw[k] + 0)
      }
    }
  ' "$file" 2>/dev/null
}

# --- Portable mkdir-based mutex (issue: wiki-write-nav-list-rmw-race) ---
# Guards the '## Pages' nav-list read -> awk-transform -> mv sequence against
# concurrent writers in the same domain. mkdir is atomic on every filesystem
# and every shell it needs to run under, including Git Bash/MSYS on Windows,
# where `flock` is NOT available -- this repo's documented working pattern of
# 6-8 parallel Claude Code sessions makes that race routine, not exotic, so a
# flock-based fix would silently degrade to no locking on that platform.
# `_wiki_nav_lock_acquire` sets the global `_nav_lock_dir` on success so the
# script's single EXIT/INT/TERM trap (`_cleanup_tmps`, further down) can
# always find and release whatever lock this run is holding, on any exit path.
_wiki_nav_lock_acquire() {
  local lock_dir="$1" timeout_sec="$2" stale_sec="$3" poll_sec="$4"
  local start now age lock_mtime stale_pid
  start="$(date +%s)"
  while true; do
    if mkdir "$lock_dir" 2>/dev/null; then
      printf '%s\n' "$$" > "$lock_dir/pid" 2>/dev/null || true
      _nav_lock_dir="$lock_dir"
      return 0
    fi
    # Lock is currently held (or was, by a process that never cleaned up).
    # Break it if it is older than the stale threshold -- otherwise one
    # crashed holder wedges the domain's nav updates permanently.
    lock_mtime="$(stat -c '%Y' "$lock_dir" 2>/dev/null || echo 0)"
    if [[ "$lock_mtime" -gt 0 ]]; then
      now="$(date +%s)"
      age=$(( now - lock_mtime ))
      if [[ "$age" -ge "$stale_sec" ]]; then
        stale_pid="$(cat "$lock_dir/pid" 2>/dev/null || echo unknown)"
        _info "wiki-write: breaking stale nav lock ${lock_dir} (age ${age}s, held by pid ${stale_pid})"
        rm -rf -- "$lock_dir" 2>/dev/null || true
        continue
      fi
    fi
    now="$(date +%s)"
    if (( now - start >= timeout_sec )); then
      return 1
    fi
    sleep "$poll_sec"
  done
}

# Releases whatever nav lock this run is holding (tracked in the global
# `_nav_lock_dir`), if any. Safe to call unconditionally and more than once --
# called both from the normal completion path and from the exit trap.
_wiki_nav_lock_release() {
  if [[ -n "${_nav_lock_dir:-}" && -d "$_nav_lock_dir" ]]; then
    rm -rf -- "$_nav_lock_dir" 2>/dev/null || true
  fi
  _nav_lock_dir=""
}

# === Argument parsing ===
# Collect positional args and flags in a single while-loop pass so that
# unknown flags are rejected at ANY position (AC #3 requirement).

DOMAIN=""
SLUG=""
FROM_FILE=""
SCOPE="project"
UPDATE=0
REPLACE=0
APPEND_SECTION_MODE=0
APPEND_SECTION=""
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
    --replace)
      REPLACE=1
      shift
      ;;
    --append-section)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        _err "--append-section requires a heading name argument"
        exit 2
      fi
      APPEND_SECTION_MODE=1
      APPEND_SECTION="$2"
      shift 2
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

# === --append-section heading validation ===
# Heading text becomes a single "## <heading>" line — reject empty values and
# embedded newlines (which would let a caller smuggle extra lines/headings in).
if [[ "$APPEND_SECTION_MODE" -eq 1 ]]; then
  if [[ -z "$APPEND_SECTION" ]]; then
    _err "--append-section requires a non-empty heading name"
    exit 2
  fi
  if [[ "$APPEND_SECTION" == *$'\n'* ]]; then
    _err "--append-section heading must not contain a newline"
    exit 2
  fi
fi

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
# Required fields per spec.md §Component + D17, amended by AD1/AD9:
#   tags:, summary:
# code-cites: is no longer required — AD1 deprecates the array in favor of
# literal markdown links in the page body; AD9 tolerates the field if present
# during the migration window but wiki-write never enforces it.
# --append-section payloads are content fragments merged into an existing
# page's frontmatter — they are not required to carry their own frontmatter.
if [[ "$APPEND_SECTION_MODE" -eq 0 ]]; then
  for field in tags summary; do
    if ! _check_frontmatter_field "$FROM_FILE" "$field"; then
      _err "payload missing required frontmatter field '${field}'"
      exit 2
    fi
  done
  # last-verified is optional, but if present it MUST be quoted (PD7).
  if ! _check_last_verified_quoted "$FROM_FILE"; then
    _err "payload 'last-verified' value must be a quoted YAML string (e.g. last-verified: \"2026-07-11\") — wiki-write never auto-quotes; a bare date silently breaks the mdite frontmatter query"
    exit 2
  fi
fi

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
    # Name the SPECIFIC failing gate so the caller can fix it directly rather
    # than guessing (gate 1 = SKILL.md presence, already known true here;
    # gate 2 = '## Pages' heading; gate 3 = .mditerc with entrypoint: SKILL.md).
    if [[ -f "$_new_skill_dir/SKILL.md" ]]; then
      if ! grep -q '^## Pages' "$_new_skill_dir/SKILL.md" 2>/dev/null; then
        _gate_fail_detail="gate 2 failed: no '## Pages' heading found in SKILL.md"
      elif [[ ! -f "$_new_skill_dir/.mditerc" ]]; then
        _gate_fail_detail="gate 3 failed: .mditerc not found (fix: printf 'entrypoint: SKILL.md\n' > ${_new_skill_dir}/.mditerc)"
      else
        _gate_fail_detail="gate 3 failed: .mditerc exists but its entrypoint is not 'SKILL.md' (fix: set 'entrypoint: SKILL.md' in ${_new_skill_dir}/.mditerc)"
      fi
      _err "${DOMAIN} exists at ${_new_skill_dir} with an existing SKILL.md but failed the triple-gate probe — ${_gate_fail_detail}. Refusing to clobber. Run '/wiki-memory init ${DOMAIN}' to safely bootstrap, or hand-fix the failing gate."
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
# mv below, but mv -f on Linux uses rename(2) which is atomic. If another
# process creates TARGET_PAGE after this check, the rename atomically
# replaces it -- this remains true and unaffected by the nav lock below: it
# only concerns the PAGE file itself, and --update semantics apply to the
# caller's intent for that one page, not to a wedge against a concurrent
# writer of the SAME slug. The genuinely reachable concurrency defect in this
# script was the '## Pages' nav-list read-modify-write updater further down
# — concurrent creates of DISTINCT slugs in the same domain, an ordinary
# two-sessions-at-once occurrence needing no adversary at all — and that is
# now closed by a mkdir-based lock around the updater (see issue
# wiki-write-nav-list-rmw-race).
ACTION=""
if [[ "$APPEND_SECTION_MODE" -eq 1 ]]; then
  # --append-section only ever targets an EXISTING page — it merges a fragment
  # into it, it never creates a new page from scratch.
  if [[ ! -f "$TARGET_PAGE" ]]; then
    _err "--append-section requires an existing page: ${SLUG}.md not found in ${SKILL_DIR}; create it first with a plain write (no --update)"
    exit 2
  fi
  ACTION="appended"
elif [[ -f "$TARGET_PAGE" ]]; then
  if [[ "$UPDATE" -eq 0 ]]; then
    _err "slug collision: ${SLUG}.md already exists in ${SKILL_DIR}; use --update to overwrite"
    exit 2
  fi
  # --- No-silent-section-loss guard (issue: wiki-write-update-clobbers-existing,
  # wiki-write-slug-misderived-from-project-name,
  # wiki-write-guard-substring-match-bypass) ---
  # --update is a whole-page replace by design. A prior version of this guard
  # tested each existing '## ' heading with an unanchored `grep -qF` against
  # the raw payload file — a substring search that never confirmed the match
  # was actually a heading, and never inspected the section BODY. That let a
  # payload keep a heading with its body wiped, or merely mention a heading
  # in passing prose, and sail through with the section's real content gone.
  # This version parses both sides into heading -> body-non-whitespace-count
  # maps via the shared _wiki_h2_body_nonws parser (one implementation, two
  # invocations, so the two sides can never drift apart) and refuses on any
  # of three legs, evaluated over the existing page's H2s in page order:
  #   MISSING — payload has no H2 with that key at all.
  #   EMPTIED — payload has the H2, but its body lost every non-whitespace
  #             character while the existing body had at least one.
  #   SHRUNK  — payload has the H2, the existing body is substantial (at
  #             least _CLOBBER_MIN_BODY_CHARS non-whitespace chars), and the
  #             payload's body retains under _CLOBBER_SHRINK_PCT percent of
  #             that count.
  # A single-section page is not exempt from any leg. Refuse unless --replace
  # was passed to signal this is an intentional full rewrite.
  if [[ "$REPLACE" -eq 0 ]]; then
    # Minimum existing non-whitespace body size for the SHRUNK leg to engage
    # at all — below this, ordinary condensation is too noisy to gate on a
    # percentage and would false-refuse routine edits.
    _CLOBBER_MIN_BODY_CHARS=80
    # SHRUNK fires when the payload's body retains LESS than this percent of
    # the existing body's non-whitespace char count — deliberately
    # conservative (a substantial section must lose three quarters or more of
    # its content) so ordinary condensation still passes; evisceration does not.
    _CLOBBER_SHRINK_PCT=25

    declare -A _clobber_existing_nw=()
    _clobber_existing_order=()
    while IFS=$'\t' read -r _h2 _nw; do
      [[ -z "$_h2" ]] && continue
      _clobber_existing_order+=("$_h2")
      _clobber_existing_nw["$_h2"]="$_nw"
    done < <(_wiki_h2_body_nonws "$TARGET_PAGE")

    declare -A _clobber_payload_nw=()
    while IFS=$'\t' read -r _h2 _nw; do
      [[ -z "$_h2" ]] && continue
      _clobber_payload_nw["$_h2"]="$_nw"
    done < <(_wiki_h2_body_nonws "$FROM_FILE")

    _clobber_missing_headings=()
    _clobber_emptied_headings=()
    _clobber_shrunk_headings=()
    for _h2 in "${_clobber_existing_order[@]}"; do
      _existing_nw="${_clobber_existing_nw[$_h2]}"
      if [[ -z "${_clobber_payload_nw[$_h2]+x}" ]]; then
        _clobber_missing_headings+=("$_h2")
        continue
      fi
      _payload_nw="${_clobber_payload_nw[$_h2]}"
      if [[ "$_existing_nw" -gt 0 && "$_payload_nw" -eq 0 ]]; then
        _clobber_emptied_headings+=("$_h2")
        continue
      fi
      if [[ "$_existing_nw" -ge "$_CLOBBER_MIN_BODY_CHARS" ]]; then
        if (( _payload_nw * 100 < _existing_nw * _CLOBBER_SHRINK_PCT )); then
          _clobber_shrunk_headings+=("$_h2")
        fi
      fi
    done

    if [[ ${#_clobber_missing_headings[@]} -gt 0 || ${#_clobber_emptied_headings[@]} -gt 0 || ${#_clobber_shrunk_headings[@]} -gt 0 ]]; then
      _clobber_msg="refusing --update: ${SLUG}.md would silently lose content"
      if [[ ${#_clobber_missing_headings[@]} -gt 0 ]]; then
        _clobber_list="$(printf '%s, ' "${_clobber_missing_headings[@]}")"
        _clobber_list="${_clobber_list%, }"
        _clobber_msg+=" — ${#_clobber_missing_headings[@]} existing '## ' heading(s) absent from the payload (${_clobber_list})"
      fi
      if [[ ${#_clobber_emptied_headings[@]} -gt 0 ]]; then
        _clobber_list="$(printf '%s, ' "${_clobber_emptied_headings[@]}")"
        _clobber_list="${_clobber_list%, }"
        _clobber_msg+="; ${#_clobber_emptied_headings[@]} section(s) emptied by the payload (${_clobber_list})"
      fi
      if [[ ${#_clobber_shrunk_headings[@]} -gt 0 ]]; then
        _clobber_list="$(printf '%s, ' "${_clobber_shrunk_headings[@]}")"
        _clobber_list="${_clobber_list%, }"
        _clobber_msg+="; ${#_clobber_shrunk_headings[@]} section(s) reduced to under ${_CLOBBER_SHRINK_PCT}% of their existing content (${_clobber_list})"
      fi
      _clobber_msg+=". Use --append-section to add content without touching existing sections, read-merge-write the full page so the payload carries every existing heading with its body intact, or pass --replace to intentionally replace the whole page."
      _err "$_clobber_msg"
      exit 2
    fi
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
# Nav lock directory held by this run, if any (see _wiki_nav_lock_acquire /
# _wiki_nav_lock_release above). The trap below releases it on any exit path,
# including INT/TERM, so a crash never leaves the domain's nav updates wedged.
_nav_lock_dir=""

_cleanup_tmps() {
  local f
  for f in "${_tmpfiles[@]:-}"; do
    [[ -f "$f" ]] && rm -f "$f" || true
  done
  _wiki_nav_lock_release
}
trap '_cleanup_tmps' EXIT INT TERM

_tmp="$(mktemp "${TARGET_PAGE}.tmp.XXXXXXXXXX")"
_tmpfiles+=("$_tmp")

if [[ "$APPEND_SECTION_MODE" -eq 1 ]]; then
  # Merge the fragment as (new heading) or under (existing heading) the named
  # H2 section, leaving every other line of the existing page untouched.
  #
  # The fragment is read directly from FROM_FILE via awk's own file I/O
  # (getline), NOT passed through -v. `-v var=value` applies the same
  # backslash-escape processing as a string literal in the awk program, so a
  # fragment containing a literal backslash (a Windows path, a regex like
  # `\.md\)`, an escaped shell character) would be silently reinterpreted or
  # corrupted. Reading the file's bytes directly sidesteps that entirely.
  _section_line="## ${APPEND_SECTION}"
  if ! awk -v section="$_section_line" -v payload_file="$FROM_FILE" '
    function emit_payload(   _line) {
      while ((getline _line < payload_file) > 0) print _line
      close(payload_file)
    }
    BEGIN { found = 0; inserted = 0 }
    {
      if ($0 == section && !found) { found = 1; print; next }
      if (found && !inserted && /^## /) {
        emit_payload()
        print ""
        inserted = 1
      }
      print
    }
    END {
      if (found && !inserted) { print ""; emit_payload() }
      if (!found) { print ""; print section; print ""; emit_payload() }
    }
  ' "$TARGET_PAGE" > "$_tmp"; then
    _err "failed to write to tmpfile: ${_tmp}"
    exit 3
  fi
else
  # Write payload to tmpfile first (never write directly to target).
  if ! cp "$FROM_FILE" "$_tmp"; then
    _err "failed to write to tmpfile: ${_tmp}"
    exit 3
  fi
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

# Carry the destination's mode onto the tmpfile before the rename.
_apply_target_mode "$_tmp" "$TARGET_PAGE"

# Atomic rename: replaces target atomically within same filesystem.
if ! mv -f "$_tmp" "$TARGET_PAGE" 2>/dev/null; then
  _err "atomic rename failed: ${_tmp} → ${TARGET_PAGE}"
  exit 3
fi

# Rename succeeded — remove $_tmp from the tracking array (mv moved it; rm -f is a no-op now).
# The trap stays active to cover any _pages_tmp created below.

_info "wiki-write: wrote ${TARGET_PAGE} (action=${ACTION})"

# --- ## Pages updater (created inserts a new entry; updated re-syncs an
# existing entry's summary text) ---
# An --update whose payload carries a changed summary: used to leave the nav
# entry pointing at the old text, which wiki-health then reports as
# NAV_SUMMARY_MISMATCH -- the write itself succeeded, so the mismatch only
# surfaced on the next health run, attributed to nobody.
if [[ "$ACTION" == "created" || "$ACTION" == "updated" ]]; then
  _summary_text="$(_read_frontmatter_field "$FROM_FILE" summary)"
  if [[ -n "$_summary_text" ]]; then
    _new_entry="- [${SLUG}](${SLUG}.md) — ${_summary_text}"
  else
    _new_entry="- [${SLUG}](${SLUG}.md) — <!-- TODO: short description -->"
  fi
  # Exported (once, here) so every awk invocation below that needs
  # $_new_entry / $_summary_text reads it via ENVIRON[] inside a BEGIN
  # block instead of `-v var=value` -- `-v` assignment is escape-sequence
  # processed (POSIX/gawk), and $_summary_text is attacker-reachable
  # payload text (the YAML `summary:` field, read verbatim by
  # _read_frontmatter_field with no denylist, unlike DOMAIN/SLUG). A
  # payload summary containing a literal backslash-n would otherwise be
  # converted to a real newline by `-v` and inject extra lines -- including
  # forged fence markers -- into the fenced ## Pages region. ENVIRON values
  # are never escape-processed. This is the same hazard, and the same
  # `getline`-from-file style mitigation, already applied to the
  # --append-section fragment above (see the comment at its awk block).
  export _new_entry _summary_text
  _NAV_SEP=" — "
  _NAV_MODE="insert"

  # action=updated pre-check, deliberately UNLOCKED and cheap: an ordinary
  # content-only --update must not take the nav mutex or rewrite SKILL.md at
  # all. Only a payload whose summary actually differs from the entry on disk
  # earns the lock + read-modify-write below. The check is re-run under the
  # lock by the transform itself (it is a no-op when nothing matches), so the
  # unlocked read here is an optimization, never the correctness boundary.
  if [[ "$ACTION" == "updated" ]]; then
    _NAV_MODE="resync"
    if [[ -z "$_summary_text" ]]; then
      # No summary in the payload -> nothing authoritative to sync toward.
      # Never overwrite a real nav summary with the TODO placeholder.
      _NAV_MODE="skip"
    else
      _existing_entry="$(awk -v target="](${SLUG}.md)" '
        /^## Pages/ { in_pages=1 }
        in_pages && /^## / && !/^## Pages/ { in_pages=0 }
        in_pages && /^- / && index($0, target) > 0 { print; exit }
      ' "$SKILL_MD" 2>/dev/null || true)"
      if [[ -z "$_existing_entry" ]]; then
        _err "wiki-write: ${SLUG}.md was updated but has no ## Pages entry in ${SKILL_MD}; run wiki-health on ${DOMAIN} to detect/repair the orphan"
        _NAV_MODE="skip"
      elif [[ "$_existing_entry" == *"${_NAV_SEP}${_summary_text}" ]]; then
        _NAV_MODE="skip"
      fi
    fi
  fi
fi

if [[ ( "$ACTION" == "created" || "$ACTION" == "updated" ) && "$_NAV_MODE" != "skip" ]]; then

  # Resolve SKILL_DIR's real path ONCE, here, BEFORE the nav-mutex critical
  # section below -- _wiki_regen_pages_fences' symlink-containment check
  # (CWE-22 hardening) reads this global rather than re-invoking realpath
  # per bullet from inside the lock. Empty on failure (fails closed: every
  # candidate target in the regenerator is then rejected, never trusted).
  _SKILL_DIR_REAL="$(realpath -e "$SKILL_DIR" 2>/dev/null || true)"

  # Pre-resolve every fenced-region bullet's link-target realpath ONCE,
  # here, likewise BEFORE the nav-mutex critical section -- see
  # _wiki_prescan_fence_targets' header comment above for the fail-closed
  # contract this populates ($_TARGET_REALPATH_MAP). Runs unconditionally on
  # fence-presence: the fence probe itself has not run yet at this point
  # (it happens after the lock, unchanged, below), and scanning $SKILL_MD
  # here is cheap enough on an unfenced domain that duplicating the probe
  # early just to skip it is not worth the extra code path (D8 only
  # requires no SUBPROCESS under the lock, not zero pre-lock work).
  _wiki_prescan_fence_targets "$SKILL_MD"

  if [[ "$_NAV_MODE" == "insert" ]]; then
    # The page this write is about was already landed on disk at
    # $TARGET_PAGE (== $SKILL_DIR/${SLUG}.md) earlier above, before this
    # nav-update block runs -- but it cannot appear in the prescan just
    # above, which read $SKILL_MD as it existed BEFORE this write's own
    # entry is inserted into it. Add it explicitly here: SLUG is already
    # CLI-validated (_validate_name, no '..' or leading '/' possible), and
    # the file at $TARGET_PAGE is known to exist at this point in the
    # script, so this resolves and passes containment unconditionally in
    # practice -- still routed through the identical realpath+containment
    # check below, never assumed safe merely because SLUG was validated.
    _new_target_real="$(realpath -e "${SKILL_DIR}/${SLUG}.md" 2>/dev/null || true)"
    if [[ -n "$_new_target_real" && -n "${_SKILL_DIR_REAL:-}" && \
          "$_new_target_real" == "${_SKILL_DIR_REAL}/"* ]]; then
      _TARGET_REALPATH_MAP["${SLUG}.md"]="$_new_target_real"
    fi
  fi

  # --- Serialize the read -> awk-transform -> mv sequence below with the
  # portable mkdir mutex (issue: wiki-write-nav-list-rmw-race). Without it,
  # two concurrent creates in the same domain each read the SAME starting
  # SKILL.md, each produce a version containing only their own entry, and the
  # later mv silently drops the earlier one -- reliably, not just under
  # adversarial timing (measured 1/10 and 3/10 survivors across separate
  # 10-concurrent-create runs pre-fix). Named per the guard-constant style
  # above (_CLOBBER_MIN_BODY_CHARS / _CLOBBER_SHRINK_PCT).
  _NAV_LOCK_DIR="${SKILL_DIR}/.wiki-write-nav.lock"
  _NAV_LOCK_TIMEOUT_SEC=10   # bounded wait for a live holder before giving up
  _NAV_LOCK_STALE_SEC=60     # a lock dir older than this is presumed abandoned by a crashed holder and broken
  _NAV_LOCK_POLL_SEC=0.2     # sleep between acquisition retries while waiting

  if ! _wiki_nav_lock_acquire "$_NAV_LOCK_DIR" "$_NAV_LOCK_TIMEOUT_SEC" "$_NAV_LOCK_STALE_SEC" "$_NAV_LOCK_POLL_SEC"; then
    # The page file has already landed (it is written before this point) --
    # reporting failure now would contradict the filesystem. wiki-health's
    # ORPHAN_PAGE check repairs a page that is on disk but missing from
    # ## Pages, so a lost nav entry here is a lesser failure than a write
    # that reports failure after already mutating the filesystem. Warn and
    # exit 0 rather than fail the whole write.
    if [[ "$_NAV_MODE" == "resync" ]]; then
      _err "wiki-write: nav lock ${_NAV_LOCK_DIR} busy after ${_NAV_LOCK_TIMEOUT_SEC}s -- ${SLUG}.md was updated but its ## Pages summary is NOT yet re-synced; re-run wiki-health on ${DOMAIN} to detect the NAV_SUMMARY_MISMATCH"
    else
      _err "wiki-write: nav lock ${_NAV_LOCK_DIR} busy after ${_NAV_LOCK_TIMEOUT_SEC}s -- ${SLUG}.md was created but is NOT yet listed in ## Pages; re-run wiki-health on ${DOMAIN} to detect/repair the orphan"
    fi
    exit 0
  fi

  # --- Fence-presence probe (in-process; never a subprocess call to
  # `wiki-health fence-scan`, per D8) ---
  # Does this domain's '## Pages' section contain at least one
  # '<!-- BEGIN:PAGES -->' / '<!-- END:PAGES -->' marker pair
  # (marker-fenced-regions-convention.md)? Fenced domains take the
  # whole-region regenerate path below; unfenced domains fall back to the
  # pre-existing per-entry transforms unchanged (D9).
  _fenced=0
  grep -q '<!-- BEGIN:PAGES -->' "$SKILL_MD" 2>/dev/null && _fenced=1 || true

  if [[ "$_fenced" -eq 1 ]]; then
    # --- Whole-region regenerate (fenced domains) ---
    # A fenced region is strictly stronger than a per-entry patch: every
    # region in the domain is rebuilt from each covered page's CURRENT
    # frontmatter summary:, repairing drift on entries OTHER than the one
    # this write touched, not just the entry being written (spec.md:21).
    _regen_src="$SKILL_MD"
    if [[ "$_NAV_MODE" == "insert" ]]; then
      # action=created: the new entry has no prior nav line to regenerate
      # from, so place it first, writing to an intermediate tmp -- then
      # regenerate over THAT result so the new entry's summary (and any
      # other entry's drift) resolves in one pass, under one lock hold,
      # one mv. WHICH region gets the new entry reuses the SAME
      # branch-selection rule the unfenced fallback below uses
      # (sub-sectioned '### Standalone Pages' present vs. flat, unchanged
      # per the decision table's "Region selection for row 1"). The
      # sub-sectioned branch's insertion POSITION differs from the
      # unfenced fallback, though: it is fence-aware here (lands the entry
      # immediately before that region's own '<!-- END:PAGES -->', so it
      # joins the existing bullet run inside the fence rather than landing
      # in the unfenced gap between two runs) instead of reusing the old
      # blank-line/heading heuristic, which predates fences and does not
      # know where a fence boundary sits. That old heuristic stays exactly
      # as-is in the unfenced fallback below (D9) -- its insert-position
      # quirk is out of scope to "fix" there (spec.md:177), but this
      # fenced copy is new code with no such constraint, and an unfenced
      # landing here would permanently escape all future regeneration.
      _insert_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
      _tmpfiles+=("$_insert_tmp")
      if grep -q '^### Standalone Pages' "$SKILL_MD" 2>/dev/null; then
        # Does THIS sub-heading's own section (from the heading to the next
        # '###' or '## ' heading, whichever comes first) contain a fence?
        # Scanned separately, forward, ignoring any intervening blank
        # lines -- 7 of 49 real domains (e.g. aws-lambda-expert) carry a
        # blank line between '### Standalone Pages' and its own
        # '<!-- BEGIN:PAGES -->', and a rule that stops at the first blank
        # line would misfire before ever reaching that fence. The insert
        # awk below is chosen from this result, never from a blank line or
        # heading directly, so the fence markers are always what decide the
        # insertion point when a fence exists.
        _sp_has_fence="$(awk '
          /^### Standalone Pages/ { in_sp=1; next }
          in_sp && /^<!-- BEGIN:PAGES -->/ { print 1; matched=1; exit }
          in_sp && (/^###/ || /^## /) { print 0; matched=1; exit }
          END { if (in_sp && !matched) print 0 }
        ' "$SKILL_MD")"
        if [[ "$_sp_has_fence" == "1" ]]; then
          # Fence-aware: insert before the END marker of the first fenced
          # run following the heading (the run "immediately following" it,
          # per the decision table) -- so the new entry becomes the fence's
          # own last bullet, not a stray line outside any fence, regardless
          # of a blank line sitting between the heading and the fence.
          awk '
            BEGIN { entry = ENVIRON["_new_entry"] }
            /^### Standalone Pages/ { in_sp=1 }
            in_sp && !found_fence && /^<!-- BEGIN:PAGES -->/ { found_fence=1 }
            in_sp && found_fence && !done && /^<!-- END:PAGES -->/ {
              print entry
              done=1
            }
            { print }
          ' "$SKILL_MD" > "$_insert_tmp"
        else
          # No fence under this sub-heading yet (edge case: a still-unfenced
          # '### Standalone Pages' bullet list co-existing with a fenced
          # region elsewhere in the same domain) -- there is no fence
          # boundary to respect, so fall back to the original blank-line/
          # heading heuristic.
          awk '
            BEGIN { entry = ENVIRON["_new_entry"] }
            /^### Standalone Pages/ { in_sp=1 }
            in_sp && /^$/ && !done {
              print entry
              done=1
            }
            in_sp && /^##/ && !/^### Standalone Pages/ && !done {
              print entry
              done=1
            }
            { print }
            END { if (in_sp && !done) { print entry } }
          ' "$SKILL_MD" > "$_insert_tmp"
        fi
      else
        awk '
          BEGIN { entry = ENVIRON["_new_entry"] }
          /^## Pages/ { in_pages=1; pages_line=NR }
          in_pages && /^## / && !/^## Pages/ { in_pages=0 }
          in_pages && /^### Archived/ { in_pages=0 }
          in_pages && /^- / { last_bullet=NR }
          { lines[NR]=$0 }
          END {
            insert_after = (last_bullet > 0) ? last_bullet : pages_line
            for (i=1; i<=NR; i++) {
              print lines[i]
              if (i == insert_after) { print entry }
            }
          }
        ' "$SKILL_MD" > "$_insert_tmp"
      fi
      _regen_src="$_insert_tmp"
    fi

    _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
    _tmpfiles+=("$_pages_tmp")
    _wiki_regen_pages_fences "$_regen_src" > "$_pages_tmp"
    if [[ -n "${_insert_tmp:-}" ]]; then
      rm -f "$_insert_tmp"
    fi

    if cmp -s "$_pages_tmp" "$SKILL_MD"; then
      # Regenerating from unchanged frontmatter across every covered page
      # reproduces the file byte-for-byte -- nothing to land.
      rm -f "$_pages_tmp"
      _wiki_nav_lock_release
      _info "wiki-write: ## Pages entry for ${SLUG} already current; nav unchanged"
      _NAV_MODE="skip"
    else
      _apply_target_mode "$_pages_tmp" "$SKILL_MD"
      mv -f "$_pages_tmp" "$SKILL_MD"
    fi
  elif [[ "$_NAV_MODE" == "resync" ]]; then
    # Rewrite the matching entry's summary in place. Only the text AFTER the
    # first separator is replaced, so a decorated title survives untouched --
    # notably the " (archived)" suffix an entry under '### Archived' may carry
    # (AD8). Scoped to '- ' bullets inside the '## Pages' section so a prose
    # link to the same page elsewhere in SKILL.md is never rewritten. The
    # '### Archived' subsection stays in scope: an archived page's summary
    # must track its frontmatter exactly as an active one does.
    _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
    _tmpfiles+=("$_pages_tmp")
    # summ is read via ENVIRON[], not -v (see the export comment above where
    # $_summary_text is set) -- it is attacker-reachable payload text with no
    # denylist, unlike target/sep below, which are built from CLI-validated
    # SLUG and a fixed literal and so carry no such risk from -v's escape
    # processing.
    awk -v target="](${SLUG}.md)" -v sep="$_NAV_SEP" '
      BEGIN { summ = ENVIRON["_summary_text"] }
      /^## Pages/ { in_pages=1 }
      in_pages && /^## / && !/^## Pages/ { in_pages=0 }
      !done && in_pages && /^- / && index($0, target) > 0 {
        p = index($0, sep)
        if (p > 0) {
          print substr($0, 1, p + length(sep) - 1) summ
          done = 1
          next
        }
      }
      { print }
    ' "$SKILL_MD" > "$_pages_tmp"
    if cmp -s "$_pages_tmp" "$SKILL_MD"; then
      # Another writer re-synced it between the unlocked pre-check and this
      # transform, or the entry carries no separator to rewrite. Either way
      # there is nothing to land -- do not mv an identical file.
      rm -f "$_pages_tmp"
      _wiki_nav_lock_release
      _info "wiki-write: ## Pages entry for ${SLUG} already current; nav unchanged"
      _NAV_MODE="skip"
    else
      _apply_target_mode "$_pages_tmp" "$SKILL_MD"
      mv -f "$_pages_tmp" "$SKILL_MD"
    fi
  # Read SKILL.md and detect format:
  #   Sub-sectioned: contains '### Standalone Pages' heading → append there.
  #   Flat list:     '## Pages' with direct bullet items → append to end of list.
  elif grep -q '^### Standalone Pages' "$SKILL_MD" 2>/dev/null; then
    # Sub-sectioned layout: insert after '### Standalone Pages' heading,
    # after any existing bullets in that section.
    # Strategy: use awk to find the section and append at end of its bullet block.
    _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
    _tmpfiles+=("$_pages_tmp")
    # entry is read via ENVIRON[], not -v -- see the export comment above
    # where $_new_entry is set (same CWE-150 hazard as the fenced branches).
    awk '
      BEGIN { entry = ENVIRON["_new_entry"] }
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
    _apply_target_mode "$_pages_tmp" "$SKILL_MD"
    mv -f "$_pages_tmp" "$SKILL_MD"
  else
    # Flat ## Pages layout: insert the new entry after the last ACTIVE bullet
    # in the ## Pages section. Active-bullet tracking stops at a '### Archived'
    # heading (if present), so the entry lands before it — never appended
    # inside/after the archived block.
    _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
    _tmpfiles+=("$_pages_tmp")
    # entry is read via ENVIRON[], not -v -- see the export comment above
    # where $_new_entry is set (same CWE-150 hazard as the fenced branches).
    awk '
      BEGIN { entry = ENVIRON["_new_entry"] }
      /^## Pages/ { in_pages=1; pages_line=NR }
      in_pages && /^## / && !/^## Pages/ { in_pages=0 }
      in_pages && /^### Archived/ { in_pages=0 }
      in_pages && /^- / { last_bullet=NR }
      { lines[NR]=$0 }
      END {
        insert_after = (last_bullet > 0) ? last_bullet : pages_line
        for (i=1; i<=NR; i++) {
          print lines[i]
          if (i == insert_after) { print entry }
        }
      }
    ' "$SKILL_MD" > "$_pages_tmp"
    _apply_target_mode "$_pages_tmp" "$SKILL_MD"
    mv -f "$_pages_tmp" "$SKILL_MD"
  fi

  if [[ "$_NAV_MODE" != "skip" ]]; then
    _wiki_nav_lock_release
    _info "wiki-write: updated ## Pages in ${SKILL_MD}"
  fi
fi

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
