---
name: scripts-expert
description: "Validated patterns for writing portable shell and Node.js scripts with install.sh centralization, Windows/MSYS compatibility, argument validation, and PATH exposure via ~/.local/bin/. Use when creating shell scripts, writing install scripts, exposing scripts on PATH, handling Windows symlink issues, or adding --help to CLI tools — even for simple single-file scripts."
---

<role>
  <identity>scripts expert</identity>
  <purpose>Provide validated patterns for portable shell and Node.js scripts across Windows/MSYS and Unix platforms, with centralized install.sh management and PATH exposure.</purpose>
</role>

## Pages

- [Windows/MSYS Gotchas](windows-msys/index.md) — Platform compatibility traps and correct approaches for symlinks, script resolution, JSON IPC, and atomic writes
- [Exec Wrapper Pattern](exec-wrapper.md) — Elevation-free script exposure via `~/.local/bin/` exec wrappers that work on all platforms
- [install.sh Pattern](install-sh.md) — Idempotent install script structure with status reporting and PATH verification
- [Argument Validation Guard](argument-validation.md) — `-h`/`--help` handling and unknown-flag rejection for PATH-exposed scripts
- [Script Header Convention](script-header-convention.md) — Standard bash shebang, usage comment, and `set -euo pipefail` strict mode
- [Local-Prefer Walker Pattern](local-prefer-walker-pattern.md) — Walk up from PWD to find project-local script before falling back to baked path
- [Opt-In User-Scope Install](opt-in-user-scope-install.md) — Default project-local mutations only; --user-install flag for ~/.local/bin/ writes
- [Bash Subshell Strips Globals](bash-subshell-strips-globals.md) — Command substitution forks a subshell — function global assignments don't propagate to parent
- [Destructive Shared Staging Hazard](destructive-shared-staging-hazard.md) — Destructive `rm -rf` on a shared staging path silently clobbers concurrent writers; mitigate with per-process staging or atomic tmpfile+rename

## Meta
- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
