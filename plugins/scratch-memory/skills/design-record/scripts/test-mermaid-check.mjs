// Tests for mermaid-check: exit codes, the per-block failure line, and the
// skipped (69) path. The pass and failure tests use the real pinned packages
// from the user cache, installing them on first run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'mermaid-check.mjs');
const repoRoot = path.resolve(here, '../../../..');
const trayIdea = path.join(repoRoot, 'scratch', 'claude-tray-cli', 'idea.md');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-check-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const run = (args, env = {}) => spawnSync('node', [script, ...args], {
  encoding: 'utf8', env: { ...process.env, ...env }, timeout: 300000,
});
const write = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return p; };

const DIAGRAMS = `# Doc

\`\`\`mermaid
flowchart LR
  A["one"] --> B["two"]
\`\`\`

\`\`\`mermaid
sequenceDiagram
  A->>B: hello
\`\`\`

\`\`\`mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Closed
\`\`\`
`;

test('help exits 0; no file or an unknown flag exits 2', () => {
  assert.equal(run(['--help']).status, 0);
  assert.equal(run([]).status, 2);
  assert.equal(run(['--bogus', 'x.md']).status, 2);
});

test('an unreadable file exits 2', () => {
  const r = run([path.join(tmp, 'missing.md')]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cannot read/);
});

test('a file with no mermaid block exits 0 without loading Mermaid, even offline', () => {
  const f = write('plain.md', '# Plain\n\n```js\nconst a = 1;\n```\n');
  const r = run([f], { MERMAID_CHECK_CACHE: path.join(tmp, 'no-cache'), npm_config_registry: 'http://127.0.0.1:9/' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(fs.existsSync(path.join(tmp, 'no-cache')), false);
});

test('flowchart, sequence and state blocks parse: exit 0 and nothing printed', () => {
  const r = run([write('good.md', DIAGRAMS)]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('--verbose names each block checked, on stderr only', () => {
  const f = write('good-verbose.md', DIAGRAMS);
  const r = run(['--verbose', f]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
  assert.deepEqual(r.stderr.trim().split('\n').map((l) => l.replace(/ ok \(.*\)$/, '')), [`${f}:3:`, `${f}:8:`, `${f}:13:`]);
});

test('a broken block exits 1 with one line naming its opening fence line', () => {
  const f = write('bad.md', DIAGRAMS.replace('A["one"] --> B["two"]', 'A["one"] B["two"]'));
  const r = run([f]);
  assert.equal(r.status, 1);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.ok(lines[0].startsWith(`${f}:3: `), lines[0]);
});

test('a mermaid fence quoted inside an outer fence is not checked', () => {
  const f = write('quoted.md', '````markdown\n```mermaid\nflowchart LR\n  A[ --> \n```\n````\n');
  assert.equal(run([f]).status, 0);
});

test('the real claude-tray-cli design parses; a copy with one arrow deleted names that fence', { skip: !fs.existsSync(trayIdea) }, () => {
  assert.equal(run([trayIdea]).status, 0);
  const text = fs.readFileSync(trayIdea, 'utf8');
  const fence = text.split('\n').indexOf('```mermaid') + 1;
  const arrow = text.indexOf('-->', text.indexOf('```mermaid'));
  const f = write('tray-broken.md', text.slice(0, arrow) + text.slice(arrow + 3));
  const r = run([f]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.stdout.trim().split('\n').map((l) => l.split(': ')[0]), [`${f}:${fence}`]);
});

test('with an empty cache and an unreachable registry it exits 69, never 0', () => {
  const r = run([write('offline.md', DIAGRAMS)], {
    MERMAID_CHECK_CACHE: path.join(tmp, 'empty-cache'),
    npm_config_cache: path.join(tmp, 'empty-npm-cache'),
    npm_config_registry: 'http://127.0.0.1:9/',
    npm_config_fetch_retry_mintimeout: '100',
    npm_config_fetch_retry_maxtimeout: '200',
  });
  assert.equal(r.status, 69);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /skipped/);
});

test('an install that a signal ends says which signal and what npm last said', { skip: process.platform === 'win32' }, () => {
  // An `npm` first on PATH that complains and is killed, as one out of memory is.
  const bin = path.join(tmp, 'killed-npm');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\necho "fake npm: out of memory" >&2\nkill -9 $$\n', { mode: 0o755 });
  const r = run([write('killed.md', DIAGRAMS)], { MERMAID_CHECK_CACHE: path.join(tmp, 'killed-cache'), PATH: bin + path.delimiter + process.env.PATH });
  assert.equal(r.status, 69);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /npm ci killed by SIGKILL: fake npm: out of memory\); check skipped, not verified clean/);
});

test('the cache holds exactly the tree mermaid-lock.json locks, every transitive package at its locked version', () => {
  const cache = path.join(tmp, 'locked-cache');
  assert.equal(run([write('locked.md', DIAGRAMS)], { MERMAID_CHECK_CACHE: cache }).status, 0);
  const lockText = fs.readFileSync(path.join(here, 'mermaid-lock.json'), 'utf8');
  const [dir] = fs.readdirSync(cache).filter((d) => !d.startsWith('.'));
  assert.equal(fs.readFileSync(path.join(cache, dir, 'package-lock.json'), 'utf8'), lockText);
  const locked = Object.entries(JSON.parse(lockText).packages).filter(([k]) => k);
  assert.ok(locked.length > 2);
  for (const [rel, { version }] of locked) {
    const pj = JSON.parse(fs.readFileSync(path.join(cache, dir, rel, 'package.json'), 'utf8'));
    assert.equal(pj.version, version, rel);
  }
});
