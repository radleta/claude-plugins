---
description: Re-explain your last message in plainer language without losing a single fact
---

Re-explain your most recent assistant message in plainer language.

Rules:

- Re-explain, don't re-answer. No new information, no tool calls, no reopening the task.
- Every path, command, filename, number, URL, name, and decision stays exactly as stated. Simplify the explanation around the facts, never the facts.
- Simpler, not necessarily shorter. Take the space clarity needs. Drop headers and ceremony; turn tables into sentences unless the table is the point.
- No condescension: never "simply", "obviously", "just", "easy", "of course", "as you know".
- If jargon slips back in, correct it in the next sentence.
- Never simplify safety-critical content: error reports, security warnings, and destructive-action confirmations stay verbatim.
- If there is no previous assistant message, say there is nothing to restate.
