#!/usr/bin/env node
// scratch-memory.mjs — unified CLI entry point + top-level dispatcher
//
// Usage:
//   scratch-memory handoff <subcommand> [options]    Manage handoff docs
//   scratch-memory pickup [options]                  Pick up a prior session
//   scratch-memory register <subcommand> [options]   Register/manage MCP
//   scratch-memory --help                            Show this help
//   scratch-memory --version                         Show version
//
// Dispatcher routes to ./handoff.mjs, ./pickup.mjs, or ./register.mjs.
// Each sub-module exports async dispatch(argv) and handles its own arg guard.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --- Script directory (Windows/MSYS-safe via import.meta.url) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Version: read from plugin-manifests/scratch-memory.json ---
// Prefer the manifest (single-source truth, D17 spirit). Fall back to a
// constant if the file can't be found (e.g. run from outside the repo).
const VERSION_FALLBACK = '0.1.0';

function readVersion() {
  try {
    // resolveProjectRoot isn't available yet at module-top — walk up from
    // __dirname to find the manifest instead of relying on process.cwd().
    let cur = __dirname;
    for (let i = 0; i < 20; i++) {
      const candidate = join(cur, 'plugin-manifests', 'scratch-memory.json');
      try {
        const raw = readFileSync(candidate, 'utf-8');
        const manifest = JSON.parse(raw);
        if (typeof manifest.version === 'string') return manifest.version;
      } catch {
        // not found here, keep walking
      }
      const parent = dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  } catch {
    // fall through to fallback
  }
  return VERSION_FALLBACK;
}

const VERSION = readVersion();
const CMD = 'scratch-memory';

// --- Top-level help text ---

function printHelp(out = process.stdout) {
  out.write(`${CMD} — scratch-memory CLI (version ${VERSION})

Usage:
  ${CMD} handoff <subcommand> [options]    Manage session handoff documents
  ${CMD} pickup [options]                  Pick up a prior session's workstream
  ${CMD} register <subcommand> [options]   Register/manage the scratch-memory MCP
  ${CMD} --help, -h                        Show this help
  ${CMD} --version, -v                     Show version

Verb groups:
  handoff          commit, path, validate, list — manage HANDOFF.md
  pickup           Transfer a prior session's folder to the current session
  register         Add, remove, status for scratch-memory MCP
  cat-sessions     Assemble/inspect session log files newest-first with char budget
  rewrite-pointer  Rewrite the thin HANDOFF.md pointer from the assembled session log
  tasks            list, lint — workstream task backlog and issues-corpus frontmatter lint
  epics            frontier — ready spikes of an epic in the scratch/issues/ corpus

Pickup subcommands:
  pickup <from-session-id> --to-session-id <to-session-id> [--json]   Transfer prior session folder to current session

Handoff subcommands:
  handoff commit [ID] [--json]            No-op for v3 pointers; legacy folders redirect to rewrite-pointer
  handoff path [ID]                       Print absolute path to HANDOFF.md
  handoff validate [ID] [--loose] [--json] Schema validation (v3 strict; --loose for hook use)
  handoff list [--limit N] [--json]       List recent handoffs sorted by last_updated

Tasks subcommands:
  list <session-dir>   Print the '## Tasks' block for a workstream
  lint <path>          Lint a file or directory (schema auto-detected from the path)

Exit codes:
  0  success
  1  user error (bad subcommand / bad option)
  2  dependency or environment error
`);
}

// --- Main async dispatcher ---

async function main() {
  const verb = process.argv[2];

  // --- Help / version (before anything else) ---
  if (verb === '--help' || verb === '-h') {
    printHelp(process.stdout);
    process.exit(0);
  }

  if (verb === '--version' || verb === '-v') {
    process.stdout.write(`${CMD} ${VERSION}\n`);
    process.exit(0);
  }

  // --- Reject unknown flags starting with '-' ---
  if (typeof verb === 'string' && verb.startsWith('-')) {
    process.stderr.write(`ERROR: unknown option: ${verb}\n\n`);
    printHelp(process.stderr);
    process.exit(1);
  }

  // --- No args ---
  if (!verb) {
    process.stderr.write(`ERROR: no subcommand\n\n`);
    printHelp(process.stderr);
    process.exit(1);
  }

  // --- Route to verb group sub-modules ---
  // Dynamic import so each verb group loads on demand (and so stubs are
  // concrete modules that later steps can replace in place).
  const remaining = process.argv.slice(3);

  switch (verb) {
    case 'handoff': {
      const mod = await import('./handoff.mjs');
      await mod.dispatch(remaining);
      break;
    }
    case 'pickup': {
      const mod = await import('./pickup.mjs');
      await mod.dispatch(remaining);
      break;
    }
    case 'register': {
      const mod = await import('./register.mjs');
      await mod.dispatch(remaining);
      break;
    }
    case 'cat-sessions': {
      const mod = await import('./cat-sessions.mjs');
      await mod.dispatch(remaining);
      break;
    }
    case 'rewrite-pointer': {
      const mod = await import('./rewrite-pointer.mjs');
      await mod.dispatch(remaining);
      break;
    }
    case 'tasks': {
      const mod = await import('./tasks.mjs');
      await mod.dispatch(remaining);
      break;
    }
    case 'epics': {
      const mod = await import('./epics.mjs');
      await mod.dispatch(remaining);
      break;
    }
    default:
      process.stderr.write(`ERROR: unknown subcommand: ${verb}\n\n`);
      printHelp(process.stderr);
      process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(`${err.stack ?? err.message}\n`);
  process.exit(2);
});
