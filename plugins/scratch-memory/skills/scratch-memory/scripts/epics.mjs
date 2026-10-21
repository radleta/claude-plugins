#!/usr/bin/env node
// epics.mjs — CLI verb group for the epic/spike graph over the issues corpus
//
// Two subcommands:
//   frontier <epic-slug>  the ready spikes of an epic, one bare slug per line
//   graph <epic-slug>     the epic's whole member graph — decision work and
//                         build work in blocker layers, plus cycles, external
//                         blockers and progress
//
// This module is a THIN DISPATCH (D15). It carries no graph logic of its own:
// readiness comes from tasks.mjs's `frontierSpikes`, and every layer, cycle
// and count `graph` prints comes from its `buildEpicReport`, the same pure
// traversal the graph lint rules run on — so these verbs and 'tasks lint' can
// never disagree. What lives here is the I/O those pure functions refuse to do
// — resolving the corpus directory and reading it — plus the CLI surface and
// the text formatting.
//
// Exports:
//   dispatch(argv)   — `epics frontier` / `epics graph` CLI entry point
//
// Wired into scratch-memory.mjs's verb switch as one `case 'epics'`, the same
// one-case, one-dynamic-import shape the other six verb groups use.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveProjectRoot } from './handoff.mjs';
import {
  EXIT,
  ISSUE_SLUG_PATTERN,
  buildEpicGraph,
  buildEpicReport,
  buildIssueIndex,
  frontierSpikes,
  readIssuesCorpus,
} from './tasks.mjs';

const EPICS_HELP = `Usage: scratch-memory epics <subcommand> [options]

Inspect the epic/spike graph in the scratch/issues/ corpus. Readiness is
computed by the same pure traversal the graph lint rules use, so this verb and
'tasks lint' can never disagree about which spikes are workable.

Subcommands:
  frontier <epic-slug>   Write the epic's ready spikes, one bare slug per line:
                          every spike carrying 'role: spike' and that epic
                          slug, with 'status: open', whose 'blocked_by' slugs
                          all resolve to an issue anywhere in the corpus at a
                          settled status ('wont-fix', 'fixed', 'accepted',
                          'moved' or 'settled' --
                          'deferred' acknowledges without deciding, so it
                          still blocks). A blocker that resolves to nothing
                          counts as unsettled, so a typo fails closed and never
                          promotes work into the ready list ('tasks lint'
                          reports it as an E1 finding at edit time).

  graph <epic-slug>      Write the epic's whole member graph: its own line,
                          then 'decisions' (the spike members) and 'build'
                          (everything else) with each member under its blocker
                          layer -- layer 0 has no open blocker -- then any
                          external blockers, blocked_by cycles and blockers
                          that resolve to nothing, and a closing progress
                          count. Members in a cycle have no layer and are
                          listed under 'cycles'.

                          The text form is for a person: its headings and
                          indentation are framing, not data, and they are not
                          a stable interface. Parse '--json' instead.

                          Options: --json (emit the machine shape), --open-only
                          (hide members whose status is not 'open').

Arguments:
  epic-slug     The slug of a file in scratch/issues/ carrying 'role: epic'.
                The corpus directory is derived from the project root, never
                from this argument, and the slug must match the corpus slug
                charset: lowercase alphanumerics and inner hyphens.

Options:
  -h, --help    Show this help.
  --            Stop flag parsing; the next token is the positional argument.

Output:
  'frontier' writes ready spike slugs to stdout, one per line, sorted. An epic
  whose open spikes are all blocked writes nothing and exits 0 -- that is a
  clean state, not an error. 'frontier' has no --json: its output is one bare
  slug per line, which pipes already, so a flag would buy nothing. The
  asymmetry with 'graph' is deliberate.

  'graph' writes its report to stdout. Errors go to stderr: ERROR: <message>.

Exit codes:
  0  success (including an epic with no ready spikes)
  1  user error (bad subcommand/option, malformed slug, or no such epic)
  2  infrastructure error (FS read failure)
`;

// Parse a single positional argument plus a declared flag set, honoring `--`
// as a stop-flags token. Mirrors tasks.mjs's helper rather than importing it:
// that one is module-private there. With no `flags` the behavior is exactly
// the original's, which is what keeps `frontier` unchanged.
function parseSinglePositional(argv, { flags = [] } = {}) {
  let stopFlags = false;
  let positional = null;
  const seen = new Set();
  for (const a of argv) {
    if (!stopFlags && a === '--') { stopFlags = true; continue; }
    if (!stopFlags && a.startsWith('-')) {
      if (!flags.includes(a)) {
        return { positional: null, flags: seen, error: `unknown option: ${a}` };
      }
      seen.add(a);
      continue;
    }
    if (positional !== null) {
      return { positional: null, flags: seen, error: 'too many positional arguments' };
    }
    positional = a;
  }
  return { positional, flags: seen, error: null };
}

// `dispatch` honors -h/--help only as the group's FIRST token, so without this
// `epics graph --help` reaches the flag parser and dies as an unknown option.
// Both verbs get it: the hole is the same one and they should not differ here.
function wroteSubcommandHelp(argv) {
  if (!argv.includes('-h') && !argv.includes('--help')) return false;
  process.stdout.write(EPICS_HELP);
  process.exitCode = EXIT.SUCCESS;
  return true;
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

// epics frontier <epic-slug>
async function cmdFrontier(argv) {
  if (wroteSubcommandHelp(argv)) return;
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
  const corpus = readIssuesCorpus(issuesDir);
  const graph = buildEpicGraph(positional, corpus);

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
  const ready = frontierSpikes(graph, buildIssueIndex(corpus));
  if (ready.length > 0) {
    process.stdout.write(ready.join('\n') + '\n');
  }
  process.exitCode = EXIT.SUCCESS;
}


// The text form of one member row. Settled members are shown rather than
// hidden, and the bracketed status is what marks them.
function memberLine(member, kindKey) {
  const parts = [`${member.slug} [${member.status ?? 'unknown'}]`];
  if (member[kindKey] !== null && member[kindKey] !== undefined) parts.push(`${kindKey}: ${member[kindKey]}`);
  if (member.blocked_by.length > 0) parts.push(`blocked_by: ${member.blocked_by.join(',')}`);
  return parts.join('  ');
}

// `decisions` and `build` always print -- with `(none)` when empty -- so the
// split between deciding and building stays visible. Every other section is
// omitted when it has nothing in it.
function renderLayeredSection(lines, heading, layers, kindKey) {
  lines.push(`${heading}:`);
  const populated = layers.some((layer) => layer.length > 0);
  if (!populated) {
    lines.push('  (none)');
    return;
  }
  layers.forEach((layer, depth) => {
    if (layer.length === 0) return;
    lines.push(`  layer ${depth}:`);
    for (const member of layer) lines.push(`    ${memberLine(member, kindKey)}`);
  });
}

function renderReport(report) {
  const lines = [];
  const epicBlockers = report.epic.blocked_by.length === 0
    ? 'none'
    : report.epic.blocked_by.map((b) => `${b.slug} [${b.status ?? 'unresolvable'}]`).join(', ');
  lines.push(`${report.epic.slug} [${report.epic.status}] ${report.epic.title}`);
  lines.push(`blocked_by: ${epicBlockers}`);
  lines.push('');

  renderLayeredSection(lines, 'decisions', report.decisions, 'spike_type');
  renderLayeredSection(lines, 'build', report.build, 'kind');

  if (report.external.length > 0) {
    lines.push('external blockers:');
    for (const blocker of report.external) {
      const where = blocker.epic.length > 0 ? blocker.epic.join(',') : 'none';
      lines.push(`  ${blocker.slug} [${blocker.status ?? 'unknown'}]  epic: ${where}`);
    }
  }
  if (report.cycles.length > 0) {
    lines.push('cycles:');
    for (const cycle of report.cycles) lines.push(`  ${cycle.join(' -> ')}`);
  }
  if (report.unresolvable.length > 0) {
    lines.push('unresolvable blockers:');
    for (const edge of report.unresolvable) lines.push(`  ${edge.slug} -> ${edge.target}`);
  }

  lines.push(`progress: ${report.progress.closed}/${report.progress.total} members closed`);
  return lines.join('\n') + '\n';
}

// --open-only is presentation: it hides members, never recomputes the layers
// they sit in, and never touches the progress count -- an epic's progress is
// the whole membership or it is not progress.
function hideClosedMembers(report) {
  const openOnly = (layers) => layers.map((layer) => layer.filter((m) => m.status === 'open'));
  return { ...report, decisions: openOnly(report.decisions), build: openOnly(report.build) };
}

// epics graph <epic-slug> [--json] [--open-only]
async function cmdGraph(argv) {
  if (wroteSubcommandHelp(argv)) return;

  const { positional, flags, error } = parseSinglePositional(argv, { flags: ['--json', '--open-only'] });
  if (error) {
    process.stderr.write(`ERROR: ${error}\n`);
    process.exit(EXIT.USER_ERROR);
  }
  if (positional === null) {
    process.stderr.write('ERROR: missing <epic-slug>\n');
    process.exit(EXIT.USER_ERROR);
  }

  const issuesDir = resolveCorpus(positional);
  const index = buildIssueIndex(readIssuesCorpus(issuesDir));
  let report = buildEpicReport(positional, index);

  // Same fail-closed reasoning as `frontier`: a slug naming no epic is a
  // mistyped argument, and an empty report would read as "nothing to do".
  if (report.epic.status === null) {
    process.stderr.write(`ERROR: no such epic: ${positional} (no file in ${issuesDir} carries role: epic with that slug)\n`);
    process.exit(EXIT.USER_ERROR);
  }

  if (flags.has('--open-only')) report = hideClosedMembers(report);

  // Single buffered write, then process.exitCode rather than process.exit():
  // exiting here can terminate before stdout flushes on a pipe.
  process.stdout.write(flags.has('--json')
    ? `${JSON.stringify(report, null, 2)}\n`
    : renderReport(report));
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
    case 'graph':
      await cmdGraph(subArgv);
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
