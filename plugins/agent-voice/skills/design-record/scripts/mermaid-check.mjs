#!/usr/bin/env node
// mermaid-check — parse every fenced `mermaid` block in Markdown files against
// the pinned Mermaid version, the one mermaid-pin.json names.
//
// The pinned packages and their whole dependency tree, as locked in
// mermaid-lock.json, are installed with `npm ci` on first use into a user cache
// directory keyed by the pin and the lock, so no node_modules lands in the skill
// folder and no dependency resolves from a range.
// Exit 69 means the check was skipped, never that the file is clean.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EX_UNAVAILABLE = 69;
const here = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `Usage: mermaid-check [--verbose] <file.md>...

Parses every fenced mermaid block against the version in mermaid-pin.json.

Exit codes:
  0   every block parsed; nothing printed
  1   one line per failing block on stdout: {file}:{line}: {message},
      {line} being the opening fence's line
  2   usage error or unreadable file
  69  the pinned packages could not be installed or loaded; the check was
      skipped, never verified clean

Options:
  --verbose   print each block checked, on stderr
  -h, --help  show this help

Environment:
  MERMAID_CHECK_CACHE   cache root for the pinned packages
                        (default: \${XDG_CACHE_HOME:-~/.cache}/mermaid-check)`;

function unavailable(why) {
  process.stderr.write(`mermaid-check: pinned Mermaid unavailable (${why}); check skipped, not verified clean\n`);
  process.exit(EX_UNAVAILABLE);
}

// A fence opens with 3+ backticks or tildes and closes with the same character
// at least as long. Every fence is tracked, so a mermaid fence shown inside an
// outer example fence is not mistaken for a real diagram.
function mermaidBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!open) {
      const m = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/.exec(line);
      if (m) open = { fence: m[1], line: i + 1, mermaid: m[2] === 'mermaid', body: [] };
      continue;
    }
    const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
    if (close && close[1][0] === open.fence[0] && close[1].length >= open.fence.length) {
      if (open.mermaid) blocks.push(open);
      open = null;
      continue;
    }
    open.body.push(line);
  }
  if (open && open.mermaid) blocks.push(open);
  return blocks;
}

function cacheRoot() {
  if (process.env.MERMAID_CHECK_CACHE) return process.env.MERMAID_CHECK_CACHE;
  const base = process.platform === 'win32'
    ? (process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'))
    : (process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'));
  return path.join(base, 'mermaid-check');
}

// mermaid-lock.json was generated from exactly this package.json
// (`npm install --package-lock-only`); `npm ci` refuses the pair if they drift.
function ensureInstalled(pin, lock) {
  const pkg = JSON.stringify({ name: 'mermaid-check-cache', private: true, dependencies: pin }, null, 2) + '\n';
  const key = crypto.createHash('sha256').update(pkg).update(lock).digest('hex').slice(0, 16);
  const root = cacheRoot();
  const dir = path.join(root, key);
  if (Object.keys(pin).every((name) => fs.existsSync(path.join(dir, 'node_modules', name, 'package.json')))) return dir;

  // Install into a temporary sibling and rename, so an interrupted install
  // never leaves a half-filled directory that looks complete.
  fs.mkdirSync(root, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(root, '.install-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), pkg);
  fs.writeFileSync(path.join(tmp, 'package-lock.json'), lock);
  const win = process.platform === 'win32';
  const r = spawnSync(win ? 'npm.cmd' : 'npm',
    ['ci', '--no-audit', '--no-fund', '--ignore-scripts', '--prefer-offline', '--fetch-retries=1'],
    { cwd: tmp, encoding: 'utf8', timeout: 180000, shell: win });
  if (r.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    // What ended npm, and the last it said: a kill for memory reads as "exited null" otherwise.
    const tail = String(r.stderr || '').trim().split('\n').slice(-5).join(' | ').slice(-400);
    unavailable((r.error ? r.error.message : r.signal ? `npm ci killed by ${r.signal}` : `npm ci exited ${r.status}`) + (tail ? `: ${tail}` : ''));
  }
  try {
    fs.renameSync(tmp, dir);
  } catch {
    // Another run finished the same install first; use its copy.
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return dir;
}

async function loadMermaid(dir) {
  const req = createRequire(path.join(dir, 'package.json'));
  const { JSDOM } = req('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const mermaid = (await import(pathToFileURL(req.resolve('mermaid')).href)).default;
  mermaid.initialize({ startOnLoad: false });
  return mermaid;
}

// Mermaid's message is a header, a source excerpt with a caret, and an
// "Expecting ..." line; one output line keeps the header and the last line.
function oneLine(err) {
  const lines = String(err && err.message ? err.message : err).split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return lines[0] || 'parse error';
  return `${lines[0].replace(/:$/, '')} of the block: ${lines[lines.length - 1]}`;
}

async function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(USAGE);
    return 0;
  }
  const verbose = argv.includes('--verbose');
  const files = argv.filter((a) => a !== '--verbose');
  const bad = files.find((a) => a.startsWith('-'));
  if (bad || files.length === 0) {
    process.stderr.write(`${bad ? `mermaid-check: unknown option ${bad}\n` : ''}${USAGE}\n`);
    return 2;
  }

  const found = [];
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      process.stderr.write(`mermaid-check: cannot read ${file}: ${e.code || e.message}\n`);
      return 2;
    }
    for (const block of mermaidBlocks(text)) found.push({ file, ...block });
  }
  if (found.length === 0) return 0;

  let mermaid;
  try {
    const pin = JSON.parse(fs.readFileSync(path.join(here, 'mermaid-pin.json'), 'utf8'));
    for (const [name, version] of Object.entries(pin)) {
      if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`${name} pin "${version}" is not an exact version`);
    }
    const lock = fs.readFileSync(path.join(here, 'mermaid-lock.json'), 'utf8');
    mermaid = await loadMermaid(ensureInstalled(pin, lock));
  } catch (e) {
    unavailable(e.message);
  }

  let failed = 0;
  for (const b of found) {
    try {
      const { diagramType } = await mermaid.parse(b.body.join('\n'));
      if (verbose) process.stderr.write(`${b.file}:${b.line}: ok (${diagramType})\n`);
    } catch (e) {
      failed++;
      process.stdout.write(`${b.file}:${b.line}: ${oneLine(e)}\n`);
    }
  }
  return failed ? 1 : 0;
}

process.exitCode = await main(process.argv.slice(2));
