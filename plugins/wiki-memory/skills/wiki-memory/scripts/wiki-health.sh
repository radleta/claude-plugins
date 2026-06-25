#!/usr/bin/env bash
# wiki-health.sh — Deterministic 4-state classifier for wiki-backed skills
#
# Usage: wiki-health <skill> [--verbose|--json] [--full]
#        wiki-health --all [--json]
#
# Exit codes:
#   0  — healthy
#   2  — usage/argument error
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
       wiki-health --all [--json]
       wiki-health -h|--help

Deterministic 4-state classifier for wiki-backed skills.

Arguments:
  <skill>     Skill folder name under .claude/skills/ (e.g. pdfsharp-expert)
  --verbose   Print state line + bulleted reason list
  --json      Print full JSON verdict (Data Model §1 schema)
  --full      Deep-audit mode: run Step 5b pairwise cross-link scan + Step 6
              group-affinity check on structurally-healthy skills. Downgrades
              healthy → partial-migration when candidates are found. Purely
              diagnostic — does NOT modify any wiki files. Use to detect
              missing cross-references after protocol-evolution events.
              Example: wiki-health winforms-expert --full
  --all       Survey all skill folders; table output; exit 6 if any non-healthy
  --all --json  JSON array of per-skill verdict objects

Exit codes:
  0  healthy
  2  usage/argument error
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

# --- Classify a single skill folder ---
# Sets global variables:
#   CLASSIFY_STATE, CLASSIFY_REASONS (array of "code:detail" strings)
#   CLASSIFY_FILES_* and CLASSIFY_PAGES_* for JSON schema fields
_classify_skill() {
  local skill_dir="$1"

  CLASSIFY_STATE=""
  CLASSIFY_REASONS=()

  # Files sub-object fields
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
  CLASSIFY_pages_missing_summary=()
  CLASSIFY_pages_tag_prefix_mismatches=()   # JSON fragments
  CLASSIFY_pages_listed_but_missing=()
  CLASSIFY_pages_orphan_index_md=false

  # --- Collect file signals ---

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
    local total_lines
    total_lines=$(wc -l < "$skillmd")
    local frontmatter_end
    frontmatter_end=$(awk 'NR>1 && /^---/{print NR; exit}' "$skillmd" || true)
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
    if command -v mdite &>/dev/null; then
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
              | grep -oE '\([^)]+\.md\)' | tr -d '()')
  fi

  # Scan actual page files (exclude special files and scripts/, assets/ subdirs)
  local all_pages=()
  while IFS= read -r -d '' f; do
    local rel="${f#$skill_dir/}"
    # Skip scripts/ and assets/ subdirs
    [[ "$rel" == scripts/* || "$rel" == assets/* ]] && continue
    # Skip special files
    local base
    base="$(basename "$f")"
    [[ "$base" == "SKILL.md" || "$base" == "log.md" || "$base" == "schema.md" || "$base" == "index.md" || "$base" == ".origin" || "$base" == ".snapshot" ]] && continue
    all_pages+=("$rel")
  done < <(find "$skill_dir" -maxdepth 2 -name "*.md" -not -path "*/scripts/*" -not -path "*/assets/*" -print0 2>/dev/null)

  CLASSIFY_pages_total=${#all_pages[@]}

  # Check listed pages for missing files
  for lp in "${listed_pages[@]}"; do
    if [[ ! -f "$skill_dir/$lp" ]]; then
      CLASSIFY_pages_listed_but_missing+=("$lp")
    fi
  done

  # Check page frontmatter: summary field required
  for pf in "${all_pages[@]}"; do
    local full_path="$skill_dir/$pf"
    if [[ -f "$full_path" ]]; then
      if ! awk '/^---/{count++; if(count==2) exit} count==1 && /^summary:/{found=1} END{exit !found}' "$full_path" 2>/dev/null; then
        CLASSIFY_pages_missing_summary+=("$pf")
      fi
    fi
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
        # Extract all tag values from the page's YAML frontmatter (between first ---...--- block)
        local page_tags
        page_tags=$(awk '/^---/{count++; if(count==2) exit} count==1 && /^tags:/{found=1} found && /^tags:/{print; next} found && /^[^ -]/{found=0} found{print}' "$full_path" 2>/dev/null || true)
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

  # --- Determine state ---

  # Check for new: no wiki signals at all
  local has_wiki_signals=false
  if [[ "$CLASSIFY_mditerc_present" == true && "$CLASSIFY_entrypoint_correct" == true ]] || \
     [[ "$CLASSIFY_pages_heading_present" == true ]]; then
    has_wiki_signals=true
  fi

  if [[ "$has_wiki_signals" == false ]]; then
    CLASSIFY_STATE="new"
    CLASSIFY_REASONS+=("NO_PAGES_HEADING:SKILL.md has no ## Pages heading")
    [[ "$CLASSIFY_mditerc_present" == false ]] && \
      CLASSIFY_REASONS+=("MDITERC_MISSING:.mditerc file not found")
    [[ "$CLASSIFY_mditerc_present" == true && "$CLASSIFY_entrypoint_correct" == false ]] && \
      CLASSIFY_REASONS+=("ENTRYPOINT_WRONG:.mditerc entrypoint is not SKILL.md")
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
  [[ "$CLASSIFY_meta_heading_present" == false ]] && \
    unhealthy_reasons+=("NO_META_HEADING:SKILL.md missing ## Meta section")
  (( CLASSIFY_mdite_lint_exit_code != 0 )) && \
    unhealthy_reasons+=("MDITE_LINT_FAILURE:mdite lint exited ${CLASSIFY_mdite_lint_exit_code}")
  [[ "$CLASSIFY_pages_orphan_index_md" == true ]] && \
    unhealthy_reasons+=("ORPHAN_INDEX_MD:top-level index.md co-exists with ## Pages in SKILL.md")

  for mp in "${CLASSIFY_pages_missing_summary[@]}"; do
    unhealthy_reasons+=("MISSING_SUMMARY:page ${mp} missing summary frontmatter field")
  done

  for lm in "${CLASSIFY_pages_listed_but_missing[@]}"; do
    unhealthy_reasons+=("LISTED_PAGE_MISSING:page listed in ## Pages but file missing: ${lm}")
  done

  for tm in "${CLASSIFY_pages_tag_prefix_mismatches[@]}"; do
    # Format stored as "page-path:actual != expected" — emit as structured reason code
    local tm_page="${tm%%:*}"
    local tm_detail="${tm#*:}"
    unhealthy_reasons+=("TAG_PREFIX_MISMATCH:${tm_page}: tag prefix ${tm_detail}")
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
    # Frontmatter detection
    if (/^---/) {
      front_count++
      if (front_count == 1) { in_front = 1; next }
      if (front_count == 2) { in_front = 0; front_done = 1; next }
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
    # Markdown links: extract basename of linked .md files
    line = $0
    while (match(line, /\([^)]*\.md\)/, m)) {
      lnk = m[0]
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
  FNR == 1 {
    if (NR > 1) emit(cur_fn)
    cur_fn = FILENAME
    reset()
  }
  /^---/ {
    fc++
    if (fc==1) { in_front=1; next }
    if (fc==2) { in_front=0; fd=1; next }
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
    line = $0
    while (match(line, /\([^)]*\.md\)/)) {
      lnk = substr(line, RSTART, RLENGTH); gsub(/[\(\)]/, "", lnk)
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
  FNR == 1 { if (NR > 1) emit(cur_fn); cur_fn=FILENAME; reset() }
  /^---/ { fc++; if (fc==1) { in_front=1; next } if (fc==2) { in_front=0; fd=1; next } }
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

# --- State to exit code ---
_state_exit_code() {
  case "$1" in
    healthy)           echo 0 ;;
    new)               echo 3 ;;
    partial-migration) echo 4 ;;
    unhealthy)         echo 5 ;;
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

  # Build listed_but_missing array
  local listed_but_missing_json=""
  for lm in "${CLASSIFY_pages_listed_but_missing[@]}"; do
    [[ -n "$listed_but_missing_json" ]] && listed_but_missing_json+=","
    listed_but_missing_json+="\"$(_json_str "$lm")\""
  done

  # Build tag_prefix_mismatches array
  local tag_mismatch_json=""
  for tm in "${CLASSIFY_pages_tag_prefix_mismatches[@]}"; do
    [[ -n "$tag_mismatch_json" ]] && tag_mismatch_json+=","
    tag_mismatch_json+="\"$(_json_str "$tm")\""
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
    "missing_summary": [$missing_summary_json],
    "tag_prefix_mismatches": [$tag_mismatch_json],
    "listed_but_missing": [$listed_but_missing_json],
    "orphan_index_md": $CLASSIFY_pages_orphan_index_md
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

  # Denylist: reject path traversal and shell-special chars in FRESH_PAGE
  if [[ -n "$FRESH_PAGE" ]]; then
    if [[ "$FRESH_PAGE" == */* || "$FRESH_PAGE" == *\\* || "$FRESH_PAGE" == *..* || \
          "$FRESH_PAGE" == *" "* || "$FRESH_PAGE" == *'"'* || "$FRESH_PAGE" == *'`'* || \
          "$FRESH_PAGE" == *'$'* || "$FRESH_PAGE" == *'*'* || "$FRESH_PAGE" == *'?'* || \
          "$FRESH_PAGE" == *';'* || "$FRESH_PAGE" == *'&'* || "$FRESH_PAGE" == *'|'* || \
          "$FRESH_PAGE" == *'<'* || "$FRESH_PAGE" == *'>'* || "$FRESH_PAGE" == *'('* || \
          "$FRESH_PAGE" == *')'* || "$FRESH_PAGE" == *'{'* || "$FRESH_PAGE" == *'}'* || \
          "$FRESH_PAGE" == *'['* || "$FRESH_PAGE" == *']'* || \
          "$FRESH_PAGE" == *$'\n'* ]]; then
      echo "ERROR: invalid page path: $FRESH_PAGE" >&2
      exit 2
    fi
  fi
}

# Resolve skill directory using skill-as-wiki triple-gate resolver.
# Walk up from $PWD looking for .claude/skills/<skill>/ with:
#   1. SKILL.md present
#   2. ## Pages heading in SKILL.md
#   3. .mditerc present with entrypoint: SKILL.md
# Sets FRESH_SKILL_DIR on success; returns 0 on hit, 1 on miss.
_freshness_resolve_skill() {
  local skill="$1"
  local dir="${PWD%/}"
  while [[ "$dir" != "/" && "$dir" != "." ]]; do
    local candidate="$dir/.claude/skills/$skill"
    if [[ -d "$candidate" && -f "$candidate/SKILL.md" ]]; then
      if grep -q '^## Pages' "$candidate/SKILL.md" 2>/dev/null; then
        if [[ -f "$candidate/.mditerc" ]] && grep -q '^entrypoint:[[:space:]]*SKILL\.md' "$candidate/.mditerc" 2>/dev/null; then
          FRESH_SKILL_DIR="$candidate"
          return 0
        fi
      fi
    fi
    dir="$(dirname "$dir")"
  done
  # Fallback: try SCRIPT_DIR walk (start at SCRIPT_DIR for parity with _find_project_root)
  local sdir="$SCRIPT_DIR"
  while [[ "$sdir" != "/" && "$sdir" != "." ]]; do
    local candidate="$sdir/.claude/skills/$skill"
    if [[ -d "$candidate" && -f "$candidate/SKILL.md" ]]; then
      if grep -q '^## Pages' "$candidate/SKILL.md" 2>/dev/null; then
        if [[ -f "$candidate/.mditerc" ]] && grep -q '^entrypoint:[[:space:]]*SKILL\.md' "$candidate/.mditerc" 2>/dev/null; then
          FRESH_SKILL_DIR="$candidate"
          return 0
        fi
      fi
    fi
    sdir="$(dirname "$sdir")"
  done
  return 1
}

# Extract code-cites list from a page's YAML frontmatter.
# Outputs one path per line; empty output if field is absent or empty list.
_extract_code_cites() {
  local page_path="$1"
  # awk: collect code-cites: field inside frontmatter block (between first two --- lines)
  awk '
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
  FRESH_PSLUG="$(basename "$page_path" .md)"
  FRESH_WIKI_MTIME=0
  FRESH_NEWEST_CITED_COMMIT="null"
  FRESH_STATUS=""

  # Extract code-cites
  local cites
  cites="$(_extract_code_cites "$page_path")"

  if [[ -z "$cites" ]]; then
    # Principle page — no cited paths
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
    fi
  done <<< "$cites"

  # Tier-2 (--deep): if Tier-1 flagged stale-timestamp, confirm with semantic diff.
  # Get T_wiki commit hash; compare each cited path at that commit vs HEAD via git diff.
  # Any difference → stale-semantic. All same → fresh (false alarm).
  # Status set never includes stale-timestamp in deep mode.
  if [[ "$FRESH_DEEP" == true && "$page_status" == "stale-timestamp" ]]; then
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
      # Check if the cited path existed at T_wiki commit
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
    while IFS= read -r -d '' f; do
      local base
      base="$(basename "$f")"
      [[ "$base" == "SKILL.md" || "$base" == "log.md" || "$base" == "schema.md" ]] && continue
      pages+=("$f")
    done < <(find "$skill_dir" -maxdepth 1 -name "*.md" -print0 2>/dev/null | sort -z)
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
  if ! _freshness_resolve_skill "$FRESH_SKILL"; then
    echo "ERROR: skill '$FRESH_SKILL' not resolvable as wiki (SKILL.md + ## Pages + .mditerc required)" >&2
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

# Resolve a skill as a wiki-backed skill.
# Walk up from $PWD looking for .claude/skills/<skill>/ with:
#   1. SKILL.md present
#   2. ## Pages heading in SKILL.md
#   3. .mditerc present with entrypoint: SKILL.md
# Sets CITED_SKILL_DIR on success; returns 0 on hit, 1 on miss.
_resolve_skill_as_wiki() {
  local skill="$1"
  local dir="${PWD%/}"
  while [[ "$dir" != "/" && "$dir" != "." ]]; do
    local candidate="$dir/.claude/skills/$skill"
    if [[ -d "$candidate" && -f "$candidate/SKILL.md" ]]; then
      if grep -q '^## Pages' "$candidate/SKILL.md" 2>/dev/null; then
        if [[ -f "$candidate/.mditerc" ]] && grep -q '^entrypoint:[[:space:]]*SKILL\.md' "$candidate/.mditerc" 2>/dev/null; then
          CITED_SKILL_DIR="$candidate"
          return 0
        fi
      fi
    fi
    dir="$(dirname "$dir")"
  done
  # Fallback: try SCRIPT_DIR walk (parity with _find_project_root)
  local sdir="$SCRIPT_DIR"
  while [[ "$sdir" != "/" && "$sdir" != "." ]]; do
    local candidate="$sdir/.claude/skills/$skill"
    if [[ -d "$candidate" && -f "$candidate/SKILL.md" ]]; then
      if grep -q '^## Pages' "$candidate/SKILL.md" 2>/dev/null; then
        if [[ -f "$candidate/.mditerc" ]] && grep -q '^entrypoint:[[:space:]]*SKILL\.md' "$candidate/.mditerc" 2>/dev/null; then
          CITED_SKILL_DIR="$candidate"
          return 0
        fi
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
  if ! _resolve_skill_as_wiki "$CITED_SKILL"; then
    echo "ERROR: skill '$CITED_SKILL' not resolvable as wiki (SKILL.md + ## Pages + .mditerc required)" >&2
    # Infra failure: emit empty result and exit 0
    if [[ "$CITED_JSON" == true ]]; then
      printf '{"skill":"%s","page":"%s","cited_paths":[]}\n' \
        "$(_json_str "$CITED_SKILL")" "$(_json_str "$CITED_PAGE")"
    fi
    exit 0
  fi

  _run_cited_paths
  exit 0
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

  # --full deep-audit mode: run after structural classification.
  # Only fires when state = healthy (non-healthy already needs work; no downgrade needed).
  # Does NOT modify any wiki files — purely diagnostic.
  if [[ "$FULL_MODE" == true && "$CLASSIFY_STATE" == "healthy" ]]; then
    DEEP_CROSS_REFS=()
    DEEP_GROUP_AFFINITY=()
    _deep_scan_cross_refs "$skill_dir"
    _deep_scan_group_affinity "$skill_dir"

    # If any deep-audit candidates were found, downgrade to partial-migration
    if [ "${#DEEP_CROSS_REFS[@]}" -gt 0 ] || [ "${#DEEP_GROUP_AFFINITY[@]}" -gt 0 ]; then
      CLASSIFY_STATE="partial-migration"
      # Emit reason codes for each type of finding
      if [ "${#DEEP_CROSS_REFS[@]}" -gt 0 ]; then
        CLASSIFY_REASONS+=("MISSING_CROSS_LINKS:${#DEEP_CROSS_REFS[@]} page pair(s) with missing cross-references (Step 5b deep scan)")
      fi
      if [ "${#DEEP_GROUP_AFFINITY[@]}" -gt 0 ]; then
        CLASSIFY_REASONS+=("MISPLACED_PAGE:${#DEEP_GROUP_AFFINITY[@]} top-level page(s) fit an existing subdirectory group (Step 6 group-affinity)")
      fi
    fi
  fi

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
