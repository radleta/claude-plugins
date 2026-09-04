# Spending the two loads

Every document and pointer you add spends one of two budgets. Know which one before adding
either.

**Context load** is the cost of always-loaded material on the agent's window: an `AGENTS.md`
line, a skill description, anything sitting in context every turn, spending tokens and
attention whether or not it fires.

**Cognitive load** is the cost on the human: which documents exist, and when to reach for each.
The human is the index. This one is the price of human agency rather than a cost to minimise;
spend it where human judgement matters and remove it where it does not.

Material reached only through a pointer escapes context load at the price of the pointer's own
line. Material with no pointer rides entirely on cognitive load.

## When a split earns it

Splitting spends one of the two, so split only when the cut earns it.

**Splitting off reference is the common case, and it has an answer rather than a judgement
call.** Take the material you are considering moving and ask two questions in this order.

1. **What fraction of runs read it?** Count the branches from Step 1 that reach the material,
   against the branches that exist. Material every branch reaches stays inline whatever its
   size. Material a minority of branches reach is a candidate.
2. **Is it bigger than the pointer that would replace it?** A pointer costs the line that
   states what the material is plus the line that states the branch condition. Material worth
   fewer lines than that is cheaper left where it is.

Both yes, and the split earns its context load. Either no, and it does not. Size alone never
decides: a forty-line block every run reads stays, and an eight-line block one branch in five
reaches goes.

Cognitive load is the cost this does not price, and it is the reason to stop at one new file
per pass unless the branches genuinely demand more. Each file is one more thing a human has to
know exists.

Split by sequence when the steps visible ahead tempt the agent to rush the one in front of it,
since keeping them out of view drives more legwork on the current task. This is the last resort
for premature completion, and Step 4 states what must be true before you arrive here.

Watch the reverse as well: merging two sequences exposes each step to what follows and invites
premature completion.

A split across a real context boundary — a hand-off or a sub-agent dispatch — is the only kind
that hides anything. An inline call leaves the later steps in context and clears nothing.
