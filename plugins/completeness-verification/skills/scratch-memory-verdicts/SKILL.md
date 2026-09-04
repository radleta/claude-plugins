---
name: scratch-memory-verdicts
description: "MCP contract for write_review and write_report only: tool schemas, role-to-status tables, and write paths for read-only reviewer/verifier sub-agents. Use when a reviewer or verifier persists an APPROVED/FINDINGS/ISSUES_FOUND verdict — even when the task looks like a single trivial call, load this instead of full scratch-memory."
---

# Scratch Memory — Verdicts

Slim, sub-agent-facing subset of `scratch-memory`: the two tool contracts a
read-only reviewer or verifier sub-agent ever calls. For registration, CLI
verbs (`handoff`, `pickup`, `tasks`), hooks, file layout, and the growth
path, see the `scratch-memory` skill instead — this skill deliberately omits
all of that.

## Tool: `write_report`

```
write_report({
  project: string,       // scratch subdir, e.g. "my-feature"; must match [a-zA-Z0-9._-]+
  step: integer,         // plan step number; use 0 for ad-hoc
  iter: integer,         // iteration within the step; 1-based
  role: enum,            // "coder" | "completeness" | "quality" | "security"
  status: enum,          // see role-to-status table below
  body: string           // markdown body; server prepends YAML frontmatter
}) → "Wrote: {path}"
```

**Role-to-status mapping** (server rejects mismatched pairs):

| Role | Allowed `status` |
|---|---|
| `coder` | `READY_FOR_REVIEW` \| `FIXED` \| `BLOCKED` |
| `completeness` / `quality` / `security` | `APPROVED` \| `FINDINGS` |

Server writes to:
```
{project_root}/scratch/{project}/steps/step-{NN}/{role}-iter{N}-{ts}.md
```

Frontmatter added automatically:
```yaml
---
role: quality
status: FINDINGS
step: 1
iteration: 1
timestamp: 2026-04-17T14:30:22.123Z
project: my-feature
---
```

## Tool: `write_review`

```
write_review({
  project: string,       // scratch subdir, same rules as write_report
  phase: enum,           // "idea" | "spec" | "draft" | "plan"
  iter: integer,         // iteration within the review loop; 1-based
  role: enum,            // "document-quality" | "codebase-alignment" | "domain" | "creative" | "decision-traceability" | "combinatorial-completeness" | "craft" | "step-quality" | "investigation-quality" | "spec-traceability"
  status: enum,          // see role-to-status table below
  skills: string[],      // OPTIONAL — ordered expert-skill names for role=domain disambiguation
  body: string           // markdown body; server prepends YAML frontmatter
}) → "Wrote: {path}"
```

**Role-to-status mapping:**

| Role | Allowed `status` |
|---|---|
| `document-quality` / `codebase-alignment` / `domain` / `decision-traceability` / `combinatorial-completeness` / `craft` / `step-quality` / `investigation-quality` / `spec-traceability` | `APPROVED` \| `ISSUES_FOUND` |
| `creative` | `SUGGESTIONS` \| `NO_SUGGESTIONS` |

Server writes to:
```
{project_root}/scratch/{project}/reviews/{phase}/{role}[-{skills[0]}]-iter{N}-{ts}.md
```

For `role=domain`, the first entry of `skills` is appended to the filename
(e.g. `domain-frontend-iter1-<ts>.md`) so multiple parallel domain reviewers
(frontend, backend-net, etc.) don't collide within the same iteration.

Frontmatter added automatically:
```yaml
---
role: domain
status: APPROVED
phase: spec
iteration: 1
timestamp: 2026-04-18T14:42:28.840Z
project: my-feature
skills: [csharp-expert, dynamodb-expert]
---
```

## Shared guarantees

Both tools share the same underlying write path:

- **Append-only** — `flag: 'wx'` fails if the target file already exists (a collision is a caller bug)
- **Sandboxed** — path must start with `{project_root}/scratch/`; anything else is refused
- **Audited** — every write appends one JSONL line to `{project_root}/scratch/.scratch-memory/audit.jsonl`, including `status`, so verdicts are filterable (`rg "^status: FINDINGS" scratch/`) without a body parse
- **Role/status validated** — coder statuses, verifier statuses, and review statuses are non-interchangeable; a mismatched pair is rejected

## Error semantics

Both tools use the server-wide named-error-string channel, same as
`write_issue` / `write_session` / `write_task`. A failure comes back as a
JSON-RPC error frame carrying a named string in `error.data.error`, repeated
as a `NAME: ` prefix on `error.message`. Branch on `error.data.error`, not on
the message text. `code: -32602` means a bad argument, `code: -32000` a
filesystem/runtime failure. No tool in this server uses the `isError: true`
result channel.

| Error string | Code | Raised by | Condition |
|---|---|---|---|
| `PROJECT_INVALID` | -32602 | both | `project` missing, not a string, or not matching `[a-zA-Z0-9._-]+` |
| `ITER_INVALID` | -32602 | both | `iter` not an integer `>= 1` |
| `ROLE_INVALID` | -32602 | both | `role` not in the tool's role enum |
| `STATUS_INVALID` | -32602 | both | `status` not allowed for that `role` — see the tables above |
| `BODY_INVALID` | -32602 | both | `body` missing or not a string |
| `STEP_INVALID` | -32602 | `write_report` | `step` not an integer `>= 0` |
| `PHASE_INVALID` | -32602 | `write_review` | `phase` not one of `idea`, `spec`, `draft`, `plan` |
| `SKILLS_INVALID` | -32602 | `write_review` | `skills` not an array of `[a-zA-Z0-9._-]+` strings |
| `STATUS_BODY_MISMATCH` | -32602 | `write_review` | `status` contradicts the body — `APPROVED` with a non-empty blocking section, `ISSUES_FOUND` with none, or a `role=domain` `## Aggregate` that disagrees with the declared status |
| `FS_FAILURE` | -32000 | both | Sandbox escape, the `wx` collision (a verdict for this project/step-or-phase/role/iter already exists in the same second), ENOENT, or permissions |

## Everything else

Registration, the CLI (`handoff`, `pickup`, `tasks`, `install-hooks`),
`write_issue`, `write_session`, `write_task`, hooks, file layout, and the
growth path all live in the `scratch-memory` skill — load that instead if
your task touches any of them.
