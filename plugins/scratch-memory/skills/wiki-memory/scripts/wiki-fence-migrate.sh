#!/usr/bin/env bash
# wiki-fence-migrate.sh — One-shot, idempotent, insertion-only fleet
# migration that wraps every unfenced "## Pages" bullet run in
# <!-- BEGIN:PAGES --> / <!-- END:PAGES --> markers, dropping only the blank
# lines inside a run, per the canonical
# grammar in claude-code-ref-expert/marker-fenced-regions-convention.md.
# Detection is delegated to `wiki-health fence-scan` (D8) -- this script
# owns only iteration, insertion, dry-run reporting, and post-write
# verification. It never re-implements the fence-run grammar.
#
# Usage: wiki-fence-migrate.sh [--dry-run] [--skill <name>] [--json] [-h|--help]
#
# Deliberately NOT added to install.sh's WRAPPERS array (`install.sh:197`):
# a fleet-mutating, one-shot migration tool does not belong on every
# machine's PATH alongside wiki-health / wiki-write, which are safe,
# routinely-invoked, read-mostly commands. It is invoked by explicit path;
# init-repo.sh's per-worktree bin/ symlinks already give dev access without
# a user-scope install. Leaving it out also avoids the dual-loop drift
# regression scripts-expert/install-sh.md documents, since there is no
# second WRAPPERS entry to keep in sync.
#
# Exit codes:
#   0  — success (including a fleet-wide idempotent no-op), or a
#        completed --dry-run
#   1  — missing dependency (wiki-health not resolvable or not executable)
#   2  — usage/argument error, unknown flag
#   3  — one or more domains failed verification (a domain that failed
#        after its write was restored from a backup copy taken just before
#        it; other domains keep their fences)

set -euo pipefail

# --- Resolve script directory through symlinks (MSYS-safe; copied verbatim
# from wiki-health.sh:18-28, C9) ---
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
WIKI_HEALTH="$SCRIPT_DIR/wiki-health.sh"

# --- Usage / help ---
_usage() {
  cat <<'USAGE'
Usage: wiki-fence-migrate.sh [--dry-run] [--skill <name>] [--json] [-h|--help]

One-shot, idempotent, insertion-only fleet migration that wraps every
unfenced "## Pages" bullet run in <!-- BEGIN:PAGES --> / <!-- END:PAGES -->
markers, dropping only the blank lines inside a run, per the canonical fence
grammar (claude-code-ref-expert/marker-fenced-regions-convention.md).
Detection is delegated to `wiki-health fence-scan` (D8) -- this script owns only
iteration, insertion, dry-run reporting, and post-write verification.

Run from the repo root -- the rollback manifest path printed on success is
relative to the invocation directory.

Arguments:
  --dry-run     Report what would change; perform no write and create no
                manifest.
  --skill NAME  Restrict the run to a single domain (e.g. for a review
                dry-run before a fleet-wide apply).
  --json        Emit a JSON summary instead of the human-readable report.
  -h, --help    Show this help and exit.

Exit codes:
  0  success (including a fleet-wide idempotent no-op), or a completed
     --dry-run
  1  missing dependency -- wiki-health not resolvable or not executable
  2  usage/argument error, unknown flag
  3  one or more domains failed verification (a domain that failed after
     its write was restored from its pre-write backup; other domains keep
     their fences)
USAGE
}

# --- Argument parsing (R12 argument-validation.md:11-31: -h/--help handled
# first, before the unknown-flag rejection; never let a flag fall through
# to a positional) ---
DRY_RUN=false
SKILL_ARG=""
JSON_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      _usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skill)
      shift
      if [[ $# -eq 0 || "$1" == -* ]]; then
        echo "ERROR: --skill requires a value" >&2
        echo "Run 'wiki-fence-migrate.sh --help' for usage." >&2
        exit 2
      fi
      SKILL_ARG="$1"
      shift

      # Denylist (same convention as wiki-health.sh's MAINT_SKILL /
      # FRESH_SKILL / CITED_SKILL / LINT_MARKER_SKILL / FENCE_SCAN_SKILL --
      # see _parse_fence_scan_args in that file): $SKILL_ARG is interpolated
      # directly into filesystem paths below ($SKILLS_DIR/$name,
      # $vdir/.claude/skills/$name) and passed as `wiki-health fence-scan`'s
      # own <skill> positional, so it must be rejected here, before it is
      # ever used to build a path -- empty string included, since an
      # explicit `--skill ''` must not silently fall through to fleet
      # enumeration (the `-n "$SKILL_ARG"` check further down treats an
      # empty value as "not provided").
      if [[ -z "$SKILL_ARG" || "$SKILL_ARG" == */* || "$SKILL_ARG" == *\\* || "$SKILL_ARG" == *..* || \
            "$SKILL_ARG" == *" "* || "$SKILL_ARG" == *'"'* || "$SKILL_ARG" == *'`'* || \
            "$SKILL_ARG" == *'$'* || "$SKILL_ARG" == *'*'* || "$SKILL_ARG" == *'?'* || \
            "$SKILL_ARG" == *';'* || "$SKILL_ARG" == *'&'* || "$SKILL_ARG" == *'|'* || \
            "$SKILL_ARG" == *'<'* || "$SKILL_ARG" == *'>'* || "$SKILL_ARG" == *'('* || \
            "$SKILL_ARG" == *')'* || "$SKILL_ARG" == *'{'* || "$SKILL_ARG" == *'}'* || \
            "$SKILL_ARG" == *'['* || "$SKILL_ARG" == *']'* || \
            "$SKILL_ARG" == *$'\n'* ]]; then
        echo "ERROR: invalid skill path: $SKILL_ARG" >&2
        echo "Run 'wiki-fence-migrate.sh --help' for usage." >&2
        exit 2
      fi
      ;;
    --json)
      JSON_MODE=true
      shift
      ;;
    -*)
      echo "ERROR: unknown option: $1" >&2
      echo "Run 'wiki-fence-migrate.sh --help' for usage." >&2
      exit 2
      ;;
    *)
      echo "ERROR: unexpected argument: $1" >&2
      echo "Run 'wiki-fence-migrate.sh --help' for usage." >&2
      exit 2
      ;;
  esac
done

# --- Missing-dependency guard (exit 1): abort before touching any domain ---
if [[ ! -f "$WIKI_HEALTH" || ! -r "$WIKI_HEALTH" ]]; then
  echo "ERROR: missing dependency: wiki-health not found or not readable at $WIKI_HEALTH" >&2
  exit 1
fi

# --- JSON string escaping (copied from wiki-health.sh:143-147 -- a generic
# utility, not part of the fence grammar D8 guards against duplicating) ---
_json_str() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\t/\\t/g; s/\r/\\r/g'
}

# --- Walk up from a starting directory looking for .claude/ (copied from
# wiki-health.sh:18-28's sibling helpers, used here only to locate the
# skills fleet root -- never to re-derive fence-run boundaries) ---
_walk_up_for_claude_dir() {
  local dir="$1"
  while [[ "$dir" != "/" && "$dir" != "." ]]; do
    if [[ -d "$dir/.claude" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

_find_project_root() {
  local root
  if root="$(_walk_up_for_claude_dir "${PWD%/}")"; then echo "$root"; return 0; fi
  if root="$(_walk_up_for_claude_dir "$SCRIPT_DIR")"; then echo "$root"; return 0; fi
  echo "ERROR: could not find project root (.claude/ not found)" >&2
  return 1
}

PROJECT_ROOT="$(_find_project_root)"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "ERROR: skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

# --- Interrupt/exit cleanup trap, wired before the first mktemp (canonical
# in-repo shape copied from wiki-write.sh, located by searching for the
# literal `trap '_cleanup_tmps'` rather than a line number).
#
# Bash defers delivery of a trapped INT/TERM until the currently-running
# foreground command returns, and then -- critically -- does NOT terminate
# the script on its own once the trap handler finishes; a script that traps
# INT/TERM purely for cleanup and never exits from the handler simply
# resumes execution where it left off (verified empirically: a toy script
# with `trap 'echo hit' INT` continues its loop after printing "hit").
# Relying on the ALREADY-SET `$?` at trap-entry to decide the exit code is
# unreliable for the signal case -- it reflects whatever command happened
# to complete just before the deferred trap fired (often 0), not the
# signal. So INT/TERM only raise a flag; the domain loop below polls that
# flag once per iteration and exits non-zero itself, and the EXIT leg frees
# resources. Deferring the removal to EXIT keeps the in-flight domain's temp
# file and pre-write backup on disk until it has finished its own
# write-verify-rename-restore sequence (never half-written, never restored
# from a deleted backup), and the sweep stops before starting the next
# domain, well short of a full run. ---
_tmpfiles=()
_tmpdirs=()
_interrupted=false
_cleanup_tmps() {
  local f d
  for f in "${_tmpfiles[@]:-}"; do
    [[ -f "$f" ]] && rm -f "$f" || true
  done
  for d in "${_tmpdirs[@]:-}"; do
    [[ -d "$d" ]] && rm -rf "$d" || true
  done
}
trap '_cleanup_tmps' EXIT
trap '_interrupted=true' INT TERM

# --- Triple-gate wiki-backed check, matching _resolve_skill_as_wiki's test
# (R7): SKILL.md exists, contains ## Pages, and .mditerc names SKILL.md as
# entrypoint. Duplicated here because this script enumerates domains itself
# rather than delegating enumeration to wiki-health --all. ---
_is_wiki_backed() {
  local dir="$1"
  [[ -f "$dir/SKILL.md" ]] || return 1
  grep -q '^## Pages' "$dir/SKILL.md" 2>/dev/null || return 1
  [[ -f "$dir/.mditerc" ]] || return 1
  grep -q '^entrypoint:[[:space:]]*SKILL\.md' "$dir/.mditerc" 2>/dev/null || return 1
  return 0
}

# --- Extract the `- ` bullet lines inside ## Pages, skipping fenced code
# blocks the same way the canonical grammar does. Used only for the
# nav-entry-preserved invariant check below -- this reads bullet text, it
# does not detect fence-run boundaries (D8's grammar stays wiki-health's
# alone). ---
_pages_bullets() {
  awk '
    /^## Pages/ { p = 1; next }
    p && /^## / { p = 0 }
    p {
      if ($0 ~ /^```/ || $0 ~ /^~~~/) { fence = !fence; next }
      if (fence) next
      if ($0 ~ /^- /) print
    }
  ' "$1"
}

# --- Insert BEGIN/END markers at the given 1-based line numbers, in one awk
# pass so earlier insertions never shift the line numbers still to be
# processed (Actions: "process runs in descending start order ... or build
# the whole file in one awk pass keyed on the run list" -- this is the
# latter). begins_csv/ends_csv are comma-separated line numbers. A run may
# hold blank lines (the Blank-Line Rule); they are dropped inside the fence,
# which holds only bullets. ---
_insert_fences() {
  local src="$1" dst="$2" begins_csv="$3" ends_csv="$4"
  awk -v begins="$begins_csv" -v ends="$ends_csv" '
    BEGIN {
      nb = split(begins, barr, ",")
      for (i = 1; i <= nb; i++) if (barr[i] != "") begin_at[barr[i] + 0] = 1
      ne = split(ends, earr, ",")
      for (i = 1; i <= ne; i++) if (earr[i] != "") end_at[earr[i] + 0] = 1
    }
    {
      if (FNR in begin_at) { print "<!-- BEGIN:PAGES -->"; in_run = 1 }
      if (!(in_run && $0 == "")) print
      if (FNR in end_at) { print "<!-- END:PAGES -->"; in_run = 0 }
    }
  ' "$src" > "$dst"
}

# --- Run fence-scan (D8: the ONE detector implementation) against arbitrary
# file content by staging it as a throwaway skill so the real subcommand can
# resolve it, then report the unfenced-run count. This lets pre-rename
# verification call the real grammar without re-implementing it and without
# ever writing the candidate content to its real target path.
# GLOBAL-SETTING FUNCTION -- sets FENCE_SCAN_CONTENT_UNFENCED and must be
# called DIRECTLY (never via `$(...)`), matching bash-subshell-strips-
# globals: capturing this function's output in a command substitution would
# fork a subshell and lose the array registration below to the parent.
# Returns 0 with FENCE_SCAN_CONTENT_UNFENCED set to the unfenced count, or
# 1 with it set to -1 if fence-scan itself could not resolve the staged
# content (an internal error, not a normal fence-scan result). ---
FENCE_SCAN_CONTENT_UNFENCED=-1
_fence_scan_content_unfenced_count() {
  local name="$1" content_file="$2"
  local vdir
  vdir="$(mktemp -d)"
  _tmpdirs+=("$vdir")
  mkdir -p "$vdir/.claude/skills/$name"
  cp "$content_file" "$vdir/.claude/skills/$name/SKILL.md"
  printf 'entrypoint: SKILL.md\n' > "$vdir/.claude/skills/$name/.mditerc"

  local vout vrc
  set +e
  vout="$(cd "$vdir" && bash "$WIKI_HEALTH" fence-scan "$name" 2>/dev/null)"
  vrc=$?
  set -e

  rm -rf "$vdir"

  if [[ "$vrc" -ne 0 && "$vrc" -ne 1 ]]; then
    FENCE_SCAN_CONTENT_UNFENCED=-1
    return 1
  fi

  local unfenced=0 s e f
  if [[ -n "$vout" ]]; then
    while IFS=$'\t' read -r s e f; do
      [[ -z "$s" ]] && continue
      [[ "$f" == "0" ]] && unfenced=$((unfenced + 1))
    done <<< "$vout"
  fi
  FENCE_SCAN_CONTENT_UNFENCED="$unfenced"
  return 0
}

# --- Enumerate the fleet in deterministic order (R2: the --all idiom at
# wiki-health.sh:3046-3050 -- find ... -print0 | sort -z into an array) ---
DOMAINS=()
if [[ -n "$SKILL_ARG" ]]; then
  DOMAINS=("$SKILL_ARG")
else
  while IFS= read -r -d '' d; do
    DOMAINS+=("$(basename "$d")")
  done < <(find -H "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null | sort -z)
fi

FENCED_COUNT=0
ALREADY_FENCED_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0
JSON_DOMAINS=""
MANIFEST=".git/wiki-fence-migrate/changed-files.$$.txt"
MANIFEST_INITIALIZED=false

_json_add_domain() {
  local skill="$1" action="$2" runs="$3"
  [[ -n "$JSON_DOMAINS" ]] && JSON_DOMAINS+=","
  JSON_DOMAINS+="{\"skill\":\"$(_json_str "$skill")\",\"action\":\"${action}\",\"runs\":${runs}}"
}

MODE_LABEL="apply"
[[ "$DRY_RUN" == true ]] && MODE_LABEL="dry-run"

# Print the summary line (every path) plus the fully-resolved rollback line
# (apply mode only, never on a dry run since no manifest was ever created),
# then exit with the given code. Shared by the normal end-of-sweep tail and
# the interrupt check below so both report identically.
_report_and_exit() {
  local code="$1"

  if [[ "$JSON_MODE" == true ]]; then
    printf '{"mode":"%s","domains":[%s],"totals":{"fenced":%d,"already_fenced":%d,"skipped":%d,"failed":%d}}\n' \
      "$MODE_LABEL" "$JSON_DOMAINS" "$FENCED_COUNT" "$ALREADY_FENCED_COUNT" "$SKIPPED_COUNT" "$FAILED_COUNT"
  else
    echo "wiki-fence-migrate: ${FENCED_COUNT} fenced, ${ALREADY_FENCED_COUNT} already-fenced, ${SKIPPED_COUNT} skipped, ${FAILED_COUNT} failed"
  fi

  if [[ "$DRY_RUN" == true ]]; then
    # No manifest is ever created on a dry run -- no rollback line on any
    # path, but an interrupted dry run still reports non-zero rather than
    # masquerading as a clean completion.
    exit "$code"
  fi

  if [[ "$code" -ne 0 ]]; then
    [[ "$MANIFEST_INITIALIZED" == true ]] && echo "rollback: xargs -0 -a ${MANIFEST} git checkout --" >&2
    exit "$code"
  fi

  [[ "$MANIFEST_INITIALIZED" == true ]] && echo "rollback: xargs -0 -a ${MANIFEST} git checkout --"
  exit 0
}

for name in "${DOMAINS[@]}"; do
  # Interrupt poll: the INT/TERM trap raises this flag on
  # SIGINT/SIGTERM. Checking it once per iteration guarantees
  # the domain that was in flight when the signal arrived always finishes
  # its own write-verify-rename sequence first (never half-written), and
  # the sweep stops before starting the next domain -- well short of a full
  # run, and with a non-zero exit that actually proves interruption (unlike
  # trusting $? at trap-fire time, which reflects whatever command
  # happened to complete just before the deferred trap ran).
  if [[ "$_interrupted" == true ]]; then
    _report_and_exit 130
  fi

  domain_dir="$SKILLS_DIR/$name"

  if ! _is_wiki_backed "$domain_dir"; then
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    _json_add_domain "$name" "skipped" 0
    continue
  fi

  target="$domain_dir/SKILL.md"

  # Predeclare before capturing $? (R11: a bare `local var` between the
  # command and its `$?` read clobbers the exit status). Guard the call so
  # fence-scan's normal exit-1 ("has unfenced runs") never aborts the run
  # under set -euo pipefail.
  local_scan_out=""
  local_scan_rc=0
  set +e
  local_scan_out="$(bash "$WIKI_HEALTH" fence-scan "$name" 2>/dev/null)"
  local_scan_rc=$?
  set -e

  if [[ "$local_scan_rc" -ne 0 && "$local_scan_rc" -ne 1 ]]; then
    # fence-scan could not resolve this domain even though our own gate
    # passed (race, or a shape our gate doesn't catch) -- treat as skipped
    # rather than aborting the whole sweep.
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    _json_add_domain "$name" "skipped" 0
    echo "WARN: fence-scan could not resolve $name (exit $local_scan_rc); skipping" >&2
    continue
  fi

  begins=() ends=() unfenced=0
  if [[ -n "$local_scan_out" ]]; then
    while IFS=$'\t' read -r s e f; do
      [[ -z "$s" ]] && continue
      if [[ "$f" == "0" ]]; then
        begins+=("$s")
        ends+=("$e")
        unfenced=$((unfenced + 1))
      fi
    done <<< "$local_scan_out"
  fi

  # Short-circuit already-fenced domains before ANY write machinery: no
  # mktemp, no insertion pass, no cmp, no rename (C4 idempotency).
  if [[ "$unfenced" -eq 0 ]]; then
    ALREADY_FENCED_COUNT=$((ALREADY_FENCED_COUNT + 1))
    _json_add_domain "$name" "already-fenced" 0
    continue
  fi

  begins_csv="$(IFS=,; echo "${begins[*]}")"
  ends_csv="$(IFS=,; echo "${ends[*]}")"

  if [[ "$DRY_RUN" == true ]]; then
    # Same audit pass as apply mode, but the proposed content lives in
    # system tmp (never under .claude/skills/) and is discarded after the
    # diff -- a dry run must leave the real fleet's working tree untouched.
    preview="$(mktemp)"
    _tmpfiles+=("$preview")
    _insert_fences "$target" "$preview" "$begins_csv" "$ends_csv"
    if [[ "$JSON_MODE" == false ]]; then
      echo "would-fence: $name ($unfenced runs)"
      diff -u "$target" "$preview" || true
    fi
    rm -f "$preview"
    FENCED_COUNT=$((FENCED_COUNT + 1))
    _json_add_domain "$name" "fenced" "$unfenced"
    continue
  fi

  # --- Apply path ---
  # Pre-write probe. wiki-health exits non-zero on any unhealthy domain, so
  # only the JSON envelope says whether the probe ran at all; a probe
  # without one is a failed probe, never an empty reason-code set.
  fail_reason=""
  before_out=""
  set +e
  before_out="$(bash "$WIKI_HEALTH" "$name" --json 2>/dev/null)"
  set -e
  if [[ "$before_out" != *'"reasons": ['* ]]; then
    fail_reason="pre-write wiki-health probe produced no JSON verdict"
  fi
  before_codes="$(printf '%s\n' "$before_out" | LC_ALL=C grep -o '"code":"[A-Z_]*"' | LC_ALL=C sort -u || true)"

  tmp="$(mktemp "${target}.tmp.XXXXXXXXXX")"
  _tmpfiles+=("$tmp")
  _insert_fences "$target" "$tmp" "$begins_csv" "$ends_csv"

  # Invariant 1 (C3, insertion-only): stripping every marker line from the
  # temp file must reproduce the original byte-for-byte, blank lines aside,
  # since a run's interior blank lines are dropped inside its fence.
  if [[ -z "$fail_reason" ]]; then
    if ! cmp -s <(grep -vE '^(<!-- (BEGIN|END):PAGES -->)?$' "$tmp") <(grep -v '^$' "$target"); then
      fail_reason="insertion-only check failed (stripped temp differs from original)"
    fi
  fi

  # Invariant 2: fence-scan on the temp content reports unfenced == 0 (the
  # real detector, staged against throwaway content -- never re-implemented).
  # Called directly, never via $(...) -- it sets FENCE_SCAN_CONTENT_UNFENCED
  # as a global (bash-command-substitution-subshell).
  if [[ -z "$fail_reason" ]]; then
    if ! _fence_scan_content_unfenced_count "$name" "$tmp"; then
      fail_reason="fence-scan could not resolve the staged temp content"
    elif [[ "$FENCE_SCAN_CONTENT_UNFENCED" != "0" ]]; then
      fail_reason="fence-scan on temp content reported unfenced=$FENCE_SCAN_CONTENT_UNFENCED (expected 0)"
    fi
  fi

  # Invariant 3: the `- ` bullet multiset inside ## Pages is unchanged.
  if [[ -z "$fail_reason" ]]; then
    if ! diff -q <(_pages_bullets "$target" | sort) <(_pages_bullets "$tmp" | sort) >/dev/null; then
      fail_reason="## Pages bullet multiset changed"
    fi
  fi

  # Backup of the exact pre-write bytes, uncommitted edits included, for the
  # post-write restore. Same directory as $target so the restoring `mv -f`
  # is an atomic same-filesystem rename, and no `.md` suffix so the
  # post-write probe never reads it as an orphan page.
  backup=""
  if [[ -z "$fail_reason" ]]; then
    if ! backup="$(mktemp "${target}.bak.XXXXXXXXXX")"; then
      fail_reason="could not create a backup copy of SKILL.md"
    else
      _tmpfiles+=("$backup")
      if ! cp -p "$target" "$backup"; then
        rm -f "$backup"
        fail_reason="could not write a backup copy of SKILL.md"
      fi
    fi
  fi

  if [[ -n "$fail_reason" ]]; then
    rm -f "$tmp"
    echo "ERROR: $name: $fail_reason" >&2
    FAILED_COUNT=$((FAILED_COUNT + 1))
    _json_add_domain "$name" "failed" "$unfenced"
    continue
  fi

  # Never rename a temp file that failed a check -- past this point every
  # invariant has passed, so the rename is safe.
  mv -f "$tmp" "$target"

  # Post-write verification: fencing may clear reason codes but must never
  # add one. Only the code set is compared -- details carry SKILL.md line
  # numbers that the fence insertion shifts.
  after_out=""
  set +e
  after_out="$(bash "$WIKI_HEALTH" "$name" --json 2>/dev/null)"
  set -e
  verify_fail=""
  if [[ "$after_out" != *'"reasons": ['* ]]; then
    verify_fail="post-write wiki-health probe produced no JSON verdict"
  else
    after_codes="$(printf '%s\n' "$after_out" | LC_ALL=C grep -o '"code":"[A-Z_]*"' | LC_ALL=C sort -u || true)"
    new_codes="$(LC_ALL=C comm -13 <(printf '%s\n' "$before_codes") <(printf '%s\n' "$after_codes") | sed -n 's/^"code":"\(.*\)"$/\1/p' | paste -sd, -)"
    if [[ -n "$new_codes" ]]; then
      verify_fail="fencing added wiki-health reason code(s) $new_codes"
    fi
  fi

  if [[ -n "$verify_fail" ]]; then
    # Restore from the backup, never from git: git holds HEAD, not the
    # uncommitted edits this file may carry. Guarded so a failed restore
    # fails only this domain instead of aborting the sweep under set -e.
    if mv -f "$backup" "$target"; then
      echo "ERROR: $name: $verify_fail; restored from the pre-write backup" >&2
    else
      # Keep the backup: it is now the only copy of the pre-write content.
      _tmpfiles=("${_tmpfiles[@]/"$backup"}")
      echo "ERROR: $name: $verify_fail; restore from '$backup' FAILED -- fenced content is still in place, the backup is kept" >&2
    fi
    FAILED_COUNT=$((FAILED_COUNT + 1))
    _json_add_domain "$name" "failed" "$unfenced"
    continue
  fi
  rm -f "$backup"

  if [[ "$MANIFEST_INITIALIZED" == false ]]; then
    mkdir -p .git/wiki-fence-migrate
    : > "$MANIFEST"
    MANIFEST_INITIALIZED=true
  fi
  # NUL-delimited, not newline-delimited: a bare `echo ... >> "$MANIFEST"`
  # replayed via default-word-splitting `xargs` would let a manifest entry
  # containing embedded whitespace expand into multiple `git checkout --`
  # arguments on rollback, acting on paths beyond the one domain that
  # failed. Paired with the `-0`-reading `xargs -0 -a` in the printed
  # rollback line below.
  printf '%s\0' "$target" >> "$MANIFEST"

  if [[ "$JSON_MODE" == false ]]; then
    echo "fenced: $name ($unfenced runs)"
  fi
  FENCED_COUNT=$((FENCED_COUNT + 1))
  _json_add_domain "$name" "fenced" "$unfenced"
done

FINAL_CODE=0
[[ "$FAILED_COUNT" -gt 0 ]] && FINAL_CODE=3
_report_and_exit "$FINAL_CODE"
