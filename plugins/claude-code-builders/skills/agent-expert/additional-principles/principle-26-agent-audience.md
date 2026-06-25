---
tags: [agent-expert/additional-principles]
summary: "Principle #26: Design for Agent Audience — executable protocols over conversational prose; structure over narrative for agent-consumed instructions"
---

# Principle #26: Design for Agent Audience, Not Human Readers

**Category:** Meta-Architecture / Audience Alignment
**Priority:** ALWAYS APPLY (for agent-consumed instructions)
**Complexity Cost:** Medium (requires mindset shift)

**What it means:**
- Instructions consumed by agents should be written FOR agents, not humans
- Users will never directly read most agent instructions (skills, CLAUDE.md, slash commands)
- Use executable protocols instead of conversational examples
- Use decision logic instead of motivational language
- Agent pattern-matching works on structure, not narrative

**When to apply:**
- Writing Claude Code skills (SKILL.md files)
- Writing CLAUDE.md instructions
- Writing slash command prompts (.claude/commands/*.md)
- Writing any agent-consumed instructions or protocols

**When NOT to apply:**
- User-facing documentation (README.md for end users)
- API documentation for human developers
- Tutorials and guides intended for people to read
- Marketing or explanatory content

**How to apply:**

**1. Replace conversational prompts with executable protocols:**

```markdown
❌ Human-Oriented:
## Ready to Build?

Tell me:
- What domain or purpose for the skill?
- What should it help you do?

I'll guide you through creating a production-ready skill!

✅ Agent-Oriented:
## Skill Creation Protocol

<workflow type="sequential">
  <step id="gather-requirements" order="first">
    <description>Gather skill requirements from user</description>

    <required-information>
      <item priority="critical">Domain or purpose</item>
      <item priority="critical">Use cases</item>
      <item priority="high">Constraints</item>
    </required-information>

    <actions>
      <action>Request missing critical information from user</action>
      <action>Confirm understanding with user</action>
    </actions>

    <acceptance-criteria>
      <criterion>Domain clearly identified</criterion>
      <criterion>At least 2 use cases documented</criterion>
    </acceptance-criteria>

    <blocks>determine-type</blocks>
  </step>
</workflow>
```

**2. Replace "quick reference" lists with loading protocols:**

```markdown
❌ Human-Oriented:
## Quick Reference

Here are the available files:
- UNIVERSAL.md - Universal principles
- expert/README.md - Expert skill guidance
- validation/README.md - Validation checklists

✅ Agent-Oriented:
## File Loading Protocol

<loading-decision>
  <trigger>User requests skill creation</trigger>

  <required-files>
    <file path="UNIVERSAL.md">
      <load-when>Creating first skill of any type</load-when>
      <contains>YAML requirements, description formula</contains>
      <outcome>Understand universal skill requirements</outcome>
    </file>

    <file path="expert/README.md">
      <load-when>Skill type determined as expert</load-when>
      <contains>Investigation protocols, checklists</contains>
      <outcome>Apply expert skill patterns</outcome>
    </file>
  </required-files>
</loading-decision>
```

**3. Replace conversational examples with pattern-matching logic:**

```markdown
❌ Human-Oriented:
## How to Use This Skill

**Tell me what you need:**

"Create a skill for [domain]" → I'll detect type and create it
"Validate this skill" → I'll run validation

✅ Agent-Oriented:
## Request Pattern Matching

<request-patterns>
  <pattern type="skill-creation">
    <triggers>
      <keyword>create</keyword>
      <keyword>skill</keyword>
      <context>domain mentioned</context>
    </triggers>
    <execution>
      <step>Determine skill type from domain</step>
      <step>Load UNIVERSAL.md</step>
      <step>Load [type]/README.md</step>
      <step>Execute creation workflow</step>
    </execution>
  </pattern>

  <pattern type="skill-validation">
    <triggers>
      <keyword>validate</keyword>
      <keyword>skill</keyword>
    </triggers>
    <execution>
      <step>Load validation/README.md</step>
      <step>Apply validation checklist</step>
      <step>Launch validation agent</step>
    </execution>
  </pattern>
</request-patterns>
```

**Why it matters:**

| Human-Oriented Writing | Agent-Oriented Writing |
|------------------------|------------------------|
| "Ready to build?" | `<workflow>` with explicit steps |
| "Tell me what you need" | `<required-information>` with priorities |
| "I'll guide you through..." | `<execution>` with sequential actions |
| "Here's a quick reference" | `<loading-decision>` with when-to-load rules |
| Example phrases users might say | `<request-patterns>` with trigger keywords |
| Friendly, motivational | Structured, executable |
| Works for humans reading docs | Works for agents executing instructions |

**Common mistakes to avoid:**

```markdown
❌ "You might want to validate your skill when done"
✅ "After skill creation completes: Load validation/README.md, execute validation protocol"

❌ "Here are some examples of what you can say:"
✅ "<request-patterns> with trigger keywords and execution logic"

❌ Section heading: "Let's Get Started!"
✅ Section heading: "Initialization Protocol" or "Workflow Entry Point"

❌ "Feel free to ask me questions if you're unsure"
✅ "<clarification-protocol> Request missing required-information items before proceeding"
```

**Trade-offs:**

- **Pro:** Higher execution reliability, clearer decision logic, better token efficiency
- **Pro:** Agents pattern-match on structure more reliably than narrative
- **Pro:** Reduces ambiguity and increases consistent behavior
- **Con:** Less friendly for humans who browse skill files (rare - users don't read skills)
- **Con:** Requires more upfront design (creating protocols vs writing conversationally)

**Verdict:** For agent-consumed instructions (skills, CLAUDE.md, slash commands), optimize for agent execution over human friendliness. But remember: structured formats are a tool, not a religion. Use XML when it adds clarity (complex workflows, multi-branch decisions). Use plain markdown when it's sufficient (linear steps, simple checklists). The goal is *unambiguous, executable instructions* — the format that achieves that most concisely wins.
