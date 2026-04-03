# Plugin Templates

Starter templates at three complexity levels. Copy and customize for your plugins.

## Minimal Plugin (Single Skill)

The simplest possible plugin — one skill, no extras.

### Structure

```
my-skill-plugin/
  .claude-plugin/
    plugin.json
  skills/
    my-skill/
      SKILL.md
  README.md
```

### plugin.json

```json
{
  "name": "my-skill-plugin",
  "version": "1.0.0",
  "description": "A focused skill for [domain]"
}
```

### skills/my-skill/SKILL.md

```yaml
---
name: my-skill
description: "Validated patterns for [domain]. Use when [scenario 1], [scenario 2], or [scenario 3] — even for [edge case]."
---
```

```markdown
# My Skill

<role>
  <identity>Expert [domain] specialist</identity>
  <purpose>Guide [what this skill helps accomplish]</purpose>
  <expertise>
    <area>[Area 1]</area>
    <area>[Area 2]</area>
  </expertise>
  <scope>
    <in-scope>
      <item>[What this covers]</item>
    </in-scope>
    <out-of-scope>
      <item>[What this doesn't cover]</item>
    </out-of-scope>
  </scope>
</role>

## Core Content

[Domain knowledge, patterns, checklists, examples]
```

### README.md

```markdown
# My Skill Plugin

[What this plugin does]

## Installation

\`\`\`
/plugin install my-skill-plugin
\`\`\`

## Usage

[How to use the skill — what queries trigger it]

## Components

- **my-skill**: [Brief description]
```

---

## Moderate Plugin (Skill + Command + Hook)

A practical plugin with a skill for knowledge, a command for user invocation, and a hook for automation.

### Structure

```
code-guard-plugin/
  .claude-plugin/
    plugin.json
  skills/
    code-guard/
      SKILL.md
  commands/
    guard-check.md
  hooks/
    pre-commit.js
  README.md
```

### plugin.json

```json
{
  "name": "code-guard-plugin",
  "version": "1.0.0",
  "description": "Automated code quality checks with pre-commit validation",
  "author": {
    "name": "Your Name"
  },
  "keywords": ["code-quality", "guard", "pre-commit"],
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "node hooks/pre-commit.js"
      }
    ]
  }
}
```

### skills/code-guard/SKILL.md

```yaml
---
name: code-guard
description: "Code quality guard patterns for pre-commit validation and dangerous operation prevention. Use when reviewing code safety, setting up commit guards, or preventing destructive commands — even for quick scripts."
---
```

```markdown
# Code Guard

[Quality patterns, dangerous command lists, validation rules]
```

### commands/guard-check.md

```yaml
---
description: "Run code guard checks on staged changes"
user-invocable: true
argument-hint: "[--strict] [--fix]"
---

Run the code-guard skill's validation checklist against the currently staged changes.
Report findings in a structured format with severity levels.
```

### hooks/pre-commit.js

```javascript
const fs = require('fs');
const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));

if (input.tool_name === 'Bash') {
  const cmd = input.tool_input?.command || '';
  const blocked = ['rm -rf /', 'drop database', '--force --no-verify'];
  
  for (const pattern of blocked) {
    if (cmd.includes(pattern)) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `Blocked: command contains "${pattern}"`
      }));
      process.exit(2);
    }
  }
}

process.exit(0);
```

---

## Comprehensive Plugin (Full Stack)

A complete plugin with all component types for a team development workflow.

### Structure

```
team-workflow-plugin/
  .claude-plugin/
    plugin.json
  skills/
    team-conventions/
      SKILL.md
      CHECKLISTS.md
    pr-review/
      SKILL.md
  commands/
    review-pr.md
    check-conventions.md
  agents/
    pr-reviewer.md
    convention-checker.md
  hooks/
    on-commit.sh
    pre-push.js
  .mcp.json
  README.md
```

### plugin.json

```json
{
  "name": "team-workflow-plugin",
  "version": "2.0.0",
  "description": "Complete team development workflow with PR reviews, conventions, and automation",
  "author": {
    "name": "Team Lead",
    "email": "lead@team.com"
  },
  "repository": "https://github.com/team/workflow-plugin",
  "license": "MIT",
  "keywords": ["team", "workflow", "pr-review", "conventions"],
  "hooks": {
    "Stop": [
      {
        "command": "bash hooks/on-commit.sh"
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "node hooks/pre-push.js"
      }
    ]
  },
  "mcpServers": ".mcp.json"
}
```

### .mcp.json

```json
{
  "mcpServers": {
    "github-api": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### agents/pr-reviewer.md

```yaml
---
name: pr-reviewer
description: "Reviews pull requests for quality, conventions, and completeness"
model: sonnet
skills:
  - pr-review
  - team-conventions
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(git *)
---

Review the pull request described in the task context.
Apply the pr-review and team-conventions skills to check quality.
Report findings with severity levels and specific file:line references.
```

### commands/review-pr.md

```yaml
---
description: "Review a PR for quality and team conventions"
user-invocable: true
argument-hint: "<pr-number>"
allowed-tools:
  - Agent
  - Read
  - Bash(gh *)
---

Review PR #$1 using the pr-reviewer agent.

1. Fetch PR details with `gh pr view $1`
2. Get the diff with `gh pr diff $1`
3. Launch the pr-reviewer agent with the PR context
4. Summarize findings for the user
```

---

## MCP Server Plugin Template

A plugin that primarily provides MCP server integrations.

### Structure

```
api-connector-plugin/
  .claude-plugin/
    plugin.json
  skills/
    api-usage/
      SKILL.md
  .mcp.json
  README.md
```

### plugin.json

```json
{
  "name": "api-connector-plugin",
  "version": "1.0.0",
  "description": "Connect to [API name] with pre-configured tools and usage patterns",
  "mcpServers": ".mcp.json"
}
```

### .mcp.json

```json
{
  "mcpServers": {
    "my-api": {
      "command": "node",
      "args": ["./server/index.js"],
      "env": {
        "API_KEY": "${MY_API_KEY}",
        "API_BASE_URL": "https://api.example.com/v1"
      }
    }
  }
}
```

### skills/api-usage/SKILL.md

```yaml
---
name: api-usage
description: "[API name] integration patterns and best practices. Use when calling [API name], handling API responses, or troubleshooting API errors."
---
```

```markdown
# API Usage Guide

## Authentication

[How to set up API keys, environment variables]

## Common Operations

[Typical API calls, expected responses, error handling]

## Rate Limits and Best Practices

[Throttling, caching, retry patterns]
```

---

## Template Selection Guide

| Your Need | Template | Components |
|-----------|----------|------------|
| Share domain knowledge | Minimal | 1 skill |
| Automate a workflow | Moderate | Skill + command + hook |
| Team development process | Comprehensive | Skills + commands + agents + hooks + MCP |
| External API integration | MCP Server | Skill + MCP server |
| Simple utility command | Minimal (command variant) | 1 command |
