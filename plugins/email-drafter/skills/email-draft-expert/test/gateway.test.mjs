// Gateway tests — loads apps-script.js into a Node.js vm context with mocked
// Google Apps Script globals, then tests server-side functions directly.
// Focuses on threading preservation through edit/attach/detach MIME rebuilds.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const SCRIPT_PATH = resolve(import.meta.dirname, '..', 'apps-script.js');
const scriptSource = readFileSync(SCRIPT_PATH, 'utf8');

// Build a simple MIME message with threading headers for testing round-trips
function buildTestMime({ inReplyTo, references, subject, body, attachments } = {}) {
  const lines = [
    'MIME-Version: 1.0',
    'From: test@example.com',
    'To: recipient@example.com',
    `Subject: ${subject || 'Test Subject'}`,
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);

  if (attachments && attachments.length > 0) {
    const boundary = '----TestBoundary';
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(Buffer.from(body || '<p>Hello</p>').toString('base64'));
    for (const att of attachments) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      if (att.contentId) lines.push(`Content-ID: <${att.contentId}>`);
      lines.push('');
      lines.push(att.base64 || Buffer.from('fake-data').toString('base64'));
    }
    lines.push(`--${boundary}--`);
  } else {
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(Buffer.from(body || '<p>Hello</p>').toString('base64'));
  }
  return lines.join('\r\n');
}

// Create a fresh vm context with mocked GAS globals
function createGatewayContext() {
  const calls = {
    draftsUpdate: [],
    draftsGet: [],
    draftsCreate: [],
  };

  // Track what raw MIME was stored by the last drafts.update call
  let lastStoredMime = null;
  let mockDraftThreadId = null;
  let mockDraftMessageId = 'msg-123';
  let mockRawMime = null;
  let mockHeaders = {};
  let mockMessageTo = 'recipient@example.com';
  let mockMessageFrom = 'sender@example.com';

  const context = {
    // GmailApp mock
    GmailApp: {
      getMessageById: (id) => ({
        getId: () => id,
        getThread: () => ({
          getId: () => 'thread-abc',
          addLabel: () => {},
          getLabels: () => [{ getName: () => 'AI-Drafts' }],
        }),
        getFrom: () => mockMessageFrom,
        getTo: () => mockMessageTo,
        getCc: () => '',
        getSubject: () => 'Re: Test',
        getHeader: (name) => {
          if (mockHeaders[name] !== undefined) return mockHeaders[name];
          if (name === 'Message-ID' || name === 'Message-Id') return '<orig@example.com>';
          return '';
        },
        getPlainBody: () => 'test body',
        getAttachments: () => [],
      }),
      getUserLabelByName: (name) => ({
        getThreads: () => [],
        getName: () => name,
      }),
      createLabel: (name) => ({ getName: () => name }),
      createDraft: () => ({ getId: () => 'draft-new' }),
    },

    // Gmail Advanced Service mock
    Gmail: {
      Users: {
        Drafts: {
          get: (userId, draftId) => {
            calls.draftsGet.push({ userId, draftId });
            return {
              id: draftId,
              message: {
                id: mockDraftMessageId,
                threadId: mockDraftThreadId,
                raw: null, // not used directly, getRawMime_ uses Messages.get
              },
            };
          },
          update: (resource, userId, draftId) => {
            calls.draftsUpdate.push({ resource, userId, draftId });
            // Decode the raw MIME for inspection
            if (resource.message && resource.message.raw) {
              lastStoredMime = Buffer.from(resource.message.raw, 'base64').toString('utf8');
            }
            return {
              id: draftId,
              message: { id: mockDraftMessageId, threadId: mockDraftThreadId },
            };
          },
          create: (resource, userId) => {
            calls.draftsCreate.push({ resource, userId });
            return {
              id: 'draft-new',
              message: { id: 'msg-new', threadId: 'thread-abc' },
            };
          },
        },
        Messages: {
          get: (userId, messageId, opts) => {
            return { raw: Buffer.from(mockRawMime || '').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
          },
        },
      },
    },

    // ContentService mock
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({
        setMimeType: () => ({ getContent: () => text }),
        getContent: () => text,
      }),
    },

    // PropertiesService mock
    PropertiesService: {
      getScriptProperties: () => ({
        getProperties: () => ({
          apiKeys: 'test-key',
          labelName: 'AI-Inbox',
          draftLabelName: 'AI-Drafts',
        }),
      }),
    },

    // Utilities mock
    Utilities: {
      base64Encode: (bytes, charset) => {
        if (bytes instanceof Uint8Array || Array.isArray(bytes)) {
          return Buffer.from(bytes).toString('base64');
        }
        return Buffer.from(String(bytes), 'utf8').toString('base64');
      },
      base64EncodeWebSafe: (bytes) => {
        let buf;
        if (bytes instanceof Uint8Array || Array.isArray(bytes)) {
          buf = Buffer.from(bytes);
        } else {
          buf = Buffer.from(String(bytes), 'utf8');
        }
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      },
      base64Decode: (str) => {
        const buf = Buffer.from(str, 'base64');
        return Array.from(buf);
      },
      Charset: { UTF_8: 'UTF_8' },
      getUuid: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
    },

    // Logger mock
    Logger: { log: () => {} },

    // console mock
    console: { log: () => {}, error: () => {} },
  };

  vm.createContext(context);
  vm.runInContext(scriptSource, context);

  return {
    context,
    calls,
    getLastStoredMime: () => lastStoredMime,
    setMockDraftThreadId: (id) => { mockDraftThreadId = id; },
    setMockRawMime: (mime) => { mockRawMime = mime; },
    setMockDraftMessageId: (id) => { mockDraftMessageId = id; },
    setMockHeaders: (headers) => { mockHeaders = headers; },
    setMockMessageTo: (to) => { mockMessageTo = to; },
    setMockMessageFrom: (from) => { mockMessageFrom = from; },
  };
}

// Helper to call a gateway function in the vm context
function callInContext(ctx, fnName, ...args) {
  return vm.runInContext(`${fnName}(${args.map(a => JSON.stringify(a)).join(', ')})`, ctx);
}

describe('gateway: threading preservation', () => {
  let gw;

  beforeEach(() => {
    gw = createGatewayContext();
  });

  describe('extractDraftState_ captures threading headers', () => {
    it('captures In-Reply-To and References from parsed MIME', () => {
      const mime = buildTestMime({
        inReplyTo: '<abc@example.com>',
        references: '<abc@example.com> <def@example.com>',
      });
      gw.setMockRawMime(mime);

      const result = vm.runInContext(
        `extractDraftState_(parseMime_(${JSON.stringify(mime)}))`,
        gw.context,
      );

      assert.equal(result.inReplyTo, '<abc@example.com>');
      assert.equal(result.references, '<abc@example.com> <def@example.com>');
    });

    it('returns empty strings when threading headers are absent', () => {
      const mime = buildTestMime({});
      gw.setMockRawMime(mime);

      const result = vm.runInContext(
        `extractDraftState_(parseMime_(${JSON.stringify(mime)}))`,
        gw.context,
      );

      assert.equal(result.inReplyTo, '');
      assert.equal(result.references, '');
    });
  });

  describe('buildMimeMessage_ emits threading headers', () => {
    it('includes In-Reply-To and References in output MIME', () => {
      const result = vm.runInContext(
        `buildMimeMessage_(${JSON.stringify({
          from: 'test@example.com',
          to: 'recipient@example.com',
          cc: '',
          subject: 'Re: Test',
          inReplyTo: '<msg-1@example.com>',
          references: '<msg-1@example.com>',
          htmlBody: '<p>Reply</p>',
          htmlBodyBase64: '',
          attachments: [],
        })})`,
        gw.context,
      );

      assert.match(result, /In-Reply-To: <msg-1@example\.com>/);
      assert.match(result, /References: <msg-1@example\.com>/);
    });

    it('omits threading headers when not present in state', () => {
      const result = vm.runInContext(
        `buildMimeMessage_(${JSON.stringify({
          from: 'test@example.com',
          to: 'recipient@example.com',
          cc: '',
          subject: 'New email',
          inReplyTo: '',
          references: '',
          htmlBody: '<p>Hello</p>',
          htmlBodyBase64: '',
          attachments: [],
        })})`,
        gw.context,
      );

      assert.doesNotMatch(result, /In-Reply-To:/);
      assert.doesNotMatch(result, /References:/);
    });
  });

  describe('handleEdit_ preserves threading through state rebuild', () => {
    it('carries inReplyTo and references from currentState to newState', () => {
      const mime = buildTestMime({
        inReplyTo: '<original@example.com>',
        references: '<original@example.com>',
        subject: 'Re: Thread test',
      });
      gw.setMockRawMime(mime);
      gw.setMockDraftThreadId('thread-123');

      // Call handleEdit_ to change subject
      const resultJson = callInContext(gw.context, 'handleEdit_',
        { draftLabelName: 'AI-Drafts' },
        { draftId: 'draft-1', subject: 'Re: Updated subject' },
      );

      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.ok, true);

      // Verify the rebuilt MIME contains threading headers
      const storedMime = gw.getLastStoredMime();
      assert.match(storedMime, /In-Reply-To: <original@example\.com>/);
      assert.match(storedMime, /References: <original@example\.com>/);
    });
  });

  describe('handleAttach_ preserves threading through state mutation', () => {
    it('keeps inReplyTo and references after adding an attachment', () => {
      const mime = buildTestMime({
        inReplyTo: '<thread-msg@example.com>',
        references: '<thread-msg@example.com>',
      });
      gw.setMockRawMime(mime);
      gw.setMockDraftThreadId('thread-456');

      const resultJson = callInContext(gw.context, 'handleAttach_',
        { draftLabelName: 'AI-Drafts' },
        {
          draftId: 'draft-2',
          filename: 'test.png',
          mimeType: 'image/png',
          content: Buffer.from('fake-png-data').toString('base64'),
        },
      );

      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.ok, true);

      const storedMime = gw.getLastStoredMime();
      assert.match(storedMime, /In-Reply-To: <thread-msg@example\.com>/);
      assert.match(storedMime, /References: <thread-msg@example\.com>/);
    });
  });

  describe('handleDetach_ preserves threading through state mutation', () => {
    it('keeps inReplyTo and references after removing an attachment', () => {
      const mime = buildTestMime({
        inReplyTo: '<detach-msg@example.com>',
        references: '<detach-msg@example.com>',
        attachments: [
          { filename: 'remove-me.pdf', mimeType: 'application/pdf' },
          { filename: 'keep-me.png', mimeType: 'image/png' },
        ],
      });
      gw.setMockRawMime(mime);
      gw.setMockDraftThreadId('thread-789');

      const resultJson = callInContext(gw.context, 'handleDetach_',
        { draftLabelName: 'AI-Drafts' },
        { draftId: 'draft-3', filename: 'remove-me.pdf' },
      );

      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.ok, true);

      const storedMime = gw.getLastStoredMime();
      assert.match(storedMime, /In-Reply-To: <detach-msg@example\.com>/);
      assert.match(storedMime, /References: <detach-msg@example\.com>/);
    });
  });

  describe('updateDraft_ passes threadId to Gmail API', () => {
    it('includes threadId in the update payload when provided', () => {
      gw.setMockDraftThreadId('thread-preserve');

      vm.runInContext(
        `updateDraft_("draft-tid", "MIME-Version: 1.0\\r\\nSubject: test\\r\\n\\r\\nBody", "thread-preserve")`,
        gw.context,
      );

      assert.equal(gw.calls.draftsUpdate.length, 1);
      const payload = gw.calls.draftsUpdate[0];
      assert.equal(payload.resource.message.threadId, 'thread-preserve');
      assert.equal(payload.draftId, 'draft-tid');
    });

    it('omits threadId from payload when not provided', () => {
      vm.runInContext(
        `updateDraft_("draft-notid", "MIME-Version: 1.0\\r\\nSubject: test\\r\\n\\r\\nBody")`,
        gw.context,
      );

      assert.equal(gw.calls.draftsUpdate.length, 1);
      const payload = gw.calls.draftsUpdate[0];
      assert.equal(payload.resource.message.threadId, undefined);
    });
  });

  describe('updateDraftAndRelabel_ reads and passes threadId', () => {
    it('reads threadId from draft resource before updating', () => {
      gw.setMockDraftThreadId('thread-relabel');
      gw.setMockRawMime(buildTestMime({}));

      // updateDraftAndRelabel_ reads the draft to get threadId, then calls updateDraft_
      vm.runInContext(
        `updateDraftAndRelabel_("draft-relabel", "MIME-Version: 1.0\\r\\nSubject: test\\r\\n\\r\\nBody", { draftLabelName: "AI-Drafts" })`,
        gw.context,
      );

      // First getDraftResource_ call reads threadId, then updateDraft_ is called
      const updateCall = gw.calls.draftsUpdate[0];
      assert.equal(updateCall.resource.message.threadId, 'thread-relabel');
    });
  });
});

describe('gateway: new v3.3 actions (draft-raw, draft-meta, raw-update)', () => {
  let gw;

  beforeEach(() => {
    gw = createGatewayContext();
  });

  describe('handleDraftRaw_ returns raw MIME + metadata', () => {
    it('returns raw MIME, messageId, and threadId for a valid draft', () => {
      const mime = buildTestMime({ subject: 'Raw Test' });
      gw.setMockRawMime(mime);
      gw.setMockDraftThreadId('thread-raw-1');
      gw.setMockDraftMessageId('msg-raw-1');

      const resultJson = callInContext(gw.context, 'handleDraftRaw_',
        { draftLabelName: 'AI-Drafts' },
        { draftId: 'draft-raw-1' },
      );

      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.ok, true);
      assert.equal(result.draftId, 'draft-raw-1');
      assert.equal(result.messageId, 'msg-raw-1');
      assert.equal(result.threadId, 'thread-raw-1');
      assert.ok(result.raw.length > 0);
    });

    it('returns error for missing draftId', () => {
      const resultJson = callInContext(gw.context, 'handleDraftRaw_',
        { draftLabelName: 'AI-Drafts' },
        {},
      );
      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.error, 'draftId is required');
    });
  });

  describe('handleDraftMeta_ returns metadata only', () => {
    it('returns messageId and threadId without raw MIME', () => {
      gw.setMockDraftThreadId('thread-meta-1');
      gw.setMockDraftMessageId('msg-meta-1');

      const resultJson = callInContext(gw.context, 'handleDraftMeta_',
        { draftLabelName: 'AI-Drafts' },
        { draftId: 'draft-meta-1' },
      );

      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.ok, true);
      assert.equal(result.draftId, 'draft-meta-1');
      assert.equal(result.messageId, 'msg-meta-1');
      assert.equal(result.threadId, 'thread-meta-1');
      assert.equal(result.raw, undefined);
    });

    it('returns error for missing draftId', () => {
      const resultJson = callInContext(gw.context, 'handleDraftMeta_',
        { draftLabelName: 'AI-Drafts' },
        {},
      );
      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.error, 'draftId is required');
    });
  });

  describe('handleRawUpdate_ accepts pre-built MIME', () => {
    it('calls updateDraft_ with raw MIME and threadId', () => {
      gw.setMockDraftThreadId('thread-upd-1');
      gw.setMockDraftMessageId('msg-upd-1');
      gw.setMockRawMime(buildTestMime({}));

      const resultJson = callInContext(gw.context, 'handleRawUpdate_',
        { draftLabelName: 'AI-Drafts' },
        { draftId: 'draft-upd-1', raw: 'MIME-Version: 1.0\r\nSubject: Updated\r\n\r\nBody', threadId: 'thread-upd-1' },
      );

      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.ok, true);
      assert.equal(result.draftId, 'draft-upd-1');

      // Verify updateDraft_ was called
      assert.equal(gw.calls.draftsUpdate.length, 1);
      assert.equal(gw.calls.draftsUpdate[0].draftId, 'draft-upd-1');
      assert.equal(gw.calls.draftsUpdate[0].resource.message.threadId, 'thread-upd-1');
    });

    it('returns error for missing draftId', () => {
      const resultJson = callInContext(gw.context, 'handleRawUpdate_',
        { draftLabelName: 'AI-Drafts' },
        { raw: 'some mime' },
      );
      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.error, 'draftId is required');
    });

    it('returns error for missing raw content', () => {
      const resultJson = callInContext(gw.context, 'handleRawUpdate_',
        { draftLabelName: 'AI-Drafts' },
        { draftId: 'draft-x' },
      );
      const result = JSON.parse(resultJson.getContent());
      assert.equal(result.error, 'raw MIME content is required');
    });

    it('falls back to draft threadId when not provided in request', () => {
      gw.setMockDraftThreadId('thread-fallback');
      gw.setMockDraftMessageId('msg-fb');
      gw.setMockRawMime(buildTestMime({}));

      callInContext(gw.context, 'handleRawUpdate_',
        { draftLabelName: 'AI-Drafts' },
        { draftId: 'draft-fb', raw: 'MIME-Version: 1.0\r\nSubject: test\r\n\r\nBody' },
      );

      assert.equal(gw.calls.draftsUpdate[0].resource.message.threadId, 'thread-fallback');
    });
  });
});

describe('gateway: edit/attach/detach round-trip with threading', () => {
  let gw;

  beforeEach(() => {
    gw = createGatewayContext();
  });

  it('full round-trip: reply MIME → edit → attach → detach preserves threading', () => {
    // Start with a reply MIME that has threading headers
    const replyMime = buildTestMime({
      inReplyTo: '<original@example.com>',
      references: '<root@example.com> <original@example.com>',
      subject: 'Re: Full round-trip test',
    });
    gw.setMockRawMime(replyMime);
    gw.setMockDraftThreadId('thread-roundtrip');

    // Step 1: Edit the draft (change subject)
    callInContext(gw.context, 'handleEdit_',
      { draftLabelName: 'AI-Drafts' },
      { draftId: 'draft-rt', subject: 'Re: Updated round-trip' },
    );

    let storedMime = gw.getLastStoredMime();
    assert.match(storedMime, /In-Reply-To: <original@example\.com>/);
    assert.match(storedMime, /References: <root@example\.com> <original@example\.com>/);

    // Update mock to return the just-stored MIME for the next operation
    gw.setMockRawMime(storedMime);

    // Step 2: Attach a file
    callInContext(gw.context, 'handleAttach_',
      { draftLabelName: 'AI-Drafts' },
      {
        draftId: 'draft-rt',
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        content: Buffer.from('pdf-content').toString('base64'),
      },
    );

    storedMime = gw.getLastStoredMime();
    assert.match(storedMime, /In-Reply-To: <original@example\.com>/);
    assert.match(storedMime, /References: <root@example\.com> <original@example\.com>/);

    // Update mock for next operation
    gw.setMockRawMime(storedMime);

    // Step 3: Detach the file
    callInContext(gw.context, 'handleDetach_',
      { draftLabelName: 'AI-Drafts' },
      { draftId: 'draft-rt', filename: 'doc.pdf' },
    );

    storedMime = gw.getLastStoredMime();
    assert.match(storedMime, /In-Reply-To: <original@example\.com>/);
    assert.match(storedMime, /References: <root@example\.com> <original@example\.com>/);

    // Verify threadId was passed in every update call
    for (const call of gw.calls.draftsUpdate) {
      assert.equal(call.resource.message.threadId, 'thread-roundtrip',
        'threadId must be preserved in every update call');
    }
  });
});

describe('gateway: handleReply_ From and Reply-To handling', () => {
  let gw;

  beforeEach(() => {
    gw = createGatewayContext();
  });

  it('sets From to original To address (reply as the recipient)', () => {
    gw.setMockMessageFrom('Furnished Finder <messaging@leads.ff.com>');
    gw.setMockMessageTo('user@example.com');

    const result = callInContext(gw.context, 'handleReply_',
      { labelName: 'AI-Drafts', draftLabelName: 'AI-Drafts' },
      { messageId: 'msg-123', html: '<p>Hi</p>', replyAll: true },
    );
    const resp = JSON.parse(result.getContent());
    assert.ok(resp.ok, 'reply should succeed');

    // Inspect the raw MIME passed to Drafts.create
    const createCall = gw.calls.draftsCreate[0];
    const rawMime = Buffer.from(createCall.resource.message.raw, 'base64').toString('utf8');
    assert.match(rawMime, /From: user@example\.com/, 'From should be the original recipient');
  });

  it('uses Reply-To header for To address when present', () => {
    gw.setMockMessageFrom('Furnished Finder <messaging@leads.ff.com>');
    gw.setMockMessageTo('user@example.com');
    gw.setMockHeaders({ 'Reply-To': 'furnishedfinder-12345.abc@leads.ff.com' });

    const result = callInContext(gw.context, 'handleReply_',
      { labelName: 'AI-Drafts', draftLabelName: 'AI-Drafts' },
      { messageId: 'msg-123', html: '<p>Hi</p>', replyAll: false },
    );
    const resp = JSON.parse(result.getContent());
    assert.ok(resp.ok, 'reply should succeed');

    const createCall = gw.calls.draftsCreate[0];
    const rawMime = Buffer.from(createCall.resource.message.raw, 'base64').toString('utf8');
    assert.match(rawMime, /To: furnishedfinder-12345\.abc@leads\.ff\.com/,
      'To should use Reply-To header, not From');
  });

  it('falls back to From when no Reply-To header', () => {
    gw.setMockMessageFrom('direct-sender@example.com');
    gw.setMockMessageTo('me@example.com');
    gw.setMockHeaders({}); // no Reply-To

    const result = callInContext(gw.context, 'handleReply_',
      { labelName: 'AI-Drafts', draftLabelName: 'AI-Drafts' },
      { messageId: 'msg-123', html: '<p>Hi</p>', replyAll: false },
    );
    const resp = JSON.parse(result.getContent());
    assert.ok(resp.ok, 'reply should succeed');

    const createCall = gw.calls.draftsCreate[0];
    const rawMime = Buffer.from(createCall.resource.message.raw, 'base64').toString('utf8');
    assert.match(rawMime, /To: direct-sender@example\.com/,
      'To should fall back to From when no Reply-To');
  });
});
