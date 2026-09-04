#!/usr/bin/env node
// epics.mjs — CLI verb group for the epic/spike graph over the issues corpus
//
// One subcommand: `epics frontier <epic-slug>`, which writes the ready spikes
// of an epic — open, and with every blocker resolved — one bare slug per line.
//
// This module is a THIN DISPATCH (D15). It carries no graph logic of its own:
// readiness is decided entirely by tasks.mjs's `frontierSpikes(buildEpicGraph(
// slug, files))`, the same pure traversal the Tier 2a graph rules run on, so
// the frontier and the lint can never disagree about what "ready" means. What
// lives here is the I/O those pure functions refuse to do — resolving the
// corpus directory and reading it — plus the CLI surface.
//
// Exports:
//   dispatch(argv)   — `epics frontier` CLI entry point
//
// Wired into scratch-memory.mjs's verb switch as one `case 'epics'`, the same
// one-case, one-dynamic-import shape the other six verb groups use.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveProjectRoot } from './handoff.mjs';
import { EXIT, ISSUE_SLUG_PATTERN, buildEpicGraph, frontierSpikes } from './tasks.mjs';

const EPICS_HELP = `Usage: scratch-memory epics <subcommand> [options]

Inspect the epic/spike graph in the scratch/issues/ corpus. Readiness is
computed by the same pure traversal the graph lint rules use, so this verb and
'tasks lint' can never disagree about which spikes are workable.

Subcommands:
  frontier <epic-slug>   Write the epic's ready spikes, one bare slug per line:
                          every spike carrying 'role: spike' and that epic
                          slug, with 'status: open', whose 'blocked_by' slugs
                          all resolve to spikes with 'status: resolved'. A
                          blocker that resolves to nothing counts as
                          unresolved, so a typo fails closed and never
                          promotes work into the ready list ('tasks lint'
                          reports it as an E1 finding at edit time).

Arguments:
  epic-slug     The slug of a file in scratch/issues/ carrying 'role: epic'.
                The corpus directory is derived from the project root, never
                from this argument, and the slug must match the corpus slug
                charset: lowercase alphanumerics and inner hyphens.

Options:
  -h, --help    Show this help.
  --            Stop flag parsing; the next token is the positional argument.

Output:
  ready spike slugs go to stdout, one per line, sorted. An epic whose open
  spikes are all blocked writes nothing and exits 0 -- that is a clean state,
  not an error. Errors go to stderr: ERROR: <message>.

Exit codes:
  0  success (including an epic with no ready spikes)
  1  user error (bad subcommand/option, malformed slug, or no such epic)
  2  infrastructure error (FS read failure)
`;

// Parse a single positional argument, honoring `--` as a stop-flags token.
// Mirrors tasks.mjs:871 rather than importing it: that helper is module-
// private there, and `frontier` has the same shape -- exactly one positional
// and no flags of its own besides `--`.
function parseSinglePositional(argv) {
  let stopFlags = false;
  let positional = null;
  for (const a of argv) {
    if (!stopFlags && a === '--') { stopFlags = true; continue; }
    if (!stopFlags && a.startsWith('-')) {
      return { positional: null, error: `unknown option: ${a}` };
    }
    if (positional !== null) {
      return { positional: null, error: 'too many positional arguments' };
    }
    positional = a;
  }
  return { positional, error: null };
}

// The scratch-sandbox guard for a verb whose argument is a SLUG, not a path.
// `tasks list` and `tasks lint` contain a caller-supplied path with
// resolveInScratchSandbox (tasks.mjs:893); here there is no path to contain --
// the corpus directory is built from the project root, and the slug never
// reaches the filesystem. The equivalent guard is therefore the charset:
// ISSUE_SLUG_PATTERN admits lowercase alphanumerics and inner hyphens only, so
// a separator or a `..` segment is a user error before anything is read.
// Exits USER_ERROR on failure, so callers can treat the return as resolved.
function resolveCorpus(slug) {
  if (!ISSUE_SLUG_PATTERN.test(slug)) {
    process.stderr.write(
      `ERROR: MALFORMED_SLUG: epic-slug must match the corpus slug charset\n` +
      `  expected: lowercase alphanumerics and inner hyphens\n` +
      `  received: ${slug}\n`
    );
    process.exit(EXIT.USER_ERROR);
  }

  let projectRoot;
  try {
    projectRoot = resolveProjectRoot();
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.USER_ERROR);
  }

  return join(projectRoot, 'scratch', 'issues');
}

// Read the issues corpus as the `{path, content}` set buildEpicGraph takes.
// Every `*.md` is handed over rather than pre-filtered by frontmatter: the
// pure traversal already decides membership, and doing it here would be the
// second implementation of that predicate this module exists to avoid.
//
// A missing corpus directory returns the empty set rather than failing --
// the epic cannot exist in a corpus that does not exist, so it falls through
// to the same "no such epic" error a mistyped slug gets.
function readIssuesCorpus(dir) {
  let entryNames;
  try {
    entryNames = readdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }

  const files = [];
  for (const name of entryNames.filter((n) => n.endsWith('.md')).sort()) {
    const fullPath = join(dir, name);
    try {
      // Encoding is load-bearing: without it readFileSync returns a Buffer,
      // and the graph's helpers are string operations that throw on one.
      files.push({ path: fullPath, content: readFileSync(fullPath, 'utf-8') });
    } catch (err) {
      // A file listed and then removed before its read is a race, not a
      // finding -- tasks.mjs's sibling read tolerates the same ENOENT for the
      // same reason. Anything else is genuine trouble and stays loud.
      if (err.code === 'ENOENT') continue;
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }
  }
  return files;
}

// epics frontier <epic-slug>
async function cmdFrontier(argv) {
  const { positional, error } = parseSinglePositional(argv);
  if (error) {
    process.stderr.write(`ERROR: ${error}\n`);
    process.exit(EXIT.USER_ERROR);
  }
  if (positional === null) {
    process.stderr.write('ERROR: missing <epic-slug>\n');
    process.exit(EXIT.USER_ERROR);
  }

  const issuesDir = resolveCorpus(positional);
  const graph = buildEpicGraph(positional, readIssuesCorpus(issuesDir));

  // A slug naming no epic is a mistyped argument, and staying silent about it
  // would report "nothing to work on" for work that exists -- the same
  // fail-closed reasoning that makes an unresolvable blocker count as blocked.
  // An epic whose spikes are merely all blocked is the empty-and-clean case
  // below, and is never routed here.
  if (graph.epic === null) {
    process.stderr.write(`ERROR: no such epic: ${positional} (no file in ${issuesDir} carries role: epic with that slug)\n`);
    process.exit(EXIT.USER_ERROR);
  }

  // Single buffered write, then process.exitCode rather than process.exit():
  // exiting here can terminate before stdout flushes on a pipe, which is the
  // discipline `tasks lint` follows for the same reason.
  const ready = frontierSpikes(graph);
  if (ready.length > 0) {
    process.stdout.write(ready.join('\n') + '\n');
  }
  process.exitCode = EXIT.SUCCESS;
}

// dispatch — top-level router for the `epics` verb group.
export async function dispatch(argv) {
  const verb = argv[0];

  if (verb === '-h' || verb === '--help') {
    process.stdout.write(EPICS_HELP);
    process.exit(EXIT.SUCCESS);
  }

  if (!verb) {
    process.stderr.write('ERROR: missing subcommand\n\n');
    process.stderr.write(EPICS_HELP);
    process.exit(EXIT.USER_ERROR);
  }

  const subArgv = argv.slice(1);

  switch (verb) {
    case 'frontier':
      await cmdFrontier(subArgv);
      break;
    default:
      process.stderr.write(`ERROR: unknown epics subcommand: ${verb}\n\n`);
      process.stderr.write(EPICS_HELP);
      process.exit(EXIT.USER_ERROR);
  }
}

export default dispatch;

// ---------------------------------------------------------------------------
// Entry-point guard — forward to dispatch() on direct invocation (`node
// epics.mjs ...`), not just when imported by scratch-memory.mjs. Without
// this, direct invocation silently exits 0 with no output (issue:
// verb-modules-silent-noop-direct-invocation).
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch(err => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(2);
  });
}
