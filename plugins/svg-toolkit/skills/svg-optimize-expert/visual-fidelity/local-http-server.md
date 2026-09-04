---
tags: [svg-optimize-expert/visual-fidelity]
summary: Simple Node.js HTTP server for CORS-safe canvas pixel access when comparing original and optimized SVGs.
---

# Setup: Local HTTP Server

SVGs must be served from the same origin for canvas pixel access:

```javascript
// Simple server (save as server.mjs, run with: node server.mjs)
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';

const MIME = { '.html': 'text/html', '.svg': 'image/svg+xml', '.js': 'text/javascript' };

createServer((req, res) => {
  const file = '.' + (req.url === '/' ? '/index.html' : req.url);
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(3456, () => console.log('http://localhost:3456'));
```
