#!/usr/bin/env bash
# test-wiki-health.sh — Automated tests for wiki-health worktree-aware resolution
# Run: bash test-wiki-health.sh
# All tests use temp directories cleaned up on exit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIKI_HEALTH="$SCRIPT_DIR/wiki-health.sh"
PASS=0
FAIL=0
TOTAL=0

# --- Test helpers ---
pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  FAIL: $1 — $2"; }

assert_exit() {
  local expected="$1" actual="$2" label="$3"
  if [[ "$actual" -eq "$expected" ]]; then
    pass "$label"
  else
    fail "$label" "expected exit $expected, got $actual"
  fi
}

assert_contains() {
  local needle="$1" haystack="$2" label="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    pass "$label"
  else
    fail "$label" "output missing '$needle'"
  fi
}

assert_exit_in_set() {
  local actual="$1" label="$2"
  shift 2
  local valid_exits=("$@")
  for v in "${valid_exits[@]}"; do
    if [[ "$actual" -eq "$v" ]]; then
      pass "$label"
      return
    fi
  done
  fail "$label" "exit $actual not in valid set {${valid_exits[*]}}"
}

# --- Temp directory setup ---
TMPDIR_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT

# ============================================================
echo "=== Group 1: Worktree-aware resolution ==="
# ============================================================

# Build wt-a: stub-expert is "new" — no SKILL.md, no .mditerc
wt_a="$TMPDIR_ROOT/wt-a"
mkdir -p "$wt_a/.claude/skills/stub-expert"

# Build wt-b: stub-expert is "unhealthy" — has ## Pages heading + .mditerc with wrong entrypoint
wt_b="$TMPDIR_ROOT/wt-b"
mkdir -p "$wt_b/.claude/skills/stub-expert"
cat > "$wt_b/.claude/skills/stub-expert/SKILL.md" <<'EOF'
# Stub Expert

## Pages

- [Page One](page-one.md) — stub page

## Meta
EOF
# Wrong entrypoint intentionally (not SKILL.md) → ENTRYPOINT_WRONG → unhealthy
cat > "$wt_b/.claude/skills/stub-expert/.mditerc" <<'EOF'
entrypoint: index.md
EOF

# Test: wt-a → stub-expert should be "new" (exit 3)
rc=0
output=""
output=$(cd "$wt_a" && bash "$WIKI_HEALTH" stub-expert 2>&1) || rc=$?
assert_exit 3 "$rc" "wt-a: stub-expert resolves as new (exit 3)"
assert_contains "stub-expert: new" "$output" "wt-a: output shows 'new' state"

# Test: wt-b → stub-expert should be "unhealthy" (exit 5)
rc=0
output=""
output=$(cd "$wt_b" && bash "$WIKI_HEALTH" stub-expert 2>&1) || rc=$?
assert_exit 5 "$rc" "wt-b: stub-expert resolves as unhealthy (exit 5)"
assert_contains "stub-expert: unhealthy" "$output" "wt-b: output shows 'unhealthy' state"

# Test: each worktree resolves its OWN .claude/ (wt-a should not see wt-b's skill state)
rc=0
output=""
output=$(cd "$wt_a" && bash "$WIKI_HEALTH" stub-expert 2>&1) || rc=$?
assert_exit 3 "$rc" "wt-a: no bleed-over from wt-b (still exit 3)"

# ============================================================
echo ""
echo "=== Group 2: Fallback when PWD is outside any worktree ==="
# ============================================================

# Create a dir with no .claude/ anywhere up the tree
no_claude_dir="$TMPDIR_ROOT/no-claude-here"
mkdir -p "$no_claude_dir"

# SCRIPT_DIR is the green worktree's scripts/ — its walk-up finds green's .claude/
# wiki-memory exists in green's .claude/skills/ — so fallback should succeed
rc=0
output=""
output=$(cd "$no_claude_dir" && bash "$WIKI_HEALTH" wiki-memory 2>&1) || rc=$?
# Valid exits: 0 (healthy), 3 (new), 4 (partial-migration), 5 (unhealthy)
assert_exit_in_set "$rc" "fallback from outside-worktree: exit in valid set {0,3,4,5}" 0 3 4 5

# ============================================================
echo ""
echo "=== Group 3: Exit-code preservation (argparse paths) ==="
# ============================================================

# Test: --help → exit 0
rc=0; (cd "$wt_a" && bash "$WIKI_HEALTH" --help >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--help exits 0"

# Test: no args → exit 2 (usage error)
rc=0; (cd "$wt_a" && bash "$WIKI_HEALTH" 2>/dev/null) || rc=$?
assert_exit 2 "$rc" "no args exits 2"

# Test: nonexistent skill from a valid worktree → exit 2 (skill not found)
rc=0; (cd "$wt_a" && bash "$WIKI_HEALTH" nonexistent-skill-xyz 2>/dev/null) || rc=$?
assert_exit 2 "$rc" "nonexistent skill from valid worktree exits 2"

# ============================================================
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
