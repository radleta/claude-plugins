# Web App Planning Protocol

When a plan involves a web application (React, Vue, Svelte, Next.js, or similar), apply these additional requirements on top of the standard planning workflow and CDD phasing.

## Relationship to Implementation Skills

This protocol shapes the **plan** — what testing tiers, story requirements, and visual verification to include. Several implementation skills provide the **how** during execution:

| Skill | Use During |
|-------|-----------|
| **react-expert** | Component architecture, hooks, performance patterns (React projects) |
| **frontend-design** | High-quality UI implementation with creative, polished code |
| **chrome-devtools-agent** | E2e browser testing, screenshots, visual verification via chrome-browser agent |
| **qa-expert** | Test strategy, framework-specific test patterns |

Recommend in the plan: "Load react-expert (or framework equivalent) and chrome-devtools-agent during implementation steps."

## Testing Strategy

Every web app plan must include a testing strategy covering three tiers. Each tier maps to specific plan steps — testing is not a single final step but is woven into implementation phases.

### Tier 1: Unit Tests (Every Implementation Step)

Each step that creates or modifies components, hooks, utilities, or services must include unit tests as part of that step's acceptance criteria.

**Component tests:**
- Render with expected props → correct output
- User interactions (click, type, submit) → correct behavior
- Conditional rendering (loading, error, empty states)
- Accessibility: focusable elements, ARIA attributes, keyboard navigation

**Hook tests:**
- Initial state correctness
- State transitions on actions
- Error handling and edge cases
- Cleanup on unmount

**Utility/service tests:**
- Input/output validation
- Edge cases (null, undefined, empty, boundary values)
- Error conditions

**Plan step template addition:**
```markdown
### Step N: [Feature Name]
...existing actions...

**Unit Tests (required):**
- [ ] Component renders correctly with mock data
- [ ] User interactions trigger expected behavior
- [ ] Loading, error, and empty states render correctly
- [ ] Accessibility: keyboard nav, ARIA labels, focus management
Verify: `npm test -- [test-file]` — all pass, coverage >= 80%
```

### Tier 2: Integration Tests (Feature-Complete Steps)

After a feature's components and hooks are wired together, add integration tests that verify data flow end-to-end within the browser context.

**What to test:**
- Form submission → API call → state update → UI reflects change
- Navigation flows (route changes, redirects, deep links)
- Authentication gates (protected routes, role-based rendering)
- Error recovery (API failure → error state → retry → success)

**Plan step template addition:**
```markdown
### Step N: [Feature] Integration Wiring
...existing actions...

**Integration Tests (required):**
- [ ] Complete user flow works end-to-end with mocked API
- [ ] Error scenarios handled gracefully (network failure, 4xx, 5xx)
- [ ] State persists correctly across navigation
Verify: `npm test -- --testPathPattern integration` — all pass
```

### Tier 3: E2E Browser Tests (Final Verification Steps)

After backend wiring is complete, add e2e tests that run in a real browser using the **chrome-browser agent**. These validate the full stack — frontend, API, database — in a realistic environment.

**When to include e2e tests:**
- User-facing flows that span multiple pages (onboarding, checkout, multi-step forms)
- Features with complex state (drag-and-drop, real-time updates, file uploads)
- Critical paths where failure has high business impact (payment, auth, data export)

**E2e test requirements:**
- Run against a local dev server with test database/fixtures
- Use chrome-browser agent for browser automation (navigation, clicking, form filling, screenshots)
- Capture screenshots at key checkpoints for visual verification
- Test at multiple viewport breakpoints (mobile: 375px, tablet: 768px, desktop: 1280px)

**Plan step template addition:**
```markdown
### Step N: E2E Browser Tests
**Prerequisites:** Dev server running, test fixtures loaded

**Test Flows (use chrome-browser agent):**
- [ ] [Flow name]: Navigate to [URL] → [actions] → verify [expected state]
- [ ] [Flow name]: [description of user journey]
- [ ] Screenshot comparison at mobile (375px), tablet (768px), desktop (1280px)

**Acceptance Criteria:**
- [ ] All e2e flows pass in chrome-browser
- [ ] Screenshots captured and reviewed at 3 breakpoints
- [ ] No console errors during test execution
- [ ] Network requests return expected status codes
Verify: chrome-browser agent executes all flows successfully
```

## Visual Verification with Stories

Every component created in a web app plan must have corresponding stories (Storybook, Histoire, Ladle, or the project's equivalent). This complements CDD phasing — CDD defines the ordering, this protocol defines the story requirements.

### Story Requirements Per Component

| Requirement | Why It Matters |
|-------------|---------------|
| Default/populated state | Baseline rendering verification |
| Loading state | Skeleton/spinner displays correctly |
| Error state | Error messaging is clear and actionable |
| Empty state | User sees helpful guidance, not blank space |
| Interactive states | Hover, focus, active, disabled all styled |
| Responsive variants | Component works at mobile, tablet, desktop |

### Story-Driven Visual Verification Protocol

At each story phase review gate (from CDD.md), use the chrome-browser agent or ux-verifier agent to verify stories visually:

1. **Render each story variant** in the story tool (Storybook dev server)
2. **Capture screenshots** at 3 breakpoints (375px, 768px, 1280px)
3. **Verify against checklist:**
   - [ ] Layout doesn't break at any breakpoint
   - [ ] Text is readable (no truncation, no overflow)
   - [ ] Interactive elements are reachable (touch targets >= 44px on mobile)
   - [ ] Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
   - [ ] Loading/error/empty states are visually distinct and clear
4. **Document findings** with screenshots as evidence

### When No Story Tool Exists

If the project has no Storybook/Histoire/Ladle setup:
- **First story phase must set up the story tool** as part of its scope
- Choose the tool that matches the framework (Storybook for React, Histoire for Vue, etc.)
- Configure with the project's existing build tool and design system
- Add a story for at least one existing component as a smoke test

## Web App Checklist (Adds to PLAN-QUALITY.md)

These items are **mandatory** when APP_TYPE = web-app. A web app plan scoring < 7/10 on these items is capped at Grade C.

### Testing Checklist (5 items)

- [ ] Unit tests included IN each implementation step (not deferred to a final step)
- [ ] Component tests cover rendering, interactions, and state variants
- [ ] Integration tests verify end-to-end data flow for each feature
- [ ] E2e browser tests planned for critical user flows (using chrome-browser agent)
- [ ] Test verification commands specified per step (not just "run tests")

### Visual Verification Checklist (5 items)

- [ ] Every new component has stories with all required variants (default, loading, error, empty)
- [ ] Stories include responsive variants (mobile, tablet, desktop)
- [ ] Story phase review gates include visual verification (screenshots at 3 breakpoints)
- [ ] Accessibility verified in stories (contrast, keyboard nav, ARIA, touch targets)
- [ ] Story tool setup included if project lacks one

## Investigation Additions for Web Apps

During the investigation phase, add these areas when APP_TYPE = web-app:

### Browser Compatibility Discovery

- Target browsers and versions (check package.json browserslist, .browserslistrc)
- Polyfill requirements
- CSS feature support (check for PostCSS, autoprefixer config)

### Testing Infrastructure Discovery

- Test framework (Jest, Vitest, Testing Library, Cypress, Playwright)
- Test file patterns and locations
- Coverage thresholds and CI enforcement
- Existing e2e test patterns (if any)
- Mock data conventions for tests

### Story Infrastructure Discovery

(Overlaps with CDD's UI Infrastructure Discovery — focus on what CDD doesn't cover)
- Story file naming convention (*.stories.tsx vs *.story.tsx)
- Story organization (co-located vs centralized)
- Decorator patterns (theme providers, router wrappers)
- Add-on configuration (a11y, viewport, actions)

**Document as:**
```markdown
## Web App Infrastructure
- Test framework: Vitest + React Testing Library
- Test location: co-located __tests__/ folders
- Coverage threshold: 80% (enforced in CI)
- E2e: Playwright in tests/e2e/ (if exists) or none (plan must add)
- Stories: Storybook 8, co-located *.stories.tsx
- Story decorators: ThemeProvider + RouterProvider in .storybook/preview.tsx
- Browsers: last 2 versions of Chrome, Firefox, Safari (from browserslist)
```
