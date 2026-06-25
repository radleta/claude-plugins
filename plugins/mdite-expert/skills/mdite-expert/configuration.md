---
tags: [mdite/configuration]
updated: 2026-04-07
summary: "All config options, file format examples, precedence rules, environment variables, and rule severity levels"
---

# Configuration

## Config Precedence (highest to lowest)

1. **CLI flags** (`--entrypoint`, `--format`, etc.)
2. **Project config** (`.mditerc`, `mdite.config.js`, `package.json#mdite`)
3. **User config** (`~/.config/mdite/config.json`)
4. **Built-in defaults**

## Configuration Options

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `entrypoint` | string | `"README.md"` | Graph traversal start file |
| `depth` | number or `"unlimited"` | `"unlimited"` | Max traversal depth |
| `format` | `"text"` or `"json"` | `"text"` | Lint output format |
| `rules` | Record | see below | Rule severity levels |
| `maxConcurrency` | number (1-100) | `10` | Parallel file validations |
| `exclude` | string[] | `[]` | Gitignore-style exclude patterns |
| `respectGitignore` | boolean | `false` | Honor .gitignore |
| `excludeHidden` | boolean | `true` | Skip hidden directories |
| `validateExcludedLinks` | `"ignore"`, `"warn"`, or `"error"` | `"ignore"` | Links to excluded files |
| `scopeLimit` | boolean | `true` | Enable scope limiting |
| `scopeRoot` | string | undefined | Explicit scope root |
| `externalLinks` | `"validate"`, `"warn"`, `"error"`, or `"ignore"` | `"validate"` | External link policy |

## Rules

| Rule | Default | Detects |
|------|---------|---------|
| `orphan-files` | `"error"` | Files not reachable from entrypoint |
| `dead-link` | `"error"` | Broken file links |
| `dead-anchor` | `"error"` | Broken heading/anchor references |

Severity levels: `"error"` (exit code 1), `"warn"` (reported but exit 0), `"off"` (ignored)

## Config File Examples

**mdite.config.js** (recommended — supports comments):
```js
module.exports = {
  entrypoint: 'README.md',
  depth: 'unlimited',
  rules: {
    'orphan-files': 'error',
    'dead-link': 'error',
    'dead-anchor': 'warn'
  },
  exclude: ['archive/**', 'drafts/**'],
  respectGitignore: true,
  maxConcurrency: 10
};
```

**.mditerc** (JSON, no comments):
```json
{
  "entrypoint": "README.md",
  "rules": {
    "orphan-files": "error",
    "dead-link": "error",
    "dead-anchor": "error"
  },
  "exclude": ["node_modules/**"]
}
```

## Environment Variables

| Variable | Effect |
|----------|--------|
| `NO_COLOR` | Disable colored output (respects no-color.org) |
| `FORCE_COLOR` | Force colors even when piped |
| `CI=true` | Auto-disable colors in CI environments |

## Version

Current: **mdite v1.1.0**
