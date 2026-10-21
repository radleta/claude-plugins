#!/usr/bin/env node
// register.mjs — dispatcher for the `register` verb group
//
// Subcommands: add | remove | status | install-hooks | --help

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { normalize as winNormalize } from 'node:path/win32';
import { platform } from 'node:process';
import { homedir } from 'node:os';

// --- Script directory (Windows/MSYS-safe via import.meta.url) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_MJS = join(__dirname, 'server.mjs');

// --- MSYS path normalization ---
// Convert MSYS-style /c/Users/... to C:/Users/... so `claude mcp add` receives
// a native Windows path. On non-Windows platforms, passes through unchanged.
// Reference: scratch-memory.sh:62-74

function normalizeServerPath(p) {
  if (platform !== 'win32') return p;
  const msysMatch = p.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (msysMatch) {
    const drive = msysMatch[1].toUpperCase();
    const rest = msysMatch[2] || '';
    return winNormalize(`${drive}:${rest}`);
  }
  return winNormalize(p);
}

// --- Dep check ---
// Performed once at dispatch entry, before any subcommand runs.

function checkDeps() {
  const result = spawnSync('claude', ['--version'], { stdio: 'ignore' });
  if (result.error || result.status !== 0) {
    process.stderr.write('ERROR: claude CLI not found on PATH\n');
    process.exit(2);
  }
}

// --- help text ---

const CMD = 'scratch-memory register';
const SCRIPT_DIR = __dirname;

function printHelp(out = process.stdout) {
  out.write(`${CMD} — Register/unregister scratch-memory MCP for the current project

Usage:
  ${CMD} add [--user]              Register MCP (default: local scope; --user: user scope)
  ${CMD} remove                    Unregister from this project
  ${CMD} status                    Show current registration
  ${CMD} check [--user]            Check drift of MCP registration (default: local; --user: user scope)
  ${CMD} install-hooks [--user|--project]   Install PostToolUse validation hooks (opt-in)
  ${CMD} --help                    Show this help

Scope: local (default) stores entry in ~/.claude.json for this project only.
--user scope stores entry machine-wide so it's available in all projects.
Local scope bakes --project-root <cwd> into the registration; one entry
serves one project and is robust under cwd divergence (e.g., claude launched
from a project subdirectory). User scope omits --project-root so the server
resolves it from process.cwd() at MCP spawn time, letting one machine-wide
registration serve every project the user opens.
Server: ${SERVER_MJS}

One-time machine setup:
  bash ${SCRIPT_DIR}/install.sh

Exit codes:
  0  success
  1  user error (bad subcommand)
  2  missing dependency or server script
  3  not registered (status only)
`);
}

function printAddHelp(out = process.stdout) {
  out.write(`Usage: ${CMD} add [--user] [--help]

Register the scratch-memory MCP for this worktree.

Flags:
  --user   Register at user scope (machine-wide); default is local scope (project-only)

Local scope (default): entry stored in ~/.claude.json for this project.
User scope (--user): entry stored machine-wide; available in all projects.

Local scope bakes the current cwd as --project-root into the registration,
binding this entry to this project. User scope omits --project-root so the
server resolves project root from process.cwd() at MCP spawn time; one
registration serves every project opened on this machine.
Both modes bind to server.mjs via absolute path. Idempotent: removes any
existing entry for the matching scope before re-adding.

After running, restart Claude Code in this project to load the MCP.
`);
}

function printRemoveHelp(out = process.stdout) {
  out.write(`Usage: ${CMD} remove [--help]

Unregister scratch-memory from this project (both project and local scopes).
Prints "already absent" if not currently registered.
`);
}

function printStatusHelp(out = process.stdout) {
  out.write(`Usage: ${CMD} status [--help]

Show current MCP registration for scratch-memory.

Exit codes:
  0  registered (prints registration details)
  3  not registered
`);
}

// --- Absolute path to the hook script (stays in-place, per P4) ---
const HOOK_SCRIPT = join(__dirname, 'hooks', 'handoff-validate.sh');

// --- Absolute path to the scratch-lint hook script; installed under its own
// PostToolUse matcher group ("Edit|Write|MultiEdit") — see D3. ---
const LINT_HOOK_SCRIPT = join(__dirname, 'hooks', 'scratch-lint.sh');

// --- install-hooks help ---

function printInstallHooksHelp(out = process.stdout) {
  out.write(`Usage: ${CMD} install-hooks [--user|--project] [--help]

Install two PostToolUse validation hooks into a settings.json file (opt-in),
each in its own matcher group:

  handoff-validate.sh   matcher: Edit|Write
    Fires on Edit or Write events that touch scratch/S-*/HANDOFF.md.
    Runs: scratch-memory handoff validate --loose <session-id>

  scratch-lint.sh       matcher: Edit|Write|MultiEdit
    Fires on Edit, Write, or MultiEdit events that touch
    scratch/S-*/tasks/*.md or scratch/issues/*.md.
    Runs: scratch-memory tasks lint <file_path>

Flags:
  --user      Write into ~/.claude/settings.json (default)
  --project   Write into .claude/settings.json in the project root (git-walk)
  --help      Show this help

Each hook is installed idempotently (deduped by exact command string) into
its own matcher group; other matcher-group entries (e.g. from other tools)
are never replaced, only appended to. One settings.json write covers both
hooks per invocation.

Exit codes:
  0  created, updated, or already correct
  1  user error (bad flag) or could not resolve project root (--project only)
`);
}

// --- Subcommands ---

function cmdAdd(userScope = false) {
  const serverPath = normalizeServerPath(SERVER_MJS);
  const scope = userScope ? 'user' : 'local';
  const scopeLabel = userScope ? 'user scope' : 'local scope';

  // Ensure scratch/ exists (scratch-memory has no purpose without it)
  const scratchDir = join(process.cwd(), 'scratch');
  const scratchMetaDir = join(scratchDir, '.scratch-memory');
  if (!existsSync(scratchDir)) {
    mkdirSync(scratchDir, { recursive: true });
    process.stdout.write(`  created: ${scratchDir}/\n`);
  }
  mkdirSync(scratchMetaDir, { recursive: true });

  // Remove pre-existing entry for the same scope (idempotent re-registration).
  // Only sweep the matching scope — user-scope add should not clobber local-scope entries.
  spawnSync('claude', ['mcp', 'remove', '-s', scope, 'scratch-memory'], {
    stdio: ['ignore', 'ignore', 'ignore'],
    shell: false,
  });

  // Re-bind under the chosen scope.
  // Local scope: bake --project-root so the server binds to this project even under cwd divergence.
  // User scope: omit --project-root so the server resolves it from process.cwd() at MCP spawn time,
  //   letting one machine-wide registration serve every project the user opens.
  const projectRoot = process.cwd();
  const mcpArgs = userScope
    ? ['mcp', 'add', '-s', scope, 'scratch-memory', '--', 'node', serverPath]
    : ['mcp', 'add', '-s', scope, 'scratch-memory', '--', 'node', serverPath, '--project-root', projectRoot];
  const result = spawnSync('claude', mcpArgs, { stdio: ['ignore', 'inherit', 'inherit'], shell: false });
  if (result.status !== 0) {
    process.stderr.write('ERROR: claude mcp add failed\n');
    process.exit(2);
  }

  process.stdout.write(
    userScope
      ? `Registered scratch-memory (${scopeLabel}): node ${serverPath}\n`
      : `Registered scratch-memory (${scopeLabel}): node ${serverPath} --project-root ${projectRoot}\n`
  );
  process.stdout.write(
    userScope
      ? `  bound: scratch-memory (${scopeLabel}; project_root resolved from cwd at MCP spawn)\n`
      : `  bound: scratch-memory (${scopeLabel}; --project-root=${projectRoot})\n`
  );
  process.stdout.write('\n');
  process.stdout.write('NOTE: Restart Claude Code in this project to load the MCP.\n');
}

// cmdCheck — inspect the current MCP registration for scratch-memory and report drift.
// Output: one line with [OK], [DRIFT], [MISSING], or [OTHER] prefix tag.
// Always exits 0 (drift is state, not error).
function cmdCheck(userScope = false) {
  const scope = userScope ? 'user' : 'local';
  const scopeLabel = userScope ? 'user scope' : 'local scope';
  const serverPath = normalizeServerPath(SERVER_MJS);
  const projectRoot = process.cwd();

  // Read ~/.claude.json to inspect the MCP registration for the given scope.
  // claude mcp list output format is not reliable for machine parsing;
  // reading the JSON config directly is more robust.
  const claudeJsonPath = join(homedir(), '.claude.json');
  let claudeConfig = {};
  try {
    if (existsSync(claudeJsonPath)) {
      claudeConfig = JSON.parse(readFileSync(claudeJsonPath, 'utf-8'));
    }
  } catch {
    // Parse failure → treat as missing
  }

  // ~/.claude.json structure:
  //   User scope:  { mcpServers: { "scratch-memory": { ... } } }
  //   Local scope: { projects: { "/path/to/project": { mcpServers: { "scratch-memory": { ... } } } } }
  const entry = userScope
    ? claudeConfig?.mcpServers?.['scratch-memory']
    : claudeConfig?.projects?.[projectRoot]?.mcpServers?.['scratch-memory'];

  if (!entry) {
    process.stdout.write(`[MISSING] scratch-memory (${scopeLabel}): not registered at ${scope} scope\n`);
    return;
  }

  // ~/.claude.json entry shape: { type, command: "node", args: [serverPath, ...optArgs], env }
  // `command` is always "node"; serverPath is args[0].
  const args = entry.args || [];
  // Find the --project-root value in args
  const prIdx = args.indexOf('--project-root');
  const bakedRoot = prIdx !== -1 ? args[prIdx + 1] : null;
  // Server path is the first element of args (command "node" is in the command field, not args)
  const bakedServer = args.length > 0 ? args[0] : null;

  if (userScope) {
    // User-scope correct registration: args = [serverPath] — NO --project-root.
    // A baked --project-root means this was registered before the cwd-at-spawn fix.
    if (bakedRoot !== null) {
      process.stdout.write(
        `[DRIFT] scratch-memory (${scopeLabel}): legacy --project-root=${bakedRoot} baked; re-run 'scratch-memory register add --user'\n`
      );
    } else if (bakedServer === serverPath) {
      process.stdout.write(
        `[OK] scratch-memory (${scopeLabel}): correct (server=${serverPath}; project_root from cwd at MCP spawn)\n`
      );
    } else {
      process.stdout.write(`[OTHER] scratch-memory (${scopeLabel}): registered but server path unrecognized\n`);
    }
  } else {
    // Local scope: correct registration has both --project-root and server path matching.
    if (bakedRoot === null || bakedServer === null) {
      process.stdout.write(`[OTHER] scratch-memory (${scopeLabel}): registered but path unrecognized\n`);
      return;
    }

    if (bakedRoot === projectRoot && bakedServer === serverPath) {
      process.stdout.write(`[OK] scratch-memory (${scopeLabel}): correct (worktree=${projectRoot})\n`);
    } else if (bakedRoot !== projectRoot) {
      process.stdout.write(`[DRIFT] scratch-memory (${scopeLabel}): baked=${bakedRoot} expected=${projectRoot}\n`);
    } else {
      process.stdout.write(`[OTHER] scratch-memory (${scopeLabel}): registered but path unrecognized\n`);
    }
  }
}

function cmdRemove() {
  let removed = false;
  const r1 = spawnSync('claude', ['mcp', 'remove', '-s', 'project', 'scratch-memory'], {
    stdio: ['ignore', 'ignore', 'ignore'],
    shell: false,
  });
  if (r1.status === 0) removed = true;

  const r2 = spawnSync('claude', ['mcp', 'remove', '-s', 'local', 'scratch-memory'], {
    stdio: ['ignore', 'ignore', 'ignore'],
    shell: false,
  });
  if (r2.status === 0) removed = true;

  if (removed) {
    process.stdout.write('  removed: scratch-memory\n');
  } else {
    process.stdout.write('  already absent: scratch-memory\n');
  }
}

function cmdStatus() {
  const result = spawnSync('claude', ['mcp', 'get', 'scratch-memory'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: false,
  });
  if (result.status === 0) {
    if (result.stdout) process.stdout.write(result.stdout);
  } else {
    process.stdout.write('Not registered in this project\n');
    process.exit(3);
  }
}

// --- MSYS → bash-safe path for hook command (settings.json must hold a bash-invocable path) ---
// On Windows, convert /c/Users/... to C:/Users/... for the bash command string.
// Forward slashes are used throughout — backslashes inside bash double-quoted strings
// are escape sequences (\t, \n, \b, etc.) and would silently corrupt paths on Windows.
// MSYS/bash accepts forward-slash Windows paths (e.g. C:/Users/...) without issue.
function normalizeHookPath(p) {
  if (platform !== 'win32') return p;
  const msysMatch = p.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (msysMatch) {
    const drive = msysMatch[1].toUpperCase();
    const rest = (msysMatch[2] || '');
    // Keep forward slashes — safe for bash on Windows/MSYS
    return `${drive}:${rest}`;
  }
  // Already a native Windows path — convert any backslashes to forward slashes for bash safety
  return p.replace(/\\/g, '/');
}

function cmdInstallHooks(scope) {
  // Local helper: install one hook's command into its matcher group inside
  // the given PostToolUse array — find-or-create the group, dedup by exact
  // command string, append if not yet present (never replace the array).
  // Mutates `postToolUse` in place; does not write to disk and never exits
  // cmdInstallHooks, so the loop below can process a second (or third)
  // descriptor unconditionally instead of being cut off the way the
  // pre-refactor single-hook version was. Returns a status string so the
  // loop can report per-hook and decide whether a write is needed at all.
  function installHookDescriptor(postToolUse, matcher, hookCommand) {
    const desiredEntry = { type: 'command', command: hookCommand, timeout: 10 };

    const groupIdx = postToolUse.findIndex(g => g.matcher === matcher);

    if (groupIdx === -1) {
      postToolUse.push({ matcher, hooks: [desiredEntry] });
      return 'created';
    }

    const group = postToolUse[groupIdx];
    if (!Array.isArray(group.hooks)) group.hooks = [];

    // Dedup by command string
    if (group.hooks.some(h => h.command === hookCommand)) {
      return 'already-present';
    }

    group.hooks.push(desiredEntry);
    return 'appended';
  }

  // Resolve target settings.json path
  let settingsPath;
  if (scope === 'project') {
    // Walk cwd for .git root (same logic as resolveProjectRoot in handoff.mjs)
    let cur = process.cwd();
    let found = false;
    while (true) {
      const candidate = join(cur, '.git');
      try {
        const st = statSync(candidate);
        if (st.isFile() || st.isDirectory()) { found = true; break; }
      } catch {
        // ENOENT or EACCES — keep walking
      }
      const parent = dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    if (!found) {
      process.stderr.write('ERROR: not inside a git repository (no .git found walking up from cwd)\n');
      process.exit(1);
    }
    settingsPath = join(cur, '.claude', 'settings.json');
  } else {
    // --user (default)
    settingsPath = join(homedir(), '.claude', 'settings.json');
  }

  // Capture whether the file existed BEFORE we read or create it, so status reporting
  // can accurately distinguish created (new file) from updated (pre-existing file mutated).
  const existedOnDisk = existsSync(settingsPath);

  // Read existing settings (or start from empty object)
  let settings = {};
  if (existedOnDisk) {
    try {
      const raw = readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(raw);
    } catch (err) {
      process.stderr.write(`ERROR: failed to parse ${settingsPath}: ${err.message}\n`);
      process.exit(2);
    }
  }

  // Ensure hooks and hooks.PostToolUse exist
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

  const postToolUse = settings.hooks.PostToolUse;

  // Desired matcher groups — handoff-validate.sh keeps its existing matcher
  // unwidened (D3); scratch-lint.sh gets its own "Edit|Write|MultiEdit" group
  // since it also needs to fire on MultiEdit.
  const MATCHER = 'Edit|Write';
  const descriptors = [
    { matcher: MATCHER, script: HOOK_SCRIPT },
    { matcher: 'Edit|Write|MultiEdit', script: LINT_HOOK_SCRIPT },
  ];

  // Install each hook descriptor into its own matcher group. Both descriptors
  // are visited unconditionally on this one loop, so neither can be silently
  // skipped the way the pre-refactor version's two early exits (:403, :415)
  // would have skipped a second hook appended after them.
  let anyChanged = false;
  for (const { matcher, script } of descriptors) {
    // Resolve the absolute path to the hook script (resolves at install time, not run time)
    const hookScriptRaw = resolve(script);
    const hookScript = normalizeHookPath(hookScriptRaw);
    const hookCommand = `bash "${hookScript}"`;

    // Informational: report hook script source location (per scripts-expert Status Reporting)
    process.stderr.write(`  hook script: ${hookScriptRaw}\n`);

    const result = installHookDescriptor(postToolUse, matcher, hookCommand);

    if (result === 'already-present') {
      process.stderr.write(`  already correct: ${settingsPath}\n`);
      continue;
    }

    anyChanged = true;
    process.stdout.write(`Hooks installed: ${hookScriptRaw}\n`);
    if (result === 'created') {
      if (existedOnDisk) {
        process.stderr.write(`  updated: ${settingsPath} (added PostToolUse matcher group for "${matcher}")\n`);
      } else {
        process.stderr.write(`  created: ${settingsPath} (added PostToolUse matcher group for "${matcher}")\n`);
      }
    } else {
      // result === 'appended'
      process.stderr.write(`  updated: ${settingsPath} (appended hook to existing "${matcher}" matcher group)\n`);
    }
  }

  // Single write for both descriptors — skip entirely when both were already
  // present, preserving the pre-refactor no-write-when-idempotent behaviour.
  if (anyChanged) {
    writeSettingsAtomic(settingsPath, settings);
  }
}

// Atomic write via temp+rename (D8)
function writeSettingsAtomic(targetPath, data) {
  const dir = dirname(targetPath);
  mkdirSync(dir, { recursive: true });
  const tmp = `${targetPath}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  renameSync(tmp, targetPath);
}

// --- dispatch ---
// Arg-guard pattern:
//   1. -h/--help → help, exit 0
//   2. Unknown flag → error + help, exit 1
//   3. add/remove/status → run subcommand (each supports --help as first sub-arg)
//   4. Unknown subcommand → error + help, exit 1
//   5. No subcommand → error + help, exit 1

export async function dispatch(argv) {
  const verb = argv[0];

  if (verb === '-h' || verb === '--help') {
    printHelp(process.stdout);
    process.exit(0);
  }

  if (typeof verb === 'string' && verb.startsWith('-')) {
    process.stderr.write(`ERROR: unknown option: ${verb}\n\n`);
    printHelp(process.stderr);
    process.exit(1);
  }

  // Check deps before any subcommand that needs `claude`
  if (verb === 'add' || verb === 'remove' || verb === 'status') {
    // Sub-subcommand --help doesn't need claude
    const subArg = argv[1];
    if (subArg !== '-h' && subArg !== '--help') {
      checkDeps();
    }
  }
  // check verb reads ~/.claude.json directly; no `claude` dep needed

  switch (verb) {
    case 'add': {
      let userScope = false;
      for (let i = 1; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === '-h' || flag === '--help') {
          printAddHelp(process.stdout);
          process.exit(0);
        } else if (flag === '--user') {
          userScope = true;
        } else if (typeof flag === 'string' && flag.startsWith('-')) {
          process.stderr.write(`ERROR: unknown option: ${flag}\n\n`);
          printAddHelp(process.stderr);
          process.exit(1);
        }
      }
      cmdAdd(userScope);
      break;
    }

    case 'check': {
      let userScope = false;
      for (let i = 1; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === '-h' || flag === '--help') {
          process.stdout.write(`Usage: ${CMD} check [--user] [--help]\n\nCheck drift of the scratch-memory MCP registration.\n\nFlags:\n  --user   Check user-scope registration (default: local scope)\n\nOutput: one prefix-tagged line per check. Exits 0 always.\n`);
          process.exit(0);
        } else if (flag === '--user') {
          userScope = true;
        } else if (typeof flag === 'string' && flag.startsWith('-')) {
          process.stderr.write(`ERROR: unknown option: ${flag}\n`);
          process.exit(1);
        }
      }
      cmdCheck(userScope);
      break;
    }

    case 'remove': {
      const sub = argv[1];
      if (sub === '-h' || sub === '--help') {
        printRemoveHelp(process.stdout);
        process.exit(0);
      }
      if (typeof sub === 'string' && sub.startsWith('-')) {
        process.stderr.write(`ERROR: unknown option: ${sub}\n\n`);
        printRemoveHelp(process.stderr);
        process.exit(1);
      }
      cmdRemove();
      break;
    }

    case 'status': {
      const sub = argv[1];
      if (sub === '-h' || sub === '--help') {
        printStatusHelp(process.stdout);
        process.exit(0);
      }
      if (typeof sub === 'string' && sub.startsWith('-')) {
        process.stderr.write(`ERROR: unknown option: ${sub}\n\n`);
        printStatusHelp(process.stderr);
        process.exit(1);
      }
      cmdStatus();
      break;
    }

    case 'install-hooks': {
      const sub = argv[1];
      if (sub === '-h' || sub === '--help') {
        printInstallHooksHelp(process.stdout);
        process.exit(0);
      }
      // Determine scope flag (default: --user)
      let scope = 'user';
      for (let i = 1; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === '--user') {
          scope = 'user';
        } else if (flag === '--project') {
          scope = 'project';
        } else if (typeof flag === 'string' && flag.startsWith('-')) {
          process.stderr.write(`ERROR: unknown option: ${flag}\n\n`);
          printInstallHooksHelp(process.stderr);
          process.exit(1);
        }
        // Positional args beyond flags are silently ignored (none expected)
      }
      cmdInstallHooks(scope);
      break;
    }

    case undefined:
    case '': {
      process.stderr.write('ERROR: no subcommand\n\n');
      printHelp(process.stderr);
      process.exit(1);
      break;
    }

    default: {
      process.stderr.write(`ERROR: unknown subcommand: ${verb}\n\n`);
      printHelp(process.stderr);
      process.exit(1);
    }
  }
}

export default dispatch;

// ---------------------------------------------------------------------------
// Entry-point guard — forward to dispatch() on direct invocation (`node
// register.mjs <subcommand> ...`), not just when imported by
// scratch-memory.mjs. Without this, direct invocation silently exits 0 with
// no output (issue: verb-modules-silent-noop-direct-invocation).
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch(err => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(2);
  });
}
