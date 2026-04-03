# Writer Skills Guide

## What Are Writer Skills?

Writer skills guide creation of documentation, guides, tutorials, and other content with audience-aware, structure-focused, quality-driven approaches. They encode knowledge about writing effective documentation for specific audiences and content types.

**Examples of Writer Skills:**
- **api-docs** - API documentation, SDK guides, developer-focused technical content
- **user-docs** - End-user documentation, tutorials, how-to articles for non-technical users
- **pr-writer** - Pull request descriptions with structured templates

**When to create writer skills:**
- Documentation is the primary output (guides, tutorials, references)
- Audience clarity critical (developers vs end-users vs reviewers)
- Structure and organization matter (templates, sections, patterns)
- Tone and style guidance needed (technical vs friendly vs professional)
- Quality criteria for writing (measurable standards)
- Content templates needed (API docs, tutorials, FAQs, etc.)

**Writer skills are NOT for:**
- Domain knowledge expertise (use expert skills instead)
- Syntax documentation (use CLI skills instead)
- Code generation (use expert skills with templates)

---

## Agent-Optimization for Writer Skills

Writer skills benefit from agent-optimization for content structure and quality criteria. See [AGENTIC.md](../AGENTIC.md) - Use Read tool when optimizing writer skills for content quality (provides complete 25-principle framework with decision criteria).

**Most valuable for writer skills:** #2, #7, #10, #11, #14, #17, #18, #23

**When to apply:**
- Content templates (exact sections and structure expected)
- Audience specifications (explicit characteristics and needs)
- Tone/style criteria (measurable attributes and standards)
- Quality checklists (specific verification criteria)

**Pattern examples:** See [patterns/README.md](../patterns/README.md) - Use Read tool when applying agent-optimization patterns (provides 20+ categorized examples: content templates, examples sections, anti-patterns)
- Category 5: Examples Sections (positive + negative)
- Category 8: Content Templates (structured output)
- Category 9: Anti-Patterns (before/after comparisons)

**Complete framework:** [AGENTIC.md](../AGENTIC.md) (25 principles), [patterns/README.md](../patterns/README.md) (20+ examples)

---

## Core Principles

### 1. Audience First

**What it means**: Know who you're writing for and adapt everything to their needs.

**Why it matters**: Technical documentation for developers requires different language, depth, and style than guides for non-technical end-users. Writing for the wrong audience creates confusion and frustration.

**How to implement:**
- Define target audience clearly (role, technical level, prior knowledge)
- Specify technical level (beginner, intermediate, advanced, expert)
- State prior knowledge assumptions explicitly
- Provide tone and voice guidelines (formal, friendly, encouraging, professional)
- Note accessibility requirements (reading level, language complexity)
- Consider audience goals (what they're trying to accomplish)
- Address audience pain points (what confuses or frustrates them)

**Example from api-docs:**
```markdown
## Core Principles

### 1. Developer-First Mindset
Write for your audience. Anticipate developer questions, understand their pain points,
and provide the information they need to be successful. Developers want to get started
quickly and solve problems efficiently.
```

**Example from user-docs:**
```markdown
## Core Principles

### 1. Empathize with the User
Write from the user's perspective. Understand their goals, pain points, and level of
technical knowledge. Ask: "What is the user trying to accomplish?" not "What features
does this product have?"
```

### 2. Structure Matters

**What it means**: Clear organization, predictable patterns, and logical information hierarchy.

**Why it matters**: Well-structured content helps readers find information quickly, understand relationships between concepts, and navigate documentation efficiently. Poor structure forces readers to read everything to find what they need.

**How to implement:**
- Provide content templates for each document type (tutorial, API reference, troubleshooting guide)
- Define section organization (what sections appear in what order)
- Establish information hierarchy (overview → details → examples → troubleshooting)
- Use consistent patterns across similar content types
- Guide progressive disclosure (start simple, add complexity gradually)
- Make content scannable (headings, bullets, short paragraphs)
- Include clear navigation aids (table of contents, breadcrumbs, cross-links)

**Example from pr-writer:**
```markdown
## PR Description Framework

### The "What, Why, How" Approach

**WHAT** - Summary of changes (required)
- High-level overview
- Reference related issues

**WHY** - Context and motivation (for non-obvious changes)
- Why is this necessary?
- What problem does it solve?

**HOW** - Implementation details (for complex changes)
- Key design decisions
- Areas needing scrutiny
```

**Example structure template from user-docs:**
```markdown
## Standard Tutorial Structure

1. **Overview** (2-3 sentences)
   - What will be learned
   - Who should read this
   - Prerequisites

2. **Step-by-Step Instructions**
   - Each step one task
   - Screenshots for UI
   - Expected results after each step

3. **Troubleshooting** (common issues)

4. **Next Steps** (where to go from here)
```

### 3. Clarity Over Cleverness

**What it means**: Simple, direct writing beats clever or complex prose every time.

**Why it matters**: Users come to documentation to find information quickly, not to be entertained or impressed. Complex language creates cognitive load and slows comprehension. If readers must re-read a sentence, it should be rewritten.

**How to implement:**
- Short sentences (15-20 words average, maximum 25 words)
- Simple words over complex alternatives ("use" not "utilize")
- Active voice preferred ("Click Save" not "The Save button should be clicked")
- Present tense for instructions ("Click" not "You should click")
- Concrete examples not abstract descriptions
- One idea per sentence
- No jargon without definitions
- Second person ("you") for instructions

**Example from user-docs:**
```markdown
### Use Simple Words

❌ Don't Use | ✅ Use Instead
---|---
utilize | use
facilitate | help
commence | start
prior to | before
in order to | to

### Simplify Sentence Structure

**❌ Bad (Complex):**
"In the event that you should encounter an error during the upload process, it is
recommended that you verify that the file size does not exceed the maximum allowable
limit before attempting to retry the operation."

**✅ Good (Simple):**
"If you see an error when uploading, check that your file is under 10MB. Then try again."
```

### 4. Examples Included

**What it means**: Show concrete examples for every concept, not just abstract descriptions.

**Why it matters**: Examples clarify abstract concepts, provide copy-paste starting points, and demonstrate proper usage. One well-chosen example is worth paragraphs of explanation.

**How to implement:**
- Include example for every significant concept
- Provide before/after examples showing improvement
- Show complete working examples (not fragments)
- Annotate examples with comments explaining key parts
- Cover multiple scenarios (simple, moderate, complex cases)
- Use real-world examples not toy examples
- Make examples copy-paste ready when possible

**Example from api-docs:**
```markdown
### 5. Code Samples & Examples

**Key elements:**
- **Multiple Languages**: Python, JavaScript/Node.js, Java, Go, Ruby, PHP, cURL
- **Complete Examples**: Fully functional, not just snippets
- **Idiomatic Code**: Follow language conventions and best practices
- **Comments**: Explain complex logic inline
- **Error Handling**: Show proper error handling patterns
- **Real-World Scenarios**: Practical use cases, not just toy examples
- **Copy-Paste Ready**: Developers should be able to copy and run immediately
```

### 5. Quality Criteria

**What it means**: Measurable, objective standards for good documentation.

**Why it matters**: Subjective guidance like "write well" or "make it clear" doesn't help. Specific, verifiable criteria ensure consistency and provide clear targets for review and improvement.

**How to implement:**
- Define what "good" looks like with specific attributes
- Create quality checklists with measurable items
- Specify review criteria (what to check during review)
- Include self-review process (how to review your own work)
- Provide examples showing different quality levels
- Make criteria verifiable (can answer yes/no or measure)

**Example quality checklist from user-docs:**
```markdown
## User Documentation Checklist

Before publishing, verify:

**Content Quality:**
- [ ] Written in plain language (8th grade level or below)
- [ ] Uses active voice and second person ("you")
- [ ] Sentences are short and clear (under 20 words)
- [ ] No jargon without explanation

**Completeness:**
- [ ] Prerequisites listed (if any)
- [ ] All steps included (nothing assumed)
- [ ] Expected results shown ("You should see...")
- [ ] Common errors or issues addressed
```

### 6. Format Templates

**What it means**: Reusable structures and patterns for common document types.

**Why it matters**: Templates ensure consistency, save time, and provide scaffolding that writers can fill in. They codify best practices and organizational patterns that have proven effective.

**How to implement:**
- Create template for each content type the skill handles
- Annotate templates with guidance in comments
- Provide multiple templates (basic, intermediate, advanced)
- Store templates in templates/ directory when complex
- Show examples of documents created using each template
- Include template selection guidance (when to use which)

**Example from api-docs:**
```markdown
## Common Documentation Deliverables

### API Reference
**Format:** Interactive HTML (Swagger UI, Redoc) or searchable docs site
**Content:** Complete endpoint reference with examples
**Audience:** Developers during integration

### Developer Guide
**Format:** Long-form documentation (Markdown, HTML)
**Content:** Concepts, architecture, best practices, advanced topics
**Audience:** Developers wanting deeper understanding

### Quick Start Tutorial
**Format:** Step-by-step guide with code
**Content:** Fastest path to first successful integration
**Audience:** New developers getting started
```

### 7. Iterative Quality

**What it means**: Documentation improves through review, testing, and iteration.

**Why it matters**: First drafts are rarely optimal. Testing with real users, incorporating feedback, and continuous improvement create documentation that truly serves its audience.

**How to implement:**
- Include self-review checklist (what to check yourself)
- Provide peer review guidance (what reviewers should look for)
- Describe user testing approach (how to test with target audience)
- Explain feedback incorporation process
- Recommend version history tracking
- Encourage continuous updates based on user questions

**Example from user-docs:**
```markdown
### 5. Review & Test with Users
- Technical review: Verify accuracy with product team
- User test: Have someone follow your instructions
- Read aloud: Catch awkward phrasing
- Check readability: Use Hemingway Editor (target grade 8)
- Verify all links work
- Check all screenshots are current
- Get feedback from customer support team
```

---

## Writer Skill Checklist

Use this comprehensive checklist when creating or reviewing writer skills:

### Audience Analysis (12 items)

- [ ] **Target audience clearly defined** - Specific role, context, technical level
- [ ] **Technical level specified** - Beginner, intermediate, advanced, or expert
- [ ] **Prior knowledge assumptions stated** - What readers should know before starting
- [ ] **Tone and voice guidelines provided** - How the writing should sound
- [ ] **Language complexity appropriate** - Matches audience technical level
- [ ] **Jargon handling specified** - When to avoid, define, or use technical terms
- [ ] **Cultural considerations noted** - Language, examples, idioms appropriate
- [ ] **Accessibility requirements addressed** - Reading level, screen readers, etc.
- [ ] **Reading level appropriate** - Verified with readability tools
- [ ] **Audience goals understood** - What they're trying to accomplish
- [ ] **Audience pain points addressed** - Common questions, frustrations handled
- [ ] **Multiple audience segments handled** - If skill serves different reader types

### Structure & Organization (15 items)

- [ ] **Content templates provided** - For each document type the skill creates
- [ ] **Section organization clear** - Defined order and purpose of sections
- [ ] **Information hierarchy defined** - Overview, details, examples, troubleshooting
- [ ] **Navigation structure specified** - How readers move through content
- [ ] **Progressive disclosure used** - Start simple, add complexity gradually
- [ ] **Headings descriptive and scannable** - Clear, specific, searchable
- [ ] **Lists vs paragraphs used appropriately** - Lists for scanability, paragraphs for narrative
- [ ] **Visual hierarchy clear** - Heading levels, emphasis, formatting consistent
- [ ] **Table of contents when appropriate** - For longer documents
- [ ] **Cross-references clear** - Links between related sections work
- [ ] **Introduction sets expectations** - What reader will learn/accomplish
- [ ] **Conclusion summarizes key points** - Reinforces main takeaways
- [ ] **Related content linked** - "See also", "Next steps" sections
- [ ] **Chunking appropriate** - Sections not too long or too short
- [ ] **Flow logical and intuitive** - Natural reading progression

### Writing Quality (18 items)

- [ ] **Style guide followed** - If one exists for this content type
- [ ] **Grammar correct** - No grammatical errors
- [ ] **Spelling correct** - No spelling errors, consistent spelling choices
- [ ] **Sentence length appropriate** - 15-20 words average, max 25
- [ ] **Active voice preferred** - "Click Save" not "Save should be clicked"
- [ ] **Present tense for instructions** - "Click" not "You should click"
- [ ] **Second person for instructions** - "You" not "one" or "the user"
- [ ] **Terminology consistent** - Same term for same concept throughout
- [ ] **Terms defined on first use** - Technical terms explained when introduced
- [ ] **Acronyms spelled out on first use** - "API (Application Programming Interface)"
- [ ] **Simple words preferred** - "Use" not "utilize", "help" not "facilitate"
- [ ] **Concrete examples not abstractions** - Show specific instances
- [ ] **Screenshots/diagrams when helpful** - Visual aids for complex concepts
- [ ] **Code samples formatted correctly** - Syntax highlighting, proper indentation
- [ ] **Links valid and relevant** - All hyperlinks work and add value
- [ ] **Metadata complete** - Title, description, keywords if applicable
- [ ] **Version information included** - If content is version-specific
- [ ] **Date included** - For time-sensitive content

### Templates & Examples (10 items)

- [ ] **Templates provided for each content type** - API doc, tutorial, guide, etc.
- [ ] **Templates annotated** - Comments/guidance explain each section
- [ ] **Multiple template complexity levels** - Simple, moderate, comprehensive
- [ ] **Before/after examples** - Show improvement or wrong → right
- [ ] **Complete examples** - Working, copy-paste ready when applicable
- [ ] **Multiple scenarios covered** - Different use cases shown
- [ ] **Real-world examples** - Practical, not toy examples
- [ ] **Examples tested** - Confirmed working/accurate
- [ ] **Examples current** - Follow 2025 best practices
- [ ] **Example quality meets criteria** - Examples demonstrate quality standards

---

## File Structure Patterns

See [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool when designing file structure (File Structure Patterns section provides 6 patterns: minimal/simple/template-based/script-powered/complex/sub-folder with token counts and decision criteria).

**Writer-specific variations:**

**Simple** (100-200 lines): Single SKILL.md
- Single content type (e.g., PR descriptions), inline templates
- Example: pr-writer (~278 lines)

**Moderate** (200-400 lines): SKILL.md + EXAMPLES.md + templates/
- Multiple content types (tutorials, guides, references)
- Example pattern: api-docs or user-docs style

**Comprehensive** (400+ lines): SKILL.md + STYLE-GUIDE.md + TEMPLATES.md + EXAMPLES.md + REFERENCE.md + templates/
- Many content types (6+), extensive style guidance, large template library

---

## Description Patterns

See [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool when writing descriptions (Description Engineering section provides WHAT + WHEN formula, length guidelines, keyword optimization, and 10+ examples).

### Writer-Specific Adaptations

**Formula:**
```
[Expert language] [content types] [for/with audience/features]. Use when [action 1], [action 2], [action 3], or [action 4].
```

**Key characteristics:**
- Content types listed explicitly (API docs, tutorials, guides)
- Audience mentioned when critical (developers, end-users, reviewers)
- Quality attributes included (well-structured, clear, comprehensive)
- Action-oriented triggers (creating, writing, preparing, improving)
- Length: 100-500 chars (ideal: 200-400), same as all skill types

**Examples:**

**api-docs** (233 chars):
```yaml
description: Expert knowledge for creating API documentation, SDK guides, and developer-focused technical content including REST APIs, GraphQL endpoints, OpenAPI specifications, code samples, and authentication flows.
```
7 content types, developer-focused audience, 233 chars

**user-docs** (237 chars):
```yaml
description: Expert knowledge for creating end-user documentation including user guides, tutorials, how-to articles, knowledge base content, troubleshooting guides, onboarding materials, and FAQs for non-technical users.
```
7 content types, non-technical audience explicit, 237 chars

**pr-writer** (250 chars):
```yaml
description: Creates well-structured pull requests with best practices for titles, descriptions, testing, and documentation. Use when creating PRs, writing PR descriptions, preparing code for review, or improving PR quality for GitHub/GitLab workflows.
```
Quality attribute ("well-structured"), 4 explicit triggers, 250 chars

---

## Creation Workflow

Follow these steps when creating a writer skill:

### 1. Identify Content Types (10 min)
- What documentation will this skill create?
- List all document types (tutorials, API docs, guides, FAQs, etc.)
- Group related types if many (e.g., "user guides" covers how-to, tutorial, walkthrough)
- Verify types are distinct enough to warrant templates

### 2. Define Audience (10 min)
- Who reads this content? (developers, end-users, administrators, reviewers)
- What's their technical level? (beginner, intermediate, advanced)
- What prior knowledge do they have?
- What are they trying to accomplish?
- What frustrates or confuses them?

### 3. Establish Structure Templates (20 min)
- Create template for each major content type
- Define sections and their order
- Note what goes in each section
- Provide example length guidance (2-3 sentences, 100-200 words, etc.)
- Include optional vs required sections

### 4. Set Quality Criteria (15 min)
- What makes this documentation "good"?
- Create measurable standards (reading level, sentence length, etc.)
- List what must be present (examples, screenshots, etc.)
- Define what to avoid (jargon, passive voice, etc.)
- Make criteria verifiable (yes/no checkboxes)

### 5. Provide Tone Guidance (10 min)
- How should this content sound?
- Formal vs friendly vs professional vs encouraging
- Technical depth appropriate for audience
- Example sentences showing desired tone
- Common tone mistakes to avoid

### 6. Create Templates (20 min)
- Write out full template for each content type
- Annotate with guidance comments
- Include multiple complexity levels if needed
- Test template by filling it out yourself
- Ensure templates are copy-paste ready

### 7. Gather Examples (20 min)
- Collect before/after examples
- Show different quality levels (poor, good, excellent)
- Include real-world samples (with permission)
- Annotate examples to highlight key features
- Cover multiple scenarios

### 8. Build Checklist (15 min)
- Convert quality criteria to checklist format
- Organize by category (audience, structure, quality, templates)
- Aim for 40-55 items total
- Make each item specific and verifiable
- Include "Why it matters" context for key items

### 9. Organize Files (10 min)
- Determine structure (simple/moderate/comprehensive)
- Create file structure (mkdir, touch files)
- Decide what goes in SKILL.md vs separate files
- Plan @ references for external files

### 10. Write Description (15 min)
- List all content types clearly
- Mention audience if critical
- Include quality attributes
- Add explicit "Use when" triggers
- Aim for 200-400 chars (100-500 acceptable)
- Test discovery by checking keyword richness

### 11. Validate (20 min)
- Use @validation/README.md checklist
- Verify all 45-55 checklist items addressed
- Check all @ references point to existing files
- Test templates by filling them out
- Launch agent audit following claude-skill-builder post-change validation protocol

**Total time estimate:** 2.5-3 hours for comprehensive writer skill

---

## Examples Section

### api-docs - API Documentation Expert

**Key features:**
- **Audience:** Developers (technical, experienced)
- **Content types:** API reference, SDK guides, OpenAPI specs, authentication docs
- **Structure:** Endpoint documentation, code samples in multiple languages, troubleshooting
- **Quality criteria:** Technical accuracy, completeness, tested code examples
- **Tone:** Technical, precise, professional
- **File structure:** Single comprehensive SKILL.md with @ references

**Patterns to follow:**
- Clear audience definition (Developer-First Mindset)
- Multiple content deliverable types
- Emphasis on accuracy and testing
- Code examples as primary teaching tool

### user-docs - End-User Documentation Expert

**Key features:**
- **Audience:** Non-technical end-users
- **Content types:** User guides, tutorials, how-to articles, FAQs, troubleshooting
- **Structure:** Step-by-step instructions, screenshots, simple language
- **Quality criteria:** Clarity, accessibility, readability (8th grade level)
- **Tone:** Friendly, patient, encouraging
- **File structure:** Single comprehensive SKILL.md with @ references

**Patterns to follow:**
- Plain language guidelines with before/after examples
- Strong emphasis on simplicity (Clarity Above All)
- Visual communication (screenshots, diagrams)
- User testing and iteration

### pr-writer - Pull Request Creation

**Key features:**
- **Audience:** Code reviewers (technical)
- **Content type:** Pull request descriptions
- **Structure:** What/Why/How framework, structured sections
- **Quality criteria:** Completeness, clear communication, appropriate detail
- **Tone:** Professional, thorough, helpful
- **File structure:** Compact single file (~278 lines)

**Patterns to follow:**
- Clear structural templates (minimal, standard, comprehensive)
- Guidance on when to include optional sections
- Emphasis on reviewer experience (respect their time)
- Compact format for single content type

---

## Common Pitfalls

### ❌ What to Avoid

**Wrong audience assumptions:**
- Using technical jargon when writing for non-technical users
- Oversimplifying when writing for expert developers
- Not defining audience clearly in skill

**✓ What to do instead:**
- Define audience explicitly at start of skill
- Provide tone and language guidelines specific to audience
- Show examples of appropriate vs inappropriate language

---

**No structure guidance:**
- Describing content without providing organizational templates
- Vague "write good documentation" without structure
- Missing section organization and hierarchy

**✓ What to do instead:**
- Provide explicit templates for each content type
- Define section order and purpose
- Show example structures with annotations

---

**Abstract without concrete:**
- Explaining concepts without showing examples
- Describing principles without demonstrating application
- Theory without practice

**✓ What to do instead:**
- Include example for every major concept
- Provide before/after examples showing improvement
- Make examples copy-paste ready when applicable

---

**Missing quality criteria:**
- Subjective "make it good" without specifics
- No measurable standards
- Unclear success criteria

**✓ What to do instead:**
- Create specific, measurable quality criteria
- Provide verification checklist
- Define what "good" looks like objectively

---

**Clever over clear:**
- Complex sentences when simple would work
- Passive voice throughout
- Jargon without definitions

**✓ What to do instead:**
- Emphasize simple, direct writing
- Provide plain language guidelines
- Show before/after examples of clarity improvements

---

**No templates:**
- Users must start from scratch
- Inconsistent document organization
- No scaffolding provided

**✓ What to do instead:**
- Create template for each content type
- Provide multiple complexity levels
- Annotate templates with guidance

---

**Single quality level:**
- Only showing "perfect" examples
- No progression from basic to advanced
- Missing guidance on when to use what

**✓ What to do instead:**
- Show multiple quality levels (basic, good, excellent)
- Provide templates for different complexity needs
- Guide when to use simple vs comprehensive approaches

---

## See Also

**Universal guidance** (applies to all skill types):
- [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool for YAML frontmatter syntax, description formula, token optimization techniques, and @ reference guidance

**Validation and quality:**
- [validation/README.md](../validation/README.md) - Use Read tool for post-creation validation checklist and agent audit process

**Other skill types:**
- [expert/README.md](../expert/README.md) - Use Read tool when creating domain knowledge and investigation-based skills
- [cli/README.md](../cli/README.md) - Use Read tool when creating syntax and configuration-focused skills

**Cross-type scenarios:**
- If your skill combines documentation with investigation → Review both writer and expert guides
- If your skill documents syntax/configuration → Review both writer and CLI guides
- Hybrid skills can follow principles from multiple types
