# ZAP Operator Guide — Warm Beta

**For:** warm-beta cohort members.
**Date:** 2026-05-16.
**Status:** This is a controlled cohort release. Not public beta.

ZAP is an AI-first marketing-asset drafter. It generates offers,
landing pages, email + WhatsApp sequences, ad copy, ad creatives, and
hero-mechanism content for your campaign — fast, in one cascade.

But ZAP **drafts**. You **finish**. This guide is how to use it
safely.

---

## The one rule that matters

**Never push a kit to Meta or GHL without reviewing it first.**

ZAP is deliberately built to refuse to invent your prices, guarantee
terms, cohort dates, customer testimonials, or programme duration. If
you didn't tell it those facts during setup, it will leave a marker
in the output that looks like this:

> Lose 20 lbs in 90 days for `[INSERT_PRICE]` or your money back.

Those `[INSERT_X]` markers are not a bug. They are ZAP saying: *"I
don't know your real price. Fill it in before you publish."*

The warm-beta UI surfaces those markers in two places — the kit page
banner and the push modal. If you ignore them and push, your
audience will see `[INSERT_PRICE]` instead of "$497". That is
embarrassing and avoidable.

---

## The five-step kit completion flow

### Step 1 — Fill in setup honestly

When you go through onboarding / service setup:
- Enter your **real price** (e.g. "$497" not "let AI suggest").
- Enter your **real guarantee terms** (e.g. "30-day money-back").
- Enter your **real cohort cadence** (e.g. "next cohort Feb 3, 12 seats").
- Enter your **real programme duration** (e.g. "12 weeks").
- If using testimonials, enter **real customer names + locations**.

The more facts you supply here, the fewer placeholders you'll see
later. A fully-filled setup can produce a clean kit with zero
`[INSERT_X]` markers and zero banner.

### Step 2 — Trigger Auto Mode

Click the Auto Mode button. ZAP runs a 9-step cascade:

1. Offer angle
2. Hero mechanism
3. Lead magnet
4. Headlines
5. Ad copy
6. Landing page
7. Email sequence
8. WhatsApp sequence
9. Ad creatives

Each step persists before the next one starts. You can refresh the
page during the cascade — your work won't be lost.

### Step 3 — Read the banner

When you land on your kit page (`/v2/campaign-kits/[your-id]`), look
at the top. If you see an orange banner:

> ⚠ **Some content still needs your details before publishing**
> ZAP generated **9 placeholders** (like `[INSERT_PRICE]`,
> `[INSERT_GUARANTEE_TERMS]`, `[INSERT_COHORT_START_DATE]`) across **3
> assets**. These are intentional — ZAP does not invent your pricing,
> guarantee terms, cohort dates, or programme duration. Fill them in
> before pushing to Meta, GHL, or sending to leads.
>
> [Offer × 5] [Landing Page × 3] [Email Sequence × 1]
>
> **[Review & Complete →]**

That banner is telling you exactly what's left to finish. Click the
button.

If you see **no banner**, your kit is clean — you can skip to step 5.

### Step 4 — Edit every placeholder

The "Review & Complete →" button scrolls you to the asset that has
the most placeholders. Open it, edit each `[INSERT_X]` token to your
real value, save, go back to the kit page.

The banner count should decrement. Repeat until the banner self-hides
entirely.

If a placeholder asks for something you genuinely don't know yet
(e.g. you don't have a price set yet), **don't push that kit**. Wait
until you have the fact.

### Step 5 — Push only when clean

Click "Push to Meta / GHL". One of two things happens:

**A) The modal opens with no warning.** Your kit is clean. Pick
platforms, push, you're done.

**B) The modal opens with a smaller orange warning** + a "← Review
on kit page first" button. This means you missed something. Click
that button, finish the placeholders, come back.

**Do not push past the warning.** The warning is not a soft nudge —
it means your audience will see literal `[INSERT_X]` strings.

---

## What NOT to trust blindly

ZAP is good at drafts. It is **not** a fact-checker or a compliance
officer. Specifically:

1. **Customer testimonials.** ZAP will fill in testimonial *quotes*,
   but the **names + locations** must be people you actually know.
   Don't ship fictional testimonials — that's both ethically wrong
   and a Meta ad-policy violation.
2. **Statistics / research claims.** Cross-check any numerical or
   research claim ZAP produces. The LP generator is instructed not
   to invent statistics, but verification is your job.
3. **Dates.** If ZAP produced a date, verify it matches your
   actual calendar.
4. **Compliance language.** Health / financial / legal claims must
   be reviewed against your jurisdiction's rules before publish.
   ZAP injects some Meta ad-policy guidance but does not guarantee
   compliance.
5. **Pricing structure.** Anchor prices, bonus values, "total value"
   summations — if ZAP shows a specific dollar amount that wasn't
   in your setup, treat it as a placeholder you forgot to fill, not
   as a real number ZAP knows about your business.

---

## Common situations

### "I see a placeholder but I don't know what it means"

The placeholder name tells you. Examples:
- `[INSERT_PRICE]` → your offer's price
- `[INSERT_GUARANTEE_TERMS]` → the wording of your guarantee
- `[INSERT_COHORT_START_DATE]` → when your next cohort starts
- `[INSERT_COHORT_LIMIT]` → how many seats per cohort
- `[INSERT_PROGRAMME_DURATION]` → how long the programme runs
- `[INSERT_RESULT_AMOUNT]` → e.g. "20 lbs" / "$10k" / "5x growth"
- `[INSERT_TIMEFRAME]` → e.g. "90 days" / "6 weeks"
- `[INSERT_BONUS_1_VALUE]`, `[INSERT_BONUS_2_VALUE]` → bonus pricing

If a placeholder appears that genuinely shouldn't (e.g. a token you've
never seen, or a token in an asset where it makes no sense), report
it to support — that may be a generator drift.

### "I edited a placeholder but the banner count didn't drop"

- Did you save the asset edit? (Browser network tab will show a
  trpc mutation if so.)
- Did you refresh the kit page? The banner reads from the brief
  queries; a refresh re-fetches them.
- If the banner still shows the same count after a hard refresh,
  inspect the asset content — there may be another `[INSERT_X]` in
  that asset you didn't notice.

### "I want to push without completing placeholders"

You should not. But if you have a strong reason (e.g. you're testing
the push flow internally and want to see how Meta ingests literal
placeholder strings), you can dismiss the warning by closing the
modal, but you cannot skip the warning render — it is non-dismissible
by design.

### "The kit shows no banner but I see `[INSERT_X]` in an asset"

Should not happen — the detector scans every asset's persisted
brief data. If you see this, report it immediately to support. They
will run `detectPlaceholders` against your kit's brief blobs and
debug.

### "The push to Meta or GHL failed"

That's not a placeholder problem. Push failures are infrastructure —
contact support with your kit ID, push timestamp, and the error
message you saw. Support has access to the `pushes` audit log + the
orchestration `jobs` table.

---

## Limits of the warm beta

You are part of a controlled cohort. Some things are not in scope
yet:

- **Non-English assets.** ZAP outputs English only.
- **Video / image generation polish.** Ad creatives use Pexels
  footage + automated voiceover. Custom branding requires manual
  edits.
- **Compliance certification.** ZAP does not certify any output as
  compliant with your jurisdiction's rules. You are the compliance
  owner.
- **Fully autonomous publishing.** ZAP will never publish without
  your explicit click on the push button. There is no scheduled
  or background publish.
- **Multi-account management.** One operator, one Meta + GHL
  connection per kit.

---

## Who to ask

- **Placeholder review questions** → operator guide first (this
  doc), then support
- **Push failures** → support with kit ID + timestamp
- **Generator output looks wrong / made up** → support with kit ID
  + a specific quote + which asset
- **Setup / onboarding stuck** → support with screenshot

Support response target during warm beta: same business day.

---

## Final word

You are part of how ZAP gets to public beta. The most useful thing
you can do is **use the placeholder review flow honestly** — read
the banner, complete every placeholder, push only clean kits, report
anything that looks like a fabrication that slipped through.

If you do that, ZAP gives you a complete campaign draft in minutes.
If you don't, you'll ship `[INSERT_PRICE]` to your list. The choice
is yours.

Have fun.
