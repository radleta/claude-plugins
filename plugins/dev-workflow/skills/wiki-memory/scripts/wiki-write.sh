#!/usr/bin/env bash
# wiki-write — Write a wiki page to a wiki-backed skill domain
#
# Usage: wiki-write <domain> <slug> --from <payload-file> [--scope project|user]
#                   [--update] [--json] [--quiet]
#        wiki-write <domain> <slug> --remove [--scope project|user]
#        wiki-write <domain> <old-slug> --rename <new-slug> [--title <text>] [--scope project|user]
#        wiki-write <domain> --hub-sync [--scope project|user]
#        wiki-write -h|--help
#
# Exit codes (repo-local scheme — aligns with wiki-health.sh):
#   0 — success
#   1 — RESERVED (not used)
#   2 — user/argument error (bad args, invalid domain/slug, malformed frontmatter,
#         slug collision without --update, destructive --update without --replace,
#         --append-section on a page that does not exist, unknown flag,
#         --remove on a page that does not exist, --remove with a write flag,
#         --rename from a missing page or onto an existing one)
#   3 — infra error (unreadable payload, filesystem error, --remove or
#         --rename on a domain that does not resolve)
#   4 — --remove / --rename / --hub-sync only: the nav lock was busy, so
#         NOTHING was removed, moved or synced. The write modes exit 0 on a
#         lock timeout because their page write has already landed; these
#         three have touched nothing at that point and can say so.
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
       wiki-write <domain> <slug> --remove
       wiki-write <domain> <old-slug> --rename <new-slug> [--title <text>]
       wiki-write <domain> --hub-sync
       wiki-write -h|--help

Write a wiki page to a wiki-backed skill domain.

Every page write (create, --update, --append-section) regenerates the page's
contents list: a page over 100 lines with a '## ' heading gets one bullet per
heading inside <!-- BEGIN:CONTENTS --> / <!-- END:CONTENTS --> after its H1; a
shorter page loses any fence it had.

Arguments:
  <domain>    Wiki domain name (e.g. claude-code-ref-expert). Must not contain
              '/', '\', '..', or spaces.
  <slug>      Page filename without the .md extension (e.g. my-page). May contain
              at most one '/' subdir separator (e.g. backend/my-page). Must not
              contain '..', leading/trailing '/', or shell metacharacters.
              A grouped page (<group>/<leaf>, leaf not 'index') is listed in
              <group>/index.md's '## Pages', never in SKILL.md; a create
              exits 2, writing nothing, when that index is missing or has no
              '## Pages' heading. An --update there inserts or resyncs the
              page's bullet, or skips the nav step when the index is
              missing or headless.

Required flags:
  --from <path>     Path to a readable payload markdown file. For a plain
                    create/update, the file must begin with a YAML frontmatter
                    block containing both required fields: tags:, summary:
                    (see below; code-cites: is tolerated if present but is no
                    longer required). For --append-section, the file is a
                    bare content fragment — no frontmatter block required
                    (see --append-section below).

Mode flags (mutually exclusive):
  --remove               Delete <slug>.md from the domain and delete its bullet
                         from '## Pages' (anywhere in that section), drop a
                         fence the delete leaves empty, then regenerate the
                         remaining fenced entries. A grouped page's bullet is
                         also dropped from its {group}/index.md. Takes no payload: --from, --update,
                         --replace and --append-section alongside it are
                         rejected at argument parse, before anything is touched.
                         Exits 2 if the page does not exist, 3 if the domain
                         does not resolve (a removal never auto-initializes),
                         and 4 if the nav lock is busy — in which case nothing
                         at all was removed. Also deletes the page's key line
                         from .rulings/. Emits action=removed, then one
                         'referrer <path>' line per *.md file under the skills
                         root (dot-directories excluded) that still links the
                         removed page; --json adds "referrers":[...].
  --rename <new-slug>    Move <slug>.md to <new-slug>.md under the nav lock:
                         re-slug its '## Pages' bullet link in place (a move
                         between SKILL.md and a {group}/index.md, or between
                         two group indexes, inserts the bullet into the new
                         one, then drops it from the old), regenerate
                         fences, and move its .rulings/ key (to the new group's
                         shard when the group changes). A bullet titled exactly
                         <slug> (the title a create writes) is re-titled
                         <new-slug>; any other title is kept. Position,
                         decoration and summary are never changed.
                         Prints 'renamed <old> -> <new>' and one
                         'referrer <path>' line per file still linking the old
                         path; it edits no referrer and runs no git check.
                         Takes no payload and combines with no other mode
                         (exit 2). Exits 2 if <slug>.md does not exist, if
                         <new-slug> is invalid, or if <new-slug>.md exists
                         (that is a merge), or if <new-slug> is a grouped page
                         whose {group}/index.md is missing or has no
                         '## Pages' heading; 3 if the domain does not resolve;
                         4 if the nav lock is busy, with nothing moved.
                         --json emits {"action":"renamed","from":...,"to":...,
                         "referrers":[...]}.
  --hub-sync             Bring the domain's nav into the grouped-page listing
                         convention under the nav lock: move every grouped
                         page's SKILL.md bullet into its {group}/index.md
                         (re-linked relative to the index, a full-slug title
                         becoming the leaf, the summary the page's summary:),
                         list every grouped page its index lacks, and add a
                         SKILL.md bullet for every group hub SKILL.md lacks,
                         carrying the index's summary:. Group indexes are
                         written before SKILL.md. A group whose index is
                         missing or has no '## Pages' heading is skipped and
                         named. Prints one line per change:
                           hub-sync: moved <group>/<leaf> to <group>/index.md
                           hub-sync: listed <group>/<leaf> in <group>/index.md
                           hub-sync: added hub <group>/index.md to SKILL.md
                           hub-sync: skipped <group>: <group>/index.md missing
                           hub-sync: skipped <group>: <group>/index.md has no ## Pages heading
                         or 'hub-sync: nothing to move' when there is none.
                         Takes no slug and no payload (exit 2 with a slug,
                         --from, --update, --replace, --append-section,
                         --remove, --rename, --title or --json); exits 0
                         otherwise, 3 if the domain does not resolve, 4 if
                         the nav lock is busy, with nothing changed.
  --title <text>         --rename only: set the renamed bullet's title to
                         <text>, whatever its current title. Exits 2 when
                         used without --rename, or when <text> is blank or
                         holds '[', ']', '\' or a control character.

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
                         "action":"created|updated|appended|removed"}
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
  page-kind:    (string) — one of reference, map, procedure. Absent means
                reference. Any other value is REJECTED (exit 2): the page
                standard binds its rubric per kind, so a typo must not
                silently fall back. Not checked in --append-section mode.

Exit codes:
  0 — success
  1 — RESERVED (not used)
  2 — user/argument error
  3 — infra error
  4 — --remove / --rename / --hub-sync only: nav lock busy, nothing changed
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
    # A CRLF file's '---' arrives as $'---\r' and matches nothing below, which
    # would make the whole frontmatter block invisible. Same strip in
    # _check_last_verified_quoted and _read_frontmatter_field.
    line="${line%$'\r'}"
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
    line="${line%$'\r'}"
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
    line="${line%$'\r'}"
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
# same as the writer/reader H2 parsers elsewhere in this file. Scans every '- [' bullet in the
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
# everything before the separator, including any decoration after a title's
# link, survives untouched, mirroring the per-entry
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
# byte-identical, except that inside ## Pages an END marker, blank lines and
# a BEGIN marker in a row are dropped, merging two fences into one. Strictly stronger than a per-entry patch: every entry in
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
  # The Blank-Line Rule: inside ## Pages an END marker is held with the blank
  # lines after it; a BEGIN marker next drops all of them, merging the two
  # fences, and any other line prints them first.
  local _in_pages=0 _held_end=0 _held_blanks=0

  while IFS= read -r _line || [[ -n "$_line" ]]; do
    if [[ "$_held_end" -eq 1 ]]; then
      if [[ -z "$_line" ]]; then
        _held_blanks=$((_held_blanks + 1))
        continue
      fi
      _held_end=0
      if [[ "$_line" == '<!-- BEGIN:PAGES -->' ]]; then
        _in_fence=1
        continue
      fi
      printf '<!-- END:PAGES -->\n'
      for ((; _held_blanks > 0; _held_blanks--)); do printf '\n'; done
    fi
    if [[ "$_line" == '## '* ]]; then
      [[ "$_line" == '## Pages'* ]] && _in_pages=1 || _in_pages=0
    fi
    if [[ "$_line" == '<!-- BEGIN:PAGES -->' ]]; then
      _in_fence=1
      printf '%s\n' "$_line"
      continue
    fi
    if [[ "$_line" == '<!-- END:PAGES -->' ]]; then
      _in_fence=0
      if [[ "$_in_pages" -eq 1 ]]; then
        _held_end=1 _held_blanks=0
      else
        printf '%s\n' "$_line"
      fi
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
            # The decorator (any text after the link) sits between
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
  if [[ "$_held_end" -eq 1 ]]; then
    printf '<!-- END:PAGES -->\n'
    for ((; _held_blanks > 0; _held_blanks--)); do printf '\n'; done
  fi
}

# --- Grouped-page listing convention ---
# A grouped leaf is {group}/{leaf} with leaf != index, one level deep. Its one
# nav bullet lives in {group}/index.md '## Pages', linked relative to the
# index as ]({leaf}.md); SKILL.md lists only root pages and group hubs.
# wiki-health.sh carries the same predicate; change both together.
_is_grouped_leaf() { [[ "$1" == */* && "${1##*/}" != index ]]; }

# A nav bullet's first link to a page: every '## Pages' reader below matches
# it through ENVIRON["_WIKI_LINK_RE"], so the bullet-to-page reading is one
# pattern. An ENVIRON string reaches awk as a dynamic regex, unescaped.
export _WIKI_LINK_RE='\]\([^)]+\.md\)'

# Reads or rewrites a group index's '## Pages' list. The list stays unfenced
# and is edited one bullet at a time. Lines inside ``` / ~~~ code blocks and
# multi-line HTML comments are never headings or bullets, the same reading
# wiki-health's group-index checks use. A bullet matches when its FIRST link
# is exactly $_gn_link. Modes, all to stdout:
#   state   'ok' when a '## Pages' heading exists, else 'headless'
#   probe   the first matching bullet, or nothing
#   links   '<file>\t<link target>\t<bullet>' for every bullet's first link, over
#           every file given (the one mode that takes several)
#   upsert  the file with the matching bullet's summary set to $_gn_summary
#           (left alone when that is empty, or the bullet has no separator
#           after its link), or, with no match, $_gn_entry inserted after the
#           list's last bullet (after the heading and one blank line when
#           the list is empty);
#           $_gn_entry may hold several lines
#   delete  the file without any matching bullet
#   repoint the file with each matching bullet's link set to $_gn_new_link
#           and, when its title is $_gn_old_title or $_gn_force_title is 1,
#           the title $_gn_new_title
# Values arrive through ENVIRON, never -v, which escape-processes them.
_wiki_group_nav() {
  local mode="$1"; shift
  _gn_mode="$mode" awk '
    BEGIN { mode = ENVIRON["_gn_mode"]; link = ENVIRON["_gn_link"]; sep = " — " }
    FNR == 1 { in_comment = 0; in_code = 0; in_pages = 0 }
    {
      lines[NR] = $0; skip = 0
      if (in_comment) { skip = 1; if (index($0, "-->")) in_comment = 0 }
      else if ($0 ~ /^(```|~~~)/) { in_code = !in_code; skip = 1 }
      else if (in_code) skip = 1
      else if ($0 ~ /^[ \t]*<!--/ && !index($0, "-->")) { in_comment = 1; skip = 1 }
      if (skip) next
      if ($0 ~ /^## /) {
        in_pages = ($0 ~ /^## Pages/)
        if (in_pages && !pages_line) pages_line = NR
        next
      }
      if (in_pages && $0 ~ /^- /) {
        last_bullet = NR
        if (!match($0, ENVIRON["_WIKI_LINK_RE"])) next
        if (mode == "links") print FILENAME "\t" substr($0, RSTART + 2, RLENGTH - 3) "\t" $0
        if (substr($0, RSTART, RLENGTH) == link) {
          hit[NR] = RSTART + RLENGTH
          if (!first_hit) first_hit = NR
        }
      }
    }
    END {
      if (mode == "links") exit
      if (mode == "state") { print (pages_line ? "ok" : "headless"); exit }
      if (mode == "probe") { if (first_hit) print lines[first_hit]; exit }
      summ = ENVIRON["_gn_summary"]
      after = last_bullet
      if (!after) after = (pages_line && pages_line < NR && lines[pages_line + 1] == "" ? pages_line + 1 : pages_line)
      for (i = 1; i <= NR; i++) {
        line = lines[i]
        if (i in hit) {
          if (mode == "delete") continue
          if (mode == "upsert" && i == first_hit && summ != "") {
            rest = substr(line, hit[i]); p = index(rest, sep)
            if (p > 0) line = substr(line, 1, hit[i] - 1) substr(rest, 1, p - 1) sep summ
          }
          if (mode == "repoint") {
            start = hit[i] - length(link)
            head = substr(line, 1, start - 1)
            if (substr(head, 1, 3) == "- [" && (ENVIRON["_gn_force_title"] == "1" || head == "- [" ENVIRON["_gn_old_title"]))
              head = "- [" ENVIRON["_gn_new_title"]
            line = head ENVIRON["_gn_new_link"] substr(line, hit[i])
          }
        }
        print line
        if (mode == "upsert" && !first_hit && i == after) print ENVIRON["_gn_entry"]
      }
    }
  ' "$@"
}

# Prints SKILL.md file $1 with ENVIRON _new_entry after the last '## Pages'
# bullet. A fence with no bullet inside it (a freshly scaffolded domain)
# takes the entry directly before its END marker instead. Emptiness is judged
# on the fence interior only, so a bullet stranded outside the fence never
# becomes the anchor.
_wiki_pages_append() {
  awk '
    BEGIN { entry = ENVIRON["_new_entry"] }
    /^## Pages/ { in_pages=1; pages_line=NR }
    in_pages && /^## / && !/^## Pages/ { in_pages=0 }
    in_pages && /^<!-- BEGIN:PAGES -->/ { in_fence=1 }
    in_pages && /^<!-- END:PAGES -->/ { if (in_fence && !first_end) first_end=NR; in_fence=0 }
    in_pages && /^- / { last_bullet=NR; if (in_fence) fence_bullets++ }
    { lines[NR]=$0 }
    END {
      insert_before = (first_end > 0 && fence_bullets == 0) ? first_end : 0
      insert_after = insert_before ? 0 : ((last_bullet > 0) ? last_bullet : pages_line)
      for (i=1; i<=NR; i++) {
        if (i == insert_before) { print entry }
        print lines[i]
        if (i == insert_after) { print entry }
      }
    }
  ' "$1"
}

# Prints SKILL.md file $1 without any '## Pages' bullet whose own first link
# is one of the newline-separated links in ENVIRON _remove_target, dropping a fence the delete leaves empty with
# one of its surrounding blank lines: an empty pair holds nothing
# machine-owned, catches no later insert, and reads as an orphaned list.
# Shared by --remove, --rename and --hub-sync. No `exit` in this awk: awk's
# exit still runs END, whose output would land in the rewritten file.
_wiki_pages_delete() {
  awk '
    BEGIN { nt = split(ENVIRON["_remove_target"], t, "\n"); for (i = 1; i <= nt; i++) target[t[i]] = 1; n = 0 }
    /^## Pages/ { in_pages=1 }
    in_pages && /^## / && !/^## Pages/ { in_pages=0 }
    in_pages && /^- / {
      if (match($0, ENVIRON["_WIKI_LINK_RE"]) && (substr($0, RSTART, RLENGTH) in target)) next
    }
    in_pages && $0 == "<!-- END:PAGES -->" && n > 0 && out[n] == "<!-- BEGIN:PAGES -->" {
      n--
      if (n > 0 && out[n] == "") skip_blank = 1
      next
    }
    skip_blank { skip_blank = 0; if ($0 == "") next }
    { out[++n] = $0 }
    END { for (i = 1; i <= n; i++) print out[i] }
  ' "$1"
}

# Prints the first '## Pages' bullet of SKILL.md file $1 whose own first link
# is $2, or nothing.
_wiki_pages_probe() {
  _pp_link="$2" awk '
    BEGIN { target = ENVIRON["_pp_link"] }
    /^## Pages/ { in_pages=1 }
    in_pages && /^## / && !/^## Pages/ { in_pages=0 }
    in_pages && /^- / && match($0, ENVIRON["_WIKI_LINK_RE"]) && substr($0, RSTART, RLENGTH) == target { print; exit }
  ' "$1"
}

# The title a create gives a slug's bullet: the leaf for a grouped leaf, the
# group for {group}/index, else the slug.
_wiki_nav_title() {
  if _is_grouped_leaf "$1"; then printf '%s' "${1##*/}"
  elif [[ "$1" == */* ]]; then printf '%s' "${1%/*}"
  else printf '%s' "$1"; fi
}

# The link a slug's bullet carries inside its nav target.
_wiki_nav_link() {
  if _is_grouped_leaf "$1"; then printf '](%s.md)' "${1##*/}"; else printf '](%s.md)' "$1"; fi
}

# Prints the state of the group index a grouped leaf's slug belongs to:
# ok, missing, or headless (no '## Pages' heading).
_wiki_group_index_state() {
  local idx="${SKILL_DIR}/${1%%/*}/index.md"
  if [[ ! -f "$idx" ]]; then printf 'missing\n'; return 0; fi
  _wiki_group_nav state "$idx"
}

# Applies one _wiki_group_nav rewrite to a group index by tmpfile and
# same-directory rename. Returns 0 when the file changed, 1 when it did not.
_wiki_group_nav_write() {
  local mode="$1" idx="$2" tmp
  tmp="$(mktemp "${idx}.tmp.XXXXXXXXXX")"
  _tmpfiles+=("$tmp")
  _wiki_group_nav "$mode" "$idx" > "$tmp"
  if cmp -s "$tmp" "$idx"; then
    rm -f "$tmp"
    return 1
  fi
  _apply_target_mode "$tmp" "$idx"
  mv -f "$tmp" "$idx"
}

# --- Shared H2 heading -> body non-whitespace-char-count parser ---
# Used by the no-silent-section-loss guard (below) on BOTH the existing page
# and the payload — one implementation, invoked twice, so the two sides can
# never drift apart (writer/reader format drift is a recurring pattern in
# this file).
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
# _wiki_page_summary_value in wiki-health.sh).
# Fence toggle reuses the AD5 idiom already used at wiki-health.sh:286-287,
# wiki-health.sh:627, wiki-health.sh:1822-1823, and churn-check:304-305 —
# inline single-backtick code spans are NOT fence-toggled, a documented,
# accepted limitation carried forward unchanged (see wiki-memory-expert/churn-check.md).
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
REMOVE=0
RENAME=0
HUB_SYNC=0
NEW_SLUG=""
TITLE_SET=0
TITLE=""
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
    --remove)
      REMOVE=1
      shift
      ;;
    --hub-sync)
      HUB_SYNC=1
      shift
      ;;
    --rename)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        _err "--rename requires a <new-slug> argument"
        exit 2
      fi
      RENAME=1
      NEW_SLUG="$2"
      shift 2
      ;;
    --title)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        _err "--title requires a <text> argument"
        exit 2
      fi
      TITLE_SET=1
      TITLE="$2"
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

# --hub-sync acts on the whole domain: no slug, no payload, no other mode.
if [[ "$HUB_SYNC" -eq 1 ]]; then
  _conflicting=""
  [[ -n "$SLUG" ]] && _conflicting="${_conflicting} <slug>"
  [[ "$REMOVE" -eq 1 ]] && _conflicting="${_conflicting} --remove"
  [[ "$RENAME" -eq 1 ]] && _conflicting="${_conflicting} --rename"
  [[ "$UPDATE" -eq 1 ]] && _conflicting="${_conflicting} --update"
  [[ "$REPLACE" -eq 1 ]] && _conflicting="${_conflicting} --replace"
  [[ "$APPEND_SECTION_MODE" -eq 1 ]] && _conflicting="${_conflicting} --append-section"
  [[ -n "$FROM_FILE" ]] && _conflicting="${_conflicting} --from"
  [[ "$TITLE_SET" -eq 1 ]] && _conflicting="${_conflicting} --title"
  [[ "$JSON" -eq 1 ]] && _conflicting="${_conflicting} --json"
  if [[ -n "$_conflicting" ]]; then
    _err "--hub-sync takes no slug and no payload and cannot be combined with:${_conflicting}"
    exit 2
  fi
  _NO_PAYLOAD=1
  _mode_flag="--hub-sync"
fi

if [[ -z "$SLUG" && "$HUB_SYNC" -eq 0 ]]; then
  _err "<slug> is required"
  _usage >&2
  exit 2
fi

# === --remove / --rename mode exclusivity ===
# Neither carries a payload, so neither combines with a mode that writes one,
# or with the other. Rejected here, at argument parse, before the filesystem
# has been touched at all.
[[ "$HUB_SYNC" -eq 1 ]] || _NO_PAYLOAD=0
if [[ "$REMOVE" -eq 1 || "$RENAME" -eq 1 ]]; then
  _NO_PAYLOAD=1
  _mode_flag="--remove"
  [[ "$RENAME" -eq 1 ]] && _mode_flag="--rename"
  _conflicting=""
  [[ "$REMOVE" -eq 1 && "$RENAME" -eq 1 ]] && _conflicting="${_conflicting} --remove"
  [[ "$UPDATE" -eq 1 ]] && _conflicting="${_conflicting} --update"
  [[ "$REPLACE" -eq 1 ]] && _conflicting="${_conflicting} --replace"
  [[ "$APPEND_SECTION_MODE" -eq 1 ]] && _conflicting="${_conflicting} --append-section"
  [[ -n "$FROM_FILE" ]] && _conflicting="${_conflicting} --from"
  if [[ -n "$_conflicting" ]]; then
    _err "${_mode_flag} takes no payload and cannot be combined with:${_conflicting}"
    exit 2
  fi
fi

# === Validate required --from ===
# Mode-conditional: --remove, --rename and --hub-sync have no payload, so the gate does not apply.
if [[ "${_NO_PAYLOAD:-0}" -eq 0 && -z "$FROM_FILE" ]]; then
  _err "--from <payload-file> is required"
  _usage >&2
  exit 2
fi

# === Blocklist validation for domain and slug ===
_validate_name "domain" "$DOMAIN"
[[ "$HUB_SYNC" -eq 1 ]] || _validate_slug "$SLUG"
if [[ "$RENAME" -eq 1 ]]; then
  _validate_slug "$NEW_SLUG"
fi

# === --title validation ===
# The title lands between '- [' and '](' on one bullet line, so a bracket, a
# backslash (which escapes the closing bracket) or a control character would
# break the link or forge extra nav lines.
if [[ "$TITLE_SET" -eq 1 ]]; then
  if [[ "$RENAME" -ne 1 ]]; then
    _err "--title is valid only with --rename"
    exit 2
  fi
  if [[ "$TITLE" != *[^[:space:]]* ]]; then
    _err "--title requires non-blank text"
    exit 2
  fi
  if [[ "$TITLE" == *[][\\]* || "$TITLE" == *[[:cntrl:]]* ]]; then
    _err "--title must not contain '[', ']', '\\' or a control character"
    exit 2
  fi
fi

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

# === Payload validation (skipped wholesale in --remove / --rename mode) ===
# Neither carries a payload -- --from alongside them is already rejected
# above -- so every check below, which reads $FROM_FILE, has nothing to
# act on and must not run.
if [[ "$_NO_PAYLOAD" -eq 0 ]]; then
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
fi

# === Frontmatter field presence validation ===
# Required fields per spec.md §Component + D17, amended by AD1/AD9:
#   tags:, summary:
# code-cites: is no longer required — AD1 deprecates the array in favor of
# literal markdown links in the page body; AD9 tolerates the field if present
# during the migration window but wiki-write never enforces it.
# --append-section payloads are content fragments merged into an existing
# page's frontmatter — they are not required to carry their own frontmatter.
if [[ "$APPEND_SECTION_MODE" -eq 0 && "$_NO_PAYLOAD" -eq 0 ]]; then
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
  # page-kind is optional and absent means reference (page-standard.md D7).
  # When present it must name one of the three kinds the standard binds rules
  # to — a typo that silently fell back to reference would defeat the binding.
  if _check_frontmatter_field "$FROM_FILE" "page-kind"; then
    page_kind_value="$(_read_frontmatter_field "$FROM_FILE" "page-kind" || true)"
    case "$page_kind_value" in
      reference|map|procedure) ;;
      *)
        _err "payload 'page-kind' must be one of: reference, map, procedure (got: '${page_kind_value}')"
        exit 2
        ;;
    esac
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
    # A removal or rename never auto-initializes: scaffolding a domain in
    # order to report that the page it would hold does not exist creates a
    # domain nobody asked for. Unresolvable domain is exit 3, as every other
    # resolution failure is.
    if [[ "$_NO_PAYLOAD" -eq 1 ]]; then
      _err "${_mode_flag}: ${DOMAIN} does not resolve at project scope; a removal or rename never auto-initializes a domain"
      exit 3
    fi
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
      _err "${DOMAIN} exists at ${_new_skill_dir} with an existing SKILL.md but failed the triple-gate probe — ${_gate_fail_detail}. Refusing to clobber. Run '/wiki-init ${DOMAIN}' to safely bootstrap, or hand-fix the failing gate."
      exit 3
    fi

    # Auto-init only into a repository. A walk-up that stops at $HOME has
    # found the user-scope skills tree, and a root outside any git work tree
    # is a stray .claude/skills/ that belongs to no project. -ef, not a string
    # match, so a symlinked path to $HOME is still caught.
    if [[ "$_project_root" -ef "$HOME" ]]; then
      _err "refusing to auto-init ${DOMAIN} from ${PWD}: the .claude/skills/ found walking up is under \$HOME (${_project_root}), the user-scope tree. Run wiki-write from the repository root."
      exit 3
    fi
    if [[ "$(git -C "$_project_root" rev-parse --is-inside-work-tree 2>/dev/null || true)" != "true" ]]; then
      _err "refusing to auto-init ${DOMAIN} from ${PWD}: the .claude/skills/ found walking up (${_project_root}) is not inside a git work tree. Run wiki-write from the repository root."
      exit 3
    fi

    _info "wiki-write: auto-initializing ${DOMAIN} at project scope under $_new_skill_dir"
    mkdir -p "$_new_skill_dir"

    # Scaffold SKILL.md (D26 hardcoded description)
    cat > "$_new_skill_dir/SKILL.md" <<SKILLMD
---
name: ${DOMAIN}
description: "Project-scoped expert for ${_project_name} domain — populated by /ingest and the researcher agent. <!-- TODO: refine description before publishing -->"
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

# --- Output ---
# Defined here, above its callers: the --remove and --rename blocks just below
# call these and exit, and the write paths call it at the very end of the script. One
# escaping implementation, so the two call sites cannot drift apart.
# $TARGET_PAGE need not still exist: only its directory is resolved, and
# --remove leaves that in place.
_emit_result() {
  local action="$1"
  local target_abs
  target_abs="$(cd "$(dirname "$TARGET_PAGE")" && pwd)/$(basename "$TARGET_PAGE")"
  if [[ "$JSON" -eq 1 ]]; then
    # Values passed through denylist already (no '"', '$', '`'); escape as defense-in-depth.
    # --remove appends its referrer array before the closing brace.
    printf '{"path":"%s","domain":"%s","slug":"%s","scope":"%s","action":"%s"' \
      "${target_abs//\"/\\\"}" "${DOMAIN//\"/\\\"}" "${SLUG//\"/\\\"}" \
      "${SCOPE//\"/\\\"}" "${action//\"/\\\"}"
    [[ "$action" == "removed" ]] && printf ',"referrers":%s' "$(_json_array ${_REFERRERS[@]+"${_REFERRERS[@]}"})"
    printf '}\n'
  else
    printf '%s\n' "$target_abs"
    [[ "$action" == "removed" ]] && _print_referrers
  fi
  return 0
}

# --- Referrers and rulings (shared by --remove and --rename) ---

_REFERRERS=()

# JSON string array from the arguments. Referrer paths are arbitrary file
# names, not denylisted input, so backslash, quote and every control
# character are escaped.
_json_array() {
  local out="" item c hex ch
  for item in "$@"; do
    item="${item//\\/\\\\}"
    item="${item//\"/\\\"}"
    if [[ "$item" == *[[:cntrl:]]* ]]; then
      for c in {1..31} 127; do
        printf -v hex '%02x' "$c"
        printf -v ch "\\x${hex}"
        [[ "$item" == *"$ch"* ]] && item="${item//"$ch"/\\u00${hex}}"
      done
    fi
    out+="${out:+,}\"${item}\""
  done
  printf '[%s]' "$out"
}

# One 'referrer <path>' line per referrer. A path holding a control character
# (a newline would forge a second line) is printed in shell-quoted %q form.
_print_referrers() {
  local f
  for f in ${_REFERRERS[@]+"${_REFERRERS[@]}"}; do
    if [[ "$f" == *[[:cntrl:]]* ]]; then printf 'referrer %q\n' "$f"; else printf 'referrer %s\n' "$f"; fi
  done
}

# Fills _REFERRERS with every *.md file under the scope's skills root (the
# domain folder's parent), dot-directories excluded, holding a markdown link
# that resolves to the page path $1. find prunes dot-directories below the
# root (grep --exclude-dir='.*' would also match the root's own '.claude'
# suffix and skip everything); grep narrows to files naming the page's
# basename; awk then resolves each link against its file's directory, so a
# same-named page in another folder is not reported.
_collect_referrers() {
  local page_abs="$1" root f
  root="$(dirname "$SKILL_DIR")"
  _REFERRERS=()
  while IFS= read -r -d '' f; do
    [[ -n "$f" ]] || continue
    if _page_abs="$page_abs" _ref_dir="$(dirname "$f")" awk '
      function norm(p,   n, parts, out, i, m, r) {
        n = split(p, parts, "/"); m = 0
        for (i = 1; i <= n; i++) {
          if (parts[i] == "" || parts[i] == ".") continue
          if (parts[i] == "..") { if (m > 0) m--; continue }
          out[++m] = parts[i]
        }
        r = ""
        for (i = 1; i <= m; i++) r = r "/" out[i]
        return r
      }
      BEGIN { want = norm(ENVIRON["_page_abs"]); dir = ENVIRON["_ref_dir"]; found = 0 }
      {
        rest = $0
        while (!found && match(rest, /\]\([^) \t]+/)) {
          t = substr(rest, RSTART + 2, RLENGTH - 2)
          rest = substr(rest, RSTART + RLENGTH)
          sub(/^</, "", t); sub(/>$/, "", t); sub(/#.*$/, "", t)
          if (t == "" || t ~ /^[A-Za-z][A-Za-z0-9+.-]*:/) continue
          if (norm((t ~ /^\// ? "" : dir "/") t) == want) found = 1
        }
        if (found) exit
      }
      END { exit(found ? 0 : 1) }
    ' "$f"; then
      _REFERRERS+=("$f")
    fi
  done < <(find "$root" -mindepth 1 -name '.*' -prune -o -type f -name '*.md' \
             -exec grep -lZF -- "$(basename "$page_abs")" {} + 2>/dev/null | LC_ALL=C sort -z)
}

# .rulings/ shard for a page slug: '{group}.md' for 'group/page', else '_root.md'.
_rulings_shard_for() {
  if [[ "$1" == */* ]]; then printf '%s.md' "${1%%/*}"; else printf '_root.md'; fi
}

# Refuses (exit 3, nothing touched) when the .rulings/ directory or a shard
# the call would rewrite is a symlink or resolves outside the domain. Runs
# pre-lock; requires $_SKILL_DIR_REAL. $1 is the mode name, the rest are keys.
_rulings_check_contained() {
  local mode="$1"; shift
  local dir="${SKILL_DIR}/.rulings" key shard real
  [[ -e "$dir" || -L "$dir" ]] || return 0
  if [[ -L "$dir" || "$(realpath -e "$dir" 2>/dev/null || true)" != "${_SKILL_DIR_REAL}/.rulings" ]]; then
    _err "${mode}: ${dir} is a symlink or resolves outside ${SKILL_DIR}; NOTHING was changed"
    exit 3
  fi
  for key in "$@"; do
    [[ -n "$key" ]] || continue
    shard="${dir}/$(_rulings_shard_for "$key")"
    real="$(realpath -m "$shard" 2>/dev/null || true)"
    if [[ -L "$shard" || "$real" != "${_SKILL_DIR_REAL}/.rulings/"* ]]; then
      _err "${mode}: ${shard} is a symlink or resolves outside ${SKILL_DIR}; NOTHING was changed"
      exit 3
    fi
  done
}

# Moves every '- `<old-key>` — ...' line to key <new-key>, into the new key's
# shard, or deletes the lines when <new-key> is empty. Shards stay sorted by
# key, and a shard left with no ruling is deleted. The new shard lands before
# the old one is rewritten, so a failure between the two duplicates a ruling
# rather than losing it.
_rulings_move() {
  local old_key="$1" new_key="$2"
  local dir="${SKILL_DIR}/.rulings"
  local old_shard new_shard rest_tmp moved_tmp new_tmp base
  old_shard="${dir}/$(_rulings_shard_for "$old_key")"
  [[ -f "$old_shard" ]] || return 0

  rest_tmp="$(mktemp "${old_shard}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$rest_tmp")
  moved_tmp="$(mktemp "${old_shard}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$moved_tmp")
  _rk_prefix="- \`${old_key}\`" _rk_moved="$moved_tmp" awk '
    BEGIN { p = ENVIRON["_rk_prefix"]; n = length(p); moved = ENVIRON["_rk_moved"] }
    substr($0, 1, n) == p && (length($0) == n || substr($0, n + 1, 1) == " ") {
      print substr($0, n + 1) > moved; next
    }
    { print }
  ' "$old_shard" > "$rest_tmp"
  if [[ ! -s "$moved_tmp" ]]; then
    rm -f "$rest_tmp" "$moved_tmp"
    return 0
  fi

  if [[ -n "$new_key" ]]; then
    new_shard="${dir}/$(_rulings_shard_for "$new_key")"
    base="$new_shard"
    [[ "$new_shard" == "$old_shard" ]] && base="$rest_tmp"
    new_tmp="$(mktemp "${new_shard}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$new_tmp")
    {
      [[ -f "$base" ]] && cat "$base"
      _rk_key="$new_key" awk '{ printf "- `%s`%s\n", ENVIRON["_rk_key"], $0 }' "$moved_tmp"
    } | awk 'NF { k = $0; sub(/^- `/, "", k); sub(/`.*$/, "", k); print k "\t" $0 }' \
      | LC_ALL=C sort -s -t "$(printf '\t')" -k1,1 | cut -f2- > "$new_tmp"
    _apply_target_mode "$new_tmp" "$new_shard"
    mv -f "$new_tmp" "$new_shard"
    if [[ "$new_shard" == "$old_shard" ]]; then
      rm -f "$rest_tmp" "$moved_tmp"
      return 0
    fi
  fi

  if grep -q '[^[:space:]]' "$rest_tmp"; then
    _apply_target_mode "$rest_tmp" "$old_shard"
    mv -f "$rest_tmp" "$old_shard"
  else
    rm -f "$rest_tmp" "$old_shard"
  fi
  rm -f "$moved_tmp"
}


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

# === --remove: delete a page and its nav bullet ===
# The fourth flag mode. It reuses this script's domain resolution, slug
# validation, nav mutex, fence regenerator and result emitter unchanged, and
# reaches none of the payload machinery below.
#
# Ordering is the whole point: unlike create/update, which land the page file
# BEFORE touching the nav and therefore exit 0 on a lock timeout (the write
# already happened; contradicting the filesystem would be worse), this mode has
# touched nothing when it asks for the lock. So it can honestly fail -- exit 4,
# nothing deleted -- and the domain is never left holding a bullet that points
# at a file that is gone.
if [[ "$REMOVE" -eq 1 ]]; then
  if [[ ! -f "$TARGET_PAGE" ]]; then
    _err "--remove: ${SLUG}.md not found in ${SKILL_DIR}; nothing to remove"
    exit 2
  fi

  # Pre-lock, per D8 (no subprocess inside the critical section): resolve
  # SKILL_DIR's real path and prescan every fenced bullet's link target, both
  # of which _wiki_regen_pages_fences reads as globals. Empty on failure --
  # the regenerator fails closed.
  _SKILL_DIR_REAL="$(realpath -e "$SKILL_DIR" 2>/dev/null || true)"
  [[ -n "$_SKILL_DIR_REAL" ]] && _rulings_check_contained "--remove" "$SLUG"
  _wiki_prescan_fence_targets "$SKILL_MD"

  _NAV_LOCK_DIR="${SKILL_DIR}/.wiki-write-nav.lock"
  _NAV_LOCK_TIMEOUT_SEC=10
  _NAV_LOCK_STALE_SEC=60
  _NAV_LOCK_POLL_SEC=0.2

  if ! _wiki_nav_lock_acquire "$_NAV_LOCK_DIR" "$_NAV_LOCK_TIMEOUT_SEC" "$_NAV_LOCK_STALE_SEC" "$_NAV_LOCK_POLL_SEC"; then
    _err "wiki-write: nav lock ${_NAV_LOCK_DIR} busy after ${_NAV_LOCK_TIMEOUT_SEC}s -- NOTHING was removed; ${SLUG}.md and its ## Pages entry are both untouched. Retry when the concurrent writer finishes."
    exit 4
  fi

  # --- Critical section ---
  #
  # Ordering here is a safety property, not a style choice. The rm is the one
  # irreversible step, so EVERYTHING that can fail is done before it: the
  # containment check, the writability probe, both tmpfiles, the bullet delete
  # and the regeneration all run first, against $SKILL_MD only. After the rm
  # only the `mv` remains, into a directory whose writability mktemp just
  # proved. A failure anywhere earlier exits with the page still on disk --
  # which is what the exit-4 contract promises and what stops this mode from
  # manufacturing the dangling-bullet orphan it exists to clean up.

  # Containment (CWE-59/CWE-22). _validate_slug deliberately permits ONE '/'
  # separator, so 'sub/page' is a supported shape and ${SKILL_DIR}/sub may be
  # a symlink pointing outside the domain -- which the -f test above follows
  # transparently. Resolve the victim and refuse unless it lands under
  # $_SKILL_DIR_REAL, the same check _wiki_prescan_fence_targets applies to
  # every bullet target it trusts. Fails closed: an unresolvable path or an
  # unresolvable SKILL_DIR refuses rather than proceeding. The rm below then
  # operates on the CANONICAL path, so no symlinked component is dereferenced
  # a second time. This matters more here than on the write path it mirrors:
  # an overwrite is recoverable from the payload, a delete is not.
  _target_real="$(realpath -e "$TARGET_PAGE" 2>/dev/null || true)"
  if [[ -z "$_target_real" || -z "${_SKILL_DIR_REAL:-}" || \
        "$_target_real" != "${_SKILL_DIR_REAL}/"* ]]; then
    _err "--remove: refusing to delete ${TARGET_PAGE} -- it does not resolve to a path inside ${SKILL_DIR} (symlinked path component?); NOTHING was removed"
    exit 3
  fi

  # Pre-flight the whole nav rewrite before anything is destroyed.
  if [[ ! -w "$SKILL_MD" ]]; then
    _err "--remove: ${SKILL_MD} is not writable; NOTHING was removed"
    exit 3
  fi
  _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
  _tmpfiles+=("$_pages_tmp")
  _debullet_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
  _tmpfiles+=("$_debullet_tmp")

  # Delete the bullet whose OWN link target is this slug, anywhere in the
  # '## Pages' section -- from that heading to the next '## ' heading, fenced
  # or not. A '### ' subsection heading does not match '^## ' (its third
  # character is '#', not a space), so the section scope carries through it.
  #
  # The match is anchored to the bullet's FIRST markdown link, using the same
  # extraction the regenerator uses, rather than a whole-line substring test.
  # A substring test also drops a bullet for a DIFFERENT page whose summary
  # prose happens to link the removed slug -- silently deleting an unrelated
  # nav entry (CWE-707).
  #
  # The regenerator alone cannot do this: it passes a bullet whose target file
  # is missing through VERBATIM and by design, so after the rm it would
  # preserve exactly the bullet this mode exists to remove.
  #
  # No `exit` in this awk: awk's exit still runs END, and anything an END block
  # emitted would land in the rewritten SKILL.md.
  _remove_target="](${SLUG}.md)"
  export _remove_target
  _wiki_pages_delete "$SKILL_MD" > "$_debullet_tmp"

  # A grouped leaf's bullet lives in its group index; drop it there too, into
  # a tmpfile landed after the rm. A missing or headless index skips this
  # step and wiki-health reports the gap.
  _gi_tmp=""
  if _is_grouped_leaf "$SLUG" && [[ "$(_wiki_group_index_state "$SLUG")" == "ok" ]]; then
    _gi_file="${SKILL_DIR}/${SLUG%%/*}/index.md"
    _gi_tmp="$(mktemp "${_gi_file}.tmp.XXXXXXXXXX")"
    _tmpfiles+=("$_gi_tmp")
    _gn_link="$(_wiki_nav_link "$SLUG")" _wiki_group_nav delete "$_gi_file" > "$_gi_tmp"
    if cmp -s "$_gi_tmp" "$_gi_file"; then
      rm -f "$_gi_tmp"; _gi_tmp=""
    else
      _apply_target_mode "$_gi_tmp" "$_gi_file"
    fi
  fi

  # Regenerate the remaining fenced bullets unconditionally: the removal may
  # have been the only edit, but a fenced domain's region is rebuilt wholesale
  # from every covered page's current frontmatter, which repairs drift on the
  # entries that stayed. An unfenced domain has no region to rebuild, so the
  # section-scoped delete above is the whole edit. Both run BEFORE the rm --
  # the removed page's own bullet is already gone from $_debullet_tmp, so the
  # regenerator never looks at the file that is about to disappear.
  if grep -q '<!-- BEGIN:PAGES -->' "$SKILL_MD" 2>/dev/null; then
    _wiki_regen_pages_fences "$_debullet_tmp" > "$_pages_tmp"
  else
    cp "$_debullet_tmp" "$_pages_tmp"
  fi
  rm -f "$_debullet_tmp"

  _nav_changed=1
  cmp -s "$_pages_tmp" "$SKILL_MD" && _nav_changed=0
  if [[ "$_nav_changed" -eq 1 ]]; then
    _apply_target_mode "$_pages_tmp" "$SKILL_MD"
  fi

  # --- Point of no return: everything above is proven, nothing below can be
  # undone. Only the rm and the rename remain.
  rm -f -- "$_target_real" || { _err "--remove: failed to delete ${_target_real}"; exit 3; }
  [[ -n "$_gi_tmp" ]] && mv -f "$_gi_tmp" "$_gi_file"

  if [[ "$_nav_changed" -eq 1 ]]; then
    mv -f "$_pages_tmp" "$SKILL_MD"
    _info "wiki-write: removed ${SLUG}.md and its ## Pages entry in ${SKILL_MD}"
  elif [[ -n "$_gi_tmp" ]]; then
    rm -f "$_pages_tmp"
    _info "wiki-write: removed ${SLUG}.md and its ## Pages entry in ${_gi_file}"
  else
    rm -f "$_pages_tmp"
    _info "wiki-write: ${SLUG}.md removed; no ## Pages entry referenced it"
  fi
  _rulings_move "$SLUG" ""
  _wiki_nav_lock_release

  _collect_referrers "$TARGET_PAGE"
  _emit_result "removed"
  exit 0
fi

# === --rename: move a page, re-slug its nav bullet, move its rulings ===
# Edits only what is machine-owned. Prose links to the old path need judgment
# a script lacks, so they are printed as referrers for the caller to rewrite.
# Like --remove, it asks for the lock before touching anything, so a busy lock
# is an honest exit 4 with nothing moved. No git check: the removal/rename
# gate belongs to the ingestor.
if [[ "$RENAME" -eq 1 ]]; then
  if [[ ! -f "$TARGET_PAGE" ]]; then
    _err "--rename: ${SLUG}.md not found in ${SKILL_DIR}; nothing to rename"
    exit 2
  fi
  NEW_PAGE="$SKILL_DIR/${NEW_SLUG}.md"
  if [[ -e "$NEW_PAGE" ]]; then
    _err "--rename: ${NEW_SLUG}.md already exists in ${SKILL_DIR}; renaming onto an existing page is a merge -- fold the content by hand and --remove the old page"
    exit 2
  fi

  # Nav targets: SKILL.md for a root page or a group hub, the group index for
  # a grouped leaf. The new side must have a home for its bullet.
  _old_idx="" _new_idx=""
  _is_grouped_leaf "$SLUG" && _old_idx="${SKILL_DIR}/${SLUG%%/*}/index.md"
  if _is_grouped_leaf "$NEW_SLUG"; then
    _new_idx="${SKILL_DIR}/${NEW_SLUG%%/*}/index.md"
    case "$(_wiki_group_index_state "$NEW_SLUG")" in
      missing)  _err "--rename: ${NEW_SLUG%%/*}/index.md missing in ${SKILL_DIR}; write the group index first; NOTHING was moved"; exit 2 ;;
      headless) _err "--rename: ${NEW_SLUG%%/*}/index.md has no ## Pages heading in ${SKILL_DIR}; add the heading first; NOTHING was moved"; exit 2 ;;
    esac
  fi
  [[ -n "$_old_idx" && "$(_wiki_group_index_state "$SLUG")" != "ok" ]] && _old_idx_ok=0 || _old_idx_ok=1

  # Pre-lock (D8): containment for both ends, the same check --remove applies.
  # The new page does not exist yet, so its path resolves with -m; a symlinked
  # group folder pointing outside the domain fails containment here.
  _SKILL_DIR_REAL="$(realpath -e "$SKILL_DIR" 2>/dev/null || true)"
  _target_real="$(realpath -e "$TARGET_PAGE" 2>/dev/null || true)"
  _new_real="$(realpath -m "$NEW_PAGE" 2>/dev/null || true)"
  if [[ -z "${_SKILL_DIR_REAL:-}" || "$_target_real" != "${_SKILL_DIR_REAL}/"* || \
        "$_new_real" != "${_SKILL_DIR_REAL}/"* ]]; then
    _err "--rename: ${SLUG} -> ${NEW_SLUG} does not resolve to paths inside ${SKILL_DIR} (symlinked path component?); NOTHING was moved"
    exit 3
  fi
  _rulings_check_contained "--rename" "$SLUG" "$NEW_SLUG"
  _wiki_prescan_fence_targets "$SKILL_MD"

  _NAV_LOCK_DIR="${SKILL_DIR}/.wiki-write-nav.lock"
  _NAV_LOCK_TIMEOUT_SEC=10
  _NAV_LOCK_STALE_SEC=60
  _NAV_LOCK_POLL_SEC=0.2
  if ! _wiki_nav_lock_acquire "$_NAV_LOCK_DIR" "$_NAV_LOCK_TIMEOUT_SEC" "$_NAV_LOCK_STALE_SEC" "$_NAV_LOCK_POLL_SEC"; then
    _err "wiki-write: nav lock ${_NAV_LOCK_DIR} busy after ${_NAV_LOCK_TIMEOUT_SEC}s -- NOTHING was moved; ${SLUG}.md and its ## Pages entry are both untouched. Retry when the concurrent writer finishes."
    exit 4
  fi

  # --- Critical section. Everything that can fail runs before the page moves.
  # A create takes the lock only after landing its page, so the pre-lock
  # existence check is repeated here.
  if [[ -e "$NEW_PAGE" || -L "$NEW_PAGE" ]]; then
    _err "--rename: ${NEW_SLUG}.md appeared in ${SKILL_DIR} while waiting for the lock; renaming onto an existing page is a merge; NOTHING was moved"
    exit 2
  fi
  if [[ ! -w "$SKILL_MD" ]]; then
    _err "--rename: ${SKILL_MD} is not writable; NOTHING was moved"
    exit 3
  fi
  mkdir -p "$(dirname "$NEW_PAGE")" || { _err "--rename: cannot create $(dirname "$NEW_PAGE"); NOTHING was moved"; exit 3; }
  _reslug_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
  _tmpfiles+=("$_reslug_tmp")
  _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
  _tmpfiles+=("$_pages_tmp")

  # Re-slug the bullet whose OWN first link is the old page, anywhere in
  # '## Pages', with the same anchoring --remove uses. The title between '- ['
  # and the link becomes --title when given, else the new slug when it is
  # exactly the old slug; the text after the link is left byte-identical.
  # The title is read through ENVIRON, which is never escape-processed.
  _old_link="](${SLUG}.md)" _new_link="](${NEW_SLUG}.md)" \
  _old_slug="$SLUG" _new_slug="$NEW_SLUG" _title_set="$TITLE_SET" _title="$TITLE" awk '
    BEGIN { old = ENVIRON["_old_link"]; new = ENVIRON["_new_link"] }
    /^## Pages/ { in_pages=1; print; next }
    in_pages && /^## / { in_pages=0 }
    in_pages && /^- / && match($0, ENVIRON["_WIKI_LINK_RE"]) && substr($0, RSTART, RLENGTH) == old {
      head = substr($0, 1, RSTART - 1)
      if (substr(head, 1, 3) == "- [") {
        if (ENVIRON["_title_set"] == "1") head = "- [" ENVIRON["_title"]
        else if (head == "- [" ENVIRON["_old_slug"]) head = "- [" ENVIRON["_new_slug"]
      }
      $0 = head new substr($0, RSTART + RLENGTH)
    }
    { print }
  ' "$SKILL_MD" > "$_reslug_tmp"

  # Group-index side. Within one target the bullet is re-pointed in place;
  # across targets it is carried: inserted into the new target, dropped from
  # the old one, title rules as above. A bullet with nothing to carry is
  # written as a create writes one.
  _old_link="$(_wiki_nav_link "$SLUG")" _new_link="$(_wiki_nav_link "$NEW_SLUG")"
  _ni_tmp="" _oi_tmp="" _title_checked=0
  if [[ -n "$_new_idx" && "$_new_idx" == "$_old_idx" ]]; then
    _ni_tmp="$(mktemp "${_new_idx}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$_ni_tmp")
    _gn_link="$_old_link" _gn_new_link="$_new_link" _gn_old_title="${SLUG##*/}" _gn_force_title="$TITLE_SET" \
      _gn_new_title="$([[ "$TITLE_SET" -eq 1 ]] && printf '%s' "$TITLE" || _wiki_nav_title "$NEW_SLUG")" \
      _wiki_group_nav repoint "$_new_idx" > "$_ni_tmp"
    if [[ "$TITLE_SET" -eq 1 ]]; then
      _title_checked=1
      grep -qF -- "- [${TITLE}${_new_link}" "$_ni_tmp" || \
        _err "--rename: no ## Pages bullet links ${SLUG}.md, so --title was not applied; the page still moves"
    fi
  elif [[ -n "$_new_idx" || -n "$_old_idx" ]]; then
    _carry=""
    [[ -n "$_old_idx" && "$_old_idx_ok" -eq 1 ]] && _carry="$(_gn_link="$_old_link" _wiki_group_nav probe "$_old_idx")"
    _carry_from="$_old_link"
    if [[ -z "$_carry" ]]; then
      _carry="$(_wiki_pages_probe "$SKILL_MD" "](${SLUG}.md)")"
      _carry_from="](${SLUG}.md)"
    fi
    if [[ -n "$_carry" ]]; then
      _head="${_carry%%"$_carry_from"*}"
      if [[ "$TITLE_SET" -eq 1 ]]; then _head="- [${TITLE}"
      elif [[ "$_head" == "- [${SLUG}" || "$_head" == "- [${SLUG##*/}" ]]; then _head="- [$(_wiki_nav_title "$NEW_SLUG")"
      fi
      _new_entry="${_head}${_new_link}${_carry#*"$_carry_from"}"
    else
      _summary_text="$(_read_frontmatter_field "$TARGET_PAGE" summary || true)"
      _new_entry="- [$([[ "$TITLE_SET" -eq 1 ]] && printf '%s' "$TITLE" || _wiki_nav_title "$NEW_SLUG")${_new_link} — ${_summary_text:-<!-- TODO: short description -->}"
    fi
    _title_checked=1
    export _new_entry
    if [[ -n "$_new_idx" ]]; then
      # SKILL.md keeps no bullet for a grouped leaf.
      _remove_target="](${SLUG}.md)" _wiki_pages_delete "$SKILL_MD" > "$_reslug_tmp"
      _ni_tmp="$(mktemp "${_new_idx}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$_ni_tmp")
      _gn_link="$_new_link" _gn_entry="$_new_entry" _gn_summary="" _wiki_group_nav upsert "$_new_idx" > "$_ni_tmp"
    elif [[ -z "$(_wiki_pages_probe "$_reslug_tmp" "$_new_link")" ]]; then
      _append_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$_append_tmp")
      _wiki_pages_append "$_reslug_tmp" > "$_append_tmp"
      mv -f "$_append_tmp" "$_reslug_tmp"
    fi
    if [[ -n "$_old_idx" && "$_old_idx_ok" -eq 1 ]]; then
      _oi_tmp="$(mktemp "${_old_idx}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$_oi_tmp")
      _gn_link="$_old_link" _wiki_group_nav delete "$_old_idx" > "$_oi_tmp"
    fi
  fi
  if [[ "$TITLE_SET" -eq 1 && "$_title_checked" -eq 0 ]] && ! grep -qF -- "- [${TITLE}](${NEW_SLUG}.md)" "$_reslug_tmp"; then
    _err "--rename: no ## Pages bullet links ${SLUG}.md, so --title was not applied; the page still moves"
  fi

  # The page moves before regeneration so the fenced bullet's new target
  # exists when the regenerator stats it; the prescan could not see that
  # path, so its containment-checked value is added here.
  # -n never overwrites and -T never moves into a directory; a page still at
  # its old path afterwards means something occupied the new one.
  mv -n -T -- "$_target_real" "$_new_real" 2>/dev/null
  if [[ -e "$_target_real" || ! -f "$_new_real" ]]; then
    _err "--rename: failed to move ${TARGET_PAGE} to ${NEW_PAGE} (target occupied?); NOTHING was moved"
    exit 3
  fi
  _TARGET_REALPATH_MAP["${NEW_SLUG}.md"]="$_new_real"

  if grep -q '<!-- BEGIN:PAGES -->' "$_reslug_tmp" 2>/dev/null; then
    _wiki_regen_pages_fences "$_reslug_tmp" > "$_pages_tmp"
  else
    cp "$_reslug_tmp" "$_pages_tmp"
  fi
  rm -f "$_reslug_tmp"
  # The new nav target lands first, so a failure between writes leaves the
  # bullet listed twice, never nowhere.
  _rename_land() {
    if cmp -s "$1" "$2"; then rm -f "$1"; else _apply_target_mode "$1" "$2"; mv -f "$1" "$2"; fi
  }
  [[ -n "$_ni_tmp" ]] && _rename_land "$_ni_tmp" "$_new_idx"
  _rename_land "$_pages_tmp" "$SKILL_MD"
  [[ -n "$_oi_tmp" ]] && _rename_land "$_oi_tmp" "$_old_idx"

  _rulings_move "$SLUG" "$NEW_SLUG"
  _wiki_nav_lock_release
  _info "wiki-write: renamed ${SLUG}.md to ${NEW_SLUG}.md in ${SKILL_DIR}"

  _collect_referrers "$TARGET_PAGE"
  if [[ "$JSON" -eq 1 ]]; then
    printf '{"action":"renamed","from":"%s","to":"%s","referrers":%s}\n' \
      "$SLUG" "$NEW_SLUG" "$(_json_array ${_REFERRERS[@]+"${_REFERRERS[@]}"})"
  else
    printf 'renamed %s -> %s\n' "$SLUG" "$NEW_SLUG"
    _print_referrers
  fi
  exit 0
fi


# === --hub-sync: bring a domain's nav into the grouped-page listing convention ===
# Rubric fix (a). Every grouped leaf ends up listed in its group index and
# nowhere in SKILL.md, and every group hub listed in SKILL.md with its index's
# summary:. A group whose index is missing or has no '## Pages' heading is
# skipped and named, its SKILL.md bullets and unlisted leaves left for
# wiki-health to report. Nothing else changes. Every group index lands before
# SKILL.md, so a crash leaves a page listed twice, never nowhere.
if [[ "$HUB_SYNC" -eq 1 ]]; then
  # Pre-lock: the groups on disk, each index's state and summary, and every
  # grouped leaf with its summary. Under the lock every per-group lookup
  # below is one of these associative arrays.
  _SKILL_DIR_REAL="$(realpath -e "$SKILL_DIR" 2>/dev/null || true)"
  _wiki_prescan_fence_targets "$SKILL_MD"
  declare -A _hs_state=() _hs_index_summary=() _hs_leaf_summary=() _hs_group_seen=() _hs_group_work=()
  _hs_groups=() _hs_leaves=()
  while IFS= read -r -d '' _hs_f; do
    _hs_rel="${_hs_f#"$SKILL_DIR"/}"
    _hs_g="${_hs_rel%%/*}"
    case "$_hs_g" in scripts|assets|protocols|fixtures|.*) continue ;; esac
    _hs_leaf="${_hs_rel#*/}"; _hs_leaf="${_hs_leaf%.md}"
    if [[ -z "${_hs_group_seen[$_hs_g]+x}" ]]; then
      _hs_group_seen[$_hs_g]=1
      _hs_groups+=("$_hs_g")
      _hs_state[$_hs_g]="missing"
      if [[ -f "${SKILL_DIR}/${_hs_g}/index.md" ]]; then
        _hs_state[$_hs_g]="$(_wiki_group_nav state "${SKILL_DIR}/${_hs_g}/index.md")"
        _hs_index_summary[$_hs_g]="$(_read_frontmatter_field "${SKILL_DIR}/${_hs_g}/index.md" summary || true)"
        _hs_real="$(realpath -e "${SKILL_DIR}/${_hs_g}/index.md" 2>/dev/null || true)"
        [[ -n "$_hs_real" && -n "$_SKILL_DIR_REAL" && "$_hs_real" == "${_SKILL_DIR_REAL}/"* ]] && \
          _TARGET_REALPATH_MAP["${_hs_g}/index.md"]="$_hs_real"
      fi
    fi
    [[ "$_hs_leaf" == "index" ]] && continue
    _hs_group_work[$_hs_g]=1
    _hs_leaves+=("${_hs_g}/${_hs_leaf}")
    _hs_leaf_summary["${_hs_g}/${_hs_leaf}"]="$(_read_frontmatter_field "$_hs_f" summary || true)"
  done < <(find "$SKILL_DIR" -mindepth 2 -maxdepth 2 -name '*.md' -print0 2>/dev/null | LC_ALL=C sort -z)

  _NAV_LOCK_DIR="${SKILL_DIR}/.wiki-write-nav.lock"
  if ! _wiki_nav_lock_acquire "$_NAV_LOCK_DIR" 10 60 0.2; then
    _err "wiki-write: nav lock ${_NAV_LOCK_DIR} busy after 10s -- NOTHING was changed. Retry when the concurrent writer finishes."
    exit 4
  fi

  # SKILL.md's grouped-leaf bullets and listed hubs, in file order.
  declare -A _hs_skill_bullet=() _hs_hub_listed=() _hs_listed=()
  _hs_skill_order=()
  while IFS=$'\t' read -r _ _hs_target _hs_line; do
    [[ "$_hs_target" == *..* || "$_hs_target" == /* ]] && continue
    _hs_slug="${_hs_target%.md}"
    if [[ "$_hs_slug" == */index && "${_hs_slug%/index}" != */* ]]; then
      _hs_hub_listed[${_hs_slug%/index}]=1
    elif [[ "$_hs_slug" == */* && "${_hs_slug#*/}" != */* ]] && _is_grouped_leaf "$_hs_slug" && \
         [[ -z "${_hs_skill_bullet[$_hs_slug]+x}" ]]; then
      # A bullet whose page is gone stays in SKILL.md for LISTED_PAGE_MISSING.
      [[ -f "${SKILL_DIR}/${_hs_target}" ]] || continue
      _hs_skill_bullet[$_hs_slug]="$_hs_line"
      _hs_skill_order+=("$_hs_slug")
      _hs_group_work[${_hs_slug%%/*}]=1
      if [[ -z "${_hs_group_seen[${_hs_slug%%/*}]+x}" ]]; then
        _hs_group_seen[${_hs_slug%%/*}]=1
        _hs_groups+=("${_hs_slug%%/*}")
      fi
    fi
  done < <(_gn_link="" _wiki_group_nav links "$SKILL_MD")

  # What every usable group index already lists, read in one pass.
  _hs_ok_indexes=()
  for _hs_g in "${_hs_groups[@]}"; do
    [[ "${_hs_state[$_hs_g]:-missing}" == "ok" ]] && _hs_ok_indexes+=("${SKILL_DIR}/${_hs_g}/index.md")
  done
  if [[ ${#_hs_ok_indexes[@]} -gt 0 ]]; then
    while IFS=$'\t' read -r _hs_file _hs_target _; do
      _hs_g="${_hs_file%/index.md}"; _hs_g="${_hs_g##*/}"
      _hs_listed["${_hs_g}/${_hs_target%.md}"]=1
    done < <(_gn_link="" _wiki_group_nav links "${_hs_ok_indexes[@]}")
  fi

  _hs_out=() _hs_remove="" _hs_hub_entries=""
  mapfile -t _hs_sorted < <(printf '%s\n' "${_hs_groups[@]}" | LC_ALL=C sort)
  for _hs_g in "${_hs_sorted[@]}"; do
    [[ -n "$_hs_g" && -n "${_hs_group_work[$_hs_g]+x}" ]] || continue
    case "${_hs_state[$_hs_g]:-missing}" in
      missing)  _hs_out+=("hub-sync: skipped ${_hs_g}: ${_hs_g}/index.md missing"); continue ;;
      headless) _hs_out+=("hub-sync: skipped ${_hs_g}: ${_hs_g}/index.md has no ## Pages heading"); continue ;;
    esac
    _hs_entries=""
    for _hs_slug in ${_hs_skill_order[@]+"${_hs_skill_order[@]}"}; do
      [[ "${_hs_slug%%/*}" == "$_hs_g" ]] || continue
      _hs_leaf="${_hs_slug#*/}"
      _hs_remove+="${_hs_remove:+$'\n'}](${_hs_slug}.md)"
      _hs_out+=("hub-sync: moved ${_hs_slug} to ${_hs_g}/index.md")
      [[ -n "${_hs_listed[$_hs_slug]+x}" ]] && continue
      # The SKILL.md bullet re-linked relative to the index; a title that was
      # the full slug becomes the leaf; the summary is the leaf's summary:.
      _hs_line="${_hs_skill_bullet[$_hs_slug]}"
      _hs_head="${_hs_line%%"](${_hs_slug}.md)"*}"
      _hs_rest="${_hs_line#*"](${_hs_slug}.md)"}"
      [[ "$_hs_head" == "- [${_hs_slug}" ]] && _hs_head="- [${_hs_leaf}"
      _hs_sum="${_hs_leaf_summary[$_hs_slug]:-}"
      if [[ -n "$_hs_sum" ]]; then
        if [[ "$_hs_rest" == *" — "* ]]; then _hs_rest="${_hs_rest%% — *} — ${_hs_sum}"; else _hs_rest="${_hs_rest} — ${_hs_sum}"; fi
      fi
      _hs_entries+="${_hs_entries:+$'\n'}${_hs_head}](${_hs_leaf}.md)${_hs_rest}"
      _hs_listed[$_hs_slug]=1
    done
    for _hs_slug in ${_hs_leaves[@]+"${_hs_leaves[@]}"}; do
      [[ "${_hs_slug%%/*}" == "$_hs_g" && -z "${_hs_listed[$_hs_slug]+x}" ]] || continue
      _hs_leaf="${_hs_slug#*/}"
      _hs_entries+="${_hs_entries:+$'\n'}- [${_hs_leaf}](${_hs_leaf}.md) — ${_hs_leaf_summary[$_hs_slug]:-<!-- TODO: short description -->}"
      _hs_out+=("hub-sync: listed ${_hs_slug} in ${_hs_g}/index.md")
    done
    if [[ -z "${_hs_hub_listed[$_hs_g]+x}" ]]; then
      _hs_hub_entries+="${_hs_hub_entries:+$'\n'}- [${_hs_g}](${_hs_g}/index.md) — ${_hs_index_summary[$_hs_g]:-<!-- TODO: short description -->}"
      _hs_out+=("hub-sync: added hub ${_hs_g}/index.md to SKILL.md")
    fi
    if [[ -n "$_hs_entries" ]]; then
      _gn_link="" _gn_summary="" _gn_entry="$_hs_entries" \
        _wiki_group_nav_write upsert "${SKILL_DIR}/${_hs_g}/index.md" || true
    fi
  done

  if [[ -n "$_hs_remove" || -n "$_hs_hub_entries" ]]; then
    _hs_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$_hs_tmp")
    _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"; _tmpfiles+=("$_pages_tmp")
    # Hub bullets go in before the delete: the delete drops a fence it leaves
    # empty, and the hubs must land inside that fence, not after the heading.
    if [[ -n "$_hs_hub_entries" ]]; then
      _new_entry="$_hs_hub_entries" _wiki_pages_append "$SKILL_MD" > "$_hs_tmp"
    else
      cp "$SKILL_MD" "$_hs_tmp"
    fi
    if [[ -n "$_hs_remove" ]]; then
      _remove_target="$_hs_remove" _wiki_pages_delete "$_hs_tmp" > "$_pages_tmp"
      mv -f "$_pages_tmp" "$_hs_tmp"
    fi
    if grep -q '<!-- BEGIN:PAGES -->' "$_hs_tmp" 2>/dev/null; then
      _wiki_regen_pages_fences "$_hs_tmp" > "$_pages_tmp"
    else
      cp "$_hs_tmp" "$_pages_tmp"
    fi
    rm -f "$_hs_tmp"
    if cmp -s "$_pages_tmp" "$SKILL_MD"; then
      rm -f "$_pages_tmp"
    else
      _apply_target_mode "$_pages_tmp" "$SKILL_MD"
      mv -f "$_pages_tmp" "$SKILL_MD"
    fi
  fi
  _wiki_nav_lock_release

  if [[ ${#_hs_out[@]} -eq 0 ]]; then
    printf 'hub-sync: nothing to move\n'
  else
    printf '%s\n' "${_hs_out[@]}"
  fi
  exit 0
fi

# --- Dual-scope collision check for project scope ---
# If writing to project scope and the page also exists at user scope, exit 2.
# Skip this check when project and user scope resolve to the same file (symlinked ~/.claude/),
# or to the same repo path in two worktrees of one repository: ~/.claude/skills links to
# the main checkout while the session works in a lane worktree. That is one page, and the
# write goes to the project-scope copy, the checkout the session works in.
if [[ "$SCOPE" == "project" ]]; then
  _user_twin="$HOME/.claude/skills/$DOMAIN/${SLUG}.md"
  # -ef compares device and inode. Comparing realpath output does not work here:
  # MSYS preserves the input path's style, so one file reached as D:/repo/... and
  # via $HOME yields two spellings that never string-match.
  if [[ -f "$_user_twin" && -f "$TARGET_PAGE" ]] && ! [[ "$TARGET_PAGE" -ef "$_user_twin" ]]; then
    _p_dir="$(dirname "$TARGET_PAGE")"
    _u_dir="$(dirname "$_user_twin")"
    _p_common="$(git -C "$_p_dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
    _u_common="$(git -C "$_u_dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
    _p_prefix="$(git -C "$_p_dir" rev-parse --show-prefix 2>/dev/null || true)"
    _u_prefix="$(git -C "$_u_dir" rev-parse --show-prefix 2>/dev/null || true)"
    if ! [[ -n "$_p_common" && "$_p_common" -ef "$_u_common" && -n "$_p_prefix" && "$_p_prefix" == "$_u_prefix" ]]; then
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

# A created grouped leaf's bullet goes into its group index, so that index
# must exist and carry a '## Pages' heading before the page lands.
if [[ "$ACTION" == "created" ]] && _is_grouped_leaf "$SLUG"; then
  case "$(_wiki_group_index_state "$SLUG")" in
    missing)
      _err "${SLUG%%/*}/index.md missing in ${SKILL_DIR}; write the group index first (wiki-write ${DOMAIN} ${SLUG%%/*}/index, its payload carrying a '## Pages' heading); NOTHING was written"
      exit 2 ;;
    headless)
      _err "${SLUG%%/*}/index.md has no ## Pages heading in ${SKILL_DIR}; add the heading to the index first; NOTHING was written"
      exit 2 ;;
  esac
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
  # Preserve the target's line endings. awk splits on \n and emits ORS, so a
  # CRLF page would come back LF — rewriting every line of a file the caller
  # only meant to append to. Detect the ending with bash `read`, which keeps
  # the CR (MSYS `grep -c $'\r'` does not report it reliably), and hand it to
  # awk as ORS via ENVIRON rather than -v, which escape-processes its value.
  # Each line is stripped of a trailing CR before use: MSYS gawk opens in text
  # mode and has already done so, but Linux gawk has not, and without the strip
  # the section comparison below would never match on a CRLF page.
  _target_ors=$'\n'
  _first_line=""
  IFS= read -r _first_line < "$TARGET_PAGE" 2>/dev/null || true
  [[ "$_first_line" == *$'\r' ]] && _target_ors=$'\r\n'
  if ! _target_ors="$_target_ors" awk -v section="$_section_line" -v payload_file="$FROM_FILE" '
    function emit_payload(   _line) {
      while ((getline _line < payload_file) > 0) { sub(/\r$/, "", _line); print _line }
      close(payload_file)
    }
    BEGIN { ORS = ENVIRON["_target_ors"]; found = 0; inserted = 0 }
    {
      sub(/\r$/, "")
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

# Contents-list fence, regenerated wholesale on every write (contents-fence.awk);
# exit 10 means the page neither has nor needs one and stays byte-identical.
_cf_tmp="$(mktemp "${TARGET_PAGE}.tmp.XXXXXXXXXX")"
_tmpfiles+=("$_cf_tmp")
_cf_ors=$'\n'
_cf_first=""
IFS= read -r _cf_first < "$_tmp" 2>/dev/null || true
[[ "$_cf_first" == *$'\r' ]] && _cf_ors=$'\r\n'
CF_ORS="$_cf_ors" awk -v mode=write -f "$SCRIPT_DIR/contents-fence.awk" "$_tmp" > "$_cf_tmp" && _cf_rc=0 || _cf_rc=$?
case "$_cf_rc" in
  0)  mv -f "$_cf_tmp" "$_tmp" ;;
  10) rm -f "$_cf_tmp" ;;
  *)  _err "failed to regenerate the contents fence in tmpfile: ${_tmp}"; exit 3 ;;
esac

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
  # --- Nav title/scope for a subdirectory page ---
  # A subdir slug names a page inside a topic group (e.g. scanning/scan-patterns).
  # The nav lists ONE entry per group, pointing at that group's index.md and
  # titled with the bare group name -- the shape the '## Pages' heading promises
  # and the one every hand-built domain already uses. Registering every page
  # flat is what a six-way parallel fan-out once produced in one domain: 36
  # entries across six groups where six belonged, correct and lint-clean but no
  # longer a topic list. Two cases, and only these two:
  #   <dir>/index      -> the group's own entry; title is <dir>, target is
  #                       <dir>/index.md, so the link text stops repeating
  #                       "/index" back at the reader.
  #   <dir>/<other>    -> a grouped leaf: its entry goes into <dir>/index.md's
  #                       '## Pages', titled with the leaf and linked relative
  #                       to the index, never into SKILL.md. A create has
  #                       already refused when that index is missing or
  #                       headless; an update skips the nav step then.
  # A flat slug (no '/') is untouched: it still registers itself.
  _nav_title="$(_wiki_nav_title "$SLUG")"
  _nav_link="$(_wiki_nav_link "$SLUG")"
  _NAV_GROUPED=0
  _is_grouped_leaf "$SLUG" && _NAV_GROUPED=1
  if [[ -n "$_summary_text" ]]; then
    _new_entry="- [${_nav_title}${_nav_link} — ${_summary_text}"
  else
    _new_entry="- [${_nav_title}${_nav_link} — <!-- TODO: short description -->"
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

  # A grouped leaf's nav target is its group index. The unlocked probe keeps
  # a content-only update lock-free; a missing bullet is inserted (an
  # update's heal prints nothing), a drifted summary resynced, and the
  # transform re-reads the index under the lock.
  if [[ "$_NAV_GROUPED" -eq 1 ]]; then
    _NAV_MODE="skip"
    _NAV_INDEX="${SKILL_DIR}/${SLUG%%/*}/index.md"
    if [[ ( "$ACTION" == "created" || -n "$_summary_text" ) && \
          "$(_wiki_group_index_state "$SLUG")" == "ok" ]]; then
      _gn_link="$_nav_link" _gn_entry="$_new_entry" _gn_summary="$_summary_text"
      export _gn_link _gn_entry _gn_summary
      _existing_entry="$(_wiki_group_nav probe "$_NAV_INDEX")"
      if [[ -z "$_existing_entry" || ( -n "$_summary_text" && "$_existing_entry" != *"${_NAV_SEP}${_summary_text}" ) ]]; then
        _NAV_MODE="group"
      fi
    fi
  # action=updated pre-check, deliberately UNLOCKED and cheap: an ordinary
  # content-only --update must not take the nav mutex or rewrite SKILL.md at
  # all. Only a payload whose summary actually differs from the entry on disk
  # earns the lock + read-modify-write below. The check is re-run under the
  # lock by the transform itself (it is a no-op when nothing matches), so the
  # unlocked read here is an optimization, never the correctness boundary.
  elif [[ "$ACTION" == "updated" ]]; then
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

if [[ ( "$ACTION" == "created" || "$ACTION" == "updated" ) && "$_NAV_MODE" == "group" ]]; then
  _NAV_LOCK_DIR="${SKILL_DIR}/.wiki-write-nav.lock"
  if ! _wiki_nav_lock_acquire "$_NAV_LOCK_DIR" 10 60 0.2; then
    _err "wiki-write: nav lock ${_NAV_LOCK_DIR} busy after 10s -- ${SLUG}.md was written but its bullet in ${_NAV_INDEX} is NOT yet current; re-run wiki-health on ${DOMAIN}"
    exit 0
  fi
  _wiki_group_nav_write upsert "$_NAV_INDEX" || true
  _wiki_nav_lock_release
  _NAV_MODE="skip"
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
        _wiki_pages_append "$SKILL_MD" > "$_insert_tmp"
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
    # first separator is replaced, so a decorated title survives untouched.
    # Scoped to '- ' bullets inside the '## Pages' section so a prose
    # link to the same page elsewhere in SKILL.md is never rewritten.
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
    # Flat ## Pages layout: insert the new entry after the last bullet
    # in the ## Pages section.
    _pages_tmp="$(mktemp "${SKILL_MD}.tmp.XXXXXXXXXX")"
    _tmpfiles+=("$_pages_tmp")
    # entry is read via ENVIRON[], not -v -- see the export comment above
    # where $_new_entry is set (same CWE-150 hazard as the fenced branches).
    awk '
      BEGIN { entry = ENVIRON["_new_entry"] }
      /^## Pages/ { in_pages=1; pages_line=NR }
      in_pages && /^## / && !/^## Pages/ { in_pages=0 }
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

_emit_result "$ACTION"

exit 0
