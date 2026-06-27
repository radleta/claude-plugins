#!/usr/bin/env node
// ai-lint.mjs — Detect mechanical "AI writing" tells in text.
//
// Pure detection logic lives in exported functions so it can be unit-tested
// directly (see ai-lint.test.mjs). The CLI entrypoint at the bottom only runs
// when this file is executed, not when it is imported.
//
// The linter catches the OBJECTIVE, lexical/structural tells — the ones a regex
// can find reliably. The judgment-heavy tells (hollow symmetry, fake warmth,
// rhythm, rule-of-three abuse) are left to the human-voice SKILL.md workflow;
// a clean lint report does NOT mean the text reads as human.

// ─── Detection tables ────────────────────────────────────────────────────────
// Each table entry carries a short `fix` hint so the report is actionable.
// Severity tiers: "high" = strong tell on its own; "med" = tell in clusters;
// "low" = weak signal, only meaningful when stacked with others.

// Single words that read as AI filler. Word-boundary, case-insensitive.
export const WORD_TELLS = [
  { word: "delve", fix: "say 'look at' / 'dig into' / cut it" },
  { word: "delves", fix: "say 'looks at' / 'digs into'" },
  { word: "delving", fix: "say 'looking at' / 'digging into'" },
  { word: "leverage", fix: "say 'use'" },
  { word: "leverages", fix: "say 'uses'" },
  { word: "leveraging", fix: "say 'using'" },
  { word: "underscore", fix: "say 'show' / 'stress'" },
  { word: "underscores", fix: "say 'shows' / 'stresses'" },
  { word: "tapestry", fix: "drop the metaphor; name the thing" },
  { word: "testament", fix: "say 'shows' / 'proves'" },
  { word: "realm", fix: "say 'area' / 'field' / cut it" },
  { word: "landscape", fix: "say 'field' / 'market' / cut it" },
  { word: "robust", fix: "say what's actually strong about it" },
  { word: "seamless", fix: "say 'smooth' / cut it" },
  { word: "seamlessly", fix: "cut it or be specific" },
  { word: "crucial", fix: "say 'important' / cut the intensifier" },
  { word: "pivotal", fix: "say 'key' / cut it" },
  { word: "vibrant", fix: "show the detail instead of asserting it" },
  { word: "meticulous", fix: "show the care; don't label it" },
  { word: "meticulously", fix: "show the care; don't label it" },
  { word: "intricate", fix: "say 'detailed' / 'complex'" },
  { word: "intricacies", fix: "say 'details'" },
  { word: "boasts", fix: "say 'has'" },
  { word: "nestled", fix: "say 'in' / 'near'" },
  { word: "showcase", fix: "say 'show'" },
  { word: "showcases", fix: "say 'shows'" },
  { word: "showcasing", fix: "say 'showing'" },
  { word: "garner", fix: "say 'get' / 'earn'" },
  { word: "foster", fix: "say 'build' / 'support'" },
  { word: "fostering", fix: "say 'building' / 'supporting'" },
  { word: "bolster", fix: "say 'strengthen' / 'back'" },
  { word: "bolstered", fix: "say 'strengthened' / 'backed'" },
  { word: "myriad", fix: "say 'many' / give a number" },
  { word: "plethora", fix: "say 'lots of' / give a number" },
  { word: "elevate", fix: "say 'improve' / 'raise'" },
  { word: "enduring", fix: "say 'lasting' / cut it" },
  { word: "groundbreaking", fix: "cut the hype; say what's new" },
  { word: "renowned", fix: "say who knows it / cut it" },
  { word: "unwavering", fix: "cut the intensifier" },
  { word: "profound", fix: "say 'deep' / be specific" },
  // Corporate / Latinate filler — prefer the plain word
  { word: "utilize", fix: "say 'use'" },
  { word: "embark", fix: "say 'start' / 'begin'" },
  { word: "commence", fix: "say 'start'" },
  { word: "synergy", fix: "name the actual benefit" },
  { word: "synergies", fix: "name the actual benefits" },
  { word: "holistic", fix: "say 'whole' / be specific" },
  { word: "actionable", fix: "say 'usable', or cut it" },
  { word: "impactful", fix: "say what the impact is" },
  { word: "learnings", fix: "say 'lessons' / 'what we learned'" },
  { word: "underpins", fix: "say 'supports'" },
  // Symbolic gloss — assigning false weight to mundane things
  { word: "symbolizes", fix: "show it; don't assign meaning" },
  { word: "embodies", fix: "show it; don't assign meaning" },
];

// "Yellow" words: legitimate in moderation, but AI reaches for them reflexively.
// Flagged only from the SECOND occurrence onward, so a single use never trips.
export const YELLOW_WORDS = [
  "comprehensive",
  "significant",
  "essential",
  "fundamental",
  "dynamic",
  "innovative",
];

// Multi-word phrases that read as AI scaffolding. Case-insensitive substring.
export const PHRASE_TELLS = [
  { phrase: "it's important to note", fix: "just state it, or cut it" },
  { phrase: "it is important to note", fix: "just state it, or cut it" },
  { phrase: "worth noting", fix: "just state it, or cut it" },
  { phrase: "worth mentioning", fix: "just state it, or cut it" },
  { phrase: "stands as a testament", fix: "say what it shows" },
  { phrase: "serves as a testament", fix: "say what it shows" },
  { phrase: "a testament to", fix: "say 'shows' / 'proves'" },
  { phrase: "rich cultural heritage", fix: "name the specific thing" },
  { phrase: "rich history", fix: "name the specific events" },
  { phrase: "plays a vital role", fix: "say what it does" },
  { phrase: "plays a crucial role", fix: "say what it does" },
  { phrase: "plays a key role", fix: "say what it does" },
  { phrase: "plays a significant role", fix: "say what it does" },
  { phrase: "in the realm of", fix: "say 'in' / cut it" },
  { phrase: "in the world of", fix: "say 'in' / cut it" },
  { phrase: "when it comes to", fix: "say 'for' / cut it" },
  { phrase: "in today's fast-paced", fix: "cut the throat-clearing" },
  { phrase: "in today's digital age", fix: "cut the throat-clearing" },
  { phrase: "at the end of the day", fix: "cut the filler" },
  { phrase: "navigating the", fix: "say 'handling' / 'working through'" },
  { phrase: "navigate the", fix: "say 'handle' / 'work through'" },
  { phrase: "the ever-evolving", fix: "cut the cliche" },
  { phrase: "ever-changing", fix: "cut the cliche" },
  { phrase: "more than just", fix: "say what it is, directly" },
  { phrase: "dive into", fix: "say 'look at' / 'cover'" },
  { phrase: "let's explore", fix: "just start" },
  { phrase: "in conclusion", fix: "cut it; the ending is obvious" },
  { phrase: "deeply rooted", fix: "say where it comes from" },
  { phrase: "commitment to", fix: "show the action, not the label" },
  // Wordy Latinate filler
  { phrase: "in order to", fix: "say 'to'" },
  { phrase: "due to the fact that", fix: "say 'because'" },
  { phrase: "at this point in time", fix: "say 'now'" },
  { phrase: "in the event that", fix: "say 'if'" },
  { phrase: "has the ability to", fix: "say 'can'" },
  { phrase: "prior to", fix: "say 'before'" },
  // Treadmill restatement — same point, near-zero new information
  { phrase: "in other words", fix: "say it once, clearly, the first time" },
  { phrase: "put simply", fix: "just say the simple version" },
  { phrase: "to put it another way", fix: "say it once" },
  { phrase: "that is to say", fix: "say it once" },
  // Persuasive authority tropes
  { phrase: "the real question is", fix: "just ask the question" },
  { phrase: "at its core", fix: "cut it; say the thing" },
  { phrase: "what really matters", fix: "cut the framing" },
  { phrase: "the heart of the matter", fix: "cut the cliche" },
  // Signposting / announcing instead of delivering
  { phrase: "let's dive in", fix: "just start" },
  { phrase: "let's break this down", fix: "just explain it" },
  { phrase: "here's what you need to know", fix: "just tell them" },
  { phrase: "without further ado", fix: "cut it" },
  // Reader-steering frames
  { phrase: "what you need to know is", fix: "just state it" },
  { phrase: "the key insight here", fix: "just give the insight" },
  { phrase: "you might be wondering", fix: "cut the mind-reading" },
  // Infomercial engagement hooks (the '?' keeps these from over-matching)
  { phrase: "the catch?", fix: "cut the teaser; state it" },
  { phrase: "the kicker?", fix: "cut the teaser; state it" },
  { phrase: "sound familiar?", fix: "cut the manufactured hook" },
  // Faux-candor theatrical openers
  { phrase: "here's the thing", fix: "cut the faux-candor opener" },
  { phrase: "let's be honest", fix: "just be direct" },
  { phrase: "real talk", fix: "cut it; just say it" },
  // Whether-closer hedge-summary
  { phrase: "whether you're", fix: "if used to close a paragraph, cut the universal hedge" },
];

// Chatbot / assistant artifacts — high severity, near-certain tells when text
// is supposed to read as a human's own words.
export const ARTIFACT_TELLS = [
  { phrase: "certainly!", fix: "delete the assistant preamble" },
  { phrase: "i hope this helps", fix: "delete the sign-off" },
  { phrase: "let me know if you have", fix: "delete or make it specific" },
  { phrase: "feel free to", fix: "delete the filler" },
  { phrase: "as an ai", fix: "delete — never disclose the model in attributed text" },
  { phrase: "as a large language model", fix: "delete entirely" },
  { phrase: "i cannot fulfill", fix: "delete the refusal scaffolding" },
  { phrase: "as of my last", fix: "delete the cutoff disclaimer" },
  { phrase: "here's a", fix: "consider cutting the framing preamble" },
  { phrase: "great question", fix: "delete the flattery" },
  { phrase: "you're absolutely right", fix: "delete the sycophancy" },
  { phrase: "of course!", fix: "delete the preamble" },
  { phrase: "would you like me to", fix: "delete; just do it or ask plainly" },
  { phrase: "happy to help", fix: "delete the filler" },
];

// Regex structural tells. `re` must be global for index reporting.
export const STRUCTURE_TELLS = [
  {
    name: "not-only-but-also",
    re: /\bnot only\b[^.?!]*?\bbut also\b/gi,
    severity: "med",
    fix: "negative parallelism — make one direct positive claim",
  },
  {
    name: "not-just-but",
    re: /\bit'?s not just\b[^.?!]*?\bit'?s\b/gi,
    severity: "med",
    fix: "negative parallelism — state what it is, directly",
  },
  {
    name: "not-x-but-y",
    re: /\bnot (?:a|an|just|merely|simply)\b[^.?!,]*?,?\s+but (?:rather\s+)?(?:a|an)\b/gi,
    severity: "low",
    fix: "negative parallelism — lead with the positive",
  },
  {
    name: "from-x-to-y",
    re: /\bfrom (?:its|the|a)\b[^.?!]*?\bto (?:its|the|a)\b/gi,
    severity: "low",
    fix: "'from X to Y' sweep — name the specific items",
  },
];

// ─── Core analysis ───────────────────────────────────────────────────────────

function lineColAt(text, index) {
  let line = 1;
  let last = 0;
  for (let i = 0; i < index; i++) {
    if (text[i] === "\n") {
      line++;
      last = i + 1;
    }
  }
  return { line, col: index - last + 1 };
}

function pushMatch(findings, text, index, match, category, severity, fix) {
  const { line, col } = lineColAt(text, index);
  findings.push({ category, severity, match, line, col, index, fix });
}

function scanWords(text, findings) {
  for (const { word, fix } of WORD_TELLS) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      pushMatch(findings, text, m.index, m[0], "word", "med", fix);
    }
  }
}

function scanYellow(text, findings) {
  // Flag a yellow word only from its second occurrence onward — one use is fine,
  // repetition is the AI tell.
  for (const word of YELLOW_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    const hits = [];
    let m;
    while ((m = re.exec(text)) !== null) hits.push(m.index);
    if (hits.length >= 2) {
      pushMatch(findings, text, hits[1], `${word} (×${hits.length})`, "word:overused", "low",
        "AI reaches for this reflexively — keep at most one; vary or cut the rest");
    }
  }
}

function scanPhrases(text, list, category, severity, findings) {
  const lower = text.toLowerCase();
  for (const { phrase, fix } of list) {
    let from = 0;
    let idx;
    while ((idx = lower.indexOf(phrase, from)) !== -1) {
      pushMatch(findings, text, idx, text.slice(idx, idx + phrase.length), category, severity, fix);
      from = idx + phrase.length;
    }
  }
}

function scanStructure(text, findings) {
  for (const { name, re, severity, fix } of STRUCTURE_TELLS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      pushMatch(findings, text, m.index, m[0].trim(), `structure:${name}`, severity, fix);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
}

function scanFormatting(text, findings) {
  // Em/en-dash density: flag once if used heavily relative to length.
  const dashes = (text.match(/[—–]/g) || []).length;
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  if (dashes >= 3 && dashes / words > 0.01) {
    const idx = text.search(/[—–]/);
    pushMatch(findings, text, idx < 0 ? 0 : idx, `${dashes} em/en-dashes`, "formatting:em-dash",
      "low", "AI overuses em/en-dashes — swap some for commas, periods, or parens");
  }

  // Double-hyphen used as a dash substitute — another generation tell.
  const dh = text.indexOf(" -- ");
  if (dh !== -1) {
    pushMatch(findings, text, dh + 1, "--", "formatting:double-hyphen", "low",
      "replace ' -- ' with a comma, period, or parens");
  }

  // Curly quotes / apostrophes — a near-deterministic generation artifact.
  const curly = /[‘’“”]/g;
  let m;
  let curlyCount = 0;
  let firstCurly = -1;
  while ((m = curly.exec(text)) !== null) {
    curlyCount++;
    if (firstCurly < 0) firstCurly = m.index;
  }
  if (curlyCount > 0) {
    pushMatch(findings, text, firstCurly, `${curlyCount} curly quote(s)`, "formatting:curly-quotes",
      "low", "replace smart quotes with straight quotes unless the channel needs them");
  }

  // Emoji — almost always a tell in attributed prose.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;
  let firstEmoji = -1;
  let emojiCount = 0;
  while ((m = emoji.exec(text)) !== null) {
    emojiCount++;
    if (firstEmoji < 0) firstEmoji = m.index;
  }
  if (emojiCount > 0) {
    pushMatch(findings, text, firstEmoji, `${emojiCount} emoji`, "formatting:emoji",
      "med", "remove emoji from attributed/persuasive prose");
  }

  // Bold density: many **...** spans reads as mechanical key-term highlighting.
  const bold = (text.match(/\*\*[^*\n]+\*\*/g) || []).length;
  if (bold >= 4) {
    const idx = text.indexOf("**");
    pushMatch(findings, text, idx < 0 ? 0 : idx, `${bold} bold spans`, "formatting:bold-density",
      "low", "AI bolds key terms mechanically — keep bold for genuine emphasis only");
  }

  // Title Case Headings: markdown headings where most words are capitalized.
  const headingRe = /^#{1,6}\s+(.+)$/gm;
  while ((m = headingRe.exec(text)) !== null) {
    const heading = m[1].trim();
    const wordsInHeading = heading.split(/\s+/).filter((w) => /[a-z]/i.test(w));
    if (wordsInHeading.length >= 3) {
      const capped = wordsInHeading.filter((w) => /^[A-Z]/.test(w)).length;
      if (capped / wordsInHeading.length >= 0.8) {
        pushMatch(findings, text, m.index, heading, "formatting:title-case-heading",
          "low", "use sentence case for headings unless the house style is Title Case");
      }
    }
  }
}

function scanConjunctionOpeners(text, findings) {
  // Sentence/line openers like "Moreover," "Furthermore," "Additionally,".
  const re = /(^|[.!?]\s+|\n)\s*(Moreover|Furthermore|Additionally|However|Notably|Importantly)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = m.index + m[0].indexOf(m[2]);
    pushMatch(findings, text, idx, m[2], "transition-opener", "low",
      "AI opens sentences with these — cut or fold into the previous sentence");
  }
}

// analyze — the single entrypoint. Returns { findings, summary }.
export function analyze(text) {
  const findings = [];
  scanWords(text, findings);
  scanYellow(text, findings);
  scanPhrases(text, PHRASE_TELLS, "phrase", "med", findings);
  scanPhrases(text, ARTIFACT_TELLS, "artifact", "high", findings);
  scanStructure(text, findings);
  scanFormatting(text, findings);
  scanConjunctionOpeners(text, findings);

  findings.sort((a, b) => a.index - b.index);

  const summary = { high: 0, med: 0, low: 0, total: findings.length };
  for (const f of findings) summary[f.severity]++;
  return { findings, summary };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const HELP = `ai-lint — detect mechanical "AI writing" tells in text

Usage:
  ai-lint [options] [file]
  cat draft.md | ai-lint [options]

Reads from a file argument or stdin and reports lexical/structural AI tells.

Options:
  --json        Emit findings as JSON
  --quiet       Print only the summary line
  --exit-zero   Always exit 0 (default: exit 1 when any finding is reported)
  -h, --help    Show this help

Exit codes:
  0   no findings (or --exit-zero)
  1   one or more findings reported
  2   usage error

Note: a clean report does not mean the text reads as human. The linter only
catches objective tells; rhythm, hollow symmetry, and fake warmth need the
human-voice skill workflow.`;

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
  });
}

function formatText(findings, summary) {
  if (findings.length === 0) return "ai-lint: no tells found.";
  const lines = findings.map((f) => {
    const fix = f.fix ? `  → ${f.fix}` : "";
    return `  ${f.line}:${f.col}  [${f.severity}] ${f.category}: "${f.match}"${fix}`;
  });
  lines.push(
    `\nai-lint: ${summary.total} finding(s) — ${summary.high} high, ${summary.med} med, ${summary.low} low`
  );
  return lines.join("\n");
}

async function main(argv) {
  const args = argv.slice(2);
  const opts = { json: false, quiet: false, exitZero: false, file: null };
  for (const a of args) {
    if (a === "-h" || a === "--help") {
      process.stdout.write(HELP + "\n");
      return 0;
    } else if (a === "--json") opts.json = true;
    else if (a === "--quiet") opts.quiet = true;
    else if (a === "--exit-zero") opts.exitZero = true;
    else if (a.startsWith("-")) {
      process.stderr.write(`ai-lint: unknown option: ${a}\n`);
      return 2;
    } else opts.file = a;
  }

  let text;
  if (opts.file) {
    const { readFile } = await import("node:fs/promises");
    text = await readFile(opts.file, "utf8");
  } else if (!process.stdin.isTTY) {
    text = await readStdin();
  } else {
    process.stderr.write("ai-lint: no input (pass a file or pipe via stdin)\n");
    return 2;
  }

  const { findings, summary } = analyze(text);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ findings, summary }, null, 2) + "\n");
  } else if (opts.quiet) {
    process.stdout.write(
      `ai-lint: ${summary.total} finding(s) — ${summary.high} high, ${summary.med} med, ${summary.low} low\n`
    );
  } else {
    process.stdout.write(formatText(findings, summary) + "\n");
  }

  return opts.exitZero || summary.total === 0 ? 0 : 1;
}

// Run only when executed directly, not when imported by the test file.
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).then((code) => process.exit(code));
}
