#!/usr/bin/env bash
# wiki-health.sh — Deterministic 5-state classifier for skill folders
#
# Usage: wiki-health <skill> [--verbose|--json] [--full]
#        wiki-health --all [--json] [--full]
#
# Exit codes:
#   0  — healthy
#   2  — usage/argument error, or not-a-wiki (undeclared skill; both share this code)
#   3  — new
#   4  — partial-migration
#   5  — unhealthy
#   6  — --all sweep: one or more skills non-healthy

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
Usage: wiki-health <skill> [--verbose|--json] [--full]
       wiki-health --all [--json] [--full]
       wiki-health -h|--help

Deterministic 5-state classifier for skill folders.

Arguments:
  <skill>     Skill folder name under .claude/skills/ (e.g. pdfsharp-expert)
  --verbose   Print state line + bulleted reason list
  --json      Print full JSON verdict (Data Model §1 schema)
  --full      Deep-audit mode: run Step 5b pairwise cross-link scan + Step 6
              group-affinity check on structurally-healthy skills. Downgrades
              healthy → partial-migration when candidates are found. Purely
              diagnostic — does NOT modify any wiki files. Use to detect
              missing cross-references after protocol-evolution events.
              Valid with a single skill or with --all.
              Example: wiki-health winforms-expert --full
              Example: wiki-health --all --full
  --all       Survey all skill folders; table output; exit 6 if any non-healthy
  --all --json  JSON array of per-skill verdict objects
  --all --full  Run the deep audit for every skill in the sweep. Bounded but
                slower — each qualifying domain (>50 pages) prints a
                per-domain slow-scan warning to stderr.

Exit codes:
  0  healthy
  2  usage/argument error, or not-a-wiki (undeclared skill; both share this code)
  3  new
  4  partial-migration
  5  unhealthy
  6  --all: one or more non-healthy

Subcommands:
  freshness <skill> [<page>] [--deep] [--json] [--quiet]
    Per-page git-timestamp freshness check for wiki pages with code-cites.
    Status values: fresh | stale-timestamp | unknown (no code-cites or git miss).
    Exit codes for freshness: 0 always on success/infra-as-unknown; 2 on bad args.
    --deep    Enable Tier-2 verification (reserved; Step 03c).
    --json    Emit JSON: {"skill":"...","pages":[{"page":"...","status":"...","wiki_mtime":<unix>,"newest_cited_path_commit":<unix|null>}]}
    --quiet   Suppress stderr progress (errors still emit).

  cited-paths <skill> <page> [--json] [--quiet]
    Enumerate code-cites: paths from a single wiki page's frontmatter.
    Designed for piping into resolver chains -- use --quiet to keep stdout pure.
    Stdout (plain): one path per line, verbatim from code-cites: frontmatter.
    Stdout (--json): {"skill":"...","page":"...","cited_paths":[...]}.
    Empty cited-paths -> zero output lines + exit 0.
    Exit codes: 0 on success/infra-as-unknown; 2 on bad args/unknown flag.
    --json    Emit JSON object with cited_paths array.
    --quiet   Suppress stderr progress diagnostics (errors still emit).

  maintenance-due <skill> [--json]
    Compound-condition verdict: is a lint/sweep due for this wiki? Composes
    page counts, code-cites/md-link churn (churn-check), and mdite
    orphan/link status into due/N/K/large-drift.
    Exit codes: 0 not due; 1 due; 2 bad skill arg (Unix predicate idiom --
    distinct from the classify enum's own exit codes).
    --json    Emit JSON verdict: {due, N, K, correction-cap, large-drift,
              queue:[{page,last-verified,cited-churn}], stats:{...}} --
              always emitted regardless of exit code.

  fence-scan <skill> [--json] [--quiet]
    Detect unfenced ## Pages bullet runs against the canonical marker-fence
    grammar (claude-code-ref-expert/marker-fenced-regions-convention.md).
    Detection only -- read-only on every path, never writes a file.
    Exit codes: 0 no unfenced runs found (including zero runs at all); 1 one
    or more unfenced runs found; 2 bad args or unresolvable skill.
    --json    Emit JSON: {"skill":"...","runs":[{"start":<int>,"end":<int>,
              "fenced":<bool>}],"unfenced":<int>}
    --quiet   Suppress stderr progress diagnostics (errors still emit).
    Example: wiki-health fence-scan winforms-expert --json
USAGE
}

# --- Walk up from a starting directory looking for .claude/ ---
# Usage: _walk_up_for_claude_dir <start-dir>
# Echoes the project root and returns 0 if found; returns 1 (no echo) if not found.
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

# --- Find project root: PWD-walk first, SCRIPT_DIR-walk as fallback ---
_find_project_root() {
  local root
  if root="$(_walk_up_for_claude_dir "${PWD%/}")"; then echo "$root"; return 0; fi
  if root="$(_walk_up_for_claude_dir "$SCRIPT_DIR")"; then echo "$root"; return 0; fi
  echo "ERROR: could not find project root (.claude/ not found)" >&2
  return 1
}

# --- JSON string escaping ---
_json_str() {
  # Escape backslash, double-quote, newline, tab, and carriage return for JSON
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\t/\\t/g; s/\r/\\r/g'
}

# --- Check if a directory is a staging dir ---
_is_staging_dir() {
  local dir="$1"
  [[ -d "$dir" && -f "$dir/.origin" ]]
}

# --- Read exclude: patterns from a skill's .mditerc (gitignore-style subset,
# see _wiki_path_excluded below for match semantics) ---
# Handles flow-style (exclude: [a, b]), block-style (exclude:\n  - a\n  - b),
# a bare single-scalar value (exclude: a), CRLF line endings (stripped via
# `tr -d '\r'`, same convention as the entrypoint grep above), and
# single/double-quoted items. Absent .mditerc or absent exclude: field ->
# empty output (no behavior change). Mirrors the flow/block-list parsing
# idiom already used by _extract_code_cites below (own-copy convention:
# churn-check carries a byte-identical copy of this function — see
# churn-check's copy for the shared rationale). This is a security-relevant
# parse of repo content: awk/sed only, no eval, and every parsed pattern is
# later used only inside a bash [[ ]] string/glob comparison — never
# expanded into a command.
_wiki_mditerc_exclude_patterns() {
  local mditerc="$1"
  [[ -f "$mditerc" ]] || return 0
  tr -d '\r' < "$mditerc" | awk '
    /^exclude:[[:space:]]*\[/ {
      line = $0
      sub(/^exclude:[[:space:]]*/, "", line)
      gsub(/^\[|\][[:space:]]*$/, "", line)
      n = split(line, items, /,[[:space:]]*/)
      for (i = 1; i <= n; i++) {
        item = items[i]
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", item)
        gsub(/^"|"$/, "", item)
        gsub(/^'"'"'|'"'"'$/, "", item)
        if (item != "") print item
      }
      in_list = 0
      next
    }
    /^exclude:[[:space:]]*$/ { in_list = 1; next }
    /^exclude:/ {
      line = $0
      sub(/^exclude:[[:space:]]*/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      gsub(/^"|"$/, "", line)
      gsub(/^'"'"'|'"'"'$/, "", line)
      if (line != "") print line
      in_list = 0
      next
    }
    in_list && /^[[:space:]]*-[[:space:]]/ {
      item = $0
      sub(/^[[:space:]]*-[[:space:]]*/, "", item)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", item)
      gsub(/^"|"$/, "", item)
      gsub(/^'"'"'|'"'"'$/, "", item)
      if (item != "") print item
      next
    }
    in_list && /^[^[:space:]-]/ { in_list = 0 }
  ' 2>/dev/null
}

# --- Test whether a wiki-root-relative path matches ANY of a
# newline-delimited exclude-pattern list (documented gitignore-compatible
# subset) ---
# (a) no wildcard char -> exact relative-path match; (b) trailing "/**" ->
# directory-prefix match (dir/** matches dir/ itself and everything below);
# (c) otherwise a bash [[ == ]] glob match — bash's `*`/`?` cross "/"
# (divergence from gitignore's own semantics), accepted for this subset.
# Own-copy convention: churn-check carries a byte-identical copy.
_wiki_path_excluded() {
  local rel="$1" patterns="$2"
  local pattern
  while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    if [[ "$pattern" == */\*\* ]]; then
      local prefix="${pattern%/\*\*}"
      [[ "$rel" == "$prefix" || "$rel" == "$prefix"/* ]] && return 0
    else
      [[ "$rel" == $pattern ]] && return 0
    fi
  done <<< "$patterns"
  return 1
}

# --- Enumerate content-page CANDIDATES under skill_dir, before .mditerc
# exclude: filtering (D12: group-subdir aware) ---
# maxdepth-2 scan excluding scripts/, assets/, protocols/, fixtures/ subdirs
# and special files (SKILL.md, log.md, schema.md, index.md, .origin,
# .snapshot). fixtures/ holds test-fixture .md files (not knowledge pages)
# and must not be candidates for missing-summary, orphan, or census checks —
# see wiki-health-fixtures-census-exclusion. Outputs newline-delimited
# relative paths, sorted for deterministic ordering. Factored out of
# _wiki_collect_pages so _classify_skill can diff candidates-vs-kept to
# compute the excluded-by-mditerc visibility count (see CLASSIFY_pages_
# excluded_by_mditerc) without duplicating the find invocation.
_wiki_collect_pages_candidates() {
  local skill_dir="$1"
  while IFS= read -r -d '' f; do
    local rel="${f#"$skill_dir"/}"
    [[ "$rel" == scripts/* || "$rel" == assets/* || "$rel" == protocols/* || "$rel" == fixtures/* ]] && continue
    local base
    base="$(basename "$f")"
    [[ "$base" == "SKILL.md" || "$base" == "log.md" || "$base" == "schema.md" || "$base" == "index.md" || "$base" == ".origin" || "$base" == ".snapshot" ]] && continue
    printf '%s\n' "$rel"
  done < <(find "$skill_dir" -maxdepth 2 -name "*.md" \
            -not -path "*/scripts/*" -not -path "*/assets/*" -not -path "*/protocols/*" -not -path "*/fixtures/*" \
            -print0 2>/dev/null | sort -z)
}

# --- Enumerate content pages under skill_dir (D12: group-subdir aware) ---
# _wiki_collect_pages_candidates (above) plus per-wiki .mditerc exclude:
# filtering (gitignore-style subset — see _wiki_path_excluded). Outputs
# newline-delimited relative paths, sorted for deterministic ordering.
# Shared by _classify_skill (page counts / orphan / summary / tag-prefix
# checks), _run_freshness (whole-domain freshness scan), and
# _run_maintenance_due (stats/queue passes) — third use factored into one
# helper per the rule-of-three precedent set by the resolver factoring (PD2).
# Distinct from _collect_content_pages below (maxdepth-3, no protocols/,
# fixtures/, or .mditerc exclude: filtering — used only by the
# duplicate-detection Jaccard pass; out of scope per wiki-health-mditerc-
# exclude step 2).
_wiki_collect_pages() {
  local skill_dir="$1"
  local exclude_patterns
  exclude_patterns="$(_wiki_mditerc_exclude_patterns "$skill_dir/.mditerc")"
  local rel
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    [[ -n "$exclude_patterns" ]] && _wiki_path_excluded "$rel" "$exclude_patterns" && continue
    printf '%s\n' "$rel"
  done < <(_wiki_collect_pages_candidates "$skill_dir")
}

# --- Extract nav-entry records from a skill's SKILL.md ## Pages / ### Archived ---
# Shape: "- [Title](page.md) — summary text" (live) or
#        "- [Title](page.md) (archived) — summary text" (archived).
# Splits on the FIRST " — " occurring immediately after the "](page.md)"
# anchor (with the optional " (archived)" token in between) — never on the
# last dash or a dash count, since both the title and the summary may carry
# their own em-dashes (see wiki-health-parsing-contracts).
# Outputs one record per matched nav line, \x01-delimited:
#   PAGE_PATH\x01IS_ARCHIVED(0|1)\x01SUMMARY_TEXT
# Skips fenced code blocks (``` / ~~~) inside the section so an illustrative
# snippet is never misread as a real nav entry.
_wiki_extract_nav_entries() {
  local skillmd="$1"
  awk '
    BEGIN { in_pages = 0; in_archived = 0; in_fence = 0 }
    /^## Pages/ { in_pages = 1; next }
    in_pages && /^## / { in_pages = 0 }
    in_pages && /^### Archived/ { in_archived = 1; next }
    in_pages {
      if ($0 ~ /^```/ || $0 ~ /^~~~/) { in_fence = !in_fence; next }
      if (in_fence) next
      line = $0
      if (match(line, /\]\([^)]+\.md\)/)) {
        path = substr(line, RSTART + 2, RLENGTH - 3)
        rest = substr(line, RSTART + RLENGTH)
        if (rest ~ /^ \(archived\)/) { sub(/^ \(archived\)/, "", rest) }
        # length(sep), never a literal 3: index() and substr() count bytes when
        # awk runs byte-oriented (LANG/LC_ALL unset) and characters when it does
        # not, and the em-dash is 3 bytes but 1 character. length() reports in
        # whichever unit those two are using, so the skip stays correct in both.
        # A hardcoded 3 landed mid-em-dash under a byte-oriented locale and left
        # a stray continuation byte on every summary, which then mismatched the
        # page frontmatter and reported the whole fleet as unhealthy.
        sep = " — "
        sep_pos = index(rest, sep)
        summary = ""
        if (sep_pos > 0) { summary = substr(rest, sep_pos + length(sep)) }
        gsub(/^[ \t]+|[ \t]+$/, "", summary)
        printf "%s\x01%s\x01%s\n", path, in_archived, summary
      }
    }
  ' "$skillmd"
}

# --- Detect contiguous ## Pages bullet runs and classify each as fenced or
# unfenced, per the canonical bullet-run grammar in
# claude-code-ref-expert/marker-fenced-regions-convention.md. This is the
# one implementation every conforming detector/generator shares (D8) --
# wiki-health's fence-scan subcommand below is its first caller.
# A run OPENS on a `^- ` bullet line (inside ## Pages) and CLOSES on the
# next blank line, `^###` sub-heading, `^---` thematic break, any other
# prose line, or the `^## ` section-end heading. An existing
# `<!-- END:PAGES -->` marker also closes an open run -- the generator never
# leaves a blank line between a fenced run's last bullet and its END
# marker, so END:PAGES must close the run itself rather than waiting for a
# blank line that will never come. An existing `<!-- BEGIN:PAGES -->`
# marker does not open or extend a run; it only marks the run that follows
# it as already fenced (idempotency). Skips fenced code blocks the same way
# _wiki_extract_nav_entries does (:291-292 shape above) so an illustrative
# ```` ``` ```` snippet is never misread as a real bullet.
# PURE EMITTER: writes only to stdout, sets no globals -- safe to call as
# `runs="$(_wiki_pages_bullet_runs "$f")"` (bash-subshell-strips-globals;
# that rule's defect class applies only to global-setting functions, and
# this one deliberately isn't one).
# Emits one tab-separated record per run, in file order:
#   <start_line>\t<end_line>\t<0|1 fenced>
_wiki_pages_bullet_runs() {
  local skillmd="$1"
  awk '
    BEGIN { in_pages = 0; in_fence = 0; in_run = 0; run_start = 0; fenced = 0; marked_fenced = 0 }
    /^## Pages/ { in_pages = 1; next }
    in_pages && /^## / {
      if (in_run) { printf "%d\t%d\t%d\n", run_start, NR - 1, fenced; in_run = 0 }
      in_pages = 0
      next
    }
    in_pages {
      if ($0 ~ /^```/ || $0 ~ /^~~~/) { in_fence = !in_fence; next }
      if (in_fence) next
      if ($0 ~ /^<!-- BEGIN:PAGES -->/) {
        if (in_run) { printf "%d\t%d\t%d\n", run_start, NR - 1, fenced; in_run = 0 }
        marked_fenced = 1
        next
      }
      if ($0 ~ /^<!-- END:PAGES -->/) {
        if (in_run) { printf "%d\t%d\t%d\n", run_start, NR - 1, fenced; in_run = 0 }
        marked_fenced = 0
        next
      }
      if ($0 ~ /^- /) {
        if (!in_run) { in_run = 1; run_start = NR; fenced = marked_fenced }
        next
      }
      # Blank line, ### sub-heading, --- thematic break, or any other prose
      # line all close an open run identically (bullet-run grammar table)
      # and no-op when no run is open.
      if (in_run) { printf "%d\t%d\t%d\n", run_start, NR - 1, fenced; in_run = 0 }
    }
    END {
      if (in_run) { printf "%d\t%d\t%d\n", run_start, NR, fenced }
    }
  ' "$skillmd"
}

# --- Validate BEGIN:PAGES / END:PAGES marker balance in the ## Pages section ---
# Separate helper from _wiki_pages_bullet_runs above, deliberately: that one
# tracks fence state as a plain boolean and therefore cannot notice an
# unterminated BEGIN — after which every following run reports fenced when it
# is not. Extending its emitted record shape instead would break the
# fence-scan subcommand's contract, so balance validation lives here.
# Same section bounds (^## Pages -> next ^## ) and same fenced-code-block skip
# as its neighbour, so an illustrative marker inside a ``` block is ignored.
# PURE EMITTER: writes only to stdout, sets no globals.
# Emits one tab-separated record per fault, in file order:
#   <line>\t<BEGIN_WITHOUT_END|END_WITHOUT_BEGIN|NESTED_BEGIN>
# A well-formed section emits nothing — INCLUDING one whose marker pair wraps
# zero bullets, which is the correct scaffold protocols/init.md writes for a
# domain with no pages yet and must never be reported.
_wiki_pages_fence_balance() {
  local skillmd="$1"
  awk '
    BEGIN { in_pages = 0; in_fence = 0; open_line = 0 }
    /^## Pages/ { in_pages = 1; next }
    in_pages && /^## / {
      if (open_line) { printf "%d\tBEGIN_WITHOUT_END\n", open_line; open_line = 0 }
      in_pages = 0
      next
    }
    in_pages {
      if ($0 ~ /^```/ || $0 ~ /^~~~/) { in_fence = !in_fence; next }
      if (in_fence) next
      if ($0 ~ /^<!-- BEGIN:PAGES -->/) {
        # Keep the outer region open so a later END still closes it — a
        # nested BEGIN is one fault, not two.
        if (open_line) { printf "%d\tNESTED_BEGIN\n", NR } else { open_line = NR }
        next
      }
      if ($0 ~ /^<!-- END:PAGES -->/) {
        if (open_line) { open_line = 0 } else { printf "%d\tEND_WITHOUT_BEGIN\n", NR }
        next
      }
    }
    END {
      # Reachable only when ## Pages runs to EOF; the ^## rule above already
      # reports and clears open_line when a later section closes it.
      if (open_line) { printf "%d\tBEGIN_WITHOUT_END\n", open_line }
    }
  ' "$skillmd"
}

# --- Extract a page's frontmatter summary: value (empty if absent) ---
# summary: is always single-line double-quoted (wiki-memory/schema.md) —
# strips the surrounding double quotes. A trailing \r is stripped first
# (some content pages carry CRLF line endings) so it never blocks the
# trailing-quote match — without this, "%\"" silently no-ops when \r is
# the actual last character, leaving a residual quote + \r in the value
# and causing a false NAV_SUMMARY_MISMATCH against the (CRLF-free) nav
# text extracted from SKILL.md.
# Frontmatter is only recognized when line 1 is exactly "---" — the
# NR==1 guard below rejects a body-embedded "---"/"summary:"/"---" block
# later in the page (e.g. an illustrative template) that would otherwise
# be misread as real frontmatter (wiki-health-frontmatter-line1-only-
# detection).
_wiki_page_summary_value() {
  local full_path="$1"
  local raw
  raw=$(awk 'NR==1 && !/^---[[:space:]]*$/{exit} /^---/{count++; if(count==2) exit; next} count==1 && /^summary:/{sub(/^summary:[[:space:]]*/,""); print; exit}' "$full_path" 2>/dev/null || true)
  raw="${raw%$'\r'}"
  raw="${raw%\"}"
  raw="${raw#\"}"
  printf '%s' "$raw"
}

# --- Extract a page's frontmatter status: value (empty if absent) ---
# Same trailing-\r strip as _wiki_page_summary_value — without it, a CRLF
# page's status: value would carry a residual \r and never exact-match
# the literal string "archived" in the ARCHIVED_STATUS_MISMATCH checks.
# Same line-1-only frontmatter guard as _wiki_page_summary_value above.
_wiki_page_status_value() {
  local full_path="$1"
  local raw
  raw=$(awk 'NR==1 && !/^---[[:space:]]*$/{exit} /^---/{count++; if(count==2) exit; next} count==1 && /^status:/{sub(/^status:[[:space:]]*/,""); print; exit}' "$full_path" 2>/dev/null || true)
  raw="${raw%$'\r'}"
  raw="${raw%\"}"
  raw="${raw#\"}"
  printf '%s' "$raw"
}

# --- Detect whether a page's frontmatter carries a forbidden `updated:` key ---
# Page staleness is tracked via git log/mtime, never a YAML field, so an
# `updated:` key on any wiki page is always stale data and a merge-conflict
# risk (mirrors protocols/lint.md's widened Forbidden `updated:` field
# check). Same line-1-only frontmatter guard as _wiki_page_summary_value
# above. Returns 0 (true, via awk's exit code) when the field is present,
# 1 (false) otherwise — callers use this directly as an `if` condition.
_wiki_page_has_forbidden_updated_field() {
  local full_path="$1"
  awk 'NR==1 && !/^---[[:space:]]*$/{exit} /^---/{count++; if(count==2) exit} count==1 && /^updated:/{found=1} END{exit !found}' "$full_path" 2>/dev/null
}

# --- Collapse whitespace runs to a single space and trim ends ---
_wiki_normalize_ws() {
  printf '%s' "$1" | tr -s '[:space:]' ' ' | sed -E 's/^ //; s/ $//'
}

# --- Classify a single skill folder ---
# Sets global variables:
#   CLASSIFY_STATE, CLASSIFY_REASONS (array of "code:detail" strings)
#   CLASSIFY_FILES_* and CLASSIFY_PAGES_* for JSON schema fields
_classify_skill() {
  local skill_dir="$1"
  # Optional: a mdite-lint exit code the caller already obtained (e.g.
  # _run_maintenance_due, which also needs mdite's stdout for its own
  # due-condition leg and would otherwise pay the wrapper's external-process
  # cost a second time). Empty/absent -> invoke mdite here as before.
  local precomputed_mdite_rc="${2:-}"

  CLASSIFY_STATE=""
  CLASSIFY_REASONS=()

  # Files sub-object fields
  CLASSIFY_wiki_declared=false
  CLASSIFY_legacy_log_present=false
  CLASSIFY_adoption_signals=()
  CLASSIFY_pages_duplicate_last_verified=()
  CLASSIFY_mditerc_present=false
  CLASSIFY_entrypoint_correct=false
  CLASSIFY_pages_heading_present=false
  CLASSIFY_meta_heading_present=false
  CLASSIFY_staging_dir_present=false
  CLASSIFY_body_line_count=0
  CLASSIFY_body_section_count=0
  CLASSIFY_pages_placement="none"
  CLASSIFY_mdite_lint_exit_code=0

  # Pages sub-object fields
  CLASSIFY_pages_total=0
  CLASSIFY_pages_excluded_by_mditerc=0
  CLASSIFY_pages_missing_summary=()
  CLASSIFY_pages_forbidden_updated_field=()
  CLASSIFY_pages_unfenced_runs=()
  CLASSIFY_pages_unbalanced_fences=()   # "SKILL.md:<line>:<FAULT>"
  CLASSIFY_pages_tag_prefix_mismatches=()   # JSON fragments
  CLASSIFY_pages_listed_but_missing=()
  CLASSIFY_pages_orphan_index_md=false
  CLASSIFY_pages_orphan_pages=()
  CLASSIFY_pages_nav_summary_mismatches=()
  CLASSIFY_pages_archived_status_mismatches=()   # JSON fragments ("path:detail")

  # --- Collect file signals ---

  # Wiki identity (D15): the `wiki: true` declaration, and nothing else.
  _wiki_is_declared "$skill_dir/SKILL.md" && CLASSIFY_wiki_declared=true

  # (e) Legacy operations log. log.md is deleted fleet-wide (D3) and no
  # writer creates one any more, so a surviving file is migration debt --
  # a finding, which is what lets the audit report it mechanically rather
  # than asking an agent to go looking.
  [[ -f "$skill_dir/log.md" ]] && CLASSIFY_legacy_log_present=true

  # .mditerc presence and entrypoint check
  local mditerc="$skill_dir/.mditerc"
  if [[ -f "$mditerc" ]]; then
    CLASSIFY_mditerc_present=true
    if tr -d '\r' < "$mditerc" | grep -q '^entrypoint:[[:space:]]*SKILL\.md'; then
      CLASSIFY_entrypoint_correct=true
    fi
  fi

  # SKILL.md checks
  local skillmd="$skill_dir/SKILL.md"
  local pages_line=0
  local meta_line=0

  if [[ -f "$skillmd" ]]; then
    # Find ## Pages and ## Meta line numbers
    pages_line=$(grep -n '^## Pages' "$skillmd" | head -1 | cut -d: -f1 || true)
    meta_line=$(grep -n '^## Meta' "$skillmd" | head -1 | cut -d: -f1 || true)

    [[ -n "$pages_line" ]] && CLASSIFY_pages_heading_present=true
    [[ -n "$meta_line" ]] && CLASSIFY_meta_heading_present=true

    # Body line count: lines after the YAML frontmatter block (skip lines 1-N until closing ---)
    # Not previously guarded by any line-1 check — a SKILL.md whose own line 1
    # isn't "---" has no frontmatter, and the bare NR>1 scan below would find
    # a body-embedded "---" (e.g. an example template) instead, producing a
    # bogus frontmatter_end deep in the body. The NR==1 exit below rejects
    # that case up front (wiki-health-frontmatter-line1-only-detection).
    local total_lines
    total_lines=$(wc -l < "$skillmd")
    local frontmatter_end
    frontmatter_end=$(awk 'NR==1 && !/^---[[:space:]]*$/{exit} NR>1 && /^---/{print NR; exit}' "$skillmd" || true)
    if [[ -n "$frontmatter_end" ]]; then
      CLASSIFY_body_line_count=$(( total_lines - frontmatter_end ))
    else
      CLASSIFY_body_line_count="$total_lines"
    fi

    # Count ## sections after ## Meta
    if [[ -n "$meta_line" ]]; then
      CLASSIFY_body_section_count=$(awk -v meta="$meta_line" 'NR > meta && /^## /{count++} END{print count+0}' "$skillmd")
    fi

    # ## Pages placement
    if [[ "$CLASSIFY_pages_heading_present" == true && "$CLASSIFY_meta_heading_present" == true ]]; then
      if (( pages_line < meta_line )); then
        # Is it at the top (after frontmatter/role stub) or at the end?
        # "end" = body content before ## Pages exceeds 30 lines of non-frontmatter non-index content
        local content_before_pages
        if [[ -n "$frontmatter_end" ]]; then
          content_before_pages=$(( pages_line - frontmatter_end - 1 ))
        else
          content_before_pages=$(( pages_line - 1 ))
        fi
        if (( content_before_pages > 30 )); then
          CLASSIFY_pages_placement="end"
        else
          CLASSIFY_pages_placement="top"
        fi
      fi
    fi
  fi

  # Staging dir check (any subdirectory containing .origin file)
  local staging_found=false
  while IFS= read -r -d '' f; do
    staging_found=true
    break
  done < <(find "$skill_dir" -maxdepth 2 -name ".origin" -print0 2>/dev/null)
  [[ "$staging_found" == true ]] && CLASSIFY_staging_dir_present=true

  # Orphan top-level index.md (co-exists with ## Pages in SKILL.md)
  if [[ -f "$skill_dir/index.md" && "$CLASSIFY_pages_heading_present" == true ]]; then
    CLASSIFY_pages_orphan_index_md=true
  fi

  # mdite lint — run only if wiki signals present
  if [[ "$CLASSIFY_mditerc_present" == true && "$CLASSIFY_entrypoint_correct" == true ]]; then
    if [[ -n "$precomputed_mdite_rc" ]]; then
      # Caller already ran `mdite lint` once — reuse its exit code instead
      # of invoking the external process again.
      CLASSIFY_mdite_lint_exit_code="$precomputed_mdite_rc"
    elif command -v mdite &>/dev/null; then
      set +e
      # cd into skill_dir so mdite picks up .mditerc (mdite lint <abs-path> ignores .mditerc)
      ( cd "$skill_dir" && mdite lint . ) &>/dev/null
      CLASSIFY_mdite_lint_exit_code=$?
      set -e
    else
      # mdite not available — treat as lint pass (can't validate)
      CLASSIFY_mdite_lint_exit_code=0
    fi
  fi

  # --- Count wiki pages (exclude scripts/, assets/, and special files) ---
  local page_file
  local listed_pages=()

  # Collect pages listed in ## Pages section
  if [[ "$CLASSIFY_pages_heading_present" == true && -f "$skillmd" ]]; then
    while IFS= read -r page_path; do
      # Skip absolute paths and paths with ..
      [[ "$page_path" == /* || "$page_path" == *..* ]] && continue
      [[ -z "$page_path" ]] && continue
      listed_pages+=("$page_path")
    done < <(awk '/^## Pages/{found=1; next} found && /^## /{exit} found{print}' "$skillmd" \
              | grep -oE '\]\([^)]+\.md\)' | sed -E 's/^\]\(//; s/\)$//')
  fi

  # Scan actual page files (exclude special files and scripts/, assets/,
  # protocols/ subdirs — protocols/ holds workflow docs, not wiki content
  # pages, so they must not be candidates for missing-summary, tag-prefix,
  # or disk-orphan checks; see wiki-health-blind-spots).
  local all_pages=()
  while IFS= read -r rel; do
    [[ -n "$rel" ]] && all_pages+=("$rel")
  done < <(_wiki_collect_pages "$skill_dir")

  CLASSIFY_pages_total=${#all_pages[@]}

  # --- Visibility guard (mditerc exclude): count census candidates dropped
  # by .mditerc's exclude: patterns, so a broad glob can't silently hide
  # knowledge pages. Diffs the raw candidate walk against the (already
  # exclude-filtered) all_pages above rather than re-parsing .mditerc here.
  local all_candidates=()
  while IFS= read -r rel; do
    [[ -n "$rel" ]] && all_candidates+=("$rel")
  done < <(_wiki_collect_pages_candidates "$skill_dir")
  CLASSIFY_pages_excluded_by_mditerc=$(( ${#all_candidates[@]} - ${#all_pages[@]} ))

  # Check listed pages for missing files
  for lp in "${listed_pages[@]}"; do
    if [[ ! -f "$skill_dir/$lp" ]]; then
      CLASSIFY_pages_listed_but_missing+=("$lp")
    fi
  done

  # --- Disk-orphan detection (issue: wiki-health-blind-spots) ---
  # The check above only asks "is every listed page present on disk?" — it never
  # asks the reverse: "is every page on disk reachable from the index chain?".
  # Build a REACHABLE set = listed_pages, plus one hop through any listed page
  # that is itself a subdir hub (group/index.md): two-tier wikis (e.g.
  # claude-code-expert) list only the hub in SKILL.md's ## Pages, and the hub's
  # own ## Pages section lists the actual content pages relative to that subdir
  # — those must NOT be false-positived as orphans.
  local reachable_pages=("${listed_pages[@]}")
  local lp2
  for lp2 in "${listed_pages[@]}"; do
    if [[ "$lp2" == */index.md ]]; then
      local hub_subdir="${lp2%/index.md}"
      local hub_index="$skill_dir/$lp2"
      if [[ -f "$hub_index" ]]; then
        while IFS= read -r hub_page; do
          [[ "$hub_page" == /* || "$hub_page" == *..* ]] && continue
          [[ -z "$hub_page" ]] && continue
          reachable_pages+=("${hub_subdir}/${hub_page}")
        done < <(awk '/^## Pages/{found=1; next} found && /^## /{exit} found{print}' "$hub_index" \
                  | grep -oE '\]\([^)]+\.md\)' | sed -E 's/^\]\(//; s/\)$//')
      fi
    fi
  done

  # Any on-disk content page not present in reachable_pages is an orphan.
  for pf in "${all_pages[@]}"; do
    local pf_reachable=false
    local rp
    for rp in "${reachable_pages[@]}"; do
      if [[ "$pf" == "$rp" ]]; then
        pf_reachable=true
        break
      fi
    done
    [[ "$pf_reachable" == false ]] && CLASSIFY_pages_orphan_pages+=("$pf")
  done

  # Check page frontmatter: summary field required
  # Frontmatter only recognized when line 1 is exactly "---" — the NR==1
  # exit rejects a body-embedded "---"/"summary:"/"---" block (e.g. an
  # illustrative template) that would otherwise false-pass this check
  # (wiki-health-frontmatter-line1-only-detection).
  for pf in "${all_pages[@]}"; do
    local full_path="$skill_dir/$pf"
    if [[ -f "$full_path" ]]; then
      if ! awk 'NR==1 && !/^---[[:space:]]*$/{exit} /^---/{count++; if(count==2) exit} count==1 && /^summary:/{found=1} END{exit !found}' "$full_path" 2>/dev/null; then
        CLASSIFY_pages_missing_summary+=("$pf")
      fi
    fi
  done

  # Check forbidden `updated:` field (mirrors protocols/lint.md's widened
  # Forbidden `updated:` field check — mechanical, zero-LLM-token coverage so
  # the rule doesn't depend solely on an LLM remembering to apply the
  # protocol). Page staleness is tracked via git log/mtime, never a YAML
  # field, so an `updated:` key on any wiki page is always stale data and a
  # merge-conflict risk. Same NR==1 frontmatter-only guard as the summary
  # check above. Scoped over all_pages (ordinary knowledge pages) plus the
  # three meta files, which all_pages's page census deliberately excludes.
  for pf in "${all_pages[@]}"; do
    local full_path="$skill_dir/$pf"
    if [[ -f "$full_path" ]]; then
      if _wiki_page_has_forbidden_updated_field "$full_path"; then
        CLASSIFY_pages_forbidden_updated_field+=("$pf")
      fi
    fi
  done
  local uf_meta_name uf_meta_path
  for uf_meta_name in SKILL.md log.md schema.md; do
    uf_meta_path="$skill_dir/$uf_meta_name"
    if [[ -f "$uf_meta_path" ]]; then
      if _wiki_page_has_forbidden_updated_field "$uf_meta_path"; then
        CLASSIFY_pages_forbidden_updated_field+=("$uf_meta_name")
      fi
    fi
  done

  # Duplicate last-verified keys. `last-verified` is the one non-derivable
  # fact in the wiki, and a page carrying it twice has an ambiguous
  # verification date -- readers take the first, writers may append a second,
  # and the two disagree silently. Counted inside the frontmatter block only,
  # under the same NR==1 guard as the checks above, so a fenced example in
  # the body documenting the field is not a duplicate. Same scope as the
  # forbidden-`updated:` check: knowledge pages plus the meta files the page
  # census excludes.
  local dlv_name dlv_path dlv_count
  for dlv_name in "${all_pages[@]}" SKILL.md schema.md; do
    dlv_path="$skill_dir/$dlv_name"
    [[ -f "$dlv_path" ]] || continue
    dlv_count=$(awk '
      NR == 1 && !/^---[[:space:]]*$/ { exit }
      NR > 1 && /^---/ { exit }
      NR > 1 && /^last-verified:/ { c++ }
      END { print c+0 }
    ' "$dlv_path" 2>/dev/null)
    (( dlv_count > 1 )) && \
      CLASSIFY_pages_duplicate_last_verified+=("${dlv_name}:${dlv_count}")
  done

  # Check tag-prefix conformance (WMF-spec §1: healthy requires page tag prefixes match schema.md)
  #
  # Why: schema.md declares the authoritative tag prefix (e.g. winforms-expert/<subtopic>).
  # Pre-existing pages may carry an old prefix (e.g. winforms/<subtopic>) after a skill rename.
  # We extract the expected prefix from the first tags: example in a YAML frontmatter block
  # inside schema.md. If schema.md declares no tags: example, the check is skipped — the domain
  # author has not yet codified a prefix convention.
  local expected_tag_prefix=""
  local schema_file="$skill_dir/schema.md"
  if [[ -f "$schema_file" ]]; then
    # Extract the first tags: [...] value inside a fenced YAML block (``` or ~~~) in schema.md.
    # Pattern: line like "tags: [prefix/<subtopic>]" — grab everything before the first '/'.
    # We look only inside YAML blocks (between ``` yaml/--- fences) to avoid matching prose.
    expected_tag_prefix=$(awk '
      /^```/ || /^~~~/ { in_block = !in_block; next }
      in_block && /^tags:/ {
        # Extract text between [ and /, e.g. "tags: [winforms-expert/foo]" → "winforms-expert"
        match($0, /\[([^/\]]+)\//, arr)
        if (arr[1] != "") { print arr[1]; exit }
      }
    ' "$schema_file" 2>/dev/null || true)
  fi

  # Only run the prefix check when schema.md declares an explicit tag prefix
  if [[ -n "$expected_tag_prefix" ]]; then
    for pf in "${all_pages[@]}"; do
      local full_path="$skill_dir/$pf"
      if [[ -f "$full_path" ]]; then
        # Extract all tag values from the page's YAML frontmatter (between
        # first ---...--- block). Same NR==1 line-1-only frontmatter guard
        # as the MISSING_SUMMARY check above — a body-embedded "---" block
        # must never be mistaken for real frontmatter.
        local page_tags
        page_tags=$(awk 'NR==1 && !/^---[[:space:]]*$/{exit} /^---/{count++; if(count==2) exit} count==1 && /^tags:/{found=1} found && /^tags:/{print; next} found && /^[^ -]/{found=0} found{print}' "$full_path" 2>/dev/null || true)
        if [[ -n "$page_tags" ]]; then
          # Extract each tag prefix (text before the first '/') and compare against expected
          while IFS= read -r tag_line; do
            # Handle both "tags: [a/b, c/d]" and "- a/b" list formats
            # Extract each "word/..." token
            local tag_val
            while IFS= read -r tag_val; do
              [[ -z "$tag_val" ]] && continue
              local actual_prefix="${tag_val%%/*}"
              # Normalize: strip leading "- " markers or bracket residue
              actual_prefix="${actual_prefix#- }"
              actual_prefix="${actual_prefix#[}"
              actual_prefix="${actual_prefix%,}"
              actual_prefix="${actual_prefix%]}"
              actual_prefix="${actual_prefix// /}"
              [[ -z "$actual_prefix" || "$actual_prefix" == "$expected_tag_prefix" ]] && continue
              # Mismatch found — record it
              CLASSIFY_pages_tag_prefix_mismatches+=("$pf:${actual_prefix} != ${expected_tag_prefix}")
              break  # one mismatch per page is sufficient
            done < <(grep -oE '[a-zA-Z0-9_-]+/[a-zA-Z0-9_/.-]+' <<< "$page_tags" || true)
          done <<< "$page_tags"
        fi
      fi
    done
  fi

  # --- Nav-integrity checks (nav-summary + archived-status parity) ---
  #
  # NAV_SUMMARY_MISMATCH: for each ## Pages / ### Archived nav entry, the
  # text after the separator must exactly equal (whitespace-normalized) the
  # target page's frontmatter summary: value. Entries pointing at a missing
  # page are already covered by LISTED_PAGE_MISSING — skip them here since
  # there is no frontmatter to compare against.
  #
  # ARCHIVED_STATUS_MISMATCH: bidirectional — a page listed under
  # ### Archived must carry frontmatter status: archived, and any page
  # carrying frontmatter status: archived must be listed under ### Archived.
  # Keyed strictly on the exact value "archived" — other status: values
  # (e.g. status: captured, a learned-file schema leak) must never trip this.
  if [[ "$CLASSIFY_pages_heading_present" == true && -f "$skillmd" ]]; then
    local -A nav_archived_paths
    local nav_path nav_archived nav_summary

    while IFS=$'\x01' read -r nav_path nav_archived nav_summary; do
      [[ -z "$nav_path" ]] && continue
      [[ "$nav_path" == /* || "$nav_path" == *..* ]] && continue

      [[ "$nav_archived" == "1" ]] && nav_archived_paths["$nav_path"]=1

      local nav_full="$skill_dir/$nav_path"
      [[ -f "$nav_full" ]] || continue   # LISTED_PAGE_MISSING already covers this

      local fm_summary
      fm_summary="$(_wiki_page_summary_value "$nav_full")"
      if [[ "$(_wiki_normalize_ws "$nav_summary")" != "$(_wiki_normalize_ws "$fm_summary")" ]]; then
        CLASSIFY_pages_nav_summary_mismatches+=("$nav_path")
      fi

      local fm_status
      fm_status="$(_wiki_page_status_value "$nav_full")"
      if [[ "$nav_archived" == "1" && "$fm_status" != "archived" ]]; then
        CLASSIFY_pages_archived_status_mismatches+=("$nav_path:listed under ### Archived but frontmatter status is not 'archived'")
      fi
    done < <(_wiki_extract_nav_entries "$skillmd")

    for pf in "${all_pages[@]}"; do
      local full_path="$skill_dir/$pf"
      [[ -f "$full_path" ]] || continue
      local fm_status
      fm_status="$(_wiki_page_status_value "$full_path")"
      if [[ "$fm_status" == "archived" && -z "${nav_archived_paths[$pf]:-}" ]]; then
        CLASSIFY_pages_archived_status_mismatches+=("$pf:frontmatter status is 'archived' but page not listed under ### Archived")
      fi
    done
  fi

  # --- Marker-fence checks over the ## Pages section ---
  #
  # MISSING_PAGES_FENCE: every ## Pages bullet run must sit inside a
  # <!-- BEGIN:PAGES --> / <!-- END:PAGES --> region, which is what lets
  # wiki-write regenerate the whole region instead of patching one entry at a
  # time. A run outside every region is a run whose siblings' drift never
  # heals, so this gates state rather than merely reporting.
  #
  # UNBALANCED_PAGES_FENCE: an unterminated (or stray, or nested) marker makes
  # the run detector's fenced flag lie, which would be a silent false negative
  # inside the gate above. Both consume pure emitters, so no local is needed
  # to carry an exit status across the call.
  if [[ "$CLASSIFY_pages_heading_present" == true && -f "$skillmd" ]]; then
    local run_start run_end run_fenced
    while IFS=$'\t' read -r run_start run_end run_fenced; do
      [[ "$run_fenced" == "1" ]] && continue
      CLASSIFY_pages_unfenced_runs+=("SKILL.md:${run_start}-${run_end}")
    done < <(_wiki_pages_bullet_runs "$skillmd")

    local fence_line fence_fault
    while IFS=$'\t' read -r fence_line fence_fault; do
      CLASSIFY_pages_unbalanced_fences+=("SKILL.md:${fence_line}:${fence_fault}")
    done < <(_wiki_pages_fence_balance "$skillmd")
  fi

  # --- Determine state ---

  # An undeclared skill is not a wiki (D15). It is never reported as a broken
  # one -- the previous OR-test on .mditerc/## Pages is exactly what classified
  # 47 deliberately monolithic skills as `new`. Two outcomes, and only two:
  #
  #   structural signals present -> `new`, an adoption CANDIDATE, reported so a
  #     person can confirm it (D17). Never adopted without an explicit --fix.
  #   no structural signals       -> `not-a-wiki`. The audit says nothing about
  #     it at all: --all omits the row entirely and it cannot make the sweep
  #     non-healthy.
  #
  # The four signals are D17's, verbatim: a `## Pages` heading, a legacy
  # log.md, a .mditerc, or 3+ sibling pages carrying both tags: and summary:.
  # Any one is enough -- these are candidacy hints for a human, not a test to
  # be passed.
  if [[ "$CLASSIFY_wiki_declared" == false ]]; then
    [[ "$CLASSIFY_pages_heading_present" == true ]] && \
      CLASSIFY_adoption_signals+=("PAGES_HEADING:SKILL.md carries a ## Pages heading")
    [[ "$CLASSIFY_legacy_log_present" == true ]] && \
      CLASSIFY_adoption_signals+=("LEGACY_LOG:a log.md from a previous wiki generation is present")
    [[ "$CLASSIFY_mditerc_present" == true ]] && \
      CLASSIFY_adoption_signals+=("MDITERC_PRESENT:.mditerc file found")
    local wiki_shaped_pages=0
    for pf in "${all_pages[@]}"; do
      local wsp_path="$skill_dir/$pf"
      [[ -f "$wsp_path" ]] || continue
      if awk '
           NR == 1 && !/^---[[:space:]]*$/ { exit 1 }
           NR > 1 && /^---/ { exit !(t && sm) }
           NR > 1 && /^tags:/ { t = 1 }
           NR > 1 && /^summary:/ { sm = 1 }
           END { exit !(t && sm) }
         ' "$wsp_path" 2>/dev/null; then
        wiki_shaped_pages=$(( wiki_shaped_pages + 1 ))
      fi
    done
    (( wiki_shaped_pages >= 3 )) && \
      CLASSIFY_adoption_signals+=("SIBLING_PAGES:${wiki_shaped_pages} sibling pages carry both tags: and summary: frontmatter")

    if (( ${#CLASSIFY_adoption_signals[@]} > 0 )); then
      CLASSIFY_STATE="new"
      CLASSIFY_REASONS+=("ADOPTION_CANDIDATE:not declared a wiki (no 'wiki: true' in SKILL.md frontmatter) but structurally shaped like one -- adoptable, not broken")
      local asig
      for asig in "${CLASSIFY_adoption_signals[@]}"; do
        CLASSIFY_REASONS+=("$asig")
      done
    else
      CLASSIFY_STATE="not-a-wiki"
    fi
    return 0
  fi

  # Check for partial-migration:
  # Condition 1: staging dir present + .origin exists
  if [[ "$CLASSIFY_staging_dir_present" == true ]]; then
    CLASSIFY_STATE="partial-migration"
    CLASSIFY_REASONS+=("STAGING_DIR_PRESENT:Staging directory with .origin found — migration in progress")
    return 0
  fi

  # Condition 2: ## Pages present AND (body weight > 400 lines OR >2 ## sections after ## Meta)
  if [[ "$CLASSIFY_pages_heading_present" == true ]]; then
    if (( CLASSIFY_body_line_count > 400 )); then
      CLASSIFY_STATE="partial-migration"
      CLASSIFY_REASONS+=("BODY_WEIGHT_EXCEEDED:SKILL.md body is ${CLASSIFY_body_line_count} lines (threshold: 400) — content not yet decomposed to pages")
      return 0
    fi
    if (( CLASSIFY_body_section_count > 2 )); then
      CLASSIFY_STATE="partial-migration"
      CLASSIFY_REASONS+=("EXCESSIVE_BODY_SECTIONS:SKILL.md has ${CLASSIFY_body_section_count} ## sections after ## Meta (threshold: >2) — content not yet decomposed to pages")
      return 0
    fi
  fi

  # Check for unhealthy: wiki-backed but has problems
  local unhealthy_reasons=()

  [[ "$CLASSIFY_mditerc_present" == false ]] && \
    unhealthy_reasons+=("MDITERC_MISSING:.mditerc file not found")
  [[ "$CLASSIFY_mditerc_present" == true && "$CLASSIFY_entrypoint_correct" == false ]] && \
    unhealthy_reasons+=("ENTRYPOINT_WRONG:.mditerc entrypoint is not SKILL.md")
  [[ "$CLASSIFY_pages_heading_present" == false ]] && \
    unhealthy_reasons+=("NO_PAGES_HEADING:SKILL.md has no ## Pages heading")
  [[ "$CLASSIFY_meta_heading_present" == false ]] && \
    unhealthy_reasons+=("NO_META_HEADING:SKILL.md missing ## Meta section")
  [[ "$CLASSIFY_legacy_log_present" == true ]] && \
    unhealthy_reasons+=("LEGACY_LOG_PRESENT:log.md is present -- the operations log was retired (D3); delete it")
  (( CLASSIFY_mdite_lint_exit_code != 0 )) && \
    unhealthy_reasons+=("MDITE_LINT_FAILURE:mdite lint exited ${CLASSIFY_mdite_lint_exit_code}")
  [[ "$CLASSIFY_pages_orphan_index_md" == true ]] && \
    unhealthy_reasons+=("ORPHAN_INDEX_MD:top-level index.md co-exists with ## Pages in SKILL.md")

  for mp in "${CLASSIFY_pages_missing_summary[@]}"; do
    unhealthy_reasons+=("MISSING_SUMMARY:page ${mp} missing summary frontmatter field")
  done

  for fu in "${CLASSIFY_pages_forbidden_updated_field[@]}"; do
    unhealthy_reasons+=("FORBIDDEN_UPDATED_FIELD:page ${fu} carries a forbidden updated: frontmatter field (staleness is tracked via git log/mtime, never a YAML field)")
  done

  for dv in "${CLASSIFY_pages_duplicate_last_verified[@]}"; do
    unhealthy_reasons+=("DUPLICATE_LAST_VERIFIED:page ${dv%:*} carries ${dv##*:} last-verified keys in one frontmatter block -- the verification date is ambiguous")
  done

  for ur in "${CLASSIFY_pages_unfenced_runs[@]}"; do
    unhealthy_reasons+=("MISSING_PAGES_FENCE:## Pages bullet run at ${ur} is not wrapped in <!-- BEGIN:PAGES --> / <!-- END:PAGES --> markers")
  done

  for ub in "${CLASSIFY_pages_unbalanced_fences[@]}"; do
    # Format stored as "SKILL.md:<line>:<FAULT>" — the page:detail compound
    # form extended with the fault kind, which selects the wording. The kind
    # never contains a colon, so the last segment splits off cleanly.
    local ub_loc="${ub%:*}"
    local ub_detail=""
    case "${ub##*:}" in
      BEGIN_WITHOUT_END)
        ub_detail="<!-- BEGIN:PAGES --> at ${ub_loc} has no matching <!-- END:PAGES --> before the end of ## Pages" ;;
      END_WITHOUT_BEGIN)
        ub_detail="<!-- END:PAGES --> at ${ub_loc} has no preceding <!-- BEGIN:PAGES --> in ## Pages" ;;
      NESTED_BEGIN)
        ub_detail="<!-- BEGIN:PAGES --> at ${ub_loc} opens a second region before the previous one was closed by <!-- END:PAGES -->" ;;
    esac
    unhealthy_reasons+=("UNBALANCED_PAGES_FENCE:${ub_detail}")
  done

  for lm in "${CLASSIFY_pages_listed_but_missing[@]}"; do
    unhealthy_reasons+=("LISTED_PAGE_MISSING:page listed in ## Pages but file missing: ${lm}")
  done

  for op in "${CLASSIFY_pages_orphan_pages[@]}"; do
    unhealthy_reasons+=("ORPHAN_PAGE:page on disk but not reachable from SKILL.md ## Pages (directly or via a subdir hub index.md): ${op}")
  done

  for tm in "${CLASSIFY_pages_tag_prefix_mismatches[@]}"; do
    # Format stored as "page-path:actual != expected" — emit as structured reason code
    local tm_page="${tm%%:*}"
    local tm_detail="${tm#*:}"
    unhealthy_reasons+=("TAG_PREFIX_MISMATCH:${tm_page}: tag prefix ${tm_detail}")
  done

  for nm in "${CLASSIFY_pages_nav_summary_mismatches[@]}"; do
    unhealthy_reasons+=("NAV_SUMMARY_MISMATCH:page ${nm} nav summary does not match frontmatter summary")
  done

  for am in "${CLASSIFY_pages_archived_status_mismatches[@]}"; do
    # Format stored as "page-path:detail" — emit as structured reason code
    local am_page="${am%%:*}"
    local am_detail="${am#*:}"
    unhealthy_reasons+=("ARCHIVED_STATUS_MISMATCH:${am_page}: ${am_detail}")
  done

  if [[ ${#unhealthy_reasons[@]} -gt 0 ]]; then
    CLASSIFY_STATE="unhealthy"
    CLASSIFY_REASONS=("${unhealthy_reasons[@]}")
    return 0
  fi

  # All checks passed — healthy
  CLASSIFY_STATE="healthy"
  return 0
}

# ==============================================================================
# --full deep-audit support
# ==============================================================================

# Sets globals:
#   DEEP_CROSS_REFS — array of "source_page|target_page|signal" strings
#   DEEP_GROUP_AFFINITY — array of "page|target_group/slug|signal" strings
DEEP_CROSS_REFS=()
DEEP_GROUP_AFFINITY=()

# Pure-bash token intersection: returns count of tokens common to two
# space-separated sorted-unique token strings.
# Inputs are already sorted unique, one token per "word", space-separated.
# Jaccard check: given two sorted-unique space-separated token strings,
# sets global _JACCARD_HIT=1 if overlap >= 0.4, else _JACCARD_HIT=0.
# No echo/subshell — safe under set -e.
_jaccard_check() {
  local a="$1" b="$2"
  _JACCARD_HIT=0
  local inter=0 ca=0 cb=0 word union
  for word in $a; do
    ca=$(( ca + 1 ))
    case " $b " in *" $word "*) inter=$(( inter + 1 )) ;; esac
  done
  if [ "$inter" -eq 0 ]; then return; fi
  for word in $b; do cb=$(( cb + 1 )); done
  union=$(( ca + cb - inter ))
  if [ "$union" -eq 0 ]; then return; fi
  # threshold 0.4: inter * 10 / union >= 4
  if [ $(( inter * 10 / union )) -ge 4 ]; then _JACCARD_HIT=1; fi
}

# Collect all content page paths for a skill_dir (same exclusion rules as _classify_skill)
# Outputs newline-delimited relative paths
_collect_content_pages() {
  local skill_dir="$1"
  while IFS= read -r -d '' f; do
    local rel="${f#$skill_dir/}"
    [[ "$rel" == scripts/* || "$rel" == assets/* ]] && continue
    local base
    base="$(basename "$f")"
    [[ "$base" == "SKILL.md" || "$base" == "log.md" || "$base" == "schema.md" || "$base" == "index.md" || "$base" == ".origin" || "$base" == ".snapshot" ]] && continue
    printf '%s\n' "$rel"
  done < <(find "$skill_dir" -maxdepth 3 -name "*.md" -not -path "*/scripts/*" -not -path "*/assets/*" -print0 2>/dev/null)
}

# Precompute all signals for all pages in skill_dir in a SINGLE awk pass.
# Outputs one line per page:
#   PAGE_PATH<TAB>SLUG<TAB>H1<TAB>SORTED_TAGS<TAB>SORTED_HEADING_TOKENS<TAB>CODE_FP_LIST<TAB>NOUN_PHRASES<TAB>EXISTING_LINKS
# Where SORTED_* fields are space-separated sorted-unique lowercase tokens.
# CODE_FP_LIST: space-separated md5 checksums of code blocks (one per block).
# NOUN_PHRASES: colon-separated hyphenated phrases (only for short pages).
# EXISTING_LINKS: space-separated basenames (without .md) that this page links to.
_precompute_page_signals() {
  local skill_dir="$1"
  # Single awk program reads all pages, extracts signals, outputs one record per page.
  # We run it by feeding each file path to awk; for performance, batch with xargs.
  find "$skill_dir" -maxdepth 3 -name "*.md" \
    -not -path "*/scripts/*" -not -path "*/assets/*" \
    -print0 2>/dev/null \
  | xargs -0 -I{} awk -v SKILL_DIR="$skill_dir" -v FILEPATH="{}" '
  BEGIN {
    rel = FILEPATH
    sub(SKILL_DIR "/", "", rel)
    # Skip special files
    n = split(rel, parts, "/")
    base = parts[n]
    if (base == "SKILL.md" || base == "log.md" || base == "schema.md" ||
        base == "index.md" || base == ".origin" || base == ".snapshot") {
      skip = 1
    }
    if (rel ~ /^scripts\// || rel ~ /^assets\//) skip = 1
    in_front = 0; front_done = 0; front_count = 0
    in_code = 0; code_block = ""
    tags = ""; headings = ""; h1 = ""; links = ""
    body_lines = 0; noun_src = ""
    # Stop words (short list for heading filtering)
    split("a an the and or for of in on at to from with by is are was were be been being it its that this these those not no do does did have has had will would can could may might shall should must if then else how when where what which who why per vs use set get all any each via", sw, " ")
    for (w in sw) stop[sw[w]] = 1
  }
  {
    if (skip) next
    # Frontmatter detection — only recognized when it opens on line 1
    # (NR==1); a body-embedded "---" block must never be mistaken for real
    # frontmatter (wiki-health-frontmatter-line1-only-detection). DEAD CODE:
    # no call sites currently invoke this function (verified via repo grep)
    # — the guard is applied here only for consistency with the other
    # frontmatter-detection sites in this file, not because this path is
    # exercised.
    if (NR == 1) {
      if (/^---[[:space:]]*$/) { front_count = 1; in_front = 1; next }
      front_done = 1
    } else if (in_front && /^---/) {
      front_count++
      in_front = 0
      front_done = 1
      next
    }
    if (in_front) {
      if (/^tags:/) {
        gsub(/tags:[ \t]*/, "")
        gsub(/[\[\],"'"'"']/, " ")
        n = split(tolower($0), toks, /[ \t]+/)
        for (k=1;k<=n;k++) {
          t = toks[k]
          gsub(/^[ \t]+|[ \t]+$/, "", t)
          if (t != "" && t !~ /^[a-z]+-expert$/ && t !~ /^[0-9]+$/ && length(t) > 1)
            tags = tags " " t
        }
      }
      next
    }
    if (!front_done) next
    # Body
    body_lines++
    # H1
    if (!h1 && /^# [^ ]/) {
      h1 = tolower($0)
      gsub(/^# /, "", h1)
      gsub(/ /, "-", h1)
    }
    # Headings (## and ###)
    if (/^##/) {
      line = tolower($0)
      gsub(/^#+[ \t]*/, "", line)
      n = split(line, words, /[ \t]+/)
      for (k=1; k<=n; k++) {
        w = words[k]
        gsub(/[^a-z0-9]/, "", w)
        if (w != "" && !(w in stop) && length(w) > 2)
          headings = headings " " w
      }
    }
    # Code blocks
    if (/^```/ || /^~~~/) {
      if (!in_code) { in_code = 1; code_block = "" }
      else {
        # End of code block — compute a simple checksum (sum of char codes mod 999983)
        cksum = 0
        n = length(code_block)
        for (k=1; k<=n; k++) cksum = (cksum * 31 + ord(substr(code_block,k,1))) % 999983
        if (cksum > 0) fps = fps " " cksum
        in_code = 0; code_block = ""
      }
      next
    }
    if (in_code) { code_block = code_block $0 "\n"; next }
    # Markdown links: extract basename of linked .md files.
    # Require the closing-bracket-then-paren pair (real markdown link syntax)
    # rather than a bare parenthetical ending in .md) — a prose aside like
    # "(and overwrites SKILL.md)" is not a link and must not match.
    line = $0
    while (match(line, /\]\([^)]*\.md\)/, m)) {
      lnk = m[0]
      sub(/^\]/, "", lnk)
      gsub(/[\(\)]/, "", lnk)
      n2 = split(lnk, lparts, "/")
      bname = lparts[n2]
      gsub(/\.md$/, "", bname)
      links = links " " bname
      # advance past this match
      line = substr(line, RSTART + RLENGTH)
    }
    # Noun phrases from short pages (≤10 lines) — extract capitalized multi-word sequences
    if (body_lines <= 10) {
      noun_src = noun_src " " $0
    }
  }
  function ord(c,  i) {
    for (i=0; i<256; i++) if (sprintf("%c",i) == c) return i
    return 0
  }
  END {
    if (skip) exit
    # Normalize: sort and deduplicate space-separated token lists
    # (awk does not have sort, so we just output as-is; bash will sort later)
    slug = rel
    gsub(/\.md$/, "", slug)
    n = split(slug, sp, "/"); slug = sp[n]

    # Extract noun phrases: capitalize-led sequences of 2-4 capitalized/hyphenated words
    np = ""
    while (match(noun_src, /([A-Z][a-zA-Z0-9-]+[ \t]+){1,3}[A-Z][a-zA-Z0-9-]+/)) {
      phrase = substr(noun_src, RSTART, RLENGTH)
      phrase = tolower(phrase)
      gsub(/[ \t]+/, "-", phrase)
      gsub(/-+$/, "", phrase)
      if (length(phrase) >= 5) np = np ":" phrase
      noun_src = substr(noun_src, RSTART + RLENGTH)
    }
    gsub(/^:/, "", np)

    printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n", \
      rel, slug, h1, tags, headings, fps, np, links
  }
  ' FILEPATH="{}" "$skill_dir/{}" 2>/dev/null || true
}

# Run Step 5b pairwise cross-link scan on all pages in skill_dir
# Populates DEEP_CROSS_REFS global array.
# Uses a SINGLE awk pass over all files for O(n) precomputation.
_deep_scan_cross_refs() {
  local skill_dir="$1"

  # Collect all content pages
  local all_pages=()
  while IFS= read -r p; do
    [[ -n "$p" ]] && all_pages+=("$p")
  done < <(_collect_content_pages "$skill_dir")

  local n=${#all_pages[@]}
  [ "$n" -lt 2 ] && return

  if [ "$n" -gt 50 ]; then
    echo "WARNING: --full scan on ${n} pages may be slow for large wikis" >&2
  fi

  # Build absolute file list for awk
  local file_list=()
  local i
  for (( i = 0; i < n; i++ )); do
    file_list+=("$skill_dir/${all_pages[$i]}")
  done

  # Single awk pass: read ALL page files at once.
  # Outputs one line per page using \x01 (ASCII SOH) as delimiter to avoid
  # bash read IFS-whitespace collapsing of consecutive tabs when fps is empty.
  #   REL_PATH\x01TAGS\x01HEADINGS\x01FPS\x01NP\x01LINKS\x01H1
  # All token fields are space-separated, deduped within awk.
  local awk_out
  awk_out=$(awk -v SKILL_DIR="$skill_dir" '
  BEGIN {
    split("a an the and or for of in on at to from with by is are was were be been being it its that this these those not no do does did have has had will would can could may might shall should must if then else how when where what which who why per vs use set get all any each via", sw, " ")
    for (w in sw) stop[sw[w]] = 1
    reset()
  }
  function reset(  ) {
    in_front=0; fc=0; fd=0; in_code=0; code_block=""; code_lines=0
    tags=""; headings=""; h1=""; links=""; noun_src=""; fps=""
    body_lines=0
    delete seen_tags; delete seen_headings; delete seen_fps
  }
  function emit(fn,  rel, np) {
    rel = fn; sub(SKILL_DIR "/", "", rel)
    # Compute noun phrases
    np = ""
    while (match(noun_src, /([A-Z][a-zA-Z0-9-]+[ \t]+){1,3}[A-Z][a-zA-Z0-9-]+/)) {
      phrase = substr(noun_src, RSTART, RLENGTH)
      phrase = tolower(phrase)
      gsub(/[ \t]+/, "-", phrase); gsub(/-+$/, "", phrase)
      if (length(phrase) >= 5 && phrase !~ /^[a-z]+-expert/) np = np ":" phrase
      noun_src = substr(noun_src, RSTART + RLENGTH)
    }
    gsub(/^:/, "", np)
    printf "%s\x01%s\x01%s\x01%s\x01%s\x01%s\x01%s\n", rel, tags, headings, fps, np, links, h1
  }
  # Frontmatter is only recognized when it opens on line 1 of each file
  # (FNR==1) — a body-embedded "---" block must never be mistaken for real
  # frontmatter (wiki-health-frontmatter-line1-only-detection).
  FNR == 1 {
    if (NR > 1) emit(cur_fn)
    cur_fn = FILENAME
    reset()
    if (/^---[[:space:]]*$/) { fc=1; in_front=1; next }
    fd=1
  }
  in_front && /^---/ {
    fc++
    in_front=0
    fd=1
    next
  }
  in_front {
    if (/^tags:/) {
      line = $0; gsub(/tags:[ \t]*/, "", line); gsub(/[\[\],"'"'"']/, " ", line)
      n2 = split(tolower(line), toks, /[ \t]+/)
      for (k=1;k<=n2;k++) {
        t = toks[k]; gsub(/^[ \t]+|[ \t]+$/, "", t)
        # Skip expert-name tokens, path-style group tags (contain /), and short tokens
        if (t != "" && t !~ /^[a-z]+-expert$/ && t !~ /\// && length(t)>1 && !(t in seen_tags)) {
          seen_tags[t]=1; tags = tags " " t
        }
      }
    }
    next
  }
  !fd { next }
  {
    body_lines++
    if (!h1 && /^# [^ ]/) { h1 = tolower($0); sub(/^# /, "", h1); gsub(/ /, "-", h1) }
    if (/^##/) {
      line = tolower($0); gsub(/^#+[ \t]*/, "", line)
      # Skip structural-section headings that add no semantic signal
      if (line ~ /^(related|see also|see-also|meta|pages|references|links|notes|checklists?)$/) next
      n2 = split(line, words, /[ \t]+/)
      for (k=1;k<=n2;k++) {
        w = words[k]; gsub(/[^a-z0-9]/, "", w)
        # Drop heading stopwords before adding to token set
        if (w ~ /^(related|also|meta|pages|references|links|notes|checklists?)$/) continue
        if (w != "" && !(w in stop) && length(w)>2 && !(w in seen_headings)) {
          seen_headings[w]=1; headings = headings " " w
        }
      }
    }
    if (/^```/ || /^~~~/) {
      if (!in_code) { in_code=1; code_block=""; code_lines=0 }
      else {
        # Only fingerprint substantial blocks (≥4 lines) to avoid hash collisions on trivial snippets
        if (code_lines >= 4) {
          ck=0; nb=length(code_block)
          for (k=1;k<=nb;k++) ck=(ck*31+ord(substr(code_block,k,1)))%999983
          if (ck>0 && !(ck in seen_fps)) { seen_fps[ck]=1; fps=fps" "ck }
        }
        in_code=0; code_block=""; code_lines=0
      }
      next
    }
    if (in_code) { code_block = code_block $0 "\n"; code_lines++; next }
    # Require the closing-bracket-then-paren pair — see matching note in
    # _precompute_page_signals above; a bare parenthetical also matches prose
    # asides that happen to end in .md) and are not links.
    line = $0
    while (match(line, /\]\([^)]*\.md\)/)) {
      lnk = substr(line, RSTART, RLENGTH); sub(/^\]/, "", lnk); gsub(/[\(\)]/, "", lnk)
      n2 = split(lnk, lp, "/"); bname=lp[n2]; gsub(/\.md$/, "", bname)
      links = links " " bname
      line = substr(line, RSTART+RLENGTH)
    }
    if (body_lines <= 10) noun_src = noun_src " " $0
  }
  function ord(c,  k) { for (k=0;k<256;k++) if (sprintf("%c",k)==c) return k; return 0 }
  END { emit(cur_fn) }
  ' "${file_list[@]}" 2>/dev/null || true)

  # Parse awk output into indexed arrays
  local page_slugs=() page_h1s=() page_tags_sorted=() page_headings_sorted=()
  local page_fps_sorted=() page_nps=() page_links=()

  i=0
  while IFS=$'\x01' read -r f_rel f_tags f_head f_fps f_np f_links f_h1; do
    [[ -z "$f_rel" ]] && continue
    all_pages[$i]="$f_rel"
    page_tags_sorted[$i]="$f_tags"
    page_headings_sorted[$i]="$f_head"
    page_fps_sorted[$i]="$f_fps"
    page_nps[$i]="$f_np"
    page_links[$i]=" $f_links "
    page_h1s[$i]="$f_h1"
    local slug="${f_rel%.md}"; slug="${slug##*/}"
    page_slugs[$i]="$slug"
    i=$(( i + 1 ))
  done <<< "$awk_out"
  n=$i

  # Pairwise comparison — pure bash, no subshells in the inner loop
  local j
  for (( i = 0; i < n - 1; i++ )); do
    [[ -z "${all_pages[$i]}" ]] && continue
    local page_a="${all_pages[$i]}"
    local slug_a="${page_slugs[$i]}"
    local tags_a="${page_tags_sorted[$i]}"
    local head_a="${page_headings_sorted[$i]}"
    local fps_a="${page_fps_sorted[$i]}"
    local np_a="${page_nps[$i]}"
    local links_a="${page_links[$i]}"
    local h1_a="${page_h1s[$i]}"

    for (( j = i + 1; j < n; j++ )); do
      [[ -z "${all_pages[$j]}" ]] && continue
      local page_b="${all_pages[$j]}"
      local slug_b="${page_slugs[$j]}"
      local tags_b="${page_tags_sorted[$j]}"
      local head_b="${page_headings_sorted[$j]}"
      local fps_b="${page_fps_sorted[$j]}"
      local np_b="${page_nps[$j]}"
      local links_b="${page_links[$j]}"
      local h1_b="${page_h1s[$j]}"

      # Skip pairs already cross-linked (check links arrays — O(1) bash pattern match)
      case "$links_a" in *" $slug_b "*) continue ;; esac
      case "$links_b" in *" $slug_a "*) continue ;; esac

      local signal_hit=false signal_name=""

      # Signal 1: tag overlap (any tag token in common, filtering skill-name tokens)
      if [[ -n "$tags_a" && -n "$tags_b" ]]; then
        local tok
        for tok in $tags_a; do
          case " $tags_b " in *" $tok "*)
            signal_hit=true; signal_name="tag-overlap(${tok})"; break ;;
          esac
        done
      fi

      # Signal 2: heading-text similarity (Jaccard ≥ 0.4, pure bash)
      if [[ "$signal_hit" == false && -n "$head_a" && -n "$head_b" ]]; then
        _jaccard_check "$head_a" "$head_b"
        if [ "$_JACCARD_HIT" -eq 1 ]; then
          signal_hit=true; signal_name="heading-similarity"
        fi
      fi

      # Signal 3: code-block fingerprint (exact checksum match)
      if [[ "$signal_hit" == false && -n "$fps_a" && -n "$fps_b" ]]; then
        local fp
        for fp in $fps_a; do
          case " $fps_b " in *" $fp "*)
            signal_hit=true; signal_name="code-fingerprint"; break ;;
          esac
        done
      fi

      # Signal 4: noun-phrase match (phrase from A matches slug/H1 of B, and vice versa)
      if [[ "$signal_hit" == false ]]; then
        # Check A's noun phrases against B's slug and H1
        if [[ -n "$np_a" ]]; then
          local phrase
          IFS=':' read -ra phrases_a <<< "$np_a"
          for phrase in "${phrases_a[@]}"; do
            [[ -z "$phrase" ]] && continue
            if [[ "$slug_b" == *"$phrase"* || "$h1_b" == *"$phrase"* ]]; then
              signal_hit=true; signal_name="noun-phrase(${phrase})"; break
            fi
            # Check slug-prefix match (first segment of slug_b, min 5 chars)
            local sp="${slug_b%-*}"
            if [[ ${#sp} -ge 5 && "$phrase" == *"$sp"* ]]; then
              signal_hit=true; signal_name="noun-phrase(slug-prefix:${sp})"; break
            fi
          done
        fi
        # Check B's noun phrases against A's slug and H1
        if [[ "$signal_hit" == false && -n "$np_b" ]]; then
          IFS=':' read -ra phrases_b <<< "$np_b"
          local phrase
          for phrase in "${phrases_b[@]}"; do
            [[ -z "$phrase" ]] && continue
            if [[ "$slug_a" == *"$phrase"* || "$h1_a" == *"$phrase"* ]]; then
              signal_hit=true; signal_name="noun-phrase(${phrase}→${slug_a})"; break
            fi
          done
        fi
      fi

      if [[ "$signal_hit" == true ]]; then DEEP_CROSS_REFS+=("${page_a}|${page_b}|${signal_name}"); fi
    done
  done
}

# Run Step 6 group-affinity check for top-level pages that could PROMOTE-INTO a subdir
# Populates DEEP_GROUP_AFFINITY global array
# Uses a SINGLE awk pass over all top-level pages + group index/content files.
_deep_scan_group_affinity() {
  local skill_dir="$1"

  # Find existing subdirectory groups (dirs with index.md)
  local groups=()
  while IFS= read -r -d '' d; do
    local rel_d="${d#$skill_dir/}"
    [[ -f "$d/index.md" ]] && groups+=("$rel_d")
  done < <(find "$skill_dir" -mindepth 1 -maxdepth 1 -type d -not -name "scripts" -not -name "assets" -print0 2>/dev/null)

  [ "${#groups[@]}" -eq 0 ] && return

  # Find top-level .md pages (not in subdirs, not special files)
  local top_pages=()
  while IFS= read -r -d '' f; do
    local rel="${f#$skill_dir/}"
    [[ "$rel" == */* ]] && continue
    local base; base="$(basename "$f")"
    [[ "$base" == "SKILL.md" || "$base" == "log.md" || "$base" == "schema.md" || "$base" == "index.md" ]] && continue
    top_pages+=("$rel")
  done < <(find "$skill_dir" -maxdepth 1 -name "*.md" -print0 2>/dev/null)

  [ "${#top_pages[@]}" -eq 0 ] && return

  # Collect all files for single awk pass:
  #   top-level pages + group index files + group content files
  local all_ga_files=()
  local grp
  for grp in "${groups[@]}"; do
    [[ -f "$skill_dir/$grp/index.md" ]] && all_ga_files+=("$skill_dir/$grp/index.md")
    while IFS= read -r -d '' gf; do
      all_ga_files+=("$gf")
    done < <(find "$skill_dir/$grp" -name "*.md" -not -name "index.md" -print0 2>/dev/null)
  done
  local page
  for page in "${top_pages[@]}"; do
    [[ -f "$skill_dir/$page" ]] && all_ga_files+=("$skill_dir/$page")
  done

  [ "${#all_ga_files[@]}" -eq 0 ] && return

  # Single awk pass: extracts tags, h1, headings from each file.
  # Outputs: REL_PATH<TAB>TAGS<TAB>H1<TAB>HEADINGS
  local ga_awk_out
  ga_awk_out=$(awk -v SKILL_DIR="$skill_dir" '
  BEGIN {
    split("a an the and or for of in on at to from with by is are was were be been being it its that this these those not no do does did have has had will would can could may might shall should must if then else how when where what which who why per vs use set get all any each via", sw, " ")
    for (w in sw) stop[sw[w]] = 1
    reset()
  }
  function reset() { in_front=0; fc=0; fd=0; tags=""; h1=""; headings="" }
  function emit(fn,  rel) {
    rel = fn; sub(SKILL_DIR "/", "", rel)
    printf "%s\t%s\t%s\t%s\n", rel, tags, h1, headings
  }
  # Frontmatter is only recognized when it opens on line 1 of each file
  # (FNR==1) — a body-embedded "---" block must never be mistaken for real
  # frontmatter (wiki-health-frontmatter-line1-only-detection).
  FNR == 1 {
    if (NR > 1) emit(cur_fn)
    cur_fn=FILENAME
    reset()
    if (/^---[[:space:]]*$/) { fc=1; in_front=1; next }
    fd=1
  }
  in_front && /^---/ { fc++; in_front=0; fd=1; next }
  in_front {
    if (/^tags:/) {
      line=$0; gsub(/tags:[ \t]*/, "", line); gsub(/[\[\],"'"'"']/, " ", line)
      n=split(tolower(line), toks, /[ \t]+/)
      for (k=1;k<=n;k++) { t=toks[k]; gsub(/^[ \t]+|[ \t]+$/,"",t); if (t!=""&&length(t)>1) tags=tags" "t }
    }
    next
  }
  !fd { next }
  {
    if (!h1 && /^# [^ ]/) { h1=tolower($0); sub(/^# /,"",h1); gsub(/ /,"-",h1) }
    if (/^##/) {
      line=tolower($0); gsub(/^#+[ \t]*/,"",line)
      n=split(line, words, /[ \t]+/)
      for (k=1;k<=n;k++) { w=words[k]; gsub(/[^a-z0-9]/,"",w); if (w!=""&&!(w in stop)&&length(w)>2) headings=headings" "w }
    }
  }
  END { emit(cur_fn) }
  ' "${all_ga_files[@]}" 2>/dev/null || true)

  # Parse awk output into per-file signal maps (assoc arrays keyed by rel path)
  declare -A ga_tags ga_h1 ga_head
  while IFS=$'\t' read -r f_rel f_tags f_h1 f_head; do
    [[ -z "$f_rel" ]] && continue
    ga_tags["$f_rel"]="$f_tags"
    ga_h1["$f_rel"]="$f_h1"
    ga_head["$f_rel"]="$f_head"
  done <<< "$ga_awk_out"

  # Build per-group tag sets (hierarchical tags containing '/') from group content pages
  declare -A grp_tag_set grp_idx_head
  for grp in "${groups[@]}"; do
    local gt=""
    while IFS= read -r -d '' gf; do
      local grel="${gf#$skill_dir/}"
      local t="${ga_tags[$grel]:-}"
      [[ -n "$t" ]] && gt+=" $t"
    done < <(find "$skill_dir/$grp" -name "*.md" -not -name "index.md" -print0 2>/dev/null)
    # Keep only slash-containing tags (group-domain tags)
    local filtered_gt=""
    local w
    for w in $gt; do
      [[ "$w" == */* ]] && filtered_gt+=" $w"
    done
    grp_tag_set["$grp"]="$filtered_gt"
    local idx_rel="$grp/index.md"
    grp_idx_head["$grp"]="${ga_head[$idx_rel]:-}"
  done

  # Match top-level pages against groups
  for page in "${top_pages[@]}"; do
    [[ -z "${ga_tags[$page]+x}" ]] && continue
    local p_tags="${ga_tags[$page]}"
    local p_h1="${ga_h1[$page]}"
    local p_head="${ga_head[$page]}"

    for grp in "${groups[@]}"; do
      local match=false match_signal=""

      # Signal 1: tag overlap (hierarchical tags)
      local gt="${grp_tag_set[$grp]}"
      if [[ -n "$p_tags" && -n "$gt" ]]; then
        local tok
        for tok in $p_tags; do
          [[ "$tok" != */* ]] && continue
          case " $gt " in *" $tok "*)
            match=true; match_signal="tag-prefix-match(${tok})"; break ;;
          esac
        done
      fi

      # Signal 2: heading overlap with group index
      if [[ "$match" == false ]]; then
        local gi_head="${grp_idx_head[$grp]}"
        if [[ -n "$p_head" && -n "$gi_head" ]]; then
          _jaccard_check "$p_head" "$gi_head"
          if [ "$_JACCARD_HIT" -eq 1 ]; then
            match=true; match_signal="heading-overlap(${grp})"
          fi
        fi
        # Group name appears in page H1
        local grp_slug="${grp##*/}"
        local grp_clean="${grp_slug//-/ }"
        if [[ "$p_h1" == *"$grp_clean"* ]]; then
          match=true; match_signal="h1-contains-group-name(${grp_slug})"
        fi
      fi

      if [[ "$match" == true ]]; then
        DEEP_GROUP_AFFINITY+=("${page}|${grp}/$(basename "$page")|${match_signal}")
        break
      fi
    done
  done
}

# --- Run --full deep-audit against current CLASSIFY_* globals ---
# No-op when FULL_MODE is not set, so every call site can invoke this
# unconditionally right after _classify_skill.
#
# Runs regardless of base state — an unhealthy or partial-migration wiki is
# exactly the one that most needs cross-link diagnostics (issue:
# wiki-health-blind-spots). Only a HEALTHY base state is eligible to be
# DOWNGRADED to partial-migration; any other base state keeps its own (more
# specific) state, and deep-audit findings are reported alongside the
# existing reasons instead of being silently dropped.
# Does NOT modify any wiki files — purely diagnostic.
_run_deep_audit() {
  local skill_dir="$1"

  [[ "$FULL_MODE" == true ]] || return 0

  DEEP_CROSS_REFS=()
  DEEP_GROUP_AFFINITY=()
  _deep_scan_cross_refs "$skill_dir"
  _deep_scan_group_affinity "$skill_dir"

  if [ "${#DEEP_CROSS_REFS[@]}" -gt 0 ] || [ "${#DEEP_GROUP_AFFINITY[@]}" -gt 0 ]; then
    if [[ "$CLASSIFY_STATE" == "healthy" ]]; then
      CLASSIFY_STATE="partial-migration"
    fi
    # Emit reason codes for each type of finding — reported alongside any
    # existing base-state reasons rather than only on downgrade.
    if [ "${#DEEP_CROSS_REFS[@]}" -gt 0 ]; then
      CLASSIFY_REASONS+=("MISSING_CROSS_LINKS:${#DEEP_CROSS_REFS[@]} page pair(s) with missing cross-references (Step 5b deep scan)")
    fi
    if [ "${#DEEP_GROUP_AFFINITY[@]}" -gt 0 ]; then
      CLASSIFY_REASONS+=("MISPLACED_PAGE:${#DEEP_GROUP_AFFINITY[@]} top-level page(s) fit an existing subdirectory group (Step 6 group-affinity)")
    fi
  fi
}

# --- State to exit code ---
_state_exit_code() {
  case "$1" in
    healthy)           echo 0 ;;
    new)               echo 3 ;;
    partial-migration) echo 4 ;;
    unhealthy)         echo 5 ;;
    # not-a-wiki falls through to 2 deliberately -- the same code every
    # subcommand already returns when a skill is not a wiki. No state gains a
    # new exit code in this change.
    *)                 echo 2 ;;
  esac
}

# --- Emit JSON verdict for current CLASSIFY_* globals ---
# When FULL_MODE=true, appends deep_audit sub-object from DEEP_CROSS_REFS / DEEP_GROUP_AFFINITY
_emit_json_verdict() {
  local skill_name="$1"

  # Build reasons array
  local reasons_json=""
  for r in "${CLASSIFY_REASONS[@]}"; do
    local code="${r%%:*}"
    local detail="${r#*:}"
    [[ -n "$reasons_json" ]] && reasons_json+=","
    reasons_json+="{\"code\":\"$(_json_str "$code")\",\"detail\":\"$(_json_str "$detail")\"}"
  done

  # Build missing_summary array
  local missing_summary_json=""
  for ms in "${CLASSIFY_pages_missing_summary[@]}"; do
    [[ -n "$missing_summary_json" ]] && missing_summary_json+=","
    missing_summary_json+="\"$(_json_str "$ms")\""
  done

  # Build forbidden_updated_field array
  local forbidden_updated_field_json=""
  for fu in "${CLASSIFY_pages_forbidden_updated_field[@]}"; do
    [[ -n "$forbidden_updated_field_json" ]] && forbidden_updated_field_json+=","
    forbidden_updated_field_json+="\"$(_json_str "$fu")\""
  done

  # Build duplicate_last_verified array
  local duplicate_last_verified_json=""
  for dv in "${CLASSIFY_pages_duplicate_last_verified[@]}"; do
    [[ -n "$duplicate_last_verified_json" ]] && duplicate_last_verified_json+=","
    duplicate_last_verified_json+="\"$(_json_str "$dv")\""
  done

  # Build unfenced_runs array
  local unfenced_runs_json=""
  for ur in "${CLASSIFY_pages_unfenced_runs[@]}"; do
    [[ -n "$unfenced_runs_json" ]] && unfenced_runs_json+=","
    unfenced_runs_json+="\"$(_json_str "$ur")\""
  done

  # Build unbalanced_fences array
  local unbalanced_fences_json=""
  for ub in "${CLASSIFY_pages_unbalanced_fences[@]}"; do
    [[ -n "$unbalanced_fences_json" ]] && unbalanced_fences_json+=","
    unbalanced_fences_json+="\"$(_json_str "$ub")\""
  done

  # Build listed_but_missing array
  local listed_but_missing_json=""
  for lm in "${CLASSIFY_pages_listed_but_missing[@]}"; do
    [[ -n "$listed_but_missing_json" ]] && listed_but_missing_json+=","
    listed_but_missing_json+="\"$(_json_str "$lm")\""
  done

  # Build orphan_pages array
  local orphan_pages_json=""
  for op in "${CLASSIFY_pages_orphan_pages[@]}"; do
    [[ -n "$orphan_pages_json" ]] && orphan_pages_json+=","
    orphan_pages_json+="\"$(_json_str "$op")\""
  done

  # Build tag_prefix_mismatches array
  local tag_mismatch_json=""
  for tm in "${CLASSIFY_pages_tag_prefix_mismatches[@]}"; do
    [[ -n "$tag_mismatch_json" ]] && tag_mismatch_json+=","
    tag_mismatch_json+="\"$(_json_str "$tm")\""
  done

  # Build nav_summary_mismatches array
  local nav_summary_mismatch_json=""
  for nm in "${CLASSIFY_pages_nav_summary_mismatches[@]}"; do
    [[ -n "$nav_summary_mismatch_json" ]] && nav_summary_mismatch_json+=","
    nav_summary_mismatch_json+="\"$(_json_str "$nm")\""
  done

  # Build archived_status_mismatches array
  local archived_status_mismatch_json=""
  for am in "${CLASSIFY_pages_archived_status_mismatches[@]}"; do
    [[ -n "$archived_status_mismatch_json" ]] && archived_status_mismatch_json+=","
    archived_status_mismatch_json+="\"$(_json_str "$am")\""
  done

  # Optionally build deep_audit sub-object
  local deep_audit_fragment=""
  if [[ "$FULL_MODE" == true ]]; then
    local cross_refs_json=""
    for cr in "${DEEP_CROSS_REFS[@]}"; do
      local src="${cr%%|*}"
      local rest="${cr#*|}"
      local tgt="${rest%%|*}"
      local sig="${rest#*|}"
      [[ -n "$cross_refs_json" ]] && cross_refs_json+=","
      cross_refs_json+="{\"source\":\"$(_json_str "$src")\",\"target\":\"$(_json_str "$tgt")\",\"signal\":\"$(_json_str "$sig")\"}"
    done

    local group_affinity_json=""
    for ga in "${DEEP_GROUP_AFFINITY[@]}"; do
      local page="${ga%%|*}"
      local rest="${ga#*|}"
      local tgt="${rest%%|*}"
      local sig="${rest#*|}"
      [[ -n "$group_affinity_json" ]] && group_affinity_json+=","
      group_affinity_json+="{\"page\":\"$(_json_str "$page")\",\"target\":\"$(_json_str "$tgt")\",\"signal\":\"$(_json_str "$sig")\"}"
    done

    deep_audit_fragment=',"deep_audit":{"cross_references":['"$cross_refs_json"'],"group_affinity":['"$group_affinity_json"']}'
  fi

  cat <<JSON
{
  "skill": "$(_json_str "$skill_name")",
  "state": "$(_json_str "$CLASSIFY_STATE")",
  "reasons": [$reasons_json],
  "files": {
    "wiki_declared": $CLASSIFY_wiki_declared,
    "legacy_log_present": $CLASSIFY_legacy_log_present,
    "mditerc_present": $CLASSIFY_mditerc_present,
    "entrypoint_correct": $CLASSIFY_entrypoint_correct,
    "pages_heading_present": $CLASSIFY_pages_heading_present,
    "meta_heading_present": $CLASSIFY_meta_heading_present,
    "staging_dir_present": $CLASSIFY_staging_dir_present,
    "body_line_count": $CLASSIFY_body_line_count,
    "body_section_count": $CLASSIFY_body_section_count,
    "pages_placement": "$CLASSIFY_pages_placement",
    "mdite_lint_exit_code": $CLASSIFY_mdite_lint_exit_code
  },
  "pages": {
    "total": $CLASSIFY_pages_total,
    "excluded_by_mditerc": $CLASSIFY_pages_excluded_by_mditerc,
    "missing_summary": [$missing_summary_json],
    "forbidden_updated_field": [$forbidden_updated_field_json],
    "duplicate_last_verified": [$duplicate_last_verified_json],
    "unfenced_runs": [$unfenced_runs_json],
    "unbalanced_fences": [$unbalanced_fences_json],
    "tag_prefix_mismatches": [$tag_mismatch_json],
    "listed_but_missing": [$listed_but_missing_json],
    "orphan_index_md": $CLASSIFY_pages_orphan_index_md,
    "orphan_pages": [$orphan_pages_json],
    "nav_summary_mismatches": [$nav_summary_mismatch_json],
    "archived_status_mismatches": [$archived_status_mismatch_json]
  }${deep_audit_fragment}
}
JSON
}

# --- Get primary reason string for table output ---
_primary_reason() {
  if [[ ${#CLASSIFY_REASONS[@]} -gt 0 ]]; then
    # Return just the detail portion of the first reason
    echo "${CLASSIFY_REASONS[0]#*:}"
  else
    echo "—"
  fi
}

# --- Parse arguments ---
MODE=""      # "single" or "all"
SKILL_ARG=""
OUTPUT_FMT="default"  # "default", "verbose", "json"
FULL_MODE=false       # --full deep-audit mode
EXTRA_FLAGS_SEEN=false

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        _usage
        exit 0
        ;;
      --all)
        MODE="all"
        shift
        ;;
      --json)
        OUTPUT_FMT="json"
        shift
        ;;
      --verbose)
        OUTPUT_FMT="verbose"
        shift
        ;;
      --full)
        FULL_MODE=true
        shift
        ;;
      -*)
        echo "ERROR: unknown option: $1" >&2
        echo "Run 'wiki-health --help' for usage." >&2
        exit 2
        ;;
      *)
        if [[ -z "$SKILL_ARG" ]]; then
          SKILL_ARG="$1"
          shift
        else
          echo "ERROR: unexpected argument: $1" >&2
          echo "Run 'wiki-health --help' for usage." >&2
          exit 2
        fi
        ;;
    esac
  done

  # Validate combination
  if [[ "$MODE" == "all" && -n "$SKILL_ARG" ]]; then
    echo "ERROR: --all cannot be combined with a skill name argument" >&2
    exit 2
  fi

  if [[ "$MODE" == "" && -z "$SKILL_ARG" ]]; then
    echo "ERROR: skill name required (or use --all)" >&2
    echo "Run 'wiki-health --help' for usage." >&2
    exit 2
  fi

  if [[ "$MODE" == "" ]]; then
    MODE="single"
  fi

  # --verbose and --json are mutually exclusive
  # (last one wins in practice, but log a warning for clarity)
  # Already handled by sequential overwrite — no extra logic needed
}

# =============================================================================
# Freshness subcommand implementation
# =============================================================================

# Parse args for: wiki-health freshness <skill> [<page>] [--deep] [--json] [--quiet]
# Sets globals: FRESH_SKILL, FRESH_PAGE, FRESH_DEEP, FRESH_JSON, FRESH_QUIET
# Exits 2 on bad args.
_parse_freshness_args() {
  FRESH_SKILL=""
  FRESH_PAGE=""
  FRESH_DEEP=false
  FRESH_JSON=false
  FRESH_QUIET=false

  local end_of_opts=false
  while [[ $# -gt 0 ]]; do
    if [[ "$end_of_opts" == false && "$1" == "--" ]]; then
      end_of_opts=true
      shift
      continue
    fi
    if [[ "$end_of_opts" == false && "$1" == --* ]] || \
       [[ "$end_of_opts" == false && "$1" == -h ]]; then
      case "$1" in
        -h|--help) _usage; exit 0 ;;
        --deep)  FRESH_DEEP=true;  shift ;;
        --json)  FRESH_JSON=true;  shift ;;
        --quiet) FRESH_QUIET=true; shift ;;
        *)
          echo "ERROR: unknown option: $1" >&2
          echo "Run 'wiki-health --help' for usage." >&2
          exit 2
          ;;
      esac
    else
      if [[ -z "$FRESH_SKILL" ]]; then
        FRESH_SKILL="$1"
        shift
      elif [[ -z "$FRESH_PAGE" ]]; then
        FRESH_PAGE="$1"
        shift
      else
        echo "ERROR: unexpected argument: $1" >&2
        echo "Run 'wiki-health --help' for usage." >&2
        exit 2
      fi
    fi
  done

  if [[ -z "$FRESH_SKILL" ]]; then
    echo "ERROR: freshness requires <skill> positional argument" >&2
    echo "Run 'wiki-health --help' for usage." >&2
    exit 2
  fi

  # Denylist: reject path traversal and shell-special chars in FRESH_SKILL
  if [[ "$FRESH_SKILL" == */* || "$FRESH_SKILL" == *\\* || "$FRESH_SKILL" == *..* || \
        "$FRESH_SKILL" == *" "* || "$FRESH_SKILL" == *'"'* || "$FRESH_SKILL" == *'`'* || \
        "$FRESH_SKILL" == *'$'* || "$FRESH_SKILL" == *'*'* || "$FRESH_SKILL" == *'?'* || \
        "$FRESH_SKILL" == *';'* || "$FRESH_SKILL" == *'&'* || "$FRESH_SKILL" == *'|'* || \
        "$FRESH_SKILL" == *'<'* || "$FRESH_SKILL" == *'>'* || "$FRESH_SKILL" == *'('* || \
        "$FRESH_SKILL" == *')'* || "$FRESH_SKILL" == *'{'* || "$FRESH_SKILL" == *'}'* || \
        "$FRESH_SKILL" == *'['* || "$FRESH_SKILL" == *']'* || \
        "$FRESH_SKILL" == *$'\n'* ]]; then
    echo "ERROR: invalid skill path: $FRESH_SKILL" >&2
    exit 2
  fi

  # Denylist: reject path traversal and shell-special chars in FRESH_PAGE.
  # A single '/' separator is now accepted so a group/page two-tier slug can
  # address a group-subdirectory page (D12 prerequisite: group-subdirectory
  # freshness support) — traversal, absolute paths, empty segments, and
  # deeper nesting (more than one '/') are still rejected. See
  # wiki-health-subcommand-and-check-scope for the pre-extension behavior.
  if [[ -n "$FRESH_PAGE" ]]; then
    if [[ "$FRESH_PAGE" == *\\* || "$FRESH_PAGE" == *..* || \
          "$FRESH_PAGE" == *" "* || "$FRESH_PAGE" == *'"'* || "$FRESH_PAGE" == *'`'* || \
          "$FRESH_PAGE" == *'$'* || "$FRESH_PAGE" == *'*'* || "$FRESH_PAGE" == *'?'* || \
          "$FRESH_PAGE" == *';'* || "$FRESH_PAGE" == *'&'* || "$FRESH_PAGE" == *'|'* || \
          "$FRESH_PAGE" == *'<'* || "$FRESH_PAGE" == *'>'* || "$FRESH_PAGE" == *'('* || \
          "$FRESH_PAGE" == *')'* || "$FRESH_PAGE" == *'{'* || "$FRESH_PAGE" == *'}'* || \
          "$FRESH_PAGE" == *'['* || "$FRESH_PAGE" == *']'* || \
          "$FRESH_PAGE" == /* || "$FRESH_PAGE" == */ || \
          "$FRESH_PAGE" == *$'\n'* ]]; then
      echo "ERROR: invalid page path: $FRESH_PAGE" >&2
      exit 2
    fi
    # Two-tier only: reject deeper nesting (more than one '/' separator) —
    # group/page is supported, group/sub/page is not.
    local slashes="${FRESH_PAGE//[^\/]/}"
    if [[ "${#slashes}" -gt 1 ]]; then
      echo "ERROR: invalid page path: $FRESH_PAGE" >&2
      exit 2
    fi
  fi
}

# Skill resolution for the freshness subcommand uses the shared
# "_resolve_skill_as_wiki" helper (defined below, near the cited-paths
# subcommand) — factored on the third use (maintenance-due) per plan
# decision PD2 / claude-code-ref-expert wiki-health-subcommand-resolver-
# pattern. _dispatch_freshness calls it directly (see below) and assigns
# FRESH_SKILL_DIR from the shared RESOLVED_SKILL_DIR output.

# Extract code-cites list from a page's YAML frontmatter.
# Outputs one path per line; empty output if field is absent or empty list.
_extract_code_cites() {
  local page_path="$1"
  # awk: collect code-cites: field inside frontmatter block (between first two --- lines)
  # Frontmatter only recognized when line 1 is exactly "---" — the NR==1
  # exit rejects a body-embedded "---"/"code-cites:"/"---" block (e.g. an
  # illustrative template) that would otherwise be misread as real
  # frontmatter (wiki-health-frontmatter-line1-only-detection).
  awk '
    NR == 1 && !/^---[[:space:]]*$/ { exit }
    /^---/ { count++; if (count == 2) exit; next }
    count == 1 && /^code-cites:/ {
      line = $0
      gsub(/^code-cites:[[:space:]]*/, "", line)
      # Inline list: [a, b, c] or []
      if (line ~ /^\[/) {
        gsub(/[\[\]]/, "", line)
        n = split(line, items, /,[[:space:]]*/)
        for (i = 1; i <= n; i++) {
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", items[i])
          if (items[i] != "") print items[i]
        }
        found = 1
      } else if (line == "" || line ~ /^[[:space:]]*$/) {
        # Block-style list follows — gather subsequent "- item" lines
        in_list = 1
      } else {
        # Single bare value (unusual but handle)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
        if (line != "") print line
        found = 1
      }
      next
    }
    count == 1 && in_list && /^[[:space:]]*-[[:space:]]/ {
      item = $0
      gsub(/^[[:space:]]*-[[:space:]]*/, "", item)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", item)
      if (item != "") print item
      next
    }
    count == 1 && in_list && /^[^[:space:]-]/ { in_list = 0 }
  ' "$page_path" 2>/dev/null
}

# --- Extract md-link targets from a page's body (post-frontmatter content) ---
# Own copy of churn-check's fence-aware `_extract_md_link_targets`
# (wiki-health.sh sources nothing, per the no-sourcing convention — see
# churn-check:205-243 for the mirrored implementation this duplicates).
# Guarded regex: requires literal ](...) markdown-link syntax immediately
# following the closing bracket. Filters out non-repo-path schemes
# (http(s)://, mailto:, obsidian://, file://) and pure-anchor targets
# (#heading), and strips a trailing #fragment from an otherwise-real path
# target. Fence-aware (AD5): a line matching ^``` flips an in-fence flag;
# while in-fence, link extraction is skipped. Inline-code spans remain a
# documented limitation (not fence-toggled, extracted as usual). Outputs
# one raw target per line.
_extract_md_link_targets() {
  local page_path="$1"
  # Frontmatter only recognized when line 1 is exactly "---" — the NR==1
  # rule below sets count=2 immediately for a no-frontmatter page (so body
  # scanning starts at line 1 instead of being silently skipped until a
  # body-embedded "---" pair is found), while a genuine line-1 "---" still
  # arms the real open/close scan (wiki-health-frontmatter-line1-only-
  # detection).
  awk '
    NR == 1 && /^---[[:space:]]*$/ { count++; next }
    NR == 1 { count = 2 }
    count == 1 && /^---/ { count++; next }
    count < 2 { next }
    /^```/ { in_fence = !in_fence; next }
    in_fence { next }
    {
      line = $0
      while (match(line, /\]\([^)]*\)/)) {
        raw = substr(line, RSTART + 2, RLENGTH - 3)
        line = substr(line, RSTART + RLENGTH)
        if (raw == "") continue
        if (raw ~ /^https?:\/\//) continue
        if (raw ~ /^mailto:/) continue
        if (raw ~ /^obsidian:\/\//) continue
        if (raw ~ /^file:\/\//) continue
        if (raw ~ /^#/) continue
        sub(/#.*$/, "", raw)
        if (raw == "") continue
        print raw
      }
    }
  ' "$page_path" 2>/dev/null
}

# --- Normalize a path string's ./ and ../ segments (pure bash, no realpath
# dependency) --- Own copy of churn-check's MSYS-safe fallback (`realpath -m`
# fails silently on MSYS, a first-class platform for this repo) — see
# churn-check:245-285 for the mirrored implementation this duplicates.
# Operates purely on the string (no filesystem access, no symlink
# resolution). Input MUST be an absolute path (all call sites pass an
# absolute base_dir).
_normalize_path() {
  local input="$1"
  local IFS='/'
  local -a parts
  # Disable pathname expansion for the split below — an unquoted array
  # assignment is subject to globbing, and a raw target segment containing
  # *, ?, or [ must split as a literal string, not glob-expand against cwd
  # entries. Restore the prior glob setting immediately after the split.
  local restore_glob=""
  case $- in *f*) ;; *) set -f; restore_glob=1 ;; esac
  parts=($input)
  [[ -n "$restore_glob" ]] && set +f
  local -a stack=()
  local part
  for part in "${parts[@]}"; do
    case "$part" in
      "" | ".") continue ;;
      "..")
        if [[ "${#stack[@]}" -gt 0 ]]; then
          stack=("${stack[@]:0:$((${#stack[@]} - 1))}")
        fi
        ;;
      *) stack+=("$part") ;;
    esac
  done
  local result="" seg
  for seg in "${stack[@]}"; do
    result+="/$seg"
  done
  [[ -z "$result" ]] && result="/"
  printf '%s' "$result"
}

# --- Resolve a raw target string to an absolute path ---
# Own copy of churn-check's `_resolve_abs` (wiki-health.sh sources nothing)
# — see churn-check:287-312 for the mirrored implementation this
# duplicates. md-link targets are relative to the referencing page's own
# directory. Caller contract: reject absolute (leading "/") targets BEFORE
# calling this — an absolute target is never resolved or probed. Falls back
# to pure-bash ./.. normalization (_normalize_path) when `realpath -m`
# fails or produces empty output.
_resolve_abs() {
  local base_dir="$1" raw="$2"
  local resolved
  resolved="$(realpath -m "$base_dir/$raw" 2>/dev/null)" || resolved=""
  if [[ -n "$resolved" ]]; then
    printf '%s' "$resolved"
  else
    _normalize_path "$base_dir/$raw"
  fi
}

# --- Derive a page's cite set: legacy code-cites ∪ external md-link
# targets (AD1/AD9 union-read transition) ---
# Reuses AD2's internal/external classification rule. BOTH halves of the
# union are guarded against escaping $FRESH_PROJECT_ROOT before their raw
# values ever reach a caller — the two new unconditional `-e`
# existence probes this step adds to _freshness_one_page (Tier-1
# has_unresolvable_cite, Tier-2 "never existed" branch) would otherwise
# turn an untrusted code-cites value into a filesystem existence oracle
# (security-verifier iter1 high finding: freshness --deep --json leaked
# host-filesystem existence of an attacker-chosen absolute path via the
# fresh/stale-semantic status alone).
#   - code-cites half: values are always repo-root-relative by convention
#     with no legitimate need for .. segments, so this mirrors
#     churn-check's identical code-cites guard (churn-check:351-359) —
#     a raw value is rejected pre-resolution (never resolved, never
#     probed) if it is absolute OR contains a ".." segment (checked on the
#     path with any ":line" suffix stripped, matching how
#     _freshness_one_page itself strips that suffix before probing).
#   - md-link half: resolve-then-contain containment — absolute targets
#     are rejected pre-resolution (never resolved, never probed); relative
#     targets are resolved FIRST via _resolve_abs against the page's own
#     directory (a page-relative external link legitimately requires ..
#     segments to escape the skill dir by construction), THEN
#     containment-checked against $FRESH_PROJECT_ROOT — a target whose
#     resolved path escapes the project root is discarded with NO
#     filesystem/git probe on it.
# A target resolving inside $FRESH_SKILL_DIR is internal (mdite's nav
# domain, not an auditable source reference per AD2) and is excluded here
# — only external targets are cite-set members. Surviving external targets
# are emitted as paths relative to $FRESH_PROJECT_ROOT (matching
# code-cites' existing repo-root-relative convention) so the downstream
# git log / git cat-file -e / git diff callers in _freshness_one_page work
# identically regardless of a cite's origin. Uses globals FRESH_SKILL_DIR
# and FRESH_PROJECT_ROOT — callers must set both before invoking (mirrors
# _freshness_one_page's existing FRESH_SKILL_DIR convention). A page with
# neither a code-cite nor an external md-link produces empty output, which
# _freshness_one_page's caller already treats as "unknown" (nothing to
# verify).
_extract_cite_set() {
  local page_path="$1"
  local page_dir
  page_dir="$(dirname "$page_path")"

  local raw_cite cite_check
  while IFS= read -r raw_cite; do
    [[ -z "$raw_cite" ]] && continue
    cite_check="${raw_cite%%:*}"
    [[ "$cite_check" == /* || "$cite_check" == *..* ]] && continue
    printf '%s\n' "$raw_cite"
  done <<< "$(_extract_code_cites "$page_path")"

  local target abs rel
  while IFS= read -r target; do
    [[ -z "$target" ]] && continue
    [[ "$target" == /* ]] && continue
    abs="$(_resolve_abs "$page_dir" "$target")"

    case "$abs" in
      "$FRESH_PROJECT_ROOT"/*) ;;
      *) continue ;;
    esac
    case "$abs" in
      "$FRESH_SKILL_DIR"/*) continue ;;
    esac

    rel="${abs#"$FRESH_PROJECT_ROOT"/}"
    printf '%s\n' "$rel"
  done <<< "$(_extract_md_link_targets "$page_path")"
}

# Compute freshness for a single page file.
# Outputs: <page-slug> TAB <status> on stdout (plain path).
# Also sets globals for JSON output (read directly when called without a subshell):
#   FRESH_WIKI_MTIME, FRESH_NEWEST_CITED_COMMIT, FRESH_STATUS, FRESH_PSLUG
FRESH_WIKI_MTIME=0
FRESH_NEWEST_CITED_COMMIT="null"
FRESH_STATUS=""
FRESH_PSLUG=""

_freshness_one_page() {
  local page_path="$1"
  # Slug is the page path relative to the skill dir, minus .md — for a
  # group-subdirectory page this yields "group/page" rather than colliding
  # with a flat page of the same basename (D12: group/page two-tier support).
  local rel="${page_path#"$FRESH_SKILL_DIR"/}"
  FRESH_PSLUG="${rel%.md}"
  FRESH_WIKI_MTIME=0
  FRESH_NEWEST_CITED_COMMIT="null"
  FRESH_STATUS=""

  # Extract cite set: legacy code-cites ∪ external md-link targets (AD1/AD9)
  local cites
  cites="$(_extract_cite_set "$page_path")"

  if [[ -z "$cites" ]]; then
    # Principle page — no cited paths (neither code-cites nor external links)
    FRESH_STATUS="unknown"
    printf '%s\tunknown\n' "$FRESH_PSLUG"
    return
  fi

  # Get wiki page mtime via git log
  local t_wiki
  t_wiki="$(git log -1 --format=%at -- "$page_path" 2>/dev/null || true)"

  if [[ -z "$t_wiki" ]]; then
    # git log returned nothing — page not in git history
    [[ "$FRESH_QUIET" == false ]] && echo "WARN: git log returned no result for $page_path — treating as unknown" >&2
    FRESH_STATUS="unknown"
    printf '%s\tunknown\n' "$FRESH_PSLUG"
    return
  fi
  FRESH_WIKI_MTIME="$t_wiki"

  # Check each cited path: any commit newer than T_wiki → stale-timestamp
  local page_status="fresh"
  local newest_commit="null"
  # AD4: a cite absent on disk with no commit since T_wiki either could be
  # genuinely dead (never existed, or deleted before this page was last
  # touched) -- the --since-bounded query below cannot distinguish that
  # from "unchanged and still fine" because both return empty. Flag it so
  # the deep-mode Tier-2 gate below still runs and resolves the ambiguity
  # with an unconditional history check. Tier-1 alone never emits
  # stale-semantic (AD4 is deep-mode-scoped) -- page_status stays untouched
  # here.
  local has_unresolvable_cite=false
  local cite
  while IFS= read -r cite; do
    [[ -z "$cite" ]] && continue
    # Strip optional :line suffix (path:line format per spec)
    local cite_path="${cite%%:*}"
    local cited_commit
    cited_commit="$(git log --since="$t_wiki" -1 --format=%at -- "$cite_path" 2>/dev/null || true)"
    if [[ -n "$cited_commit" ]]; then
      page_status="stale-timestamp"
      if [[ "$newest_commit" == "null" ]] || (( cited_commit > newest_commit )); then
        newest_commit="$cited_commit"
      fi
    elif [[ ! -e "$cite_path" ]]; then
      has_unresolvable_cite=true
    fi
  done <<< "$cites"

  # Tier-2 (--deep): if Tier-1 flagged stale-timestamp, OR a cite is
  # unresolvable (AD4 false-fresh fix — see has_unresolvable_cite above),
  # confirm with semantic diff. Get T_wiki commit hash; compare each cited
  # path at that commit vs HEAD via git diff. Any difference, or a cite that
  # never existed at all, → stale-semantic. All same → fresh (false alarm).
  # Status set never includes stale-timestamp in deep mode.
  if [[ "$FRESH_DEEP" == true && ( "$page_status" == "stale-timestamp" || "$has_unresolvable_cite" == true ) ]]; then
    local t_wiki_commit
    t_wiki_commit="$(git log -1 --format=%H -- "$page_path" 2>/dev/null || true)"
    if [[ -z "$t_wiki_commit" ]]; then
      # Cannot get commit hash — treat as unknown (infra failure)
      [[ "$FRESH_QUIET" == false ]] && echo "WARN: git log -1 --format=%H returned nothing for $page_path — treating as unknown" >&2
      FRESH_NEWEST_CITED_COMMIT="null"
      FRESH_STATUS="unknown"
      printf '%s\tunknown\n' "$FRESH_PSLUG"
      return
    fi
    local tier2_status="fresh"
    while IFS= read -r cite; do
      [[ -z "$cite" ]] && continue
      local cite_path="${cite%%:*}"
      # AD4: neither on disk nor in git history at all → a dead reference is
      # a contradiction, never a silent fresh. Catches the "never existed"
      # case a --since-bounded Tier-1 query can't see (git log without
      # --since below checks the path's ENTIRE history, not just since
      # T_wiki).
      if [[ ! -e "$cite_path" ]]; then
        local any_history
        any_history="$(git log -1 --format=%H -- "$cite_path" 2>/dev/null || true)"
        if [[ -z "$any_history" ]]; then
          tier2_status="stale-semantic"
          break
        fi
      fi
      # Check if the cited path existed at T_wiki commit (resolvable paths)
      if ! git cat-file -e "${t_wiki_commit}:${cite_path}" 2>/dev/null; then
        # Path didn't exist at T_wiki — treat as stale-semantic
        tier2_status="stale-semantic"
        break
      fi
      # Compare content at T_wiki commit vs HEAD
      if ! git diff --quiet "${t_wiki_commit}" HEAD -- "$cite_path" 2>/dev/null; then
        tier2_status="stale-semantic"
        break
      fi
    done <<< "$cites"
    page_status="$tier2_status"
    # In deep mode we never emit stale-timestamp; newest_commit metadata unchanged
  fi

  FRESH_NEWEST_CITED_COMMIT="$newest_commit"
  FRESH_STATUS="$page_status"
  printf '%s\t%s\n' "$FRESH_PSLUG" "$page_status"
}

# Run the freshness subcommand.
_run_freshness() {
  local skill_dir="$FRESH_SKILL_DIR"

  # Enumerate pages to check
  local pages=()
  if [[ -n "$FRESH_PAGE" ]]; then
    local single_path="$skill_dir/${FRESH_PAGE}.md"
    if [[ ! -f "$single_path" ]]; then
      [[ "$FRESH_QUIET" == false ]] && echo "WARN: page file not found: $single_path" >&2
      # Emit unknown per contract (infra failure)
      if [[ "$FRESH_JSON" == true ]]; then
        printf '{"skill":"%s","pages":[{"page":"%s","status":"unknown","wiki_mtime":0,"newest_cited_path_commit":null}]}\n' \
          "$(_json_str "$FRESH_SKILL")" "$(_json_str "$FRESH_PAGE")"
      else
        printf '%s\tunknown\n' "$FRESH_PAGE"
      fi
      return
    fi
    pages=("$single_path")
  else
    # maxdepth 2 recurses one level into subdirectory groups (D12: two-tier
    # wikis) — a flat wiki has no non-{scripts,assets,protocols} subdirs, so
    # this enumerates the exact same file set as the prior maxdepth-1 scan.
    # Shared enumeration helper (same exclusion convention as
    # _classify_skill's content-page collection) — see _wiki_collect_pages.
    local rel
    while IFS= read -r rel; do
      [[ -n "$rel" ]] && pages+=("$skill_dir/$rel")
    done < <(_wiki_collect_pages "$skill_dir")
  fi

  if [[ "$FRESH_JSON" == true ]]; then
    local pages_json=""
    local p
    for p in "${pages[@]}"; do
      # Call directly (no subshell) so FRESH_WIKI_MTIME, FRESH_NEWEST_CITED_COMMIT,
      # FRESH_STATUS, and FRESH_PSLUG propagate back to this scope.
      _freshness_one_page "$p" > /dev/null
      [[ -n "$pages_json" ]] && pages_json+=","
      pages_json+="{\"page\":\"$(_json_str "$FRESH_PSLUG")\",\"status\":\"$(_json_str "$FRESH_STATUS")\",\"wiki_mtime\":${FRESH_WIKI_MTIME},\"newest_cited_path_commit\":${FRESH_NEWEST_CITED_COMMIT}}"
    done
    printf '{"skill":"%s","pages":[%s]}\n' "$(_json_str "$FRESH_SKILL")" "$pages_json"
  else
    local p
    for p in "${pages[@]}"; do
      _freshness_one_page "$p"
    done
  fi
}

# Dispatch freshness subcommand with arg parsing and skill resolution.
_dispatch_freshness() {
  # Parse args (exits 2 on error)
  _parse_freshness_args "$@"

  FRESH_SKILL_DIR=""
  RESOLVED_SKILL_DIR=""
  if ! _resolve_skill_as_wiki "$FRESH_SKILL"; then
    echo "ERROR: skill '$FRESH_SKILL' not declared as a wiki (SKILL.md frontmatter must carry 'wiki: true')" >&2
    # Infra failure: emit unknown per page and exit 0
    if [[ -n "$FRESH_PAGE" ]]; then
      if [[ "$FRESH_JSON" == true ]]; then
        printf '{"skill":"%s","pages":[{"page":"%s","status":"unknown","wiki_mtime":0,"newest_cited_path_commit":null}]}\n' \
          "$(_json_str "$FRESH_SKILL")" "$(_json_str "$FRESH_PAGE")"
      else
        printf '%s\tunknown\n' "$FRESH_PAGE"
      fi
    fi
    exit 0
  fi
  FRESH_SKILL_DIR="$RESOLVED_SKILL_DIR"
  # Containment root for _extract_cite_set's resolve-then-contain guard
  # (AD2/AD9) — _resolve_skill_as_wiki already confirmed this skill lives
  # under <project-root>/.claude/skills/, so the same PWD-walk-first /
  # SCRIPT_DIR-fallback resolver used at bare-skill-mode dispatch (see
  # PROJECT_ROOT below) finds the identical ancestor here too.
  FRESH_PROJECT_ROOT="$(_find_project_root)"

  _run_freshness
  exit 0
}

# =============================================================================
# cited-paths subcommand implementation
# =============================================================================

# Parse args for: wiki-health cited-paths <skill> <page> [--json] [--quiet]
# Sets globals: CITED_SKILL, CITED_PAGE, CITED_JSON, CITED_QUIET
# Exits 2 on bad args.
_parse_cited_paths_args() {
  CITED_SKILL=""
  CITED_PAGE=""
  CITED_JSON=false
  CITED_QUIET=false

  local end_of_opts=false
  while [[ $# -gt 0 ]]; do
    if [[ "$end_of_opts" == false && "$1" == "--" ]]; then
      end_of_opts=true
      shift
      continue
    fi
    if [[ "$end_of_opts" == false && "$1" == --* ]] || \
       [[ "$end_of_opts" == false && "$1" == -h ]]; then
      case "$1" in
        -h|--help) _usage; exit 0 ;;
        --json)  CITED_JSON=true;  shift ;;
        --quiet) CITED_QUIET=true; shift ;;
        *)
          echo "ERROR: unknown option: $1" >&2
          echo "Run 'wiki-health --help' for usage." >&2
          exit 2
          ;;
      esac
    else
      if [[ -z "$CITED_SKILL" ]]; then
        CITED_SKILL="$1"
        shift
      elif [[ -z "$CITED_PAGE" ]]; then
        CITED_PAGE="$1"
        shift
      else
        echo "ERROR: unexpected argument: $1" >&2
        echo "Run 'wiki-health --help' for usage." >&2
        exit 2
      fi
    fi
  done

  if [[ -z "$CITED_SKILL" ]]; then
    echo "ERROR: cited-paths requires <skill> positional argument" >&2
    echo "Run 'wiki-health --help' for usage." >&2
    exit 2
  fi

  if [[ -z "$CITED_PAGE" ]]; then
    echo "ERROR: cited-paths requires <page> positional argument" >&2
    echo "Run 'wiki-health --help' for usage." >&2
    exit 2
  fi

  # Denylist: reject path traversal and shell-special chars in CITED_SKILL
  if [[ "$CITED_SKILL" == */* || "$CITED_SKILL" == *\\* || "$CITED_SKILL" == *..* || \
        "$CITED_SKILL" == *" "* || "$CITED_SKILL" == *'"'* || "$CITED_SKILL" == *'`'* || \
        "$CITED_SKILL" == *'$'* || "$CITED_SKILL" == *'*'* || "$CITED_SKILL" == *'?'* || \
        "$CITED_SKILL" == *';'* || "$CITED_SKILL" == *'&'* || "$CITED_SKILL" == *'|'* || \
        "$CITED_SKILL" == *'<'* || "$CITED_SKILL" == *'>'* || "$CITED_SKILL" == *'('* || \
        "$CITED_SKILL" == *')'* || "$CITED_SKILL" == *'{'* || "$CITED_SKILL" == *'}'* || \
        "$CITED_SKILL" == *'['* || "$CITED_SKILL" == *']'* || \
        "$CITED_SKILL" == *$'\n'* ]]; then
    echo "ERROR: invalid skill path: $CITED_SKILL" >&2
    exit 2
  fi

  # Denylist: reject path traversal and shell-special chars in CITED_PAGE
  if [[ "$CITED_PAGE" == */* || "$CITED_PAGE" == *\\* || "$CITED_PAGE" == *..* || \
        "$CITED_PAGE" == *" "* || "$CITED_PAGE" == *'"'* || "$CITED_PAGE" == *'`'* || \
        "$CITED_PAGE" == *'$'* || "$CITED_PAGE" == *'*'* || "$CITED_PAGE" == *'?'* || \
        "$CITED_PAGE" == *';'* || "$CITED_PAGE" == *'&'* || "$CITED_PAGE" == *'|'* || \
        "$CITED_PAGE" == *'<'* || "$CITED_PAGE" == *'>'* || "$CITED_PAGE" == *'('* || \
        "$CITED_PAGE" == *')'* || "$CITED_PAGE" == *'{'* || "$CITED_PAGE" == *'}'* || \
        "$CITED_PAGE" == *'['* || "$CITED_PAGE" == *']'* || \
        "$CITED_PAGE" == *$'\n'* ]]; then
    echo "ERROR: invalid page path: $CITED_PAGE" >&2
    exit 2
  fi
}

# Resolve a skill as a wiki-backed skill. SHARED resolver (plan decision
# PD2 / claude-code-ref-expert wiki-health-subcommand-and-check-scope) —
# used by all three subcommands that need skill-as-wiki resolution
# (freshness, cited-paths, maintenance-due). wiki-health.sh sources nothing,
# so this helper stays in-file; callers must invoke it DIRECTLY (never via
# `x="$(...)"` command substitution — see bash-subshell-strips-globals)
# since it communicates its result via the RESOLVED_SKILL_DIR global.
# Walk up from $PWD looking for .claude/skills/<skill>/ with:
#   1. SKILL.md present
#   2. ## Pages heading in SKILL.md
#   3. .mditerc present with entrypoint: SKILL.md
# Sets RESOLVED_SKILL_DIR on success; returns 0 on hit, 1 on miss.
# --- Wiki identity (D15): a skill IS a wiki when its SKILL.md frontmatter
# declares `wiki: true`. Nothing else identifies one -- not .mditerc, not a
# `## Pages` heading. Those remain *conformance* checks a declared wiki must
# satisfy; they no longer decide membership, which is what let 47 deliberately
# monolithic skills be reported as broken wikis.
#
# Frontmatter only: the same NR==1 guard the summary/updated checks use, so a
# `wiki: true` line inside a fenced example in the body cannot declare a
# domain by accident. The value must be bare lowercase `true` -- `True` or
# `"true"` is a YAML string to some readers and a boolean to others, and a
# declaration that means different things to different parsers is not a
# declaration.
_wiki_is_declared() {
  local skillmd="$1"
  [[ -f "$skillmd" ]] || return 1
  awk '
    NR == 1 && !/^---[[:space:]]*$/ { exit 1 }
    NR > 1 && /^---/ { exit 1 }
    NR > 1 && /^wiki:[[:space:]]*true[[:space:]]*$/ { found = 1; exit 0 }
    END { exit !found }
  ' "$skillmd" 2>/dev/null
}

_resolve_skill_as_wiki() {
  local skill="$1"
  local dir="${PWD%/}"
  while [[ "$dir" != "/" && "$dir" != "." ]]; do
    local candidate="$dir/.claude/skills/$skill"
    if [[ -d "$candidate" && -f "$candidate/SKILL.md" ]]; then
      if _wiki_is_declared "$candidate/SKILL.md"; then
        RESOLVED_SKILL_DIR="$candidate"
        return 0
      fi
    fi
    dir="$(dirname "$dir")"
  done
  # Fallback: try SCRIPT_DIR walk (parity with _find_project_root)
  local sdir="$SCRIPT_DIR"
  while [[ "$sdir" != "/" && "$sdir" != "." ]]; do
    local candidate="$sdir/.claude/skills/$skill"
    if [[ -d "$candidate" && -f "$candidate/SKILL.md" ]]; then
      if _wiki_is_declared "$candidate/SKILL.md"; then
        RESOLVED_SKILL_DIR="$candidate"
        return 0
      fi
    fi
    sdir="$(dirname "$sdir")"
  done
  return 1
}

# Run the cited-paths subcommand.
# Reads CITED_SKILL_DIR, CITED_PAGE, CITED_JSON, CITED_QUIET, CITED_SKILL.
_run_cited_paths() {
  local skill_dir="$CITED_SKILL_DIR"
  local page_path="$skill_dir/${CITED_PAGE}.md"

  if [[ ! -f "$page_path" ]]; then
    [[ "$CITED_QUIET" == false ]] && echo "WARN: page file not found: $page_path" >&2
    # Infra failure: emit empty result per contract (exit 0)
    if [[ "$CITED_JSON" == true ]]; then
      printf '{"skill":"%s","page":"%s","cited_paths":[]}\n' \
        "$(_json_str "$CITED_SKILL")" "$(_json_str "$CITED_PAGE")"
    fi
    return
  fi

  # Extract code-cites using existing awk parser
  local cites
  cites="$(_extract_code_cites "$page_path")"

  if [[ "$CITED_JSON" == true ]]; then
    # Build JSON array of cited paths
    local cited_json=""
    if [[ -n "$cites" ]]; then
      while IFS= read -r cite; do
        [[ -z "$cite" ]] && continue
        [[ -n "$cited_json" ]] && cited_json+=","
        cited_json+="\"$(_json_str "$cite")\""
      done <<< "$cites"
    fi
    printf '{"skill":"%s","page":"%s","cited_paths":[%s]}\n' \
      "$(_json_str "$CITED_SKILL")" "$(_json_str "$CITED_PAGE")" "$cited_json"
  else
    # Plain output: one path per line (empty cites → zero lines)
    if [[ -n "$cites" ]]; then
      printf '%s\n' "$cites"
    fi
  fi
}

# Dispatch cited-paths subcommand with arg parsing and skill resolution.
_dispatch_cited_paths() {
  # Parse args (exits 2 on error)
  _parse_cited_paths_args "$@"

  CITED_SKILL_DIR=""
  RESOLVED_SKILL_DIR=""
  if ! _resolve_skill_as_wiki "$CITED_SKILL"; then
    echo "ERROR: skill '$CITED_SKILL' not declared as a wiki (SKILL.md frontmatter must carry 'wiki: true')" >&2
    # Infra failure: emit empty result and exit 0
    if [[ "$CITED_JSON" == true ]]; then
      printf '{"skill":"%s","page":"%s","cited_paths":[]}\n' \
        "$(_json_str "$CITED_SKILL")" "$(_json_str "$CITED_PAGE")"
    fi
    exit 0
  fi
  CITED_SKILL_DIR="$RESOLVED_SKILL_DIR"

  _run_cited_paths
  exit 0
}

# =============================================================================
# maintenance-due subcommand implementation
# =============================================================================
#
# D10 compound due condition: due = any mechanical churn hit. The
# ingests-since-last-lint leg was dropped with log.md itself (D3); the
# git-derived churn legs carry the signal on their own. Days-elapsed is NOT
# an input. D11 threshold formulas (N/K/correction-cap/large-drift) are
# computed inline, no stored per-wiki config -- N is still reported in the
# --json verdict as a threshold consumers may read, but with the ingest leg
# gone it no longer gates `due`. Zero LLM tokens -- git + mdite only.

# EX_UNAVAILABLE mirrors the mdite wrapper's own named constant (mdite:39).
# wiki-health.sh sources nothing, so the value is duplicated here as a plain
# integer rather than sourced — a stable, documented wrapper contract, not
# an internal implementation detail.
MAINT_MDITE_EX_UNAVAILABLE=69

MAINT_SKILL=""
MAINT_JSON=false
MAINT_SKILL_DIR=""
MAINT_DUE=false
MAINT_N=0
MAINT_K=0
MAINT_CORRECTION_CAP=3
MAINT_LARGE_DRIFT=false
MAINT_PAGES_TOTAL=0
MAINT_PAGES_CODE_CITED=0
MAINT_STALE_SEMANTIC_COUNT=0
MAINT_FRESH_COUNT=0
MAINT_UNKNOWN_COUNT=0
MAINT_CHURN_HIT=false
MAINT_CHURN_AVAILABLE=true
MAINT_MDITE_HIT=false
MAINT_MDITE_AVAILABLE=true
MAINT_QUEUE=()

# Parse args for: wiki-health maintenance-due <skill> [--json]
# Sets globals: MAINT_SKILL, MAINT_JSON. Exits 2 on bad args.
_parse_maintenance_due_args() {
  MAINT_SKILL=""
  MAINT_JSON=false

  local end_of_opts=false
  while [[ $# -gt 0 ]]; do
    if [[ "$end_of_opts" == false && "$1" == "--" ]]; then
      end_of_opts=true
      shift
      continue
    fi
    if [[ "$end_of_opts" == false && "$1" == --* ]] || \
       [[ "$end_of_opts" == false && "$1" == -h ]]; then
      case "$1" in
        -h|--help) _usage; exit 0 ;;
        --json)  MAINT_JSON=true; shift ;;
        *)
          echo "ERROR: unknown option: $1" >&2
          echo "Run 'wiki-health --help' for usage." >&2
          exit 2
          ;;
      esac
    else
      if [[ -z "$MAINT_SKILL" ]]; then
        MAINT_SKILL="$1"
        shift
      else
        echo "ERROR: unexpected argument: $1" >&2
        echo "Run 'wiki-health --help' for usage." >&2
        exit 2
      fi
    fi
  done

  if [[ -z "$MAINT_SKILL" ]]; then
    echo "ERROR: maintenance-due requires <skill> positional argument" >&2
    echo "Run 'wiki-health --help' for usage." >&2
    exit 2
  fi

  # Denylist: reject path traversal and shell-special chars in MAINT_SKILL
  # (same convention as the FRESH_SKILL / CITED_SKILL denylists above).
  if [[ "$MAINT_SKILL" == */* || "$MAINT_SKILL" == *\\* || "$MAINT_SKILL" == *..* || \
        "$MAINT_SKILL" == *" "* || "$MAINT_SKILL" == *'"'* || "$MAINT_SKILL" == *'`'* || \
        "$MAINT_SKILL" == *'$'* || "$MAINT_SKILL" == *'*'* || "$MAINT_SKILL" == *'?'* || \
        "$MAINT_SKILL" == *';'* || "$MAINT_SKILL" == *'&'* || "$MAINT_SKILL" == *'|'* || \
        "$MAINT_SKILL" == *'<'* || "$MAINT_SKILL" == *'>'* || "$MAINT_SKILL" == *'('* || \
        "$MAINT_SKILL" == *')'* || "$MAINT_SKILL" == *'{'* || "$MAINT_SKILL" == *'}'* || \
        "$MAINT_SKILL" == *'['* || "$MAINT_SKILL" == *']'* || \
        "$MAINT_SKILL" == *$'\n'* ]]; then
    echo "ERROR: invalid skill path: $MAINT_SKILL" >&2
    exit 2
  fi
}

# Extract the last-verified frontmatter value from a page (quoted-YAML-
# string convention, D5/D17) — strips surrounding quotes. Outputs the raw
# value, or empty if the field is absent.
#
# Design note: this is the queue's VALUE source in both the mdite-available
# and mdite-EX_UNAVAILABLE cases. mdite's `files --frontmatter` is a
# membership FILTER (matches spec/name only), not a value projector — it
# cannot supply the actual date string the queue needs to sort by, so grep
# is used uniformly rather than only as a degraded fallback. This guarantees
# "never a false-empty queue" regardless of mdite availability. mdite is
# still genuinely exercised for the due-condition's leg (b) below (orphan/
# broken-link status via `mdite lint`).
_extract_last_verified() {
  local page_path="$1"
  # Frontmatter only recognized when line 1 is exactly "---" — same NR==1
  # guard as _extract_code_cites above (wiki-health-frontmatter-line1-
  # only-detection).
  awk '
    NR == 1 && !/^---[[:space:]]*$/ { exit }
    /^---/ { count++; if (count == 2) exit; next }
    count == 1 && /^last-verified:/ {
      line = $0
      gsub(/^last-verified:[[:space:]]*/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      gsub(/^"|"$/, "", line)
      gsub(/^'"'"'|'"'"'$/, "", line)
      print line
      exit
    }
  ' "$page_path" 2>/dev/null
}

# =============================================================================
# fence-scan subcommand implementation
# =============================================================================

# Parse args for: wiki-health fence-scan <skill> [--json] [--quiet]
# Sets globals: FENCE_SCAN_SKILL, FENCE_SCAN_JSON, FENCE_SCAN_QUIET
# Exits 2 on bad args. -h/--help is handled FIRST, before the zero-arg
# check (R12:
# `git-state --help` once created a file literally named `--help` when a
# help check ran after positional binding instead of before it).
_parse_fence_scan_args() {
  FENCE_SCAN_SKILL=""
  FENCE_SCAN_JSON=false
  FENCE_SCAN_QUIET=false

  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    _usage
    exit 0
  fi

  if [[ $# -eq 0 ]]; then
    echo "ERROR: fence-scan requires <skill> positional argument" >&2
    echo "Run 'wiki-health --help' for usage." >&2
    exit 2
  fi

  FENCE_SCAN_SKILL="$1"
  shift

  # Denylist: same convention as MAINT_SKILL / FRESH_SKILL / CITED_SKILL /
  # LINT_MARKER_SKILL above.
  if [[ "$FENCE_SCAN_SKILL" == */* || "$FENCE_SCAN_SKILL" == *\\* || "$FENCE_SCAN_SKILL" == *..* || \
        "$FENCE_SCAN_SKILL" == *" "* || "$FENCE_SCAN_SKILL" == *'"'* || "$FENCE_SCAN_SKILL" == *'`'* || \
        "$FENCE_SCAN_SKILL" == *'$'* || "$FENCE_SCAN_SKILL" == *'*'* || "$FENCE_SCAN_SKILL" == *'?'* || \
        "$FENCE_SCAN_SKILL" == *';'* || "$FENCE_SCAN_SKILL" == *'&'* || "$FENCE_SCAN_SKILL" == *'|'* || \
        "$FENCE_SCAN_SKILL" == *'<'* || "$FENCE_SCAN_SKILL" == *'>'* || "$FENCE_SCAN_SKILL" == *'('* || \
        "$FENCE_SCAN_SKILL" == *')'* || "$FENCE_SCAN_SKILL" == *'{'* || "$FENCE_SCAN_SKILL" == *'}'* || \
        "$FENCE_SCAN_SKILL" == *'['* || "$FENCE_SCAN_SKILL" == *']'* || \
        "$FENCE_SCAN_SKILL" == *$'\n'* ]]; then
    echo "ERROR: invalid skill path: $FENCE_SCAN_SKILL" >&2
    exit 2
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json)  FENCE_SCAN_JSON=true;  shift ;;
      --quiet) FENCE_SCAN_QUIET=true; shift ;;
      *)
        echo "ERROR: unknown option: $1" >&2
        echo "Run 'wiki-health --help' for usage." >&2
        exit 2
        ;;
    esac
  done
}

# Run the fence-scan subcommand: detect unfenced ## Pages bullet runs via
# _wiki_pages_bullet_runs (invoked DIRECTLY, never via a global-setting-
# function-in-$( ) pattern -- it is a pure emitter, so capturing its stdout
# in a command substitution is safe per bash-subshell-strips-globals).
# Reads FENCE_SCAN_SKILL_DIR, FENCE_SCAN_SKILL, FENCE_SCAN_JSON.
# Returns 0 when no run is unfenced (including zero runs at all), 1 when at
# least one run is unfenced.
_run_fence_scan() {
  local skill_dir="$FENCE_SCAN_SKILL_DIR"
  local skillmd="$skill_dir/SKILL.md"

  local runs
  runs="$(_wiki_pages_bullet_runs "$skillmd")"

  local unfenced=0
  local start end fenced
  if [[ -n "$runs" ]]; then
    while IFS=$'\t' read -r start end fenced; do
      [[ -z "$start" ]] && continue
      [[ "$fenced" == "0" ]] && unfenced=$((unfenced + 1))
    done <<< "$runs"
  fi

  if [[ "$FENCE_SCAN_JSON" == true ]]; then
    local runs_json="" fenced_bool
    if [[ -n "$runs" ]]; then
      while IFS=$'\t' read -r start end fenced; do
        [[ -z "$start" ]] && continue
        [[ -n "$runs_json" ]] && runs_json+=","
        fenced_bool="false"
        [[ "$fenced" == "1" ]] && fenced_bool="true"
        runs_json+="{\"start\":${start},\"end\":${end},\"fenced\":${fenced_bool}}"
      done <<< "$runs"
    fi
    printf '{"skill":"%s","runs":[%s],"unfenced":%d}\n' \
      "$(_json_str "$FENCE_SCAN_SKILL")" "$runs_json" "$unfenced"
  else
    [[ -n "$runs" ]] && printf '%s\n' "$runs"
  fi

  [[ "$unfenced" -gt 0 ]] && return 1
  return 0
}

# Dispatch fence-scan subcommand with arg parsing and skill resolution.
# Exits 2 with the resolver's standard error text on an unresolvable skill,
# then exits with the runner's code. Predeclares scan_rc BEFORE running _run_fence_scan and
# wraps the call in set +e/set -e (matching _run_maintenance_due's own
# mdite-exit-code capture at :2715-2718) so set -euo pipefail does not abort
# the script the instant the runner intentionally returns 1
# (bash-local-var-clobbers-exit-status: predeclare before the measured
# command, capture $? immediately after with no intervening statement).
_dispatch_fence_scan() {
  _parse_fence_scan_args "$@"

  FENCE_SCAN_SKILL_DIR=""
  RESOLVED_SKILL_DIR=""
  if ! _resolve_skill_as_wiki "$FENCE_SCAN_SKILL"; then
    echo "ERROR: skill '$FENCE_SCAN_SKILL' not declared as a wiki (SKILL.md frontmatter must carry 'wiki: true')" >&2
    exit 2
  fi
  FENCE_SCAN_SKILL_DIR="$RESOLVED_SKILL_DIR"

  local scan_rc
  set +e
  _run_fence_scan
  scan_rc=$?
  set -e
  exit "$scan_rc"
}

# Run the maintenance-due subcommand: computes the D10 compound due
# condition and the D11 threshold-formula verdict payload. Reads
# MAINT_SKILL_DIR, MAINT_SKILL, MAINT_JSON.
_run_maintenance_due() {
  local skill_dir="$MAINT_SKILL_DIR"

  # Leg (b) precursor: run `mdite lint` ONCE up front, shared by
  # _classify_skill's health-state check (needs only the exit code) and this
  # function's own due-condition leg (b) below (needs stdout content). The
  # wrapper's external process can block up to its full timeout, so a single
  # maintenance-due call must not pay that cost twice.
  MAINT_MDITE_HIT=false
  MAINT_MDITE_AVAILABLE=true
  local mdite_out="" mdite_rc=0
  if command -v mdite &>/dev/null; then
    set +e
    mdite_out="$(cd "$skill_dir" && mdite lint . 2>/dev/null)"
    mdite_rc=$?
    set -e
    if [[ "$mdite_rc" -eq "$MAINT_MDITE_EX_UNAVAILABLE" ]]; then
      MAINT_MDITE_AVAILABLE=false
    elif [[ -n "$mdite_out" ]]; then
      MAINT_MDITE_HIT=true
    fi
  else
    MAINT_MDITE_AVAILABLE=false
  fi

  # --- Page counts come free from wiki-health's existing classifier (spec
  # Data Model, Threshold formulas) — call directly (no subshell) so
  # CLASSIFY_pages_total / CLASSIFY_STATE propagate back
  # (bash-subshell-strips-globals). Pass the mdite exit code captured above
  # so _classify_skill reuses it instead of invoking mdite a second time.
  _classify_skill "$skill_dir" "$mdite_rc"
  MAINT_PAGES_TOTAL="$CLASSIFY_pages_total"
  local health_state="$CLASSIFY_STATE"
  local classify_reasons=("${CLASSIFY_REASONS[@]}")

  # --- Per-page pass: code-cited count (K denominator), freshness stats
  # (fresh/unknown/stale-semantic), and verification-queue sort keys.
  local pages=()
  while IFS= read -r rel; do
    [[ -n "$rel" ]] && pages+=("$rel")
  done < <(_wiki_collect_pages "$skill_dir")

  MAINT_PAGES_CODE_CITED=0
  MAINT_STALE_SEMANTIC_COUNT=0
  MAINT_FRESH_COUNT=0
  MAINT_UNKNOWN_COUNT=0

  # Reuse the existing Tier-1/Tier-2 freshness helper directly (in-process,
  # same script — no subshell) to classify every page fresh/unknown/
  # stale-semantic in one pass. FRESH_DEEP=true means any Tier-1 hit, OR a
  # cite that is unresolvable (AD4 — see has_unresolvable_cite in
  # _freshness_one_page), is confirmed (or collapsed to fresh) via the
  # existing --deep git-diff check; pages with neither skip the confirm
  # entirely, so this stays bounded to the actually-churned-or-suspect
  # subset rather than deep-diffing every page.
  FRESH_SKILL_DIR="$skill_dir"
  FRESH_PROJECT_ROOT="$(_find_project_root)"
  FRESH_DEEP=true
  FRESH_QUIET=true

  local queue_lines=()
  local rel abs_path cites lv churn_epoch sort_epoch inv_churn
  for rel in "${pages[@]}"; do
    abs_path="$skill_dir/$rel"

    # Cite set for the K-denominator recount (AD9): a page counts as
    # code-cited when it has ≥1 EXTERNAL ref — legacy code-cites value OR
    # external md-link — not only when the legacy field is non-empty.
    cites="$(_extract_cite_set "$abs_path")"
    [[ -n "$cites" ]] && MAINT_PAGES_CODE_CITED=$(( MAINT_PAGES_CODE_CITED + 1 ))

    _freshness_one_page "$abs_path" > /dev/null
    case "$FRESH_STATUS" in
      stale-semantic) MAINT_STALE_SEMANTIC_COUNT=$(( MAINT_STALE_SEMANTIC_COUNT + 1 )) ;;
      fresh)          MAINT_FRESH_COUNT=$(( MAINT_FRESH_COUNT + 1 )) ;;
      unknown)        MAINT_UNKNOWN_COUNT=$(( MAINT_UNKNOWN_COUNT + 1 )) ;;
    esac

    lv="$(_extract_last_verified "$abs_path")"
    churn_epoch="$FRESH_NEWEST_CITED_COMMIT"
    [[ "$churn_epoch" == "null" ]] && churn_epoch=0

    if [[ -n "$lv" ]]; then
      sort_epoch="$(date -u -d "$lv" +%s 2>/dev/null || echo 0)"
    else
      sort_epoch="$(git log -1 --format=%at -- "$abs_path" 2>/dev/null || true)"
      [[ -z "$sort_epoch" ]] && sort_epoch=0
    fi
    # Tie-break: largest cited-code churn first among equal sort_epoch —
    # invert so an ascending text sort still yields largest-churn-first.
    # Field separator is '|' (not tab) -- bash classifies tab as "IFS
    # whitespace" regardless of what IFS is set to, which collapses
    # consecutive delimiters and silently drops empty fields (e.g. an empty
    # $lv) on read; '|' is not whitespace-classified, so empty fields
    # survive the round trip through `sort` and back.
    inv_churn=$(( 9999999999 - churn_epoch ))
    queue_lines+=("$(printf '%020d|%020d|%s|%s|%s' "$sort_epoch" "$inv_churn" "$rel" "$lv" "$churn_epoch")")
  done

  MAINT_QUEUE=()
  if [[ "${#queue_lines[@]}" -gt 0 ]]; then
    local q_rel q_lv q_churn
    while IFS='|' read -r _ _ q_rel q_lv q_churn; do
      MAINT_QUEUE+=("${q_rel}|${q_lv}|${q_churn}")
    done < <(printf '%s\n' "${queue_lines[@]}" | sort)
  fi

  # --- Threshold formulas (D11), size-proportional with clamps ---
  MAINT_N=$(( MAINT_PAGES_TOTAL * 25 / 100 ))
  (( MAINT_N < 5 ))  && MAINT_N=5
  (( MAINT_N > 15 )) && MAINT_N=15

  MAINT_K=$(( MAINT_PAGES_CODE_CITED * 20 / 100 ))
  (( MAINT_K < 5 ))  && MAINT_K=5
  (( MAINT_K > 25 )) && MAINT_K=25

  MAINT_CORRECTION_CAP=3

  # --- Compound due condition (D10): any mechanical churn hit.
  # Days-elapsed is NOT an input.
  # Leg (a)+(c): code-cites churn + changed md-link-target churn, delegated
  # to churn-check (Step 1) — computed once via the external tool, never
  # duplicated inline.
  MAINT_CHURN_HIT=false
  MAINT_CHURN_AVAILABLE=true
  if command -v churn-check &>/dev/null; then
    local churn_rc
    set +e
    churn-check "$MAINT_SKILL" &>/dev/null
    churn_rc=$?
    set -e
    if [[ "$churn_rc" -eq 1 ]]; then
      MAINT_CHURN_HIT=true
    elif [[ "$churn_rc" -ge 2 ]]; then
      MAINT_CHURN_AVAILABLE=false
    fi
  else
    MAINT_CHURN_AVAILABLE=false
  fi

  # Leg (b): mdite orphan/broken-link status, via the Step 2 wrapper. The
  # wrapper remaps mdite's native exit-1-on-findings to wrapper-exit-0 with
  # findings forwarded on stdout, so stdout content (not exit code) is the
  # findings signal; EX_UNAVAILABLE (69) degrades this leg only -- never a
  # false clean. MAINT_MDITE_HIT / MAINT_MDITE_AVAILABLE were already
  # computed from the single mdite invocation at the top of this function.

  # --- large-drift (D11): stale-semantic > 10% of wiki (min 2), OR degraded
  # health. The D11 table's third leg ("any misleading drift") lives in
  # scratch/<project>/learned/ files -- a per-project tree this skill-scoped
  # script has no visibility into (no skill-to-project mapping exists here).
  # Callers with project context (lint.md's sweep, the boundary/archive
  # gate) OR this value with their own escalated-drift check before
  # recommending groom.
  #
  # health_state's MDITE_LINT_FAILURE reason (from _classify_skill's own
  # mdite invocation above) is discounted when it is the ONLY unhealthy
  # reason AND leg (b) independently confirms mdite is EX_UNAVAILABLE: the
  # wrapper's exit code doesn't distinguish "ran clean" from "ran with
  # findings" (both remap to 0; only EX_UNAVAILABLE differs), so
  # _classify_skill's own exit-code-only check can only ever fire on
  # unavailability post-wrapper, never on genuine findings -- treating that
  # as "degraded health" would be exactly the false-non-clean the spec's
  # Error Handling table forbids for a transient mdite outage (non-fatal).
  # Any OTHER unhealthy reason still counts toward large-drift.
  MAINT_LARGE_DRIFT=false
  if (( MAINT_STALE_SEMANTIC_COUNT >= 2 )) && (( MAINT_STALE_SEMANTIC_COUNT * 100 > MAINT_PAGES_TOTAL * 10 )); then
    MAINT_LARGE_DRIFT=true
  fi
  if [[ "$health_state" != "healthy" ]]; then
    local has_non_mdite_reason=false cr
    for cr in "${classify_reasons[@]}"; do
      [[ "$cr" != MDITE_LINT_FAILURE:* ]] && has_non_mdite_reason=true && break
    done
    if [[ "$has_non_mdite_reason" == true || "$MAINT_MDITE_AVAILABLE" == true ]]; then
      MAINT_LARGE_DRIFT=true
    fi
  fi

  MAINT_DUE=false
  [[ "$MAINT_CHURN_HIT" == true || "$MAINT_MDITE_HIT" == true ]] && MAINT_DUE=true

  if [[ "$MAINT_JSON" == true ]]; then
    _emit_maintenance_due_json "$MAINT_SKILL"
  else
    if [[ "$MAINT_DUE" == true ]]; then
      echo "${MAINT_SKILL}: due"
    else
      echo "${MAINT_SKILL}: not-due"
    fi
  fi
}

# Emit the full --json verdict payload (Data Model — always emitted
# regardless of exit code).
_emit_maintenance_due_json() {
  local skill_name="$1"

  local queue_json="" entry q_rel q_lv q_churn
  for entry in "${MAINT_QUEUE[@]}"; do
    IFS='|' read -r q_rel q_lv q_churn <<< "$entry"
    [[ -n "$queue_json" ]] && queue_json+=","
    if [[ -n "$q_lv" ]]; then
      queue_json+="{\"page\":\"$(_json_str "$q_rel")\",\"last-verified\":\"$(_json_str "$q_lv")\",\"cited-churn\":${q_churn}}"
    else
      queue_json+="{\"page\":\"$(_json_str "$q_rel")\",\"last-verified\":null,\"cited-churn\":${q_churn}}"
    fi
  done

  local stale_pct="0.0"
  if (( MAINT_PAGES_TOTAL > 0 )); then
    stale_pct=$(awk -v a="$MAINT_STALE_SEMANTIC_COUNT" -v b="$MAINT_PAGES_TOTAL" 'BEGIN{printf "%.1f", (a/b)*100}')
  fi

  cat <<JSON
{
  "skill": "$(_json_str "$skill_name")",
  "due": $MAINT_DUE,
  "N": $MAINT_N,
  "K": $MAINT_K,
  "correction-cap": $MAINT_CORRECTION_CAP,
  "large-drift": $MAINT_LARGE_DRIFT,
  "queue": [$queue_json],
  "stats": {
    "pages-total": $MAINT_PAGES_TOTAL,
    "pages-code-cited": $MAINT_PAGES_CODE_CITED,
    "fresh": $MAINT_FRESH_COUNT,
    "unknown": $MAINT_UNKNOWN_COUNT,
    "stale-semantic": $MAINT_STALE_SEMANTIC_COUNT,
    "stale-semantic-pct": $stale_pct,
    "mdite-available": $MAINT_MDITE_AVAILABLE,
    "churn-check-available": $MAINT_CHURN_AVAILABLE
  }
}
JSON
}

# Dispatch maintenance-due subcommand with arg parsing and skill resolution.
_dispatch_maintenance_due() {
  # Parse args (exits 2 on error)
  _parse_maintenance_due_args "$@"

  MAINT_SKILL_DIR=""
  RESOLVED_SKILL_DIR=""
  if ! _resolve_skill_as_wiki "$MAINT_SKILL"; then
    echo "ERROR: skill '$MAINT_SKILL' not declared as a wiki (SKILL.md frontmatter must carry 'wiki: true')" >&2
    exit 2
  fi
  MAINT_SKILL_DIR="$RESOLVED_SKILL_DIR"

  _run_maintenance_due

  if [[ "$MAINT_DUE" == true ]]; then
    exit 1
  else
    exit 0
  fi
}

# --- Subcommand peeling layer (inserted BEFORE parse_args) ---
# If $1 is a recognized subcommand verb, route to verb-specific handler.
# Verb handler exits — does not fall through to parse_args.
# Otherwise fall through to existing parse_args (bare-skill mode unchanged).
case "${1:-}" in
  freshness)
    shift
    _dispatch_freshness "$@"
    ;;
  cited-paths)
    shift
    _dispatch_cited_paths "$@"
    ;;
  maintenance-due)
    shift
    _dispatch_maintenance_due "$@"
    ;;
  fence-scan)
    shift
    _dispatch_fence_scan "$@"
    ;;
esac

parse_args "$@"

# --- Locate project root and skills directory ---
PROJECT_ROOT="$(_find_project_root)"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "ERROR: skills directory not found: $SKILLS_DIR" >&2
  exit 2
fi

# ==============================================================================
# Single-skill mode
# ==============================================================================
if [[ "$MODE" == "single" ]]; then
  skill_dir="$SKILLS_DIR/$SKILL_ARG"

  if [[ ! -d "$skill_dir" ]]; then
    echo "ERROR: skill not found: $SKILL_ARG (looked in $skill_dir)" >&2
    exit 2
  fi

  _classify_skill "$skill_dir"

  # --full deep-audit mode: run after structural classification. See
  # _run_deep_audit for the downgrade/reporting semantics. No-op when
  # --full was not passed.
  _run_deep_audit "$skill_dir"

  exit_code=$(_state_exit_code "$CLASSIFY_STATE")

  case "$OUTPUT_FMT" in
    default)
      echo "${SKILL_ARG}: ${CLASSIFY_STATE}"
      ;;
    verbose)
      echo "${SKILL_ARG}: ${CLASSIFY_STATE}"
      for r in "${CLASSIFY_REASONS[@]}"; do
        echo "  - ${r#*:}"
      done
      # Zero-exclusion runs stay silent — only surface the line when
      # .mditerc exclude: patterns actually dropped a census candidate, so a
      # broad glob can't silently hide knowledge pages.
      (( CLASSIFY_pages_excluded_by_mditerc > 0 )) && \
        echo "  excluded-by-mditerc: ${CLASSIFY_pages_excluded_by_mditerc}"
      ;;
    json)
      _emit_json_verdict "$SKILL_ARG"
      ;;
  esac

  exit "$exit_code"
fi

# ==============================================================================
# --all mode
# ==============================================================================
if [[ "$MODE" == "all" ]]; then
  skill_dirs=()
  while IFS= read -r -d '' d; do
    skill_dirs+=("$d")
  done < <(find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null | sort -z)

  any_non_healthy=false

  if [[ "$OUTPUT_FMT" == "json" ]]; then
    # JSON array output
    echo "["
    first=true
    for skill_dir in "${skill_dirs[@]}"; do
      skill_name="$(basename "$skill_dir")"
      _classify_skill "$skill_dir"
      # Undeclared with no wiki shape: not a wiki, so the sweep says nothing
      # about it at all -- no row, and it cannot make the fleet non-healthy.
      [[ "$CLASSIFY_STATE" == "not-a-wiki" ]] && continue
      # --full deep-audit mode: no-op when --full was not passed. Must run
      # before the non-healthy check below so a downgrade is reflected in
      # any_non_healthy and in the emitted deep_audit JSON object.
      _run_deep_audit "$skill_dir"
      [[ "$CLASSIFY_STATE" != "healthy" ]] && any_non_healthy=true

      [[ "$first" == false ]] && echo ","
      first=false
      _emit_json_verdict "$skill_name"
    done
    echo "]"
  else
    # Table output
    printf "%-40s %-20s %s\n" "skill" "state" "primary-reason"
    printf "%-40s %-20s %s\n" "$(printf '%0.s-' {1..40})" "$(printf '%0.s-' {1..20})" "$(printf '%0.s-' {1..40})"
    for skill_dir in "${skill_dirs[@]}"; do
      skill_name="$(basename "$skill_dir")"
      _classify_skill "$skill_dir"
      # Undeclared with no wiki shape: omitted from the sweep entirely (D15).
      [[ "$CLASSIFY_STATE" == "not-a-wiki" ]] && continue
      # --full deep-audit mode: no-op when --full was not passed. Must run
      # before the non-healthy check and _primary_reason below so a
      # downgrade is reflected in the exit code and the printed reason.
      _run_deep_audit "$skill_dir"
      [[ "$CLASSIFY_STATE" != "healthy" ]] && any_non_healthy=true
      primary_reason="$(_primary_reason)"
      printf "%-40s %-20s %s\n" "$skill_name" "$CLASSIFY_STATE" "$primary_reason"
    done
  fi

  if [[ "$any_non_healthy" == true ]]; then
    exit 6
  else
    exit 0
  fi
fi
