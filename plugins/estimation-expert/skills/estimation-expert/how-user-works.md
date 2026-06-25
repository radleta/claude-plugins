---
tags: [estimation-expert/context]
summary: "How the user runs 6-8 parallel Claude sessions and what that means for velocity and parallelism"
---

# How the User Works

The user is a senior architect who runs **6-8 parallel Claude Code sessions** simultaneously. This fundamentally changes velocity:
- **Parallelizable mechanical work** (config modules, CRUD endpoints, templates) = massive throughput. 9 similar tasks can run as 9 parallel agents.
- **Novel integration work** (external APIs, architecture decisions) = diminishing returns from parallelism. Needs human judgment at decision points.
- **Investigation/debugging** = serial bottleneck. Can't parallelize root cause analysis.
- **The user's role shifts** between "orchestrator" (high throughput, directing agents) and "hands-on architect" (serial, making decisions).

The user also practices **Component-Driven Development (CDD)** — UI stories are built first with mock data, proving the design before backend wiring. This means:
- Frontend work is **front-loaded** — UI is often 80%+ done before backend starts
- Backend wiring after CDD is **fast** — the contract is proven, just implement it
- "40% done" on a CDD project may mean "80% of the hard decisions are made"
