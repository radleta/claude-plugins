---
tags: [agent-expert/failure-mode-diagnostics]
summary: "Post-mortem methodology for agent failures: MAST 2025 14-failure-mode taxonomy, transcript reading techniques, prompt vs. model vs. environment triage, repro/isolation protocol, escalation heuristics, diagnostic anti-patterns"
---

# Failure Mode Diagnostics

## Overview

This page covers **failure diagnosis** — what to do after an agent does the wrong thing. It provides the MAST 2025 taxonomy of 14 failure modes (arXiv:2503.13657), transcript reading techniques, a triage protocol for distinguishing prompt, model, and environment causes, and an isolation/repro methodology. For preventing drift before it happens, see [workflow-following.md](workflow-following.md). For context budget management that shapes what a transcript looks like, see [token-turn-optimization.md](token-turn-optimization.md).

---

## When to Read This Page

Read this page when:

- An agent produced wrong output and you cannot tell whether the prompt, model, or tool was at fault
- A failure is intermittent and you cannot reproduce it reliably
- You are reading a transcript trying to find where the failure started
- A multi-agent workflow failed and you need to attribute which agent or step was responsible
- You are writing a post-mortem for a failed agent run
- The same agent works in test but fails in production
- A tool returned an unexpected response and the agent did not recover
- You need to decide whether to fix the prompt, change the model tier, or fix the environment

---

## The Diagnostic Question Hierarchy

Before touching the prompt or swapping a model, establish which layer failed. Failures are commonly misattributed: engineers change the prompt when the tool was broken, or swap the model when the prompt had the wrong instructions. (https://tianpan.co/blog/2026-04-15-debugging-llm-failures-field-guide)

Ask these questions in order:

**1. Can you reproduce the failure?**
Attempt to reproduce with the exact same transcript input. If the failure is intermittent, you cannot diagnose it — isolate it first (see Repro and Isolation Protocol).

**2. Did a tool return unexpected output?**
Inspect every tool result in the transcript. Empty arrays, HTTP 200 with no content, truncated responses, and stale state are environmental failures — not model failures. Anthropic's multi-agent research system: *"tool-testing agent...when given a flawed MCP tool, it attempts to use the tool and then rewrites the tool description."* (https://www.anthropic.com/engineering/multi-agent-research-system) If removing the tool call eliminates the failure, the environment caused it.

**3. Did the agent try to call a tool that does not exist?**
Hallucinated tool names are a prompt failure: the agent was not given a correct and complete tool list. ReAct analysis found 90.8% of retry budget was wasted on `hallucinated_tool_exhausted_retries` — not model capability failures. (https://towardsdatascience.com/your-react-agent-is-wasting-90-of-its-retries-heres-how-to-stop-it/)

**4. Does the failure disappear with a rewritten prompt?**
If prompt ablation (removing system instructions, few-shots, or retrieved context one at a time) makes the failure go away, the prompt caused it. Most production regressions trace to prompt changes, model version updates, or input distribution shifts — in that order. (https://tianpan.co/blog/2026-04-15-debugging-llm-failures-field-guide)

**5. Does the failure persist across prompt variants?**
If the agent fails with multiple reasonable prompts and the tool environment is known clean, suspect the model tier: the task may exceed the capability of the model used. Try the same prompt with a higher-capability model before declaring the prompt unfixable.

**6. Is the failure stochastic?**
Run the same prompt three times. If results differ, you have a stochastic failure. Temperature=0 reduces but does not eliminate non-determinism — Mixture-of-Experts routing, floating-point ordering, and probability ties introduce variance even at temperature=0. (https://www.vincentschmalbach.com/does-temperature-0-guarantee-deterministic-llm-outputs/) If the failure only occurs sometimes, diagnosis requires golden-set testing across a distribution of inputs, not single-run inspection.

### Triage Decision Table

| Observation | Probable Cause | First Action |
|---|---|---|
| Tool returned empty/error; agent did not recover | Environment | Inspect tool result; fix tool or add error-handling instruction |
| Agent called a non-existent tool name | Prompt | Audit the tool list in the prompt; add explicit `NOT when:` boundaries |
| Agent ignored explicit instruction in the prompt | Prompt (context dilution) | Check context fill; restate instruction earlier; simplify prompt |
| Agent reasoning is correct but action differs | Prompt (FM-2.6 mismatch) | Add explicit output schema; lock action format in prompt |
| Failure reproduces at temperature=0 across prompt variants | Model | Try higher model tier; simplify task decomposition |
| Failure intermittent across identical inputs | Stochastic/MoE | Golden-set regression; add explicit output format to reduce variance |
| Failure appears only in long sessions | Context dilution | Check context fill; trigger compaction earlier; restate goal per step |
| Failure appears in production but not test | Input distribution shift | Extract production trace; run ablation on production input verbatim |

---

## MAST 2025: The 14-Failure-Mode Taxonomy

MAST (Multi-Agent System Failure Taxonomy) analyzed 1,600+ annotated traces across 7 multi-agent frameworks, identified 14 failure modes with high inter-annotator agreement (κ = 0.88), and clustered them into three categories. (https://arxiv.org/html/2503.13657v2)

### FC1: Specification Issues — 41.77% of all failures

The largest category. Failures where the agent's behavior diverges from what the task or role specification requires.

| Mode | Frequency | Description | Transcript Signal |
|---|---|---|---|
| **FM-1.3 Step repetition** | 17.14% | Unnecessary reiteration of previously completed steps | Agent re-runs a step it already completed; output is duplicate of a prior turn |
| **FM-1.1 Disobey task specification** | 10.98% | Failure to adhere to task constraints or requirements | Agent output violates an explicit rule stated in the prompt |
| **FM-1.5 Unaware of termination conditions** | 9.82% | Lacks recognition of criteria that should trigger stopping | Agent continues after the goal is met; keeps searching/iterating past completion |
| **FM-1.4 Loss of conversation history** | 3.33% | Unexpected context truncation; ignores recent history | Agent contradicts its own output from 3–4 turns prior |
| **FM-1.2 Disobey role specification** | 0.50% | Failure to stay within the defined role's constraints | Agent takes actions outside its declared scope; crosses into another agent's responsibility |

**Diagnostic implication:** FC1 failures are almost always prompt-fixable. Step repetition and unaware-of-termination both trace to missing stopping conditions and missing goal restatement per step. See [workflow-following.md § Drift: Three Root Causes](workflow-following.md).

### FC2: Inter-Agent Misalignment — 36.94% of all failures

Failures in coordination between agents — what one agent communicates, assumes, or ignores about another.

| Mode | Frequency | Description | Transcript Signal |
|---|---|---|---|
| **FM-2.6 Reasoning-action mismatch** | 13.98% | Discrepancy between logical reasoning and actual action taken | Agent's reasoning block says "I should X" but the subsequent tool call does Y |
| **FM-2.2 Fail to ask for clarification** | 11.65% | Does not request information when input is ambiguous | Agent proceeds on an assumption that contradicts the task; no clarification turn |
| **FM-2.3 Task derailment** | 7.15% | Deviation from the intended objective or focus | Later turns pursue a sub-goal that displaced the original; original goal no longer referenced |
| **FM-2.1 Conversation reset** | 2.33% | Unexpected restarting of dialogue, losing prior context | Agent treats the conversation as fresh when prior context exists |
| **FM-2.4 Information withholding** | 1.66% | Fails to share data that other agents need | Agent output is locally correct but omits information a downstream agent depends on |
| **FM-2.5 Ignored other agent's input** | 0.17% | Disregards input from another agent | Agent output makes no reference to a prior agent's output despite depending on it |

**Diagnostic implication:** FC2 failures are harder to diagnose because similar surface behaviors can have different root causes. An agent that appears to withhold information (FM-2.4) might actually have lost history (FM-1.4) or ignored input (FM-2.5). MAST notes: *"diagnosing FC2 failures can be complex, as similar surface behaviors can stem from different root causes — withholding, ignoring input, and context mismanagement — underscoring the need for fine-grained modes."* (https://arxiv.org/html/2503.13657v2)

Reasoning-action mismatch (FM-2.6 at 13.98%) is the highest-frequency inter-agent failure. It is identifiable in transcripts: find a turn where the reasoning block and the subsequent action contradict each other. This is a prompt failure (missing output schema or unclear action format), not a model capability failure.

### FC3: Task Verification — 21.30% of all failures

Failures in checking whether the task was completed correctly.

| Mode | Frequency | Description | Transcript Signal |
|---|---|---|---|
| **FM-3.1 Premature termination** | 7.82% | Ends before all objectives are met | Agent declares success; inspection of output shows incomplete coverage |
| **FM-3.2 No or incomplete verification** | 6.82% | Partial or total omission of outcome checking | Agent reports done without running any verification command |
| **FM-3.3 Incorrect verification** | 6.66% | Inadequate validation of task outcomes | Agent runs a proxy check (file exists) but not the objective check (file correct) |

**Diagnostic implication:** FC3 failures are the highest-leverage intervention target. MAST intervention study: adding multi-level verification (high-level objective check supplementing code-level checks) produced **+15.6% absolute improvement** in task success (ChatDev, ProgramDev benchmark). (https://arxiv.org/html/2503.13657v2) This maps directly to the distinction between proxy verification and objective verification in [workflow-following.md § Missing or Incorrect Verification](workflow-following.md).

### Intervention Impact Summary

The AG2-MathChat intervention (improved role specification) produced **+9.4% success rate increase** on GSM-Plus (84.25% → 89.00%, p=0.03). (https://arxiv.org/html/2503.13657v1) However, MAST concludes: *"simple fixes are still insufficient for achieving reliable MAS performance"* — architectural changes beyond prompt tuning are required for elimination.

### Compounding: How Failure Modes Chain

MAST traces show failures compound: *"a small reasoning mismatch early in the process often leads to a deviation from the task specification, which in turn triggers a total derailment."* (https://arxiv.org/pdf/2509.25370) Step attribution — finding the *earliest* step where all continuations lead to failure — matters more than finding the first *visible* mistake. A visible failure at step 7 often has a causal root at step 2 or 3.

---

## Transcript Reading Methodology

A transcript is not a truth record — it is a sequence of generated tokens. The agent's narration of what it is doing is itself a model output, not introspection. Never diagnose from the agent's stated reasoning alone; diagnose from observable actions and tool results.

### What to Record

For every agent run, log: full input (system prompt, conversation history, retrieved context), full output including reasoning blocks, tool names called and arguments, tool return values, model version, prompt version, token counts, and timestamps. Without inputs, attribution accuracy drops by 76% at the step level — output-only observation is insufficient. (https://arxiv.org/html/2604.22708v1)

### What to Look for First

**1. The first divergence point, not the first visible failure.** A cascade starting at step 2 often produces a visible failure at step 7. Work backward: find the step where the agent's output first deviated from what the workflow required. (https://latitude.so/blog/ai-agent-failure-detection-guide)

**2. Reasoning-action mismatch (FM-2.6).** Find turns where the `<thinking>` or reasoning block concludes one thing and the subsequent tool call or output does another. This is the second-highest frequency failure mode (13.98%) and is unambiguously visible in the transcript.

**3. Goal drift markers.** Every N steps, check whether the agent's output still references the original objective verbatim. If the original goal has dropped from the agent's framing by step 5, context dilution has occurred. Detection: ask the agent to restate the original goal; if the restatement shifts, drift is active. (https://ceaksan.com/en/llm-agentic-failure-modes)

**4. Hallucinated tool names.** Scan tool calls for names not in the tool definition list provided in the prompt. Hallucinated tool calls are a prompt failure (incomplete tool list or unclear tool boundaries), not a model capability failure.

**5. Repeated identical tool calls.** Three or more identical tool calls in sequence — same tool, same arguments — signals a stale-context loop. The agent does not know the tool already ran (context loss, FM-1.4) or is caught in a retry loop on a non-retryable error.

**6. Self-contradictions across turns.** Find turns where the agent asserts X and later asserts not-X without any new information. This signals either context truncation (FM-1.4) or reasoning-action mismatch (FM-2.6).

**7. Upstream output shapes.** Trace data flow: does step N's output match the shape step N+1 expects? Silent failures — HTTP 200 with empty data — propagate to later steps that look like step N+1 problems but are actually step N environment failures. (https://latitude.so/blog/ai-agent-failure-detection-guide)

### What to Ignore

- **The agent's stated explanation of why it did something.** The reasoning block is generated text, not introspection. An agent saying "I chose this tool because..." is a prediction of what a good explanation looks like, not a causal account. Verify the stated reasoning by checking whether it is consistent with the actual tool call.
- **Isolated turn quality.** A turn that looks reasonable in isolation may be wrong relative to 5 turns of context. Always read turns in the context of the original goal and prior outputs.
- **Response latency spikes in isolation.** Latency spikes correlate with context size (more tokens to process), not with failure. They signal context budget pressure, not the cause of any specific failure.
- **Preamble text.** "Sure, I'll analyze this carefully..." is a token-cost artifact (see [token-turn-optimization.md](token-turn-optimization.md)), not diagnostic signal.

### Step-Level vs. Agent-Level Attribution in Multi-Agent Systems

For failures in systems with multiple agents, two attribution questions are distinct: (1) at which *step* did failure become inevitable, and (2) which *agent* was responsible. (https://arxiv.org/html/2604.22708v1)

**Recoverability-aware attribution:** if an upstream error could have been caught by a downstream validator explicitly responsible for catching it, the failure attribution belongs to the validator's step, not the original error. Environmental interaction agents cause 50%+ of failures; orchestrators/planners cause 18–29%. Attribution to the orchestrator is often correct even when the visible failure is in a worker, because the orchestrator's task description or tool routing created the conditions.

---

## Detection Patterns for High-Frequency Inter-Agent Failures

The two highest-frequency FC2 failures together account for 25%+ of all failures and are highly actionable from the prompt side.

### Reasoning-Action Check (FM-2.6, 13.98%)

Use this as an evaluator prompt to scan a transcript for reasoning-action mismatches:

```
You are scanning an agent transcript for FM-2.6 reasoning-action mismatches.

For each turn that contains BOTH a reasoning block AND a tool call or output:
1. Extract the agent's stated intent from the reasoning block (what it said it would do)
2. Compare to the actual tool call or output
3. Flag if intent and action contradict — e.g., reasoning says "I will read file X" but tool call reads file Y; reasoning says "I should ask for clarification" but agent proceeds with an assumption

Return: list of {turn_number, stated_intent, actual_action, mismatch_severity}
where mismatch_severity is HIGH (different objective), MEDIUM (different parameter), LOW (different format).
Do not flag turns where reasoning and action align.
```

### Clarification-Gate Template (FM-2.2, 11.65%)

Embed at the point in a workflow where the agent must decide whether to proceed or ask. Use as an explicit gate, not an instruction:

```
Before proceeding with this step, verify ALL of:
- [ ] The input contains every value referenced in the step's required parameters
- [ ] No parameter has a value that could match more than one real-world entity
- [ ] The intended action is not ambiguous between two reasonable interpretations

If ANY checkbox is unchecked, output exactly:
CLARIFICATION_REQUIRED: <which item is unclear>; <minimum information needed>

Do NOT proceed with assumptions when any item is unchecked.
Do NOT explain why you need clarification — output only the line above and stop.
```

The `CLARIFICATION_REQUIRED:` enum prefix lets an orchestrator detect the gate trigger by string match without parsing prose.

---

## MAST LLM-as-Judge Classifier

MAST 2025 found that an LLM-as-judge pipeline prompting with the failure taxonomy, execution traces, and few-shot examples achieves **94% accuracy** classifying failure modes against human annotators. (https://arxiv.org/html/2503.13657v2) Use this template to run the classifier on your own transcripts:

```
You are classifying agent failure modes using the MAST 2025 taxonomy.

Failure modes (assign one or more):
FC1 SPECIFICATION ISSUES (41.77%):
  FM-1.1 Disobey task specification (10.98%)
  FM-1.2 Disobey role specification (0.50%)
  FM-1.3 Step repetition (17.14%)
  FM-1.4 Loss of conversation history (3.33%)
  FM-1.5 Unaware of termination conditions (9.82%)
FC2 INTER-AGENT MISALIGNMENT (36.94%):
  FM-2.1 Conversation reset (2.33%)
  FM-2.2 Fail to ask for clarification (11.65%)
  FM-2.3 Task derailment (7.15%)
  FM-2.4 Information withholding (1.66%)
  FM-2.5 Ignored other agent's input (0.17%)
  FM-2.6 Reasoning-action mismatch (13.98%)
FC3 TASK VERIFICATION (21.30%):
  FM-3.1 Premature termination (7.82%)
  FM-3.2 No or incomplete verification (6.82%)
  FM-3.3 Incorrect verification (6.66%)

Input: <full transcript with turn numbers, reasoning blocks, tool calls, tool results, and final output>
Expected output: <what the task required>
Actual output: <what the agent produced>

For each failure observed:
- mode: <FM-N.M code>
- earliest_evidence_turn: <turn where the failure first becomes detectable>
- transcript_quote: <verbatim excerpt that proves the classification>
- confidence: HIGH | MEDIUM | LOW

Return only the list. Do not explain modes that don't apply. Do not suggest fixes.
```

Run the classifier in a fresh context (separate from the failing agent). Use the result to drive the post-mortem and prioritize the highest-frequency, highest-confidence mode first.

---

## Prompt vs. Model vs. Environment Triage

### Layer Definitions

| Layer | What it covers | When it's the cause |
|---|---|---|
| **Prompt** | System prompt, task instructions, tool definitions, few-shot examples, step specifications | Agent ignores instruction; hallucinated tool; context dilution; wrong verification; goal drift |
| **Model** | Sampled token sequence; model tier; model version | Task exceeds capability of the tier; version drift between deployments; stochastic inconsistency on same prompt |
| **Environment** | Tool implementations, MCP servers, API dependencies, context state, file system | Tool returns empty/wrong; stale state; truncated context; rate limit without retry handling |

### Isolation Protocol

Use ablation — strip one component at a time and test whether the failure persists. (https://tianpan.co/blog/2026-04-15-debugging-llm-failures-field-guide)

```
Start: failure confirmed with full production input

Round 1 — Environment check:
  Replace tool results with known-good mock data.
  If failure disappears → environment caused it.

Round 2 — Prompt ablation (run each independently):
  a) Remove few-shot examples → failure persists?
  b) Remove retrieved context → failure persists?
  c) Remove system message → failure persists?
  d) Remove formatting instructions → failure persists?
  The first removal that eliminates the failure identifies the misfiring component.

Round 3 — Stochasticity check:
  Run 3× at temperature=0. If results differ, failure is stochastic.
  Note: temperature=0 does not guarantee determinism (MoE routing, float ops, ties).
  If stochastic → golden-set regression across 20+ inputs required.

Round 4 — Model tier check:
  If prompt ablation found no single misfiring component and environment is clean,
  run the minimal prompt at the next higher model tier.
  If higher tier succeeds → model capability, not prompt.
```

### Trace Replay for Verification

After forming a hypothesis, verify it by replaying the failed trace with the proposed fix. Anthropic's research team: *"simulations using our Console with the exact prompts and tools from our system, then watched agents work step-by-step."* (https://www.anthropic.com/engineering/multi-agent-research-system) Replay with single-component override (different prompt version, model, or tool mock) confirms or falsifies the hypothesis without needing the original user to repeat the interaction.

### Non-Determinism Caveat

Even after isolation, some failures resist exact reproduction. MoE routing creates race conditions in batched inference; GPU floating-point ordering introduces token-probability differences across runs; probability ties break arbitrarily. (https://www.vincentschmalbach.com/does-temperature-0-guarantee-deterministic-llm-outputs/) Design systems resilient to minor output variations rather than assuming perfect determinism. Golden-set testing across a distribution of inputs is more diagnostic than single-run comparison.

---

## Repro and Isolation Protocol

A minimal repro reduces a production failure to its smallest reproducible form: the shortest prompt, fewest turns, and simplest tool state that still exhibits the failure.

### Steps

**1. Extract the exact production trace.**
Log all inputs, outputs, tool calls, and tool results verbatim. Reconstruct the session from these, not from memory.

**2. Confirm reproduction before changing anything.**
Run the extracted trace as-is. If it doesn't reproduce, the failure was stochastic or depends on state you didn't capture.

**3. Shorten the transcript.**
Remove turns from the beginning and from the end until the failure disappears, then add back the minimum context needed. The shortest reproducing transcript is your minimal repro.

**4. Substitute mock tool results.**
Replace live tool calls with hardcoded returns matching the production values. This isolates the failure from live environment variation and makes the repro stable across runs.

**5. Run at temperature=0 with consistent model version.**
This maximizes reproducibility. Do not assume temperature=0 is fully deterministic, but use it as the baseline.

**6. Freeze the repro as a regression test.**
Convert the minimal repro into a named test case with: input transcript, expected output or expected behavior, and the pass/fail criterion. Run the golden set on every prompt or model change. (https://latitude.so/blog/ai-agent-failure-detection-guide)

**7. Cluster similar failures before writing the fix.**
Group related failures by shared signature — same error type, same tool, same step, same pattern — before attempting to fix the first one. A single root cause often manifests across multiple surface failures. Fixing one without seeing the cluster produces a narrow fix that misses the systemic issue. (https://latitude.so/blog/ai-agent-failure-detection-guide)

---

## Post-Mortem Methodology

A post-mortem captures failure evidence durably so the same failure doesn't require re-diagnosis. Reflexion (Shinn et al. 2023) demonstrated that storing failure observations as explicit text — rather than discarding them — enables 10–20 percentage-point pass-rate improvements on iterative tasks. (https://arxiv.org/abs/2303.11366) The same principle applies to post-mortems.

### Required Sections

For every critical failure (one that blocked the workstream or required architectural change), document:

1. **Failure summary** — 2–3 sentences: what failed, which system, when
2. **Impact statement** — affected runs/users; downstream effect
3. **Timeline** — turn-level chronology; include at least the divergence step and the first visible failure step
4. **MAST failure mode classification** — assign one or more of the 14 modes; note category (FC1/FC2/FC3)
5. **Root cause** — which layer (prompt/model/environment) and which specific component
6. **Trace evidence** — a healthy trace excerpt vs. the failed trace excerpt at the same step
7. **Isolation confirmation** — which ablation step confirmed the root cause
8. **Fix applied** — exact change (prompt diff, tool fix, model tier change)
9. **Verification** — golden-set rerun result after fix; did the failure reproduce?
10. **Prevention items** — specific prompt elements, test cases, or architectural changes to prevent recurrence

Non-critical failures (cosmetic output issues, single-turn errors that recovered) deserve at minimum sections 1, 4, and 8 — keep the threshold low for capturing diagnostic data even when the failure didn't block work.

### State Persistence for Diagnosis

GSD Agentic Architecture Playbook: maintain debugging artifacts persistently (`.planning/debug/` for active sessions, `debug/resolved/` for archived). (https://dstreefkerk.github.io/2026-02-agentic-architecture-playbook-patterns-for-reliable-llm-workflows/) Losing diagnostic history to context windows means every new failure in the same area starts from scratch.

---

## When to Escalate vs. Fix Locally

Most failures are prompt-fixable (FC1 at 41.77%, FC2 partially). But some warrant escalation to architecture or model changes.

### Fix Locally (Prompt/Tool Level)

- **FM-1.1, FM-1.5, FM-3.2, FM-3.3** — task/role misspecification, missing verification: rewrite the prompt section governing that failure mode
- **FM-2.6 Reasoning-action mismatch** — add an explicit output schema; lock the action format
- **FM-2.2 Fail to ask for clarification** — add an explicit clarification gate at the ambiguous decision point (see Detection Patterns above)
- **Tool argument errors** — fix the tool description; add a `NOT when:` boundary; switch to absolute paths (SWE-bench team fixed a class of tool errors this way)
- **Stale context / step repetition** — add explicit `[DONE]` markers per step; add context compaction trigger

### Escalate to Architecture

- **Failure recurs after 3 prompt fixes** — the 3-strikes circuit breaker applies to debugging too. After three prompt interventions on the same failure mode, the failure likely requires architectural change (topology, verification layer, fresh-context dispatch). GSD Playbook: *"after three failed debugging attempts, the agent dumps state and recommends a fresh session."* (https://dstreefkerk.github.io/2026-02-agentic-architecture-playbook-patterns-for-reliable-llm-workflows/) See [workflow-following.md § Self-Correction and Reflection Loops](workflow-following.md).
- **FC2 misalignment across all multi-agent runs** — agent boundary definitions need redesign; the inter-agent interface is structurally ambiguous
- **FC3 failures persist after verification prompt addition** — current verifiers are performing only superficial checks; requires an independent verifier agent with a separate context
- **Failure only manifests at >10K context** — context budget architecture (fresh-context dispatch, compaction triggers) needs redesign

### Escalate to Model Tier

- **Task requires multi-step reasoning the current tier cannot handle** — try the next higher tier with the same minimal repro; if it succeeds, the task complexity exceeds the model
- **Version drift** — if behavior changed across a model version update without prompt changes, pin the model version and evaluate against the golden set before upgrading
- **Stochastic failure with production distribution** — if failure rate is >5% across the golden set on the same prompt, model sampling variance may require structured output enforcement or a tier upgrade

---

## Anti-Patterns

| Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Diagnosing from the agent's self-explanation | The agent's narration is generated text, not introspection; it confidently explains failures it didn't understand | Diagnose from observable actions and tool results; use reasoning blocks only as supporting signal |
| Changing the prompt before reproducing the failure | You cannot tell if the fix worked if you haven't confirmed reproduction | Reproduce first, then fix; verify reproduction is eliminated after the fix |
| Conflating "model couldn't figure it out" with "we didn't tell it" | FC1 at 41.77% — most failures are specification failures, not capability gaps | Apply MAST taxonomy; default hypothesis is prompt/specification failure until ablation rules it out |
| Global retry counter instead of per-tool | One bad tool exhausts the retry budget; unrelated tools get no retries | Per-tool circuit breakers; classify errors as retryable vs. non-retryable before retrying |
| Output-only transcript observation | Missing inputs causes 76% accuracy drop in step-level attribution | Log full inputs (system prompt, history, retrieved context) plus all tool results, not just agent outputs |
| Single-run diagnosis for stochastic failures | One run proves nothing about probabilistic failure modes | Run golden set across 20+ labeled inputs; measure failure rate, not presence/absence |
| Fixing the first visible step | Step 7 failure often traces to step 2 divergence | Find the first divergence point, not the first failure; work backward |
| Diagnosing FC2 failures from surface output alone | FM-2.4 and FM-2.5 look identical at the output layer but have different root causes | Use full trace with inter-agent message history; classify by MAST fine-grained modes |
| Assuming temperature=0 gives exact reproduction | MoE routing, float-point ordering, and probability ties still introduce variance | Use temperature=0 as a baseline; test across a distribution; design for resilience |
| Re-diagnosing the same failure class on every occurrence | Without post-mortems, every failure starts from scratch | Write post-mortems for critical failures; classify by MAST mode; build regression tests |
| Escalating to architecture after one failure | Most FC1/FC2 failures are prompt-fixable | Apply the 3-strikes rule: three prompt interventions, then escalate |
| Treating all verification failures as the same | FM-3.2 (no verification) and FM-3.3 (wrong verification) require different fixes | FM-3.2: add verification step; FM-3.3: replace proxy check with objective criterion |

---

## Cross-References

- [workflow-following.md](workflow-following.md) — Preventing drift before it happens: 5 canonical patterns, stopping conditions, self-correction loops, 3-strikes circuit breaker
- [token-turn-optimization.md](token-turn-optimization.md) — Context budget management: what fills context fastest, compaction triggers, how to keep transcripts readable
- [tool-design.md](tool-design.md) — Design-time tool engineering: the ACI choices that prevent environment-class failures before they happen
- [subagent-patterns.md](subagent-patterns.md) — Dispatch mechanics: isolating failures to sub-agent contexts, fresh-context dispatch as escalation strategy
