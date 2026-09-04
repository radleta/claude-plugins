#!/usr/bin/env bash
# test-wiki-health.sh — Automated tests for wiki-health worktree-aware resolution
# Run: bash test-wiki-health.sh
# All tests use temp directories cleaned up on exit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIKI_HEALTH="$SCRIPT_DIR/wiki-health.sh"
WIKI_WRITE="$SCRIPT_DIR/wiki-write.sh"
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

# Init a git repo with a fixed, isolated identity (no dependency on ambient
# git config) — same convention as test-churn-check.sh.
_git_init_repo() {
  local dir="$1"
  mkdir -p "$dir"
  (cd "$dir" && git init -q && git config user.email "test@test.com" && git config user.name "Test User")
}

# Commit all changes in a repo with a fixed author/committer date, so
# freshness ordering between fixture commits is deterministic (no reliance
# on real wall-clock timing / sleep).
_git_commit() {
  local dir="$1" msg="$2" date="$3"
  (cd "$dir" && git add -A && GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit -q -m "$msg")
}

# --- Temp directory setup ---
TMPDIR_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT

# ============================================================
echo "=== Group 1: Worktree-aware resolution ==="
# ============================================================

# Build wt-a: stub-expert is "not-a-wiki" — no SKILL.md, no .mditerc, so
# nothing declares it and no structural signal makes it an adoption candidate
wt_a="$TMPDIR_ROOT/wt-a"
mkdir -p "$wt_a/.claude/skills/stub-expert"

# Build wt-b: stub-expert is "unhealthy" — has ## Pages heading + .mditerc with wrong entrypoint
wt_b="$TMPDIR_ROOT/wt-b"
mkdir -p "$wt_b/.claude/skills/stub-expert"
cat > "$wt_b/.claude/skills/stub-expert/SKILL.md" <<'EOF'
---
wiki: true
---

# Stub Expert

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — stub page
<!-- END:PAGES -->

## Meta
EOF
# Wrong entrypoint intentionally (not SKILL.md) → ENTRYPOINT_WRONG → unhealthy
cat > "$wt_b/.claude/skills/stub-expert/.mditerc" <<'EOF'
entrypoint: index.md
EOF

# Test: wt-a → stub-expert should be "not-a-wiki" (exit 2)
rc=0
output=""
output=$(cd "$wt_a" && bash "$WIKI_HEALTH" stub-expert 2>&1) || rc=$?
assert_exit 2 "$rc" "wt-a: stub-expert resolves as not-a-wiki (exit 2)"
assert_contains "stub-expert: not-a-wiki" "$output" "wt-a: output shows 'not-a-wiki' state"

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
assert_exit 2 "$rc" "wt-a: no bleed-over from wt-b (still exit 2)"

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
echo "=== Group 4: Disk-orphan detection ==="
# ============================================================

wt_c="$TMPDIR_ROOT/wt-c"

# --- Flat fixture: page-b.md exists on disk but is never listed in ## Pages ---
flat_dir="$wt_c/.claude/skills/stub-orphan-flat"
mkdir -p "$flat_dir"
cat > "$flat_dir/SKILL.md" <<'EOF'
---
name: stub-orphan-flat
description: "flat orphan fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page A](page-a.md) — Page A
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$flat_dir/.mditerc"
cat > "$flat_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
code-cites: []
---
# Page A
EOF
cat > "$flat_dir/page-b.md" <<'EOF'
---
tags: [x]
summary: "Page B (orphan)"
code-cites: []
---
# Page B
EOF

rc=0; output=""
output=$(cd "$wt_c" && bash "$WIKI_HEALTH" stub-orphan-flat --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "flat orphan fixture: unhealthy (exit 5)"
assert_contains "page-b.md" "$output" "flat orphan fixture: orphan page-b.md reported"
assert_not_contains "page-a.md" "$output" "flat orphan fixture: listed page-a.md NOT reported as orphan"

json_output=$(cd "$wt_c" && bash "$WIKI_HEALTH" stub-orphan-flat --json 2>/dev/null) || true
assert_contains '"orphan_pages"' "$json_output" "flat orphan fixture: JSON has orphan_pages field"
assert_contains "page-b.md" "$json_output" "flat orphan fixture: JSON orphan_pages lists page-b.md"

# --- Two-tier fixture: SKILL.md lists a subdir hub; the hub's own ## Pages
# lists its content pages. Those must NOT be false-positived as orphans;
# a page missing from BOTH indexes must still be flagged. ---
twotier_dir="$wt_c/.claude/skills/stub-orphan-twotier"
mkdir -p "$twotier_dir/group"
cat > "$twotier_dir/SKILL.md" <<'EOF'
---
name: stub-orphan-twotier
description: "two-tier orphan fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [group/](group/index.md) — group hub
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$twotier_dir/.mditerc"
cat > "$twotier_dir/group/index.md" <<'EOF'
---
tags: [x]
summary: "Group hub"
---
# Group Hub

## Pages

- [Sub Page](sub-page.md) — summary
EOF
cat > "$twotier_dir/group/sub-page.md" <<'EOF'
---
tags: [x]
summary: "Sub Page"
code-cites: []
---
# Sub Page
EOF
cat > "$twotier_dir/group/orphan-sub.md" <<'EOF'
---
tags: [x]
summary: "Orphan Sub"
code-cites: []
---
# Orphan Sub
EOF

rc=0; output=""
output=$(cd "$wt_c" && bash "$WIKI_HEALTH" stub-orphan-twotier --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "two-tier orphan fixture: unhealthy (exit 5)"
assert_contains "orphan-sub.md" "$output" "two-tier orphan fixture: group/orphan-sub.md reported as orphan"
assert_not_contains "sub-page.md" "$output" "two-tier orphan fixture: hub-listed group/sub-page.md NOT false-positived"

# ============================================================
echo ""
echo "=== Group 5: --full deep scan runs on an unhealthy fixture ==="
# ============================================================

full_unhealthy_dir="$wt_c/.claude/skills/stub-full-unhealthy"
mkdir -p "$full_unhealthy_dir"
cat > "$full_unhealthy_dir/SKILL.md" <<'EOF'
---
name: stub-full-unhealthy
description: "unhealthy fixture for --full deep scan"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — first
- [Page Two](page-two.md) — second
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$full_unhealthy_dir/.mditerc"
# page-one.md is missing its summary: field on purpose — guarantees base state
# is unhealthy regardless of the deep scan outcome.
cat > "$full_unhealthy_dir/page-one.md" <<'EOF'
---
tags: [foo, shared-topic]
code-cites: []
---
# Page One

Some content about shared-topic.
EOF
cat > "$full_unhealthy_dir/page-two.md" <<'EOF'
---
tags: [bar, shared-topic]
summary: "Page Two"
code-cites: []
---
# Page Two

More info about shared-topic.
EOF

rc=0; output=""
output=$(cd "$wt_c" && bash "$WIKI_HEALTH" stub-full-unhealthy --full --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "--full on unhealthy fixture: stays unhealthy (exit 5, no downgrade)"
assert_contains "missing summary" "$output" "--full on unhealthy fixture: base MISSING_SUMMARY reason still present"
assert_contains "cross-reference" "$output" "--full on unhealthy fixture: deep-audit cross-ref reason reported alongside base failure"

json_full=$(cd "$wt_c" && bash "$WIKI_HEALTH" stub-full-unhealthy --full --json 2>/dev/null) || true
assert_contains '"deep_audit"' "$json_full" "--full on unhealthy fixture: JSON includes deep_audit even though state is unhealthy"

# ============================================================
echo ""
echo "=== Group 6: link-extraction regex false-positive fixture ==="
# ============================================================

regexfp_dir="$wt_c/.claude/skills/stub-regex-fp"
mkdir -p "$regexfp_dir"
cat > "$regexfp_dir/SKILL.md" <<'EOF'
---
name: stub-regex-fp
description: "regex false-positive fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Real Page](real-page.md) — does something (and overwrites SKILL.md) when it fails
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$regexfp_dir/.mditerc"
cat > "$regexfp_dir/real-page.md" <<'EOF'
---
tags: [x]
summary: "does something (and overwrites SKILL.md) when it fails"
code-cites: []
---
# Real Page
EOF

rc=0; output=""
output=$(cd "$wt_c" && bash "$WIKI_HEALTH" stub-regex-fp --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "regex FP fixture: healthy (exit 0), no phantom missing page"
assert_not_contains "and overwrites SKILL.md" "$output" "regex FP fixture: prose parenthetical NOT reported as listed-but-missing"

# ============================================================
echo ""
echo "=== Group 7: freshness group-subdirectory support ==="
# ============================================================

wt_d="$TMPDIR_ROOT/wt-d"
_git_init_repo "$wt_d"

# --- Two-tier fixture: grp1/sub-page.md cites a code file at the repo root ---
group_skill_dir="$wt_d/.claude/skills/stub-fresh-group"
mkdir -p "$group_skill_dir/grp1"
cat > "$wt_d/cited-code.sh" <<'EOF'
#!/usr/bin/env bash
echo "v1"
EOF
_git_commit "$wt_d" "commit1: cited-code.sh v1" "2024-01-01T00:00:00"

cat > "$group_skill_dir/SKILL.md" <<'EOF'
---
name: stub-fresh-group
description: "freshness group-subdirectory fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Grp1](grp1/index.md) — group hub
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$group_skill_dir/.mditerc"
cat > "$group_skill_dir/grp1/index.md" <<'EOF'
---
tags: [x]
summary: "Grp1 hub"
code-cites: []
---
# Grp1 Hub

## Pages

- [Sub Page](sub-page.md) — summary
EOF
cat > "$group_skill_dir/grp1/sub-page.md" <<'EOF'
---
tags: [x]
summary: "Sub Page"
code-cites: [cited-code.sh]
---
# Sub Page
EOF
_git_commit "$wt_d" "commit2: stub-fresh-group skill" "2024-01-02T00:00:00"

# Test: group/page slug no longer rejected — exits 0, verdict computed (not unknown)
rc=0; output=""
output=$(cd "$wt_d" && bash "$WIKI_HEALTH" freshness stub-fresh-group grp1/sub-page --quiet 2>&1) || rc=$?
assert_exit 0 "$rc" "freshness group/page slug: no longer exits 2 on the '/'"
assert_contains "grp1/sub-page	fresh" "$output" "freshness group/page slug: unchurned code-cite resolves to fresh (not unknown)"

# Test: --json also reports fresh (not unknown) for the group-subdirectory page
json_output=""
json_output=$(cd "$wt_d" && bash "$WIKI_HEALTH" freshness stub-fresh-group grp1/sub-page --json --quiet 2>/dev/null) || true
assert_contains '"page":"grp1/sub-page"' "$json_output" "freshness group/page --json: page slug is two-tier aware"
assert_contains '"status":"fresh"' "$json_output" "freshness group/page --json: status fresh"

# Test: churning the cited file AFTER the wiki page's last commit flips fresh -> stale-timestamp
cat > "$wt_d/cited-code.sh" <<'EOF'
#!/usr/bin/env bash
echo "v2"
EOF
_git_commit "$wt_d" "commit3: cited-code.sh v2 (churn)" "2024-01-03T00:00:00"

rc=0; output=""
output=$(cd "$wt_d" && bash "$WIKI_HEALTH" freshness stub-fresh-group grp1/sub-page --quiet 2>&1) || rc=$?
assert_exit 0 "$rc" "freshness group/page slug after churn: still exits 0"
assert_contains "grp1/sub-page	stale-timestamp" "$output" "freshness group/page slug after churn: reports stale-timestamp"

# Test: whole-domain enumeration (no page arg) recurses into grp1 and reaches
# sub-page.md, but excludes the grp1/index.md navigational hub.
rc=0; output=""
output=$(cd "$wt_d" && bash "$WIKI_HEALTH" freshness stub-fresh-group --quiet 2>&1) || rc=$?
assert_contains "grp1/sub-page" "$output" "freshness whole-domain scan: recurses into grp1 and reaches sub-page"
assert_not_contains "grp1/index" "$output" "freshness whole-domain scan: grp1/index.md hub excluded (not a content page)"

# Test: deeper nesting (more than one '/') is still rejected
rc=0; output=""
output=$(cd "$wt_d" && bash "$WIKI_HEALTH" freshness stub-fresh-group grp1/sub/page --quiet 2>&1) || rc=$?
assert_exit 2 "$rc" "freshness deeper-nested slug (a/b/c): still rejected (exit 2)"

# Test: absolute-path page arg is still rejected
rc=0; output=""
output=$(cd "$wt_d" && bash "$WIKI_HEALTH" freshness stub-fresh-group /grp1 --quiet 2>&1) || rc=$?
assert_exit 2 "$rc" "freshness absolute page slug: still rejected (exit 2)"

# Test: traversal is still rejected
rc=0; output=""
output=$(cd "$wt_d" && bash "$WIKI_HEALTH" freshness stub-fresh-group ../grp1 --quiet 2>&1) || rc=$?
assert_exit 2 "$rc" "freshness traversal page slug: still rejected (exit 2)"

# --- Flat-wiki regression fixture: no subdirectory groups at all. The
# maxdepth-2 recursion must enumerate the EXACT same two pages a maxdepth-1
# scan would have — proving the group-subdirectory extension is a no-op for
# flat wikis. ---
flat_skill_dir="$wt_d/.claude/skills/stub-fresh-flat"
mkdir -p "$flat_skill_dir"
cat > "$wt_d/flat-cited-code.sh" <<'EOF'
#!/usr/bin/env bash
echo "flat v1"
EOF
_git_commit "$wt_d" "commit4: flat-cited-code.sh" "2024-01-04T00:00:00"

cat > "$flat_skill_dir/SKILL.md" <<'EOF'
---
name: stub-fresh-flat
description: "flat freshness regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — no code-cites
- [Page Two](page-two.md) — cites unchurned code
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$flat_skill_dir/.mditerc"
cat > "$flat_skill_dir/page-one.md" <<'EOF'
---
tags: [x]
summary: "Page One"
code-cites: []
---
# Page One
EOF
cat > "$flat_skill_dir/page-two.md" <<'EOF'
---
tags: [x]
summary: "Page Two"
code-cites: [flat-cited-code.sh]
---
# Page Two
EOF
_git_commit "$wt_d" "commit5: stub-fresh-flat skill" "2024-01-05T00:00:00"

rc=0; output=""
output=$(cd "$wt_d" && bash "$WIKI_HEALTH" freshness stub-fresh-flat --quiet 2>&1) || rc=$?
assert_contains "page-one	unknown" "$output" "flat regression fixture: no-code-cites page reports unknown"
assert_contains "page-two	fresh" "$output" "flat regression fixture: unchurned code-cite page reports fresh"
line_count=$(printf '%s\n' "$output" | grep -c . || true)
if [[ "$line_count" -eq 2 ]]; then
  pass "flat regression fixture: enumeration finds exactly the 2 flat pages (maxdepth-2 recursion is a no-op with no subdir groups)"
else
  fail "flat regression fixture: enumeration finds exactly the 2 flat pages (maxdepth-2 recursion is a no-op with no subdir groups)" "expected 2 output lines, got $line_count: $output"
fi

# ============================================================
echo ""
echo "=== Group 8: maintenance-due basic mechanics ==="
# ============================================================

wt_e="$TMPDIR_ROOT/wt-e"
_git_init_repo "$wt_e"

maint_skill_dir="$wt_e/.claude/skills/stub-maint-basic"
mkdir -p "$maint_skill_dir"
cat > "$wt_e/maint-cited.sh" <<'EOF'
#!/usr/bin/env bash
echo "v1"
EOF
_git_commit "$wt_e" "commit1: maint-cited.sh v1" "2024-02-01T00:00:00"

cat > "$maint_skill_dir/SKILL.md" <<'EOF'
---
name: stub-maint-basic
description: "maintenance-due basic fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$maint_skill_dir/.mditerc"
cat > "$maint_skill_dir/page-one.md" <<'EOF'
---
tags: [x]
summary: "Page One"
code-cites: [maint-cited.sh]
last-verified: "2024-02-15"
---
# Page One
EOF
_git_commit "$wt_e" "commit2: stub-maint-basic skill" "2024-02-02T00:00:00"

# Test: clean wiki (no churn, no ingests since last lint) -> not-due, exit 0
rc=0; output=""
output=$(cd "$wt_e" && bash "$WIKI_HEALTH" maintenance-due stub-maint-basic 2>&1) || rc=$?
assert_exit 0 "$rc" "maintenance-due clean wiki: exit 0 (not due)"
assert_contains "not-due" "$output" "maintenance-due clean wiki: plain output says not-due"

# Test: --json shape has the full required key set, regardless of exit code
json_output=""
json_output=$(cd "$wt_e" && bash "$WIKI_HEALTH" maintenance-due stub-maint-basic --json 2>/dev/null) || true
assert_contains '"due"' "$json_output" "maintenance-due --json: has due key"
assert_contains '"N"' "$json_output" "maintenance-due --json: has N key"
assert_contains '"K"' "$json_output" "maintenance-due --json: has K key"
assert_contains '"correction-cap"' "$json_output" "maintenance-due --json: has correction-cap key"
assert_contains '"large-drift"' "$json_output" "maintenance-due --json: has large-drift key"
assert_contains '"queue"' "$json_output" "maintenance-due --json: has queue key"
assert_contains '"stats"' "$json_output" "maintenance-due --json: has stats key"
if command -v jq &>/dev/null; then
  if printf '%s' "$json_output" | jq . >/dev/null 2>&1; then
    pass "maintenance-due --json: parses via jq"
  else
    fail "maintenance-due --json: parses via jq" "invalid JSON: $json_output"
  fi
fi

# Test: bad skill arg -> exit 2 (the distinct bad-arg code, NOT 1/due)
rc=0; output=""
output=$(cd "$wt_e" && bash "$WIKI_HEALTH" maintenance-due nonexistent-skill-xyz 2>&1) || rc=$?
assert_exit 2 "$rc" "maintenance-due bad skill arg: exit 2, not 1"

# Test: --help prints usage mentioning maintenance-due
rc=0; output=""
output=$(cd "$wt_e" && bash "$WIKI_HEALTH" maintenance-due --help 2>&1) || rc=$?
assert_exit 0 "$rc" "maintenance-due --help: exit 0"
assert_contains "maintenance-due" "$output" "maintenance-due --help: usage mentions maintenance-due"

# Test: unknown flag rejected (argument validation guard)
rc=0; output=""
output=$(cd "$wt_e" && bash "$WIKI_HEALTH" maintenance-due stub-maint-basic --bogus-flag 2>&1) || rc=$?
assert_exit 2 "$rc" "maintenance-due unknown flag: exit 2"

# Test: churning the cited file after the wiki page's last commit -> due, exit 1
cat > "$wt_e/maint-cited.sh" <<'EOF'
#!/usr/bin/env bash
echo "v2"
EOF
_git_commit "$wt_e" "commit3: maint-cited.sh v2 (churn)" "2024-02-03T00:00:00"

rc=0; output=""
output=$(cd "$wt_e" && bash "$WIKI_HEALTH" maintenance-due stub-maint-basic 2>&1) || rc=$?
assert_exit 1 "$rc" "maintenance-due after cited-code churn: exit 1 (due)"
assert_contains "stub-maint-basic: due" "$output" "maintenance-due after churn: plain output says due"

json_output=""
json_output=$(cd "$wt_e" && bash "$WIKI_HEALTH" maintenance-due stub-maint-basic --json 2>/dev/null) || true
assert_contains '"due": true' "$json_output" "maintenance-due after churn --json: due is true"

# Regression: classify's own exit codes are unaffected by the new subcommand
rc=0
(cd "$wt_e" && bash "$WIKI_HEALTH" stub-maint-basic >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "classify exit codes unchanged: stub-maint-basic still classifies healthy (exit 0)"

# Resolver factoring (plan decision PD2): exactly one shared
# _resolve_skill_as_wiki definition; the former _freshness_resolve_skill
# inline copy is gone (no third copy added).
resolver_count=$(grep -c '_resolve_skill_as_wiki()' "$WIKI_HEALTH" || true)
if [[ "$resolver_count" -eq 1 ]]; then
  pass "resolver factoring: exactly one _resolve_skill_as_wiki() definition"
else
  fail "resolver factoring: exactly one _resolve_skill_as_wiki() definition" "found $resolver_count"
fi
if ! grep -q '_freshness_resolve_skill' "$WIKI_HEALTH"; then
  pass "resolver factoring: _freshness_resolve_skill inline copy removed"
else
  fail "resolver factoring: _freshness_resolve_skill inline copy removed" "still present"
fi

# ============================================================
echo ""
echo "=== Group 9: maintenance-due due-condition legs (churn-check, mdite) ==="
# ============================================================

FAKEBIN_E="$wt_e/fakebin"
mkdir -p "$FAKEBIN_E"

mdite_skill_dir="$wt_e/.claude/skills/stub-maint-mdite"
mkdir -p "$mdite_skill_dir"
cat > "$mdite_skill_dir/SKILL.md" <<'EOF'
---
name: stub-maint-mdite
description: "maintenance-due mdite-leg fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$mdite_skill_dir/.mditerc"
cat > "$mdite_skill_dir/page-one.md" <<'EOF'
---
tags: [x]
summary: "Page One"
code-cites: []
---
# Page One
EOF
_git_commit "$wt_e" "commit4: stub-maint-mdite skill" "2024-02-04T00:00:00"

# Shim: fake npx reports findings (mdite's real exit-1-on-findings, remapped
# by the wrapper to exit 0 with stdout forwarded) -> leg (b) hit -> due=true.
cat > "$FAKEBIN_E/npx" <<'EOF'
#!/usr/bin/env bash
echo "dead-link: foo.md -> gone.md"
exit 1
EOF
chmod +x "$FAKEBIN_E/npx"

rc=0; output=""
output=$(cd "$wt_e" && PATH="$SCRIPT_DIR:$FAKEBIN_E:$PATH" bash "$WIKI_HEALTH" maintenance-due stub-maint-mdite 2>&1) || rc=$?
assert_exit 1 "$rc" "maintenance-due mdite findings shim: due=true via leg (b), exit 1"

json_output=""
json_output=$(cd "$wt_e" && PATH="$SCRIPT_DIR:$FAKEBIN_E:$PATH" bash "$WIKI_HEALTH" maintenance-due stub-maint-mdite --json 2>/dev/null) || true
assert_contains '"mdite-available": true' "$json_output" "maintenance-due mdite findings shim: mdite-available true"

# Shim: fake npx fails with empty stdout (EX_UNAVAILABLE) -> leg (b) degrades
# non-fatally; never a false "due" purely from unavailability, and
# large-drift must NOT flip true from the transient outage alone (no other
# unhealthy reason on this fixture).
cat > "$FAKEBIN_E/npx" <<'EOF'
#!/usr/bin/env bash
echo "npm ERR! network failure" >&2
exit 1
EOF
chmod +x "$FAKEBIN_E/npx"

rc=0; json_output=""
json_output=$(cd "$wt_e" && PATH="$SCRIPT_DIR:$FAKEBIN_E:$PATH" bash "$WIKI_HEALTH" maintenance-due stub-maint-mdite --json 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "maintenance-due mdite EX_UNAVAILABLE shim: no crash, not-due (exit 0)"
assert_contains '"mdite-available": false' "$json_output" "maintenance-due mdite EX_UNAVAILABLE shim: mdite-available false"
assert_contains '"large-drift": false' "$json_output" "maintenance-due mdite EX_UNAVAILABLE shim: large-drift NOT falsely tripped by a transient outage alone"

# ============================================================
echo ""
echo "=== Group 10: maintenance-due threshold formulas (N/K clamps) ==="
# ============================================================

wt_f="$TMPDIR_ROOT/wt-f"
_git_init_repo "$wt_f"

# --- 10-page fixture: floor clamp for both N and K ---
small_skill_dir="$wt_f/.claude/skills/stub-maint-small"
mkdir -p "$small_skill_dir"
cat > "$wt_f/small-cited.sh" <<'EOF'
#!/usr/bin/env bash
echo "small"
EOF
_git_commit "$wt_f" "small fixture cited file" "2024-03-01T00:00:00"

{
  cat <<'EOF'
---
name: stub-maint-small
description: "maintenance-due small (10-page) fixture -- floor clamps"
wiki: true
---

## Pages

EOF
  i=1
  while [[ "$i" -le 10 ]]; do
    n=$(printf '%02d' "$i")
    echo "- [Page ${n}](page-${n}.md) — summary"
    i=$((i + 1))
  done
  printf '\n## Meta\n'
} > "$small_skill_dir/SKILL.md"
printf 'entrypoint: SKILL.md\n' > "$small_skill_dir/.mditerc"

i=1
while [[ "$i" -le 10 ]]; do
  n=$(printf '%02d' "$i")
  if [[ "$i" -le 2 ]]; then
    cites="[small-cited.sh]"
  else
    cites="[]"
  fi
  cat > "$small_skill_dir/page-${n}.md" <<PAGEEOF
---
tags: [x]
summary: "Page ${n}"
code-cites: ${cites}
---
# Page ${n}
PAGEEOF
  i=$((i + 1))
done
_git_commit "$wt_f" "small fixture: 10 pages, 2 code-cited" "2024-03-02T00:00:00"

json_output=""
json_output=$(cd "$wt_f" && bash "$WIKI_HEALTH" maintenance-due stub-maint-small --json 2>/dev/null) || true
assert_contains '"N": 5' "$json_output" "maintenance-due 10-page fixture: N clamps to floor 5 (raw 2)"
assert_contains '"K": 5' "$json_output" "maintenance-due 10-page fixture: K clamps to floor 5 (raw 0)"
assert_contains '"pages-total": 10' "$json_output" "maintenance-due 10-page fixture: pages-total is 10"
assert_contains '"pages-code-cited": 2' "$json_output" "maintenance-due 10-page fixture: pages-code-cited is 2"

# --- Large fixture: ceiling clamp for both N and K (130 pages, all cited --
# raw N=32, raw K=26, both exceed their ceilings) ---
large_skill_dir="$wt_f/.claude/skills/stub-maint-large"
mkdir -p "$large_skill_dir"
cat > "$wt_f/large-cited.sh" <<'EOF'
#!/usr/bin/env bash
echo "large"
EOF
_git_commit "$wt_f" "large fixture cited file" "2024-03-03T00:00:00"

{
  cat <<'EOF'
---
name: stub-maint-large
description: "maintenance-due large (130-page) fixture -- ceiling clamps"
wiki: true
---

## Pages

EOF
  i=1
  while [[ "$i" -le 130 ]]; do
    n=$(printf '%03d' "$i")
    echo "- [Page ${n}](page-${n}.md) — summary"
    i=$((i + 1))
  done
  printf '\n## Meta\n'
} > "$large_skill_dir/SKILL.md"
printf 'entrypoint: SKILL.md\n' > "$large_skill_dir/.mditerc"

i=1
while [[ "$i" -le 130 ]]; do
  n=$(printf '%03d' "$i")
  cat > "$large_skill_dir/page-${n}.md" <<PAGEEOF
---
tags: [x]
summary: "Page ${n}"
code-cites: [large-cited.sh]
---
# Page ${n}
PAGEEOF
  i=$((i + 1))
done
_git_commit "$wt_f" "large fixture: 130 pages, all code-cited" "2024-03-04T00:00:00"

json_output=""
json_output=$(cd "$wt_f" && bash "$WIKI_HEALTH" maintenance-due stub-maint-large --json 2>/dev/null) || true
assert_contains '"N": 15' "$json_output" "maintenance-due 130-page fixture: N clamps to ceiling 15 (raw 32)"
assert_contains '"K": 25' "$json_output" "maintenance-due 130-page fixture: K clamps to ceiling 25 (raw 26)"
assert_contains '"correction-cap": 3' "$json_output" "maintenance-due: correction-cap is the fixed default 3"

# ============================================================
echo ""
echo "=== Group 11: maintenance-due verification-queue ordering ==="
# ============================================================

wt_g="$TMPDIR_ROOT/wt-g"
_git_init_repo "$wt_g"

queue_skill_dir="$wt_g/.claude/skills/stub-maint-queue"
mkdir -p "$queue_skill_dir"

cat > "$queue_skill_dir/SKILL.md" <<'EOF'
---
name: stub-maint-queue
description: "maintenance-due verification-queue ordering fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page A](page-a.md) — summary
- [Page B](page-b.md) — summary
- [Page C](page-c.md) — summary
- [Page D](page-d.md) — summary (no last-verified -- sorts by git-age)
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$queue_skill_dir/.mditerc"

# page-d has NO last-verified field; its git commit date (2024-04-05) must
# slot it between page-b (last-verified 2024-04-01, oldest) and page-a
# (last-verified 2024-04-10) in the combined oldest-first queue.
cat > "$queue_skill_dir/page-d.md" <<'EOF'
---
tags: [x]
summary: "Page D"
code-cites: []
---
# Page D (no last-verified)
EOF
_git_commit "$wt_g" "queue fixture: page-d (no last-verified)" "2024-04-05T00:00:00"

cat > "$queue_skill_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
code-cites: []
last-verified: "2024-04-10"
---
# Page A
EOF
cat > "$queue_skill_dir/page-b.md" <<'EOF'
---
tags: [x]
summary: "Page B"
code-cites: []
last-verified: "2024-04-01"
---
# Page B
EOF
cat > "$queue_skill_dir/page-c.md" <<'EOF'
---
tags: [x]
summary: "Page C"
code-cites: []
last-verified: "2024-04-20"
---
# Page C
EOF
_git_commit "$wt_g" "queue fixture: page-a/b/c (varied last-verified)" "2024-04-25T00:00:00"

json_output=""
json_output=$(cd "$wt_g" && bash "$WIKI_HEALTH" maintenance-due stub-maint-queue --json 2>/dev/null) || true
queue_pages=$(printf '%s' "$json_output" | grep -oE '"page":"[^"]*"' | sed -E 's/"page":"//; s/"$//' || true)
expected_order=$'page-b.md\npage-d.md\npage-a.md\npage-c.md'
if [[ "$queue_pages" == "$expected_order" ]]; then
  pass "maintenance-due queue ordering: oldest-last-verified-first, no-last-verified page ordered by git-age"
else
  fail "maintenance-due queue ordering: oldest-last-verified-first, no-last-verified page ordered by git-age" "got: $(printf '%s' "$queue_pages" | tr '\n' ',')"
fi
assert_contains '"last-verified":null' "$json_output" "maintenance-due queue: no-last-verified page emits JSON null (not a false date)"

# Degradation: with mdite shimmed unavailable, the queue still populates
# from the git-only last-verified grep (no false-empty queue) -- queue
# construction never depended on mdite in the first place (see design note
# on _extract_last_verified), so this also regression-guards that design.
FAKEBIN_G="$wt_g/fakebin"
mkdir -p "$FAKEBIN_G"
cat > "$FAKEBIN_G/npx" <<'EOF'
#!/usr/bin/env bash
echo "npm ERR! network failure" >&2
exit 1
EOF
chmod +x "$FAKEBIN_G/npx"

json_output=""
json_output=$(cd "$wt_g" && PATH="$SCRIPT_DIR:$FAKEBIN_G:$PATH" bash "$WIKI_HEALTH" maintenance-due stub-maint-queue --json 2>/dev/null) || true
assert_contains '"mdite-available": false' "$json_output" "maintenance-due queue degradation: mdite-available false under the shim"
queue_pages_degraded=$(printf '%s' "$json_output" | grep -oE '"page":"[^"]*"' | sed -E 's/"page":"//; s/"$//' || true)
if [[ "$queue_pages_degraded" == "$expected_order" ]]; then
  pass "maintenance-due queue degradation: queue still populates (same order) with mdite unavailable"
else
  fail "maintenance-due queue degradation: queue still populates (same order) with mdite unavailable" "got: $(printf '%s' "$queue_pages_degraded" | tr '\n' ',')"
fi
# ============================================================
echo ""
echo "=== Group 13: external md-link cite-set derivation (AD1/AD2/AD4/AD9) ==="
# ============================================================

wt_i="$TMPDIR_ROOT/wt-i"
_git_init_repo "$wt_i"

cat > "$wt_i/external-src.sh" <<'EOF'
#!/usr/bin/env bash
echo "v1"
EOF
_git_commit "$wt_i" "commit1: external-src.sh v1" "2024-03-01T00:00:00"

mdlink_skill_dir="$wt_i/.claude/skills/stub-mdlink-fresh"
mkdir -p "$mdlink_skill_dir"
cat > "$mdlink_skill_dir/SKILL.md" <<'EOF'
---
name: stub-mdlink-fresh
description: "external md-link cite-set derivation fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Link Page](link-page.md) — external md-link only, no code-cites
- [Internal Link Page](internal-link-page.md) — internal-only link
- [Escape Link Page](escape-link-page.md) — link escaping outside project root
- [Misscoped Page](misscoped-page.md) — misscoped code-cite (never in git history)
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$mdlink_skill_dir/.mditerc"

cat > "$mdlink_skill_dir/link-page.md" <<'EOF'
---
tags: [x]
summary: "Link Page"
code-cites: []
---
# Link Page

See [external-src.sh](../../../external-src.sh) for the source.
EOF

cat > "$mdlink_skill_dir/internal-link-page.md" <<'EOF'
---
tags: [x]
summary: "Internal Link Page"
code-cites: []
---
# Internal Link Page

See [Link Page](link-page.md) for details.
EOF

cat > "$mdlink_skill_dir/escape-link-page.md" <<'EOF'
---
tags: [x]
summary: "Escape Link Page"
code-cites: []
---
# Escape Link Page

See [escaped](../../../../../../../../../../../../../../../etc/hostname) for the target.
EOF

cat > "$mdlink_skill_dir/misscoped-page.md" <<'EOF'
---
tags: [x]
summary: "Misscoped Page"
code-cites: [nonexistent-file.sh]
---
# Misscoped Page
EOF
_git_commit "$wt_i" "commit2: stub-mdlink-fresh skill" "2024-03-02T00:00:00"

# Test 1: an external md-link with no code-cites contributes to the cite
# set — an unchurned target resolves fresh, not unknown (proves the link
# entered the set; an empty set would report unknown instead).
rc=0; output=""
output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh link-page --quiet 2>&1) || rc=$?
assert_exit 0 "$rc" "external md-link cite set: link-page freshness exits 0"
assert_contains "link-page	fresh" "$output" "external md-link cite set: external link with no code-cites contributes and resolves fresh (not unknown)"

# Test 4: a page with only an internal link (resolves inside the skill dir)
# has no external cite -> unknown (nothing to verify), per AD2.
rc=0; output=""
output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh internal-link-page --quiet 2>&1) || rc=$?
assert_contains "internal-link-page	unknown" "$output" "internal-only link: excluded from cite set (AD2) -> unknown"

# Test 6: resolve-then-contain — a ../-escaping link that resolves OUTSIDE
# the project root is discarded with no probe (not in the cite set) ->
# unknown, same shape as the internal-only case above. (The link-page case
# above already proves the paired half: a ../-escaping link that resolves
# INSIDE the project root IS in the cite set.)
rc=0; output=""
output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh escape-link-page --quiet 2>&1) || rc=$?
assert_contains "escape-link-page	unknown" "$output" "resolve-then-contain: link escaping project root discarded -> unknown, not fresh/error"

# Test 5: --json output shape is unchanged by the cite-set rework — page/
# status keys still present and correct (wiki-health.sh:66 schema).
json_output=""
json_output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh link-page --json --quiet 2>/dev/null) || true
assert_contains '"page":"link-page"' "$json_output" "external md-link --json: page key present, correct slug"
assert_contains '"status":"fresh"' "$json_output" "external md-link --json: status key present, fresh"

# Test 1 (continued): churn the external target after the page's last
# commit -> --deep confirms a genuine content change -> stale-semantic
# (proves the external-md-link-only cite "can go stale-semantic").
cat > "$wt_i/external-src.sh" <<'EOF'
#!/usr/bin/env bash
echo "v2"
EOF
_git_commit "$wt_i" "commit3: external-src.sh v2 (churn)" "2024-03-03T00:00:00"

rc=0; output=""
output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh link-page --deep --quiet 2>&1) || rc=$?
assert_contains "link-page	stale-semantic" "$output" "external md-link cite set: churned external target confirms stale-semantic in --deep mode"

# Test 2: AD4 false-fresh regression guard — an all-misscoped-cite page
# (never in git history, not on disk) must report stale-semantic in --deep
# mode, NEVER silent fresh (the exact bug class AD4 fixes).
json_output=""
json_output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh misscoped-page --deep --json --quiet 2>/dev/null) || true
assert_contains '"status":"stale-semantic"' "$json_output" "AD4 false-fresh regression guard: misscoped cite --deep reports stale-semantic, never fresh"
assert_not_contains '"status":"fresh"' "$json_output" "AD4 false-fresh regression guard: misscoped cite --deep never reports fresh"

# Test 7 (security regression, iter2 fix): a code-cites value that is
# absolute or ..-escaping must never reach the new Tier-1/Tier-2 filesystem
# or git probes -- otherwise `freshness --deep --json` becomes a
# filesystem existence oracle via the fresh vs stale-semantic status alone
# (security-verifier iter1 high finding). Two fixtures carry the SAME cite
# shape (absolute path) but differ in whether that path actually exists on
# the host; both must report the IDENTICAL status (unknown) -- proving the
# raw value was discarded pre-probe rather than fed into an -e test whose
# result would otherwise leak host-filesystem state.
cat > "$mdlink_skill_dir/existence-oracle-hit.md" <<'EOF'
---
tags: [x]
summary: "Existence-Oracle Guard (absolute path exists on host)"
code-cites: [/etc/hostname]
---
# Existence-Oracle Guard (absolute path exists on host)
EOF

cat > "$mdlink_skill_dir/existence-oracle-miss.md" <<'EOF'
---
tags: [x]
summary: "Existence-Oracle Guard (absolute path does not exist on host)"
code-cites: [/nonexistent-target-xyz123-existence-oracle-guard]
---
# Existence-Oracle Guard (absolute path does not exist on host)
EOF

cat > "$mdlink_skill_dir/dotdot-code-cite.md" <<'EOF'
---
tags: [x]
summary: "Dot-Dot Code-Cite Guard"
code-cites: [../../../../../../../../../../etc/hostname]
---
# Dot-Dot Code-Cite Guard
EOF
_git_commit "$wt_i" "commit4: code-cites existence-oracle guard fixtures" "2024-03-04T00:00:00"

json_output=""
json_output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh existence-oracle-hit --deep --json --quiet 2>/dev/null) || true
assert_contains '"status":"unknown"' "$json_output" "code-cites existence-oracle guard: absolute cite whose host path EXISTS is discarded pre-probe -> unknown"

json_output=""
json_output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh existence-oracle-miss --deep --json --quiet 2>/dev/null) || true
assert_contains '"status":"unknown"' "$json_output" "code-cites existence-oracle guard: absolute cite whose host path is MISSING is discarded pre-probe -> unknown, IDENTICAL to the exists case above (no oracle leak)"

rc=0; output=""
output=$(cd "$wt_i" && bash "$WIKI_HEALTH" freshness stub-mdlink-fresh dotdot-code-cite --deep --quiet 2>&1) || rc=$?
assert_contains "dotdot-code-cite	unknown" "$output" "code-cites existence-oracle guard: ..-escaping cite discarded pre-probe -> unknown"

# Test 3: pages-code-cited recount (K denominator) — a page counts as
# code-cited when it has >=1 EXTERNAL ref, including a link-only page with
# no legacy code-cites field populated. Isolated fixture (2 pages, exactly
# one link-only) for an unambiguous expected count.
wt_j="$TMPDIR_ROOT/wt-j"
_git_init_repo "$wt_j"

cat > "$wt_j/pcc-external.sh" <<'EOF'
#!/usr/bin/env bash
echo "v1"
EOF
_git_commit "$wt_j" "commit1: pcc-external.sh" "2024-03-10T00:00:00"

pcc_skill_dir="$wt_j/.claude/skills/stub-pages-code-cited"
mkdir -p "$pcc_skill_dir"
cat > "$pcc_skill_dir/SKILL.md" <<'EOF'
---
name: stub-pages-code-cited
description: "pages-code-cited recount fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Link Only](link-only.md) — external md-link only, no code-cites
- [Nothing](nothing.md) — no cites of any kind
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$pcc_skill_dir/.mditerc"
cat > "$pcc_skill_dir/link-only.md" <<'EOF'
---
tags: [x]
summary: "Link Only"
code-cites: []
---
# Link Only

See [pcc-external.sh](../../../pcc-external.sh) for the source.
EOF
cat > "$pcc_skill_dir/nothing.md" <<'EOF'
---
tags: [x]
summary: "Nothing"
code-cites: []
---
# Nothing
EOF
_git_commit "$wt_j" "commit2: stub-pages-code-cited skill" "2024-03-11T00:00:00"

json_output=""
json_output=$(cd "$wt_j" && bash "$WIKI_HEALTH" maintenance-due stub-pages-code-cited --json 2>/dev/null) || true
assert_contains '"pages-code-cited": 1' "$json_output" "pages-code-cited recount: link-only page (no code-cites) counts toward K denominator"

# ============================================================
echo ""
echo "=== Group 14: nav-integrity checks (NAV_SUMMARY_MISMATCH / ARCHIVED_STATUS_MISMATCH) ==="
# ============================================================

wt_k="$TMPDIR_ROOT/wt-k"

# --- Healthy fixture: exercises every "must NOT trip" case together ---
# - em-dash-inside-summary: both the summary and its frontmatter counterpart
#   carry their own em-dash; nav-summary parsing must split on the FIRST
#   " — " after the "](page.md)" anchor, not the last, so this still matches.
# - status: captured page sits under ## Pages (not Archived) — a learned-file
#   schema-leak value that must never be confused with status: archived.
# - an ### Archived entry uses the "(archived)" token and correctly carries
#   frontmatter status: archived, with a nav summary that itself contains an
#   em-dash — both must be tolerated without tripping either check.
navhealthy_dir="$wt_k/.claude/skills/stub-nav-healthy"
mkdir -p "$navhealthy_dir"
cat > "$navhealthy_dir/SKILL.md" <<'EOF'
---
name: stub-nav-healthy
description: "nav-integrity healthy fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Em Dash Page](em-dash-page.md) — cache invalidation — a tricky topic worth noting
- [Captured Page](captured-page.md) — a page mid-capture, not yet ingested
<!-- END:PAGES -->

### Archived

<!-- BEGIN:PAGES -->
- [Old Page](old-page.md) (archived) — retired approach — superseded by Em Dash Page
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$navhealthy_dir/.mditerc"
cat > "$navhealthy_dir/em-dash-page.md" <<'EOF'
---
tags: [x]
summary: "cache invalidation — a tricky topic worth noting"
---
# Em Dash Page
EOF
cat > "$navhealthy_dir/captured-page.md" <<'EOF'
---
tags: [x]
status: captured
summary: "a page mid-capture, not yet ingested"
---
# Captured Page
EOF
cat > "$navhealthy_dir/old-page.md" <<'EOF'
---
tags: [x]
status: archived
summary: "retired approach — superseded by Em Dash Page"
---
# Old Page
EOF

rc=0; output=""
output=$(cd "$wt_k" && bash "$WIKI_HEALTH" stub-nav-healthy --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "nav-integrity healthy fixture: exit 0 (healthy)"
assert_not_contains "NAV_SUMMARY_MISMATCH" "$output" "nav-integrity healthy fixture: em-dash-inside-summary match does not trip NAV_SUMMARY_MISMATCH"
assert_not_contains "ARCHIVED_STATUS_MISMATCH" "$output" "nav-integrity healthy fixture: status:captured page and (archived)-token entry do not trip ARCHIVED_STATUS_MISMATCH"

json_output=""
json_output=$(cd "$wt_k" && bash "$WIKI_HEALTH" stub-nav-healthy --json 2>/dev/null) || true
assert_contains '"nav_summary_mismatches"' "$json_output" "nav-integrity healthy fixture: JSON has nav_summary_mismatches field"
assert_contains '"archived_status_mismatches"' "$json_output" "nav-integrity healthy fixture: JSON has archived_status_mismatches field"
assert_not_contains "em-dash-page.md" "$json_output" "nav-integrity healthy fixture: JSON does not list em-dash-page.md as a mismatch"
assert_not_contains "captured-page.md" "$json_output" "nav-integrity healthy fixture: JSON does not list captured-page.md as a mismatch"
assert_not_contains "old-page.md" "$json_output" "nav-integrity healthy fixture: JSON does not list old-page.md as a mismatch"

# --- Locale matrix: the nav separator is an em-dash, so parsing it must not
#     depend on whether awk counts bytes or characters ---
# _wiki_extract_nav_entries locates " — " with index() and then skips past it
# with substr(). Both count bytes when awk runs byte-oriented (LANG/LC_ALL
# unset) and characters otherwise, and the em-dash is 3 bytes but 1 character.
# A hardcoded skip of 3 was correct only in the character case; byte-oriented,
# it landed mid-em-dash and left a stray continuation byte on every parsed
# summary, so every page mismatched its own frontmatter and the entire fleet
# reported unhealthy. The assertions above run under whatever locale the suite
# inherits, which is why they never caught it — these pin both modes.
for _loc_mode in byte char; do
  rc=0; output=""
  if [[ "$_loc_mode" == "byte" ]]; then
    output=$(cd "$wt_k" && env -u LANG -u LC_ALL bash "$WIKI_HEALTH" stub-nav-healthy --verbose 2>&1) || rc=$?
  else
    output=$(cd "$wt_k" && env LANG=C.UTF-8 LC_ALL=C.UTF-8 bash "$WIKI_HEALTH" stub-nav-healthy --verbose 2>&1) || rc=$?
  fi
  assert_exit 0 "$rc" "nav locale matrix (${_loc_mode}): em-dash nav summaries parse to healthy"
  assert_not_contains "NAV_SUMMARY_MISMATCH" "$output" \
    "nav locale matrix (${_loc_mode}): no spurious NAV_SUMMARY_MISMATCH from em-dash separator"
done

# --- Unhealthy fixture: one instance of each "must trip" case ---
# - mismatched-page.md: nav-line summary text does not match frontmatter
#   summary: -> NAV_SUMMARY_MISMATCH.
# - hidden-archived-page.md: frontmatter status: archived, but listed under
#   ## Pages (not ### Archived) -> ARCHIVED_STATUS_MISMATCH (reverse leg).
# - stale-archived-entry.md: listed under ### Archived (with the (archived)
#   token) but its frontmatter carries no status: archived ->
#   ARCHIVED_STATUS_MISMATCH (forward leg). Its own nav summary and
#   frontmatter summary are kept identical so only the archived-status leg
#   trips for this page, keeping each assertion isolated to one cause.
navunhealthy_dir="$wt_k/.claude/skills/stub-nav-unhealthy"
mkdir -p "$navunhealthy_dir"
cat > "$navunhealthy_dir/SKILL.md" <<'EOF'
---
name: stub-nav-unhealthy
description: "nav-integrity unhealthy fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Mismatched Page](mismatched-page.md) — this text does not match the page
- [Hidden Archived Page](hidden-archived-page.md) — should be listed under Archived
<!-- END:PAGES -->

### Archived

<!-- BEGIN:PAGES -->
- [Stale Archived Entry](stale-archived-entry.md) (archived) — never actually marked archived
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$navunhealthy_dir/.mditerc"
cat > "$navunhealthy_dir/mismatched-page.md" <<'EOF'
---
tags: [x]
summary: "Totally different summary text"
---
# Mismatched Page
EOF
cat > "$navunhealthy_dir/hidden-archived-page.md" <<'EOF'
---
tags: [x]
status: archived
summary: "should be listed under Archived"
---
# Hidden Archived Page
EOF
cat > "$navunhealthy_dir/stale-archived-entry.md" <<'EOF'
---
tags: [x]
summary: "never actually marked archived"
---
# Stale Archived Entry
EOF

rc=0; output=""
output=$(cd "$wt_k" && bash "$WIKI_HEALTH" stub-nav-unhealthy --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "nav-integrity unhealthy fixture: exit 5 (unhealthy)"
assert_contains "nav summary does not match frontmatter summary" "$output" "nav-integrity unhealthy fixture: nav-summary mismatch reported"
assert_contains "mismatched-page.md" "$output" "nav-integrity unhealthy fixture: mismatched-page.md named in NAV_SUMMARY_MISMATCH reason"
assert_contains "### Archived" "$output" "nav-integrity unhealthy fixture: archived-status mismatch reported"
assert_contains "hidden-archived-page.md" "$output" "nav-integrity unhealthy fixture: page carrying status:archived but unlisted under Archived is reported"
assert_contains "stale-archived-entry.md" "$output" "nav-integrity unhealthy fixture: Archived-listed entry missing status:archived is reported"

json_output=""
json_output=$(cd "$wt_k" && bash "$WIKI_HEALTH" stub-nav-unhealthy --json 2>/dev/null) || true
assert_contains '"nav_summary_mismatches"' "$json_output" "nav-integrity unhealthy fixture: JSON has nav_summary_mismatches field"
assert_contains "mismatched-page.md" "$json_output" "nav-integrity unhealthy fixture: JSON nav_summary_mismatches lists mismatched-page.md"
assert_contains '"archived_status_mismatches"' "$json_output" "nav-integrity unhealthy fixture: JSON has archived_status_mismatches field"
assert_contains "hidden-archived-page.md" "$json_output" "nav-integrity unhealthy fixture: JSON archived_status_mismatches mentions hidden-archived-page.md"
assert_contains "stale-archived-entry.md" "$json_output" "nav-integrity unhealthy fixture: JSON archived_status_mismatches mentions stale-archived-entry.md"

# Locale matrix, negative half (positive half sits with the healthy fixture
# above): a separator skip that over-corrects would swallow the genuine
# mismatch along with the stray byte, turning this fixture green. Both modes
# must still report it.
for _loc_mode in byte char; do
  rc=0; output=""
  if [[ "$_loc_mode" == "byte" ]]; then
    output=$(cd "$wt_k" && env -u LANG -u LC_ALL bash "$WIKI_HEALTH" stub-nav-unhealthy --verbose 2>&1) || rc=$?
  else
    output=$(cd "$wt_k" && env LANG=C.UTF-8 LC_ALL=C.UTF-8 bash "$WIKI_HEALTH" stub-nav-unhealthy --verbose 2>&1) || rc=$?
  fi
  assert_exit 5 "$rc" "nav locale matrix (${_loc_mode}): genuine nav drift still reports unhealthy"
  assert_contains "mismatched-page.md" "$output" \
    "nav locale matrix (${_loc_mode}): genuine mismatch still names mismatched-page.md"
done

# ============================================================
echo ""
echo "=== Group 15: nav-integrity false positive -- CRLF page + early SKILL.md path references ==="
# ============================================================
#
# Regression guard for a live-fleet defect (cli-expert reported
# NAV_SUMMARY_MISMATCH for 7 byte-identical pages). Root cause turned out to
# be CRLF line endings on the content page, NOT the initially-suspected
# "nav line matched by first path occurrence anywhere in SKILL.md" mechanism
# (that scoping was already correct -- _wiki_extract_nav_entries only reads
# between "## Pages" and the next "## " heading). The real bug: a
# CRLF-terminated frontmatter line leaves \r as the actual last character, so
# "${raw%\"}" in _wiki_page_summary_value / _wiki_page_status_value silently
# no-ops (the trailing quote is never the last char), leaving a residual
# quote (+\r) in the extracted value that never equals the CRLF-free nav
# text parsed from SKILL.md. Both conditions from the original hypothesis
# (early <file path="..."> reference and a prose markdown link before
# "## Pages") are exercised together below since that is the exact shape
# cli-expert's SKILL.md has (its "File Loading Protocol" section) -- proving
# neither, on its own, causes a false positive once the page is CRLF-free.

wt_l="$TMPDIR_ROOT/wt-l"

# --- Healthy fixture: CRLF page + early <file path> and prose-link references ---
navcrlf_dir="$wt_l/.claude/skills/stub-nav-crlf"
mkdir -p "$navcrlf_dir"
cat > "$navcrlf_dir/SKILL.md" <<'EOF'
---
name: stub-nav-crlf
description: "nav-integrity CRLF + early-reference regression fixture"
wiki: true
---

## File Loading Protocol

<loading-decision>
  <file path="early-file-ref.md">
    <load-when>Some condition</load-when>
  </file>
</loading-decision>

See also [Early File Ref](early-file-ref.md) for background.

## Pages

<!-- BEGIN:PAGES -->
- [Early File Ref](early-file-ref.md) — a page referenced earlier via file path and prose link
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$navcrlf_dir/.mditerc"
# CRLF-terminated content page -- written with explicit \r\n via printf so no
# sed -i / dos2unix dependency is needed (Windows/MSYS-safe, per scripts-expert).
printf -- '---\r\ntags: [x]\r\nsummary: "a page referenced earlier via file path and prose link"\r\n---\r\n# Early File Ref\r\n' > "$navcrlf_dir/early-file-ref.md"

rc=0; output=""
output=$(cd "$wt_l" && bash "$WIKI_HEALTH" stub-nav-crlf --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "nav-integrity CRLF fixture: exit 0 (healthy) despite CRLF page + early SKILL.md references"
assert_not_contains "NAV_SUMMARY_MISMATCH" "$output" "nav-integrity CRLF fixture: CRLF page with byte-identical summary does not trip NAV_SUMMARY_MISMATCH"

json_output=""
json_output=$(cd "$wt_l" && bash "$WIKI_HEALTH" stub-nav-crlf --json 2>/dev/null) || true
assert_not_contains "early-file-ref.md" "$json_output" "nav-integrity CRLF fixture: JSON does not list early-file-ref.md as a mismatch of any kind"

# --- True-mismatch guard: same CRLF shape, but nav text now genuinely differs ---
# Confirms the \r-strip fix isn't so permissive that a real mismatch on a
# CRLF page goes undetected.
navcrlfmismatch_dir="$wt_l/.claude/skills/stub-nav-crlf-mismatch"
mkdir -p "$navcrlfmismatch_dir"
cat > "$navcrlfmismatch_dir/SKILL.md" <<'EOF'
---
name: stub-nav-crlf-mismatch
description: "nav-integrity CRLF true-mismatch fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [CRLF Page](crlf-page.md) — this text does not match the page
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$navcrlfmismatch_dir/.mditerc"
printf -- '---\r\ntags: [x]\r\nsummary: "totally different frontmatter text"\r\n---\r\n# CRLF Page\r\n' > "$navcrlfmismatch_dir/crlf-page.md"

rc=0; output=""
output=$(cd "$wt_l" && bash "$WIKI_HEALTH" stub-nav-crlf-mismatch --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "nav-integrity CRLF true-mismatch fixture: exit 5 (unhealthy) -- real mismatch on a CRLF page is still detected"
assert_contains "nav summary does not match frontmatter summary" "$output" "nav-integrity CRLF true-mismatch fixture: NAV_SUMMARY_MISMATCH still reported"
assert_contains "crlf-page.md" "$output" "nav-integrity CRLF true-mismatch fixture: crlf-page.md named in the mismatch reason"

# --- Archived-status parity: CRLF page carrying status: archived ---
# Same \r residual would corrupt _wiki_page_status_value's comparison
# against the literal string "archived" -- guard both directions.
navcrlfarchived_dir="$wt_l/.claude/skills/stub-nav-crlf-archived"
mkdir -p "$navcrlfarchived_dir"
cat > "$navcrlfarchived_dir/SKILL.md" <<'EOF'
---
name: stub-nav-crlf-archived
description: "nav-integrity CRLF archived-status regression fixture"
wiki: true
---

## Pages

### Archived

<!-- BEGIN:PAGES -->
- [CRLF Archived Page](crlf-archived-page.md) (archived) — retired CRLF page
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$navcrlfarchived_dir/.mditerc"
printf -- '---\r\ntags: [x]\r\nstatus: archived\r\nsummary: "retired CRLF page"\r\n---\r\n# CRLF Archived Page\r\n' > "$navcrlfarchived_dir/crlf-archived-page.md"

rc=0; output=""
output=$(cd "$wt_l" && bash "$WIKI_HEALTH" stub-nav-crlf-archived --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "nav-integrity CRLF archived fixture: exit 0 (healthy) -- CRLF status: archived value still exact-matches literal archived"
assert_not_contains "ARCHIVED_STATUS_MISMATCH" "$output" "nav-integrity CRLF archived fixture: CRLF status: archived does not trip ARCHIVED_STATUS_MISMATCH"

json_output=""
json_output=$(cd "$wt_l" && bash "$WIKI_HEALTH" stub-nav-crlf-archived --json 2>/dev/null) || true
assert_not_contains "crlf-archived-page.md" "$json_output" "nav-integrity CRLF archived fixture: JSON does not list crlf-archived-page.md as a mismatch of any kind"

# ============================================================
echo ""
echo "=== Group 16: frontmatter line-1-only detection + fixtures/ census exclusion ==="
# ============================================================
#
# Regression guard for two live-fleet detector gaps surfaced by today's
# fleet migration: (1) every frontmatter parse site in wiki-health.sh
# counted "/^---/" occurrences ANYWHERE in a page, so a body-embedded
# "---"/"summary:"/"---" block (e.g. an illustrative template, the
# sdd-expert examples/add-feature-example.md shape) could be misread as
# real frontmatter -- either false-passing a page with NO real frontmatter
# (MISSING_SUMMARY silently skipped) or, for md-link extraction, silently
# dropping every link above the embedded block. (2) fixtures/ was not
# excluded from the page census, so plan-expert's fixtures/ subdir (commit
# 14f2888) was misread as 19 knowledge pages missing summaries.

wt_m="$TMPDIR_ROOT/wt-m"

# --- (a) No real frontmatter + embedded block mid-body -> MISSING_SUMMARY
# still fires (the embedded block must NOT be read as real frontmatter).
# The nav entry carries no summary text so the (empty-vs-empty) nav/
# frontmatter comparison never trips NAV_SUMMARY_MISMATCH -- this fixture
# isolates the MISSING_SUMMARY assertion from that separate check.
embfmunhealthy_dir="$wt_m/.claude/skills/stub-embedded-fm-unhealthy"
mkdir -p "$embfmunhealthy_dir"
cat > "$embfmunhealthy_dir/SKILL.md" <<'EOF'
---
name: stub-embedded-fm-unhealthy
description: "embedded frontmatter false-pass regression fixture (no real frontmatter)"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [No Frontmatter Page](no-frontmatter-page.md)
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$embfmunhealthy_dir/.mditerc"
cat > "$embfmunhealthy_dir/no-frontmatter-page.md" <<'EOF'
# No Frontmatter Page

Some intro text before the embedded example.

Example config shown below:

---
summary: "a fake summary embedded mid-body, not real frontmatter"
---

More text after the fake block.
EOF

rc=0; output=""
output=$(cd "$wt_m" && bash "$WIKI_HEALTH" stub-embedded-fm-unhealthy --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "embedded frontmatter false-pass: no-real-frontmatter page trips exit 5 (unhealthy)"
assert_contains "missing summary frontmatter field" "$output" "embedded frontmatter false-pass: MISSING_SUMMARY fires for a page with no real frontmatter (embedded block not read as frontmatter)"
assert_contains "no-frontmatter-page.md" "$output" "embedded frontmatter false-pass: no-frontmatter-page.md named in the MISSING_SUMMARY reason"

json_output=""
json_output=$(cd "$wt_m" && bash "$WIKI_HEALTH" stub-embedded-fm-unhealthy --json 2>/dev/null) || true
assert_contains '"missing_summary": ["no-frontmatter-page.md"]' "$json_output" "embedded frontmatter false-pass: JSON missing_summary array lists the page"

# --- (b) Real line-1 frontmatter AND an embedded block later in the body
# -> no false MISSING_SUMMARY, and the REAL summary (not the embedded
# block's fake value) is what the nav-summary comparison uses.
embfmhealthy_dir="$wt_m/.claude/skills/stub-embedded-fm-healthy"
mkdir -p "$embfmhealthy_dir"
cat > "$embfmhealthy_dir/SKILL.md" <<'EOF'
---
name: stub-embedded-fm-healthy
description: "embedded frontmatter regression fixture (real frontmatter wins)"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Real Frontmatter Page](real-frontmatter-page.md) — the real summary for this page
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$embfmhealthy_dir/.mditerc"
cat > "$embfmhealthy_dir/real-frontmatter-page.md" <<'EOF'
---
tags: [x]
summary: "the real summary for this page"
---
# Real Frontmatter Page

Example config shown below:

---
summary: "a fake summary embedded mid-body, must not be used"
---

More text after the fake block.
EOF

rc=0; output=""
output=$(cd "$wt_m" && bash "$WIKI_HEALTH" stub-embedded-fm-healthy --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "embedded frontmatter real-wins: page with real frontmatter + embedded block is healthy (exit 0)"
assert_not_contains "missing summary frontmatter field" "$output" "embedded frontmatter real-wins: MISSING_SUMMARY does not false-fire when real frontmatter is present"
assert_not_contains "nav summary does not match frontmatter summary" "$output" "embedded frontmatter real-wins: NAV_SUMMARY_MISMATCH does not false-fire -- the real summary, not the embedded block's fake value, is compared"

# --- (c) md-link extraction from a no-frontmatter file whose body contains
# a "---" line -> links ABOVE that line must still be extracted (the
# drop-everything-above bug: the old code skipped every line until the
# SECOND "---" occurrence, even lines before the first one).
wt_n="$TMPDIR_ROOT/wt-n"
_git_init_repo "$wt_n"

cat > "$wt_n/embedded-mdlink-external.sh" <<'EOF'
#!/usr/bin/env bash
echo "v1"
EOF
_git_commit "$wt_n" "commit1: embedded-mdlink-external.sh v1" "2024-04-01T00:00:00"

embmdlink_dir="$wt_n/.claude/skills/stub-embedded-mdlink"
mkdir -p "$embmdlink_dir"
cat > "$embmdlink_dir/SKILL.md" <<'EOF'
---
name: stub-embedded-mdlink
description: "embedded frontmatter md-link extraction regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Embedded Link Page](embedded-link-page.md) — link above an embedded fake frontmatter block
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$embmdlink_dir/.mditerc"
cat > "$embmdlink_dir/embedded-link-page.md" <<'EOF'
See [embedded-mdlink-external.sh](../../../embedded-mdlink-external.sh) for the source.

---
fake: "an embedded block that must not swallow the link above it"
---

More text after the fake block.
EOF
_git_commit "$wt_n" "commit2: stub-embedded-mdlink skill" "2024-04-02T00:00:00"

rc=0; output=""
output=$(cd "$wt_n" && bash "$WIKI_HEALTH" freshness stub-embedded-mdlink embedded-link-page --quiet 2>&1) || rc=$?
assert_exit 0 "$rc" "embedded frontmatter md-link extraction: freshness exits 0"
assert_contains "embedded-link-page	fresh" "$output" "embedded frontmatter md-link extraction: link ABOVE the embedded '---' line is still extracted and resolves fresh (not unknown)"

# --- (d) A fixtures/ subdir of bare .md files must be excluded from the
# page census entirely -- no MISSING_SUMMARY, no ORPHAN_PAGE, and
# pages-total unchanged (counts only the one real knowledge page).
wt_o="$TMPDIR_ROOT/wt-o"

fixcensus_dir="$wt_o/.claude/skills/stub-fixtures-census"
mkdir -p "$fixcensus_dir/fixtures"
cat > "$fixcensus_dir/SKILL.md" <<'EOF'
---
name: stub-fixtures-census
description: "fixtures/ census exclusion regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Real Page](real-page.md) — the only real knowledge page in this skill
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fixcensus_dir/.mditerc"
cat > "$fixcensus_dir/real-page.md" <<'EOF'
---
tags: [x]
summary: "the only real knowledge page in this skill"
---
# Real Page
EOF
cat > "$fixcensus_dir/fixtures/bare-one.md" <<'EOF'
# Bare Fixture One

Just a bare markdown fixture file with no frontmatter.
EOF
cat > "$fixcensus_dir/fixtures/bare-two.md" <<'EOF'
# Bare Fixture Two

Another bare markdown fixture file with no frontmatter.
EOF

rc=0; output=""
output=$(cd "$wt_o" && bash "$WIKI_HEALTH" stub-fixtures-census --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "fixtures/ census exclusion: skill with a fixtures/ subdir of bare .md files is healthy (exit 0)"
assert_not_contains "missing summary frontmatter field" "$output" "fixtures/ census exclusion: fixtures/ files do not trip MISSING_SUMMARY"
assert_not_contains "not reachable from SKILL.md ## Pages" "$output" "fixtures/ census exclusion: fixtures/ files do not trip ORPHAN_PAGE"

json_output=""
json_output=$(cd "$wt_o" && bash "$WIKI_HEALTH" stub-fixtures-census --json 2>/dev/null) || true
assert_contains '"total": 1' "$json_output" "fixtures/ census exclusion: pages-total counts only the one real page (fixtures/ excluded)"
assert_not_contains "bare-one.md" "$json_output" "fixtures/ census exclusion: JSON never mentions fixtures/bare-one.md"
assert_not_contains "bare-two.md" "$json_output" "fixtures/ census exclusion: JSON never mentions fixtures/bare-two.md"

# ============================================================
echo ""
echo "=== Group 17: .mditerc exclude: census filtering ==="
# ============================================================
#
# Per-wiki census exclusion via .mditerc's exclude: field (wiki-health-
# mditerc-exclude). All fixtures below add an extra file that would
# otherwise trip MISSING_SUMMARY (no frontmatter) and/or ORPHAN_PAGE (not
# listed in ## Pages) — excluding it via .mditerc must make the skill
# healthy again, drop the file from pages-total, and never mention it in
# verbose/JSON output. Non-matching and absent-field fixtures verify the
# feature is a no-op unless a pattern actually hits.

wt_p="$TMPDIR_ROOT/wt-p"

# --- (a) exact-path exclude (block-style .mditerc) drops the file from
# census entirely: no MISSING_SUMMARY, no ORPHAN_PAGE, pages-total
# decremented, and the excluded-by-mditerc visibility count fires. ---
exact_dir="$wt_p/.claude/skills/stub-mditerc-exclude-exact"
mkdir -p "$exact_dir"
cat > "$exact_dir/SKILL.md" <<'EOF'
---
name: stub-mditerc-exclude-exact
description: "exact-path .mditerc exclude regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page A](page-a.md) — Page A
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\nexclude:\n  - bad.md\n' > "$exact_dir/.mditerc"
cat > "$exact_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
---
# Page A
EOF
cat > "$exact_dir/bad.md" <<'EOF'
# Bad Page (no frontmatter, unlisted — would trip MISSING_SUMMARY + ORPHAN_PAGE)
EOF

rc=0; output=""
output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-exact --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "exact-path exclude: skill is healthy (exit 0) once the offending file is excluded"
assert_not_contains "bad.md" "$output" "exact-path exclude: bad.md never mentioned in verbose output"
assert_contains "excluded-by-mditerc: 1" "$output" "exact-path exclude: visibility count reports 1 excluded file"

json_output=""
json_output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-exact --json 2>/dev/null) || true
assert_contains '"total": 1' "$json_output" "exact-path exclude: JSON pages-total counts only page-a.md"
assert_contains '"excluded_by_mditerc": 1' "$json_output" "exact-path exclude: JSON excluded_by_mditerc is 1"
assert_not_contains "bad.md" "$json_output" "exact-path exclude: JSON never mentions bad.md"

# --- (b) trailing "/**" directory-prefix exclude drops every file under the
# directory (two files here), and the visibility count reflects both. ---
prefix_dir="$wt_p/.claude/skills/stub-mditerc-exclude-prefix"
mkdir -p "$prefix_dir/junk"
cat > "$prefix_dir/SKILL.md" <<'EOF'
---
name: stub-mditerc-exclude-prefix
description: "dir/** .mditerc exclude regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page A](page-a.md) — Page A
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\nexclude:\n  - junk/**\n' > "$prefix_dir/.mditerc"
cat > "$prefix_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
---
# Page A
EOF
cat > "$prefix_dir/junk/one.md" <<'EOF'
# Junk One (no frontmatter, unlisted)
EOF
cat > "$prefix_dir/junk/two.md" <<'EOF'
# Junk Two (no frontmatter, unlisted)
EOF

rc=0; output=""
output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-prefix --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "dir/** prefix exclude: skill is healthy (exit 0) once junk/ is excluded"
assert_not_contains "junk" "$output" "dir/** prefix exclude: junk/ files never mentioned in verbose output"
assert_contains "excluded-by-mditerc: 2" "$output" "dir/** prefix exclude: visibility count reports both junk/ files excluded"

json_output=""
json_output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-prefix --json 2>/dev/null) || true
assert_contains '"total": 1' "$json_output" "dir/** prefix exclude: JSON pages-total counts only page-a.md"
assert_contains '"excluded_by_mditerc": 2' "$json_output" "dir/** prefix exclude: JSON excluded_by_mditerc is 2"

# --- (c) a non-matching pattern excludes nothing — the offending file still
# trips MISSING_SUMMARY/ORPHAN_PAGE, and the visibility count stays silent
# (zero-exclusion runs never print the line). ---
nomatch_dir="$wt_p/.claude/skills/stub-mditerc-exclude-nomatch"
mkdir -p "$nomatch_dir"
cat > "$nomatch_dir/SKILL.md" <<'EOF'
---
name: stub-mditerc-exclude-nomatch
description: "non-matching .mditerc exclude pattern regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page A](page-a.md) — Page A
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\nexclude:\n  - nomatch-nothing.md\n' > "$nomatch_dir/.mditerc"
cat > "$nomatch_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
---
# Page A
EOF
cat > "$nomatch_dir/bad.md" <<'EOF'
# Bad Page (no frontmatter, unlisted — pattern does not match this file)
EOF

rc=0; output=""
output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-nomatch --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "non-matching exclude pattern: skill is still unhealthy (exit 5) — pattern excludes nothing"
assert_contains "bad.md" "$output" "non-matching exclude pattern: bad.md is still reported"
assert_not_contains "excluded-by-mditerc" "$output" "non-matching exclude pattern: visibility count stays silent (zero exclusions)"

json_output=""
json_output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-nomatch --json 2>/dev/null) || true
assert_contains '"excluded_by_mditerc": 0' "$json_output" "non-matching exclude pattern: JSON excluded_by_mditerc is 0"

# --- (d) absent exclude: field is a no-op — behavior identical to before
# this feature existed (offending file still reported, count stays 0). ---
absent_dir="$wt_p/.claude/skills/stub-mditerc-exclude-absent"
mkdir -p "$absent_dir"
cat > "$absent_dir/SKILL.md" <<'EOF'
---
name: stub-mditerc-exclude-absent
description: "absent .mditerc exclude field regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page A](page-a.md) — Page A
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$absent_dir/.mditerc"
cat > "$absent_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
---
# Page A
EOF
cat > "$absent_dir/bad.md" <<'EOF'
# Bad Page (no frontmatter, unlisted)
EOF

rc=0; output=""
output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-absent --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "absent exclude field: skill is still unhealthy (exit 5) — no behavior change"
assert_contains "bad.md" "$output" "absent exclude field: bad.md is still reported"
assert_not_contains "excluded-by-mditerc" "$output" "absent exclude field: visibility count stays silent"

json_output=""
json_output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-absent --json 2>/dev/null) || true
assert_contains '"excluded_by_mditerc": 0' "$json_output" "absent exclude field: JSON excluded_by_mditerc is 0"

# --- (f) flow-style .mditerc ("exclude: [a]") parses the same as
# block-style — reuses the exact-match scenario in flow-list form. ---
flow_dir="$wt_p/.claude/skills/stub-mditerc-exclude-flow"
mkdir -p "$flow_dir"
cat > "$flow_dir/SKILL.md" <<'EOF'
---
name: stub-mditerc-exclude-flow
description: "flow-style .mditerc exclude regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page A](page-a.md) — Page A
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\nexclude: [bad.md]\n' > "$flow_dir/.mditerc"
cat > "$flow_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
---
# Page A
EOF
cat > "$flow_dir/bad.md" <<'EOF'
# Bad Page (no frontmatter, unlisted)
EOF

rc=0; output=""
output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-flow --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "flow-style exclude: skill is healthy (exit 0) — flow-style [a] parses same as block-style"
assert_not_contains "bad.md" "$output" "flow-style exclude: bad.md never mentioned in verbose output"
assert_contains "excluded-by-mditerc: 1" "$output" "flow-style exclude: visibility count reports 1 excluded file"

# --- (g) a CRLF .mditerc parses identically to LF (same strip convention as
# the existing entrypoint check). ---
crlf_dir="$wt_p/.claude/skills/stub-mditerc-exclude-crlf"
mkdir -p "$crlf_dir"
cat > "$crlf_dir/SKILL.md" <<'EOF'
---
name: stub-mditerc-exclude-crlf
description: "CRLF .mditerc exclude regression fixture"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page A](page-a.md) — Page A
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\r\nexclude:\r\n  - bad.md\r\n' > "$crlf_dir/.mditerc"
cat > "$crlf_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
---
# Page A
EOF
cat > "$crlf_dir/bad.md" <<'EOF'
# Bad Page (no frontmatter, unlisted)
EOF

rc=0; output=""
output=$(cd "$wt_p" && bash "$WIKI_HEALTH" stub-mditerc-exclude-crlf --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "CRLF .mditerc exclude: skill is healthy (exit 0) — CRLF line endings parse correctly"
assert_not_contains "bad.md" "$output" "CRLF .mditerc exclude: bad.md never mentioned in verbose output"
assert_contains "excluded-by-mditerc: 1" "$output" "CRLF .mditerc exclude: visibility count reports 1 excluded file"

# ============================================================
echo ""
echo "=== Group 19: FORBIDDEN_UPDATED_FIELD mechanical check ==="
# ============================================================
#
# Regression guard for the wiki-write-guard-invariant sweep: an `updated:`
# frontmatter field is forbidden fleet-wide (staleness is tracked via git
# log/mtime, never a YAML field -- SKILL.md's own doctrine) but was only
# ever enforced by protocols/lint.md's LLM-applied check, scoped to
# SKILL.md/log.md/schema.md and never actually run against ordinary
# knowledge pages -- the exact gap that let ~33 pages across 5 domains
# drift with a stray `updated:` line before this check existed. These
# fixtures cover: (a) an ordinary page carrying the field, (b) SKILL.md
# itself carrying it (the pre-existing meta-file scope, now mechanical),
# (c) a page with the legitimate `last-verified:` field does NOT false-fire,
# and (d) a body-embedded fake `updated:` block does NOT false-fire (same
# NR==1 frontmatter-only guard as MISSING_SUMMARY).

# --- (a) Ordinary knowledge page carrying `updated:` in real frontmatter.
wt_r="$TMPDIR_ROOT/wt-r"

fu_page_dir="$wt_r/.claude/skills/stub-forbidden-updated-page"
mkdir -p "$fu_page_dir"
cat > "$fu_page_dir/SKILL.md" <<'EOF'
---
name: stub-forbidden-updated-page
description: "forbidden updated: field regression fixture (ordinary page)"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Violation Page](violation-page.md) — carries a forbidden updated: field
- [Clean Page](clean-page.md) — carries the legitimate last-verified: field instead
- [Embedded Fake Page](embedded-fake-page.md) — no real frontmatter, fake block mid-body
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fu_page_dir/.mditerc"
cat > "$fu_page_dir/violation-page.md" <<'EOF'
---
tags: [x]
updated: 2026-04-08
summary: "carries a forbidden updated: field"
---
# Violation Page
EOF
cat > "$fu_page_dir/clean-page.md" <<'EOF'
---
tags: [x]
summary: "carries the legitimate last-verified: field instead"
last-verified: "2026-07-01"
---
# Clean Page
EOF
cat > "$fu_page_dir/embedded-fake-page.md" <<'EOF'
# Embedded Fake Page

carries a forbidden updated: field is not real frontmatter here.

Example config shown below:

---
updated: 2026-01-01
---

More text after the fake block.
EOF

rc=0; output=""
output=$(cd "$wt_r" && bash "$WIKI_HEALTH" stub-forbidden-updated-page --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "FORBIDDEN_UPDATED_FIELD ordinary page: trips exit 5 (unhealthy)"
assert_contains "carries a forbidden updated: frontmatter field" "$output" "FORBIDDEN_UPDATED_FIELD ordinary page: reason text fires"
assert_contains "violation-page.md" "$output" "FORBIDDEN_UPDATED_FIELD ordinary page: violation-page.md named in the reason"

json_output=""
json_output=$(cd "$wt_r" && bash "$WIKI_HEALTH" stub-forbidden-updated-page --json 2>/dev/null) || true
assert_contains '"forbidden_updated_field": ["violation-page.md"]' "$json_output" "FORBIDDEN_UPDATED_FIELD ordinary page: JSON array lists exactly the one real-frontmatter violator"
assert_not_contains "clean-page.md\"]" "$json_output" "FORBIDDEN_UPDATED_FIELD ordinary page: last-verified page does NOT false-fire"

# --- (b) SKILL.md itself carrying `updated:` -- the pre-existing meta-file
# scope from protocols/lint.md, now covered mechanically too.
wt_s="$TMPDIR_ROOT/wt-s"

fu_meta_dir="$wt_s/.claude/skills/stub-forbidden-updated-meta"
mkdir -p "$fu_meta_dir"
cat > "$fu_meta_dir/SKILL.md" <<'EOF'
---
name: stub-forbidden-updated-meta
description: "forbidden updated: field regression fixture (SKILL.md itself)"
updated: 2026-04-24
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Clean Page](clean-page.md) — an ordinary page with no violation
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fu_meta_dir/.mditerc"
cat > "$fu_meta_dir/clean-page.md" <<'EOF'
---
tags: [x]
summary: "an ordinary page with no violation"
---
# Clean Page
EOF

rc=0; output=""
output=$(cd "$wt_s" && bash "$WIKI_HEALTH" stub-forbidden-updated-meta --verbose 2>&1) || rc=$?
assert_exit 5 "$rc" "FORBIDDEN_UPDATED_FIELD SKILL.md: trips exit 5 (unhealthy)"
assert_contains "carries a forbidden updated: frontmatter field" "$output" "FORBIDDEN_UPDATED_FIELD SKILL.md: reason text fires"
assert_contains "page SKILL.md carries" "$output" "FORBIDDEN_UPDATED_FIELD SKILL.md: SKILL.md itself named in the reason"

json_output=""
json_output=$(cd "$wt_s" && bash "$WIKI_HEALTH" stub-forbidden-updated-meta --json 2>/dev/null) || true
assert_contains '"forbidden_updated_field": ["SKILL.md"]' "$json_output" "FORBIDDEN_UPDATED_FIELD SKILL.md: JSON array lists SKILL.md"

# --- (c) A fully clean skill (last-verified: only, no updated: anywhere)
# stays healthy once the check is active -- the fleet-wide "must not flip a
# currently-healthy domain unhealthy" acceptance bar for this sweep.
wt_t="$TMPDIR_ROOT/wt-t"

fu_ok_dir="$wt_t/.claude/skills/stub-forbidden-updated-ok"
mkdir -p "$fu_ok_dir"
cat > "$fu_ok_dir/SKILL.md" <<'EOF'
---
name: stub-forbidden-updated-ok
description: "forbidden updated: field regression fixture (fully clean)"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Clean Page](clean-page.md) — carries last-verified, never updated
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fu_ok_dir/.mditerc"
cat > "$fu_ok_dir/clean-page.md" <<'EOF'
---
tags: [x]
summary: "carries last-verified, never updated"
last-verified: "2026-07-01"
---
# Clean Page
EOF

rc=0; output=""
output=$(cd "$wt_t" && bash "$WIKI_HEALTH" stub-forbidden-updated-ok --verbose 2>&1) || rc=$?
assert_exit 0 "$rc" "FORBIDDEN_UPDATED_FIELD fully-clean fixture: stays healthy (exit 0) once the check is active"
assert_not_contains "forbidden updated:" "$output" "FORBIDDEN_UPDATED_FIELD fully-clean fixture: no false-fire anywhere"

# ============================================================
echo ""
echo "=== Group 20: --all --full honors deep-audit findings fleet-wide ==="
# ============================================================
#
# Regression guard for issue wiki-health-all-silently-drops-full: --full was
# accepted by the arg parser for --all but the deep-audit gate lived only in
# the single-skill branch, so `wiki-health --all --full` silently ran a
# shallow sweep and reported a domain "healthy" that `wiki-health <skill>
# --full` reported "partial-migration" for the exact same fixture. These
# fixtures cover both required correctness properties: --full must actually
# be honored inside the --all loop (a), AND DEEP_CROSS_REFS /
# DEEP_GROUP_AFFINITY must be reset per skill so one domain's findings do
# not bleed into the next domain's verdict in the same sweep (b).

wt_u="$TMPDIR_ROOT/wt-u"

# --- (a) stub-full-all-a-dirty: healthy base state (summary present on both
# pages, unlike Group 5's stub-full-unhealthy), but two pages share a topic
# tag/prose term ("shared-topic") without cross-linking each other -- the
# same Step 5b signal Group 5 uses, reused per this step's dispatch guidance
# rather than inventing a new fixture style. Sorts alphabetically BEFORE
# stub-full-all-b-clean below, so it is classified first in the --all loop --
# required for (b) to actually exercise the reset instead of trivially
# passing because the clean skill happened to run first.
dirty_dir="$wt_u/.claude/skills/stub-full-all-a-dirty"
mkdir -p "$dirty_dir"
cat > "$dirty_dir/SKILL.md" <<'EOF'
---
name: stub-full-all-a-dirty
description: "--all --full fleet fixture: cross-link findings present"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$dirty_dir/.mditerc"
cat > "$dirty_dir/page-one.md" <<'EOF'
---
tags: [foo, shared-topic]
summary: "Page One"
code-cites: []
---
# Page One

Some content about shared-topic.
EOF
cat > "$dirty_dir/page-two.md" <<'EOF'
---
tags: [bar, shared-topic]
summary: "Page Two"
code-cites: []
---
# Page Two

More info about shared-topic.
EOF

# --- (b) stub-full-all-b-clean: single unrelated page, no shared tags or
# topics with anything -- zero cross-link candidate pairs of its own. If
# DEEP_CROSS_REFS / DEEP_GROUP_AFFINITY are not reset per skill inside the
# --all loop, this skill would inherit a-dirty's leftover findings and be
# wrongly downgraded too.
clean_dir="$wt_u/.claude/skills/stub-full-all-b-clean"
mkdir -p "$clean_dir"
cat > "$clean_dir/SKILL.md" <<'EOF'
---
name: stub-full-all-b-clean
description: "--all --full fleet fixture: no cross-link candidates, must stay healthy"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Solo Page](solo-page.md) — Solo Page
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$clean_dir/.mditerc"
cat > "$clean_dir/solo-page.md" <<'EOF'
---
tags: [unrelated]
summary: "Solo Page"
code-cites: []
---
# Solo Page

Nothing to see here.
EOF

# Test 5 (checked first, as the "before" baseline): plain --all is
# unchanged on this fixture -- both skills report healthy, exit 0.
rc_plain=0; plain_all_output=""
plain_all_output=$(cd "$wt_u" && bash "$WIKI_HEALTH" --all 2>/dev/null) || rc_plain=$?
assert_exit 0 "$rc_plain" "--all --full fleet fixture: plain --all (no --full) exits 0 -- both fixtures are healthy at the base-state level"
plain_a_line="$(printf '%s\n' "$plain_all_output" | grep '^stub-full-all-a-dirty' || true)"
plain_b_line="$(printf '%s\n' "$plain_all_output" | grep '^stub-full-all-b-clean' || true)"
assert_contains " healthy " "$plain_a_line" "--all --full fleet fixture: plain --all reports a-dirty healthy (deep audit never runs without --full)"
assert_contains " healthy " "$plain_b_line" "--all --full fleet fixture: plain --all reports b-clean healthy"

# Test 1: --all --full reports non-healthy for a-dirty where plain --all
# reported healthy -- the exact regression, asserted as a disagreement
# between the two invocations rather than just checking one side.
rc_full=0; full_all_output=""
full_all_output=$(cd "$wt_u" && bash "$WIKI_HEALTH" --all --full 2>/dev/null) || rc_full=$?
full_a_line="$(printf '%s\n' "$full_all_output" | grep '^stub-full-all-a-dirty' || true)"
full_b_line="$(printf '%s\n' "$full_all_output" | grep '^stub-full-all-b-clean' || true)"
assert_contains "partial-migration" "$full_a_line" "--all --full fleet fixture: --all --full downgrades a-dirty to partial-migration"
assert_not_contains "partial-migration" "$plain_a_line" "--all --full fleet fixture: plain --all and --all --full DISAGREE on a-dirty -- proves --full was previously silently dropped by --all"
assert_contains "cross-reference" "$full_a_line" "--all --full fleet fixture: a-dirty's primary-reason column names the cross-link finding"

# Test 2: exit code is 6 -- the deep audit alone is what makes the sweep
# non-healthy (both fixtures pass base-state classification on their own).
assert_exit 6 "$rc_full" "--all --full fleet fixture: --all --full exits 6 -- deep-audit downgrade alone drives the sweep exit code"

# Test 4: no finding bleed -- b-clean (processed second, alphabetically
# after a-dirty) still reports healthy in the SAME --all --full sweep that
# downgraded a-dirty. This is the regression test for the per-skill
# DEEP_CROSS_REFS / DEEP_GROUP_AFFINITY reset.
assert_contains " healthy " "$full_b_line" "--all --full fleet fixture: b-clean stays healthy in the same --all --full sweep that downgraded a-dirty -- no finding bleed across skills"
assert_not_contains "partial-migration" "$full_b_line" "--all --full fleet fixture: b-clean does NOT inherit a-dirty's MISSING_CROSS_LINKS downgrade"

# Test 3: --all --full --json emits a deep_audit object per entry (2 of 2).
rc=0; json_full_all=""
json_full_all=$(cd "$wt_u" && bash "$WIKI_HEALTH" --all --full --json 2>/dev/null) || rc=$?
assert_exit 6 "$rc" "--all --full fleet fixture: --all --full --json also exits 6 (JSON branch honors --full identically to the table branch)"
deep_audit_count="$(grep -c '"deep_audit"' <<<"$json_full_all" || true)"
if [[ "$deep_audit_count" -eq 2 ]]; then
  pass "--all --full fleet fixture: --all --full --json emits deep_audit for both fleet entries (2 of 2)"
else
  fail "--all --full fleet fixture: --all --full --json emits deep_audit for both fleet entries (2 of 2)" "found $deep_audit_count deep_audit object(s), expected 2"
fi
if command -v jq &>/dev/null; then
  if printf '%s' "$json_full_all" | jq . >/dev/null 2>&1; then
    pass "--all --full fleet fixture: --all --full --json parses via jq"
  else
    fail "--all --full fleet fixture: --all --full --json parses via jq" "invalid JSON: $json_full_all"
  fi
  dirty_cross_ref_count="$(printf '%s' "$json_full_all" | jq '[.[] | select(.skill=="stub-full-all-a-dirty")][0].deep_audit.cross_references | length')"
  if [[ "$dirty_cross_ref_count" -gt 0 ]]; then
    pass "--all --full fleet fixture: a-dirty's JSON deep_audit.cross_references is non-empty"
  else
    fail "--all --full fleet fixture: a-dirty's JSON deep_audit.cross_references is non-empty" "got $dirty_cross_ref_count entries"
  fi
  clean_cross_ref_count="$(printf '%s' "$json_full_all" | jq '[.[] | select(.skill=="stub-full-all-b-clean")][0].deep_audit.cross_references | length')"
  if [[ "$clean_cross_ref_count" -eq 0 ]]; then
    pass "--all --full fleet fixture: b-clean's JSON deep_audit.cross_references is empty -- confirms no bleed at the JSON level too"
  else
    fail "--all --full fleet fixture: b-clean's JSON deep_audit.cross_references is empty -- confirms no bleed at the JSON level too" "got $clean_cross_ref_count entries, expected 0"
  fi
fi

# ============================================================
echo ""
echo "=== Group 21: fence-scan bullet-run detection and subcommand contract ==="
# ============================================================
#
# Discharges CLI checklist items 6 (unit tests: argument parsing, core
# logic, output formatting) and 7 (integration tests: real binary, real
# arguments) for step 02's fence-scan subcommand and its underlying
# _wiki_pages_bullet_runs detector -- both already committed and verifier-
# approved; this group tests them, it does not change them. Grammar
# reference: claude-code-ref-expert/marker-fenced-regions-convention.md
# (the bullet-run grammar table is normative there).
#
# Five fixture domains, each exercising a distinct grammar cell:
#   fence-flat            -- one flat unfenced run of 3 bullets (baseline)
#   fence-subsectioned    -- 3 sub-headings plus an interior blank-line
#                            split; must yield 4 runs, not 3 -- the cell
#                            the fleet census (M3) did not measure (6 real
#                            domains carry this shape)
#   fence-archived        -- ### Archived sub-section forms its own run,
#                            distinct from the active run above it
#   fence-trailing-rule   -- trailing --- thematic break after the last
#                            bullet (C10); the run must end at the last
#                            bullet, never at the blank line or the rule
#   fence-already-fenced  -- same bullets as fence-flat, already wrapped
#                            in BEGIN:PAGES/END:PAGES (C4 idempotency
#                            signal: every emitted record is fenced=1)

wt_v="$TMPDIR_ROOT/wt-v"

fence_flat_dir="$wt_v/.claude/skills/fence-flat"
mkdir -p "$fence_flat_dir"
cat > "$fence_flat_dir/SKILL.md" <<'EOF'
---
name: fence-flat
description: "fence-scan fixture: flat ## Pages, one unfenced run of 3 bullets"
wiki: true
---

## Pages

- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two
- [Page Three](page-three.md) — Page Three

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fence_flat_dir/.mditerc"

fence_sub_dir="$wt_v/.claude/skills/fence-subsectioned"
mkdir -p "$fence_sub_dir"
cat > "$fence_sub_dir/SKILL.md" <<'EOF'
---
name: fence-subsectioned
description: "fence-scan fixture: sub-sectioned Pages with 3 sub-headings and an interior blank-line split -- must yield 4 runs, not 3"
wiki: true
---

## Pages

### Topic Areas

- [Topic A](topic-a.md) — Topic A
- [Topic B](topic-b.md) — Topic B

### Reference Pages

- [Ref One](ref-one.md) — Ref One

### Standalone Pages

- [Standalone A](standalone-a.md) — Standalone A

- [Standalone B](standalone-b.md) — Standalone B

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fence_sub_dir/.mditerc"

fence_archived_dir="$wt_v/.claude/skills/fence-archived"
mkdir -p "$fence_archived_dir"
cat > "$fence_archived_dir/SKILL.md" <<'EOF'
---
name: fence-archived
description: "fence-scan fixture: ## Pages with an ### Archived sub-section carrying an (archived)-suffixed entry"
wiki: true
---

## Pages

- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two

### Archived

- [Old Page](old-page.md) (archived) — superseded by Page One

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fence_archived_dir/.mditerc"

fence_trailing_dir="$wt_v/.claude/skills/fence-trailing-rule"
mkdir -p "$fence_trailing_dir"
cat > "$fence_trailing_dir/SKILL.md" <<'EOF'
---
name: fence-trailing-rule
description: "fence-scan fixture: flat ## Pages with a trailing --- thematic break after the last bullet (C10 shape)"
wiki: true
---

## Pages

- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two

---

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fence_trailing_dir/.mditerc"

fence_fenced_dir="$wt_v/.claude/skills/fence-already-fenced"
mkdir -p "$fence_fenced_dir"
cat > "$fence_fenced_dir/SKILL.md" <<'EOF'
---
name: fence-already-fenced
description: "fence-scan fixture: same content as fence-flat but already carrying BEGIN:PAGES/END:PAGES markers (C4 idempotency signal)"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two
- [Page Three](page-three.md) — Page Three
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$fence_fenced_dir/.mditerc"

# --- Assertion 1: fence-flat exits 1 with exactly one unfenced run line.
rc=0; flat_output=""
flat_output=$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-flat 2>/dev/null) || rc=$?
flat_line_count="$(wc -l <<< "$flat_output")"
if [[ "$rc" -eq 1 && "$flat_line_count" -eq 1 ]]; then
  pass "fence-scan fence-flat: exits 1 with exactly 1 unfenced run line on stdout"
else
  fail "fence-scan fence-flat: exits 1 with exactly 1 unfenced run line on stdout" "rc=$rc line_count=$flat_line_count output=[$flat_output]"
fi

# --- Assertion 2: fence-flat's one run record has fenced=0.
flat_fenced="$(awk -F'\t' 'NR==1{print $3}' <<< "$flat_output")"
if [[ "$flat_fenced" == "0" ]]; then
  pass "fence-scan fence-flat: the run record's fenced field is 0"
else
  fail "fence-scan fence-flat: the run record's fenced field is 0" "got fenced=$flat_fenced"
fi

# --- Assertion 3: fence-subsectioned yields 4 runs, not 3 -- the
# blank-line-inside-a-sub-section grammar cell the fleet census (M3) did
# not measure (6 real domains carry this shape). This is also the R10
# testing corollary's required non-zero, non-empty run count: a detector
# broken via the bash-subshell-strips-globals pattern would report 0 here,
# not 4.
rc=0; sub_output=""
sub_output=$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-subsectioned 2>/dev/null) || rc=$?
sub_run_count="$(wc -l <<< "$sub_output")"
if [[ "$sub_run_count" -eq 4 ]]; then
  pass "fence-scan fence-subsectioned: yields 4 runs, not 3 (blank-line split honored)"
else
  fail "fence-scan fence-subsectioned: yields 4 runs, not 3 (blank-line split honored)" "expected 4, got $sub_run_count runs=[$sub_output]"
fi

# --- Assertion 4: every ### sub-heading line in fence-subsectioned falls
# OUTSIDE every emitted run's [start,end] range (sub-headings are human
# curation and stay unfenced -- D3). Lines 8, 13, 17 are the "### Topic
# Areas", "### Reference Pages", "### Standalone Pages" headings.
sub_headings_outside=true
for h in 8 13 17; do
  while IFS=$'\t' read -r rs re rf; do
    [[ -z "$rs" ]] && continue
    if [[ "$h" -ge "$rs" && "$h" -le "$re" ]]; then
      sub_headings_outside=false
    fi
  done <<< "$sub_output"
done
if [[ "$sub_headings_outside" == true ]]; then
  pass "fence-scan fence-subsectioned: every ### sub-heading line falls outside every emitted run range"
else
  fail "fence-scan fence-subsectioned: every ### sub-heading line falls outside every emitted run range" "runs=[$sub_output]"
fi

# --- Assertion 5: fence-archived's ### Archived bullet forms its own run,
# distinct from (not merged with) the active run above it.
rc=0; archived_output=""
archived_output=$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-archived 2>/dev/null) || rc=$?
archived_run_count="$(wc -l <<< "$archived_output")"
archived_run1_end="$(awk -F'\t' 'NR==1{print $2}' <<< "$archived_output")"
archived_run2_start="$(awk -F'\t' 'NR==2{print $1}' <<< "$archived_output")"
if [[ "$archived_run_count" -eq 2 && "$archived_run2_start" -gt $((archived_run1_end + 1)) ]]; then
  pass "fence-scan fence-archived: ### Archived bullet forms its own run, distinct from the active run above"
else
  fail "fence-scan fence-archived: ### Archived bullet forms its own run, distinct from the active run above" "run_count=$archived_run_count run1_end=$archived_run1_end run2_start=$archived_run2_start"
fi

# --- Assertion 6: fence-trailing-rule's run ends at the last bullet, NOT
# at the blank line or the --- thematic break after it (C10).
rc=0; trailing_output=""
trailing_output=$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-trailing-rule 2>/dev/null) || rc=$?
trailing_end="$(awk -F'\t' 'NR==1{print $2}' <<< "$trailing_output")"
if [[ "$trailing_end" == "10" ]]; then
  pass "fence-scan fence-trailing-rule: run's end line is the last bullet (10), not the blank line or the --- rule"
else
  fail "fence-scan fence-trailing-rule: run's end line is the last bullet (10), not the blank line or the --- rule" "got end=$trailing_end"
fi

# --- Assertion 7: fence-already-fenced exits 0 and every emitted record
# is fenced=1 (C4 idempotency signal). The -n check on $fenced_output
# guards against a detector that reports zero runs (which would also make
# unfenced_count trivially 0 without proving anything).
rc=0; fenced_output=""
fenced_output=$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-already-fenced 2>/dev/null) || rc=$?
fenced_unfenced_count="$(awk -F'\t' '$3==0{c++} END{print c+0}' <<< "$fenced_output")"
if [[ "$rc" -eq 0 && -n "$fenced_output" && "$fenced_unfenced_count" -eq 0 ]]; then
  pass "fence-scan fence-already-fenced: exits 0 and every emitted record has fenced=1"
else
  fail "fence-scan fence-already-fenced: exits 0 and every emitted record has fenced=1" "rc=$rc unfenced_count=$fenced_unfenced_count output=[$fenced_output]"
fi

# --- Assertion 8: --json on fence-subsectioned reports .runs length == 4.
json_sub="$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-subsectioned --json 2>/dev/null)" || true
jq_rc=0
printf '%s' "$json_sub" | jq -e '.runs | length == 4' >/dev/null 2>&1 || jq_rc=$?
assert_exit 0 "$jq_rc" "fence-scan --json fence-subsectioned: jq -e '.runs | length == 4' succeeds"

# --- Assertion 9: --json on fence-already-fenced reports .unfenced == 0.
json_fenced="$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-already-fenced --json 2>/dev/null)" || true
jq_rc2=0
printf '%s' "$json_fenced" | jq -e '.unfenced == 0' >/dev/null 2>&1 || jq_rc2=$?
assert_exit 0 "$jq_rc2" "fence-scan --json fence-already-fenced: jq -e '.unfenced == 0' succeeds"

# --- Assertion 10: an unresolvable skill exits 2 with empty stdout and
# error text on stderr -- never a false-positive empty success.
unresolvable_stderr_file="$TMPDIR_ROOT/fence-scan-unresolvable.stderr"
rc=0; unresolvable_stdout=""
unresolvable_stdout=$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan zzz-nonexistent-skill-fence-scan-xyz 2>"$unresolvable_stderr_file") || rc=$?
unresolvable_stderr="$(cat "$unresolvable_stderr_file")"
if [[ "$rc" -eq 2 && -z "$unresolvable_stdout" && -n "$unresolvable_stderr" ]]; then
  pass "fence-scan unresolvable skill: exits 2 with empty stdout and error text on stderr"
else
  fail "fence-scan unresolvable skill: exits 2 with empty stdout and error text on stderr" "rc=$rc stdout=[$unresolvable_stdout] stderr=[$unresolvable_stderr]"
fi

# --- Assertion 11: an unknown option exits 2 with the standard
# "ERROR: unknown option:" text on stderr.
rc=0; bogus_stderr=""
bogus_stderr=$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-flat --bogus 2>&1 >/dev/null) || rc=$?
if [[ "$rc" -eq 2 && "$bogus_stderr" == *"ERROR: unknown option:"* ]]; then
  pass "fence-scan --bogus: exits 2 with 'ERROR: unknown option:' on stderr"
else
  fail "fence-scan --bogus: exits 2 with 'ERROR: unknown option:' on stderr" "rc=$rc stderr=[$bogus_stderr]"
fi

# --- Assertion 12: fence-scan --help exits 0 and creates no file literally
# named --help (R12 regression guard: git-state once created exactly this
# file when a help check ran after positional binding instead of before).
rc=0
(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan --help >/dev/null 2>&1) || rc=$?
help_file_created=false
[[ -e "$wt_v/--help" ]] && help_file_created=true
if [[ "$rc" -eq 0 && "$help_file_created" == false ]]; then
  pass "fence-scan --help: exits 0 and creates no file named --help"
else
  fail "fence-scan --help: exits 0 and creates no file named --help" "rc=$rc help_file_created=$help_file_created"
fi

# --- Assertion 13: fence-scan pipes cleanly -- fence-subsectioned --quiet
# piped through wc -l reports 4 (Tier 2 CLI piping contract, R14).
pipe_count="$(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-subsectioned --quiet 2>/dev/null | wc -l)" || true
pipe_count="$(printf '%s' "$pipe_count" | tr -d '[:space:]')"
if [[ "$pipe_count" == "4" ]]; then
  pass "fence-scan fence-subsectioned --quiet: piped through wc -l reports 4 lines"
else
  fail "fence-scan fence-subsectioned --quiet: piped through wc -l reports 4 lines" "expected 4, got '$pipe_count'"
fi

# --- Assertion 14: fence-scan is read-only -- fence-flat's SKILL.md bytes
# and mtime are unchanged after a scan (detection only, never a write).
readonly_skillmd="$fence_flat_dir/SKILL.md"
before_hash="$(md5sum "$readonly_skillmd" | awk '{print $1}')"
before_mtime="$(stat -c '%Y' "$readonly_skillmd" 2>/dev/null)"
(cd "$wt_v" && bash "$WIKI_HEALTH" fence-scan fence-flat >/dev/null 2>&1) || true
after_hash="$(md5sum "$readonly_skillmd" | awk '{print $1}')"
after_mtime="$(stat -c '%Y' "$readonly_skillmd" 2>/dev/null)"
if [[ "$before_hash" == "$after_hash" && "$before_mtime" == "$after_mtime" ]]; then
  pass "fence-scan fence-flat: read-only -- SKILL.md bytes and mtime unchanged after a scan"
else
  fail "fence-scan fence-flat: read-only -- SKILL.md bytes and mtime unchanged after a scan" "before_hash=$before_hash after_hash=$after_hash before_mtime=$before_mtime after_mtime=$after_mtime"
fi

# ============================================================
echo ""
echo "=== Group 22: MISSING_PAGES_FENCE state-gating check ==="
# ============================================================
#
# Covers step 10's two marker-fence checks, both wired as STATE-GATING (D6):
# an offending domain classifies `unhealthy` (exit 5), it is not merely
# reported. Group 19's FORBIDDEN_UPDATED_FIELD group is the shape model --
# every fixture asserted through BOTH --verbose text and a --json key,
# because the check has three separate edit sites (reason emission, JSON
# accumulator, heredoc key) and a check that fires in one mode but not the
# other is a real defect class in this file.
#
# The must-NOT-trip half carries as much weight as the must-trip half. R6's
# recorded failure mode is a check that flips previously-healthy domains
# unhealthy because it was wired into unhealthy_reasons "just for
# visibility"; the only mechanical guard is a fixture that is SUPPOSED to
# stay healthy and is asserted to stay healthy. Each of those carries an
# assert_not_contains, never a bare exit-code assertion -- an exit code can
# be right for the wrong reason.
#
# Ten fixture domains:
#   MISSING_PAGES_FENCE must-trip
#     mpf-unfenced     -- flat ## Pages, one unfenced run
#     mpf-partial      -- two runs, one fenced and one not; gating must fire
#                         on the unfenced one even though a fence exists
#                         elsewhere in the same file
#   MISSING_PAGES_FENCE must-NOT-trip
#     mpf-fenced       -- every run fenced; stays healthy, exit 0
#     mpf-new          -- declared, but no ## Pages heading, so there is
#                         no wiki signal at all; stays `new`, exit 3, and
#                         the check is unreachable by construction
#     mpf-empty-pages  -- ## Pages heading with zero bullets; no run exists,
#                         so nothing can be unfenced
#     mpf-meta-only    -- fenced ## Pages plus a ## Meta section whose links
#                         are NOT fenced; ## Meta is outside this check's
#                         scope (C5), so it must stay healthy
#   UNBALANCED_PAGES_FENCE must-trip
#     upf-begin-no-end -- BEGIN whose ## Pages section ends with no END
#     upf-end-no-begin -- stray END with no preceding BEGIN
#     upf-nested-begin -- second BEGIN before the open region's END
#   UNBALANCED_PAGES_FENCE must-NOT-trip
#     upf-empty-fence  -- well-formed BEGIN/END pair wrapping ZERO bullets,
#                         i.e. the exact protocols/init.md:64-65 scaffold.
#                         This is the regression guard for every freshly
#                         `init`ed domain: a balance check that flags it
#                         makes every new domain unhealthy at birth.
#
# Output-mode note: --verbose prints CLASSIFY_REASONS with the `CODE:`
# prefix STRIPPED (step 10 deliberately added no bespoke verbose line), so
# the reason WORDING is what --verbose can be matched against. The token
# itself lives in --json at .reasons[].code. Assertions below therefore
# match wording in --verbose and the token in --json -- matching the token
# against --verbose would pass vacuously in both directions and prove
# nothing.

wt_w="$TMPDIR_ROOT/wt-w"
_git_init_repo "$wt_w"

# Emit a knowledge page whose frontmatter summary matches its nav text, so
# no unrelated check (MISSING_SUMMARY / NAV_SUMMARY_MISMATCH) fires and each
# fixture isolates exactly the fence fault under test.
_g22_page() {
  local path="$1" summary="$2" title="$3"
  printf '%s\n' '---' 'tags: [x]' "summary: \"$summary\"" '---' "# $title" > "$path"
}

# Every fixture gets the meta files a real wiki domain carries, so the
# fixtures model production domains rather than a reduced shape.
_g22_meta() {
  local dir="$1"
  printf 'entrypoint: SKILL.md\n' > "$dir/.mditerc"
  _g22_page "$dir/schema.md" "domain page schema" "Schema"
}

# --- Fixture: mpf-unfenced -- flat ## Pages, one unfenced bullet run.
# The bullet sits at SKILL.md line 9; assertion 2 pins that literal, the
# same convention Group 21's fixtures use.
mpf_unfenced_dir="$wt_w/.claude/skills/mpf-unfenced"
mkdir -p "$mpf_unfenced_dir"
cat > "$mpf_unfenced_dir/SKILL.md" <<'EOF'
---
name: mpf-unfenced
description: "MISSING_PAGES_FENCE fixture: flat ## Pages with one unfenced run"
wiki: true
---

## Pages

- [Page One](page-one.md) — Page One

## Meta
EOF
_g22_meta "$mpf_unfenced_dir"
_g22_page "$mpf_unfenced_dir/page-one.md" "Page One" "Page One"

# --- Fixture: mpf-partial -- one fenced run AND one unfenced run in the
# same file. The mixed case: gating must fire on the unfenced run even
# though a well-formed fence region exists elsewhere in the section.
mpf_partial_dir="$wt_w/.claude/skills/mpf-partial"
mkdir -p "$mpf_partial_dir"
cat > "$mpf_partial_dir/SKILL.md" <<'EOF'
---
name: mpf-partial
description: "MISSING_PAGES_FENCE fixture: two runs, one fenced and one not"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
<!-- END:PAGES -->

- [Page Two](page-two.md) — Page Two

## Meta
EOF
_g22_meta "$mpf_partial_dir"
_g22_page "$mpf_partial_dir/page-one.md" "Page One" "Page One"
_g22_page "$mpf_partial_dir/page-two.md" "Page Two" "Page Two"

# --- Fixture: mpf-fenced -- every run fenced. Must stay healthy: this is
# the R6 guard that the new check does not flip compliant domains unhealthy.
mpf_fenced_dir="$wt_w/.claude/skills/mpf-fenced"
mkdir -p "$mpf_fenced_dir"
cat > "$mpf_fenced_dir/SKILL.md" <<'EOF'
---
name: mpf-fenced
description: "MISSING_PAGES_FENCE fixture: every ## Pages run correctly fenced"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two
<!-- END:PAGES -->

## Meta
EOF
_g22_meta "$mpf_fenced_dir"
_g22_page "$mpf_fenced_dir/page-one.md" "Page One" "Page One"
_g22_page "$mpf_fenced_dir/page-two.md" "Page Two" "Page Two"

# --- Fixture: mpf-new -- declared a wiki (D15) but carrying no ## Pages
# heading, so _classify_skill reports NO_PAGES_HEADING and never reaches the
# fence block. The state is unhealthy rather than `new`: identity is the
# declaration now, so a declared wiki missing ## Pages is non-conformant, not
# unmigrated. What this fixture tests is unchanged -- no fence reason may
# appear when there is no ## Pages section to scan.
mpf_new_dir="$wt_w/.claude/skills/mpf-new"
mkdir -p "$mpf_new_dir"
cat > "$mpf_new_dir/SKILL.md" <<'EOF'
---
name: mpf-new
description: "MISSING_PAGES_FENCE fixture: flat skill with no ## Pages heading"
wiki: true
---

# Flat Skill

Body content only. No ## Pages section, so the fence check is unreachable.
EOF

# --- Fixture: mpf-empty-pages -- ## Pages heading present, zero bullets.
# No bullet run exists, so there is nothing that could be unfenced.
mpf_empty_dir="$wt_w/.claude/skills/mpf-empty-pages"
mkdir -p "$mpf_empty_dir"
cat > "$mpf_empty_dir/SKILL.md" <<'EOF'
---
name: mpf-empty-pages
description: "MISSING_PAGES_FENCE fixture: ## Pages heading with zero bullets"
wiki: true
---

## Pages

## Meta
EOF
_g22_meta "$mpf_empty_dir"

# --- Fixture: mpf-meta-only -- fenced ## Pages, plus a ## Meta section
# carrying UNFENCED bullets. C5: the check's scope is the ## Pages section
# only, so the ## Meta bullets must not be scanned and the domain stays
# healthy. Guards against a detector whose section bounds leak past the
# next ## heading.
mpf_meta_dir="$wt_w/.claude/skills/mpf-meta-only"
mkdir -p "$mpf_meta_dir"
cat > "$mpf_meta_dir/SKILL.md" <<'EOF'
---
name: mpf-meta-only
description: "MISSING_PAGES_FENCE fixture: fenced ## Pages, unfenced ## Meta links"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
<!-- END:PAGES -->

## Meta

- [Schema](schema.md)
- [Page One](page-one.md)
EOF
_g22_meta "$mpf_meta_dir"
_g22_page "$mpf_meta_dir/page-one.md" "Page One" "Page One"

# --- Fixture: upf-begin-no-end -- BEGIN at line 9, no END before the
# ## Meta heading closes the section. Carries a SECOND bullet run after the
# unclosed marker, which is what assertion 13 probes.
upf_bne_dir="$wt_w/.claude/skills/upf-begin-no-end"
mkdir -p "$upf_bne_dir"
cat > "$upf_bne_dir/SKILL.md" <<'EOF'
---
name: upf-begin-no-end
description: "UNBALANCED_PAGES_FENCE fixture: BEGIN with no matching END"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One

- [Page Two](page-two.md) — Page Two

## Meta
EOF
_g22_meta "$upf_bne_dir"
_g22_page "$upf_bne_dir/page-one.md" "Page One" "Page One"
_g22_page "$upf_bne_dir/page-two.md" "Page Two" "Page Two"

# --- Fixture: upf-end-no-begin -- a well-formed pair followed by a STRAY
# second END at line 12. Deliberately keeps the real run fenced so only the
# balance fault fires and the assertion cannot pass on MISSING_PAGES_FENCE
# by accident.
upf_enb_dir="$wt_w/.claude/skills/upf-end-no-begin"
mkdir -p "$upf_enb_dir"
cat > "$upf_enb_dir/SKILL.md" <<'EOF'
---
name: upf-end-no-begin
description: "UNBALANCED_PAGES_FENCE fixture: stray END with no preceding BEGIN"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
<!-- END:PAGES -->
<!-- END:PAGES -->

## Meta
EOF
_g22_meta "$upf_enb_dir"
_g22_page "$upf_enb_dir/page-one.md" "Page One" "Page One"

# --- Fixture: upf-nested-begin -- a second BEGIN at line 11 opens while
# the first region is still open. Both runs stay fenced, so again only the
# balance fault fires.
upf_nb_dir="$wt_w/.claude/skills/upf-nested-begin"
mkdir -p "$upf_nb_dir"
cat > "$upf_nb_dir/SKILL.md" <<'EOF'
---
name: upf-nested-begin
description: "UNBALANCED_PAGES_FENCE fixture: nested second BEGIN before END"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
- [Page One](page-one.md) — Page One
<!-- BEGIN:PAGES -->
- [Page Two](page-two.md) — Page Two
<!-- END:PAGES -->

## Meta
EOF
_g22_meta "$upf_nb_dir"
_g22_page "$upf_nb_dir/page-one.md" "Page One" "Page One"
_g22_page "$upf_nb_dir/page-two.md" "Page Two" "Page Two"

# --- Fixture: upf-empty-fence -- a well-formed BEGIN/END pair wrapping
# ZERO bullets. This is byte-for-byte the scaffold protocols/init.md:64-65
# writes for every newly `init`ed domain. It MUST stay healthy; a balance
# check that flags it would make every new domain unhealthy at birth, which
# is the same fleet-wide regression D7 exists to prevent.
upf_empty_dir="$wt_w/.claude/skills/upf-empty-fence"
mkdir -p "$upf_empty_dir"
cat > "$upf_empty_dir/SKILL.md" <<'EOF'
---
name: upf-empty-fence
description: "UNBALANCED_PAGES_FENCE fixture: well-formed fence pair wrapping zero bullets"
wiki: true
---

## Pages

<!-- BEGIN:PAGES -->
<!-- END:PAGES -->

## Meta
EOF
_g22_meta "$upf_empty_dir"

_git_commit "$wt_w" "group 22 marker-fence fixtures" "2026-01-01T00:00:00"

# --- Assertion 1: mpf-unfenced trips the gate -- exit 5 AND the state word
# is `unhealthy`. Both halves together: exit 5 alone could be produced by
# any other unhealthy reason, and these fixtures are built so none is.
rc=0; mpf_unfenced_out=""
mpf_unfenced_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-unfenced --verbose 2>&1) || rc=$?
if [[ "$rc" -eq 5 && "$mpf_unfenced_out" == *"mpf-unfenced: unhealthy"* ]]; then
  pass "MISSING_PAGES_FENCE mpf-unfenced: state-gates to unhealthy (exit 5)"
else
  fail "MISSING_PAGES_FENCE mpf-unfenced: state-gates to unhealthy (exit 5)" "rc=$rc output=[$mpf_unfenced_out]"
fi

# --- Assertion 2: the --verbose reason wording, with the run's line range
# pinned. One contiguous needle spanning both halves the criterion names
# ("## Pages bullet run at SKILL.md:" and "is not wrapped in"), so a reason
# that emitted only one of them cannot pass.
assert_contains "## Pages bullet run at SKILL.md:9-9 is not wrapped in" "$mpf_unfenced_out" "MISSING_PAGES_FENCE mpf-unfenced: --verbose names the run and its line range"

# --- Assertion 3: --json reports exactly one unfenced run.
mpf_unfenced_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-unfenced --json 2>/dev/null)" || true
g22_jq_rc=0
printf '%s' "$mpf_unfenced_json" | jq -e '.pages.unfenced_runs | length == 1' >/dev/null 2>&1 || g22_jq_rc=$?
assert_exit 0 "$g22_jq_rc" "MISSING_PAGES_FENCE mpf-unfenced: jq -e '.pages.unfenced_runs | length == 1' succeeds"

# --- Assertion 4: the reason token itself is present in --json. .reasons is
# an array of {code, detail} objects, so the token is matched on .code --
# not with startswith() over strings, which errors on object input.
g22_jq_rc2=0
printf '%s' "$mpf_unfenced_json" | jq -e '[.reasons[].code] | any(. == "MISSING_PAGES_FENCE")' >/dev/null 2>&1 || g22_jq_rc2=$?
assert_exit 0 "$g22_jq_rc2" "MISSING_PAGES_FENCE mpf-unfenced: --json .reasons carries the MISSING_PAGES_FENCE code"

# --- Assertion 5: mpf-partial trips exit 5 and reports exactly ONE
# unfenced run -- the fenced run in the same file is not reported. This is
# the mixed case: a fence existing somewhere in the section must not
# suppress gating on a run outside it.
rc=0; mpf_partial_out=""
mpf_partial_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-partial --verbose 2>&1) || rc=$?
mpf_partial_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-partial --json 2>/dev/null)" || true
g22_jq_rc3=0
printf '%s' "$mpf_partial_json" | jq -e '.pages.unfenced_runs | length == 1' >/dev/null 2>&1 || g22_jq_rc3=$?
if [[ "$rc" -eq 5 && "$g22_jq_rc3" -eq 0 ]]; then
  pass "MISSING_PAGES_FENCE mpf-partial: exit 5 and only the unfenced run is reported (fenced run excluded)"
else
  fail "MISSING_PAGES_FENCE mpf-partial: exit 5 and only the unfenced run is reported (fenced run excluded)" "rc=$rc jq_rc=$g22_jq_rc3 json=[$mpf_partial_json]"
fi

# --- Assertion 6: mpf-fenced stays healthy -- the R6 must-NOT-trip guard.
rc=0; mpf_fenced_out=""
mpf_fenced_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-fenced --verbose 2>&1) || rc=$?
if [[ "$rc" -eq 0 && "$mpf_fenced_out" == *"mpf-fenced: healthy"* ]]; then
  pass "MISSING_PAGES_FENCE mpf-fenced: fully fenced domain stays healthy (exit 0)"
else
  fail "MISSING_PAGES_FENCE mpf-fenced: fully fenced domain stays healthy (exit 0)" "rc=$rc output=[$mpf_fenced_out]"
fi

# --- Assertion 7: no false-fire in --verbose. The needle is the reason
# WORDING, not the token: --verbose strips the CODE: prefix, so a
# not-contains on the token would pass vacuously and prove nothing.
assert_not_contains "is not wrapped in" "$mpf_fenced_out" "MISSING_PAGES_FENCE mpf-fenced: --verbose shows no unfenced-run reason"

# --- Assertion 8: the JSON key is present and empty, never omitted. A
# consumer that reads .pages.unfenced_runs must not have to distinguish
# "absent" from "empty".
mpf_fenced_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-fenced --json 2>/dev/null)" || true
g22_jq_rc4=0
printf '%s' "$mpf_fenced_json" | jq -e '.pages.unfenced_runs == []' >/dev/null 2>&1 || g22_jq_rc4=$?
assert_exit 0 "$g22_jq_rc4" "MISSING_PAGES_FENCE mpf-fenced: jq -e '.pages.unfenced_runs == []' succeeds (key present, empty)"

# --- Assertion 9: mpf-new is unhealthy for NO_PAGES_HEADING and carries no fence
# reason. The check is unreachable here by construction -- _classify_skill
# returns before the fence block when there is no wiki signal at all.
rc=0; mpf_new_out=""
mpf_new_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-new --verbose 2>&1) || rc=$?
mpf_new_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-new --json 2>/dev/null)" || true
if [[ "$rc" -eq 5 && "$mpf_new_out" == *"mpf-new: unhealthy"* && "$mpf_new_json" == *"NO_PAGES_HEADING"* && "$mpf_new_json" != *"MISSING_PAGES_FENCE"* ]]; then
  pass "MISSING_PAGES_FENCE mpf-new: no ## Pages heading is unhealthy (exit 5, NO_PAGES_HEADING) with no fence reason"
else
  fail "MISSING_PAGES_FENCE mpf-new: no ## Pages heading is unhealthy (exit 5, NO_PAGES_HEADING) with no fence reason" "rc=$rc output=[$mpf_new_out] json=[$mpf_new_json]"
fi

# --- Assertion 10: mpf-empty-pages stays healthy -- a ## Pages heading
# with zero bullets has no run, so nothing can be unfenced.
rc=0; mpf_empty_out=""
mpf_empty_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-empty-pages --verbose 2>&1) || rc=$?
mpf_empty_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-empty-pages --json 2>/dev/null)" || true
if [[ "$rc" -eq 0 && "$mpf_empty_json" != *"MISSING_PAGES_FENCE"* ]]; then
  pass "MISSING_PAGES_FENCE mpf-empty-pages: zero-bullet ## Pages stays healthy (exit 0) with no fence reason"
else
  fail "MISSING_PAGES_FENCE mpf-empty-pages: zero-bullet ## Pages stays healthy (exit 0) with no fence reason" "rc=$rc output=[$mpf_empty_out] json=[$mpf_empty_json]"
fi

# --- Assertion 11: mpf-meta-only stays healthy (C5). The unfenced bullets
# under ## Meta are outside the check's section bounds and must not be
# scanned.
rc=0; mpf_meta_out=""
mpf_meta_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-meta-only --verbose 2>&1) || rc=$?
mpf_meta_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" mpf-meta-only --json 2>/dev/null)" || true
if [[ "$rc" -eq 0 && "$mpf_meta_json" != *"MISSING_PAGES_FENCE"* ]]; then
  pass "MISSING_PAGES_FENCE mpf-meta-only: unfenced ## Meta links are out of scope, stays healthy (C5)"
else
  fail "MISSING_PAGES_FENCE mpf-meta-only: unfenced ## Meta links are out of scope, stays healthy (C5)" "rc=$rc output=[$mpf_meta_out] json=[$mpf_meta_json]"
fi

# --- Assertion 12: upf-begin-no-end trips exit 5 with the BEGIN_WITHOUT_END
# wording, naming the offending marker's line.
rc=0; upf_bne_out=""
upf_bne_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" upf-begin-no-end --verbose 2>&1) || rc=$?
if [[ "$rc" -eq 5 && "$upf_bne_out" == *"<!-- BEGIN:PAGES --> at SKILL.md:9 has no matching <!-- END:PAGES --> before the end of ## Pages"* ]]; then
  pass "UNBALANCED_PAGES_FENCE upf-begin-no-end: exit 5 with the BEGIN_WITHOUT_END reason wording"
else
  fail "UNBALANCED_PAGES_FENCE upf-begin-no-end: exit 5 with the BEGIN_WITHOUT_END reason wording" "rc=$rc output=[$upf_bne_out]"
fi

# --- Assertion 13: the behavioural probe behind the whole balance check.
#
# CRITERION DIVERGENCE, reported rather than silently satisfied. Step 11's
# criterion 13 reads "the bullet run after the unclosed BEGIN is not
# reported as fenced". That is not satisfiable against step 10's APPROVED
# contract, which forbids touching the run detector: its Actions say "Do
# not modify _wiki_pages_bullet_runs() or fence-scan's output shape", and
# its acceptance criteria pin
# `git diff -U0 -- wiki-health.sh | grep -c 'marked_fenced'` -> 0.
# _wiki_pages_bullet_runs tracks fence state as a plain boolean, so after an
# unclosed BEGIN every following run DOES still report fenced=true. That is
# the documented, deliberate limitation -- not a defect introduced here.
#
# What the balance check buys is that the false negative can no longer
# ESCAPE. This assertion pins BOTH halves at once:
#   (a) the detector still reports zero unfenced runs (the false negative
#       is really present -- so a future detector change is noticed here),
#   (b) the domain is nonetheless caught: unbalanced_fences is non-empty
#       and the state is unhealthy.
# Together they state the real invariant: an unclosed BEGIN can hide a run
# from the fence detector, but it can never yield a healthy verdict.
upf_bne_scan="$(cd "$wt_w" && bash "$WIKI_HEALTH" fence-scan upf-begin-no-end --json 2>/dev/null)" || true
upf_bne_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" upf-begin-no-end --json 2>/dev/null)" || true
g22_jq_rc5=0
printf '%s' "$upf_bne_json" | jq -e '.pages.unfenced_runs == [] and (.pages.unbalanced_fences | length >= 1) and .state == "unhealthy"' >/dev/null 2>&1 || g22_jq_rc5=$?
g22_jq_rc6=0
printf '%s' "$upf_bne_scan" | jq -e '.unfenced == 0 and ([.runs[].fenced] | all)' >/dev/null 2>&1 || g22_jq_rc6=$?
if [[ "$g22_jq_rc5" -eq 0 && "$g22_jq_rc6" -eq 0 ]]; then
  pass "UNBALANCED_PAGES_FENCE upf-begin-no-end: the run after the unclosed BEGIN escapes the fence detector but is still caught as unhealthy by the balance check"
else
  fail "UNBALANCED_PAGES_FENCE upf-begin-no-end: the run after the unclosed BEGIN escapes the fence detector but is still caught as unhealthy by the balance check" "health_jq=$g22_jq_rc5 scan_jq=$g22_jq_rc6 scan=[$upf_bne_scan] json=[$upf_bne_json]"
fi

# --- Assertion 14: upf-end-no-begin trips exit 5 with the
# END_WITHOUT_BEGIN wording.
rc=0; upf_enb_out=""
upf_enb_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" upf-end-no-begin --verbose 2>&1) || rc=$?
if [[ "$rc" -eq 5 && "$upf_enb_out" == *"<!-- END:PAGES --> at SKILL.md:12 has no preceding <!-- BEGIN:PAGES --> in ## Pages"* ]]; then
  pass "UNBALANCED_PAGES_FENCE upf-end-no-begin: exit 5 with the END_WITHOUT_BEGIN reason wording"
else
  fail "UNBALANCED_PAGES_FENCE upf-end-no-begin: exit 5 with the END_WITHOUT_BEGIN reason wording" "rc=$rc output=[$upf_enb_out]"
fi

# --- Assertion 15: upf-nested-begin trips exit 5 with the NESTED_BEGIN
# wording, naming the second BEGIN's line rather than the first's.
rc=0; upf_nb_out=""
upf_nb_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" upf-nested-begin --verbose 2>&1) || rc=$?
if [[ "$rc" -eq 5 && "$upf_nb_out" == *"<!-- BEGIN:PAGES --> at SKILL.md:11 opens a second region before the previous one was closed by <!-- END:PAGES -->"* ]]; then
  pass "UNBALANCED_PAGES_FENCE upf-nested-begin: exit 5 with the NESTED_BEGIN reason wording"
else
  fail "UNBALANCED_PAGES_FENCE upf-nested-begin: exit 5 with the NESTED_BEGIN reason wording" "rc=$rc output=[$upf_nb_out]"
fi

# --- Assertion 16: THE regression guard for every freshly `init`ed domain.
# A well-formed fence pair wrapping zero bullets is exactly what
# protocols/init.md:64-65 emits. If this assertion ever fails, the balance
# check is unshippable: every new domain would classify unhealthy at birth.
rc=0; upf_empty_out=""
upf_empty_out=$(cd "$wt_w" && bash "$WIKI_HEALTH" upf-empty-fence --verbose 2>&1) || rc=$?
upf_empty_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" upf-empty-fence --json 2>/dev/null)" || true
if [[ "$rc" -eq 0 && "$upf_empty_out" == *"upf-empty-fence: healthy"* && "$upf_empty_json" != *"UNBALANCED_PAGES_FENCE"* ]]; then
  pass "UNBALANCED_PAGES_FENCE upf-empty-fence: the protocols/init.md scaffold (fence pair, zero bullets) stays healthy (exit 0)"
else
  fail "UNBALANCED_PAGES_FENCE upf-empty-fence: the protocols/init.md scaffold (fence pair, zero bullets) stays healthy (exit 0)" "rc=$rc output=[$upf_empty_out] json=[$upf_empty_json]"
fi

# --- Assertion 17: the unbalanced_fences JSON key behaves in both
# directions -- populated on a must-trip fixture, present-and-empty (never
# omitted) on the must-NOT-trip scaffold.
g22_jq_rc7=0
upf_nb_json="$(cd "$wt_w" && bash "$WIKI_HEALTH" upf-nested-begin --json 2>/dev/null)" || true
printf '%s' "$upf_nb_json" | jq -e '.pages.unbalanced_fences | length >= 1' >/dev/null 2>&1 || g22_jq_rc7=$?
g22_jq_rc8=0
printf '%s' "$upf_empty_json" | jq -e '.pages.unbalanced_fences == []' >/dev/null 2>&1 || g22_jq_rc8=$?
if [[ "$g22_jq_rc7" -eq 0 && "$g22_jq_rc8" -eq 0 ]]; then
  pass "UNBALANCED_PAGES_FENCE --json .pages.unbalanced_fences: populated on a fault, present-and-empty on the clean scaffold"
else
  fail "UNBALANCED_PAGES_FENCE --json .pages.unbalanced_fences: populated on a fault, present-and-empty on the clean scaffold" "fault_jq=$g22_jq_rc7 clean_jq=$g22_jq_rc8 fault_json=[$upf_nb_json] clean_json=[$upf_empty_json]"
fi

# ============================================================
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
