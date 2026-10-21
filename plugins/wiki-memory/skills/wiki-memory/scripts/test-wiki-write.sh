#!/usr/bin/env bash
# test-wiki-write.sh — Automated tests for wiki-write
# Run: bash test-wiki-write.sh
# All tests use temp directories cleaned up on exit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Fully isolate from the real user environment (dual-scope collision check
# reads $HOME/.claude/skills/...) — mirrors test-wiki-resolve.sh's convention.
export HOME="$TMPDIR_ROOT/fakehome"
mkdir -p "$HOME"

# --- Shared fixture files (payload sources) ---
FULL_PAYLOAD="$TMPDIR_ROOT/full-payload.md"
cat > "$FULL_PAYLOAD" <<'EOF'
---
tags: [test-expert/page-one]
summary: "A simple test page"
code-cites: []
---
# Page One

Some content.
EOF

FULL_PAYLOAD_V2="$TMPDIR_ROOT/full-payload-v2.md"
cat > "$FULL_PAYLOAD_V2" <<'EOF'
---
tags: [test-expert/page-one]
summary: "A simple test page, revised"
code-cites: []
---
# Page One

Revised content.
EOF

# A group index payload: carries the '## Pages' heading its leaves list under.
INDEX_PAYLOAD="$TMPDIR_ROOT/index-payload.md"
cat > "$INDEX_PAYLOAD" <<'EOF'
---
tags: [test-expert/index]
summary: "A simple test page"
---
# Group

## Pages
EOF

FRAGMENT="$TMPDIR_ROOT/fragment.md"
cat > "$FRAGMENT" <<'EOF'
New fragment line 1.
New fragment line 2.
EOF

# Fragment containing literal backslashes — a Windows path, a regex, an
# escaped shell character. Exercises the awk getline-from-file merge path
# (not `-v payload=...`) which must NOT reinterpret these as escape sequences.
BACKSLASH_FRAGMENT="$TMPDIR_ROOT/backslash-fragment.md"
cat > "$BACKSLASH_FRAGMENT" <<'EOF'
Windows path: C:\Users\radleta\dev.
Regex: match /\.md\)/ only markdown link targets.
Escaped char: \t is not a tab here, it is two literal characters.
EOF

# Helper: scaffold a minimal, fully triple-gate-valid domain at $1/.claude/skills/$2
_scaffold_domain() {
  local root="$1" domain="$2"
  mkdir -p "$root/.claude/skills/$domain"
  cat > "$root/.claude/skills/$domain/SKILL.md" <<EOF
---
name: ${domain}
description: "test domain"
---

## Pages

## Meta
EOF
  printf 'entrypoint: SKILL.md\n' > "$root/.claude/skills/$domain/.mditerc"
}

# Helper: scaffold a minimal, fully triple-gate-valid domain using the
# SUB-SECTIONED '### Standalone Pages' nav layout (the 4+ topic-group format
# described in SKILL.md's Page Conventions), for exercising the nav updater's
# other awk branch alongside _scaffold_domain's flat-list layout.
_scaffold_domain_substandalone() {
  local root="$1" domain="$2"
  mkdir -p "$root/.claude/skills/$domain"
  cat > "$root/.claude/skills/$domain/SKILL.md" <<EOF
---
name: ${domain}
description: "test domain (sub-sectioned nav layout)"
---

## Pages

### Topic Areas

### Standalone Pages

## Meta
EOF
  printf 'entrypoint: SKILL.md\n' > "$root/.claude/skills/$domain/.mditerc"
}

# ============================================================
echo "=== Group 1: create / update / collision / --update on absent slug ==="
# ============================================================

wt1="$TMPDIR_ROOT/wt1"
mkdir -p "$wt1/.claude/skills"
git init -q "$wt1"  # auto-init writes only inside a git work tree

# Create (auto-init, since test-expert does not exist yet)
rc=0; out=""
out=$(cd "$wt1" && bash "$WIKI_WRITE" test-expert page-one --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "create: exits 0"
assert_contains '"action":"created"' "$out" "create: JSON action=created"
assert_eq "yes" "$([[ -f "$wt1/.claude/skills/test-expert/page-one.md" ]] && echo yes || echo no)" "create: page file exists on disk"
assert_contains "page-one.md" "$(cat "$wt1/.claude/skills/test-expert/SKILL.md")" "create: ## Pages entry added to SKILL.md"
# wiki-write no longer keeps an operations log: a write must not create a
# log.md, and auto-init must not scaffold one. Asserted on the create path
# because that is the only path that ever created the file.
assert_eq "no" "$([[ -f "$wt1/.claude/skills/test-expert/log.md" ]] && echo yes || echo no)" "create: no log.md is created"

# Collision without --update
rc=0; out=""
out=$(cd "$wt1" && bash "$WIKI_WRITE" test-expert page-one --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_exit 2 "$rc" "collision without --update: exits 2"
assert_contains "slug collision" "$out" "collision without --update: error names the collision"
assert_contains "--update" "$out" "collision without --update: error suggests --update"

# Update with --update (payload has no '## ' headings itself; the existing page
# has none either, so there is nothing for the no-silent-section-loss guard to lose)
rc=0; out=""
out=$(cd "$wt1" && bash "$WIKI_WRITE" test-expert page-one --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "update: exits 0"
assert_contains '"action":"updated"' "$out" "update: JSON action=updated"
assert_contains "Revised content." "$(cat "$wt1/.claude/skills/test-expert/page-one.md")" "update: content replaced"
assert_eq "no" "$([[ -f "$wt1/.claude/skills/test-expert/log.md" ]] && echo yes || echo no)" "update: still no log.md"

# --update on an absent slug behaves as a plain create (no error)
rc=0; out=""
out=$(cd "$wt1" && bash "$WIKI_WRITE" test-expert page-never-existed --update --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "--update on absent slug: exits 0"
assert_contains '"action":"created"' "$out" "--update on absent slug: JSON action=created (not updated)"
assert_eq "no" "$([[ -f "$wt1/.claude/skills/test-expert/log.md" ]] && echo yes || echo no)" "--update on absent slug: still no log.md"

# ============================================================
echo ""
echo "=== Group 1b: concurrent nav-list read-modify-write race (wiki-write-nav-list-rmw-race) ==="
# ============================================================
# Replaces the old Group 1b, which fired 5 concurrent writers at the SAME
# slug and could not detect the nav-list race even in principle, since all 5
# writers produced identical content for the identical page. The real defect
# lives in the SKILL.md '## Pages' updater: an unguarded cross-process
# read -> awk-transform -> mv, so N concurrent CREATES of N DISTINCT slugs
# race on the SAME starting SKILL.md and all but the last mv to land are
# silently dropped from the nav list, even though every page file survives.
# Assert both invariants together -- N page files, N nav entries -- since a
# fix that only satisfies the page path (already true pre-fix) would still
# pass a partial check.

# --- (a) same-slug concurrency: several concurrent --update calls at the SAME
# slug must leave one intact page carrying the written payload and exactly one
# nav entry -- a lost or duplicated bullet is the failure this half guards.
# Distinct from (b)/(c) below, which target the nav race itself via DISTINCT
# slugs.
_same_slug_n=5
for _i in $(seq 1 "$_same_slug_n"); do
  (cd "$wt1" && bash "$WIKI_WRITE" test-expert page-one --update --from "$FULL_PAYLOAD_V2" >/dev/null 2>&1) &
done
wait
# All 5 write the same payload to the same slug, so the surviving page must
# carry that payload in full -- a torn or truncated page is a lost write.
assert_contains "Revised content." "$(cat "$wt1/.claude/skills/test-expert/page-one.md")" "concurrent same-slug updates: the page survives carrying the written payload"
# One bullet, not five: the nav updater must neither drop the entry nor add a
# duplicate under concurrency.
_same_slug_nav_count=$(grep -cF "](page-one.md)" "$wt1/.claude/skills/test-expert/SKILL.md" || true)
assert_eq "1" "$_same_slug_nav_count" "concurrent same-slug updates: exactly one page-one entry in ## Pages (none dropped, none duplicated)"

# --- (b) the actual regression: N concurrent CREATES of N DISTINCT slugs in
# one domain, flat '## Pages' layout. Pre-fix this reliably drops nav entries
# (measured 1/10 and 3/10 survivors across separate runs -- nondeterministic,
# so assert the exact expected count, never a range or a floor).
_race_n=10
wt9="$TMPDIR_ROOT/wt9"
mkdir -p "$wt9/.claude/skills"
_scaffold_domain "$wt9" "nav-race-flat-expert"

for _i in $(seq 1 "$_race_n"); do
  _race_payload="$TMPDIR_ROOT/nav-race-payload-flat-${_i}.md"
  cat > "$_race_payload" <<EOF
---
tags: [nav-race-flat-expert/race-slug-${_i}]
summary: "race slug ${_i}"
code-cites: []
---
# Race Slug ${_i}

Content for race slug ${_i}.
EOF
  (cd "$wt9" && bash "$WIKI_WRITE" nav-race-flat-expert "race-slug-${_i}" --from "$_race_payload" >/dev/null 2>&1) &
done
wait

_race_file_count=0
for _i in $(seq 1 "$_race_n"); do
  [[ -f "$wt9/.claude/skills/nav-race-flat-expert/race-slug-${_i}.md" ]] && _race_file_count=$((_race_file_count + 1))
done
assert_eq "$_race_n" "$_race_file_count" "nav race (flat layout): all $_race_n page files land on disk"

_race_nav_count=0
for _i in $(seq 1 "$_race_n"); do
  grep -qF "race-slug-${_i}.md" "$wt9/.claude/skills/nav-race-flat-expert/SKILL.md" && _race_nav_count=$((_race_nav_count + 1))
done
assert_eq "$_race_n" "$_race_nav_count" "nav race (flat layout): all $_race_n entries present in ## Pages -- the defect this test targets"

# --- (c) same race, but the sub-sectioned '### Standalone Pages' layout,
# since the defect is in both awk branches and a fix scoped to only the flat
# branch would otherwise still pass this test.
wt10="$TMPDIR_ROOT/wt10"
mkdir -p "$wt10/.claude/skills"
_scaffold_domain_substandalone "$wt10" "nav-race-sub-expert"

for _i in $(seq 1 "$_race_n"); do
  _race_payload="$TMPDIR_ROOT/nav-race-payload-sub-${_i}.md"
  cat > "$_race_payload" <<EOF
---
tags: [nav-race-sub-expert/race-slug-${_i}]
summary: "race slug ${_i}"
code-cites: []
---
# Race Slug ${_i}

Content for race slug ${_i}.
EOF
  (cd "$wt10" && bash "$WIKI_WRITE" nav-race-sub-expert "race-slug-${_i}" --from "$_race_payload" >/dev/null 2>&1) &
done
wait

_race_file_count=0
for _i in $(seq 1 "$_race_n"); do
  [[ -f "$wt10/.claude/skills/nav-race-sub-expert/race-slug-${_i}.md" ]] && _race_file_count=$((_race_file_count + 1))
done
assert_eq "$_race_n" "$_race_file_count" "nav race (sub-sectioned layout): all $_race_n page files land on disk"

_race_nav_count=0
for _i in $(seq 1 "$_race_n"); do
  grep -qF "race-slug-${_i}.md" "$wt10/.claude/skills/nav-race-sub-expert/SKILL.md" && _race_nav_count=$((_race_nav_count + 1))
done
assert_eq "$_race_n" "$_race_nav_count" "nav race (sub-sectioned layout): all $_race_n entries present under ### Standalone Pages"

# ============================================================
echo ""
echo "=== Group 1c: stale nav lock is broken, not wedged ==="
# ============================================================
# A crashed holder must not wedge the domain's nav updates permanently: a
# lock dir older than the stale threshold is broken and the write proceeds.
wt11="$TMPDIR_ROOT/wt11"
mkdir -p "$wt11/.claude/skills"
_scaffold_domain "$wt11" "nav-stale-expert"

_stale_lock_dir="$wt11/.claude/skills/nav-stale-expert/.wiki-write-nav.lock"
mkdir -p "$_stale_lock_dir"
printf '999999\n' > "$_stale_lock_dir/pid"
# Backdate well past the stale threshold (60s) -- 2 hours is unambiguous.
touch -d "2 hours ago" "$_stale_lock_dir"

_stale_payload="$TMPDIR_ROOT/nav-stale-payload.md"
cat > "$_stale_payload" <<'EOF'
---
tags: [nav-stale-expert/stale-slug]
summary: "page written against a pre-existing stale lock"
code-cites: []
---
# Stale Slug

Content.
EOF

rc=0; out=""
_stale_start="$(date +%s)"
out=$(cd "$wt11" && bash "$WIKI_WRITE" nav-stale-expert stale-slug --from "$_stale_payload" --json 2>&1) || rc=$?
_stale_elapsed=$(( $(date +%s) - _stale_start ))
assert_exit 0 "$rc" "stale lock: write still exits 0"
assert_eq "yes" "$([[ "$_stale_elapsed" -lt 10 ]] && echo yes || echo no)" "stale lock: write does not wait out the full acquisition timeout (completed in ${_stale_elapsed}s)"
assert_contains "stale-slug.md" "$(cat "$wt11/.claude/skills/nav-stale-expert/SKILL.md")" "stale lock: nav entry still inserted after breaking the stale lock"
assert_eq "no" "$([[ -d "$_stale_lock_dir" ]] && echo yes || echo no)" "stale lock: lock directory removed after the write completes (released on exit)"

# ============================================================
echo ""
echo "=== Group 2: --append-section ==="
# ============================================================

wt2="$TMPDIR_ROOT/wt2"
mkdir -p "$wt2/.claude/skills"
_scaffold_domain "$wt2" "append-expert"

# Fixture: two-section page, freshly seeded before each sub-test for isolation.
_seed_multi_page() {
  local target="$1"
  cat > "$target" <<'EOF'
---
tags: [append-expert/page-multi]
summary: "Multi-section page"
code-cites: []
---
# Page Multi

## Section A
Original A content.

## Section B
Original B content.
EOF
}

page_a="$wt2/.claude/skills/append-expert/page-multi-a.md"
_seed_multi_page "$page_a"
before_a="$(cat "$page_a")"

rc=0; out=""
out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-multi-a --append-section "Section A" --from "$FRAGMENT" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "append-section existing heading: exits 0"
assert_contains '"action":"appended"' "$out" "append-section existing heading: JSON action=appended"
after_a="$(cat "$page_a")"
assert_contains "New fragment line 1." "$after_a" "append-section existing heading: fragment content present"
assert_contains "Original B content." "$after_a" "append-section existing heading: Section B untouched"
assert_contains "tags: [append-expert/page-multi]" "$after_a" "append-section existing heading: frontmatter preserved"
# Fragment must land under Section A, before Section B (positional check).
pos_frag=$(grep -n "New fragment line 1." "$page_a" | head -1 | cut -d: -f1)
pos_b=$(grep -n "^## Section B" "$page_a" | head -1 | cut -d: -f1)
if [[ "$pos_frag" -lt "$pos_b" ]]; then
  pass "append-section existing heading: fragment inserted before Section B"
else
  fail "append-section existing heading: fragment inserted before Section B" "fragment at line $pos_frag, Section B at line $pos_b"
fi
# An --append-section write modifies a page and must still leave no operations
# log behind it -- the write path that used to log every action, appends included.
assert_eq "no" "$([[ -f "$wt2/.claude/skills/append-expert/log.md" ]] && echo yes || echo no)" "append-section existing heading: no log.md is created"

# New heading (not present yet) — creates the section at the end, existing sections untouched.
page_b="$wt2/.claude/skills/append-expert/page-multi-b.md"
_seed_multi_page "$page_b"
rc=0; out=""
out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-multi-b --append-section "Section C" --from "$FRAGMENT" 2>&1) || rc=$?
assert_exit 0 "$rc" "append-section new heading: exits 0"
after_b="$(cat "$page_b")"
assert_contains "## Section C" "$after_b" "append-section new heading: new heading created"
assert_contains "Original A content." "$after_b" "append-section new heading: Section A untouched"
assert_contains "Original B content." "$after_b" "append-section new heading: Section B untouched"

# Missing page: --append-section requires an EXISTING page.
rc=0; out=""
out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert does-not-exist --append-section "X" --from "$FRAGMENT" 2>&1) || rc=$?
assert_exit 2 "$rc" "append-section missing page: exits 2"
assert_contains "not found" "$out" "append-section missing page: error names the missing page"

# Fragment payload without frontmatter is accepted (not required for append-section).
rc=0
(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-multi-a --append-section "Section D" --from "$FRAGMENT" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "append-section: frontmatter-less fragment payload accepted"

# Fragment containing literal backslashes must survive byte-for-byte — the
# merge reads the payload via awk getline-from-file, not `-v payload=...`,
# specifically to avoid awk's -v backslash-escape reinterpretation.
page_bs="$wt2/.claude/skills/append-expert/page-multi-backslash.md"
_seed_multi_page "$page_bs"
rc=0; out=""
out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-multi-backslash --append-section "Section A" --from "$BACKSLASH_FRAGMENT" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "append-section backslash fragment: exits 0"
after_bs="$(cat "$page_bs")"
assert_contains 'C:\Users\radleta\dev.' "$after_bs" "append-section backslash fragment: Windows path preserved verbatim"
assert_contains 'match /\.md\)/ only markdown link targets.' "$after_bs" "append-section backslash fragment: regex preserved verbatim"
assert_contains '\t is not a tab here, it is two literal characters.' "$after_bs" "append-section backslash fragment: \\t not reinterpreted as a tab"

# --- CRLF pages ---
# A CRLF page must keep its line endings through a write, and its frontmatter
# must be readable at all. awk emits ORS per record and MSYS gawk strips the CR
# on input, so an unguarded merge rewrites every line of the file; the bash
# frontmatter walkers compare against a bare '---', which $'---\r' never
# matches, making the whole block invisible.

# Counts lines ending in CR and lines not ending in CR. `read` keeps the CR,
# which is why the count is taken this way rather than with grep — MSYS grep
# does not report a lone CR reliably.
_count_line_endings() {
  local f="$1" line crlf=0 lf=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == *$'\r' ]]; then crlf=$((crlf + 1)); else lf=$((lf + 1)); fi
  done < "$f"
  echo "$crlf $lf"
}

_seed_crlf_page() {
  printf '%s\r\n' \
    '---' \
    'tags: [append-expert/page-crlf]' \
    'summary: "CRLF page"' \
    'code-cites: []' \
    '---' \
    '# Page CRLF' \
    '' \
    '## Section A' \
    'Original A content.' \
    '' \
    '## Section B' \
    'Original B content.' > "$1"
}

page_crlf="$wt2/.claude/skills/append-expert/page-crlf.md"
_seed_crlf_page "$page_crlf"
rc=0
(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-crlf --append-section "Section A" --from "$FRAGMENT" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "append-section on a CRLF page: exits 0"
read -r _crlf_n _lf_n <<<"$(_count_line_endings "$page_crlf")"
assert_eq "0" "$_lf_n" "append-section on a CRLF page: no line was converted to bare LF"
after_crlf="$(cat "$page_crlf")"
assert_contains "Original B content." "$after_crlf" "append-section on a CRLF page: Section B untouched"
assert_contains "## Section A" "$after_crlf" "append-section on a CRLF page: target heading still present"
# Without this, every assertion above is satisfied by a merge that re-emits the
# page with the right ORS and never calls emit_payload() — a silent no-op.
assert_contains "New fragment line 1." "$after_crlf" "append-section on a CRLF page: fragment content merged"
assert_contains "New fragment line 2." "$after_crlf" "append-section on a CRLF page: whole fragment merged"

# The LF control: the same merge must not introduce CRs.
page_lf_ctl="$wt2/.claude/skills/append-expert/page-lf-control.md"
_seed_multi_page "$page_lf_ctl"
rc=0
(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-lf-control --append-section "Section A" --from "$FRAGMENT" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "append-section on an LF page: exits 0"
read -r _crlf_n _lf_n <<<"$(_count_line_endings "$page_lf_ctl")"
assert_eq "0" "$_crlf_n" "append-section on an LF page: no line gained a CR"

# A CRLF payload's required frontmatter fields must be found, not reported missing.
crlf_payload="$TMPDIR_ROOT/crlf-payload.md"
printf '%s\r\n' \
  '---' \
  'tags: [append-expert/page-crlf-update]' \
  'summary: "Updated via CRLF payload"' \
  '---' \
  '# Updated' \
  '' \
  'Body.' > "$crlf_payload"
page_crlf_up="$wt2/.claude/skills/append-expert/page-crlf-update.md"
_seed_crlf_page "$page_crlf_up"
rc=0; out=""
out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-crlf-update --from "$crlf_payload" --update --replace 2>&1) || rc=$?
assert_exit 0 "$rc" "--update from a CRLF payload: exits 0"
assert_not_contains "missing required frontmatter field" "$out" "--update from a CRLF payload: required fields are found"

# The last-verified quoting gate must still reject a bare value on a CRLF payload.
# Before the CR strip the gate read the block as absent and passed it through.
crlf_bare="$TMPDIR_ROOT/crlf-bare-lastverified.md"
printf '%s\r\n' \
  '---' \
  'tags: [append-expert/page-crlf-bare]' \
  'summary: "Bare last-verified"' \
  'last-verified: 2026-01-01' \
  '---' \
  '# Bare' > "$crlf_bare"
rc=0; out=""
out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-crlf-bare --from "$crlf_bare" 2>&1) || rc=$?
assert_exit 2 "$rc" "CRLF payload with a bare last-verified: rejected"
assert_contains "last-verified" "$out" "CRLF payload with a bare last-verified: error names the field"

# The page-kind gate reads its value through _read_frontmatter_field, the third
# walker. SKILL.md states a typo must not silently fall back to `reference`,
# because the fallback is what the rubric binds on. Pre-fix, a CRLF payload
# defeated the gate by making the whole frontmatter block unreadable.
crlf_badkind="$TMPDIR_ROOT/crlf-bad-page-kind.md"
printf '%s\r\n' \
  '---' \
  'tags: [append-expert/page-crlf-badkind]' \
  'summary: "Misspelled page-kind"' \
  'page-kind: refrence' \
  '---' \
  '# Bad kind' > "$crlf_badkind"
rc=0; out=""
out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-crlf-badkind --from "$crlf_badkind" 2>&1) || rc=$?
assert_exit 2 "$rc" "CRLF payload with a misspelled page-kind: rejected, not silently defaulted"
assert_contains "page-kind" "$out" "CRLF payload with a misspelled page-kind: error names the field"

# --- Dual-scope collision guard ---
# The guard refuses a project-scope write when the same slug also exists at user
# scope, and skips itself when both paths name the SAME file. Comparing realpath
# output cannot tell those apart on MSYS, which preserves the input path's style:
# one file reached as D:/repo/... and via $HOME yields two spellings that never
# string-match, so every project-scope write in a junctioned repo was refused.
# The guard now compares device and inode. Both legs are asserted: the refusal
# must still fire on two genuinely distinct files, and must not fire on one.
dual_payload="$TMPDIR_ROOT/dual-payload.md"
cat > "$dual_payload" <<'EOF'
---
tags: [append-expert/page-dual]
summary: "Dual-scope probe"
---
# Dual
EOF

# Positive leg: two distinct files at the two scopes must still be refused.
mkdir -p "$HOME/.claude/skills/append-expert"
printf 'user-scope copy, different bytes\n' > "$HOME/.claude/skills/append-expert/page-dual.md"
printf 'project-scope copy, different bytes\n' > "$wt2/.claude/skills/append-expert/page-dual.md"
rc=0; out=""
out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-dual --from "$dual_payload" --update --replace 2>&1) || rc=$?
assert_exit 2 "$rc" "dual-scope guard: two distinct files at both scopes are refused"
assert_contains "dual-scope collision" "$out" "dual-scope guard: error names the collision"

# Negative leg: one file reached through both scopes must NOT be refused.
# ln -s copies rather than links on an MSYS shell without winsymlinks, so the
# leg runs only where a real link was created.
printf 'shared file\n' > "$wt2/.claude/skills/append-expert/page-dual-same.md"
ln -s "$wt2/.claude/skills/append-expert/page-dual-same.md" \
      "$HOME/.claude/skills/append-expert/page-dual-same.md" 2>/dev/null || true
if [[ -L "$HOME/.claude/skills/append-expert/page-dual-same.md" ]]; then
  rc=0; out=""
  out=$(cd "$wt2" && bash "$WIKI_WRITE" append-expert page-dual-same --from "$dual_payload" --update --replace 2>&1) || rc=$?
  assert_exit 0 "$rc" "dual-scope guard: one file reached through both scopes is not refused"
  assert_not_contains "dual-scope collision" "$out" "dual-scope guard: no collision reported for the same file"
else
  echo "  SKIP: dual-scope guard same-file leg (no real symlink support here)"
fi

# Worktree leg: ~/.claude/skills links to the main checkout's skills while the
# session works in a linked worktree, so every page has a twin that is a
# different file at the same repo path. That is one page, written in the
# worktree; the same layout in an unrelated repo still refuses. Each case gets
# its own HOME so the user-scope link does not disturb the shared fake HOME.
ds_main="$TMPDIR_ROOT/ds-main"
ds_lane="$TMPDIR_ROOT/ds-lane"
ds_other="$TMPDIR_ROOT/ds-other"
for _r in "$ds_main" "$ds_other"; do
  _scaffold_domain "$_r" "append-expert"
  printf 'committed copy\n' > "$_r/.claude/skills/append-expert/page-dual.md"
  git init -q "$_r"
  git -C "$_r" add -A
  git -C "$_r" -c user.email=t@t -c user.name=T commit -qm fixture
done
git -C "$ds_main" worktree add -q "$ds_lane" 2>/dev/null
ds_home_wt="$TMPDIR_ROOT/ds-home-wt"
ds_home_other="$TMPDIR_ROOT/ds-home-other"
mkdir -p "$ds_home_wt/.claude" "$ds_home_other/.claude"
ln -s "$ds_main/.claude/skills" "$ds_home_wt/.claude/skills" 2>/dev/null || true
ln -s "$ds_other/.claude/skills" "$ds_home_other/.claude/skills" 2>/dev/null || true
if [[ -L "$ds_home_wt/.claude/skills" && -f "$ds_lane/.claude/skills/append-expert/page-dual.md" ]]; then
  rc=0; out=""
  out=$(cd "$ds_lane" && HOME="$ds_home_wt" bash "$WIKI_WRITE" append-expert page-dual --from "$dual_payload" --update --replace 2>&1) || rc=$?
  assert_exit 0 "$rc" "dual-scope guard: one repo path in two worktrees of one repo is not refused"
  assert_contains "# Dual" "$(cat "$ds_lane/.claude/skills/append-expert/page-dual.md")" \
    "dual-scope guard: the worktree write lands in the project-scope (worktree) copy"
  assert_eq "committed copy" "$(cat "$ds_main/.claude/skills/append-expert/page-dual.md")" \
    "dual-scope guard: the worktree write leaves the main checkout's copy untouched"

  rc=0; out=""
  out=$(cd "$ds_lane" && HOME="$ds_home_other" bash "$WIKI_WRITE" append-expert page-dual --from "$dual_payload" --update --replace 2>&1) || rc=$?
  assert_exit 2 "$rc" "dual-scope guard: the same repo path in an unrelated repo is still refused"
  assert_contains "dual-scope collision" "$out" "dual-scope guard: unrelated-repo twin names the collision"
else
  echo "  SKIP: dual-scope guard worktree leg (no symlink or worktree support here)"
fi

# ============================================================
echo ""
echo "=== Group 3: soft clobber guard on --update / --replace override ==="
# ============================================================

wt3="$TMPDIR_ROOT/wt3"
mkdir -p "$wt3/.claude/skills"
_scaffold_domain "$wt3" "clobber-expert"

guard_page="$wt3/.claude/skills/clobber-expert/page-guard.md"
cat > "$guard_page" <<'EOF'
---
tags: [clobber-expert/page-guard]
summary: "Guarded page"
code-cites: []
---
# Page Guard

## Section X
X content.

## Section Y
Y content.
EOF
before_guard="$(cat "$guard_page")"

no_overlap_payload="$TMPDIR_ROOT/no-overlap-payload.md"
cat > "$no_overlap_payload" <<'EOF'
---
tags: [clobber-expert/page-guard]
summary: "Replaced page"
code-cites: []
---
# Replaced

Totally different content, no shared headings.
EOF

# Refuses a destructive whole-page --update
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-guard --update --from "$no_overlap_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "soft clobber guard: refuses non-overlapping --update, exits 2"
assert_contains "--append-section" "$out" "soft clobber guard: error suggests --append-section"
assert_contains "--replace" "$out" "soft clobber guard: error suggests --replace"
assert_eq "$before_guard" "$(cat "$guard_page")" "soft clobber guard: page content unchanged after refusal"

# --replace overrides the guard
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-guard --update --replace --from "$no_overlap_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "--replace override: exits 0"
assert_contains '"action":"updated"' "$out" "--replace override: JSON action=updated"
assert_contains "Totally different content" "$(cat "$guard_page")" "--replace override: content fully replaced"

# No-silent-section-loss invariant: payload sharing SOME but not ALL existing
# headings must now be refused — sharing "Section X" is not enough when
# "Section Y" would still be silently dropped.
shared_page="$wt3/.claude/skills/clobber-expert/page-shared.md"
cat > "$shared_page" <<'EOF'
---
tags: [clobber-expert/page-shared]
summary: "Shared-heading page"
code-cites: []
---
# Page Shared

## Section X
Old X.

## Section Y
Old Y.
EOF
before_shared="$(cat "$shared_page")"
shared_payload="$TMPDIR_ROOT/shared-payload.md"
cat > "$shared_payload" <<'EOF'
---
tags: [clobber-expert/page-shared]
summary: "Shared-heading page, revised"
code-cites: []
---
# Page Shared

## Section X
New X, but heading matches.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-shared --update --from "$shared_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "no-silent-section-loss guard: partial-heading-overlap --update refuses, exits 2"
assert_contains "Section Y" "$out" "no-silent-section-loss guard: error names the specific lost heading"
assert_contains "--append-section" "$out" "no-silent-section-loss guard: partial-overlap error suggests --append-section"
assert_contains "--replace" "$out" "no-silent-section-loss guard: partial-overlap error suggests --replace"
assert_eq "$before_shared" "$(cat "$shared_page")" "no-silent-section-loss guard: partial-overlap page content unchanged after refusal"

# --replace forces past the partial-overlap refusal.
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-shared --update --replace --from "$shared_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "no-silent-section-loss guard: --replace forces past partial-overlap refusal, exits 0"
assert_contains '"action":"updated"' "$out" "no-silent-section-loss guard: --replace partial-overlap JSON action=updated"
after_shared="$(cat "$shared_page")"
assert_contains "New X, but heading matches." "$after_shared" "no-silent-section-loss guard: --replace partial-overlap applies payload content"
assert_not_contains "Old Y." "$after_shared" "no-silent-section-loss guard: --replace partial-overlap intentionally drops Section Y"

# Guard now fires even when the existing page has only ONE H2 section — this
# is the exact hole that let the reproduced incident happen (a freshly-created
# single-section page's --update went unguarded under the old 2+-section
# threshold).
single_page="$wt3/.claude/skills/clobber-expert/page-single.md"
cat > "$single_page" <<'EOF'
---
tags: [clobber-expert/page-single]
summary: "Single-section page"
code-cites: []
---
# Page Single

## Only Section
Content.
EOF
before_single="$(cat "$single_page")"
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-single --update --from "$no_overlap_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "no-silent-section-loss guard: single-section page --update refuses without --replace, exits 2"
assert_contains "Only Section" "$out" "no-silent-section-loss guard: single-section error names the lost heading"
assert_eq "$before_single" "$(cat "$single_page")" "no-silent-section-loss guard: single-section page content unchanged after refusal"

# --replace forces past the single-section refusal.
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-single --update --replace --from "$no_overlap_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "no-silent-section-loss guard: --replace forces past single-section refusal, exits 0"
assert_contains "Totally different content" "$(cat "$single_page")" "no-silent-section-loss guard: --replace single-section content fully replaced"

# Exact-heading-match allow: payload carries exactly the same headings as the
# existing page (content within each section may differ) — no headings lost.
exact_page="$wt3/.claude/skills/clobber-expert/page-exact.md"
cat > "$exact_page" <<'EOF'
---
tags: [clobber-expert/page-exact]
summary: "Exact-heading-match page"
code-cites: []
---
# Page Exact

## Section X
Old X.

## Section Y
Old Y.
EOF
exact_payload="$TMPDIR_ROOT/exact-payload.md"
cat > "$exact_payload" <<'EOF'
---
tags: [clobber-expert/page-exact]
summary: "Exact-heading-match page, revised"
code-cites: []
---
# Page Exact

## Section X
Revised X content.

## Section Y
Revised Y content.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-exact --update --from "$exact_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "no-silent-section-loss guard: exact-heading-match --update succeeds without --replace"
assert_contains '"action":"updated"' "$out" "no-silent-section-loss guard: exact-heading-match JSON action=updated"
after_exact="$(cat "$exact_page")"
assert_contains "Revised X content." "$after_exact" "no-silent-section-loss guard: exact-heading-match Section X updated"
assert_contains "Revised Y content." "$after_exact" "no-silent-section-loss guard: exact-heading-match Section Y updated"

# Payload-superset allow: payload carries every existing heading PLUS a new
# one — no existing heading is lost, so the guard does not fire.
superset_page="$wt3/.claude/skills/clobber-expert/page-superset.md"
cat > "$superset_page" <<'EOF'
---
tags: [clobber-expert/page-superset]
summary: "Payload-superset page"
code-cites: []
---
# Page Superset

## Section X
Old X.

## Section Y
Old Y.
EOF
superset_payload="$TMPDIR_ROOT/superset-payload.md"
cat > "$superset_payload" <<'EOF'
---
tags: [clobber-expert/page-superset]
summary: "Payload-superset page, revised"
code-cites: []
---
# Page Superset

## Section X
Revised X content.

## Section Y
Revised Y content.

## Section Z
Brand new section.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-superset --update --from "$superset_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "no-silent-section-loss guard: payload-superset --update succeeds without --replace"
assert_contains '"action":"updated"' "$out" "no-silent-section-loss guard: payload-superset JSON action=updated"
after_superset="$(cat "$superset_page")"
assert_contains "Revised X content." "$after_superset" "no-silent-section-loss guard: payload-superset Section X updated"
assert_contains "Revised Y content." "$after_superset" "no-silent-section-loss guard: payload-superset Section Y updated"
assert_contains "## Section Z" "$after_superset" "no-silent-section-loss guard: payload-superset new Section Z present"

# ---- Substring-match bypass regression tests (issue:
# wiki-write-guard-substring-match-bypass) — the retired grep -qF loop
# treated any bare heading text appearing ANYWHERE in the payload as
# "carried", whether it was a real heading, an emptied section, or a passing
# mention in prose. These ten cases pin the heading+body parser that
# replaced it (MISSING / EMPTIED / SHRUNK legs, fence-awareness, CRLF, and
# H3-nesting). ----

# Case A (issue verbatim): payload keeps both headings but wipes their bodies.
case_a_page="$wt3/.claude/skills/clobber-expert/page-case-a.md"
cat > "$case_a_page" <<'EOF'
---
tags: [clobber-expert/page-case-a]
summary: "Case A source page"
code-cites: []
---

## Background

Critical background content that must survive.

## Usage

Critical usage content that must survive.
EOF
before_case_a="$(cat "$case_a_page")"
case_a_payload="$TMPDIR_ROOT/case-a-payload.md"
cat > "$case_a_payload" <<'EOF'
---
tags: [clobber-expert/page-case-a]
summary: "gutted"
---

## Background

## Usage
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-case-a --update --from "$case_a_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "substring-bypass Case A: emptied-body --update refuses, exits 2"
assert_contains "Background" "$out" "substring-bypass Case A: error names Background"
assert_contains "Usage" "$out" "substring-bypass Case A: error names Usage"
assert_contains "--append-section" "$out" "substring-bypass Case A: error suggests --append-section"
assert_contains "--replace" "$out" "substring-bypass Case A: error suggests --replace"
assert_eq "$before_case_a" "$(cat "$case_a_page")" "substring-bypass Case A: page content unchanged after refusal"

rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-case-a --update --replace --from "$case_a_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "substring-bypass Case A + --replace: forces past refusal, exits 0"
assert_contains '"action":"updated"' "$out" "substring-bypass Case A + --replace: JSON action=updated"
assert_not_contains "Critical background content" "$(cat "$case_a_page")" "substring-bypass Case A + --replace: body content actually gone"

# Case B (issue verbatim): headings appear only as prose in an unrelated section.
case_b_page="$wt3/.claude/skills/clobber-expert/page-case-b.md"
cat > "$case_b_page" <<'EOF'
---
tags: [clobber-expert/page-case-b]
summary: "Case B source page"
code-cites: []
---

## Background

Critical background content that must survive.

## Usage

Critical usage content that must survive.
EOF
before_case_b="$(cat "$case_b_page")"
case_b_payload="$TMPDIR_ROOT/case-b-payload.md"
cat > "$case_b_payload" <<'EOF'
---
tags: [clobber-expert/page-case-b]
summary: "unrelated"
---

## Notes

This page used to discuss ## Background and ## Usage but no longer does.
Completely unrelated replacement content.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-case-b --update --from "$case_b_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "substring-bypass Case B: prose-only-mention --update refuses, exits 2"
assert_contains "Background" "$out" "substring-bypass Case B: error names Background"
assert_contains "Usage" "$out" "substring-bypass Case B: error names Usage"
assert_eq "$before_case_b" "$(cat "$case_b_page")" "substring-bypass Case B: page content unchanged after refusal"

rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-case-b --update --replace --from "$case_b_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "substring-bypass Case B + --replace: forces past refusal, exits 0"
assert_contains "## Notes" "$(cat "$case_b_page")" "substring-bypass Case B + --replace: payload applied"

# Fence-awareness: payload carries '## Background' only inside a fenced code
# block — a fenced heading does not count as carrying it.
fence_page="$wt3/.claude/skills/clobber-expert/page-fence.md"
cat > "$fence_page" <<'EOF'
---
tags: [clobber-expert/page-fence]
summary: "Fence source page"
code-cites: []
---

## Background

Fence background body.

## Usage

Fence usage body.
EOF
before_fence="$(cat "$fence_page")"
fence_payload="$TMPDIR_ROOT/fence-payload.md"
cat > "$fence_payload" <<'EOF'
---
tags: [clobber-expert/page-fence]
summary: "Fence payload"
code-cites: []
---

## Usage

Fence usage body retained.

```
## Background
This heading is inside a fenced code block and must not count as carrying it.
```
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-fence --update --from "$fence_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "fence-awareness: fenced heading does not satisfy the guard, refuses exit 2"
assert_contains "Background" "$out" "fence-awareness: error names Background"
assert_eq "$before_fence" "$(cat "$fence_page")" "fence-awareness: page content unchanged after refusal"

# Threshold fixtures: a 400-non-whitespace-char body ($_shrink_x400) and two
# replacements — a moderate condensation to 250 chars (above the 25% floor,
# must NOT false-refuse) and a catastrophic shrink to 15 chars (below the
# floor, must refuse).
_shrink_x400="$(printf 'x%.0s' $(seq 1 400))"
_shrink_y250="$(printf 'y%.0s' $(seq 1 250))"
_shrink_y15="$(printf 'y%.0s' $(seq 1 15))"

# Moderate condensation above the SHRUNK threshold: exit 0, no false refusal.
shrink_ok_page="$wt3/.claude/skills/clobber-expert/page-shrink-ok.md"
cat > "$shrink_ok_page" <<EOF
---
tags: [clobber-expert/page-shrink-ok]
summary: "Shrink-ok source page"
code-cites: []
---

## Background

${_shrink_x400}

## Usage

Stable usage body.
EOF
shrink_ok_payload="$TMPDIR_ROOT/shrink-ok-payload.md"
cat > "$shrink_ok_payload" <<EOF
---
tags: [clobber-expert/page-shrink-ok]
summary: "Shrink-ok payload"
code-cites: []
---

## Background

${_shrink_y250}

## Usage

Stable usage body.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-shrink-ok --update --from "$shrink_ok_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "SHRUNK leg: moderate condensation above threshold does not false-refuse"
assert_contains '"action":"updated"' "$out" "SHRUNK leg: moderate condensation JSON action=updated"

# Catastrophic shrink under the SHRUNK threshold: refuses exit 2, names the section.
catastrophic_page="$wt3/.claude/skills/clobber-expert/page-catastrophic.md"
cat > "$catastrophic_page" <<EOF
---
tags: [clobber-expert/page-catastrophic]
summary: "Catastrophic-shrink source page"
code-cites: []
---

## Background

${_shrink_x400}

## Usage

Stable usage body.
EOF
before_catastrophic="$(cat "$catastrophic_page")"
catastrophic_payload="$TMPDIR_ROOT/catastrophic-payload.md"
cat > "$catastrophic_payload" <<EOF
---
tags: [clobber-expert/page-catastrophic]
summary: "Catastrophic-shrink payload"
code-cites: []
---

## Background

${_shrink_y15}

## Usage

Stable usage body.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-catastrophic --update --from "$catastrophic_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "SHRUNK leg: catastrophic shrink below threshold refuses, exits 2"
assert_contains "Background" "$out" "SHRUNK leg: error names the shrunk section"
assert_eq "$before_catastrophic" "$(cat "$catastrophic_page")" "SHRUNK leg: page content unchanged after refusal"

# CRLF existing page + LF payload carrying the same headings and comparable
# bodies — regression guard against the \r-stripping fix reintroducing a
# false refusal via the anchoring change.
crlf_page="$wt3/.claude/skills/clobber-expert/page-crlf.md"
printf -- '---\r\ntags: [clobber-expert/page-crlf]\r\nsummary: "CRLF source page"\r\ncode-cites: []\r\n---\r\n\r\n## Background\r\n\r\nCRLF background body.\r\n\r\n## Usage\r\n\r\nCRLF usage body.\r\n' > "$crlf_page"
crlf_payload="$TMPDIR_ROOT/crlf-payload.md"
cat > "$crlf_payload" <<'EOF'
---
tags: [clobber-expert/page-crlf]
summary: "CRLF payload"
code-cites: []
---

## Background

CRLF background body.

## Usage

CRLF usage body, revised slightly but comparable.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-crlf --update --from "$crlf_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "CRLF regression: CRLF existing page + LF payload with matching headings does not false-refuse"
assert_contains '"action":"updated"' "$out" "CRLF regression: JSON action=updated"

# ### subsection stays inside its parent H2 body: renaming/rewording a '### '
# nested heading must not itself be demanded as a top-level heading.
h3_page="$wt3/.claude/skills/clobber-expert/page-h3.md"
cat > "$h3_page" <<'EOF'
---
tags: [clobber-expert/page-h3]
summary: "H3-nesting source page"
code-cites: []
---

## Background

Intro paragraph with details.

### Sub

Nested detail content here providing extra depth.

## Usage

Usage body.
EOF
h3_payload="$TMPDIR_ROOT/h3-payload.md"
cat > "$h3_payload" <<'EOF'
---
tags: [clobber-expert/page-h3]
summary: "H3-nesting payload"
code-cites: []
---

## Background

Intro paragraph with details, revised slightly.

### Details

Nested detail content here providing extra depth, reworded.

## Usage

Usage body.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-h3 --update --from "$h3_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "H3-nesting: payload renaming a nested ### heading is not demanded as a top-level heading, exits 0"
assert_contains '"action":"updated"' "$out" "H3-nesting: JSON action=updated"

# Existing page with zero '## ' headings: --update still proceeds unguarded.
zero_h2_page="$wt3/.claude/skills/clobber-expert/page-zero-h2.md"
cat > "$zero_h2_page" <<'EOF'
---
tags: [clobber-expert/page-zero-h2]
summary: "Zero-H2 source page"
code-cites: []
---
# Zero H2 Page

Just prose here, no H2 sections at all.
EOF
zero_h2_payload="$TMPDIR_ROOT/zero-h2-payload.md"
cat > "$zero_h2_payload" <<'EOF'
---
tags: [clobber-expert/page-zero-h2]
summary: "Zero-H2 payload"
code-cites: []
---
# Zero H2 Page, Replaced

Completely different prose, still no H2 sections.
EOF
rc=0; out=""
out=$(cd "$wt3" && bash "$WIKI_WRITE" clobber-expert page-zero-h2 --update --from "$zero_h2_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "zero-H2 page: --update proceeds unguarded regardless of payload content, exits 0"
assert_contains '"action":"updated"' "$out" "zero-H2 page: JSON action=updated"

# ============================================================
echo ""
echo "=== Group 4: auto-init partial-gate cases (a)(b)(c) — no content destruction ==="
# ============================================================

wt4="$TMPDIR_ROOT/wt4"
mkdir -p "$wt4/.claude/skills"
git init -q "$wt4"  # auto-init writes only inside a git work tree

# (a) SKILL.md absent entirely -> auto-init scaffold is correct behavior.
rc=0; out=""
out=$(cd "$wt4" && bash "$WIKI_WRITE" gate-a-expert page-one --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_exit 0 "$rc" "gate (a) SKILL.md absent: auto-init succeeds, exits 0"
assert_eq "yes" "$([[ -f "$wt4/.claude/skills/gate-a-expert/SKILL.md" ]] && echo yes || echo no)" "gate (a): SKILL.md scaffolded"

# (b) SKILL.md exists but lacks ## Pages (gate 2 fails) — must NOT overwrite.
mkdir -p "$wt4/.claude/skills/gate-b-expert"
cat > "$wt4/.claude/skills/gate-b-expert/SKILL.md" <<'EOF'
---
name: gate-b-expert
description: "Custom hand-authored description that must NOT be destroyed"
---

# Gate B Expert

Custom body content. No Pages heading yet.
EOF
before_b="$(cat "$wt4/.claude/skills/gate-b-expert/SKILL.md")"
rc=0; out=""
out=$(cd "$wt4" && bash "$WIKI_WRITE" gate-b-expert page-one --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_exit 3 "$rc" "gate (b) missing ## Pages: refuses to clobber, exits 3"
assert_contains "gate 2" "$out" "gate (b): error names gate 2"
assert_contains "## Pages" "$out" "gate (b): error mentions the missing heading"
assert_eq "$before_b" "$(cat "$wt4/.claude/skills/gate-b-expert/SKILL.md")" "gate (b): SKILL.md content NOT destroyed"

# (c) SKILL.md + ## Pages exist but .mditerc is missing (gate 3 fails) — must NOT overwrite.
mkdir -p "$wt4/.claude/skills/gate-c-expert"
cat > "$wt4/.claude/skills/gate-c-expert/SKILL.md" <<'EOF'
---
name: gate-c-expert
description: "Custom hand-authored description 2 that must NOT be destroyed"
---

## Pages

- [bar](bar.md) — existing page
EOF
before_c="$(cat "$wt4/.claude/skills/gate-c-expert/SKILL.md")"
rc=0; out=""
out=$(cd "$wt4" && bash "$WIKI_WRITE" gate-c-expert page-one --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_exit 3 "$rc" "gate (c) missing .mditerc: refuses to clobber, exits 3"
assert_contains "gate 3" "$out" "gate (c) missing .mditerc: error names gate 3"
assert_contains ".mditerc" "$out" "gate (c) missing .mditerc: error mentions .mditerc"
assert_eq "$before_c" "$(cat "$wt4/.claude/skills/gate-c-expert/SKILL.md")" "gate (c) missing .mditerc: SKILL.md content NOT destroyed"

# (c) variant: .mditerc present but wrong entrypoint (gate 3 fails differently) — must NOT overwrite.
mkdir -p "$wt4/.claude/skills/gate-c2-expert"
cat > "$wt4/.claude/skills/gate-c2-expert/SKILL.md" <<'EOF'
---
name: gate-c2-expert
description: "Custom hand-authored description 3 that must NOT be destroyed"
---

## Pages

- [bar](bar.md) — existing page
EOF
printf 'entrypoint: index.md\n' > "$wt4/.claude/skills/gate-c2-expert/.mditerc"
before_c2="$(cat "$wt4/.claude/skills/gate-c2-expert/SKILL.md")"
rc=0; out=""
out=$(cd "$wt4" && bash "$WIKI_WRITE" gate-c2-expert page-one --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_exit 3 "$rc" "gate (c) wrong entrypoint: refuses to clobber, exits 3"
assert_contains "gate 3" "$out" "gate (c) wrong entrypoint: error names gate 3"
assert_eq "$before_c2" "$(cat "$wt4/.claude/skills/gate-c2-expert/SKILL.md")" "gate (c) wrong entrypoint: SKILL.md content NOT destroyed"

# ============================================================
echo ""
echo "=== Group 5: unknown-flag rejection ==="
# ============================================================

wt5="$TMPDIR_ROOT/wt5"
mkdir -p "$wt5/.claude/skills"
rc=0; out=""
out=$(cd "$wt5" && bash "$WIKI_WRITE" test-expert page-one --bogus-flag --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_exit 2 "$rc" "unknown flag: exits 2"
assert_contains "unknown option" "$out" "unknown flag: error names it"

# ============================================================
echo ""
echo "=== Group 6: exit-code discipline (2 vs 3) ==="
# ============================================================

wt6="$TMPDIR_ROOT/wt6"
mkdir -p "$wt6/.claude/skills"
git init -q "$wt6"  # auto-init writes only inside a git work tree

# Missing required --from -> user error (2)
rc=0; (cd "$wt6" && bash "$WIKI_WRITE" test-expert page-one 2>/dev/null) || rc=$?
assert_exit 2 "$rc" "missing --from: exits 2"

# --from pointing at a nonexistent file -> infra error (3)
rc=0; (cd "$wt6" && bash "$WIKI_WRITE" test-expert page-one --from "$TMPDIR_ROOT/does-not-exist.md" 2>/dev/null) || rc=$?
assert_exit 3 "$rc" "--from nonexistent file: exits 3"

# Payload with tags+summary but NO code-cites: tolerated, no longer
# required (AD1/AD9) — succeeds, exits 0.
no_cites_fm="$TMPDIR_ROOT/no-cites-frontmatter.md"
cat > "$no_cites_fm" <<'EOF'
---
tags: [test-expert/no-cites]
summary: "No code-cites field at all"
---
# No Cites
EOF
rc=0; out=""
out=$(cd "$wt6" && bash "$WIKI_WRITE" test-expert page-no-cites --from "$no_cites_fm" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "payload missing code-cites (tags+summary present): succeeds, exits 0 (AD1/AD9)"
assert_contains '"action":"created"' "$out" "payload missing code-cites: JSON action=created"

# Payload WITH code-cites: still succeeds — tolerated, not required (AD9).
with_cites_fm="$TMPDIR_ROOT/with-cites-frontmatter.md"
cat > "$with_cites_fm" <<'EOF'
---
tags: [test-expert/with-cites]
summary: "Has a legacy code-cites field"
code-cites: []
---
# With Cites
EOF
rc=0; out=""
out=$(cd "$wt6" && bash "$WIKI_WRITE" test-expert page-with-cites --from "$with_cites_fm" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "payload WITH code-cites: still succeeds, exits 0 (tolerated)"
assert_contains '"action":"created"' "$out" "payload with code-cites: JSON action=created"
assert_contains "code-cites: []" "$(cat "$wt6/.claude/skills/test-expert/page-with-cites.md")" "payload with code-cites: field passed through verbatim (not stripped)"

# Payload missing summary -> still a required field, exits 2.
missing_summary_fm="$TMPDIR_ROOT/missing-summary-frontmatter.md"
cat > "$missing_summary_fm" <<'EOF'
---
tags: [test-expert/bad-summary]
---
# Bad
EOF
rc=0; (cd "$wt6" && bash "$WIKI_WRITE" test-expert page-bad-summary --from "$missing_summary_fm" 2>/dev/null) || rc=$?
assert_exit 2 "$rc" "payload missing summary: still required, exits 2"

# Payload missing tags -> still a required field, exits 2.
missing_tags_fm="$TMPDIR_ROOT/missing-tags-frontmatter.md"
cat > "$missing_tags_fm" <<'EOF'
---
summary: "Has summary but no tags"
---
# Bad
EOF
rc=0; (cd "$wt6" && bash "$WIKI_WRITE" test-expert page-bad-tags --from "$missing_tags_fm" 2>/dev/null) || rc=$?
assert_exit 2 "$rc" "payload missing tags: still required, exits 2"

# ============================================================
echo ""
echo "=== Group 7: last-verified frontmatter mechanics (PD7 validate-and-reject) ==="
# ============================================================

wt7="$TMPDIR_ROOT/wt7"
mkdir -p "$wt7/.claude/skills"
_scaffold_domain "$wt7" "lastverified-expert"

# Quoted last-verified payload: create a two-section page carrying the field.
lv_payload_quoted="$TMPDIR_ROOT/lv-quoted.md"
cat > "$lv_payload_quoted" <<'EOF'
---
tags: [lastverified-expert/page-lv]
summary: "A page with last-verified"
code-cites: []
last-verified: "2026-07-01"
---
# Page LV

## Section One
Body content one.

## Section Two
Body content two.
EOF

rc=0; out=""
out=$(cd "$wt7" && bash "$WIKI_WRITE" lastverified-expert page-lv --from "$lv_payload_quoted" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "last-verified quoted: create exits 0"
assert_contains '"action":"created"' "$out" "last-verified quoted: JSON action=created"
assert_contains 'last-verified: "2026-07-01"' "$(cat "$wt7/.claude/skills/lastverified-expert/page-lv.md")" "last-verified quoted: quoted value written through verbatim"

# Bare-date last-verified payload: REJECTED, exit 2, never auto-quoted.
lv_payload_bare="$TMPDIR_ROOT/lv-bare.md"
cat > "$lv_payload_bare" <<'EOF'
---
tags: [lastverified-expert/page-lv-bare]
summary: "A page with a bare last-verified date"
code-cites: []
last-verified: 2026-07-01
---
# Page LV Bare

Some content.
EOF

rc=0; out=""
out=$(cd "$wt7" && bash "$WIKI_WRITE" lastverified-expert page-lv-bare --from "$lv_payload_bare" 2>&1) || rc=$?
assert_exit 2 "$rc" "last-verified bare date: rejected, exits 2"
assert_contains "last-verified" "$out" "last-verified bare date: error names the field"
assert_contains "quoted" "$out" "last-verified bare date: error mentions the quoting requirement"
assert_eq "no" "$([[ -f "$wt7/.claude/skills/lastverified-expert/page-lv-bare.md" ]] && echo yes || echo no)" "last-verified bare date: rejected payload never written to disk"

# Read-merge-write bump: full --update payload carries the identical body plus
# a new quoted last-verified value — body must survive byte-identical.
lv_bump_payload="$TMPDIR_ROOT/lv-bump.md"
cat > "$lv_bump_payload" <<'EOF'
---
tags: [lastverified-expert/page-lv]
summary: "A page with last-verified"
code-cites: []
last-verified: "2026-07-11"
---
# Page LV

## Section One
Body content one.

## Section Two
Body content two.
EOF

rc=0; out=""
out=$(cd "$wt7" && bash "$WIKI_WRITE" lastverified-expert page-lv --update --from "$lv_bump_payload" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "last-verified bump: --update exits 0"
assert_contains '"action":"updated"' "$out" "last-verified bump: JSON action=updated"
after_bump="$(cat "$wt7/.claude/skills/lastverified-expert/page-lv.md")"
assert_contains 'last-verified: "2026-07-11"' "$after_bump" "last-verified bump: field bumped to new quoted value"
assert_contains "Body content one." "$after_bump" "last-verified bump: Section One body preserved verbatim"
assert_contains "Body content two." "$after_bump" "last-verified bump: Section Two body preserved verbatim"

# Frontmatter-only bump payload against a fixture with >=2 '## ' sections:
# the soft-clobber guard MUST refuse it — a bare last-verified bump can only
# ride a full read-merge-write, never a frontmatter-only payload.
lv_fm_only_payload="$TMPDIR_ROOT/lv-fm-only.md"
cat > "$lv_fm_only_payload" <<'EOF'
---
tags: [lastverified-expert/page-lv]
summary: "A page with last-verified"
code-cites: []
last-verified: "2026-07-12"
---
EOF

before_guard_lv="$(cat "$wt7/.claude/skills/lastverified-expert/page-lv.md")"
rc=0; out=""
out=$(cd "$wt7" && bash "$WIKI_WRITE" lastverified-expert page-lv --update --from "$lv_fm_only_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "last-verified frontmatter-only bump: refused by soft clobber guard, exits 2"
assert_contains "--replace" "$out" "last-verified frontmatter-only bump: error suggests --replace"
assert_eq "$before_guard_lv" "$(cat "$wt7/.claude/skills/lastverified-expert/page-lv.md")" "last-verified frontmatter-only bump: page content unchanged after refusal"

# ============================================================
echo ""
echo "=== Group 8: ## Pages nav-entry insertion point, flat list ==="
# ============================================================
# A new page's nav entry lands immediately after the last bullet of a flat
# ## Pages list, before the next ## section.

wt8="$TMPDIR_ROOT/wt8"
mkdir -p "$wt8/.claude/skills"

NAV_PAYLOAD="$TMPDIR_ROOT/nav-payload.md"
cat > "$NAV_PAYLOAD" <<'EOF'
---
tags: [nav-test/new-page]
summary: "a newly added page"
code-cites: []
---
# New Page

Some content.
EOF

# --- flat list: end-of-list insertion ---
mkdir -p "$wt8/.claude/skills/flat-nav-expert"
cat > "$wt8/.claude/skills/flat-nav-expert/SKILL.md" <<'EOF'
---
name: flat-nav-expert
description: "test domain with a flat ## Pages list"
---

## Pages

- [Alpha](alpha.md) — first page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt8/.claude/skills/flat-nav-expert/.mditerc"

rc=0; out=""
out=$(cd "$wt8" && bash "$WIKI_WRITE" flat-nav-expert beta --from "$NAV_PAYLOAD" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "flat list: create exits 0"

skill_md_c="$wt8/.claude/skills/flat-nav-expert/SKILL.md"
alpha_line_c=$(grep -n '^- \[Alpha\]' "$skill_md_c" | head -1 | cut -d: -f1)
beta_line_c=$(grep -n 'beta\.md' "$skill_md_c" | head -1 | cut -d: -f1)
meta_line_c=$(grep -n '^## Meta' "$skill_md_c" | head -1 | cut -d: -f1)

assert_eq "yes" "$([[ "$beta_line_c" -eq $((alpha_line_c + 1)) ]] && echo yes || echo no)" "flat list: new entry appended immediately after the last bullet"
assert_eq "yes" "$([[ "$beta_line_c" -lt "$meta_line_c" ]] && echo yes || echo no)" "flat list: new entry lands inside ## Pages, before ## Meta"

# ============================================================
echo ""
echo "=== Group 9: file mode preservation across atomic writes ==="
# ============================================================
# Regression coverage for the mode-600 bug: mktemp creates its tmpfile at 0600
# and mv is rename(2), which carries the source inode's mode onto the
# destination -- so every page write and every SKILL.md nav update silently
# downgraded its target to 0600. Git tracks only the executable bit, so the
# drift never appeared in a diff and no review could catch it.
# wiki-write.sh:_apply_target_mode now restores the destination's mode (or the
# umask-derived create mode, for a page that does not exist yet) onto the
# tmpfile before each of the three renames.

wt9="$TMPDIR_ROOT/wt9"
mkdir -p "$wt9/.claude/skills"
git init -q "$wt9"  # auto-init writes only inside a git work tree

MODE_PAYLOAD="$TMPDIR_ROOT/mode-payload.md"
cat > "$MODE_PAYLOAD" <<'EOF'
---
tags: [mode-test]
summary: "Payload for the file-mode preservation tests."
---

## Mode Test Page

Body text.
EOF

# A new page is world-readable like every other file the script writes, not 0600.
( umask 022; cd "$wt9" && bash "$WIKI_WRITE" mode-expert page-one --from "$MODE_PAYLOAD" --quiet ) >/dev/null 2>&1 || true
assert_eq "644" "$(stat -c '%a' "$wt9/.claude/skills/mode-expert/page-one.md" 2>/dev/null)" "mode: new page created 644 under umask 022"

# A page an operator deliberately restricted keeps that restriction through --update.
chmod 600 "$wt9/.claude/skills/mode-expert/page-one.md"
( umask 022; cd "$wt9" && bash "$WIKI_WRITE" mode-expert page-one --from "$MODE_PAYLOAD" --update --quiet ) >/dev/null 2>&1 || true
assert_eq "600" "$(stat -c '%a' "$wt9/.claude/skills/mode-expert/page-one.md" 2>/dev/null)" "mode: --update preserves a restricted page's 600"

# SKILL.md is rewritten by the nav-entry insert; its mode must survive that.
chmod 644 "$wt9/.claude/skills/mode-expert/SKILL.md"
( umask 022; cd "$wt9" && bash "$WIKI_WRITE" mode-expert page-two --from "$MODE_PAYLOAD" --quiet ) >/dev/null 2>&1 || true
assert_eq "644" "$(stat -c '%a' "$wt9/.claude/skills/mode-expert/SKILL.md" 2>/dev/null)" "mode: SKILL.md stays 644 through a nav-entry insert"

# The create mode is derived from the umask, not hardcoded to 644. The subshell
# keeps the restrictive umask from leaking into any later test.
( umask 077; cd "$wt9" && bash "$WIKI_WRITE" mode-expert page-three --from "$MODE_PAYLOAD" --quiet ) >/dev/null 2>&1 || true
assert_eq "600" "$(stat -c '%a' "$wt9/.claude/skills/mode-expert/page-three.md" 2>/dev/null)" "mode: new page honors umask 077 (600), not a hardcoded 644"

# ============================================================
echo ""
echo "=== Group 10: --update nav re-sync (aea2fd4 regression net) ==="
# ============================================================
# aea2fd4 ("fix(wiki-write): re-sync ## Pages summary on --update") landed
# the per-entry resync transform (wiki-write.sh:1001-1087) but committed no
# test file alongside it -- git show --stat aea2fd4 touches wiki-write.sh
# alone, +84/-7. The seven cases below are that commit's own message list,
# run for real for the first time. All three fixture domains are
# deliberately UNFENCED: this is the per-entry path D9 keeps as the
# documented fallback for unfenced domains after step 08 fences the
# marker-based nav rewrite, so it needs standing coverage regardless of what
# step 08 does to the fenced path. Reuses FULL_PAYLOAD / FULL_PAYLOAD_V2
# (defined above) throughout rather than minting a payload per case -- R15,
# wiki-memory-expert/wiki-tooling-test-suites.md.

wt_g10="$TMPDIR_ROOT/wt_g10"
mkdir -p "$wt_g10/.claude/skills"

# --- Fixture A: flat '## Pages' domain, plus a prose link OUTSIDE ## Pages
# (Case 6) and an orphan page with no nav entry at all (Case 5).
mkdir -p "$wt_g10/.claude/skills/resync-flat-expert"
cat > "$wt_g10/.claude/skills/resync-flat-expert/SKILL.md" <<'EOF'
---
name: resync-flat-expert
description: "test domain for --update nav re-sync (flat layout)"
---

## Overview

See also [Page One](page-one.md) for background reading.

## Pages

- [Alpha](alpha.md) — first page
- [page-one](page-one.md) — A simple test page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt_g10/.claude/skills/resync-flat-expert/.mditerc"
cat > "$wt_g10/.claude/skills/resync-flat-expert/page-one.md" <<'EOF'
---
tags: [resync-flat-expert/page-one]
summary: "A simple test page"
code-cites: []
---
# Page One

Some content.
EOF
# Physically placed, never through wiki-write -- carries no ## Pages entry.
cat > "$wt_g10/.claude/skills/resync-flat-expert/orphan-page.md" <<'EOF'
---
tags: [resync-flat-expert/orphan-page]
summary: "manually placed page, not in nav"
code-cites: []
---
# Orphan Page

Manually placed content with no nav entry.
EOF

skill_md_g10_flat="$wt_g10/.claude/skills/resync-flat-expert/SKILL.md"

# --- Case 1: create still inserts. A plain create (no --update) of a NEW
# slug still adds exactly one nav bullet, and the pre-existing entries
# (Alpha, page-one) are untouched.
rc=0; out=""
out=$(cd "$wt_g10" && bash "$WIKI_WRITE" resync-flat-expert page-two --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
_g10_c1_new=$(grep -c '^- \[page-two\](page-two\.md) — ' "$skill_md_g10_flat" || true)
_g10_c1_alpha=$(grep -c '^- \[Alpha\](alpha\.md) — first page$' "$skill_md_g10_flat" || true)
_g10_c1_pageone=$(grep -c '^- \[page-one\](page-one\.md) — A simple test page$' "$skill_md_g10_flat" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g10_c1_new" -eq 1 && "$_g10_c1_alpha" -eq 1 && "$_g10_c1_pageone" -eq 1 ]] && echo yes || echo no)" "Case 1 (create still inserts): plain create adds exactly one bullet, pre-existing entries intact"

# --- Case 2: no-op update is byte-identical. --update whose payload summary
# equals the entry already on disk (FULL_PAYLOAD's "A simple test page",
# matching page-one's bullet above) must not touch SKILL.md at all.
_g10_md5_before2="$(md5sum "$skill_md_g10_flat" | awk '{print $1}')"
rc=0; out=""
out=$(cd "$wt_g10" && bash "$WIKI_WRITE" resync-flat-expert page-one --update --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
_g10_md5_after2="$(md5sum "$skill_md_g10_flat" | awk '{print $1}')"
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g10_md5_before2" == "$_g10_md5_after2" ]] && echo yes || echo no)" "Case 2 (no-op update is byte-identical): --update with an unchanged summary leaves SKILL.md byte-identical and exits 0"

# --- Case 3: changed summary re-syncs. --update with FULL_PAYLOAD_V2's
# differing summary rewrites only page-one's bullet; Alpha and the page-two
# bullet from Case 1 (which happens to carry the SAME old summary text) stay
# byte-unchanged -- proving the rewrite is scoped to the matching slug, not
# a blind text substitution.
_g10_prose_before="$(grep -F 'See also [Page One]' "$skill_md_g10_flat" || true)"
rc=0; out=""
out=$(cd "$wt_g10" && bash "$WIKI_WRITE" resync-flat-expert page-one --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
_g10_c3_new=$(grep -c '^- \[page-one\](page-one\.md) — A simple test page, revised$' "$skill_md_g10_flat" || true)
_g10_c3_old=$(grep -c '^- \[page-one\](page-one\.md) — A simple test page$' "$skill_md_g10_flat" || true)
_g10_c3_alpha=$(grep -c '^- \[Alpha\](alpha\.md) — first page$' "$skill_md_g10_flat" || true)
_g10_c3_pagetwo=$(grep -c '^- \[page-two\](page-two\.md) — A simple test page$' "$skill_md_g10_flat" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g10_c3_new" -eq 1 && "$_g10_c3_old" -eq 0 && "$_g10_c3_alpha" -eq 1 && "$_g10_c3_pagetwo" -eq 1 ]] && echo yes || echo no)" "Case 3 (changed summary re-syncs): only page-one's bullet is rewritten; Alpha and page-two are untouched"

# --- Case 6: prose links untouched. The same Case 3 update re-synced
# page-one's nav bullet -- the prose link to the same page under ## Overview
# (outside ## Pages) must be byte-identical.
_g10_prose_after="$(grep -F 'See also [Page One]' "$skill_md_g10_flat" || true)"
assert_eq "$_g10_prose_before" "$_g10_prose_after" "Case 6 (prose links untouched): prose link to page-one outside ## Pages is byte-identical after the Case 3 nav re-sync"

# --- Case 5: orphan warns and exits 0. --update on a page with no ## Pages
# entry (orphan-page.md was placed directly on disk, never through
# wiki-write) emits the orphan warning to STDERR, leaves SKILL.md untouched,
# and still exits 0.
_g10_md5_before5="$(md5sum "$skill_md_g10_flat" | awk '{print $1}')"
rc=0
_g10_stderr5=$(cd "$wt_g10" && bash "$WIKI_WRITE" resync-flat-expert orphan-page --update --from "$FULL_PAYLOAD_V2" --json 2>&1 1>/dev/null) || rc=$?
_g10_md5_after5="$(md5sum "$skill_md_g10_flat" | awk '{print $1}')"
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g10_stderr5" == *"has no ## Pages entry"* && "$_g10_md5_before5" == "$_g10_md5_after5" ]] && echo yes || echo no)" "Case 5 (orphan warns and exits 0): --update on an orphan page warns to stderr, exits 0, SKILL.md untouched"

# --- Fixture B: sub-sectioned '### Standalone Pages' domain (Case 7).
mkdir -p "$wt_g10/.claude/skills/resync-substandalone-expert"
cat > "$wt_g10/.claude/skills/resync-substandalone-expert/SKILL.md" <<'EOF'
---
name: resync-substandalone-expert
description: "test domain for --update nav re-sync (sub-sectioned layout)"
---

## Pages

### Topic Areas

### Standalone Pages

- [Solo One](solo-one.md) — first standalone page
- [solo-two](solo-two.md) — A simple test page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt_g10/.claude/skills/resync-substandalone-expert/.mditerc"
cat > "$wt_g10/.claude/skills/resync-substandalone-expert/solo-two.md" <<'EOF'
---
tags: [resync-substandalone-expert/solo-two]
summary: "A simple test page"
code-cites: []
---
# Solo Two

Some content.
EOF

skill_md_g10_sub="$wt_g10/.claude/skills/resync-substandalone-expert/SKILL.md"

# --- Case 7: sub-sectioned layout unaffected. --update's resync path is a
# blind bullet-line scan of the whole ## Pages block -- it must find and
# rewrite solo-two's bullet inside ### Standalone Pages without disturbing
# the heading itself or the bullet order.
rc=0; out=""
out=$(cd "$wt_g10" && bash "$WIKI_WRITE" resync-substandalone-expert solo-two --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
_g10_c7_heading=$(grep -c '^### Standalone Pages$' "$skill_md_g10_sub" || true)
_g10_c7_solo_one_line=$(grep -n '^- \[Solo One\]' "$skill_md_g10_sub" | head -1 | cut -d: -f1 || true)
_g10_c7_solo_two_line=$(grep -n 'solo-two\.md' "$skill_md_g10_sub" | head -1 | cut -d: -f1 || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g10_c7_heading" -eq 1 && "$_g10_c7_solo_one_line" -lt "$_g10_c7_solo_two_line" ]] && echo yes || echo no)" "Case 7 (sub-sectioned layout unaffected): ### Standalone Pages heading and bullet order survive the resync"

# --- Fixture C: an entry carrying a title decoration between its link and
# the separator (Case 4).
mkdir -p "$wt_g10/.claude/skills/resync-decorated-expert"
cat > "$wt_g10/.claude/skills/resync-decorated-expert/SKILL.md" <<'EOF'
---
name: resync-decorated-expert
description: "test domain for --update nav re-sync (decorated title)"
---

## Pages

- [Current Page](current-page.md) — an active page
- [page-old](page-old.md) (draft) — A simple test page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt_g10/.claude/skills/resync-decorated-expert/.mditerc"
cat > "$wt_g10/.claude/skills/resync-decorated-expert/page-old.md" <<'EOF'
---
tags: [resync-decorated-expert/page-old]
summary: "A simple test page"
code-cites: []
---
# Page Old

Some content.
EOF

skill_md_g10_decorated="$wt_g10/.claude/skills/resync-decorated-expert/SKILL.md"

# --- Case 4: title decoration preserved. Only the text after the first
# " — " separator is replaced -- the " (draft)" decoration in the title
# portion must survive the resync.
rc=0; out=""
out=$(cd "$wt_g10" && bash "$WIKI_WRITE" resync-decorated-expert page-old --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
assert_contains "- [page-old](page-old.md) (draft) — A simple test page, revised" "$(cat "$skill_md_g10_decorated")" "Case 4 (title decoration preserved): ' (draft)' decoration survives while the summary re-syncs"

# ============================================================
echo ""
echo "=== Group 11: fenced-region regeneration, unfenced fallback, appended no-op ==="
# ============================================================
# Coverage OF step 08's rewrite (marker-fenced-regions-convention.md), where
# Group 10 above is the regression net UNDER it. Three behaviors, keyed to
# step 08's decision matrix by row number:
#   - fenced domain  -> whole-region regenerate: EVERY covered entry in every
#     fenced region is rebuilt from its page's current frontmatter summary,
#     not just the entry the write is about (rows 1/3/4).
#   - unfenced domain -> the per-entry resync fallback is kept verbatim (D9,
#     rows 9/10) -- proven here by contrast: the entries this write is NOT
#     about must stay drifted.
#   - --append-section -> nav is untouched entirely (D10, rows 5/6), a
#     documented NON-change that needs a standing test precisely because
#     nobody would notice it breaking.
# The fenced-flat fixture carries THREE entries with TWO drifted so the
# regeneration assertions run against a fixture whose correct result is
# non-empty AND different from the input -- R10's testing corollary
# (bash-command-substitution-subshell.md): a fixture whose correct value is
# unchanged passes even when the mechanism is entirely broken.
# Reuses FULL_PAYLOAD / FULL_PAYLOAD_V2 (defined at the top of this file)
# throughout; no group-local payload is minted at all -- R15,
# wiki-memory-expert/wiki-tooling-test-suites.md.

wt11="$TMPDIR_ROOT/wt11"
mkdir -p "$wt11/.claude/skills"

# Helper: write a page with the given frontmatter summary. Group-local; the
# four fixtures below need eleven of these and an inline heredoc apiece would
# bury the fixture shapes that actually matter.
_g11_page() {
  local dir="$1" slug="$2" summary="$3"
  mkdir -p "$(dirname "$dir/$slug.md")"
  cat > "$dir/$slug.md" <<EOF
---
tags: [${slug}]
summary: "${summary}"
code-cites: []
---
# ${slug}

Body content.
EOF
}

# --- Fixture A: fenced-flat. One fenced region, three entries, two of them
# (alpha, gamma) deliberately drifted from their pages' frontmatter.
mkdir -p "$wt11/.claude/skills/regen-fenced-flat-expert"
cat > "$wt11/.claude/skills/regen-fenced-flat-expert/SKILL.md" <<'EOF'
---
name: regen-fenced-flat-expert
description: "test domain: one fenced ## Pages region, two drifted entries"
---

## Pages

<!-- BEGIN:PAGES -->
- [alpha](alpha.md) — stale alpha text
- [page-one](page-one.md) — A simple test page
- [gamma](gamma.md) — stale gamma text
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt11/.claude/skills/regen-fenced-flat-expert/.mditerc"
_g11_page "$wt11/.claude/skills/regen-fenced-flat-expert" alpha "fresh alpha text"
_g11_page "$wt11/.claude/skills/regen-fenced-flat-expert" page-one "A simple test page"
_g11_page "$wt11/.claude/skills/regen-fenced-flat-expert" gamma "fresh gamma text"
skill_md_g11_flat="$wt11/.claude/skills/regen-fenced-flat-expert/SKILL.md"

# --- Assertion 1 (row 3): the written entry re-syncs. --update carrying
# FULL_PAYLOAD_V2's changed summary rewrites page-one's own bullet. The link
# snapshot on the next line is assertion 3's "before" side, taken here because
# it has to be read before this write lands.
_g11_links_before="$(grep -oE '\]\([^)]+\.md\)' "$skill_md_g11_flat" | sort | tr '\n' ' ' || true)"
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-fenced-flat-expert page-one --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
_g11_a1=$(grep -c '^- \[page-one\](page-one\.md) — A simple test page, revised$' "$skill_md_g11_flat" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_a1" -eq 1 ]] && echo yes || echo no)" "Assertion 1 (row 3): --update on a fenced domain re-syncs the written entry's summary"

# --- Assertion 2 (row 3): the SAME single write repairs both OTHER drifted
# entries. This is the whole-region property -- strictly stronger than a
# per-entry patch, and the reason two entries are drifted rather than one
# (one drifted entry cannot distinguish "regenerated the region" from
# "patched a single bullet and got lucky").
_g11_a2_stale_alpha=$(grep -c '^- \[alpha\](alpha\.md) — stale alpha text$' "$skill_md_g11_flat" || true)
_g11_a2_stale_gamma=$(grep -c '^- \[gamma\](gamma\.md) — stale gamma text$' "$skill_md_g11_flat" || true)
_g11_a2_fresh_alpha=$(grep -c '^- \[alpha\](alpha\.md) — fresh alpha text$' "$skill_md_g11_flat" || true)
_g11_a2_fresh_gamma=$(grep -c '^- \[gamma\](gamma\.md) — fresh gamma text$' "$skill_md_g11_flat" || true)
assert_eq "yes" "$([[ "$_g11_a2_stale_alpha" -eq 0 && "$_g11_a2_stale_gamma" -eq 0 && \
                      "$_g11_a2_fresh_alpha" -eq 1 && "$_g11_a2_fresh_gamma" -eq 1 ]] && echo yes || echo no)" \
  "Assertion 2 (row 3): the same write regenerates the whole region — both other drifted entries are repaired too"

# --- Assertion 3 (row 3): regeneration replaces summaries only. Every
# bullet's '](*.md)' link target is preserved as a multiset -- nothing is
# retargeted, dropped, or duplicated.
_g11_links_after="$(grep -oE '\]\([^)]+\.md\)' "$skill_md_g11_flat" | sort | tr '\n' ' ' || true)"
assert_eq "yes" "$([[ -n "$_g11_links_before" && "$_g11_links_before" == "$_g11_links_after" ]] && echo yes || echo no)" \
  "Assertion 3 (row 3): regeneration leaves every entry's link target unchanged (multiset equality)"

# --- Assertion 4 (row 4): unchanged summary is a true no-op. Re-running the
# identical --update now that page-one's bullet already carries
# FULL_PAYLOAD_V2's summary must leave SKILL.md byte-identical and must not
# leave the nav mutex directory behind.
_g11_md5_a4_before="$(md5sum "$skill_md_g11_flat" | awk '{print $1}')"
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-fenced-flat-expert page-one --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
_g11_md5_a4_after="$(md5sum "$skill_md_g11_flat" | awk '{print $1}')"
_g11_a4_lock="$([[ -e "$wt11/.claude/skills/regen-fenced-flat-expert/.wiki-write-nav.lock" ]] && echo yes || echo no)"
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_md5_a4_before" == "$_g11_md5_a4_after" && "$_g11_a4_lock" == "no" ]] && echo yes || echo no)" \
  "Assertion 4 (row 4): --update with an unchanged summary leaves SKILL.md byte-identical and no .wiki-write-nav.lock behind"

# --- Assertion 12 (idempotency): a THIRD identical --update still lands
# nothing, and performs no nav rewrite at all. The unlocked action=updated
# pre-check (wiki-write.sh:1275) sees the on-disk bullet already carrying the
# payload's summary and sets _NAV_MODE=skip, so the nav block never runs --
# the run emits no "updated ## Pages" line. Asserted here rather than the
# "already current; nav unchanged" info line: that line belongs to the cmp -s
# guards inside the nav block (wiki-write.sh:1472, :1513), which an idempotent
# repeat never reaches. Placed with assertion 4 because it is the same fixture
# in the same state; numbered per the step's list, not per file order.
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-fenced-flat-expert page-one --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
_g11_md5_a12="$(md5sum "$skill_md_g11_flat" | awk '{print $1}')"
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_md5_a12" == "$_g11_md5_a4_before" && "$out" != *"updated ## Pages"* ]] && echo yes || echo no)" \
  "Assertion 12 (idempotency): a repeated identical --update leaves SKILL.md byte-identical and rewrites no nav entry"

# --- Assertion 5 (row 1): a create lands INSIDE the fence. The new entry must
# join the existing bullet run between the markers -- an entry landing outside
# would permanently escape all future regeneration -- and the write must not
# emit a second marker pair.
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-fenced-flat-expert page-two --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
_g11_a5_begin_n=$(grep -c '^<!-- BEGIN:PAGES -->$' "$skill_md_g11_flat" || true)
_g11_a5_end_n=$(grep -c '^<!-- END:PAGES -->$' "$skill_md_g11_flat" || true)
_g11_a5_begin_line=$(grep -n '^<!-- BEGIN:PAGES -->$' "$skill_md_g11_flat" | head -1 | cut -d: -f1 || true)
_g11_a5_end_line=$(grep -n '^<!-- END:PAGES -->$' "$skill_md_g11_flat" | head -1 | cut -d: -f1 || true)
_g11_a5_new_line=$(grep -n '^- \[page-two\](page-two\.md) — A simple test page$' "$skill_md_g11_flat" | head -1 | cut -d: -f1 || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_a5_begin_n" -eq 1 && "$_g11_a5_end_n" -eq 1 && \
                      -n "$_g11_a5_new_line" && "$_g11_a5_new_line" -gt "$_g11_a5_begin_line" && \
                      "$_g11_a5_new_line" -lt "$_g11_a5_end_line" ]] && echo yes || echo no)" \
  "Assertion 5 (row 1): a create inserts the new entry inside the fence, still exactly one BEGIN/END marker pair"

# --- Assertion 11 (rows 5/6, D10): --append-section is a nav NO-OP. It merges
# a fragment into an existing page and must not touch SKILL.md at all. A
# documented non-change, tested because a regression here would otherwise be
# silent.
_g11_md5_a11_before="$(md5sum "$skill_md_g11_flat" | awk '{print $1}')"
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-fenced-flat-expert page-one --append-section "Notes" --from "$FRAGMENT" --json 2>&1) || rc=$?
_g11_md5_a11_after="$(md5sum "$skill_md_g11_flat" | awk '{print $1}')"
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_md5_a11_before" == "$_g11_md5_a11_after" ]] && echo yes || echo no)" \
  "Assertion 11 (rows 5/6, D10): --append-section leaves SKILL.md byte-identical and exits 0"

# --- Fixture B: fenced-sub. Two '###' sub-headings, and the second one's
# bullet run split by a bare blank line into two fenced regions -- the shape
# 6 of the 49 real fenced domains carry (e.g. csharp-expert's
# '### Standalone Pages'). Only solo-one is drifted; the Topic Areas hub entry
# (a subdirectory link target) and solo-two are already current, so any change
# to them is a regression, not a repair.
mkdir -p "$wt11/.claude/skills/regen-fenced-sub-expert"
cat > "$wt11/.claude/skills/regen-fenced-sub-expert/SKILL.md" <<'EOF'
---
name: regen-fenced-sub-expert
description: "test domain: two sub-headings, one bullet run split by a blank line"
---

## Pages

### Topic Areas

<!-- BEGIN:PAGES -->
- [Hub](hub/index.md) — hub landing page
<!-- END:PAGES -->

### Standalone Pages

<!-- BEGIN:PAGES -->
- [solo-one](solo-one.md) — stale solo one text
<!-- END:PAGES -->

<!-- BEGIN:PAGES -->
- [solo-two](solo-two.md) — solo two current text
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt11/.claude/skills/regen-fenced-sub-expert/.mditerc"
_g11_page "$wt11/.claude/skills/regen-fenced-sub-expert" hub/index "hub landing page"
_g11_page "$wt11/.claude/skills/regen-fenced-sub-expert" solo-one "fresh solo one text"
_g11_page "$wt11/.claude/skills/regen-fenced-sub-expert" solo-two "solo two current text"
skill_md_g11_sub="$wt11/.claude/skills/regen-fenced-sub-expert/SKILL.md"

_g11_sub_hub_before="$(grep -F '](hub/index.md)' "$skill_md_g11_sub" || true)"
_g11_sub_two_before="$(grep -F '](solo-two.md)' "$skill_md_g11_sub" || true)"
_g11_sub_heads_before="$(grep -c '^### ' "$skill_md_g11_sub" || true)"
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-fenced-sub-expert solo-one --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?

# --- Assertion 6: a write into ONE region leaves the other regions' entries
# and both '###' sub-headings byte-identical, and no sub-heading is ever
# swallowed into a fence (the regenerator passes every non-bullet line inside
# a fence through verbatim, but a heading inside one would mean the migration
# fenced the wrong span).
_g11_sub_hub_after="$(grep -F '](hub/index.md)' "$skill_md_g11_sub" || true)"
_g11_sub_two_after="$(grep -F '](solo-two.md)' "$skill_md_g11_sub" || true)"
_g11_sub_heads_after="$(grep -c '^### ' "$skill_md_g11_sub" || true)"
_g11_sub_head_in_fence="$(awk '
  /^<!-- BEGIN:PAGES -->$/ { f=1; next }
  /^<!-- END:PAGES -->$/   { f=0; next }
  f && /^### / { print }
' "$skill_md_g11_sub")"
_g11_sub_resynced=$(grep -c '^- \[solo-one\](solo-one\.md) — A simple test page, revised$' "$skill_md_g11_sub" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_sub_resynced" -eq 1 && \
                      -n "$_g11_sub_hub_before" && -n "$_g11_sub_two_before" && \
                      "$_g11_sub_hub_before" == "$_g11_sub_hub_after" && \
                      "$_g11_sub_two_before" == "$_g11_sub_two_after" && \
                      "$_g11_sub_heads_before" -eq 2 && "$_g11_sub_heads_after" -eq 2 && \
                      -z "$_g11_sub_head_in_fence" ]] && echo yes || echo no)" \
  "Assertion 6 (fenced-sub): a write into one region leaves the other regions' entries and both ### sub-headings byte-identical, none inside a fence"

# --- Assertion 7: the two '### Standalone Pages' fences, separated only by a
# blank line, regenerate as one fence; the '### Topic Areas' fence above,
# separated by a sub-heading, stays its own (the Blank-Line Rule).
assert_eq "<!-- BEGIN:PAGES -->|- [solo-one](solo-one.md) — A simple test page, revised|- [solo-two](solo-two.md) — solo two current text|<!-- END:PAGES -->||## Meta" \
  "$(sed -n '/^### Standalone Pages/,$p' "$skill_md_g11_sub" | sed '1,2d' | paste -sd'|')" \
  "Assertion 7 (fenced-sub): blank-line-split fences under one sub-heading regenerate as one fence"
assert_eq "2" "$(grep -c '^<!-- BEGIN:PAGES -->' "$skill_md_g11_sub")" \
  "Assertion 7 (fenced-sub): the fence under a distinct sub-heading stays separate"

# --- Fixture C: fenced-decorated. A fenced region carrying a bullet whose
# link target does not exist at all, plus a second fenced region under a
# '### ' subheading whose entry carries a ' (draft)' title decoration.
mkdir -p "$wt11/.claude/skills/regen-fenced-decorated-expert"
cat > "$wt11/.claude/skills/regen-fenced-decorated-expert/SKILL.md" <<'EOF'
---
name: regen-fenced-decorated-expert
description: "test domain: two fenced regions, one decorated entry"
---

## Pages

<!-- BEGIN:PAGES -->
- [Current Page](current-page.md) — stale current page text
- [Ghost](ghost-page.md) — target file was never created
<!-- END:PAGES -->

### Standalone Pages

<!-- BEGIN:PAGES -->
- [page-old](page-old.md) (draft) — stale decorated text
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt11/.claude/skills/regen-fenced-decorated-expert/.mditerc"
_g11_page "$wt11/.claude/skills/regen-fenced-decorated-expert" current-page "current page, fresh"
_g11_page "$wt11/.claude/skills/regen-fenced-decorated-expert" page-old "page old, fresh"
skill_md_g11_deco="$wt11/.claude/skills/regen-fenced-decorated-expert/SKILL.md"

_g11_deco_ghost_before="$(grep -F '](ghost-page.md)' "$skill_md_g11_deco" || true)"
_g11_deco_bullets_before=$(grep -c '^- ' "$skill_md_g11_deco" || true)
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-fenced-decorated-expert current-page --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?

# --- Assertion 8: the ' (draft) — ' title decoration survives. Only the
# text after the FIRST ' — ' separator following the link's closing ')' is
# replaced, so the decorator between the link and the separator is preserved
# while the summary is regenerated from page-old.md's own frontmatter.
_g11_deco_suffix=$(grep -c '^- \[page-old\](page-old\.md) (draft) — page old, fresh$' "$skill_md_g11_deco" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_deco_suffix" -eq 1 ]] && echo yes || echo no)" \
  "Assertion 8 (fenced-decorated): regeneration preserves the ' (draft) — ' title decoration while replacing the summary"

# --- Assertion 9: a bullet whose link target does not exist is left verbatim.
# Regeneration never deletes a nav entry -- an unresolvable target is a
# pass-through case, not a prune case, so the bullet count is also unchanged.
_g11_deco_ghost_after="$(grep -F '](ghost-page.md)' "$skill_md_g11_deco" || true)"
_g11_deco_bullets_after=$(grep -c '^- ' "$skill_md_g11_deco" || true)
assert_eq "yes" "$([[ -n "$_g11_deco_ghost_before" && \
                      "$_g11_deco_ghost_before" == "$_g11_deco_ghost_after" && \
                      "$_g11_deco_bullets_before" -eq "$_g11_deco_bullets_after" ]] && echo yes || echo no)" \
  "Assertion 9 (fenced-decorated): a bullet whose target file does not exist is left verbatim; regeneration deletes no nav entry"

# --- Fixture D: unfenced-flat. The same three-entry, two-drifted shape as
# fixture A with the markers removed -- the D9 fallback's proof by contrast.
mkdir -p "$wt11/.claude/skills/regen-unfenced-flat-expert"
cat > "$wt11/.claude/skills/regen-unfenced-flat-expert/SKILL.md" <<'EOF'
---
name: regen-unfenced-flat-expert
description: "test domain: no fence markers at all (D9 per-entry fallback)"
---

## Pages

- [alpha](alpha.md) — stale alpha text
- [page-one](page-one.md) — A simple test page
- [gamma](gamma.md) — stale gamma text

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt11/.claude/skills/regen-unfenced-flat-expert/.mditerc"
_g11_page "$wt11/.claude/skills/regen-unfenced-flat-expert" alpha "fresh alpha text"
_g11_page "$wt11/.claude/skills/regen-unfenced-flat-expert" page-one "A simple test page"
_g11_page "$wt11/.claude/skills/regen-unfenced-flat-expert" gamma "fresh gamma text"
skill_md_g11_unfenced="$wt11/.claude/skills/regen-unfenced-flat-expert/SKILL.md"

# --- Assertion 10 (rows 9/10, D9): the unfenced fallback is genuinely the old
# per-entry behavior, not regeneration in disguise. The written entry re-syncs
# and the two OTHER drifted entries are left drifted -- byte-for-byte the same
# fixture that fixture A repairs wholesale. If all three re-synced here, the
# fallback would BE regeneration and this test would have proven nothing.
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-unfenced-flat-expert page-one --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
_g11_a10_written=$(grep -c '^- \[page-one\](page-one\.md) — A simple test page, revised$' "$skill_md_g11_unfenced" || true)
_g11_a10_stale_alpha=$(grep -c '^- \[alpha\](alpha\.md) — stale alpha text$' "$skill_md_g11_unfenced" || true)
_g11_a10_stale_gamma=$(grep -c '^- \[gamma\](gamma\.md) — stale gamma text$' "$skill_md_g11_unfenced" || true)
_g11_a10_fresh_any=$(grep -cE '^- \[(alpha|gamma)\]\((alpha|gamma)\.md\) — fresh ' "$skill_md_g11_unfenced" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_a10_written" -eq 1 && \
                      "$_g11_a10_stale_alpha" -eq 1 && "$_g11_a10_stale_gamma" -eq 1 && \
                      "$_g11_a10_fresh_any" -eq 0 ]] && echo yes || echo no)" \
  "Assertion 10 (rows 9/10, D9): on an unfenced domain only the written entry re-syncs — both other drifted entries stay drifted"

# ============================================================
echo "=== Group 12: subdirectory pages register their group index, not themselves ==="
# ============================================================
# The nav lists one entry per topic group. A subdir slug names a page inside a
# group, so <dir>/index owns that group's single entry and every other page in
# the group registers nothing. A six-way parallel fan-out into one domain
# is what exposed the old behavior: 36 flat entries across six groups where six
# belonged. Flat slugs are unaffected and still register themselves.

wt12="$TMPDIR_ROOT/wt12"
mkdir -p "$wt12/.claude/skills"
git init -q "$wt12"  # auto-init writes only inside a git work tree

# Seed the domain with a flat page so the nav fence exists.
rc=0
out=$(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert page-one --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
skill_md_g12="$wt12/.claude/skills/subdir-expert/SKILL.md"

# --- Assertion 1: a leaf written before its group index is refused (exit 2,
# naming the index) before anything lands: its bullet would have no home.
rc=0; out=""
out=$(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert topic/leaf-page --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
_g12_leaf_on_disk=$([[ -e "$wt12/.claude/skills/subdir-expert/topic/leaf-page.md" ]] && echo yes || echo no)
assert_eq "yes" "$([[ "$rc" -eq 2 && "$out" == *"topic/index.md missing"* && "$_g12_leaf_on_disk" == "no" ]] && echo yes || echo no)" \
  "Assertion 1 (subdir): a leaf created before its group index exits 2 naming the index, page not written"

# --- Assertion 2: the group index DOES register, titled with the bare group
# name and targeting <dir>/index.md -- not "[topic/index]", which would repeat
# "/index" back at the reader.
rc=0; out=""
out=$(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert topic/index --from "$INDEX_PAYLOAD" --json 2>&1) || rc=$?
_g12_index_entry=$(grep -c '^- \[topic\](topic/index\.md) — ' "$skill_md_g12" || true)
_g12_slashindex_title=$(grep -c '^- \[topic/index\]' "$skill_md_g12" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g12_index_entry" -eq 1 && "$_g12_slashindex_title" -eq 0 ]] && echo yes || echo no)" \
  "Assertion 2 (subdir): <dir>/index registers one entry titled [<dir>] pointing at <dir>/index.md"

# --- Assertion 3: leaves are listed in the group index, titled with the leaf
# and linked relative to it, never in SKILL.md, so the group keeps exactly one
# SKILL.md entry however many pages it holds.
index_g12="$wt12/.claude/skills/subdir-expert/topic/index.md"
_g12_rcs=""
for _g12_leaf in leaf-page second-leaf; do
  rc=0
  (cd "$wt12" && bash "$WIKI_WRITE" subdir-expert "topic/$_g12_leaf" --from "$FULL_PAYLOAD" --quiet >/dev/null 2>&1) || rc=$?
  _g12_rcs+="$rc"
done
_g12_topic_entries=$(grep -cE '^- \[[^]]*\]\(topic/' "$skill_md_g12" || true)
_g12_listed=$(grep -cE '^- \[(leaf-page|second-leaf)\]\((leaf-page|second-leaf)\.md\) — A simple test page$' "$index_g12" || true)
assert_eq "yes" "$([[ "$_g12_rcs" == "00" && "$_g12_topic_entries" -eq 1 && "$_g12_listed" -eq 2 ]] && echo yes || echo no)" \
  "Assertion 3 (subdir): leaves are listed in their group index, SKILL.md keeps one group entry"

# --- Assertion 4 (D3): --update of a listed leaf with a changed summary exits
# 0, prints nothing to stderr, resyncs the index bullet, and leaves SKILL.md
# byte-identical: the leaf has no SKILL.md entry, and the group's is the hub's.
_g12_before=$(cat "$skill_md_g12")
rc=0; _g12_err="$TMPDIR_ROOT/g12-stderr"
(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert topic/leaf-page --update --from "$FULL_PAYLOAD_V2" --quiet >/dev/null 2>"$_g12_err") || rc=$?
_g12_after=$(cat "$skill_md_g12")
_g12_resync=$(grep -c '^- \[leaf-page\](leaf-page\.md) — A simple test page, revised$' "$index_g12" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && ! -s "$_g12_err" && "$_g12_before" == "$_g12_after" && "$_g12_resync" -eq 1 ]] && echo yes || echo no)" \
  "Assertion 4 (subdir, D3): --update of a grouped leaf resyncs its index bullet, empty stderr, SKILL.md byte-identical"
rc=0; out=""
out=$(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert topic/leaf-page --update --from "$FULL_PAYLOAD" 2>&1 >/dev/null) || rc=$?
assert_not_contains "ERROR" "$out" "Assertion 4b (subdir): --update of a grouped leaf prints no orphan ERROR"

# --- Assertion 4c: --update heals a leaf its index does not list, whether or
# not the summary changed, and prints nothing.
for _g12_payload in "$FULL_PAYLOAD" "$FULL_PAYLOAD_V2"; do
  sed -i '/](leaf-page\.md)/d' "$index_g12"
  rc=0
  (cd "$wt12" && bash "$WIKI_WRITE" subdir-expert topic/leaf-page --update --from "$_g12_payload" --quiet >/dev/null 2>"$_g12_err") || rc=$?
  _g12_healed=$(grep -c '^- \[leaf-page\](leaf-page\.md) — ' "$index_g12" || true)
  assert_eq "yes" "$([[ "$rc" -eq 0 && ! -s "$_g12_err" && "$_g12_healed" -eq 1 ]] && echo yes || echo no)" \
    "Assertion 4c (subdir): --update inserts a missing index bullet silently ($(basename "$_g12_payload"))"
done

# --- Assertion 4d/4e: a group index with no '## Pages' heading refuses a
# create (exit 2, nothing written) and lets an --update through, nav skipped.
mkdir -p "$wt12/.claude/skills/subdir-expert/bare"
printf -- '---\ntags: [t]\nsummary: "bare hub"\n---\n# bare\n' > "$wt12/.claude/skills/subdir-expert/bare/index.md"
cp "$FULL_PAYLOAD" "$wt12/.claude/skills/subdir-expert/bare/old.md"
rc=0; out=""
out=$(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert bare/new --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 2 && "$out" == *"bare/index.md has no ## Pages heading"* && ! -e "$wt12/.claude/skills/subdir-expert/bare/new.md" ]] && echo yes || echo no)" \
  "Assertion 4d (subdir): create into a headless group index exits 2, page not written"
_g12_bare_before=$(cat "$wt12/.claude/skills/subdir-expert/bare/index.md")
rc=0
(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert bare/old --update --from "$FULL_PAYLOAD_V2" --quiet >/dev/null 2>"$_g12_err") || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && ! -s "$_g12_err" && "$_g12_bare_before" == "$(cat "$wt12/.claude/skills/subdir-expert/bare/index.md")" ]] && echo yes || echo no)" \
  "Assertion 4e (subdir): --update in a headless group writes the page and skips the nav step"

# --- Assertion 5: an --update to the group index DOES re-sync its summary.
# The skip must be scoped to non-index pages, not to every subdir slug. The
# payload carries the index's own '## Pages' list, as a read-merge-write would.
_g12_index_v2="$TMPDIR_ROOT/g12-index-v2.md"
sed 's/^summary: .*/summary: "A simple test page, revised"/' "$index_g12" > "$_g12_index_v2"
rc=0; out=""
out=$(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert topic/index --update --from "$_g12_index_v2" --json 2>&1) || rc=$?
_g12_resynced=$(grep -c '^- \[topic\](topic/index\.md) — A simple test page, revised$' "$skill_md_g12" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g12_resynced" -eq 1 ]] && echo yes || echo no)" \
  "Assertion 5 (subdir): --update on <dir>/index re-syncs that group's nav summary"

# --- Assertion 6: a flat slug is untouched by any of this and still registers
# itself, so the change is scoped to subdir slugs alone.
rc=0; out=""
out=$(cd "$wt12" && bash "$WIKI_WRITE" subdir-expert page-two --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
_g12_flat=$(grep -c '^- \[page-two\](page-two\.md) — ' "$skill_md_g12" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g12_flat" -eq 1 ]] && echo yes || echo no)" \
  "Assertion 6 (subdir): a flat slug still registers its own nav entry"

# ============================================================
echo ""
echo "=== Group 12: page-kind enum gate (page-standard.md D7) ==="
# ============================================================
# page-kind binds the page standard's rubric per kind, so an unrecognised
# value must be rejected rather than falling back to reference silently.

wt12="$TMPDIR_ROOT/wt12"
mkdir -p "$wt12/.claude/skills"
_scaffold_domain "$wt12" "pagekind-expert"

_g12_payload() {
  # $1 = destination path, $2 = slug, $3 = page-kind line (may be empty)
  local dest="$1" slug="$2" kind_line="$3"
  {
    printf -- '---\n'
    printf 'tags: [pagekind-expert/%s]\n' "$slug"
    printf 'summary: "A page for the kind gate"\n'
    [[ -n "$kind_line" ]] && printf '%s\n' "$kind_line"
    printf -- '---\n\n# %s\n\n## Section One\nBody content one.\n' "$slug"
  } > "$dest"
}

# --- Reject: a near-miss typo of a real kind.
pk_bad="$TMPDIR_ROOT/pk-bad.md"
_g12_payload "$pk_bad" "page-bad" "page-kind: procedures"
rc=0; out=""
out=$(cd "$wt12" && bash "$WIKI_WRITE" pagekind-expert page-bad --from "$pk_bad" 2>&1) || rc=$?
assert_exit 2 "$rc" "page-kind typo: rejected, exits 2"
assert_contains "page-kind" "$out" "page-kind typo: error names the field"
assert_contains "reference, map, procedure" "$out" "page-kind typo: error names all three valid values"
assert_eq "no" "$([[ -f "$wt12/.claude/skills/pagekind-expert/page-bad.md" ]] && echo yes || echo no)" \
  "page-kind typo: rejected payload never written to disk"
assert_eq "0" "$(grep -c 'page-bad' "$wt12/.claude/skills/pagekind-expert/SKILL.md" || true)" \
  "page-kind typo: no nav entry left behind for the rejected slug"

# --- Accept: each of the three valid kinds writes.
for kind in reference map procedure; do
  pk_ok="$TMPDIR_ROOT/pk-$kind.md"
  _g12_payload "$pk_ok" "page-$kind" "page-kind: $kind"
  rc=0; out=""
  out=$(cd "$wt12" && bash "$WIKI_WRITE" pagekind-expert "page-$kind" --from "$pk_ok" --json 2>&1) || rc=$?
  assert_exit 0 "$rc" "page-kind '$kind': accepted, exits 0"
  assert_contains '"action":"created"' "$out" "page-kind '$kind': JSON action=created"
  assert_contains "page-kind: $kind" "$(cat "$wt12/.claude/skills/pagekind-expert/page-$kind.md")" \
    "page-kind '$kind': value written through verbatim"
done

# --- Accept: the field is optional; absent means reference, so no gate fires.
pk_absent="$TMPDIR_ROOT/pk-absent.md"
_g12_payload "$pk_absent" "page-absent" ""
rc=0
(cd "$wt12" && bash "$WIKI_WRITE" pagekind-expert page-absent --from "$pk_absent" --json >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "page-kind absent: accepted, exits 0 (absent means reference)"

# --- Accept: a quoted value is unwrapped before the enum comparison.
pk_quoted="$TMPDIR_ROOT/pk-quoted.md"
_g12_payload "$pk_quoted" "page-quoted" 'page-kind: "map"'
rc=0
(cd "$wt12" && bash "$WIKI_WRITE" pagekind-expert page-quoted --from "$pk_quoted" --json >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "page-kind quoted: 'map' in quotes is accepted, exits 0"

# --- Skipped under --append-section: that mode skips frontmatter entirely, so
# the same typo payload rides through as a content fragment onto a page that
# already exists. The page keeps its own stored kind; the next --update gates it.
pk_frag="$TMPDIR_ROOT/pk-frag.md"
_g12_payload "$pk_frag" "page-reference" "page-kind: procedures"
rc=0; out=""
out=$(cd "$wt12" && bash "$WIKI_WRITE" pagekind-expert page-reference --append-section "Appended" --from "$pk_frag" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "page-kind typo under --append-section: accepted (that mode skips frontmatter)"
_g12_after="$(cat "$wt12/.claude/skills/pagekind-expert/page-reference.md")"
assert_contains "page-kind: reference" "$_g12_after" \
  "page-kind typo under --append-section: the page keeps its own stored kind"
assert_contains "## Appended" "$_g12_after" \
  "page-kind typo under --append-section: the fragment landed as a new section"

# ============================================================
echo ""
echo "=== Group 13: --remove (page deletion + nav bullet removal) ==="
# ============================================================

wt13="$TMPDIR_ROOT/wt13"
mkdir -p "$wt13/.claude/skills"

_g13_page() {
  local dir="$1" slug="$2" summary="$3"
  mkdir -p "$(dirname "$dir/$slug.md")"
  cat > "$dir/$slug.md" <<EOF
---
tags: [${slug}]
summary: "${summary}"
---
# ${slug}

Body content.
EOF
}

_g13_payload="$TMPDIR_ROOT/g13-payload.md"
cat > "$_g13_payload" <<'EOF'
---
tags: [rm-fenced-expert/doomed]
summary: "A page about to be removed"
---
# doomed

## Section One
Body content one.
EOF

# --- Fixture A: fenced ## Pages with a ### subheading, and one
# hand-placed bullet under it sitting OUTSIDE the fence. This is the
# acceptance fixture: create through wiki-write, remove, and the file plus
# its bullet are gone while every remaining bullet is byte-identical to
# before the create.
_g13_a="$wt13/.claude/skills/rm-fenced-expert"
mkdir -p "$_g13_a"
cat > "$_g13_a/SKILL.md" <<'EOF'
---
name: rm-fenced-expert
description: "test domain: fenced ## Pages with an unfenced subsection"
---

## Pages

<!-- BEGIN:PAGES -->
- [alpha](alpha.md) — alpha text
- [gamma](gamma.md) — gamma text
<!-- END:PAGES -->

### Standalone Pages
- [oldie](oldie.md) — a hand-placed page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$_g13_a/.mditerc"
_g13_page "$_g13_a" alpha "alpha text"
_g13_page "$_g13_a" gamma "gamma text"
_g13_page "$_g13_a" oldie "a hand-placed page"

_g13_md5_pristine="$(md5sum "$_g13_a/SKILL.md" | awk '{print $1}')"

rc=0
(cd "$wt13" && bash "$WIKI_WRITE" rm-fenced-expert doomed --from "$_g13_payload" --json >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--remove fixture: the page to be removed is created first"
assert_eq "1" "$(grep -c '\](doomed\.md)' "$_g13_a/SKILL.md" || true)" \
  "--remove fixture: the create landed exactly one nav bullet"

rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-fenced-expert doomed --remove --json 2>&1) || rc=$?
assert_exit 0 "$rc" "--remove on a fenced domain: exits 0"
assert_contains '"action":"removed"' "$out" "--remove on a fenced domain: JSON action=removed"
assert_eq "no" "$([[ -f "$_g13_a/doomed.md" ]] && echo yes || echo no)" \
  "--remove on a fenced domain: the page file is gone"
assert_eq "0" "$(grep -c 'doomed' "$_g13_a/SKILL.md" || true)" \
  "--remove on a fenced domain: no bullet for the slug survives anywhere in SKILL.md"
assert_eq "$_g13_md5_pristine" "$(md5sum "$_g13_a/SKILL.md" | awk '{print $1}')" \
  "--remove on a fenced domain: SKILL.md is byte-identical to before the create"
assert_eq "no" "$([[ -e "$_g13_a/.wiki-write-nav.lock" ]] && echo yes || echo no)" \
  "--remove on a fenced domain: no .wiki-write-nav.lock left behind"
assert_eq "yes" "$([[ -f "$_g13_a/alpha.md" && -f "$_g13_a/gamma.md" && -f "$_g13_a/oldie.md" ]] && echo yes || echo no)" \
  "--remove on a fenced domain: no other page file was touched"

# --- Removing the hand-placed bullet that sits under '### Standalone Pages',
# OUTSIDE the fence. The regenerator never sees that bullet, so if the
# section-scoped awk pass did not reach past the '### ' subheading the bullet
# would survive as an orphan pointing at a deleted file.
rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-fenced-expert oldie --remove --json 2>&1) || rc=$?
assert_exit 0 "$rc" "--remove under a ### subheading: exits 0"
assert_eq "no" "$([[ -f "$_g13_a/oldie.md" ]] && echo yes || echo no)" \
  "--remove under a ### subheading: the page file is gone"
assert_eq "0" "$(grep -c 'oldie' "$_g13_a/SKILL.md" || true)" \
  "--remove under a ### subheading: the unfenced bullet is gone too"
_g13_after_sub="$(cat "$_g13_a/SKILL.md")"
assert_contains "### Standalone Pages" "$_g13_after_sub" \
  "--remove under a ### subheading: the heading itself survives"
assert_contains "- [alpha](alpha.md) — alpha text" "$_g13_after_sub" \
  "--remove under a ### subheading: the fenced entries survive untouched"
assert_contains "## Meta" "$_g13_after_sub" \
  "--remove under a ### subheading: the section after ## Pages survives"

# --- Fixture B: unfenced domain. Same section-scoped delete, no regeneration.
_g13_b="$wt13/.claude/skills/rm-unfenced-expert"
mkdir -p "$_g13_b"
cat > "$_g13_b/SKILL.md" <<'EOF'
---
name: rm-unfenced-expert
description: "test domain: unfenced ## Pages"
---

## Pages

- [alpha](alpha.md) — stale alpha text
- [doomed](doomed.md) — A page about to be removed
- [gamma](gamma.md) — stale gamma text

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$_g13_b/.mditerc"
_g13_page "$_g13_b" alpha "fresh alpha text"
_g13_page "$_g13_b" doomed "A page about to be removed"
_g13_page "$_g13_b" gamma "fresh gamma text"

rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-unfenced-expert doomed --remove --json 2>&1) || rc=$?
assert_exit 0 "$rc" "--remove on an unfenced domain: exits 0"
assert_eq "no" "$([[ -f "$_g13_b/doomed.md" ]] && echo yes || echo no)" \
  "--remove on an unfenced domain: the page file is gone"
assert_eq "0" "$(grep -c 'doomed' "$_g13_b/SKILL.md" || true)" \
  "--remove on an unfenced domain: the bullet is gone"
# The two surviving entries are deliberately drifted from their pages'
# frontmatter. An unfenced domain has no region to rebuild, so they must stay
# drifted -- if they re-synced, the remove path would have regenerated a
# domain that has no fence.
_g13_b_after="$(cat "$_g13_b/SKILL.md")"
assert_contains "- [alpha](alpha.md) — stale alpha text" "$_g13_b_after" \
  "--remove on an unfenced domain: other entries are left exactly as they were, not regenerated"
assert_contains "- [gamma](gamma.md) — stale gamma text" "$_g13_b_after" \
  "--remove on an unfenced domain: the second drifted entry is likewise untouched"

# --- Refusals.
rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-unfenced-expert doomed --remove 2>&1) || rc=$?
assert_exit 2 "$rc" "--remove of an already-removed page: exits 2"
assert_contains "not found" "$out" "--remove of a missing page: error says the page was not found"

# Reproduces scratch/issues/wiki-write-no-page-removal-path.md: the file is
# deleted by hand first, leaving a stale bullet. --remove refuses (the page
# does not exist) and the stale bullet is left for wiki-health to report --
# the repair is to recreate the page and remove it properly.
rm -f "$_g13_b/alpha.md"
rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-unfenced-expert alpha --remove 2>&1) || rc=$?
assert_exit 2 "$rc" "--remove after a hand-deleted file: exits 2, the page does not exist"
assert_eq "1" "$(grep -c '\](alpha\.md)' "$_g13_b/SKILL.md" || true)" \
  "--remove after a hand-deleted file: the stale bullet is left in place, not silently swept"

for _g13_flag in "--update" "--replace"; do
  rc=0; out=""
  out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-unfenced-expert gamma --remove "$_g13_flag" --from "$_g13_payload" 2>&1) || rc=$?
  assert_exit 2 "$rc" "--remove with ${_g13_flag}: rejected, exits 2"
  assert_contains "$_g13_flag" "$out" "--remove with ${_g13_flag}: error names the conflicting flag"
done
assert_eq "yes" "$([[ -f "$_g13_b/gamma.md" ]] && echo yes || echo no)" \
  "--remove with a write flag: rejected at parse, the target page is still on disk"

rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-unfenced-expert gamma --remove --from "$_g13_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "--remove with --from: rejected, exits 2"
assert_contains "--from" "$out" "--remove with --from: error names --from"

rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-unfenced-expert gamma --remove --append-section "Notes" --from "$_g13_payload" 2>&1) || rc=$?
assert_exit 2 "$rc" "--remove with --append-section: rejected, exits 2"
assert_contains "--append-section" "$out" "--remove with --append-section: error names the conflicting flag"

# --- Lock busy: the one place --remove differs from the write modes. They
# exit 0 on a timeout because their page write has already landed; --remove
# has touched nothing yet, so it exits 4 and says so. A held lock with a FRESH
# mtime is not broken as stale, so acquisition waits out the full 10s timeout.
_g13_lock="$_g13_b/.wiki-write-nav.lock"
mkdir -p "$_g13_lock"
printf '999999\n' > "$_g13_lock/pid"
_g13_md5_locked_before="$(md5sum "$_g13_b/SKILL.md" | awk '{print $1}')"
rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-unfenced-expert gamma --remove 2>&1) || rc=$?
assert_exit 4 "$rc" "--remove with the nav lock held: exits 4"
assert_contains "NOTHING was removed" "$out" "--remove with the nav lock held: error states nothing was removed"
assert_contains ".wiki-write-nav.lock" "$out" "--remove with the nav lock held: error names the lock path"
assert_eq "yes" "$([[ -f "$_g13_b/gamma.md" ]] && echo yes || echo no)" \
  "--remove with the nav lock held: the page file is still on disk"
assert_eq "$_g13_md5_locked_before" "$(md5sum "$_g13_b/SKILL.md" | awk '{print $1}')" \
  "--remove with the nav lock held: SKILL.md is byte-identical, the bullet still points at a page that exists"
rm -rf "$_g13_lock"

# --- Containment (CWE-59/CWE-22): _validate_slug permits one '/' separator, so
# a symlinked INTERMEDIATE component can steer the delete outside the domain.
# The -f test follows it transparently; the realpath containment check must
# refuse before the rm. A leaf symlink is a separate, safe case (only the link
# is unlinked) and is not what this covers.
_g13_out="$TMPDIR_ROOT/g13-outside"
mkdir -p "$_g13_out"
cat > "$_g13_out/victim.md" <<'EOF'
---
tags: [victim]
summary: "a file outside the domain that must survive"
---
# victim
EOF
ln -s "$_g13_out" "$_g13_b/escape"
rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-unfenced-expert escape/victim --remove 2>&1) || rc=$?
assert_eq "yes" "$([[ "$rc" -ne 0 ]] && echo yes || echo no)" \
  "--remove through a symlinked path component: refused (non-zero exit)"
assert_eq "yes" "$([[ -f "$_g13_out/victim.md" ]] && echo yes || echo no)" \
  "--remove through a symlinked path component: the file outside the domain still exists"
assert_contains "does not resolve" "$out" \
  "--remove through a symlinked path component: error says the path does not resolve inside the domain"
rm -f "$_g13_b/escape"

# --- Bullet anchoring (CWE-707): a DIFFERENT page's bullet whose summary prose
# links the removed slug must survive. A whole-line substring test would drop it
# silently, removing an unrelated nav entry.
_g13_c="$wt13/.claude/skills/rm-anchor-expert"
mkdir -p "$_g13_c"
cat > "$_g13_c/SKILL.md" <<'EOF'
---
name: rm-anchor-expert
description: "test domain: a bullet whose summary links another page"
---

## Pages

- [keeper](keeper.md) — see also [doomed](doomed.md) for the older approach
- [doomed](doomed.md) — the page being removed

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$_g13_c/.mditerc"
_g13_page "$_g13_c" keeper "see also [doomed](doomed.md) for the older approach"
_g13_page "$_g13_c" doomed "the page being removed"

rc=0
(cd "$wt13" && bash "$WIKI_WRITE" rm-anchor-expert doomed --remove --json >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--remove with a cross-linking summary: exits 0"
_g13_c_after="$(cat "$_g13_c/SKILL.md")"
assert_contains "- [keeper](keeper.md) — see also [doomed](doomed.md) for the older approach" "$_g13_c_after" \
  "--remove anchors to the bullet's own link: the keeper bullet survives even though its summary links the removed slug"
assert_eq "0" "$(grep -c '^- \[doomed\](doomed\.md)' "$_g13_c/SKILL.md" || true)" \
  "--remove anchors to the bullet's own link: the real doomed bullet is gone"
assert_eq "no" "$([[ -f "$_g13_c/doomed.md" ]] && echo yes || echo no)" \
  "--remove anchors to the bullet's own link: the doomed page file is gone"

# --- Pre-flight (CWE-459): nothing irreversible may happen before the steps
# that can fail. With SKILL.md read-only the mode must refuse with the page
# still on disk, rather than deleting it and failing to land the nav rewrite.
_g13_d="$wt13/.claude/skills/rm-preflight-expert"
mkdir -p "$_g13_d"
cat > "$_g13_d/SKILL.md" <<'EOF'
---
name: rm-preflight-expert
description: "test domain: read-only SKILL.md"
---

## Pages

- [doomed](doomed.md) — the page being removed

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$_g13_d/.mditerc"
_g13_page "$_g13_d" doomed "the page being removed"
chmod a-w "$_g13_d/SKILL.md"
rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-preflight-expert doomed --remove 2>&1) || rc=$?
assert_eq "yes" "$([[ "$rc" -ne 0 ]] && echo yes || echo no)" \
  "--remove with an unwritable SKILL.md: refused (non-zero exit)"
assert_eq "yes" "$([[ -f "$_g13_d/doomed.md" ]] && echo yes || echo no)" \
  "--remove with an unwritable SKILL.md: the page is NOT deleted — no dangling bullet is manufactured"
assert_contains "NOTHING was removed" "$out" \
  "--remove with an unwritable SKILL.md: error states nothing was removed"
chmod u+w "$_g13_d/SKILL.md"

# A removal must never auto-initialize a domain in order to report the page missing.
rc=0; out=""
out=$(cd "$wt13" && bash "$WIKI_WRITE" rm-nonexistent-expert whatever --remove 2>&1) || rc=$?
assert_exit 3 "$rc" "--remove on an unresolvable domain: exits 3"
assert_eq "no" "$([[ -d "$wt13/.claude/skills/rm-nonexistent-expert" ]] && echo yes || echo no)" \
  "--remove on an unresolvable domain: no domain folder was auto-initialized"

# ============================================================
echo ""
echo "=== Group 14: --rename, and referrers + rulings on --remove ==="
# ============================================================

wt14="$TMPDIR_ROOT/wt14"
_g14="$wt14/.claude/skills/rn-expert"
_g14_other="$wt14/.claude/skills/rn-other-expert"
mkdir -p "$_g14/grp" "$_g14/.hidden" "$_g14/.rulings" "$_g14_other"

_g14_page() {
  local dir="$1" slug="$2" summary="$3" body="$4"
  mkdir -p "$(dirname "$dir/$slug.md")"
  printf -- '---\ntags: [%s]\nsummary: "%s"\n---\n# %s\n\n%s\n' "$slug" "$summary" "$slug" "$body" > "$dir/$slug.md"
}

cat > "$_g14/SKILL.md" <<'EOF'
---
name: rn-expert
description: "test domain: rename with a group, referrers and rulings"
---

## Pages

<!-- BEGIN:PAGES -->
- [Alpha Subject](a.md) — alpha summary
- [grp/](grp/index.md) — group hub
- [Other](other.md) — other summary
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$_g14/.mditerc"
_g14_page "$_g14" a "alpha summary" "Alpha body."
_g14_page "$_g14" other "other summary" "See [alpha](a.md#section) for the rule."
_g14_page "$_g14" grp/index "group hub" "## Pages

- [Alpha, from the group](../a.md) — cross link
- [Page](page.md) — page"
_g14_page "$_g14" grp/page "page summary" "Background in [the alpha page](../a.md)."
# Not referrers: a dot-directory file, and a page linking a same-named file elsewhere.
_g14_page "$_g14" .hidden/notes "hidden" "Links [a](../a.md)."
_g14_page "$_g14_other" a "a different a" "Own page."
_g14_page "$_g14_other" x "cross-domain referrer" "See [rn alpha](../rn-expert/a.md) and [own a](a.md)."
printf 'entrypoint: SKILL.md\n' > "$_g14_other/.mditerc"
printf -- '---\nname: rn-other-expert\ndescription: "x"\n---\n\n## Pages\n\n- [a](a.md) — a different a\n- [x](x.md) — cross-domain referrer\n\n## Meta\n' > "$_g14_other/SKILL.md"
printf -- '- `a` — keep this subject at the root\n- `z` — a ruling for another page\n' > "$_g14/.rulings/_root.md"

(cd "$wt14" && git init -q && git config user.email t@t && git config user.name T && git add -A && git commit -qm fixture)

rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert a --rename b 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--rename a b: exits 0"
assert_eq "yes" "$([[ -f "$_g14/b.md" && ! -e "$_g14/a.md" ]] && echo yes || echo no)" \
  "--rename a b: b.md exists and a.md does not"
assert_contains "- [Alpha Subject](b.md) — alpha summary" "$(cat "$_g14/SKILL.md")" \
  "--rename a b: the fenced bullet links b.md; a title that is not the old slug and the summary are unchanged"
assert_eq "0" "$(grep -c '(a\.md)' "$_g14/SKILL.md" || true)" \
  "--rename a b: no bullet still links a.md"
assert_eq "- \`b\` — keep this subject at the root" "$(head -1 "$_g14/.rulings/_root.md")" \
  "--rename a b: the ruling key reads b, sorted first"
assert_contains "- \`z\` — a ruling for another page" "$(cat "$_g14/.rulings/_root.md")" \
  "--rename a b: an unrelated ruling survives"
assert_eq "renamed a -> b" "$(printf '%s\n' "$out" | head -1)" \
  "--rename a b: prints the renamed line first"
assert_eq "4" "$(printf '%s\n' "$out" | grep -c '^referrer ' || true)" \
  "--rename a b: four referrer lines print (three same-domain, one cross-domain)"
for _g14_ref in "$_g14/other.md" "$_g14/grp/index.md" "$_g14/grp/page.md" "$_g14_other/x.md"; do
  assert_contains "referrer $_g14_ref" "$out" "--rename a b: referrer ${_g14_ref#"$wt14/"} is named"
done
assert_not_contains ".hidden" "$out" "--rename a b: a dot-directory file is not a referrer"
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert grp/page --rename grp/page2 --json 2>/dev/null) || true
assert_eq '{"action":"renamed","from":"grp/page","to":"grp/page2","referrers":[]}' "$out" \
  "--rename --json: referrers is a JSON array; the group index whose bullet the rename re-pointed is not one"
assert_contains "- [Page](page2.md) — page" "$(cat "$_g14/grp/index.md")" \
  "--rename grp/page grp/page2: the group index bullet is re-pointed in place"
(cd "$wt14" && bash "$WIKI_WRITE" rn-expert grp/page2 --rename grp/page >/dev/null 2>&1) || true
assert_contains "](../a.md)" "$(cat "$_g14/grp/page.md")" "--rename a b: no referrer was edited"
assert_eq "no" "$([[ -e "$_g14/.wiki-write-nav.lock" ]] && echo yes || echo no)" \
  "--rename a b: no nav lock left behind"

(cd "$wt14" && git add -A && git commit -qm renamed)
_g14_page "$_g14" c "c summary" "C body."
(cd "$wt14" && git add -A && git commit -qm c)
rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert b --rename c 2>&1) || rc=$?
assert_exit 2 "$rc" "--rename b c onto an existing page: exits 2"
assert_contains "merge" "$out" "--rename onto an existing page: error names it a merge"
assert_eq "" "$(cd "$wt14" && git status --porcelain)" \
  "--rename onto an existing page: git status shows nothing changed"

rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert b --rename c --json 2>&1) || rc=$?
assert_exit 2 "$rc" "--rename onto an existing page with --json: still exits 2"

_g14_lock="$_g14/.wiki-write-nav.lock"
mkdir -p "$_g14_lock"
printf '999999\n' > "$_g14_lock/pid"
rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert b --rename d 2>&1) || rc=$?
assert_exit 4 "$rc" "--rename with the nav lock held: exits 4"
assert_contains "NOTHING was moved" "$out" "--rename with the nav lock held: error states nothing was moved"
assert_eq "yes" "$([[ -f "$_g14/b.md" && ! -e "$_g14/d.md" ]] && echo yes || echo no)" \
  "--rename with the nav lock held: nothing moved"
rm -rf "$_g14_lock"
assert_eq "" "$(cd "$wt14" && git status --porcelain)" \
  "--rename with the nav lock held: git status shows nothing changed"

# Group change: the ruling moves to the group's shard, --json carries referrers.
rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert b --rename grp/b --json 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--rename b grp/b: exits 0"
assert_eq '{"action":"renamed","from":"b","to":"grp/b","referrers":[]}' "$out" \
  "--rename --json: action, from, to and the referrer array (empty: nothing links b.md)"
assert_eq "yes" "$([[ -f "$_g14/grp/b.md" && ! -e "$_g14/b.md" ]] && echo yes || echo no)" \
  "--rename b grp/b: the page moved into the group folder"
assert_eq "- \`grp/b\` — keep this subject at the root" "$(cat "$_g14/.rulings/grp.md")" \
  "--rename b grp/b: the ruling moved to the group's shard with the new key"
assert_eq "0" "$(grep -c '`b`' "$_g14/.rulings/_root.md" || true)" \
  "--rename b grp/b: the old shard no longer holds the key"
assert_contains "- [Alpha Subject](b.md) — alpha summary" "$(cat "$_g14/grp/index.md")" \
  "--rename b grp/b: the bullet moves into the group index, linked relative to it"
assert_eq "0" "$(grep -c '(grp/b\.md)\|(b\.md)' "$_g14/SKILL.md" || true)" \
  "--rename b grp/b: SKILL.md no longer lists the page"

# Refusals.
rc=0
(cd "$wt14" && bash "$WIKI_WRITE" rn-expert grp/b --rename "../escape" >/dev/null 2>&1) || rc=$?
assert_exit 2 "$rc" "--rename to an invalid slug: exits 2"
rc=0
(cd "$wt14" && bash "$WIKI_WRITE" rn-expert missing --rename other2 >/dev/null 2>&1) || rc=$?
assert_exit 2 "$rc" "--rename of a missing page: exits 2"
for _g14_flag in "--remove" "--update" "--from $FULL_PAYLOAD" "--append-section Notes --from $FULL_PAYLOAD"; do
  rc=0; out=""
  # shellcheck disable=SC2086
  out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert other --rename other2 $_g14_flag 2>&1) || rc=$?
  assert_exit 2 "$rc" "--rename combined with ${_g14_flag%% *}: exits 2"
done
assert_eq "yes" "$([[ -f "$_g14/other.md" && ! -e "$_g14/other2.md" ]] && echo yes || echo no)" \
  "--rename refused at parse: nothing moved"
rc=0
(cd "$wt14" && bash "$WIKI_WRITE" rn-missing-expert a --rename b >/dev/null 2>&1) || rc=$?
assert_exit 3 "$rc" "--rename on an unresolvable domain: exits 3"
assert_eq "no" "$([[ -d "$wt14/.claude/skills/rn-missing-expert" ]] && echo yes || echo no)" \
  "--rename on an unresolvable domain: no domain auto-initialized"

# --remove deletes the ruling (and the emptied shard) and names referrers.
rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert grp/b --remove 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--remove grp/b: exits 0"
assert_eq "no" "$([[ -e "$_g14/.rulings/grp.md" ]] && echo yes || echo no)" \
  "--remove grp/b: its ruling line is deleted and the emptied shard with it"
assert_contains "- \`z\` — a ruling for another page" "$(cat "$_g14/.rulings/_root.md")" \
  "--remove grp/b: another shard's ruling survives"
assert_eq "0" "$(printf '%s\n' "$out" | grep -c '^referrer ' || true)" \
  "--remove grp/b: links to the pre-rename path a.md are not referrers of grp/b"
assert_eq "$_g14/grp/b.md" "$(printf '%s\n' "$out" | head -1)" \
  "--remove grp/b: its existing path line still prints first"
rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert grp/page --remove 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--remove grp/page: exits 0"
assert_eq "0" "$(grep -c '](page\.md)' "$_g14/grp/index.md" || true)" \
  "--remove grp/page: its bullet is dropped from the group index"
assert_eq "" "$(printf '%s\n' "$out" | sed -n 2p)" \
  "--remove grp/page: the group index whose bullet the removal dropped is not a referrer"
rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-expert c --remove --json 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--remove --json: exits 0"
assert_contains '"action":"removed","referrers":[]}' "$out" \
  "--remove --json: adds an empty referrer array for an unlinked page"

# Security hardening: control characters in referrer names, a same-group
# rename that keeps its ruling, a page appearing at the new slug while the
# rename waits for the lock, and a symlinked .rulings directory.
_g14s="$wt14/.claude/skills/rn-sec-expert"
mkdir -p "$_g14s/.rulings"
printf -- '---\nname: rn-sec-expert\ndescription: "x"\n---\n\n## Pages\n\n<!-- BEGIN:PAGES -->\n- [p](p.md) — p summary\n- [q](q.md) — q summary\n<!-- END:PAGES -->\n\n## Meta\n' > "$_g14s/SKILL.md"
printf 'entrypoint: SKILL.md\n' > "$_g14s/.mditerc"
_g14_page "$_g14s" p "p summary" "P body."
_g14_page "$_g14s" q "q summary" "Q body."
_g14s_nl="$_g14s/odd
name.md"
_g14_page "$_g14s" "odd
name" "odd" "See [p](p.md) and [p2](p2.md)."
printf -- '- `p` — p ruling\n- `q` — q ruling\n' > "$_g14s/.rulings/_root.md"

rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-sec-expert p --rename p2 --json 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--rename with a newline in a referrer's file name: exits 0"
assert_eq "1" "$(grep -cF -- '"referrers":["'"$_g14s"'/odd\u000aname.md"]' <<< "$out" || true)" \
  "--rename --json: a newline in a referrer path is escaped as a JSON unicode escape"
assert_eq "- \`p2\` — p ruling" "$(head -1 "$_g14s/.rulings/_root.md")" \
  "--rename within one shard: the ruling survives under the new key"
assert_contains "- \`q\` — q ruling" "$(cat "$_g14s/.rulings/_root.md")" \
  "--rename within one shard: the shard's other ruling survives"
rc=0; out=""
out=$(cd "$wt14" && bash "$WIKI_WRITE" rn-sec-expert p2 --rename p 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--rename back p2 -> p: exits 0"
assert_eq "1" "$(printf '%s\n' "$out" | grep -c '^referrer ' || true)" \
  "--rename text output: a newline in a referrer path does not forge a second referrer line"
assert_contains "referrer $(printf '%q' "$_g14s_nl")" "$out" \
  "--rename text output: a control-character referrer path prints in %q form"
rm -f -- "$_g14s_nl"

mkdir "$_g14s/.wiki-write-nav.lock"
( sleep 1; _g14_page "$_g14s" late "late" "Late."; rmdir "$_g14s/.wiki-write-nav.lock" ) &
_g14s_bg=$!
rc=0
(cd "$wt14" && bash "$WIKI_WRITE" rn-sec-expert q --rename late >/dev/null 2>&1) || rc=$?
wait "$_g14s_bg"
assert_exit 2 "$rc" "--rename onto a page created while it waited for the lock: exits 2"
assert_eq "yes" "$([[ -f "$_g14s/q.md" && "$(cat "$_g14s/late.md")" == *Late.* ]] && echo yes || echo no)" \
  "--rename onto a page created while it waited for the lock: neither page is touched"

_g14s_out="$TMPDIR_ROOT/rulings-outside"
mkdir -p "$_g14s_out"
printf -- '- `q` — outside ruling\n' > "$_g14s_out/_root.md"
rm -rf "$_g14s/.rulings"
ln -s "$_g14s_out" "$_g14s/.rulings"
rc=0
(cd "$wt14" && bash "$WIKI_WRITE" rn-sec-expert q --remove >/dev/null 2>&1) || rc=$?
assert_exit 3 "$rc" "--remove with a symlinked .rulings directory: exits 3"
assert_eq "yes" "$([[ -f "$_g14s/q.md" && "$(cat "$_g14s_out/_root.md")" == *"outside ruling"* ]] && echo yes || echo no)" \
  "--remove with a symlinked .rulings directory: the page and the outside file are untouched"
rc=0
(cd "$wt14" && bash "$WIKI_WRITE" rn-sec-expert q --rename q3 >/dev/null 2>&1) || rc=$?
assert_exit 3 "$rc" "--rename with a symlinked .rulings directory: exits 3"
assert_eq "yes" "$([[ -f "$_g14s/q.md" && ! -e "$_g14s/q3.md" ]] && echo yes || echo no)" \
  "--rename with a symlinked .rulings directory: nothing moved"

# ============================================================
echo ""
echo "=== Group 15: --remove of a fence's last bullet leaves no empty fence ==="
# ============================================================
# Two fenced runs split by a blank line. Removing the second run's only
# bullet must drop its emptied BEGIN/END pair and one of the blank lines
# around it, before the regeneration that would otherwise merge the fences; a stray empty pair would otherwise catch no later
# insert and read as a second, orphaned Pages list.

wt15="$TMPDIR_ROOT/wt15"
_g15="$wt15/.claude/skills/rm-lastfence-expert"
mkdir -p "$_g15"
cat > "$_g15/SKILL.md" <<'EOF'
---
name: rm-lastfence-expert
description: "test domain: two fenced runs"
---

## Pages

<!-- BEGIN:PAGES -->
- [alpha](alpha.md) — alpha text
<!-- END:PAGES -->

<!-- BEGIN:PAGES -->
- [lone](lone.md) — lone text
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$_g15/.mditerc"
_g13_page "$_g15" alpha "alpha text"
_g13_page "$_g15" lone "lone text"

_g15_expected="$TMPDIR_ROOT/g15-expected.md"
cat > "$_g15_expected" <<'EOF'
---
name: rm-lastfence-expert
description: "test domain: two fenced runs"
---

## Pages

<!-- BEGIN:PAGES -->
- [alpha](alpha.md) — alpha text
<!-- END:PAGES -->

## Meta
EOF

rc=0
(cd "$wt15" && bash "$WIKI_WRITE" rm-lastfence-expert lone --remove >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--remove of a fence's only bullet: exits 0"
assert_eq "yes" "$(cmp -s "$_g15_expected" "$_g15/SKILL.md" && echo yes || echo no)" \
  "--remove of a fence's only bullet: the emptied fence pair and its blank line are gone"

_g15_payload="$TMPDIR_ROOT/g15-payload.md"
printf -- '---\ntags: [rm-lastfence-expert/beta]\nsummary: "beta text"\n---\n# beta\n\n## One\nBody.\n' > "$_g15_payload"
rc=0
(cd "$wt15" && bash "$WIKI_WRITE" rm-lastfence-expert beta --from "$_g15_payload" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "create after an emptied fence was dropped: exits 0"
assert_eq "<!-- BEGIN:PAGES -->|- [alpha](alpha.md) — alpha text|- [beta](beta.md) — beta text|<!-- END:PAGES -->" \
  "$(sed -n '/^<!-- BEGIN:PAGES -->/,/^<!-- END:PAGES -->/p' "$_g15/SKILL.md" | paste -sd'|')" \
  "create after an emptied fence was dropped: the new bullet joins the one remaining fence"

# ============================================================
echo "=== Group 16: fenced runs separated only by blank lines regenerate as one fence ==="
# ============================================================
# The Blank-Line Rule: an END marker, blank lines, then a BEGIN marker inside
# ## Pages is one run, so any fenced write merges the two fences. A second
# write with nothing new leaves SKILL.md byte-identical.

wt16="$TMPDIR_ROOT/wt16"
_g16="$wt16/.claude/skills/merge-fence-expert"
mkdir -p "$_g16"
cat > "$_g16/SKILL.md" <<'EOF'
---
name: merge-fence-expert
description: "test domain: two fenced runs split by blank lines"
---

## Pages

<!-- BEGIN:PAGES -->
- [alpha](alpha.md) — alpha text
<!-- END:PAGES -->


<!-- BEGIN:PAGES -->
- [delta](delta.md) — stale delta text
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$_g16/.mditerc"
_g13_page "$_g16" alpha "alpha text"
_g13_page "$_g16" delta "delta text"

_g16_payload="$TMPDIR_ROOT/g16-payload.md"
printf -- '---\ntags: [merge-fence-expert/beta]\nsummary: "beta text"\n---\n# beta\n\n## One\nBody.\n' > "$_g16_payload"
rc=0
(cd "$wt16" && bash "$WIKI_WRITE" merge-fence-expert beta --from "$_g16_payload" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "create in a domain with blank-line-split fences: exits 0"
assert_eq "## Pages||<!-- BEGIN:PAGES -->|- [alpha](alpha.md) — alpha text|- [delta](delta.md) — delta text|- [beta](beta.md) — beta text|<!-- END:PAGES -->||## Meta" \
  "$(sed -n '/^## Pages/,$p' "$_g16/SKILL.md" | paste -sd'|')" \
  "create in a domain with blank-line-split fences: one fence holds every bullet, blank lines between the fences gone"

cp "$_g16/SKILL.md" "$TMPDIR_ROOT/g16-after-first.md"
rc=0
(cd "$wt16" && bash "$WIKI_WRITE" merge-fence-expert beta --update --from "$_g16_payload" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "second write after the merge: exits 0"
assert_eq "yes" "$(cmp -s "$TMPDIR_ROOT/g16-after-first.md" "$_g16/SKILL.md" && echo yes || echo no)" \
  "second write after the merge: SKILL.md byte-identical"

# ============================================================
echo ""
echo "=== Group 17: --rename re-titles a slug-titled bullet; --title sets it ==="
# ============================================================
# A bullet titled exactly with the old slug (the shape a create writes) takes
# the new slug; any other title is kept. --title overrides both. Position,
# decoration and summary never change.

wt17="$TMPDIR_ROOT/wt17"
_g17="$wt17/.claude/skills/rt-expert"
_g17u="$wt17/.claude/skills/rt-flat-expert"
mkdir -p "$_g17" "$_g17u"
cat > "$_g17/SKILL.md" <<'EOF'
---
name: rt-expert
description: "test domain: rename titles"
---

## Pages

<!-- BEGIN:PAGES -->
- [first](first.md) — first summary
- [s1](s1.md) — s1 summary
- [Human Title](h1.md) (legacy) — h1 summary
- [last](last.md) — last summary
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$_g17/.mditerc"
for _g17_s in first s1 h1 last; do _g13_page "$_g17" "$_g17_s" "${_g17_s} summary"; done
_g17_before="$TMPDIR_ROOT/g17-before.md"

cp "$_g17/SKILL.md" "$_g17_before"
rc=0
(cd "$wt17" && bash "$WIKI_WRITE" rt-expert s1 --rename s2 >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--rename of a slug-titled bullet: exits 0"
assert_eq "$(sed 's/^- \[s1\](s1\.md)/- [s2](s2.md)/' "$_g17_before")" "$(cat "$_g17/SKILL.md")" \
  "--rename of a slug-titled bullet: the title becomes the new slug in place, all else byte-identical"

cp "$_g17/SKILL.md" "$_g17_before"
rc=0
(cd "$wt17" && bash "$WIKI_WRITE" rt-expert h1 --rename h2 >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--rename of a human-titled bullet: exits 0"
assert_eq "$(sed 's/(h1\.md)/(h2.md)/' "$_g17_before")" "$(cat "$_g17/SKILL.md")" \
  "--rename of a human-titled bullet: only the link target changes, byte-identical otherwise"

cp "$_g17/SKILL.md" "$_g17_before"
rc=0
(cd "$wt17" && bash "$WIKI_WRITE" rt-expert s2 --rename s3 --title "Subject Three" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--rename --title on a slug-titled bullet: exits 0"
assert_eq "$(sed 's/^- \[s2\](s2\.md)/- [Subject Three](s3.md)/' "$_g17_before")" "$(cat "$_g17/SKILL.md")" \
  "--rename --title on a slug-titled bullet: the given title lands in place, all else byte-identical"

cp "$_g17/SKILL.md" "$_g17_before"
rc=0
(cd "$wt17" && bash "$WIKI_WRITE" rt-expert h2 --rename h3 --title 'Renamed — `Human` & $Co' >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--rename --title on a decorated human-titled bullet: exits 0"
assert_eq "$(sed 's/^- \[Human Title\](h2\.md)/- [Renamed — `Human` \& $Co](h3.md)/' "$_g17_before")" "$(cat "$_g17/SKILL.md")" \
  "--rename --title on a decorated human-titled bullet: title replaced, decoration and summary kept"

# Refusals: every one exits 2 at parse and moves nothing.
cp "$_g17/SKILL.md" "$_g17_before"
for _g17_bad in "a]b" "a[b" 'a\b' "$(printf 'a\nb')" "$(printf 'a\tb')" "" "   "; do
  rc=0; out=""
  out=$(cd "$wt17" && bash "$WIKI_WRITE" rt-expert last --rename last2 --title "$_g17_bad" 2>&1) || rc=$?
  assert_exit 2 "$rc" "--title $(printf '%q' "$_g17_bad"): exits 2"
  assert_contains "--title" "$out" "--title $(printf '%q' "$_g17_bad"): the error names --title"
done
rc=0; out=""
out=$(cd "$wt17" && bash "$WIKI_WRITE" rt-expert last --remove --title "X" 2>&1) || rc=$?
assert_exit 2 "$rc" "--title with --remove: exits 2"
assert_contains "--title is valid only with --rename" "$out" "--title with --remove: the error says it needs --rename"
rc=0; out=""
out=$(cd "$wt17" && bash "$WIKI_WRITE" rt-expert newpage --from "$FULL_PAYLOAD" --title "X" 2>&1) || rc=$?
assert_exit 2 "$rc" "--title with a create: exits 2"
assert_contains "--title is valid only with --rename" "$out" "--title with a create: the error says it needs --rename"
assert_eq "yes" "$([[ -f "$_g17/last.md" && ! -e "$_g17/last2.md" && ! -e "$_g17/newpage.md" ]] && cmp -s "$_g17_before" "$_g17/SKILL.md" && echo yes || echo no)" \
  "--title refusals: no page moved or created and SKILL.md is untouched"

# Unfenced nav: the same default applies without a regenerator.
printf -- '---\nname: rt-flat-expert\ndescription: "x"\n---\n\n## Pages\n\n- [u1](u1.md) — u1 summary\n- [Kept Name](u2.md) — u2 summary\n\n## Meta\n' > "$_g17u/SKILL.md"
printf 'entrypoint: SKILL.md\n' > "$_g17u/.mditerc"
_g13_page "$_g17u" u1 "u1 summary"
_g13_page "$_g17u" u2 "u2 summary"
rc=0
(cd "$wt17" && bash "$WIKI_WRITE" rt-flat-expert u1 --rename u1b >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "--rename in an unfenced nav: exits 0"
assert_eq "- [u1b](u1b.md) — u1 summary|- [Kept Name](u2.md) — u2 summary" \
  "$(grep '^- ' "$_g17u/SKILL.md" | paste -sd'|')" \
  "--rename in an unfenced nav: the slug-titled bullet is re-titled in place"

# ============================================================
echo ""
echo "=== Group 18: project-scope auto-init stays inside a git work tree ==="
# ============================================================
# The walk-up for a project root stops at the first ancestor holding
# .claude/skills/. Run from under $HOME outside any repo, that ancestor is
# $HOME itself and a create would scaffold a stray domain into the
# user-scope tree.

# (a) $HOME is the only ancestor with .claude/skills/.
g18_home="$TMPDIR_ROOT/g18-home"
mkdir -p "$g18_home/.claude/skills" "$g18_home/work/sub"
rc=0; out=""
out=$(cd "$g18_home/work/sub" && HOME="$g18_home" bash "$WIKI_WRITE" stray-expert page-one --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_exit 3 "$rc" "auto-init under \$HOME: exits 3"
assert_contains "$g18_home/work/sub" "$out" "auto-init under \$HOME: message names the working directory"
assert_contains "repository root" "$out" "auto-init under \$HOME: message says to run from the repository root"
assert_eq "0" "$(find "$g18_home/.claude/skills" -mindepth 1 | wc -l | tr -d ' ')" \
  "auto-init under \$HOME: nothing is created under \$HOME/.claude/skills/"

# (b) a stray .claude/skills/ outside any repo and outside $HOME.
g18_norepo="$TMPDIR_ROOT/g18-norepo"
mkdir -p "$g18_norepo/.claude/skills" "$g18_norepo/sub"
rc=0; out=""
out=$(cd "$g18_norepo/sub" && bash "$WIKI_WRITE" stray-expert page-one --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_exit 3 "$rc" "auto-init outside a git work tree: exits 3"
assert_contains "$g18_norepo/sub" "$out" "auto-init outside a git work tree: message names the working directory"
assert_contains "not inside a git work tree" "$out" "auto-init outside a git work tree: message names the reason"
assert_eq "0" "$(find "$g18_norepo/.claude/skills" -mindepth 1 | wc -l | tr -d ' ')" \
  "auto-init outside a git work tree: nothing is created under .claude/skills/"

# (c) the same call from a subdirectory of a git-inited repo under that
# $HOME still auto-inits, into the repo rather than $HOME.
g18_repo="$g18_home/work/repo"
mkdir -p "$g18_repo/.claude/skills" "$g18_repo/sub"
git init -q "$g18_repo"
rc=0; out=""
out=$(cd "$g18_repo/sub" && HOME="$g18_home" bash "$WIKI_WRITE" fresh-expert page-one --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "auto-init inside a git repo: exits 0"
assert_contains '"action":"created"' "$out" "auto-init inside a git repo: JSON action=created"
assert_eq "yes" "$([[ -f "$g18_repo/.claude/skills/fresh-expert/page-one.md" ]] && echo yes || echo no)" \
  "auto-init inside a git repo: the page lands in the repo's domain"
assert_eq "0" "$(find "$g18_home/.claude/skills" -mindepth 1 | wc -l | tr -d ' ')" \
  "auto-init inside a git repo: nothing is created under \$HOME/.claude/skills/"

# (d) a linked worktree has a .git file, not a directory; auto-init proceeds.
g18_main="$TMPDIR_ROOT/g18-main"
mkdir -p "$g18_main/.claude/skills"
: > "$g18_main/.claude/skills/.keep"
git init -q "$g18_main"
git -C "$g18_main" add -A
git -C "$g18_main" -c user.name=test -c user.email=test@example.com -c core.hooksPath=/dev/null commit -q -m fixture
git -C "$g18_main" worktree add -q "$TMPDIR_ROOT/g18-linked" 2>/dev/null
rc=0; out=""
out=$(cd "$TMPDIR_ROOT/g18-linked" && bash "$WIKI_WRITE" linked-expert page-one --from "$FULL_PAYLOAD" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "auto-init in a linked worktree: exits 0"
assert_eq "yes" "$([[ -f "$TMPDIR_ROOT/g18-linked/.claude/skills/linked-expert/page-one.md" ]] && echo yes || echo no)" \
  "auto-init in a linked worktree: the page lands in the worktree's domain"

# ============================================================
echo ""
echo "=== Group 19: a create into an empty fence lands inside it ==="
# ============================================================
# The protocols/init.md SKILL.md template scaffolds an empty
# BEGIN/END:PAGES pair. The flat create branch once anchored on the last
# bullet or the '## Pages' heading, so the first entry landed above the
# fence and every later one followed it there.

# _g19_make_domain ROOT NAME -- a domain whose SKILL.md is the init.md template.
_g19_make_domain() {
  local dir="$1/.claude/skills/$2"
  mkdir -p "$dir"
  cat > "$dir/SKILL.md" <<SKILLMD
---
name: $2
description: "fixture scaffolded from the init.md SKILL.md template"
wiki: true
---

## Pages
<!-- Pages are listed below, one bullet per page: a markdown link to the page
     file, an em dash, then that page's one-line summary. wiki-write writes
     them into the fenced region on every write. -->
<!-- BEGIN:PAGES -->
<!-- END:PAGES -->

## Meta
- [Schema](schema.md) — Wiki conventions and page-type definitions
SKILLMD
  printf 'entrypoint: SKILL.md\n' > "$dir/.mditerc"
}

# _g19_fence_interior FILE -- the lines strictly between the first
# BEGIN:PAGES and END:PAGES markers, '|'-joined.
_g19_fence_interior() {
  awk '/^<!-- END:PAGES -->/ { exit } f { print } /^<!-- BEGIN:PAGES -->/ { f = 1 }' "$1" | paste -sd'|' -
}

wt19="$TMPDIR_ROOT/wt19"
_g19_make_domain "$wt19" empty-fence-expert
g19_skill="$wt19/.claude/skills/empty-fence-expert/SKILL.md"

rc=0
(cd "$wt19" && bash "$WIKI_WRITE" empty-fence-expert page-one --from "$FULL_PAYLOAD" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "empty fence: first create exits 0"
rc=0
(cd "$wt19" && bash "$WIKI_WRITE" empty-fence-expert page-two --from "$FULL_PAYLOAD" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "empty fence: second create exits 0"

g19_interior="$(_g19_fence_interior "$g19_skill")"
assert_contains "](page-one.md)" "$g19_interior" "empty fence: the first entry sits inside the fence"
assert_contains "](page-two.md)" "$g19_interior" "empty fence: the second entry sits inside the fence"
assert_eq "2" "$(tr '|' '\n' <<< "$g19_interior" | grep -c '^- ' || true)" \
  "empty fence: the fence holds exactly the two entries"
assert_eq "0" "$(sed -n '/^## Pages/,/^<!-- BEGIN:PAGES -->/p' "$g19_skill" | grep -c '^- ' || true)" \
  "empty fence: no entry sits between ## Pages and the fence"
g19_json="$(cd "$wt19" && bash "$SCRIPT_DIR/wiki-health.sh" empty-fence-expert --json 2>/dev/null || true)"
assert_contains '"reasons": [' "$g19_json" "empty fence: wiki-health --json returned a verdict"
assert_not_contains '"code":"MISSING_PAGES_FENCE"' "$g19_json" "empty fence: wiki-health lists no MISSING_PAGES_FENCE"

# A bullet stranded above an empty fence by the old behavior is never the
# anchor: the new entry still goes inside the fence.
_g19_make_domain "$wt19" stray-bullet-expert
g19s_skill="$wt19/.claude/skills/stray-bullet-expert/SKILL.md"
sed -i 's/^<!-- BEGIN:PAGES -->$/- [Stray](stray.md) — left outside by the old create\n&/' "$g19s_skill"
rc=0
(cd "$wt19" && bash "$WIKI_WRITE" stray-bullet-expert page-one --from "$FULL_PAYLOAD" >/dev/null 2>&1) || rc=$?
assert_exit 0 "$rc" "stray bullet: create exits 0"
assert_contains "](page-one.md)" "$(_g19_fence_interior "$g19s_skill")" \
  "stray bullet: the new entry sits inside the fence, not after the stray bullet"

# ============================================================
echo ""
echo "=== Group 20: grouped-leaf --update, --remove and --rename on the hub fixture ==="
# ============================================================
# shellcheck source=test-hub-fixture.sh
source "$SCRIPT_DIR/test-hub-fixture.sh"

# Fresh fixture per case: _g20_new <parts...> sets _g20 to the domain folder.
_g20_n=0
_g20_new() {
  _g20_n=$((_g20_n + 1))
  _g20_wt="$TMPDIR_ROOT/wt20-$_g20_n"
  mkdir -p "$_g20_wt/.claude/skills"
  git init -q "$_g20_wt"
  _hub_fixture "$_g20_wt/.claude/skills" hub-expert "$@"
  _g20="$_g20_wt/.claude/skills/hub-expert"
}
_g20_ww() { (cd "$_g20_wt" && bash "$WIKI_WRITE" hub-expert "$@"); }

# --update in a folder with no index writes the page and exits 0.
_g20_new grpE
printf -- '---\ntags: [hub-expert/page]\nsummary: "y revised"\n---\n# y\n\nNew body.\n' > "$TMPDIR_ROOT/g20-y.md"
rc=0; _g20_ww grpE/y --update --from "$TMPDIR_ROOT/g20-y.md" --quiet >/dev/null 2>&1 || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && "$(cat "$_g20/grpE/y.md")" == *"New body."* && ! -e "$_g20/grpE/index.md" ]] && echo yes || echo no)" \
  "grpE/y --update with no grpE/index.md: page written, exit 0, no index created"

# --remove of the only page in a folder with no index removes it and exits 0.
_g20_new grpK
rc=0; _g20_ww grpK/z --remove >/dev/null 2>&1 || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && ! -e "$_g20/grpK/z.md" ]] && echo yes || echo no)" \
  "grpK/z --remove with no grpK/index.md: page removed, exit 0"

# Create into a folder with no index exits 2 naming it; nothing lands.
_g20_new akn
rc=0; out=""
out=$(_g20_ww grpD/new --from "$FULL_PAYLOAD" 2>&1) || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 2 && "$out" == *"grpD/index.md"* && ! -e "$_g20/grpD/new.md" ]] && echo yes || echo no)" \
  "grpD/new create with no grpD/index.md: exit 2 naming the index, page not written"

# Rename across groups: the bullet leaves grpA's index for grpB's, SKILL.md untouched.
_g20_skill_before="$(cat "$_g20/SKILL.md")"
rc=0; _g20_ww grpA/x --rename grpB/x >/dev/null 2>&1 || rc=$?
assert_exit 0 "$rc" "grpA/x --rename grpB/x: exits 0"
assert_eq "0" "$(grep -c '](x\.md)' "$_g20/grpA/index.md" || true)" "grpA/x --rename grpB/x: grpA/index.md no longer lists x"
assert_contains "- [x](x.md) — x summary" "$(cat "$_g20/grpB/index.md")" "grpA/x --rename grpB/x: grpB/index.md lists x"
assert_eq "$_g20_skill_before" "$(cat "$_g20/SKILL.md")" "grpA/x --rename grpB/x: SKILL.md unchanged"

# Rename within a group re-points the bullet in place.
rc=0; _g20_ww grpB/x --rename grpB/x2 >/dev/null 2>&1 || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && "$(grep -c '^- \[x2\](x2\.md) — x summary$' "$_g20/grpB/index.md")" -eq 1 && "$(grep -c '](x\.md)' "$_g20/grpB/index.md" || true)" -eq 0 ]] && echo yes || echo no)" \
  "grpB/x --rename grpB/x2: the bullet is re-pointed and re-titled in place"

# Root page into a group: its SKILL.md bullet moves to the group index.
rc=0; _g20_ww y --rename grpA/y >/dev/null 2>&1 || rc=$?
assert_exit 0 "$rc" "y --rename grpA/y: exits 0"
assert_eq "0" "$(grep -c '](y\.md)\|](grpA/y\.md)' "$_g20/SKILL.md" || true)" "y --rename grpA/y: SKILL.md no longer lists y"
assert_contains "- [y](y.md) — y summary" "$(cat "$_g20/grpA/index.md")" "y --rename grpA/y: grpA/index.md lists y"

# A grouped leaf out to the root: the bullet moves back into SKILL.md.
rc=0; _g20_ww grpA/y --rename y >/dev/null 2>&1 || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && "$(grep -c '^- \[y\](y\.md) — y summary$' "$_g20/SKILL.md")" -eq 1 && "$(grep -c '](y\.md)' "$_g20/grpA/index.md" || true)" -eq 0 ]] && echo yes || echo no)" \
  "grpA/y --rename y: the bullet moves from grpA/index.md into SKILL.md"

# Rename into a group with no index exits 2 naming it; nothing changes.
_g20_tree_before="$(cd "$_g20" && find . -type f | sort | xargs md5sum)"
rc=0; out=""
out=$(_g20_ww grpA/r --rename grpC/x 2>&1) || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 2 && "$out" == *"grpC/index.md"* && "$_g20_tree_before" == "$(cd "$_g20" && find . -type f | sort | xargs md5sum)" ]] && echo yes || echo no)" \
  "grpA/r --rename grpC/x with no grpC/index.md: exit 2 naming the index, no file changed"

# A legacy grouped leaf listed in SKILL.md and its index: --remove drops both.
rc=0; _g20_ww grpA/r --remove >/dev/null 2>&1 || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && "$(grep -c '](grpA/r\.md)' "$_g20/SKILL.md" || true)" -eq 0 && "$(grep -c '](r\.md)' "$_g20/grpA/index.md" || true)" -eq 0 ]] && echo yes || echo no)" \
  "grpA/r --remove: its bullet is dropped from SKILL.md and from grpA/index.md"

# ============================================================
echo ""
echo "=== Group 21: --hub-sync brings a domain's nav into the listing convention ==="
# ============================================================
_g21_mdite_orphans() {
  # Empty when mdite reports no orphan; "unavailable" when mdite cannot run.
  command -v mdite >/dev/null 2>&1 || { echo unavailable; return; }
  local o rc=0
  o="$(cd "$1" && mdite lint --entrypoint SKILL.md 2>&1)" || rc=$?
  [[ "$rc" -eq 0 ]] || { echo unavailable; return; }
  printf '%s\n' "$o" | grep 'Orphaned file' || true
}

_g20_new akn grpF grpG
rc=0; out=""
out=$(_g20_ww --hub-sync 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--hub-sync on the akn-shaped fixture: exits 0"
assert_eq "0" "$(grep -E '\]\(grp[A-Z]/[^)]+\.md\)' "$_g20/SKILL.md" | grep -cv '/index\.md)' || true)" \
  "--hub-sync: no grouped-leaf bullet is left in SKILL.md"
assert_eq "303" "$(grep -cE '^- \[[^]]+\]\([^/)]+\.md\) — ' "$_g20/grpA/index.md" || true)" \
  "--hub-sync: grpA/index.md lists every grpA leaf (r, x, q and 300 filler leaves)"
assert_contains "- [q](q.md) — q summary" "$(cat "$_g20/grpA/index.md")" \
  "--hub-sync: a moved bullet is re-linked relative to the index and re-titled with the leaf"
assert_eq "1" "$(grep -c '](r\.md)' "$_g20/grpA/index.md")" \
  "--hub-sync: a leaf its index already listed keeps one bullet"
assert_contains "hub-sync: moved grpA/r to grpA/index.md" "$out" \
  "--hub-sync: a leaf its index already listed still prints its moved line"
assert_contains "- [grpF](grpF/index.md) — grpF hub" "$(cat "$_g20/SKILL.md")" \
  "--hub-sync: a missing group hub bullet is added to SKILL.md with the index's summary"
assert_eq "1" "$(grep -c '](grpF/index\.md)' "$_g20/SKILL.md")" \
  "--hub-sync: SKILL.md carries exactly one grpF hub bullet"
assert_contains "hub-sync: added hub grpF/index.md to SKILL.md" "$out" "--hub-sync: prints the added hub line"
assert_contains "- [w](w.md) — w summary" "$(cat "$_g20/grpG/index.md")" \
  "--hub-sync: a leaf listed nowhere is listed in its index, titled with the leaf, carrying its summary"
assert_contains "hub-sync: listed grpG/w in grpG/index.md" "$out" "--hub-sync: prints the listed line"
assert_eq "yes" "$([[ "$(wc -c < "$_g20/SKILL.md")" -lt 60000 ]] && echo yes || echo no)" \
  "--hub-sync: SKILL.md drops below the 60,000-byte read-cap threshold"
_g21_orphans="$(_g21_mdite_orphans "$_g20")"
if [[ "$_g21_orphans" == "unavailable" ]]; then
  echo "  SKIP: mdite unavailable; no-orphan check not run"
else
  assert_eq "" "$_g21_orphans" "--hub-sync: mdite lint --entrypoint SKILL.md reports no orphan"
fi

_g21_tree() { (cd "$_g20" && find . -type f -not -path './.git*' | sort | xargs md5sum); }
_g21_before="$(_g21_tree)"
rc=0; out=""
out=$(_g20_ww --hub-sync 2>/dev/null) || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && "$out" == "hub-sync: nothing to move" && "$_g21_before" == "$(_g21_tree)" ]] && echo yes || echo no)" \
  "--hub-sync rerun: prints only 'nothing to move' and changes no file"

# A group whose index is missing is skipped and named; the rest syncs.
_g20_new akn grpH
rc=0; out=""
out=$(_g20_ww --hub-sync 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "--hub-sync with grpH/index.md missing: exits 0"
assert_contains "hub-sync: skipped grpH: grpH/index.md missing" "$out" "--hub-sync: names the skipped group"
assert_contains "- [q](q.md) — q summary" "$(cat "$_g20/grpA/index.md")" "--hub-sync: grpA/q moves despite the skipped group"
assert_contains "- [grpH/p](grpH/p.md) — p summary" "$(cat "$_g20/SKILL.md")" "--hub-sync: the skipped group's SKILL.md bullet stays"

# A group whose index has no '## Pages' heading is skipped until one is added.
_g20_new grpJ
rc=0; out=""
out=$(_g20_ww --hub-sync 2>/dev/null) || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && "$out" == "hub-sync: skipped grpJ: grpJ/index.md has no ## Pages heading" ]] && echo yes || echo no)" \
  "--hub-sync with a headless grpJ/index.md: exit 0, one skip line"
printf '\n## Pages\n' >> "$_g20/grpJ/index.md"
rc=0; out=""
out=$(_g20_ww --hub-sync 2>/dev/null) || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 && "$out" == "hub-sync: listed grpJ/r in grpJ/index.md" ]] && grep -q '^- \[r\](r\.md) — r summary$' "$_g20/grpJ/index.md" && echo yes || echo no)" \
  "--hub-sync after the heading is added: grpJ/index.md lists r"

# --hub-sync moves only real '- ' bullets whose page exists: a bullet for a
# missing page stays in SKILL.md, and a commented example bullet is no bullet,
# so its page on disk is listed fresh rather than moved.
_g20_new grpF
printf -- '---\ntags: [hub-expert/page]\nsummary: "c summary"\n---\n# c\n' > "$_g20/grpF/c.md"
awk '/^<!-- END:PAGES -->/ && !done { print "- [grpF/gone](grpF/gone.md) — gone summary"; done = 1 } { print }' \
  "$_g20/SKILL.md" > "$_g20/SKILL.md.new" && mv "$_g20/SKILL.md.new" "$_g20/SKILL.md"
awk '/^<!-- END:PAGES -->/ { print; print ""; print "### Notes"; print ""; print "<!--"; print "- [grpF/c](grpF/c.md) — c summary"; print "-->"; next } { print }' \
  "$_g20/SKILL.md" > "$_g20/SKILL.md.new" && mv "$_g20/SKILL.md.new" "$_g20/SKILL.md"
rc=0; out=""
out=$(_g20_ww --hub-sync 2>/dev/null) || rc=$?
_g21_skill="$(cat "$_g20/SKILL.md")"; _g21_idx="$(cat "$_g20/grpF/index.md")"
assert_eq "yes" "$([[ "$rc" -eq 0 && "$out" != *gone* && "$out" == *"hub-sync: listed grpF/c in grpF/index.md"* && "$out" != *"moved grpF/c"* ]] && echo yes || echo no)" \
  "--hub-sync: a commented bullet is listed fresh, not moved; a missing page gets no line"
assert_contains "- [grpF/gone](grpF/gone.md) — gone summary" "$_g21_skill" "--hub-sync: a bullet for a missing page stays in SKILL.md"
assert_contains "- [grpF/c](grpF/c.md) — c summary" "$_g21_skill" "--hub-sync: a commented bullet stays in SKILL.md"
assert_eq "no|yes" "$([[ "$_g21_idx" == *"(gone.md)"* ]] && echo yes || echo no)|$([[ "$_g21_idx" == *"- [c](c.md) — c summary"* ]] && echo yes || echo no)" \
  "--hub-sync: the missing page never reaches grpF/index.md; c is listed under its leaf title"

# Argument errors: no slug, no payload, no other mode.
for _g21_args in "grpA/q" "--from $FULL_PAYLOAD" "--update" "--remove" "--rename grpA/z" "--json"; do
  rc=0
  # shellcheck disable=SC2086
  _g20_ww --hub-sync $_g21_args >/dev/null 2>&1 || rc=$?
  assert_exit 2 "$rc" "--hub-sync with ${_g21_args%% *}: exits 2"
done

# ============================================================
echo ""
echo "=== Group 22: the contents-list fence on pages over 100 lines ==="
# ============================================================
wt22="$TMPDIR_ROOT/wt22"
_scaffold_domain "$wt22" fence-expert
_g22_dir="$wt22/.claude/skills/fence-expert"
_g22_ww() { (cd "$wt22" && bash "$WIKI_WRITE" fence-expert "$@" >/dev/null 2>&1); }

# _g22_payload FILE FILLER-LINES-PER-SECTION HEADING... -- a page with an H1,
# a fenced code block holding a '## ' line, and one section per heading.
_g22_payload() {
  local f="$1" n="$2" h i
  shift 2
  {
    printf -- '---\ntags: [fence-expert/page]\nsummary: "fence page"\n---\n# Fence Page\n\nIntro.\n\n'
    printf '```\n## Not A Heading\n```\n'
    for h in "$@"; do
      printf '\n## %s\n\n' "$h"
      for ((i = 1; i <= n; i++)); do printf 'line %d\n' "$i"; done
    done
  } > "$f"
}
_g22_fence() { awk '/^<!-- BEGIN:CONTENTS -->$/,/^<!-- END:CONTENTS -->$/' "$1"; }
_g22_expect=$'<!-- BEGIN:CONTENTS -->\n- Alpha\n- Beta\n- Gamma\n<!-- END:CONTENTS -->'

_g22_payload "$TMPDIR_ROOT/g22-long.md" 35 Alpha Beta Gamma
rc=0; _g22_ww long --from "$TMPDIR_ROOT/g22-long.md" || rc=$?
assert_exit 0 "$rc" "contents fence: create of a long page exits 0"
assert_eq "$_g22_expect" "$(_g22_fence "$_g22_dir/long.md")" \
  "contents fence: one bullet per ## heading, the code-block '## ' line excluded"
assert_eq $'# Fence Page\n\n<!-- BEGIN:CONTENTS -->' "$(sed -n 5,7p "$_g22_dir/long.md")" \
  "contents fence: sits after the H1 and one blank line"
assert_eq "$(cat "$TMPDIR_ROOT/g22-long.md")" "$(awk '/^<!-- BEGIN:CONTENTS -->$/,/^<!-- END:CONTENTS -->$/{next} 1' "$_g22_dir/long.md" | sed '6{/^$/d}')" \
  "contents fence: the rest of the page is the payload unchanged"

cp "$_g22_dir/long.md" "$TMPDIR_ROOT/g22-first.md"
rc=0; _g22_ww long --update --from "$TMPDIR_ROOT/g22-first.md" || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 ]] && cmp -s "$_g22_dir/long.md" "$TMPDIR_ROOT/g22-first.md" && echo yes || echo no)" \
  "contents fence: rewriting a page with its own fence is byte-identical"

sed 's/^- Beta$/- Stale/' "$TMPDIR_ROOT/g22-first.md" > "$TMPDIR_ROOT/g22-stale.md"
rc=0; _g22_ww long --update --from "$TMPDIR_ROOT/g22-stale.md" || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 ]] && cmp -s "$_g22_dir/long.md" "$TMPDIR_ROOT/g22-first.md" && echo yes || echo no)" \
  "contents fence: a hand-edited fence in the payload is regenerated"

printf 'Delta body.\n' > "$TMPDIR_ROOT/g22-frag.md"
rc=0; _g22_ww long --append-section Delta --from "$TMPDIR_ROOT/g22-frag.md" || rc=$?
assert_eq "yes|- Delta" "$([[ "$rc" -eq 0 ]] && echo yes || echo no)|$(_g22_fence "$_g22_dir/long.md" | sed -n 5p)" \
  "contents fence: --append-section of a new heading adds its bullet"

_g22_payload "$TMPDIR_ROOT/g22-short.md" 5 Alpha Beta Gamma Delta
rc=0; _g22_ww long --update --replace --from "$TMPDIR_ROOT/g22-short.md" || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 ]] && cmp -s "$_g22_dir/long.md" "$TMPDIR_ROOT/g22-short.md" && echo yes || echo no)" \
  "contents fence: a page shrunk to 100 lines or fewer loses its fence, byte-identical to the payload"

printf -- '---\ntags: [fence-expert/page]\nsummary: "fence page"\n---\n# Short\r\n\r\n## Only\r\nno trailing newline' > "$TMPDIR_ROOT/g22-raw.md"
rc=0; _g22_ww raw --from "$TMPDIR_ROOT/g22-raw.md" || rc=$?
assert_eq "yes" "$([[ "$rc" -eq 0 ]] && cmp -s "$_g22_dir/raw.md" "$TMPDIR_ROOT/g22-raw.md" && echo yes || echo no)" \
  "contents fence: a short page with no fence is written byte-for-byte"

_g22_payload "$TMPDIR_ROOT/g22-lf.md" 35 Alpha Beta Gamma
sed 's/$/\r/' "$TMPDIR_ROOT/g22-lf.md" > "$TMPDIR_ROOT/g22-crlf.md"
rc=0; _g22_ww crlf --from "$TMPDIR_ROOT/g22-crlf.md" || rc=$?
read -r _g22_cr _g22_lf <<<"$(_count_line_endings "$_g22_dir/crlf.md")"
assert_eq "0|$_g22_expect" "$_g22_lf|$(tr -d '\r' < "$_g22_dir/crlf.md" | _g22_fence /dev/stdin)" \
  "contents fence: a CRLF page gets the fence with every line still CRLF"

grep -v '^<!-- END:CONTENTS -->$' "$TMPDIR_ROOT/g22-first.md" > "$TMPDIR_ROOT/g22-orphan.md"
rc=0; _g22_ww long --update --replace --from "$TMPDIR_ROOT/g22-orphan.md" || rc=$?
assert_eq "0|1|1|" "$rc|$(grep -c '^<!-- BEGIN:CONTENTS -->$' "$_g22_dir/long.md")|$(grep -c '^<!-- END:CONTENTS -->$' "$_g22_dir/long.md")|$(awk -v mode=check -f "$SCRIPT_DIR/contents-fence.awk" "$_g22_dir/long.md")" \
  "contents fence: a BEGIN with no END is dropped and one well-formed fence written, so the check passes"

printf -- '---\ntags: [fence-expert/page]\nsummary: "fence page"\n---\n# Short\n\n<!-- BEGIN:CONTENTS -->\n- Only\n\n## Only\nbody\n' > "$TMPDIR_ROOT/g22-short-orphan.md"
rc=0; _g22_ww shortorphan --from "$TMPDIR_ROOT/g22-short-orphan.md" || rc=$?
assert_eq "0|0" "$rc|$(grep -c 'BEGIN:CONTENTS' "$_g22_dir/shortorphan.md")" \
  "contents fence: a short page's unterminated BEGIN is dropped rather than kept byte-for-byte"

# ============================================================
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
