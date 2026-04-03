# App-Type Planning Protocols

Protocol files that add app-type-specific testing, verification, and checklist requirements to plans. Each protocol is loaded at the classification gate based on APP_TYPE.

## Available Protocols

| File | APP_TYPE | Adds |
|------|----------|------|
| `web-app.md` | web-app | 3-tier testing (unit/integration/e2e with chrome-browser), story requirements, visual verification, 10 checklist items |
| `cli.md` | cli | 3-tier testing (unit/integration/e2e), exit codes, piping, output formats, 8 checklist items |

## Adding New Protocols

To add a protocol for a new app type (e.g., `api`, `library`, `mobile`):

1. Create `protocols/{app-type}.md` following the structure of existing protocols
2. Add APP_TYPE classification rule in SKILL.md gate 0
3. Add file loading protocol entry in SKILL.md
4. Add checklist section in PLAN-QUALITY.md with grade cap threshold
5. Update this README
