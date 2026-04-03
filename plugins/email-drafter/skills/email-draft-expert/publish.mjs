#!/usr/bin/env node
// Email Drafter CLI — creates drafts, manages draft lifecycle, and interacts
// with label-gated mailboxes via the Apps Script gateway.
// Transparent caching for thread and download actions.
//
// Usage:
//   email-draft [draft] --profile <name> [--subject "..."] [--to "..."] [--cc "..."] <file>
//   echo "markdown" | email-draft [draft] --profile <name>
//   email-draft list --profile <name>
//   email-draft thread --profile <name> --id <threadId> [--refresh]
//   email-draft read --profile <name> --id <messageId>
//   email-draft reply --profile <name> --id <messageId> [--reply-sender-only] <file>
//   email-draft download --profile <name> --id <messageId> [-o <dir>] [--refresh]
//   email-draft list-drafts --profile <name>
//   email-draft read-draft --profile <name> --id <draftId>
//   email-draft edit --profile <name> --id <draftId> [--subject "..."] [--to "..."] [--cc "..."] [body.md]
//   email-draft attach --profile <name> --id <draftId> [--content-id <cid>] <file> [<file2> ...]
//   email-draft detach --profile <name> --id <draftId> --filename <name>
//   email-draft edit --profile <name> --id <draftId> --dry-run [...]
//   email-draft attach --profile <name> --id <draftId> --dry-run <file> [...]
//   email-draft detach --profile <name> --id <draftId> --dry-run --filename <name>
//   email-draft configure --profile <name> [--to "..."] [--cc "..."]
//   email-draft update --profile <name>
//
// Config: .env (in skill folder, checked first) or ~/.config/email-drafter/config.env

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { resolve, join, dirname, basename, extname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import { rmSync } from 'fs';
import { parseAttachments, parseDraftState, buildMime } from './lib/mime.mjs';

// --- Constants ---

const MAX_ATTACH_SIZE = 15 * 1024 * 1024; // 15MB hard limit
const WARN_ATTACH_SIZE = 10 * 1024 * 1024; // 10MB warning

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
};

function guessMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// --- Parse args ---
const args = process.argv.slice(2);

const ACTIONS = new Set([
  'draft', 'list', 'thread', 'read', 'reply', 'download', 'raw',
  'list-drafts', 'read-draft', 'edit', 'attach', 'detach',
  'configure', 'update',
]);
let action = 'draft';
let file = null;
let files = []; // batch attach: { path, contentId }
let subjectOverride = null;
let profileOverride = null;
let toOverride = null;
let ccOverride = null;
let targetId = null;
let replySenderOnly = false;
let outputDir = null;
let refresh = false;
let maxResultsOverride = null;
let defaultSubjectOverride = null;
let contentId = null;
let filenameOverride = null;
let mimeTypeOverride = null;
let dryRun = false;

// First positional arg may be an action
let argStart = 0;
if (args.length > 0 && ACTIONS.has(args[0])) {
  action = args[0];
  if (action === 'raw') action = 'download'; // alias
  argStart = 1;
}

let pendingContentId = null;
for (let i = argStart; i < args.length; i++) {
  if (args[i] === '--subject' && args[i + 1]) {
    subjectOverride = args[++i];
  } else if (args[i] === '--profile' && args[i + 1]) {
    profileOverride = args[++i];
  } else if (args[i] === '--to' && args[i + 1]) {
    toOverride = args[++i];
  } else if (args[i] === '--cc' && args[i + 1] !== undefined) {
    ccOverride = args[++i];
  } else if ((args[i] === '--id' || args[i] === '--message-id' || args[i] === '--thread-id' || args[i] === '--draft-id') && args[i + 1]) {
    targetId = args[++i];
  } else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) {
    outputDir = args[++i];
  } else if (args[i] === '--reply-sender-only') {
    replySenderOnly = true;
  } else if (args[i] === '--refresh') {
    refresh = true;
  } else if (args[i] === '--dry-run') {
    dryRun = true;
  } else if (args[i] === '--max-results' && args[i + 1]) {
    maxResultsOverride = args[++i];
  } else if (args[i] === '--default-subject' && args[i + 1]) {
    defaultSubjectOverride = args[++i];
  } else if (args[i] === '--content-id' && args[i + 1]) {
    pendingContentId = args[++i];
    contentId = pendingContentId; // backward compat for single-file attach
  } else if (args[i] === '--filename' && args[i + 1]) {
    filenameOverride = args[++i];
  } else if (args[i] === '--mime-type' && args[i + 1]) {
    mimeTypeOverride = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    printUsage();
    process.exit(0);
  } else if (!args[i].startsWith('--')) {
    file = args[i];
    // For attach action: collect files with their pending --content-id
    files.push({ path: args[i], contentId: pendingContentId });
    pendingContentId = null;
  }
}

function printUsage() {
  console.log(`Usage:
  email-draft [draft] --profile <name> [--subject "..."] [--to "..."] [--cc "..."] <file>
  echo "markdown" | email-draft [draft] --profile <name>
  email-draft list --profile <name>
  email-draft thread --profile <name> --id <threadId> [--refresh]
  email-draft read --profile <name> --id <messageId>
  email-draft reply --profile <name> --id <messageId> [--reply-sender-only] <file>
  email-draft download --profile <name> --id <messageId> [-o <dir>] [--refresh]
  email-draft list-drafts --profile <name>
  email-draft read-draft --profile <name> --id <draftId>
  email-draft edit --profile <name> --id <draftId> [--dry-run] [--subject "..."] [--to "..."] [--cc "..."] [body.md]
  email-draft attach --profile <name> --id <draftId> [--dry-run] [--content-id <cid>] <file> [<file2> ...]
  email-draft detach --profile <name> --id <draftId> [--dry-run] --filename <name>
  email-draft configure --profile <name> [--to "..."] [--cc "..."] [--max-results N] [--default-subject "..."]
  email-draft update --profile <name>

Actions:
  draft        Create a standalone Gmail draft (default)
  list         List labeled threads (summaries)
  thread       Read an entire conversation (cached)
  read         Read a single labeled message
  reply        Draft a reply to a labeled message
  download     Download raw message and extract attachments (cached)
  list-drafts  List AI-managed drafts
  read-draft   Read full draft content by draftId
  edit         Update draft subject, recipients, and/or body
  attach       Add file attachment(s) to a draft (multiple files in one call)
  detach       Remove an attachment from a draft by filename
  configure    Update gateway config (to, cc, etc. — not apiKeys or labelName)
  update       Check gateway version and copy latest code to clipboard

Flags:
  --dry-run    Preview changes without updating the draft (edit, attach, detach)

Profiles are defined in ~/.config/email-drafter/config.env`);
}

// Sanitize targetId to prevent path traversal in cache paths
if (targetId && !/^[a-zA-Z0-9_\-]+$/.test(targetId)) {
  console.error('Invalid --id value. Must contain only alphanumeric characters, hyphens, and underscores.');
  process.exit(1);
}

// Validate required args per action
if (action === 'list' || action === 'list-drafts' || action === 'update') {
  // no extra args needed
} else if (action === 'configure') {
  // validated later — at least one config flag required
} else if (action === 'thread') {
  if (!targetId) {
    console.error('thread requires --id <threadId>');
    process.exit(1);
  }
} else if (action === 'read') {
  if (!targetId) {
    console.error('read requires --id <messageId>');
    process.exit(1);
  }
} else if (action === 'read-draft') {
  if (!targetId) {
    console.error('read-draft requires --id <draftId>');
    process.exit(1);
  }
} else if (action === 'reply') {
  if (!targetId) {
    console.error('reply requires --id <messageId>');
    process.exit(1);
  }
  if (!file && process.stdin.isTTY) {
    console.error('reply requires a markdown file or stdin for the reply body');
    process.exit(1);
  }
} else if (action === 'download') {
  if (!targetId) {
    console.error('download requires --id <messageId>');
    process.exit(1);
  }
} else if (action === 'edit') {
  if (!targetId) {
    console.error('edit requires --id <draftId>');
    process.exit(1);
  }
  // At least one update field must be provided (validated after reading stdin)
} else if (action === 'attach') {
  if (!targetId) {
    console.error('attach requires --id <draftId>');
    process.exit(1);
  }
  if (files.length === 0) {
    console.error('attach requires at least one file to attach');
    process.exit(1);
  }
} else if (action === 'detach') {
  if (!targetId) {
    console.error('detach requires --id <draftId>');
    process.exit(1);
  }
  if (!filenameOverride) {
    console.error('detach requires --filename <name>');
    process.exit(1);
  }
} else if (action === 'draft') {
  if (!file && process.stdin.isTTY) {
    printUsage();
    process.exit(1);
  }
}

// --- Load config ---
const config = {};
const __dirname = dirname(fileURLToPath(import.meta.url));
const localConfigPath = resolve(__dirname, '.env');
const globalConfigPath = resolve(process.env.HOME || process.env.USERPROFILE, '.config/email-drafter/config.env');
const configPath = existsSync(localConfigPath) ? localConfigPath : globalConfigPath;
try {
  const configText = readFileSync(configPath, 'utf-8');
  for (const line of configText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIdx = trimmed.indexOf('=');
    const k = trimmed.slice(0, eqIdx);
    const v = trimmed.slice(eqIdx + 1);
    config[k] = v;
  }
} catch {
  // config file not found — fall through to error below
}

// Merge env vars over file config (env takes precedence)
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('EMAIL_DRAFTER_')) config[k] = v;
}

// --- Resolve profile ---
const configuredProfiles = new Set();
for (const k of Object.keys(config)) {
  const m = k.match(/^EMAIL_DRAFTER_PROFILE_(.+?)_(URL|KEY)$/);
  if (m) configuredProfiles.add(m[1]);
}

if (configuredProfiles.size > 1 && !profileOverride) {
  console.error('Multiple profiles configured — --profile is required.');
  console.error('');
  console.error('Available profiles:');
  for (const p of configuredProfiles) console.error(`  --profile ${p}`);
  process.exit(1);
}

const profile = profileOverride || config.EMAIL_DRAFTER_DEFAULT_PROFILE || null;

let url, key;

if (profile) {
  const prefix = `EMAIL_DRAFTER_PROFILE_${profile}`;
  url = config[`${prefix}_URL`];
  key = config[`${prefix}_KEY`];

  if (!url || !key) {
    console.error(`Profile "${profile}" not found in config.`);
    console.error(`Expected: ${prefix}_URL and ${prefix}_KEY in ${configPath}`);
    console.error('');
    console.error('Available profiles:');
    const profiles = new Set();
    for (const k of Object.keys(config)) {
      const m = k.match(/^EMAIL_DRAFTER_PROFILE_(.+?)_(URL|KEY)$/);
      if (m) profiles.add(m[1]);
    }
    if (profiles.size === 0) {
      console.error('  (none configured)');
    } else {
      for (const p of profiles) console.error(`  ${p}`);
    }
    process.exit(1);
  }
} else {
  // Legacy single-profile fallback
  url = config.EMAIL_DRAFTER_URL;
  key = config.EMAIL_DRAFTER_KEY;
}

if (!url || !key) {
  console.error('Email drafter not configured.');
  console.error('See email-draft-expert skill for setup instructions.');
  process.exit(1);
}

if (!url.startsWith('http')) {
  console.error('EMAIL_DRAFTER_URL is empty or invalid. Complete setup first.');
  console.error('See email-draft-expert skill for Steps 3-4 (deploy Apps Script, save URL).');
  process.exit(1);
}

// --- Cache ---
const cacheDir = resolve(
  process.env.HOME || process.env.USERPROFILE,
  '.cache', 'email-drafter',
  profile || 'default'
);

function readCache(subdir, id, filename) {
  const p = join(cacheDir, subdir, id, filename);
  try {
    return readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

function writeCache(subdir, id, filename, data) {
  const dir = join(cacheDir, subdir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), data);
}

function deleteCache(subdir, id) {
  const dir = join(cacheDir, subdir, id);
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore — cache dir may not exist
  }
}

// --- Gateway version check ---
// Cached per session to avoid repeated GET requests.
let gatewayVersion = null;

async function getGatewayVersion() {
  if (gatewayVersion !== null) return gatewayVersion;
  try {
    const res = await fetch(url, {
      headers: { 'Connection': 'close' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const info = await res.json();
      gatewayVersion = info.version || '0.0.0';
    } else {
      gatewayVersion = '0.0.0';
    }
  } catch {
    gatewayVersion = '0.0.0';
  }
  return gatewayVersion;
}

function versionAtLeast(version, minimum) {
  const vParts = version.split('.').map(Number);
  const mParts = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const v = vParts[i] || 0;
    const m = mParts[i] || 0;
    if (v > m) return true;
    if (v < m) return false;
  }
  return true;
}

// --- Client-side MIME flow ---

async function cachedFetchDraftRaw(draftId) {
  if (!refresh) {
    const cachedMeta = readCache('draft-raw', draftId, 'meta.json');
    if (cachedMeta) {
      const meta = JSON.parse(cachedMeta);
      // Check if messageId is still current
      const metaResult = await postGateway({ action: 'draft-meta', draftId });
      if (metaResult.ok && metaResult.messageId === meta.messageId) {
        const cachedRaw = readCache('draft-raw', draftId, 'raw.eml');
        if (cachedRaw) {
          console.error(`Draft MIME${profileLabel}: ${draftId} (cached)`);
          return { raw: cachedRaw, messageId: meta.messageId, threadId: meta.threadId };
        }
      }
    }
  }

  // Cache miss or stale — fetch full raw MIME
  const result = await postGateway({ action: 'draft-raw', draftId });
  if (!result.ok) {
    console.error(`Failed to fetch draft raw: ${result.error}`);
    process.exit(1);
  }

  // Cache the result
  writeCache('draft-raw', draftId, 'meta.json', JSON.stringify({
    messageId: result.messageId,
    threadId: result.threadId,
    cachedAt: new Date().toISOString(),
  }));
  writeCache('draft-raw', draftId, 'raw.eml', result.raw);

  return { raw: result.raw, messageId: result.messageId, threadId: result.threadId };
}

async function postRawUpdate(draftId, rawMime, threadId) {
  const result = await postGateway({
    action: 'raw-update',
    draftId,
    raw: rawMime,
    threadId,
  });
  if (!result.ok) {
    console.error(`Failed to update draft: ${result.error}`);
    process.exit(1);
  }
  // Invalidate cache after update
  deleteCache('draft-raw', draftId);
  return result;
}

// --- Inline image helpers ---

/**
 * Scan markdown for local image references and rewrite to cid: URLs.
 * Returns { images: [{ cid, filePath, filename, mimeType }], rewrittenMd }
 */
function extractLocalImages(md, basePath) {
  const images = [];
  const rewrittenMd = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    // Skip URLs and already-cid references
    if (/^https?:\/\//.test(src) || src.startsWith('cid:') || src.startsWith('data:')) {
      return match;
    }

    const filePath = resolve(basePath, src);
    if (!existsSync(filePath)) {
      console.error(`Warning: image not found, leaving reference unchanged: ${src}`);
      return match;
    }

    const cid = `img-${images.length}`;
    images.push({
      cid,
      filePath,
      filename: basename(filePath),
      mimeType: guessMimeType(filePath),
    });

    return `![${alt}](cid:${cid})`;
  });

  return { images, rewrittenMd };
}

/**
 * Attach inline images to a draft via the gateway.
 */
async function attachInlineImages(draftId, images) {
  for (const img of images) {
    const content = readFileSync(img.filePath);
    const base64 = content.toString('base64');
    const result = await postGateway({
      action: 'attach',
      draftId,
      filename: img.filename,
      mimeType: img.mimeType,
      content: base64,
      contentId: img.cid,
    });
    if (!result.ok) {
      console.error(`Warning: failed to attach inline image ${img.filename}: ${result.error}`);
    } else {
      console.error(`Attached inline: ${img.filename} (cid:${img.cid})`);
    }
  }
}

/**
 * Read markdown from file or stdin, parse frontmatter and inline images, convert to HTML.
 * Returns { html, frontmatter, images, subject }
 */
function prepareMarkdown(fileOrStdin, basePath) {
  let md;
  if (typeof fileOrStdin === 'string') {
    md = readFileSync(fileOrStdin, 'utf-8');
  } else {
    md = readFileSync(0, 'utf-8');
  }

  let frontmatter = {};
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    md = md.slice(fmMatch[0].length);
    for (const line of fmMatch[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) frontmatter[m[1].toLowerCase()] = m[2].trim();
    }
  }

  // Extract local images and rewrite markdown
  const { images, rewrittenMd } = extractLocalImages(md, basePath);
  md = rewrittenMd;

  const h1Match = md.match(/^#\s+(.+)$/m);
  const subject = frontmatter.subject || (h1Match ? h1Match[1] : null);

  // marked is sync despite being importable — use it directly
  const bodyHtml = marked.parse(md);
  const html = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head>\n<body>\n${bodyHtml}\n</body></html>`;

  return { html, frontmatter, images, subject };
}

// --- Dry-run summary ---

function printDryRunSummary(action, beforeState, afterState) {
  console.error(`\n[DRY RUN] ${action} — no changes applied\n`);

  // Subject
  if (beforeState.subject !== afterState.subject) {
    console.error(`  Subject: "${beforeState.subject}" → "${afterState.subject}"`);
  } else {
    console.error(`  Subject: "${afterState.subject}"`);
  }

  // To
  if (beforeState.to !== afterState.to) {
    console.error(`  To: "${beforeState.to}" → "${afterState.to}"`);
  }

  // Cc
  if (beforeState.cc !== afterState.cc) {
    console.error(`  Cc: "${beforeState.cc || ''}" → "${afterState.cc || ''}"`);
  }

  // Body
  const beforeLen = (beforeState.htmlBody || '').length;
  const afterLen = (afterState.htmlBody || '').length;
  if (beforeLen !== afterLen) {
    console.error(`  Body: ${beforeLen} chars → ${afterLen} chars`);
  }

  // Attachments
  const beforeNames = (beforeState.attachments || []).map(a => a.filename);
  const afterNames = (afterState.attachments || []).map(a => a.filename);
  const added = afterNames.filter(n => !beforeNames.includes(n));
  const removed = beforeNames.filter(n => !afterNames.includes(n));

  if (added.length > 0) {
    console.error(`  Attachments added: ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    console.error(`  Attachments removed: ${removed.join(', ')}`);
  }
  if (added.length === 0 && removed.length === 0) {
    console.error(`  Attachments: ${afterNames.length} (unchanged)`);
  }
  console.error('');
}

// --- Execute action ---
const profileLabel = profile ? ` [${profile}]` : '';

if (action === 'list') {
  await doList();
} else if (action === 'thread') {
  await doThread();
} else if (action === 'read') {
  await doRead();
} else if (action === 'reply') {
  await doReply();
} else if (action === 'download') {
  await doDownload();
} else if (action === 'list-drafts') {
  await doListDrafts();
} else if (action === 'read-draft') {
  await doReadDraft();
} else if (action === 'edit') {
  await doEdit();
} else if (action === 'attach') {
  await doAttach();
} else if (action === 'detach') {
  await doDetach();
} else if (action === 'configure') {
  await doConfigure();
} else if (action === 'update') {
  await doUpdate();
} else {
  await doDraft();
}

// --- Action handlers ---

async function doDraft() {
  const basePath = file ? dirname(resolve(file)) : process.cwd();
  const { html, frontmatter, images, subject: fmSubject } = prepareMarkdown(file || 0, basePath);

  const to = toOverride || frontmatter.to || null;
  const cc = ccOverride || frontmatter.cc || null;
  const subject = subjectOverride || fmSubject || 'Draft';

  console.error(`Publishing${profileLabel}: "${subject}"`);
  console.error(`Source: ${file || 'stdin'}`);

  // Include inline images in the draft payload so CID references and image parts
  // are in the same MIME from the start. Gmail strips unresolved CID refs if the
  // image parts aren't present at creation time.
  const inlineImages = images.map(img => ({
    filename: img.filename,
    mimeType: img.mimeType,
    content: readFileSync(img.filePath).toString('base64'),
    contentId: img.cid,
  }));

  const result = await postGateway({
    action: 'draft', subject, html,
    ...(to && { to }), ...(cc && { cc }),
    ...(inlineImages.length > 0 && { inlineImages }),
  });

  if (result.ok) {
    for (const img of images) {
      console.error(`Attached inline: ${img.filename} (cid:${img.cid})`);
    }
    console.error(`Draft created${profileLabel}: "${result.subject}" (draftId: ${result.draftId})`);
    console.error('Open Gmail > Drafts > review and send.');
  } else {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }
}

async function doList() {
  console.error(`Listing labeled threads${profileLabel}...`);
  const result = await postGateway({ action: 'list' });

  if (!result.ok) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  if (result.threads.length === 0) {
    console.error(`No threads with label "${result.label}".`);
    return;
  }

  console.log(JSON.stringify(result.threads, null, 2));
  console.error(`${result.count} thread(s) with label "${result.label}".`);
}

async function doThread() {
  // Check cache first
  if (!refresh) {
    const cached = readCache('threads', targetId, 'thread.json');
    if (cached) {
      console.error(`Thread${profileLabel}: ${targetId} (cached)`);
      console.log(cached);
      return;
    }
  }

  console.error(`Fetching thread${profileLabel}: ${targetId}`);
  const result = await postGateway({ action: 'thread', threadId: targetId });

  if (!result.ok) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  const json = JSON.stringify(result, null, 2);
  writeCache('threads', targetId, 'thread.json', json);
  console.log(json);
  console.error(`${result.messageCount} message(s) in thread "${result.subject}".`);
}

async function doRead() {
  console.error(`Reading message${profileLabel}: ${targetId}`);
  const result = await postGateway({ action: 'read', messageId: targetId });

  if (!result.ok) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  console.log(JSON.stringify(result.message, null, 2));
}

async function doReply() {
  const basePath = file ? dirname(resolve(file)) : process.cwd();
  let md;
  if (file) {
    md = readFileSync(file, 'utf-8');
  } else {
    md = readFileSync(0, 'utf-8');
  }

  // Strip frontmatter if present (reply doesn't need to/subject)
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    md = md.slice(fmMatch[0].length);
  }

  // Extract local images
  const { images, rewrittenMd } = extractLocalImages(md, basePath);
  md = rewrittenMd;

  const bodyHtml = marked.parse(md);
  const html = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head>\n<body>\n${bodyHtml}\n</body></html>`;

  console.error(`Drafting reply${profileLabel} to message: ${targetId}`);
  console.error(`Source: ${file || 'stdin'}`);

  const payload = {
    action: 'reply',
    messageId: targetId,
    html,
    replyAll: !replySenderOnly,
  };
  if (ccOverride) payload.cc = ccOverride;

  const result = await postGateway(payload);

  if (result.ok) {
    // Attach inline images if any
    if (images.length > 0 && result.draftId) {
      await attachInlineImages(result.draftId, images);
    }
    console.error(`Reply draft created${profileLabel}: "${result.subject}" (draftId: ${result.draftId})`);
    console.error('Open Gmail > Drafts > review and send.');
  } else {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }
}

async function doDownload() {
  const dir = outputDir || join(cacheDir, 'messages', targetId);
  const metaPath = join(dir, 'meta.json');

  // Check cache first
  if (!refresh && existsSync(metaPath)) {
    console.error(`Download${profileLabel}: ${targetId} (cached)`);
    console.log(readFileSync(metaPath, 'utf-8'));
    return;
  }

  mkdirSync(dir, { recursive: true });

  console.error(`Fetching raw message${profileLabel}: ${targetId}`);
  const result = await postGateway({ action: 'raw', messageId: targetId });

  if (!result.ok) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  // Save the full .eml file
  const emlPath = join(dir, `${targetId}.eml`);
  writeFileSync(emlPath, result.raw);
  console.error(`Saved: ${emlPath} (${result.size} bytes)`);

  // Parse MIME and extract attachments (postal-mime handles nested multipart)
  const files = [];
  const attachments = await parseAttachments(result.raw);
  if (attachments.length > 0) {
    const usedNames = {};
    for (const att of attachments) {
      if (!att.filename) continue;
      // Deduplicate filenames: image.png → image.png, image_2.png, image_3.png
      let filename = att.filename;
      if (usedNames[filename]) {
        usedNames[filename]++;
        const dotIdx = filename.lastIndexOf('.');
        if (dotIdx > 0) {
          filename = filename.slice(0, dotIdx) + '_' + usedNames[filename] + filename.slice(dotIdx);
        } else {
          filename = filename + '_' + usedNames[filename];
        }
      } else {
        usedNames[filename] = 1;
      }
      const outPath = join(dir, filename);
      writeFileSync(outPath, att.content);
      console.error(`Extracted: ${outPath} (${att.content.length} bytes)`);
      files.push({ name: filename, path: outPath, size: att.content.length });
    }
    if (files.length === 0) {
      console.error('No attachments found.');
    }
  } else {
    console.error('No attachments found.');
  }

  // Write meta and output
  const meta = { messageId: result.messageId, eml: emlPath, size: result.size, files };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta, null, 2));
}

async function doListDrafts() {
  console.error(`Listing AI-managed drafts${profileLabel}...`);
  const result = await postGateway({ action: 'list-drafts' });

  if (!result.ok) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  if (result.drafts.length === 0) {
    console.error(`No AI-managed drafts (label: "${result.draftLabel}").`);
    return;
  }

  console.log(JSON.stringify(result.drafts, null, 2));
  console.error(`${result.count} AI-managed draft(s) (label: "${result.draftLabel}").`);
}

async function doReadDraft() {
  console.error(`Reading draft${profileLabel}: ${targetId}`);
  const result = await postGateway({ action: 'read-draft', draftId: targetId });

  if (!result.ok) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

async function doEdit() {
  let html = null;
  let images = [];

  // Read body from file if provided (edit does not read stdin — use a file for body updates)
  if (file) {
    const basePath = dirname(resolve(file));
    const prepared = prepareMarkdown(file, basePath);
    html = prepared.html;
    images = prepared.images;
  }

  // Validate: at least one field to update
  if (!subjectOverride && !toOverride && ccOverride === null && !html) {
    console.error('edit requires at least one update: --subject, --to, --cc, or a body file');
    process.exit(1);
  }

  console.error(`Editing draft${profileLabel}: ${targetId}${dryRun ? ' (dry run)' : ''}`);

  const gwVersion = await getGatewayVersion();
  if (versionAtLeast(gwVersion, '3.3.0')) {
    // Client-side MIME flow
    const { raw, threadId } = await cachedFetchDraftRaw(targetId);
    const state = await parseDraftState(raw);
    const beforeState = { ...state, attachments: [...state.attachments] };

    // Override provided fields, preserve the rest
    if (subjectOverride) state.subject = subjectOverride;
    if (toOverride) state.to = toOverride;
    if (ccOverride !== null) state.cc = ccOverride;
    if (html) state.htmlBody = html;

    // Add inline images as CID attachments if body was updated
    if (images.length > 0) {
      for (const img of images) {
        state.attachments.push({
          filename: img.filename,
          mimeType: img.mimeType,
          base64: readFileSync(img.filePath).toString('base64'),
          contentId: img.cid,
        });
      }
    }

    if (dryRun) {
      printDryRunSummary('edit', beforeState, state);
      return;
    }

    const newMime = buildMime(state);
    await postRawUpdate(targetId, newMime, threadId);
    console.error(`Draft updated${profileLabel}: "${state.subject}" (draftId: ${targetId})`);
  } else {
    // Fallback: server-side flow for gateway < 3.3
    const payload = { action: 'edit', draftId: targetId };
    if (subjectOverride) payload.subject = subjectOverride;
    if (toOverride) payload.to = toOverride;
    if (ccOverride !== null) payload.cc = ccOverride;
    if (html) payload.html = html;

    const result = await postGateway(payload);

    if (result.ok) {
      if (images.length > 0) {
        await attachInlineImages(targetId, images);
      }
      console.error(`Draft updated${profileLabel}: "${result.subject}" (draftId: ${result.draftId})`);
    } else {
      console.error(`Failed: ${result.error}`);
      process.exit(1);
    }
  }
}

async function doAttach() {
  // Validate all files upfront before making any gateway calls
  const validated = [];
  for (const entry of files) {
    const filePath = resolve(entry.path);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const stats = statSync(filePath);
    if (stats.size > MAX_ATTACH_SIZE) {
      console.error(`File too large: ${basename(filePath)} is ${(stats.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_ATTACH_SIZE / 1024 / 1024}MB)`);
      process.exit(1);
    }
    if (stats.size > WARN_ATTACH_SIZE) {
      console.error(`Warning: large file ${basename(filePath)} (${(stats.size / 1024 / 1024).toFixed(1)}MB) — may be slow to upload`);
    }
    validated.push({
      filePath,
      filename: (files.length === 1 && filenameOverride) ? filenameOverride : basename(filePath),
      mimeType: (files.length === 1 && mimeTypeOverride) ? mimeTypeOverride : guessMimeType(filePath),
      contentId: entry.contentId || null,
      size: stats.size,
    });
  }

  for (const v of validated) {
    console.error(`Attaching${profileLabel}: ${v.filename} (${v.mimeType}, ${(v.size / 1024).toFixed(1)}KB)`);
  }

  const gwVersion = await getGatewayVersion();
  if (versionAtLeast(gwVersion, '3.3.0')) {
    // Client-side MIME flow — parse once, add all, rebuild once
    const { raw, threadId } = await cachedFetchDraftRaw(targetId);
    const state = await parseDraftState(raw);
    const beforeState = { ...state, attachments: [...state.attachments] };

    for (const v of validated) {
      state.attachments.push({
        filename: v.filename,
        mimeType: v.mimeType,
        base64: readFileSync(v.filePath).toString('base64'),
        contentId: v.contentId,
      });
    }

    if (dryRun) {
      printDryRunSummary('attach', beforeState, state);
      return;
    }

    const newMime = buildMime(state);
    await postRawUpdate(targetId, newMime, threadId);
    const names = validated.map(v => v.filename).join(', ');
    console.error(`Attached${profileLabel}: ${names} to draft ${targetId}`);
  } else {
    // Fallback: server-side flow — one call per file
    if (dryRun) {
      console.error(`\n[DRY RUN] attach — no changes applied\n`);
      for (const v of validated) {
        console.error(`  Would attach: ${v.filename} (${v.mimeType})`);
      }
      console.error('');
      return;
    }

    for (const v of validated) {
      const payload = {
        action: 'attach',
        draftId: targetId,
        filename: v.filename,
        mimeType: v.mimeType,
        content: readFileSync(v.filePath).toString('base64'),
      };
      if (v.contentId) payload.contentId = v.contentId;

      const result = await postGateway(payload);
      if (result.ok) {
        console.error(`Attached${profileLabel}: ${result.attached} to draft ${result.draftId}`);
      } else {
        console.error(`Failed: ${result.error}`);
        process.exit(1);
      }
    }
  }
}

async function doDetach() {
  console.error(`Detaching${profileLabel}: "${filenameOverride}" from draft ${targetId}${dryRun ? ' (dry run)' : ''}`);

  const gwVersion = await getGatewayVersion();
  if (versionAtLeast(gwVersion, '3.3.0')) {
    // Client-side MIME flow
    const { raw, threadId } = await cachedFetchDraftRaw(targetId);
    const state = await parseDraftState(raw);
    const beforeState = { ...state, attachments: [...state.attachments] };

    const idx = state.attachments.findIndex(a => a.filename === filenameOverride);
    if (idx === -1) {
      console.error(`Failed: attachment "${filenameOverride}" not found in draft`);
      process.exit(1);
    }
    state.attachments.splice(idx, 1);

    if (dryRun) {
      printDryRunSummary('detach', beforeState, state);
      return;
    }

    const newMime = buildMime(state);
    await postRawUpdate(targetId, newMime, threadId);
    console.error(`Detached${profileLabel}: ${filenameOverride} from draft ${targetId}`);
  } else {
    // Fallback: server-side flow for gateway < 3.3
    const result = await postGateway({
      action: 'detach',
      draftId: targetId,
      filename: filenameOverride,
    });

    if (result.ok) {
      console.error(`Detached${profileLabel}: ${result.detached} from draft ${result.draftId}`);
    } else {
      console.error(`Failed: ${result.error}`);
      process.exit(1);
    }
  }
}

async function doConfigure() {
  const payload = { action: 'configure' };

  if (toOverride !== null) payload.to = toOverride;
  if (ccOverride !== null) payload.cc = ccOverride;
  if (maxResultsOverride !== null) payload.maxResults = maxResultsOverride;
  if (defaultSubjectOverride !== null) payload.defaultSubject = defaultSubjectOverride;

  // Check that at least one config field was provided
  const configFields = Object.keys(payload).filter(k => k !== 'action');
  if (configFields.length === 0) {
    console.error('configure requires at least one config flag:');
    console.error('  --to <addr>              Default recipients');
    console.error('  --cc <addr>              Default CC recipients');
    console.error('  --max-results <n>        Max threads from list');
    console.error('  --default-subject <s>    Fallback subject line');
    process.exit(1);
  }

  console.error(`Configuring gateway${profileLabel}...`);
  const result = await postGateway(payload);

  if (result.ok) {
    console.error(`Configured${profileLabel}: ${result.updated.join(', ')}`);
  } else {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }
}

async function doUpdate() {
  // Read local gateway version from apps-script.js
  const skillDir = dirname(fileURLToPath(import.meta.url));
  const scriptPath = join(skillDir, 'apps-script.js');
  const scriptContent = readFileSync(scriptPath, 'utf-8');

  const localVersionMatch = scriptContent.match(/var GATEWAY_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!localVersionMatch) {
    console.error('Could not read GATEWAY_VERSION from local apps-script.js');
    process.exit(1);
  }
  const localVersion = localVersionMatch[1];

  // Check remote gateway version via GET
  console.error(`Checking gateway version${profileLabel}...`);
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    console.error('Check your network connection and verify the gateway URL is correct.');
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Gateway error (HTTP ${res.status}): ${res.statusText}`);
    process.exit(1);
  }
  const info = await res.json();
  const remoteVersion = info.version || 'unknown';

  console.error(`  Local:  v${localVersion}`);
  console.error(`  Remote: v${remoteVersion}`);

  if (remoteVersion === localVersion) {
    console.log(`Gateway${profileLabel} is up to date (v${localVersion}).`);
    return;
  }

  // Copy apps-script.js to clipboard
  copyToClipboard(scriptContent);
  console.log(`Update available: v${remoteVersion} → v${localVersion}`);
  console.log('');
  console.log('Code copied to clipboard. To update:');
  console.log('  1. Open Apps Script editor for this deployment');
  console.log('  2. Select all in Code.gs and paste (Ctrl+A, Ctrl+V)');
  console.log('  3. Save (Ctrl+S)');
  console.log('  4. Deploy > Manage deployments > Edit > New version > Deploy');
  const localMajor = parseInt(localVersion, 10) || 0;
  const remoteMajor = parseInt(remoteVersion, 10) || 0;
  if (localMajor >= 3 && remoteMajor < 3) {
    console.log('');
    console.log('v3.0+ requires Gmail Advanced Service:');
    console.log('  5. In Apps Script editor: Services (+) > Gmail API > Add');
    console.log('  6. In Script Properties: add draftLabelName (e.g., "email-drafter")');
  }
}

function copyToClipboard(text) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      execSync('clip', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else if (platform === 'darwin') {
      execSync('pbcopy', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else {
      // Linux — try xclip, fall back to xsel
      try {
        execSync('xclip -selection clipboard', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
      } catch {
        execSync('xsel --clipboard --input', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
      }
    }
  } catch {
    console.error('Could not copy to clipboard. The code is in:');
    console.error(`  ${join(dirname(fileURLToPath(import.meta.url)), 'apps-script.js')}`);
  }
}

// --- Gateway client ---

async function postGateway(payload) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Connection': 'close' },
      body: JSON.stringify({ key, ...payload }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    console.error('Check your network connection and verify the Apps Script deployment is active.');
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`Gateway error (HTTP ${res.status}): ${res.statusText}`);
    console.error('Check your network connection and verify the Apps Script deployment is active.');
    process.exit(1);
  }

  return res.json();
}
