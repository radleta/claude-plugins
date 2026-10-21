#!/usr/bin/env bash
# test-learned-check.sh — Automated tests for learned-check
# Run: bash test-learned-check.sh
# Every test runs inside a temp directory holding its own scratch/, so learned-check
# resolves that directory as the repo root and never touches the real scratch/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LC="$SCRIPT_DIR/learned-check.mjs"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
REAL_CAPTURE="$REPO_ROOT/scratch/wiki-durability/learned/research-learned-check-status-enum-and-writers.md"
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

TMPDIR_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT

# run <dir> <args...> — run learned-check from <dir>; sets rc and out (stdout+stderr).
run() {
  local dir="$1"; shift
  rc=0
  out=$(cd "$dir" && node "$LC" "$@" 2>&1) || rc=$?
}

# capture <path> <status> [extra frontmatter lines...] — write a minimal valid learned file.
capture() {
  local path="$1" status="$2"; shift 2
  mkdir -p "$(dirname "$path")"
  {
    printf -- '---\nsource: test\ntype: research\nscope: project\ntarget-domain: demo-expert\nstatus: %s\n' "$status"
    local line
    for line in "$@"; do printf '%s\n' "$line"; done
    printf -- '---\n\n## Title of %s\n\nBody line one.\n' "$(basename "$path" .md)"
  } > "$path"
}

# fresh <name> — a new temp root with scratch/proj/learned/; echoes the root.
fresh() {
  local root="$TMPDIR_ROOT/$1"
  mkdir -p "$root/scratch/proj/learned"
  echo "$root"
}

frontmatter_field() {
  sed -n "s/^$2: //p" "$1" | head -1
}

# ============================================================
echo "=== Group 1: help ==="
# ============================================================
R="$(fresh help)"
run "$R" --help
assert_exit 0 "$rc" "--help exits 0"
assert_contains "mark-dropped <file> <reason> <note>" "$out" "--help lists mark-dropped"
run "$R" mark-dropped --help
assert_exit 0 "$rc" "mark-dropped --help exits 0"
assert_contains "sought, novel, enforcing, durable, duplicate, tool-output" "$out" "mark-dropped help names the six reasons"
run "$R" pending --help
assert_contains "--type <type>" "$out" "pending help names --type"
assert_contains "2 = usage error" "$out" "pending help names exit 2"
run "$R" status --help
assert_contains "dropped" "$out" "status help names dropped"
run "$R" bogus
assert_exit 1 "$rc" "unknown subcommand exits 1"
run "$R" status x --nope
assert_exit 1 "$rc" "unknown flag exits 1"

# ============================================================
echo "=== Group 2: status ==="
# ============================================================
R="$(fresh status)"
L="$R/scratch/proj/learned"
run "$R" status
assert_exit 1 "$rc" "status with no path exits 1"
run "$R" status "$L"
assert_exit 0 "$rc" "status on empty dir exits 0"
run "$R" status "$R/scratch/nope/learned"
assert_contains "[WARN] no such directory" "$out" "status warns on missing dir"
capture "$L/a.md" ingested
capture "$L/b.md" dropped "drop-reason: durable" 'drop-note: "gone next week"'
run "$R" status "$L"
assert_exit 0 "$rc" "status with only ingested and dropped exits 0"
assert_contains "Dropped:" "$out" "status dashboard shows Dropped"
capture "$L/c.md" captured
run "$R" status "$L"
assert_exit 1 "$rc" "status with a captured file exits 1"
capture "$L/d.md" escalated "escalation-reason: cannot-verify"
capture "$L/e.md" weird
run "$R" status "$R/scratch/proj" --json
assert_exit 2 "$rc" "status with an escalated file exits 2 (project dir resolves to learned/)"
assert_eq '{"captured":1,"ingested":1,"escalated":1,"dropped":1,"invalid":1}' \
  "$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s).counts)))')" \
  "status --json counts every status plus invalid"

# ============================================================
echo "=== Group 3: pending and escalated ==="
# ============================================================
run "$R" pending "$L"
assert_exit 1 "$rc" "pending exits 1 with a captured file"
assert_contains "c.md" "$out" "pending lists the captured file"
assert_not_contains "b.md" "$out" "pending omits the dropped file"
run "$R" pending "$L" --json
assert_contains '"file"' "$out" "pending --json emits file records"
run "$R" escalated "$L"
assert_exit 2 "$rc" "escalated exits 2 with an escalated file"
assert_contains "cannot-verify" "$out" "escalated shows the reason"
R2="$(fresh pending-clear)"
capture "$R2/scratch/proj/learned/x.md" dropped "drop-reason: novel" 'drop-note: "known"'
capture "$R2/scratch/proj/learned/y.md" escalated "escalation-reason: r"
run "$R2" pending "$R2/scratch/proj/learned"
assert_exit 0 "$rc" "pending treats dropped and escalated as not pending"
run "$R2" escalated "$R2/scratch/nope"
assert_exit 0 "$rc" "escalated on a missing dir exits 0"
run "$R" pending
assert_exit 2 "$rc" "pending with no path exits 2"
run "$R" pending "$L" --nope
assert_exit 2 "$rc" "pending with an unknown flag exits 2"
run "$R" --nope pending "$L"
assert_exit 2 "$rc" "an unknown flag before pending exits 2"
run "$R" status "$L" --type drift
assert_exit 1 "$rc" "--type on another subcommand is an unknown flag (exit 1)"

R3="$(fresh pending-type)"
L3="$R3/scratch/proj/learned"
capture "$L3/drift-page.md" captured
sed -i 's/^type: research$/type: drift/' "$L3/drift-page.md"
capture "$L3/research-one.md" captured
capture "$L3/drift-done.md" ingested
sed -i 's/^type: research$/type: drift/' "$L3/drift-done.md"
run "$R3" pending "$L3" --type drift
assert_exit 1 "$rc" "pending --type drift exits 1 with a captured drift file"
assert_contains "drift-page.md" "$out" "pending --type drift lists the drift file"
assert_not_contains "research-one.md" "$out" "pending --type drift omits the research file"
assert_not_contains "drift-done.md" "$out" "pending --type drift omits an ingested drift file"
run "$R3" pending "$L3" --type=drift --json
assert_exit 1 "$rc" "pending --type=drift --json exits 1"
assert_contains "drift-page.md" "$out" "pending --type=drift --json lists the drift file"
assert_not_contains "research-one.md" "$out" "pending --type=drift --json omits the research file"
rm "$L3/drift-page.md"
run "$R3" pending "$L3" --type drift
assert_exit 0 "$rc" "pending --type drift exits 0 when only research is captured"
run "$R3" pending "$L3"
assert_exit 1 "$rc" "pending without --type still counts the research file"
run "$R3" pending "$R3/no-such-dir" --type drift
assert_exit 0 "$rc" "pending --type on a missing dir exits 0"
run "$R3" pending "$L3" --type drfit
assert_exit 2 "$rc" "pending --type with an unknown type exits 2"
assert_contains "invalid type 'drfit'" "$out" "pending --type names the bad value"
assert_contains "research, decision, gotcha, pattern, drift" "$out" "pending --type lists the valid types"
run "$R3" pending "$L3" --type
assert_exit 2 "$rc" "pending --type with no value exits 2"

# ============================================================
echo "=== Group 4: feed-forward ==="
# ============================================================
R="$(fresh ff)"
L="$R/scratch/proj/learned"
capture "$L/s2.md" captured "targets-step: 2"
capture "$L/s5.md" captured "targets-step: 5"
capture "$L/s9.md" ingested "targets-step: 9"
run "$R" feed-forward "$L" --step 3
assert_exit 0 "$rc" "feed-forward exits 0"
assert_contains "s5.md" "$out" "feed-forward includes a captured file at a later step"
assert_not_contains "s2.md" "$out" "feed-forward excludes an earlier step"
assert_not_contains "s9.md" "$out" "feed-forward excludes a non-captured file"
run "$R" feed-forward "$L"
assert_exit 1 "$rc" "feed-forward without --step exits 1"
run "$R" feed-forward "$L" --step=-1
assert_exit 1 "$rc" "feed-forward with a negative step exits 1"

# ============================================================
echo "=== Group 5: validate ==="
# ============================================================
R="$(fresh validate)"
L="$R/scratch/proj/learned"
capture "$L/ok.md" captured
capture "$L/dropped-ok.md" dropped "drop-reason: duplicate" 'drop-note: "same as page x"'
run "$R" validate "$L"
assert_exit 0 "$rc" "validate accepts captured and a complete dropped file"
capture "$L/dropped-bare.md" dropped
capture "$L/dropped-badreason.md" dropped "drop-reason: vague" 'drop-note: "x"'
capture "$L/badstatus.md" archived
capture "$L/badsev.md" captured "severity: minor"
printf 'no frontmatter\n' > "$L/nofm.md"
run "$R" validate "$L" --json
assert_exit 1 "$rc" "validate exits 1 on errors"
assert_contains "dropped-bare.md: missing field 'drop-reason'" "$out" "validate requires drop-reason on dropped"
assert_contains "dropped-bare.md: missing field 'drop-note'" "$out" "validate requires drop-note on dropped"
assert_contains "invalid drop-reason 'vague'" "$out" "validate rejects an unknown drop-reason"
assert_contains "invalid status 'archived'" "$out" "validate rejects an unknown status"
assert_contains "'severity' field only valid when type=drift" "$out" "validate keeps the severity rule"
assert_contains "no frontmatter found" "$out" "validate flags a file with no frontmatter"
assert_not_contains "ok.md: " "$out" "validate raises nothing for the valid files"

# ============================================================
echo "=== Group 6: init ==="
# ============================================================
R="$(fresh init)"
run "$R" init "$R/scratch/new/learned"
assert_exit 0 "$rc" "init exits 0"
[[ -f "$R/scratch/new/learned/.gitkeep" ]] && pass "init creates .gitkeep" || fail "init creates .gitkeep" "missing"
run "$R" init "$R/scratch/new/learned" --json
assert_contains '"created": false' "$out" "init is idempotent"

# ============================================================
echo "=== Group 7: mark-ingested and mark-escalated ==="
# ============================================================
R="$(fresh mark)"
L="$R/scratch/proj/learned"
capture "$L/i.md" captured
run "$R" mark-ingested "$L/i.md"
assert_exit 0 "$rc" "mark-ingested exits 0"
assert_eq "ingested" "$(frontmatter_field "$L/i.md" status)" "mark-ingested writes status"
[[ -n "$(frontmatter_field "$L/i.md" ingested-at)" ]] && pass "mark-ingested stamps ingested-at" || fail "mark-ingested stamps ingested-at" "empty"
assert_contains "Body line one." "$(cat "$L/i.md")" "mark-ingested preserves the body"
run "$R" mark-ingested "$L/missing.md"
assert_exit 1 "$rc" "mark-ingested on a missing file exits 1"
run "$R" mark-ingested "$TMPDIR_ROOT/outside.md"
assert_exit 1 "$rc" "mark-ingested outside scratch/ exits 1"
capture "$L/e.md" captured
run "$R" mark-escalated "$L/e.md" 'sources-disagree $& here'
assert_exit 0 "$rc" "mark-escalated exits 0"
assert_eq 'sources-disagree $& here' "$(frontmatter_field "$L/e.md" escalation-reason)" "mark-escalated writes the reason verbatim"
run "$R" mark-escalated "$L/e.md"
assert_exit 1 "$rc" "mark-escalated without a reason exits 1"

# ============================================================
echo "=== Group 8: mark-dropped on a real capture ==="
# ============================================================
R="$(fresh drop)"
L="$R/scratch/proj/learned"
if [[ -f "$REAL_CAPTURE" ]]; then
  cp "$REAL_CAPTURE" "$L/real.md"
  # The real capture may already be filed; the verb only drops a pending one.
  sed -i 's/^status: .*/status: captured/' "$L/real.md"
else
  capture "$L/real.md" captured
fi
run "$R" mark-dropped "$L/real.md" durable "roster of writers"
assert_exit 0 "$rc" "mark-dropped exits 0"
assert_eq "dropped" "$(frontmatter_field "$L/real.md" status)" "mark-dropped writes status: dropped"
assert_eq "durable" "$(frontmatter_field "$L/real.md" drop-reason)" "mark-dropped writes drop-reason"
assert_eq '"roster of writers"' "$(frontmatter_field "$L/real.md" drop-note)" "mark-dropped writes a quoted drop-note"
run "$R" validate "$L"
assert_exit 0 "$rc" "validate passes on the dropped copy"
run "$R" status "$L" --json
assert_contains '"dropped": 1' "$out" "status counts the copy under dropped"
run "$R" mark-dropped "$L/real.md" durable "again"
assert_exit 1 "$rc" "mark-dropped on an already-dropped file exits 1"
capture "$L/other.md" captured
capture "$L/sought.md" captured
run "$R" mark-dropped "$L/sought.md" sought "answers the workstream's own question"
assert_exit 0 "$rc" "mark-dropped accepts sought"
assert_eq "sought" "$(frontmatter_field "$L/sought.md" drop-reason)" "mark-dropped writes drop-reason sought"
run "$R" mark-dropped "$L/other.md" vague "x"
assert_exit 1 "$rc" "mark-dropped with an unknown reason exits 1"
run "$R" mark-dropped "$L/other.md" novel ""
assert_exit 1 "$rc" "mark-dropped with an empty note exits 1"
run "$R" mark-dropped "$L/other.md" novel "   "
assert_exit 1 "$rc" "mark-dropped with a blank note exits 1"
run "$R" mark-dropped "$L/missing.md" novel "x"
assert_exit 1 "$rc" "mark-dropped on a missing file exits 1"
run "$R" mark-dropped
assert_exit 1 "$rc" "mark-dropped with no arguments exits 1"
assert_eq "captured" "$(frontmatter_field "$L/other.md" status)" "a refused mark-dropped leaves the file untouched"
capture "$L/esc.md" escalated "escalation-reason: r"
run "$R" mark-dropped "$L/esc.md" novel "x"
assert_exit 1 "$rc" "mark-dropped on an escalated file exits 1"
run "$R" mark-dropped "$L/other.md" tool-output 'said "raw" output' --json
assert_exit 0 "$rc" "mark-dropped --json exits 0"
assert_contains '"drop-reason": "tool-output"' "$out" "mark-dropped --json reports the reason"
run "$R" validate "$L"
assert_exit 0 "$rc" "a note with embedded quotes still validates"
capture "$L/esc-note.md" captured
run "$R" mark-dropped "$L/esc-note.md" novel "$(printf 'bad \033]0;title\007 note')"
assert_exit 0 "$rc" "mark-dropped with escape sequences in the note exits 0"
if [[ "$out" == *$'\033]0;'* || "$out" == *$'\007'* ]]; then
  fail "mark-dropped strips control characters from the echoed note" "raw escape byte reached the terminal"
else
  pass "mark-dropped strips control characters from the echoed note"
fi

# ============================================================
echo "=== Group 9: reroute ==="
# ============================================================
R="$(fresh reroute)"
L="$R/scratch/proj/learned"
capture "$L/r.md" escalated "escalation-reason: wrong domain"
run "$R" reroute "$L/r.md" other-expert
assert_exit 0 "$rc" "reroute exits 0 on an escalated file"
assert_eq "captured" "$(frontmatter_field "$L/r.md" status)" "reroute resets status to captured"
assert_eq "other-expert" "$(frontmatter_field "$L/r.md" target-domain)" "reroute writes target-domain"
run "$R" reroute "$L/r.md" "../evil"
assert_exit 1 "$rc" "reroute rejects an invalid domain name"
run "$R" reroute "$L/r.md"
assert_exit 1 "$rc" "reroute without a domain exits 1"

# ============================================================
echo "=== Group 10: list and stats ==="
# ============================================================
R="$(fresh across)"
capture "$R/scratch/proj/learned/p1.md" ingested
capture "$R/scratch/proj/learned/p2.md" dropped "drop-reason: novel" 'drop-note: "x"'
capture "$R/scratch/two/learned/t1.md" captured
mkdir -p "$R/scratch/.hidden/learned"
capture "$R/scratch/.hidden/learned/h.md" escalated "escalation-reason: r"
run "$R" list
assert_exit 1 "$rc" "list exits 1 with a pending file"
assert_contains "p2.md" "$out" "list shows the dropped file"
assert_not_contains "h.md" "$out" "list skips dot-directories under scratch/"
run "$R" stats --json
assert_exit 0 "$rc" "stats exits 0"
assert_contains '"dropped": 1' "$out" "stats counts dropped"
assert_contains '"captured": 1' "$out" "stats counts captured"
run "$R" stats
assert_contains "Dropped:" "$out" "stats text shows Dropped"

# ============================================================
echo ""
echo "=== Group 12: --include-archived reads the archive branch ==="
# ============================================================
# A real git repo with an `archive` branch holding scratch/archived-proj/learned/,
# and a working tree holding a different project, so a hit can only come from the branch.
R="$(fresh archived)"
git -C "$R" init -q
git -C "$R" config user.email test@example.com
git -C "$R" config user.name Test
capture "$R/scratch/archived-proj/learned/old.md" ingested
git -C "$R" add -A >/dev/null
git -C "$R" commit -qm "archived capture"
git -C "$R" branch -m archive
git -C "$R" checkout -q --orphan main
git -C "$R" rm -rq --cached . 2>/dev/null || true
rm -rf "$R/scratch/archived-proj"
capture "$R/scratch/proj/learned/live.md" captured
git -C "$R" add -A >/dev/null
git -C "$R" commit -qm "live capture"

run "$R" list
assert_not_contains "old.md" "$out" "list without the flag leaves the archive branch alone"
assert_contains "live.md" "$out" "list without the flag shows the working-tree capture"

run "$R" list --include-archived
assert_contains "old.md" "$out" "list --include-archived finds the archived capture"
assert_contains "live.md" "$out" "list --include-archived keeps the working-tree capture"

run "$R" stats --include-archived --json
assert_contains '"ingested": 1' "$out" "stats --include-archived counts the archived capture"

# --- Boundary ingest helpers ---

# gitrepo <name> — a temp git repo with one commit, scratch/proj/learned/ and
# .claude/skills/dom/old.md; echoes its realpathed root.
gitrepo() {
  local root="$TMPDIR_ROOT/$1"
  mkdir -p "$root/scratch/proj/learned" "$root/.claude/skills/dom"
  git -C "$root" init -q
  git -C "$root" config user.email test@example.com
  git -C "$root" config user.name Test
  printf 'old\n' > "$root/.claude/skills/dom/old.md"
  git -C "$root" add -A >/dev/null
  git -C "$root" commit -qm init
  realpath "$root"
}

# drift <path> <status> — a capture of type drift.
drift() {
  capture "$1" "$2"
  sed -i 's/^type: research$/type: drift/' "$1"
}

# ============================================================
echo ""
echo "=== Group 13: gate ==="
# ============================================================
R="$(gitrepo gate)"
L="$R/scratch/proj/learned"
drift "$L/d.md" captured
run "$R" gate 'scratch/proj/learned' --type drift
assert_exit 1 "$rc" "gate --type drift exits 1 with a captured drift file"
assert_eq "$L"$'\nproject: proj\npending: 1\npending exit: 1' "$out" "gate prints the dir, project, count and pending exit"
sed -i 's/^status: captured$/status: ingested/' "$L/d.md"
run "$R" gate 'scratch/proj/learned' --type drift
assert_exit 0 "$rc" "gate exits 0 once the capture is ingested"
assert_eq "$L"$'\nproject: proj\npending: 0\npending exit: 0' "$out" "gate prints pending: 0 once ingested"
capture "$L/r.md" captured
run "$R" gate 'scratch/proj/learned' --type drift
assert_contains "pending: 0" "$out" "gate --type drift does not count a research capture"
run "$R" gate "$L/"
assert_exit 1 "$rc" "gate with no type counts the research capture (absolute path, trailing slash)"
assert_contains "pending: 1" "$out" "gate with no type prints pending: 1"
mkdir -p "$R/scratch/empty"
run "$R" gate 'scratch/empty/learned'
assert_exit 0 "$rc" "gate on a missing learned/ in an existing project dir exits 0"
assert_eq "$R/scratch/empty/learned"$'\nproject: empty\npending: 0\npending exit: 0' "$out" "gate on a missing learned/ prints pending: 0"
run "$R" gate 'scratch/nope/learned'
assert_eq 'refused: scratch/nope/learned is not scratch/<project>/learned' "$out" "gate refuses a learned/ whose project dir is missing, as realpath did"

run "$R" gate 'scratch/proj/learned' --type research
assert_exit 3 "$rc" "gate --type research is refused"
assert_eq "refused: type 'research' is not drift" "$out" "gate names the refused type"
run "$R" gate 'scratch/proj/learned' --type
assert_eq "refused: type '' is not drift" "$out" "gate --type with no value is refused as an empty type"
run "$R" gate 'scratch/proj learned'
assert_exit 3 "$rc" "gate refuses a path with a space"
assert_eq 'refused: the path holds a character outside [-A-Za-z0-9_./:\]' "$out" "gate prints the allow-list refusal"
run "$R" gate "$(printf 'scratch/proj/learned\nscratch/proj/learned')"
assert_eq 'refused: the path holds a character outside [-A-Za-z0-9_./:\]' "$out" "gate refuses a two-line path"
run "$R" gate 'scratch/proj/../proj/learned'
assert_exit 3 "$rc" "gate refuses a .. segment"
assert_eq "refused: '..' segment in scratch/proj/../proj/learned" "$out" "gate prints the .. refusal"
run "$R" gate 'scratch\proj\..\proj\learned'
assert_eq "refused: '..' segment in scratch\\proj\\..\\proj\\learned" "$out" "gate finds a .. segment behind backslashes"
run "$R" gate 'scratch/proj'
assert_exit 3 "$rc" "gate refuses a project dir"
assert_eq 'refused: scratch/proj is not scratch/<project>/learned' "$out" "gate prints the not-learned refusal"
out=$(cd "$R" && node "$LC" gate 'C:\a\b' 2>&1) && rc=0 || rc=$?
assert_exit 3 "$rc" "the page's step 1 command with C:\\a\\b is refused"
assert_eq 'refused: C:\a\b is not scratch/<project>/learned' "$out" "the step 1 command keeps every backslash of C:\\a\\b"
mkdir -p "$TMPDIR_ROOT/elsewhere/learned"
ln -s "$TMPDIR_ROOT/elsewhere/learned" "$R/scratch/out"
run "$R" gate 'scratch/out'
assert_eq 'refused: scratch/out is not scratch/<project>/learned' "$out" "gate follows a symlink before the containment check"
run "$TMPDIR_ROOT" gate "$L"
assert_exit 3 "$rc" "gate outside a git repo is refused"

ln -s "$R/.claude/skills/dom" "$R/.claude/skills/zlink"
run "$R" gate 'scratch/proj/learned'
assert_exit 3 "$rc" "gate refuses a symlinked domain under .claude/skills"
assert_eq 'refused: .claude/skills/zlink is a symlink, and git status cannot see the files behind it; run /ingest by hand' "$out" "gate names the symlinked domain"
rm "$R/.claude/skills/zlink"
mv "$R/.claude/skills" "$R/real-skills"
ln -s "$R/real-skills" "$R/.claude/skills"
run "$R" gate 'scratch/proj/learned'
assert_contains 'refused: .claude/skills is a symlink' "$out" "gate refuses a symlinked .claude/skills"
rm "$R/.claude/skills"; mv "$R/real-skills" "$R/.claude/skills"

run "$R" gate
assert_exit 2 "$rc" "gate with no path exits 2"
run "$R" gate 'scratch/proj/learned' --nope
assert_exit 2 "$rc" "gate with an unknown flag exits 2"
if [[ "$(id -u)" != 0 ]]; then
  chmod 000 "$L"
  run "$R" gate 'scratch/proj/learned'
  chmod 755 "$L"
  assert_exit 2 "$rc" "gate exits 2 when the directory cannot be scanned"
  assert_eq "$L"$'\nproject: proj\npending: ?\npending exit: 2' "$out" "gate prints pending: ? on a scan error"
else
  echo "  SKIP: unreadable-directory check (running as root)"
fi

# ============================================================
echo ""
echo "=== Group 14: bashQuote matches bash 5.2 printf %q (C.UTF-8) ==="
# ============================================================
# Expected values were probed once from bash 5.2.21 under C.UTF-8 and are fixed here;
# bash is never the oracle, since macOS's bash 3.2 quotes differently.
# quote_case <input> <expected> <label>
quote_case() {
  local got
  got="$(node --input-type=module -e "import { bashQuote } from '$LC'; process.stdout.write(bashQuote(process.argv[1]))" -- "$1")"
  assert_eq "$2" "$got" "bashQuote: $3"
}
quote_case '' "''" empty
quote_case 'a,b' 'a\,b' comma
quote_case '~x' '\~x' leading-tilde
quote_case 'x~' 'x~' inner-tilde
quote_case '~' '\~' lone-tilde
quote_case '#x' '\#x' leading-hash
quote_case 'x#y' 'x#y' inner-hash
quote_case 'é' 'é' non-ascii
quote_case '日本' '日本' cjk
quote_case 'ü b' 'ü\ b' non-ascii-space
quote_case $'a\tb' "\$'a\\tb'" tab
quote_case $'a\nb' "\$'a\\nb'" newline
quote_case $'x\'y\tz\\w é' "\$'x\\'y\\tz\\\\w é'" ansi-c-escapes
quote_case $'a\001b\033c\177' "\$'a\\001b\\Ec\\177'" octal-escapes
quote_case $'a\rb\a\b\v\f' "\$'a\\rb\\a\\b\\v\\f'" c-escapes
quote_case "a'b" "a\\'b" quote
quote_case 'a b' 'a\ b' space
quote_case 'a=b@c%d+e-f:g.h_i/j' 'a=b@c%d+e-f:g.h_i/j' safe-punctuation
quote_case '=x@y%z+w-v:u' '=x@y%z+w-v:u' leading-safe-punctuation
quote_case 'a!b^c{d}[e]*f?g$h"i;j&k|l<m>(n)`o\p' 'a\!b\^c\{d\}\[e\]\*f\?g\$h\"i\;j\&k\|l\<m\>\(n\)\`o\\p' shell-metacharacters

# leftovers <git-dir> — every boundary-ingest file left in a git dir, one per line.
leftovers() { (cd "$1" && ls -1 | grep '^boundary-ingest' || true); }

# ============================================================
echo ""
echo "=== Group 15: snapshot and compare ==="
# ============================================================
R="$(gitrepo snap)"
GD="$(git -C "$R" rev-parse --absolute-git-dir)"
printf 'dirty before\n' >> "$R/.claude/skills/dom/old.md"
rc=0; out=$(cd "$R" && echo '[]' | node "$LC" snapshot 'scratch/proj/learned' --repos - 2>&1) || rc=$?
assert_exit 0 "$rc" "snapshot exits 0"
assert_eq "" "$out" "snapshot prints nothing on success"
assert_eq "root	.	$GD/boundary-ingest-skills.lock"$'\n'". \\ M\\ .claude/skills/dom/old.md ''"$'\n'"repos: read" \
  "$(cat "$GD/boundary-ingest-proj.before")" "the snapshot file keeps the shell's layout"
assert_eq "snapshot: $GD/boundary-ingest-proj.before" "$(head -1 "$GD/boundary-ingest-skills.lock")" "the lock names the snapshot file"
[[ "$(sed -n 2p "$GD/boundary-ingest-skills.lock")" =~ ^created:\ [0-9]+$ ]] && pass "the lock records created: epoch seconds" || fail "the lock records created: epoch seconds" "$(cat "$GD/boundary-ingest-skills.lock")"
run "$R" snapshot 'scratch/proj/learned'
assert_exit 3 "$rc" "a second snapshot on the project is refused"
assert_eq "refused: $GD/boundary-ingest-proj.before exists; another ingest on proj is running, or one stopped before step 4 (remove the file only when none is running)" "$out" "the second snapshot names the existing file"
mkdir -p "$R/scratch/other/learned"
run "$R" snapshot 'scratch/other/learned'
assert_exit 3 "$rc" "a snapshot on another project is refused while the repo lock is held"
assert_eq "refused: $GD/boundary-ingest-skills.lock is held by the ingest whose snapshot is $GD/boundary-ingest-proj.before (remove it only when none is running)" "$out" "the refusal names the lock holder"
assert_eq "boundary-ingest-proj.before"$'\n'"boundary-ingest-skills.lock" "$(leftovers "$GD")" "a refused snapshot removes its own file and leaves the held lock"
mkdir -p "$R/.claude/skills/dom/scripts"
printf 'new\n' > "$R/.claude/skills/dom/new.md"
printf 'echo\n' > "$R/.claude/skills/dom/scripts/run.sh"
printf 'again\n' >> "$R/.claude/skills/dom/old.md"
run "$R" compare 'scratch/proj/learned'
assert_exit 0 "$rc" "compare exits 0"
assert_eq "other .claude/skills/dom/scripts/run.sh"$'\n'"page .claude/skills/dom/new.md" "$out" "compare prints the written paths, byte-sorted, leaving the pre-dirty page out"
assert_eq "" "$(leftovers "$GD")" "compare leaves no snapshot file and no lock"
run "$R" compare 'scratch/proj/learned'
assert_exit 4 "$rc" "compare with no snapshot aborts"
assert_eq "aborted: no snapshot at $GD/boundary-ingest-proj.before" "$out" "compare names the missing snapshot"

# renames, deletions and quoting
git -C "$R" add -A >/dev/null && git -C "$R" commit -qm two
(cd "$R" && : | node "$LC" snapshot "$R/scratch/proj/learned" --repos - >/dev/null 2>&1) || true
(cd "$R" && git mv .claude/skills/dom/new.md '.claude/skills/dom/re named.md' && rm .claude/skills/dom/old.md)
printf 'x\n' > "$R/.claude/skills/dom/notes.txt"
run "$R" compare 'scratch/proj/learned'
assert_eq "other .claude/skills/dom/notes.txt"$'\n'"page .claude/skills/dom/new.md"$'\n'"page .claude/skills/dom/old.md"$'\n'"page .claude/skills/dom/re\\ named.md"$'\n'"note: repos not read" \
  "$out" "compare lists both sides of a staged rename, a deletion and a non-page, %q-quoted, then the repos note"
git -C "$R" add -A >/dev/null && git -C "$R" commit -qm three

# stdin that is not a JSON array reads as not-read
for input in '' 'not json' '{}'; do
  rc=0; out=$(cd "$R" && printf '%s' "$input" | node "$LC" snapshot 'scratch/proj/learned' --repos - 2>&1) || rc=$?
  assert_exit 0 "$rc" "snapshot --repos - with stdin '$input' exits 0"
  assert_eq "repos: not-read" "$(tail -1 "$GD/boundary-ingest-proj.before")" "stdin '$input' records repos: not-read"
  run "$R" compare 'scratch/proj/learned'
  assert_eq "note: repos not read" "$out" "compare after stdin '$input' prints the repos note"
done

# usage and path errors route like each verb's own failure
run "$R" snapshot
assert_exit 3 "$rc" "snapshot with no path exits 3"
assert_eq "refused: snapshot requires exactly one <learned-dir> argument" "$out" "snapshot prints a usage error as refused:"
run "$R" snapshot 'scratch/proj/learned' --nope
assert_eq "refused: Unknown flag: --nope" "$out" "snapshot prints an unknown flag as refused:"
run "$R" snapshot 'scratch/proj/learned' --repos x
assert_exit 3 "$rc" "snapshot --repos with a value other than - exits 3"
run "$R" --nope snapshot 'scratch/proj/learned'
assert_exit 3 "$rc" "an unknown flag before snapshot exits 3"
run "$R" snapshot 'scratch/proj'
assert_eq "refused: scratch/proj is not scratch/<project>/learned" "$out" "snapshot repeats the gate's path checks"
run "$R" compare
assert_exit 4 "$rc" "compare with no path exits 4"
assert_eq "aborted: compare requires exactly one <learned-dir> argument" "$out" "compare prints a usage error as aborted:"
run "$R" compare 'scratch/proj/learned' --nope
assert_eq "aborted: Unknown flag: --nope" "$out" "compare prints an unknown flag as aborted:"
run "$R" compare 'scratch/pr oj/learned'
assert_exit 4 "$rc" "compare refuses a bad path"
assert_eq 'aborted: the path holds a character outside [-A-Za-z0-9_./:\]' "$out" "compare prints a path refusal as aborted:"
ln -s "$R/.claude/skills/dom" "$R/.claude/skills/zlink"
run "$R" snapshot 'scratch/proj/learned'
assert_contains "refused: .claude/skills/zlink is a symlink" "$out" "snapshot re-checks symlinks at use"
rm "$R/.claude/skills/zlink"
assert_eq "" "$(leftovers "$GD")" "refused and aborted runs leave nothing behind"

# a failing git status refuses or aborts, and releases
cp "$GD/index" "$TMPDIR_ROOT/index.bak"
printf 'garbage' > "$GD/index"
run "$R" snapshot 'scratch/proj/learned'
assert_exit 3 "$rc" "snapshot exits 3 when git status fails"
assert_eq "refused: git status failed; nothing was dispatched" "$out" "snapshot names the failed git status"
assert_eq "" "$(leftovers "$GD")" "a failed git status releases the lock and the snapshot file"
cp "$TMPDIR_ROOT/index.bak" "$GD/index"
(cd "$R" && node "$LC" snapshot 'scratch/proj/learned' >/dev/null 2>&1) || true
printf 'garbage' > "$GD/index"
run "$R" compare 'scratch/proj/learned'
assert_exit 4 "$rc" "compare exits 4 when git status fails"
assert_eq "aborted: git status failed" "$out" "compare names the failed git status"
assert_eq "" "$(leftovers "$GD")" "an aborted compare still releases"
cp "$TMPDIR_ROOT/index.bak" "$GD/index"

# a signal during a git call: the run finishes its synchronous work, then exits non-zero
SLOW="$TMPDIR_ROOT/slow-git"
mkdir -p "$SLOW"
printf '#!/usr/bin/env bash\n[ "$1" = status ] && sleep 1\nexec %q "$@"\n' "$(command -v git)" > "$SLOW/git"
chmod +x "$SLOW/git"
(cd "$R" && node "$LC" snapshot 'scratch/proj/learned' >/dev/null 2>&1) || true
(cd "$R" && PATH="$SLOW:$PATH" exec node "$LC" compare 'scratch/proj/learned' >/dev/null 2>&1) & pid=$!
sleep 0.5; kill -TERM "$pid" || true; rc=0; wait "$pid" || rc=$?
assert_exit 143 "$rc" "compare interrupted by SIGTERM exits 143"
assert_eq "" "$(leftovers "$GD")" "an interrupted compare releases the lock and the snapshot file"
(cd "$R" && PATH="$SLOW:$PATH" exec node "$LC" snapshot 'scratch/proj/learned' >/dev/null 2>&1) & pid=$!
sleep 0.5; kill -TERM "$pid" || true; rc=0; wait "$pid" || rc=$?
assert_exit 143 "$rc" "snapshot interrupted by SIGTERM exits 143, never reading as finished"
assert_eq "boundary-ingest-proj.before"$'\n'"boundary-ingest-skills.lock" "$(leftovers "$GD")" "a snapshot that finished before the signal keeps what it handed to compare"
run "$R" compare 'scratch/proj/learned'
assert_eq "" "$(leftovers "$GD")" "compare releases what the interrupted snapshot handed it"

# ============================================================
echo ""
echo "=== Group 16: registered repos ==="
# ============================================================
R="$(gitrepo reg-calling)"
GD="$(git -C "$R" rev-parse --absolute-git-dir)"
R2="$(gitrepo reg-target)"
GD2="$(git -C "$R2" rev-parse --absolute-git-dir)"
R3="$(gitrepo reg-linked)"
ln -s "$R3/.claude/skills/dom" "$R3/.claude/skills/link"
R4="$(gitrepo reg-held)"
GD4="$(git -C "$R4" rev-parse --absolute-git-dir)"
mkdir -p "$TMPDIR_ROOT/reg-plain"
: > "$TMPDIR_ROOT/live.before"
printf 'snapshot: %s\ncreated: %s\n' "$TMPDIR_ROOT/live.before" "$(date -u +%s)" > "$GD4/boundary-ingest-skills.lock"
cp "$GD4/boundary-ingest-skills.lock" "$TMPDIR_ROOT/held.lock"
entry() { printf '{"name":"%s","path":"%s","accepts":%s,"description":"","level":"user","ok":%s}' "$1" "$2" "$3" "$4"; }
LIST="[$(entry calling "$R" '["learned"]' true),$(entry target "$R2" '["learned","docs"]' true),$(entry dup "$R2/" '["learned"]' true),$(entry linked "$R3" '["learned"]' true),$(entry held "$R4" '["learned"]' true),$(entry plain "$TMPDIR_ROOT/reg-plain" '["learned"]' true),$(entry gone "$TMPDIR_ROOT/no/such/repo" '["learned"]' true),$(entry docs-only "$R3" '["docs"]' true),$(entry broken "$R4" '["learned"]' false)]"
rc=0; out=$(cd "$R" && printf '%s' "$LIST" | node "$LC" snapshot 'scratch/proj/learned' --repos - 2>&1) || rc=$?
assert_exit 0 "$rc" "snapshot with registered repos exits 0"
assert_eq "note: skipped registered repo $R3: $R3/.claude/skills/link is a symlink"$'\n'"note: skipped registered repo $R4: its ingest lock is held by the ingest whose snapshot is $TMPDIR_ROOT/live.before"$'\n'"note: skipped registered repo $TMPDIR_ROOT/reg-plain: git rev-parse failed"$'\n'"note: skipped registered repo $TMPDIR_ROOT/no/such/repo: realpath failed" \
  "$out" "snapshot notes each skipped registered repo and continues"
assert_eq "root	.	$GD/boundary-ingest-skills.lock"$'\n'"root	$R2	$GD2/boundary-ingest-skills.lock" \
  "$(grep '^root' "$GD/boundary-ingest-proj.before")" "snapshot locks the calling repo once and the registered repo once"
assert_eq "snapshot: $GD/boundary-ingest-proj.before" "$(head -1 "$GD2/boundary-ingest-skills.lock")" "the registered repo's lock names the calling repo's snapshot"
cmp -s "$GD4/boundary-ingest-skills.lock" "$TMPDIR_ROOT/held.lock" && pass "a held registered lock is left untouched" || fail "a held registered lock is left untouched" "changed"
mkdir -p "$R2/.claude/skills/dom2"
printf 'p\n' > "$R2/.claude/skills/dom2/p.md"
printf 'x\n' > "$R2/.claude/skills/dom2/p.sh"
run "$R" compare 'scratch/proj/learned'
assert_eq "repo-other $R2 .claude/skills/dom2/p.sh"$'\n'"repo-page $R2 .claude/skills/dom2/p.md" "$out" "compare lists the registered repo's paths under its root"
assert_eq "" "$(leftovers "$GD")$(leftovers "$GD2")" "compare releases the registered repo's lock too"
cmp -s "$GD4/boundary-ingest-skills.lock" "$TMPDIR_ROOT/held.lock" && pass "compare leaves another ingest's lock alone" || fail "compare leaves another ingest's lock alone" "changed"
rm -f "$GD4/boundary-ingest-skills.lock"
git -C "$R2" add -A >/dev/null && git -C "$R2" commit -qm dom2

# a registered repo whose git status fails refuses the whole run and releases both locks
cp "$GD2/index" "$TMPDIR_ROOT/index2.bak"
printf 'garbage' > "$GD2/index"
rc=0; out=$(cd "$R" && printf '[%s]' "$(entry target "$R2" '["learned"]' true)" | node "$LC" snapshot 'scratch/proj/learned' --repos - 2>&1) || rc=$?
assert_exit 3 "$rc" "a registered repo's failed git status refuses the run"
assert_eq "refused: git status failed in $R2; nothing was dispatched" "$out" "the refusal names the registered repo"
assert_eq "" "$(leftovers "$GD")$(leftovers "$GD2")" "the refusal releases both locks and the snapshot file"
cp "$TMPDIR_ROOT/index2.bak" "$GD2/index"

# the page's step 3 command, through the real scratch-memory in a sandboxed config
if command -v scratch-memory >/dev/null 2>&1; then
  export SCRATCH_MEMORY_CONFIG_DIR="$TMPDIR_ROOT/sm-config"
  (cd "$R" && scratch-memory repos add target "$R2" --accepts learned --user >/dev/null 2>&1)
  rc=0; out=$(cd "$R" && { scratch-memory repos list --json 2>/dev/null || true; } | node "$LC" snapshot 'scratch/proj/learned' --repos - 2>&1) || rc=$?
  assert_exit 0 "$rc" "step 3's page command exits 0 with a registered repo"
  printf 'q\n' > "$R2/.claude/skills/dom2/q.md"
  run "$R" compare 'scratch/proj/learned'
  assert_eq "repo-page $R2 .claude/skills/dom2/q.md" "$out" "the page command reaches the repo registered through scratch-memory"
  NOSM_PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -vxF "$(dirname "$(command -v scratch-memory)")" | paste -sd:)"
  rc=0; out=$(cd "$R" && PATH="$NOSM_PATH" bash -c "{ scratch-memory repos list --json 2>/dev/null || true; } | node '$LC' snapshot 'scratch/proj/learned' --repos -" 2>&1) || rc=$?
  assert_exit 0 "$rc" "step 3's page command exits 0 with scratch-memory off PATH"
  printf 'r\n' > "$R2/.claude/skills/dom2/r.md"
  run "$R" compare 'scratch/proj/learned'
  assert_eq "note: repos not read" "$out" "with scratch-memory off PATH, compare prints the repos note and no repo- line"
  unset SCRATCH_MEMORY_CONFIG_DIR
else
  echo "  SKIP: registered-repo half of step 3's page command (scratch-memory not installed)"
fi

# ============================================================
echo ""
echo "=== Group 17: lock contention and old-format files ==="
# ============================================================
R="$(gitrepo contend)"
GD="$(git -C "$R" rev-parse --absolute-git-dir)"
mkdir -p "$R/scratch/p1/learned" "$R/scratch/p2/learned" "$R/scratch/p3/learned"
winners_ok=0; refusals_ok=0
for round in $(seq 1 50); do
  printf 'snapshot: %s\ncreated: %s\n' "$GD/boundary-ingest-gone.before" "$(date -u +%s)" > "$GD/boundary-ingest-skills.lock"
  for p in p1 p2 p3; do
    (cd "$R" && { node "$LC" snapshot "scratch/$p/learned" > "$TMPDIR_ROOT/contend-$p.out" 2>&1 && echo 0 || echo $?; } > "$TMPDIR_ROOT/contend-$p.rc") &
  done
  wait
  won=""; held=0
  for p in p1 p2 p3; do
    if [[ "$(cat "$TMPDIR_ROOT/contend-$p.rc")" == 0 ]]; then won="$won $p"; fi
  done
  won="${won# }"
  for p in p1 p2 p3; do
    [[ "$p" == "$won" ]] && continue
    [[ "$(cat "$TMPDIR_ROOT/contend-$p.out")" == "refused: $GD/boundary-ingest-skills.lock is held by the ingest whose snapshot is $GD/boundary-ingest-$won.before (remove it only when none is running)" ]] && held=$((held + 1))
  done
  [[ "$won" =~ ^p[123]$ ]] && winners_ok=$((winners_ok + 1))
  [[ "$held" == 2 ]] && refusals_ok=$((refusals_ok + 1))
  [[ "$won" =~ ^p[123]$ ]] && (cd "$R" && node "$LC" compare "scratch/$won/learned" >/dev/null 2>&1) || true
  rm -f "$GD/boundary-ingest-skills.lock"
done
assert_eq 50 "$winners_ok" "exactly one of three concurrent snapshots takes a stale lock, every round"
assert_eq 50 "$refusals_ok" "the other two print the held-lock refusal naming the winner, every round"
assert_eq "" "$(cd "$GD" && ls -1 | grep -E '\.(broken|new)\.|\.mutex$' || true)" "no .broken.*, .new.* or .mutex file remains"

# the mutex: one left by a killed process is removed; a live one makes snapshot wait, then refuse
: > "$GD/boundary-ingest-skills.lock.mutex"
touch -d '1 minute ago' "$GD/boundary-ingest-skills.lock.mutex"
run "$R" snapshot 'scratch/p1/learned'
assert_exit 0 "$rc" "a mutex over 30 s old is removed and the lock taken"
run "$R" compare 'scratch/p1/learned'
assert_eq "" "$(leftovers "$GD")" "nothing is left after breaking a stale mutex"
: > "$GD/boundary-ingest-skills.lock.mutex"
t0=$(date +%s%N)
run "$R" snapshot 'scratch/p1/learned'
waited_ms=$(( ($(date +%s%N) - t0) / 1000000 ))
assert_exit 3 "$rc" "a live mutex refuses snapshot once its wait runs out"
[ "$waited_ms" -ge 2000 ] && pass "snapshot waits 2 s for a live mutex" || fail "snapshot waits 2 s for a live mutex" "${waited_ms} ms"
assert_eq "refused: $GD/boundary-ingest-skills.lock.mutex stayed busy for 2 s; another ingest is taking or releasing the lock (remove it only when none is running)" "$out" "the busy-mutex refusal names the mutex"
[ -e "$GD/boundary-ingest-skills.lock.mutex" ] && pass "the live mutex is left in place" || fail "the live mutex is left in place" "removed"
assert_eq "boundary-ingest-skills.lock.mutex" "$(leftovers "$GD")" "the refusal leaves no lock or snapshot file"
rm -f "$GD/boundary-ingest-skills.lock.mutex"

# stale and malformed locks
printf 'snapshot: %s\ncreated: %s\n' "$GD/boundary-ingest-live.before" "$(( $(date -u +%s) - 7300 ))" > "$GD/boundary-ingest-skills.lock"
: > "$GD/boundary-ingest-live.before"
run "$R" snapshot 'scratch/p1/learned'
assert_exit 0 "$rc" "a lock over 2 h old is broken even when its snapshot file exists"
run "$R" compare 'scratch/p1/learned'
rm -f "$GD/boundary-ingest-live.before"
: > "$GD/boundary-ingest-skills.lock"
run "$R" snapshot 'scratch/p1/learned'
assert_exit 3 "$rc" "a fresh lock with no content is held"
assert_eq "refused: $GD/boundary-ingest-skills.lock is held by the ingest whose snapshot is  (remove it only when none is running)" "$out" "the empty lock refusal"
assert_eq "" "$(cat "$GD/boundary-ingest-skills.lock")" "the empty lock is left untouched"
printf 'snapshot: %s\n' "$GD/boundary-ingest-gone.before" > "$GD/boundary-ingest-skills.lock"
run "$R" snapshot 'scratch/p1/learned'
assert_exit 3 "$rc" "a fresh lock with no created: line is held, even with its snapshot gone"
touch -d '3 hours ago' "$GD/boundary-ingest-skills.lock"
run "$R" snapshot 'scratch/p1/learned'
assert_exit 0 "$rc" "a malformed lock older than 2 h is broken"
run "$R" compare 'scratch/p1/learned'
assert_eq "" "$(leftovers "$GD")" "nothing is left after the malformed-lock run"

# a lock held by another live snapshot: refused, and the lock is left byte for byte
: > "$GD/boundary-ingest-other.before"
printf 'snapshot: %s\ncreated: %s\n' "$GD/boundary-ingest-other.before" "$(date -u +%s)" > "$GD/boundary-ingest-skills.lock"
cp "$GD/boundary-ingest-skills.lock" "$TMPDIR_ROOT/live.lock"
run "$R" snapshot 'scratch/p1/learned'
assert_eq "refused: $GD/boundary-ingest-skills.lock is held by the ingest whose snapshot is $GD/boundary-ingest-other.before (remove it only when none is running)" "$out" "a live lock refuses snapshot"
cmp -s "$GD/boundary-ingest-skills.lock" "$TMPDIR_ROOT/live.lock" && pass "the live lock is left untouched" || fail "the live lock is left untouched" "changed"
rm -f "$GD/boundary-ingest-skills.lock" "$GD/boundary-ingest-other.before"

# files written by the old shell: compare reads them and releases both
printf 'dirty\n' >> "$R/.claude/skills/dom/old.md"
printf 'root\t.\t%s\n' "$GD/boundary-ingest-skills.lock" > "$GD/boundary-ingest-p1.before"
printf '%s %s %s\n' '.' '\ M\ .claude/skills/dom/old.md' "''" >> "$GD/boundary-ingest-p1.before"
printf 'repos: read\n' >> "$GD/boundary-ingest-p1.before"
printf 'snapshot: %s\ncreated: %s\n' "$GD/boundary-ingest-p1.before" "$(date -u +%s)" > "$GD/boundary-ingest-skills.lock"
printf 'n\n' > "$R/.claude/skills/dom/fresh page.md"
run "$R" compare 'scratch/p1/learned'
assert_exit 0 "$rc" "compare reads an old-format snapshot"
assert_eq 'page .claude/skills/dom/fresh\ page.md' "$out" "compare matches the old %q status line and lists only the new path"
assert_eq "" "$(leftovers "$GD")" "compare releases an old-format lock and snapshot"
rm "$R/.claude/skills/dom/fresh page.md"

# an old-format file with an MSYS-form root, as Git Bash wrote it: off Windows that root
# cannot be read, so compare aborts, and still releases the calling repo's lock and file
printf 'root\t.\t%s\n' "$GD/boundary-ingest-skills.lock" > "$GD/boundary-ingest-p1.before"
printf 'root\t%s\t%s\n' '/c/Users/dev/other' 'C:/Users/dev/other/.git/boundary-ingest-skills.lock' >> "$GD/boundary-ingest-p1.before"
printf '%s %s %s\n' '/c/Users/dev/other' '\?\?\ .claude/skills/x/a.md' "''" >> "$GD/boundary-ingest-p1.before"
printf 'repos: read\n' >> "$GD/boundary-ingest-p1.before"
printf 'snapshot: %s\ncreated: %s\n' "$GD/boundary-ingest-p1.before" "$(date -u +%s)" > "$GD/boundary-ingest-skills.lock"
run "$R" compare 'scratch/p1/learned'
assert_exit 4 "$rc" "compare aborts on an MSYS root it cannot read off Windows"
assert_eq "" "$(leftovers "$GD")" "the abort still releases the calling repo's lock and the snapshot"

# ============================================================
echo ""
echo "=== Group 18: this repository ==="
# ============================================================
HERE_GD="$(git -C "$REPO_ROOT" rev-parse --absolute-git-dir)"
if [[ -d "$REPO_ROOT/scratch/boundary-ingest-port/learned" && -z "$(leftovers "$HERE_GD")" ]]; then
  run "$REPO_ROOT" gate 'scratch/boundary-ingest-port/learned'
  assert_contains "pending: 0" "$out" "gate on this repo's build learned/ prints pending: 0"
  rc=0; out=$(cd "$REPO_ROOT" && echo '[]' | node "$LC" snapshot 'scratch/boundary-ingest-port/learned' --repos - 2>&1) || rc=$?
  assert_eq "0:" "$rc:$out" "snapshot in this repo prints nothing"
  run "$REPO_ROOT" compare 'scratch/boundary-ingest-port/learned'
  assert_eq "0:" "$rc:$out" "compare in this repo, with no ingest between, prints nothing"
  assert_eq "" "$(leftovers "$HERE_GD")" "this repo is left with no snapshot or lock file"
else
  echo "  SKIP: this-repository run (no scratch/boundary-ingest-port/learned, or an ingest holds this repo)"
fi

# ============================================================
echo ""
echo "==========================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================================="
[[ "$FAIL" -eq 0 ]]
