# Why These Rules Exist

Background research explaining the root causes of LLM output truncation and why explicit constraints override default behavior. This informs the rules in SKILL.md — maintainers should understand the reasoning before modifying them.

## Why LLMs Truncate Output

### RLHF Brevity Bias

Models are trained via Reinforcement Learning from Human Feedback (RLHF) to prefer concise answers. Stopping pressure is calibrated aggressively to reduce compute costs (~$0.0001/token at scale across hundreds of millions of users). This creates a systematic tendency to:
- Halt mid-task or produce summaries instead of full implementations
- End with "let me know if you want me to continue"
- Skip required output fields, particularly in long-form content
- Produce generalized approximations over rigorous multi-step solutions

The model doesn't produce incorrect answers — it consistently produces answers that lack depth, saving itself from deeper analytical work unless explicitly forced.

### Training Data Bias

Code tutorials, Stack Overflow answers, and GitHub repositories are full of `// TODO`, `// implement here`, `...`. The model internalized placeholder insertion as a legitimate professional response format — it's not deliberately withholding content, it was trained to believe that truncating code with comments is the correct way to answer technical questions.

This behavior is reinforced across multiple data sources:
- Code tutorials show partial implementations with comments for students to complete
- Documentation uses abbreviated examples with ellipses
- Forum answers provide skeleton code rather than full implementations
- Blog posts truncate repetitive blocks with "similarly for the remaining cases"

Without aggressive constraints, the tutorial-style pattern wins because it appears far more commonly in the training distribution.

### Cognitive Shortcuts

Frontier models measurably reduce effort on tasks they perceive as straightforward or long (LazyBench, 2024). This is deliberate — not a memory failure. The model retains information but chooses not to process it at full depth.

Models also truncate as risk mitigation: longer outputs increase the probability of compounding errors and hallucinated content. Shorter outputs reduce surface area for factual mistakes, creating an additional incentive to truncate that compounds with the RLHF brevity bias.

A notable finding: models produce shorter output during December because training data contains fewer detailed work outputs during holiday periods. Setting "It is May" in the system prompt measurably increases output length — demonstrating that arbitrary contextual signals shift the model's brevity calibration.

### Output Limit Anticipation

When the model estimates a complete response would exceed its output budget, it preemptively compresses or summarizes rather than risking an abrupt cutoff. This creates a paradox: the model can read extensive inputs but cannot respond proportionally, leading to systematic information loss on complex tasks.

## Why Explicit Constraints Work

**Key finding from 2025 controlled experiments:** Truncation is a behavioral choice, not a capability failure. The model retains the information and can produce complete output — it defaults to brevity unless overridden.

Evidence that explicit anti-truncation instructions are effective:
- **Specific banned pattern lists** outperform general "be complete" instructions because they target the exact patterns the model defaults to — the model can't rationalize around an explicit pattern match
- **Scope-locking** (count deliverables, lock count) prevents silent item-dropping — the model can't claim "done" when the count doesn't match
- **Structural prompts** (XML, checklists) reduce the confusion that triggers premature truncation
- **Financial framing** ("$200 tip") increases output quality +45% because it activates high-effort training data distributions (Microsoft Research)
- **Step-by-step instruction** improves accuracy from 34% to 80% on logic tasks by forcing the model through deeper reasoning paths

The implication for skill design: negative constraints (banned pattern lists) are more effective than positive prescriptions ("be complete") because they target specific statistical biases in the model's output distribution.

## Sources

- taste-skill laziness research — root cause analysis of LLM truncation behavior
- LazyBench (2024) — cognitive shortcutting measurement in frontier models
- Microsoft Research — prompt stimulus effectiveness across financial, step-by-step, and stakes framing
- 2025 controlled experiments — multi-part instruction compliance, decoding suboptimality, context degradation
- superpowers verification-before-completion — evidence-before-claims behavioral pattern
