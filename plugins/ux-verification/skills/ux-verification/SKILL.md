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
You have no knowledge of the codebase. You only see what's on screen.

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

**UX-01: Feedback & System Status** (CRITICAL)
- Is there a loading indicator (spinner, skeleton, progress bar) rendered during async operations?
- Is there a success confirmation shown after state-changing actions (save, delete, submit)?
- Is there a progress indicator for multi-step or long-running operations?
- Are optimistic UI updates or skeleton screens present for perceived speed?
- Do buttons show a pending/disabled state while their action is in flight?
- NOT checking: async logic correctness, Promise chains, error propagation (that's verify-code)

**UX-02: Error Experience** (CRITICAL)
- Do user-facing error messages explain what happened in plain language?
- Do error messages suggest what the user can do next?
- Are technical details hidden by default (no stack traces, HTTP codes, "null", "undefined")?
- Is there a retry mechanism visible to the user for recoverable errors?
- Does the UI preserve user input when an error occurs (form data not erased)?
- Are errors positioned near the relevant context (inline, not just a toast)?
- NOT checking: catch block correctness, error propagation logic (that's verify-code)

**UX-03: Accessibility & Semantics** (CRITICAL)
- Images have meaningful alt text (not just `alt=""` on content images)
- Interactive elements use semantic HTML (`<button>`, `<a>`, `<nav>`, not div-with-onclick)
- Form inputs have associated `<label>` or `aria-label` (not placeholder-only)
- Heading hierarchy is logical (no skipped levels, single h1 per page)
- ARIA roles used correctly (no redundant ARIA on semantic elements)
- Color is not the sole indicator of state (error, success, required fields)
- Focus outlines present (no `outline: none` without a visible replacement)
- `prefers-reduced-motion` respected for animations
- `lang` attribute present on `<html>` element

**UX-04: Keyboard & Focus** (HIGH)
- All interactive elements reachable via Tab key
- Click handlers have keyboard equivalents (Enter/Space on buttons)
- Modals trap focus internally and release focus on close
- Skip-to-content link present on pages with complex headers
- Escape key closes modals, overlays, and dropdowns
- Focus moves logically after dynamic content changes (e.g., after deletion, focus to next item)
- No keyboard traps (user can always Tab out of any component)

**UX-05: Form UX** (HIGH)
- HTML5 input types match data (`type="email"`, `type="tel"`, `type="number"`, `type="date"`)
- `autocomplete` attributes on common fields (name, email, address, password)
- Labels are visible at all times (not just placeholder text that disappears)
- Error messages positioned near the related field, not only at form top
- Submit button disables after click to prevent double-submit
- Multi-step forms show progress indicator (step 2 of 4)
- Form state preserved on validation failure (valid fields keep their values)
- NOT checking: validation logic correctness (that's verify-code)

**UX-06: Layout Stability** (HIGH)
- Images and iframes have explicit width/height or aspect-ratio
- No dynamically injected content above the fold without reserved space
- Fonts use `font-display: swap` or equivalent to prevent invisible text
- Lazy-loaded content has placeholder dimensions matching final size
- No layout shifts from late-loading ads, banners, or embeds

**UX-07: CLI/DX Conventions** (HIGH) — only when CLI code detected
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

**UX-08: Visual Polish & Professionalism** (HIGH)
- Consistent spacing rhythm (elements follow a predictable grid, not random gaps)
- Typography hierarchy is clear (headings, body, captions are visually distinct)
- Color harmony (consistent palette, no clashing hues, proper contrast ratios)
- Alignment is precise (elements sit on a grid, no off-by-pixel misalignment)
- Sufficient whitespace (content has breathing room, not cramped or cluttered)
- Professional aesthetic (would a design-conscious user respect this?)
- No "developer UI" tells (unstyled browser defaults, raw data dumps, debug info visible)
- SCREENSHOT REQUIRED at 1440px (desktop baseline)

**UX-09: Responsive & Breakpoints** (HIGH)
- Layout adapts meaningfully at each breakpoint (restructured, not just squished)
- No horizontal overflow or unexpected scrollbar at any breakpoint
- Touch targets >= 44px on mobile breakpoints (320px, 768px)
- Text remains readable without zooming at all breakpoints
- Navigation transforms appropriately (hamburger menu on mobile, full nav on desktop)
- Images scale without distortion or overflow
- Content priority shifts on smaller screens (most important content first)
- SCREENSHOTS REQUIRED at 320px, 768px, 1024px, 1440px

**UX-10: Content & Microcopy** (MEDIUM)
- Empty states explain what to do ("No tasks yet. Create your first one." not just "No items")
- Loading messages indicate what's happening ("Loading your dashboard..." not just a spinner)
- Button labels are specific and action-oriented ("Save Changes" not just "Submit")
- No jargon, technical codes, or developer-speak in user-facing text
- No ALL CAPS for body text (acceptable for short labels if consistent with design system)
- Confirmation messages reflect what actually happened ("Project saved" not "Operation successful")
- Destructive actions use clear warning language ("Delete permanently? This cannot be undone.")

### Tier 3 — Visual-Primary (holistic judgment)

**UX-11: Design System Compliance** (HIGH)
- Colors use design tokens or CSS custom properties (not hardcoded hex values)
- Spacing uses a consistent scale (not arbitrary pixel values)
- Components from design system used where available (not raw HTML duplicating existing components)
- Typography matches type scale (not arbitrary font sizes)
- Icons from the system icon set (not random inline SVGs mixed with icon library)
- If no design system exists: check for internal consistency (same button style everywhere, same spacing between similar elements)

**UX-12: Deceptive Patterns** (CRITICAL)
- No confirm shaming ("No thanks, I don't want to save money")
- No pre-checked consent or marketing checkboxes
- No asymmetric effort (easy to sign up, deliberately hard to cancel)
- No false urgency without real data ("Only 2 left!" when not tied to inventory)
- No hidden costs revealed late in a flow
- Cancel and decline options equally prominent as confirm and accept
- Unsubscribe and account deletion are straightforward, not buried

**UX-13: Intuitive Flow & Delight** (MEDIUM)
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
   - **Frontend**: `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`, `.astro`
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

**Prerequisites check:**
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
3. Assign severity: CRITICAL > HIGH > MEDIUM
4. Check against the six axioms — flag any axiom violations not already covered
5. Apply the beauty bar: "Would a design-conscious user consider this professional, beautiful, and intuitive? Would they love using it?"

### Step 5: Verdict

Determine **APPROVED** or **ISSUES_FOUND** based on findings.

- Any CRITICAL finding → ISSUES_FOUND
- 3+ HIGH findings → ISSUES_FOUND
- HIGH findings in isolation → use judgment (is it a meaningful UX degradation?)
- MEDIUM-only findings → APPROVED with recommendations
- If the UI merely "works" but looks generic, cluttered, or confusing → ISSUES_FOUND

## Output Format

```
## UX Verification Report

**VERDICT: [APPROVED|ISSUES_FOUND]**

---

### Scope
**Files examined:** [list of files reviewed]
**Verification mode:** [Code + Visual | Code-only (no dev server)]
**File classification:** [Frontend | CLI | Both]
**Design system detected:** [Yes — tokens at path | No — checking internal consistency]

---

### Visual Evidence (if applicable)

| Breakpoint | Screenshot | Key Observations |
|------------|------------|------------------|
| 320px (mobile) | .qa/.../evidence/01-mobile.png | [observations] |
| 768px (tablet) | .qa/.../evidence/02-tablet.png | [observations] |
| 1024px (laptop) | .qa/.../evidence/03-laptop.png | [observations] |
| 1440px (desktop) | .qa/.../evidence/04-desktop.png | [observations] |

---

### Findings

#### CRITICAL
| Category | File:Line | Issue | User Impact | Fix |
|----------|-----------|-------|-------------|-----|

#### HIGH
| Category | File:Line | Issue | User Impact | Fix |
|----------|-----------|-------|-------------|-----|

#### MEDIUM
| Category | File:Line | Issue | User Impact | Fix |
|----------|-----------|-------|-------------|-----|

---

### Axiom Check
| # | Axiom | Status | Evidence |
|---|-------|--------|----------|
| 1 | Action acknowledged <100ms | ✅/❌ | [detail] |
| 2 | User input preserved | ✅/❌ | [detail] |
| 3 | Edge cases handled | ✅/❌ | [detail] |
| 4 | Recent intent wins | ✅/❌ | [detail] |
| 5 | Constraints transparent | ✅/❌ | [detail] |
| 6 | Platform conventions | ✅/❌ | [detail] |

---

### Summary

**Beauty Bar:** [Would a design-conscious user love this? Why or why not?]
**Accessibility:** [X] critical, [X] high issues
**Responsiveness:** [Passes at all breakpoints | Fails at: list]
**Overall:** [PROCEED to next gate | ADDRESS issues first]
```

## Examples

### ISSUES_FOUND Example

```
## UX Verification Report

**VERDICT: ISSUES_FOUND**

### Scope
**Files examined:** src/components/UserProfile.tsx, src/styles/profile.css
**Verification mode:** Code + Visual
**File classification:** Frontend
**Design system detected:** Yes — tokens at src/styles/tokens.css

### Visual Evidence

| Breakpoint | Screenshot | Key Observations |
|------------|------------|------------------|
| 320px | .qa/.../evidence/01-mobile.png | Form overflows viewport, submit button off-screen |
| 768px | .qa/.../evidence/02-tablet.png | Acceptable layout |
| 1024px | .qa/.../evidence/03-laptop.png | Acceptable layout |
| 1440px | .qa/.../evidence/04-desktop.png | Profile card feels cramped, no whitespace around avatar |

### Findings

#### CRITICAL
| Category | File:Line | Issue | User Impact | Fix |
|----------|-----------|-------|-------------|-----|
| UX-03 | UserProfile.tsx:28 | `<div onClick={save}>` used instead of `<button>` | Screen reader users cannot interact | Change to `<button>` element |
| UX-02 | UserProfile.tsx:45 | `catch(e) { setError("Error") }` — generic error | User has no idea what went wrong or what to do | Show specific message: "Could not save profile. Check your connection and try again." |

#### HIGH
| Category | File:Line | Issue | User Impact | Fix |
|----------|-----------|-------|-------------|-----|
| UX-09 | profile.css:12 | No responsive styles below 768px | Form unusable on mobile — overflows viewport | Add mobile breakpoint with stacked layout |
| UX-08 | profile.css:5 | Hardcoded `color: #333` instead of token | Inconsistent with rest of app's dark mode support | Use `var(--color-text-primary)` |

### Axiom Check
| # | Axiom | Status | Evidence |
|---|-------|--------|----------|
| 1 | Action acknowledged <100ms | ❌ | No loading state on save button |
| 2 | User input preserved | ✅ | Form fields persist on error |
| 3 | Edge cases handled | ❌ | No mobile breakpoint, form overflows |
| 4 | Recent intent wins | ✅ | Single save action, no race condition |
| 5 | Constraints transparent | ❌ | Generic error message hides real issue |
| 6 | Platform conventions | ❌ | div-as-button violates a11y conventions |

### Summary

**Beauty Bar:** A design-conscious user would find the desktop layout cramped and the mobile experience broken. The hardcoded colors break dark mode. Not yet professional quality.
**Accessibility:** 1 critical (div-as-button), 0 high
**Responsiveness:** Fails at 320px (form overflow)
**Overall:** ADDRESS issues first
```

### APPROVED Example

```
## UX Verification Report

**VERDICT: APPROVED**

### Scope
**Files examined:** src/components/Dashboard.tsx, src/components/StatCard.tsx
**Verification mode:** Code + Visual
**File classification:** Frontend
**Design system detected:** Yes — tokens at src/theme/tokens.ts

### Visual Evidence

| Breakpoint | Screenshot | Key Observations |
|------------|------------|------------------|
| 320px | .qa/.../evidence/01-mobile.png | Cards stack vertically, readable |
| 768px | .qa/.../evidence/02-tablet.png | 2-column grid, good use of space |
| 1024px | .qa/.../evidence/03-laptop.png | 3-column grid, balanced |
| 1440px | .qa/.../evidence/04-desktop.png | 4-column grid, professional and clean |

### Findings

#### MEDIUM
| Category | File:Line | Issue | User Impact | Fix |
|----------|-----------|-------|-------------|-----|
| UX-10 | Dashboard.tsx:15 | Empty state says "No data" | Could be friendlier | Consider "No activity yet. Data will appear here as your team gets started." |

### Axiom Check
| # | Axiom | Status | Evidence |
|---|-------|--------|----------|
| 1 | Action acknowledged <100ms | ✅ | Skeleton screens during data fetch |
| 2 | User input preserved | ✅ | No form inputs on this page |
| 3 | Edge cases handled | ✅ | Empty state rendered, error state rendered |
| 4 | Recent intent wins | ✅ | Data refresh replaces stale data |
| 5 | Constraints transparent | ✅ | Rate limit shown in UI when hit |
| 6 | Platform conventions | ✅ | Semantic HTML, keyboard navigable |

### Summary

**Beauty Bar:** Clean, professional dashboard with responsive grid. Design-conscious user would approve. Minor empty state copy could be warmer.
**Accessibility:** 0 critical, 0 high
**Responsiveness:** Passes at all breakpoints
**Overall:** PROCEED to next gate
```
