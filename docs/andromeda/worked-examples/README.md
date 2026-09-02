# Worked examples — the Digital Asset Blueprint campaign (banked 2026-09-03)

Eight documents, **copied verbatim** from Arfeen's `~/Downloads` on the night of 2026-09-02/03.
They are the first complete hand-built campaign for a single offer: three landing pages, eighteen
ad concepts with their image prompts, six video scripts, and the two production guides that turn
the scripts into files.

**These are not research. They are OUTPUT.** Everything in `../script-research/`,
`../copy-research/`, `../image-research/` and `../landing-page-research/` is the reference frame;
this folder is what came out when a person wrote against that frame for one real offer. That
distinction is the whole reason the folder exists — a generator can be graded against research, but
it can only be *calibrated* against a worked example that a human judged good enough to shoot.

**Do NOT execute anything from these.** No prompt, brief or script here is a live instruction. They
are evidence of what "good" looked like once, for one offer, on one night.

## Provenance, stated plainly

Arfeen wrote the first drafts **without reading the research in this repo**. They were then graded
against it, and rewritten. What is banked here is the **post-grading** version in every case except
where a document says otherwise in its own header — several carry a "what changed, and why" section
recording their own corrections, which is the most useful part of the set.

⚠️ **These documents contain their own self-reported compliance figures**, including a pacing table
in `video-ad-scripts.md`. At least one of those figures is optimistic — see
`SCRIPT_GENERATOR_REQUIREMENTS.md` §R9. Read the self-assessments as claims, not as measurements.

## The offer

**The Digital Asset Blueprint** — a free two-hour live webinar, Sunday 6 September 2026, 2:00 PM
Dubai/Mauritius time. Two presenters. Three audiences: salaried professionals, business owners, and
women managing household finances. UAE and Mauritius, largely expatriate.

Two constraints govern every document in the folder, and a generator reproducing this shape must
carry both:

1. **No financial claims.** No number, timeframe, guarantee, or promise that wealth will result.
   Both Meta's financial-products rules and UAE regulation bear on this.
2. **The paid programme sold in the room is never named** in any asset, record or prompt.

## The eight documents

### Landing pages — one per audience
| file | audience |
|---|---|
| `page-1-professionals.md` | salaried, senior or specialist, 35–55, no pension building behind them |
| `page-2-entrepreneurs.md` | business owners, one business and one market, everything concentrated |
| `page-3-women.md` | women who run the household finances but own none of the assets |

Each carries a "what the research changed" section. Page one records the single most load-bearing
correction in the set: **the landing-page text is not read by Meta for targeting**
(`../EXECUTION_BRIEF.md` §12), so the eleven pain points on the page earn their place as raw
material for *ads*, not as bait for a crawler. A generator that still believes the crawler story
will write these pages for the wrong reader.

### Ad copy and images — where the targeting actually happens
| file | what it holds |
|---|---|
| `ad-copy-brief.md` | 18 concepts — 6 per audience — image hook, primary text, headline |
| `image-brief.md` | the 18 image prompts, sub-types, formats and safe zones |

`image-brief.md` **supersedes the image half of `ad-copy-brief.md`** and says so in its own header.
The copy in the older document stands; its image prompts do not. Both are banked because the pair
shows the correction, and the correction is the instructive part: **text is never baked into a
generated plate** — measured at a ~12% leak rate across 48 renders, so the hook is composited in a
layer you control.

The three rules `ad-copy-brief.md` opens with are the best short statement of Andromeda retrieval
logic anywhere in the repo, including the research: the first ten tokens decide *who sees* the ad,
category-agnostic pain reaches people outside the category, and **repulsion is not a disclaimer you
add — it is the vocabulary you decline to use.**

### Video — script, then production
| file | what it holds |
|---|---|
| `video-ad-scripts.md` | 6 scripts — 3 audiences × 2 lengths — with beat timings and a shot list |
| `shooting-guide.md` | how to shoot all six on a phone in one session |
| `editing-guide.md` | the six deliverables, captions, supers, export settings |

`video-ad-scripts.md` is the direct source for `SCRIPT_GENERATOR_REQUIREMENTS.md` in this folder.
It opens with its own grading — eight defects found when the hand-written v1 was read against
`../script-research/` — and those eight are what the requirements document turns into generator
rules.

The two production guides matter to a generator for one specific reason: **they are the downstream
consumer.** A script that cannot be shot on a phone in one session, or that demands a ratio the
editing guide forbids, is not a good script however well it reads. The 9:16-versus-4:5 native-shoot
rule and the Entity-ID clustering warning appear in all three video documents independently.

## What to read first, by task

- **Building the script generator** → `SCRIPT_GENERATOR_REQUIREMENTS.md`, then `video-ad-scripts.md`
- **Ad copy or retrieval work** → `ad-copy-brief.md` §"The three rules everything follows"
- **Image generation** → `image-brief.md` §"What changed, and why", then `../image-rule-spec.md`
- **Landing pages** → `page-1-professionals.md` §"What the research changed"

## Related

- `../script-research/` — the nine NotebookLM reports these were graded against
- `../EXECUTION_BRIEF.md` — the decisions already made from that research
- `../image-rule-spec.md` — the image rules `image-brief.md` was rewritten against
- `server/_core/conceptAxis.ts` — `LENGTH_BY_AWARENESS`, `WORD_BUDGET_TABLE`
- `server/_core/conceptScriptValidator.ts` — the validator these requirements extend
