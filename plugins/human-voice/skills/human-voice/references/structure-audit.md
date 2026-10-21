# Structure Audit

The one definition of the structure audit: the read that finds what `ai-lint` cannot.

You are the reviewer: a cold reader of one draft, meeting it the way its recipient will.
Before you audit, read [scrub.md](scrub.md) in full; it holds the tells this page checks,
by step number. You audit and the author revises: rewrite nothing, and return the output
below as your whole reply. The routing section of [SKILL.md](../SKILL.md) is for whoever
writes a draft; skip it.

An author also runs this page on its own draft where scrub.md Step 5 says so.

**Input:** four labeled parts. `Draft:` (the draft, or the path of its file), `Tier:` (`1`
or `2`), `Channel:` (email, PR description, LinkedIn post) and `Recipient:` (who reads it).

## Procedure

Run all four checks, in order, on the whole draft. Every check ends in the output below,
including a check that finds nothing.

1. **Tells.** Check the draft against every tell in scrub.md Step 3. On `Tier 1`, and only
   there, a parenthesis standing in for a dash is a row. Density decides a row: no
   single tell proves AI, so one instance becomes a row only when it clusters with others or
   carries the piece's shape. One passage goes under one tell name, the closest. Fragments
   that suit the channel (Slack, texts and DMs, per scrub.md Step 4) are the register, not Staccato
   drama.
2. **Reshuffle test.** Could two body paragraphs swap places without breaking the logic? If
   yes, the piece is a pile of co-equal points: `fail`, plus a `Reshuffle` row quoting the
   opening of a paragraph that moves freely, its fix naming the dependency that would give the
   piece a spine. A draft with one body paragraph passes, since nothing can swap.
3. **Read-aloud test.** Would a person say this out loud to the recipient? A phrase that
   survives only on paper fails it: `fail`, plus one `Read-aloud` row per such phrase, its fix
   the way a person would say it.
4. **Self-critique.** Reread the draft adversarially and ask what still reads as AI that the
   table has not named. Up to three findings, each a row tagged `Self-critique`. One shape to
   look for: a paragraph built from a stock sequence of moves, such as thanks, cause, fix,
   caveat, cute close, which passes the reshuffle test because its sentences depend on each
   other while the paragraph is still a template.

**Auditing your own draft** (the self-check): the self-critique is where your
anchoring to the shape you chose shows. Mark a test `pass` only when you can name what makes
it pass; the reason clause carries that.

**Fixes** follow the never-fabricate constraint that opens scrub.md: each one uses only facts
already in the draft. A fix that would need a new fact says what is missing instead of
supplying it.

## Output

The audit is this block and nothing else:

```
| Tell | Quoted text | Fix |
|---|---|---|
| {scrub.md Step 3 tell name, "Reshuffle", "Read-aloud" or "Self-critique"} | "{verbatim from the draft}" | {the change, using only facts in the draft} |
Reshuffle: pass|fail — {one clause}
Read-aloud: pass|fail — {one clause}
Self-critique: {n} row(s) added | none — {one clause naming what the adversarial reread looked for}
```

With no findings, the table is replaced by the single line `No structural tells found.` and
the three lines still follow:

```
No structural tells found.
Reshuffle: pass — {one clause}
Read-aloud: pass — {one clause}
Self-critique: none — {one clause naming what the adversarial reread looked for}
```

Each clause names what this draft shows, never a reason that would fit any draft.

The `Self-critique:` line counts the rows it added, so a skipped self-critique shows.
