# /capture-issue

Contents: Inputs · Task Instructions · Kind Classification · Title Extraction — Overflow Rule · `slug_override` Detection Rules · Intent vs Prior Thinking · Sensitive-Data Guardrails · Example Tool-Call Shape · Return-Parse Error Handling · Echo Format

## Entry: /capture-issue

`/capture-issue <description>`, or another command that applies these steps to its own arguments.

File the user's description as a structured issue document under `scratch/issues/` via the `mcp__scratch-memory__write_issue` tool.

Filing policy — kind boundaries, when to file at all, checking for an existing capture first — is this skill's [SKILL.md](SKILL.md); the admission test step (f) applies is [issue-standard.md](issue-standard.md) `## Admission`.

### Inputs

The arguments are the user's free-form description of an issue, idea, or pain-point. It may optionally contain an inline slug directive (see slug_override detection rules below). When no arguments are provided, prompt the user for a description before proceeding.

### Task Instructions

Given the description, do the following in order:

(a) **Parse** the description — read the full text and understand what the user is reporting.

(b) **Classify `kind`** — determine whether the item is `"issue"`, `"idea"`, or `"mixed"` using holistic LLM judgment anchored by the canonical examples below (not a keyword decision tree). Prefer `"mixed"` when ambiguous.

(c) **Extract `title`** — produce a concise title of ≤ 80 characters, ideally 5–12 words, summarizing what the item is about. Apply the title overflow rule (see below) before calling the tool.

(d) **Detect `slug_override`** — if the user's description contains an explicit inline slug directive, extract it per the detection rules below; otherwise omit.

(e) **Structure the description into optional prose fields** — `summary`, `intent`, `impact`, `prior_thinking`, and `related` — by reading the user's text and assigning content to the appropriate field. Do not invent content; only use what the user provided.

   `related` accepts free-form markdown (file paths, issue slugs, wiki links). When the issue is about a wiki page — whoever filed it, a user typing `/capture-issue` included — `related` is **required** and must use the `wiki:{wiki-domain}/{wiki-slug}` prefix to identify that page (e.g., `"wiki:billing-backend/auth-flow"`); the back-link is the only handle that gets from the issue to the page. For every other subject, `related` is optional and free-form.

(f) **Search for a duplicate, then admit.** Search the open and deferred issues for this subject, each search a fixed string over `scratch/issues/*.md`: the titles (`grep -h '^title:'`), plausible slugs (`ls scratch/issues/` for the subject's key words), and every file or path the description names (`grep -lF -- '{path}'`, matching `## Related` lines). A path goes on that command line only when it matches `^[A-Za-z0-9._/@+-]+$` and does not start with `-`, the path test `issue-groom-methodology` § Inputs gives, since a description often carries pasted logs or URLs; search any other path with the Grep tool. Read the `title:`, `status:` and `## Summary` of each hit. When one holds this subject, file nothing: print

   ```
   Matches: scratch/issues/{slug}.md — {title}
   Proposed addition: {the new evidence or words, as a dated ## Notes bullet, or the ## Summary rewrite the wider scope needs}
   ```

   When the hit matches this subject's slug or title exactly and the addition is a dated `## Notes` bullet, make that edit and stop: the same issue, the agent's call (Owner: agent (user-decision-rubric)). Otherwise wait for the user's ruling. On approval, make that edit to the matching issue and stop; on a ruling that it is a different subject, continue. Whether a hit that is not an exact match holds this subject is Owner: user-decision-rubric (test: Conflict); a `## Summary` rewrite is Owner: user-decision-rubric `corpus-calls`

   Then check the description against the other four `## Admission` questions; when one fails, name it in one line and ask before filing. Owner: user-decision-rubric (test: Scope)

(g) **Call `mcp__scratch-memory__write_issue`** with all resolved fields.

(h) **Parse the return** — attempt `JSON.parse` on the `content[0].text` field of the response per the error-handling rule below.

(i) **Echo a terse result** to the user in the echo format below.

### Kind Classification

Classification approach: **holistic LLM judgment anchored by examples** (not a keyword-based decision tree). Prefer `"mixed"` when ambiguous.

Canonical examples (use these to anchor your judgment — not a tree):

- **`issue` (positive):** `"login times out after 30 seconds on slow networks"` — concrete observed failure of existing behavior.
- **`issue` (negative — NOT an issue):** `"add dark-mode toggle to settings"` — proposes new capability, no current-behavior failure.
- **`idea` (positive):** `"add a /capture-decision slash command that files to scratch/decisions/"` — proposes new capability.
- **`idea` (negative — NOT an idea):** `"build fails on Windows after upgrading Node to 20.11"` — concrete failure of existing behavior.
- **`mixed` (positive):** `"error messages from the API client are opaque because we never standardized an error-class convention"` — states a pain point AND sketches a missing capability as the root cause.
- **`mixed` (negative — NOT mixed):** `"the CI runner is flaky"` (pure `issue`); `"we should add a dashboard"` (pure `idea`).
- **`mixed` boundary case:** `"agents pick up stale issue files because we don't have a triage step"` — contains a symptom AND a proposed capability, but the symptom is the primary frame. Classify as `mixed`; if the user's voice is overwhelmingly about one side, pick that side. When in doubt, `mixed`.

### Title Extraction — Overflow Rule

Target ≤ 80 characters, ideally 5–12 words. If the best title Claude can produce is > 80 characters, truncate at the last word boundary at index ≤ 80 (remove trailing partial word and any trailing punctuation). Do NOT ask the user; do NOT re-prompt internally. The server throws on > 80, so the command must enforce the constraint before calling the tool.

### `slug_override` Detection Rules

**Extract as `slug_override` when** the user's description contains an explicit inline slug directive of the form `slug: <kebab-case-token>`, `slug=<kebab-case-token>`, or `--slug <kebab-case-token>` (or trailing equivalent). The token must match `^[a-z0-9][a-z0-9-]*[a-z0-9]$`.

- **Positive example:** `"slug: fix-login-timeout: login times out on slow networks"` → `slug_override = "fix-login-timeout"`, description used for title/prose is everything after the `:`.
- **Negative example (DO NOT extract):** `"fix the database slug mismatch bug"` — the word "slug" appears but not as a directive. `slug_override` stays absent.
- **Negative example (DO NOT extract):** `"slug: something"` alone with no further description — insufficient content to file; Claude should tell the user to provide a description rather than inventing one.

### Intent vs Prior Thinking

Separate the user's narrative into two distinct prose fields:

- **Intent** = motivation + when-it-came-up. *"I noticed this while trying to run the nightly build on the staging server; we've been flaky for two weeks and finally I could reproduce."*
- **Prior Thinking** = analysis already done + candidate approaches. *"Suspect it's a TLS cert rotation interacting with our OpenSSL version. Options: pin OpenSSL, switch to Node 20, or add a connection-retry with exponential backoff."*

Put motivation/narrative in Intent; put analysis/candidate-causes/proposed-approaches in Prior Thinking.

### Sensitive-Data Guardrails

Before calling the tool, redact: API keys (`sk_*`, `ghp_*`, AWS/GCP keys, etc.), env variable values, absolute personal paths outside the repo, and tokens. Summarize multi-line error output rather than dumping stack traces verbatim. Do not pass raw credentials or secrets as field values.

### Example Tool-Call Shape

**Tool-call XML emission note:** emit `<parameter>` consistently within the same tool call. The `write_issue` MCP tool strict-rejects mixed-namespace tags (`<parameter name="X">...</X>` without the matching `antml:` close-tag prefix) with `MALFORMED_TOOL_CALL_XML`.

```
mcp__scratch-memory__write_issue({
  kind: "issue",
  title: "Login API times out after 30s on slow networks",
  summary: "The /login endpoint times out after 30 seconds when the client is on a slow connection, even though the server responds in under 2 seconds. Users see a generic network-error modal and have to retry.",
  intent: "Saw this when testing the staging environment on tethered mobile data today; confirmed reproducible by throttling Chrome DevTools network to Slow 3G.",
  impact: "Blocks mobile users on cellular data; accounts for ~8% of failed login attempts in last week's logs.",
  prior_thinking: "Likely the client-side XHR timeout is 30s while the real retry-worthy window is longer. Options: increase client timeout to 60s, add server-side push for long-running auth, or add exponential backoff on client.",
  related: "src/auth/login.ts, src/lib/http-client.ts, issue: flaky-auth-metrics.md"
})
```

When the issue is about a wiki page — the researcher reporting pollution it read, or any paired wiki-plus-issue routing — `related` is required and uses the `wiki:{wiki-domain}/{wiki-slug}` prefix:

```
mcp__scratch-memory__write_issue({
  kind: "issue",
  title: "Auth flow wiki page is stale — middleware skips claim validation",
  summary: "The billing-backend auth-flow wiki page describes JWT claim validation before role check, but the current middleware skips claim validation when a role cache hit occurs.",
  intent: "Detected while the researcher agent cross-checked the wiki page against current code; the correction left as a learned/ capture and the page is unchanged.",
  impact: "Any new claim-dependent guard is silently bypassed for cached-role sessions; the wiki page misleads implementers.",
  related: "wiki:billing-backend/auth-flow"
})
```

### Return-Parse Error Handling

After the tool returns:

- Extract the single `content[0].text` string.
- Attempt `JSON.parse` on it.
- **On success:** read `path`, `kind`, `title`, `collision_note` from the parsed object; echo per format below.
- **On failure (non-JSON text):** treat the text as an error message from the server or MCP layer; echo `"Capture failed: {raw text}"` and stop. Do not retry.

### Echo Format

After a successful tool call, print exactly:

```
Captured: {path}
{kind}: {title}
Note: {collision_note}          # line omitted when collision_note is null
```

Additional instructions in the arguments override the above.
