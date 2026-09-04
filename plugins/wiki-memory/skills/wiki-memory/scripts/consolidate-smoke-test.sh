#!/usr/bin/env bash
# consolidate-smoke-test.sh — Smoke-test runner for /wiki-memory consolidate
#
# Stages the synthetic fixtures from scratch/wiki-fleet-conversion/smoke-test/
# into a temporary directory, exercises the pure-mechanical sub-steps of the
# consolidate protocol (fixture structure validation), and reports per-criterion
# PASS/FAIL results.
#
# Output format: each criterion line is prefixed with "PASS: " or "FAIL: " so
# downstream greps (Step 04) can reliably count results:
#   grep "^PASS:" output.txt | wc -l    # count passing criteria
#   grep "^FAIL:" output.txt | wc -l    # count failing criteria
#
# Exit codes:
#   0 — all criteria pass
#   1 — one or more criteria fail or usage error (unknown flag, too many args)

set -euo pipefail

# ----- Usage / help --------------------------------------------------------
# IMPORTANT: this case block MUST come before the positional-count guard below.
# When --help is passed, $# is 1 — a positional guard would reject it first.
case "${1:-}" in
  -h|--help)
    cat <<'USAGE'
Usage: consolidate-smoke-test.sh [--help]

Smoke-test runner for the /wiki-memory consolidate operation.

Stages synthetic skill fixtures from:
  scratch/wiki-fleet-conversion/smoke-test/

into a mktemp -d temporary directory, then validates the six structural
acceptance criteria for the consolidate operation against the staged fixtures.

Output format:
  PASS: <criterion-label>   — criterion met
  FAIL: <criterion-label>   — criterion not met

Step 04 greps for these prefixes to count pass/fail totals. The prefix
format is fixed — do not pipe through tools that alter line prefixes.

Exit codes:
  0 — all 6 criteria pass
  1 — one or more criteria fail

Options:
  -h, --help    Show this help text and exit 0

USAGE
    exit 0
    ;;
  -*)
    echo "ERROR: unknown option: ${1}" >&2
    exit 1
    ;;
esac

# ----- Positional-argument count guard ------------------------------------
# Placed AFTER the flag case block so --help is handled before this check.
if [ $# -gt 0 ]; then
  echo "ERROR: too many arguments" >&2
  exit 1
fi

# ----- Locate fixtures root -----------------------------------------------
# Walk upward from this script's location to find the repo root, then resolve
# the scratch/wiki-fleet-conversion/smoke-test/ path.
_resolve_script_dir() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir
    dir="$(cd "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd "$(dirname "$src")" && pwd
}
SCRIPT_DIR="$(_resolve_script_dir)"

# scripts/ -> wiki-memory/ -> skills/ -> .claude/ -> repo root
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
FIXTURES_ROOT="$REPO_ROOT/scratch/wiki-fleet-conversion/smoke-test"

if [ ! -d "$FIXTURES_ROOT" ]; then
  echo "ERROR: fixtures root not found: $FIXTURES_ROOT" >&2
  echo "  Run this script from a clone of claude-code-ref-gray with the scratch subrepo present." >&2
  exit 1
fi

# ----- Temp directory + cleanup trap --------------------------------------
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

# ----- Stage fixtures into tmpdir -----------------------------------------
cp -r "$FIXTURES_ROOT/source-a"    "$tmpdir/source-a"
cp -r "$FIXTURES_ROOT/source-b"    "$tmpdir/source-b"
cp -r "$FIXTURES_ROOT/target-empty" "$tmpdir/target-empty"

# ----- Criterion evaluation helpers ---------------------------------------
pass_count=0
fail_count=0

pass() { echo "PASS: $1"; (( pass_count++ )) || true; }
fail() { echo "FAIL: $1"; (( fail_count++ )) || true; }

# ----- Criterion 1: source-a has SKILL.md + ≥1 sibling page + .mditerc + schema.md + log.md ---
label="source-a: SKILL.md + sibling-page + .mditerc + schema.md + log.md"
if [ -f "$tmpdir/source-a/SKILL.md" ] \
   && [ -f "$tmpdir/source-a/.mditerc" ] \
   && [ -f "$tmpdir/source-a/schema.md" ] \
   && [ -f "$tmpdir/source-a/log.md" ] \
   && [ "$(ls "$tmpdir/source-a"/*.md 2>/dev/null | { grep -v "SKILL\.md\|schema\.md\|log\.md" || true; } | wc -l)" -gt 0 ]; then
  pass "$label"
else
  fail "$label"
fi

# ----- Criterion 2: source-a sibling page has tags + summary frontmatter -----
label="source-a: sibling page carries tags + summary frontmatter"
sibling_page=""
for f in "$tmpdir/source-a"/*.md; do
  base="$(basename "$f")"
  if [ "$base" != "SKILL.md" ] && [ "$base" != "schema.md" ] && [ "$base" != "log.md" ]; then
    sibling_page="$f"
    break
  fi
done

if [ -n "$sibling_page" ] \
   && grep -q "^tags:" "$sibling_page" \
   && grep -q "^summary:" "$sibling_page"; then
  pass "$label"
else
  fail "$label"
fi

# ----- Criterion 3: source-a SKILL.md has ## Pages section ----------------
label="source-a: SKILL.md contains ## Pages section"
if grep -q "^## Pages" "$tmpdir/source-a/SKILL.md"; then
  pass "$label"
else
  fail "$label"
fi

# ----- Criterion 4: source-b has SKILL.md only (no sibling files) ---------
label="source-b: SKILL.md only — no sibling pages, no .mditerc"
extra_files=$(ls "$tmpdir/source-b/" | { grep -v "^SKILL\.md$" || true; } | wc -l)
if [ -f "$tmpdir/source-b/SKILL.md" ] && [ "$extra_files" -eq 0 ]; then
  pass "$label"
else
  fail "$label"
fi

# ----- Criterion 5: source-b SKILL.md has ≥3 substantive content sections --
label="source-b: SKILL.md has >= 3 substantive content sections"
section_count=$(grep -c "^## " "$tmpdir/source-b/SKILL.md" || true)
if [ "$section_count" -ge 3 ]; then
  pass "$label"
else
  fail "$label"
fi

# ----- Criterion 6: target-empty has SKILL.md + .mditerc + schema.md + log.md ---
label="target-empty: SKILL.md + .mditerc + schema.md + log.md"
if [ -f "$tmpdir/target-empty/SKILL.md" ] \
   && [ -f "$tmpdir/target-empty/.mditerc" ] \
   && [ -f "$tmpdir/target-empty/schema.md" ] \
   && [ -f "$tmpdir/target-empty/log.md" ]; then
  pass "$label"
else
  fail "$label"
fi

# ----- Summary ------------------------------------------------------------
echo ""
echo "Results: $pass_count passed, $fail_count failed (of 6 criteria)"

if [ "$fail_count" -eq 0 ]; then
  echo "Status: ALL PASS — smoke test complete"
  exit 0
else
  echo "Status: FAILURES DETECTED — review FAIL: lines above"
  exit 1
fi
