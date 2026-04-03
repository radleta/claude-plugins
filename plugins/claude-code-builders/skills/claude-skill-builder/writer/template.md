# Writer Skill Template

This template provides a comprehensive structure for creating writer skills. Adapt sections based on your specific content types and needs.

---

## YAML Frontmatter

```yaml
---
name: your-skill-name
description: [Expert language] [content types] [for/with audience/features]. Use when [action 1], [action 2], [action 3], or [action 4].
---
```

**Naming:**
- Use kebab-case: `api-docs`, `user-guides`, `technical-writing`
- Be specific but not overly long

**Description guidelines:**
- List content types explicitly (API docs, tutorials, guides)
- Mention audience if critical (developers, end-users)
- Include quality attributes (well-structured, comprehensive, clear)
- Add explicit "Use when" triggers (creating, writing, preparing)
- Length: 100-500 characters (ideal: 200-400), same as all skill types

---

## Main Skill Introduction

```markdown
# [Skill Name] - [Brief Description]

I am an expert in creating [type of content] that [outcome/benefit]. I provide
comprehensive knowledge about [domain] best practices, [key focus areas], and [deliverables].
```

**Tips:**
- Keep introduction to 2-3 sentences
- Focus on outcomes and benefits
- Mention primary audience
- Set expectations for what skill provides

---

## Core Principles Section

```markdown
## Core Principles

### 1. [Principle Name - Audience/Structure/Quality Related]

**What it means**: [Clear definition in one sentence]

**Why it matters**: [Why this principle is important for this content type]

**How to implement**:
- [Specific action or approach]
- [Another specific action]
- [Concrete guidance point]
- [Implementation detail]

**Example from [reference skill or real-world]:**
\`\`\`markdown
[Show concrete example demonstrating the principle]
\`\`\`

### 2. [Second Principle]

[Same structure as above]

### 3. [Third Principle]

[Same structure as above]

[Continue for 5-7 total principles]
```

**Key principles to cover for writer skills:**
1. **Audience First** - Understanding and writing for target readers
2. **Structure Matters** - Organization, templates, predictable patterns
3. **Clarity Over Cleverness** - Simple, direct writing
4. **Examples Included** - Show, don't just tell
5. **Quality Criteria** - Measurable standards
6. **Format Templates** - Reusable structures
7. **Iterative Quality** - Review, test, improve

**Tips:**
- Each principle needs all four parts (what, why, how, example)
- "How to implement" should be specific actionable items (3-6 bullets)
- Examples should be concrete, not abstract
- Reference existing skills when possible
- Order principles from most to least fundamental

---

## Audience Analysis Section

```markdown
## Target Audience

**Primary Audience**: [Role/type, e.g., "End-users (non-technical)"]
- [Technical level description]
- [What they're trying to accomplish]
- [What knowledge they have/lack]
- [Common pain points or questions]

**Secondary Audience**: [If applicable]
- [Similar breakdown as primary]

**Writing Guidelines for This Audience:**

### Tone & Voice
- **Tone**: [Formal/Friendly/Professional/Encouraging/Technical]
- **Voice**: [First person/Second person/Third person]
- **Style**: [Conversational/Academic/Instructional]

### Language Complexity
- **Reading Level**: [e.g., "8th grade", "College level", "Technical expert"]
- **Sentence Length**: [Average and maximum, e.g., "15-20 words avg, 25 max"]
- **Vocabulary**: [Simple/Technical/Domain-specific]

### Jargon Handling
- **Approach**: [Avoid/Define on first use/Use freely with context]
- **Technical Terms**: [How to handle specialized vocabulary]
- **Acronyms**: [Always spell out/Spell out first use/Assume known]

### Cultural Considerations
- [Any cultural or accessibility notes]
- [Language considerations]
- [Example sensitivity]
```

**Tips:**
- Be specific about technical level (not just "intermediate")
- Focus on what audience is trying to accomplish, not just who they are
- Provide clear tone guidance with examples
- Specify measurable language complexity (reading level tools available)

---

## Content Structure Templates Section

```markdown
## Content Types & Templates

This skill handles [number] primary content types:

### 1. [Content Type Name, e.g., "Tutorial"]

**Purpose**: [What this content type accomplishes]
**Audience**: [Who reads this type]
**Length**: [Typical length range, e.g., "500-1500 words, 5-15 steps"]

**Standard Structure:**
\`\`\`markdown
# [Clear, Task-Based Title]

[Brief overview: What reader will accomplish and why it's useful - 2-3 sentences]

**Time to complete:** [Realistic estimate]
**Prerequisites:** [What's needed before starting]
**Difficulty:** [Beginner/Intermediate/Advanced]

## Step 1: [First Action/Task]

[Clear instruction paragraph]

[Screenshot/diagram if UI-related]

**Expected result:** [What reader should see after this step]

## Step 2: [Second Action/Task]

[Continue pattern...]

## What You Accomplished

[Summary of what was achieved - 2-3 sentences]

## Troubleshooting

[Common issues and solutions]

## Next Steps

- [Link to related content]
- [Suggestion for what to learn next]
\`\`\`

**Key characteristics:**
- [ ] Task-based title (starts with "How to...")
- [ ] Clear learning outcome stated upfront
- [ ] Prerequisites listed explicitly
- [ ] Steps are sequential and complete
- [ ] Each step shows expected result
- [ ] Troubleshooting section included
- [ ] Next steps provided

**Quality checklist for this type:**
- [ ] [Quality criterion 1]
- [ ] [Quality criterion 2]
- [ ] [Quality criterion 3]

### 2. [Second Content Type]

[Same structure as above]

### 3. [Additional Content Types]

[Continue for each major content type]
```

**Tips:**
- Provide complete template with all sections
- Use comments/annotations to explain each section purpose
- Include "expected result" or success criteria
- Show section length guidance (words, sentences, steps)
- Provide quality checklist specific to that content type
- Order from most to least common/important

---

## Quality Criteria Section

```markdown
## Quality Standards

### Excellent [Content Type] Documentation Includes:

**Audience Appropriateness:**
- [ ] Written at appropriate technical level for target audience
- [ ] Tone matches audience expectations
- [ ] Prior knowledge assumptions stated
- [ ] Jargon handled per guidelines

**Structural Quality:**
- [ ] Follows standard template for content type
- [ ] Sections in logical order
- [ ] Clear information hierarchy
- [ ] Scannable (headings, bullets, white space)
- [ ] Appropriate length for content type

**Writing Quality:**
- [ ] Simple, clear sentences (avg 15-20 words)
- [ ] Active voice preferred
- [ ] Present tense for instructions
- [ ] Consistent terminology
- [ ] Grammar and spelling correct

**Completeness:**
- [ ] All required sections present
- [ ] Examples included where helpful
- [ ] Screenshots/diagrams for complex concepts
- [ ] Prerequisites stated
- [ ] Expected outcomes clear
- [ ] Troubleshooting for common issues
- [ ] Next steps or related content linked

**Accuracy:**
- [ ] Information verified and current
- [ ] Examples tested and working
- [ ] Links valid and relevant
- [ ] Version information included if applicable

**Findability:**
- [ ] Descriptive, searchable title
- [ ] Clear metadata (keywords, description)
- [ ] Properly categorized
- [ ] Cross-linked from related content

### Measuring Quality

**Readability Tools:**
- Hemingway Editor: [Target score, e.g., "Grade 8 or below"]
- Flesch Reading Ease: [Target score, e.g., "60-70 (Plain English)"]

**Review Process:**
1. **Self-review**: Use quality checklist above
2. **Technical review**: Verify accuracy with subject matter experts
3. **User testing**: Have target audience follow instructions
4. **Editorial review**: Check style, grammar, consistency
```

**Tips:**
- Make criteria specific and verifiable (yes/no checkboxes)
- Organize by category for easy scanning
- Include objective measures (reading level scores)
- Provide review process steps
- Cover all aspects: audience, structure, writing, completeness, accuracy, findability

---

## Common Deliverables Section

```markdown
## Common Documentation Deliverables

This section describes the typical outputs when using this skill.

### [Deliverable Type 1]
**Format:** [File format, presentation method]
**Content:** [What it contains]
**Length:** [Typical length]
**Audience:** [Primary readers]
**Use case:** [When to create this type]

### [Deliverable Type 2]
[Same structure]

[Continue for each major deliverable type]
```

**Examples:**
- API Reference (format, content, length, audience, use case)
- Tutorial (format, content, length, audience, use case)
- Quick Reference Guide (format, content, length, audience, use case)

---

## Standard Workflow Section

```markdown
## Standard Workflow

Follow this process when creating [content type]:

### 1. Understand the [Subject/Feature/Topic] ([Time estimate])

**What to do:**
- [Specific action or investigation]
- [Another action]
- [Investigation task]

**Why it matters:** [Rationale for this step]

**Deliverable:** [What you should have after this step]

### 2. [Second Phase]

[Same structure]

### 3. [Third Phase]

[Same structure]

[Continue for 6-10 workflow steps]

### [Final Step]: Publish & Maintain

**What to do:**
- [Publishing actions]
- [Maintenance tasks]
- [Monitoring and updates]

**Why it matters:** Documentation is never truly "done"
```

**Typical workflow phases for documentation:**
1. Understand the subject/audience/need
2. Research and gather information
3. Design information architecture/structure
4. Draft content following templates
5. Add examples and visuals
6. Technical and editorial review
7. User testing and feedback
8. Publish and establish maintenance process

**Tips:**
- Make steps actionable and specific
- Include time estimates for each phase
- Explain why each step matters
- Specify deliverable for each step
- Order steps logically (can't skip or reorder)

---

## Comprehensive Checklist Section

```markdown
## [Content Type] Creation Checklist

Before publishing [content type], verify all applicable items:

### Audience & Clarity ([number] items)

- [ ] **[Specific verifiable criterion]** - [Brief why it matters]
- [ ] **[Another criterion]**
- [ ] **[Another criterion]**
[12-15 items related to audience and clarity]

### Structure & Organization ([number] items)

- [ ] **[Structure criterion]**
- [ ] **[Organization criterion]**
[12-15 items related to structure]

### Writing Quality ([number] items)

- [ ] **[Quality criterion]**
- [ ] **[Style criterion]**
[15-20 items related to writing quality]

### Completeness ([number] items)

- [ ] **[Completeness criterion]**
[8-10 items related to completeness]

### Accuracy & Currency ([number] items)

- [ ] **[Accuracy criterion]**
[5-8 items related to accuracy]
```

**Tips:**
- Aim for 45-55 total items for comprehensive writer skill
- Each item should be specific and verifiable (yes/no answer)
- Use bold for the criterion, regular text for context
- Organize into 4-6 logical categories
- Make items actionable (can be checked/verified)

---

## Visual Communication Section (If Applicable)

```markdown
## Visual Communication Guidelines

[Include this section if content type uses screenshots, diagrams, videos, etc.]

### Screenshots

**When to include:**
- [Scenario 1, e.g., "Every UI interaction step"]
- [Scenario 2]
- [Scenario 3]

**Best practices:**
- **Timing**: Take screenshots after each UI change to keep current
- **Cropping**: Show only relevant UI, remove unnecessary context
- **Annotations**: Use arrows, boxes, numbers to highlight key elements
- **Quality**: Use high-resolution, clear images (2x retina when possible)
- **Alt Text**: Describe image content for accessibility
- **Consistency**: Same window size, same theme/settings for all screenshots

### Diagrams

**Types to use:**
- **Flowcharts**: [When to use]
- **Workflows**: [When to use]
- **System Diagrams**: [When to use]
- **Before/After**: [When to use]

**Tools**: [Recommended diagramming tools]

### Videos/GIFs

**When to create:**
- [Multi-step processes]
- [Complex workflows]
- [Interactive demonstrations]

**Best practices:**
- Keep under [duration limit]
- Add captions for accessibility
- Show cursor clearly
```

**Tips:**
- Only include if content type regularly uses visuals
- Provide specific guidance on when and how to use each visual type
- Include accessibility considerations (alt text, captions)
- Recommend specific tools
- Show examples of good vs poor visual communication

---

## Plain Language Guidelines Section (If Applicable)

```markdown
## Plain Language Guidelines

[Include this section if writing for non-technical audience]

### Use Simple Words

| ❌ Don't Use | ✅ Use Instead |
|-------------|----------------|
| utilize | use |
| facilitate | help |
| commence | start |
| terminate | end |
| prior to | before |
| subsequent to | after |
| in order to | to |
| due to the fact that | because |

### Simplify Sentence Structure

**❌ Bad (Complex):**
> "[Example of overly complex sentence with passive voice, jargon, and multiple clauses]"

**✅ Good (Simple):**
> "[Same idea expressed simply, actively, clearly]"

### Avoid Jargon

**❌ Bad:**
> "[Example with unnecessary jargon]"

**✅ Good:**
> "[Same idea with plain language or defined terms]"

### Use Active Voice

**❌ Passive:**
> "[Example in passive voice]"

**✅ Active:**
> "[Same idea in active voice]"

### Be Concise

**❌ Wordy:**
> "[Example with unnecessary words and phrases]"

**✅ Concise:**
> "[Same idea expressed concisely]"
```

**Tips:**
- Provide 5-10 word substitution pairs
- Show 3-5 before/after sentence examples
- Cover: complexity, jargon, voice, conciseness
- Make examples relevant to your content domain
- Reference readability tools (Hemingway Editor, Grammarly)

---

## Common Pitfalls Section

```markdown
## Common Pitfalls to Avoid

### ❌ [Pitfall Category 1]

**The mistake:** [Description of what people do wrong]

**Why it's bad:** [Why this creates problems]

**Example:**
\`\`\`
[Example of the mistake]
\`\`\`

**✓ What to do instead:** [Correct approach]

**Example:**
\`\`\`
[Example of correct approach]
\`\`\`

---

### ❌ [Pitfall Category 2]

[Same structure]

---

[Continue for 6-10 common pitfalls]
```

**Typical writer skill pitfalls:**
- Wrong audience assumptions (too technical or too simple)
- Feature-focused instead of task-focused language
- Missing steps or assuming knowledge
- Outdated screenshots or examples
- No confirmation of expected results
- Unclear or buried calls to action
- Inconsistent terminology
- Passive voice throughout
- No troubleshooting guidance

**Tips:**
- Start with ❌ to show the mistake clearly
- Explain why it's problematic
- Provide concrete example of the mistake
- Show ✓ correct approach with example
- Use horizontal rules to separate pitfalls visually

---

## Key Reminders Section

```markdown
## Key Reminders

When creating [content type]:

1. **[Most important reminder]** - [Brief elaboration]
2. **[Second reminder]** - [Brief elaboration]
3. **[Third reminder]** - [Brief elaboration]
4. **[Fourth reminder]** - [Brief elaboration]
5. **[Fifth reminder]** - [Brief elaboration]
6. **[Sixth reminder]** - [Brief elaboration]
7. **[Seventh reminder]** - [Brief elaboration]
8. **[Eighth reminder]** - [Brief elaboration]
```

**Tips:**
- Keep to 6-10 key reminders
- Order by importance (most critical first)
- Make each memorable and actionable
- Keep elaboration to one line
- These should be the "golden rules" for this content type

**Examples:**
- "Write for your audience, not for yourself"
- "Show with examples, don't just tell"
- "Test by doing - follow your own instructions"
- "Keep it current - update when product changes"
- "Use plain language - 8th grade reading level"

---

## Additional Resources Section (If Applicable)

```markdown
## Additional Resources

For templates, examples, and reference materials, see:
- **@EXAMPLES.md** - [What's in this file, e.g., "Tutorial templates, KB article examples"]
- **@REFERENCE.md** - [What's in this file, e.g., "Detailed checklists, style guides"]
- **@TEMPLATES.md** - [What's in this file, e.g., "Complete templates for all content types"]

**External resources:**
- [Tool name]: [What it's for, URL]
- [Style guide name]: [What it's for, URL]
- [Reference]: [What it's for, URL]

**When to use this skill:**
Invoke this skill when [scenario 1], [scenario 2], [scenario 3], or [scenario 4].
```

**Tips:**
- Only include if you have separate files (@EXAMPLES.md, etc.)
- Describe what's in each external file
- Link to relevant external resources (style guides, tools)
- End with explicit "When to use" scenarios
- Make @ references match actual files you'll create

---

## Template Usage Notes

### Sections to Always Include:
1. YAML frontmatter
2. Main introduction
3. Core principles (5-7 principles)
4. Audience analysis
5. Content structure templates
6. Quality criteria
7. Workflow
8. Comprehensive checklist (45-55 items)
9. Common pitfalls (6-10)
10. Key reminders (6-10)

### Sections to Include When Applicable:
- Visual communication guidelines (if content uses images/diagrams)
- Plain language guidelines (if non-technical audience)
- Common deliverables (if multiple output types)
- Additional resources (if using @ references)

### Customization Tips:
- Replace `[Content Type]` with your specific type (Tutorial, API Documentation, etc.)
- Adapt audience section to your specific readers
- Create templates for YOUR content types (don't just copy examples)
- Make checklists specific to your domain
- Provide examples from your actual content area

### File Organization:
- **Simple skill**: All in SKILL.md (100-200 lines)
- **Moderate skill**: SKILL.md + templates/ directory (200-400 lines)
- **Comprehensive skill**: SKILL.md + EXAMPLES.md + REFERENCE.md + templates/ (400+ lines)
