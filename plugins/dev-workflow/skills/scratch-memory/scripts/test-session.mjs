#!/usr/bin/env node
// test-session.mjs — Tests for session.mjs: lintSession's eight checks and its warning
// tier on fixture workstreams, and the `session lint`, `mark-groomed`, `close` and
// `mark-event-groomed` CLI through the real scratch-memory.mjs dispatcher.
// Usage: node test-session.mjs   (exit 0 on all-pass)

import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync, lstatSync, symlinkSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import process from 'node:process';

import { lintSession, sessionRadius, SESSION_CHECKS, SESSION_WARNINGS } from './session.mjs';
import { writeGroomMarker, readGroomMarker, readEventMarks, writeEventMarks, TASKS_METHODOLOGY_VERSION } from './tasks.mjs';
import { questionId, questionKernel, assembleSessions } from './cat-sessions.mjs';
import { createAnchorFixture, createFixture } from './test-fixtures.mjs';
import { runCli } from './test-driver.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-session.mjs\n\nRuns session.mjs tests (TS group). Exit 0 on all-pass, 1 otherwise.\n');
  process.exit(0);
}
if (argv.length > 0) {
  process.stderr.write(`Unexpected argument: ${argv[0]}\n`);
  process.exit(1);
}

let passCount = 0;
let failCount = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passCount++;
    process.stdout.write(`PASS: ${name}\n`);
  } catch (err) {
    failCount++;
    process.stdout.write(`FAIL: ${name}\n`);
    const frames = (err.stack ?? String(err)).split('\n').slice(1, 4).join('\n');
    process.stderr.write(`  ${err.message}\n${frames}\n`);
  }
}

process.on('uncaughtException', (err) => {
  process.stderr.write(`HARNESS-ERROR: ${err.message}\n`);
  process.stdout.write('0 passed, 1 failed\n');
  process.exit(1);
});

const DONE = 'Done when: `node test-x.mjs` exits 0';

// A workstream fixture under a sandboxed scratch root. `task()` writes a valid task
// file unless overrides remove or change keys; `session()` writes a session file
// whose body holds the given open-question bullets.
function workstream(slug = 'ws') {
  const fx = createAnchorFixture();
  const dir = join(fx.scratchDir, `S-${slug}`);
  mkdirSync(join(dir, 'tasks'), { recursive: true });
  let n = 0;
  function task(id, fields = {}, body = DONE) {
    const fm = { id, title: '"A task"', status: 'open', created: '2026-09-01T00:00:00.000Z', updated: '2026-09-01T00:00:00.000Z', ...fields };
    const lines = ['---', ...Object.entries(fm).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`), '---', ''];
    const name = `${id}-a-task.md`;
    writeFileSync(join(dir, 'tasks', name), lines.join('\n') + body + '\n', 'utf-8');
    return name;
  }
  function session({ raised = [], resolved = [], extra = '' } = {}) {
    mkdirSync(join(dir, 'sessions'), { recursive: true });
    n++;
    const name = `2026-09-0${n}T00-00-00-000Z-0000000${n}.md`;
    const body = [
      '---', `session_id: ${slug}`, '---', '',
      '## Open questions raised', ...raised.map((q) => `- ${q}`), '',
      '## Open questions resolved', ...resolved.map((q) => `- ${q}`), '',
      extra, '',
    ].join('\n');
    writeFileSync(join(dir, 'sessions', name), body, 'utf-8');
    return name;
  }
  return { fx, dir, task, session };
}

const checksOf = (result) => result.findings.map((f) => f.check);

(async () => {

  await runTest('TS1: a workstream with no task files and no marker reports version-behind alone, and the marker clears it', () => {
    const { fx, dir, session } = workstream();
    try {
      session({ raised: ['Is this still open?'] });
      let r = lintSession(dir);
      deepStrictEqual(checksOf(r), ['version-behind']);
      strictEqual(r.data_problems, 0);
      strictEqual(r.version_behind, true);
      strictEqual(r.marker_version, null);
      strictEqual(r.methodology_version, TASKS_METHODOLOGY_VERSION);

      writeGroomMarker(dir);
      r = lintSession(dir);
      deepStrictEqual(r.findings, []);
      strictEqual(r.data_problems, 0);
      strictEqual(r.version_behind, false);
      strictEqual(r.marker_version, TASKS_METHODOLOGY_VERSION);
    } finally { fx.cleanup(); }
  });

  await runTest('TS2: a conforming workstream with a current marker has no findings', () => {
    const { fx, dir, task, session } = workstream();
    try {
      const q = 'Which root wins?';
      task('t-aaaaa1');
      task('t-aaaaa2', { status: 'blocked', blocked_on: `"answer to ${questionId(questionKernel(q))}"` });
      task('t-aaaaa3', { status: 'done' }, 'No outcome line needed once closed');
      session({ raised: [q, 'Ship it?'], resolved: ['Ship it? → RESOLVED: closed — moved to task t-aaaaa1'] });
      writeGroomMarker(dir);
      const r = lintSession(dir);
      deepStrictEqual(r.findings, [], JSON.stringify(r.findings));
      strictEqual(r.version_behind, false);
      strictEqual(r.marker_version, TASKS_METHODOLOGY_VERSION);
    } finally { fx.cleanup(); }
  });

  await runTest('TS3: task-warn reuses the tasks lint rules, one finding per problem', () => {
    const { fx, dir, task } = workstream();
    try {
      const name = task('t-bbbbb1', { status: 'wontdo', updated: undefined });
      writeGroomMarker(dir);
      const r = lintSession(dir);
      const warns = r.findings.filter((f) => f.check === 'task-warn');
      deepStrictEqual(warns.map((f) => f.file), [name, name]);
      ok(warns.some((f) => f.message === 'missing required key: updated'), JSON.stringify(warns));
      ok(warns.some((f) => f.message.startsWith('invalid status: wontdo')), JSON.stringify(warns));
    } finally { fx.cleanup(); }
  });

  await runTest('TS4: missing-done-when fires for open and blocked tasks only, and a leading blank line is tolerated', () => {
    const { fx, dir, task } = workstream();
    try {
      const open = task('t-ccccc1', {}, 'Just prose');
      const blocked = task('t-ccccc2', { status: 'blocked', blocked_on: '"go-ahead"' }, '');
      task('t-ccccc3', { status: 'done' }, 'Just prose');
      task('t-ccccc4', {}, `\n\n${DONE}`);
      writeGroomMarker(dir);
      const r = lintSession(dir);
      deepStrictEqual(r.findings.map((f) => [f.check, f.file]), [['missing-done-when', open], ['missing-done-when', blocked]]);
    } finally { fx.cleanup(); }
  });

  await runTest('TS5: blocked-without-blocked-on fires for a blocked task with no or an empty blocked_on', () => {
    const { fx, dir, task } = workstream();
    try {
      const none = task('t-ddddd1', { status: 'blocked' });
      const empty = task('t-ddddd2', { status: 'blocked', blocked_on: '""' });
      task('t-ddddd3', { status: 'open' });
      writeGroomMarker(dir);
      deepStrictEqual(lintSession(dir).findings.map((f) => [f.check, f.file]),
        [['blocked-without-blocked-on', none], ['blocked-without-blocked-on', empty]]);
    } finally { fx.cleanup(); }
  });

  await runTest('TS6: promoted-to-missing fires only when scratch/issues/<slug>.md does not exist', () => {
    const { fx, dir, task } = workstream();
    try {
      mkdirSync(join(fx.scratchDir, 'issues'), { recursive: true });
      writeFileSync(join(fx.scratchDir, 'issues', 'real-issue.md'), '---\n---\n', 'utf-8');
      task('t-eeeee1', { status: 'promoted', promoted_to: 'real-issue' });
      const gone = task('t-eeeee2', { status: 'promoted', promoted_to: 'deleted-issue' });
      writeGroomMarker(dir);
      const r = lintSession(dir);
      deepStrictEqual(r.findings.map((f) => [f.check, f.file]), [['promoted-to-missing', gone]]);
      ok(r.findings[0].message.includes('scratch/issues/deleted-issue.md'), r.findings[0].message);
    } finally { fx.cleanup(); }
  });

  await runTest('TS7: moved-to-missing-task fires per session reference to a task id with no file', () => {
    const { fx, dir, task, session } = workstream();
    try {
      task('t-fffff1');
      const s = session({ resolved: ['q-000000 → RESOLVED: closed — moved to task t-fffff1', 'Old? → RESOLVED: closed — moved to task t-fffff9'] });
      writeGroomMarker(dir);
      const r = lintSession(dir);
      deepStrictEqual(r.findings.map((f) => [f.check, f.file]), [['moved-to-missing-task', s]]);
      ok(r.findings[0].message.includes('t-fffff9'), r.findings[0].message);
    } finally { fx.cleanup(); }
  });

  await runTest('TS8: open-question-moved fires for a still-open question whose text says moved to task', () => {
    const { fx, dir, task, session } = workstream();
    try {
      task('t-11111a');
      const s = session({ raised: ['Should the lint run at handoff? → moved to task t-11111a', 'Unrelated?'] });
      writeGroomMarker(dir);
      const r = lintSession(dir);
      deepStrictEqual(r.findings.map((f) => [f.check, f.file]), [['open-question-moved', s]]);
      ok(r.findings[0].message.startsWith(questionId(questionKernel('Should the lint run at handoff?'))), r.findings[0].message);
    } finally { fx.cleanup(); }
  });

  await runTest('TS9: blocked-on-closed-question fires when blocked_on names a q-id that is not still open', () => {
    const { fx, dir, task, session } = workstream();
    try {
      const openQ = 'Is A still undecided?';
      const closedQ = 'Was B decided?';
      const openId = questionId(questionKernel(openQ));
      const closedId = questionId(questionKernel(closedQ));
      session({ raised: [openQ, closedQ] });
      session({ resolved: [`${closedId} → RESOLVED: yes`] });
      task('t-22222a', { status: 'blocked', blocked_on: `"${openId}"` });
      const stale = task('t-22222b', { status: 'blocked', blocked_on: `"${closedId}"` });
      writeGroomMarker(dir);
      const r = lintSession(dir);
      deepStrictEqual(r.findings.map((f) => [f.check, f.file]), [['blocked-on-closed-question', stale]]);
      ok(r.findings[0].message.includes(closedId), r.findings[0].message);
    } finally { fx.cleanup(); }
  });

  await runTest('TS10: version-behind fires with file "-" when task files exist and the marker is absent or unparseable, and data_problems excludes it', () => {
    const { fx, dir, task } = workstream();
    try {
      task('t-33333a', {}, 'No outcome line');
      let r = lintSession(dir);
      deepStrictEqual(checksOf(r), ['missing-done-when', 'version-behind']);
      strictEqual(r.data_problems, 1);
      strictEqual(r.version_behind, true);
      strictEqual(r.marker_version, null);
      deepStrictEqual(r.findings[1], { check: 'version-behind', file: '-', message: `task methodology v${TASKS_METHODOLOGY_VERSION} is newer than this workstream's missing marker` });

      writeFileSync(join(dir, 'groom.yaml'), 'methodology_version: nope\n', 'utf-8');
      r = lintSession(dir);
      strictEqual(r.version_behind, true, 'an unparseable marker counts as missing');

      writeGroomMarker(dir);
      r = lintSession(dir);
      strictEqual(r.version_behind, false);
      deepStrictEqual(checksOf(r), ['missing-done-when']);
    } finally { fx.cleanup(); }
  });

  await runTest('TS11: every emitted check name is one of SESSION_CHECKS', () => {
    deepStrictEqual(SESSION_CHECKS, ['task-warn', 'missing-done-when', 'blocked-without-blocked-on', 'promoted-to-missing',
      'moved-to-missing-task', 'open-question-moved', 'blocked-on-closed-question', 'version-behind']);
  });

  await runTest('TS12: `session lint` prints <check>: <file>: <message> lines and exits 1 on findings, exits 0 silently when clean', () => {
    const { fx, dir, task } = workstream();
    try {
      const name = task('t-44444a', { status: 'blocked' }, 'prose');
      let res = runCli(['session', 'lint', dir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, res.stderr);
      strictEqual(res.stderr, '');
      deepStrictEqual(res.stdout.split('\n'), [
        `missing-done-when: ${name}: blocked task body does not open with "Done when:"`,
        `blocked-without-blocked-on: ${name}: status: blocked with no blocked_on`,
        `version-behind: -: task methodology v${TASKS_METHODOLOGY_VERSION} is newer than this workstream's missing marker`,
        '',
      ]);

      task('t-44444a', { status: 'blocked', blocked_on: '"go-ahead"' });
      writeGroomMarker(dir);
      res = runCli(['session', 'lint', dir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, res.stdout + res.stderr);
      strictEqual(res.stdout, '');
    } finally { fx.cleanup(); }
  });

  await runTest('TS13: `session lint` user errors exit 1 on stderr: missing arg, unknown option, out of sandbox, not a directory, unknown subcommand', () => {
    const fx = createAnchorFixture();
    try {
      for (const args of [['session', 'lint'], ['session', 'lint', '--bogus'], ['session', 'lint', '/tmp'], ['session', 'lint', join(fx.scratchDir, 'S-nope')], ['session', 'frobnicate'], ['session']]) {
        const res = runCli(args, { cwd: fx.projectRoot });
        strictEqual(res.exitCode, 1, `${args.join(' ')} → ${res.exitCode}`);
        strictEqual(res.stdout, '', `${args.join(' ')} stdout empty`);
        ok(res.stderr.includes('ERROR:'), `${args.join(' ')} stderr: ${res.stderr}`);
      }
    } finally { fx.cleanup(); }
  });

  await runTest('TS14: `session lint` exits 2 when a task file cannot be read', () => {
    if (process.getuid && process.getuid() === 0) throw new Error('TS14 cannot force a read failure as root');
    const { fx, dir, task } = workstream();
    const path = () => join(dir, 'tasks', 't-55555a-a-task.md');
    try {
      task('t-55555a');
      chmodSync(path(), 0o000);
      const res = runCli(['session', 'lint', dir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 2, res.stdout + res.stderr);
      ok(res.stderr.includes('ERROR:'), res.stderr);
    } finally {
      try { chmodSync(path(), 0o644); } catch {}
      fx.cleanup();
    }
  });

  await runTest('TS15: `session mark-groomed` writes the marker, prints its path, and clears version-behind', () => {
    const { fx, dir, task } = workstream();
    try {
      task('t-66666a');
      strictEqual(runCli(['session', 'lint', dir], { cwd: fx.projectRoot }).exitCode, 1);
      const res = runCli(['session', 'mark-groomed', dir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, res.stderr);
      strictEqual(res.stdout, `${join(dir, 'groom.yaml')}\n`);
      ok(readFileSync(join(dir, 'groom.yaml'), 'utf-8').startsWith(`methodology_version: ${TASKS_METHODOLOGY_VERSION}\ngroomed: `));
      const after = runCli(['session', 'lint', dir], { cwd: fx.projectRoot });
      strictEqual(after.exitCode, 0, after.stdout);
    } finally { fx.cleanup(); }
  });

  await runTest('TS16: `session mark-groomed` exits 1 on a user error and 2 on a write failure', () => {
    if (process.getuid && process.getuid() === 0) throw new Error('TS16 cannot force a write failure as root');
    const { fx, dir } = workstream();
    try {
      const missing = runCli(['session', 'mark-groomed'], { cwd: fx.projectRoot });
      strictEqual(missing.exitCode, 1);
      chmodSync(dir, 0o555);
      const res = runCli(['session', 'mark-groomed', dir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 2, res.stdout + res.stderr);
      strictEqual(res.stdout, '');
      ok(!existsSync(join(dir, 'groom.yaml')));
    } finally {
      try { chmodSync(dir, 0o755); } catch {}
      fx.cleanup();
    }
  });

  await runTest('TS17: a malformed promoted_to is a promoted-to-missing finding that never echoes the value or probes the path', () => {
    const { fx, dir, task } = workstream();
    try {
      writeGroomMarker(dir);
      task('t-77777a', { status: 'promoted', promoted_to: '../../outside' });
      const found = lintSession(dir).findings.filter((f) => f.check === 'promoted-to-missing');
      deepStrictEqual(found, [{ check: 'promoted-to-missing', file: 't-77777a-a-task.md', message: 'promoted_to is malformed: not an issue slug' }]);
    } finally { fx.cleanup(); }
  });

  await runTest('TS18: `session mark-groomed` rejects a folder not named S-<id> and a symlink that resolves outside scratch/', () => {
    const { fx } = workstream();
    try {
      const plain = join(fx.scratchDir, 'not-a-workstream');
      mkdirSync(plain);
      const bad = runCli(['session', 'mark-groomed', plain], { cwd: fx.projectRoot });
      strictEqual(bad.exitCode, 1, bad.stdout + bad.stderr);
      ok(!existsSync(join(plain, 'groom.yaml')));

      const outside = join(fx.projectRoot, 'outside');
      mkdirSync(outside);
      symlinkSync(outside, join(fx.scratchDir, 'S-linked'));
      const linked = runCli(['session', 'mark-groomed', join(fx.scratchDir, 'S-linked')], { cwd: fx.projectRoot });
      strictEqual(linked.exitCode, 1, linked.stdout + linked.stderr);
      ok(linked.stderr.includes('OUT_OF_SANDBOX_PATH'), linked.stderr);
      ok(!existsSync(join(outside, 'groom.yaml')), 'no marker written through the symlink');
    } finally { fx.cleanup(); }
  });

  const qid = (text) => questionId(questionKernel(text));
  const RUN = '2026-09-01T12:00:00.000Z';
  const closeArgs = (dir, id, over = {}) => {
    const flags = { '--kind': 'answered', '--cite': 'abc1234', '--quote-file': '-', '--event': 'pickup', '--run': RUN, ...over };
    return ['session', 'close', dir, id, ...Object.entries(flags).filter(([, v]) => v !== undefined).flat()];
  };

  await runTest('TS19: `session close` appends one line under the run heading, prints it, and regenerates HANDOFF.md without the question', () => {
    const { fx, dir, session } = workstream();
    try {
      session({ raised: ['Is A decided?', 'Is B decided?', 'Is C decided?'] });
      const [a, b, c] = ['Is A decided?', 'Is B decided?', 'Is C decided?'].map(qid);
      const first = runCli(closeArgs(dir, a), { cwd: fx.projectRoot, input: 'the fix landed\nin one commit\n' });
      strictEqual(first.exitCode, 0, first.stderr);
      const lineA = `- ${a} → RESOLVED: closed — answered: abc1234 — "the fix landed in one commit"`;
      strictEqual(first.stdout, lineA + '\n');
      strictEqual(readFileSync(join(dir, 'groom-closes.md'), 'utf-8'), `## pickup ${RUN}\n${lineA}\n`);
      const pointer = readFileSync(join(dir, 'HANDOFF.md'), 'utf-8');
      ok(!pointer.includes(a) && pointer.includes(b), 'pointer drops the closed question and keeps the open one');
      deepStrictEqual(assembleSessions(dir).still_open_questions.map((q) => q.id).sort(), [b, c].sort());

      const quoteFile = join(fx.projectRoot, 'quote.txt');
      writeFileSync(quoteFile, 'tracked there', 'utf-8');
      const second = runCli(closeArgs(dir, b, { '--kind': 'tracked', '--cite': 'tasks/t-aaaaaa-a-task.md', '--quote-file': quoteFile }), { cwd: fx.projectRoot });
      strictEqual(second.exitCode, 0, second.stderr);
      const third = runCli(closeArgs(dir, c, { '--kind': 'moot', '--event': 'groom', '--run': '2026-09-01T13:00:00Z' }), { cwd: fx.projectRoot, input: 'gone' });
      strictEqual(third.exitCode, 0, third.stderr);
      deepStrictEqual(readFileSync(join(dir, 'groom-closes.md'), 'utf-8').split('\n'), [
        `## pickup ${RUN}`, lineA, `- ${b} → RESOLVED: closed — tracked: tasks/t-aaaaaa-a-task.md — "tracked there"`,
        '', '## groom 2026-09-01T13:00:00Z', `- ${c} → RESOLVED: closed — moot: abc1234 — "gone"`, '',
      ], 'one heading per run');
      deepStrictEqual(assembleSessions(dir).still_open_questions, []);

      session({ raised: ['Is A decided?'] });
      deepStrictEqual(assembleSessions(dir).still_open_questions.map((q) => q.id), [a], 'a later raise brings it back');
    } finally { fx.cleanup(); }
  });

  await runTest('TS20: `session close` refuses, exit 1 and nothing written, on each bad argument', () => {
    const { fx, dir, session } = workstream();
    try {
      session({ raised: ['Is A decided?', 'Was B decided?'] });
      session({ resolved: [`${qid('Was B decided?')} → RESOLVED: yes`] });
      const a = qid('Is A decided?');
      const cases = [
        ['bad id', closeArgs(dir, 'q-12'), 'x'],
        ['not still open', closeArgs(dir, qid('Was B decided?')), 'x'],
        ['unknown id', closeArgs(dir, 'q-000000'), 'x'],
        ['bad kind', closeArgs(dir, a, { '--kind': 'done' }), 'x'],
        ['bad run', closeArgs(dir, a, { '--run': 'yesterday' }), 'x'],
        ['local-time run', closeArgs(dir, a, { '--run': '2026-09-05T00:00:00' }), 'x'],
        ['empty quote', closeArgs(dir, a), '  \n'],
        ['long quote', closeArgs(dir, a), 'x'.repeat(201)],
        ['missing cite', closeArgs(dir, a, { '--cite': undefined }), 'x'],
        ['bad event', closeArgs(dir, a, { '--event': 'two words' }), 'x'],
        ['unknown flag', [...closeArgs(dir, a), '--force'], 'x'],
        ['no id', ['session', 'close', dir], 'x'],
      ];
      for (const [label, args, input] of cases) {
        const res = runCli(args, { cwd: fx.projectRoot, input });
        strictEqual(res.exitCode, 1, `${label}: exit ${res.exitCode} ${res.stderr}`);
        ok(res.stderr.includes('ERROR:') && res.stdout === '', `${label}: ${res.stderr}`);
      }
      ok(!existsSync(join(dir, 'groom-closes.md')) && !existsSync(join(dir, 'HANDOFF.md')), 'nothing written');
      const ok200 = runCli(closeArgs(dir, a), { cwd: fx.projectRoot, input: 'x'.repeat(200) });
      strictEqual(ok200.exitCode, 0, ok200.stderr);

      const plain = join(fx.scratchDir, 'not-a-workstream');
      mkdirSync(plain);
      strictEqual(runCli(closeArgs(plain, a), { cwd: fx.projectRoot, input: 'x' }).exitCode, 1, 'a folder not named S-<id>');
    } finally { fx.cleanup(); }
  });

  await runTest('TS21: `session close` refuses an id two questions share, and a workstream with no session files', () => {
    const { fx, dir, session } = workstream();
    try {
      mkdirSync(join(dir, 'sessions'), { recursive: true });
      strictEqual(runCli(closeArgs(dir, 'q-abcdef'), { cwd: fx.projectRoot, input: 'x' }).exitCode, 1, 'no session files');

      // A q- id is 24 bits, so two questions that share one turn up within a few thousand tries.
      const seen = new Map();
      let pair = null;
      for (let i = 0; pair === null; i++) {
        const text = `Is option ${i} the one?`;
        if (seen.has(qid(text))) pair = [seen.get(qid(text)), text];
        seen.set(qid(text), text);
      }
      session({ raised: pair });
      const res = runCli(closeArgs(dir, qid(pair[0])), { cwd: fx.projectRoot, input: 'x' });
      strictEqual(res.exitCode, 1, res.stdout + res.stderr);
      ok(res.stderr.includes('more than one question'), res.stderr);
      ok(!existsSync(join(dir, 'groom-closes.md')));
    } finally { fx.cleanup(); }
  });

  await runTest('TS22: `session close` exits 2 with the line standing when the pointer cannot be regenerated', () => {
    if (process.getuid && process.getuid() === 0) throw new Error('TS22 cannot force a write failure as root');
    const { fx, dir, session } = workstream();
    try {
      session({ raised: ['Is A decided?'] });
      mkdirSync(join(dir, 'HANDOFF.md'));
      writeFileSync(join(dir, 'HANDOFF.md', 'blocker'), '', 'utf-8');
      const res = runCli(closeArgs(dir, qid('Is A decided?')), { cwd: fx.projectRoot, input: 'x' });
      strictEqual(res.exitCode, 2, res.stdout + res.stderr);
      ok(res.stderr.includes('rewrite-pointer'), res.stderr);
      ok(readFileSync(join(dir, 'groom-closes.md'), 'utf-8').includes(qid('Is A decided?')), 'the line stands');
    } finally { fx.cleanup(); }
  });

  await runTest('TS23: `session mark-event-groomed` stores the marks and remainder beside the groom keys, and `mark-groomed` keeps them', () => {
    const { fx, dir } = workstream();
    try {
      const args = ['session', 'mark-event-groomed', dir, '--code', 'abc1234', '--scratch', 'def5678abc', '--session', '2026-09-01T00-00-00-000Z-00000001.md'];
      let res = runCli([...args, '--remainder', 'q-aaaaaa=abc1234,t-bbbbbb=2026-09-01T00-00-00-000Z-00000001.md'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, res.stderr);
      strictEqual(res.stdout, `${join(dir, 'groom.yaml')}\n`);
      strictEqual(readGroomMarker(dir), null, 'a never-groomed workstream still has no groom marker');
      deepStrictEqual(readEventMarks(dir), { code: 'abc1234', scratch: 'def5678abc', session: '2026-09-01T00-00-00-000Z-00000001.md',
        remainder: [{ id: 'q-aaaaaa', ref: 'abc1234' }, { id: 't-bbbbbb', ref: '2026-09-01T00-00-00-000Z-00000001.md' }] });

      strictEqual(runCli(['session', 'mark-groomed', dir], { cwd: fx.projectRoot }).exitCode, 0);
      const groomed = readGroomMarker(dir);
      strictEqual(groomed.methodology_version, TASKS_METHODOLOGY_VERSION);
      strictEqual(readEventMarks(dir).remainder.length, 2, 'mark-groomed keeps the event keys');

      res = runCli(args, { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, res.stderr);
      deepStrictEqual(readEventMarks(dir).remainder, [], 'an absent --remainder stores an empty list');
      deepStrictEqual(readGroomMarker(dir), groomed, 'methodology_version and groomed are left as they are');
      ok(/^event_remainder: $/m.test(readFileSync(join(dir, 'groom.yaml'), 'utf-8')));
    } finally { fx.cleanup(); }
  });

  await runTest('TS24: `session mark-event-groomed` exits 1 on a user error and 2 on a write failure', () => {
    if (process.getuid && process.getuid() === 0) throw new Error('TS24 cannot force a write failure as root');
    const { fx, dir } = workstream();
    try {
      const good = ['--code', 'abc1234', '--scratch', 'def5678', '--session', 'a.md'];
      const swap = (flag, value) => good.map((v, i) => (good[i - 1] === flag ? value : v));
      for (const flags of [good.slice(2), swap('--code', 'HEAD'), swap('--scratch', 'nope'), swap('--session', '../x.md'),
        [...good, '--remainder', 'q-aaaaaa'], [...good, '--remainder', 'x-aaaaaa=abc1234'], [...good, '--remainder', 'q-aaaaaa=not a ref']]) {
        const res = runCli(['session', 'mark-event-groomed', dir, ...flags], { cwd: fx.projectRoot });
        strictEqual(res.exitCode, 1, `${flags.join(' ')} → ${res.exitCode} ${res.stderr}`);
      }
      ok(!existsSync(join(dir, 'groom.yaml')));
      chmodSync(dir, 0o555);
      const res = runCli(['session', 'mark-event-groomed', dir, ...good], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 2, res.stdout + res.stderr);
    } finally {
      try { chmodSync(dir, 0o755); } catch {}
      fx.cleanup();
    }
  });

  await runTest('TS25: question-shape warns on the newest session file only, names each fault, and stays out of findings, data_problems and the exit code', () => {
    const { fx, dir, session } = workstream();
    try {
      session({ raised: ['An old bullet with no mark'] });
      const newest = session({ raised: [
        'Is this one well formed? settles when: the user rules',
        'A recorded decision with no mark, settles when: never',
        'Is it A? Or is it B? settles when: the user picks',
        'Is the clause missing?',
        'none',
      ] });
      writeGroomMarker(dir);
      const r = lintSession(dir);
      deepStrictEqual(SESSION_WARNINGS, ['question-shape']);
      deepStrictEqual(r.findings, []);
      strictEqual(r.data_problems, 0);
      deepStrictEqual(r.warnings.map((w) => [w.check, w.file, w.message.split(':')[0]]), [
        ['question-shape', newest, 'no "?"'],
        ['question-shape', newest, 'more than one "?"'],
        ['question-shape', newest, 'no "settles when'],
      ]);
      const res = runCli(['session', 'lint', dir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, 'warnings alone exit 0');
      strictEqual(res.stdout.split('\n').filter(Boolean).length, 3);
      ok(res.stdout.startsWith(`question-shape: ${newest}: no "?": A recorded decision`), res.stdout);
      const brief = runCli(['cat-sessions', dir, '--with-tasks'], { cwd: fx.projectRoot });
      ok(!brief.stdout.includes('GROOM:'), 'a warning is not counted into the data GROOM line');
    } finally { fx.cleanup(); }
  });

  await runTest('TS26: with findings, `session lint` prints the warnings after them and still exits 1', () => {
    const { fx, dir, task, session } = workstream();
    try {
      const name = task('t-88888a', {}, 'No outcome line');
      session({ raised: ['No mark here'] });
      writeGroomMarker(dir);
      const res = runCli(['session', 'lint', dir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1);
      const lines = res.stdout.split('\n').filter(Boolean);
      ok(lines[0].startsWith(`missing-done-when: ${name}`) && lines[1].startsWith('question-shape: '), res.stdout);
    } finally { fx.cleanup(); }
  });

  await runTest('TS27: a tracked ledger close naming a missing task is moved-to-missing-task, and the task it names is exempt from blocked-on-closed-question', () => {
    const { fx, dir, task, session } = workstream();
    try {
      const [qa, qb, qc] = ['Is A owed? settles when: x', 'Is B owed? settles when: x', 'Is C owed? settles when: x'];
      session({ raised: [qa, qb, qc] });
      const waiting = task('t-99999a', { status: 'blocked', blocked_on: `"${qid(qa)}"` });
      const other = task('t-99999b', { status: 'blocked', blocked_on: `"${qid(qa)}"` });
      writeGroomMarker(dir);
      const close = (q, cite) => strictEqual(runCli(closeArgs(dir, qid(q), { '--kind': 'tracked', '--cite': cite }), { cwd: fx.projectRoot, input: 'owed' }).exitCode, 0);
      close(qa, `tasks/${waiting}`);
      close(qb, 'tasks/t-fffff0-gone.md');
      close(qc, 'scratch/issues/some-issue.md');
      const r = lintSession(dir);
      deepStrictEqual(r.findings.map((f) => [f.check, f.file]), [
        ['moved-to-missing-task', 'groom-closes.md'],
        ['blocked-on-closed-question', other],
      ]);
      ok(r.findings[0].message.includes('t-fffff0') && r.findings[0].message.includes(qid(qb)), r.findings[0].message);
    } finally { fx.cleanup(); }
  });

  // A code repo with scratch/ as its own nested repo, as this project lays them out, holding
  // one workstream; `inPlace` leaves scratch/ tracked by the code repo instead.
  // `commit(repo, file, subject)` writes and commits one file.
  function gitWorkstream(slug = 'ws', { inPlace = false, sub = '' } = {}) {
    const fx = createFixture();
    const code = join(fx.projectRoot, sub);
    const scratch = join(code, 'scratch');
    const dir = join(scratch, `S-${slug}`);
    mkdirSync(join(dir, 'tasks'), { recursive: true });
    mkdirSync(join(dir, 'sessions'), { recursive: true });
    const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!inPlace) {
      run(scratch, 'init', '--quiet');
      run(scratch, 'config', 'user.email', 'test@example.com');
      run(scratch, 'config', 'user.name', 'Test User');
    }
    let n = 0;
    function commit(repo, file, subject, date) {
      mkdirSync(dirname(join(repo, file)), { recursive: true });
      writeFileSync(join(repo, file), `${++n}\n`, 'utf-8');
      run(repo, 'add', '--', file);
      const env = { ...process.env, ...(date && { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }) };
      execFileSync('git', ['commit', '--quiet', '-m', subject], { cwd: repo, env, stdio: 'ignore' });
      return run(repo, 'rev-parse', 'HEAD');
    }
    function session(day, sections = {}) {
      const name = `2026-09-${day}T00-00-00-000Z-000000${day}.md`;
      const body = ['---', `session_id: ${slug}`, '---', '', ...Object.entries(sections).flatMap(([h, bullets]) => [`## ${h}`, ...bullets.map((b) => `- ${b}`), ''])].join('\n');
      writeFileSync(join(dir, 'sessions', name), body, 'utf-8');
      return name;
    }
    function task(id, body, fields = {}) {
      const fm = { id, title: '"A task"', status: 'open', created: '2026-09-01T00:00:00.000Z', updated: '2026-09-01T00:00:00.000Z', ...fields };
      writeFileSync(join(dir, 'tasks', `${id}-a-task.md`), ['---', ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`), '---', '', body, ''].join('\n'), 'utf-8');
    }
    commit(scratch, 'README.md', 'init scratch', '2026-08-01T00:00:00Z');
    const radius = (extra = [], cwd = code) => {
      const res = runCli(['session', 'radius', dir, '--json', ...extra], { cwd });
      if (res.exitCode !== 0) throw new Error(`radius exit ${res.exitCode}: ${res.stderr}`);
      return JSON.parse(res.stdout);
    };
    const stamp = (r, remainder) => {
      const res = runCli(['session', 'mark-event-groomed', dir, '--code', r.marks.code, '--scratch', r.marks.scratch, '--session', r.marks.session,
        ...(remainder ? ['--remainder', remainder] : [])], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, res.stderr);
    };
    return { fx, dir, scratch, code, run, commit, session, task, radius, stamp };
  }
  const idsOf = (r) => r.pending.map((row) => row.id);

  await runTest('TS28: with no stamp, `session radius` reads the newest session file and the commits dated since the one before it, and prints the marks from both repos with the cwd inside scratch/', () => {
    const w = gitWorkstream();
    try {
      const qPhrase = 'Does the frobnicator widget rotate clockwise?';
      w.session('01', { 'Open questions raised': [qPhrase, 'Is the old thing untouched?', 'Does `src/early.mjs` need a guard?', 'Does `src/late.mjs` need a guard?'] });
      const newest = w.session('03', { 'Decisions made': ['The frobnicator widget rotate direction is settled', 't-aaaaaa is unblocked'] });
      w.task('t-aaaaaa', DONE);
      w.task('t-bbbbbb', DONE + '\n\nSave point 2026-09-02: /brainstorming x — step 2\n\nt-aaaaaa waits on this');
      w.task('t-cccccc', DONE, { status: 'done' });
      w.commit(w.code, 'src/early.mjs', 'before the previous session', '2026-08-15T00:00:00Z');
      const late = w.commit(w.code, 'src/late.mjs', 'after the previous session', '2026-09-02T00:00:00Z');

      const r = w.radius([], w.scratch);
      deepStrictEqual(r.marks, { code: w.run(w.code, 'rev-parse', 'HEAD'), scratch: w.run(w.scratch, 'rev-parse', 'HEAD'), session: newest });
      ok(!isNaN(Date.parse(r.run)) && r.run.endsWith('Z'), r.run);
      deepStrictEqual(r.pending.map((row) => [row.id, row.kind, row.by, row.ref]), [
        ['t-aaaaaa', 'task', 'id', newest],
        [qid(qPhrase), 'question', 'phrase', newest],
        [qid('Does `src/late.mjs` need a guard?'), 'question', 'path', late],
      ], 'id, then phrase, then path; the save point, the done task, the untouched question and the early commit are left out');
      strictEqual(r.pending[0].evidence, 't-aaaaaa is unblocked');
      strictEqual(r.pending[2].evidence, 'src/late.mjs');
      deepStrictEqual(r.past_cap, []);
      ok(!existsSync(join(w.dir, 'groom.yaml')), 'read-only');

      const text = runCli(['session', 'radius', w.dir], { cwd: w.code }).stdout.split('\n');
      deepStrictEqual(text.slice(1, 6), [`code: ${r.marks.code}`, `scratch: ${r.marks.scratch}`, `session: ${newest}`, 'pending: 3', `t-aaaaaa | task | id | ${newest} | t-aaaaaa is unblocked`]);
      ok(text[0].startsWith('run: '));
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS29: after a stamp nothing new is `pending: none`, whatever remainder is stored; new evidence is every commit reachable since the stamp, outside the workstream folder and lane records', () => {
    const w = gitWorkstream();
    try {
      const q = 'Does `src/a.mjs` need a guard?';
      w.session('01', { 'Open questions raised': [q, 'Does `docs/b.md` say so?', 'Is the remainder row kept?'] });
      const first = w.radius();
      const rem = qid('Is the remainder row kept?');
      w.stamp(first, `${rem}=${first.marks.session}`);

      let r = w.radius();
      deepStrictEqual(r.pending, [], 'a stored remainder alone dispatches nothing');
      strictEqual(runCli(['session', 'radius', w.dir], { cwd: w.code }).stdout.split('\n')[4], 'pending: none');

      // The groom's own kind of commit: the workstream folder, groom.yaml and a lane record.
      w.commit(w.scratch, 'S-ws/notes.md', `groom ${qid(q)}`);
      w.commit(w.scratch, 'L-some-lane/README.md', `record ${qid(q)}`);
      r = w.radius();
      deepStrictEqual(r.pending, [], 'own-folder and lane-record commits are never evidence');
      ok(r.marks.scratch !== first.marks.scratch, 'the scratch mark still moves');

      // An old-dated commit that only now became reachable is read; a merge commit is not itself evidence.
      w.run(w.code, 'checkout', '--quiet', '-b', 'side');
      const old = w.commit(w.code, 'src/a.mjs', 'side work', '2020-01-01T00:00:00Z');
      w.run(w.code, 'checkout', '--quiet', '-');
      execFileSync('git', ['merge', '--quiet', '--no-ff', '-m', `merge side ${qid('Does `docs/b.md` say so?')}`, 'side'], { cwd: w.code, stdio: 'ignore' });
      const filed = w.commit(w.scratch, 'issues/new-issue.md', 'file an issue nothing names');
      r = w.radius();
      deepStrictEqual(r.pending.map((row) => [row.id, row.by, row.ref]), [[rem, 'remainder', first.marks.session], [qid(q), 'path', old]]);
      ok(!('evidence' in r.pending[0]), 'a session reference that no longer nominates the row prints no evidence line');
      ok(filed);

      w.stamp(r);
      deepStrictEqual(w.radius().pending, [], 'an event straight after a run dispatches nothing');
      const later = w.session('02', { Done: [`${qid(q)} checked`] });
      deepStrictEqual(w.radius().pending.map((row) => [row.id, row.by, row.ref]), [[qid(q), 'id', later]], 'a session file named later than the stored one is evidence');
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS30: a remainder row carries its stored reference and that reference\'s evidence line; one that no longer resolves has none; a closed row is dropped; new evidence that nominates nothing still dispatches on the remainder', () => {
    const w = gitWorkstream();
    try {
      const [qa, qb, qc] = ['Does `src/a.mjs` need a guard?', 'Is B kept?', 'Is C closed?'];
      const s1 = w.session('01', { 'Open questions raised': [qa, qb, qc], Done: [`${qid(qb)} looked at`] });
      const sha = w.commit(w.code, 'src/a.mjs', 'touch a');
      const r0 = w.radius();
      w.stamp(r0, `${qid(qa)}=${sha},${qid(qb)}=${s1},${qid(qc)}=${s1},t-dddddd=deadbeef,${qid('Is B kept?')}=${'0'.repeat(40)}`);
      w.session('02', { 'Open questions resolved': [`${qid(qc)} → RESOLVED: yes`] });

      const r = w.radius();
      deepStrictEqual(r.pending.map((row) => [row.id, row.by, row.ref, row.evidence]), [
        [qid(qa), 'remainder', sha, 'src/a.mjs'],
        [qid(qb), 'remainder', s1, `${qid(qb)} looked at`],
      ]);

      w.stamp(r, `${qid(qa)}=${'0'.repeat(40)},${qid(qb)}=gone.md`);
      w.commit(w.code, 'other/file.txt', 'unrelated work');
      const r2 = w.radius();
      deepStrictEqual(r2.pending.map((row) => [row.id, row.by, 'evidence' in row]), [[qid(qa), 'remainder', false], [qid(qb), 'remainder', false]]);

      // A hand-edited groom.yaml: a stored reference that is not a sha or a bare file name is dropped unread.
      writeFileSync(join(w.fx.projectRoot, 'outside.md'), `## Done\n- ${qid(qa)} SECRET\n`, 'utf-8');
      const yaml = join(w.dir, 'groom.yaml');
      writeFileSync(yaml, readFileSync(yaml, 'utf-8').replace(/^event_remainder: .*$/m, `event_remainder: ${qid(qa)}=../../../outside.md,${qid(qb)}=$(id).md`), 'utf-8');
      const r3 = runCli(['session', 'radius', w.dir, '--json'], { cwd: w.code });
      strictEqual(r3.exitCode, 0, r3.stderr);
      ok(!r3.stdout.includes('SECRET') && !r3.stdout.includes('outside.md') && !r3.stdout.includes('$(id)'), r3.stdout);
      // runCli keeps stderr only on a failure, so the warning is read from a direct spawn.
      const warn = spawnSync('node', [new URL('./scratch-memory.mjs', import.meta.url).pathname, 'session', 'radius', w.dir], { cwd: w.code, encoding: 'utf-8' }).stderr;
      ok(warn.startsWith('WARN: ') && warn.includes(qid(qa)) && warn.includes(qid(qb)) && !warn.includes('outside.md'), warn);
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS31: the cap keeps a pair together and lists the rows past it with their references; a question carries its newest still-open mark', () => {
    const w = gitWorkstream();
    try {
      const qs = Array.from({ length: 4 }, (_, i) => `Is item ${i} done?`);
      w.session('01', { 'Open questions raised': qs });
      w.session('02', { 'Open questions resolved': [`${qid(qs[0])} → STILL OPEN: waiting on the user`] });
      w.task('t-aaaaaa', DONE);
      w.task('t-bbbbbb', `${DONE}\n\nPairs with ${qid(qs[3])}`);
      const newest = w.session('03', { Done: [`t-aaaaaa t-bbbbbb ${qs.map(qid).join(' ')} all seen`] });

      const all = w.radius();
      deepStrictEqual(idsOf(all), ['t-aaaaaa', 't-bbbbbb', qid(qs[3]), ...[qs[0], qs[1], qs[2]].map(qid).sort()], 'the pair sits together at the stronger member; equal rows keep id order');
      const marked = all.pending.find((row) => row.id === qid(qs[0]));
      ok(marked.still_open.text.includes('waiting on the user') && marked.still_open.date, JSON.stringify(marked));
      ok(!('still_open' in all.pending.find((row) => row.id === qid(qs[1]))));

      const capped = w.radius(['--cap', '2']);
      deepStrictEqual(idsOf(capped), ['t-aaaaaa', 't-bbbbbb', qid(qs[3])], 'the cap never splits a pair');
      deepStrictEqual(capped.past_cap.map((x) => x.ref), [newest, newest, newest]);
      strictEqual(capped.past_cap.length + capped.pending.length, 6);
      const text = runCli(['session', 'radius', w.dir, '--cap', '2'], { cwd: w.code }).stdout;
      ok(text.includes(`past cap:\n${capped.past_cap[0].id}=${newest}\n`), text);
      ok(text.includes('  still-open mark ') === false, 'the marked row is past the cap');
      strictEqual(w.radius(['--cap', '1']).pending.length, 1);

      // A unit of three: a task naming two questions is never cut after the first of them.
      w.task('t-bbbbbb', `${DONE}\n\nPairs with ${qid(qs[3])} and ${qid(qs[1])}`);
      const three = w.radius(['--cap', '3']);
      deepStrictEqual(idsOf(three).slice(1).sort(), ['t-bbbbbb', qid(qs[3]), qid(qs[1])].sort(), 'the cap keeps all three');
      strictEqual(three.past_cap.length, 2);
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS32: `session radius` exits 2 on a git failure, 1 on a user error, and treats a stored commit that no longer resolves as no stamp', () => {
    const w = gitWorkstream();
    try {
      w.session('01', { 'Open questions raised': ['Is A done?'], Done: [`${qid('Is A done?')} seen`] });
      const r = w.radius();
      for (const args of [[w.dir, '--cap', '0'], [w.dir, '--cap', 'x'], [w.dir, '--bogus'], [], [join(w.scratch, 'S-nope')]]) {
        strictEqual(runCli(['session', 'radius', ...args], { cwd: w.code }).exitCode, 1, args.join(' '));
      }
      runCli(['session', 'mark-event-groomed', w.dir, '--code', '0'.repeat(40), '--scratch', r.marks.scratch, '--session', r.marks.session], { cwd: w.code });
      deepStrictEqual(idsOf(w.radius()), [qid('Is A done?')], 'an unresolvable stored commit reads as a first run');

      rmSync(join(w.scratch, '.git'), { recursive: true, force: true });
      writeFileSync(join(w.scratch, '.git'), 'gitdir: /nonexistent\n', 'utf-8');
      const res = runCli(['session', 'radius', w.dir], { cwd: w.code });
      strictEqual(res.exitCode, 2, res.stdout + res.stderr);
      strictEqual(res.stdout, '', 'a git failure never reads as "pending: none"');
      ok(res.stderr.includes('ERROR:'), res.stderr);
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS33: with scratch/ tracked in place by the code repo, a commit to the workstream folder or a lane record is not evidence and a commit is read once', () => {
    const w = gitWorkstream('ws', { inPlace: true });
    try {
      const q = 'Does `src/a.mjs` need a guard?';
      w.session('01', { 'Open questions raised': [q, 'Is the remainder row kept?'] });
      const first = w.radius();
      strictEqual(first.marks.scratch, first.marks.code);
      w.stamp(first, `${qid('Is the remainder row kept?')}=${first.marks.session}`);

      w.commit(w.scratch, 'S-ws/notes.md', `groom ${qid(q)}`);
      w.commit(w.scratch, 'L-some-lane/README.md', `record ${qid(q)}`);
      deepStrictEqual(w.radius().pending, [], 'the groom\'s own commits dispatch nothing on a stored remainder');

      const sha = w.commit(w.code, 'src/a.mjs', 'touch a');
      deepStrictEqual(w.radius().pending.map((row) => [row.id, row.by, row.ref]), [[qid('Is the remainder row kept?'), 'remainder', first.marks.session], [qid(q), 'path', sha]]);
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS34: a unit of rows that are not neighbours by rank stays whole under the cap; a sessions/ file with a name write_session could not produce is not read', () => {
    const w = gitWorkstream();
    try {
      const q = 'Is the shared question settled?';
      w.session('01', { 'Open questions raised': [q] });
      w.task('t-aaaaaa', `${DONE}\n\nNames ${qid(q)}`);
      w.task('t-bbbbbb', DONE);
      w.task('t-cccccc', `${DONE}\n\nAlso names ${qid(q)}`);
      const newest = w.session('02', { Done: [`t-aaaaaa t-bbbbbb t-cccccc ${qid(q)} all seen`] });
      writeFileSync(join(w.dir, 'sessions', '2026-09-09T00-00-00-000Z-$(id).md'), `---\nsession_id: ws\n---\n\n## Done\n- ${qid(q)} PLANTED\n`, 'utf-8');

      const r = w.radius(['--cap', '2']);
      deepStrictEqual(idsOf(r), ['t-aaaaaa', qid(q), 't-cccccc'], 'the question brings its second task inside the cut');
      deepStrictEqual(r.past_cap, [{ id: 't-bbbbbb', ref: newest }]);
      strictEqual(r.marks.session, newest);
      ok(!JSON.stringify(r).includes('$(id)') && !JSON.stringify(r).includes('PLANTED'));
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS35: with the code repo below its git root and scratch/ tracked in place, the workstream folder and lane records are still not evidence and a path still nominates', () => {
    const w = gitWorkstream('ws', { inPlace: true, sub: 'sub' });
    try {
      const q = 'Does `src/a.mjs` need a guard?';
      w.session('01', { 'Open questions raised': [q, 'Is the remainder row kept?'] });
      // The CLI's project root is the git root, so this layout is reached through the function.
      const first = sessionRadius(w.dir);
      writeEventMarks(w.dir, { ...first.marks, remainder: [{ id: qid('Is the remainder row kept?'), ref: first.marks.session }] });

      w.commit(w.scratch, 'S-ws/notes.md', `groom ${qid(q)}`);
      w.commit(w.scratch, 'L-some-lane/README.md', `record ${qid(q)}`);
      w.commit(w.fx.projectRoot, 'elsewhere/src/a.mjs', 'outside the code repo');
      deepStrictEqual(sessionRadius(w.dir).pending, []);

      const sha = w.commit(w.code, 'src/a.mjs', 'touch a');
      deepStrictEqual(sessionRadius(w.dir).pending.map((row) => [row.id, row.by, row.ref, row.evidence]).slice(1), [[qid(q), 'path', sha, 'src/a.mjs']]);
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS36: `session close` calls that overlap each keep their line, and the pointer lists none of the closed questions', async () => {
    const { fx, dir, session } = workstream();
    try {
      const qs = Array.from({ length: 6 }, (_, i) => `Is item ${i} decided?`);
      session({ raised: qs });
      const cli = new URL('./scratch-memory.mjs', import.meta.url).pathname;
      const codes = await Promise.all(qs.map((text) => new Promise((resolve) => {
        const child = spawn('node', [cli, ...closeArgs(dir, qid(text))], { cwd: fx.projectRoot, stdio: ['pipe', 'ignore', 'ignore'] });
        child.stdin.end('settled');
        child.on('close', resolve);
      })));
      deepStrictEqual(codes, qs.map(() => 0));
      const ledger = readFileSync(join(dir, 'groom-closes.md'), 'utf-8');
      strictEqual(ledger.split('\n').filter((l) => l.startsWith('- q-')).length, 6, ledger);
      strictEqual(ledger.split('\n').filter((l) => l.startsWith('## ')).length, 1, ledger);
      const pointer = readFileSync(join(dir, 'HANDOFF.md'), 'utf-8');
      ok(qs.every((text) => !pointer.includes(qid(text))), pointer);
      ok(!existsSync(join(dir, 'groom-closes.md.lock')), 'the lock is released');
    } finally { fx.cleanup(); }
  });

  await runTest('TS37: `session close`, `mark-groomed` and `mark-event-groomed` refuse a ledger or marker that is a symlink, and copy nothing of its target', () => {
    const { fx, dir, session } = workstream();
    try {
      session({ raised: ['Is A decided?'] });
      const outside = join(fx.projectRoot, 'outside.txt');
      writeFileSync(outside, 'secret_key: PLANTED\n', 'utf-8');
      for (const [name, argv, input] of [
        ['groom-closes.md', closeArgs(dir, qid('Is A decided?')), 'settled'],
        ['groom.yaml', ['session', 'mark-groomed', dir]],
        ['groom.yaml', ['session', 'mark-event-groomed', dir, '--code', 'abc1234', '--scratch', 'abc1234', '--session', 'a.md']],
      ]) {
        const link = join(dir, name);
        rmSync(link, { force: true });
        symlinkSync(outside, link);
        const res = runCli(argv, { cwd: fx.projectRoot, input });
        strictEqual(res.exitCode, 1, `${argv[1]}: ${res.stdout}${res.stderr}`);
        ok(res.stderr.includes('OUT_OF_SANDBOX_PATH'), res.stderr);
        ok(lstatSync(link).isSymbolicLink(), `${argv[1]} left the link as it was`);
        strictEqual(readFileSync(outside, 'utf-8'), 'secret_key: PLANTED\n');
      }
    } finally { fx.cleanup(); }
  });

  await runTest('TS38: `session radius` holds a stored stamp to what the verb writes, reads a commit whose subject or path carries odd bytes, and makes no row of an oddly named task file', () => {
    const w = gitWorkstream();
    try {
      const q = 'Is A done?';
      w.session('01', { 'Open questions raised': [q], Done: [`${qid(q)} seen`] });
      const first = w.radius();
      w.stamp(first);
      deepStrictEqual(w.radius().pending, []);

      // The groom's own folder under a non-ASCII name, and a subject carrying the record separator.
      w.commit(w.scratch, 'S-ws/n\u00f6tes.md', `groom ${qid(q)}`);
      deepStrictEqual(w.radius().pending, [], 'a non-ASCII path under the workstream folder is still its own');
      const odd = w.commit(w.code, 'src/x.mjs', `split\x1e${qid(q)} here`);
      deepStrictEqual(w.radius().pending.map((row) => [row.id, row.by, row.ref]), [[qid(q), 'id', odd]]);

      writeFileSync(join(w.dir, 'tasks', "t-aaaaaa-$(id)'.md"), `---\nid: t-aaaaaa\ntitle: "x"\nstatus: open\n---\n\n${DONE}\n${qid(q)}\n`, 'utf-8');
      ok(!JSON.stringify(w.radius()).includes('$(id)'));

      const yaml = join(w.dir, 'groom.yaml');
      const stamped = readFileSync(yaml, 'utf-8');
      writeFileSync(yaml, stamped.replace(/^event_code: .*$/m, 'event_code: HEAD').replace(/^event_scratch: .*$/m, 'event_scratch: HEAD'), 'utf-8');
      deepStrictEqual(idsOf(w.radius()), [qid(q)], '`HEAD` as a stored commit reads as no stamp, not as an empty range');
      writeFileSync(yaml, stamped.replace(/^event_session: .*$/m, 'event_session: 9999-never-written.md'), 'utf-8');
      deepStrictEqual(idsOf(w.radius()), [qid(q)], 'a stored session name no file carries reads as no stamp');
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS40: a question raised or marked in an oddly named session file puts no such name in the output; a quoted own-folder path is still own; a stored remainder commit nominates by a non-ASCII path', () => {
    const w = gitWorkstream();
    try {
      const [q, qOdd, qPath] = ['Is A done?', 'Is the odd one done?', 'Does `src/n\u00f6te.mjs` need a guard?'];
      w.session('01', { 'Open questions raised': [q, qPath] });
      const oddName = "2026-09-02T00-00-00-000Z-$(id)'.md";
      writeFileSync(join(w.dir, 'sessions', oddName), `---\nsession_id: ws\n---\n\n## Open questions raised\n- ${qOdd}\n\n## Open questions resolved\n- ${qid(q)} \u2192 STILL OPEN: waiting\n`, 'utf-8');
      const newest = w.session('03', { Done: [`${qid(q)} ${qid(qOdd)} seen`] });
      const sha = w.commit(w.code, 'src/n\u00f6te.mjs', 'touch it');
      const first = w.radius();
      ok(!JSON.stringify(first).includes('$(id)'), JSON.stringify(first));
      ok(!idsOf(first).includes(qid(qOdd)), 'a question raised in an oddly named session file makes no row');
      deepStrictEqual(Object.keys(first.pending.find((row) => row.id === qid(q)).still_open).sort(), ['date', 'text']);

      w.stamp(first, `${qid(qPath)}=${sha}`);
      w.commit(w.scratch, 'S-ws/a"b.md', `groom ${qid(q)}`);
      deepStrictEqual(w.radius().pending, [], 'a C-quoted path under the workstream folder is still its own');
      w.session('04', { Done: ['nothing that names a row'] });
      deepStrictEqual(w.radius().pending.map((row) => [row.id, row.by, row.evidence]), [[qid(qPath), 'remainder', 'src/n\u00f6te.mjs']]);
      ok(newest);
    } finally { w.fx.cleanup(); }
  });

  await runTest('TS39: two `session close` calls on one id that overlap write one line, and one is refused', async () => {
    const { fx, dir, session } = workstream();
    try {
      session({ raised: ['Is A decided?'] });
      const cli = new URL('./scratch-memory.mjs', import.meta.url).pathname;
      const codes = await Promise.all([0, 1, 2].map(() => new Promise((resolve) => {
        const child = spawn('node', [cli, ...closeArgs(dir, qid('Is A decided?'))], { cwd: fx.projectRoot, stdio: ['pipe', 'ignore', 'ignore'] });
        child.stdin.end('settled');
        child.on('close', resolve);
      })));
      deepStrictEqual(codes.sort(), [0, 1, 1]);
      strictEqual(readFileSync(join(dir, 'groom-closes.md'), 'utf-8').split('\n').filter((l) => l.startsWith('- q-')).length, 1);
      ok(!existsSync(join(dir, 'groom-closes.md.lock')), 'a refused close releases the lock');
    } finally { fx.cleanup(); }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
