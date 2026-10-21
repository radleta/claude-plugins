#!/usr/bin/env bash
# test-git-sync-all.sh — Exercise git-sync-all.sh against throwaway origin/clone repos.
#
# Usage: bash test-git-sync-all.sh
# Exit:  0 all cases pass, 1 any case fails

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC="$SCRIPT_DIR/git-sync-all.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP:?}"' EXIT

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1

PASS=0
FAIL=0
ok()  { PASS=$((PASS + 1)); echo "  ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  FAIL $1"; [ -n "${2:-}" ] && echo "$2" | sed 's/^/       /'; }

# make_origin <name> <base> [develop]: a bare origin whose HEAD is <base>, optionally with develop
make_origin() {
  local name="$1" base="$2" seed="$TMP/seed-$1"
  git init -q -b "$base" "$seed"
  git -C "$seed" commit -q --allow-empty -m "init $name"
  [ "${3:-}" = develop ] && git -C "$seed" branch develop
  git clone -q --bare "$seed" "$TMP/origin/$name.git"
  rm -rf "${seed:?}"
}

# push_upstream <name> <branch>: advance the origin's branch by one commit
push_upstream() {
  local w="$TMP/push-$1"
  git clone -q "$TMP/origin/$1.git" "$w"
  git -C "$w" checkout -q "$2"
  git -C "$w" commit -q --allow-empty -m "upstream $2"
  git -C "$w" push -q origin "$2"
  rm -rf "${w:?}"
}

# fresh: a parent clone (develop) with sub-a (develop), sub-b (main only), sub-c (master only),
# each clone on its target and one commit behind origin.
fresh() {
  rm -rf "${TMP:?}/origin" "${TMP:?}/w"
  make_origin parent master develop
  make_origin sub-a main develop
  make_origin sub-b main
  make_origin sub-c master
  git clone -q -b develop "$TMP/origin/parent.git" "$TMP/w"
  printf '# subrepos\nsub-a/\nsub-b\n\nsub-c  # trailing comment\nmissing/\n' > "$TMP/w/.subrepos"
  printf '.subrepos\nsub-a/\nsub-b/\nsub-c/\n' > "$TMP/w/.git/info/exclude"
  git clone -q "$TMP/origin/sub-a.git" "$TMP/w/sub-a"
  git -C "$TMP/w/sub-a" checkout -q develop
  git clone -q "$TMP/origin/sub-b.git" "$TMP/w/sub-b"
  git clone -q "$TMP/origin/sub-c.git" "$TMP/w/sub-c"
  push_upstream parent develop
  push_upstream sub-a develop
  push_upstream sub-b main
  push_upstream sub-c master
}

run() { OUT=$(cd "$TMP/w" && bash "$SYNC" "$@" 2>&1); CODE=$?; }
branch() { git -C "$TMP/w/$1" branch --show-current; }
at_origin() { [ "$(git -C "$TMP/w/$1" rev-parse HEAD)" = "$(git -C "$TMP/w/$1" rev-parse "origin/$2")" ]; }
line_has() { echo "$OUT" | grep -q -- "  $1: .*$2"; }

expect_blocked() {
  local label="$1" repo="$2" blocker="$3"
  run --apply
  if [ "$CODE" -eq 2 ] && line_has "$repo" "blockers: .*$blocker" && echo "$OUT" | grep -q "Result: BLOCKED"; then
    ok "$label"
  else
    bad "$label (exit $CODE)" "$OUT"
  fi
}

echo "git-sync-all tests"

# 1. Clean tree, every repo on its target and behind: check is READY, apply switches all.
fresh
run
if [ "$CODE" -eq 0 ] && echo "$OUT" | grep -q "Result: READY" && ! at_origin sub-a develop; then
  ok "check mode reports READY and changes nothing"
else bad "check mode READY" "$OUT"; fi
if echo "$OUT" | grep -q "skipped (not a git repo): missing" \
  && line_has . "develop -> develop" && line_has sub-b "main -> main" && line_has sub-c "master -> master"; then
  ok "targets: develop when present, else origin/HEAD; missing dir skipped"
else bad "target selection" "$OUT"; fi
run --apply
if [ "$CODE" -eq 0 ] && echo "$OUT" | grep -q "Result: SWITCHED" \
  && at_origin . develop && at_origin sub-a develop && at_origin sub-b main && at_origin sub-c master; then
  ok "apply fast-forwards every repo to origin"
else bad "apply fast-forward" "$OUT"; fi

# 2. On a pushed feature branch with no local target: apply creates the target tracking origin.
fresh
git -C "$TMP/w/sub-a" checkout -q -b feature
git -C "$TMP/w/sub-a" commit -q --allow-empty -m feat
git -C "$TMP/w/sub-a" push -q -u origin feature
git -C "$TMP/w/sub-a" branch -q -D develop
run --apply
if [ "$CODE" -eq 0 ] && [ "$(branch sub-a)" = develop ] && at_origin sub-a develop \
  && [ "$(git -C "$TMP/w/sub-a" rev-parse --abbrev-ref 'develop@{u}')" = origin/develop ]; then
  ok "pushed feature branch switches; missing target created tracking origin"
else bad "feature branch switch" "$OUT"; fi

# 3. A local branch with no upstream whose commits are all on origin is not a blocker.
fresh
git -C "$TMP/w/sub-b" checkout -q -b scratchwork origin/main
run
if [ "$CODE" -eq 0 ]; then ok "no-upstream branch with nothing unique is not blocked"
else bad "no-upstream clean branch" "$OUT"; fi

# 4. Detached at an origin commit is not a blocker, and apply puts it on the target.
fresh
git -C "$TMP/w/sub-c" checkout -q --detach origin/master
run --apply
if [ "$CODE" -eq 0 ] && [ "$(branch sub-c)" = master ] && at_origin sub-c master; then
  ok "detached at an origin commit switches"
else bad "detached clean" "$OUT"; fi

# Blockers. Each must exit 2 and leave every repo where it was.
fresh
echo x > "$TMP/w/sub-a/tracked.txt"
expect_blocked "untracked file is dirty" sub-a dirty
if ! at_origin . develop && echo "$OUT" | grep -q "Result: BLOCKED"; then
  ok "a blocker in one sub-repo switches no repo"
else bad "nothing switched when blocked" "$OUT"; fi
if grep -q "^?? tracked.txt" "$TMP/w/.git/claude-sync-state.txt"; then
  ok "state file lists the dirty paths"
else bad "state file dirty paths" "$(cat "$TMP/w/.git/claude-sync-state.txt")"; fi

fresh
git -C "$TMP/w/sub-a" commit -q --allow-empty -m one
git -C "$TMP/w/sub-a" commit -q --allow-empty -m two
echo y > "$TMP/w/sub-a/f"; git -C "$TMP/w/sub-a" add f
expect_blocked "staged change is dirty" sub-a dirty
git -C "$TMP/w/sub-a" reset -q --hard HEAD
expect_blocked "commits ahead of upstream are unpushed" sub-a unpushed
if grep -q "two" "$TMP/w/.git/claude-sync-state.txt"; then ok "state file lists the unpushed commits"
else bad "state file unpushed commits"; fi

fresh
git -C "$TMP/w/sub-b" checkout -q -b local-only
git -C "$TMP/w/sub-b" commit -q --allow-empty -m mine
expect_blocked "no-upstream branch with unique commits is unpushed" sub-b unpushed

fresh
git -C "$TMP/w/sub-b" checkout -q -b gone
git -C "$TMP/w/sub-b" commit -q --allow-empty -m mine
git -C "$TMP/w/sub-b" push -q -u origin gone
git -C "$TMP/origin/sub-b.git" branch -q -D gone
expect_blocked "branch whose upstream was deleted keeps its commits as unpushed" sub-b unpushed

fresh
git -C "$TMP/w/sub-c" checkout -q --detach
git -C "$TMP/w/sub-c" commit -q --allow-empty -m floating
expect_blocked "detached HEAD with a local commit" sub-c detached-unpushed

fresh
git -C "$TMP/w/sub-a" checkout -q -b feature
git -C "$TMP/w/sub-a" push -q -u origin feature
git -C "$TMP/w/sub-a" checkout -q develop
git -C "$TMP/w/sub-a" commit -q --allow-empty -m local-develop
git -C "$TMP/w/sub-a" checkout -q feature
expect_blocked "local target ahead of origin" sub-a target-ahead

fresh
( cd "$TMP/w/sub-b" \
  && git checkout -q -b side && echo a > c && git add c && git commit -q -m a \
  && git checkout -q main && echo b > c && git add c && git commit -q -m b \
  && git merge -q side >/dev/null 2>&1 ) || true
expect_blocked "merge in progress" sub-b in-progress

fresh
git -C "$TMP/w/sub-c" remote set-url origin "$TMP/origin/does-not-exist.git"
expect_blocked "fetch failure" sub-c fetch-failed

fresh
git -C "$TMP/origin/sub-b.git" symbolic-ref HEAD refs/heads/nothing
git -C "$TMP/w/sub-b" remote set-head origin -d
expect_blocked "no develop and no origin/HEAD" sub-b no-target

# Arguments and location.
run --bogus
[ "$CODE" -eq 1 ] && ok "unknown argument exits 1" || bad "unknown argument" "$OUT"
OUT=$(cd "$TMP" && bash "$SYNC" 2>&1); CODE=$?
[ "$CODE" -eq 1 ] && ok "outside a repo exits 1" || bad "outside a repo" "$OUT"
fresh
OUT=$(cd "$TMP/w/sub-a" && bash "$SYNC" 2>&1); CODE=$?
if [ "$CODE" -eq 0 ] && echo "$OUT" | grep -q "^Repo: .*sub-a$"; then
  ok "run inside a sub-repo checks that repo and reports its path"
else bad "run inside a sub-repo" "$OUT"; fi

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
