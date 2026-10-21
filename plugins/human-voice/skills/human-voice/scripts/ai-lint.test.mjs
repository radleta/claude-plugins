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

test("here's a / let me know if you have report distinct severities", () => {
  const here = analyze("Here's a quick update.");
  const hereFinding = here.findings.find((f) => f.match.toLowerCase() === "here's a");
  assert.ok(hereFinding, JSON.stringify(here.findings));
  assert.equal(hereFinding.severity, "low");

  const letKnow = analyze("Let me know if you have any concerns.");
  const letFinding = letKnow.findings.find((f) => f.match.toLowerCase() === "let me know if you have");
  assert.ok(letFinding, JSON.stringify(letKnow.findings));
  assert.equal(letFinding.severity, "med");
});

test("narrowed 'commitment to' skips literal commitments, flags puffery", () => {
  const clean = analyze("Our commitment to close by Friday stands.");
  assert.ok(!matched(clean).some((m) => m.startsWith("commitment to")));

  const flagged = analyze("We're proud of their commitment to excellence.");
  assert.ok(matched(flagged).includes("commitment to excellence"));
});

test("narrowed 'navigate the' skips literal UI navigation, flags the cliche", () => {
  const clean = analyze("navigate the settings panel");
  assert.ok(!matched(clean).some((m) => m.startsWith("navigate the") || m.startsWith("navigating the")));

  const flagged = analyze("navigating the complexities of tax law");
  assert.ok(matched(flagged).includes("navigating the complexities"));
});

test("flags cross-sentence negative parallelism (isn't just X. It's Y.)", () => {
  const r = analyze("It isn't just a dashboard. It's a philosophy.");
  assert.ok(cats(r).includes("structure:isnt-just"), JSON.stringify(r.findings));
});

test("catches era throat-clearing, manufactured warmth, and game-changer", () => {
  assert.ok(matched(analyze("in an era of rapid change")).includes("in an era of"));
  assert.ok(matched(analyze("We're thrilled to announce the update.")).includes("thrilled to"));
  assert.ok(matched(analyze("a real game-changer")).includes("game-changer"));
});

test("flags colon-headline formula but not a literal step heading", () => {
  const formula = analyze("## Serverless: Why It Matters\n\nbody");
  assert.ok(cats(formula).includes("formatting:colon-headline"));

  const step = analyze("## Step 1: configure the webhook\n\nbody");
  assert.ok(!cats(step).includes("formatting:colon-headline"));
});

test("masks fenced and inline code so tells inside code don't fire", () => {
  const doc = [
    "We should not delve into filler words here.",
    "",
    "```js",
    "// delve is fine inside code",
    "const message = \"delve\";",
    "```",
    "",
    "Also skip `delve` when it's inline code.",
  ].join("\n");
  const r = analyze(doc);
  const delveHits = r.findings.filter((f) => f.match.toLowerCase() === "delve");
  assert.equal(delveHits.length, 1, JSON.stringify(r.findings));
  assert.equal(delveHits[0].line, 1);
});

test("end-to-end: human sample yields no high-severity findings", () => {
  const r = analyze(
    "Here's a quick note: I reviewed the contract and the indemnification clause looks fine. Let me know if you have any concerns about section 4. Our commitment to close by Friday stands."
  );
  assert.equal(r.summary.high, 0, JSON.stringify(r.findings));
});

test("flags colon-fronted clause density but not a single instance", () => {
  const dense = [
    "The one finding I'd actually hand somebody: part-time consultants bill the same median.",
    "",
    "On us being related: bring it up yourself before anyone else does.",
    "",
    "One thing to flag now so it doesn't surprise anyone later: I'm set up to contract.",
  ].join("\n");
  const r = analyze(dense);
  const f = r.findings.find((x) => x.category === "structure:colon-clause-density");
  assert.ok(f, JSON.stringify(r.findings));
  assert.equal(f.severity, "low");
  assert.ok(f.match.startsWith("3 colon-fronted clauses"));

  const single = analyze("On us being related: bring it up yourself before anyone else does.");
  assert.ok(!cats(single).includes("structure:colon-clause-density"));
});

test("colon-clause density ignores code, URLs, times, headings, lists, and frontmatter", () => {
  const doc = [
    "---",
    "title: the plan",
    "author: someone",
    "---",
    "",
    "## Serverless costs: what we measured",
    "",
    "We met at 14:30 and again at 09:15 to walk the numbers with the team.",
    "",
    "The reference is at https://example.com/a and the mirror at https://example.org/b now.",
    "",
    "- The first thing we checked: the invoices matched what the vendor quoted.",
    "- The second thing we checked: the hours matched the invoices exactly.",
    "",
    "Run the helper with `node scripts/thing.mjs: run` to see the totals printed.",
    "",
    "```yaml",
    "one thing we checked here: the invoices",
    "another thing we checked: the hours",
    "```",
  ].join("\n");
  const r = analyze(doc);
  assert.ok(!cats(r).includes("structure:colon-clause-density"), JSON.stringify(r.findings));
});

// ─── Structural warnings ─────────────────────────────────────────────────────

const warned = (r, category) => r.warnings.find((w) => w.category === category);
const sections = (endings) => endings.map((e, i) => `## Part ${i + 1}\n\nSome body text for part ${i + 1}. ${e}`).join("\n\n");

test("contraction density: spelled-out text warns, contracted text does not", () => {
  const formal = analyze(Array(8).fill("It is late and we are tired, but the build does not pass.").join(" "));
  const w = warned(formal, "structure:contraction-density");
  assert.ok(w, JSON.stringify(formal.warnings));
  assert.ok(w.match.startsWith("0 contractions vs 24 spelled-out forms"), w.match);

  const casual = analyze(Array(8).fill("It's late and we're tired, but the build doesn't pass.").join(" "));
  assert.ok(!warned(casual, "structure:contraction-density"), JSON.stringify(casual.warnings));
});

test("rather-than frequency: dense use warns with lines, sparse use in long text does not", () => {
  const dense = analyze(Array(5).fill("We chose the first option rather than the second.").join("\n"));
  const w = warned(dense, "structure:rather-than");
  assert.ok(w, JSON.stringify(dense.warnings));
  assert.deepEqual(w.lines, [1, 2, 3, 4, 5]);

  const sparse = analyze("word ".repeat(2000) + Array(4).fill("Use this instead of that.").join(" "));
  assert.ok(!warned(sparse, "structure:rather-than"), JSON.stringify(sparse.warnings));
});

test("semicolon corrective pairs: claim/reversal pairs warn, ordinary semicolons do not", () => {
  const pairs = analyze([
    "The distinction matters to me; to a user it's the same thing.",
    "",
    "Internal tools count as usable; a customer feature does not count until a customer can reach it.",
    "",
    "The plan looked settled; but the budget said otherwise.",
  ].join("\n"));
  const w = warned(pairs, "structure:semicolon-corrective");
  assert.ok(w, JSON.stringify(pairs.warnings));
  assert.deepEqual(w.lines, [1, 3, 5]);

  const ordinary = analyze([
    "Keep changes small and contained; nothing risky going in before the move.",
    "",
    "The Potrace pipeline is ready; the work left is curation with human review.",
    "",
    "We met on Tuesday; the notes went out Wednesday.",
    "",
    "| a; not b | c; but d | e; to a user |",
  ].join("\n"));
  assert.ok(!warned(ordinary, "structure:semicolon-corrective"), JSON.stringify(ordinary.warnings));
});

test("section endings: a shared opener or trailing clause warns, varied endings do not", () => {
  const opener = analyze(sections(Array(5).fill("That's the whole point of the change.")));
  const w = warned(opener, "structure:section-ending-shape");
  assert.ok(w, JSON.stringify(opener.warnings));
  assert.ok(w.match.startsWith('5 of 5 section endings open with "that\'s"'), w.match);

  const trailing = analyze(sections([
    "The deploy went out on Friday, and nobody noticed a thing.",
    "The audit covered every project area, so the gaps are known now.",
    "We moved the ads over in one step, and the bottom slot came back.",
    "The backlog was sorted by severity, so the blockers come first.",
    "Dana wrote the reference pages himself, and they cover each area.",
  ]));
  assert.ok(warned(trailing, "structure:section-ending-shape").match.includes('", and …" / ", so …"'));

  const varied = analyze(sections([
    "See Stage 3 below.",
    "Shipping that blind was not an option.",
    "Each stage gates the next.",
    "Nothing at those two ratings goes out in this release.",
    "Full detail went out in the release note at the time.",
  ]) + "\n\n## Table\n\n| a | b |\n|---|---|\n| That's | it |");
  assert.ok(!warned(varied, "structure:section-ending-shape"), JSON.stringify(varied.warnings));
});

test("warnings never change the exit code or the finding summary", async () => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const input = Array(5).fill("We chose the first option rather than the second.").join("\n");
  assert.equal(analyze(input).summary.total, 0);
  const run = spawnSync(process.execPath, [fileURLToPath(new URL("./ai-lint.mjs", import.meta.url))], { input, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.ok(run.stdout.includes("[warn] structure:rather-than"), run.stdout);
});

test("clean output names the structure audit in text and --quiet modes, never in --json", async () => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const cli = fileURLToPath(new URL("./ai-lint.mjs", import.meta.url));
  const input = "I read the contract last night. Call them tomorrow and ask for the 30-day version.";
  const reminder = "Structure audit still required: Step 3 tells (human-voice references/scrub.md), reshuffle test, read-aloud test, self-critique (references/structure-audit.md).";
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { input, encoding: "utf8" });

  const text = run();
  assert.equal(text.status, 0, text.stdout + text.stderr);
  assert.equal(text.stdout, `ai-lint: no mechanical tells found. ${reminder}\n`);

  const quiet = run("--quiet");
  assert.equal(quiet.status, 0, quiet.stdout + quiet.stderr);
  assert.equal(quiet.stdout, `ai-lint: 0 finding(s) — 0 high, 0 med, 0 low\n${reminder}\n`);

  const json = run("--json");
  assert.equal(json.status, 0, json.stdout + json.stderr);
  assert.equal(JSON.parse(json.stdout).summary.total, 0);
  assert.ok(!json.stdout.includes("Structure audit"), json.stdout);

  const dirty = spawnSync(process.execPath, [cli, "--quiet"], { input: "We will delve into this robust tapestry.", encoding: "utf8" });
  assert.equal(dirty.status, 1);
  assert.ok(!dirty.stdout.includes("Structure audit"), dirty.stdout);
});

test("flags a labeled announcement before inline prose, in colon, period and dash forms", () => {
  for (const s of [
    "One housekeeping item: our forwarding address is 12 Elm St.",
    "The truck is booked. One caveat, since I'd rather flag it now than surprise you later: we may lose a day.",
    "One caveat. Cross-country in a truck takes time.",
    "A quick note — our forwarding address is X.",
    "One thing worth flagging: the lease ends in May.",
  ]) {
    assert.ok(cats(analyze(s)).includes("structure:labeled-announcement"), s);
  }
});

test("labeled-announcement rule stays quiet on list introducers and ordinary sentences", () => {
  for (const s of [
    "Two options:\n- rent now\n- rent later",
    "One note:\n- the fob is late",
    "The steps are: run it, then check it.",
    "One of the caveats is the truck.",
    "Another tenant moved in on Friday.",
    "A reminder, sent the day before, cut no-shows by half. We kept it.",
    "One point, as Dana said, still stands. The lease ends in May.",
    "Another request, filed in May, is still open. We are waiting.",
  ]) {
    assert.ok(!cats(analyze(s)).includes("structure:labeled-announcement"), s);
  }
});

test("tier 1 reports each em dash and leaves en dashes to the density rule", () => {
  const text = "The clause is the problem — call them. Ask for the short version — it is three pages.";
  assert.equal(analyze("Read pages 3–5 tonight.", { tier: 1 }).summary.total, 0);
  assert.ok(!cats(analyze(text)).includes("formatting:em-dash"));
  assert.ok(!cats(analyze(text, { tier: 2 })).includes("formatting:em-dash"));
  const hits = analyze(text, { tier: 1 }).findings.filter((f) => f.category === "formatting:em-dash");
  assert.deepEqual(hits.map((f) => f.match), ["—", "—"]);
  const ranges = analyze("Pages 3–5, 7–9 and 11–12.", { tier: 1 }).findings;
  assert.deepEqual(ranges.map((f) => f.match), ["3 en-dashes"]);
});

test("flags the email openers as high and the business filler as phrases", () => {
  const opener = analyze("I wanted to reach out about the lease.");
  assert.ok(opener.findings.some((f) => f.match.toLowerCase() === "i wanted to reach out" && f.severity === "high"));
  assert.equal(opener.summary.total, 1, "the filler inside the opener is not a second finding");
  assert.ok(cats(analyze("I hope you’re doing well.")).includes("phrase"), "typographic apostrophe");
  for (const s of ["I hope this email finds you well.", "I know you're busy, so here it is.", "Let's circle back on Friday.", "Just following up on the invoice."]) {
    assert.ok(cats(analyze(s)).includes("phrase"), s);
  }
  for (const s of ["A breach outside the EU is reported.", "Use a circle background here.", "It has a touch based menu."]) {
    assert.equal(analyze(s).summary.total, 0, s);
  }
  assert.ok(cats(analyze("Please reach out, or touch base.")).includes("phrase"), "punctuation after the phrase");
});

test("'solutions' and 'align' trip only from the second use", () => {
  assert.equal(analyze("We sell storage solutions.").summary.total, 0);
  assert.ok(cats(analyze("We sell storage solutions and shipping solutions.")).includes("word:overused"));
  assert.ok(cats(analyze("We align on scope, then align on price.")).includes("word:overused"));
});

test("CLI: --tier 1 fails one em dash, no flag passes it, and a bad tier is a usage error", async () => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const cli = fileURLToPath(new URL("./ai-lint.mjs", import.meta.url));
  const run = (input, ...args) => spawnSync(process.execPath, [cli, ...args], { input, encoding: "utf8" });
  const dash = "The renewal clause is the problem — call them tomorrow.";
  assert.equal(run(dash).status, 0);
  assert.equal(run(dash, "--tier", "2").status, 0);
  const banned = run(dash, "--tier", "1");
  assert.equal(banned.status, 1);
  assert.match(banned.stdout, /formatting:em-dash/);
  assert.equal(run(dash, "--tier", "3").status, 2);
  assert.equal(run(dash, "--tier").status, 2);
  const label = run("One housekeeping item: our forwarding address is 12 Elm St.");
  assert.equal(label.status, 1);
  assert.match(label.stdout, /structure:labeled-announcement/);
  assert.equal(run("Two options:\n- rent now\n- rent later").status, 0);
  assert.equal(run("I wanted to reach out").status, 1);
});
