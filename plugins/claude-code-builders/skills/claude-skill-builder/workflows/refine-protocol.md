# Refine Protocol: Update Existing Skill with Session Insights

<protocol-metadata>
  <purpose>Update existing skill with validated insights while maintaining health</purpose>
  <triggers>
    <keyword>refine</keyword>
    <keyword>update skill</keyword>
    <keyword>add to skill</keyword>
    <keyword>improve skill</keyword>
  </triggers>
  <outputs>Updated skill files with documented changes</outputs>
  <critical>MUST assess skill health BEFORE adding content</critical>
</protocol-metadata>

## Prerequisites

Before executing this protocol:
1. Skill name provided as $2 argument
2. Optional focus area provided as $ARGUMENTS
3. claude-skill-builder and agent-expert skills loaded

## Protocol Steps

<workflow type="sequential">
  <step id="1-locate" order="first">
    <name>Locate, Stage, and Read Skill</name>
    <actions>
      <action>Run `skill-edit pull $2` to stage the skill for editing (see SKILL.md "Write Strategy")</action>
      <action>Read SKILL.md and all referenced files from the staging path</action>
      <action>Document current structure and content</action>
    </actions>
    <output>Staging path, current file inventory, content summary</output>
  </step>

  <step id="2-health-check" order="second" critical="true">
    <name>Assess Skill Health (REQUIRED)</name>

    <description>
      CRITICAL: Must assess health BEFORE adding content.
      A bloated skill will only get worse with additions.
    </description>

    <quick-health-metrics>
      <metric name="skill-md-lines">
        <measure>Count lines in SKILL.md</measure>
        <healthy>< 300</healthy>
        <warning>300-400</warning>
        <bloated>> 400</bloated>
      </metric>

      <metric name="architecture">
        <measure>Check if using multi-file pattern appropriately</measure>
        <check>Does complexity warrant current structure?</check>
      </metric>

      <metric name="lazy-loading">
        <measure>Are Read instructions present for non-critical content?</measure>
        <check>Is everything crammed into SKILL.md?</check>
      </metric>
    </quick-health-metrics>

    <decision-gate>
      <if condition="healthy (< 300 lines, appropriate architecture)">
        <then>Proceed to step 3 (extract insights)</then>
      </if>

      <if condition="warning (300-400 lines)">
        <then>
          1. Warn user about approaching threshold
          2. Recommend refactoring opportunities
          3. Proceed with caution - consider extracting before adding
        </then>
      </if>

      <if condition="bloated (> 400 lines OR inappropriate architecture)">
        <then>
          STOP. Do not add more content.
          1. Inform user skill needs restructuring first
          2. Run full assess protocol (workflows/assess-protocol.md)
          3. Recommend specific refactoring actions:
             - Extract examples to EXAMPLES.md
             - Apply protocol-per-file if multiple operations
             - Move large sections to separate files with Read instructions
          4. User must approve restructuring before refinement continues
        </then>
      </if>
    </decision-gate>

    <output>Health status and decision (proceed/warn/stop)</output>
  </step>

  <step id="3-extract-insights" order="third">
    <name>Extract Session Insights</name>

    <description>
      Automatically analyze conversation for insights worth capturing.
      Focus area ($ARGUMENTS) prioritizes specific topics if provided.
    </description>

    <insight-categories>
      <category id="validated-patterns">
        <name>Validated Patterns</name>
        <description>Approaches confirmed to work through real usage</description>
        <look-for>
          - Solutions that worked
          - Patterns applied successfully
          - Techniques with positive outcomes
        </look-for>
      </category>

      <category id="gotchas">
        <name>Gotchas and Quirks</name>
        <description>Unexpected behaviors, workarounds, edge cases</description>
        <look-for>
          - Surprising behaviors discovered
          - Workarounds needed
          - Edge cases encountered
          - Things that didn't work as expected
        </look-for>
      </category>

      <category id="updates">
        <name>Tool/API Updates</name>
        <description>New capabilities, changed behaviors, deprecations</description>
        <look-for>
          - New features discovered
          - API changes noted
          - Deprecated approaches
          - Version-specific behaviors
        </look-for>
      </category>

      <category id="triggers">
        <name>Trigger Keywords</name>
        <description>Terms that should activate this skill</description>
        <look-for>
          - How user phrased their request
          - Domain terms used
          - Action verbs that apply
        </look-for>
      </category>

      <category id="examples">
        <name>Real-World Examples</name>
        <description>Concrete usage worth documenting</description>
        <look-for>
          - Code that demonstrates patterns
          - Before/after transformations
          - Complete working solutions
        </look-for>
      </category>
    </insight-categories>

    <output>Categorized list of insights to incorporate</output>
  </step>

  <step id="4-plan-integration" order="fourth">
    <name>Plan Integration (Token-Aware)</name>

    <integration-decision for-each-insight="true">
      <question>Where does this insight belong?</question>

      <options>
        <option id="inline-skill-md" when="critical, used > 50%, < 20 lines">
          <action>Add directly to SKILL.md</action>
          <check>Will this push SKILL.md over threshold?</check>
        </option>

        <option id="existing-file" when="fits existing supporting file">
          <action>Add to appropriate existing file (EXAMPLES.md, etc.)</action>
          <prefer>This option when file exists</prefer>
        </option>

        <option id="new-file" when="large content or new category">
          <action>Create new supporting file with Read instruction</action>
          <require>Add navigation in SKILL.md</require>
        </option>

        <option id="description-update" when="new trigger keywords">
          <action>Enhance description with new WHEN scenarios</action>
          <limit>Keep description 200-500 chars</limit>
        </option>
      </options>
    </integration-decision>

    <token-budget>
      <rule>Calculate remaining budget: (threshold - current lines)</rule>
      <rule>If adding > budget: MUST extract existing content first</rule>
      <rule>Never let SKILL.md exceed 400 lines</rule>
    </token-budget>

    <output>Integration plan with target location for each insight</output>
  </step>

  <step id="5-apply-updates" order="fifth">
    <name>Apply Updates (in staging)</name>

    <prerequisite>All edits target the staging path from step 1 (`skill-edit pull`). Do NOT Edit/Write directly to `.claude/skills/`.</prerequisite>

    <update-guidelines>
      <guideline id="preserve-structure">
        Maintain existing organization and voice
      </guideline>

      <guideline id="consolidate">
        Don't create redundant content - enhance existing sections
      </guideline>

      <guideline id="agent-optimize">
        Apply agent-optimization principles to new content:
        - #7 Executable steps
        - #9 No ambiguity
        - #13 Imperative voice
        - #14 Include examples (positive AND negative)
      </guideline>

      <guideline id="cross-reference">
        Update any counts, references, or navigation affected
      </guideline>
    </update-guidelines>

    <actions>
      <action>Apply each planned update</action>
      <action>Track all changes made (file, section, change type)</action>
      <action>Update description if new triggers identified</action>
      <action>Fix any outdated counts or references</action>
    </actions>

    <output>List of all changes applied</output>
  </step>

  <step id="6-validate" order="sixth">
    <name>Validate Updates</name>

    <actions>
      <action>Run `skill-edit push --dry-run $2` to preview the diff</action>
    </actions>

    <validation-checks>
      <check id="yaml">YAML frontmatter still valid</check>
      <check id="description">Description maintains WHAT + WHEN formula</check>
      <check id="lines">SKILL.md still under threshold (< 400, ideally < 300)</check>
      <check id="references">All file references valid</check>
      <check id="navigation">Read instructions present for new files</check>
      <check id="consistency">Voice and style consistent</check>
    </validation-checks>

    <if-validation-fails>
      <action>Fix issues in staging before proceeding</action>
      <action>If over line limit: extract content to supporting files</action>
    </if-validation-fails>
  </step>

  <step id="7-report" order="last">
    <name>Push and Report Changes</name>

    <actions>
      <action priority="critical">Run `skill-edit push $2` to apply changes (backs up, verifies no conflicts, overwrites)</action>
    </actions>

    <report-template>
## Skill Refinement Complete: {skill-name}

### Health Status
- **Before**: {lines} lines, {status}
- **After**: {lines} lines, {status}

### Changes Made

**Files Modified:**
{list of files with change summary}

**Insights Captured:**
{bulleted list of key insights added}

### Description Updates
{if description changed, show before/after}

### Recommendations
{any follow-up actions suggested}

**NOTE**: Skills hot-reload automatically since v2.1. The updated skill is available immediately.
    </report-template>
  </step>
</workflow>

## Refactoring Guidance (When Health Check Fails)

If step 2 determines skill is bloated, recommend these refactoring actions:

### For Monolithic SKILL.md (> 400 lines)

```
1. Identify content categories:
   - Core workflow (keep in SKILL.md)
   - Examples (move to EXAMPLES.md)
   - Reference material (move to REFERENCE.md)
   - Type-specific content (move to [type]/ folder)

2. Extract largest sections first:
   - Find sections > 100 lines
   - Move to separate files
   - Add Read instructions with WHEN/WHY

3. Target: SKILL.md < 300 lines as orchestrator
```

### For Multiple Operations in SKILL.md

```
1. Identify distinct operations:
   - List each operation/mode
   - Check if mutually exclusive

2. If 3+ operations, apply protocol-per-file:
   - Create protocols/ folder
   - Extract each operation to separate file
   - Add routing logic to SKILL.md

3. Target: Load only needed protocol per invocation
```

### For Missing Lazy Loading

```
1. Identify usage frequency:
   - Critical for every invocation → Inline
   - Used < 50% of time → Externalize

2. Add Read instructions:
   - "Use Read tool when [trigger] (provides [value])"
   - Include WHEN and WHY for each

3. Target: Two-tier architecture (inline critical, lazy-load rest)
```

## Cross-References

- **[assess-protocol.md](assess-protocol.md)** - Full health assessment
- **[TOKEN-OPTIMIZATION.md](../TOKEN-OPTIMIZATION.md)** - Architectural patterns
- **[UNIVERSAL.md](../UNIVERSAL.md)** - Core principles
- **[validation/README.md](../validation/README.md)** - Complete validation checklist
