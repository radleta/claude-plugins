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
# from migrate.md/consolidate.md), for exercising the nav updater's other awk
# branch alongside _scaffold_domain's flat-list layout.
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
echo "=== Group 8: ## Pages nav-entry insertion point vs. ### Archived ==="
# ============================================================
# Regression coverage for the nav-insertion bug: a new page's nav entry was
# appended at the end of the entire ## Pages block, which lands inside a
# ### Archived subsection when one is present (misfiling active pages as
# archived). The fix stops active-bullet tracking at ### Archived so the
# entry always lands before it, and end-of-list behavior is unchanged when
# no ### Archived subsection exists.

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

# --- (a) ### Archived present, with active bullets before it ---
mkdir -p "$wt8/.claude/skills/archived-nav-expert"
cat > "$wt8/.claude/skills/archived-nav-expert/SKILL.md" <<'EOF'
---
name: archived-nav-expert
description: "test domain with an archived section"
---

## Pages

- [Alpha](alpha.md) — first active page

### Archived

- [Zed](zed.md) (archived) — retired page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt8/.claude/skills/archived-nav-expert/.mditerc"

rc=0; out=""
out=$(cd "$wt8" && bash "$WIKI_WRITE" archived-nav-expert beta --from "$NAV_PAYLOAD" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "archived present: create exits 0"

skill_md_a="$wt8/.claude/skills/archived-nav-expert/SKILL.md"
alpha_line=$(grep -n '^- \[Alpha\]' "$skill_md_a" | head -1 | cut -d: -f1)
beta_line=$(grep -n 'beta\.md' "$skill_md_a" | head -1 | cut -d: -f1)
archived_line=$(grep -n '^### Archived' "$skill_md_a" | head -1 | cut -d: -f1)
zed_line=$(grep -n '^- \[Zed\]' "$skill_md_a" | head -1 | cut -d: -f1)

assert_eq "yes" "$([[ "$beta_line" -eq $((alpha_line + 1)) ]] && echo yes || echo no)" "archived present: new entry inserted immediately after the last active bullet"
assert_eq "yes" "$([[ "$beta_line" -lt "$archived_line" ]] && echo yes || echo no)" "archived present: new entry lands before the ### Archived heading"
assert_eq "yes" "$([[ "$beta_line" -lt "$zed_line" ]] && echo yes || echo no)" "archived present: new entry does not land among archived bullets"
blank_before_archived_a="$(sed -n "$((archived_line - 1))p" "$skill_md_a")"
assert_eq "" "$blank_before_archived_a" "archived present: blank line separating active bullets from ### Archived is preserved"

# --- (b) ### Archived present, no active bullets yet ---
mkdir -p "$wt8/.claude/skills/archived-empty-nav-expert"
cat > "$wt8/.claude/skills/archived-empty-nav-expert/SKILL.md" <<'EOF'
---
name: archived-empty-nav-expert
description: "test domain: archived section, no active bullets yet"
---

## Pages

### Archived

- [Zed](zed.md) (archived) — retired page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt8/.claude/skills/archived-empty-nav-expert/.mditerc"

rc=0; out=""
out=$(cd "$wt8" && bash "$WIKI_WRITE" archived-empty-nav-expert gamma --from "$NAV_PAYLOAD" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "archived present, no active bullets yet: create exits 0"

skill_md_b="$wt8/.claude/skills/archived-empty-nav-expert/SKILL.md"
pages_line_b=$(grep -n '^## Pages' "$skill_md_b" | head -1 | cut -d: -f1)
gamma_line=$(grep -n 'gamma\.md' "$skill_md_b" | head -1 | cut -d: -f1)
archived_line_b=$(grep -n '^### Archived' "$skill_md_b" | head -1 | cut -d: -f1)

assert_eq "yes" "$([[ "$gamma_line" -gt "$pages_line_b" && "$gamma_line" -lt "$archived_line_b" ]] && echo yes || echo no)" "archived present, no active bullets yet: new entry lands between ## Pages heading and ### Archived"

# --- (c) no ### Archived section at all — end-of-list behavior unchanged ---
mkdir -p "$wt8/.claude/skills/flat-no-archived-expert"
cat > "$wt8/.claude/skills/flat-no-archived-expert/SKILL.md" <<'EOF'
---
name: flat-no-archived-expert
description: "test domain with no archived section"
---

## Pages

- [Alpha](alpha.md) — first page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt8/.claude/skills/flat-no-archived-expert/.mditerc"

rc=0; out=""
out=$(cd "$wt8" && bash "$WIKI_WRITE" flat-no-archived-expert beta --from "$NAV_PAYLOAD" --json 2>&1) || rc=$?
assert_exit 0 "$rc" "no archived section: create exits 0"

skill_md_c="$wt8/.claude/skills/flat-no-archived-expert/SKILL.md"
alpha_line_c=$(grep -n '^- \[Alpha\]' "$skill_md_c" | head -1 | cut -d: -f1)
beta_line_c=$(grep -n 'beta\.md' "$skill_md_c" | head -1 | cut -d: -f1)
meta_line_c=$(grep -n '^## Meta' "$skill_md_c" | head -1 | cut -d: -f1)

assert_eq "yes" "$([[ "$beta_line_c" -eq $((alpha_line_c + 1)) ]] && echo yes || echo no)" "no archived section: new entry still appended immediately after the last bullet (no regression)"
assert_eq "yes" "$([[ "$beta_line_c" -lt "$meta_line_c" ]] && echo yes || echo no)" "no archived section: new entry lands inside ## Pages, before ## Meta"

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
# wiki-write-test-payload-reuse.md.

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
_g10_prose_before="$(grep -F 'See also [Page One]' "$skill_md_g10_flat")"
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
_g10_prose_after="$(grep -F 'See also [Page One]' "$skill_md_g10_flat")"
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

# --- Fixture C: '### Archived' domain, entry carries the " (archived)"
# title suffix (Case 4).
mkdir -p "$wt_g10/.claude/skills/resync-archived-expert"
cat > "$wt_g10/.claude/skills/resync-archived-expert/SKILL.md" <<'EOF'
---
name: resync-archived-expert
description: "test domain for --update nav re-sync (archived suffix)"
---

## Pages

- [Current Page](current-page.md) — an active page

### Archived

- [page-old](page-old.md) (archived) — A simple test page

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt_g10/.claude/skills/resync-archived-expert/.mditerc"
cat > "$wt_g10/.claude/skills/resync-archived-expert/page-old.md" <<'EOF'
---
tags: [resync-archived-expert/page-old]
summary: "A simple test page"
code-cites: []
---
# Page Old

Some content.
EOF

skill_md_g10_archived="$wt_g10/.claude/skills/resync-archived-expert/SKILL.md"

# --- Case 4: archived suffix preserved. Only the text after the first
# " — " separator is replaced (AD8, wiki-write.sh:1063-1075) -- the
# " (archived)" suffix in the title portion must survive the resync.
rc=0; out=""
out=$(cd "$wt_g10" && bash "$WIKI_WRITE" resync-archived-expert page-old --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?
assert_contains "- [page-old](page-old.md) (archived) — A simple test page, revised" "$(cat "$skill_md_g10_archived")" "Case 4 (archived suffix preserved): ' (archived)' title suffix survives while the summary re-syncs"

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
# (bash-subshell-strips-globals.md:30): a fixture whose correct value is
# unchanged passes even when the mechanism is entirely broken.
# Reuses FULL_PAYLOAD / FULL_PAYLOAD_V2 (defined at the top of this file)
# throughout; no group-local payload is minted at all -- R15,
# wiki-write-test-payload-reuse.md.

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

# --- Assertion 7: the bare blank line splitting the '### Standalone Pages'
# run survives, still sitting between an END marker and the next BEGIN marker
# -- i.e. outside both fences. Regeneration must not absorb, move, or delete
# it; the migration's split-run shape has to round-trip.
_g11_sub_gap="$(awk '
  { l[NR] = $0 }
  END {
    for (i = 2; i < NR; i++) {
      if (l[i] == "" && l[i-1] == "<!-- END:PAGES -->" && l[i+1] == "<!-- BEGIN:PAGES -->") {
        print "yes"; exit
      }
    }
    print "no"
  }
' "$skill_md_g11_sub")"
assert_eq "yes" "$_g11_sub_gap" "Assertion 7 (fenced-sub): the blank line splitting a run survives regeneration, still outside both fences"

# --- Fixture C: fenced-archived. An active fenced region carrying a bullet
# whose link target does not exist at all, plus a fenced '### Archived' region
# whose entry carries the ' (archived)' title suffix.
mkdir -p "$wt11/.claude/skills/regen-fenced-archived-expert"
cat > "$wt11/.claude/skills/regen-fenced-archived-expert/SKILL.md" <<'EOF'
---
name: regen-fenced-archived-expert
description: "test domain: fenced active + fenced ### Archived region"
---

## Pages

<!-- BEGIN:PAGES -->
- [Current Page](current-page.md) — stale current page text
- [Ghost](ghost-page.md) — target file was never created
<!-- END:PAGES -->

### Archived

<!-- BEGIN:PAGES -->
- [page-old](page-old.md) (archived) — stale archived text
<!-- END:PAGES -->

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$wt11/.claude/skills/regen-fenced-archived-expert/.mditerc"
_g11_page "$wt11/.claude/skills/regen-fenced-archived-expert" current-page "current page, fresh"
_g11_page "$wt11/.claude/skills/regen-fenced-archived-expert" page-old "page old, fresh"
skill_md_g11_arch="$wt11/.claude/skills/regen-fenced-archived-expert/SKILL.md"

_g11_arch_ghost_before="$(grep -F '](ghost-page.md)' "$skill_md_g11_arch" || true)"
_g11_arch_bullets_before=$(grep -c '^- ' "$skill_md_g11_arch" || true)
rc=0; out=""
out=$(cd "$wt11" && bash "$WIKI_WRITE" regen-fenced-archived-expert current-page --update --from "$FULL_PAYLOAD_V2" --json 2>&1) || rc=$?

# --- Assertion 8 (AD8): the ' (archived) — ' title suffix survives. Only the
# text after the FIRST ' — ' separator following the link's closing ')' is
# replaced, so the decorator between the link and the separator is preserved
# while the summary is regenerated from page-old.md's own frontmatter.
_g11_arch_suffix=$(grep -c '^- \[page-old\](page-old\.md) (archived) — page old, fresh$' "$skill_md_g11_arch" || true)
assert_eq "yes" "$([[ "$rc" -eq 0 && "$_g11_arch_suffix" -eq 1 ]] && echo yes || echo no)" \
  "Assertion 8 (fenced-archived, AD8): regeneration preserves the ' (archived) — ' title suffix while replacing the summary"

# --- Assertion 9: a bullet whose link target does not exist is left verbatim.
# Regeneration never deletes a nav entry -- an unresolvable target is a
# pass-through case, not a prune case, so the bullet count is also unchanged.
_g11_arch_ghost_after="$(grep -F '](ghost-page.md)' "$skill_md_g11_arch" || true)"
_g11_arch_bullets_after=$(grep -c '^- ' "$skill_md_g11_arch" || true)
assert_eq "yes" "$([[ -n "$_g11_arch_ghost_before" && \
                      "$_g11_arch_ghost_before" == "$_g11_arch_ghost_after" && \
                      "$_g11_arch_bullets_before" -eq "$_g11_arch_bullets_after" ]] && echo yes || echo no)" \
  "Assertion 9 (fenced-archived): a bullet whose target file does not exist is left verbatim; regeneration deletes no nav entry"

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
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
