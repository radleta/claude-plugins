---
description: Debug an error message within a context
argument-hint: <error message> | <Description of bug>
---

Work through the process of debugging the error message. Follow this workflow:

## 1. Create Hypotheses

Think critically, and avoid the trap of accepting the first solution that _may_ solve the problem, rather than examining all the alternatives to identify the one that not only fits the evidence, but fits it _best_.

Create a new Markdown file in a project-relative debug output location (e.g. `docs/debug/`, `scratch/debug/`, or whatever convention this repo already uses — never hardcode an absolute path) that details out the error code from the user, the context, and the information gathered. Prefix the filename with the date and timestamp.

Start by brainstorming 5 Hypotheses, or declarative statements that have not yet been established as true.

## 2. Gather Evidence

Start by gathering all of the information that you can see via the tools and resources you have available to you regarding the bug.

Use whatever tools are actually available and relevant to this project:

- The project's own test runner and lint/typecheck commands
- `gh` cli (for GitHub-hosted repos)
- The project's database or backend CLI tools, if any
- For browser-based bugs, delegate to the `chrome-browser` agent — never call browser automation tools directly
- Repo files
- Any other CLI tools available in this environment that are relevant to gathering evidence

When gathering evidence, try to only gather evidence that is valid, answer the following questions about each piece of evidence:

- Who or what was the source?
- What was the source's access?
- What is the source's reliability?
- Is the information plausible?

We will be ranking the competing hypotheses by the degree to which relevant evidence is inconsistent, the favored hypothesis is the one with the least inconsistent evidence. Only inconsistent evidence has any real value in determining the credibility of a hypothesis.

Seven steps of Hypothesis Testing:

1. Construct a matrix in the markdown file: Label the first column "Evidence" Label the other columns to the right "Hypotheses" and enter the descriptors atop the columns. The hypotheses must be mutually exclusive.

2. List "Significant" evidence down the left'hand margin, including "absent" evidence.

- "What evidence not included in the matrix would refute one or more hypotheses? Gather this information now.

3. Working across the matrix, test evidence for consistency with each hypothesis, one item of evidence at a time.

- Consistency does not mean the evidence necessarily validates the hypothesis. It means the evidence is compatible with the hypothesis.

4. Refine the matrix
   4a. Add or reword hypotheses
   4b. Add "significant" evidence relevant to any new or reworded hypothesis and test it against all hypotheses.
   4c. Delete, but keep a record of evidence that is consistent with all of the hypotheses. It has no diagnostic value.

5. Working downward, evaluate each hypothesis.

6. Rank the hypotheses by the strength of inconsistent evidence.

7. Perform a sanity check.

## 3. Implement solution(s)

Now that we are fairly certain about the cause of the bug, implement a solution for this bug, and any other potential signs of falter or unsteady code touched during this review.

## 4. Verify Solutions

Create a test using the project's own test framework — or, for browser-based bugs, delegate verification to the `chrome-browser` agent rather than calling browser tools directly — and verify that the solution actually fixed the problem. If it did not, go back to the hypothesis and continue with the next likely solution.

## 5. Bug Report

Create a bug report in a project-relative bug-report output location (e.g. `docs/bug-report/`, `scratch/bug-report/`, or whatever convention this repo already uses — never hardcode an absolute path) that describes the bug or error, the cause, and the solution. Prefix this with the date and timestamp.

The goal of this bug report is to identify areas where if we had thought ahead, we would have avoided this bug altogether.
