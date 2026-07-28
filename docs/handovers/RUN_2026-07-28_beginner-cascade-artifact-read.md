# Artifact read — beginner cascade, prod, 2026-07-28

The read that had been starved three times. Run on `HEAD = origin/railway-build = 9ff6724`.

**Shape:** beginner — newly-certified paediatric sleep consultant, **zero paying clients, zero
testimonials, no programme built**, campaignType `lead_magnet`. Service 282 · ICP 259 · kit 197 ·
LP 230.

**The cascade completed in ~8 minutes**, every node produced, job `complete` (not `failed`).

```
offers 1 · mechanisms 15 · leadMagnetTitles 60 · headlines 10 · adCopy 9
landingPage 1 · email 1 · whatsapp 1 · bonuses 3 · concepts 8 · adCreatives 5
```

---

## 1. Step 9 did NOT fail — ad creatives generated for the first time

Every prior run died at step 9. This one produced **5 ad creatives** and a populated
`selectedAdCreativeBatchId`; `job.result` carried **no `failedSteps`** at all.

**F1(a) is input-dependent, not deterministic.** The gate rejects the whole ad-headline batch if
any headline exceeds the length bar; this run's headlines happened to fit. It will still kill runs
whose headlines run long — the all-or-nothing disposition is unchanged.

**Consequence:** the Replicate → Cloudinary image path is **no longer unverified** — it executed and
produced creatives. That closes a standing caveat and unblocks the parked image-model evaluation,
which was gated on "the ad-creative path generates again".

### 1a. The creatives, seen for the first time — mechanically fine, not usable

Saved: `docs/screenshots/run-2026-07-28/ad-creative-v1..v5.png` (1080×1080).

**Why step 9 passed is now unambiguous** — every headline landed under the bar, one exactly on it:

| v | style | headline | chars |
|---|---|---|---|
| 1 | person_shocked | Baby sleeps through in 3 weeks. | 31 |
| 2 | screenshot | From 2-hour bedtimes to 7pm done. | 33 |
| 3 | person_intense | It's not the habit. It's the sequence. | **38** |
| 4 | object | Rocking her down vs. she goes down. | 35 |
| 5 | person_curious | Stop feeding to sleep every night. | 34 |

**The images have systemic problems:**

1. **Gender mismatch with the ICP.** The ICP is unambiguously a mother — "my partner", maternity
   pay, mothers' group, antenatal group. **Both inspected creatives depict a man.**
2. **Headline text overlaps the subject's face** in both — laid across mouth, arm and chest.
3. **Garbled callout labels.** v4 renders a green speech bubble reading "Parenting books" and a
   circle reading **"Baby time parents"** — not a phrase. Half of it sits behind the headline,
   partly illegible.
4. **v1 reads as alarming, not aspirational** — a wild-eyed, open-mouthed man holding a **newborn**
   (the ICP's baby is 4–12 months). For an audience that explicitly distrusts anything that "sounds
   too easy" and values gentleness, this is badly off-brand.
5. **All five share one identical body line** — "I remember standing at the cot at 11pm…". The
   variations vary headline and image only, so the deck is less varied than the count suggests.
6. The body line **is** correctly first person — the register standard is working here.

**"Baby sleeps through in 3 weeks."** is a flat promised result in a timeframe — the
`PROMISED_RESULT_RE` category — and it passed the gate. Another instance of §3.

**This is the input the parked image-model evaluation needs.** It was blocked on "the ad-creative
path generates again"; it now does, and these are real ZAP prompts rather than generic test ones.

## 2. 🔴 The landing page published — and it is the headline artifact

**`https://zapcampaigns.com/p/sleep-reset-for-new-parents-230`** — HTTP 200, **zero `[INSERT_*]`
tokens**, published with **zero operator questions asked** (`getPublishReadiness` returned
`ready=true, remaining=0`). Screenshot: `docs/screenshots/LP-230-published-fullpage.png`.

**What is genuinely good:** strong specific hero headline; three benefit cards that are concrete and
in-domain; real PDF-derived magnet cover; email capture present twice; no fabricated testimonials —
the beginner suppression worked; **no empty headings and no orphaned sections** — the suppressions
close cleanly rather than leaving holes.

**What is visibly wrong on the live page:**

| # | Defect | Detail |
|---|---|---|
| 1 | **`yourbrand` placeholder shipping live** | Top-left logo renders the literal string `yourbrand`; the magnet card renders `YOUR BRAND'S`. `burchardProductivity.ts:123` — `coach.coachName \|\| "yourbrand"`. The coach has no name set, so the fallback ships. |
| 2 | **Fabricated social proof in template chrome** | Five filled stars + **"Trusted by high achievers"** on a page for a coach with **zero clients**. `burchardProductivity.ts:114-116`. The comment says *"Never fabricated"* — but the guard only drops the **number**, not the **claim**. Honesty was applied to magnitude, not to assertion. |
| 3 | **Text overflow / collision** | The magnet cover title overruns its container and is clipped by the orange FREE badge — `…SEQUENCE RESET: H` with `OW` cut off. |
| 4 | **Grammar break** | `Get Your Free **The** 3-Night Settling Sequence Reset… Now!` — the template prepends `Get Your Free {title}` to a title already starting with "The". |
| 5 | **Lead-magnet title too long for every slot** | 137 chars. Renders as a four-line orange run-on inside "Everything you need, in one simple ___." ending on a lonely full stop. This is the readability/register problem made visual. |
| 6 | **Generic filler** | "Use it every day and stay on track." — doesn't fit a three-night sequence. |

Page weight is **10,957 bytes** vs 29–32KB for prior published pages. The thinness is expected
(`lead_magnet_download`'s designed-empty fields) and does **not** produce visible holes — but the
page does end abruptly after a single CTA block.

## 3. 🔴🔴 The anti-fabrication validator does not fire on real copy

**The most serious finding.** The cascade produced invented proof for a coach who states she has no
clients:

- **Mechanism:** *"Developed after working with **over two hundred families** stuck in exactly this
  loop… **Most families** reach a consistent five-to-six-hour first stretch **by night fourteen**."*
- **Lead magnet:** *"By night three, **most babies** produce their first unbroken 5-hour stretch."*
- **Email 3:** a complete invented case study — *"By night four, the transfer was holding. By the end
  of week three, the five-to-six-hour stretch was consistent."*
- **WhatsApp 2:** another invented client story with a specific outcome.

**Two independent causes.**

**(a) Unguarded generators.** `checkOutput` is wired into concept, landing-page, LP-publisher,
concept-script, ad-copy and the Meta gate. It is **absent from `heroMechanismsGenerator.ts`**
(no `compliance`/`fabricat`/`screen` reference anywhere in the file), and from the offer, lead-magnet,
email, WhatsApp and bonus generators. The mechanism is **upstream of the whole cascade**, so its
invented claim propagates. Notably it did **not** reach the published landing page — the guarded
surfaces held; the unguarded ones leaked.

**(b) The detectors miss the phrasings that actually occur.** Verified against the live publish gate
and directly against `checkFabrication`, with `supplied` correctly all-null (beginner):

```
meta.publishToMeta gate on planted invented proof  -> ok=true, blocking=[], advisories=[]
```

Control strings from the suite block correctly; the real ones do not:

| Copy | Result | Why |
|---|---|---|
| `87% of consultants never post twice.` | **BLOCK** | control — detector works |
| `94% of my clients see a full night by week two.` | **PASS** | `STAT_SELF_DESCRIPTIVE` exempts `of my`. The false-positive fix for *"80% of my week"* also exempts the single highest-risk phrasing. |
| `Sarah got her baby sleeping 12 hours in 4 days.` | **PASS** | `TESTIMONIAL_RE` requires literal openers (`one of my clients`, `a client`…). A **bare first name** never matches. |
| `Guaranteed results or your money back.` | **PASS** | `GUARANTEE_RE` needs `money-back guarantee`; *"or your money back"* has no trailing `guarantee`. |
| `working with over two hundred families` | **PASS** | `AUTHORITY_RE` needs `I've helped…` + digits. No `I`, spelled-out number, and `families` is not in its noun list. |

**`server/fabricationValidator.test.ts` is 23/23 green.** The suite asserts the exact strings the
regexes were written against, so it measures the fixtures rather than the behaviour — the §15a
failure mode (*every gate passed against the lie*), in a different costume.

**This is not a "tighten the regex" task.** Pattern-matching invented proof by surface form will keep
losing to paraphrase. Whatever replaces it has to reason about *whether a claim is supported by the
coach's own words*, which is what the corpus was built for.

## 4. Other real defects

- **`ctaLink: "#"` on every email** — the CTA is a dead link in all three.
- **`[INSERT_HOST_NAME]` unresolved ×5** — every email signs off `— [INSERT_HOST_NAME]`.
- **WhatsApp is written for the wrong campaign type.** `[INSERT_EVENT_NAME]` twice — *"At
  [INSERT_EVENT_NAME] with [INSERT_HOST_NAME]"*, *"You've already said yes to [INSERT_EVENT_NAME]"* —
  but this is a **lead-magnet** campaign with no event. A structural coherence break, not a token gap.
- **Email 2 subject/preview do not match its body.** Subject *"the night I nearly quit"*, preview
  *"the kind where you sit in a car park…"* — the body contains no car park and no quitting moment.
  **The car park is the register standard's own worked example** from
  `META_AD_COMPLIANCE_REFERENCE.md` §3.1; it has leaked from the prompt into generated copy as if it
  were the coach's story. Worth checking wherever that example appears in prompts.
- **ICP internal inconsistency** — the baby is seven months old in `introduction`, "past six months"
  in `fears`, and "hit nine months" in `buyingTriggers`.
- **`campaignType` still NULL on the kit** — F2 diagnosis confirmed unchanged at HEAD.
- **Bonus PDF cover page is ~60% whitespace.**
- **`.pdf.pdf`** double-suffix still present in bonus and lead-magnet storage keys.

## 5. What is good, and worth protecting

- **The ICP is excellent** — vivid, first-person, specific, no invented demographics/influencers
  (Class-A removal holding), `groundingMeta` populated across 14 sections.
- **The lead magnet is genuinely useful** — a real three-night protocol with timings, fill-in fields,
  protest-vs-distress guidance and a wobble script.
- **The bonus PDFs render properly** — real `%PDF-1.4`, 212–662KB, cover page, "How to use this"
  card, tickable checkboxes, markdown headings (not `<pre>`). All three HTML versions serve 200.
- **The 8 concepts are correctly first-person** — *"I built a method because I needed one thing that
  did not change shape every time I looked at it."* The register standard is working where wired.

## 6. Where the artifacts live (all committed — nothing session-scoped)

| Artifact | Path |
|---|---|
| Published LP, full-page screenshot | `docs/screenshots/LP-230-published-fullpage.png` |
| 5 ad creatives | `docs/screenshots/run-2026-07-28/ad-creative-v1..v5.png` |
| 3 bonus PDFs | `docs/screenshots/run-2026-07-28/bonus-25..27.pdf` |
| Every node's full text — ICP, offer, mechanism, lead magnet, all 10 headlines, all 9 ad copy, LP content, **email sequence in full**, **WhatsApp sequence in full**, bonuses, concepts | `docs/handovers/RUN_2026-07-28_artifacts-full.txt` |

The 5 published pages were purged from Cloudflare KV and verified 404. Cloudinary assets (5 creative
PNGs, 3 bonus PDFs, 1 magnet PDF) remain as orphans — same `.pdf.pdf` cleanup class as the prior run.

## 7. Method notes

- The **poll watched downstream write timestamps, not `jobs.status`** — the zombie-job tell.
- **`campaignConcepts` went 0 → 8 after the artifact dump.** A real late writer, caught only by
  reconciling against the pre-run baseline. Never trust a single post-run count.
- **`landingPages.delete` does NOT purge Cloudflare KV.** Deleting the row leaves the page live.
  Purge via `deleteKvPage` explicitly.
- The smoke coach has **zero** `meta_access_tokens` / `metaConnections`, so the Meta gate can be
  exercised with no possibility of live spend.
