#!/usr/bin/env bash
# test-wiki-fence-migrate.sh — Automated tests for wiki-fence-migrate.sh
# Run: bash test-wiki-fence-migrate.sh
# All tests use temp directories cleaned up on exit. This suite NEVER reads
# or writes the real fleet under .claude/skills/ -- every fixture domain
# lives under $TMPDIR_ROOT, and every invocation of the script under test is
# run with that fixture root as its working directory (via `cd "$root" &&`
# or an explicit save/restore of $PWD), never the repo root.
#
# Discharges CLI checklist item 6 (plan-expert/protocols/cli.md:115 — unit
# tests: argument parsing, core logic, output formatting) for
# wiki-fence-migrate.sh: Group 6 covers argument parsing, Groups 1-5 cover
# core logic, Group 7 covers output formatting.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIKI_FENCE_MIGRATE="$SCRIPT_DIR/wiki-fence-migrate.sh"
PASS=0
FAIL=0
TOTAL=0

# --- Test helpers (matches test-wiki-write.sh:14-52) ---
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

echo "=== Group 1: idempotent re-run produces no writes ==="
# ============================================================
# C4 (spec.md) — a second apply over an already-fenced domain must produce
# byte-identical output and still exit 0.
g1_root="$TMPDIR_ROOT/g1"
g1_dir="$g1_root/.claude/skills/idem-flat"
mkdir -p "$g1_dir"
cat > "$g1_dir/SKILL.md" <<'EOF'
---
name: idem-flat
description: "fixture: flat unfenced ## Pages for idempotent re-run"
---

## Pages

- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two
- [Page Three](page-three.md) — Page Three

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$g1_dir/.mditerc"

g1_rc1=0
(cd "$g1_root" && bash "$WIKI_FENCE_MIGRATE" --skill idem-flat) >/dev/null 2>&1 || g1_rc1=$?
assert_exit 0 "$g1_rc1" "idempotent re-run: first apply (fencing pass) exits 0"

g1_sum_after_first="$(md5sum "$g1_dir/SKILL.md" | awk '{print $1}')"

g1_rc2=0
(cd "$g1_root" && bash "$WIKI_FENCE_MIGRATE" --skill idem-flat) >/dev/null 2>&1 || g1_rc2=$?
assert_exit 0 "$g1_rc2" "idempotent re-run: second apply (already-fenced) exits 0"

g1_sum_after_second="$(md5sum "$g1_dir/SKILL.md" | awk '{print $1}')"
assert_eq "$g1_sum_after_first" "$g1_sum_after_second" \
  "idempotent re-run: SKILL.md checksum unchanged across the second apply"

echo "=== Group 2: dry-run writes nothing ==="
# ============================================================
g2_root="$TMPDIR_ROOT/g2"
g2_dir="$g2_root/.claude/skills/dryrun-flat"
mkdir -p "$g2_dir"
cat > "$g2_dir/SKILL.md" <<'EOF'
---
name: dryrun-flat
description: "fixture: flat unfenced ## Pages for dry-run"
---

## Pages

- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$g2_dir/.mditerc"

g2_sum_before="$(md5sum "$g2_dir/SKILL.md" | awk '{print $1}')"

g2_rc=0
(cd "$g2_root" && bash "$WIKI_FENCE_MIGRATE" --skill dryrun-flat --dry-run) >/dev/null 2>&1 || g2_rc=$?
assert_exit 0 "$g2_rc" "dry-run: exits 0"

g2_sum_after="$(md5sum "$g2_dir/SKILL.md" | awk '{print $1}')"
assert_eq "$g2_sum_before" "$g2_sum_after" "dry-run: SKILL.md byte-identical after --dry-run"

if [[ -d "$g2_root/.git" ]]; then
  fail "dry-run: creates no manifest (.git/wiki-fence-migrate is never created)" "found $g2_root/.git"
else
  pass "dry-run: creates no manifest (.git/wiki-fence-migrate is never created)"
fi

echo "=== Group 3: a blank-line-split run gets two fence pairs ==="
# ============================================================
# The bullet-run grammar closes a run on a blank line, per
# _wiki_pages_bullet_runs in wiki-health.sh. A fixture with
# bullet / blank / bullets under ## Pages must yield 2 runs, hence 2 fence
# pairs -- the shape step 01's blank-line rule covers, which the fleet
# census (M3) did not measure.
g3_root="$TMPDIR_ROOT/g3"
g3_dir="$g3_root/.claude/skills/split-pages"
mkdir -p "$g3_dir"
cat > "$g3_dir/SKILL.md" <<'EOF'
---
name: split-pages
description: "fixture: bullet / blank / bullets under ## Pages -- must yield 2 runs"
---

## Pages

- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two

- [Page Three](page-three.md) — Page Three
- [Page Four](page-four.md) — Page Four

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$g3_dir/.mditerc"

g3_rc=0
(cd "$g3_root" && bash "$WIKI_FENCE_MIGRATE" --skill split-pages) >/dev/null 2>&1 || g3_rc=$?
assert_exit 0 "$g3_rc" "blank-line split: apply exits 0"

g3_begin_count="$(grep -c '<!-- BEGIN:PAGES -->' "$g3_dir/SKILL.md")"
g3_end_count="$(grep -c '<!-- END:PAGES -->' "$g3_dir/SKILL.md")"
assert_eq "2" "$g3_begin_count" "blank-line split: exactly 2 BEGIN:PAGES markers"
assert_eq "2" "$g3_end_count" "blank-line split: exactly 2 END:PAGES markers"

echo "=== Group 4: a trailing --- keeps the END marker before it (C10) ==="
# ============================================================
# Shape mirrors mcp-expert/email-campaign-expert: bullets, blank line,
# thematic break, blank line, ## See Also. The blank line after the last
# bullet already closes the run (bullet-run grammar), so the --- must never
# end up wrapped inside the fence.
g4_root="$TMPDIR_ROOT/g4"
g4_dir="$g4_root/.claude/skills/trailing-rule"
mkdir -p "$g4_dir"
cat > "$g4_dir/SKILL.md" <<'EOF'
---
name: trailing-rule
description: "fixture: ## Pages followed by a trailing --- thematic break and a See Also section (C10 shape)"
---

## Pages

- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two

---

## See Also

- Something else
EOF
printf 'entrypoint: SKILL.md\n' > "$g4_dir/.mditerc"

g4_rc=0
(cd "$g4_root" && bash "$WIKI_FENCE_MIGRATE" --skill trailing-rule) >/dev/null 2>&1 || g4_rc=$?
assert_exit 0 "$g4_rc" "trailing rule: apply exits 0"

g4_begin_count="$(grep -c '<!-- BEGIN:PAGES -->' "$g4_dir/SKILL.md")"
g4_end_count="$(grep -c '<!-- END:PAGES -->' "$g4_dir/SKILL.md")"
assert_eq "1" "$g4_begin_count" "trailing rule: exactly 1 BEGIN:PAGES marker"
assert_eq "1" "$g4_end_count" "trailing rule: exactly 1 END:PAGES marker"

g4_end_line="$(grep -n '<!-- END:PAGES -->' "$g4_dir/SKILL.md" | head -1 | cut -d: -f1)"
g4_rule_line="$(awk '/^## Pages/{p=1; next} p && /^---$/{print NR; exit}' "$g4_dir/SKILL.md")"
if [[ -n "$g4_rule_line" && "$g4_rule_line" -gt "$g4_end_line" ]]; then
  pass "trailing rule: END:PAGES marker sits before the standalone --- (never wraps it)"
else
  fail "trailing rule: END:PAGES marker sits before the standalone --- (never wraps it)" \
    "end_line=$g4_end_line rule_line=${g4_rule_line:-<not found>}"
fi

# The ordering inequality above is not sufficient on its own -- it would
# still pass if a regression collapsed the blank line between the marker
# and the rule (making them adjacent), or if unrelated content were
# inserted between them. Assert the required three-part shape explicitly:
# <!-- END:PAGES -->, then exactly one blank line, then ---.
g4_blank_line=$((g4_end_line + 1))
g4_line_after_end="$(sed -n "${g4_blank_line}p" "$g4_dir/SKILL.md")"
if [[ -z "$g4_line_after_end" ]]; then
  pass "trailing rule: line immediately after END:PAGES is blank"
else
  fail "trailing rule: line immediately after END:PAGES is blank" \
    "line $g4_blank_line: '$g4_line_after_end'"
fi

g4_expected_rule_line=$((g4_end_line + 2))
if [[ -n "$g4_rule_line" && "$g4_rule_line" -eq "$g4_expected_rule_line" ]]; then
  pass "trailing rule: --- sits exactly two lines after END:PAGES (marker, blank, ---)"
else
  fail "trailing rule: --- sits exactly two lines after END:PAGES (marker, blank, ---)" \
    "expected rule_line=$g4_expected_rule_line, got ${g4_rule_line:-<not found>}"
fi

echo "=== Group 5: an interrupted apply sweep leaves no stray temp file ==="
# ============================================================
# `set -m` here is load-bearing, not defensive: without job control, bash
# marks SIGINT ignored for an asynchronously-backgrounded child, so the
# child's own `trap ... INT` can never install and `kill -INT` is silently
# discarded -- this group would then pass regardless of whether cleanup
# works (scripts-expert/wiki-aging-loop.md, scripts-expert/sigint-proc-
# disposition.md). A bare stray-temp-file count is not enough either: the
# shared EXIT/INT/TERM trap cleans up on a normal exit too, so the group
# must also assert the process was still alive when signalled and that the
# run exited non-zero.
g5_root="$TMPDIR_ROOT/g5"
mkdir -p "$g5_root/.claude/skills"
for i in $(seq -w 1 8); do
  g5_dir="$g5_root/.claude/skills/int-$i"
  mkdir -p "$g5_dir"
  cat > "$g5_dir/SKILL.md" <<EOF
---
name: int-$i
description: "fixture $i: interrupt sweep domain"
---

## Pages

- [Page One](page-one.md) — Page One
- [Page Two](page-two.md) — Page Two

## Meta
EOF
  printf 'entrypoint: SKILL.md\n' > "$g5_dir/.mditerc"
done

g5_out="$TMPDIR_ROOT/g5-out.txt"
: > "$g5_out"

g5_orig_pwd="$(pwd)"
cd "$g5_root"
set -m
bash "$WIKI_FENCE_MIGRATE" > "$g5_out" 2>&1 &
g5_pid=$!
sleep 2

g5_still_running=false
if kill -0 "$g5_pid" 2>/dev/null; then
  g5_still_running=true
fi

kill -INT "$g5_pid" 2>/dev/null || true

g5_rc=0
wait "$g5_pid" || g5_rc=$?
set +m
cd "$g5_orig_pwd"

if [[ "$g5_still_running" == true ]]; then
  pass "interrupt: script was still running when SIGINT was sent"
else
  fail "interrupt: script was still running when SIGINT was sent" \
    "kill -0 failed before the signal -- the sweep may have already finished, which would prove nothing"
fi

if [[ "$g5_rc" -ne 0 ]]; then
  pass "interrupt: interrupted sweep exits non-zero"
else
  fail "interrupt: interrupted sweep exits non-zero" \
    "exit 0 -- the EXIT-leg of the cleanup trap also fires on a normal, uninterrupted completion"
fi

g5_stray_count="$(find "$g5_root/.claude/skills" -name 'SKILL.md.tmp.*' 2>/dev/null | wc -l | tr -d ' ')"
assert_eq "0" "$g5_stray_count" "interrupt: no stray SKILL.md.tmp.* files remain under the fixture"

echo "=== Group 6: argument parsing ==="
# ============================================================
g6_root="$TMPDIR_ROOT/g6"
g6_fixture_dir="$g6_root/.claude/skills/arg-fixture"
mkdir -p "$g6_fixture_dir"
cat > "$g6_fixture_dir/SKILL.md" <<'EOF'
---
name: arg-fixture
description: "fixture: minimal wiki-backed domain for argument-parsing checks"
---

## Pages

- [Page One](page-one.md) — Page One

## Meta
EOF
printf 'entrypoint: SKILL.md\n' > "$g6_fixture_dir/.mditerc"

# --help: usage to stdout, exit 0, and no file literally named --help
# (R12 argument-validation.md:34 — git-state --help once created exactly
# that file, so the exit-code check alone does not replace this).
g6_help_out=""
g6_help_rc=0
g6_help_out=$(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" --help 2>&1) || g6_help_rc=$?
assert_exit 0 "$g6_help_rc" "--help: exits 0"
assert_contains "Usage: wiki-fence-migrate.sh" "$g6_help_out" "--help: prints the usage block"
if [[ -e "$g6_root/--help" ]]; then
  fail "--help: leaves no file literally named --help" "found $g6_root/--help"
else
  pass "--help: leaves no file literally named --help"
fi

# -h: same short-flag path, same no-stray-file guarantee
g6_h_rc=0
(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" -h) >/dev/null 2>&1 || g6_h_rc=$?
assert_exit 0 "$g6_h_rc" "-h: exits 0 (same path as --help)"
if [[ -e "$g6_root/-h" ]]; then
  fail "-h: leaves no file literally named -h" "found $g6_root/-h"
else
  pass "-h: leaves no file literally named -h"
fi

# Unknown flag -> stderr, exit 2 (family's usage-error polarity, shared with
# fence-scan and wiki-health).
g6_bogus_err=""
g6_bogus_rc=0
g6_bogus_err=$(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" --bogus 2>&1 >/dev/null) || g6_bogus_rc=$?
assert_exit 2 "$g6_bogus_rc" "unknown flag: exits 2"
assert_contains "ERROR: unknown option: --bogus" "$g6_bogus_err" "unknown flag: stderr names the exact flag"

# --skill with no value -> exit 2, not swallowed as a positional
g6_missing_err=""
g6_missing_rc=0
g6_missing_err=$(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" --skill 2>&1 >/dev/null) || g6_missing_rc=$?
assert_exit 2 "$g6_missing_rc" "--skill with no value: exits 2"
assert_contains "ERROR: --skill requires a value" "$g6_missing_err" "--skill with no value: stderr names the missing value"

# --skill --json must never parse as --skill=--json: a flag-shaped next
# token is rejected as a missing value, not swallowed as --skill's argument.
g6_swallow_err=""
g6_swallow_rc=0
g6_swallow_err=$(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" --skill --json 2>&1 >/dev/null) || g6_swallow_rc=$?
assert_exit 2 "$g6_swallow_rc" "--skill --json: rejected, not parsed as --skill=--json"
assert_contains "ERROR: --skill requires a value" "$g6_swallow_err" \
  "--skill --json: error names the missing value, not an invalid-skill-path message"

# --skill path-validation denylist (step 04 iteration 2 fix): this is the
# durable regression net for a high-severity path-traversal that let
# --skill '../../../../some/path' reach the destructive `mv -f` before the
# denylist existed (wiki-fence-migrate.sh:116-127). Each payload below must
# be rejected with exit 2 and an "ERROR: invalid skill path: ..." line on
# stderr, and -- since rejection happens during argument parsing, before
# any domain is ever touched -- must create no file under the fixture root.
_g6_snapshot() { find "$g6_root" -type f | sort; }

g6_snap_before="$(_g6_snapshot)"
g6_empty_err=""
g6_empty_rc=0
g6_empty_err=$(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" --skill '' 2>&1 >/dev/null) || g6_empty_rc=$?
assert_exit 2 "$g6_empty_rc" "--skill '': rejected"
assert_contains "ERROR: invalid skill path:" "$g6_empty_err" "--skill '': stderr names the invalid path"
assert_eq "$g6_snap_before" "$(_g6_snapshot)" "--skill '': creates no file"

g6_snap_before="$(_g6_snapshot)"
g6_slash_err=""
g6_slash_rc=0
g6_slash_err=$(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" --skill 'a/b' 2>&1 >/dev/null) || g6_slash_rc=$?
assert_exit 2 "$g6_slash_rc" "--skill 'a/b': rejected"
assert_contains "ERROR: invalid skill path: a/b" "$g6_slash_err" "--skill 'a/b': stderr names the invalid path"
assert_eq "$g6_snap_before" "$(_g6_snapshot)" "--skill 'a/b': creates no file"

g6_snap_before="$(_g6_snapshot)"
g6_traversal_err=""
g6_traversal_rc=0
g6_traversal_err=$(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" --skill '../../../../tmp/evil' 2>&1 >/dev/null) || g6_traversal_rc=$?
assert_exit 2 "$g6_traversal_rc" "--skill path traversal: rejected"
assert_contains "ERROR: invalid skill path: ../../../../tmp/evil" "$g6_traversal_err" \
  "--skill path traversal: stderr names the invalid path"
assert_eq "$g6_snap_before" "$(_g6_snapshot)" "--skill path traversal: creates no file"

# --skill NAME --json --dry-run: accepted in combination, exit 0, exactly
# one domain record.
g6_combo_out=""
g6_combo_rc=0
g6_combo_out=$(cd "$g6_root" && bash "$WIKI_FENCE_MIGRATE" --skill arg-fixture --json --dry-run) || g6_combo_rc=$?
assert_exit 0 "$g6_combo_rc" "--skill NAME --json --dry-run: accepted in combination, exits 0"
g6_combo_domain_count="$(printf '%s' "$g6_combo_out" | grep -o '"skill"' | wc -l | tr -d ' ')"
assert_eq "1" "$g6_combo_domain_count" "--skill NAME --json --dry-run: emits exactly one domain record"

echo "=== Group 7: output formatting ==="
# ============================================================
# Pins all three output surfaces the script's consumers read: the --json
# schema (structurally, not just parseable), the human summary line's exact
# shape, and the absence of ANSI on every path.
g7_root="$TMPDIR_ROOT/g7"
mkdir -p "$g7_root/.claude/skills"

_g7_make_fixture() {
  local name="$1"
  local dir="$g7_root/.claude/skills/$name"
  mkdir -p "$dir"
  cat > "$dir/SKILL.md" <<EOF
---
name: $name
description: "fixture: output-formatting check for $name"
---

## Pages

- [Page One](page-one.md) — Page One

## Meta
EOF
  printf 'entrypoint: SKILL.md\n' > "$dir/.mditerc"
}

_g7_make_fixture out-json-dry
_g7_make_fixture out-json-apply
_g7_make_fixture out-human-dry
_g7_make_fixture out-human-apply

g7_json_dry_out=$(cd "$g7_root" && bash "$WIKI_FENCE_MIGRATE" --skill out-json-dry --json --dry-run)
g7_json_apply_out=$(cd "$g7_root" && bash "$WIKI_FENCE_MIGRATE" --skill out-json-apply --json)

# Apply-mode stdout carries the JSON line followed by a plain-text
# "rollback: ..." line -- isolate line 1 before handing it to jq, since a
# bare `jq -e` over the whole multi-line blob reports jq's own parse-error
# exit code (4) for the trailing non-JSON line, which would fail this
# assertion for a reason unrelated to the schema it exists to check.
g7_json_dry_line1="$(head -n1 <<< "$g7_json_dry_out")"
g7_json_apply_line1="$(head -n1 <<< "$g7_json_apply_out")"

if command -v jq &>/dev/null; then
  if printf '%s' "$g7_json_dry_line1" | jq -e '.mode == "dry-run" or .mode == "apply"' >/dev/null 2>&1; then
    pass "--json (dry-run): .mode is dry-run or apply"
  else
    fail "--json (dry-run): .mode is dry-run or apply" "payload=$g7_json_dry_line1"
  fi
  if printf '%s' "$g7_json_dry_line1" | jq -e '[.domains[] | has("skill") and has("runs") and (.action as $a | ["fenced","already-fenced","skipped","failed"] | index($a) != null)] | all' >/dev/null 2>&1; then
    pass "--json (dry-run): every domain record has skill, runs, and a valid action"
  else
    fail "--json (dry-run): every domain record has skill, runs, and a valid action" "payload=$g7_json_dry_line1"
  fi
  if printf '%s' "$g7_json_dry_line1" | jq -e 'has("totals")' >/dev/null 2>&1; then
    pass "--json (dry-run): top-level totals key present"
  else
    fail "--json (dry-run): top-level totals key present" "payload=$g7_json_dry_line1"
  fi

  if printf '%s' "$g7_json_apply_line1" | jq -e '.mode == "dry-run" or .mode == "apply"' >/dev/null 2>&1; then
    pass "--json (apply): .mode is dry-run or apply"
  else
    fail "--json (apply): .mode is dry-run or apply" "payload=$g7_json_apply_line1"
  fi
  if printf '%s' "$g7_json_apply_line1" | jq -e '[.domains[] | has("skill") and has("runs") and (.action as $a | ["fenced","already-fenced","skipped","failed"] | index($a) != null)] | all' >/dev/null 2>&1; then
    pass "--json (apply): every domain record has skill, runs, and a valid action"
  else
    fail "--json (apply): every domain record has skill, runs, and a valid action" "payload=$g7_json_apply_line1"
  fi
  if printf '%s' "$g7_json_apply_line1" | jq -e 'has("totals")' >/dev/null 2>&1; then
    pass "--json (apply): top-level totals key present"
  else
    fail "--json (apply): top-level totals key present" "payload=$g7_json_apply_line1"
  fi
fi

g7_human_dry_out=$(cd "$g7_root" && bash "$WIKI_FENCE_MIGRATE" --skill out-human-dry --dry-run | cat)
g7_human_apply_out=$(cd "$g7_root" && bash "$WIKI_FENCE_MIGRATE" --skill out-human-apply | cat)

# (b) human summary matches the literal anchored shape -- a future
# reordering or relabelling of the four counters fails this instead of
# passing on a substring match.
if grep -qE '^wiki-fence-migrate: [0-9]+ fenced, [0-9]+ already-fenced, [0-9]+ skipped, [0-9]+ failed$' <<< "$g7_human_dry_out"; then
  pass "human summary (dry-run, piped): matches the anchored four-counter shape"
else
  fail "human summary (dry-run, piped): matches the anchored four-counter shape" "output=$g7_human_dry_out"
fi
if grep -qE '^wiki-fence-migrate: [0-9]+ fenced, [0-9]+ already-fenced, [0-9]+ skipped, [0-9]+ failed$' <<< "$g7_human_apply_out"; then
  pass "human summary (apply, piped): matches the anchored four-counter shape"
else
  fail "human summary (apply, piped): matches the anchored four-counter shape" "output=$g7_human_apply_out"
fi

# (c) no ANSI escape appears on any of the four output surfaces -- piped or
# not, --json or human, dry-run or apply.
g7_ansi_json_dry="$(grep -c $'\033' <<< "$g7_json_dry_out" || true)"
g7_ansi_json_apply="$(grep -c $'\033' <<< "$g7_json_apply_out" || true)"
g7_ansi_human_dry="$(grep -c $'\033' <<< "$g7_human_dry_out" || true)"
g7_ansi_human_apply="$(grep -c $'\033' <<< "$g7_human_apply_out" || true)"
assert_eq "0" "$g7_ansi_json_dry" "no ANSI escapes (--json, dry-run, not piped)"
assert_eq "0" "$g7_ansi_json_apply" "no ANSI escapes (--json, apply, not piped)"
assert_eq "0" "$g7_ansi_human_dry" "no ANSI escapes (human, dry-run, piped)"
assert_eq "0" "$g7_ansi_human_apply" "no ANSI escapes (human, apply, piped)"

# The human summary is suppressed under --json: the two never both appear
# on stdout.
assert_not_contains "wiki-fence-migrate: " "$g7_json_dry_out" \
  "--json (dry-run): stdout contains no wiki-fence-migrate: line"
assert_not_contains "wiki-fence-migrate: " "$g7_json_apply_out" \
  "--json (apply): stdout contains no wiki-fence-migrate: line"

# ============================================================
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
