---
tags: [scripts/wrapper-design]
summary: "Walk up from PWD to find project-local script before falling back to baked path"
---

## Local-Prefer Walker Pattern for Worktree-Aware Dev Tools

When an `install.sh` writes a wrapper to `~/.local/bin/<name>`, a single hardcoded `exec node "/abs/path/to/script.mjs" "$@"` breaks for users with multiple worktrees: whichever worktree's `install.sh` last ran owns all wrappers, regardless of where the user is currently working.

**Pattern:** Walk up from `$PWD` looking for the project-local copy of the target script. On match, exec local. On no match, fall through to the baked absolute path.

```bash
#!/usr/bin/env bash
TARGET_REL_PATH="<relative/path/from/repo/root>"
dir=$(pwd)
while [ "$dir" != "/" ]; do
  if [ -f "$dir/$TARGET_REL_PATH" ]; then
    exec <runner> "$dir/$TARGET_REL_PATH" "$@"
  fi
  dir=$(dirname "$dir")
done
exec <runner> "<BAKED_ABS_PATH>" "$@"
```

`<runner>` is `node` for `.mjs`/`.js`, `bash` for `.sh`. The baked fallback covers invocations outside any source-repo worktree (the common production case).

**Tradeoff:** The walker means whatever worktree you `cd` into, its tools win. For users with one canonical worktree the walker has no visible effect. For multi-worktree dev iteration, edits in the active worktree are exercised immediately without re-running `install.sh`.

**Discovered:** During install-scope-flags session. Solved the worktree-mismatch root cause described in the MCP-registration-bakes-path learned file. After switching to the walker, tests in the dev worktree exercised dev code instead of the canonical worktree's stale binary.

**Impact:** Any install.sh that writes a `~/.local/bin` wrapper for a script inside a cloneable repo should use this pattern. Single-worktree users pay negligible overhead (one `stat` per directory level); multi-worktree users get correct behavior without any manual re-registration.
