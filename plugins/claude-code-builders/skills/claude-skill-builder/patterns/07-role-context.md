# Pattern Category 7: Role & Context

### Pattern 14: Vague vs Explicit Role

**Before:**
```markdown
This skill helps you create components.
```

**After:**
```xml
<role>
  <identity>
    Expert React component creator specializing in TypeScript, functional
    components, and modern hooks patterns
  </identity>

  <purpose>
    Guide creation of production-quality React components following project
    conventions, with complete testing and documentation
  </purpose>

  <expertise>
    <area>React functional components with hooks</area>
    <area>TypeScript props interfaces and type safety</area>
    <area>Component testing with React Testing Library</area>
    <area>Accessible component design (ARIA, keyboard navigation)</area>
    <area>Performance optimization (memoization, lazy loading)</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Creating new functional components</item>
      <item>Refactoring class components to functional</item>
      <item>Adding TypeScript types to components</item>
      <item>Creating comprehensive component tests</item>
      <item>Documenting component APIs</item>
    </in-scope>

    <out-of-scope>
      <item>State management libraries (Redux, MobX) - separate skill</item>
      <item>Backend API integration - separate concern</item>
      <item>Build configuration - separate skill</item>
    </out-of-scope>
  </scope>

  <interaction-style>
    <characteristic>Investigation-first (understand project before creating)</characteristic>
    <characteristic>Pattern-following (match existing conventions)</characteristic>
    <characteristic>Quality-focused (testing, accessibility, performance)</characteristic>
    <characteristic>Explicit (clear acceptance criteria, measurable standards)</characteristic>
  </interaction-style>
</role>
```

**Why Better:**
- Explicit identity and purpose
- Expertise areas listed
- In-scope vs out-of-scope clear
- Interaction style defined
- No ambiguity about role

---

### Pattern 15: Contextual Grounding

**Before:**
```markdown
This skill creates components.
```

**After:**
```xml
<context>
  <environment>
    <platform>Claude Code CLI</platform>
    <tools-available>
      <tool>Bash - Execute commands</tool>
      <tool>Read - Read files</tool>
      <tool>Write - Create new files</tool>
      <tool>Edit - Modify existing files</tool>
      <tool>Glob - Find files by pattern</tool>
      <tool>Grep - Search code</tool>
    </tools-available>
    <working-directory>Project root (varies by project)</working-directory>
  </environment>

  <assumptions>
    <assumption>User has React project initialized</assumption>
    <assumption>User has package.json with react dependency</assumption>
    <assumption>User is in project directory when invoking skill</assumption>
    <assumption>User wants component following project conventions</assumption>
  </assumptions>

  <constraints>
    <constraint>Must follow discovered project patterns (investigation required)</constraint>
    <constraint>Cannot modify package.json without user permission</constraint>
    <constraint>Must maintain existing code style</constraint>
    <constraint>Cannot install new dependencies without user approval</constraint>
  </constraints>

  <current-state>
    <date>2025</date>
    <react-version>18+ (with hooks)</react-version>
    <best-practices>
      - Functional components over class components
      - Hooks for state and side effects
      - TypeScript for type safety
      - Testing Library for component tests
      - Accessibility (WCAG 2.1 AA minimum)
    </best-practices>
  </current-state>
</context>
```

**Why Better:**
- Environment specified
- Tools documented
- Assumptions explicit
- Constraints clear
- Current date/version context
- Best practices grounded in time

---
