# Init Protocol: Create New Skill

<protocol-metadata>
  <purpose>Create a new Claude Code skill with proper architecture from the start</purpose>
  <triggers>
    <keyword>init</keyword>
    <keyword>create skill</keyword>
    <keyword>new skill</keyword>
    <keyword>initialize</keyword>
  </triggers>
  <outputs>Complete skill directory with SKILL.md and supporting files</outputs>
</protocol-metadata>

## Prerequisites

Before executing this protocol:
1. Skill name provided as $2 argument
2. Optional focus area provided as $ARGUMENTS
3. claude-skill-builder and agent-expert skills loaded
4. Read [UNIVERSAL.md](../UNIVERSAL.md) for core principles

## Protocol Steps

<workflow type="sequential">
  <step id="1-analyze-context" order="first">
    <name>Analyze Conversation Context</name>

    <description>
      Extract insights from the current conversation to inform skill creation.
      This happens automatically - no user action required.
    </description>

    <actions>
      <action>Scan conversation for:
        - Domain context and terminology
        - Use cases mentioned or implied
        - Patterns or approaches discussed
        - Problems being solved
        - Tools or technologies involved
      </action>
      <action>If focus area provided ($ARGUMENTS): prioritize that context</action>
      <action>Document extracted insights for use in skill content</action>
    </actions>

    <output>Context summary with key insights for skill</output>
  </step>

  <step id="2-gather-requirements" order="second">
    <name>Gather Requirements</name>

    <required-information>
      <item priority="critical" source="argument">
        <name>Skill Name</name>
        <value>$2</value>
        <format>kebab-case (e.g., my-skill-name)</format>
      </item>

      <item priority="critical" source="ask-if-unclear">
        <name>Domain/Purpose</name>
        <question>What domain or purpose does this skill serve?</question>
        <examples>React development, Python testing, API documentation</examples>
      </item>

      <item priority="critical" source="ask-if-unclear">
        <name>Capabilities</name>
        <question>What should this skill help accomplish?</question>
        <minimum>At least 2 concrete capabilities</minimum>
      </item>

      <item priority="critical" source="ask-if-unclear">
        <name>Scope</name>
        <question>User-scoped or project-scoped?</question>
        <options>
          <option value="user">~/.claude/skills/ - Portable across projects, self-contained examples</option>
          <option value="project">.claude/skills/ - Project-specific, can reference codebase files</option>
        </options>
      </item>

      <item priority="high" source="infer-or-ask">
        <name>Complexity</name>
        <question>Expected complexity level?</question>
        <options>
          <option value="simple">Simple (< 200 lines total)</option>
          <option value="moderate">Moderate (200-500 lines, multi-file)</option>
          <option value="comprehensive">Comprehensive (500+ lines, folders)</option>
        </options>
      </item>
    </required-information>

    <actions>
      <action>Extract requirements from conversation context first</action>
      <action>Only ask user for critical missing information</action>
      <action>Confirm understanding before proceeding</action>
    </actions>

    <acceptance-criteria>
      <criterion>Domain clearly identified</criterion>
      <criterion>At least 2 capabilities documented</criterion>
      <criterion>Scope explicitly determined</criterion>
    </acceptance-criteria>
  </step>

  <step id="3-determine-type" order="third">
    <name>Determine Skill Type</name>

    <decision-logic>
      <condition>
        <if>Domain knowledge + investigation required</if>
        <then>Type = Expert</then>
        <load>Use Read tool on expert/README.md</load>
      </condition>

      <condition>
        <if>Syntax, formats, or configuration documentation</if>
        <then>Type = CLI</then>
        <load>Use Read tool on cli/README.md</load>
      </condition>

      <condition>
        <if>Creating guides, tutorials, or documentation</if>
        <then>Type = Writer</then>
        <load>Use Read tool on writer/README.md</load>
      </condition>

      <condition>
        <if>Combines multiple aspects</if>
        <then>Type = Hybrid</then>
        <load>Use Read tool on multiple type files as needed</load>
      </condition>

      <condition>
        <if>Multiple distinct operations (3+)</if>
        <then>Architecture = Protocol-per-file</then>
        <load>Use Read tool on TOKEN-OPTIMIZATION.md Pattern 5</load>
      </condition>
    </decision-logic>

    <actions>
      <action>Determine type from domain characteristics</action>
      <action>Read appropriate type-specific guidance</action>
      <action>For comprehensive skills (> 200 lines expected), also read TOKEN-OPTIMIZATION.md</action>
    </actions>
  </step>

  <step id="4-plan-architecture" order="fourth">
    <name>Plan Architecture</name>

    <architecture-decision>
      <pattern name="minimal" when="< 200 lines total, simple purpose">
        <structure>
          skill-name/
          └── SKILL.md
        </structure>
      </pattern>

      <pattern name="moderate" when="200-500 lines, multiple concerns">
        <structure>
          skill-name/
          ├── SKILL.md (< 300 lines)
          ├── EXAMPLES.md
          └── [TYPE].md (if needed)
        </structure>
      </pattern>

      <pattern name="comprehensive" when="500+ lines, deep domain">
        <structure>
          skill-name/
          ├── SKILL.md (< 200 lines, orchestrator)
          ├── [content-folders]/
          │   └── README.md (each folder)
          └── validation/
        </structure>
      </pattern>

      <pattern name="protocol-per-file" when="3+ distinct operations">
        <structure>
          skill-name/
          ├── SKILL.md (orchestrator with routing)
          ├── protocols/
          │   ├── operation-a.md
          │   ├── operation-b.md
          │   └── operation-c.md
          └── [supporting files]
        </structure>
      </pattern>
    </architecture-decision>

    <scope-content-strategy>
      <if-user-scoped>
        <strategy>Self-contained with inline examples</strategy>
        <reason>Must work without project files</reason>
        <action>Include complete code examples in skill files</action>
      </if-user-scoped>

      <if-project-scoped>
        <strategy>Show not tell - reference actual codebase files</strategy>
        <reason>Codebase is source of truth, avoid stale duplication</reason>
        <action>Create file reference tables with "Read When" guidance</action>
      </if-project-scoped>
    </scope-content-strategy>

    <output>Architecture plan with file structure and content strategy</output>
  </step>

  <step id="5-create-skill" order="fifth">
    <name>Create Skill Files</name>

    <yaml-frontmatter>
      <required>
        <field name="name">$2 (kebab-case)</field>
        <field name="description">Follow WHAT + WHEN + WITHOUT formula (200-400 chars ideal)</field>
      </required>

      <description-formula>
        [What the skill does — direct, keyword-rich, third person]. Use when [scenario 1], [scenario 2], [scenario 3] — even when [pushy edge case].
      </description-formula>

      <example>
        name: react-component-builder
        description: Validated React patterns for component architecture with TypeScript, hooks, and prop typing. Use when building UI components, refactoring class components, or scaffolding React structures — even for seemingly straightforward React tasks.
      </example>
    </yaml-frontmatter>

    <skill-md-structure>
      <section name="role" required="true">
        <template>
<role>
  <identity>[Expert identity]</identity>
  <purpose>[What skill accomplishes]</purpose>
  <expertise>
    <area>[Key area 1]</area>
    <area>[Key area 2]</area>
  </expertise>
  <scope>
    <in-scope>[What skill covers]</in-scope>
    <out-of-scope>[What skill doesn't cover]</out-of-scope>
  </scope>
</role>
        </template>
      </section>

      <section name="core-content" required="true">
        <guidelines>
          - Apply agent-optimization principles (#7, #9, #13, #14, #26)
          - Use imperative voice
          - Include positive AND negative examples
          - Make every step executable and measurable
        </guidelines>
      </section>

      <section name="navigation" when="multi-file">
        <template>
## File Loading Protocol

<loading-decision>
  <file path="[file.md]">
    <load-when>[Trigger condition]</load-when>
    <provides>[Value/benefit]</provides>
  </file>
</loading-decision>
        </template>
      </section>
    </skill-md-structure>

    <actions>
      <action>Create skill directory at appropriate location (scope)</action>
      <action>Write SKILL.md with YAML frontmatter and role definition</action>
      <action>Populate with insights extracted from conversation</action>
      <action>Create supporting files per architecture plan</action>
      <action>Ensure SKILL.md stays under target line count</action>
    </actions>
  </step>

  <step id="6-validate" order="sixth">
    <name>Validate Skill</name>

    <quick-validation>
      <check id="yaml">YAML frontmatter parses correctly</check>
      <check id="description">Description 100-500 chars with AFTER + WHEN + WITHOUT</check>
      <check id="lines">SKILL.md under line limit (300 ideal, 400 max)</check>
      <check id="references">All file references valid</check>
      <check id="examples">At least 2-3 concrete examples included</check>
    </quick-validation>

    <actions>
      <action>Run quick validation checks</action>
      <action>For comprehensive skills: launch validation agent (see validation/README.md)</action>
      <action>Fix any issues found</action>
    </actions>

    <reference>Use Read tool on validation/README.md for complete checklist</reference>
  </step>

  <step id="7-deliver" order="last">
    <name>Deliver and Inform User</name>

    <required-output>
      <item>List of files created with paths</item>
      <item>Key insights captured from conversation</item>
      <item>How to test the skill</item>
      <item>Hot-reload confirmation (skill available immediately)</item>
    </required-output>

    <hot-reload-message>
      The skill "{skill-name}" is now available. Skills hot-reload automatically since v2.1 — no session restart needed.
    </hot-reload-message>

    <follow-up-suggestions>
      - Test skill triggers by describing use cases
      - Refine description if triggers don't work
      - Add more examples based on real usage
    </follow-up-suggestions>
  </step>
</workflow>

## Agent-Optimization Principles to Apply

Always apply these principles from agent-expert:

| Principle | Application |
|-----------|-------------|
| #7 Executable | Every instruction specific and actionable |
| #9 No Ambiguity | Quantify, define, exemplify all terms |
| #13 Imperative | Direct commands, not suggestions |
| #14 Examples | Show what to do AND what not to do |
| #23 Role Definition | Identity, purpose, expertise, scope |
| #26 Agent Audience | Optimize for agent execution, not human reading |

## Cross-References

- **[UNIVERSAL.md](../UNIVERSAL.md)** - YAML requirements, description formula, token optimization
- **[TOKEN-OPTIMIZATION.md](../TOKEN-OPTIMIZATION.md)** - Architecture patterns for efficiency
- **[expert/README.md](../expert/README.md)** - Expert skill specific guidance
- **[cli/README.md](../cli/README.md)** - CLI skill specific guidance
- **[writer/README.md](../writer/README.md)** - Writer skill specific guidance
- **[validation/README.md](../validation/README.md)** - Complete validation checklist
