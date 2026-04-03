// Email Drafter — Google Apps Script Gateway (v3.3.0)
// Deploy as Web App: Execute as Me, Access: Anyone
// Requires: Gmail Advanced Service (Services > Gmail API > Add) for all draft and reply operations
//
// ALL configuration lives in Script Properties (no hardcoded config).
// Set properties via: Apps Script editor > Project Settings > Script Properties
//
// Required Script Properties:
//   apiKeys        — JSON object mapping hex keys to labels, e.g. {"abc123":"desktop"}
//
// Optional Script Properties (set via 'configure' action or UI):
//   labelName      — Gmail label for read access (empty = draft-only mode)
//   draftLabelName — Gmail label for draft management (empty = no draft management)
//   to             — Default recipients (comma-separated)
//   cc             — Default CC recipients
//   defaultSubject — Fallback subject line (default: "Draft")
//   maxResults     — Max threads/drafts returned by list (default: 25)
//
// Actions:
//   draft       — Create a standalone draft (v1 behavior, default)
//   list        — List messages with the access label (headers + snippet)
//   thread      — Read all messages in a labeled thread
//   read        — Read a single message body (must have access label)
//   reply       — Create a draft reply to a labeled message
//   raw         — Return raw RFC 2822 message for attachment extraction
//   list-drafts — List AI-managed drafts (requires draftLabelName)
//   read-draft  — Read full draft content by draftId (requires draftLabelName)
//   edit        — Update draft subject/to/cc/body (requires draftLabelName)
//   attach      — Add attachment to existing draft (requires draftLabelName)
//   detach      — Remove attachment from draft by filename (requires draftLabelName)
//   draft-raw   — Return raw MIME + metadata for a draft (requires draftLabelName, v3.3+)
//   draft-meta  — Return draft metadata only, no MIME (requires draftLabelName, v3.3+)
//   raw-update  — Accept pre-built raw MIME and update a draft (requires draftLabelName, v3.3+)
//   configure   — Update Script Properties (whitelisted fields only, excludes apiKeys)

var GATEWAY_VERSION = "3.4.0";

// Fields the 'configure' action is allowed to set.
// apiKeys, labelName, and draftLabelName are deliberately excluded — manage via Script Properties UI only.
// apiKeys: controls authentication (adding keys = granting access)
// labelName: controls read scope (changing label = escalating read permissions)
// draftLabelName: controls draft management scope
var CONFIGURE_WHITELIST = ["to", "cc", "defaultSubject", "maxResults"];

// ============================================
// Config from Script Properties
// ============================================

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var apiKeysRaw = props.getProperty("apiKeys");
  var apiKeys = {};
  if (apiKeysRaw) {
    try {
      apiKeys = JSON.parse(apiKeysRaw);
    } catch (e) {
      throw new Error(
        "apiKeys Script Property is malformed JSON — fix it in Project Settings > Script Properties (use double quotes, not single)",
      );
    }
  }

  return {
    apiKeys: apiKeys,
    labelName: props.getProperty("labelName") || "",
    draftLabelName: props.getProperty("draftLabelName") || "",
    to: props.getProperty("to") || "",
    cc: props.getProperty("cc") || "",
    defaultSubject: props.getProperty("defaultSubject") || "Draft",
    maxResults: parseInt(props.getProperty("maxResults") || "25", 10),
  };
}

// ============================================
// Router
// ============================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var config = getConfig_();
    var keyLabel = config.apiKeys[data.key];

    if (!keyLabel) {
      return jsonResponse_({ error: "unauthorized" });
    }

    // v1 compat: no action field = draft
    var action = data.action || "draft";

    switch (action) {
      case "draft":
        return handleDraft_(config, data);
      case "list":
        return requireLabel_(config, function () {
          return handleList_(config, data);
        });
      case "read":
        return requireLabel_(config, function () {
          return handleRead_(config, data);
        });
      case "reply":
        return requireLabel_(config, function () {
          return handleReply_(config, data);
        });
      case "thread":
        return requireLabel_(config, function () {
          return handleThread_(config, data);
        });
      case "raw":
        return requireLabel_(config, function () {
          return handleRaw_(config, data);
        });
      case "list-drafts":
        return requireDraftLabel_(config, function () {
          return handleListDrafts_(config, data);
        });
      case "read-draft":
        return requireDraftLabel_(config, function () {
          return handleReadDraft_(config, data);
        });
      case "edit":
        return requireDraftLabel_(config, function () {
          return handleEdit_(config, data);
        });
      case "attach":
        return requireDraftLabel_(config, function () {
          return handleAttach_(config, data);
        });
      case "detach":
        return requireDraftLabel_(config, function () {
          return handleDetach_(config, data);
        });
      case "draft-raw":
        return requireDraftLabel_(config, function () {
          return handleDraftRaw_(config, data);
        });
      case "draft-meta":
        return requireDraftLabel_(config, function () {
          return handleDraftMeta_(config, data);
        });
      case "raw-update":
        return requireDraftLabel_(config, function () {
          return handleRawUpdate_(config, data);
        });
      case "configure":
        return handleConfigure_(config, data);
      default:
        return jsonResponse_({ error: "unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse_({ error: err.message });
  }
}

function doGet() {
  try {
    var config = getConfig_();
    var resp = { status: "ok", version: GATEWAY_VERSION };
    if (config.labelName) resp.label = config.labelName;
    if (config.draftLabelName) resp.draftLabel = config.draftLabelName;
    return jsonResponse_(resp);
  } catch (err) {
    return jsonResponse_({ error: err.message });
  }
}

// ============================================
// Actions — Drafting
// ============================================

/**
 * Create a standalone draft. Returns draftId for subsequent operations.
 */
function handleDraft_(config, data) {
  if (typeof Gmail === "undefined") {
    return jsonResponse_({
      error:
        "Gmail Advanced Service not enabled — open Apps Script editor > Services > Gmail API > Add",
    });
  }

  var html = data.html || "";
  if (!html) {
    return jsonResponse_({ error: "html body is required" });
  }

  var to = data.to || config.to;
  var cc = data.cc || config.cc;
  var subject = data.subject || config.defaultSubject;

  // Strategy: two paths depending on whether inline images are present.
  //
  // WITH inline images: use GmailApp.createDraft() with inlineImages parameter.
  //   Gmail sets up its internal image rendering (CID via raw MIME doesn't work
  //   in the draft editor). Body emoji use HTML entities (browsers render them).
  //   Subject passed directly — GmailApp is a high-level API that may handle
  //   emoji fine internally. NO raw MIME update afterward (that would destroy
  //   Gmail's internal image URL mappings).
  //
  // WITHOUT inline images: use raw MIME via Gmail API for full emoji fidelity
  //   in both subject (RFC 2047) and body (manual UTF-8 encoding).

  var hasInline = data.inlineImages && data.inlineImages.length > 0;
  var draftId, messageId;

  if (hasInline) {
    // Build inlineImages map: { cid: Blob }
    var inlineImagesMap = {};
    for (var ai = 0; ai < data.inlineImages.length; ai++) {
      var img = data.inlineImages[ai];
      var cid = img.contentId || "img-" + ai;
      var decoded = Utilities.base64Decode(img.content);
      inlineImagesMap[cid] = Utilities.newBlob(
        decoded,
        img.mimeType,
        img.filename,
      );
    }

    // HTML-encode supplementary plane chars (emoji) in body only.
    // HTML entities are ASCII-safe and browsers render them identically.
    var safeHtml = htmlEncodeSupplementary_(html);

    var options = { htmlBody: safeHtml };
    if (cc) options.cc = cc;
    options.inlineImages = inlineImagesMap;

    // Pass subject directly — GmailApp handles MIME encoding internally.
    // Do NOT do a raw MIME update afterward — it destroys Gmail's image URLs.
    var draft = GmailApp.createDraft(to || "", subject, "", options);
    draftId = draft.getId();
    messageId = draft.getMessageId();
  } else {
    // No inline images — use raw MIME for full emoji fidelity
    var state = {
      from: "",
      to: to,
      cc: cc || "",
      subject: subject,
      htmlBody: html,
      htmlBodyBase64: "",
      attachments: [],
    };
    var rawMime = buildMimeMessage_(state);
    var encoded = base64UrlEncode_(rawMime);
    var created = Gmail.Users.Drafts.create(
      { message: { raw: encoded } },
      "me",
    );
    draftId = created.id;
    messageId = created.message.id;
  }

  var resp = {
    ok: true,
    subject: subject,
    draftId: draftId,
    messageId: messageId,
  };
  if (config.draftLabelName) {
    var msg = GmailApp.getMessageById(messageId);
    if (msg) msg.getThread().addLabel(getDraftLabel_(config));
  }
  return jsonResponse_(resp);
}

/**
 * HTML-encode supplementary plane characters (U+10000+) as numeric entities.
 * GmailApp corrupts 4-byte UTF-8 strings. HTML entities are ASCII-safe.
 */
function htmlEncodeSupplementary_(str) {
  var result = "";
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      var low = str.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        var cp = ((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
        result += "&#" + cp + ";";
        i++;
        continue;
      }
    }
    result += str.charAt(i);
  }
  return result;
}

/**
 * Create a draft reply to a specific message.
 * The message's thread must have the access label (if labelName set) or be unrestricted.
 */
function handleReply_(config, data) {
  if (typeof Gmail === "undefined") {
    return jsonResponse_({
      error:
        "Gmail Advanced Service not enabled — open Apps Script editor > Services > Gmail API > Add",
    });
  }

  if (!data.messageId) {
    return jsonResponse_({ error: "messageId is required" });
  }

  var html = data.html || "";
  if (!html) {
    return jsonResponse_({ error: "html body is required" });
  }

  var msg = GmailApp.getMessageById(data.messageId);
  if (!msg) {
    return jsonResponse_({ error: "message not found" });
  }

  var thread = msg.getThread();
  if (!threadHasNamedLabel_(thread, config.labelName)) {
    return jsonResponse_({
      error:
        'access denied — thread does not have "' + config.labelName + '" label',
    });
  }

  // Build reply headers — In-Reply-To and References for proper threading
  var replyAll = data.replyAll !== false;
  var origFrom = msg.getFrom();
  var origTo = msg.getTo();
  var origCc = msg.getCc() || "";
  var origSubject = msg.getSubject();

  // Reply destination: prefer Reply-To header (e.g. FF routing address), fall back to From
  var origReplyTo = msg.getHeader("Reply-To") || origFrom;
  var replyTo = origReplyTo;
  var replyCc = data.cc || "";
  if (replyAll) {
    var allRecipients = [origTo, origCc, replyCc]
      .filter(function (s) {
        return s;
      })
      .join(", ");
    replyCc = allRecipients;
  }

  var subject = origSubject.match(/^Re:/i) ? origSubject : "Re: " + origSubject;

  // Build raw MIME with threading headers
  var origMsgId =
    msg.getHeader("Message-ID") || msg.getHeader("Message-Id") || "";
  var state = {
    from: origTo,
    to: replyTo,
    cc: replyCc,
    subject: subject,
    inReplyTo: origMsgId,
    references: origMsgId,
    htmlBody: html,
    htmlBodyBase64: "",
    attachments: [],
  };
  var rawMime = buildMimeMessage_(state);

  var encoded = base64UrlEncode_(rawMime);
  var created = Gmail.Users.Drafts.create(
    { message: { raw: encoded, threadId: thread.getId() } },
    "me",
  );

  var resp = {
    ok: true,
    draftId: created.id,
    messageId: created.message.id,
    replyTo: msg.getId(),
    subject: subject,
  };
  if (config.draftLabelName) {
    var replyMsg = GmailApp.getMessageById(created.message.id);
    if (replyMsg) replyMsg.getThread().addLabel(getDraftLabel_(config));
  }
  return jsonResponse_(resp);
}

// ============================================
// Actions — Label-Gated Reading
// ============================================

/**
 * List labeled threads as summaries.
 */
function handleList_(config, data) {
  var label = getAccessLabel_(config);
  var threads = label.getThreads(0, config.maxResults);
  var summaries = [];

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var msgs = thread.getMessages();
    var lastMsg = msgs[msgs.length - 1];

    var participants = {};
    var hasAttachments = false;
    for (var m = 0; m < msgs.length; m++) {
      participants[msgs[m].getFrom()] = true;
      if (!hasAttachments && msgs[m].getAttachments().length > 0) {
        hasAttachments = true;
      }
    }

    summaries.push({
      threadId: thread.getId(),
      subject: thread.getFirstMessageSubject(),
      messageCount: msgs.length,
      lastDate: lastMsg.getDate().toISOString(),
      lastFrom: lastMsg.getFrom(),
      snippet: lastMsg.getPlainBody().substring(0, 200),
      participants: Object.keys(participants),
      hasAttachments: hasAttachments,
      isUnread: thread.isUnread(),
    });
  }

  return jsonResponse_({
    ok: true,
    label: config.labelName,
    count: summaries.length,
    threads: summaries,
  });
}

/**
 * Read an entire thread — all messages in chronological order.
 * Thread must have the access label.
 */
function handleThread_(config, data) {
  if (!data.threadId) {
    return jsonResponse_({ error: "threadId is required" });
  }

  var thread = GmailApp.getThreadById(data.threadId);
  if (!thread) {
    return jsonResponse_({ error: "thread not found" });
  }

  if (!threadHasNamedLabel_(thread, config.labelName)) {
    return jsonResponse_({
      error:
        'access denied — thread does not have "' + config.labelName + '" label',
    });
  }

  var msgs = thread.getMessages();
  var messages = [];

  for (var m = 0; m < msgs.length; m++) {
    var msg = msgs[m];
    var attachments = msg.getAttachments();
    var attachmentMeta = [];
    for (var a = 0; a < attachments.length; a++) {
      attachmentMeta.push({
        name: attachments[a].getName(),
        size: attachments[a].getSize(),
        contentType: attachments[a].getContentType(),
      });
    }
    messages.push({
      id: msg.getId(),
      from: msg.getFrom(),
      to: msg.getTo(),
      cc: msg.getCc(),
      date: msg.getDate().toISOString(),
      body: msg.getPlainBody(),
      attachments: attachmentMeta,
    });
  }

  return jsonResponse_({
    ok: true,
    threadId: thread.getId(),
    subject: thread.getFirstMessageSubject(),
    messageCount: messages.length,
    messages: messages,
  });
}

/**
 * Read a single message body. Message must be in a labeled thread.
 */
function handleRead_(config, data) {
  if (!data.messageId) {
    return jsonResponse_({ error: "messageId is required" });
  }

  var msg = GmailApp.getMessageById(data.messageId);
  if (!msg) {
    return jsonResponse_({ error: "message not found" });
  }

  if (!threadHasNamedLabel_(msg.getThread(), config.labelName)) {
    return jsonResponse_({
      error:
        'access denied — thread does not have "' + config.labelName + '" label',
    });
  }

  var attachments = msg.getAttachments();
  var attachmentMeta = [];
  for (var i = 0; i < attachments.length; i++) {
    attachmentMeta.push({
      name: attachments[i].getName(),
      size: attachments[i].getSize(),
      contentType: attachments[i].getContentType(),
    });
  }

  return jsonResponse_({
    ok: true,
    message: {
      id: msg.getId(),
      threadId: msg.getThread().getId(),
      from: msg.getFrom(),
      to: msg.getTo(),
      cc: msg.getCc(),
      subject: msg.getSubject(),
      date: msg.getDate().toISOString(),
      body: msg.getPlainBody(),
      htmlBody: msg.getBody(),
      attachments: attachmentMeta,
    },
  });
}

/**
 * Return the raw RFC 2822 message (headers + MIME body with attachments).
 */
function handleRaw_(config, data) {
  if (!data.messageId) {
    return jsonResponse_({ error: "messageId is required" });
  }

  var msg = GmailApp.getMessageById(data.messageId);
  if (!msg) {
    return jsonResponse_({ error: "message not found" });
  }

  if (!threadHasNamedLabel_(msg.getThread(), config.labelName)) {
    return jsonResponse_({
      error:
        'access denied — thread does not have "' + config.labelName + '" label',
    });
  }

  // Use Gmail API raw format (GmailApp.getRawContent() corrupts 4-byte emoji)
  var raw = getRawMime_(data.messageId);

  return jsonResponse_({
    ok: true,
    messageId: data.messageId,
    size: raw.length,
    raw: raw,
  });
}

// ============================================
// Actions — Configuration
// ============================================

/**
 * Update Script Properties for whitelisted fields.
 */
function handleConfigure_(config, data) {
  var props = PropertiesService.getScriptProperties();
  var updated = [];

  for (var i = 0; i < CONFIGURE_WHITELIST.length; i++) {
    var key = CONFIGURE_WHITELIST[i];
    if (data[key] !== undefined) {
      var value = typeof data[key] === "string" ? data[key] : String(data[key]);
      props.setProperty(key, value);
      updated.push(key);
    }
  }

  if (updated.length === 0) {
    return jsonResponse_({
      error:
        "no configurable fields provided. Allowed: " +
        CONFIGURE_WHITELIST.join(", "),
    });
  }

  return jsonResponse_({ ok: true, action: "configured", updated: updated });
}

// ============================================
// Actions — Draft Management (requires draftLabelName + Gmail Advanced Service)
// ============================================

/**
 * List AI-managed drafts. Only returns drafts whose thread has the draft label.
 * Uses Gmail Advanced Service to list drafts, then filters by label.
 */
function handleListDrafts_(config, data) {
  var draftLabel = getDraftLabel_(config);

  // Build a set of labeled thread IDs for fast lookup
  var labeledThreadIds = {};
  var labeledThreads = draftLabel.getThreads(0, 500);
  for (var t = 0; t < labeledThreads.length; t++) {
    labeledThreadIds[labeledThreads[t].getId()] = true;
  }

  // List drafts via Advanced Service (fetch more than maxResults to account for filtering)
  var response = Gmail.Users.Drafts.list("me", { maxResults: 200 });
  var allDrafts = response.drafts || [];
  var results = [];

  for (var d = 0; d < allDrafts.length; d++) {
    var draftEntry = allDrafts[d];
    if (!draftEntry.message || !labeledThreadIds[draftEntry.message.threadId])
      continue;

    // Use Gmail API metadata format for emoji-safe subject without downloading full body
    var msgMeta = Gmail.Users.Messages.get("me", draftEntry.message.id, {
      format: "metadata",
      metadataHeaders: ["Subject", "To", "Date"],
    });
    var headers = (msgMeta.payload && msgMeta.payload.headers) || [];
    var subject = "",
      to = "",
      date = "";
    for (var h = 0; h < headers.length; h++) {
      if (headers[h].name === "Subject")
        subject = decodeSubject_(headers[h].value || "");
      else if (headers[h].name === "To") to = headers[h].value || "";
      else if (headers[h].name === "Date") date = headers[h].value || "";
    }
    var snippet = msgMeta.snippet || "";

    results.push({
      draftId: draftEntry.id,
      messageId: draftEntry.message.id,
      threadId: draftEntry.message.threadId,
      subject: subject,
      to: to,
      date: date,
      snippet: snippet,
      hasAttachments:
        ((msgMeta.payload && msgMeta.payload.parts) || []).length > 1,
    });

    if (results.length >= config.maxResults) break;
  }

  return jsonResponse_({
    ok: true,
    draftLabel: config.draftLabelName,
    count: results.length,
    drafts: results,
  });
}

/**
 * Read full draft content by draftId. Returns HTML body and attachment metadata.
 */
function handleReadDraft_(config, data) {
  if (!data.draftId) {
    return jsonResponse_({ error: "draftId is required" });
  }

  var draftResource = getDraftResource_(data.draftId);
  if (!draftResource) {
    return jsonResponse_({ error: "draft not found" });
  }

  // Verify draft label access via GmailApp (still needed for label check)
  var msg = GmailApp.getMessageById(draftResource.message.id);
  if (!msg) {
    return jsonResponse_({ error: "draft message not found" });
  }

  if (!threadHasNamedLabel_(msg.getThread(), config.draftLabelName)) {
    return jsonResponse_({
      error:
        'access denied — draft does not have "' +
        config.draftLabelName +
        '" label',
    });
  }

  // Use Gmail API raw format — GmailApp.getRawContent() corrupts 4-byte emoji
  var state = extractDraftState_(
    parseMime_(getRawMime_(draftResource.message.id)),
  );

  var attachmentMeta = [];
  for (var i = 0; i < state.attachments.length; i++) {
    var att = state.attachments[i];
    var size = att.base64 ? Math.floor((att.base64.length * 3) / 4) : 0;
    attachmentMeta.push({
      name: att.filename,
      size: size,
      contentType: att.mimeType,
    });
  }

  return jsonResponse_({
    ok: true,
    draftId: data.draftId,
    messageId: draftResource.message.id,
    threadId: draftResource.message.threadId,
    subject: state.subject,
    from: state.from,
    to: state.to,
    cc: state.cc,
    date: msg.getDate().toISOString(),
    htmlBody: state.htmlBody,
    body: state.htmlBody.replace(/<[^>]+>/g, ""),
    attachments: attachmentMeta,
  });
}

/**
 * Edit a draft — update subject, to, cc, and/or HTML body.
 * Preserves existing attachments (including inline images with Content-IDs).
 * Uses replace semantics: provided fields override, omitted fields preserved.
 */
function handleEdit_(config, data) {
  if (!data.draftId) {
    return jsonResponse_({ error: "draftId is required" });
  }

  if (!data.subject && !data.to && data.cc === undefined && !data.html) {
    return jsonResponse_({
      error: "at least one field to update is required (subject, to, cc, html)",
    });
  }

  var draftResource = getDraftResource_(data.draftId);
  if (!draftResource) {
    return jsonResponse_({ error: "draft not found" });
  }

  var msg = GmailApp.getMessageById(draftResource.message.id);
  if (!msg) {
    return jsonResponse_({ error: "draft message not found" });
  }

  var thread = msg.getThread();
  if (!threadHasNamedLabel_(thread, config.draftLabelName)) {
    return jsonResponse_({
      error:
        'access denied — draft does not have "' +
        config.draftLabelName +
        '" label',
    });
  }

  // Get current state — use Gmail API raw format (GmailApp.getRawContent() corrupts 4-byte emoji)
  var currentState = extractDraftState_(
    parseMime_(getRawMime_(draftResource.message.id)),
  );

  // Override provided fields, preserve the rest
  // Clear htmlBodyBase64 when body changes to force re-encode from new string
  var newState = {
    from: currentState.from,
    to: data.to || currentState.to,
    cc: data.cc !== undefined ? data.cc : currentState.cc,
    subject: data.subject || currentState.subject,
    inReplyTo: currentState.inReplyTo,
    references: currentState.references,
    htmlBody: data.html || currentState.htmlBody,
    htmlBodyBase64: data.html ? "" : currentState.htmlBodyBase64,
    attachments: currentState.attachments,
  };

  var rawMime = buildMimeMessage_(newState);
  updateDraftAndRelabel_(data.draftId, rawMime, config);

  return jsonResponse_({
    ok: true,
    draftId: data.draftId,
    subject: newState.subject,
  });
}

/**
 * Attach a file to an existing draft. One file per call (each gets its own 30s window).
 * For inline images, provide contentId — HTML should reference as <img src="cid:contentId">.
 */
function handleAttach_(config, data) {
  if (!data.draftId) {
    return jsonResponse_({ error: "draftId is required" });
  }
  if (!data.filename) {
    return jsonResponse_({ error: "filename is required" });
  }
  if (!data.mimeType) {
    return jsonResponse_({ error: "mimeType is required" });
  }
  if (!data.content) {
    return jsonResponse_({ error: "content (base64) is required" });
  }

  var draftResource = getDraftResource_(data.draftId);
  if (!draftResource) {
    return jsonResponse_({ error: "draft not found" });
  }

  var msg = GmailApp.getMessageById(draftResource.message.id);
  if (!msg) {
    return jsonResponse_({ error: "draft message not found" });
  }

  if (!threadHasNamedLabel_(msg.getThread(), config.draftLabelName)) {
    return jsonResponse_({
      error:
        'access denied — draft does not have "' +
        config.draftLabelName +
        '" label',
    });
  }

  // Get current state — use Gmail API raw format (GmailApp.getRawContent() corrupts 4-byte emoji)
  var currentState = extractDraftState_(
    parseMime_(getRawMime_(draftResource.message.id)),
  );

  // Add new attachment
  currentState.attachments.push({
    filename: data.filename,
    mimeType: data.mimeType,
    base64: data.content,
    contentId: data.contentId || null,
  });

  var rawMime = buildMimeMessage_(currentState);
  updateDraftAndRelabel_(data.draftId, rawMime, config);

  return jsonResponse_({
    ok: true,
    draftId: data.draftId,
    attached: data.filename,
  });
}

/**
 * Remove an attachment from a draft by filename. Removes the first match.
 */
function handleDetach_(config, data) {
  if (!data.draftId) {
    return jsonResponse_({ error: "draftId is required" });
  }
  if (!data.filename) {
    return jsonResponse_({ error: "filename is required" });
  }

  var draftResource = getDraftResource_(data.draftId);
  if (!draftResource) {
    return jsonResponse_({ error: "draft not found" });
  }

  var msg = GmailApp.getMessageById(draftResource.message.id);
  if (!msg) {
    return jsonResponse_({ error: "draft message not found" });
  }

  if (!threadHasNamedLabel_(msg.getThread(), config.draftLabelName)) {
    return jsonResponse_({
      error:
        'access denied — draft does not have "' +
        config.draftLabelName +
        '" label',
    });
  }

  // Use Gmail API raw format (GmailApp.getRawContent() corrupts 4-byte emoji)
  var currentState = extractDraftState_(
    parseMime_(getRawMime_(draftResource.message.id)),
  );

  // Find and remove first matching attachment
  var removed = false;
  var filtered = [];
  for (var i = 0; i < currentState.attachments.length; i++) {
    if (!removed && currentState.attachments[i].filename === data.filename) {
      removed = true;
    } else {
      filtered.push(currentState.attachments[i]);
    }
  }

  if (!removed) {
    return jsonResponse_({
      error: 'attachment "' + data.filename + '" not found in draft',
    });
  }

  currentState.attachments = filtered;
  var rawMime = buildMimeMessage_(currentState);
  updateDraftAndRelabel_(data.draftId, rawMime, config);

  return jsonResponse_({
    ok: true,
    draftId: data.draftId,
    detached: data.filename,
  });
}

// ============================================
// Actions — Client-Side MIME Flow (v3.3+)
// ============================================

/**
 * Return raw MIME + metadata for a draft. Used by client-side MIME rebuild flow.
 * Client fetches once, caches locally, and re-downloads only when messageId changes.
 */
function handleDraftRaw_(config, data) {
  if (!data.draftId) {
    return jsonResponse_({ error: "draftId is required" });
  }

  var draftResource = getDraftResource_(data.draftId);
  if (!draftResource) {
    return jsonResponse_({ error: "draft not found" });
  }

  var msg = GmailApp.getMessageById(draftResource.message.id);
  if (!msg) {
    return jsonResponse_({ error: "draft message not found" });
  }

  if (!threadHasNamedLabel_(msg.getThread(), config.draftLabelName)) {
    return jsonResponse_({
      error:
        'access denied — draft does not have "' +
        config.draftLabelName +
        '" label',
    });
  }

  var raw = getRawMime_(draftResource.message.id);
  return jsonResponse_({
    ok: true,
    draftId: data.draftId,
    messageId: draftResource.message.id,
    threadId: draftResource.message.threadId,
    raw: raw,
  });
}

/**
 * Return metadata only (no MIME body) for a draft. Used for cache validation —
 * client compares messageId against its cached version to decide whether to re-download.
 */
function handleDraftMeta_(config, data) {
  if (!data.draftId) {
    return jsonResponse_({ error: "draftId is required" });
  }

  var draftResource = getDraftResource_(data.draftId);
  if (!draftResource) {
    return jsonResponse_({ error: "draft not found" });
  }

  var msg = GmailApp.getMessageById(draftResource.message.id);
  if (!msg) {
    return jsonResponse_({ error: "draft message not found" });
  }

  if (!threadHasNamedLabel_(msg.getThread(), config.draftLabelName)) {
    return jsonResponse_({
      error:
        'access denied — draft does not have "' +
        config.draftLabelName +
        '" label',
    });
  }

  return jsonResponse_({
    ok: true,
    draftId: data.draftId,
    messageId: draftResource.message.id,
    threadId: draftResource.message.threadId,
  });
}

/**
 * Accept pre-built raw MIME from the client and update the draft.
 * Client handles all MIME parsing/building; GAS just does Drafts.update + relabel.
 */
function handleRawUpdate_(config, data) {
  if (!data.draftId) {
    return jsonResponse_({ error: "draftId is required" });
  }
  if (!data.raw) {
    return jsonResponse_({ error: "raw MIME content is required" });
  }

  var draftResource = getDraftResource_(data.draftId);
  if (!draftResource) {
    return jsonResponse_({ error: "draft not found" });
  }

  var msg = GmailApp.getMessageById(draftResource.message.id);
  if (!msg) {
    return jsonResponse_({ error: "draft message not found" });
  }

  if (!threadHasNamedLabel_(msg.getThread(), config.draftLabelName)) {
    return jsonResponse_({
      error:
        'access denied — draft does not have "' +
        config.draftLabelName +
        '" label',
    });
  }

  var threadId = data.threadId || draftResource.message.threadId;
  updateDraft_(data.draftId, data.raw, threadId);

  // Re-apply draft label after update
  draftResource = getDraftResource_(data.draftId);
  if (draftResource) {
    var updatedMsg = GmailApp.getMessageById(draftResource.message.id);
    if (updatedMsg) {
      updatedMsg.getThread().addLabel(getDraftLabel_(config));
    }
  }

  return jsonResponse_({
    ok: true,
    draftId: data.draftId,
  });
}

// ============================================
// MIME Helpers — Parse
// ============================================

/**
 * Parse a raw RFC 2822 message into a structured tree.
 * Returns { headers: {}, body: string, parts: [] }
 */
function parseMime_(raw) {
  var divider = raw.indexOf("\r\n\r\n");
  var nlLen = 4;
  if (divider === -1) {
    divider = raw.indexOf("\n\n");
    nlLen = 2;
  }
  if (divider === -1) return { headers: {}, body: raw, parts: [] };

  var headerStr = raw.substring(0, divider);
  var body = raw.substring(divider + nlLen);

  // Unfold continued headers (lines starting with whitespace)
  headerStr = headerStr.replace(/\r?\n[ \t]+/g, " ");
  var headers = {};
  var lines = headerStr.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var colon = lines[i].indexOf(":");
    if (colon > 0) {
      var name = lines[i].substring(0, colon).trim().toLowerCase();
      var value = lines[i].substring(colon + 1).trim();
      headers[name] = value;
    }
  }

  // Check for multipart
  var ct = headers["content-type"] || "";
  var boundaryMatch = ct.match(/boundary="?([^";\r\n]+)"?/i);
  if (!boundaryMatch) {
    return { headers: headers, body: body, parts: [] };
  }

  var boundary = boundaryMatch[1].trim();
  var delimiter = "--" + boundary;
  var sections = body.split(delimiter);

  var parts = [];
  for (var j = 1; j < sections.length; j++) {
    var section = sections[j];
    // Closing boundary
    if (section.substring(0, 2) === "--") break;
    // Strip leading/trailing CRLF around part content
    section = section.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    parts.push(parseMime_(section));
  }

  return { headers: headers, body: "", parts: parts };
}

/**
 * Extract draft state from a parsed MIME tree.
 * Returns { from, to, cc, subject, inReplyTo, references, htmlBody, attachments[] }
 * Each attachment: { filename, mimeType, base64, contentId }
 */
function extractDraftState_(parsed) {
  var state = {
    from: parsed.headers["from"] || "",
    to: parsed.headers["to"] || "",
    cc: parsed.headers["cc"] || "",
    subject: decodeSubject_(parsed.headers["subject"] || ""),
    inReplyTo: parsed.headers["in-reply-to"] || "",
    references: parsed.headers["references"] || "",
    htmlBody: "",
    htmlBodyBase64: "", // Preserve raw base64 to avoid decode/re-encode lossy round-trip
    attachments: [],
  };

  if (parsed.parts.length === 0) {
    // Single part message
    var encoding = (
      parsed.headers["content-transfer-encoding"] || ""
    ).toLowerCase();
    if (encoding === "base64") {
      state.htmlBodyBase64 = parsed.body.replace(/\s/g, "");
      var decoded = Utilities.base64Decode(state.htmlBodyBase64);
      state.htmlBody = decodeUtf8Bytes_(decoded);
    } else if (encoding === "quoted-printable") {
      state.htmlBody = decodeQuotedPrintable_(parsed.body);
    } else {
      state.htmlBody = parsed.body;
    }
    return state;
  }

  // Walk parts recursively
  walkParts_(parsed.parts, state);
  return state;
}

/**
 * Recursively walk MIME parts to extract HTML body and attachments.
 */
function walkParts_(parts, state) {
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    var ct = (part.headers["content-type"] || "").toLowerCase();
    var cd = part.headers["content-disposition"] || "";
    var cid = part.headers["content-id"] || "";

    if (part.parts.length > 0) {
      // Nested multipart — recurse
      walkParts_(part.parts, state);
    } else if (
      ct.indexOf("text/html") === 0 &&
      cd.indexOf("attachment") === -1
    ) {
      // HTML body part
      var encoding = (
        part.headers["content-transfer-encoding"] || ""
      ).toLowerCase();
      if (encoding === "base64") {
        state.htmlBodyBase64 = part.body.replace(/\s/g, "");
        var decoded = Utilities.base64Decode(state.htmlBodyBase64);
        state.htmlBody = decodeUtf8Bytes_(decoded);
      } else if (encoding === "quoted-printable") {
        state.htmlBody = decodeQuotedPrintable_(part.body);
      } else {
        state.htmlBody = part.body;
      }
    } else if (
      ct &&
      ct.indexOf("multipart/") === -1 &&
      (ct.indexOf("text/plain") !== 0 || cd.indexOf("attachment") !== -1)
    ) {
      // Attachment or inline image (text/plain skipped unless Content-Disposition: attachment)
      var filename = "";
      var nameMatch =
        cd.match(/filename="?([^";]+)"?/i) || ct.match(/name="?([^";]+)"?/i);
      if (nameMatch) filename = nameMatch[1].trim();

      var mimeType = ct.split(";")[0].trim();
      var partEncoding = (
        part.headers["content-transfer-encoding"] || ""
      ).toLowerCase();
      var base64Content;
      if (partEncoding === "base64") {
        base64Content = part.body.replace(/\s/g, "");
      } else {
        base64Content = Utilities.base64Encode(
          Utilities.newBlob(part.body).getBytes(),
        );
      }

      var contentId = null;
      if (cid) {
        contentId = cid.replace(/^</, "").replace(/>$/, "");
      }

      state.attachments.push({
        filename: filename,
        mimeType: mimeType,
        base64: base64Content,
        contentId: contentId,
      });
    }
  }
}

/**
 * Get raw MIME string for a message using Gmail API (not GmailApp).
 * GmailApp.getMessageById().getRawContent() corrupts 4-byte UTF-8 (emoji).
 * Gmail Advanced Service returns Byte[] for the raw field, which we decode manually.
 */
function getRawMime_(messageId) {
  var rawMsg = Gmail.Users.Messages.get("me", messageId, { format: "raw" });
  return decodeRawMimeField_(rawMsg.raw);
}

/**
 * Decode the raw field from Gmail.Users.Messages.get(format:'raw').
 * GAS Advanced Service returns Byte[] directly (not a base64url string like the REST API).
 * Handles both cases for safety, then decodes bytes to string using our custom UTF-8 decoder.
 */
function decodeRawMimeField_(raw) {
  var rawMimeBytes;
  if (typeof raw === "string") {
    var rawB64 = raw.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
    var pad = rawB64.length % 4;
    if (pad === 2) rawB64 += "==";
    else if (pad === 3) rawB64 += "=";
    rawMimeBytes = Utilities.base64Decode(rawB64);
  } else {
    rawMimeBytes = raw;
  }
  return decodeUtf8Bytes_(rawMimeBytes);
}

/**
 * Encode a JavaScript string to a UTF-8 byte array.
 * GAS's Utilities.base64Encode(text, Charset.UTF_8) and Utilities.newBlob(text).getBytes()
 * both corrupt 4-byte UTF-8 sequences (emoji in supplementary planes) by encoding each
 * UTF-16 surrogate half independently. This manual encoder handles surrogate pairs correctly.
 */
function encodeUtf8Bytes_(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    var cp;
    // Handle surrogate pairs (4-byte UTF-8 chars like emoji)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      var low = str.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = ((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
        i++; // skip low surrogate
      } else {
        cp = code; // lone high surrogate, encode as-is
      }
    } else {
      cp = code;
    }
    // Encode code point as UTF-8 bytes
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6));
      bytes.push(0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12));
      bytes.push(0x80 | ((cp >> 6) & 0x3f));
      bytes.push(0x80 | (cp & 0x3f));
    } else {
      bytes.push(0xf0 | (cp >> 18));
      bytes.push(0x80 | ((cp >> 12) & 0x3f));
      bytes.push(0x80 | ((cp >> 6) & 0x3f));
      bytes.push(0x80 | (cp & 0x3f));
    }
  }
  return bytes;
}

/**
 * Decode a UTF-8 byte array to a JavaScript string.
 * GAS's Utilities.newBlob(bytes).getDataAsString('UTF-8') corrupts 4-byte
 * sequences (emoji in supplementary planes). This manual decoder handles all
 * UTF-8 sequences including 4-byte (U+10000–U+10FFFF) correctly.
 */
function decodeUtf8Bytes_(bytes) {
  var str = "";
  var i = 0;
  while (i < bytes.length) {
    var b = bytes[i] & 0xff; // unsigned
    var cp;
    if (b < 0x80) {
      cp = b;
      i += 1;
    } else if (b < 0xe0) {
      cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0xff & 0x3f);
      i += 2;
    } else if (b < 0xf0) {
      cp =
        ((b & 0x0f) << 12) |
        ((bytes[i + 1] & 0xff & 0x3f) << 6) |
        (bytes[i + 2] & 0xff & 0x3f);
      i += 3;
    } else {
      cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0xff & 0x3f) << 12) |
        ((bytes[i + 2] & 0xff & 0x3f) << 6) |
        (bytes[i + 3] & 0xff & 0x3f);
      i += 4;
    }
    str += String.fromCodePoint(cp);
  }
  return str;
}

/**
 * Decode a quoted-printable encoded string.
 */
function decodeQuotedPrintable_(str) {
  // Unfold soft line breaks, then collect raw bytes and decode as UTF-8
  var unfolded = str.replace(/=\r?\n/g, "");
  var bytes = [];
  for (var i = 0; i < unfolded.length; i++) {
    if (unfolded[i] === "=" && i + 2 < unfolded.length) {
      var hex = unfolded.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(unfolded.charCodeAt(i));
  }
  return decodeUtf8Bytes_(bytes);
}

/**
 * Decode an RFC 2047 encoded subject (=?charset?encoding?text?=).
 */
function decodeSubject_(subject) {
  return subject.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g,
    function (_, charset, encoding, text) {
      if (encoding.toUpperCase() === "B") {
        var bytes = Utilities.base64Decode(text);
        return decodeUtf8Bytes_(bytes);
      } else {
        // Q encoding: like quoted-printable but _ = space
        var decoded = text
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, function (__, hex) {
            return String.fromCharCode(parseInt(hex, 16));
          });
        return decoded;
      }
    },
  );
}

// ============================================
// MIME Helpers — Build
// ============================================

/**
 * Build a complete RFC 2822 MIME message from draft state.
 * Handles: HTML-only, HTML+attachments, HTML+inline images, HTML+both.
 *
 * Structure when both present:
 *   multipart/mixed
 *     multipart/related
 *       text/html
 *       inline images (Content-ID)
 *     regular attachments
 */
function buildMimeMessage_(state) {
  var regularAttachments = [];
  var inlineImages = [];
  for (var i = 0; i < state.attachments.length; i++) {
    if (state.attachments[i].contentId) {
      inlineImages.push(state.attachments[i]);
    } else {
      regularAttachments.push(state.attachments[i]);
    }
  }

  var hasRegular = regularAttachments.length > 0;
  var hasInline = inlineImages.length > 0;

  // Headers
  var headerLines = [];
  headerLines.push("MIME-Version: 1.0");
  if (state.from) headerLines.push("From: " + sanitizeHeaderValue_(state.from));
  if (state.to) headerLines.push("To: " + sanitizeHeaderValue_(state.to));
  if (state.cc) headerLines.push("Cc: " + sanitizeHeaderValue_(state.cc));
  headerLines.push("Subject: " + encodeSubject_(state.subject));
  if (state.inReplyTo)
    headerLines.push("In-Reply-To: " + sanitizeHeaderValue_(state.inReplyTo));
  if (state.references)
    headerLines.push("References: " + sanitizeHeaderValue_(state.references));

  if (!hasRegular && !hasInline) {
    // Simple HTML message
    headerLines.push('Content-Type: text/html; charset="UTF-8"');
    headerLines.push("Content-Transfer-Encoding: base64");
    headerLines.push("");
    headerLines.push(wrapBase64_(encodeHtmlBase64_(state)));
    return headerLines.join("\r\n");
  }

  if (hasInline && hasRegular) {
    // multipart/mixed wrapping multipart/related + regular attachments
    var mixedBoundary = generateBoundary_("mixed");
    var relatedBoundary = generateBoundary_("related");

    headerLines.push(
      'Content-Type: multipart/mixed; boundary="' + mixedBoundary + '"',
    );
    headerLines.push("");

    var parts = [];

    // Related section: HTML + inline images
    var relatedPart =
      'Content-Type: multipart/related; boundary="' +
      relatedBoundary +
      '"\r\n\r\n';
    relatedPart += buildHtmlPart_(state, relatedBoundary);
    for (var ii = 0; ii < inlineImages.length; ii++) {
      relatedPart += buildAttachmentPart_(inlineImages[ii], relatedBoundary);
    }
    relatedPart += "--" + relatedBoundary + "--";
    parts.push(relatedPart);

    // Regular attachments
    for (var ra = 0; ra < regularAttachments.length; ra++) {
      parts.push(buildAttachmentPartContent_(regularAttachments[ra]));
    }

    // Assemble
    var body = "";
    for (var p = 0; p < parts.length; p++) {
      body += "--" + mixedBoundary + "\r\n" + parts[p] + "\r\n";
    }
    body += "--" + mixedBoundary + "--";
    return headerLines.join("\r\n") + "\r\n" + body;
  } else if (hasInline) {
    // multipart/related: HTML + inline images
    var relBoundary = generateBoundary_("related");
    headerLines.push(
      'Content-Type: multipart/related; boundary="' + relBoundary + '"',
    );
    headerLines.push("");

    var relBody = buildHtmlPart_(state, relBoundary);
    for (var il = 0; il < inlineImages.length; il++) {
      relBody += buildAttachmentPart_(inlineImages[il], relBoundary);
    }
    relBody += "--" + relBoundary + "--";
    return headerLines.join("\r\n") + "\r\n" + relBody;
  } else {
    // multipart/mixed: HTML + regular attachments
    var mBoundary = generateBoundary_("mixed");
    headerLines.push(
      'Content-Type: multipart/mixed; boundary="' + mBoundary + '"',
    );
    headerLines.push("");

    var mBody = buildHtmlPart_(state, mBoundary);
    for (var at = 0; at < regularAttachments.length; at++) {
      mBody += buildAttachmentPart_(regularAttachments[at], mBoundary);
    }
    mBody += "--" + mBoundary + "--";
    return headerLines.join("\r\n") + "\r\n" + mBody;
  }
}

/**
 * Encode HTML body to base64, reusing preserved base64 when body is unmodified.
 * Avoids lossy decode/re-encode round-trip for supplementary Unicode (emoji, etc.).
 */
function encodeHtmlBase64_(state) {
  if (state.htmlBodyBase64) return state.htmlBodyBase64;
  return Utilities.base64Encode(encodeUtf8Bytes_(state.htmlBody));
}

/**
 * Build the HTML body MIME part with boundary delimiter.
 */
function buildHtmlPart_(state, boundary) {
  return (
    "--" +
    boundary +
    "\r\n" +
    'Content-Type: text/html; charset="UTF-8"\r\n' +
    "Content-Transfer-Encoding: base64\r\n" +
    "\r\n" +
    wrapBase64_(encodeHtmlBase64_(state)) +
    "\r\n"
  );
}

/**
 * Build an attachment MIME part with boundary delimiter.
 */
function buildAttachmentPart_(att, boundary) {
  return "--" + boundary + "\r\n" + buildAttachmentPartContent_(att) + "\r\n";
}

/**
 * Build attachment MIME part content (headers + body, without boundary delimiter).
 */
function buildAttachmentPartContent_(att) {
  var disposition = att.contentId ? "inline" : "attachment";
  var safeName = sanitizeHeaderValue_(att.filename);
  var lines = [];
  lines.push("Content-Type: " + att.mimeType + '; name="' + safeName + '"');
  lines.push(
    "Content-Disposition: " + disposition + '; filename="' + safeName + '"',
  );
  lines.push("Content-Transfer-Encoding: base64");
  if (att.contentId) {
    var safeId = sanitizeHeaderValue_(att.contentId);
    lines.push("Content-ID: <" + safeId + ">");
    lines.push("X-Attachment-Id: " + safeId);
  }
  lines.push("");
  lines.push(wrapBase64_(att.base64));
  return lines.join("\r\n");
}

/**
 * Generate a unique MIME boundary string.
 */
function generateBoundary_(prefix) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var result = "----=_" + (prefix || "Part") + "_";
  for (var i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Wrap base64 string at 76 characters per line (MIME compliance).
 */
function wrapBase64_(b64) {
  var lines = [];
  for (var i = 0; i < b64.length; i += 76) {
    lines.push(b64.substring(i, i + 76));
  }
  return lines.join("\r\n");
}

/**
 * Strip characters that could inject MIME headers (CRLF) or break quoted strings.
 */
function sanitizeHeaderValue_(val) {
  if (!val) return val;
  return val.replace(/[\r\n]/g, "").replace(/"/g, "'");
}

/**
 * Encode a subject for MIME headers (RFC 2047 if non-ASCII).
 */
function encodeSubject_(subject) {
  subject = sanitizeHeaderValue_(subject);
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  var b64 = Utilities.base64Encode(encodeUtf8Bytes_(subject));
  return "=?UTF-8?B?" + b64 + "?=";
}

/**
 * Base64url-encode a raw MIME string for the Gmail API.
 */
function base64UrlEncode_(rawMime) {
  return Utilities.base64EncodeWebSafe(encodeUtf8Bytes_(rawMime)).replace(
    /=+$/,
    "",
  );
}

// ============================================
// Draft Helpers — Gmail Advanced Service
// ============================================

/**
 * Get a draft resource from the Gmail Advanced Service.
 * Returns { id, message: { id, threadId } } or null.
 */
function getDraftResource_(draftId) {
  try {
    return Gmail.Users.Drafts.get("me", draftId);
  } catch (e) {
    return null;
  }
}

/**
 * Update a draft's message content via the Gmail Advanced Service.
 * @param {string} draftId
 * @param {string} rawMime
 * @param {string} [threadId] - Thread ID to preserve thread association through update
 */
function updateDraft_(draftId, rawMime, threadId) {
  var encoded = base64UrlEncode_(rawMime);
  var msg = { raw: encoded };
  if (threadId) msg.threadId = threadId;
  Gmail.Users.Drafts.update({ message: msg }, "me", draftId);
}

/**
 * Update a draft and re-apply the draft label to its thread.
 * Drafts.update replaces the underlying message, so re-label to be safe.
 * Reads the draft's threadId before updating to preserve thread association.
 */
function updateDraftAndRelabel_(draftId, rawMime, config) {
  var draftResource = getDraftResource_(draftId);
  var threadId =
    draftResource && draftResource.message
      ? draftResource.message.threadId
      : null;
  updateDraft_(draftId, rawMime, threadId);
  draftResource = getDraftResource_(draftId);
  if (draftResource) {
    var msg = GmailApp.getMessageById(draftResource.message.id);
    if (msg) {
      msg.getThread().addLabel(getDraftLabel_(config));
    }
  }
}

// ============================================
// Label Helpers
// ============================================

/**
 * Guard: require read label to be configured and exist.
 */
function requireLabel_(config, fn) {
  if (!config.labelName) {
    return jsonResponse_({
      error:
        "label-gated features not configured — set labelName in Script Properties",
    });
  }
  var label = GmailApp.getUserLabelByName(config.labelName);
  if (!label) {
    return jsonResponse_({
      error: 'label "' + config.labelName + '" not found — create it in Gmail',
    });
  }
  return fn();
}

/**
 * Guard: require draft label to be configured and Gmail Advanced Service enabled.
 * Auto-creates the label if it doesn't exist.
 */
function requireDraftLabel_(config, fn) {
  if (!config.draftLabelName) {
    return jsonResponse_({
      error:
        "draft management not configured — set draftLabelName in Script Properties",
    });
  }
  if (typeof Gmail === "undefined") {
    return jsonResponse_({
      error:
        "Gmail Advanced Service not enabled — open Apps Script editor > Services > Gmail API > Add",
    });
  }
  return fn();
}

function getAccessLabel_(config) {
  return GmailApp.getUserLabelByName(config.labelName);
}

/**
 * Get (or create) the draft management label.
 */
function getDraftLabel_(config) {
  var label = GmailApp.getUserLabelByName(config.draftLabelName);
  if (!label) {
    label = GmailApp.createLabel(config.draftLabelName);
  }
  return label;
}

/**
 * Label a draft's thread with the draft management label.
 */
function labelDraft_(config, draft) {
  var label = getDraftLabel_(config);
  draft.getMessage().getThread().addLabel(label);
}

/**
 * Check if a thread has a specific named label.
 */
function threadHasNamedLabel_(thread, labelName) {
  var labels = thread.getLabels();
  for (var i = 0; i < labels.length; i++) {
    if (labels[i].getName() === labelName) return true;
  }
  return false;
}

// ============================================
// Response
// ============================================

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
