import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAttachments, parseDraftState, buildMime } from '../lib/mime.mjs';

// --- parseAttachments ---

describe('parseAttachments', () => {
  function buildMimeMsg(parts, boundary = '----=_Part_123') {
    let msg = `From: test@example.com\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    for (const part of parts) {
      msg += `--${boundary}\r\n${part}\r\n`;
    }
    msg += `--${boundary}--\r\n`;
    return msg;
  }

  it('extracts a base64-encoded attachment', async () => {
    const content = Buffer.from('fake pdf content');
    const raw = buildMimeMsg([
      'Content-Type: text/plain\r\n\r\nBody text',
      `Content-Type: application/pdf\r\nContent-Disposition: attachment; filename="report.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${content.toString('base64')}`,
    ]);
    const attachments = await parseAttachments(raw);
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].filename, 'report.pdf');
    assert.deepEqual(attachments[0].content, content);
  });

  it('extracts multiple attachments', async () => {
    const pdf = Buffer.from('pdf bytes');
    const img = Buffer.from('png bytes');
    const raw = buildMimeMsg([
      'Content-Type: text/plain\r\n\r\nBody',
      `Content-Type: application/pdf\r\nContent-Disposition: attachment; filename="doc.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${pdf.toString('base64')}`,
      `Content-Type: image/png\r\nContent-Disposition: attachment; filename="logo.png"\r\nContent-Transfer-Encoding: base64\r\n\r\n${img.toString('base64')}`,
    ]);
    const attachments = await parseAttachments(raw);
    assert.equal(attachments.length, 2);
    assert.equal(attachments[0].filename, 'doc.pdf');
    assert.equal(attachments[1].filename, 'logo.png');
    assert.deepEqual(attachments[0].content, pdf);
    assert.deepEqual(attachments[1].content, img);
  });

  it('returns empty array for single-part message', async () => {
    const raw = 'From: test@example.com\r\nContent-Type: text/plain\r\n\r\nHello World';
    const attachments = await parseAttachments(raw);
    assert.equal(attachments.length, 0);
  });

  it('returns empty array for multipart with no attachments', async () => {
    const raw = buildMimeMsg([
      'Content-Type: text/plain\r\n\r\nPlain text body',
      'Content-Type: text/html\r\n\r\n<p>HTML body</p>',
    ]);
    const attachments = await parseAttachments(raw);
    assert.equal(attachments.length, 0);
  });

  it('handles base64 with line wrapping', async () => {
    const original = 'A'.repeat(200);
    const b64 = Buffer.from(original).toString('base64');
    const wrapped = b64.match(/.{1,76}/g).join('\r\n');
    const raw = buildMimeMsg([
      `Content-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="data.bin"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrapped}`,
    ]);
    const attachments = await parseAttachments(raw);
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].content.toString(), original);
  });

  it('handles nested multipart (multipart/related wrapping multipart/mixed)', async () => {
    const innerContent = Buffer.from('inner attachment data');
    const innerBoundary = '----=_Inner_456';
    const outerBoundary = '----=_Outer_789';
    const raw = [
      `From: test@example.com`,
      `Content-Type: multipart/related; boundary="${outerBoundary}"`,
      '',
      `--${outerBoundary}`,
      `Content-Type: multipart/mixed; boundary="${innerBoundary}"`,
      '',
      `--${innerBoundary}`,
      'Content-Type: text/plain',
      '',
      'Body text',
      `--${innerBoundary}`,
      'Content-Type: application/pdf',
      'Content-Disposition: attachment; filename="nested.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      innerContent.toString('base64'),
      `--${innerBoundary}--`,
      `--${outerBoundary}--`,
    ].join('\r\n');
    const attachments = await parseAttachments(raw);
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].filename, 'nested.pdf');
    assert.deepEqual(attachments[0].content, innerContent);
  });

  it('handles inline images with Content-ID', async () => {
    const imgData = Buffer.from('inline image data');
    const raw = buildMimeMsg([
      'Content-Type: text/html\r\n\r\n<img src="cid:img1">',
      `Content-Type: image/png; name="photo.png"\r\nContent-Disposition: inline; filename="photo.png"\r\nContent-ID: <img1>\r\nContent-Transfer-Encoding: base64\r\n\r\n${imgData.toString('base64')}`,
    ]);
    const attachments = await parseAttachments(raw);
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].filename, 'photo.png');
  });

  it('sets filename to null when no filename provided', async () => {
    const raw = buildMimeMsg([
      `Content-Type: application/octet-stream\r\nContent-Disposition: attachment\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from('data').toString('base64')}`,
    ]);
    const attachments = await parseAttachments(raw);
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].filename, null);
  });

  it('returns content as Buffer', async () => {
    const raw = buildMimeMsg([
      `Content-Type: application/pdf\r\nContent-Disposition: attachment; filename="test.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from('test').toString('base64')}`,
    ]);
    const attachments = await parseAttachments(raw);
    assert.ok(Buffer.isBuffer(attachments[0].content));
  });

  it('includes mimeType in result', async () => {
    const raw = buildMimeMsg([
      `Content-Type: image/jpeg\r\nContent-Disposition: attachment; filename="photo.jpg"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from('jpeg').toString('base64')}`,
    ]);
    const attachments = await parseAttachments(raw);
    assert.equal(attachments[0].mimeType, 'image/jpeg');
  });
});

// --- parseDraftState ---

describe('parseDraftState', () => {
  it('parses a simple HTML message', async () => {
    const raw = [
      'From: Alice <alice@example.com>',
      'To: Bob <bob@example.com>',
      'Cc: Carol <carol@example.com>',
      'Subject: Hello',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      '<p>Hello World</p>',
    ].join('\r\n');
    const state = await parseDraftState(raw);
    assert.equal(state.from, 'Alice <alice@example.com>');
    assert.equal(state.to, 'Bob <bob@example.com>');
    assert.equal(state.cc, 'Carol <carol@example.com>');
    assert.equal(state.subject, 'Hello');
    assert.match(state.htmlBody, /Hello World/);
    assert.equal(state.attachments.length, 0);
  });

  it('parses threading headers', async () => {
    const raw = [
      'From: test@example.com',
      'To: recipient@example.com',
      'Subject: Re: Thread',
      'In-Reply-To: <abc@example.com>',
      'References: <abc@example.com> <def@example.com>',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      '<p>Reply</p>',
    ].join('\r\n');
    const state = await parseDraftState(raw);
    assert.equal(state.inReplyTo, '<abc@example.com>');
    assert.equal(state.references, '<abc@example.com> <def@example.com>');
  });

  it('returns empty strings for missing threading headers', async () => {
    const raw = 'From: test@example.com\r\nSubject: New\r\nContent-Type: text/html\r\n\r\n<p>Hi</p>';
    const state = await parseDraftState(raw);
    assert.equal(state.inReplyTo, '');
    assert.equal(state.references, '');
  });

  it('parses attachments with base64 content', async () => {
    const pdfData = Buffer.from('pdf content');
    const raw = [
      'From: test@example.com',
      'To: recipient@example.com',
      'Subject: With Attachment',
      'Content-Type: multipart/mixed; boundary="----=_Part_1"',
      '',
      '------=_Part_1',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      '<p>Body</p>',
      '------=_Part_1',
      'Content-Type: application/pdf; name="report.pdf"',
      'Content-Disposition: attachment; filename="report.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      pdfData.toString('base64'),
      '------=_Part_1--',
    ].join('\r\n');
    const state = await parseDraftState(raw);
    assert.equal(state.attachments.length, 1);
    assert.equal(state.attachments[0].filename, 'report.pdf');
    assert.equal(state.attachments[0].mimeType, 'application/pdf');
    assert.equal(state.attachments[0].base64, pdfData.toString('base64'));
    assert.equal(state.attachments[0].contentId, null);
  });

  it('parses inline images with Content-ID', async () => {
    const imgData = Buffer.from('image data');
    const raw = [
      'From: test@example.com',
      'Content-Type: multipart/related; boundary="----=_Rel_1"',
      '',
      '------=_Rel_1',
      'Content-Type: text/html',
      '',
      '<img src="cid:img-0">',
      '------=_Rel_1',
      'Content-Type: image/png; name="logo.png"',
      'Content-Disposition: inline; filename="logo.png"',
      'Content-ID: <img-0>',
      'Content-Transfer-Encoding: base64',
      '',
      imgData.toString('base64'),
      '------=_Rel_1--',
    ].join('\r\n');
    const state = await parseDraftState(raw);
    assert.equal(state.attachments.length, 1);
    assert.equal(state.attachments[0].filename, 'logo.png');
    assert.equal(state.attachments[0].contentId, 'img-0');
  });

  it('formats multiple recipients correctly', async () => {
    const raw = [
      'From: sender@example.com',
      'To: Alice <alice@example.com>, Bob <bob@example.com>',
      'Subject: Multi',
      'Content-Type: text/html',
      '',
      '<p>Hi</p>',
    ].join('\r\n');
    const state = await parseDraftState(raw);
    assert.match(state.to, /alice@example\.com/);
    assert.match(state.to, /bob@example\.com/);
  });
});

// --- buildMime ---

describe('buildMime', () => {
  it('builds simple HTML message (no attachments)', () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      htmlBody: '<p>Hello</p>',
      attachments: [],
    });
    assert.match(mime, /From:.*test@example\.com/);
    assert.match(mime, /To:.*recipient@example\.com/);
    assert.match(mime, /Subject:/);
    assert.match(mime, /text\/html/);
    assert.match(mime, /<p>Hello<\/p>/);
  });

  it('builds multipart/mixed with regular attachment', () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'With File',
      htmlBody: '<p>Body</p>',
      attachments: [{
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        base64: Buffer.from('fake-pdf').toString('base64'),
        contentId: null,
      }],
    });
    assert.match(mime, /multipart\/mixed/);
    assert.match(mime, /application\/pdf/);
    assert.match(mime, /report\.pdf/);
  });

  it('builds multipart/related with inline image (CID)', () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'With Inline',
      htmlBody: '<img src="cid:img-0">',
      attachments: [{
        filename: 'logo.png',
        mimeType: 'image/png',
        base64: Buffer.from('fake-img').toString('base64'),
        contentId: 'img-0',
      }],
    });
    assert.match(mime, /multipart\/related/);
    assert.match(mime, /Content-ID: <img-0>/);
    assert.match(mime, /logo\.png/);
  });

  it('builds mixed wrapping related (both inline + regular)', () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Both',
      htmlBody: '<img src="cid:img-0"><p>Text</p>',
      attachments: [
        { filename: 'logo.png', mimeType: 'image/png', base64: Buffer.from('img').toString('base64'), contentId: 'img-0' },
        { filename: 'doc.pdf', mimeType: 'application/pdf', base64: Buffer.from('pdf').toString('base64'), contentId: null },
      ],
    });
    assert.match(mime, /multipart\/mixed/);
    assert.match(mime, /multipart\/related/);
    assert.match(mime, /Content-ID: <img-0>/);
    assert.match(mime, /doc\.pdf/);
  });

  it('includes threading headers when present', () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Re: Thread',
      inReplyTo: '<msg-1@example.com>',
      references: '<msg-1@example.com>',
      htmlBody: '<p>Reply</p>',
      attachments: [],
    });
    assert.match(mime, /In-Reply-To: <msg-1@example\.com>/);
    assert.match(mime, /References: <msg-1@example\.com>/);
  });

  it('omits threading headers when empty', () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'New',
      inReplyTo: '',
      references: '',
      htmlBody: '<p>Hi</p>',
      attachments: [],
    });
    assert.doesNotMatch(mime, /In-Reply-To:/);
    assert.doesNotMatch(mime, /References:/);
  });

  it('includes Cc header when present', () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      cc: 'cc@example.com',
      subject: 'CC Test',
      htmlBody: '<p>Hi</p>',
      attachments: [],
    });
    assert.match(mime, /Cc:.*cc@example\.com/);
  });
});

// --- buildMime edge cases ---

describe('buildMime edge cases', () => {
  it('handles empty htmlBody', async () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Empty Body',
      htmlBody: '',
      attachments: [],
    });
    assert.ok(mime.length > 0);
    const state = await parseDraftState(mime);
    assert.equal(state.subject, 'Empty Body');
  });

  it('throws when from is missing (mimetext requires From header)', () => {
    assert.throws(() => buildMime({
      to: 'recipient@example.com',
      subject: 'No From',
      htmlBody: '<p>Hi</p>',
      attachments: [],
    }), /From.*required/i);
  });

  it('handles undefined attachments array', async () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'No Attachments Field',
      htmlBody: '<p>Hi</p>',
    });
    const state = await parseDraftState(mime);
    assert.equal(state.subject, 'No Attachments Field');
    assert.equal(state.attachments.length, 0);
  });

  it('sanitizes CRLF injection in subject', () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Safe\r\nBcc: evil@attacker.com',
      htmlBody: '<p>Hi</p>',
      attachments: [],
    });
    // CRLF stripped — no separate Bcc header line injected
    const lines = mime.split('\r\n');
    const bccHeaders = lines.filter(l => /^Bcc:/i.test(l));
    assert.equal(bccHeaders.length, 0, 'should not have a separate Bcc header line');
  });

  it('sanitizes CRLF injection in from address', () => {
    const mime = buildMime({
      from: 'test@example.com\r\nBcc: evil@attacker.com',
      to: 'recipient@example.com',
      subject: 'Injection Test',
      htmlBody: '<p>Hi</p>',
      attachments: [],
    });
    // CRLF stripped — "Bcc:" appears inside the address string, not as a separate header line
    const lines = mime.split('\r\n');
    const bccHeaders = lines.filter(l => /^Bcc:/i.test(l));
    assert.equal(bccHeaders.length, 0, 'should not have a separate Bcc header line');
  });

  it('sanitizes double quotes in filename', async () => {
    const mime = buildMime({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Filename Test',
      htmlBody: '<p>Hi</p>',
      attachments: [{
        filename: 'file"name.pdf',
        mimeType: 'application/pdf',
        base64: Buffer.from('data').toString('base64'),
        contentId: null,
      }],
    });
    const state = await parseDraftState(mime);
    assert.equal(state.attachments.length, 1);
    assert.doesNotMatch(state.attachments[0].filename, /"/);
    assert.match(state.attachments[0].filename, /file'name/);
  });
});

// --- Round-trip: parseDraftState → buildMime → parseDraftState ---

describe('round-trip: parseDraftState → buildMime → parseDraftState', () => {
  it('preserves threading headers through round-trip', async () => {
    const original = [
      'From: test@example.com',
      'To: recipient@example.com',
      'Subject: Re: Thread Test',
      'In-Reply-To: <original@example.com>',
      'References: <root@example.com> <original@example.com>',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      '<p>Reply body</p>',
    ].join('\r\n');

    const state1 = await parseDraftState(original);
    const rebuilt = buildMime(state1);
    const state2 = await parseDraftState(rebuilt);

    assert.equal(state2.inReplyTo, '<original@example.com>');
    assert.equal(state2.references, '<root@example.com> <original@example.com>');
    assert.equal(state2.subject, 'Re: Thread Test');
  });

  it('preserves attachments through round-trip', async () => {
    const pdfData = Buffer.from('round-trip pdf');
    const original = [
      'From: test@example.com',
      'To: recipient@example.com',
      'Subject: Attachment RT',
      'Content-Type: multipart/mixed; boundary="----=_RT"',
      '',
      '------=_RT',
      'Content-Type: text/html',
      '',
      '<p>Body</p>',
      '------=_RT',
      'Content-Type: application/pdf; name="doc.pdf"',
      'Content-Disposition: attachment; filename="doc.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      pdfData.toString('base64'),
      '------=_RT--',
    ].join('\r\n');

    const state1 = await parseDraftState(original);
    const rebuilt = buildMime(state1);
    const state2 = await parseDraftState(rebuilt);

    assert.equal(state2.attachments.length, 1);
    assert.equal(state2.attachments[0].filename, 'doc.pdf');
    assert.equal(state2.attachments[0].mimeType, 'application/pdf');
    // Content should survive round-trip
    assert.equal(
      Buffer.from(state2.attachments[0].base64, 'base64').toString(),
      'round-trip pdf',
    );
  });

  it('preserves inline images with CID through round-trip', async () => {
    const imgData = Buffer.from('inline-img');
    const original = [
      'From: test@example.com',
      'To: recipient@example.com',
      'Subject: CID RT',
      'Content-Type: multipart/related; boundary="----=_CID"',
      '',
      '------=_CID',
      'Content-Type: text/html',
      '',
      '<img src="cid:img-0">',
      '------=_CID',
      'Content-Type: image/png; name="logo.png"',
      'Content-Disposition: inline; filename="logo.png"',
      'Content-ID: <img-0>',
      'Content-Transfer-Encoding: base64',
      '',
      imgData.toString('base64'),
      '------=_CID--',
    ].join('\r\n');

    const state1 = await parseDraftState(original);
    assert.equal(state1.attachments[0].contentId, 'img-0');

    const rebuilt = buildMime(state1);
    const state2 = await parseDraftState(rebuilt);

    assert.equal(state2.attachments.length, 1);
    assert.equal(state2.attachments[0].contentId, 'img-0');
    assert.equal(state2.attachments[0].filename, 'logo.png');
  });

  it('handles empty optional fields', async () => {
    const raw = 'From: test@example.com\r\nSubject: Minimal\r\nContent-Type: text/html\r\n\r\n<p>Hi</p>';
    const state = await parseDraftState(raw);
    const rebuilt = buildMime(state);
    const state2 = await parseDraftState(rebuilt);

    assert.equal(state2.subject, 'Minimal');
    assert.equal(state2.cc, '');
    assert.equal(state2.inReplyTo, '');
    assert.equal(state2.references, '');
    assert.equal(state2.attachments.length, 0);
  });
});
