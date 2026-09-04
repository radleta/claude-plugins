# Browser → Local Relay Server Pattern

Use when extracting **binary data** (images, files, PDFs) from sites behind Cloudflare or bot protection where the data is too large for `console.log`.

## When to Use

| Condition | Use Relay? |
|-----------|-----------|
| Data is text/JSON < 1MB | No — use direct JS injection + console.log |
| Data is binary (images, files) | **Yes** — browser can't write to disk |
| Site has Cloudflare/bot protection | **Yes** — browser bypasses it, curl doesn't |
| Data fits in console as base64 | Maybe — relay is cleaner but console works for small files |
| Need resumability (100+ items) | **Yes** — relay tracks completed items |

## Architecture

```
Browser (on target-site.com)              localhost:3456 (relay-server)
┌─────────────────────────────┐           ┌──────────────────────────┐
│ 1. fetch() target page HTML │           │                          │
│ 2. extract data/file URLs   │           │                          │
│ 3. fetch() files as blobs   │──POST───→ │ 4. write to disk         │
│    (parallel, 4-6 at once)  │  /save    │ 5. update manifest       │
│                             │←─200 OK── │                          │
│ 6. random delay 3-8s        │           │                          │
│ 7. next item...             │           │ Output directory:        │
└─────────────────────────────┘           │   item-1/file.jpg        │
                                          │   manifest.json          │
                                          └──────────────────────────┘
```

## Relay Server API

```
POST /save/:key/:filename     Write binary body to {outputDir}/{key}/{filename}
POST /complete/:key            Mark item complete, flush manifest to disk
GET  /status                   { completed: [...keys], total: N }
GET  /manifest                 Current manifest.json content
GET  /script                   Serve browser script with config baked in
OPTIONS *                      CORS preflight
```

## Generic Relay Server Example

Node.js, built-in modules only (~60 lines core logic):

```javascript
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const outputDir = process.argv[2] || './output';
const port = parseInt(process.argv[3] || '3456');
const allowOrigin = process.argv[4] || '*';

fs.mkdirSync(outputDir, { recursive: true });
let manifest = { items: {} };
const manifestPath = path.join(outputDir, 'manifest.json');
if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function isPathSafe(s) {
  var d = decodeURIComponent(s);
  return !d.includes('..') && !d.includes('/') && !d.includes('\\') && s.length > 0 && s.length < 256;
}

const server = http.createServer(async (req, res) => {
  var segs = new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean);
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && segs[0] === 'save' && segs.length === 3) {
    if (!isPathSafe(segs[1]) || !isPathSafe(segs[2])) {
      res.writeHead(400); res.end('path traversal'); return;
    }
    var dir = path.join(outputDir, segs[1]);
    fs.mkdirSync(dir, { recursive: true });
    var chunks = []; req.on('data', c => chunks.push(c));
    req.on('end', () => {
      var buf = Buffer.concat(chunks);
      fs.writeFileSync(path.join(dir, segs[2]), buf);
      if (!manifest.items[segs[1]]) manifest.items[segs[1]] = { files: [] };
      manifest.items[segs[1]].files.push(segs[2]);
      res.writeHead(200); res.end(JSON.stringify({ ok: true, size: buf.length }));
    });
    return;
  }

  if (req.method === 'POST' && segs[0] === 'complete' && segs.length === 2) {
    if (manifest.items[segs[1]]) manifest.items[segs[1]].completed = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'GET' && segs[0] === 'status') {
    var completed = Object.keys(manifest.items).filter(k => manifest.items[k].completed);
    res.writeHead(200); res.end(JSON.stringify({ completed, total: completed.length }));
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(port, '127.0.0.1', () => console.error(`Relay on http://localhost:${port}`));
process.on('SIGINT', () => { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); process.exit(0); });
```

## Generic Browser Script Example

Inject via Chrome DevTools MCP — fetches pages, extracts file URLs, POSTs to relay:

```javascript
(async function() {
  var RELAY = 'http://localhost:3456';
  var ITEMS = ['item-1', 'item-2'];  // Replace with your item IDs
  var MIN_DELAY = 3000, MAX_DELAY = 8000;

  // Check what's already done
  var status = await (await fetch(RELAY + '/status')).json();
  var done = new Set(status.completed);
  var todo = ITEMS.filter(function(id) { return !done.has(id); });

  for (var i = 0; i < todo.length; i++) {
    var id = todo[i];
    try {
      // 1. Fetch page and extract file URLs (customize per site)
      var html = await (await fetch('/item/' + id)).text();
      var urls = extractFileUrls(html, id);  // Your regex here

      // 2. Download files and POST to relay (parallel)
      await Promise.all(urls.map(function(url, j) {
        return fetch(url).then(function(r) { return r.blob(); }).then(function(blob) {
          return fetch(RELAY + '/save/' + id + '/' + (j+1) + '.jpg', { method: 'POST', body: blob });
        });
      }));

      // 3. Mark complete
      await fetch(RELAY + '/complete/' + id, { method: 'POST' });
    } catch (e) { console.log('ERROR: ' + id + ' — ' + e.message); }

    // 4. Random delay
    if (i < todo.length - 1) await new Promise(function(r) { setTimeout(r, MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)); });
  }
  return JSON.stringify({ done: todo.length - 0 });
})();
```

## Loading the Script via Relay

Instead of pasting large scripts into Chrome DevTools, have the relay serve the script:

1. Add `GET /script` to the relay — reads the browser script file, injects config (IDs, port)
2. Browser injection becomes one line:
   ```javascript
   fetch('http://localhost:3456/script').then(r=>r.text()).then(eval)
   ```
3. Wrapped for error handling:
   ```javascript
   (async function(){ var r=await fetch('http://localhost:3456/script'); var c=await r.text(); return await eval(c); })()
   ```

## Security Checklist

- [ ] Server binds to `127.0.0.1` only (not `0.0.0.0`)
- [ ] Path traversal validation on all key/filename inputs (`..`, `/`, `\` rejected)
- [ ] `decodeURIComponent` checked (catches `%2F` encoded traversal)
- [ ] CORS origin set to specific target domain (not `*` in production)
- [ ] Upload size limit enforced (prevent memory exhaustion)
- [ ] Graceful shutdown flushes manifest to disk

## Chrome Permission Note

On first cross-origin POST from a site to `localhost`, Chrome will prompt: "Allow [site] to access local network resources?" The user must click "Allow" once. This permission persists for the browser session.

## Real-World Implementation

See the `ff-scraper` skill `IMAGES.md` for a complete implementation that downloads FurnishedFinder property photos using this pattern.
