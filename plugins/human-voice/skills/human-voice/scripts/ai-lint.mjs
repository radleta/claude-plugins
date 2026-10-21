#!/usr/bin/env node
// ai-lint.mjs — Detect mechanical "AI writing" tells in text.
//
// Pure detection logic lives in exported functions so it can be unit-tested
// directly (see ai-lint.test.mjs). The CLI entrypoint at the bottom only runs
// when this file is executed, not when it is imported.
//
// The linter catches the OBJECTIVE, lexical/structural tells — the ones a regex
// can find reliably. The judgment-heavy tells (hollow symmetry, fake warmth,
// rhythm, rule-of-three abuse) are left to human-voice references/scrub.md Step 3;
// a clean lint report does NOT mean the text reads as human.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

// ─── Warning thresholds ──────────────────────────────────────────────────────
// Structural warnings judge a whole document's habits. They never change the
// exit code: each has a legitimate human use, so a warning is a prompt for a
// prose read, not a finding.

// Contractions as a share of contractable spots (contractions plus the same
// forms spelled out: "does not", "it is"). Judged only once there are enough
// spots for the ratio to hold; informal human prose runs well above half.
const CONTRACTION_MIN_SPOTS = 20;
const CONTRACTION_MAX_RATIO = 0.2;
// "rather than" / "instead of": at least RATHER_MIN uses AND more than one per
// RATHER_WORDS_PER_USE words, so a long piece may use a handful.
const RATHER_MIN = 4;
const RATHER_WORDS_PER_USE = 400;
// Semicolon-joined corrective pairs: one is punctuation, a habit is the tell.
const SEMICOLON_PAIR_MIN = 3;
// Section endings: judged once SECTION_MIN sections end on prose; warn when one
// shape ends at least SECTION_SHAPE_MIN of them and SECTION_SHAPE_SHARE of all.
// The share sits under half: across a long document, one closing move at two
// sections in five is already a rhythm the reader hears.
const SECTION_MIN = 5;
const SECTION_SHAPE_MIN = 4;
const SECTION_SHAPE_SHARE = 0.4;

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
  "solutions",
  "align",
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
  // Email openers that delay the point. Near-certain tells, like the artifacts below.
  { phrase: "i hope this email finds you well", severity: "high", fix: "delete the opener; start with the point" },
  { phrase: "i hope you're doing well", severity: "high", fix: "delete the opener; start with the point" },
  { phrase: "i wanted to reach out", severity: "high", fix: "delete the opener; start with the point" },
  { phrase: "i came across your company", severity: "high", fix: "delete the opener; start with the point" },
  { phrase: "i've been following your work", severity: "high", fix: "delete the opener; start with the point" },
  { phrase: "quick question for you", severity: "high", fix: "delete the opener; ask the question" },
  { phrase: "i'll keep this brief", severity: "high", fix: "delete the opener; be brief" },
  { phrase: "i know you're busy", severity: "high", fix: "delete the opener; start with the point" },
  // Business filler
  { phrase: "reach out", word: true, fix: "say 'write' / 'call' / 'email'" },
  { phrase: "circle back", word: true, fix: "say when you will reply, or cut it" },
  { phrase: "touch base", word: true, fix: "say 'talk' / 'meet', or cut it" },
  { phrase: "at your earliest convenience", fix: "name a date, or cut it" },
  { phrase: "just following up", fix: "say what you need and by when" },
  { phrase: "just bumping this", fix: "say what you need and by when" },
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
  // Typographic apostrophes fold to straight ones, so "you’re" still matches.
  const lower = text.toLowerCase().replace(/[‘’]/g, "'");
  for (const entry of list) {
    const { phrase, fix } = entry;
    const entrySeverity = entry.severity ?? severity;
    let from = 0;
    let idx;
    while ((idx = lower.indexOf(phrase, from)) !== -1) {
      from = idx + phrase.length;
      // `word` entries are short enough to sit inside other words ("breach outside").
      if (entry.word && (/[a-z]/.test(lower[idx - 1] ?? "") || /[a-z]/.test(lower[from] ?? ""))) continue;
      pushMatch(findings, text, idx, text.slice(idx, idx + phrase.length), category, entrySeverity, fix);
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

function scanFormatting(text, findings, tier) {
  // Tier 1 bans the em dash: one finding each. En dashes, which number ranges
  // use, stay on the density rule at every tier.
  let dashRe = /[—–]/g;
  let dashName = "em/en-dashes";
  if (tier === 1) {
    for (const m of text.matchAll(/—/g)) {
      pushMatch(findings, text, m.index, "—", "formatting:em-dash", "med",
        "Tier 1 bans em dashes — end the sentence or use a comma");
    }
    dashRe = /–/g;
    dashName = "en-dashes";
  }
  // Dash density: flag once if used heavily relative to length.
  const dashes = (text.match(dashRe) || []).length;
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  if (dashes >= 3 && dashes / words > 0.01) {
    pushMatch(findings, text, text.search(dashRe), `${dashes} ${dashName}`, "formatting:em-dash",
      "low", `AI overuses ${dashName} — swap some for commas or periods`);
  }

  // Double-hyphen used as a dash substitute — another generation tell.
  const dh = text.indexOf(" -- ");
  if (dh !== -1) {
    pushMatch(findings, text, dh + 1, "--", "formatting:double-hyphen", "low",
      "replace ' -- ' with a comma or a period");
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
  // The opener test walks back from the word: a regex prefix over the whitespace
  // before it is quadratic in a long run of blank lines.
  const re = /\b(Moreover|Furthermore|Additionally|However|Notably|Importantly)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let j = m.index;
    while (j > 0 && /\s/.test(text[j - 1])) j--;
    const gap = text.slice(j, m.index);
    if (j !== 0 && !gap.includes("\n") && !(gap && /[.!?]/.test(text[j - 1]))) continue;
    pushMatch(findings, text, m.index, m[1], "transition-opener", "low",
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

// Labeled announcement: a sentence that names the point it is about to make
// ("One housekeeping item: ...", "One caveat, since ...: ...", "A quick note — ...")
// and then makes it. The label, not the colon, is the tell, so the period and dash
// forms count too. The payload must follow on the same line: a label ending its
// line ("Two options:" before a list) introduces structure, not prose. A comma
// clause belongs to the label only before a colon or a dash: before a period it
// is an ordinary sentence ("A reminder, sent the day before, cut no-shows.").
const LABELED_ANNOUNCEMENT_RE = new RegExp(
  "(^[ \\t]*|[.!?][ \\t]+|\\n[ \\t]*)(" +
    "(?:One|A|Another|Just one|Quick|Last)\\s+(?:(?:quick|small|last|final|more|other|brief|minor)\\s+)?" +
    "(?:caveat|housekeeping item|note|thing|point|aside|heads[- ]up|piece of business|word of warning|" +
    "clarification|flag|ask|request|correction|reminder|item)" +
    "(?:\\s+(?:worth|to)\\s+(?:flagging|noting|mentioning|flag|note|mention))?" +
    "(?:(?:,[^.!?:\\n—–]{1,120})?(?=:|[ \\t]+[—–-]{1,2}[ \\t])|(?=\\.))" +
  ")(?::|[ \\t]+[—–-]{1,2}|\\.)[ \\t]+(?=\\S)",
  "g"
);

function scanLabeledAnnouncements(text, findings) {
  for (const m of text.matchAll(LABELED_ANNOUNCEMENT_RE)) {
    pushMatch(findings, text, m.index + m[0].indexOf(m[2]), m[2], "structure:labeled-announcement",
      "med", "self-narration — delete the label and just say the thing");
  }
}

// ─── Structural warnings ─────────────────────────────────────────────────────

function pushWarning(warnings, text, indexes, category, match, fix) {
  const lines = indexes.map((i) => lineColAt(text, i).line);
  warnings.push({ category, match, line: lines[0], lines, fix });
}

const NEGATION = /\b(?:not|no|never|nothing|none|nobody|cannot)\b|n['’]t\b/i;
const CONTRAST_OPENER = /^(?:but|yet|however|instead|otherwise|to (?:a|the|us|me|them|you))\b/i;

function warnContractions(text, warnings) {
  // 's is counted only after pronouns, so possessives ("Dana's") stay out.
  const contracted = text.match(
    /\b[A-Za-z]+n['’]t\b|\b[A-Za-z]+['’](?:re|ve|ll|m|d)\b|\b(?:it|that|there|here|what|who|he|she|let)['’]s\b/gi
  ) || [];
  const spelled = [...text.matchAll(
    /\b(?:(?:do|does|did|is|are|was|were|has|have|had|could|would|should|will)\s+not|cannot|(?:it|that|there|here|what|who|he|she)\s+is|I\s+am|(?:you|we|they)\s+are|let\s+us)\b/gi
  )];
  const spots = contracted.length + spelled.length;
  const ratio = spots ? contracted.length / spots : 1;
  if (spots >= CONTRACTION_MIN_SPOTS && ratio < CONTRACTION_MAX_RATIO) {
    pushWarning(warnings, text, [spelled[0].index], "structure:contraction-density",
      `${contracted.length} contractions vs ${spelled.length} spelled-out forms (ratio ${ratio.toFixed(2)})`,
      "near-zero contractions reads as machine-formal — contract where you'd say it that way (fine to keep in formal text)");
  }
}

function warnRatherThan(text, warnings) {
  const hits = [...text.matchAll(/\b(?:rather\s+than|instead\s+of)\b/gi)];
  const words = text.split(/\s+/).filter(Boolean).length;
  if (hits.length >= RATHER_MIN && hits.length * RATHER_WORDS_PER_USE > words) {
    pushWarning(warnings, text, hits.map((m) => m.index), "structure:rather-than",
      `${hits.length}× "rather than" / "instead of" in ${words} words`,
      "the X-rather-than-Y contrast is a habit here — state the choice and drop most of the foils");
  }
}

// Content words (5+ letters) a clause and its reversal share: "count as usable;
// does not count" is one claim flipped, "keep it small; nothing risky" is not.
const SHARED_SKIP = new Set(["there", "their", "which", "these", "those", "would", "could", "should", "about", "still", "being", "other", "doesn"]);
const contentWords = (s) => new Set((s.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => !SHARED_SKIP.has(w)));

function warnSemicolonPairs(text, warnings) {
  const hits = [];
  for (const m of text.matchAll(/;\s+/g)) {
    const lineStart = text.lastIndexOf("\n", m.index) + 1;
    if (/^\s*(?:\||#)/.test(text.slice(lineStart, m.index))) continue;
    const before = text.slice(Math.max(0, m.index - 300), m.index).replace(/\*/g, "")
      .split(/\n\s*\n|\n\s*(?:[-+]|\d+[.)])\s/).pop().split(/[.!?:]\s|;\s|\s—\s/).pop();
    const after = text.slice(m.index + m[0].length, m.index + 300).replace(/\*/g, "")
      .split(/\n\s*\n/)[0].split(/[.!?](?:\s|$)|;/)[0];
    const afterWords = contentWords(after);
    const flipped = NEGATION.test(before) !== NEGATION.test(after)
      && [...contentWords(before)].some((w) => afterWords.has(w));
    if (flipped || CONTRAST_OPENER.test(after)) hits.push(m.index);
  }
  if (hits.length >= SEMICOLON_PAIR_MIN) {
    pushWarning(warnings, text, hits, "structure:semicolon-corrective",
      `${hits.length} semicolon-joined claim/reversal pairs`,
      "'X; not Y' / 'X; to a user, Y' repeated is a template — keep the one that earns it, split or cut the rest");
  }
}

// The last sentence of every heading-led section whose final block is a prose
// paragraph. Sections ending on a table, list, or quote are left out.
function sectionEndings(text) {
  const endings = [];
  let inSection = false;
  let para = null;
  const close = () => {
    if (inSection && para) endings.push(para);
    para = null;
  };
  text.split("\n").forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) {
      close();
      inSection = true;
    } else if (!line.trim()) {
      if (para) para.done = true;
    } else if (/^\s*(?:[-*+]\s|\d+[.)]\s|\||>|---|!\[)/.test(line)) {
      para = null;
    } else if (para && !para.done) {
      para.text += " " + line.trim();
      para.line = i + 1;
    } else {
      para = { text: line.trim(), line: i + 1 };
    }
  });
  close();
  return endings.map(({ text: p, line }) => ({
    line,
    sentence: p.replace(/[*_]/g, "").split(/(?<=[.!?]["')]?)\s+(?=["'(]?[A-Z0-9])/).pop(),
  }));
}

function warnSectionEndings(text, warnings) {
  const endings = sectionEndings(text);
  if (endings.length < SECTION_MIN) return;
  const shapes = new Map();
  const add = (shape, e) => shapes.set(shape, [...(shapes.get(shape) ?? []), e]);
  for (const e of endings) {
    const opener = e.sentence.split(/\s+/)[0].toLowerCase().replace(/’/g, "'").replace(/[^a-z']/g, "");
    if (opener && !["the", "a", "an"].includes(opener)) add(`open with "${opener}"`, e);
    const tail = e.sentence.match(/^(.*),\s+(?:and|so)\s+([^,]*)$/);
    if (tail && tail[1].split(/\s+/).length >= 5 && tail[2].split(/\s+/).length >= 3) {
      add('end on a trailing ", and …" / ", so …" clause', e);
    }
  }
  for (const [shape, hits] of shapes) {
    if (hits.length >= SECTION_SHAPE_MIN && hits.length >= endings.length * SECTION_SHAPE_SHARE) {
      warnings.push({
        category: "structure:section-ending-shape",
        match: `${hits.length} of ${endings.length} section endings ${shape}`,
        line: hits[0].line,
        lines: hits.map((h) => h.line),
        fix: "sections closing on one move reads as a template — end each where its point ends, most on the plain last fact",
      });
    }
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

// analyze — the single entrypoint. Returns { findings, summary, warnings };
// warnings never count toward summary or the exit code. `tier` 1 turns on the
// em dash ban; any other value leaves em dashes to the density rule.
export function analyze(text, { tier } = {}) {
  const scanned = maskCode(text);
  const findings = [];
  scanWords(scanned, findings);
  scanYellow(scanned, findings);
  scanPhrases(scanned, PHRASE_TELLS, "phrase", "med", findings);
  scanPhrases(scanned, ARTIFACT_TELLS, "artifact", "high", findings);
  scanStructure(scanned, findings);
  scanFormatting(scanned, findings, tier);
  scanConjunctionOpeners(scanned, findings);
  scanColonClauses(scanned, findings);
  scanLabeledAnnouncements(scanned, findings);

  findings.sort((a, b) => a.index - b.index);
  // A phrase inside a longer phrase ("reach out" in "I wanted to reach out") is one tell.
  let outer = null;
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    if (f.category !== "phrase" && f.category !== "artifact") continue;
    if (outer && f.index + f.match.length <= outer.index + outer.match.length) findings.splice(i--, 1);
    else outer = f;
  }

  const summary = { high: 0, med: 0, low: 0, total: findings.length };
  for (const f of findings) summary[f.severity]++;

  const warnings = [];
  warnContractions(scanned, warnings);
  warnRatherThan(scanned, warnings);
  warnSemicolonPairs(scanned, warnings);
  warnSectionEndings(scanned, warnings);
  return { findings, summary, warnings };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const HELP = `ai-lint — detect mechanical "AI writing" tells in text

Usage:
  ai-lint [options] [file]
  cat draft.md | ai-lint [options]

Reads from a file argument or stdin and reports lexical/structural AI tells.

Options:
  --tier <1|2>  The draft's human-voice tier. 1 reports every em dash as a
                finding; 2, or no flag, judges dashes by density
  --json        Emit findings as JSON
  --quiet       Print only the summary line (plus the structure-audit
                reminder when there are no findings)
  --exit-zero   Always exit 0 (default: exit 1 when any finding is reported)
  -h, --help    Show this help

Exit codes:
  0   no findings (or --exit-zero)
  1   one or more findings reported
  2   usage error

Structural warnings (contraction density, "rather than" frequency, semicolon
corrective pairs, repeated section-ending shape) print after the findings and
never change the exit code.

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

const AUDIT_REMINDER =
  "Structure audit still required: Step 3 tells (human-voice references/scrub.md), reshuffle test, read-aloud test, self-critique (references/structure-audit.md).";

function formatText(findings, summary) {
  if (findings.length === 0) return `ai-lint: no mechanical tells found. ${AUDIT_REMINDER}`;
  const lines = findings.map((f) => {
    const fix = f.fix ? `  → ${f.fix}` : "";
    return `  ${f.line}:${f.col}  [${f.severity}] ${f.category}: "${f.match}"${fix}`;
  });
  lines.push(
    `\nai-lint: ${summary.total} finding(s) — ${summary.high} high, ${summary.med} med, ${summary.low} low`
  );
  return lines.join("\n");
}

function formatWarnings(warnings) {
  if (warnings.length === 0) return "";
  const lines = warnings.map((w) =>
    `  ${w.line}  [warn] ${w.category}: ${w.match} (lines ${w.lines.join(", ")})  → ${w.fix}`);
  return `\n\nwarnings (never change the exit code):\n${lines.join("\n")}`;
}

async function main(argv) {
  const args = argv.slice(2);
  const opts = { json: false, quiet: false, exitZero: false, file: null, tier: undefined };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") {
      process.stdout.write(HELP + "\n");
      return 0;
    } else if (a === "--tier") {
      const v = args[++i];
      if (v !== "1" && v !== "2") {
        process.stderr.write("ai-lint: --tier takes 1 or 2\n");
        return 2;
      }
      opts.tier = Number(v);
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

  const { findings, summary, warnings } = analyze(text, { tier: opts.tier });

  if (opts.json) {
    process.stdout.write(JSON.stringify({ findings, summary, warnings }, null, 2) + "\n");
  } else if (opts.quiet) {
    const warned = warnings.length ? `, ${warnings.length} warning(s)` : "";
    process.stdout.write(
      `ai-lint: ${summary.total} finding(s) — ${summary.high} high, ${summary.med} med, ${summary.low} low${warned}\n` +
        (summary.total === 0 ? `${AUDIT_REMINDER}\n` : "")
    );
  } else {
    process.stdout.write(formatText(findings, summary) + formatWarnings(warnings) + "\n");
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
