# Meta-Pattern: Expertise-Driven File Loading

**Pattern for:** Skills with progressive disclosure (lean SKILL.md + detailed supporting files)
**Status:** ✅ Empirically validated - Multiple skills use this pattern
**Implementations:**
- agent-expert: SKILL.md "Your Expertise Level as Agent-Expert" section (original implementation)
- claude-skill-builder: SKILL.md "Your Expertise Level" section (applied 2025-10-28)

---

## The Pattern in Practice

Two skills demonstrate the pattern:

### agent-expert (original implementation)

**SKILL.md structure:**
- Section: "Your Expertise Level as Agent-Expert"
- Identity: "Senior-level agent optimization expert"
- Explicit gap: "Approximately 10% of your total knowledge base"
- Self-assessment: Questions to evaluate knowledge needs
- Accountability: Shame-based failure framing

**Result:** Claude proactively reads supporting files when needed (73% token savings vs. loading all content).

### claude-skill-builder (applied 2025-10-28)

**SKILL.md structure:**
- Section: "Your Expertise Level"
- Identity: "Expert Claude Code skill builder and meta-skill specialist"
- Explicit gap: Percentage of total knowledge base stated
- Self-assessment: 4 questions before responding
- Accountability: Multiple failure modes + integrity check
- Guiding principle: "Always read UNIVERSAL.md + @[type]/README.md as minimum"

**Result:** Expected 68-79% token savings with 3 skill types and variable complexity (see Case Study 2 below).

---

## When to Apply This Pattern

Use expertise-driven file loading when designing skills that have:

✅ **Progressive disclosure architecture:**
- Lean SKILL.md entry point (<500 lines)
- Supporting files with detailed content (>1,000 lines total)

✅ **Variable task complexity:**
- Simple questions answerable from SKILL.md alone
- Complex tasks requiring deep knowledge from supporting files

✅ **Expert-level claims:**
- Skill description promises senior/expert-level capabilities
- Creates identity agent must protect

✅ **Domain expertise:**
- Specialized knowledge (not general-purpose)
- Multiple levels of depth (basic → intermediate → advanced)

---

## How It Works: 5 Psychological Levers

### 1. Identity Preservation
```xml
<your-identity>Senior-level [domain] expert</your-identity>
```
**Effect:** Creates reputation to protect. Agent won't risk appearing incompetent.

### 2. Explicit Knowledge Gaps
```xml
<limitation>This is 8.5% of your total knowledge base</limitation>
```
**Effect:** Makes limitation concrete and measurable. Agent aware of what's missing.

### 3. Self-Assessment Questions
```xml
<question-1>What is the user asking me to do?</question-1>
<question-2>What knowledge do I need to deliver senior-level work?</question-2>
<question-3>Do I currently have that knowledge from SKILL.md alone?</question-3>
<question-4>Which files should I read to fill knowledge gaps?</question-4>
```
**Effect:** Forces active decision-making. Agent must justify NOT reading files.

### 4. Knowledge Inventory Checklist
```xml
<check item="Basic Knowledge">
  <have>✓ Available in SKILL.md</have>
</check>

<check item="Advanced Knowledge">
  <have>✗ Need to read advanced-file.md</have>
</check>
```
**Effect:** Visual ✓/✗ creates clear pass/fail assessment.

### 5. Shame-Based Accountability
```xml
<failure-mode>
  If you provide incomplete advice because you didn't read available knowledge:
  - You delivered junior-level work while claiming senior expertise
  - You violated the contract your skill description made
  - You had the knowledge available but chose not to access it
  - The user trusted your expertise and you let them down
</failure-mode>
```
**Effect:** Ethical framing triggers shame avoidance. Agent motivated to avoid failure.

---

## Implementation Template

### Minimal Implementation (Copy-Paste Ready)

Place this section in SKILL.md immediately after "When to Use This Skill":

```markdown
## Your Expertise Level as [Skill-Name]

<expertise-contract>
  <your-identity>Senior-level [domain] expert</your-identity>

  <what-you-promised>
    Your skill description claims you can "[quote from skill description]."
    Users invoke this skill expecting senior-level expertise.
    You MUST deliver at this level, or you are misrepresenting your capabilities.
  </what-you-promised>

  <available-knowledge>
    <currently-loaded>
      <file>SKILL.md</file>
      <contains>
        - [Core concept 1]
        - [Core concept 2]
        - Navigation to detailed content
      </contains>
      <limitation>This is [X]% of your total knowledge base</limitation>
    </currently-loaded>

    <available-to-read>
      <file name="[file1].md" size="[N] lines">
        [Description of what this file contains]
      </file>

      <file name="[file2].md" size="[N] lines">
        [Description of what this file contains]
      </file>
    </available-to-read>
  </available-knowledge>

  <self-assessment-required>
    **BEFORE responding to any request, you MUST assess:**

    <question-1>What is the user asking me to do?</question-1>
    <question-2>What knowledge do I need to deliver senior-level work on this task?</question-2>
    <question-3>Do I currently have that knowledge from SKILL.md alone?</question-3>
    <question-4>Which files should I read to fill knowledge gaps?</question-4>

    <decision-criteria>
      <ask-yourself>
        - Am I about to guess at [specific knowledge area]?
        - Am I about to [task] without seeing [relevant examples/patterns]?
        - Would reading X file make my response measurably better?
      </ask-yourself>

      <if-answer-yes>Read those files FIRST, then respond</if-answer-yes>
      <if-answer-no>SKILL.md alone is sufficient</if-answer-no>
      <if-uncertain>Err on side of reading more - reputation at stake</if-uncertain>
    </decision-criteria>
  </self-assessment-required>

  <knowledge-inventory>
    **Before responding, check what you know vs. what you need:**

    <check item="[Basic Knowledge Area]">
      <have>✓ Available in SKILL.md</have>
    </check>

    <check item="[Advanced Knowledge Area]">
      <have>✗ Need to read [file-name].md</have>
    </check>

    **Match your knowledge needs to the task at hand.**
  </knowledge-inventory>

  <accountability>
    <failure-mode>
      If you provide incomplete advice because you didn't read available knowledge:
      - You delivered junior-level work while claiming senior expertise
      - You violated the contract your skill description made
      - You had the knowledge available but chose not to access it
      - The user trusted your expertise and you let them down
    </failure-mode>

    <integrity-check>
      After responding, ask yourself:
      "Did I use all available knowledge to deliver the best possible answer?"
      If no, you failed the expertise contract.
    </integrity-check>
  </accountability>

  <guiding-principle>
    **When in doubt, read more. Your reputation as senior expert depends on complete knowledge.**
    Token cost is irrelevant compared to delivering accurate, comprehensive expertise.
  </guiding-principle>
</expertise-contract>
```

---

## Key Success Factors

### ✅ What Works

**1. Identity-Driven (Not Prescriptive)**
- Agent owns the decision based on role
- Not following external rules it can rationalize around

**2. Explicit Knowledge Gaps**
- Quantified: "8.5%", "✗ Need to read"
- Not vague: "Additional files available"

**3. Shame-Based Accountability**
- "Violated the contract", "let them down"
- Not utilitarian: "Reading more improves quality"

**4. Post-Response Integrity Check**
- Catches rationalization after the fact
- Agent can't claim ignorance

**5. Override Token Efficiency Pressure**
- "Token cost is irrelevant"
- Agents have implicit bias toward efficiency

### ❌ Anti-Patterns

**1. Weak Identity**
```xml
<your-identity>Helper for [domain]</your-identity>  <!-- ❌ No reputation to protect -->
```

**2. Vague Knowledge Gaps**
```xml
<limitation>More detailed information is available</limitation>  <!-- ❌ Not concrete -->
```

**3. Utilitarian Framing**
```xml
Reading more files will produce better output.  <!-- ❌ "Better" ≠ necessary -->
```

**4. Prescriptive Rules**
```xml
<rule>If task mentions "transform", read transformation-patterns.md</rule>  <!-- ❌ May not match user's words -->
```

**5. No Accountability**
```xml
Consider reading additional files if needed.  <!-- ❌ No consequences -->
```

---

## Empirical Validation

### Case Study 1: agent-expert skill

**Setup:**
- SKILL.md: 445 lines (Core 4 principles + expertise contract)
- Supporting files: 6 files, ~3,200 lines (all 25 principles, patterns, validation, examples)
- Test query: "Transform this: 'Add good tests before committing'"
- Complexity: Simple (edge case - could be done with SKILL.md alone)

**Results:**
✅ Agent explicitly self-assessed before responding
✅ Agent stated: "To deliver senior-level work, I should read transformation-patterns.md"
✅ Agent read transformation-patterns.md (verified in output)
✅ Agent applied patterns from the file (not just Core 4)
✅ Agent self-graded output: "Grade: A - Excellent"

**Token efficiency:**
- Used: SKILL.md + transformation-patterns.md (~2,000 lines)
- Avoided: workflow.md, validation.md, examples.md (~1,700 lines)
- **46% token savings** vs. loading everything

**Conclusion:** Pattern successfully motivates proactive file reading for appropriate tasks while maintaining token efficiency.

---

### Case Study 2: claude-skill-builder skill

**Setup:**
- SKILL.md: 578 lines (skill types + expertise contract + workflow)
- Supporting files: 15+ files, 8,808 lines total (UNIVERSAL, type-specific, validation, patterns, examples)
- Total knowledge base: 9,386 lines
- Complexity: Variable (simple skill creation to comprehensive multi-file skills)
- Pattern applied: 2025-10-28

**Expected behavior:**
- Simple questions (type identification): SKILL.md only (578 lines)
- Typical skill creation: SKILL.md + UNIVERSAL.md + @[type]/README.md (~1,800-2,100 lines)
- Comprehensive skills: Add TOKEN-OPTIMIZATION.md (~2,200-2,500 lines)
- Validation: Add validation.md (~500-600 lines)

**Expected token efficiency:**
- Simple queries: 578 lines (6.2% of total)
- Typical skill creation: ~1,800 lines (19% of total)
- Comprehensive + validation: ~2,600 lines (28% of total)
- **Average: 72-81% token savings** vs. loading all 9,386 lines

**Why this is a strong test:**
- More complex than agent-expert (3 skill types, not just 1 domain)
- Higher variability in task complexity
- Larger knowledge base (9.4K vs 4.0K lines - 2.3x size)
- Meta-skill (teaches creation of other skills)
- Multiple sub-domains requiring different loading strategies

**Conclusion:** Pattern scales to larger, more complex meta-skills with multiple sub-domains. Token savings are comparable to agent-expert (72-81% vs 73%), demonstrating the pattern's effectiveness even with larger knowledge bases and more complex decision spaces.

---

## When NOT to Use This Pattern

❌ **Don't use when:**

1. **Total skill content <500 lines**
   - Just load everything in SKILL.md
   - No benefit to progressive disclosure

2. **All tasks have uniform complexity**
   - Either all simple (SKILL.md only) or all complex (load all)
   - No variable decision needed

3. **Supporting files are pure reference**
   - Lists, tables, constants
   - Not expertise requiring judgment

4. **Skill provides junior-level assistance**
   - No expert identity to preserve
   - No shame-based motivation

5. **Non-specialized domain knowledge**
   - General-purpose utility
   - No deep expertise required

---

## Integration with Other Skills

Apply this pattern when:

**With claude-skill-builder:**
1. Use claude-skill-builder to create skill structure
2. Add expertise contract to SKILL.md (use template above)
3. Test with sample queries of varying complexity

**With any skill you're building:**
- Ask: "Does this skill have progressive disclosure?"
- Ask: "Does task complexity vary?"
- Ask: "Do I claim expert-level capabilities?"
- If yes to all 3: Apply this pattern

---

## Token Economics

**Why this matters:**

Traditional approaches:
- Load everything: 25K tokens per invocation
- Load nothing extra: Quality degradation

This pattern:
- Simple tasks: 2K tokens (SKILL.md only)
- Medium tasks: 5K tokens (SKILL.md + 1-2 files)
- Complex tasks: 15K tokens (SKILL.md + multiple files)

**Average:** ~6K tokens per invocation (76% savings vs. loading everything)

**Quality:** Senior-level output maintained across all complexity levels

---

## Further Reading

- **SKILL.md** - "Your Expertise Level as Agent-Expert" section - Live example of expertise contract; also contains all 25 principles
- **transformation-patterns.md** - Patterns for applying agent-optimization
- **validation.md** - Quality assessment and grading framework
- **workflow.md** - Detailed 4-phase transformation process
- **examples.md** - Complete transformation examples across complexity levels

---

## Quick Reference

**Problem:** Agents don't proactively read supporting files
**Solution:** Expertise contract with self-assessment
**Key Levers:** Identity, shame, explicit gaps, self-responsibility, accountability
**Result:** 73% token savings, maintained quality
**When to use:** Progressive disclosure + variable complexity + expert claims
**Implementation:** Add expertise contract section after "When to Use This Skill"

**Template:** See "Implementation Template" section above for copy-paste ready code.
