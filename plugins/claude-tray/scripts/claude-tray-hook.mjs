#!/usr/bin/env node
// claude-tray-hook.mjs — Write session state for the tray monitor.
// Called by SessionStart, UserPromptSubmit, PreToolUse, Stop, Notification, and SessionEnd hooks.
// Reads hook JSON from stdin, derives status, writes state file to TMPDIR.
// Also resolves the claude.exe ancestor PID for desktop auto-detection.

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, appendFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  deriveStatus,
  deriveProject,
  resolveLastMessage,
  preserveFields,
  buildStateJson,
} from './claude-tray-hook-lib.mjs';

// ── Logging ──
// Writes to $TMPDIR/.claude-tray/hook.log (same dir as state files)
// Env: CLAUDE_TRAY_LOG=1 to enable (off by default to avoid I/O on every PreToolUse)
// Rotates: hook.log → hook.log.1 → ... → hook.log.5 (dropped) when size exceeds 1MB

const LOG_MAX_BYTES = 1024 * 1024; // 1MB
const LOG_KEEP = 5;

let _logDir = null;

function rotateLog(logPath) {
  try {
    const st = statSync(logPath);
    if (st.size < LOG_MAX_BYTES) return;
  } catch { return; }
  // Rotate: .5 dropped, .4→.5, .3→.4, ..., .1→.2, current→.1
  for (let i = LOG_KEEP - 1; i >= 1; i--) {
    try { renameSync(`${logPath}.${i}`, `${logPath}.${i + 1}`); } catch {}
  }
  try { renameSync(logPath, `${logPath}.1`); } catch {}
}

function log(level, msg) {
  if (!process.env.CLAUDE_TRAY_LOG && level !== 'ERROR') return;
  try {
    const dir = _logDir || join(process.env.TMPDIR || tmpdir(), '.claude-tray');
    const logPath = join(dir, 'hook.log');
    rotateLog(logPath);
    const ts = new Date().toISOString().slice(11, 23);
    appendFileSync(logPath, `${ts} [${level}] ${msg}\n`, 'utf-8');
  } catch {}
}

// ── Read stdin ──

function readStdin() {
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

// ── PID resolution ──

function validatePidAlive(pid) {
  // Node runs natively on Windows — use tasklist to check if PID exists
  const result = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], {
    encoding: 'utf-8',
    shell: false,
    timeout: 1000,
  });
  if (result.error || result.status !== 0) return true; // trust cache on error
  return (result.stdout || '').includes(String(pid));
}

function resolveClaudePid(trayDir, sid) {
  const pidCache = join(trayDir, `.pid-${sid}`);

  // Fast path: use cached PID if alive
  if (existsSync(pidCache)) {
    const cached = readFileSync(pidCache, 'utf-8').trim();
    if (cached) {
      if (validatePidAlive(cached)) return cached;
      try { unlinkSync(pidCache); } catch {}
    }
  }

  // Slow path: walk process tree via wmic to find claude.exe ancestor
  // Node.js on Windows: process.pid is already the Windows PID (no MSYS /proc/ needed)
  const myWpid = String(process.pid);

  const result = spawnSync('wmic', ['process', 'get', 'ProcessId,ParentProcessId,Name', '/format:csv'], {
    encoding: 'utf-8',
    shell: false,
    timeout: 1500,
  });
  if (result.error || result.status !== 0) return '';

  const parents = new Map();
  const names = new Map();
  for (const line of (result.stdout || '').split('\n')) {
    const clean = line.replace(/\r/g, '').trim();
    if (!clean) continue;
    const parts = clean.split(',');
    if (parts.length < 4) continue;
    const [, name, ppid, pid] = parts;
    if (!pid) continue;
    parents.set(pid, ppid);
    names.set(pid, name);
  }

  let cur = myWpid;
  for (let i = 0; i < 15; i++) {
    if (names.get(cur) === 'claude.exe') {
      try { writeFileSync(pidCache, cur, 'utf-8'); } catch {}
      return cur;
    }
    const parent = parents.get(cur);
    if (!parent || parent === '0' || parent === cur) break;
    cur = parent;
  }

  return '';
}

// ── Read existing state ──

function stripBom(str) {
  // PowerShell's Set-Content -Encoding UTF8 adds a BOM (EF BB BF)
  return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
}

function readExistingState(filePath) {
  try {
    return JSON.parse(stripBom(readFileSync(filePath, 'utf-8')));
  } catch (err) {
    if (existsSync(filePath)) {
      log('ERROR', `readExistingState failed: ${err.message} file=${filePath}`);
    }
    return null;
  }
}

// ── Main ──

const input = stripBom(readStdin());
if (!input.trim()) process.exit(0);

let hook;
try {
  hook = JSON.parse(input);
} catch (err) {
  log('ERROR', `JSON.parse stdin failed: ${err.message} input=${input.slice(0, 80)}`);
  process.exit(0);
}

const sid = hook.session_id || '';
if (!sid) process.exit(0);

// Match bash hook: prefer $TMPDIR (MSYS /tmp), fall back to os.tmpdir()
const trayDir = join(process.env.TMPDIR || tmpdir(), '.claude-tray');
_logDir = trayDir;
mkdirSync(trayDir, { recursive: true });

const event = hook.hook_event_name || '';

// Clean up PID cache on SessionEnd
if (event === 'SessionEnd') {
  try { unlinkSync(join(trayDir, `.pid-${sid}`)); } catch {}
}

const status = deriveStatus(event, {
  notificationType: hook.notification_type || '',
  source: hook.source || '',
});
if (!status) {
  log('ERROR', `Unknown event: "${event}" sid=${sid.slice(0, 8)}`);
  process.exit(0);
}

const cwd = hook.cwd || '';
const project = deriveProject(cwd);

// Resolve claude.exe PID
const claudePid = resolveClaudePid(trayDir, sid);

// Read existing state for field preservation
const stateFile = join(trayDir, `${sid}.json`);
const existing = readExistingState(stateFile);

// Resolve last message
const prompt = hook.prompt || '';
const message = hook.message || '';
const previousMessage = existing?.last_message || '';
const lastMessage = resolveLastMessage(prompt, message, previousMessage);

// Build and preserve fields
const stateFields = buildStateJson({
  sessionId: sid,
  status,
  project,
  cwd,
  hookEvent: event,
  notificationType: hook.notification_type || (event === 'PermissionRequest' ? 'permission_prompt' : ''),
  lastMessage,
  claudePid,
  soundPack: existing?.sound_pack || '',
  desktopIndex: existing?.desktop_index ?? null,
  timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
});

const finalState = preserveFields(existing, stateFields);

// Atomic write: tmp file then rename (retry on Windows EPERM from PS1 file lock)
const tmpFile = join(trayDir, `.tmp-${sid}`);
writeFileSync(tmpFile, JSON.stringify(finalState), 'utf-8');
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    renameSync(tmpFile, stateFile);
    break;
  } catch (err) {
    if (err.code === 'EPERM' && attempt < 4) {
      spawnSync('cmd', ['/c', 'ping', '-n', '1', '-w', '50', '127.0.0.1'], { stdio: 'ignore' });
      continue;
    }
    // Last attempt or non-EPERM: fall back to direct write + cleanup
    writeFileSync(stateFile, readFileSync(tmpFile, 'utf-8'), 'utf-8');
    try { unlinkSync(tmpFile); } catch {}
    break;
  }
}

// Diagnostic: log all hook input fields for event investigation
const diag = [];
if (hook.source) diag.push(`source=${hook.source}`);
if (hook.notification_type) diag.push(`notif_type=${hook.notification_type}`);
if (hook.tool_name) diag.push(`tool=${hook.tool_name}`);
if (hook.permission_mode) diag.push(`perm_mode=${hook.permission_mode}`);
const diagStr = diag.length ? ` ${diag.join(' ')}` : '';
log('INFO', `${sid.slice(0, 8)} ${project} [${event}→${status}] pid=${claudePid || 'none'}${diagStr}`);
