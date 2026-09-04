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

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

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
  { phrase: "navigating the complexities", fix: "say 'handling' / 'working through'" },
  { phrase: "navigating the challenges", fix: "say 'handling' / 'working through'" },
  { phrase: "navigate the complexities", fix: "say 'handle' / 'work through'" },
  { phrase: "navigate the challenges", fix: "say 'handle' / 'work through'" },
  { phrase: "the ever-evolving", fix: "cut the cliche" },
  { phrase: "ever-changing", fix: "cut the cliche" },
  { phrase: "more than just", fix: "say what it is, directly" },
  { phrase: "dive into", fix: "say 'look at' / 'cover'" },
  { phrase: "let's explore", fix: "just start" },
  { phrase: "in conclusion", fix: "cut it; the ending is obvious" },
  { phrase: "deeply rooted", fix: "say where it comes from" },
  { phrase: "commitment to excellence", fix: "show the action, not the label" },
  { phrase: "commitment to quality", fix: "show the action, not the label" },
  { phrase: "commitment to innovation", fix: "show the action, not the label" },
  { phrase: "commitment to sustainability", fix: "show the action, not the label" },
  { phrase: "commitment to delivering", fix: "show the action, not the label" },
  { phrase: "here's a", severity: "low", fix: "framing preamble — cut in attributed text; fine in casual notes" },
  { phrase: "let me know if you have", severity: "med", fix: "delete or make it specific" },
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
  // Era/world throat-clearing
  { phrase: "in an era of", fix: "cut the throat-clearing" },
  { phrase: "in an era where", fix: "cut the throat-clearing" },
  { phrase: "in a world where", fix: "cut the throat-clearing" },
  { phrase: "deep dive", fix: "say 'close look' / just cover it" },
  { phrase: "game-changer", fix: "say what actually changed" },
  { phrase: "game changer", fix: "say what actually changed" },
  { phrase: "unlock the full", fix: "name the concrete benefit" },
  { phrase: "unlock the power", fix: "name the concrete benefit" },
  { phrase: "unlock your potential", fix: "name the concrete benefit" },
  { phrase: "unlock new", fix: "name the concrete benefit" },
  // Manufactured warmth
  { phrase: "thrilled to", fix: "manufactured warmth — match the real emotional register" },
  { phrase: "excited to announce", fix: "manufactured warmth — match the real emotional register" },
  { phrase: "excited to share", fix: "manufactured warmth — match the real emotional register" },
  { phrase: "delighted to", fix: "manufactured warmth — match the real emotional register" },
  // Rhetorical-question transitions
  { phrase: "so what does this mean", fix: "cut the rhetorical-question transition; state the point" },
  { phrase: "what does this mean for", fix: "cut the rhetorical-question transition; state the point" },
  { phrase: "why does this matter", fix: "cut the rhetorical-question transition; state the point" },
];

// Chatbot / assistant artifacts — high severity, near-certain tells when text
// is supposed to read as a human's own words.
export const ARTIFACT_TELLS = [
  { phrase: "certainly!", fix: "delete the assistant preamble" },
  { phrase: "i hope this helps", fix: "delete the sign-off" },
  { phrase: "feel free to", fix: "delete the filler" },
  { phrase: "as an ai", fix: "delete — never disclose the model in attributed text" },
  { phrase: "as a large language model", fix: "delete entirely" },
  { phrase: "i cannot fulfill", fix: "delete the refusal scaffolding" },
  { phrase: "as of my last", fix: "delete the cutoff disclaimer" },
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
  {
    name: "isnt-just",
    re: /\b(?:isn|doesn|aren|don)['’]t (?:just|only|merely)\b[^.?!]{0,100}[.!?;—]\s*(?:it|they|that)['’]s\b/gi,
    severity: "med",
    fix: "negative parallelism — state what it is, directly",
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
  for (const entry of list) {
    const { phrase, fix } = entry;
    const entrySeverity = entry.severity ?? severity;
    let from = 0;
    let idx;
    while ((idx = lower.indexOf(phrase, from)) !== -1) {
      pushMatch(findings, text, idx, text.slice(idx, idx + phrase.length), category, entrySeverity, fix);
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
  const colonHeadlineRe = /^#{1,6}\s+[^:\n]{2,60}:\s+(?:Why|How|What)\b/;
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
    if (colonHeadlineRe.test(m[0])) {
      pushMatch(findings, text, m.index, heading, "formatting:colon-headline",
        "low", "'X: Why Y' headline formula — say the point as the title");
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

// Colon-fronted clauses in body prose: "The useful bit for us: consultants bill
// the same median." One is ordinary punctuation. A document that keeps doing it
// is running a template — the case that motivated this rule fronted 5 of its 8
// paragraphs that way, while a two-colon draft read fine. So the rule fires on
// density only: at least COLON_CLAUSE_MIN in the document AND at least one per
// four paragraphs, which keeps a long piece with a few stray colons quiet. It
// reports once, naming the count, because the repetition is the tell.
const COLON_CLAUSE_MIN = 3;

function scanColonClauses(text, findings) {
  const lines = text.split("\n");
  const hits = [];
  let offset = 0;
  let inFrontmatter = lines[0] !== undefined && lines[0].trim() === "---";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;
    offset += line.length + 1;
    if (inFrontmatter) {
      if (i > 0 && line.trim() === "---") inFrontmatter = false;
      continue;
    }
    // Headings (covered by the colon-headline rule), list-item lead-ins, and
    // table rows all use colons structurally rather than as prose punctuation.
    if (/^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\|)/.test(line)) continue;
    // Letter before the colon skips times (14:30); required whitespace after it
    // skips URLs (https://) and `key:value` pairs. Fenced and inline code is
    // already blanked out by maskCode before any scan runs.
    const re = /[A-Za-z)\]"'’]:\s+(?=\S)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const colonIdx = lineStart + m.index + m[0].indexOf(":");
      // A clause-fronting colon has a whole clause in front of it; short label
      // lead-ins ("Note: ...", "Update: ...") are not the tell. Look back through
      // the whole sentence, not just the line — prose is often hard-wrapped.
      const back = text.slice(Math.max(0, colonIdx - 200), colonIdx);
      const clause = back.split(/\n[ \t]*\n/).pop().split(/[.!?]\s/).pop();
      const wordsBefore = clause.trim().split(/\s+/).filter(Boolean).length;
      if (wordsBefore >= 4) hits.push(colonIdx);
    }
  }

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length || 1;
  if (hits.length >= COLON_CLAUSE_MIN && hits.length * 4 >= paragraphs) {
    pushMatch(findings, text, hits[0], `${hits.length} colon-fronted clauses`,
      "structure:colon-clause-density", "low",
      "repeating 'clause: clause' punctuation reads as a template — recast most as a period, a comma, or a rewrite");
  }
}

// Blank out fenced code blocks and inline code spans before scanning, so code
// content never trips a tell. Every non-newline character inside a masked
// region becomes a space — length and newlines are untouched, so line/col
// reporting still lines up with the original text. Blockquotes are left alone.
function maskCode(text) {
  let masked = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, (block) =>
    block.replace(/[^\n]/g, " ")
  );
  masked = masked.replace(/`[^`\n]+`/g, (span) => span.replace(/[^\n]/g, " "));
  return masked;
}

// analyze — the single entrypoint. Returns { findings, summary }.
export function analyze(text) {
  const scanned = maskCode(text);
  const findings = [];
  scanWords(scanned, findings);
  scanYellow(scanned, findings);
  scanPhrases(scanned, PHRASE_TELLS, "phrase", "med", findings);
  scanPhrases(scanned, ARTIFACT_TELLS, "artifact", "high", findings);
  scanStructure(scanned, findings);
  scanFormatting(scanned, findings);
  scanConjunctionOpeners(scanned, findings);
  scanColonClauses(scanned, findings);

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
// argv[1] is compared through realpath: the skill folder is reached via a symlink
// (~/.claude/skills -> the repo), and a raw string compare fails there, leaving the
// CLI to exit 0 with no output — a silent "clean" report.
const invokedAs = process.argv[1]
  ? pathToFileURL(realpathSync(process.argv[1])).href
  : "";
if (import.meta.url === invokedAs) {
  main(process.argv).then((code) => process.exit(code));
}
