# ZAP Landing-Page Visual-Quality Standard

> ⚠️ **CORRECTION PENDING (2026-07-10) — READ FIRST.** The governing rule in **§1 / §1a below ("light, not dark") is WRONG and slated for deletion.** "Light" was a reaction to one bad template, not a specification — and both the dark "energetic" template and any "light" instruction are **DEAD INPUTS**. The real rule: **the five selected SwipePages reference pages ARE the bar — replicate each per its campaign type; do not filter them through a colour rule.** The §2 invariants are *observed commonalities*, not a law. This file is being rewritten as a **per-reference replication spec** (next-session task #1). Do not act on §1/§1a. Full record: `docs/handover/CHECKPOINT_2026-07-10_LP_STANDARD_AND_CORRECTION.md`.

**Purpose:** the concrete bar ZAP's generated landing pages must hit. This is the landing-page equivalent of `docs/AD_IMAGE_VISUAL_QUALITY_STANDARD.md` (+ `docs/ad-references/`). It names WHAT makes a professional coach landing page look professional, so a future session can scope HOW from the real pipeline — and judge output against a fixed reference set, every session.

**Why this file exists (root cause it fixes):** ad images have a committed standard + reference set, so they're built against a bar every session. Landing pages had **nothing in the repo** — the design research and blueprint were produced in conversation (~2026-07-01) and never committed. That asymmetry is why landing pages never got good. This file closes it.

**Derived from:** (1) the locked design decisions (light/face-forward direction + per-campaign reference mapping, decided in conversation ~2026-07-01, previously uncommitted); (2) first-hand review on 2026-07-10 of the five mapped SwipePages "creator" references, captured (downsampled) into `docs/landing-page-references/`. Those five pages are the bar.

---

## 0. The one-line standard

Every ZAP landing page must look like **a real coach's professionally-designed, image-led direct-response page** — one presenter, one disciplined colour system, real photography, real trust marks — **not a gradient-filled generic template.** The tell of "amateur" is not darkness; it is **gradients, uniform stacks, flat stock-less colour blocks, and text-as-logos.**

---

## 1. Locked direction (inputs — do NOT re-derive)

- **Light, image-rich, face-forward, matched to campaign type.**
- **NOT** the dark "energetic"/Kong template — that template preceded this decision and is **superseded**.
- The template **engine** (`registry` / `renderTemplate` / pageType-aware composition) is reusable and **stays**; what changes is the visual system it composes.

### 1a. Honest caveat — where "light" does NOT fully survive contact with the references (Arfeen's call)
Reviewing the five real reference pages, **only Jenna Kutcher is a true white/light page.** The others are not:
- **Marie Forleo (webinar)** — a bold, solid **cobalt-blue** page (single strong brand colour as the base).
- **Jeff Walker (lead magnet)** — **editorial-dark** (deep navy) long-form sales letter on a white letter-card.
- **Ecom Mixer (event)** — **alternates** white and near-black sections.
- **Brendon Burchard (discovery)** — light base with **one** deliberate dark accent band.

So "light" is the **safe default** (and clearly right for sales/authority pages), but it is **not the actual invariant** across professional coach pages. The real shared quality is §2. **Recommendation for Arfeen (not a decision made here):** refine the rule to *"light-default; a single strong brand colour, or an editorial-dark treatment, is on-bar **if** the §2 invariants hold; the enemy is gradients + generic, not darkness itself."* Flagged per the brief: this is a locked input that partly contradicts what the real pages show.

---

## 2. The invariants — what ALL five references share (the real bar)

These held on every one of the five pages, regardless of light/dark:

1. **Face-forward.** A real, high-quality photo of the presenter is **above the fold** and recurs down the page. Jenna, Marie, Burchard, Jeff Walker all lead with a full-bleed cut-out or portrait of the person. This is the single most consistent signal.
2. **Image-composed, not text-on-colour.** The page is built *around* real photography (presenter, lifestyle, product mockups, real event photos) — not paragraphs stacked on flat colour.
3. **Single-colour discipline.** One accent (coral / cobalt / gold / orange) on a neutral or single-brand base. Never a rainbow. Never two competing accents.
4. **No gradients.** Every section is a flat colour block or a photo. Zero gradient fills. (This is the clearest amateur tell to avoid.)
5. **Real trust marks.** Real press/sponsor **logos** (Forbes, NYT, Target, Klaviyo, Triple Whale…) and real endorser **faces + names** (Oprah, Jay Shetty, Ed Mylett…). Never the brand names set as text.
6. **Constrained body-text width.** Copy sits in a narrow, centred column (or a bordered card), never edge-to-edge.
7. **Varied section rhythm.** Padding and treatment change section to section (tight hero → generous proof → banded CTA). Never uniform.
8. **Editorial typography.** A personality/display headline face (high-contrast serif or strong grotesk) paired with one clean sans body; a **two-tone accent** on the emphasis phrase of the headline (e.g. Marie's pink "Sneaky"; Jenna's coloured key words).

If a generated page has all eight, it is on-bar in any base colour. If it misses them, no colour choice saves it.

---

## 3. Per-campaign-type reference mapping — with WHY each fits + what makes it look professional

Captures live in `docs/landing-page-references/`. Source: SwipePages "creator" inspiration gallery (full-page desktop screenshots).

| Campaign type | Reference | Capture file | Base | What makes it professional (observed) |
|---|---|---|---|---|
| **sales_page** | **Jenna Kutcher** — Course Sales | `sales_page--jenna-kutcher.jpg` | **Light** (white + pastel bands) | The gold standard for the light direction. Cream/white base with soft pastel section bands (pink/lavender/pale-yellow) for rhythm; her face above the fold and recurring; editorial display-serif accents ("HI! I'M JENNA KUTCHER", condensed serif "CHANNEL/PEOPLE/MESSAGE/TIME") over clean sans body; a **real** press strip (Forbes, Women's Health, Target, ABC, Inc, Glamour, Bazaar…); constrained centred copy; product mockups; recurring coral CTA. No gradients. |
| **webinar_registration** | **Marie Forleo** — Masterclass Signup | `webinar_registration--marie-forleo.jpg` | **Bold cobalt-blue** | Short, above-the-fold-focused (webinar pages are meant to be one screen). Single strong brand colour as the whole base; huge full-bleed cut-out of her (hands-on-hips) beside a white "What You'll Discover" card; two-tone display-serif headline (pink accent on "Sneaky"); one orange CTA repeated; real press logos (Forbes/NYT/Today/Oprah/People/goop) in white. Discipline: one colour, one accent, one photo, one job. |
| **discovery_call_booking** | **Brendon Burchard** | `discovery_call_booking--brendon-burchard.jpg` | **Light + one dark accent band** | Authority/endorsement pattern. Light base; video-thumbnail hero with his face; a **single** dark navy band for the email-capture CTA (contrast, not a dark template); a grid of **real endorser portraits + names** (Oprah Winfrey Network, Jay Shetty, Tom Bilyeu, Ed Mylett, Mel Robbins); a SUCCESS-magazine authority shot. Clean restrained sans; blue accent. *Honest note: this specific page's actual goal is newsletter signup, not a discovery-call booking — it is mapped for its authority/face-forward **design language**, not its conversion mechanism.* |
| **lead_magnet_download** | **Jeff Walker** — "Followers to Buyers Blueprint" | `lead_magnet_download--jeff-walker.jpg` | **Editorial-dark** (navy) | Long-form sales-letter for a free download. Deep-navy base with a white letter-card holding the argument; gold/amber CTA repeated at every decision point ("GRAB YOUR COPY … (FREE)"); his face in mid-page photos + a large moody portrait; numbered "here's what's included" list; a "WHO IS JEFF WALKER?" authority close with real names. Dark, but editorial and restrained — the opposite of a gradient template. |
| **event_registration** | **The Ecom Mixer** | `event_registration--ecom-mixer.jpg` | **Alternating light/dark** | Real-event energy. Alternates white and near-black sections for rhythm; **real photos of the actual event** (rooftop networking crowd) throughout; real sponsor logos (Klaviyo, Triple Whale, Royal Mail); a circular "why" diagram; a proper ✓/✗ comparison table (EcomMixer vs traditional events); orange CTA. Black-and-white base + one accent; no gradients. |

**Takeaway for the rebuild:** the five are unified by §2, not by a single palette. Each campaign type gets a *different* base treatment appropriate to its job (sales = warm light editorial; webinar = one bold brand colour, one screen; discovery = light authority + endorsements; lead-magnet = editorial-dark letter; event = alternating with real event photography).

---

## 4. Design rules (locked inputs + observed)

**Locked (from the ~2026-07-01 decisions):**
- **No gradients** — they read as "2015 template"; no professional page here uses one.
- **Constrain body-text width** — narrow centred columns / cards, never full-bleed paragraphs.
- **Vary section padding** — not a uniform 96px everywhere; rhythm comes from varied spacing + banding.
- **Presenter's face above the fold** — every reference does this.
- **Real press logos, not text** — real marks in a trust strip.

**Observed (reinforcing, from the five pages):**
- **One accent colour**, disciplined; base is white / one brand colour / editorial-dark per campaign type.
- **Editorial display headline + one clean sans body**; **two-tone accent** on the headline's emphasis phrase.
- **Compose around real photography** — hero, portraits, lifestyle, product mockups, real event shots.
- **Repeat one CTA** in the accent colour at each decision point.
- **Real endorser faces + names** for authority pages.

---

## 5. Image slots required (the design rebuild and the slots are ONE effort)

You cannot compose a hero without a hero image; you cannot build the trust strip without a logo slot. The rebuild and the slots ship together.

- **Hero image** — the presenter, face-forward, above the fold. The page is composed around it.
- **Press-logo strip** — real press/sponsor logos (multiple). The trust strip needs it.
- **Headshot / portrait** — recurring presenter photo (already exists as `headshot`).
- **Coach logo** — brand mark (already exists as `logo`; also now resolved for lead magnets via `getCoachLogoUrl`).
- **Social proof** — real testimonial/endorser photos (already exists as `social_proof`).

Work required (design-sprint scope, not built here): **restore the upload flow, add the `hero_image` + `press_logo` slots, and wire them into the templates.** (Migration `0082` — which adds per-LP `landingPageId` scoping for these slots — is already applied to prod.)

---

## 6. Anti-patterns — the "amateur look" to design AWAY from

- **Gradients** (any gradient fill) — the single clearest tell.
- **Uniform padding** everywhere (the current `96px` everywhere) — kills rhythm.
- **Full-width body text** — edge-to-edge paragraphs read as unstyled.
- **Text-as-press-logos** — brand names typed out instead of real logos.
- **Dark-by-default as a template** — the current dark "energetic"/Kong render applied to everything. (Editorial-dark for a *specific* page like a sales letter is fine; a dark *template* for all is not.)
- **The current legacy renderer** (`buildTextStyleHtml`/`buildVisualStyleHtml`) — Arial/Montserrat, alternating flat blocks, no real photography. Live example: `zapcampaigns.com/p/campaign-191` (LP 191, the last page that actually published, 2026-06-24). This is the "amateur look" to replace.
- **Multi-colour chaos** — more than one accent.
- **Stock-less flat sections** — colour blocks with no real image.

---

## 7. Build sequence + the quality gate (locked)

1. **Image slots first** — restore upload; add hero + press-logo slots; wire them in.
2. **Light-dominant template rebuild** (per §1a caveat) composed around a **real image**.
3. **Quality gate: Arfeen judges the rebuilt template against the references with real images in place** — not an empty template, not "the code instructs it." This is the proof standard, identical in spirit to the ad-image gate (real output, side-by-side against references, judged by eye).
4. **Then the other four templates**, each matched to its reference (§3).

---

## 8. Known defects — recorded here so they cannot be lost

- **`publishedStyle` enum drift / migration `0081` unapplied.** Prod column is `enum('text','visual')`; code passes `"energetic"` → MySQL truncation → the publish UPDATE throws (the log label "LP publish to Cloudflare failed" is misleading — the Cloudflare calls succeed; the DB update fails). **47 of 69 landing pages never published; last successful publish 2026-06-24.** ⚠️ **Applying `0081` alone would ship the WRONG design (the superseded dark energetic template) LIVE — so it is GATED behind the light rebuild.** Fix the design first, then migrate.
- **Godfather/dollar prose-price defect** — the generator's godfather/dollar angles can mention price in prose, violating the no-price rule (§9). Positive-only prompt fix queued, not built.
- **Four stub styles** — `executive` / `clinical` / `warm` / `bold` all **alias to `energetic`** in `registry.ts` (placeholders, not real designs).
- **No style-selection UI** — the coach cannot choose a style; the panel only offers a text/visual toggle and always previews the energetic config.
- **No `campaignType → templateStyle` map** — auto mode hardcodes `"energetic"` for every campaign type despite the per-campaign reference mapping.
- **47 orphaned pages** — generated but never published (null `publicSlug`); to recover or regenerate as part of the fix.

---

## 9. Existing rules that still hold

- **No price on landing pages** — the LP drives registration; price invites pre-judgment. Price lives on offer/checkout/conversation surfaces only.
- **Don't style after the ZAP app** (Fraunces / Instrument Sans) — those are the app's fonts, not the customer's page; **flex voice + type per niche**.
- **The template engine is reusable and stays** — registry / `renderTemplate` / pageType-aware composition are sound; only the visual system changes.

---

## 10. The reference set

`docs/landing-page-references/` — five full-page desktop captures (downsampled, ~1000px wide), one per campaign type, sourced from the SwipePages creator inspiration gallery on 2026-07-10. See `docs/landing-page-references/README.md` for source URLs and per-file notes. All five were reviewed first-hand for this standard. These are the bar; judge generated pages against them with real images in place.
