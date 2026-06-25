---
tags: [mdite/commands]
updated: 2026-04-07
summary: "Full command reference: lint, files, deps, cat, config, and init with all flags and composition patterns"
---

# Commands Reference

## lint — Validate documentation structure

Builds dependency graph from entrypoint and checks for orphans, broken file links, and broken anchor links.

```bash
mdite lint                              # Validate from current directory
mdite lint ./docs                       # Lint specific directory
mdite lint --format json                # JSON output for CI/CD
mdite lint --format grep                # Tab-delimited for awk/cut
mdite lint --depth 2                    # Limit traversal depth
mdite lint --exclude "archive/**"       # Exclude patterns (gitignore-style)
mdite lint --respect-gitignore          # Honor .gitignore patterns
mdite lint --external-links ignore      # Skip external link validation
mdite lint --quiet || echo "FAILED"     # Scripting mode
```

**Multi-file mode** — lint changed files only (pre-commit hooks):
```bash
mdite lint $(git diff --cached --name-only | grep '\.md$') --depth 1
```

**Output formats:**

| Format | Stdout | Use case |
|--------|--------|----------|
| `text` | Human-readable, file:line:col, colored | Interactive terminal |
| `json` | `[{file, line, column, severity, rule, message}]` | CI/CD, jq processing |
| `grep` | Tab-delimited 8 fields | awk, cut, shell scripts |

**Exit codes:** 0 = no errors, 1 = validation errors, 2 = invalid arguments, 130 = interrupted

## files — List files in documentation graph

```bash
mdite files                             # All reachable files
mdite files --orphans                   # Only orphaned files
mdite files --depth 2                   # Files at depth <= 2
mdite files --format json               # JSON with {file, depth, orphan}
mdite files --with-depth                # Annotate with depth info
mdite files --sort incoming             # Sort by most referenced
mdite files --sort outgoing             # Sort by most connections
mdite files --sort depth                # Shallowest first
mdite files --absolute                  # Full paths
mdite files --print0 | xargs -0 ls -l  # Null-separated for xargs
mdite files --frontmatter "status=='published'"  # JMESPath filter
```

**Composition patterns:**
```bash
mdite files | xargs rg "TODO"           # Search reachable docs
mdite files --orphans | xargs rm        # Remove orphans (careful!)
mdite files | wc -l                     # Count docs
mdite files --frontmatter "contains(tags, 'api')" | xargs prettier --write
```

## deps — Show file dependencies

```bash
mdite deps README.md                    # All dependencies (tree view)
mdite deps docs/api.md --incoming       # What references this file?
mdite deps docs/guide.md --outgoing     # What does this file link to?
mdite deps README.md --depth 2          # Limit traversal
mdite deps README.md --format list      # Flat list (pipe-friendly)
mdite deps README.md --format json      # {file, stats, incoming[], outgoing[], cycles[]}
```

**Use cases:**
- Impact analysis before refactoring: `mdite deps docs/api.md --incoming`
- Cleanup check (is file still referenced?): `mdite deps docs/old.md --incoming`
- Navigation discovery: `mdite deps docs/guide.md --outgoing`

## cat — Output documentation content

```bash
mdite cat                               # All files in dependency order
mdite cat --order alpha                 # Alphabetical order
mdite cat --format json                 # JSON with {file, depth, content, wordCount}
mdite cat --separator "\n---\n"         # Custom separator
mdite cat README.md docs/api.md         # Specific files only
```

**Export patterns:**
```bash
mdite cat | pandoc --toc -o docs.pdf    # Generate PDF
mdite cat | pandoc -s -o docs.html      # Generate HTML
mdite cat | grep -n "TODO"              # Find TODOs across all docs
mdite cat | wc -w                       # Total word count
mdite cat --format json | jq '.[] | {file, wordCount}'  # Per-file stats
```

## config — Show/explore configuration

```bash
mdite config                            # Current merged config
mdite config --schema                   # All available options
mdite config --explain maxConcurrency   # Detailed help for option
mdite config --sources                  # Which layer provides each value
mdite config --template > mdite.config.js  # Generate config template
mdite config --format json              # JSON output
```

## init — Initialize configuration

```bash
mdite init                              # Create mdite.config.js (interactive)
```

Supported formats: `mdite.config.js`, `.mditerc`, `.mditerc.yaml`, `package.json#mdite`
