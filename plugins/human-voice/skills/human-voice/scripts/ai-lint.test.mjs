#!/usr/bin/env node
// ai-lint.test.mjs — unit tests for the ai-lint detection core.
// Run: node --test .claude/skills/human-voice/scripts/

import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, WORD_TELLS, PHRASE_TELLS, ARTIFACT_TELLS } from "./ai-lint.mjs";

const cats = (r) => r.findings.map((f) => f.category);
const matched = (r) => r.findings.map((f) => f.match.toLowerCase());

test("clean human text produces no findings", () => {
  const r = analyze("I read the contract last night. The renewal clause is the problem — call them tomorrow and ask for the 30-day version.");
  // The single em-dash is below the density threshold, so this stays clean.
  assert.equal(r.summary.total, 0, JSON.stringify(r.findings));
});

test("flags single-word tells with word boundaries", () => {
  const r = analyze("We should leverage this robust framework to delve into the data.");
  const words = matched(r);
  assert.ok(words.includes("leverage"));
  assert.ok(words.includes("robust"));
  assert.ok(words.includes("delve"));
});

test("word boundary prevents false positives inside other words", () => {
  // "fostering" is its own tell, but "foster" must not also fire inside it,
  // and unrelated substrings must not match.
  const r = analyze("The keyboard had a robustness rating.");
  // "robust" should NOT match inside "robustness" (word boundary on both sides).
  assert.ok(!matched(r).includes("robust"));
});

test("catches inflected forms of iconic AI words", () => {
  const r = analyze("The post leverages cloud tooling while delving into the details.");
  const words = matched(r);
  assert.ok(words.includes("leverages"));
  assert.ok(words.includes("delving"));
});

test("flags multi-word phrase tells", () => {
  const r = analyze("It's important to note that this plays a vital role in the realm of finance.");
  const phrases = matched(r);
  assert.ok(phrases.includes("it's important to note"));
  assert.ok(phrases.includes("plays a vital role"));
  assert.ok(phrases.includes("in the realm of"));
});

test("flags chatbot artifacts as high severity", () => {
  const r = analyze("Certainly! Here's a draft. I hope this helps.");
  const high = r.findings.filter((f) => f.severity === "high");
  assert.ok(high.length >= 2, JSON.stringify(r.findings));
  assert.ok(cats(r).includes("artifact"));
});

test("catches sign-off variants without 'any' (eval-found gap)", () => {
  const r = analyze("Sounds good. Let me know if you have questions.");
  assert.ok(matched(r).some((m) => m.startsWith("let me know if you have")));
});

test("catches bare 'worth noting' / 'worth mentioning' (eval-found gap)", () => {
  const r = analyze("One thing worth noting: the report is late. Also worth mentioning: the cost.");
  const m = matched(r);
  assert.ok(m.includes("worth noting"));
  assert.ok(m.includes("worth mentioning"));
});

test("flags negative parallelism structure", () => {
  const r = analyze("This is not only a tool but also a philosophy.");
  assert.ok(cats(r).some((c) => c.startsWith("structure:not-only")));
});

test("flags 'it's not just X, it's Y' parallelism", () => {
  const r = analyze("It's not just sourcing, it's framing the whole argument.");
  assert.ok(cats(r).some((c) => c.startsWith("structure:not-just")));
});

test("flags em-dash overuse but not a single em-dash", () => {
  const single = analyze("Call them tomorrow — early.");
  assert.ok(!cats(single).includes("formatting:em-dash"));

  const many = analyze("A — B — C — D — E are all words here in this line of text.");
  assert.ok(cats(many).includes("formatting:em-dash"));
});

test("flags curly quotes and emoji", () => {
  const r = analyze("She said “hello” 😊 to everyone.");
  assert.ok(cats(r).includes("formatting:curly-quotes"));
  assert.ok(cats(r).includes("formatting:emoji"));
});

test("flags title-case headings but not sentence-case", () => {
  const title = analyze("## Impact Of Technology And Digitalization\n\nbody");
  assert.ok(cats(title).includes("formatting:title-case-heading"));

  const sentence = analyze("## Impact of technology and digitalization\n\nbody");
  assert.ok(!cats(sentence).includes("formatting:title-case-heading"));
});

test("flags transition openers only at sentence start", () => {
  const opener = analyze("The plan worked. Moreover, it scaled well across teams.");
  assert.ok(cats(opener).includes("transition-opener"));
});

test("findings carry line/col and fix hints", () => {
  const r = analyze("ok\nWe leverage things.");
  const f = r.findings.find((x) => x.match.toLowerCase() === "leverage");
  assert.equal(f.line, 2);
  assert.ok(typeof f.col === "number" && f.col > 0);
  assert.ok(typeof f.fix === "string" && f.fix.length > 0);
});

test("summary counts match severities", () => {
  const r = analyze("Certainly! We leverage a robust testament to synergy.");
  const recount = { high: 0, med: 0, low: 0 };
  for (const f of r.findings) recount[f.severity]++;
  assert.deepEqual(
    { high: r.summary.high, med: r.summary.med, low: r.summary.low },
    recount
  );
  assert.equal(r.summary.total, r.findings.length);
});

test("catches corporate/Latinate single words", () => {
  const r = analyze("We utilize synergy to embark on actionable learnings.");
  const w = matched(r);
  assert.ok(w.includes("utilize"));
  assert.ok(w.includes("synergy"));
  assert.ok(w.includes("embark"));
  assert.ok(w.includes("actionable"));
});

test("catches new phrase clusters (treadmill, authority, signposting, latinate)", () => {
  const r = analyze("In order to win, let's dive in. In other words, at its core, here's the thing.");
  const m = matched(r);
  assert.ok(m.includes("in order to"));
  assert.ok(m.includes("let's dive in"));
  assert.ok(m.includes("in other words"));
  assert.ok(m.includes("at its core"));
  assert.ok(m.includes("here's the thing"));
});

test("yellow words: one use is clean, repeat is flagged", () => {
  const once = analyze("This is a comprehensive guide.");
  assert.ok(!cats(once).includes("word:overused"));

  const twice = analyze("A comprehensive plan with comprehensive coverage.");
  const f = twice.findings.find((x) => x.category === "word:overused");
  assert.ok(f, JSON.stringify(twice.findings));
  assert.ok(f.match.includes("comprehensive"));
  assert.equal(f.severity, "low");
});

test("catches new chatbot artifacts", () => {
  const r = analyze("Of course! You're absolutely right. Happy to help.");
  const high = r.findings.filter((f) => f.severity === "high");
  assert.ok(high.length >= 3, JSON.stringify(r.findings));
});

test("catches en-dash overuse and double-hyphen substitute", () => {
  const en = analyze("A – B – C – D – E words here in this longer line of text.");
  assert.ok(cats(en).includes("formatting:em-dash"));

  const dh = analyze("Call them tomorrow -- early in the day.");
  assert.ok(cats(dh).includes("formatting:double-hyphen"));
});

test("detection tables are non-empty and well-formed", () => {
  assert.ok(WORD_TELLS.length > 10);
  assert.ok(PHRASE_TELLS.length > 10);
  assert.ok(ARTIFACT_TELLS.length > 5);
  for (const t of [...WORD_TELLS, ...PHRASE_TELLS, ...ARTIFACT_TELLS]) {
    assert.ok(typeof t.fix === "string" && t.fix.length > 0);
  }
});
