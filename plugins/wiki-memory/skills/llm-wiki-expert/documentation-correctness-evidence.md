---
tags: [llm-wiki/evidence]
summary: Macke and Doyle (NAACL 2024 Findings) measured mismatched-vs-missing docstrings on LLM code understanding; magnitudes exist only for the conditions named in prose, and the paper has no stale-documentation category.
---

# Incorrect vs Missing Documentation: What Macke and Doyle Actually Measured

Primary source: [Testing the Effect of Code Documentation on Large Language Model Code Understanding](https://aclanthology.org/2024.findings-naacl.66/), William Macke and Michael Doyle, Findings of NAACL 2024, pages 1044-1050 (arXiv [2404.03114](https://arxiv.org/abs/2404.03114)). Full text retrieved from the arXiv HTML rendering; the ACL PDF did not convert.

## Setup

- Models: `gpt-3.5-turbo` and GPT-4, via the OpenAI Chat Completions API. No open-weight or non-OpenAI model was tested.
- Corpus: HumanEval reference implementations.
- Task: generate unit tests for the given function. Understanding is measured indirectly, as the proportion of generated tests that pass versus fail or raise a runtime error. A secondary metric is average line coverage.
- Conditions: base file with the docstring stripped; base plus original docstring and comments; random comments (a docstring lifted from a different HumanEval function); variable names replaced with animals; variable names replaced with random strings; and partial docstrings retaining 10, 25, 50 or 75 percent of the original lines.

## The Magnitudes That Exist

Only the comparisons the authors state in prose carry numbers. Figures 2 through 5 are unlabeled bar charts, and Tables 1 and 2 report the count of tests generated, not success rates.

| Condition | GPT-3.5 success | GPT-4 success | Where |
|---|---|---|---|
| Base file, no docstring | 44.7% | 78.5% | body prose |
| Random comments (mismatched docstring) | 22.1% | 68.1% | body prose |
| Animal variable names | 40.6% | 76.6% | body prose |
| Base plus original comments | not stated numerically | not stated numerically | Figure 2 only |
| Partial docstrings, 10 to 75 percent | not stated numerically | not stated numerically | Figure 3 only |

So the headline effect is a drop from 44.7 to 22.1 percent for GPT-3.5 and from 78.5 to 68.1 percent for GPT-4, both significant at alpha equals 0.05. Adding correct documentation to the base file did not change the error and failure proportion by a statistically significant margin. Correct documentation did raise average line coverage significantly, which did not convert into a higher pass rate.

Do not read numbers off the figures. Anything not in the table above is a magnitude the paper does not publish.

## The Stale-Documentation Gap

The paper's two-way split is mismatched versus reduced. It has no outdated, stale or obsolete category, and never uses those words.

The load-bearing detail is how the harmful condition was built: a random comment or docstring taken from a **different HumanEval function**. That is coherent, well-formed prose describing the wrong code. It is not fabricated nonsense, and it is a fair analogue for a wiki page that described the code accurately three refactors ago. The partial-docstring arm removes lines at random, so it models a page that is merely thin, not a page that is confidently wrong about a changed API.

Consequence for wiki policy: a stale page whose claims no longer match the code sits on the harmful side of this evidence, not the neutral side. A page that is simply incomplete sits on the neutral side. The abstract's phrasing invites the opposite reading and should not be cited on its own.

## Scope Limits Before Citing

- Two proprietary models from one vendor, one snapshot, one language.
- HumanEval functions are short and self-contained; the authors flag broader codebases as future work and concede HumanEval may sit in the training data, which would invalidate the results.
- Every condition is a docstring co-located in the same file as the code. The paper says nothing about documentation retrieved separately from the code it describes, and offers no evidence about a wiki page fetched into context alongside a source file. Extending it to that setting is an inference, not a finding.
