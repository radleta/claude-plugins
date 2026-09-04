---
name: gemini-cli
description: "Complete Gemini CLI syntax including installation, authentication, command flags, output formats, and scripting patterns. Use when calling Gemini from command line, running gemini CLI commands, automating AI queries with scripts, or integrating Gemini responses into workflows — even for simple one-off queries."
---

<role>
  <identity>Gemini CLI command execution specialist</identity>
  <purpose>Enable Claude to correctly invoke Gemini CLI for AI queries from the command line</purpose>
  <expertise>
    <area>Gemini CLI installation and setup</area>
    <area>Authentication methods (Google login, API key, Vertex AI)</area>
    <area>Command flags and options</area>
    <area>Output format handling (text, JSON, stream-json)</area>
    <area>Scripting and automation patterns</area>
  </expertise>
  <scope>
    <in-scope>
      <item>Running Gemini CLI commands via Bash</item>
      <item>Constructing prompts for non-interactive mode</item>
      <item>Parsing JSON output for automation</item>
      <item>Model selection and configuration</item>
    </in-scope>
    <out-of-scope>
      <item>Gemini API SDK usage (use REST API or SDK docs)</item>
      <item>Google Cloud configuration beyond Gemini</item>
      <item>Gemini model training or fine-tuning</item>
    </out-of-scope>
  </scope>
</role>

## Prerequisites

- Node.js version 20 or higher
- macOS, Linux, or Windows

## Installation

**NPX (no installation required):**
```bash
npx @google/gemini-cli
```

**Global NPM installation:**
```bash
npm install -g @google/gemini-cli
```

**Homebrew (macOS/Linux):**
```bash
brew install gemini-cli
```

## Authentication

<authentication-options>
  <option id="google-login" recommended="true">
    <name>Google Login (Recommended)</name>
    <limits>60 requests/min, 1,000 requests/day</limits>
    <setup>Run `gemini` and follow browser prompts</setup>
    <command>gemini</command>
  </option>

  <option id="api-key">
    <name>Gemini API Key</name>
    <limits>Based on API tier</limits>
    <setup>Get key from https://aistudio.google.com/apikey</setup>
    <command>
      export GEMINI_API_KEY="YOUR_KEY"
      gemini
    </command>
  </option>

  <option id="vertex-ai">
    <name>Vertex AI (Enterprise)</name>
    <limits>Based on Google Cloud quota</limits>
    <setup>Configure Google Cloud project</setup>
    <command>
      export GOOGLE_API_KEY="YOUR_KEY"
      export GOOGLE_GENAI_USE_VERTEXAI=true
      gemini
    </command>
    <project-config>
      export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
    </project-config>
  </option>
</authentication-options>

## Critical: Run from Project Root

**ALWAYS run Gemini CLI from the project root directory** to ensure proper scope and context:

```bash
# Correct - run from project root
cd /path/to/project
gemini -p "Analyze this codebase"

# Gemini CLI reads project context from current directory
# Including GEMINI.md if present
```

**Why this matters:**
- Gemini CLI uses current directory as the project scope
- `@` file references are relative to current directory
- GEMINI.md project instructions are loaded from current directory
- Directory inclusion works relative to where you run the command

## File and Directory Inclusion with @

**Gemini has a 1M token context window** - significantly larger than other models. Instead of Claude reading files then writing contents into prompts (wasting Claude's tokens), use `@` syntax to let Gemini read files directly.

### @ Syntax Reference

| Syntax | Purpose | Example |
|--------|---------|---------|
| `@file.txt` | Include single file contents | `gemini -p "Review @src/main.ts"` |
| `@./directory` | Include all files in directory | `gemini -p "Analyze @./src"` |
| `@**/*.ts` | Include files matching glob | `gemini -p "Review @**/*.test.ts"` |
| Multiple @ refs | Include multiple sources | `gemini -p "Compare @file1.ts and @file2.ts"` |

### Token Efficiency Pattern

<token-efficiency>
  <bad-pattern name="claude-reads-then-writes">
    <description>Claude reads files, writes contents into prompt - wastes Claude tokens</description>
    <example>
      # DON'T DO THIS - wastes Claude's context window
      FILE_CONTENT=$(cat src/main.ts)
      gemini -p "Review this code: $FILE_CONTENT"
    </example>
    <problem>Claude reads file, holds in memory, writes to prompt string</problem>
  </bad-pattern>

  <good-pattern name="direct-file-reference">
    <description>Use @ to let Gemini read files directly with its 1M context</description>
    <example>
      # DO THIS - Gemini reads file directly
      gemini -p "Review @src/main.ts"
    </example>
    <benefit>Claude doesn't need to read file contents - just constructs the command</benefit>
  </good-pattern>
</token-efficiency>

**When to use @ (preferred):**
- Files are within the project scope (current directory or subdirectories)
- Analyzing, reviewing, or understanding code
- Comparing multiple files
- Any file that Gemini needs to see

**When to use cat/pipe (fallback):**
- Files outside project scope
- Dynamically generated content
- Filtered/processed output (e.g., `git diff | gemini`)
- When @ syntax doesn't support the path pattern

### @ Usage Examples

```bash
# Single file review
gemini -p "Explain what @src/utils/parser.ts does"

# Multiple files comparison
gemini -p "Compare the implementations in @v1/handler.ts and @v2/handler.ts"

# Directory analysis
gemini -p "Describe the architecture in @./src/components"

# Glob pattern for test files
gemini -p "Review all tests in @**/*.test.ts for coverage gaps"

# Mixed: @ files with additional context
gemini -p "Given the interface in @types/api.ts, does @src/client.ts implement it correctly?"
```

## Core Command Syntax

### Non-Interactive Mode (Scripting)

**Primary pattern for Claude to use:**
```bash
gemini -p "Your prompt here"
```

**With JSON output (recommended for parsing):**
```bash
gemini -p "Your prompt here" --output-format json
```

**With streaming JSON:**
```bash
gemini -p "Your prompt here" --output-format stream-json
```

### Command Flags Reference

| Flag | Long Form | Purpose | Example |
|------|-----------|---------|---------|
| `-p` | `--prompt` | Pass prompt for non-interactive execution | `gemini -p "Explain X"` |
| `-m` | `--model` | Specify model to use | `gemini -m gemini-2.5-flash` |
| | `--output-format` | Output format: text, json, stream-json | `--output-format json` |
| | `--include-directories` | Include additional directories in context | `--include-directories ../lib,../docs` |
| `@` | (inline syntax) | Include file/directory in prompt | `gemini -p "Review @src/file.ts"` |

### Available Models

| Model | Use Case | Notes |
|-------|----------|-------|
| `gemini-2.5-flash` | Fast, efficient queries | Good balance of speed and capability |
| `gemini-2.5-pro` | Complex reasoning | Higher capability, slower |
| Default (unspecified) | General use | Uses account default |

## Execution Patterns for Claude

<execution-patterns>
  <pattern id="file-review" priority="high">
    <name>File Review with @</name>
    <when>Need to analyze, review, or explain code files</when>
    <command>gemini -p "Review @src/main.ts for bugs and improvements"</command>
    <output-type>Plain text analysis</output-type>
    <note>PREFERRED - uses @ to let Gemini read file directly (1M context)</note>
  </pattern>

  <pattern id="multi-file-analysis" priority="high">
    <name>Multi-File Analysis with @</name>
    <when>Need to compare, relate, or analyze multiple files</when>
    <command>gemini -p "How does @src/api/client.ts use the types defined in @src/types/index.ts?"</command>
    <output-type>Plain text analysis</output-type>
    <note>Reference multiple files with @ - Gemini's 1M context handles large codebases</note>
  </pattern>

  <pattern id="directory-analysis" priority="high">
    <name>Directory Analysis with @</name>
    <when>Need to understand folder structure or module architecture</when>
    <command>gemini -p "Explain the architecture of @./src/components"</command>
    <output-type>Plain text analysis</output-type>
    <note>Include entire directories - Gemini can handle it</note>
  </pattern>

  <pattern id="simple-query">
    <name>Simple Question</name>
    <when>Need quick answer without file context</when>
    <command>gemini -p "What is the capital of France?"</command>
    <output-type>Plain text</output-type>
  </pattern>

  <pattern id="json-query">
    <name>Structured Response</name>
    <when>Need to parse response programmatically</when>
    <command>gemini -p "List 3 programming languages as JSON array" --output-format json</command>
    <output-type>JSON object</output-type>
    <parsing>Use jq or JSON parser on output</parsing>
  </pattern>

  <pattern id="code-generation">
    <name>Code Generation</name>
    <when>Need code output</when>
    <command>gemini -p "Write a Python function to calculate fibonacci"</command>
    <output-type>Plain text with code blocks</output-type>
  </pattern>

  <pattern id="pipe-fallback">
    <name>Pipe Input (Fallback)</name>
    <when>Dynamic content, filtered output, or files outside project scope</when>
    <command>git diff --staged | gemini -p "Generate commit message for these changes"</command>
    <output-type>Plain text</output-type>
    <note>Use pipe when @ won't work - but prefer @ for in-project files</note>
  </pattern>

  <pattern id="specific-model">
    <name>Specific Model Selection</name>
    <when>Need particular model capabilities</when>
    <command>gemini -m gemini-2.5-pro -p "Complex reasoning task"</command>
    <output-type>Depends on prompt</output-type>
  </pattern>
</execution-patterns>

## Output Format Details

### Plain Text (Default)
```bash
gemini -p "Explain REST APIs"
# Returns: Human-readable text response
```

### JSON Format
```bash
gemini -p "What is 2+2?" --output-format json
# Returns: {"response": "...", "metadata": {...}}
```

**JSON output structure:**
- `response` - The model's text response
- `metadata` - Request metadata (model, tokens, etc.)

### Stream JSON Format
```bash
gemini -p "Long explanation" --output-format stream-json
# Returns: Line-by-line JSON events as response streams
```

**Use for:** Long responses where incremental output is needed

## Configuration

Settings stored in: `~/.gemini/settings.json`

Project-specific context: Create `GEMINI.md` file in project root to tailor behavior.

## Built-in Capabilities

The Gemini CLI includes:
- Google Search grounding (web search integration)
- File operations
- Shell commands
- Web fetching
- MCP (Model Context Protocol) support for extensions

## Troubleshooting

<troubleshooting>
  <issue id="auth-failed">
    <symptom>Authentication error or "Not authorized"</symptom>
    <diagnosis>
      1. Check if GEMINI_API_KEY is set: `echo $GEMINI_API_KEY`
      2. Verify key is valid at https://aistudio.google.com/apikey
      3. Check rate limits haven't been exceeded
    </diagnosis>
    <solution>
      - Re-run `gemini` to trigger Google login
      - Or set valid API key: `export GEMINI_API_KEY="your-key"`
    </solution>
  </issue>

  <issue id="node-version">
    <symptom>"Node.js version too old" or npm install fails</symptom>
    <diagnosis>Check Node version: `node --version`</diagnosis>
    <solution>Upgrade to Node.js 20+: `nvm install 20 && nvm use 20`</solution>
  </issue>

  <issue id="command-not-found">
    <symptom>"gemini: command not found"</symptom>
    <diagnosis>CLI not installed globally</diagnosis>
    <solution>
      - Use npx: `npx @google/gemini-cli -p "prompt"`
      - Or install globally: `npm install -g @google/gemini-cli`
    </solution>
  </issue>

  <issue id="rate-limit">
    <symptom>"Rate limit exceeded" or 429 error</symptom>
    <diagnosis>Too many requests in time window</diagnosis>
    <solution>
      - Wait and retry (limits reset per minute/day)
      - Use API key for higher limits
      - Use Vertex AI for enterprise quotas
    </solution>
  </issue>

  <issue id="empty-response">
    <symptom>Empty or truncated response</symptom>
    <diagnosis>Prompt may be unclear or response filtered</diagnosis>
    <solution>
      - Rephrase prompt more clearly
      - Check for content policy issues
      - Try different model with -m flag
    </solution>
  </issue>
</troubleshooting>

## Validation Checklist

Before running Gemini CLI commands, verify:

**Environment (4 items)**
- [ ] Running from project root directory (critical for @ references)
- [ ] Node.js 20+ installed: `node --version`
- [ ] Gemini CLI accessible: `npx @google/gemini-cli --version` or `gemini --version`
- [ ] Authentication configured (API key or Google login)

**File References (3 items)**
- [ ] Using `@` for in-project files (preferred over cat/pipe)
- [ ] File paths are relative to current directory
- [ ] For files outside project, use pipe fallback (`cat file | gemini`)

**Command Syntax (4 items)**
- [ ] Using `-p` flag for non-interactive prompts
- [ ] Prompt is properly quoted (use double quotes)
- [ ] Output format flag is valid: `json`, `stream-json`, or omitted for text
- [ ] Model name is valid if using `-m` flag

**For Automation (3 items)**
- [ ] Using `--output-format json` for parseable output
- [ ] Handling potential errors in scripts
- [ ] Respecting rate limits in loops

## Examples

See [EXAMPLES.md](EXAMPLES.md) - Use Read tool when need complete usage examples (provides 15+ patterns for queries, automation, and integration scenarios).

## Quick Reference

**Review a file (PREFERRED - uses @ for Gemini's 1M context):**
```bash
gemini -p "Review @src/main.ts for bugs"
```

**Analyze multiple files:**
```bash
gemini -p "How does @api/client.ts use @types/api.d.ts?"
```

**Analyze directory:**
```bash
gemini -p "Explain the architecture of @./src/components"
```

**Ask a question:**
```bash
gemini -p "Your question here"
```

**Get JSON response:**
```bash
gemini -p "Your question" --output-format json
```

**Use specific model:**
```bash
gemini -m gemini-2.5-flash -p "Your question"
```

**With npx (no install):**
```bash
npx @google/gemini-cli -p "Your question"
```

**Pipe fallback (for dynamic/external content):**
```bash
git diff --staged | gemini -p "Generate commit message"
```
