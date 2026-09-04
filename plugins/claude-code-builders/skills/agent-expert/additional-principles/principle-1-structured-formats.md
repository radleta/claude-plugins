---
tags: [agent-expert/additional-principles]
summary: "Principle #1: Use Structured Formats When Complexity Warrants It — XML for complex multi-step workflows, markdown for simple sequences"
---

# Principle #1: Use Structured Formats When Complexity Warrants It

**Category:** Structure & Format
**Priority:** Complex workflows (3+ steps, dependencies)
**Complexity Cost:** High (more verbose, but worth it for clarity)

**When to use:**
- Multi-step protocols with dependencies
- Complex hierarchies (steps with substeps)
- Clear semantic boundaries needed

**When NOT to use:**
- Simple instructions that plain markdown handles well
- Linear lists without dependencies (numbered markdown list is fine)
- Short content where XML adds more noise than structure

**How to apply:**

For complex workflows, XML or structured formats can help — but markdown with clear headings works for simpler cases. Choose the lightest format that eliminates ambiguity:

```xml
<workflow type="sequential">
  <step id="1-investigate" order="first">
    <description>Investigate project patterns</description>

    <actions>
      <action priority="critical">Find existing files matching relevant patterns</action>
      <action priority="high">Document patterns with examples</action>
    </actions>

    <acceptance-criteria>
      <criterion>Patterns documented with 3+ examples</criterion>
      <criterion>File structure identified</criterion>
    </acceptance-criteria>

    <blocks>
      <step-id>2-implement</step-id>
      <reason>Cannot implement without knowing patterns</reason>
    </blocks>
  </step>

  <step id="2-implement" order="second">
    <description>Implement following discovered patterns</description>

    <dependencies>
      <requires>Step 1 completed</requires>
      <prerequisite>Investigation report exists</prerequisite>
    </dependencies>

    <actions>
      <action>Create files at [location from investigation]</action>
      <action>Use [naming pattern from investigation]</action>
    </actions>

    <acceptance-criteria>
      <criterion>Files created at correct location</criterion>
      <criterion>Naming follows pattern</criterion>
    </acceptance-criteria>
  </step>
</workflow>
```

**Why structured formats over prose (when warranted):**
- Unambiguous boundaries (`<step>` clearly marks step boundaries)
- Hierarchical relationships clear (parent/child)
- Dependencies explicit and tagged
- But: plain markdown with numbered steps works for simple sequences — don't add XML overhead for linear workflows
