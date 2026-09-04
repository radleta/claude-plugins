# Signs of AI Writing — Catalog

Detection cues paired with fixes, distilled from
[Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
and filtered to the tells that actually change how text reads (the Wikipedia-specific
forensics — fake citations, notability padding, editor-conduct phrasing — are out of
scope here).

**Read this the right way:** no single tell proves AI authorship, and a human may use
any of these. What's diagnostic is **density** — clusters of these in one passage. Scrub
the clusters first.

Tells drift as models are retuned — "delve" is already fading from newer models. Last
audited: 2026-07. Re-audit this catalog against current-model output when models change.

The `ai-lint` tool catches the items marked 🔧 automatically — but it's optional. If it
isn't available (e.g. in Claude Cowork), scan for the 🔧 items yourself against this
catalog; they're all plain lexical/structural patterns you can spot by reading. The
unmarked items always need your judgment, tool or no tool.

## Contents

1. [Filler vocabulary](#1-filler-vocabulary) 🔧
2. [Puffery and promotional tone](#2-puffery-and-promotional-tone)
3. [Editorializing and vague attribution](#3-editorializing-and-vague-attribution) 🔧 partial
4. [Sentence-structure tells](#4-sentence-structure-tells) 🔧 partial
5. [Transitions and conjunctions](#5-transitions-and-conjunctions) 🔧
6. [Paragraph and section structure](#6-paragraph-and-section-structure)
7. [Formatting tells](#7-formatting-tells) 🔧
8. [Chatbot and assistant artifacts](#8-chatbot-and-assistant-artifacts) 🔧

---

## 1. Filler vocabulary

Words that show up far more in AI text than human text. They're not banned — they're
*overused as filler*. Keep one if it's the precise word; cut it if it's reflexive.

| Cue (overused) | Fix |
|----------------|-----|
| delve / delve into | "look at", "dig into", or cut |
| leverage | "use" |
| underscore(s), highlight(s) (meaning "show") | "show", "stress" |
| tapestry, mosaic | drop the metaphor; name the thing |
| testament (a testament to) | "shows", "proves" |
| realm, landscape, sphere, arena | "area", "field", or cut |
| robust, seamless, scalable (as reflex praise) | say what's actually true |
| crucial, pivotal, vital, key (as intensifiers) | "important", or cut |
| vibrant, rich, profound (asserting a feeling) | show the detail instead |
| meticulous(ly), intricate, intricacies | show the care; don't label it |
| boasts, features, offers (meaning "has") | "has" |
| nestled, in the heart of | "in", "near" |
| showcase(s), garner, foster(ing), bolster(ed) | "show", "get", "build", "back" |
| myriad, plethora, diverse array | "many", or give a number |
| elevate, enhance, enduring, groundbreaking, renowned | plain verb; cut hype |
| utilize, embark, commence, synergy, holistic, actionable, impactful, learnings | use, start, start, benefit, whole, usable, the impact, lessons |
| deep dive | "close look", or just cover it |
| game-changer / unlock (the full, the power, your potential, new) | say what changed / name the concrete benefit |

**Prefer the plain (Anglo-Saxon) word over the Latinate one** — AI leans formal/Latinate:
utilize→use, commence→start, subsequently→then, prior to→before, sufficient→enough,
approximately→about, numerous→many, in order to→to, due to the fact that→because, has the
ability to→can. 🔧 (most caught)

**Yellow words — one use is fine, repetition is the tell:** comprehensive, significant,
essential, fundamental, dynamic, innovative. Keep at most one per piece. 🔧 (flagged on the
2nd occurrence)

## 2. Puffery and promotional tone

The "travel brochure" and "press release" registers. The text *sells* instead of stating.

| Cue | Fix |
|-----|-----|
| "Nestled within the breathtaking region of…" | Name the location plainly |
| "offers visitors a fascinating glimpse into…" | State what's there |
| "showcasing its dedication to craftsmanship" | Show the act; drop the label |
| "stands as a shining example of…" | Say what it is |
| "rich cultural heritage", "rich history" | Name the specific events/people |
| "commitment to excellence / sustainability / quality" | Show the action, not the slogan |
| "seamlessly connecting…", "dependable, value-driven…" | Describe what it does concretely |
| "In an era where… / In a world where…" | Cut the throat-clearing; start at the point |

Rule of thumb: if a sentence would fit unchanged in an advertisement, it's puffery.

## 3. Editorializing and vague attribution

AI narrates significance instead of reporting facts, and attributes claims to no one.

**Significance narration** (🔧 some phrases caught):

| Cue | Fix |
|-----|-----|
| "highlighting / underscoring / reflecting / symbolizing…" tacked onto a clause | Delete the editorial tail; let the fact stand |
| "ensuring…", "contributing to…", "setting the stage for…" | Cut; these add no information |
| "This represents a broader shift toward…" | Only keep if you can name the shift specifically |
| "It's important to note that…", "It's worth noting…" | Just state the thing |

**Vague attribution** (needs judgment):

| Cue | Fix |
|-----|-----|
| "Experts argue…", "Observers have noted…", "Critics say…" | Name the person/source, or cut the claim |
| "Industry reports suggest…" | Cite the actual report or drop it |
| "Studies have shown…" (no study named) | Name it or remove |

## 4. Sentence-structure tells

The most recognizable AI fingerprints. Several are 🔧 caught by `ai-lint`.

**Negative parallelism** 🔧 — the signature tell:

| Cue | Fix |
|-----|-----|
| "not only X but also Y" | Make one direct positive claim |
| "it's not just X, it's Y" | State what it *is* |
| "not a mirror but a portal", "not X, but rather Y" | Lead with the positive; drop the setup |
| "X rather than Y" (as faux-insight) | Say the point directly |
| "isn't just X. It's Y." / "doesn't just X — it's Y" | State what it is (🔧 now caught) |

**Rule of three** (needs judgment) — three parallel items, compulsively:

| Cue | Fix |
|-----|-----|
| "fast, reliable, and scalable" | Keep the one that matters; show it |
| "adjective, adjective, adjective" rhythm repeated across paragraphs | Vary the structure; one strong detail beats three weak ones |

**"From X to Y" sweep** 🔧:

| Cue | Fix |
|-----|-----|
| "From its scenic landscapes to its historical landmarks…" | Name the specific items, or cut the frame |

**Avoiding plain "is/has"** 🔧 (word-level):

| Cue | Fix |
|-----|-----|
| "serves as", "stands as", "marks", "represents" (meaning "is") | "is" |
| "boasts / features / maintains / offers" (meaning "has") | "has" |

**Synonym cycling / elegant variation** (needs judgment):

| Cue | Fix |
|-----|-----|
| Same thing renamed across sentences to avoid repeating a word: "the tool… the platform… the solution… the system" | Pick one name and keep it; the variation reads as evasive |

**Fronted participials** (research-backed; AI uses these 2–5× as often as people):

| Cue | Fix |
|-----|-----|
| "Examining the data, we find…", "Leveraging X, the team…", "Having established X, …" stacked through the text | Recast as plain subject-verb sentences |

**Aphorism formulas** (manufactured profundity):

| Cue | Fix |
|-----|-----|
| "X is the Y of Z", "not a tool but a mirror", "the currency/architecture/language of…" | Delete, or make a concrete claim |

**Colon-fronted clauses** 🔧 (density, not any single instance) — a colon inside body
prose introducing the explanation, distinct from the "X: Why Y Matters" *heading*
formula in §7:

| Cue | Fix |
|-----|-----|
| "The useful bit for us: part-time consultants bill the same median." | Make it two sentences, or one with a comma |
| "On us being related: bring it up yourself." | Recast — "On us being related, bring it up yourself" |
| Several paragraphs in one document all fronting a clause this way | One is fine; a repeat is a template — vary the punctuation |

**Staccato drama** (the inverse of even rhythm):

| Cue | Fix |
|-----|-----|
| A run of clipped fragments to fake intensity: "No preference. No aesthetic. No nostalgia." | Keep one; rejoin the rest — a single short sentence is fine, a cluster is the tell |

## 5. Transitions and conjunctions

🔧 Caught at sentence openers.

| Cue | Fix |
|-----|-----|
| Sentences opening with "Moreover," "Furthermore," "Additionally," | Cut, or fold into the previous sentence |
| "However," / "Notably," / "Importantly," as reflex openers | Use sparingly; humans rarely stack these |

Humans connect ideas with the *content*, not with a transition word bolted to the front.

### Rhetorical scaffolding (announcing instead of delivering) 🔧

Phrases that perform candor or insight instead of just stating the thing. Mostly caught
by `ai-lint`.

| Cluster | Examples | Fix |
|---------|----------|-----|
| Signposting | "Let's dive in", "let's break this down", "here's what you need to know", "without further ado" | Just start / just explain |
| Authority tropes | "The real question is", "at its core", "what really matters", "the heart of the matter" | Cut the frame; say the thing |
| Reader-steering | "What you need to know is", "the key insight here is", "you might be wondering" | State it directly |
| Infomercial hooks | "The catch?", "The kicker?", "Sound familiar?" (as standalone teasers) | Cut the teaser; state it |
| Faux-candor openers | "Here's the thing", "Let's be honest", "Real talk", "Honestly?" (as standalone hooks) | Just be direct |
| Treadmill restatement | "In other words", "Put simply", "To put it another way", "Essentially," then the same point | Say it once, well |
| Rhetorical-question transitions | "So what does this mean?", "Why does this matter?" | Cut; state the point |

## 6. Paragraph and section structure

Larger patterns — judgment-level, not regex-catchable.

| Cue | Fix |
|-----|-----|
| **"Challenges and Future Prospects" formula:** "Despite its X, [subject] faces challenges… continues to…" | Cut the template; only keep concrete, sourced points |
| **Outline-shaped conclusions:** a final paragraph that restates everything and ends on vague optimism ("The future of X lies in its ability to adapt") | Delete it; strong writing doesn't need a recap |
| **Restatement:** intro says it, body says it, conclusion says it again | Say it once |
| **Forced "broader significance" endings** on every section | Remove; let facts stand |
| **Even, templated section sizing** — every section the same shape and length | Let importance set the length |
| **Reshuffle test:** body paragraphs can be swapped without breaking the logic | Give it a spine — each paragraph should depend on the one before it |
| **Diff-anchored writing:** narrating the change — "The update allows users to X" | Describe what *is*: "Users can X" |
| **Fragmented header:** a heading, then a one-line paragraph that restates the heading before real content | Cut the restatement; start the content |

The **reshuffle test** is the single most useful structural check: human prose has a
dependency chain; AI produces a bag of co-equal points.

## 7. Formatting tells

🔧 Mostly caught by `ai-lint`. Especially damaging in attributed prose (Tier 1), where
heavy markdown screams "generated."

| Cue | Fix |
|-----|-----|
| Mechanical **bolding** of every key term | Bold only genuine emphasis |
| Inline-header bullets: "• **Thing:** description" used as the default structure | Use prose for prose; reserve lists for genuine enumerations |
| Excessive **em-dashes** connecting clauses | Swap some for commas, periods, parentheses |
| **Curly quotes / apostrophes** (' ' " ") from generation | Straight quotes, unless the channel needs typographic ones |
| **Emoji** in professional or attributed prose | Remove |
| **Title Case Headings** ("Impact Of Technology And Growth") | Sentence case, unless house style is Title Case |
| Lists where flowing prose is expected (e.g. an email body) | Write it as sentences |
| Colon headline formula: "X: Why Y Matters" | Say the point as the title (🔧 caught) |

## 8. Chatbot and assistant artifacts

🔧 High-severity. These are near-certain tells — an assistant's voice leaking into text
that's supposed to be the user's. Never ship these in attributed text.

| Cue | Fix |
|-----|-----|
| "Certainly!", "Sure!", "Great question!" openers | Delete |
| "I hope this helps", "Let me know if you have any questions" sign-offs | Delete, or make specific to the actual ask |
| "Feel free to…" | Delete the filler |
| "As an AI…", "As a large language model…" | Delete entirely; never disclose the model |
| "As of my last update…", knowledge-cutoff disclaimers | Delete |
| "Here's a draft of…", "Below is…" framing preambles | Cut; just give the content |
| Placeholder text: "[insert name here]", "This section would discuss…" | Fill it in or remove |
| Sycophancy: "You're absolutely right", "Of course!" | Delete |
| Servile offers: "Would you like me to…", "Happy to help" | Delete, or make a specific ask |
| "Thrilled to announce…", "Excited to share…", "Delighted to…" | Manufactured warmth — match the real register (🔧 caught) |
