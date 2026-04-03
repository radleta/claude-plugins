# Interactive Skill Creation Workflow

This document contains the complete step-by-step workflow for creating Claude Code skills.

<workflow type="sequential">
  <step id="1-gather-requirements" order="first">
    <description>Gather skill requirements from user</description>

    <required-information>
      <item priority="critical">Domain or purpose</item>
      <item priority="critical">Capabilities (what skill helps user accomplish)</item>
      <item priority="critical">Scope (user vs project) - determines content strategy</item>
      <item priority="high">Specific requirements or constraints</item>
      <item priority="medium">Complexity level estimate</item>
    </required-information>

    <scope-determination>
      <ask-user>Should this be a user-scoped or project-scoped skill?</ask-user>
      <decision-factors>
        <factor name="portability">Will skill be used across multiple projects?</factor>
        <factor name="project-files">Does skill need to reference actual codebase files?</factor>
        <factor name="team-sharing">Should skill be shared with team via version control?</factor>
      </decision-factors>
      <implications>
        <if-user-scoped>
          <location>~/.claude/skills/</location>
          <content-strategy>Self-contained with inline examples</content-strategy>
          <rationale>Cannot reference project files - must work anywhere</rationale>
        </if-user-scoped>
        <if-project-scoped>
          <location>.claude/skills/</location>
          <content-strategy>Show not tell - reference actual project files</content-strategy>
          <rationale>Codebase is source of truth - avoid stale duplicated examples</rationale>
        </if-project-scoped>
      </implications>
    </scope-determination>

    <actions>
      <action>Request missing critical information if not provided</action>
      <action>Explicitly ask about scope if not specified</action>
      <action>Confirm understanding with user before proceeding</action>
      <action>Document requirements for reference during creation</action>
    </actions>

    <acceptance-criteria>
      <criterion>Domain clearly identified</criterion>
      <criterion>At least 2 use cases or capabilities documented</criterion>
      <criterion>Scope (user/project) explicitly determined</criterion>
      <criterion>User confirmed requirements understanding</criterion>
    </acceptance-criteria>

    <blocks>2-determine-type</blocks>
  </step>

  <step id="2-determine-type" order="second" depends-on="1-gather-requirements">
    <description>Classify skill type based on requirements</description>

    <decision-logic>
      <condition>
        <if>Domain knowledge + investigation required</if>
        <then>Type = Expert</then>
        <load-file>expert/README.md</load-file>
      </condition>

      <condition>
        <if>Syntax, formats, or configuration documentation</if>
        <then>Type = CLI</then>
        <load-file>cli/README.md</load-file>
      </condition>

      <condition>
        <if>Creating guides, tutorials, or documentation</if>
        <then>Type = Writer</then>
        <load-file>writer/README.md</load-file>
      </condition>

      <condition>
        <if>Combines multiple aspects</if>
        <then>Type = Hybrid</then>
        <load-file>Multiple type files as needed</load-file>
      </condition>

      <condition>
        <if>Unclear</if>
        <then>Request clarification from user with specific questions</then>
      </condition>
    </decision-logic>

    <actions>
      <action>Load UNIVERSAL.md (always required)</action>
      <action>Load appropriate [type]/README.md based on determination</action>
      <action>For comprehensive skills (>200 lines), also load TOKEN-OPTIMIZATION.md</action>
    </actions>

    <acceptance-criteria>
      <criterion>Skill type determined with confidence</criterion>
      <criterion>UNIVERSAL.md loaded and understood</criterion>
      <criterion>Type-specific README.md loaded and understood</criterion>
    </acceptance-criteria>

    <blocks>2.5-extract-knowledge, 3-apply-principles</blocks>
  </step>

  <step id="2.5-extract-knowledge" order="after-type" depends-on="2-determine-type">
    <description>Extract and curate domain knowledge for expert skills (auto-triggered)</description>

    <trigger-condition>
      Type = Expert AND source material provided (file paths, directory, or codebase area)
    </trigger-condition>

    <skip-condition>
      Skip if: Type is not Expert, OR no source material specified, OR user
      is providing knowledge directly (not from source files)
    </skip-condition>

    <actions>
      <action priority="critical">Launch the **insight-extractor** agent via the Task tool
        with the source material paths as the prompt</action>
      <action priority="critical">Agent applies the 3-filter knowledge distillation framework:
        - Filter 1: Does Claude already know this? (reject common knowledge)
        - Filter 2: Does this change behavior? (reject inert descriptions)
        - Filter 3: Principle or instance? (prefer principles)</action>
      <action priority="high">Review agent's categorized insight recommendations</action>
      <action priority="high">Use high-priority insights to inform skill content in step 4</action>
      <action priority="medium">Note excluded items to avoid re-discovering them</action>
    </actions>

    <acceptance-criteria>
      <criterion>insight-extractor agent launched with source material</criterion>
      <criterion>3-filter framework applied to all candidates</criterion>
      <criterion>Insights categorized by priority and type</criterion>
      <criterion>Token estimate provided for recommended inclusions</criterion>
    </acceptance-criteria>

    <blocks>3-apply-principles</blocks>
  </step>

  <step id="3-apply-principles" order="third" depends-on="2-determine-type">
    <description>Apply universal + type-specific principles to skill design</description>

    <actions>
      <action priority="critical">Create YAML frontmatter (name + description with WHAT + WHEN formula)</action>
      <action priority="critical">Define role (identity, purpose, expertise, scope) using XML</action>
      <action priority="high">Plan file structure (minimal/simple/comprehensive based on complexity)</action>
      <action priority="high">Design description for auto-discovery (3-5 WHEN triggers, rich keywords)</action>
      <action priority="medium">Plan token optimization strategy if comprehensive</action>
      <action priority="medium">Apply agent-optimization principles (#7, #9, #13, #23, #26)</action>
    </actions>

    <acceptance-criteria>
      <criterion>YAML frontmatter designed with valid syntax</criterion>
      <criterion>Description follows WHAT + WHEN formula (100-500 chars, ideal: 200-400)</criterion>
      <criterion>Role definition complete with all 4 elements</criterion>
      <criterion>File structure planned and documented</criterion>
    </acceptance-criteria>

    <blocks>4-create-files</blocks>
  </step>

  <step id="4-create-files" order="fourth" depends-on="3-apply-principles">
    <description>Create skill files in staging following type-specific patterns and scope-appropriate content strategy</description>

    <prerequisite>Write all files to the staging path: `$LOCALAPPDATA/Temp/skill-staging/{skill-name}/`. Do NOT write directly to `.claude/skills/` — see SKILL.md "Write Strategy" section.</prerequisite>

    <scope-specific-content-strategy>
      <if-user-scoped>
        <strategy>Self-contained with inline examples</strategy>
        <actions>
          <action>Include complete code examples inline in SKILL.md or EXAMPLES.md</action>
          <action>Document patterns with full code snippets</action>
          <action>Ensure skill works without any project-specific files</action>
        </actions>
        <rationale>User-scoped skills must be portable across all projects</rationale>
      </if-user-scoped>

      <if-project-scoped>
        <strategy>Show not tell - reference actual project files</strategy>
        <actions>
          <action>Create file reference tables pointing to actual codebase files</action>
          <action>Include "Read When" guidance for each referenced file</action>
          <action>Avoid duplicating code - the codebase IS the source of truth</action>
          <action>Use patterns like: "See `path/to/file.cs` for reference implementation"</action>
        </actions>
        <benefits>
          <benefit>Code stays in sync automatically (no stale examples)</benefit>
          <benefit>Smaller skill files (significant token reduction)</benefit>
          <benefit>Agents see real, current implementation</benefit>
          <benefit>Less maintenance burden</benefit>
        </benefits>
        <pattern>See UNIVERSAL.md "Show Not Tell Pattern for Project Skills" section</pattern>
      </if-project-scoped>
    </scope-specific-content-strategy>

    <actions>
      <action>Create SKILL.md with YAML frontmatter, role definition, and instructions</action>
      <action>Apply scope-appropriate content strategy (inline vs file references)</action>
      <action>Create supporting files as needed (EXAMPLES.md for user-scoped, file tables for project-scoped)</action>
      <action>Apply type-specific patterns from loaded README.md</action>
      <action>Include concrete examples appropriate to scope</action>
      <action>Ensure SKILL.md stays under 400 lines (externalize large content)</action>
    </actions>

    <acceptance-criteria>
      <criterion>All planned files created</criterion>
      <criterion>SKILL.md length appropriate (&lt;400 lines ideal)</criterion>
      <criterion>Type-specific patterns followed</criterion>
      <criterion>Scope-appropriate content strategy applied</criterion>
      <criterion>Examples included (inline for user-scoped, file references for project-scoped)</criterion>
    </acceptance-criteria>

    <blocks>5-validate</blocks>
  </step>

  <step id="5-validate" order="fifth" depends-on="4-create-files">
    <description>Validate skill quality with agent audit</description>

    <prerequisite>All skill files created and ready for review</prerequisite>

    <actions>
      <action priority="critical">Load validation/README.md to access validation protocol</action>
      <action priority="critical">Launch validation agent with audit prompt template</action>
      <action priority="high">Review agent findings comprehensively</action>
      <action priority="high">Address all Critical and Major issues found</action>
      <action priority="medium">Consider Minor issues and implement if time permits</action>
      <action priority="low">Iterate until Grade A+ achieved (if not already)</action>
    </actions>

    <acceptance-criteria>
      <criterion>Validation agent launched successfully</criterion>
      <criterion>Agent audit completed with full report</criterion>
      <criterion>All Critical issues resolved (0 remaining)</criterion>
      <criterion>All Major issues resolved (0 remaining)</criterion>
      <criterion>Grade A+ achieved</criterion>
    </acceptance-criteria>

    <blocks>6-deliver</blocks>
  </step>

  <step id="6-deliver" order="sixth" depends-on="5-validate">
    <description>Push staged skill to .claude/skills/ and deliver with usage guidance</description>

    <actions>
      <action priority="critical">Run `skill-edit push --dry-run {skill-name}` to preview, then `skill-edit push {skill-name}` to apply</action>
      <action priority="critical">Provide summary of created files with locations</action>
      <action priority="high">Explain how to test skill (try trigger keywords — skills hot-reload automatically)</action>
      <action priority="medium">Suggest next steps if applicable</action>
    </actions>

    <acceptance-criteria>
      <criterion>File summary delivered</criterion>
      <criterion>Usage guidance clear</criterion>
      <criterion>Hot-reload confirmed (no session restart needed)</criterion>
    </acceptance-criteria>
  </step>
</workflow>

## Request Pattern Matching

<request-patterns>
  <pattern id="general-skill-creation">
    <user-request-examples>
      <example>Create a skill for [domain/purpose]</example>
      <example>I need a skill that [capability description]</example>
      <example>Help me build a skill for [use case]</example>
    </user-request-examples>

    <triggers>
      <keyword>create</keyword>
      <keyword>skill</keyword>
      <keyword>build</keyword>
      <context>Domain or capability mentioned</context>
    </triggers>

    <execution-protocol>
      <step order="1">Execute Interactive Creation Workflow starting at step 1 (gather-requirements)</step>
      <step order="2">Determine skill type based on domain characteristics</step>
      <step order="3">Load UNIVERSAL.md + appropriate [type]/README.md</step>
      <step order="4">Complete workflow through validation and delivery</step>
    </execution-protocol>
  </pattern>

  <pattern id="type-specific-creation">
    <user-request-examples>
      <example>Create an expert skill for [domain]</example>
      <example>I need a CLI skill for [syntax/format]</example>
      <example>Create a writer skill for [documentation type]</example>
    </user-request-examples>

    <triggers>
      <keyword>create</keyword>
      <keyword>expert skill</keyword>
      <or-keyword>CLI skill</or-keyword>
      <or-keyword>writer skill</or-keyword>
    </triggers>

    <execution-protocol>
      <step order="1">Type already determined from user request (expert/CLI/writer)</step>
      <step order="2">Load UNIVERSAL.md (always required)</step>
      <step order="3">Load type-specific README.md (expert/, cli/, or writer/)</step>
      <step order="4">Execute Interactive Creation Workflow starting at step 3 (apply-principles)</step>
    </execution-protocol>
  </pattern>

  <pattern id="skill-validation">
    <user-request-examples>
      <example>Validate this skill</example>
      <example>Check if my skill follows best practices</example>
      <example>Audit skill quality</example>
    </user-request-examples>

    <triggers>
      <keyword>validate</keyword>
      <keyword>audit</keyword>
      <keyword>check</keyword>
      <context>Skill mentioned or implied</context>
    </triggers>

    <execution-protocol>
      <step order="1">Load validation/README.md to access validation checklists</step>
      <step order="2">Apply universal validation checklist (35 items)</step>
      <step order="3">Determine skill type and apply type-specific checklist (30-35 items)</step>
      <step order="4">Launch validation agent with audit prompt from validation/README.md</step>
      <step order="5">Report findings and provide path to Grade A+</step>
    </execution-protocol>
  </pattern>

  <pattern id="description-optimization">
    <user-request-examples>
      <example>Improve this skill's description</example>
      <example>Optimize description for auto-discovery</example>
      <example>Help me write a better skill description</example>
    </user-request-examples>

    <triggers>
      <keyword>improve</keyword>
      <keyword>optimize</keyword>
      <keyword>description</keyword>
    </triggers>

    <execution-protocol>
      <step order="1">Load UNIVERSAL.md to access description engineering section</step>
      <step order="2">Analyze current description against WHAT + WHEN formula</step>
      <step order="3">Identify missing triggers, vague capabilities, or insufficient keywords</step>
      <step order="4">Provide optimized description with explanation of improvements</step>
    </execution-protocol>
  </pattern>

  <pattern id="type-determination">
    <user-request-examples>
      <example>What type of skill should I create for [purpose]?</example>
      <example>Should this be an expert or CLI skill?</example>
      <example>Help me choose skill type</example>
    </user-request-examples>

    <triggers>
      <keyword>what type</keyword>
      <keyword>should</keyword>
      <keyword>choose</keyword>
      <context>Skill type decision needed</context>
    </triggers>

    <execution-protocol>
      <step order="1">Ask clarifying questions about skill purpose and domain</step>
      <step order="2">Apply decision logic from step 2-determine-type above</step>
      <step order="3">Explain type recommendation with rationale</step>
      <step order="4">Ask if user wants to proceed with recommended type</step>
    </execution-protocol>
  </pattern>
</request-patterns>

## Entry Point: Required Information

When user requests skill creation, gather this information:

| ID | Priority | Question | Examples |
|----|----------|----------|----------|
| domain | Critical | What domain or purpose? | React, Python testing, API docs |
| capabilities | Critical | What should skill accomplish? | Create files, validate syntax |
| scope | Critical | User-scoped or project-scoped? | ~/.claude/skills/ vs .claude/skills/ |
| constraints | High | Any requirements or constraints? | Token limits, patterns |
| complexity | Medium | Expected complexity? | Simple (<200 lines) or Comprehensive |

**Scope implications:**
- **User-scoped:** Self-contained with inline examples (portable across projects)
- **Project-scoped:** Reference actual project files ("show not tell" pattern)
