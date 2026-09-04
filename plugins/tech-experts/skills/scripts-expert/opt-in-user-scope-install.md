---
tags: [scripts/install-design]
summary: "Default project-local mutations only; --user-install flag for ~/.local/bin/ writes"
---

## Opt-In User-Scope Install + Read-Only Drift Detection in install.sh

Install scripts that mutate user-global state (`~/.local/bin/`, `~/.claude.json`, etc.) should be **opt-in**, matching conventions from `pip install --user`, `npm install -g`, and `cargo install`. Default behavior should mutate only project-local state. The explicit flag for global mutation is `--user-install` (or a domain equivalent).

**Drift detection convention:** every `install.sh` exposes a `--check` mode with these constraints:
- Fully read-only — no `mkdir`, no writes, no source-loading that requires the target script to exist yet
- Always exits 0 (drift is a state, not an error)
- Emits one prefix-tagged line per owned artifact: `[OK]`, `[DRIFT]`, `[MISSING]`, `[OTHER]`
- Compares the wrapper actually on disk against what the `install.sh` would write right now (byte-for-byte diff), and reports the result

**Aggregator pattern:** an orchestrator (e.g., `init-repo.sh`) loops over all `install.sh --check` invocations and produces a drift summary. Filter candidates via `git ls-files` rather than a shell glob — this prevents executing attacker-planted `install.sh` files at glob-matched paths outside version control.

**Discovered:** During install-scope-flags session. `init-repo.sh` previously always wrote to `~/.local/bin/` unconditionally. Post-change: `./init-repo.sh` runs the read-only drift sweep by default (which caught a real `[MISSING] scratch-memory (user scope)` divergence on first run); `./init-repo.sh --user-install` is the explicit opt-in for global mutation.

**Impact:** Applies to every `install.sh` in this repo and any repo that ships wrapper-installing scripts. The `--check` mode doubles as a CI smoke test for wrapper staleness.
