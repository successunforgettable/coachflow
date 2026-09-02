> # ⚪️ SUPERSEDED 2026-09-01 — DO NOT USE THIS FILE AS THE CURRENT PICTURE
>
> **The live index is [`docs/RESEARCH_INDEX.md`](../RESEARCH_INDEX.md), which is GENERATED from the
> filesystem and regenerated with `python3 tools/research-index.py`.**
>
> **Nothing below has been edited.** Correcting a past record in place falsifies it — this file
> stays exactly as written, as the record of what was believed on 2026-08-03.
>
> Known to be wrong below, per the 2026-09-01 sweep: it classifies landing-page research by
> production method rather than content (so 51,872 words of teardowns file as "worked examples");
> it lists **Offer** and **Unique Method** as needing research when both are recorded done
> elsewhere; and it does not distinguish **HELD** research (Email, WhatsApp — exists, Arfeen holds
> it, not banked) from missing research.

---

# Andromeda: what your research decided, what's built, and what's missing

**Written for Arfeen, 3 August 2026. Plain English. Nothing was built, changed, or deployed to write
this — it's a reading of your research documents and of the actual code.**

---

## Start here: the one-paragraph version

Andromeda is not a replacement for your 11-stop campaign path. It's the engine that's meant to sit
*inside* the ad stop and decide what the ads should say. You commissioned a large body of research to
tell it how — and that research is genuinely good and genuinely deep on **words**. The engine was
built to that research, and it works. What's missing is two things: nobody connected the engine's
output to the ads a coach actually sees, and **the picture half of an ad was never researched at
all** — the images were built by us, by trial and error, with no research document behind them.

So the honest state is: the words are researched and built but unplugged; the pictures are built but
unresearched. Those are two different kinds of missing, and only one of them is a wiring job.

---

## PART 1 — What your research decided

Your research covers four parts of an ad system. Three of them are richly covered. One isn't covered
at all.

### The angles — what different ads should say to different people

**Richly researched. This is the strongest part of the set.**

The core idea, from the **Andromeda Execution Brief**: don't make five versions of one ad. Make
**eight to twelve genuinely different ads**, each aimed at a different person-state. The reason is
mechanical, not aesthetic — Meta lumps near-identical ads together and treats them as one entry in
the auction. Genuinely different ads each earn their own entry, so you get more shots at the audience
for the same spend.

The way to make them genuinely different is a three-part framework: **who they are, what they want,
and how much they already know**. In your system the "who" stays fixed — it's the coach's ideal
customer — so the variety comes from the other two. That's the phrase in your brief: *one person,
many angles*.

The "how much they already know" part uses **five stages**, from someone who doesn't yet realise they
have a problem, through to someone ready to buy today. Your **seven Meta landing-page research
reports** confirmed something useful here: there's no rule saying you should only chase cold
audiences. Cover all five stages.

Then the report **"Meta Ads Creative Strategy 2026: Mapping Hook Patterns to Schwartz Awareness
Stages"** decided the actual matching — which *kind* of opening line belongs to which stage. Someone
who's just realised they have a problem gets an ad that leads with the problem. Someone who's already
comparing options gets proof. And so on. Two of those five matches were independently confirmed by
your ICP report **"The Psychology of the ICP"**, which arrived at the same answer from a completely
different direction. That's the strongest single piece of evidence in the whole set — two unrelated
research runs agreeing.

### The ad copy — the words in the ad itself

**Well researched, mostly on the safety side.**

Your **Meta Ad Compliance Reference** is the most-used document in the entire project. It was built
from roughly fifteen separate policy and language reports, and its most valuable feature is that it
separates *what Meta actually publishes* from *what people online claim Meta does*. It carries an
explicit **do-not-build list** — plausible-sounding rules that turned out to exist nowhere in Meta's
documentation.

The key decision it makes about copy is this: an ad may describe **a moment that happened**, told
from the coach's side. It may not describe **the person watching**. "The morning I went to pick my
toddler up and my back said no" is fine. "Are you exhausted?" is not — and that's a policy line, not
a taste one.

Fifteen further reports go deeper on the vocabulary itself — which everyday words trip Meta's filters
in health, money and mental-health contexts, and where the line sits between ordinary language and
clinical language.

### The video scripts — what a coach says to camera

**Richly researched. Nine reports, and the most specific research in the set.**

Nine documents decided how a coach's spoken ad should be built:

- **"Comprehensive Report on Video Ad Script Structure and Timing Metrics"** — a script has five
  beats: hook, problem, turn, solution, call to action.
- **"Analysis of High-Performance Video Ad Hooks for Cold Audiences"** — the opening runs under about
  ten words, and it's a bold statement rather than a question.
- **"Scripting the Messy Middle"** — one idea at a time through the middle, which is where attention
  is normally lost.
- **"Scripting for Success: Natural Video Ad Performance"** — tell the story before you give the
  number, not the other way round.
- **"Analysis of Conversational Calls-to-Action"** — the ask should feel like the natural next thing
  to say, not an interruption.
- **"Calibrating Spoken Tone for Video Ad Performance"** — tone shifts by how warm the audience is.
- **"Synthesizing Natural Speech Patterns for Talking-to-Camera Ad Scripts"** — how to make written
  lines sound spoken.
- **"Optimising Meta Video Ad Lengths for the 2026 AI Ecosystem"** — how long a script should run,
  and a practical constraint: Meta now takes one video and distributes it everywhere itself, so a
  single short version travels better than a long one.

Interestingly, the research also decided where it *doesn't* have an answer — it found no strong
signal on how long the "turn" beat should be, so that was deliberately left open rather than guessed.

### The picture — what the ad actually looks like

**Not researched. There is no document.**

I searched the repository and your Downloads folder. Across all 47 research documents there is **no
report on ad imagery**. Nothing on what a given angle should look like, nothing on what image suits a
problem-aware ad versus a ready-to-buy one, nothing on which visual styles perform.

What exists instead is a quality standard and a reference library of example images — but those were
written by us, from our own judgement. They're a bar we hold ourselves to. They are not a research
finding about what works.

This matters because **your research is explicit that the creative is the words and the picture
together** — that's the "creative is the new targeting" conclusion, and it's settled. The research
knows the picture matters. It just never went on to say what the picture should be.

---

## PART 2 — What's actually built

This section comes from reading the code and querying the live database, not from previous notes.
Two earlier handovers got this wrong in both directions, so I checked everything directly.

### The angle engine — built, running on real campaigns, and completely ignored

It's real and it works. Every time a coach's campaign reaches the ad-copy stage, this engine quietly
fires and produces **eight distinct angles**, each with its own audience stage, opening-line type,
hook, headline, and both a short and a long version of the ad text. It runs on both routes through
the product — the automatic cascade and the manual wizard.

It really has run on production. The database's internal counter shows **48 angles were genuinely
created**. They show as zero now only because they're attached to test customer profiles that were
cleaned up afterwards, and deleting a profile deletes its angles with it.

**And nothing reads them.** I searched the entire codebase. The only things that ever touch those
angles are the piece of code that writes them and two manual verification scripts. No ad, no image,
no coach-facing screen has ever seen one.

There's a related detail that tells the same story: every angle is stored with a status of "draft",
and there's a facility to mark one as "selected". **Nothing in the entire codebase ever marks one
selected.** The shelf was built; nobody ever reaches for it.

The other thing worth knowing: it runs in "fire and forget" mode. It's launched alongside the main
work rather than as part of it, and if it fails, the failure is swallowed silently. That's fine while
nothing depends on it. It stops being fine the moment something does.

### The ad copy — built, live, and working off a different system entirely

The ad copy coaches get today is real, live, and good. But it's driven by **eighteen psychological
angles** that predate Andromeda and have nothing to do with the five-stage awareness model. So right
now you effectively have **two angle systems running side by side** — the old eighteen that produce
the copy coaches actually see, and Andromeda's eight that nobody sees.

The compliance research, by contrast, is deeply and genuinely wired in — six separate places in the
code point back at that reference document. That part is real.

### The video scripts — built to the research, never run once

The script generator exists, and it's a faithful build of the nine reports: the five-beat structure,
the under-ten-word opening, one-idea-at-a-time, story-before-number, tone by warmth, the length caps.
The word budgets are taken straight from the research tables, and they replaced an older rule-of-thumb
that was letting scripts run too long for their slot.

**It has never run.** Not once, on anything. The database counter shows no script has ever been
created. The only thing in the entire project that can call it is a manual test script that a person
has to run by hand. Nothing in the product calls it — there's no button, no automatic trigger, and
nowhere for a script to go if one were made.

### The pictures — built, live, and the part coaches actually see

This is the reverse of everything above. The image system is fully built, fully wired, and running in
production today. Coaches press "Generate Ad Images" and get four finished images with headlines
composited onto them. It's had months of work: subject matching to the customer profile, text-overflow
fixes, headline placement, style choices.

All of that was built by us through trial and error — testing renders, looking at results, fixing what
looked wrong. It works. But no research document informed any of it.

---

## PART 3 — The gap

### 🔴 THE ONE THAT MATTERS: the picture half has no research behind it

Here's the difference stated as plainly as I can:

> **For the words, we know what we're aiming at and just haven't connected the wire.**
> **For the pictures, there is no wire to connect, because nobody ever decided what should be at the
> other end of it.**

An Andromeda angle currently carries seven things — the desire, the audience stage, the opening-line
type, the hook, the headline, and two lengths of body text. **Every one of them is words.** There is
no field for a picture, no description of a scene, no visual direction. The concept of "what this
particular angle should look like" does not exist anywhere in the system.

So if we were told tomorrow "connect Andromeda to the ads", the words half is genuine wiring — take
the angle's headline and body, hand them to the ad. Real work, but known work.

The picture half is not wiring. It's an unanswered question: **what image should a problem-aware ad
carry, and how should that differ from a ready-to-buy one?** Nobody has decided. The research that
would decide it doesn't exist. And it's a real question, not a theoretical one — an ad aimed at
someone who doesn't yet know they have a problem plausibly needs a completely different image from
one aimed at someone ready to buy today, and right now both would get an image chosen the same way.

Today the image system picks its look from the coach's niche and its subject from the customer
profile. It has never heard of an angle or an awareness stage. Connecting Andromeda to the ads while
leaving that untouched would mean **eight genuinely different messages all wearing broadly the same
picture** — which quietly undoes the very thing the eight-angle strategy exists to achieve, because
Meta's sameness-detection looks at the creative as a whole.

**This is not a defect and nothing is broken.** It's a piece of thinking that was never done, sitting
underneath a piece of building that was. It's the thing to resolve *before* the connection work, not
after — because it may change what an angle needs to carry.

### The rest — safety and housekeeping, not design

These are all real and worth fixing, but **none of them changes what the product should do**. They're
about not losing things.

| | what | why it matters |
|---|---|---|
| 1 | **The nine script reports exist only in your Downloads folder** — never copied into the project | They're in a folder holding 847 files. The code refers to them by short name, so if that folder is ever cleared, the reasoning behind the script rules becomes unverifiable. The landing-page research was copied in properly back in July; the script research never was. |
| 2 | **The awareness-to-hook mapping report is also Downloads-only** | It's the sole source for the single most important decision in the angle engine. Same risk. |
| 3 | **The four ICP research reports are in the project folder but were never actually saved into version control** | The code refers to one of them by name. Anyone else opening the project wouldn't find it. |
| 4 | **The seven bonus research reports have no traceable link to the code** | The bonus feature is live and was built from them, but nothing in the code says so. It's the only research area where the connection is asserted in notes rather than recorded in the build. |
| 5 | **One reference points at a document that doesn't exist** | The WhatsApp generator credits a "WhatsApp wire research report". There is no such document anywhere. Either it was never saved, or it was never written down. |

Also worth knowing, and honestly self-documented in the code: **three details were our judgement, not
research findings.** A seventh opening-line type was added for the ready-to-buy stage (the research
named six) — and it's flagged as the highest compliance risk, since it's the one that could invent
fake urgency. The tone-to-stage mapping was inferred, because the tone report gave three categories
and the system needs five. And the "eight angles" figure is a chosen number — the brief said eight to
twelve, scaling with spend.

---

## So what's actually left

### (a) The connection work — engineering, no decisions needed

The words are researched, built, and validated; they just don't go anywhere. Connecting them means
taking an angle's headline and body and feeding them into the ad-generation path. The awkward part
isn't difficulty — it's that the ad-generation logic is **duplicated across six places** (the
automatic cascade plus five separate wizard actions: generate, regenerate one, make vertical,
re-composite text, and batch). Every one has to be changed, and five of them have no automated test,
so each needs a real click and a look at the result.

Alongside that: the angle engine has to stop being fire-and-forget and become something reliable, and
it has to be able to re-run (today it produces angles once per customer profile and then never again,
forever). The script generator needs somebody to call it and somewhere for its output to land. All
engineering. No decisions.

### (b) The one real design gap — the picture strategy

Before the connection work is worth doing properly, somebody has to decide what an angle should look
like. That's either a small research pass — the same NotebookLM approach that produced the other
nine — or your own product judgement written down. Either is fine. What isn't fine is building it by
inference, because that's how we'd end up with a rule nobody agreed to, embedded in the system, that
looks researched but isn't.

This is the single most valuable next move, and it costs almost nothing to start.

### (c) There's a safety gate that comes before any of it

One hard prerequisite, and it isn't optional. Angles are harmless while nothing reads them. **The
moment they drive live ads, an invented testimonial becomes a real advertisement for a real coach,
pointed at Meta.** The current safety check was measured last session and catches **16 out of 40**
realistic invented claims. A replacement was designed and measured — it catches all 40 — but it hasn't
been built. That gets built before Andromeda produces anything a coach can publish.

### What's genuinely yours to decide, versus what's just engineering

**Yours:**

1. **What a picture should express for a given angle** — the gap above. This is a product and brand
   call, and it's the one that actually needs you.
2. **Whether a coach picks an angle, or the system picks for them.** Eight angles are produced, and
   nothing has ever marked one as chosen. If coaches choose, they need a screen to choose on. If the
   system chooses, it needs a rule. Nobody has decided which.
3. **What the script generator is for.** A script is something a coach records themselves. Does it
   appear in the campaign kit as a "here's your script" deliverable? Behind a button? For all eight
   angles or only a chosen one? The scripts are researched and built and currently have nowhere to
   go.

**Not yours — engineering will handle it:** how the connection is made across the six duplicated
places, how the angle engine becomes reliable, how re-running works, how the safety check is
rebuilt, and how the picture rule is implemented once you've decided what it is.

### Reconciling the earlier "open decisions" list

Last session produced a list of things flagged as needing your decision. That list was never saved to
disk, so I can't reproduce it line by line — but the checkpoint records a warning about it, and that
warning was right:

- **"Does Andromeda drive words only, or words and pictures?"** — **SETTLED, by your own research.**
  Creative is words and picture together. This should never have been put to you and won't be again.
- **"Should concepts cover all five awareness stages, or narrow to cold?"** — **SETTLED.** Your seven
  Meta landing-page reports found no cold-narrowing rule. All five. This is already how it's built.
- **"How many angles?"** — **SETTLED enough.** The brief says eight to twelve, scaling with spend.
  Eight is live and adjustable. Not worth your time.
- **"How long should a script be?"** — **SETTLED.** The length research decided it, and the practical
  constraint (Meta distributes one asset everywhere) decided the rest.
- **Genuinely still open:** only the three listed above — the picture strategy, who picks the angle,
  and where scripts go.

**The standing rule this establishes:** your research is the authority on what the product should do,
exactly as the code is the authority on what it currently does. A question your research has already
answered is not an open question, and shouldn't come back to you as one.

---

## Appendix — where the documents live

For whoever works on this next. The full technical version of this map, with every filename and the
code locations that cite them, is at `docs/handovers/ANDROMEDA_RESEARCH_MAP_2026-08-03.md`.

| set | count | location |
|---|---|---|
| Andromeda brief + Meta landing-page research | 9 | `docs/andromeda/` — in version control |
| ICP research | 5 | `docs/icp-research/` — on disk, **not** in version control |
| Bonus research | 7 | `docs/bonus-research/` — in version control |
| Meta ad compliance reference (the synthesis) | 1 | `docs/compliance/` — in version control |
| Landing-page research + page replication specs | 11 | `docs/landing-page-research/`, `docs/landing-page-references/` — in version control |
| **Ad-script and creative-strategy research** | **9** | **`~/Downloads` only — not in the project** |
| **Meta compliance source reports** | **15** | **`~/Downloads` only — the synthesis was saved, the sources weren't** |

Also on disk and ZAP-related, but not referenced by any code: reports on high-ticket offers, challenge
design, discovery sessions, distribution, and landing-page builder architecture.

Six documents were uploaded to the project on 2 August. Project uploads aren't visible on the
filesystem, so I can't confirm them from here — but the four named in the checkpoint (Meta's 2026
algorithm, ad length, scripts, landing-page alignment) each match a document found above, so they're
most likely the same corpus re-uploaded rather than anything new.
