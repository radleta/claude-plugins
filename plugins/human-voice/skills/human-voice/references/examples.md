# Human Voice — Before / After Examples

Concrete rewrites at each tier. Notice that the *amount* of rewriting tracks the tier:
Tier 1 gets fully re-voiced, Tier 3 is mostly left alone.

## Tier 1 — Email sent on the user's behalf (scrub hard)

**Before (AI draft):**

> Dear Bill,
>
> I hope this email finds you well. I wanted to reach out regarding the upcoming campaign
> report. It's important to note that our analytics dashboard now offers a comprehensive,
> robust, and seamless view of engagement metrics — not only open rates but also
> click-through performance. This represents a significant step forward in our commitment
> to delivering valuable insights.
>
> Please feel free to let me know if you have any questions. I hope this helps!
>
> Best regards,
> Richard

**Why it fails:** assistant sign-offs ("I hope this finds you well", "feel free to",
"I hope this helps"), filler words (robust, seamless, valuable insights), negative
parallelism ("not only…but also"), puffery ("commitment to delivering"), em-dash padding.
A real recipient instantly senses a machine — and the warmth reads as fake.

**After:**

> Bill,
>
> Quick update on the campaign report. The dashboard now shows click-through rates
> alongside opens, so you can see which subject lines actually drove traffic, not just
> who opened.
>
> Want me to walk you through it on a call, or is the export enough?
>
> Richard

(Honors the user's stated style: no "Dear", no "I hope this finds you well", no closing
phrase before the signature, signs off as "Richard".)

## Tier 1 — Blog post intro (still scrub hard — it persuades)

This is the case people get wrong. A blog post is a "product," but it's *persuasion*, so
detected AI-ness kills it. It belongs in Tier 1, not Tier 2.

**Before:**

> In today's fast-paced digital landscape, businesses are constantly navigating an
> ever-evolving array of challenges. Leveraging cutting-edge AI tools has become not just
> an advantage, but a necessity. This post delves into the myriad ways organizations can
> harness these robust solutions to unlock their full potential.

**After:**

> Last quarter we cut our support backlog in half with one change: we let an AI triage
> tickets before a human ever saw them. Here's exactly how we set it up, what broke, and
> what I'd do differently.

(Replaced throat-clearing and filler with a specific claim, a number, and a promise of
concrete payoff. That's what earns the next paragraph.)

## Tier 2 — How-to guide (light scrub)

Voice matters less; clarity matters most. Remove the worst tells, keep the structure.

**Before:**

> To configure the webhook, it's important to note that you'll first need to navigate to
> the settings panel. Additionally, you should ensure that your API key is properly
> configured before proceeding.

**After:**

> To configure the webhook, open the settings panel. Make sure your API key is set first —
> the webhook test will fail without it.

(Cut "it's important to note" and "Additionally"; turned vague "ensure properly
configured" into the concrete reason it matters. Didn't agonize over voice.)

## Tier 3 — API reference (leave it)

Affect-free, scannable, consistent. The "AI" patterns here are *fine* — parallel
structure and predictable phrasing are exactly what a reference reader wants. Don't
scrub this.

> ### `POST /api/campaigns`
>
> Creates a new campaign. Returns `201` with the created resource, or `422` if validation
> fails.
>
> | Field | Type | Required | Description |
> |-------|------|----------|-------------|
> | `name` | string | yes | Display name, max 120 chars |
> | `send_at` | ISO 8601 | no | Schedule time; omit to save as draft |

No changes needed. Running a humanizing pass on this would waste effort and could break
the consistency that makes reference docs usable.
