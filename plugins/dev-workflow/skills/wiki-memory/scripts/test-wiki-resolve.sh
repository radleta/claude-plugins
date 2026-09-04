#!/usr/bin/env bash
# test-wiki-resolve.sh — Automated tests for wiki-resolve
# Run: bash test-wiki-resolve.sh
# All tests use temp directories cleaned up on exit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIKI_RESOLVE="$SCRIPT_DIR/wiki-resolve.sh"
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

assert_not_contains() {
  local needle="$1" haystack="$2" label="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    pass "$label"
  else
    fail "$label" "output should not contain '$needle'"
  fi
}

assert_empty() {
  local actual="$1" label="$2"
  if [[ -z "$actual" ]]; then
    pass "$label"
  else
    fail "$label" "expected empty, got: $actual"
  fi
}

# --- Temp directory setup ---
TMPDIR_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT

# ============================================================
echo "=== Argument validation ==="
# ============================================================

# Test: --help
output=$(bash "$WIKI_RESOLVE" --help 2>&1) || true
rc=0; bash "$WIKI_RESOLVE" --help >/dev/null 2>&1 || rc=$?
assert_exit 0 "$rc" "--help exits 0"
assert_contains "Usage:" "$output" "--help shows usage"

# Test: -h
rc=0; bash "$WIKI_RESOLVE" -h >/dev/null 2>&1 || rc=$?
assert_exit 0 "$rc" "-h exits 0"

# Test: no args
rc=0; bash "$WIKI_RESOLVE" 2>/dev/null || rc=$?
assert_exit 1 "$rc" "no args exits 1"
output=$(bash "$WIKI_RESOLVE" 2>&1) || true
assert_contains "domain argument required" "$output" "no args error message"

# Test: unknown flag
rc=0; bash "$WIKI_RESOLVE" -z 2>/dev/null || rc=$?
assert_exit 1 "$rc" "unknown flag exits 1"
output=$(bash "$WIKI_RESOLVE" --bogus 2>&1) || true
assert_contains "unknown option" "$output" "unknown flag error message"

# Test: path traversal in domain name
rc=0; bash "$WIKI_RESOLVE" "../etc" 2>/dev/null || rc=$?
assert_exit 1 "$rc" "path traversal (..) exits 1"

rc=0; bash "$WIKI_RESOLVE" "foo/bar" 2>/dev/null || rc=$?
assert_exit 1 "$rc" "path traversal (/) exits 1"

rc=0; bash "$WIKI_RESOLVE" "foo\\bar" 2>/dev/null || rc=$?
assert_exit 1 "$rc" "path traversal (backslash) exits 1"

rc=0; bash "$WIKI_RESOLVE" "foo bar" 2>/dev/null || rc=$?
assert_exit 1 "$rc" "space in domain exits 1"

output=$(bash "$WIKI_RESOLVE" "../etc" 2>&1) || true
assert_contains "must not contain" "$output" "path traversal error message"

# ============================================================
echo ""
echo "=== --help probe order (no registry references) ==="
# ============================================================

# --help output reflects new probe order
output=$(bash "$WIKI_RESOLVE" --help 2>&1) || true
assert_contains "Resolution 0" "$output" "--help output reflects new probe order: contains Resolution 0"
assert_not_contains "paths.env" "$output" "--help output reflects new probe order: DOES NOT contain paths.env"
assert_not_contains "Registry" "$output" "--help output reflects new probe order: DOES NOT contain Registry"

# ============================================================
echo ""
echo "=== Extra positional argument ==="
# ============================================================

rc=0; bash "$WIKI_RESOLVE" mcp-expert extra-arg 2>/dev/null || rc=$?
assert_exit 1 "$rc" "extra positional argument exits 1"
err=$(bash "$WIKI_RESOLVE" mcp-expert extra-arg 2>&1) || true
assert_contains "ERROR: too many arguments — wiki-resolve takes exactly one domain argument" "$err" "extra arg error message"

# ============================================================
echo ""
echo "=== Skill-as-wiki (Resolution 0) ==="
# ============================================================

# Setup a fake repo with a skill-as-wiki layout
saw_root="$TMPDIR_ROOT/saw-repo"
mkdir -p "$saw_root/.claude/skills/mcp-expert"
cat > "$saw_root/.claude/skills/mcp-expert/SKILL.md" <<'EOF'
# MCP Expert Skill

## Pages
- [Overview](overview.md) — main page
EOF
cat > "$saw_root/.claude/skills/mcp-expert/.mditerc" <<'EOF'
entrypoint: SKILL.md
EOF

# skill-as-wiki happy path
stdout=$(cd "$saw_root" && bash "$WIKI_RESOLVE" mcp-expert 2>/dev/null)
stderr=$(cd "$saw_root" && bash "$WIKI_RESOLVE" mcp-expert 2>&1 >/dev/null) || true
rc=0; (cd "$saw_root" && bash "$WIKI_RESOLVE" mcp-expert >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "skill-as-wiki happy path exits 0"
assert_contains "<!-- wiki: $saw_root/.claude/skills/mcp-expert/ -->" "$stdout" "skill-as-wiki happy path stdout points to skill folder"
assert_empty "$stderr" "skill-as-wiki emits NO WARN"

# Resolution 0 wins over BOTH layouts: skill-as-wiki valid AND .wiki-memory present
mkdir -p "$saw_root/.wiki-memory/mcp-expert"
echo "# Legacy Index" > "$saw_root/.wiki-memory/mcp-expert/index.md"
stdout_both=$(cd "$saw_root" && bash "$WIKI_RESOLVE" mcp-expert 2>/dev/null)
stderr_both=$(cd "$saw_root" && bash "$WIKI_RESOLVE" mcp-expert 2>&1 >/dev/null) || true
rc=0; (cd "$saw_root" && bash "$WIKI_RESOLVE" mcp-expert >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "Resolution 0 wins over BOTH layouts exits 0"
assert_contains "<!-- wiki: $saw_root/.claude/skills/mcp-expert/ -->" "$stdout_both" "Resolution 0 wins over BOTH layouts stdout points to skill folder"
assert_not_contains ".wiki-memory" "$stdout_both" "Resolution 0 wins: stdout does NOT reference legacy path"
assert_empty "$stderr_both" "Resolution 0 wins over BOTH layouts: stderr EMPTY (no WARN)"

# ============================================================
echo ""
echo "=== skill-as-wiki triple-gate fall-throughs ==="
# ============================================================

# Build a legacy fallback target so fall-throughs resolve via Resolution 1 (with WARN)
fallback_root="$TMPDIR_ROOT/fallback-repo"
mkdir -p "$fallback_root/.wiki-memory/mcp-expert"
echo "# Legacy MCP Expert" > "$fallback_root/.wiki-memory/mcp-expert/index.md"

# skill-as-wiki missing ## Pages falls through to legacy
mkdir -p "$fallback_root/.claude/skills/mcp-expert"
cat > "$fallback_root/.claude/skills/mcp-expert/SKILL.md" <<'EOF'
# MCP Expert Skill (no Pages heading)
This skill has no Pages section.
EOF
cat > "$fallback_root/.claude/skills/mcp-expert/.mditerc" <<'EOF'
entrypoint: SKILL.md
EOF

stdout_nopages=$(cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert 2>/dev/null)
stderr_nopages=$(cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert 2>&1 >/dev/null) || true
rc=0; (cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "skill-as-wiki missing ## Pages falls through to legacy exits 0"
assert_contains "<!-- wiki: $fallback_root/.wiki-memory/mcp-expert/ -->" "$stdout_nopages" "skill-as-wiki missing ## Pages falls through to legacy: stdout points to .wiki-memory"
assert_contains "WARN:" "$stderr_nopages" "skill-as-wiki missing ## Pages falls through: has WARN"

# skill-as-wiki missing .mditerc falls through to legacy
rm "$fallback_root/.claude/skills/mcp-expert/.mditerc"
cat > "$fallback_root/.claude/skills/mcp-expert/SKILL.md" <<'EOF'
# MCP Expert Skill

## Pages
- [Overview](overview.md) — main page
EOF

stdout_nomditerc=$(cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert 2>/dev/null)
stderr_nomditerc=$(cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert 2>&1 >/dev/null) || true
rc=0; (cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "skill-as-wiki missing .mditerc falls through to legacy exits 0"
assert_contains "<!-- wiki: $fallback_root/.wiki-memory/mcp-expert/ -->" "$stdout_nomditerc" "skill-as-wiki missing .mditerc falls through: stdout points to .wiki-memory"
assert_contains "WARN:" "$stderr_nomditerc" "skill-as-wiki missing .mditerc falls through: has WARN"

# skill-as-wiki wrong entrypoint falls through to legacy
cat > "$fallback_root/.claude/skills/mcp-expert/.mditerc" <<'EOF'
entrypoint: index.md
EOF

stdout_wrongep=$(cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert 2>/dev/null)
stderr_wrongep=$(cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert 2>&1 >/dev/null) || true
rc=0; (cd "$fallback_root" && bash "$WIKI_RESOLVE" mcp-expert >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "skill-as-wiki wrong entrypoint falls through to legacy exits 0"
assert_contains "<!-- wiki: $fallback_root/.wiki-memory/mcp-expert/ -->" "$stdout_wrongep" "skill-as-wiki wrong entrypoint falls through: stdout points to .wiki-memory"
assert_contains "WARN:" "$stderr_wrongep" "skill-as-wiki wrong entrypoint falls through: has WARN"

# ============================================================
echo ""
echo "=== Cross-root walk-up precedence ==="
# ============================================================

# grandparent has skill-as-wiki (Resolution 0), immediate parent has legacy .wiki-memory
# cwd is a deeper subdirectory — Resolution 0 must win because it walks the FULL ancestor
# chain before Resolution 1 begins; grandparent skill-as-wiki beats parent legacy.

xroot_gp="$TMPDIR_ROOT/xroot-grandparent"
xroot_parent="$xroot_gp/parent"
xroot_cwd="$xroot_parent/child"
mkdir -p "$xroot_gp/.claude/skills/cross-domain"
cat > "$xroot_gp/.claude/skills/cross-domain/SKILL.md" <<'EOF'
# Cross Domain Skill (grandparent)

## Pages
- [Main](main.md) — grandparent
EOF
cat > "$xroot_gp/.claude/skills/cross-domain/.mditerc" <<'EOF'
entrypoint: SKILL.md
EOF

mkdir -p "$xroot_parent/.wiki-memory/cross-domain"
echo "# Parent Legacy Wiki" > "$xroot_parent/.wiki-memory/cross-domain/index.md"
mkdir -p "$xroot_cwd"

stdout_xroot=$(cd "$xroot_cwd" && bash "$WIKI_RESOLVE" cross-domain 2>/dev/null)
stderr_xroot=$(cd "$xroot_cwd" && bash "$WIKI_RESOLVE" cross-domain 2>&1 >/dev/null) || true
rc=0; (cd "$xroot_cwd" && bash "$WIKI_RESOLVE" cross-domain >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "cross-root walk-up precedence exits 0"
assert_contains "<!-- wiki: $xroot_gp/.claude/skills/cross-domain/ -->" "$stdout_xroot" "cross-root walk-up precedence: stdout points to grandparent skill"
assert_not_contains ".wiki-memory" "$stdout_xroot" "cross-root walk-up precedence: stdout does NOT reference parent legacy path"
assert_empty "$stderr_xroot" "cross-root walk-up precedence: stderr empty (no WARN)"

# ============================================================
echo ""
echo "=== Project walk-up resolution (from \$PWD) ==="
# ============================================================

# Fake project: .git/ marks the repo root
fake_project="$TMPDIR_ROOT/fake-project"
mkdir -p "$fake_project/.git"
mkdir -p "$fake_project/.wiki-memory/proj-domain"
mkdir -p "$fake_project/src/nested"
cat > "$fake_project/.wiki-memory/proj-domain/index.md" <<'EOF'
# Project Walk-up Wiki
EOF

# Test: project walk-up from repo root
output=$(cd "$fake_project" && bash "$WIKI_RESOLVE" proj-domain 2>&1)
rc=$?
assert_exit 0 "$rc" "project walk-up from repo root exits 0"
assert_contains "<!-- wiki: $fake_project/.wiki-memory/proj-domain/ -->" "$output" "project walk-up finds wiki at repo root"
assert_contains "Project Walk-up Wiki" "$output" "project walk-up outputs correct index"

# Test: project walk-up from nested subdir (climbs to repo root)
output=$(cd "$fake_project/src/nested" && bash "$WIKI_RESOLVE" proj-domain 2>&1)
rc=$?
assert_exit 0 "$rc" "project walk-up from nested subdir exits 0"
assert_contains "Project Walk-up Wiki" "$output" "project walk-up climbs nested subdirs to repo root"

# Test: .git/ boundary — an ancestor wiki outside the repo must NOT hijack
outside_wiki="$TMPDIR_ROOT/.wiki-memory/proj-domain"
mkdir -p "$outside_wiki"
echo "# Outside Wiki" > "$outside_wiki/index.md"

output=$(cd "$fake_project" && bash "$WIKI_RESOLVE" proj-domain 2>&1)
rc=$?
assert_exit 0 "$rc" ".git boundary test exits 0"
assert_contains "Project Walk-up Wiki" "$output" ".git boundary: inner wiki still wins"
assert_not_contains "Outside Wiki" "$output" ".git boundary: walk-up does NOT cross into parent"

# Test: from outside any .git/ boundary, walk-up DOES reach ancestor wiki
# (This demonstrates the boundary is enforced only when .git/ is present.)
nonrepo="$TMPDIR_ROOT/nonrepo-dir"
mkdir -p "$nonrepo"
output=$(cd "$nonrepo" && bash "$WIKI_RESOLVE" proj-domain 2>&1)
rc=$?
assert_exit 0 "$rc" "walk-up without .git boundary exits 0"
assert_contains "Outside Wiki" "$output" "walk-up reaches ancestor wiki when no .git boundary"

# Cleanup outside_wiki so later tests aren't polluted
rm -rf "$outside_wiki"

# ============================================================
echo ""
echo "=== PWD .wiki-memory walk-up legacy (Resolution 1) ==="
# ============================================================

# PWD .wiki-memory walk-up legacy — preserved for the PWD-local wiki use case
pwd_legacy_root="$TMPDIR_ROOT/pwd-legacy"
mkdir -p "$pwd_legacy_root/.wiki-memory/billing-data"
echo "# Billing Data Wiki" > "$pwd_legacy_root/.wiki-memory/billing-data/index.md"

stdout_legacy=$(cd "$pwd_legacy_root" && bash "$WIKI_RESOLVE" billing-data 2>/dev/null)
stderr_legacy=$(cd "$pwd_legacy_root" && bash "$WIKI_RESOLVE" billing-data 2>&1 >/dev/null) || true
rc=0; (cd "$pwd_legacy_root" && bash "$WIKI_RESOLVE" billing-data >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "PWD .wiki-memory walk-up legacy exits 0"
assert_contains "<!-- wiki: $pwd_legacy_root/.wiki-memory/billing-data/ -->" "$stdout_legacy" "PWD .wiki-memory walk-up legacy: stdout points to .wiki-memory/billing-data/"
assert_contains "WARN:" "$stderr_legacy" "PWD .wiki-memory walk-up legacy: stderr has one WARN line"

# ============================================================
echo ""
echo "=== stderr WARN format pinned ==="
# ============================================================

# Any legacy resolution must emit WARN in exact format
stderr_warn=$(cd "$pwd_legacy_root" && bash "$WIKI_RESOLVE" billing-data 2>&1 >/dev/null) || true
assert_contains "WARN: wiki 'billing-data' resolved via legacy" "$stderr_warn" "stderr WARN format pinned: contains WARN prefix with domain"
assert_contains "(see /wiki-memory migrate)" "$stderr_warn" "stderr WARN format pinned: contains migration hint"

# ============================================================
echo ""
echo "=== Walk-up resolution (Resolution 2 — script install walk-up) ==="
# ============================================================

# Create a fake repo structure with .claude/ and .wiki-memory/
fake_repo="$TMPDIR_ROOT/fake-repo"
mkdir -p "$fake_repo/.claude/skills/test-expert/scripts"
mkdir -p "$fake_repo/.wiki-memory/test-domain"
cat > "$fake_repo/.wiki-memory/test-domain/index.md" <<'EOF'
# Walk-up Test Wiki

## Pages
- [Walkup Page](walkup.md) — found via walk-up
EOF

# Copy wiki-resolve into the fake repo's skill scripts dir
cp "$WIKI_RESOLVE" "$fake_repo/.claude/skills/test-expert/scripts/wiki-resolve.sh"

# Test: walk-up finds wiki
output=$(bash "$fake_repo/.claude/skills/test-expert/scripts/wiki-resolve.sh" test-domain 2>&1)
rc=$?
assert_exit 0 "$rc" "walk-up resolution exits 0"
assert_contains "<!-- wiki:" "$output" "walk-up outputs wiki header"
assert_contains "Walk-up Test Wiki" "$output" "walk-up outputs correct index"
assert_contains "walk-up" "$output" "walk-up output references walkup page" || true

# Test: walk-up miss (domain not in .wiki-memory/) — exits 1 per Step 01 exit-code change
rc=0; output=$(bash "$fake_repo/.claude/skills/test-expert/scripts/wiki-resolve.sh" missing-domain 2>&1) || rc=$?
assert_exit 1 "$rc" "walk-up miss exits 1"
assert_contains "wiki-resolve failed" "$output" "walk-up miss outputs failure comment"
assert_contains "walk-up(" "$output" "walk-up miss mentions walk-up in checked paths"

# ============================================================
echo ""
echo "=== Plugin layout resolution (Resolution 3) ==="
# ============================================================

# Create a fake plugin structure
fake_plugin="$TMPDIR_ROOT/plugins/test-plugin"
mkdir -p "$fake_plugin/skills/test-expert/scripts"
mkdir -p "$fake_plugin/wikis/plugin-domain"
cat > "$fake_plugin/wikis/plugin-domain/index.md" <<'EOF'
# Plugin Wiki

## Pages
- [Plugin Page](plugin.md) — from plugin layout
EOF

# Copy wiki-resolve into the plugin skills dir
cp "$WIKI_RESOLVE" "$fake_plugin/skills/test-expert/scripts/wiki-resolve.sh"

# Test: plugin layout finds wiki
stdout_plugin=$(bash "$fake_plugin/skills/test-expert/scripts/wiki-resolve.sh" plugin-domain 2>/dev/null)
stderr_plugin=$(bash "$fake_plugin/skills/test-expert/scripts/wiki-resolve.sh" plugin-domain 2>&1 >/dev/null) || true
rc=0; bash "$fake_plugin/skills/test-expert/scripts/wiki-resolve.sh" plugin-domain >/dev/null 2>&1 || rc=$?
assert_exit 0 "$rc" "plugin resolution exits 0"
assert_contains "<!-- wiki:" "$stdout_plugin" "plugin outputs wiki header"
assert_contains "Plugin Wiki" "$stdout_plugin" "plugin outputs correct index"
assert_contains "WARN:" "$stderr_plugin" "plugin probe legacy: stderr has one WARN line"

# Test: plugin layout miss — exits 1 per Step 01 exit-code change
rc=0; output=$(bash "$fake_plugin/skills/test-expert/scripts/wiki-resolve.sh" missing-plugin 2>&1) || rc=$?
assert_exit 1 "$rc" "plugin miss exits 1"
assert_contains "wiki-resolve failed" "$output" "plugin miss outputs failure comment"

# ============================================================
echo ""
echo "=== Domain not found (all probes miss) ==="
# ============================================================

rc=0; output=$(cd "$TMPDIR_ROOT" && bash "$WIKI_RESOLVE" totally-nonexistent 2>&1) || rc=$?
assert_exit 1 "$rc" "not found exits 1"
assert_contains "wiki-resolve failed" "$output" "not found outputs failure comment"
assert_contains "totally-nonexistent" "$output" "failure mentions domain name"
assert_contains "checked:" "$output" "failure lists checked paths"

# ============================================================
echo ""
echo "=== install.sh --check post-registry-removal ==="
# ============================================================

# clean install (no stale paths.env on disk) — stdout must have OK/DRIFT/MISSING/OTHER prefixes,
# MUST NOT contain 'paths.env' or 'data dir' when no stale registry exists.
INSTALL_SH="$SCRIPT_DIR/install.sh"
install_stdout=$(HOME="$TMPDIR_ROOT/fakehome" bash "$INSTALL_SH" --check 2>/dev/null)
install_rc=0; HOME="$TMPDIR_ROOT/fakehome" bash "$INSTALL_SH" --check >/dev/null 2>&1 || install_rc=$?
assert_exit 0 "$install_rc" "install.sh --check post-registry-removal exits 0"
# At least one of the expected prefix tags must appear
if [[ "$install_stdout" == *"[OK]"* || "$install_stdout" == *"[DRIFT]"* || "$install_stdout" == *"[MISSING]"* || "$install_stdout" == *"[OTHER]"* ]]; then
  pass "install.sh --check has OK/DRIFT/MISSING/OTHER prefix tags"
else
  fail "install.sh --check has OK/DRIFT/MISSING/OTHER prefix tags" "none of the expected prefix tags found"
fi
assert_not_contains "paths.env" "$install_stdout" "install.sh --check: stdout MUST NOT contain paths.env (no stale registry)"
assert_not_contains "data dir" "$install_stdout" "install.sh --check: stdout MUST NOT contain data dir"

# ============================================================
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
