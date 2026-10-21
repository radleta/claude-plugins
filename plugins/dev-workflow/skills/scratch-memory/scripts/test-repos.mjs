#!/usr/bin/env node
// test-repos.mjs — Tests for repos.mjs: the three-level repos config and the `repos` verbs,
// through the real scratch-memory.mjs dispatcher.
// Usage: node test-repos.mjs   (exit 0 on all-pass)

import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { createFixture } from './test-fixtures.mjs';
import { runCli, CLI_PATH } from './test-driver.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-repos.mjs\n\nRuns repos.mjs tests (TR group). Exit 0 on all-pass, 1 otherwise.\n');
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

// Every test gets its own user-level config dir, so none touches the real one.
function env() {
  const dir = mkdtempSync(join(tmpdir(), 'smcp-repos-cfg-'));
  return { dir, env: { ...process.env, SCRATCH_MEMORY_CONFIG_DIR: dir } };
}

function repos(args, { env: e, cwd }) {
  return runCli(['repos', ...args], { env: e, cwd });
}

function listJson(opts) {
  const r = repos(['list', '--json'], opts);
  strictEqual(r.exitCode, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const real = (p) => realpathSync(p);

await runTest('TR1: no repos file at any level lists [] and exits 0; owner prints nothing', () => {
  const fx = createFixture();
  const { env: e } = env();
  deepStrictEqual(listJson({ env: e, cwd: fx.projectRoot }), []);
  const o = repos(['owner', fx.projectRoot], { env: e, cwd: fx.projectRoot });
  strictEqual(o.exitCode, 0);
  strictEqual(o.stdout, '');
  const oj = repos(['owner', fx.projectRoot, '--json'], { env: e, cwd: fx.projectRoot });
  strictEqual(oj.stdout.trim(), 'null');
  fx.cleanup();
});

await runTest('TR2: add is an idempotent upsert storing the realpath, accepts and description', () => {
  const fx = createFixture();
  const other = createFixture();
  const { dir, env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  const a1 = repos(['add', 'first', other.projectRoot, '--accepts', 'issues,docs', '--user'], opts);
  strictEqual(a1.exitCode, 0, a1.stderr);
  const a2 = repos(['add', 'first', other.projectRoot, '--accepts', 'issues,docs', '--user'], opts);
  strictEqual(a2.exitCode, 0);
  const a3 = repos(['add', 'first', other.projectRoot, '--accepts', 'issues', '--description', 'the first', '--user'], opts);
  strictEqual(a3.exitCode, 0);
  const file = JSON.parse(readFileSync(join(dir, 'repos.json'), 'utf-8'));
  deepStrictEqual(file, { version: 1, repos: { first: { path: real(other.projectRoot), accepts: ['issues'], description: 'the first' } } });
  deepStrictEqual(listJson(opts), [{ name: 'first', path: real(other.projectRoot), accepts: ['issues'], description: 'the first', level: 'user', ok: true }]);
  fx.cleanup(); other.cleanup();
});

// runCli drops stderr on success, so the add/remove/suppress reports are read through a shell redirect.
function spawnSyncStderr(args, { env: e, cwd }) {
  return execFileSync('bash', ['-c', `node "$0" "$@" 2>&1 >/dev/null`, CLI_PATH, ...args], { env: e, cwd, encoding: 'utf-8' });
}

await runTest('TR3: add reports created, unchanged and updated on stderr', () => {
  const fx = createFixture();
  const other = createFixture();
  const { env: e } = env();
  const run = (accepts) => {
    return spawnSyncStderr(['repos', 'add', 'first', other.projectRoot, '--accepts', accepts, '--user'], { env: e, cwd: fx.projectRoot }).trim();
  };
  strictEqual(run('issues'), 'created');
  strictEqual(run('issues'), 'unchanged');
  strictEqual(run('issues,code'), 'updated');
  fx.cleanup(); other.cleanup();
});

await runTest('TR4: add refuses a plain directory, a subdirectory, a bad name and a bad destination, writing nothing', () => {
  const fx = createFixture();
  const { dir, env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  const plain = mkdtempSync(join(tmpdir(), 'smcp-plain-'));
  mkdirSync(join(fx.projectRoot, 'sub'));
  for (const args of [
    ['add', 'x', plain, '--accepts', 'issues', '--user'],
    ['add', 'x', join(fx.projectRoot, 'sub'), '--accepts', 'issues', '--user'],
    ['add', 'Bad_Name', fx.projectRoot, '--accepts', 'issues', '--user'],
    ['add', 'issues', fx.projectRoot, '--accepts', 'issues', '--user'],
    ['add', 'x', fx.projectRoot, '--accepts', 'wiki', '--user'],
    ['add', 'x', fx.projectRoot, '--accepts', 'issues'],
    ['add', 'x', fx.projectRoot, '--accepts', 'issues', '--user', '--project'],
    ['add', 'x', fx.projectRoot, '--accepts', 'issues', '--local'],
  ]) {
    const r = repos(args, opts);
    strictEqual(r.exitCode, 1, `${args.join(' ')} → ${r.exitCode} ${r.stderr}`);
  }
  const local = repos(['add', 'x', fx.projectRoot, '--accepts', 'issues', '--local'], opts);
  ok(local.stderr.includes('--project --local'), local.stderr);
  strictEqual(existsSync(join(dir, 'repos.json')), false);
  strictEqual(existsSync(join(fx.projectRoot, '.claude')), false);
  rmSync(plain, { recursive: true, force: true });
  fx.cleanup();
});

await runTest('TR5: levels merge by name, most specific wins, and a null suppresses the levels below', () => {
  const fx = createFixture();
  const a = createFixture();
  const b = createFixture();
  const { env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  strictEqual(repos(['add', 'one', a.projectRoot, '--accepts', 'issues', '--user'], opts).exitCode, 0);
  strictEqual(repos(['add', 'two', a.projectRoot, '--accepts', 'docs', '--user'], opts).exitCode, 0);
  strictEqual(repos(['add', 'one', b.projectRoot, '--accepts', 'code', '--project'], opts).exitCode, 0);
  let list = listJson(opts);
  deepStrictEqual(list.map((x) => [x.name, x.level, x.path]), [['one', 'project', real(b.projectRoot)], ['two', 'user', real(a.projectRoot)]]);
  strictEqual(repos(['suppress', 'two', '--project', '--local'], opts).exitCode, 0);
  list = listJson(opts);
  deepStrictEqual(list.map((x) => x.name), ['one']);
  // Another repo sees the user level untouched.
  deepStrictEqual(listJson({ env: e, cwd: a.projectRoot }).map((x) => x.name), ['one', 'two']);
  // suppress again is unchanged; remove the null restores the user entry.
  strictEqual(spawnSyncStderr(['repos', 'suppress', 'two', '--project', '--local'], opts).trim(), 'unchanged');
  strictEqual(spawnSyncStderr(['repos', 'remove', 'two', '--project', '--local'], opts).trim(), 'updated');
  strictEqual(spawnSyncStderr(['repos', 'remove', 'two', '--project', '--local'], opts).trim(), 'unchanged');
  deepStrictEqual(listJson(opts).map((x) => x.name), ['one', 'two']);
  fx.cleanup(); a.cleanup(); b.cleanup();
});

await runTest('TR6: a local-level write adds the .gitignore line once and git status does not list the file', () => {
  const fx = createFixture();
  const { env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  writeFileSync(join(fx.projectRoot, '.gitignore'), 'node_modules', 'utf-8');
  strictEqual(repos(['suppress', 'someone', '--project', '--local'], opts).exitCode, 0);
  strictEqual(repos(['suppress', 'another', '--project', '--local'], opts).exitCode, 0);
  const gi = readFileSync(join(fx.projectRoot, '.gitignore'), 'utf-8');
  strictEqual(gi, 'node_modules\n.claude/scratch-memory/repos.local.json\n');
  ok(existsSync(join(fx.projectRoot, '.claude/scratch-memory/repos.local.json')));
  const status = execFileSync('git', ['status', '--short', '--untracked-files=all'], { cwd: fx.projectRoot, encoding: 'utf-8' });
  ok(!status.includes('repos.local.json'), status);
  fx.cleanup();
});

await runTest('TR7: a newer file version and an unreadable file exit 2 naming the problem', () => {
  const fx = createFixture();
  const { dir, env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  writeFileSync(join(dir, 'repos.json'), JSON.stringify({ version: 2, repos: {} }), 'utf-8');
  let r = repos(['list', '--json'], opts);
  strictEqual(r.exitCode, 2);
  ok(r.stderr.includes('version 2'), r.stderr);
  r = repos(['add', 'x', fx.projectRoot, '--accepts', 'issues', '--user'], opts);
  strictEqual(r.exitCode, 2);
  strictEqual(JSON.parse(readFileSync(join(dir, 'repos.json'), 'utf-8')).version, 2);
  writeFileSync(join(dir, 'repos.json'), '{ not json', 'utf-8');
  strictEqual(repos(['list'], opts).exitCode, 2);
  fx.cleanup();
});

await runTest('TR8: unknown fields are ignored on read and kept on write', () => {
  const fx = createFixture();
  const other = createFixture();
  const { dir, env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  writeFileSync(join(dir, 'repos.json'), JSON.stringify({ version: 1, extra: 'keep', repos: { old: { path: real(other.projectRoot), accepts: ['docs'], color: 'blue' } } }), 'utf-8');
  deepStrictEqual(listJson(opts).map((x) => x.name), ['old']);
  strictEqual(repos(['add', 'new', other.projectRoot, '--accepts', 'code', '--user'], opts).exitCode, 0);
  const file = JSON.parse(readFileSync(join(dir, 'repos.json'), 'utf-8'));
  strictEqual(file.extra, 'keep');
  strictEqual(file.repos.old.color, 'blue');
  fx.cleanup(); other.cleanup();
});

await runTest('TR9: a deleted registered repo lists ok:false; resolve exits 2 with the entry still on stdout; unknown name exits 1', () => {
  const fx = createFixture();
  const gone = createFixture();
  const { env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  strictEqual(repos(['add', 'gone', gone.projectRoot, '--accepts', 'issues', '--user'], opts).exitCode, 0);
  const ok1 = repos(['resolve', 'gone', '--json'], opts);
  strictEqual(ok1.exitCode, 0);
  strictEqual(JSON.parse(ok1.stdout).ok, true);
  const path = real(gone.projectRoot);
  gone.cleanup();
  deepStrictEqual(listJson(opts).map((x) => [x.name, x.ok]), [['gone', false]]);
  const r = repos(['resolve', 'gone', '--json'], opts);
  strictEqual(r.exitCode, 2);
  strictEqual(JSON.parse(r.stdout).path, path);
  strictEqual(repos(['resolve', 'nobody', '--json'], opts).exitCode, 1);
  fx.cleanup();
});

await runTest('TR10: owner picks the most specific ok root, follows symlinks, and skips not-ok entries', () => {
  const fx = createFixture();
  const outer = createFixture();
  const { env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  const inner = join(outer.projectRoot, 'nested');
  mkdirSync(join(inner, '.claude', 'skills', 'x'), { recursive: true });
  execFileSync('git', ['init', '--quiet'], { cwd: inner });
  strictEqual(repos(['add', 'outer', outer.projectRoot, '--accepts', 'issues', '--user'], opts).exitCode, 0);
  strictEqual(repos(['add', 'inner', inner, '--accepts', 'learned', '--user'], opts).exitCode, 0);
  const link = join(fx.projectRoot, 'skills-link');
  symlinkSync(join(inner, '.claude', 'skills'), link);
  const owner = (p) => JSON.parse(repos(['owner', p, '--json'], opts).stdout)?.name ?? null;
  strictEqual(owner(join(inner, '.claude', 'skills', 'x', 'SKILL.md')), 'inner');
  strictEqual(owner(join(link, 'x', 'new-page.md')), 'inner');
  strictEqual(owner(join(outer.projectRoot, 'README.md')), 'outer');
  strictEqual(owner(fx.projectRoot), null);
  rmSync(inner, { recursive: true, force: true });
  strictEqual(owner(join(inner, 'a.md')), 'outer');
  const human = repos(['owner', join(outer.projectRoot, 'x')], opts);
  ok(human.stdout.startsWith('outer\t'), human.stdout);
  strictEqual(human.stdout.split('\n').length, 2);
  fx.cleanup(); outer.cleanup();
});

await runTest('TR11: concurrent adds lose no update and leave no tmp or lock behind', async () => {
  const fx = createFixture();
  const other = createFixture();
  const { dir, env: e } = env();
  const names = Array.from({ length: 8 }, (_, i) => `r${i}`);
  const codes = await Promise.all(names.map((n) => new Promise((res) => {
    const c = spawn('node', [CLI_PATH, 'repos', 'add', n, other.projectRoot, '--accepts', 'issues', '--user'], { env: e, cwd: fx.projectRoot, stdio: 'ignore' });
    c.on('exit', res);
  })));
  deepStrictEqual(codes, names.map(() => 0));
  deepStrictEqual(Object.keys(JSON.parse(readFileSync(join(dir, 'repos.json'), 'utf-8')).repos).sort(), names);
  deepStrictEqual(readdirSync(dir), ['repos.json']);
  fx.cleanup(); other.cleanup();
});

await runTest('TR12: a lock left by a dead process or older than 60 s is broken; a live fresh lock times out with exit 2', () => {
  const fx = createFixture();
  const other = createFixture();
  const { dir, env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  const lock = join(dir, 'repos.json.lock');
  mkdirSync(lock);
  writeFileSync(join(lock, 'owner'), JSON.stringify({ pid: 2 ** 22 + 7, created: Date.now() }), 'utf-8');
  strictEqual(repos(['add', 'a', other.projectRoot, '--accepts', 'issues', '--user'], opts).exitCode, 0);
  mkdirSync(lock);
  writeFileSync(join(lock, 'owner'), JSON.stringify({ pid: process.pid, created: Date.now() - 61_000 }), 'utf-8');
  strictEqual(repos(['add', 'b', other.projectRoot, '--accepts', 'issues', '--user'], opts).exitCode, 0);
  mkdirSync(lock);
  writeFileSync(join(lock, 'owner'), JSON.stringify({ pid: process.pid, created: Date.now() }), 'utf-8');
  const t0 = Date.now();
  const r = repos(['add', 'c', other.projectRoot, '--accepts', 'issues', '--user'], opts);
  strictEqual(r.exitCode, 2);
  ok(Date.now() - t0 >= 5_000);
  ok(r.stderr.includes('lock'), r.stderr);
  deepStrictEqual(Object.keys(JSON.parse(readFileSync(join(dir, 'repos.json'), 'utf-8')).repos).sort(), ['a', 'b']);
  fx.cleanup(); other.cleanup();
});

await runTest('TR13: --help prints the repos help and exits 0; an unknown subcommand exits 1', () => {
  const { env: e } = env();
  const h = repos(['--help'], { env: e });
  strictEqual(h.exitCode, 0);
  ok(h.stdout.includes('--project --local'));
  ok(h.stdout.includes('stdout still holds the entry'));
  strictEqual(repos(['frobnicate'], { env: e }).exitCode, 1);
});

await runTest('TR14: concurrent adds that all find the same stale lock break it once and lose no update', async () => {
  const fx = createFixture();
  const other = createFixture();
  const { dir, env: e } = env();
  for (const owner of [JSON.stringify({ pid: 2 ** 22 + 7, created: Date.now() }), null]) {
    const lock = join(dir, 'repos.json.lock');
    mkdirSync(lock);
    if (owner) writeFileSync(join(lock, 'owner'), owner, 'utf-8');
    const names = Array.from({ length: 8 }, (_, i) => `${owner ? 'dead' : 'bare'}${i}`);
    const codes = await Promise.all(names.map((n) => new Promise((res) => {
      const c = spawn('node', [CLI_PATH, 'repos', 'add', n, other.projectRoot, '--accepts', 'issues', '--user'], { env: e, cwd: fx.projectRoot, stdio: 'ignore' });
      c.on('exit', res);
    })));
    deepStrictEqual(codes, names.map(() => 0));
    const have = Object.keys(JSON.parse(readFileSync(join(dir, 'repos.json'), 'utf-8')).repos);
    ok(names.every((n) => have.includes(n)), have.join(','));
    deepStrictEqual(readdirSync(dir), ['repos.json']);
  }
  fx.cleanup(); other.cleanup();
});

await runTest('TR15: a relative path or a shell-significant character in a repos file exits 2; add refuses such a directory with exit 1', () => {
  const fx = createFixture();
  const { dir, env: e } = env();
  const opts = { env: e, cwd: fx.projectRoot };
  for (const path of ['.', '../x', `${fx.projectRoot}/x$(id)`, `${fx.projectRoot}/it's`, `${fx.projectRoot}/a\`b`]) {
    writeFileSync(join(dir, 'repos.json'), JSON.stringify({ version: 1, repos: { bad: { path, accepts: ['issues'] } } }), 'utf-8');
    const r = repos(['list'], opts);
    strictEqual(r.exitCode, 2, `${path}: ${r.stdout}`);
    ok(r.stderr.includes('entry bad'), r.stderr);
  }
  rmSync(join(dir, 'repos.json'));
  const odd = mkdtempSync(join(tmpdir(), 'smcp-odd$'));
  execFileSync('git', ['init', '-q', odd]);
  const r = repos(['add', 'odd', odd, '--accepts', 'issues', '--user'], opts);
  strictEqual(r.exitCode, 1, r.stderr);
  ok(!existsSync(join(dir, 'repos.json')));
  rmSync(odd, { recursive: true, force: true });
  fx.cleanup();
});

process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
process.exit(failCount ? 1 : 0);
