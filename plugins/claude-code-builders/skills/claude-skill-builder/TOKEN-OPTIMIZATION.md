# Token Optimization: Architectural Pattern for Skill Efficiency

## Introduction

Token optimization is an **architectural decision**, not just a technique.

**Paradigm Shift:**
- **Before:** "Use @ references when files get big" (reactive)
- **After:** "Design for token efficiency from the start" (architectural)

**Why This Matters:**
Skills load every session. react-expert demonstrates the opportunity: **3,090 tokens initial load** (0.9%) with **99.1% content available on-demand**.

---

## The Problem

### Skills Load Every Session

Unlike code that runs once, skills load **every conversation**. Impact:
- Heavy skills slow session startup
- Multiple skills compound the problem
- Less context window for actual work
- Slower agent execution

### Measurement Matters

Token costs are real:
- Context window space (limits working memory)
- Loading time (processing overhead)
- User experience (responsiveness)

---

## Core Principles

### Principle 1: Two-Tier Pattern (Inline vs Progressive Disclosure)

⚠️ **@ Reference Discipline:**
- **Never `@` files outside the skill directory** — cross-skill `@` references create fragile path coupling that breaks when skills move or reorganize. To reference another skill, tell Claude to load it by name.
- **Minimize `@` within SKILL.md** — every `@` unconditionally loads content into context when the skill fires, even if that content is rarely needed. This is the primary cause of skill token bloat. Use relative markdown links + Read instructions for supporting files so Claude loads them conditionally.
- **Reserve `@` for content that MUST load every single invocation** — if a supporting file is only needed 10-50% of the time, it should be a Read instruction, not an `@`.

**What:** Decide per content block: inline immediately (Tier 1) or load on-demand (Tier 2).

**Why:** Maintains token efficiency while ensuring critical content is always available.

**Decision Framework:**

**Tier 1: Inline (Immediate Scope)**
- Critical content needed for skill operation
- Frequently referenced (>50% of invocations)
- Small content blocks (<200 lines)
- Content required for basic functionality

**Tier 2: Progressive Disclosure (Read Instructions)**
- Reference material (examples, templates, detailed docs)
- Occasionally needed (<50% of invocations)
- Large content blocks (>200 lines)
- Specialized or advanced content

**How:**
1. Identify content blocks > 100 lines in SKILL.md
2. Evaluate using criteria: importance, frequency, size
3. **If Tier 1:** Inline directly in SKILL.md
4. **If Tier 2:** Move to separate file, use relative markdown link + Read instruction with WHEN/WHY motivation

**Example:**
```markdown
❌ Before (broken @ reference):
See @examples/ for comprehensive examples.

✅ After (Tier 2 with motivation):
[Examples](examples/) - Use Read tool when need concrete implementation patterns

**When:** Creating your first skill of this type
**Why:** 500 lines of before/after examples with explanations
```

---

### Principle 2: Lazy Load Specialized Content

**What:** Keep essential, frequently-used guidance in SKILL.md. Load specialized content on-demand.

**Why:** Most users need only a subset per session. Loading everything wastes tokens.

**How:**
1. Identify core workflow (what every user needs)
2. Identify specialized content (what only some users need)
3. Keep core in SKILL.md, externalize specialized
4. Provide clear navigation

**Example:**
```markdown
Core (in SKILL.md): Workflow, navigation, essential concepts

Specialized (externalized):
- @performance/ - Load when optimizing
- @security/ - Load when addressing security
- @advanced/ - Load for complex patterns
```

---

### Principle 3: Optimize Discovery Paths

**What:** Make it effortless for agents to find and load additional content.

**Why:** Lazy-loading fails if agents can't discover what's available.

⚠️ **UPDATED:** Use relative markdown links + Read instructions (not @ references for skill-internal files)

**How:**
1. Relative markdown links: `[Expert guidance](expert/README.md)`
2. Explicit Read instructions with motivation: "Use Read tool when [WHEN] (provides [WHY])"
3. README.md in folders listing contents
4. Descriptive folder/file names

**Example:**
```markdown
✅ Good: **Need investigation protocols?** Use Read tool on `investigation/README.md` when starting complex projects (40+ checklists)

❌ Poor (broken): See @investigation/ for more

❌ Poor (unmotivated): See other files for more information
```

**Motivation Formula:**
```markdown
Use Read tool on `[file.md]` when [triggering condition] (provides [value/benefit])

Example:
Use Read tool on `expert/README.md` when creating expert skills (765 lines with 40-item checklist)
```

---

### Principle 4: Measure and Validate

**What:** Track initial load vs total content to validate efficiency.

**Why:** Measurement reveals whether architecture works.

**How:**
1. Measure initial load (token count)
2. Estimate total content (all files and lines)
3. Calculate ratio: Initial / Total
4. Target: < 2% comprehensive, < 5% moderate

**Example:**
```
react-expert: 3,090 tokens / ~350k total = 0.9% (exceptional)
typical-expert: 8,000 tokens / ~160k total = 5% (good)
```

---

## Decision Framework: Inline vs Progressive Disclosure

### Evaluation Checklist (Per Content Block)

For each content block or file reference, evaluate:

- [ ] **Importance:** Rate 1-5 (5 = critical for operation, 1 = nice-to-have)
- [ ] **Frequency:** Estimate usage % (>50% = inline candidate, <50% = Read candidate)
- [ ] **Size:** Count lines (<200 = inline candidate, >200 = Read candidate)
- [ ] **Motivation:** If Read, can I write clear WHEN/WHY?

**Decision Logic:**
- **Score ≥12 AND Frequency >50% AND Size <200** → **Inline (Tier 1)**
- **Otherwise** → **Progressive Disclosure (Tier 2 - Read instruction)**

### Content Decision Tree

```
Critical for skill operation?
├─ Yes AND < 200 lines
│   └─ **Inline in SKILL.md (Tier 1)**
├─ Yes AND > 200 lines
│   └─ **Inline summary + Read instruction (Tier 2)**
└─ No (reference material)
    └─ **Progressive Disclosure (Tier 2)**

Used by EVERY invocation?
├─ Yes AND < 200 lines → **Inline (Tier 1)**
└─ No OR > 200 lines → **Read instruction (Tier 2)**

Frequency of use?
├─ < 50% of invocations → **Read instruction (Tier 2)**
└─ > 50% of invocations AND < 200 lines → **Inline (Tier 1)**

Examples/templates/reference docs?
└─ **Always Tier 2 (Read instruction)**
```

### Real-World Examples

**Tier 1: Inlined in SKILL.md**
- Core workflow steps (used every invocation, <100 lines)
- Essential principles summary (<50 lines)
- Quick reference tables (<30 lines)
- Navigation to Tier 2 content (with Read instructions)

**Tier 2: Progressive Disclosure (Read Instructions)**
- Expert skill guidance (765 lines, used ~33% of invocations)
- CLI skill guidance (785 lines, used ~33% of invocations)
- Token optimization details (318 lines, comprehensive skills only ~20%)
- Validation checklists (441 lines, post-creation only)
- Pattern library (1,507 lines, examples/reference)

**Motivation Examples:**
```markdown
✅ Good motivation:
Use Read tool on `expert/README.md` when creating expert skills
**Why:** 765 lines with 40-item quality checklist and investigation protocols

✅ Good motivation:
Use Read tool on `validation/README.md` after skill creation
**Why:** 35 universal + 30 type-specific validation items (Grade A+ criteria)

❌ Poor (no WHEN):
See expert/README.md for expert guidance

❌ Poor (no WHY):
Use Read tool on expert/README.md when needed
```

---

## Case Study: react-expert

**Context:** Comprehensive React 18+ guidance (hooks, patterns, performance, TypeScript, validation).

**Challenge:** Provide deep expertise without token bloat.

### Architecture Decisions

**6 Folders:**
- rules/ - Hard constraints (6 files)
- templates/ - Working code (17 files)
- decision-trees/ - Choice guidance (4 files)
- investigation/ - Project detection (4 files)
- validation/ - Verification (checklist)
- examples/ - Complete workflows

**Why folders:** Categorize by type, enable targeted lazy-loading.

**DETECTION.md:** Maps user requests to files. "User asks about hooks → Load rules/hooks-rules.md"

**README.md per folder:** Explains contents, when to load.

**Minimal SKILL.md (142 lines):** Orchestrator only - workflow, navigation, file organization.

### Metrics (Measured)

- Initial: 3,090 tokens
- Total: 42 files, 616KB (~14,872 lines)
- Ratio: 0.9% (99.1% on-demand)

**Comparison:**
- react-expert: 0.9%
- claude-skill-builder: 4.3% (meta-skill, ~1,067 tokens / ~24,791 tokens)
- Typical expert: 4-5%

### Lessons

**What Worked:**
- Folder organization (intuitive categorization)
- DETECTION.md (targeted loading)
- README navigation (discovery)
- Minimal orchestrator (essential only)

**When to Apply:**
- Comprehensive skills with deep content
- Multiple content categories
- Specialized domain requiring extensive guidance

**When NOT to Apply:**
- Simple skills (< 200 lines total)
- Meta-skills needing context
- Content used every session

---

## Patterns

### Pattern 1: Minimal (< 200 lines total)

**Structure:**
```
skill/
└── SKILL.md (150 lines)
```

**Use:** Simple, focused skills.

**Example:** ✅ 10-item checklist skill | ❌ Comprehensive framework guide

---

### Pattern 2: Moderate (w/ @ references)

**Structure:**
```
skill/
├── SKILL.md (250 lines)
├── EXAMPLES.md
└── ADVANCED.md
```

**Use:** Core workflow + specialized content.

**Example:** ✅ API testing (core + advanced) | ❌ Simple or comprehensive skills

---

### Pattern 3: Comprehensive (react-expert style)

**Structure:**
```
skill/
├── SKILL.md (< 200 lines)
├── DETECTION.md
├── rules/ (+ README.md)
├── examples/ (+ README.md)
├── templates/ (+ README.md)
└── validation/
```

**Use:** Deep expertise, extensive specialized content.

**Example:** ✅ react-expert | ❌ Simple workflow skill

---

### Pattern 4: Meta-Skill Exception

**Structure:**
```
skill/
├── SKILL.md (300-400 lines) - More context
├── UNIVERSAL.md (reference)
├── expert/ (detailed)
└── validation/
```

**Use:** Skills used as reference during work.

**Example:** ✅ claude-skill-builder | ❌ Regular domain skills

---

### Pattern 5: Protocol-Per-File (Operation Variance)

**What:** Split skill by distinct operations/protocols when operations are mutually exclusive.

**Why:** When a skill has multiple distinct operations (e.g., save vs archive vs initialize), users typically need only ONE operation per invocation. Loading all protocols wastes tokens.

**Key Insight:** This differs from content-type splitting (examples, templates). This is about **operation variance** - the skill does different things at different times.

**Structure:**
```
skill/
├── SKILL.md              ← Lean orchestrator (decision logic, request patterns)
├── protocols/
│   ├── operation-a.md    ← Load only when doing A
│   ├── operation-b.md    ← Load only when doing B
│   └── operation-c.md    ← Load only when doing C
└── troubleshooting.md    ← Load only on errors
```

**When to Use:**
- Skill has 3+ distinct operations
- Operations are mutually exclusive (never need A AND B together)
- Each operation has its own workflow/steps
- Operations vary significantly in complexity

**When NOT to Use:**
- Operations share most steps (just use one file)
- Skill has only 1-2 simple operations
- Operations are typically chained together

**SKILL.md Orchestrator Pattern:**

The main SKILL.md becomes a lean orchestrator with:
1. **Request Pattern Matching** - Keywords that trigger each protocol
2. **Decision Logic** - Which protocol to load based on user request
3. **File Loading Protocol** - Clear instructions for when to load each file

```markdown
## Request Pattern Matching

<request-patterns>
  <pattern type="operation-a">
    <triggers>
      <keyword>keyword1</keyword>
      <keyword>keyword2</keyword>
    </triggers>
    <execute>Read protocols/operation-a.md, then execute</execute>
  </pattern>

  <pattern type="operation-b">
    <triggers>
      <keyword>keyword3</keyword>
      <keyword>keyword4</keyword>
    </triggers>
    <execute>Read protocols/operation-b.md, then execute</execute>
  </pattern>
</request-patterns>
```

**Case Study: scratch-management**

| Metric | Before (Monolithic) | After (Protocol-Per-File) |
|--------|---------------------|---------------------------|
| Initial load | 406 lines | 165 lines |
| Save operation | 406 lines | 165 + 50 = 215 lines |
| Archive operation | 406 lines | 165 + 61 = 226 lines |
| Initialize operation | 406 lines | 165 + 110 = 275 lines |
| **Typical savings** | - | **40-60%** |

**File Structure:**
```
scratch-management/
├── SKILL.md              (165 lines) - Orchestrator
├── protocols/
│   ├── save.md           (50 lines)
│   ├── archive.md        (61 lines)
│   ├── list.md           (50 lines)
│   └── initialize.md     (110 lines)
├── troubleshooting.md    (118 lines)
└── scratch.mjs           (script)
```

**Example:** ✅ scratch-management (save/archive/list/init) | ❌ Simple single-operation skills

---

### Pattern 6: Script/Asset References (Bundled Scripts)

**What:** When skills include scripts or executables, reference them using the skill invocation header path.

**Why:** Hardcoded paths break when skills are installed in different locations (user-scoped vs project-scoped, different machines, symlinked).

**The Problem:**

Skills can be installed in multiple locations:
- User-scoped: `~/.claude/skills/my-skill/`
- Project-scoped: `.claude/skills/my-skill/`
- Symlinked from shared location

Hardcoded paths like `.claude/skills/my-skill/script.mjs` break portability.

**The Solution:**

When Claude loads a skill, it provides a header:
```
Base directory for this skill: /absolute/path/to/skill
```

Use this header to construct script paths dynamically.

**Pattern Implementation:**

In SKILL.md, document how to use the header:

```markdown
## Script Location

**Use the path from skill invocation header.** When this skill loads, look for:
```
Base directory for this skill: /path/to/skill
```

Then run: `node "{base-directory}/script.mjs" <command>`

Example: If header says `Base directory for this skill: C:\Users\me\.claude\skills\my-skill`
Then use: `node "C:/Users/me/.claude/skills/my-skill/script.mjs" <command>`
```

In protocol files, reference the pattern:

```markdown
<step order="1">
  <action>Get script path from skill header</action>
  <note>Use "Base directory for this skill: ..." from skill invocation</note>
  <command>SCRIPT="{base-directory}/script.mjs"</command>
</step>
```

**When to Use:**
- Skill includes Node.js scripts (.mjs, .js)
- Skill includes Python scripts (.py)
- Skill includes any executable assets
- Skill needs to reference bundled files

**When NOT to Use:**
- Skill has no bundled scripts/assets
- Scripts are installed globally (not bundled with skill)

**Benefits:**
- Works across user-scoped and project-scoped installations
- Works when skills are symlinked
- Works across different operating systems
- No maintenance when skill is moved/renamed

**Example:** ✅ scratch-management (scratch.mjs) | ❌ Pure instruction skills with no scripts

---

## Guidelines (Suggested Targets, Not Requirements)

| Metric | Minimal | Moderate | Comprehensive | Meta | Protocol-Per-File |
|--------|---------|----------|---------------|------|-------------------|
| SKILL.md | < 200 | < 300 | < 200 | < 400 | < 200 (orchestrator) |
| Init tokens | < 2k | < 5k | < 5k | < 8k | < 3k |
| Files | 1-3 | 4-10 | 15-50+ | 10-30 | 5-15 |
| Ratio | N/A | < 5% | < 2% | < 3% | < 3% per operation |

**Ideal Targets (suggested, not required):**
- SKILL.md < 300 lines (non-meta), < 400 lines (meta-skills)
- Initial load < 5k tokens
- Ratio < 2% (comprehensive), < 5% (meta-skills acceptable)

**Note**: claude-skill-builder itself is 395 lines (within meta-skill < 400 guideline). Meta-skills teaching skill creation need more context than domain-specific skills.

**Context Matters:**
- Meta-skills may need more context
- Simple skills may not need optimization
- Focus on principles over exact numbers

---

## Validation

See [validation/README.md](validation/README.md) for 6 token optimization criteria:

1. SKILL.md length appropriate (< 400 strict, < 300 ideal)
2. Large content externalized (> 100 lines)
3. Supporting files documented (README.md explain)
4. Clear navigation (SKILL.md points to supporting files with Read instructions)
5. Token efficiency measured (ratio documented)
6. Follows patterns (architecture consistent)

---

## Cross-References

- **[UNIVERSAL.md](UNIVERSAL.md)** - Token techniques summary
- **[validation/README.md](validation/README.md)** - Complete checklist
- **[examples/token-optimization-case-study.md](examples/token-optimization-case-study.md)** - Detailed react-expert analysis

---

**Key Takeaway:** Design skills for efficiency from the start. Measure results. Iterate on principles, not just numbers.
