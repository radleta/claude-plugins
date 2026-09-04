#!/usr/bin/env bash
# test-mdite.sh — Automated tests for the mdite wrapper + its install.sh
# WRAPPERS entry (plain, non-walker shape).
# Run: bash test-mdite.sh
# All tests are offline — a fake `npx` is PATH-shimmed in the test's TMPDIR,
# no live network. The timeout test runs the wrapper's real 30s `timeout`
# (no override exists — spec.md's Interface line hardcodes `timeout 30`), so
# this suite takes >30s to complete; that is expected, not a hang.

set -euo pipefail

# Enable job control (monitor mode). Without it, a background job (`&`)
# started by a non-interactive script has SIGINT/SIGQUIT set to ignored —
# and per bash(1) "SIGNALS", "Signals ignored upon entry to the shell cannot
# be trapped or reset." That would make Group 6's backgrounded wrapper
# invocation permanently unable to honor its own `trap ... INT`, which does
# NOT reflect real usage (an interactive Ctrl-C, or a plain foreground call
# from an orchestrator script, never triggers that auto-ignore rule — only
# an explicit `&` under job-control-off does). `set -m` here makes the test
# harness match real invocation semantics instead of accidentally testing a
# harness-only edge case.
set -m

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MDITE="$SCRIPT_DIR/mdite"
INSTALL_SH="$SCRIPT_DIR/install.sh"
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

FAKEBIN="$TMPDIR_ROOT/fakebin"
mkdir -p "$FAKEBIN"

# Writes a fake `npx` shim to $FAKEBIN/npx per the requested mode:
#   clean    — exit 0, no stdout
#   findings — exit 1, prints findings to stdout (mdite's real
#              exit-1-on-findings behavior, reproduced by the shim)
#   fail     — exit 1, prints only to stderr (empty stdout)
#   hang     — never exits (deliberately hangs, exercises the wrapper's
#              internal 30s `timeout`)
#   slow     — touches a marker file, then sleeps well past a SIGINT test's
#              window (used to verify signal handling mid-fetch)
#   argv     — captures its own argv to a file for passthrough verification
_write_fake_npx() {
  local mode="$1"
  case "$mode" in
    clean)
      cat > "$FAKEBIN/npx" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
      ;;
    findings)
      cat > "$FAKEBIN/npx" <<'EOF'
#!/usr/bin/env bash
echo "dead-link: foo.md -> gone.md"
exit 1
EOF
      ;;
    fail)
      cat > "$FAKEBIN/npx" <<EOF
#!/usr/bin/env bash
echo "npm ERR! network failure" >&2
exit 1
EOF
      ;;
    hang)
      cat > "$FAKEBIN/npx" <<'EOF'
#!/usr/bin/env bash
sleep 60
EOF
      ;;
    slow)
      cat > "$FAKEBIN/npx" <<EOF
#!/usr/bin/env bash
touch "$TMPDIR_ROOT/npx-started"
sleep 30
EOF
      ;;
    argv)
      cat > "$FAKEBIN/npx" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$@" > "$TMPDIR_ROOT/argv-capture.txt"
exit 0
EOF
      ;;
  esac
  chmod +x "$FAKEBIN/npx"
}

# ============================================================
echo "=== Group 1: --help and usage ==="
# ============================================================

rc=0; output=""
output=$(bash "$MDITE" --help 2>&1) || rc=$?
assert_exit 0 "$rc" "--help exits 0"
assert_contains "Usage: mdite" "$output" "--help prints usage"

# ============================================================
echo ""
echo "=== Group 2: shim clean (exit 0, empty stdout) ==="
# ============================================================

_write_fake_npx clean
rc=0; output=""
output=$(PATH="$FAKEBIN:$PATH" bash "$MDITE" lint --entrypoint SKILL.md 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "clean shim: wrapper exits 0"
assert_eq "" "$output" "clean shim: stdout is empty"

# ============================================================
echo ""
echo "=== Group 3: shim findings (native exit 1, non-empty stdout) ==="
# ============================================================

_write_fake_npx findings
rc=0; output=""
output=$(PATH="$FAKEBIN:$PATH" bash "$MDITE" lint --entrypoint SKILL.md 2>/dev/null) || rc=$?
assert_exit 0 "$rc" "findings shim: wrapper remaps exit 1 to 0"
assert_eq "dead-link: foo.md -> gone.md" "$output" "findings shim: stdout forwarded unchanged"

# ============================================================
echo ""
echo "=== Group 4: shim failure (non-zero exit, EMPTY stdout) ==="
# ============================================================

_write_fake_npx fail
rc=0; output=""; stderr_output=""
output=$(PATH="$FAKEBIN:$PATH" bash "$MDITE" lint --entrypoint SKILL.md 2>"$TMPDIR_ROOT/stderr4.log") || rc=$?
stderr_output="$(cat "$TMPDIR_ROOT/stderr4.log")"
assert_exit 69 "$rc" "failure shim: wrapper exits EX_UNAVAILABLE (69), distinct from findings/clean"
assert_eq "" "$output" "failure shim: stdout is empty"
lower_stderr="$(printf '%s' "$stderr_output" | tr '[:upper:]' '[:lower:]')"
assert_contains "unavailable" "$lower_stderr" "failure shim: stderr carries an unavailable marker"

# ============================================================
echo ""
echo "=== Group 5: shim timeout (deliberately hanging npx, wrapper's 30s timeout fires) ==="
# ============================================================
# No override exists for the wrapper's hardcoded `timeout 30` (spec.md's
# Interface line is verbatim authoritative) — this test genuinely waits
# ~30s. An outer `timeout 40` bounds the test itself so a wrapper regression
# (e.g. losing the timeout entirely) fails fast instead of hanging the suite.

_write_fake_npx hang
rc=0; output=""; stderr_output=""
start_ts=$(date +%s)
output=$(PATH="$FAKEBIN:$PATH" timeout 40 bash "$MDITE" lint --entrypoint SKILL.md 2>"$TMPDIR_ROOT/stderr5.log") || rc=$?
end_ts=$(date +%s)
stderr_output="$(cat "$TMPDIR_ROOT/stderr5.log")"
assert_exit 69 "$rc" "timeout shim: wrapper exits EX_UNAVAILABLE (69), unconditional on stdout"
assert_eq "" "$output" "timeout shim: stdout is empty"
lower_stderr="$(printf '%s' "$stderr_output" | tr '[:upper:]' '[:lower:]')"
assert_contains "timeout" "$lower_stderr" "timeout shim: stderr mentions the timeout"
elapsed=$((end_ts - start_ts))
if [[ "$elapsed" -ge 28 && "$elapsed" -le 35 ]]; then
  pass "timeout shim: wrapper's internal 30s timeout fired (elapsed=${elapsed}s)"
else
  fail "timeout shim: wrapper's internal 30s timeout fired" "elapsed=${elapsed}s, expected ~30s"
fi

# ============================================================
echo ""
echo "=== Group 6: SIGINT mid-fetch (exit 130, no orphaned npx) ==="
# ============================================================

_write_fake_npx slow
rm -f "$TMPDIR_ROOT/npx-started"

PATH="$FAKEBIN:$PATH" bash "$MDITE" lint --entrypoint SKILL.md \
  >"$TMPDIR_ROOT/sigint-out.log" 2>"$TMPDIR_ROOT/sigint-err.log" &
wrapper_pid=$!

# Poll (bounded) until the shim's marker file confirms it actually started.
started=false
for _ in $(seq 1 50); do
  if [[ -f "$TMPDIR_ROOT/npx-started" ]]; then
    started=true
    break
  fi
  sleep 0.1
done

if [[ "$started" == true ]]; then
  pass "SIGINT test: fake npx shim confirmed started before signaling"
else
  fail "SIGINT test: fake npx shim confirmed started before signaling" "marker file never appeared"
fi

# Small settle buffer: the marker file proves the shim process exists, but
# gives the wrapper's own wait-loop a moment of slack to be fully blocked
# before the signal arrives (ample margin against the 30s shim sleep).
sleep 0.3

npx_pid="$(pgrep -f "$FAKEBIN/npx" 2>/dev/null || true)"

kill -INT "$wrapper_pid"

sigint_rc=0
wait "$wrapper_pid" 2>/dev/null || sigint_rc=$?
assert_exit 130 "$sigint_rc" "SIGINT test: wrapper exits 130, distinct from EX_UNAVAILABLE"

# Give the reaped child a brief moment to fully disappear from the process
# table, then confirm no orphan survives.
sleep 0.3
if [[ -n "$npx_pid" ]] && kill -0 "$npx_pid" 2>/dev/null; then
  fail "SIGINT test: no orphaned npx process left behind" "npx shim pid $npx_pid still alive"
else
  pass "SIGINT test: no orphaned npx process left behind"
fi

# ============================================================
echo ""
echo "=== Group 7: passthrough (non-wrapper flag forwarded to npx unexamined) ==="
# ============================================================

_write_fake_npx argv
rm -f "$TMPDIR_ROOT/argv-capture.txt"
PATH="$FAKEBIN:$PATH" bash "$MDITE" lint --entrypoint SKILL.md --orphans >/dev/null 2>&1 || true
argv_captured="$(cat "$TMPDIR_ROOT/argv-capture.txt" 2>/dev/null || true)"
assert_contains "--entrypoint" "$argv_captured" "passthrough: --entrypoint forwarded to npx"
assert_contains "--orphans" "$argv_captured" "passthrough: --orphans forwarded to npx"
assert_contains "mdite@1.1.0" "$argv_captured" "passthrough: pinned mdite@1.1.0 package spec present"

# ============================================================
echo ""
echo "=== Group 8: install.sh --check reports mdite with NO walker preamble ==="
# ============================================================

FAKEHOME="$TMPDIR_ROOT/fakehome"
mkdir -p "$FAKEHOME"
HOME="$FAKEHOME" bash "$INSTALL_SH" >/dev/null 2>&1

installed_wrapper="$FAKEHOME/.local/bin/mdite"
if [[ -f "$installed_wrapper" ]]; then
  pass "install.sh: mdite wrapper created at ~/.local/bin/mdite"
else
  fail "install.sh: mdite wrapper created at ~/.local/bin/mdite" "file not found"
fi
installed_content="$(cat "$installed_wrapper" 2>/dev/null || true)"
assert_not_contains "Local-prefer wrapper" "$installed_content" "install.sh: mdite wrapper has NO walker preamble"
assert_contains "exec bash \"$SCRIPT_DIR/mdite\" \"\$@\"" "$installed_content" "install.sh: mdite wrapper is a direct exec of the baked path"

check_output="$(HOME="$FAKEHOME" bash "$INSTALL_SH" --check 2>&1)"
assert_contains "[OK] mdite:" "$check_output" "install.sh --check: reports [OK] mdite"

# ============================================================
echo ""
echo "=== Group 9: drifted-plain-entry path ([DRIFT] not [OTHER]; unrelated content still [OTHER]) ==="
# ============================================================

# Simulate a worktree move: hand-edit the baked exec path. Bash pattern
# substitution (not sed) avoids fragile nested-escaping of the literal "$@"
# in the wrapper's exec line.
drifted_content="${installed_content//$SCRIPT_DIR\/mdite//some/other/worktree/mdite}"
printf '%s\n' "$drifted_content" > "$installed_wrapper"
drift_output="$(HOME="$FAKEHOME" bash "$INSTALL_SH" --check 2>&1 | grep '^\[.*\] mdite:' || true)"
assert_contains "[DRIFT] mdite:" "$drift_output" "drifted-plain-entry: --check reports [DRIFT], not [OTHER]"
assert_contains "baked=/some/other/worktree/mdite" "$drift_output" "drifted-plain-entry: reports the drifted baked path"
assert_contains "expected=$SCRIPT_DIR/mdite" "$drift_output" "drifted-plain-entry: reports the expected baked path"
assert_not_contains "[OTHER]" "$drift_output" "drifted-plain-entry: does NOT fall through to [OTHER]"

# A separate hand-edit that replaces the file with unrelated content still
# reports [OTHER] — the plain-shape check doesn't over-match arbitrary text.
cat > "$installed_wrapper" <<'EOF'
#!/usr/bin/env bash
echo "totally unrelated corrupted content"
EOF
other_output="$(HOME="$FAKEHOME" bash "$INSTALL_SH" --check 2>&1 | grep '^\[.*\] mdite:' || true)"
assert_contains "[OTHER] mdite:" "$other_output" "unrelated content: --check still reports [OTHER]"

# ============================================================
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
