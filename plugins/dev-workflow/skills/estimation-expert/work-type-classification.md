---
tags: [estimation-expert/reference]
summary: "Classification of work into 6 types with velocity multipliers and parallelizability ratings"
---

# Work Type Classification

Classify every remaining item into one of these types. The type determines the velocity multiplier.

| Type | Multiplier | Parallelizable? | Description | Examples |
|------|-----------|----------------|-------------|----------|
| **Mechanical** | 0.15x | Highly (÷ claude count) | Pattern repeat, first one done | Config modules after reference impl, email templates, CRUD endpoints following established pattern |
| **CDD-Wired** | 0.3x | Moderately (÷ 2-3) | UI stories proved the design, backend follows the contract | API endpoint for existing UI, wiring mock data to real service, hooking up events |
| **Infrastructure** | 0.7x | Somewhat (÷ 2) | Well-understood patterns but careful work | DynamoDB table setup, middleware pipeline, build system changes |
| **Integration** | 1.0x (baseline) | Limited | External APIs, cross-system wiring, edge cases | Payment checkout flow, webhook dispatch, OAuth flows, search indexing |
| **Investigation** | 1.5-3.0x | No (serial) | Unknown scope, may expand | Root cause debugging, performance profiling, architecture rethinks |
| **Creative** | 1.0x | No (serial) | Human-driven, Claude assists | Marketing copy, template curation, UX design decisions, pricing strategy |
