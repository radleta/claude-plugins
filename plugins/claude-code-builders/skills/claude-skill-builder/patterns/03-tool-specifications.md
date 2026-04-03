# Pattern Category 3: Tool Specifications

### Pattern 6: Basic Tool Usage

**Before:**
```markdown
Use Grep to find patterns in the code.
```

**After:**
```xml
<tool name="Grep">
  <purpose>Search for code patterns across multiple files</purpose>

  <when-to-use>
    <scenario>Finding all usages of a function or class</scenario>
    <scenario>Searching for specific patterns using regex</scenario>
    <scenario>Discovering how something is used in codebase</scenario>
  </when-to-use>

  <when-not-to-use>
    <scenario>Reading full file content (use Read instead)</scenario>
    <scenario>Finding files by name (use Glob instead)</scenario>
    <scenario>Searching for text in a specific known file (use Read instead)</scenario>
  </when-not-to-use>

  <syntax>
    <parameter name="pattern" required="true">
      Regex pattern to search for
    </parameter>
    <parameter name="path" required="false" default="current directory">
      Directory or file to search in
    </parameter>
    <parameter name="output_mode" required="false" default="files_with_matches">
      Options: files_with_matches | content | count
    </parameter>
  </syntax>

  <examples>
    <example>
      <description>Find all files using React hooks</description>
      <usage>Grep pattern="use[A-Z]\\w+" path="src/" output_mode="files_with_matches"</usage>
    </example>
    <example>
      <description>See actual usage of useState in code with context</description>
      <usage>Grep pattern="useState" path="src/" output_mode="content" -n=true -C=2</usage>
    </example>
  </examples>
</tool>
```

**Why Better:**
- When to use AND when not to use
- Full syntax specification
- All parameters documented
- Concrete usage examples
- Clear purpose

---

### Pattern 7: Complete Tool Documentation

**Before:**
```markdown
The Task tool launches agents. Use it when you need specialized help.
```

**After:**
```xml
<tool name="Task">
  <purpose>
    Launch specialized sub-agent to handle complex, multi-step tasks autonomously
  </purpose>

  <when-to-use>
    <scenario>Task requires specialized domain knowledge (QA, database, security)</scenario>
    <scenario>Multi-step process best handled by dedicated agent</scenario>
    <scenario>Task matches a specialized agent type description</scenario>
  </when-to-use>

  <when-not-to-use>
    <scenario>Simple single-tool operation (just use the tool directly)</scenario>
    <scenario>Already inside an agent (avoid recursive agent launching)</scenario>
    <scenario>Task requires user interaction (agents can't interact with user)</scenario>
  </when-not-to-use>

  <parameters>
    <parameter name="subagent_type" type="string" required="true">
      <description>Type of specialized agent to launch</description>
      <options>
        <option>general-purpose - Complex multi-step tasks</option>
        <option>Explore - Fast codebase exploration and search</option>
        <option>code-reviewer - Expert code review and analysis</option>
        <option>[See full list in tool description]</option>
      </options>
    </parameter>

    <parameter name="prompt" type="string" required="true">
      <description>Detailed task description for the agent</description>
      <guidelines>
        - Be specific and comprehensive
        - Include context and requirements
        - Specify what information agent should return
        - Indicate whether to write code or just research
      </guidelines>
    </parameter>

    <parameter name="description" type="string" required="true">
      <description>Short 3-5 word description of the task</description>
    </parameter>
  </parameters>

  <examples>
    <example>
      <scenario>Need to explore codebase for API patterns</scenario>
      <usage>
        Task subagent_type="Explore"
             prompt="Find all API endpoint definitions in the codebase. Look for REST endpoints, GraphQL resolvers, and any route definitions. Document patterns used."
             description="Explore API patterns"
      </usage>
    </example>

    <example>
      <scenario>Need code review of recent changes</scenario>
      <usage>
        Task subagent_type="code-reviewer"
             prompt="Review the changes in src/components/Button.tsx for code quality, security issues, and adherence to React best practices. Provide specific feedback."
             description="Review Button component"
      </usage>
    </example>
  </examples>

  <best-practices>
    <practice>Launch multiple agents in parallel when tasks are independent</practice>
    <practice>Provide comprehensive prompts (agents work autonomously)</practice>
    <practice>Specify expected output format in prompt</practice>
    <practice>Don't launch agents for simple tasks (use tools directly)</practice>
  </best-practices>
</tool>
```

**Why Better:**
- Complete specification
- All parameters documented with guidelines
- Multiple examples covering different scenarios
- Best practices included
- Clear when/when-not guidance

---
