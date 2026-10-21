# UX verification report examples

## ISSUES_FOUND example

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

## Issues
- would-ship-bug [UX-03] UserProfile.tsx:28 — "`<div onClick={save}>`" — screen reader and keyboard users cannot save their profile — Fix: change to a `<button>` element
- would-ship-bug [UX-09] profile.css:12 — "`.profile-form { width: 480px; }`" — below 768px the form overflows and the submit button is off-screen, so mobile users cannot save — Fix: add a mobile breakpoint with a stacked layout
- real-minor [UX-01] UserProfile.tsx:44 — "`await saveProfile(data)`" — the save runs with no loading state, so users click again and submit twice — Fix: show a spinner and disable the control while saving
- real-minor [UX-02] UserProfile.tsx:45 — "`catch(e) { setError("Error") }`" — the user sees "Error" with no idea what went wrong or what to do — Fix: "Could not save profile. Check your connection and try again."
- real-minor [UX-11] profile.css:5 — "`color: #333`" — the text ignores the app's dark mode, unlike every token-styled screen — Fix: use `var(--color-text-primary)`

## Non-blocking findings
none

### Axiom Check
| # | Axiom | Status | Evidence |
|---|-------|--------|----------|
| 1 | Action acknowledged <100ms | ❌ | No loading state on save button |
| 2 | User input preserved | ✅ | Form fields persist on error |
| 3 | Edge cases handled | ❌ | No mobile breakpoint, form overflows |
| 4 | Recent intent wins | ✅ | Single save action, no race condition |
| 5 | Constraints transparent | ❌ | Generic error message hides real issue |
| 6 | Platform conventions | ❌ | div-as-button violates a11y conventions |

## Dimensions Checked
- UX-01 feedback — 1 finding
- UX-02 error experience — 1 finding
- UX-03 accessibility — 1 finding
- UX-09 responsive — 1 finding
- UX-11 design system — 1 finding
- every other category — clean
```

## APPROVED example

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

## Issues
none

## Non-blocking findings
- nit [UX-10] Dashboard.tsx:15 — "No data" — the empty state reads curt — Fix: "No activity yet. Data will appear here as your team gets started."

### Axiom Check
| # | Axiom | Status | Evidence |
|---|-------|--------|----------|
| 1 | Action acknowledged <100ms | ✅ | Skeleton screens during data fetch |
| 2 | User input preserved | ✅ | No form inputs on this page |
| 3 | Edge cases handled | ✅ | Empty state rendered, error state rendered |
| 4 | Recent intent wins | ✅ | Data refresh replaces stale data |
| 5 | Constraints transparent | ✅ | Rate limit shown in UI when hit |
| 6 | Platform conventions | ✅ | Semantic HTML, keyboard navigable |

## Dimensions Checked
- UX-10 content and microcopy — 1 finding
- UX-01 through UX-13 otherwise — clean; UX-07 not evaluable — no CLI code
```
