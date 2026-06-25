const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ========== WebSocket Protocol (RFC 6455) ==========

const OPCODES = { TEXT: 0x01, CLOSE: 0x08, PING: 0x09, PONG: 0x0A };
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function computeAcceptKey(clientKey) {
  return crypto.createHash('sha1').update(clientKey + WS_MAGIC).digest('base64');
}

function encodeFrame(opcode, payload) {
  const fin = 0x80;
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = fin | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = fin | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = fin | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const secondByte = buffer[1];
  const opcode = buffer[0] & 0x0F;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLen = secondByte & 0x7F;
  let offset = 2;

  if (!masked) throw new Error('Client frames must be masked');

  const MAX_PAYLOAD = 1024 * 1024;

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  if (payloadLen > MAX_PAYLOAD) throw new Error('Payload exceeds 1MB limit');

  const maskOffset = offset;
  const dataOffset = offset + 4;
  const totalLen = dataOffset + payloadLen;
  if (buffer.length < totalLen) return null;

  const mask = buffer.slice(maskOffset, dataOffset);
  const data = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    data[i] = buffer[dataOffset + i] ^ mask[i % 4];
  }

  return { opcode, payload: data, bytesConsumed: totalLen };
}

// ========== Configuration ==========

const PORT = parseInt(process.env.VISUAL_COMPANION_PORT, 10) || 0;
const HOST = process.env.VISUAL_COMPANION_HOST || '127.0.0.1';
const URL_HOST = process.env.VISUAL_COMPANION_URL_HOST || 'localhost';
const CONFIG_DIR = process.env.VISUAL_COMPANION_CONFIG_DIR
  || path.join(os.homedir(), '.claude', 'visual-companion');

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.md': 'text/markdown'
};

// ========== Templates and Constants ==========

const frameTemplate = fs.readFileSync(path.join(__dirname, 'frame-template.html'), 'utf-8');
const helperScript = fs.readFileSync(path.join(__dirname, 'helper.js'), 'utf-8');
const helperInjection = '<script>\n' + helperScript + '\n</script>';
const mdRendererPath = path.join(__dirname, 'md-renderer.js');
const mdRendererScript = fs.existsSync(mdRendererPath)
  ? fs.readFileSync(mdRendererPath, 'utf-8')
  : '// md-renderer.js not found — raw MD displayed as fallback';

// ========== Helper Functions ==========

function isFullDocument(html) {
  const trimmed = html.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

// ========== Breadcrumb Builder ==========

// Generates breadcrumb HTML for the header nav.
// projectHash: 8-char hash or null (dashboard)
// projectName: display name or null (dashboard)
// relativePath: path within project dir, e.g. "subdir/file.md" or null (project root)
function buildBreadcrumbs(projectHash, projectName, relativePath) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const homeLink = '<a href="/">Home</a>';

  if (!projectHash || !projectName) {
    // Dashboard — Home is the current page (not linked)
    return '<span class="bc-segment"><span class="bc-current">Home</span></span>';
  }

  const safeName = esc(projectName);
  const projectUrl = '/' + encodeURIComponent(projectHash) + '/';

  // No relative path — project root index
  if (!relativePath) {
    return [
      '<span class="bc-segment">' + homeLink + '</span>',
      '<span class="bc-sep">›</span>',
      '<span class="bc-segment"><span class="bc-current">' + safeName + '</span></span>',
    ].join('');
  }

  // Build segments from relative path
  const parts = relativePath.split('/').filter(Boolean);
  const segments = [
    '<span class="bc-segment">' + homeLink + '</span>',
    '<span class="bc-sep">›</span>',
    '<span class="bc-segment"><a href="' + projectUrl + '">' + safeName + '</a></span>',
  ];

  // Intermediate path segments (subdirs)
  for (let i = 0; i < parts.length - 1; i++) {
    const segUrl = '/' + encodeURIComponent(projectHash) + '/' +
      parts.slice(0, i + 1).map(encodeURIComponent).join('/') + '/';
    segments.push('<span class="bc-sep">›</span>');
    segments.push('<span class="bc-segment"><a href="' + segUrl + '">' + esc(parts[i]) + '</a></span>');
  }

  // Final segment — current page (not linked)
  const last = parts[parts.length - 1];
  segments.push('<span class="bc-sep">›</span>');
  segments.push('<span class="bc-segment"><span class="bc-current">' + esc(last) + '</span></span>');

  return segments.join('');
}

function wrapInFrame(content, breadcrumbHtml) {
  const bc = breadcrumbHtml !== undefined ? breadcrumbHtml : buildBreadcrumbs(null, null, null);
  return frameTemplate
    .replace('<!-- BREADCRUMBS -->', bc)
    .replace('<!-- CONTENT -->', content);
}

function injectHelper(html) {
  if (html.includes('</body>')) {
    return html.replace('</body>', helperInjection + '\n</body>');
  }
  return html + helperInjection;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildMdShell(rawMd, filename, mtime, projectHash, projectName, relativePath) {
  const escapedMd = rawMd.replace(/<\/script>/gi, '<\\/script>');
  const escapedFilename = filename.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeHash = (projectHash || '').replace(/"/g, '&quot;');

  const cdnBase = 'https://cdn.jsdelivr.net/npm';
  const cdnScripts = [
    `${cdnBase}/markdown-it@14/dist/markdown-it.min.js`,
    `${cdnBase}/@highlightjs/cdn-assets@11.11.1/highlight.min.js`,
    `${cdnBase}/markdown-it-task-lists@2/dist/markdown-it-task-lists.min.js`,
    `${cdnBase}/markdown-it-footnote@4/dist/markdown-it-footnote.min.js`,
    `${cdnBase}/markdown-it-mark@4/dist/markdown-it-mark.min.js`,
    `${cdnBase}/markdown-it-ins@4/dist/markdown-it-ins.min.js`,
    `${cdnBase}/markdown-it-sub@2/dist/markdown-it-sub.min.js`,
    `${cdnBase}/markdown-it-sup@2/dist/markdown-it-sup.min.js`,
    `${cdnBase}/markdown-it-deflist@3/dist/markdown-it-deflist.min.js`,
    `${cdnBase}/markdown-it-emoji@3/dist/markdown-it-emoji.min.js`,
    `${cdnBase}/markdown-it-attrs@4.3.1/markdown-it-attrs.browser.js`,
    `${cdnBase}/markdown-it-anchor@9/dist/markdownItAnchor.umd.js`,
    `${cdnBase}/markdown-it-multimd-table@4/dist/markdown-it-multimd-table.min.js`,
    `${cdnBase}/markdown-it-container@4/dist/markdown-it-container.min.js`,
    `${cdnBase}/markdown-it-toc-done-right@4/dist/markdownItTocDoneRight.umd.js`,
  ];
  const cdnCss = [];
  const esmImports = `
  <script type="module">
    import obsidianCallouts from '${cdnBase}/markdown-it-obsidian-callouts@0.3.3/+esm';
    import collapsible from '${cdnBase}/markdown-it-collapsible@2.0.2/+esm';
    window.markdownitObsidianCallouts = obsidianCallouts;
    window.markdownitCollapsible = collapsible;
    window.dispatchEvent(new Event('vc-esm-ready'));
  </script>`;

  const scriptTags = cdnScripts.map(u => `  <script defer src="${u}"></script>`).join('\n');
  const cssTags = cdnCss.map(u => `  <link rel="stylesheet" href="${u}">`).join('\n');

  const mdContentBlock = `<div id="md-rendered"></div>
<script type="text/markdown" id="md-source">${escapedMd}</script>
<meta name="vc-filename" content="${escapedFilename}">
<meta name="vc-mtime" content="${mtime}">
<meta name="vc-project-hash" content="${safeHash}">
<link rel="preconnect" href="${cdnBase}">
${cssTags}
${scriptTags}
${esmImports}
<script>
${mdRendererScript}
</script>`;

  const breadcrumbs = buildBreadcrumbs(projectHash || null, projectName || null, relativePath || null);
  return wrapInFrame(mdContentBlock, breadcrumbs);
}

// ========== Security Headers ==========

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data:; font-src https://cdn.jsdelivr.net; connect-src 'self' ws:"
};

// ========== Hash Function ==========

function projectHash(absPath) {
  return crypto.createHash('sha1').update(absPath).digest('hex').slice(0, 8);
}

// ========== Multi-Project Config ==========

// Mutable state — swapped atomically on dirs.json reload
let projects = new Map();   // hash → {path, name, added}
let nameIndex = new Map();  // name → hash[] (array for ambiguity detection)

function loadDirsConfig() {
  const dirsFile = path.join(CONFIG_DIR, 'dirs.json');
  if (!fs.existsSync(dirsFile)) {
    projects = new Map();
    nameIndex = new Map();
    return;
  }

  let raw;
  try {
    raw = fs.readFileSync(dirsFile, 'utf-8');
  } catch (e) {
    console.error(JSON.stringify({ type: 'dirs-read-error', message: e.message }));
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    // Partial read during atomic write — skip, next watch event will retry
    console.error(JSON.stringify({ type: 'dirs-parse-error', message: e.message }));
    return;
  }

  const newProjects = new Map();
  const newNameIndex = new Map();

  const entries = (data && data.projects) ? Object.entries(data.projects) : [];
  for (const [hash, entry] of entries) {
    if (!entry || typeof entry.path !== 'string' || typeof entry.name !== 'string') continue;
    const exists = fs.existsSync(entry.path);
    newProjects.set(hash, { path: entry.path, name: entry.name, added: entry.added || null, stale: !exists });
    const hashes = newNameIndex.get(entry.name) || [];
    hashes.push(hash);
    newNameIndex.set(entry.name, hashes);
  }

  // Atomic swap — no awaits between these two assignments
  projects = newProjects;
  nameIndex = newNameIndex;

  console.log(JSON.stringify({ type: 'dirs-loaded', count: newProjects.size }));
}

// ========== Path Traversal Guard ==========

function safePath(projectPath, relativePath) {
  const resolved = path.resolve(projectPath, relativePath);
  const root = path.resolve(projectPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null; // traversal attempt
  }
  return resolved;
}

// ========== Project File Listing ==========

function getProjectEntries(dirPath) {
  try {
    return fs.readdirSync(dirPath).map(name => {
      const fp = path.join(dirPath, name);
      try {
        const stat = fs.statSync(fp);
        return { name, path: fp, isDir: stat.isDirectory(), mtime: stat.mtime.getTime(), size: stat.size };
      } catch (e) {
        return null;
      }
    }).filter(Boolean).sort((a, b) => b.mtime - a.mtime);
  } catch (e) {
    return [];
  }
}

// ========== Page Generators ==========

// PAGE_STYLES: structural rules only — CSS variables come from frame-template.html
const PAGE_STYLES = `
  <style>
    .vc-index { padding: 0; max-width: 900px; }
    h2 { font-size: 1.4rem; font-weight: 600; margin-bottom: 0.35rem; }
    .subtitle { color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem; }
    .vc-empty { color: var(--text-secondary); text-align: center; padding: 3rem 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    td, th { padding: 0.4rem 0; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    tbody tr { border-bottom: 1px solid var(--border); }
    td:nth-child(2), td:nth-child(3) { color: var(--text-secondary); font-size: 0.8rem; }
    .vc-table-head th { padding: 0.5rem 0; border-bottom: 1px solid var(--border); text-align: left; }
    .vc-col-size { width: 80px; }
    .vc-col-mtime { width: 180px; }
    .vc-file-badge {
      display: inline-block; font-size: 0.65rem; padding: 0.1rem 0.35rem;
      border-radius: 4px; color: white; font-weight: 600;
      margin-right: 0.5rem; vertical-align: middle;
    }
    .vc-file-badge-md { background: var(--accent); }
    .vc-file-badge-other { background: var(--text-secondary); }
    .vc-disambig-list { margin-top: 1rem; line-height: 2; padding-left: 1.25rem; }
    .vc-disambig-back { margin-top: 1.5rem; }
  </style>`;

// Returns the first heading text from a markdown string, or null
function extractFirstHeading(mdText) {
  const match = mdText.match(/^#{1,3}\s+(.+)/m);
  return match ? match[1].trim() : null;
}

// Returns {mtime, heading} for the most recently modified .md file in a dir, or null
function getMostRecentMdInfo(dirPath) {
  let best = null;
  try {
    const entries = fs.readdirSync(dirPath);
    for (const name of entries) {
      if (!name.endsWith('.md')) continue;
      const fp = path.join(dirPath, name);
      try {
        const stat = fs.statSync(fp);
        if (!best || stat.mtime.getTime() > best.mtime) {
          best = { mtime: stat.mtime.getTime(), path: fp };
        }
      } catch (e) { /* skip */ }
    }
  } catch (e) { return null; }
  if (!best) return null;
  try {
    const text = fs.readFileSync(best.path, 'utf-8');
    return { mtime: best.mtime, heading: extractFirstHeading(text) };
  } catch (e) {
    return { mtime: best.mtime, heading: null };
  }
}

function generateDashboard() {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Build card data with mtime for sorting
  const cardData = Array.from(projects.entries()).map(([hash, proj]) => {
    if (proj.stale) {
      return { hash, proj, mtime: 0, fileCount: 0, mdInfo: null, stale: true };
    }
    let fileCount = 0;
    let dirMtime = 0;
    try {
      const stat = fs.statSync(proj.path);
      dirMtime = stat.mtime.getTime();
      const entries = fs.readdirSync(proj.path);
      fileCount = entries.filter(n => {
        try { return fs.statSync(path.join(proj.path, n)).isFile(); } catch (e) { return false; }
      }).length;
    } catch (e) { /* stale-ish */ }
    const mdInfo = getMostRecentMdInfo(proj.path);
    const mtime = mdInfo ? mdInfo.mtime : dirMtime;
    return { hash, proj, mtime, fileCount, mdInfo, stale: false };
  });

  // Sort by mtime descending (most recently active first)
  cardData.sort((a, b) => b.mtime - a.mtime);

  const DASHBOARD_STYLES = `<style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap');

    .vc-dash {
      font-family: 'Syne', system-ui, sans-serif;
      padding: 2.5rem 2rem 3rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .vc-dash-header {
      display: flex;
      align-items: baseline;
      gap: 1.25rem;
      margin-bottom: 2.25rem;
      border-bottom: 2px solid var(--text-primary);
      padding-bottom: 1rem;
    }
    .vc-dash-title {
      font-size: 1.65rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text-primary);
    }
    .vc-dash-count {
      font-family: 'DM Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--text-secondary);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .vc-empty {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.6;
    }
    .vc-empty p + p { margin-top: 0.75rem; }
    .vc-empty code {
      font-family: 'DM Mono', monospace;
      background: var(--bg-tertiary);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .vc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
    }
    .vc-card {
      background: var(--bg-secondary);
      border: 1.5px solid var(--border);
      border-radius: 10px;
      padding: 1.35rem 1.5rem 1.25rem;
      text-decoration: none;
      color: inherit;
      display: block;
      transition: border-color 0.13s, transform 0.13s, box-shadow 0.13s;
      position: relative;
      overflow: hidden;
    }
    .vc-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.09);
    }
    .vc-card:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .vc-card-stale {
      opacity: 0.5;
      cursor: default;
      pointer-events: none;
    }
    .vc-card-stale-badge {
      display: inline-block;
      font-family: 'DM Mono', monospace;
      font-size: 0.65rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border-radius: 4px;
      padding: 0.15rem 0.45rem;
      margin-bottom: 0.5rem;
    }
    .vc-card-name {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text-primary);
      margin-bottom: 0.3rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .vc-card-heading {
      font-family: system-ui, sans-serif;
      font-size: 0.82rem;
      color: var(--text-secondary);
      margin-bottom: 1rem;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .vc-card-meta {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      flex-wrap: wrap;
    }
    .vc-card-hash {
      font-family: 'DM Mono', monospace;
      font-size: 0.7rem;
      font-weight: 500;
      letter-spacing: 0.04em;
      color: var(--accent);
      background: var(--selected-bg);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }
    .vc-card-files {
      font-family: 'DM Mono', monospace;
      font-size: 0.7rem;
      color: var(--text-tertiary);
      letter-spacing: 0.02em;
    }
    .vc-card-mtime {
      font-family: 'DM Mono', monospace;
      font-size: 0.7rem;
      color: var(--text-tertiary);
      letter-spacing: 0.02em;
      margin-left: auto;
    }
    .vc-card-accent-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: var(--accent);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.18s ease;
    }
    .vc-card:hover .vc-card-accent-bar { transform: scaleX(1); }
  </style>`;

  let gridContent;
  if (cardData.length === 0) {
    gridContent = `<div class="vc-empty">
      <p>No projects registered.</p>
      <p>Run <code>visual-companion add &lt;dir&gt;</code> to add one.</p>
    </div>`;
  } else {
    const cards = cardData.map(({ hash, proj, mtime, fileCount, mdInfo, stale }) => {
      const safeName = esc(proj.name);
      if (stale) {
        return `<div class="vc-card vc-card-stale">
          <div class="vc-card-stale-badge">directory not found</div>
          <div class="vc-card-name">${safeName}</div>
          <div class="vc-card-meta">
            <span class="vc-card-hash">${hash}</span>
          </div>
        </div>`;
      }

      const headingLine = (mdInfo && mdInfo.heading)
        ? `<div class="vc-card-heading">${esc(mdInfo.heading)}</div>`
        : '';
      const mtimeStr = mtime ? formatTime(mtime) : '—';
      const filesLabel = fileCount === 1 ? '1 file' : fileCount + ' files';

      return `<a href="/${encodeURIComponent(hash)}/" class="vc-card">
        <div class="vc-card-accent-bar"></div>
        <div class="vc-card-name">${safeName}</div>
        ${headingLine}
        <div class="vc-card-meta">
          <span class="vc-card-hash">${hash}</span>
          <span class="vc-card-files">${filesLabel}</span>
          <span class="vc-card-mtime">${mtimeStr}</span>
        </div>
      </a>`;
    }).join('\n');
    gridContent = `<div class="vc-grid">${cards}</div>`;
  }

  const count = cardData.length;
  const countLabel = count + ' project' + (count !== 1 ? 's' : '');

  const dashContent = `
<meta name="vc-project-hash" content="">
${DASHBOARD_STYLES}
<div class="vc-dash">
  <div class="vc-dash-header">
    <span class="vc-dash-title">Visual Companion</span>
    <span class="vc-dash-count">${esc(countLabel)}</span>
  </div>
  ${gridContent}
</div>`;

  const breadcrumbs = buildBreadcrumbs(null, null, null);
  return wrapInFrame(dashContent, breadcrumbs);
}

function generateProjectIndexPage(hash, proj, dirPath, relativePath) {
  const entries = getProjectEntries(dirPath);
  const safeProjName = proj.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const displayPath = relativePath ? proj.name + '/' + relativePath : proj.name;
  const safeDisplayPath = displayPath.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const urlBase = '/' + encodeURIComponent(hash) + (relativePath ? '/' + relativePath.split('/').map(encodeURIComponent).join('/') : '');

  let body;
  if (entries.length === 0) {
    body = '<p class="vc-empty">No files found in this directory.</p>';
  } else {
    const rows = entries.map(entry => {
      const safeEntryName = entry.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (entry.isDir) {
        const dirUrl = urlBase.replace(/\/$/, '') + '/' + encodeURIComponent(entry.name) + '/';
        return `<tr>
          <td><a href="${dirUrl}">&#x1F4C1; ${safeEntryName}/</a></td>
          <td>—</td>
          <td>${formatTime(entry.mtime)}</td>
        </tr>`;
      }
      const ext = path.extname(entry.name).toLowerCase();
      const badgeClass = ext === '.md' ? 'vc-file-badge vc-file-badge-md' : 'vc-file-badge vc-file-badge-other';
      const badgeText = ext === '.md' ? 'MD' : (ext.slice(1).toUpperCase() || 'FILE');
      const badge = `<span class="${badgeClass}">${badgeText}</span>`;
      const fileUrl = urlBase.replace(/\/$/, '') + '/' + encodeURIComponent(entry.name);
      return `<tr>
        <td>${badge}<a href="${fileUrl}">${safeEntryName}</a></td>
        <td>${formatBytes(entry.size)}</td>
        <td>${formatTime(entry.mtime)}</td>
      </tr>`;
    }).join('\n');

    body = `<table>
      <thead>
        <tr class="vc-table-head">
          <th>Name</th>
          <th class="vc-col-size">Size</th>
          <th class="vc-col-mtime">Modified</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  const breadcrumbs = buildBreadcrumbs(hash, proj.name, relativePath || null);
  const content = `
<meta name="vc-project-hash" content="${hash}">
${PAGE_STYLES}
<h2>${safeProjName}</h2>
<p class="subtitle">${entries.length} item${entries.length !== 1 ? 's' : ''}</p>
${body}`;
  return wrapInFrame(content, breadcrumbs);
}

function generateDisambiguationPage(name, hashes) {
  const safeNameDisplay = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = hashes.map(hash => {
    const proj = projects.get(hash);
    if (!proj) return '';
    const safeProjPath = proj.path.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<li><a href="/${encodeURIComponent(hash)}/">${hash}</a> — ${safeProjPath}${proj.stale ? ' <em>(directory not found)</em>' : ''}</li>`;
  }).join('\n');

  const content = `
<meta name="vc-project-hash" content="">
${PAGE_STYLES}
<h2>Ambiguous project name: &ldquo;${safeNameDisplay}&rdquo;</h2>
<p class="subtitle">Multiple projects share this name. Use the hash URL to access a specific project:</p>
<ul class="vc-disambig-list">${rows}</ul>
<p class="vc-disambig-back"><a href="/">Back to dashboard</a></p>`;

  return wrapInFrame(content, buildBreadcrumbs(null, null, null));
}

// ========== Project Resolution ==========

// Returns {hash, proj} or {error: 'not_found'|'ambiguous', hashes}
function resolveIdentifier(identifier) {
  // Try as hash first
  if (projects.has(identifier)) {
    return { hash: identifier, proj: projects.get(identifier) };
  }
  // Try as name
  const hashes = nameIndex.get(identifier);
  if (!hashes || hashes.length === 0) {
    return { error: 'not_found' };
  }
  if (hashes.length > 1) {
    return { error: 'ambiguous', hashes };
  }
  const hash = hashes[0];
  return { hash, proj: projects.get(hash) };
}

// ========== HTTP Request Handler ==========

function handleRequest(req, res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(k, v);
  }

  if (req.method === 'POST') {
    if (req.url === '/toggle') { handleToggle(req, res); return; }
    res.writeHead(404); res.end('Not found'); return;
  }
  if (req.method !== 'GET') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const rawUrl = req.url.split('?')[0];

  // Health endpoint
  if (rawUrl === '/_ready') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }

  // Root — project dashboard
  if (rawUrl === '/') {
    let html = generateDashboard();
    html = injectHelper(html);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Project routes: /{identifier}[/{relative-path}]
  // Strip leading slash, decode first segment
  const withoutLeadingSlash = rawUrl.slice(1);
  const slashIdx = withoutLeadingSlash.indexOf('/');
  const identifierEncoded = slashIdx === -1 ? withoutLeadingSlash : withoutLeadingSlash.slice(0, slashIdx);
  const restEncoded = slashIdx === -1 ? '' : withoutLeadingSlash.slice(slashIdx + 1);

  let identifier;
  try {
    identifier = decodeURIComponent(identifierEncoded);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad request: invalid URL encoding');
    return;
  }

  if (!identifier) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const resolved = resolveIdentifier(identifier);

  if (resolved.error === 'ambiguous') {
    let html = generateDisambiguationPage(identifier, resolved.hashes);
    html = injectHelper(html);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (resolved.error === 'not_found') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const { hash, proj } = resolved;

  if (proj.stale) {
    res.writeHead(404);
    res.end('Project directory not found on disk');
    return;
  }

  // Decode relative path segments
  let relativePath;
  try {
    relativePath = restEncoded
      ? restEncoded.split('/').map(seg => decodeURIComponent(seg)).join('/')
      : '';
  } catch (e) {
    res.writeHead(400);
    res.end('Bad request: invalid URL encoding');
    return;
  }

  // Trailing slash means directory index (restEncoded is always '' or ends '/' when rawUrl ends '/')
  const isIndex = rawUrl.endsWith('/');

  // Guard against path traversal
  const targetPath = relativePath
    ? safePath(proj.path, relativePath)
    : path.resolve(proj.path);

  if (!targetPath) {
    res.writeHead(403);
    res.end('Forbidden: path traversal detected');
    return;
  }

  if (!fs.existsSync(targetPath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const stat = fs.statSync(targetPath);

  if (stat.isDirectory()) {
    // Redirect to ensure trailing slash for correct relative link resolution
    if (!rawUrl.endsWith('/')) {
      res.writeHead(301, { 'Location': rawUrl + '/' });
      res.end();
      return;
    }
    let html = generateProjectIndexPage(hash, proj, targetPath, relativePath.replace(/\/$/, ''));
    html = injectHelper(html);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Serve file
  const ext = path.extname(targetPath).toLowerCase();
  if (ext === '.md') {
    const raw = fs.readFileSync(targetPath, 'utf-8');
    const mtime = stat.mtime.getTime();
    let html = buildMdShell(raw, path.basename(targetPath), mtime, hash, proj.name, relativePath || null);
    html = injectHelper(html);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else if (ext === '.html') {
    const raw = fs.readFileSync(targetPath, 'utf-8');
    const safeHashAttr = hash.replace(/"/g, '&quot;');
    const metaTag = `<meta name="vc-project-hash" content="${safeHashAttr}">`;
    const breadcrumbs = buildBreadcrumbs(hash, proj.name, relativePath || null);
    let html;
    if (isFullDocument(raw)) {
      // Inject meta tag into existing <head> if not already present
      if (!raw.includes('vc-project-hash')) {
        html = raw.replace(/<head([^>]*)>/i, `<head$1>\n${metaTag}`);
      } else {
        html = raw;
      }
    } else {
      html = wrapInFrame(metaTag + '\n' + raw, breadcrumbs);
    }
    html = injectHelper(html);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(targetPath));
  }
}

// ========== Checkbox Write-Back ==========

// Per-project toggle tracking so watcher can distinguish toggle vs external edit
const lastToggleWrite = new Map(); // projectHash → {file, mtime}

const MAX_TOGGLE_BODY = 4096;

function handleToggle(req, res) {
  let body = '';
  let size = 0;

  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_TOGGLE_BODY) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large' }));
      req.destroy();
      return;
    }
    body += chunk;
  });

  req.on('end', () => {
    if (size > MAX_TOGGLE_BODY) return;

    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const { file, line, checked, mtime: clientMtime, projectHash: reqHash } = data;

    if (typeof reqHash !== 'string' || !reqHash) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing projectHash' }));
      return;
    }
    if (typeof file !== 'string' || path.basename(file) !== file || path.extname(file) !== '.md') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid file: must be a .md filename with no path separators' }));
      return;
    }
    if (typeof line !== 'number' || !Number.isInteger(line) || line < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid line: must be a non-negative integer' }));
      return;
    }
    if (typeof checked !== 'boolean') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid checked: must be a boolean' }));
      return;
    }

    const proj = projects.get(reqHash);
    if (!proj) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Project not found' }));
      return;
    }
    if (proj.stale) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Project directory not found on disk' }));
      return;
    }

    const filePath = path.join(proj.path, file);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }

    // Optimistic concurrency
    const currentMtime = fs.statSync(filePath).mtime.getTime();
    if (typeof clientMtime === 'number' && clientMtime !== currentMtime) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'conflict', message: 'File was modified externally. Reload to see changes.' }));
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (line >= lines.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Line index out of bounds' }));
      return;
    }

    const targetLine = lines[line];
    let newLine;
    if (checked) {
      if (!targetLine.includes('- [ ]')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Line does not contain an unchecked checkbox' }));
        return;
      }
      newLine = targetLine.replace('- [ ]', '- [x]');
    } else {
      if (!targetLine.includes('- [x]')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Line does not contain a checked checkbox' }));
        return;
      }
      newLine = targetLine.replace('- [x]', '- [ ]');
    }
    lines[line] = newLine;

    const tmpPath = path.join(proj.path, '.tmp-' + file);
    fs.writeFileSync(tmpPath, lines.join('\n'));
    fs.renameSync(tmpPath, filePath);

    const newMtime = fs.statSync(filePath).mtime.getTime();
    lastToggleWrite.set(reqHash, { file, mtime: newMtime });

    const eventsFile = path.join(proj.path, file + '.events');
    fs.appendFileSync(eventsFile, JSON.stringify({
      type: 'checkbox', file, line, checked, timestamp: Date.now()
    }) + '\n');

    broadcastToProject(reqHash, { type: 'reload', source: 'toggle' });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mtime: newMtime }));
  });
}

// ========== WebSocket Connection Handling ==========

// Scoped subscription state
const subscribers = new Map();   // projectHash → Set<socket>
const socketProject = new Map(); // socket → projectHash
const watchers = new Map();      // projectHash → FSWatcher

function removeSocketFromProject(socket, hash) {
  const set = subscribers.get(hash);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) {
    subscribers.delete(hash);
    const watcher = watchers.get(hash);
    if (watcher) {
      watcher.close();
      watchers.delete(hash);
      console.log(JSON.stringify({ type: 'watcher-closed', hash, reason: 'no-subscribers' }));
    }
  }
}

function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }

  const accept = computeAcceptKey(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );

  let buffer = Buffer.alloc(0);

  function cleanupSocket() {
    const oldHash = socketProject.get(socket);
    if (oldHash !== undefined) {
      removeSocketFromProject(socket, oldHash);
      socketProject.delete(socket);
    }
  }

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      let result;
      try {
        result = decodeFrame(buffer);
      } catch (e) {
        socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
        cleanupSocket();
        return;
      }
      if (!result) break;
      buffer = buffer.slice(result.bytesConsumed);

      switch (result.opcode) {
        case OPCODES.TEXT:
          handleMessage(socket, result.payload.toString());
          break;
        case OPCODES.CLOSE:
          socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
          cleanupSocket();
          return;
        case OPCODES.PING:
          socket.write(encodeFrame(OPCODES.PONG, result.payload));
          break;
        case OPCODES.PONG:
          break;
        default: {
          const closeBuf = Buffer.alloc(2);
          closeBuf.writeUInt16BE(1003);
          socket.end(encodeFrame(OPCODES.CLOSE, closeBuf));
          cleanupSocket();
          return;
        }
      }
    }
  });

  socket.on('close', cleanupSocket);
  socket.on('error', cleanupSocket);
}

function handleMessage(socket, text) {
  let event;
  try {
    event = JSON.parse(text);
  } catch (e) {
    console.error(JSON.stringify({ type: 'ws-parse-error', message: e.message }));
    return;
  }

  if (event.type === 'subscribe') {
    const newHash = event.projectHash;
    if (typeof newHash !== 'string' || !newHash) {
      console.error(JSON.stringify({ type: 'ws-subscribe-warning', message: 'missing projectHash field' }));
      return;
    }
    if (!projects.has(newHash)) {
      console.error(JSON.stringify({ type: 'ws-subscribe-warning', message: 'unknown projectHash', hash: newHash }));
      return;
    }

    const oldHash = socketProject.get(socket);
    if (oldHash !== undefined && oldHash !== newHash) {
      removeSocketFromProject(socket, oldHash);
    }

    if (!subscribers.has(newHash)) {
      subscribers.set(newHash, new Set());
    }
    subscribers.get(newHash).add(socket);
    socketProject.set(socket, newHash);

    // Create watcher lazily on first subscriber
    if (!watchers.has(newHash)) {
      const proj = projects.get(newHash);
      try {
        const watcher = watchProject(newHash, proj);
        watchers.set(newHash, watcher);
        console.log(JSON.stringify({ type: 'watcher-created', hash: newHash, reason: 'first-subscriber' }));
      } catch (e) {
        console.error(JSON.stringify({ type: 'project-watch-start-error', hash: newHash, message: e.message }));
      }
    }
    return;
  }

  // Log other events (click events, etc.) — scoped to socket's current project
  console.log(JSON.stringify({ source: 'user-event', ...event }));
  if (event.choice) {
    console.log(JSON.stringify({ type: 'choice-event', ...event }));
    const socketHash = socketProject.get(socket);
    if (socketHash) {
      const socketProj = projects.get(socketHash);
      if (socketProj && !socketProj.stale) {
        const eventsFile = path.join(socketProj.path, '.events');
        fs.appendFileSync(eventsFile, JSON.stringify({ ...event, timestamp: Date.now() }) + '\n');
      }
    }
  }
}

function broadcastToProject(hash, msg) {
  const set = subscribers.get(hash);
  if (!set || set.size === 0) return;
  const frame = encodeFrame(OPCODES.TEXT, Buffer.from(JSON.stringify(msg)));
  for (const socket of set) {
    try { socket.write(frame); } catch (e) {
      removeSocketFromProject(socket, hash);
      socketProject.delete(socket);
    }
  }
}

// ========== File Watching (per project) ==========

const debounceTimers = new Map();
const knownFiles = new Map(); // projectHash → Set<filename>

function watchProject(hash, proj) {
  const watcher = fs.watch(proj.path, (eventType, filename) => {
    if (!filename) return;
    const isScreen = filename.endsWith('.html') || filename.endsWith('.md');
    if (!isScreen) return;

    const key = hash + ':' + filename;
    if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key));
    debounceTimers.set(key, setTimeout(() => {
      debounceTimers.delete(key);
      const filePath = path.join(proj.path, filename);
      if (!fs.existsSync(filePath)) return;

      const known = knownFiles.get(hash) || new Set();
      if (!known.has(filename)) {
        known.add(filename);
        knownFiles.set(hash, known);
        // Clear .events when a new screen file is added to this project
        const eventsFile = path.join(proj.path, '.events');
        if (fs.existsSync(eventsFile)) fs.unlinkSync(eventsFile);
        console.log(JSON.stringify({ type: 'screen-added', hash, file: filePath }));
      } else {
        console.log(JSON.stringify({ type: 'screen-updated', hash, file: filePath }));
      }

      const lastWrite = lastToggleWrite.get(hash);
      if (lastWrite && lastWrite.file === filename) {
        const fileMtime = fs.statSync(filePath).mtime.getTime();
        if (fileMtime === lastWrite.mtime) {
          // Toggle handler already broadcast with source:'toggle' — skip watcher broadcast
          lastToggleWrite.delete(hash);
          return;
        }
        lastToggleWrite.delete(hash);
      }
      broadcastToProject(hash, { type: 'reload', source: 'external' });
    }, 100));
  });
  watcher.on('error', (err) =>
    console.error(JSON.stringify({ type: 'project-watch-error', hash, message: err.message }))
  );
  return watcher;
}

// ========== Server Startup ==========

function startServer() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

  // Initial config load
  loadDirsConfig();

  // Initialize knownFiles for all loaded projects
  for (const [hash, proj] of projects) {
    if (proj.stale) continue;
    try {
      const files = fs.readdirSync(proj.path).filter(f => f.endsWith('.html') || f.endsWith('.md'));
      knownFiles.set(hash, new Set(files));
    } catch (e) {
      knownFiles.set(hash, new Set());
    }
  }

  const server = http.createServer(handleRequest);
  server.on('upgrade', handleUpgrade);

  // Watch config dir for dirs.json changes
  const configDebounce = new Map();
  const configWatcher = fs.watch(CONFIG_DIR, (eventType, filename) => {
    if (!filename || filename !== 'dirs.json') return;

    if (configDebounce.has('dirs')) clearTimeout(configDebounce.get('dirs'));
    configDebounce.set('dirs', setTimeout(() => {
      configDebounce.delete('dirs');
      loadDirsConfig();
      // Refresh knownFiles for newly added projects
      for (const [hash, proj] of projects) {
        if (!knownFiles.has(hash) && !proj.stale) {
          try {
            const files = fs.readdirSync(proj.path).filter(f => f.endsWith('.html') || f.endsWith('.md'));
            knownFiles.set(hash, new Set(files));
          } catch (e) {
            knownFiles.set(hash, new Set());
          }
        }
      }
      // Close lazy watchers for projects that were removed
      for (const [hash, watcher] of watchers) {
        if (!projects.has(hash)) {
          watcher.close();
          watchers.delete(hash);
          console.log(JSON.stringify({ type: 'watcher-closed', hash, reason: 'project-removed' }));
        }
      }
    }, 100));
  });
  configWatcher.on('error', (err) =>
    console.error(JSON.stringify({ type: 'config-watch-error', message: err.message }))
  );

  function shutdown(reason) {
    console.log(JSON.stringify({ type: 'server-stopped', reason }));
    const infoFile = path.join(CONFIG_DIR, '.server-info');
    if (fs.existsSync(infoFile)) fs.unlinkSync(infoFile);
    configWatcher.close();
    for (const watcher of watchers.values()) watcher.close();
    server.close(() => process.exit(0));
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  function onListening() {
    const actualPort = server.address().port;
    const info = JSON.stringify({
      type: 'server-started', port: actualPort, pid: process.pid, host: HOST,
      url_host: URL_HOST, url: 'http://' + URL_HOST + ':' + actualPort,
      config_dir: CONFIG_DIR
    });
    console.log(info);
    fs.writeFileSync(path.join(CONFIG_DIR, '.server-info'), info + '\n');
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // PORT 0 can't get EADDRINUSE, so this only fires for an explicit preferred port
      console.log(JSON.stringify({ type: 'port-retry', preferred: PORT, reason: 'EADDRINUSE' }));
      server.listen(0, HOST, onListening);
    } else {
      throw err;
    }
  });

  server.listen(PORT, HOST, onListening);
}

if (require.main === module) {
  startServer();
}

module.exports = { computeAcceptKey, encodeFrame, decodeFrame, OPCODES, projectHash };
