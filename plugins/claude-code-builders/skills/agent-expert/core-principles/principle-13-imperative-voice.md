---
tags: [agent-expert/core-principles]
summary: "Principle #13: Use Imperative Voice with Rationale — direct commands paired with the 'why' for better generalization"
---

# Principle #13: Use Imperative Voice with Rationale ⭐

**Category:** Explicitness & Clarity
**Priority:** ALWAYS APPLY
**Complexity Cost:** Low

**What it means:**
- Use direct commands, not suggestions or questions
- Be authoritative and decisive
- Start with action verbs (Create, Verify, Run, Add, Update)
- Avoid passive voice, conditional language, or hedging
- **Pair commands with rationale** — agents generalize better from understood principles than from rote directives
- **ALL CAPS MUSTs are a yellow flag** — if you need shouting to enforce a rule, the instruction may lack the "why" that makes compliance natural

**How to apply:**

1. **Replace suggestive language with commands:**
   ```markdown
   ❌ "You might want to consider adding tests"
   ✅ "Add tests for all public functions"

   ❌ "It would be good to document the API"
   ✅ "Document the API with JSDoc comments"

   ❌ "Consider following project conventions"
   ✅ "Follow project conventions (from investigation)"
   ```

2. **Start sentences with action verbs:**
   - Create, Build, Implement
   - Verify, Check, Validate
   - Run, Execute, Perform
   - Add, Update, Modify
   - Document, Explain, Describe

3. **Remove hedging and qualifiers:**
   ```markdown
   ❌ "Probably should check if tests pass"
   ✅ "Run tests and verify all pass"

   ❌ "Maybe add some error handling"
   ✅ "Add error handling for: invalid input, network failures, timeout"
   ```

**Examples:**

```markdown
❌ Suggestive: "You should probably run the linter"
✅ Imperative: "Run the linter (npm run lint)"

❌ Question: "Have you added tests?"
✅ Imperative: "Add tests for each public method"

❌ Passive: "Tests should be run before committing"
✅ Imperative: "Run tests before committing"

❌ Conditional: "If possible, document the code"
✅ Imperative: "Document all public functions with JSDoc"
```

4. **Pair directives with rationale (the "why"):**
   ```markdown
   ❌ Bare directive: "MUST use parameterized queries"
   ✅ With rationale: "Use parameterized queries — string concatenation enables SQL injection"

   ❌ Shouting: "NEVER use eval()"
   ✅ With rationale: "Avoid eval() — it executes arbitrary code and breaks static analysis"
   ```
   When the agent understands *why*, it generalizes the principle to novel situations rather than treating it as a rote rule.

**Why it matters:**
- Suggestions are ambiguous (should I? maybe? if I feel like it?)
- Commands are clear and unambiguous (do this, period)
- Agents execute direct instructions more reliably
- Removes uncertainty about whether action is required
- Rationale enables generalization — the agent applies the principle to cases you didn't enumerate
