import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, openSync, ftruncateSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);
const SKILL_DIR = resolve(import.meta.dirname, '..');
const PUBLISH = join(SKILL_DIR, 'publish.mjs');

// Temp dirs for config and cache
const TMP = join(tmpdir(), `email-draft-test-${process.pid}`);
const CONFIG_DIR = join(TMP, '.config', 'email-drafter');
const CACHE_DIR = join(TMP, '.cache', 'email-drafter', 'test');
const CONFIG_PATH = join(CONFIG_DIR, 'config.env');

// Mock gateway responses keyed by action
let mockResponses = {};
let lastRequest = null;
let requestHistory = [];
let mockGetResponse = { status: 'ok', version: '3.0' };
let server;
let serverUrl;

function setMockResponse(action, response) {
  mockResponses[action] = response;
}

async function runCli(args, { stdin, env } = {}) {
  const fullEnv = {
    ...process.env,
    HOME: TMP,
    USERPROFILE: TMP,
    ...env,
  };

  try {
    const { stdout, stderr } = await execFileAsync('node', [PUBLISH, ...args], {
      cwd: TMP,
      env: fullEnv,
      timeout: 10000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.code || 1 };
  }
}

// --- Setup / Teardown ---

before(async () => {
  // Start mock HTTP server
  server = createServer((req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockGetResponse));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      lastRequest = JSON.parse(body);
      requestHistory.push(lastRequest);
      const action = lastRequest.action || 'draft';
      const response = mockResponses[action] || { error: `no mock for action: ${action}` };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  serverUrl = `http://127.0.0.1:${addr.port}`;

  // Write config
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, [
    'EMAIL_DRAFTER_DEFAULT_PROFILE=test',
    `EMAIL_DRAFTER_PROFILE_test_URL=${serverUrl}`,
    'EMAIL_DRAFTER_PROFILE_test_KEY=test-key-123',
  ].join('\n'));
});

after(() => {
  server.close();
  rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  mockResponses = {};
  lastRequest = null;
  requestHistory = [];
  mockGetResponse = { status: 'ok', version: '3.0' };
  // Clear cache between tests
  rmSync(CACHE_DIR, { recursive: true, force: true });
});

// --- Tests ---

describe('CLI arg parsing', () => {
  it('shows usage on --help', async () => {
    const { stdout, exitCode } = await runCli(['--help']);
    assert.equal(exitCode, 0);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /thread/);
    assert.match(stdout, /download/);
    assert.match(stdout, /configure/);
    assert.match(stdout, /update/);
    assert.match(stdout, /list-drafts/);
    assert.match(stdout, /read-draft/);
    assert.match(stdout, /edit/);
    assert.match(stdout, /attach/);
    assert.match(stdout, /detach/);
  });

  it('exits with error when no profile and no default', async () => {
    // Override config with no default
    writeFileSync(CONFIG_PATH, [
      `EMAIL_DRAFTER_PROFILE_a_URL=${serverUrl}`,
      'EMAIL_DRAFTER_PROFILE_a_KEY=key1',
      `EMAIL_DRAFTER_PROFILE_b_URL=${serverUrl}`,
      'EMAIL_DRAFTER_PROFILE_b_KEY=key2',
    ].join('\n'));

    const { stderr, exitCode } = await runCli(['list']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /--profile is required/);

    // Restore config
    writeFileSync(CONFIG_PATH, [
      'EMAIL_DRAFTER_DEFAULT_PROFILE=test',
      `EMAIL_DRAFTER_PROFILE_test_URL=${serverUrl}`,
      'EMAIL_DRAFTER_PROFILE_test_KEY=test-key-123',
    ].join('\n'));
  });

  it('thread requires --id', async () => {
    const { stderr, exitCode } = await runCli(['thread', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /thread requires --id/);
  });

  it('download requires --id', async () => {
    const { stderr, exitCode } = await runCli(['download', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /download requires --id/);
  });

  it('read requires --id', async () => {
    const { stderr, exitCode } = await runCli(['read', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /read requires --id/);
  });

  it('reply requires --id', async () => {
    const { stderr, exitCode } = await runCli(['reply', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /reply requires --id/);
  });

  it('raw is alias for download', async () => {
    const { stderr, exitCode } = await runCli(['raw', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /download requires --id/);
  });

  it('rejects path traversal in --id', async () => {
    const { stderr, exitCode } = await runCli(['thread', '--profile', 'test', '--id', '../../etc']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /Invalid --id value/);
  });

  it('accepts valid --id with hyphens and underscores', async () => {
    setMockResponse('thread', { ok: false, error: 'not found' });
    const { exitCode } = await runCli(['thread', '--profile', 'test', '--id', 'msg_abc-123']);
    // Should reach the gateway (not rejected by validation)
    assert.equal(lastRequest.threadId, 'msg_abc-123');
  });

  it('read-draft requires --id', async () => {
    const { stderr, exitCode } = await runCli(['read-draft', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /read-draft requires --id/);
  });

  it('edit requires --id', async () => {
    const { stderr, exitCode } = await runCli(['edit', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /edit requires --id/);
  });

  it('attach requires --id', async () => {
    const { stderr, exitCode } = await runCli(['attach', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /attach requires --id/);
  });

  it('attach requires a file', async () => {
    const { stderr, exitCode } = await runCli(['attach', '--profile', 'test', '--id', 'draft1']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /attach requires at least one file/);
  });

  it('detach requires --id', async () => {
    const { stderr, exitCode } = await runCli(['detach', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /detach requires --id/);
  });

  it('detach requires --filename', async () => {
    const { stderr, exitCode } = await runCli(['detach', '--profile', 'test', '--id', 'draft1']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /detach requires --filename/);
  });
});

describe('list action', () => {
  it('sends list action to gateway and outputs thread summaries', async () => {
    const threads = [
      { threadId: 't1', subject: 'Hello', messageCount: 2, lastDate: '2026-01-01T00:00:00Z', snippet: 'Hi there' },
      { threadId: 't2', subject: 'World', messageCount: 1, lastDate: '2026-01-02T00:00:00Z', snippet: 'Bye' },
    ];
    setMockResponse('list', { ok: true, label: 'leah-read', count: 2, threads });

    const { stdout, stderr, exitCode } = await runCli(['list', '--profile', 'test']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /2 thread\(s\)/);

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].threadId, 't1');

    // Verify gateway received correct payload
    assert.equal(lastRequest.action, 'list');
    assert.equal(lastRequest.key, 'test-key-123');
  });

  it('handles empty list', async () => {
    setMockResponse('list', { ok: true, label: 'leah-read', count: 0, threads: [] });

    const { stderr, exitCode } = await runCli(['list', '--profile', 'test']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /No threads/);
  });

  it('reports gateway errors', async () => {
    setMockResponse('list', { ok: false, error: 'label not found' });

    const { stderr, exitCode } = await runCli(['list', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /label not found/);
  });
});

describe('thread action', () => {
  const threadResponse = {
    ok: true,
    threadId: 'thread-abc',
    subject: 'Test Thread',
    messageCount: 2,
    messages: [
      { id: 'msg1', from: 'alice@test.com', date: '2026-01-01T00:00:00Z', body: 'Hello', attachments: [] },
      { id: 'msg2', from: 'bob@test.com', date: '2026-01-01T01:00:00Z', body: 'Reply', attachments: [] },
    ],
  };

  it('fetches thread and outputs JSON', async () => {
    setMockResponse('thread', threadResponse);

    const { stdout, stderr, exitCode } = await runCli(['thread', '--profile', 'test', '--id', 'thread-abc']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /2 message\(s\)/);

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.threadId, 'thread-abc');
    assert.equal(parsed.messages.length, 2);

    assert.equal(lastRequest.action, 'thread');
    assert.equal(lastRequest.threadId, 'thread-abc');
  });

  it('caches thread on first fetch', async () => {
    setMockResponse('thread', threadResponse);

    // First call — hits gateway
    await runCli(['thread', '--profile', 'test', '--id', 'thread-abc']);
    assert.equal(lastRequest.threadId, 'thread-abc');

    // Reset to detect if gateway is called again
    lastRequest = null;

    // Second call — should use cache, not hit gateway
    const { stdout, stderr, exitCode } = await runCli(['thread', '--profile', 'test', '--id', 'thread-abc']);
    assert.equal(exitCode, 0);
    assert.equal(lastRequest, null); // Gateway was NOT called
    assert.match(stderr, /cached/);

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.threadId, 'thread-abc');
  });

  it('--refresh busts cache', async () => {
    setMockResponse('thread', threadResponse);

    // First call — populates cache
    await runCli(['thread', '--profile', 'test', '--id', 'thread-abc']);
    lastRequest = null;

    // Second call with --refresh — should hit gateway
    const { exitCode } = await runCli(['thread', '--profile', 'test', '--id', 'thread-abc', '--refresh']);
    assert.equal(exitCode, 0);
    assert.notEqual(lastRequest, null); // Gateway WAS called
    assert.equal(lastRequest.threadId, 'thread-abc');
  });

  it('reports access denied error', async () => {
    setMockResponse('thread', { ok: false, error: 'access denied — thread does not have "leah-read" label' });

    const { stderr, exitCode } = await runCli(['thread', '--profile', 'test', '--id', 'thread-xyz']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /access denied/);
  });
});

describe('read action', () => {
  it('fetches single message', async () => {
    setMockResponse('read', {
      ok: true,
      message: { id: 'msg1', from: 'alice@test.com', subject: 'Hi', body: 'Hello world', attachments: [] },
    });

    const { stdout, exitCode } = await runCli(['read', '--profile', 'test', '--id', 'msg1']);
    assert.equal(exitCode, 0);

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.id, 'msg1');
    assert.equal(parsed.body, 'Hello world');
  });
});

describe('reply action', () => {
  it('sends reply with markdown body', async () => {
    setMockResponse('reply', { ok: true, draftId: 'draft1', messageId: 'msg-new', subject: 'Re: Hello' });

    const mdFile = join(TMP, 'reply.md');
    writeFileSync(mdFile, 'Thanks for your message!');

    const { stderr, exitCode } = await runCli(['reply', '--profile', 'test', '--id', 'msg1', mdFile]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Reply draft created/);
    assert.match(stderr, /draftId: draft1/);

    assert.equal(lastRequest.action, 'reply');
    assert.equal(lastRequest.messageId, 'msg1');
    assert.equal(lastRequest.replyAll, true);
    assert.match(lastRequest.html, /Thanks for your message/);
  });

  it('respects --reply-sender-only', async () => {
    setMockResponse('reply', { ok: true, draftId: 'draft2', messageId: 'msg-new', subject: 'Re: Hello' });

    const mdFile = join(TMP, 'reply2.md');
    writeFileSync(mdFile, 'Direct reply');

    await runCli(['reply', '--profile', 'test', '--id', 'msg1', '--reply-sender-only', mdFile]);
    assert.equal(lastRequest.replyAll, false);
  });
});

describe('draft action', () => {
  it('creates draft with frontmatter and returns draftId', async () => {
    setMockResponse('draft', { ok: true, subject: 'Test Subject', draftId: 'draft-abc', messageId: 'msg-abc' });

    const mdFile = join(TMP, 'draft.md');
    writeFileSync(mdFile, '---\nto: bob@test.com\nsubject: Test Subject\n---\n\nHello Bob!');

    const { stderr, exitCode } = await runCli(['draft', '--profile', 'test', mdFile]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Draft created/);
    assert.match(stderr, /draftId: draft-abc/);

    assert.equal(lastRequest.action, 'draft');
    assert.equal(lastRequest.to, 'bob@test.com');
    assert.equal(lastRequest.subject, 'Test Subject');
    assert.match(lastRequest.html, /Hello Bob/);
  });

  it('CLI flags override frontmatter', async () => {
    setMockResponse('draft', { ok: true, subject: 'Override', draftId: 'draft-x', messageId: 'msg-x' });

    const mdFile = join(TMP, 'draft2.md');
    writeFileSync(mdFile, '---\nto: original@test.com\nsubject: Original\n---\n\nBody');

    await runCli(['draft', '--profile', 'test', '--to', 'override@test.com', '--subject', 'Override', mdFile]);
    assert.equal(lastRequest.to, 'override@test.com');
    assert.equal(lastRequest.subject, 'Override');
  });

  it('falls back to h1 for subject', async () => {
    setMockResponse('draft', { ok: true, subject: 'My Heading', draftId: 'draft-h1', messageId: 'msg-h1' });

    const mdFile = join(TMP, 'draft3.md');
    writeFileSync(mdFile, '# My Heading\n\nBody text');

    await runCli(['draft', '--profile', 'test', '--to', 'x@test.com', mdFile]);
    assert.equal(lastRequest.subject, 'My Heading');
  });
});

describe('download action', () => {
  const pdfContent = Buffer.from('fake pdf content');
  const pdfB64 = pdfContent.toString('base64');

  const rawEmail = [
    'From: alice@test.com',
    'To: bob@test.com',
    'Subject: With Attachment',
    'Content-Type: multipart/mixed; boundary="----=_Part_1"',
    '',
    '------=_Part_1',
    'Content-Type: text/plain',
    '',
    'Body text',
    '------=_Part_1',
    'Content-Type: application/pdf',
    'Content-Disposition: attachment; filename="report.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    pdfB64,
    '------=_Part_1--',
  ].join('\r\n');

  it('downloads raw and extracts attachments', async () => {
    setMockResponse('raw', { ok: true, messageId: 'msg-dl1', size: rawEmail.length, raw: rawEmail });

    const outDir = join(TMP, 'dl-test');
    const { stdout, stderr, exitCode } = await runCli(['download', '--profile', 'test', '--id', 'msg-dl1', '-o', outDir]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Extracted.*report\.pdf/);

    const meta = JSON.parse(stdout);
    assert.equal(meta.messageId, 'msg-dl1');
    assert.equal(meta.files.length, 1);
    assert.equal(meta.files[0].name, 'report.pdf');

    // Verify files on disk
    assert.ok(existsSync(join(outDir, 'msg-dl1.eml')));
    assert.ok(existsSync(join(outDir, 'report.pdf')));
    assert.deepEqual(readFileSync(join(outDir, 'report.pdf')), pdfContent);
  });

  it('caches download and returns cached on repeat', async () => {
    setMockResponse('raw', { ok: true, messageId: 'msg-dl2', size: rawEmail.length, raw: rawEmail });

    // First call
    await runCli(['download', '--profile', 'test', '--id', 'msg-dl2']);
    lastRequest = null;

    // Second call — should use cache
    const { stdout, stderr, exitCode } = await runCli(['download', '--profile', 'test', '--id', 'msg-dl2']);
    assert.equal(exitCode, 0);
    assert.equal(lastRequest, null); // Gateway NOT called
    assert.match(stderr, /cached/);

    const meta = JSON.parse(stdout);
    assert.equal(meta.messageId, 'msg-dl2');
  });

  it('--refresh busts download cache', async () => {
    setMockResponse('raw', { ok: true, messageId: 'msg-dl3', size: rawEmail.length, raw: rawEmail });

    // First call
    await runCli(['download', '--profile', 'test', '--id', 'msg-dl3']);
    lastRequest = null;

    // Second call with --refresh
    await runCli(['download', '--profile', 'test', '--id', 'msg-dl3', '--refresh']);
    assert.notEqual(lastRequest, null); // Gateway WAS called
  });

  it('deduplicates attachments with the same filename', async () => {
    const file1 = Buffer.from('first image');
    const file2 = Buffer.from('second image');
    const rawDup = [
      'From: a@b.com',
      'Content-Type: multipart/mixed; boundary="----=_Dup"',
      '',
      '------=_Dup',
      'Content-Type: image/png',
      'Content-Disposition: attachment; filename="image.png"',
      'Content-Transfer-Encoding: base64',
      '',
      file1.toString('base64'),
      '------=_Dup',
      'Content-Type: image/png',
      'Content-Disposition: attachment; filename="image.png"',
      'Content-Transfer-Encoding: base64',
      '',
      file2.toString('base64'),
      '------=_Dup--',
    ].join('\r\n');
    setMockResponse('raw', { ok: true, messageId: 'msg-dup', size: rawDup.length, raw: rawDup });

    const outDir = join(TMP, 'dl-dup');
    const { stdout, exitCode } = await runCli(['download', '--profile', 'test', '--id', 'msg-dup', '-o', outDir]);
    assert.equal(exitCode, 0);

    const meta = JSON.parse(stdout);
    assert.equal(meta.files.length, 2);
    assert.equal(meta.files[0].name, 'image.png');
    assert.equal(meta.files[1].name, 'image_2.png');

    // Verify both files exist and have correct content
    assert.ok(existsSync(join(outDir, 'image.png')));
    assert.ok(existsSync(join(outDir, 'image_2.png')));
    assert.deepEqual(readFileSync(join(outDir, 'image.png')), file1);
    assert.deepEqual(readFileSync(join(outDir, 'image_2.png')), file2);
  });

  it('handles message with no attachments', async () => {
    const simpleEmail = 'From: a@b.com\r\nContent-Type: text/plain\r\n\r\nJust text';
    setMockResponse('raw', { ok: true, messageId: 'msg-noatt', size: simpleEmail.length, raw: simpleEmail });

    const { stderr, exitCode } = await runCli(['download', '--profile', 'test', '--id', 'msg-noatt']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /No attachments found/);
  });
});

describe('list-drafts action', () => {
  it('sends list-drafts action and outputs draft summaries', async () => {
    const drafts = [
      { draftId: 'd1', messageId: 'm1', threadId: 't1', subject: 'Draft 1', to: 'bob@test.com', date: '2026-01-01T00:00:00Z', snippet: 'Hello' },
      { draftId: 'd2', messageId: 'm2', threadId: 't2', subject: 'Draft 2', to: 'alice@test.com', date: '2026-01-02T00:00:00Z', snippet: 'World' },
    ];
    setMockResponse('list-drafts', { ok: true, draftLabel: 'email-drafter', count: 2, drafts });

    const { stdout, stderr, exitCode } = await runCli(['list-drafts', '--profile', 'test']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /2 AI-managed draft\(s\)/);

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].draftId, 'd1');

    assert.equal(lastRequest.action, 'list-drafts');
    assert.equal(lastRequest.key, 'test-key-123');
  });

  it('handles empty draft list', async () => {
    setMockResponse('list-drafts', { ok: true, draftLabel: 'email-drafter', count: 0, drafts: [] });

    const { stderr, exitCode } = await runCli(['list-drafts', '--profile', 'test']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /No AI-managed drafts/);
  });

  it('reports gateway errors', async () => {
    setMockResponse('list-drafts', { ok: false, error: 'draft management not configured' });

    const { stderr, exitCode } = await runCli(['list-drafts', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /draft management not configured/);
  });
});

describe('read-draft action', () => {
  it('fetches draft by draftId', async () => {
    setMockResponse('read-draft', {
      ok: true,
      draftId: 'draft-x',
      messageId: 'msg-x',
      subject: 'My Draft',
      htmlBody: '<p>Hello</p>',
      attachments: [{ name: 'file.pdf', size: 1234, contentType: 'application/pdf' }],
    });

    const { stdout, exitCode } = await runCli(['read-draft', '--profile', 'test', '--id', 'draft-x']);
    assert.equal(exitCode, 0);

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.draftId, 'draft-x');
    assert.equal(parsed.subject, 'My Draft');
    assert.equal(parsed.attachments.length, 1);

    assert.equal(lastRequest.action, 'read-draft');
    assert.equal(lastRequest.draftId, 'draft-x');
  });

  it('reports errors', async () => {
    setMockResponse('read-draft', { ok: false, error: 'draft not found' });

    const { stderr, exitCode } = await runCli(['read-draft', '--profile', 'test', '--id', 'bad-id']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /draft not found/);
  });
});

describe('edit action', () => {
  it('sends subject-only edit', async () => {
    setMockResponse('edit', { ok: true, draftId: 'draft-e1', subject: 'New Subject' });

    const { stderr, exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-e1', '--subject', 'New Subject',
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Draft updated/);

    assert.equal(lastRequest.action, 'edit');
    assert.equal(lastRequest.draftId, 'draft-e1');
    assert.equal(lastRequest.subject, 'New Subject');
    assert.equal(lastRequest.html, undefined);
  });

  it('sends body update from file', async () => {
    setMockResponse('edit', { ok: true, draftId: 'draft-e2', subject: 'Updated' });

    const mdFile = join(TMP, 'edit-body.md');
    writeFileSync(mdFile, '# Updated\n\nNew body content');

    const { exitCode } = await runCli(['edit', '--profile', 'test', '--id', 'draft-e2', mdFile]);
    assert.equal(exitCode, 0);

    assert.equal(lastRequest.action, 'edit');
    assert.equal(lastRequest.draftId, 'draft-e2');
    assert.match(lastRequest.html, /New body content/);
  });

  it('sends combined subject + to + cc update', async () => {
    setMockResponse('edit', { ok: true, draftId: 'draft-e3', subject: 'Combined' });

    const { exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-e3',
      '--subject', 'Combined', '--to', 'new@test.com', '--cc', 'cc@test.com',
    ]);
    assert.equal(exitCode, 0);

    assert.equal(lastRequest.subject, 'Combined');
    assert.equal(lastRequest.to, 'new@test.com');
    assert.equal(lastRequest.cc, 'cc@test.com');
  });

  it('errors when no update fields provided', async () => {
    const { stderr, exitCode } = await runCli(['edit', '--profile', 'test', '--id', 'draft-e4']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /edit requires at least one update/);
  });

  it('allows --cc "" to clear CC', async () => {
    setMockResponse('edit', { ok: true, draftId: 'draft-cc', subject: 'CC Test' });
    const { stderr, exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-cc', '--cc', '',
    ]);
    assert.equal(exitCode, 0);
    assert.equal(lastRequest.action, 'edit');
    assert.equal(lastRequest.cc, '');
  });

  it('reports gateway errors', async () => {
    setMockResponse('edit', { ok: false, error: 'access denied — draft does not have "email-drafter" label' });

    const { stderr, exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'bad-draft', '--subject', 'X',
    ]);
    assert.equal(exitCode, 1);
    assert.match(stderr, /access denied/);
  });
});

describe('attach action', () => {
  it('reads file, base64-encodes, and sends to gateway', async () => {
    setMockResponse('attach', { ok: true, draftId: 'draft-a1', attached: 'doc.pdf' });

    const attachFile = join(TMP, 'doc.pdf');
    writeFileSync(attachFile, 'fake pdf data');

    const { stderr, exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-a1', attachFile,
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Attached.*doc\.pdf/);

    assert.equal(lastRequest.action, 'attach');
    assert.equal(lastRequest.draftId, 'draft-a1');
    assert.equal(lastRequest.filename, 'doc.pdf');
    assert.equal(lastRequest.mimeType, 'application/pdf');
    // Verify base64 content
    const decoded = Buffer.from(lastRequest.content, 'base64').toString();
    assert.equal(decoded, 'fake pdf data');
  });

  it('guesses MIME type from extension', async () => {
    setMockResponse('attach', { ok: true, draftId: 'draft-a2', attached: 'photo.png' });

    const attachFile = join(TMP, 'photo.png');
    writeFileSync(attachFile, 'fake png');

    await runCli(['attach', '--profile', 'test', '--id', 'draft-a2', attachFile]);
    assert.equal(lastRequest.mimeType, 'image/png');
  });

  it('defaults to octet-stream for unknown extensions', async () => {
    setMockResponse('attach', { ok: true, draftId: 'draft-a3', attached: 'data.xyz' });

    const attachFile = join(TMP, 'data.xyz');
    writeFileSync(attachFile, 'unknown data');

    await runCli(['attach', '--profile', 'test', '--id', 'draft-a3', attachFile]);
    assert.equal(lastRequest.mimeType, 'application/octet-stream');
  });

  it('supports --content-id for inline images', async () => {
    setMockResponse('attach', { ok: true, draftId: 'draft-a4', attached: 'logo.png' });

    const attachFile = join(TMP, 'logo.png');
    writeFileSync(attachFile, 'fake logo');

    await runCli([
      'attach', '--profile', 'test', '--id', 'draft-a4',
      '--content-id', 'logo-cid', attachFile,
    ]);
    assert.equal(lastRequest.contentId, 'logo-cid');
    assert.equal(lastRequest.filename, 'logo.png');
  });

  it('supports --filename and --mime-type overrides', async () => {
    setMockResponse('attach', { ok: true, draftId: 'draft-a5', attached: 'custom.bin' });

    const attachFile = join(TMP, 'temp.dat');
    writeFileSync(attachFile, 'binary data');

    await runCli([
      'attach', '--profile', 'test', '--id', 'draft-a5',
      '--filename', 'custom.bin', '--mime-type', 'application/x-custom', attachFile,
    ]);
    assert.equal(lastRequest.filename, 'custom.bin');
    assert.equal(lastRequest.mimeType, 'application/x-custom');
  });

  it('errors on nonexistent file', async () => {
    const { stderr, exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-a6', join(TMP, 'nonexistent.pdf'),
    ]);
    assert.equal(exitCode, 1);
    assert.match(stderr, /File not found/);
  });

  it('rejects files over 15MB', async () => {
    const bigFile = join(TMP, 'huge.bin');
    // Write a file just over 15MB (15MB + 1 byte)
    const fd = openSync(bigFile, 'w');
    ftruncateSync(fd, 15 * 1024 * 1024 + 1);
    closeSync(fd);

    const { stderr, exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-big', bigFile,
    ]);
    assert.equal(exitCode, 1);
    assert.match(stderr, /File too large/);
  });
});

describe('detach action', () => {
  it('sends detach request with filename', async () => {
    setMockResponse('detach', { ok: true, draftId: 'draft-d1', detached: 'report.pdf' });

    const { stderr, exitCode } = await runCli([
      'detach', '--profile', 'test', '--id', 'draft-d1', '--filename', 'report.pdf',
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Detached.*report\.pdf/);

    assert.equal(lastRequest.action, 'detach');
    assert.equal(lastRequest.draftId, 'draft-d1');
    assert.equal(lastRequest.filename, 'report.pdf');
  });

  it('reports gateway errors', async () => {
    setMockResponse('detach', { ok: false, error: 'attachment "missing.pdf" not found in draft' });

    const { stderr, exitCode } = await runCli([
      'detach', '--profile', 'test', '--id', 'draft-d2', '--filename', 'missing.pdf',
    ]);
    assert.equal(exitCode, 1);
    assert.match(stderr, /not found in draft/);
  });
});

describe('inline images', () => {
  it('rewrites local image paths to cid references in draft', async () => {
    // Set up sequential mock responses: draft then attach
    let callCount = 0;
    mockResponses = {};
    setMockResponse('draft', { ok: true, subject: 'With Image', draftId: 'draft-img1', messageId: 'msg-img1' });
    setMockResponse('attach', { ok: true, draftId: 'draft-img1', attached: 'logo.png' });

    // Create a local image file
    const imgDir = join(TMP, 'img-test');
    mkdirSync(imgDir, { recursive: true });
    writeFileSync(join(imgDir, 'logo.png'), 'fake png data');

    // Create markdown that references the local image
    const mdFile = join(imgDir, 'draft.md');
    writeFileSync(mdFile, '# Hello\n\n![Logo](logo.png)\n\nSome text');

    const { stdout, stderr, exitCode } = await runCli(['draft', '--profile', 'test', '--to', 'x@test.com', mdFile]);
    assert.equal(exitCode, 0);

    // Verify inlineImages payload is bundled with the draft action
    assert.equal(lastRequest.action, 'draft');
    assert.ok(Array.isArray(lastRequest.inlineImages), 'inlineImages should be an array');
    assert.equal(lastRequest.inlineImages.length, 1);
    assert.equal(lastRequest.inlineImages[0].filename, 'logo.png');
    assert.equal(lastRequest.inlineImages[0].mimeType, 'image/png');
    assert.equal(lastRequest.inlineImages[0].contentId, 'img-0');
    assert.ok(lastRequest.inlineImages[0].content, 'should have base64 content');
    // HTML should contain cid: reference
    assert.match(lastRequest.html, /cid:img-0/);
    assert.match(stderr, /Attached inline.*logo\.png.*cid:img-0/);
  });

  it('leaves URL images unchanged', async () => {
    setMockResponse('draft', { ok: true, subject: 'URL Image', draftId: 'draft-url', messageId: 'msg-url' });

    const mdFile = join(TMP, 'url-img.md');
    writeFileSync(mdFile, '![Photo](https://example.com/photo.jpg)\n\nText');

    const { exitCode } = await runCli(['draft', '--profile', 'test', '--to', 'x@test.com', mdFile]);
    assert.equal(exitCode, 0);

    // HTML should contain the original URL, not a cid: reference
    assert.match(lastRequest.html, /https:\/\/example\.com\/photo\.jpg/);
    // No attach call should have been made (only draft action)
    assert.equal(lastRequest.action, 'draft');
  });

  it('handles multiple local images with unique CIDs', async () => {
    setMockResponse('draft', { ok: true, subject: 'Multi Image', draftId: 'draft-multi', messageId: 'msg-multi' });
    setMockResponse('attach', { ok: true, draftId: 'draft-multi', attached: 'a.png' });

    const imgDir = join(TMP, 'multi-img-test');
    mkdirSync(imgDir, { recursive: true });
    writeFileSync(join(imgDir, 'header.png'), 'header png data');
    writeFileSync(join(imgDir, 'footer.jpg'), 'footer jpg data');

    const mdFile = join(imgDir, 'draft.md');
    writeFileSync(mdFile, '# Doc\n\n![Header](header.png)\n\nMiddle text\n\n![Footer](footer.jpg)');

    const { stderr, exitCode } = await runCli(['draft', '--profile', 'test', '--to', 'x@test.com', mdFile]);
    assert.equal(exitCode, 0);

    // Both images should be attached with unique CIDs (img-0 and img-1)
    assert.match(stderr, /Attached inline.*header\.png.*cid:img-0/);
    assert.match(stderr, /Attached inline.*footer\.jpg.*cid:img-1/);
  });

  it('warns about missing local images and leaves reference unchanged', async () => {
    setMockResponse('draft', { ok: true, subject: 'Missing', draftId: 'draft-miss', messageId: 'msg-miss' });

    const mdFile = join(TMP, 'missing-img.md');
    writeFileSync(mdFile, '![Alt](nonexistent.png)\n\nText');

    const { stderr, exitCode } = await runCli(['draft', '--profile', 'test', '--to', 'x@test.com', mdFile]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Warning: image not found/);
    // The reference should remain as-is (not rewritten to cid:)
    assert.match(lastRequest.html, /nonexistent\.png/);
  });
});

describe('configure action', () => {
  it('sends configure payload with --to', async () => {
    setMockResponse('configure', { ok: true, action: 'configured', updated: ['to'] });

    const { stderr, exitCode } = await runCli(['configure', '--profile', 'test', '--to', 'alice@test.com']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Configured.*to/);

    assert.equal(lastRequest.action, 'configure');
    assert.equal(lastRequest.to, 'alice@test.com');
    assert.equal(lastRequest.key, 'test-key-123');
    assert.equal(lastRequest.labelName, undefined);
  });

  it('sends multiple config fields', async () => {
    setMockResponse('configure', { ok: true, action: 'configured', updated: ['to', 'cc'] });

    const { exitCode } = await runCli([
      'configure', '--profile', 'test',
      '--to', 'alice@test.com',
      '--cc', 'archive@test.com',
    ]);
    assert.equal(exitCode, 0);

    assert.equal(lastRequest.to, 'alice@test.com');
    assert.equal(lastRequest.cc, 'archive@test.com');
    assert.equal(lastRequest.labelName, undefined);
  });

  it('sends --max-results and --default-subject', async () => {
    setMockResponse('configure', { ok: true, action: 'configured', updated: ['maxResults', 'defaultSubject'] });

    const { exitCode } = await runCli([
      'configure', '--profile', 'test',
      '--max-results', '50',
      '--default-subject', 'My Default',
    ]);
    assert.equal(exitCode, 0);

    assert.equal(lastRequest.maxResults, '50');
    assert.equal(lastRequest.defaultSubject, 'My Default');
  });

  it('errors when no config flags provided', async () => {
    const { stderr, exitCode } = await runCli(['configure', '--profile', 'test']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /configure requires at least one config flag/);
  });

  it('does not send --label as labelName', async () => {
    // --label is parsed but NOT included in configure payload (security: labelName controls read scope)
    const { stderr, exitCode } = await runCli(['configure', '--profile', 'test', '--label', 'x']);
    // --label is no longer a recognized configure flag, so no config fields are sent
    assert.equal(exitCode, 1);
    assert.match(stderr, /configure requires at least one config flag/);
  });

  it('reports gateway errors', async () => {
    setMockResponse('configure', { ok: false, error: 'no configurable fields provided' });

    const { stderr, exitCode } = await runCli(['configure', '--profile', 'test', '--to', 'x@test.com']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /no configurable fields/);
  });
});

describe('update action', () => {
  it('reports up to date when versions match', async () => {
    mockGetResponse = { status: 'ok', version: '3.4.0' };

    const { stdout, exitCode } = await runCli(['update', '--profile', 'test']);
    assert.equal(exitCode, 0);
    assert.match(stdout, /up to date.*v3\.4\.0/);
  });

  it('detects version mismatch and reports update available', async () => {
    mockGetResponse = { status: 'ok', version: '2.1' };

    const { stdout, stderr, exitCode } = await runCli(['update', '--profile', 'test']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Local:\s+v3\.4\.0/);
    assert.match(stderr, /Remote:\s+v2\.1/);
    assert.match(stdout, /Update available.*v2\.1.*v3\.4\.0/);
    assert.match(stdout, /Code copied to clipboard|Could not copy to clipboard/);
    // v3.0+ upgrade should mention Gmail Advanced Service
    assert.match(stdout, /Gmail Advanced Service/);
  });

  it('handles unknown remote version', async () => {
    mockGetResponse = { status: 'ok' };

    const { stdout, stderr, exitCode } = await runCli(['update', '--profile', 'test']);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Remote:\s+vunknown/);
    // unknown !== 3.0, so update is offered
    assert.match(stdout, /Update available/);
  });
});

describe('MIME type guessing', () => {
  // These are tested indirectly through the attach action.
  // We verify that the CLI correctly guesses MIME types by checking lastRequest.mimeType.

  it('.jpg maps to image/jpeg', async () => {
    setMockResponse('attach', { ok: true, draftId: 'd', attached: 'photo.jpg' });
    const f = join(TMP, 'photo.jpg');
    writeFileSync(f, 'x');
    await runCli(['attach', '--profile', 'test', '--id', 'd', f]);
    assert.equal(lastRequest.mimeType, 'image/jpeg');
  });

  it('.jpeg maps to image/jpeg', async () => {
    setMockResponse('attach', { ok: true, draftId: 'd', attached: 'photo.jpeg' });
    const f = join(TMP, 'photo.jpeg');
    writeFileSync(f, 'x');
    await runCli(['attach', '--profile', 'test', '--id', 'd', f]);
    assert.equal(lastRequest.mimeType, 'image/jpeg');
  });

  it('.gif maps to image/gif', async () => {
    setMockResponse('attach', { ok: true, draftId: 'd', attached: 'anim.gif' });
    const f = join(TMP, 'anim.gif');
    writeFileSync(f, 'x');
    await runCli(['attach', '--profile', 'test', '--id', 'd', f]);
    assert.equal(lastRequest.mimeType, 'image/gif');
  });

  it('.html maps to text/html', async () => {
    setMockResponse('attach', { ok: true, draftId: 'd', attached: 'page.html' });
    const f = join(TMP, 'page.html');
    writeFileSync(f, 'x');
    await runCli(['attach', '--profile', 'test', '--id', 'd', f]);
    assert.equal(lastRequest.mimeType, 'text/html');
  });

  it('.docx maps correctly', async () => {
    setMockResponse('attach', { ok: true, draftId: 'd', attached: 'doc.docx' });
    const f = join(TMP, 'doc.docx');
    writeFileSync(f, 'x');
    await runCli(['attach', '--profile', 'test', '--id', 'd', f]);
    assert.equal(lastRequest.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});

describe('gateway auth', () => {
  it('sends API key in every request', async () => {
    setMockResponse('list', { ok: true, label: 'test', count: 0, threads: [] });
    await runCli(['list', '--profile', 'test']);
    assert.equal(lastRequest.key, 'test-key-123');
  });
});

describe('client-side MIME flow (gateway >= 3.3)', () => {
  const testMime = [
    'From: test@example.com',
    'To: recipient@example.com',
    'Subject: Draft Test',
    'In-Reply-To: <thread@example.com>',
    'References: <thread@example.com>',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    '<p>Hello World</p>',
  ].join('\r\n');

  beforeEach(() => {
    // Set gateway to v3.3 to trigger client-side flow
    mockGetResponse = { status: 'ok', version: '3.4.0' };
  });

  it('edit uses client-side flow with gateway >= 3.3', async () => {
    // draft-meta for cache check (cache miss since no cache yet)
    // draft-raw for full MIME fetch
    // raw-update for sending rebuilt MIME
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-cs1', messageId: 'msg-cs1', threadId: 'thread-cs1' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-cs1', messageId: 'msg-cs1', threadId: 'thread-cs1', raw: testMime });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-cs1' });

    const { stderr, exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-cs1', '--subject', 'Updated Subject',
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Draft updated/);

    // Verify raw-update was called (not edit)
    assert.equal(lastRequest.action, 'raw-update');
    assert.equal(lastRequest.draftId, 'draft-cs1');
    assert.ok(lastRequest.raw, 'should have raw MIME in request');
    assert.equal(lastRequest.threadId, 'thread-cs1');
  });

  it('attach uses client-side flow with gateway >= 3.3', async () => {
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-cs2', messageId: 'msg-cs2', threadId: 'thread-cs2' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-cs2', messageId: 'msg-cs2', threadId: 'thread-cs2', raw: testMime });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-cs2' });

    const attachFile = join(TMP, 'cs-attach.pdf');
    writeFileSync(attachFile, 'fake pdf data');

    const { stderr, exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-cs2', attachFile,
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Attached/);
    assert.equal(lastRequest.action, 'raw-update');
  });

  it('detach uses client-side flow with gateway >= 3.3', async () => {
    // Build MIME with an attachment
    const pdfData = Buffer.from('pdf bytes');
    const mimeWithAttach = [
      'From: test@example.com',
      'To: recipient@example.com',
      'Subject: With File',
      'Content-Type: multipart/mixed; boundary="----=_Test_1"',
      '',
      '------=_Test_1',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      '<p>Body</p>',
      '------=_Test_1',
      'Content-Type: application/pdf; name="report.pdf"',
      'Content-Disposition: attachment; filename="report.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      pdfData.toString('base64'),
      '------=_Test_1--',
    ].join('\r\n');

    setMockResponse('draft-meta', { ok: true, draftId: 'draft-cs3', messageId: 'msg-cs3', threadId: 'thread-cs3' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-cs3', messageId: 'msg-cs3', threadId: 'thread-cs3', raw: mimeWithAttach });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-cs3' });

    const { stderr, exitCode } = await runCli([
      'detach', '--profile', 'test', '--id', 'draft-cs3', '--filename', 'report.pdf',
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /Detached/);
    assert.equal(lastRequest.action, 'raw-update');
  });

  it('falls back to server-side flow when gateway < 3.3', async () => {
    mockGetResponse = { status: 'ok', version: '3.2.3' };
    setMockResponse('edit', { ok: true, draftId: 'draft-fb', subject: 'Fallback' });

    const { stderr, exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-fb', '--subject', 'Fallback',
    ]);
    assert.equal(exitCode, 0);
    // Should use old edit action, not raw-update
    assert.equal(lastRequest.action, 'edit');
    assert.equal(lastRequest.draftId, 'draft-fb');
  });

  it('detach errors when attachment not found in draft', async () => {
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-cs4', messageId: 'msg-cs4', threadId: 'thread-cs4' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-cs4', messageId: 'msg-cs4', threadId: 'thread-cs4', raw: testMime });

    const { stderr, exitCode } = await runCli([
      'detach', '--profile', 'test', '--id', 'draft-cs4', '--filename', 'nonexistent.pdf',
    ]);
    assert.equal(exitCode, 1);
    assert.match(stderr, /not found in draft/);
  });

  it('caches draft-raw and uses cache on second fetch', async () => {
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-cache', messageId: 'msg-cache', threadId: 'thread-cache' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-cache', messageId: 'msg-cache', threadId: 'thread-cache', raw: testMime });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-cache' });

    // First edit — should call draft-raw
    await runCli(['edit', '--profile', 'test', '--id', 'draft-cache', '--subject', 'First']);
    assert.equal(lastRequest.action, 'raw-update');

    // Reset mock — raw-update invalidates cache, so next call will re-fetch
    // But if we set up fresh mock responses for the next call, it should work
    lastRequest = null;
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-cache', messageId: 'msg-cache-2', threadId: 'thread-cache' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-cache', messageId: 'msg-cache-2', threadId: 'thread-cache', raw: testMime });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-cache' });

    // Second edit — messageId changed (raw-update invalidated cache), so should re-fetch
    await runCli(['edit', '--profile', 'test', '--id', 'draft-cache', '--subject', 'Second']);
    assert.equal(lastRequest.action, 'raw-update');
  });

  it('cache-hit skips draft-raw when messageId unchanged', async () => {
    // Pre-populate the cache on disk before running the CLI
    const draftId = 'draft-cachehit';
    const cacheDir = join(CACHE_DIR, 'draft-raw', draftId);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'meta.json'), JSON.stringify({
      messageId: 'msg-hit', threadId: 'thread-hit', cachedAt: new Date().toISOString(),
    }));
    writeFileSync(join(cacheDir, 'raw.eml'), testMime);

    // draft-meta returns same messageId → cache hit, no draft-raw needed
    setMockResponse('draft-meta', { ok: true, draftId, messageId: 'msg-hit', threadId: 'thread-hit' });
    setMockResponse('raw-update', { ok: true, draftId });

    requestHistory = [];
    await runCli(['edit', '--profile', 'test', '--id', draftId, '--subject', 'Cached']);
    assert.equal(lastRequest.action, 'raw-update');

    // Verify draft-raw was NOT called (only draft-meta and raw-update)
    const actions = requestHistory.map(r => r.action);
    assert.ok(!actions.includes('draft-raw'), `draft-raw should not be called on cache hit, got: ${actions}`);
    assert.ok(actions.includes('draft-meta'), 'draft-meta should be called for validation');
  });

  it('uses client-side flow with version 3.10.0 (numeric comparison)', async () => {
    mockGetResponse = { status: 'ok', version: '3.10.0' };
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-v10', messageId: 'msg-v10', threadId: 'thread-v10' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-v10', messageId: 'msg-v10', threadId: 'thread-v10', raw: testMime });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-v10' });

    const { exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-v10', '--subject', 'v10 test',
    ]);
    assert.equal(exitCode, 0);
    assert.equal(lastRequest.action, 'raw-update');
  });

  it('uses client-side flow with version 3.3 (missing patch)', async () => {
    mockGetResponse = { status: 'ok', version: '3.3' };
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-v33', messageId: 'msg-v33', threadId: 'thread-v33' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-v33', messageId: 'msg-v33', threadId: 'thread-v33', raw: testMime });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-v33' });

    const { exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-v33', '--subject', 'v3.3 test',
    ]);
    assert.equal(exitCode, 0);
    assert.equal(lastRequest.action, 'raw-update');
  });

  it('falls back when gateway returns 0.0.0 (version fetch failed)', async () => {
    mockGetResponse = { status: 'ok' }; // no version field → getGatewayVersion returns '0.0.0'
    setMockResponse('edit', { ok: true, draftId: 'draft-v0', subject: 'Fallback' });

    const { exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-v0', '--subject', 'Fallback',
    ]);
    assert.equal(exitCode, 0);
    assert.equal(lastRequest.action, 'edit'); // server-side fallback
  });
});

describe('batch attach', () => {
  const testMime = [
    'From: test@example.com',
    'To: recipient@example.com',
    'Subject: Batch Test',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    '<p>Body</p>',
  ].join('\r\n');

  beforeEach(() => {
    mockGetResponse = { status: 'ok', version: '3.4.0' };
  });

  it('attaches multiple files in one call (client-side)', async () => {
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-batch1', messageId: 'msg-b1', threadId: 'thread-b1' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-batch1', messageId: 'msg-b1', threadId: 'thread-b1', raw: testMime });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-batch1' });

    const file1 = join(TMP, 'batch1.pdf');
    const file2 = join(TMP, 'batch2.png');
    const file3 = join(TMP, 'batch3.txt');
    writeFileSync(file1, 'pdf data');
    writeFileSync(file2, 'png data');
    writeFileSync(file3, 'txt data');

    const { stderr, exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-batch1', file1, file2, file3,
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /batch1\.pdf/);
    assert.match(stderr, /batch2\.png/);
    assert.match(stderr, /batch3\.txt/);

    // Only one raw-update call (not 3 separate attach calls)
    assert.equal(lastRequest.action, 'raw-update');
    const actions = requestHistory.map(r => r.action);
    assert.equal(actions.filter(a => a === 'raw-update').length, 1);
  });

  it('applies --content-id to the next file only', async () => {
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-batch2', messageId: 'msg-b2', threadId: 'thread-b2' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-batch2', messageId: 'msg-b2', threadId: 'thread-b2', raw: testMime });
    setMockResponse('raw-update', { ok: true, draftId: 'draft-batch2' });

    const logo = join(TMP, 'logo-batch.png');
    const doc = join(TMP, 'report-batch.pdf');
    writeFileSync(logo, 'logo data');
    writeFileSync(doc, 'report data');

    const { exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-batch2',
      '--content-id', 'logo-cid', logo, doc,
    ]);
    assert.equal(exitCode, 0);
    assert.equal(lastRequest.action, 'raw-update');
    // The raw MIME should contain the logo with CID and the doc without
    assert.ok(lastRequest.raw.includes('logo-batch.png'), 'should include logo filename');
    assert.ok(lastRequest.raw.includes('report-batch.pdf'), 'should include report filename');
  });

  it('falls back to sequential calls for gateway < 3.3', async () => {
    mockGetResponse = { status: 'ok', version: '3.0' };
    setMockResponse('attach', { ok: true, draftId: 'draft-batch3', attached: 'a.pdf' });

    const f1 = join(TMP, 'fallback1.pdf');
    const f2 = join(TMP, 'fallback2.pdf');
    writeFileSync(f1, 'data1');
    writeFileSync(f2, 'data2');

    requestHistory = [];
    const { exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-batch3', f1, f2,
    ]);
    assert.equal(exitCode, 0);
    // Two separate attach calls (server-side fallback)
    const attachCalls = requestHistory.filter(r => r.action === 'attach');
    assert.equal(attachCalls.length, 2);
  });

  it('validates all files before making any gateway calls', async () => {
    const realFile = join(TMP, 'real.pdf');
    writeFileSync(realFile, 'data');
    const fakeFile = join(TMP, 'nonexistent-batch.pdf');

    requestHistory = [];
    const { stderr, exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-batch4', realFile, fakeFile,
    ]);
    assert.equal(exitCode, 1);
    assert.match(stderr, /File not found/);
    // No gateway calls should have been made
    assert.equal(requestHistory.length, 0);
  });
});

describe('--dry-run flag', () => {
  const testMime = [
    'From: test@example.com',
    'To: recipient@example.com',
    'Subject: Dry Run Test',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    '<p>Hello</p>',
  ].join('\r\n');

  const mimeWithAttach = [
    'From: test@example.com',
    'To: recipient@example.com',
    'Subject: With Attachment',
    'Content-Type: multipart/mixed; boundary="----=_DR_1"',
    '',
    '------=_DR_1',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    '<p>Body</p>',
    '------=_DR_1',
    'Content-Type: application/pdf; name="old.pdf"',
    'Content-Disposition: attachment; filename="old.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('old data').toString('base64'),
    '------=_DR_1--',
  ].join('\r\n');

  beforeEach(() => {
    mockGetResponse = { status: 'ok', version: '3.4.0' };
  });

  it('edit --dry-run shows changes without updating', async () => {
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-dr1', messageId: 'msg-dr1', threadId: 'thread-dr1' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-dr1', messageId: 'msg-dr1', threadId: 'thread-dr1', raw: testMime });

    requestHistory = [];
    const { stderr, exitCode } = await runCli([
      'edit', '--profile', 'test', '--id', 'draft-dr1', '--dry-run', '--subject', 'New Subject',
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /DRY RUN/);
    assert.match(stderr, /Dry Run Test.*→.*New Subject/);

    // raw-update should NOT have been called
    const actions = requestHistory.map(r => r.action);
    assert.ok(!actions.includes('raw-update'), `raw-update should not be called in dry run, got: ${actions}`);
  });

  it('attach --dry-run shows files that would be added', async () => {
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-dr2', messageId: 'msg-dr2', threadId: 'thread-dr2' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-dr2', messageId: 'msg-dr2', threadId: 'thread-dr2', raw: testMime });

    const attachFile = join(TMP, 'dry-attach.pdf');
    writeFileSync(attachFile, 'dry run data');

    requestHistory = [];
    const { stderr, exitCode } = await runCli([
      'attach', '--profile', 'test', '--id', 'draft-dr2', '--dry-run', attachFile,
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /DRY RUN/);
    assert.match(stderr, /Attachments added.*dry-attach\.pdf/);

    const actions = requestHistory.map(r => r.action);
    assert.ok(!actions.includes('raw-update'), 'raw-update should not be called in dry run');
  });

  it('detach --dry-run shows file that would be removed', async () => {
    setMockResponse('draft-meta', { ok: true, draftId: 'draft-dr3', messageId: 'msg-dr3', threadId: 'thread-dr3' });
    setMockResponse('draft-raw', { ok: true, draftId: 'draft-dr3', messageId: 'msg-dr3', threadId: 'thread-dr3', raw: mimeWithAttach });

    requestHistory = [];
    const { stderr, exitCode } = await runCli([
      'detach', '--profile', 'test', '--id', 'draft-dr3', '--dry-run', '--filename', 'old.pdf',
    ]);
    assert.equal(exitCode, 0);
    assert.match(stderr, /DRY RUN/);
    assert.match(stderr, /Attachments removed.*old\.pdf/);

    const actions = requestHistory.map(r => r.action);
    assert.ok(!actions.includes('raw-update'), 'raw-update should not be called in dry run');
  });

  it('--dry-run shows in help text', async () => {
    const { stdout } = await runCli(['--help']);
    assert.match(stdout, /--dry-run/);
  });
});
