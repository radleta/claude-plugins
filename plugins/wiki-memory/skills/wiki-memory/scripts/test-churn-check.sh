#!/usr/bin/env bash
# test-churn-check.sh — Automated tests for churn-check
# Run: bash test-churn-check.sh
# All tests use temp directories (real git repos) cleaned up on exit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHURN_CHECK="$SCRIPT_DIR/churn-check"
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

assert_eq() {
  local expected="$1" actual="$2" label="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label"
  else
    fail "$label" "expected '$expected', got '$actual'"
  fi
}

# --- Temp directory setup ---
TMPDIR_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT

# Init a git repo with a fixed, isolated identity (no dependency on ambient
# git config).
_git_init_repo() {
  local dir="$1"
  mkdir -p "$dir"
  (cd "$dir" && git init -q && git config user.email "test@test.com" && git config user.name "Test User")
}

# Commit all changes in a repo with a fixed author/committer date, so churn
# ordering between fixture commits is deterministic (no reliance on real
# wall-clock timing / sleep).
_git_commit() {
  local dir="$1" msg="$2" date="$3"
  (cd "$dir" && git add -A && GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit -q -m "$msg")
}

# ============================================================
echo "=== Group 1: --help and usage ==="
# ============================================================

rc=0; output=""
output=$(bash "$CHURN_CHECK" --help 2>&1) || rc=$?
assert_exit 0 "$rc" "--help exits 0"
assert_contains "Usage: churn-check" "$output" "--help prints usage"

# ============================================================
echo ""
echo "=== Group 2: unknown flag rejected ==="
# ============================================================

rc=0; output=""
output=$(bash "$CHURN_CHECK" --bogus 2>&1) || rc=$?
assert_exit 2 "$rc" "--bogus exits with the distinct bad-input code (2), not 1"
lower_output="$(printf '%s' "$output" | tr '[:upper:]' '[:lower:]')"
assert_contains "unknown" "$lower_output" "--bogus output mentions 'unknown'"

# ============================================================
echo ""
echo "=== Group 3: no skill argument ==="
# ============================================================

rc=0; output=""
output=$(bash "$CHURN_CHECK" 2>&1) || rc=$?
assert_exit 2 "$rc" "no args exits 2"

# ============================================================
echo ""
echo "=== Group 4: bad/nonexistent skill arg ==="
# ============================================================

no_claude_dir="$TMPDIR_ROOT/no-claude-here"
mkdir -p "$no_claude_dir"
rc=0; output=""
output=$(cd "$no_claude_dir" && bash "$CHURN_CHECK" nonexistent-skill-xyz-churn-test 2>&1) || rc=$?
assert_exit 2 "$rc" "nonexistent skill exits with the distinct bad-input code (2), NOT 1 (churn-found)"

# ============================================================
echo ""
echo "=== Group 5: clean fixture — all references intact ==="
# ============================================================

clean_repo="$TMPDIR_ROOT/clean-repo"
_git_init_repo "$clean_repo"
skill_dir="$clean_repo/.claude/skills/churn-clean"
mkdir -p "$skill_dir" "$clean_repo/src"
cat > "$skill_dir/SKILL.md" <<'EOF'
---
name: churn-clean
description: "clean fixture"
---

## Pages

- [Page A](page-a.md) — summary
- [Page B](page-b.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir/.mditerc"
cat > "$skill_dir/page-b.md" <<'EOF'
---
tags: [x]
summary: "Page B"
code-cites: []
---
# Page B
EOF
cat > "$clean_repo/src/foo.sh" <<'EOF'
#!/usr/bin/env bash
echo hi
EOF
# Commit targets first (T1) — page-a (referencing them) lands in a later
# commit (T2), so every cited/linked target's last touch is strictly BEFORE
# the referencing page's own last touch, unambiguous regardless of git's
# --since boundary semantics.
_git_commit "$clean_repo" "commit1: targets" "2024-01-01T00:00:00"

cat > "$skill_dir/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
code-cites: [src/foo.sh]
---
# Page A

See [Page B](page-b.md) for more.
EOF
_git_commit "$clean_repo" "commit2: page-a" "2024-01-02T00:00:00"

rc=0; output=""
output=$(cd "$clean_repo" && bash "$CHURN_CHECK" churn-clean 2>&1) || rc=$?
assert_exit 0 "$rc" "clean fixture: churn-check exits 0"
assert_eq "" "$output" "clean fixture: no stdout in non-json mode"

json_output=""
json_output=$(cd "$clean_repo" && bash "$CHURN_CHECK" --json churn-clean 2>/dev/null) || true
assert_contains '"targets":[]' "$json_output" "clean fixture: --json emits empty targets array (payload regardless of exit code)"

# ============================================================
echo ""
echo "=== Group 6: deleted md-link target ==="
# ============================================================

dead_repo="$TMPDIR_ROOT/dead-repo"
_git_init_repo "$dead_repo"
skill_dir2="$dead_repo/.claude/skills/churn-dead"
mkdir -p "$skill_dir2"
cat > "$skill_dir2/SKILL.md" <<'EOF'
---
name: churn-dead
description: "dead-link fixture"
---

## Pages

- [Page A](page-a.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir2/.mditerc"
cat > "$skill_dir2/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
code-cites: []
---
# Page A

See [Gone Page](page-gone.md) for details.
EOF
cat > "$skill_dir2/page-gone.md" <<'EOF'
---
tags: [x]
summary: "Page Gone"
code-cites: []
---
# Page Gone
EOF
_git_commit "$dead_repo" "commit1: initial" "2024-01-01T00:00:00"
rm "$skill_dir2/page-gone.md"
_git_commit "$dead_repo" "commit2: delete page-gone" "2024-01-02T00:00:00"

rc=0; output=""
output=$(cd "$dead_repo" && bash "$CHURN_CHECK" churn-dead 2>&1) || rc=$?
assert_exit 1 "$rc" "deleted md-link fixture: churn-check exits non-zero (churn found)"

json_output=""
json_output=$(cd "$dead_repo" && bash "$CHURN_CHECK" --json churn-dead 2>/dev/null) || true
assert_contains '"kind":"md-link"' "$json_output" "deleted md-link fixture: JSON reports kind md-link"
assert_contains "page-gone.md" "$json_output" "deleted md-link fixture: JSON reports the dead target"
sha_match="$(printf '%s' "$json_output" | grep -oE '"contradicting-sha":"[0-9a-f]{7,40}"' || true)"
if [[ -n "$sha_match" ]]; then
  pass "deleted md-link fixture: contradicting-sha populated with a real commit SHA (the deletion commit)"
else
  fail "deleted md-link fixture: contradicting-sha populated with a real commit SHA (the deletion commit)" "no sha found in: $json_output"
fi

# ============================================================
echo ""
echo "=== Group 7: churned code-cite ==="
# ============================================================

churn_repo="$TMPDIR_ROOT/churn-repo"
_git_init_repo "$churn_repo"
skill_dir3="$churn_repo/.claude/skills/churn-cite"
mkdir -p "$skill_dir3" "$churn_repo/src"
cat > "$skill_dir3/SKILL.md" <<'EOF'
---
name: churn-cite
description: "churned code-cite fixture"
---

## Pages

- [Page C](page-c.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir3/.mditerc"
cat > "$churn_repo/src/bar.sh" <<'EOF'
#!/usr/bin/env bash
echo original
EOF
cat > "$skill_dir3/page-c.md" <<'EOF'
---
tags: [x]
summary: "Page C"
code-cites: [src/bar.sh]
---
# Page C
EOF
# Commit page-c (T1) BEFORE modifying its cited file (T2) — the cited
# file's newest commit is strictly AFTER the page's own last-touch commit,
# unambiguously triggering churn.
_git_commit "$churn_repo" "commit1: initial" "2024-01-01T00:00:00"
cat > "$churn_repo/src/bar.sh" <<'EOF'
#!/usr/bin/env bash
echo changed
EOF
_git_commit "$churn_repo" "commit2: change bar.sh" "2024-01-02T00:00:00"

rc=0; output=""
output=$(cd "$churn_repo" && bash "$CHURN_CHECK" churn-cite 2>&1) || rc=$?
assert_exit 1 "$rc" "churned code-cite fixture: churn-check exits non-zero (churn found)"

json_output=""
json_output=$(cd "$churn_repo" && bash "$CHURN_CHECK" --json churn-cite 2>/dev/null) || true
assert_contains '"kind":"code-cite"' "$json_output" "churned code-cite fixture: JSON reports kind code-cite"
assert_contains "src/bar.sh" "$json_output" "churned code-cite fixture: JSON reports the churned target"

# ============================================================
echo ""
echo "=== Group 8: regex false-positive guard (prose mention not extracted) ==="
# ============================================================

fp_repo="$TMPDIR_ROOT/fp-repo"
_git_init_repo "$fp_repo"
skill_dir4="$fp_repo/.claude/skills/churn-fp"
mkdir -p "$skill_dir4"
cat > "$skill_dir4/SKILL.md" <<'EOF'
---
name: churn-fp
description: "regex FP fixture"
---

## Pages

- [Page FP](page-fp.md) — summary
- [Real Target](real-target.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir4/.mditerc"
cat > "$skill_dir4/real-target.md" <<'EOF'
---
tags: [x]
summary: "Real Target"
code-cites: []
---
# Real Target
EOF
_git_commit "$fp_repo" "commit1: real target" "2024-01-01T00:00:00"
cat > "$skill_dir4/page-fp.md" <<'EOF'
---
tags: [x]
summary: "Page FP"
code-cites: []
---
# Page FP

See [Real Target](real-target.md) for the real thing.

Prose mention (NOT a markdown link, must not be extracted): `foo/bar.md`
also see foo/bar.md in passing, and (an aside about foo/bar.md) too.
EOF
_git_commit "$fp_repo" "commit2: page-fp" "2024-01-02T00:00:00"

rc=0; output=""
output=$(cd "$fp_repo" && bash "$CHURN_CHECK" churn-fp 2>&1) || rc=$?
assert_exit 0 "$rc" "regex FP fixture: churn-check exits 0 (prose mention is unaudited by design)"

json_output=""
json_output=$(cd "$fp_repo" && bash "$CHURN_CHECK" --json churn-fp 2>/dev/null) || true
assert_not_contains "foo/bar.md" "$json_output" "regex FP fixture: JSON does not list the prose-mentioned path as a target"

# ============================================================
echo ""
echo "=== Group 9: --json output shape ==="
# ============================================================

if command -v jq >/dev/null 2>&1; then
  json_output=""
  json_output=$(cd "$dead_repo" && bash "$CHURN_CHECK" --json churn-dead 2>/dev/null) || true
  if printf '%s' "$json_output" | jq . >/dev/null 2>&1; then
    pass "--json output parses via jq"
  else
    fail "--json output parses via jq" "jq failed to parse: $json_output"
  fi
  keys="$(printf '%s' "$json_output" | jq -r '.targets[0] | keys | sort | join(",")' 2>/dev/null || true)"
  assert_eq "contradicting-sha,kind,scope,target" "$keys" "--json entry has target, kind, scope, contradicting-sha keys"
  scope_val="$(printf '%s' "$json_output" | jq -r '.targets[0].scope' 2>/dev/null || true)"
  assert_eq "internal" "$scope_val" "--json entry for the dead md-link (target resolves inside the skill dir) reports scope internal"
else
  echo "  SKIP: jq not installed — skipping JSON shape validation"
fi

# ============================================================
echo ""
echo "=== Group 10: path-traversal containment guard ==="
# ============================================================
# A crafted code-cites or md-link target using .. or an absolute path must
# never be resolved/existence-tested outside the project — it must be
# silently skipped (same containment convention as wiki-health.sh), not
# reported as churn and not used to probe the filesystem.
# (security-verifier iter1 high finding.)

trav_repo="$TMPDIR_ROOT/trav-repo"
_git_init_repo "$trav_repo"
skill_dir5="$trav_repo/.claude/skills/churn-trav"
mkdir -p "$skill_dir5"
cat > "$skill_dir5/SKILL.md" <<'EOF'
---
name: churn-trav
description: "path-traversal fixture"
---

## Pages

- [Page T](page-t.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir5/.mditerc"
cat > "$skill_dir5/page-t.md" <<'EOF'
---
tags: [x]
summary: "Page T"
code-cites: [../../../../etc/passwd]
---
# Page T

See [Escape](../../../../etc/passwd) and [Abs](/etc/passwd) for details.
EOF
_git_commit "$trav_repo" "commit1: traversal fixture" "2024-01-01T00:00:00"

rc=0; output=""
output=$(cd "$trav_repo" && bash "$CHURN_CHECK" churn-trav 2>&1) || rc=$?
assert_exit 0 "$rc" "traversal fixture: churn-check exits 0 (traversal/absolute targets skipped, not flagged)"

json_output=""
json_output=$(cd "$trav_repo" && bash "$CHURN_CHECK" --json churn-trav 2>/dev/null) || true
assert_contains '"targets":[]' "$json_output" "traversal fixture: --json emits empty targets array (nothing extracted)"
assert_not_contains "etc/passwd" "$json_output" "traversal fixture: JSON never mentions the traversal/absolute target"

# ============================================================
echo ""
echo "=== Group 11: fence-aware extraction (AD5 — in-fence link skipped) ==="
# ============================================================

fence_repo="$TMPDIR_ROOT/fence-repo"
_git_init_repo "$fence_repo"
skill_dir6="$fence_repo/.claude/skills/churn-fence"
mkdir -p "$skill_dir6"
cat > "$skill_dir6/SKILL.md" <<'EOF'
---
name: churn-fence
description: "fence-aware fixture"
---

## Pages

- [Real](real.md) — summary
- [Page Fence](page-fence.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir6/.mditerc"
cat > "$skill_dir6/real.md" <<'EOF'
---
tags: [x]
summary: "Real"
code-cites: []
---
# Real
EOF
_git_commit "$fence_repo" "commit1: real" "2024-01-01T00:00:00"

cat > "$skill_dir6/page-fence.md" <<'EOF'
---
tags: [x]
summary: "Page Fence"
code-cites: []
---
# Page Fence

See [Real](real.md) for the real thing.

```text
Illustrative-only link, never resolved: [Dead In Fence](dead-in-fence.md)
```
EOF
_git_commit "$fence_repo" "commit2: page-fence" "2024-01-02T00:00:00"

rc=0; output=""
output=$(cd "$fence_repo" && bash "$CHURN_CHECK" churn-fence 2>&1) || rc=$?
assert_exit 0 "$rc" "fence fixture: churn-check exits 0 (in-fence dead link skipped, BUG 2 fix)"

json_output=""
json_output=$(cd "$fence_repo" && bash "$CHURN_CHECK" --json churn-fence 2>/dev/null) || true
assert_contains '"targets":[]' "$json_output" "fence fixture: --json emits empty targets array"
assert_not_contains "dead-in-fence.md" "$json_output" "fence fixture: in-fence link never extracted as a target"

# ============================================================
echo ""
echo "=== Group 12: group-subdirectory pages scanned (BUG 1 two-tier fix) + resolve-then-contain (escape resolving INSIDE repo root) ==="
# ============================================================

group_repo="$TMPDIR_ROOT/group-repo"
_git_init_repo "$group_repo"
skill_dir7="$group_repo/.claude/skills/churn-group"
mkdir -p "$skill_dir7/subgroup"
cat > "$skill_dir7/SKILL.md" <<'EOF'
---
name: churn-group
description: "group-subdirectory fixture"
---

## Pages

- [Page G](subgroup/page-g.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir7/.mditerc"
cat > "$skill_dir7/subgroup/page-g.md" <<'EOF'
---
tags: [x]
summary: "Page G"
code-cites: []
---
# Page G

See [External Missing](../../other-skill/missing.md) for details — a
../-escaping link that resolves inside the repo root (outside the skill
dir), classifying external per AD2 and churn-checked (resolve-then-contain).
EOF
_git_commit "$group_repo" "commit1: group page" "2024-01-01T00:00:00"

rc=0; output=""
output=$(cd "$group_repo" && bash "$CHURN_CHECK" churn-group 2>&1) || rc=$?
assert_exit 1 "$rc" "group-subdir fixture: dead external link in a group-subdirectory page is flagged (BUG 1 two-tier enumeration fix)"

json_output=""
json_output=$(cd "$group_repo" && bash "$CHURN_CHECK" --json churn-group 2>/dev/null) || true
assert_contains "missing.md" "$json_output" "group-subdir fixture: JSON reports the dead target from the nested page"
assert_contains '"scope":"external"' "$json_output" "group-subdir fixture: ../-escaping target resolving inside repo root but outside skill dir classifies external"

# ============================================================
echo ""
echo "=== Group 13: internal CHANGED not flagged (AD3 — internal churn is not a churn signal) ==="
# ============================================================

internal_repo="$TMPDIR_ROOT/internal-repo"
_git_init_repo "$internal_repo"
skill_dir8="$internal_repo/.claude/skills/churn-internal"
mkdir -p "$skill_dir8"
cat > "$skill_dir8/SKILL.md" <<'EOF'
---
name: churn-internal
description: "internal CHANGED suppression fixture"
---

## Pages

- [Page I-A](page-i-a.md) — summary
- [Page I-B](page-i-b.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir8/.mditerc"
cat > "$skill_dir8/page-i-b.md" <<'EOF'
---
tags: [x]
summary: "Page I-B"
code-cites: []
---
# Page I-B
EOF
cat > "$skill_dir8/page-i-a.md" <<'EOF'
---
tags: [x]
summary: "Page I-A"
code-cites: []
---
# Page I-A

See [Page I-B](page-i-b.md) for more — an internal wiki-nav link.
EOF
_git_commit "$internal_repo" "commit1: page-i-a and page-i-b" "2024-01-01T00:00:00"
# Rewrite page-i-b AFTER page-i-a's own last-touch commit — internal wiki
# pages change constantly (every groom, every ingest); this must NOT trip
# CHANGED (AD3 — CHANGED-since-page-commit applies to external targets only).
cat >> "$skill_dir8/page-i-b.md" <<'EOF'

Edited content.
EOF
_git_commit "$internal_repo" "commit2: edit page-i-b" "2024-01-02T00:00:00"

rc=0; output=""
output=$(cd "$internal_repo" && bash "$CHURN_CHECK" churn-internal 2>&1) || rc=$?
assert_exit 0 "$rc" "internal fixture: churn-check exits 0 (internal-link target churn after page commit is not flagged, AD3)"

json_output=""
json_output=$(cd "$internal_repo" && bash "$CHURN_CHECK" --json churn-internal 2>/dev/null) || true
assert_contains '"targets":[]' "$json_output" "internal fixture: --json emits empty targets array (internal CHANGED suppressed)"

# ============================================================
echo ""
echo "=== Group 14: external CHANGED flagged (md-link kind, scope external) ==="
# ============================================================

extlink_repo="$TMPDIR_ROOT/extlink-repo"
_git_init_repo "$extlink_repo"
skill_dir9="$extlink_repo/.claude/skills/churn-extlink"
mkdir -p "$skill_dir9" "$extlink_repo/src"
cat > "$skill_dir9/SKILL.md" <<'EOF'
---
name: churn-extlink
description: "external md-link CHANGED fixture"
---

## Pages

- [Page EL](page-el.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir9/.mditerc"
cat > "$extlink_repo/src/lib.sh" <<'EOF'
#!/usr/bin/env bash
echo original
EOF
_git_commit "$extlink_repo" "commit1: lib.sh" "2024-01-01T00:00:00"

cat > "$skill_dir9/page-el.md" <<'EOF'
---
tags: [x]
summary: "Page EL"
code-cites: []
---
# Page EL

See [External Lib](../../../src/lib.sh) for the source.
EOF
_git_commit "$extlink_repo" "commit2: page-el" "2024-01-02T00:00:00"

cat > "$extlink_repo/src/lib.sh" <<'EOF'
#!/usr/bin/env bash
echo changed
EOF
_git_commit "$extlink_repo" "commit3: change lib.sh" "2024-01-03T00:00:00"

rc=0; output=""
output=$(cd "$extlink_repo" && bash "$CHURN_CHECK" churn-extlink 2>&1) || rc=$?
assert_exit 1 "$rc" "external md-link fixture: churn-check exits non-zero (external target churned after page commit)"

json_output=""
json_output=$(cd "$extlink_repo" && bash "$CHURN_CHECK" --json churn-extlink 2>/dev/null) || true
assert_contains '"kind":"md-link"' "$json_output" "external md-link fixture: JSON reports kind md-link"
assert_contains '"scope":"external"' "$json_output" "external md-link fixture: JSON reports scope external"
assert_contains "src/lib.sh" "$json_output" "external md-link fixture: JSON reports the churned target"

# ============================================================
echo ""
echo "=== Group 15: misscoped code-cite MISSING flagged ==="
# ============================================================

misscoped_repo="$TMPDIR_ROOT/misscoped-repo"
_git_init_repo "$misscoped_repo"
skill_dir10="$misscoped_repo/.claude/skills/churn-misscoped"
mkdir -p "$skill_dir10"
cat > "$skill_dir10/SKILL.md" <<'EOF'
---
name: churn-misscoped
description: "misscoped code-cite fixture"
---

## Pages

- [Page M](page-m.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir10/.mditerc"
cat > "$skill_dir10/page-m.md" <<'EOF'
---
tags: [x]
summary: "Page M"
code-cites: [src/does-not-exist.sh]
---
# Page M
EOF
_git_commit "$misscoped_repo" "commit1: page-m" "2024-01-01T00:00:00"

rc=0; output=""
output=$(cd "$misscoped_repo" && bash "$CHURN_CHECK" churn-misscoped 2>&1) || rc=$?
assert_exit 1 "$rc" "misscoped code-cite fixture: churn-check exits non-zero (dead code-cite flagged)"

json_output=""
json_output=$(cd "$misscoped_repo" && bash "$CHURN_CHECK" --json churn-misscoped 2>/dev/null) || true
assert_contains '"kind":"code-cite"' "$json_output" "misscoped code-cite fixture: JSON reports kind code-cite"
assert_contains '"scope":"external"' "$json_output" "misscoped code-cite fixture: code-cites are always scope external"
assert_contains "does-not-exist.sh" "$json_output" "misscoped code-cite fixture: JSON reports the misscoped/dead cite target"

# ============================================================
echo ""
echo "=== Group 16: no-realpath path — MSYS-safe pure-bash fallback ==="
# ============================================================

noreal_repo="$TMPDIR_ROOT/noreal-repo"
_git_init_repo "$noreal_repo"
skill_dir11="$noreal_repo/.claude/skills/churn-noreal"
mkdir -p "$skill_dir11/subgroup"
cat > "$skill_dir11/SKILL.md" <<'EOF'
---
name: churn-noreal
description: "no-realpath fixture"
---

## Pages

- [Page NR](subgroup/page-nr.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir11/.mditerc"
cat > "$skill_dir11/subgroup/page-nr.md" <<'EOF'
---
tags: [x]
summary: "Page NR"
code-cites: []
---
# Page NR

See [External Missing](../../other-skill/missing.md) for details.
EOF
_git_commit "$noreal_repo" "commit1: page-nr" "2024-01-01T00:00:00"

# PATH-shim realpath away: a directory earlier in PATH whose "realpath"
# always exits 1, simulating realpath failing silently (MSYS). _resolve_abs
# must fall back to pure-bash normalization (_normalize_path) and still
# classify the ../-containing target correctly (internal/external +
# containment) with no realpath on PATH.
shim_dir="$TMPDIR_ROOT/noreal-shim"
mkdir -p "$shim_dir"
cat > "$shim_dir/realpath" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod +x "$shim_dir/realpath"

rc=0; output=""
output=$(cd "$noreal_repo" && PATH="$shim_dir:$PATH" bash "$CHURN_CHECK" churn-noreal 2>&1) || rc=$?
assert_exit 1 "$rc" "no-realpath fixture: dead external link still flagged when realpath fails (pure-bash fallback)"

json_output=""
json_output=$(cd "$noreal_repo" && PATH="$shim_dir:$PATH" bash "$CHURN_CHECK" --json churn-noreal 2>/dev/null) || true
assert_contains "missing.md" "$json_output" "no-realpath fixture: JSON reports the dead target (fallback normalization worked)"
assert_contains '"scope":"external"' "$json_output" "no-realpath fixture: ../-escaping target still classifies external without realpath on PATH"

# ============================================================
echo ""
echo "=== Group 17: resolve-then-contain — escape resolving OUTSIDE repo root gets NO filesystem/git probe ==="
# ============================================================

trav2_repo="$TMPDIR_ROOT/trav2-repo"
_git_init_repo "$trav2_repo"
skill_dir12="$trav2_repo/.claude/skills/churn-trav2"
mkdir -p "$skill_dir12"
cat > "$skill_dir12/SKILL.md" <<'EOF'
---
name: churn-trav2
description: "resolve-then-contain no-probe fixture"
---

## Pages

- [Page T2](page-t2.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir12/.mditerc"
cat > "$skill_dir12/page-t2.md" <<'EOF'
---
tags: [x]
summary: "Page T2"
code-cites: []
---
# Page T2

See [Escape](../../../../secret-sentinel-should-not-be-probed.md) for
details — resolves outside CHURN_PROJECT_ROOT; must be rejected with NO
filesystem/git probe on it (resolve-then-contain).
EOF
_git_commit "$trav2_repo" "commit1: page-t2" "2024-01-01T00:00:00"

# git-trace shim: intercept every `git` invocation and log its argv, so we
# can assert git is never invoked with the rejected sentinel path — not
# just that it's absent from output, but that no probe was ever attempted
# (the existence-oracle security property the guard was added for).
real_git="$(command -v git)"
trace_dir="$TMPDIR_ROOT/trav2-shim"
mkdir -p "$trace_dir"
trace_log="$TMPDIR_ROOT/trav2-git-trace.log"
: > "$trace_log"
cat > "$trace_dir/git" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$trace_log"
exec "$real_git" "\$@"
EOF
chmod +x "$trace_dir/git"

rc=0; output=""
output=$(cd "$trav2_repo" && PATH="$trace_dir:$PATH" bash "$CHURN_CHECK" churn-trav2 2>&1) || rc=$?
assert_exit 0 "$rc" "resolve-then-contain fixture: churn-check exits 0 (escape target rejected, not flagged)"

json_output=""
json_output=$(cd "$trav2_repo" && PATH="$trace_dir:$PATH" bash "$CHURN_CHECK" --json churn-trav2 2>/dev/null) || true
assert_not_contains "secret-sentinel" "$json_output" "resolve-then-contain fixture: the escaped target never appears in output"

trace_content="$(cat "$trace_log" 2>/dev/null || true)"
assert_not_contains "secret-sentinel" "$trace_content" "resolve-then-contain fixture: git is never invoked with the escaped sentinel path (no probe outside project root)"

# ============================================================
echo ""
echo "=== Group 18: .mditerc exclude: page-walk filtering (mirrors wiki-health.sh) ==="
# ============================================================
#
# wiki-health-mditerc-exclude: churn-check's own page walk must honor the
# same .mditerc exclude: patterns as wiki-health.sh's census filter (own
# copy — see churn-check's _wiki_mditerc_exclude_patterns /
# _wiki_path_excluded). A page dropped by exclude: must never be scanned for
# code-cites or md-link targets at all — its churn is never even
# discovered, not merely suppressed after the fact.

mditerc_repo="$TMPDIR_ROOT/mditerc-repo"
_git_init_repo "$mditerc_repo"
skill_dir13="$mditerc_repo/.claude/skills/churn-mditerc-exclude"
mkdir -p "$skill_dir13"
cat > "$skill_dir13/SKILL.md" <<'EOF'
---
name: churn-mditerc-exclude
description: ".mditerc exclude: page-walk filtering fixture"
---

## Pages

- [Page A](page-a.md) — summary

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$skill_dir13/.mditerc"
cat > "$skill_dir13/page-a.md" <<'EOF'
---
tags: [x]
summary: "Page A"
code-cites: []
---
# Page A
EOF
cat > "$skill_dir13/bad.md" <<'EOF'
---
tags: [x]
summary: "Bad Page (unlisted, dangling code-cite)"
code-cites: [src/nonexistent-file.sh]
---
# Bad Page
EOF
_git_commit "$mditerc_repo" "commit1: initial (no exclude yet)" "2024-01-01T00:00:00"

# --- (a) baseline WITHOUT exclude: the page's dangling code-cite is
# flagged as churn (MISSING). ---
rc=0; output=""
output=$(cd "$mditerc_repo" && bash "$CHURN_CHECK" churn-mditerc-exclude 2>&1) || rc=$?
assert_exit 1 "$rc" ".mditerc exclude baseline: bad.md's dangling code-cite is flagged (churn found, no exclude yet)"
assert_contains "src/nonexistent-file.sh" "$output" ".mditerc exclude baseline: dangling code-cite target reported"

# --- (b) WITH exclude: bad.md added to .mditerc's exclude: list -> the same
# dangling code-cite is never scanned, churn-check reports clean. ---
printf 'entrypoint: SKILL.md\nexclude:\n  - bad.md\n' > "$skill_dir13/.mditerc"
_git_commit "$mditerc_repo" "commit2: exclude bad.md" "2024-01-02T00:00:00"

rc=0; output=""
output=$(cd "$mditerc_repo" && bash "$CHURN_CHECK" churn-mditerc-exclude 2>&1) || rc=$?
assert_exit 0 "$rc" ".mditerc exclude applied: churn-check exits clean once bad.md is excluded"
assert_not_contains "nonexistent-file.sh" "$output" ".mditerc exclude applied: the excluded page's dangling code-cite is never reported"

json_output=""
json_output=$(cd "$mditerc_repo" && bash "$CHURN_CHECK" --json churn-mditerc-exclude 2>/dev/null) || true
assert_contains '"targets":[]' "$json_output" ".mditerc exclude applied: JSON targets array is empty"

# ============================================================
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
