---
tags: [mdite/concepts]
updated: 2026-04-07
summary: "Graph model fundamentals: nodes, edges, entrypoints, reachability, orphans, depth, and scope"
---

# Core Concepts

mdite treats markdown files as a **directed graph**:

| Concept | Definition |
|---------|-----------|
| **Node** | A markdown file in the documentation set |
| **Edge** | A relative link from one markdown file to another |
| **Entrypoint** | Starting file for graph traversal (default: `README.md`, depth 0) |
| **Reachable** | File discoverable by following links from the entrypoint |
| **Orphan** | File that exists on disk but is not reachable from the entrypoint |
| **Depth** | Number of link hops from entrypoint to reach a file |
| **Scope** | Boundary that limits traversal (prevents following links outside docs) |

## Graph Traversal

Starting from the **entrypoint**, mdite follows all relative markdown links recursively:

1. Parse entrypoint for `[text](relative-path.md)` links
2. For each linked file, parse it and follow its links
3. Track **depth** (hop count from entrypoint)
4. Mark all discovered files as **reachable**
5. Any `.md` file on disk but not discovered is an **orphan**

## Scope Limiting

When `scopeLimit` is enabled (default), mdite restricts traversal to prevent following links outside the documentation boundary. The scope root defaults to the directory containing the entrypoint, or can be set explicitly via `scopeRoot`.

## Depth Limiting

The `depth` option limits how many hops from the entrypoint mdite will follow:

| Depth | Effect |
|-------|--------|
| `0` | Entrypoint only |
| `1` | Entrypoint + directly linked files |
| `2` | Entrypoint + 2 hops |
| `"unlimited"` | Follow all links (default) |

Depth limiting is useful for:
- Pre-commit hooks: `--depth 1` validates only immediately linked files
- Performance: limiting traversal on very large doc sets
- Focused validation: checking a subsection of the graph
