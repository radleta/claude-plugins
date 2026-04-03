// MIME parsing via postal-mime and building via mimetext.
// Handles nested multipart, RFC 2047, CID inline images, and all encodings.

import PostalMime from 'postal-mime';
import { createMimeMessage } from 'mimetext';

/**
 * Parse a raw RFC 2822 message and return attachments.
 * Each attachment: { filename, mimeType, content (Buffer) }
 */
export async function parseAttachments(raw) {
  const parser = new PostalMime();
  const email = await parser.parse(raw);
  return (email.attachments || []).map(att => ({
    filename: att.filename || null,
    mimeType: att.mimeType,
    content: Buffer.from(att.content),
  }));
}

/**
 * Format an address object or array into a string like "Name <addr>, Name2 <addr2>".
 * Handles both single { address, name } and arrays thereof.
 */
function formatAddresses(addrOrArray) {
  if (!addrOrArray) return '';
  const arr = Array.isArray(addrOrArray) ? addrOrArray : [addrOrArray];
  return arr
    .map(a => {
      if (!a || !a.address) return '';
      return a.name ? `${a.name} <${a.address}>` : a.address;
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Parse raw RFC 2822 MIME and convert to GAS draft state shape.
 * Returns { from, to, cc, subject, inReplyTo, references, htmlBody, attachments[] }
 * Each attachment: { filename, mimeType, base64, contentId }
 */
export async function parseDraftState(raw) {
  const parser = new PostalMime();
  const email = await parser.parse(raw);

  const state = {
    from: formatAddresses(email.from),
    to: formatAddresses(email.to),
    cc: formatAddresses(email.cc),
    subject: email.subject || '',
    inReplyTo: '',
    references: '',
    htmlBody: email.html || '',
    attachments: (email.attachments || []).map(att => ({
      filename: att.filename || '',
      mimeType: att.mimeType,
      base64: Buffer.from(att.content).toString('base64'),
      contentId: att.contentId ? att.contentId.replace(/^<|>$/g, '') : null,
    })),
  };

  // Extract threading headers from the headers array
  for (const h of (email.headers || [])) {
    const key = h.key.toLowerCase();
    if (key === 'in-reply-to') state.inReplyTo = h.value;
    else if (key === 'references') state.references = h.value;
  }

  return state;
}

/**
 * Strip CRLF and neutralize quotes in header values to prevent MIME header injection.
 * Mirrors the server-side sanitizeHeaderValue_() in apps-script.js.
 */
function sanitizeHeader(val) {
  if (!val) return val;
  return val.replace(/[\r\n]/g, '').replace(/"/g, "'");
}

/**
 * Build a complete RFC 2822 MIME message from a GAS-shaped draft state object.
 * Handles all 4 structure variants:
 *   1. Simple HTML (no attachments)
 *   2. multipart/mixed (HTML + regular attachments)
 *   3. multipart/related (HTML + inline images with CID)
 *   4. multipart/mixed wrapping multipart/related (both)
 *
 * @param {Object} state - GAS draft state shape
 * @param {string} state.from - Sender address
 * @param {string} state.to - Recipient(s)
 * @param {string} [state.cc] - CC recipient(s)
 * @param {string} state.subject - Subject line
 * @param {string} [state.inReplyTo] - In-Reply-To header
 * @param {string} [state.references] - References header
 * @param {string} state.htmlBody - HTML body content
 * @param {Array} [state.attachments] - Attachments array
 * @returns {string} Raw RFC 2822 MIME message
 */
export function buildMime(state) {
  const msg = createMimeMessage();

  if (state.from) msg.setSender(sanitizeHeader(state.from));
  if (state.to) msg.setRecipient(sanitizeHeader(state.to));
  if (state.cc) msg.setCc(sanitizeHeader(state.cc));
  msg.setSubject(sanitizeHeader(state.subject || ''));

  // Threading headers
  if (state.inReplyTo) msg.setHeader('In-Reply-To', sanitizeHeader(state.inReplyTo));
  if (state.references) msg.setHeader('References', sanitizeHeader(state.references));

  // HTML body
  msg.addMessage({
    contentType: 'text/html',
    data: state.htmlBody || '',
  });

  // Add attachments
  for (const att of (state.attachments || [])) {
    const safeFilename = sanitizeHeader(att.filename);
    if (att.contentId) {
      // Inline image with CID
      msg.addAttachment({
        filename: safeFilename,
        contentType: att.mimeType,
        data: att.base64,
        encoding: 'base64',
        inline: true,
        headers: { 'Content-ID': `<${sanitizeHeader(att.contentId)}>` },
      });
    } else {
      // Regular attachment
      msg.addAttachment({
        filename: safeFilename,
        contentType: att.mimeType,
        data: att.base64,
        encoding: 'base64',
      });
    }
  }

  return msg.asRaw();
}
