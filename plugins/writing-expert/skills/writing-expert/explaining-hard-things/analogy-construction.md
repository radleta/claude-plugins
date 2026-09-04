---
tags: [writing/explaining-hard-things]
summary: "Good analogies work because they share structural relationships with the target concept, not just surface resemblance. The key craft challenge is testing whether the mapping holds for the causal and relational aspects that matter — and explicitly marking where the analogy breaks down."
code-cites: []
---

# Analogy Construction: Structural Mapping Over Surface Resemblance

Good analogies work because they share structural relationships with the target concept, not just surface resemblance. The key craft challenge is testing whether the mapping holds for the causal and relational aspects that matter — and explicitly marking where the analogy breaks down.

Source: Steven Pinker, *The Sense of Style* (2014); extended from classical analogy theory in cognitive science.

## Why Structural Mapping Matters

A surface-resemblance analogy ("containers are like boxes") names a category. A structural-mapping analogy ("a mutex is like a bathroom key: one person holds it, everyone else waits, and holding it too long creates a backup") names the *relationship* — the causal chain that makes the target concept behave the way it does.

Readers remember structural mappings because they can reason forward from them. If you understand why the bathroom-key analogy works (mutual exclusion + sequential access + contention under load), you can use that understanding to predict mutex behavior in new scenarios. A surface analogy can't do that.

## The Three-Part Test

Before committing to an analogy, run the structural-mapping test:

1. **What is the causal chain in the source domain?** In the bathroom-key analogy: one key → serial access → waiting queue → delay proportional to demand.
2. **Does the same causal chain hold in the target domain?** Mutex: one lock → serial critical section → waiting threads → latency proportional to contention. Yes — the mapping is structural.
3. **Where does the mapping break?** Bathroom key: lost key = system failure, no re-entry. Mutex: deadlock = system failure, no re-entry. That part holds. But: bathroom key is physical and visible; mutex is abstract and invisible to the operating system without instrumentation. Name that break explicitly.

## The "Unlike" Clause

Every analogy breaks somewhere. The break is not a weakness — explicitly marking it is a strength. It shows the reader they can trust the analogy where it holds, because you told them where it doesn't.

Pattern: "[Analogy] works because [structural mapping]. Unlike [source domain], [target domain] [key difference that matters for this explanation]."

Omitting the "unlike" clause invites the reader to extend the analogy past the point where it holds, producing false intuitions.

## When Analogies Mislead

An analogy misleads when:
- The surface resemblance is strong but the causal structure is different.
- The writer uses the analogy to avoid explaining the actual mechanism.
- The "unlike" clause is omitted and the reader extends the analogy into the domain where it breaks.

The diagnostic: if you cannot articulate the structural mapping in one sentence (not a metaphor, but a causal parallel), the analogy is probably surface-level and will mislead.

## See also

- [narrative-craft/structural-tension](../narrative-craft/structural-tension.md) — Structural tension is the reader's knowledge gap; a well-constructed analogy can give that gap a productive shape by mapping familiar structure onto unfamiliar territory, making the tension feel illuminating rather than frustrating.

## How to apply

1. **Before using an analogy, write the structural mapping explicitly** (not in the piece — in your notes): "X is like Y because [causal chain] parallels [causal chain]."
2. **Run the three-part test.** If the causal chains don't match, the analogy is surface-level — find a different one.
3. **Write the "unlike" clause** before drafting the analogy. Know in advance where the mapping breaks, so you can decide whether to include it in the piece (usually: yes) or to stop the analogy before it reaches the break.
4. **Test with a skeptical reader.** After reading the analogy, ask: "What would you predict about X based on this analogy?" If their prediction is wrong (because the analogy breaks there), you have found the boundary you need to mark.
5. **Prefer familiar process-level analogies over object-level analogies.** "Like a traffic light" (object) is weaker than "like a traffic light: queues build during red, flush during green, and the ratio of red-to-green determines throughput" (process/causal).
