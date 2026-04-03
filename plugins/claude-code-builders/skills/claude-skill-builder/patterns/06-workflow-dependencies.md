# Pattern Category 6: Workflow & Dependencies

### Pattern 12: Implicit vs Explicit Dependencies

**Before:**
```markdown
1. Investigate the project
2. Make changes
3. Test
```

**After:**
```xml
<workflow type="sequential" strict="true">
  <step id="investigate" order="1">
    <description>Investigate project patterns and conventions</description>
    <acceptance-criteria>
      <criterion>Investigation report completed</criterion>
      <criterion>All required areas documented</criterion>
    </acceptance-criteria>
    <dependencies>
      <prerequisite>None (first step)</prerequisite>
    </dependencies>
    <blocks>
      <step-id>implement</step-id>
      <step-id>test</step-id>
      <step-id>document</step-id>
      <reason>Cannot proceed without knowing project patterns</reason>
    </blocks>
  </step>

  <step id="implement" order="2">
    <description>Make code changes following discovered patterns</description>
    <acceptance-criteria>
      <criterion>Changes follow patterns from investigation</criterion>
      <criterion>Linter passes</criterion>
      <criterion>TypeScript compiles (if TS project)</criterion>
    </acceptance-criteria>
    <dependencies>
      <requires>investigate (must be completed)</requires>
      <prerequisite>Investigation report exists and is comprehensive</prerequisite>
    </dependencies>
    <blocks>
      <step-id>test</step-id>
      <reason>Cannot test what hasn't been implemented</reason>
    </blocks>
  </step>

  <step id="test" order="3">
    <description>Create and run tests</description>
    <acceptance-criteria>
      <criterion>Test file created at correct location</criterion>
      <criterion>All tests pass</criterion>
      <criterion>Coverage meets standard</criterion>
    </acceptance-criteria>
    <dependencies>
      <requires>implement (must be completed)</requires>
      <prerequisite>Code changes exist and compile</prerequisite>
    </dependencies>
    <blocks>
      <step-id>document</step-id>
      <reason>Don't document until tests verify correctness</reason>
    </blocks>
  </step>

  <step id="document" order="4">
    <description>Update documentation</description>
    <acceptance-criteria>
      <criterion>Docstrings added</criterion>
      <criterion>README updated if needed</criterion>
      <criterion>CHANGELOG entry added</criterion>
    </acceptance-criteria>
    <dependencies>
      <requires>test (must be completed)</requires>
      <prerequisite>Implementation verified by tests</prerequisite>
    </dependencies>
  </step>
</workflow>
```

**Why Better:**
- Explicit execution order (1, 2, 3, 4)
- Dependencies tagged for each step
- Blocks relationships defined
- Reasons provided
- Acceptance criteria per step
- Prerequisites clear

---

### Pattern 13: Parallel vs Sequential

**Before:**
```markdown
Read the component file, test file, and style file.
```

**After:**
```xml
<execution-model>
  <parallel-group id="file-reading" description="Can execute concurrently">
    <task id="read-component">
      <description>Read component file</description>
      <action>Read file_path="src/components/Button.tsx"</action>
    </task>

    <task id="read-test">
      <description>Read test file</description>
      <action>Read file_path="src/components/Button.test.tsx"</action>
    </task>

    <task id="read-styles">
      <description>Read style file</description>
      <action>Read file_path="src/components/Button.css"</action>
    </task>

    <optimization>
      These tasks have no dependencies on each other and can run simultaneously
      for better performance.
    </optimization>
  </parallel-group>

  <sequential-after-parallel id="analysis" description="Must run after all reads complete">
    <task id="analyze-together" depends-on="file-reading">
      <description>Analyze all three files together</description>
      <prerequisite>All files read successfully</prerequisite>
      <action>
        Compare patterns across component, test, and styles.
        Identify inconsistencies or opportunities for improvement.
      </action>
    </task>

    <task id="generate-report" depends-on="analyze-together">
      <description>Generate analysis report</description>
      <prerequisite>Analysis completed</prerequisite>
      <action>Document findings in structured format</action>
    </task>
  </sequential-after-parallel>
</execution-model>
```

**Why Better:**
- Explicit parallel group
- Sequential dependency clear
- Optimization reason stated
- Dependencies tagged
- Performance benefit explained

---
