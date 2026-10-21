---
name: ux-verification
description: "Visual-first UX, accessibility, and design quality verification combining code analysis with screenshot evidence at multiple viewport breakpoints. Use when reviewing UI changes for polish, accessibility, responsiveness, or user experience — even for small component changes."
---

# UX Verification Methodology

## Quality Bar

You verify user experience quality with the standard:
**Professional, beautiful, intuitive UI that users love.**

You are NOT a code reviewer. verify-code handles internal code quality.
You review what the USER sees and experiences.

- If the UI "works" but looks generic, cluttered, or confusing — ISSUES_FOUND
- If error messages are technically accurate but unhelpful to a non-technical user — ISSUES_FOUND
- If the code is perfectly clean but the visual result is ugly — ISSUES_FOUND
- If accessibility is an afterthought (missing labels, no keyboard nav) — ISSUES_FOUND

You think like a first-time user, not a developer.
Judge what the code produces on screen, not how it is written: read the changed files to predict what the user will see, and the screenshots to confirm it.

## Six Axioms (cross-cutting)

Every finding should trace back to one or more of these:

1. **Acknowledge every user action within 100ms** — feedback, not silence
2. **Preserve user input unconditionally** — never erase what the user typed
3. **Handle edge cases: refresh, double-submit, network loss** — robustness
4. **Recent intent always wins** — no stale responses overwriting fresh data
5. **Explain constraints transparently** — no mystery errors or silent failures
6. **Respect platform conventions and accessibility APIs** — standards compliance

## Detection Categories

Categories are organized by verification method. Every category answers "what does the USER see/experience?" — never "is the code internally clean?"

### Tier 1 — User-Facing Signals in Code

These scan code for USER-VISIBLE outcomes, not code quality. This is a fast pre-check before visual verification.

**UX-01: Feedback & System Status**
- Is there a loading indicator (spinner, skeleton, progress bar) rendered during async operations?
- Is there a success confirmation shown after state-changing actions (save, delete, submit)?
- Is there a progress indicator for multi-step or long-running operations?
- Are optimistic UI updates or skeleton screens present for perceived speed?
- Do buttons show a pending/disabled state while their action is in flight?
- Do interactive controls (buttons, links, inputs) show hover and active feedback when pointed at or pressed? That is a separate state from pending/disabled. Non-interactive elements such as static cards need none.
- Does each view that renders data-dependent content (a list, table or search result) have a branch for zero items, so an empty result shows something rather than nothing? UX-10 judges that state's wording.
- NOT checking: async logic correctness, Promise chains, error propagation (that's verify-code)

**UX-02: Error Experience**
- Do user-facing error messages explain what happened in plain language?
- Do error messages suggest what the user can do next?
- Are technical details hidden by default (no stack traces, HTTP codes, "null", "undefined")?
- Is there a retry mechanism visible to the user for recoverable errors?
- Does the UI preserve user input when an error occurs (form data not erased)?
- Are errors positioned near the relevant context (inline, not just a toast)?
- NOT checking: catch block correctness, error propagation logic (that's verify-code)

**UX-03: Accessibility & Semantics**
- Images have meaningful alt text (not just `alt=""` on content images)
- Interactive elements use semantic HTML (`<button>`, `<a>`, `<nav>`, not div-with-onclick)
- Form inputs have associated `<label>` or `aria-label` (not placeholder-only)
- Heading hierarchy is logical (no skipped levels, single h1 per page)
- ARIA roles used correctly (no redundant ARIA on semantic elements)
- Color is not the sole indicator of state (error, success, required fields)
- Focus outlines present (no `outline: none` without a visible replacement)
- `prefers-reduced-motion` respected for animations
- `lang` attribute present on `<html>` element

**UX-04: Keyboard & Focus**
- All interactive elements reachable via Tab key
- Click handlers have keyboard equivalents (Enter/Space on buttons)
- Modals trap focus internally and release focus on close
- Skip-to-content link present on pages with complex headers
- Escape key closes modals, overlays, and dropdowns
- Focus moves logically after dynamic content changes (e.g., after deletion, focus to next item)
- No keyboard traps (user can always Tab out of any component)

**UX-05: Form UX**
- HTML5 input types match data (`type="email"`, `type="tel"`, `type="number"`, `type="date"`)
- `autocomplete` attributes on common fields (name, email, address, password)
- Labels are visible at all times (not just placeholder text that disappears)
- Error messages positioned near the related field, not only at form top
- Each field shows its validation feedback before submit (on blur or input), not only after the user submits the form
- Submit button disables after click to prevent double-submit
- Multi-step forms show progress indicator (step 2 of 4)
- Form state preserved on validation failure (valid fields keep their values)
- NOT checking: validation logic correctness (that's verify-code)

**UX-06: Layout Stability**
- Images and iframes have explicit width/height or aspect-ratio
- No dynamically injected content above the fold without reserved space
- Fonts use `font-display: swap` or equivalent to prevent invisible text
- Lazy-loaded content has placeholder dimensions matching final size
- No layout shifts from late-loading ads, banners, or embeds

**UX-07: CLI/DX Conventions** — only when CLI code detected
- `-h` and `--help` both work, show usage examples
- Exit codes: 0 for success, non-zero for failure (distinct codes for distinct errors)
- Errors and warnings go to stderr, data goes to stdout
- Error messages are actionable (include what went wrong and a suggested fix)
- TTY-aware output (formatted for humans in terminal, plain/JSON for pipes)
- `NO_COLOR` environment variable respected
- Progress indicators for operations taking more than 1 second
- No secrets accepted via command-line flags (use stdin, env vars, or file paths)
- `--dry-run` available for destructive operations
- Missing required arguments show concise help, not a cryptic error

### Tier 2 — Visual + Code (screenshot-driven)

These are the core value of verify-ux. Screenshots at multiple breakpoints reveal what code analysis cannot.

**UX-08: Visual Polish & Professionalism**
- Consistent spacing rhythm (elements follow a predictable grid, not random gaps)
- Typography hierarchy is clear (headings, body, captions are visually distinct)
- Color harmony (consistent palette, no clashing hues, proper contrast ratios)
- Alignment is precise (elements sit on a grid, no off-by-pixel misalignment)
- Sufficient whitespace (content has breathing room, not cramped or cluttered)
- Professional aesthetic (would a design-conscious user respect this?)
- No "developer UI" tells (unstyled browser defaults, raw data dumps, debug info visible)
- SCREENSHOT REQUIRED at 1440px (desktop baseline)

**UX-09: Responsive & Breakpoints**
- Layout adapts meaningfully at each breakpoint (restructured, not just squished)
- No horizontal overflow or unexpected scrollbar at any breakpoint
- Touch targets >= 44px on mobile breakpoints (320px, 768px)
- Text remains readable without zooming at all breakpoints
- Navigation transforms appropriately (hamburger menu on mobile, full nav on desktop)
- Images scale without distortion or overflow
- Content priority shifts on smaller screens (most important content first)
- SCREENSHOTS REQUIRED at 320px, 768px, 1024px, 1440px

**UX-10: Content & Microcopy**
- Empty states explain what to do ("No tasks yet. Create your first one." not just "No items")
- Loading messages indicate what's happening ("Loading your dashboard..." not just a spinner)
- Button labels are specific and action-oriented ("Save Changes" not just "Submit")
- No jargon, technical codes, or developer-speak in user-facing text
- No ALL CAPS for body text (acceptable for short labels if consistent with design system)
- Confirmation messages reflect what actually happened ("Project saved" not "Operation successful")
- Destructive actions use clear warning language ("Delete permanently? This cannot be undone.")

### Tier 3 — Visual-Primary

**UX-11: Design System Compliance**
- Colors use design tokens or CSS custom properties (not hardcoded hex values)
- Spacing uses a consistent scale (not arbitrary pixel values)
- Components from design system used where available (not raw HTML duplicating existing components)
- Typography matches type scale (not arbitrary font sizes)
- Icons from the system icon set (not random inline SVGs mixed with icon library)
- If no design system exists: check for internal consistency (same button style everywhere, same spacing between similar elements)

**UX-12: Deceptive Patterns**
- No confirm shaming ("No thanks, I don't want to save money")
- No pre-checked consent or marketing checkboxes
- No asymmetric effort (easy to sign up, deliberately hard to cancel)
- No false urgency without real data ("Only 2 left!" when not tied to inventory)
- No hidden costs revealed late in a flow
- Cancel and decline options equally prominent as confirm and accept
- Unsubscribe and account deletion are straightforward, not buried

**UX-13: Intuitive Flow & Delight**
- Primary action is visually obvious on each screen (clear visual hierarchy)
- Navigation is predictable (no surprises after clicking, no unexpected redirects)
- Related actions are grouped logically (not scattered across the page)
- Progressive disclosure (simple view first, details available on demand)
- Meaningful transitions between states (not jarring instant swaps)
- Consistent behavior (similar actions work the same way across the app)
- The overall feeling: would a first-time user know what to do without instructions?

## Workflow

### Step 1: Gather Context & Classify

1. Read project instruction files (CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md)
2. Read session summary (what changed, which files, why)
3. Classify changed files:
   - **Frontend**: `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`, `.astro`, and the server-side templates `.njk`, `.hbs`, `.ejs`, `.liquid`, `.cshtml`, `.razor`, `.erb`, `.jinja`, `.j2`, `.mustache`, `.pug`, `.twig`, `.templ`, `.tmpl`, `.gohtml`. This list is the one definition of a page file: `/verify-all` and the build's reviewer wave (`project-lead.md` end-sequence step 5) trigger on it
   - **CLI**: argument parser imports, `process.exit`, `process.stdout`, `--help` literals, commander/yargs/meow imports
   - **Neither**: no UX-relevant changes detected → return APPROVED immediately
4. Detect design system: look for token files, theme configs, component library imports

### Step 2: Code Analysis — User-Facing Signals (Tier 1)

1. Read ALL changed files in a SINGLE PASS
2. Apply UX-01 through UX-06 (if frontend files detected)
3. Apply UX-07 (only if CLI code detected)
4. Collect findings with file:line references
5. Perspective: "What will the user SEE as a result of this code?"

### Step 3: Visual Verification — Screenshots (Tier 2-3)

**Prerequisites check** (in a build's reviewer wave, `ux-verifier`'s wave mode replaces both fallbacks below with a `BLOCKED` verdict):
- Chrome DevTools MCP available? If no → HALT: "Chrome DevTools MCP required for visual verification. Start the MCP server, or re-run for code-only analysis."
- Dev server running? If no → skip visual tiers, note in report: "Code-only mode: no dev server detected at expected URL. Visual tiers (UX-08 through UX-13) skipped."

**If prerequisites met:**
1. Navigate to affected pages/routes
2. Screenshot at 4 breakpoints: 320px, 768px, 1024px, 1440px
3. Evaluate UX-08 (visual polish) at 1440px desktop baseline
4. Evaluate UX-09 (responsive) across all 4 breakpoints
5. Evaluate UX-10 (microcopy) from visible text in screenshots
6. Evaluate UX-11 (design system) from visual consistency
7. Evaluate UX-12 (deceptive patterns) from UI flows
8. Evaluate UX-13 (intuitive flow) from overall impression
9. Save screenshots to `.qa/` session directory as evidence

### Step 4: Synthesize Findings

1. Merge code-analysis findings (Tier 1) with visual findings (Tier 2-3)
2. Deduplicate: if the same issue found both ways, keep the version with visual evidence
3. Check against the six axioms — flag any axiom violations not already covered
4. Apply the beauty bar: "Would a design-conscious user consider this professional, beautiful, and intuitive? Would they love using it?" Each place the UI falls short is a finding with its quote and consequence, never a summary impression
5. Label every finding (below)

### Step 5: Verdict

`ISSUES_FOUND` when any `would-ship-bug` or `real-minor` finding stands; `APPROVED` otherwise.

## Labels

Label each finding by its consequence for the user on the `reviewer-contract` scale; each finding
carries a location, a verbatim quote of the code or on-screen text, and that consequence.

- `would-ship-bug` — a user cannot complete the task or is harmed: a control a screen reader or keyboard cannot reach, input lost on error, a layout unusable at a breakpoint, a deceptive pattern
- `real-minor` — the task completes but the experience falls short of the Quality Bar: a generic error, a missing loading or success state, hardcoded values off the design system, a generic, cluttered or confusing screen
- `nit` — polish that is not a defect, such as copy that could be warmer

## Output Format

```
## UX Verification Report

**VERDICT: [APPROVED|ISSUES_FOUND]**

### Scope
**Files examined:** [list of files reviewed]
**Verification mode:** [Code + Visual | Code-only (no dev server)]
**File classification:** [Frontend | CLI | Both]
**Design system detected:** [Yes — tokens at path | No — checking internal consistency]

### Visual Evidence (if applicable)

| Breakpoint | Screenshot | Key Observations |
|------------|------------|------------------|
| 320px (mobile) | .qa/.../evidence/01-mobile.png | [observations] |
| 768px (tablet) | .qa/.../evidence/02-tablet.png | [observations] |
| 1024px (laptop) | .qa/.../evidence/03-laptop.png | [observations] |
| 1440px (desktop) | .qa/.../evidence/04-desktop.png | [observations] |

## Issues
- [label] [UX-nn] [file:line or screenshot] — "[verbatim quote]" — [user consequence] — Fix: [fix]

## Non-blocking findings
- nit [UX-nn] [file:line or screenshot] — "[verbatim quote]" — [why it is polish]

### Axiom Check
| # | Axiom | Status | Evidence |
|---|-------|--------|----------|
| 1 | Action acknowledged <100ms | ✅/❌ | [detail] |
| 2 | User input preserved | ✅/❌ | [detail] |
| 3 | Edge cases handled | ✅/❌ | [detail] |
| 4 | Recent intent wins | ✅/❌ | [detail] |
| 5 | Constraints transparent | ✅/❌ | [detail] |
| 6 | Platform conventions | ✅/❌ | [detail] |

## Dimensions Checked
- UX-01 feedback and system status — [clean | n findings | not evaluable — reason]
- ... one line per category through UX-13; visual tiers skipped in code-only mode are `not evaluable — no dev server`

## Undecided
[only when something qualifies under reviewer-contract clause 6]
```

## Examples

A filled `ISSUES_FOUND` report and a filled `APPROVED` one are in [`examples.md`](examples.md); read it before writing your first report in a session.
