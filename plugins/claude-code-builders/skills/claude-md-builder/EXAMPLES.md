# CLAUDE.md Examples & Patterns

Templates, filled examples, and advanced patterns for CLAUDE.md files.

## Templates

### Template 1: Simple Project CLAUDE.md

**When to use**: Small to medium projects (< 300 lines total)

```markdown
# [PROJECT_NAME] Conventions

## Code Style
- Language: [LANGUAGE]
- Formatter: [FORMATTER] (line length [NUMBER])
- Linter: [LINTER] with [RULE_SET] rules
- [FRAMEWORK]-specific patterns:
  - [PATTERN_1]
  - [PATTERN_2]

## Testing
- Framework: [TEST_FRAMEWORK]
- Coverage requirement: >[PERCENTAGE]%
- Test files: [FILE_PATTERN] (e.g., *.test.ts)
- [ADDITIONAL_TEST_CONVENTIONS]

## Git Workflow
- Branch naming: [PREFIX]/[description]
- Commit format: [CONVENTION] (e.g., feat:, fix:, docs:)
- PR requires [NUMBER] approvals
- Merge strategy: [STRATEGY]

## Common Commands
```bash
[DEV_COMMAND]
[TEST_COMMAND]
[BUILD_COMMAND]
```
```

---

### Template 2: Large Project with Rules

**When to use**: Complex projects with many conventions

**Main file (./CLAUDE.md)**:
```markdown
# [PROJECT_NAME]

[1-2 sentence description]

## Quick Commands
```bash
[DEV_COMMAND]
[TEST_COMMAND]
[BUILD_COMMAND]
```

## Architecture
@.claude/docs/architecture.md

## Additional Docs
@.claude/docs/deployment.md
```

**Rules directory (.claude/rules/)**:
```
.claude/rules/
├── code-style.md       # Always loaded
├── testing.md          # Always loaded
├── git-workflow.md     # Always loaded
└── api-rules.md        # Path-specific
```

**Path-specific rule (.claude/rules/api-rules.md)**:
```yaml
---
paths:
  - "src/api/**/*.ts"
---
# API Development Rules
- All endpoints must include input validation
- Use controller-service-repository pattern
- Return standardized error responses
- Include OpenAPI annotations
```

---

### Template 3: Personal User CLAUDE.md

**Location**: `~/.claude/CLAUDE.md`

```markdown
# Personal Coding Preferences

## Preferred Libraries
- Testing: [TEST_LIBRARY] (JS), [TEST_LIBRARY] (Python)
- HTTP: [HTTP_LIBRARY] (JS), [HTTP_LIBRARY] (Python)
- Dates: [DATE_LIBRARY] (JS), [DATE_LIBRARY] (Python)

## Code Style Preferences
- [PREFERENCE_1]
- [PREFERENCE_2]

## Documentation Style
- README: [FORMAT]
- Code comments: [WHEN_TO_COMMENT]
- Architecture: [DIAGRAM_FORMAT]
```

---

## Filled Examples

### Example 1: TypeScript React Project

**./CLAUDE.md** (root — kept short):
```markdown
# MyApp Conventions

## Quick Commands
```bash
npm run dev          # Development server
npm test             # Run tests
npm run build        # Production build
npm run lint         # Lint check
```

## Architecture
- React 18 + TypeScript + Vite
- State: Zustand for global, React Query for server state
- Routing: React Router v6
- Components: Functional only, no class components

## Gotchas
- IMPORTANT: Always use `pnpm`, not `npm` (lockfile incompatible)
- Environment vars must be prefixed with `VITE_` to be exposed to client
- Database migrations run automatically on deploy — test locally first
```

**.claude/rules/code-style.md** (unconditional):
```markdown
# Code Style
- Use Prettier (line length 100, single quotes, trailing commas)
- Use ESLint with @typescript-eslint recommended rules
- Functional components with hooks only
- Use early returns over nested conditionals
- Extract complex conditions into named variables
```

**.claude/rules/testing.md** (unconditional):
```markdown
# Testing
- Framework: Vitest + React Testing Library
- Coverage requirement: >80%
- Test files: `*.test.tsx` alongside source
- Use describe/it structure
- Test behavior, not implementation details
- Mock external services, not internal modules
```

**.claude/rules/api-rules.md** (path-specific):
```yaml
---
paths:
  - "src/api/**/*.ts"
  - "src/services/**/*.ts"
---
# API & Service Rules
- All API functions must validate input with Zod
- Use standardized error types from src/errors/
- All async operations must have error handling
- Log all external service calls with request ID
```

---

### Example 2: Python Data Science Project

**./CLAUDE.md**:
```markdown
# DataPipeline Conventions

## Quick Commands
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
pytest --cov=src
pre-commit install
```

## Architecture
- Python 3.11+ with type hints everywhere
- Data processing: pandas + polars for large datasets
- ML: scikit-learn for classical, PyTorch for deep learning
- API: FastAPI with Pydantic models

## Gotchas
- IMPORTANT: Run `pre-commit install` after cloning — hooks enforce Black + isort
- Large data files are in DVC, not git — run `dvc pull` for data
- GPU tests require `pytest -m gpu` flag (skipped by default)
```

**.claude/rules/code-style.md**:
```markdown
# Code Style
- Formatter: Black (line length 88)
- Import sorting: isort (Black-compatible profile)
- Type hints required for all function parameters and returns
- Use snake_case for variables/functions, PascalCase for classes
- Docstrings: Google style for all public functions
```

---

### Example 3: Personal Preferences

**~/.claude/CLAUDE.md**:
```markdown
# Personal Coding Preferences

## Preferred Libraries
- Testing: Jest (JS), pytest (Python)
- HTTP: axios (JS), httpx (Python)
- Dates: date-fns (JS), arrow (Python)
- CLI: commander (JS), click (Python)

## Code Style Preferences
- Prefer functional programming patterns
- Avoid deep nesting (max 3 levels)
- Extract complex conditions into named variables
- Use early returns over nested if/else
- Comments explain WHY, not WHAT

## Documentation
- README: Setup, usage, examples
- Architecture: Mermaid diagrams
- API docs: OpenAPI/Swagger specs
```

---

### Example 4: Enterprise Managed Policy

**Managed policy location** (deployed via MDM/Group Policy):

macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`
Linux: `/etc/claude-code/CLAUDE.md`
Windows: `C:\Program Files\ClaudeCode\CLAUDE.md`

```markdown
# Company Security & Compliance Policy

IMPORTANT: These policies are mandatory for all projects.

## Approved Dependencies
- YOU MUST only use packages from the company-approved registry
- No direct npm/pip installs from public registries without approval
- Check approved-packages.md before adding new dependencies

## Security Requirements
- Never commit secrets, API keys, or credentials to source control
- All API endpoints must implement authentication
- All user input must be validated and sanitized
- SQL queries must use parameterized queries only

## Compliance (SOC2)
- All data access must be logged for audit
- PII must be encrypted at rest and in transit
- Retain logs for minimum 90 days
- Report security incidents within 24 hours

## Code Review Policy
- Minimum 2 approvals required for all PRs
- Security-sensitive changes require security team review
- All CI checks must pass before merge
```

---

## Advanced Patterns

### Pattern: Rules + Imports Hybrid

Combine `.claude/rules/` for conventions with `@imports` for documentation:

```
project/
├── CLAUDE.md                    # Minimal: commands + architecture overview
├── .claude/
│   ├── rules/
│   │   ├── code-style.md       # Auto-loaded conventions
│   │   ├── testing.md          # Auto-loaded conventions
│   │   └── api-rules.md        # Path-specific conventions
│   └── docs/
│       ├── architecture.md     # Imported via @import
│       └── deployment.md       # Imported via @import
```

**CLAUDE.md**:
```markdown
# MyProject

## Commands
```bash
make dev
make test
make deploy-staging
```

## Architecture
@.claude/docs/architecture.md

## Deployment
@.claude/docs/deployment.md
```

Rules load automatically. Docs load via import. CLAUDE.md stays minimal.

---

### Pattern: Monorepo with Path-Specific Rules

```
monorepo/
├── CLAUDE.md                    # Shared conventions
├── .claude/rules/
│   ├── shared.md               # Cross-project rules
│   ├── frontend.md             # paths: ["packages/web/**"]
│   ├── backend.md              # paths: ["packages/api/**"]
│   └── infra.md                # paths: ["infrastructure/**"]
├── packages/
│   ├── web/
│   └── api/
└── infrastructure/
```

**.claude/rules/frontend.md**:
```yaml
---
paths:
  - "packages/web/**"
---
# Frontend Rules
- React 18 + TypeScript
- Use CSS Modules (not styled-components)
- Components in PascalCase directories
- Tests alongside source files
```

**.claude/rules/backend.md**:
```yaml
---
paths:
  - "packages/api/**"
---
# Backend Rules
- Node.js + Express + TypeScript
- Use dependency injection via tsyringe
- Controllers validate input with Zod
- Repository pattern for database access
```

---

### Pattern: Skills Offloading

Move specialized workflows out of CLAUDE.md into skills:

**Before (bloated CLAUDE.md)**:
```markdown
# Project Conventions
[50 lines of basic conventions]

## PR Review Protocol
[100 lines of detailed review steps]

## Database Migration Guide
[80 lines of migration procedures]

## Deployment Runbook
[120 lines of deployment steps]

# Total: ~350 lines, most loaded unnecessarily
```

**After (lean CLAUDE.md + skills)**:
```markdown
# Project Conventions
[50 lines of basic conventions]

# Total: 50 lines — specialized workflows moved to skills
```

Skills (loaded on-demand only when invoked):
- `.claude/skills/pr-review/SKILL.md` — PR review protocol
- `.claude/skills/db-migrate/SKILL.md` — Database migration guide
- `.claude/skills/deploy/SKILL.md` — Deployment runbook

---

### Pattern: Subdirectory CLAUDE.md Files

Claude Code discovers CLAUDE.md files in subdirectories when those directories are accessed:

```
project/
├── CLAUDE.md                # Root conventions
├── frontend/
│   └── CLAUDE.md            # Frontend-specific (supplements root)
└── backend/
    └── CLAUDE.md            # Backend-specific (supplements root)
```

When working in `frontend/`, both root and frontend CLAUDE.md load. Use this for monorepos where subdirectories have distinct conventions.

**Note**: `.claude/rules/` with `paths:` frontmatter is often simpler than subdirectory CLAUDE.md files for path-specific rules.
