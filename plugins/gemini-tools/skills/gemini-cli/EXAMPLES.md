# Gemini CLI Examples

Complete usage examples for Gemini CLI commands.

## File Inclusion with @ (Recommended)

**Use `@` syntax to include files directly** - Gemini has a 1M context window and reads files more efficiently than Claude passing file contents in prompts.

### Single File Analysis
```bash
# Analyze a specific file
gemini -p "Review @src/main.ts for potential bugs"

# Explain what a file does
gemini -p "Explain the purpose and key functions in @lib/parser.ts"

# Get improvement suggestions
gemini -p "Suggest improvements for @utils/helpers.js"
```

### Multiple File Comparison
```bash
# Compare two implementations
gemini -p "Compare @v1/handler.ts and @v2/handler.ts - what changed and why?"

# Check interface implementation
gemini -p "Does @src/api/client.ts correctly implement the interface in @types/api.d.ts?"

# Understand relationships
gemini -p "How does @src/hooks/useAuth.ts interact with @src/context/AuthProvider.tsx?"
```

### Directory Analysis
```bash
# Analyze entire directory
gemini -p "Describe the architecture of @./src/components"

# Understand module structure
gemini -p "What patterns are used in @./src/services?"

# Security review
gemini -p "Review @./src/auth for security vulnerabilities"
```

### Glob Patterns
```bash
# All test files
gemini -p "Review @**/*.test.ts for test coverage gaps"

# All TypeScript files in a folder
gemini -p "Find code duplication in @src/**/*.ts"

# Specific file types
gemini -p "Analyze all configuration files: @*.config.js @*.config.ts"
```

### @ with Additional Context
```bash
# Code review with requirements
gemini -p "Review @src/checkout.ts against these requirements:
1. Must validate payment info
2. Must handle errors gracefully
3. Must log all transactions"

# Refactoring with constraints
gemini -p "Refactor @legacy/utils.js to TypeScript, maintaining the same public API"
```

## Basic Queries

### Simple Question
```bash
gemini -p "What is the capital of France?"
```
**Output:** Plain text response

### Multi-line Prompt
```bash
gemini -p "Explain the following concepts:
1. REST APIs
2. GraphQL
3. gRPC"
```

### Prompt with Special Characters
```bash
gemini -p "What does the regex pattern ^[a-z]+$ match?"
```

## Output Formats

### JSON Output for Parsing
```bash
gemini -p "List the planets in our solar system" --output-format json
```

**Parse with jq:**
```bash
gemini -p "List 5 colors as JSON array" --output-format json | jq '.response'
```

### Streaming JSON for Long Responses
```bash
gemini -p "Write a detailed essay on climate change" --output-format stream-json
```

## Model Selection

### Fast Model for Quick Queries
```bash
gemini -m gemini-2.5-flash -p "What is 2+2?"
```

### Pro Model for Complex Reasoning
```bash
gemini -m gemini-2.5-pro -p "Analyze the trade-offs between microservices and monolithic architecture"
```

## Code Generation

### Generate a Function
```bash
gemini -p "Write a Python function to check if a number is prime"
```

### Generate with Specific Requirements
```bash
gemini -p "Write a TypeScript function that:
- Takes an array of numbers
- Returns the sum of even numbers
- Includes JSDoc comments
- Has proper error handling"
```

### Code Review Request
```bash
gemini -p "Review this code for bugs:
function add(a, b) {
  return a + b
}
add('1', 2)"
```

## Directory Context

### Analyze Project Structure
```bash
gemini --include-directories ./src -p "Describe the architecture of this codebase"
```

### Multiple Directories
```bash
gemini --include-directories ./src,./lib,./tests -p "How do these components interact?"
```

## Scripting and Automation

### Store Response in Variable (Bash)
```bash
RESPONSE=$(gemini -p "Generate a random UUID" --output-format json | jq -r '.response')
echo "Generated: $RESPONSE"
```

### Conditional Logic Based on Response
```bash
ANSWER=$(gemini -p "Is 7 a prime number? Answer only yes or no")
if [[ "$ANSWER" == *"yes"* ]]; then
  echo "7 is prime"
fi
```

### Loop with Rate Limiting
```bash
for file in *.py; do
  echo "Analyzing $file..."
  gemini -p "Summarize this Python file: $(cat $file)"
  sleep 1  # Rate limit protection
done
```

### Pipeline Integration
```bash
cat error.log | head -50 | gemini -p "Analyze these error logs and identify the root cause"
```

### Generate and Save to File
```bash
gemini -p "Generate a README template for a Node.js project" > README.md
```

## NPX Usage (No Installation)

### One-off Query
```bash
npx @google/gemini-cli -p "Explain Docker containers"
```

### With All Options
```bash
npx @google/gemini-cli -m gemini-2.5-flash -p "Quick question" --output-format json
```

## Environment Variable Setup

### Set API Key for Session
```bash
export GEMINI_API_KEY="your-api-key-here"
gemini -p "Test query"
```

### One-liner with API Key
```bash
GEMINI_API_KEY="your-key" gemini -p "Query with inline key"
```

## Error Handling in Scripts

### Check Exit Code
```bash
if gemini -p "Test query" > /dev/null 2>&1; then
  echo "Query succeeded"
else
  echo "Query failed"
fi
```

### Capture Error Output
```bash
OUTPUT=$(gemini -p "Your query" 2>&1)
if [[ $? -ne 0 ]]; then
  echo "Error: $OUTPUT"
  exit 1
fi
echo "Success: $OUTPUT"
```

### Retry on Failure
```bash
MAX_RETRIES=3
for i in $(seq 1 $MAX_RETRIES); do
  if gemini -p "Your query" --output-format json > result.json 2>&1; then
    echo "Success on attempt $i"
    break
  fi
  echo "Attempt $i failed, retrying..."
  sleep $((i * 2))  # Exponential backoff
done
```

## Advanced Patterns

### Chain Multiple Queries
```bash
# First query
SUMMARY=$(gemini -p "Summarize: $(cat document.txt)")

# Second query using first result
gemini -p "Based on this summary, what are the key action items? Summary: $SUMMARY"
```

### Template-Based Prompts
```bash
TEMPLATE="Translate the following text to {LANGUAGE}: {TEXT}"
LANGUAGE="Spanish"
TEXT="Hello, how are you?"

PROMPT=$(echo "$TEMPLATE" | sed "s/{LANGUAGE}/$LANGUAGE/" | sed "s/{TEXT}/$TEXT/")
gemini -p "$PROMPT"
```

### JSON Structured Output Request
```bash
gemini -p 'Return a JSON object with fields "name", "age", "city" for a fictional person' --output-format json
```

## Real-World Use Cases

### Code Review (Prefer @ for in-project files)
```bash
# PREFERRED: Use @ for project files
gemini -p "Review @src/myfunction.py - add docstrings and suggest improvements"

# FALLBACK: Use cat only for files outside project scope
cat /external/path/myfunction.py | gemini -p "Generate docstrings for this Python code"
```

### Git Commit Message Generator
```bash
# Must use pipe - git diff output is dynamic
git diff --staged | gemini -p "Generate a concise commit message for these changes"
```

### Architecture Understanding
```bash
# Use @ to analyze entire directories
gemini -p "Explain how @./src/api connects to @./src/database - draw the data flow"
```

### Log Analysis
```bash
# Use pipe for dynamic/filtered output
tail -100 /var/log/app.log | gemini -p "Identify any errors or warnings and suggest fixes"
```

### API Response Explanation
```bash
# Use pipe for external API responses
curl -s "https://api.example.com/data" | gemini -p "Explain this API response structure"
```

### Comprehensive Code Review
```bash
# Use @ for multi-file review - leverages Gemini's 1M context
gemini -p "Perform a security review of:
- @src/auth/login.ts
- @src/auth/session.ts
- @src/middleware/auth.ts
Look for: SQL injection, XSS, session hijacking vulnerabilities"
```

### Quick Research
```bash
gemini -p "Compare PostgreSQL vs MySQL for a high-traffic web application. Include pros and cons."
```

## @ vs Pipe: When to Use Each

| Scenario | Use @ | Use Pipe |
|----------|-------|----------|
| Project source files | ✅ `@src/file.ts` | ❌ |
| Multiple project files | ✅ `@file1.ts @file2.ts` | ❌ |
| Entire directories | ✅ `@./src/components` | ❌ |
| Git diff output | ❌ | ✅ `git diff \| gemini` |
| Files outside project | ❌ | ✅ `cat /path \| gemini` |
| Filtered/processed data | ❌ | ✅ `grep X \| gemini` |
| API responses | ❌ | ✅ `curl \| gemini` |
| Log tail/head | ❌ | ✅ `tail -100 \| gemini` |

**Rule of thumb:** If it's a file in your project, use `@`. If it's dynamic/filtered/external, use pipe.
