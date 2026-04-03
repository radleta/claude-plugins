# Assess Protocol: Skill Health Check

<protocol-metadata>
  <purpose>Audit existing skill for health, token efficiency, and identify bloat or corruption</purpose>
  <triggers>
    <keyword>assess</keyword>
    <keyword>audit</keyword>
    <keyword>health check</keyword>
    <keyword>analyze skill</keyword>
  </triggers>
  <outputs>Health report with metrics, issues, and actionable recommendations</outputs>
</protocol-metadata>

## Prerequisites

Before executing this protocol:
1. Skill name provided as $2 argument
2. claude-skill-builder and agent-expert skills loaded

## Protocol Steps

<workflow type="sequential">
  <step id="1-locate" order="first">
    <name>Locate Skill</name>
    <actions>
      <action>Search for skill in these locations (in order):
        - `.claude/skills/$2/SKILL.md` (project skills)
        - `~/.claude/skills/$2/SKILL.md` (personal skills)
      </action>
      <action>If not found, report error and exit</action>
      <action>Read SKILL.md and all referenced files</action>
    </actions>
    <output>Skill location and complete file inventory</output>
  </step>

  <step id="2-measure" order="second">
    <name>Measure Token Efficiency</name>

    <metrics>
      <metric id="skill-md-lines">
        <name>SKILL.md Line Count</name>
        <measure>Count total lines in SKILL.md</measure>
        <thresholds>
          <healthy>< 300 lines</healthy>
          <warning>300-400 lines</warning>
          <critical>> 400 lines</critical>
        </thresholds>
      </metric>

      <metric id="total-lines">
        <name>Total Skill Lines</name>
        <measure>Count lines across all skill files</measure>
        <context>For ratio calculation</context>
      </metric>

      <metric id="file-count">
        <name>File Count</name>
        <measure>Count all .md files in skill directory</measure>
        <thresholds>
          <minimal>1-3 files</minimal>
          <moderate>4-10 files</moderate>
          <comprehensive>10+ files</comprehensive>
        </thresholds>
      </metric>

      <metric id="largest-file">
        <name>Largest Single File</name>
        <measure>Find largest .md file (excluding SKILL.md)</measure>
        <thresholds>
          <healthy>< 200 lines</healthy>
          <warning>200-400 lines</warning>
          <critical>> 400 lines</critical>
        </thresholds>
      </metric>
    </metrics>

    <output>Metrics table with values and health status</output>
  </step>

  <step id="3-architecture" order="third">
    <name>Assess Architecture Pattern</name>

    <patterns-to-detect>
      <pattern id="monolithic">
        <indicators>
          - Single SKILL.md > 400 lines
          - No supporting files
          - Examples, templates, protocols all inline
        </indicators>
        <health>UNHEALTHY - needs splitting</health>
      </pattern>

      <pattern id="minimal">
        <indicators>
          - SKILL.md < 200 lines
          - 1-3 files total
          - Simple, focused purpose
        </indicators>
        <health>HEALTHY for simple skills</health>
      </pattern>

      <pattern id="moderate">
        <indicators>
          - SKILL.md < 300 lines
          - 4-10 files
          - Read instructions present
        </indicators>
        <health>HEALTHY for moderate complexity</health>
      </pattern>

      <pattern id="comprehensive">
        <indicators>
          - SKILL.md < 200 lines (orchestrator)
          - 10+ files organized in folders
          - README.md in each folder
          - Clear navigation with Read instructions
        </indicators>
        <health>HEALTHY for complex domains</health>
      </pattern>

      <pattern id="protocol-per-file">
        <indicators>
          - protocols/ or workflows/ folder exists
          - SKILL.md routes to protocol files
          - Each operation in separate file
        </indicators>
        <health>OPTIMAL for multi-operation skills</health>
      </pattern>
    </patterns-to-detect>

    <output>Detected pattern and appropriateness assessment</output>
  </step>

  <step id="4-bloat-detection" order="fourth">
    <name>Detect Bloat and Corruption</name>

    <bloat-indicators>
      <indicator id="inline-examples">
        <check>Large code examples inline in SKILL.md (> 50 lines)</check>
        <recommendation>Move to EXAMPLES.md with Read instruction</recommendation>
      </indicator>

      <indicator id="inline-templates">
        <check>Templates embedded in SKILL.md</check>
        <recommendation>Move to templates/ folder</recommendation>
      </indicator>

      <indicator id="duplicate-content">
        <check>Same content appears in multiple files</check>
        <recommendation>Consolidate to single source, reference from others</recommendation>
      </indicator>

      <indicator id="missing-lazy-load">
        <check>All content in SKILL.md, no Read instructions</check>
        <recommendation>Apply two-tier pattern: inline critical, lazy-load rest</recommendation>
      </indicator>

      <indicator id="operation-variance">
        <check>Multiple distinct operations all in SKILL.md</check>
        <recommendation>Apply protocol-per-file pattern</recommendation>
      </indicator>

      <indicator id="unmotivated-reads">
        <check>Read instructions without WHEN/WHY guidance</check>
        <recommendation>Add motivation: "Use Read tool when [trigger] (provides [value])"</recommendation>
      </indicator>
    </bloat-indicators>

    <corruption-indicators>
      <indicator id="broken-references">
        <check>References to files that don't exist</check>
        <severity>CRITICAL</severity>
      </indicator>

      <indicator id="invalid-yaml">
        <check>YAML frontmatter doesn't parse</check>
        <severity>CRITICAL</severity>
      </indicator>

      <indicator id="missing-description">
        <check>No description or description < 100 chars</check>
        <severity>MAJOR</severity>
      </indicator>

      <indicator id="description-bloat">
        <check>Uses "AFTER loading..." preamble or "WITHOUT this skill..." scare tactic — wasteful boilerplate that should be replaced with WHAT + WHEN + Be Pushy formula</check>
        <severity>MAJOR</severity>
      </indicator>
    </corruption-indicators>

    <output>List of bloat/corruption issues with severity</output>
  </step>

  <step id="5-recommendations" order="fifth">
    <name>Generate Recommendations</name>

    <recommendation-categories>
      <category id="immediate">
        <name>Immediate Fixes (Corruption)</name>
        <criteria>CRITICAL severity issues that break skill functionality</criteria>
        <action>Must fix before skill can be used reliably</action>
      </category>

      <category id="refactor">
        <name>Refactoring (Bloat)</name>
        <criteria>Architecture improvements for token efficiency</criteria>
        <actions>
          <action condition="monolithic > 400 lines">
            Split into multi-file architecture:
            1. Extract examples to EXAMPLES.md
            2. Extract protocols to protocols/ folder
            3. Keep SKILL.md as lean orchestrator
          </action>

          <action condition="multiple operations inline">
            Apply protocol-per-file pattern:
            1. Create protocols/ folder
            2. Extract each operation to separate file
            3. Add routing logic to SKILL.md
          </action>

          <action condition="no lazy loading">
            Apply two-tier pattern:
            1. Identify content used < 50% of invocations
            2. Move to separate files
            3. Add Read instructions with WHEN/WHY
          </action>
        </actions>
      </category>

      <category id="enhance">
        <name>Enhancements (Quality)</name>
        <criteria>Improvements that increase skill effectiveness</criteria>
        <examples>
          - Add more trigger keywords to description
          - Add "be pushy" edge cases to description
          - Remove AFTER/WITHOUT boilerplate from description
          - Add validation checklist
          - Improve examples
        </examples>
      </category>
    </recommendation-categories>

    <output>Prioritized recommendations with specific actions</output>
  </step>

  <step id="6-report" order="last">
    <name>Generate Health Report</name>

    <report-template>
## Skill Health Report: {skill-name}

### Overview
- **Location**: {path}
- **Pattern**: {detected-pattern}
- **Health Grade**: {A+|A|B|C|D|F}

### Metrics

| Metric | Value | Status |
|--------|-------|--------|
| SKILL.md lines | {n} | {✅|⚠️|❌} |
| Total files | {n} | {pattern} |
| Largest file | {n} lines | {✅|⚠️|❌} |

### Issues Found

**Critical** (must fix):
{list or "None"}

**Major** (should fix):
{list or "None"}

**Minor** (consider):
{list or "None"}

### Recommendations

**Immediate Actions:**
{numbered list}

**Refactoring (if needed):**
{specific architecture changes}

**Enhancements:**
{quality improvements}

### Next Steps
{specific guidance based on findings}
    </report-template>

    <grading-criteria>
      <grade value="A+">
        - Zero critical/major issues
        - Appropriate architecture for complexity
        - SKILL.md < 300 lines
        - Good token efficiency
      </grade>
      <grade value="A">
        - Zero critical issues
        - Minor architecture improvements possible
        - SKILL.md < 400 lines
      </grade>
      <grade value="B">
        - Zero critical issues
        - Some major issues or bloat
        - SKILL.md 400-500 lines
      </grade>
      <grade value="C">
        - 1-2 critical issues OR significant bloat
        - SKILL.md > 500 lines
        - Needs refactoring
      </grade>
      <grade value="D">
        - Multiple critical issues
        - Severely bloated
        - Major refactoring required
      </grade>
      <grade value="F">
        - Skill broken or unusable
        - Fundamental corruption
      </grade>
    </grading-criteria>
  </step>
</workflow>

## Quick Health Check (Abbreviated)

For rapid assessment without full protocol:

```
1. Count SKILL.md lines
   - < 300: ✅ Healthy
   - 300-400: ⚠️ Monitor
   - > 400: ❌ Needs attention

2. Check file count
   - Matches complexity? ✅
   - Single file > 400 lines? ❌ Split needed

3. Verify YAML parses
   - Valid? ✅
   - Errors? ❌ Fix immediately

4. Check description
   - Has AFTER + WHEN + WITHOUT? ✅
   - Missing components? ⚠️ Strengthen
```

## Cross-References

- **[TOKEN-OPTIMIZATION.md](../TOKEN-OPTIMIZATION.md)** - Architectural patterns and metrics
- **[validation/README.md](../validation/README.md)** - Complete validation checklists
- **[UNIVERSAL.md](../UNIVERSAL.md)** - Core principles and description formula
