---
name: web-scraper
description: "Systematic web scraping methodology with escalating techniques: API discovery, direct fetch, browser automation, DOM extraction, and browser-to-local-relay for binary data. Use when scraping websites, extracting structured data from web pages, downloading images or files from Cloudflare-protected sites, building data collection pipelines, reverse-engineering site APIs, or automating data gathering from any website — even for simple single-page extractions."
---

<role>
  <identity>Web scraping strategist and data extraction specialist</identity>
  <purpose>Guide systematic discovery of the most efficient scraping approach for any website, escalating from lightweight API calls to heavy browser automation only when necessary</purpose>
  <scope>
    <in-scope>
      <item>Discovering site APIs (GraphQL, REST, internal endpoints)</item>
      <item>Direct HTTP fetching (fetch, curl, requests)</item>
      <item>Browser automation (Chrome DevTools MCP, Playwright)</item>
      <item>DOM extraction and text parsing</item>
      <item>Anti-bot detection avoidance strategies</item>
      <item>Rate limiting and ethical scraping practices</item>
      <item>Data transformation and schema mapping</item>
    </in-scope>
    <out-of-scope>
      <item>Bypassing authentication without authorization</item>
      <item>DDoS or abusive request patterns</item>
      <item>Scraping content behind paywalls</item>
    </out-of-scope>
  </scope>
</role>

## The Scraping Ladder: Always Start at the Top

Try each method in order. Move down only when the current method fails. Lower methods are slower, more expensive, and more fragile.

| Rung | Method | Speed | Reliability | Fragility | Try First? |
|------|--------|-------|-------------|-----------|------------|
| 1 | **API Discovery** | Fastest | Highest | Lowest | Always |
| 2 | **Direct Fetch** (server-rendered HTML) | Fast | High | Low | If no API |
| 3 | **Headless Browser** (Playwright) | Medium | Medium | Medium | If SPA |
| 4 | **Real Browser** (Chrome DevTools MCP) | Slow | High | Low | If Cloudflare/bot detection |
| 4b | **Browser → Local Relay** | Medium | High | Low | If Rung 4 + binary data (images, files) |
| 5 | **Manual + JS Injection** | Slowest | Highest | Lowest | Last resort |

## Rung 1: API Discovery (Always Try First)

Most modern websites fetch data from APIs. Finding and using them directly is 10-100x faster than scraping the DOM.

### Discovery Protocol

1. **Open browser DevTools Network tab** (filter: XHR/Fetch)
2. **Navigate to the target page** and watch for API calls
3. **Look for:**
   - GraphQL endpoints (`/graphql`, `/api/graphql`)
   - REST endpoints (`/api/v1/`, `/api/resource/`)
   - Internal data endpoints (`/_next/data/`, `/__data`)
   - JSON responses in XHR requests
4. **Examine each promising request:**
   - URL pattern
   - Request method (GET/POST)
   - Headers (auth tokens, API keys, cookies)
   - Request body (for POST — especially GraphQL queries)
   - Response structure (is all the data you need here?)

### Auth Classification

| Auth Type | Scraping Viability | Example |
|-----------|-------------------|---------|
| **None** | Use directly — best case | Public GraphQL, open REST APIs |
| **API Key in URL** | Usually public, embed in requests | `?api_key=abc123` in client-side code |
| **Bearer Token** | May expire, needs refresh logic | OAuth tokens |
| **Session Cookie** | Run from browser context (fetch from same origin) | Authenticated endpoints |
| **Server-only** | Cannot use from client — try Rung 2 or 3 | Server-side API keys |

### GraphQL Tips

- Look for the query in the client-side JS bundle or Network tab
- Variables are usually JSON — copy them exactly
- `introspection` query (`__schema`) may be disabled in production — copy queries from Network tab instead
- Monetary amounts often come as formatted strings (`"$1,450"`) — strip before parsing
- Enum/lookup values may differ from display text (camelCase vs human-readable)

### Quick Test

```javascript
// Test from browser console (same-origin) or any HTTP client
fetch('https://api.example.com/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '...', variables: {} })
}).then(r => r.json()).then(console.log);
```

If this returns data with no auth errors — you're done. Build a bulk fetcher and skip everything below.

## Rung 2: Direct Fetch (Server-Rendered HTML)

For server-rendered sites (not SPAs), fetch the HTML directly and parse it.

### When This Works

- Static HTML sites
- Server-side rendered pages (PHP, Rails, Django, traditional SSR)
- Pages where `curl URL` returns the full content

### When This Fails

- SPAs (React, Vue, Angular) — HTML contains only a shell, content loads via JS
- Cloudflare/bot protection — returns 403 or CAPTCHA challenge
- Sites requiring JavaScript execution for content

### Tools

| Tool | Context | Notes |
|------|---------|-------|
| `fetch()` / `curl` | Any | Fastest, no browser needed |
| Python `requests` | Scripts | Good for batch processing |
| `WebFetch` tool | Claude Code | Built-in, no dependencies |

### Parsing

- Use CSS selectors or regex on the returned HTML
- Libraries: cheerio (Node), BeautifulSoup (Python), jsdom (Node for DOM-like API)
- Always validate that the HTML contains the data — SPAs return empty shells

## Rung 3: Headless Browser (Playwright/Puppeteer)

For SPAs where content is rendered by JavaScript.

### When This Works

- React, Vue, Angular apps without bot protection
- Sites that need JS execution to render content
- Pages with client-side routing

### When This Fails

- **Cloudflare Bot Management** — detects headless browsers and returns 403
- **Advanced bot detection** (DataDome, PerimeterX, Akamai Bot Manager)
- Sites checking for headless browser fingerprints

### Cloudflare Detection Signals

Cloudflare identifies headless browsers via:
- Missing or anomalous `navigator` properties
- WebGL/Canvas fingerprint differences
- Missing Chrome DevTools protocol markers
- Unusual TLS fingerprint (JA3/JA4)
- Request patterns (too fast, no referer, no cookies)

### Mitigation Attempts (Often Insufficient)

```python
# These help but don't guarantee bypassing Cloudflare
browser = playwright.chromium.launch(headless=True)
context = browser.new_context(
    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    viewport={"width": 1920, "height": 1080},
    locale="en-US",
)
```

**If you get 403s after 1-2 requests despite mitigations, move to Rung 4.** Don't waste time tuning headless settings — Cloudflare's detection is sophisticated.

## Rung 4: Real Browser (Chrome DevTools MCP)

Uses the user's actual Chrome browser via the Claude in Chrome extension. This is the nuclear option for bot detection.

### Why It Works

- Real browser fingerprint (WebGL, Canvas, fonts, plugins)
- Real TLS fingerprint (Chrome's actual TLS stack)
- Valid Cloudflare challenge tokens from the user's session
- Real cookies and session state

### Two Approaches

**A. Agent-Navigated (LLM drives the browser)**
- Chrome-browser subagent navigates, clicks, reads
- Most flexible but slowest (LLM processes each page)
- Use for interactive pages, login flows, complex navigation

**B. JS Injection (Script drives, agent launches)**
- Agent injects a self-contained JavaScript script
- Script loops through pages/items autonomously
- Agent only launches and collects results
- 10x faster than agent-navigated for bulk work

**Always prefer B for bulk scraping.** Reserve A for initial discovery and script development.

### Rung 4b: Browser → Local Relay Server (Binary Data)

When Rung 4 data is **binary** (images, PDFs, files) and too large for `console.log`, use the relay pattern: a tiny Node.js server on localhost receives binary POSTs from the browser script and writes files to disk.

Use the Read tool on `BROWSER-RELAY.md` in this skill directory for the complete pattern with generic server/script examples, security checklist, and Chrome permission notes.

### JS Injection Pattern for Bulk Scraping

```javascript
(async function() {
  const results = [];
  const IDS = ["id1", "id2", "id3"];

  for (const id of IDS) {
    console.log('PROGRESS: ' + results.length + '/' + IDS.length);
    try {
      // Fetch data (API call, or navigate iframe, or parse current page)
      const data = await fetchItem(id);
      results.push(data);
    } catch (e) {
      results.push({ id: id, error: e.message });
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('RESULTS:' + JSON.stringify(results));
  return JSON.stringify(results);
})();
```

## Rung 5: Manual Browsing + Extraction

When all automated approaches fail (CAPTCHA, complex multi-step auth, anti-automation).

- User browses manually
- Claude extracts data from the current page via JS injection
- Slowest but always works

## DOM Extraction Patterns

When you must parse rendered page content (Rungs 3-5):

### SPA Content Access

| Approach | Works? | Notes |
|----------|--------|-------|
| `document.body.innerText` | Sometimes | May return only header/footer in some SPAs |
| `document.querySelector('main').innerText` | Usually | Gets the main content area |
| `element.textContent` (recursive) | Always | Most thorough but verbose |

### Text Boundary Management

When pages have multiple sections (similar items, ads, related content), cut the text to avoid contamination:

```javascript
var text = mainEl.innerText;
// Cut before known boundary markers
var cutIdx = text.indexOf('Related Items');
if (cutIdx > -1) text = text.substring(0, cutIdx);
```

### Scoped Extraction

Extract specific sections before applying regex:

```javascript
// Scope to a specific section
var feesMatch = text.match(/Fees Section([\s\S]*?)End of Fees/);
var feesText = feesMatch ? feesMatch[1] : '';
// Now apply field-specific regex only within feesText
```

### Common Regex Patterns

| Data Type | Pattern | Notes |
|-----------|---------|-------|
| Price | `\$([\d,]+)` | Strip commas before parsing |
| Date | `(Jan\|Feb\|...) \d{1,2}, \d{4}` | Adjust for site's format |
| Phone | `\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}` | US format |
| Email | `[\w.+-]+@[\w-]+\.[\w.-]+` | Basic pattern |
| Number with label | `Label:\s*(\d+)` | Preceded by known label |
| Boolean from text | `/keyword/i.test(text) ? 'Yes' : 'No'` | Check presence |

## Rate Limiting Guidelines

| Method | Recommended Delay | Why |
|--------|-------------------|-----|
| Public API (no auth) | 1-2 seconds | Courtesy, avoid throttling |
| Authenticated API | Per API docs | Follow rate limit headers |
| Direct HTML fetch | 2-3 seconds | Avoid IP blocks |
| Headless browser | 3-5 seconds | Mimic human speed |
| Real browser (Chrome) | 5-10 seconds | Avoid detection patterns |

Check response headers for rate limit info:
- `X-RateLimit-Remaining`
- `Retry-After`
- `X-RateLimit-Reset`

## Spike Protocol

Before building a full scraper, always run a spike:

1. **Pick 2-3 target items** (known data for validation)
2. **Try Rung 1** (API discovery) — spend 5-10 minutes in DevTools Network tab
3. **If API found:** Test with `fetch()`, validate data matches expectations
4. **If no API:** Try `curl`/`fetch` on the page URL — does it return full HTML?
5. **If SPA:** Try Playwright — does it work or get 403'd?
6. **If blocked:** Use Chrome DevTools MCP
7. **Document:** Which rung worked, what data format, any gotchas

## Data Pipeline Pattern

```
Discovery → Spike → Build Script → Batch Extract → Transform → Validate → Store
```

1. **Discovery:** Find the data source (API, HTML, DOM)
2. **Spike:** Validate approach on 2-3 items
3. **Build Script:** Write extraction logic, unit test with mock data
4. **Batch Extract:** Run against all targets with rate limiting
5. **Transform:** Map raw data to your schema
6. **Validate:** Check data quality (nulls, types, completeness)
7. **Store:** Write to JSON, CSV, database, or spreadsheet

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| 403 on first request | Cloudflare/bot detection | Move to Rung 4 (real browser) or use API (Rung 1) |
| 403 after N requests | Rate limiting or fingerprint tracking | Increase delay, rotate user agents, or use API |
| Empty HTML body | SPA — content loads via JS | Use browser-based approach (Rung 3 or 4) |
| Partial data | Content in lazy-loaded sections or tabs | Scroll page or click tabs before extracting |
| Data from wrong section | Regex matches ads/related items | Use text boundaries to scope extraction |
| Different data format than expected | API returns formatted strings | Strip formatting (`$`, commas) before parsing |
| CAPTCHA challenge | Anti-bot escalation | Move to Rung 5 (manual + extraction) |
| `innerText` returns header only | SPA rendering issue | Use `querySelector('main')` or specific container |
| Session expires mid-scrape | Auth token timeout | Re-authenticate, use shorter batches |
