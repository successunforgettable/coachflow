# Landing-Page Reference Set

The landing-page equivalent of `docs/ad-references/` — the frozen, pixel-verifiable
captures that define the visual bar for each per-reference template. Full standard:
`/LANDING_PAGE_VISUAL_QUALITY_STANDARD.md`. Per-reference replication specs:
`./replication-specs/*.md`. Locked build decisions: memory
`project_lp_rebuild_locked_decisions`.

## Architecture (locked)

**Per-reference-per-type.** Each of the 5 ZAP page types gets its own bespoke template
built as a hand-tuned replica of a specific real page (its "reference"). No generic
"one style × five layouts" engine. Template #1 (Burchard Productivity lead-magnet) is
built, wired, and shipping-proven; templates 2–9 are the queue. Selection is
registry-driven (`server/lib/templates/renderRegistry.ts`): a pageType with a built
template auto-publishes; a pageType without one stages a **review-draft** (never the
old energetic design).

## Launch set — one reference per campaign type (frozen 2026-07-14)

The launch scope is **one reference per campaign type**. All frozen captures below are
clean live-page full-page captures (no SwipePages wrapper), pixel-verified complete, at
the 4480px-wide bar. `styleMode` values are declared in `drizzle/schema.ts` and added to
the prod enum by migration `0085_lp_templates_2_9_publishedstyle.sql` (**held — not applied**).

| pageType | Reference persona | Frozen capture (in-repo) | Dimensions | styleMode | Status |
|---|---|---|---|---|---|
| `lead_magnet_download` | **Brendon Burchard — Productivity Sheet** | `lead_magnet_download--brendon-burchard-productivity.png` | 4480×4202 | `lead_magnet_burchard` | ✅ built · wired · shipping-proven |
| `event_registration` (free) | **Iman Gadzhi — Make Money Online Challenge** | `event_registration--iman-gadzhi.png` | 4480×13966 | `event_iman_gadzhi` | ✅ reference frozen |
| `event_registration` (paid) | **Alex Hormozi — Scaling Workshop** (generic headline) | `event_registration--alex-hormozi.png` | 4480×14636 | `event_hormozi` | ✅ reference frozen |
| `sales_page` | **Ali Abdaal — Part-Time YouTuber Academy** | `sales_page--ali-abdaal.png` | 4480×69468 | `sales_ali_abdaal` | ✅ reference frozen |
| `discovery_call_booking` | **Burchard design language** (see below — no own capture) | *(reuses Burchard Productivity)* | — | `discovery_burchard_performance` | ✅ resolved — no capture needed |
| `webinar_registration` | **Siddharth Rajsekar — AI Coaching Workshop** | ⛔ capture REJECTED — re-capture needed | — | `webinar_rajsekar_coaching` | ⛔ blocked on clean capture |

### Discovery resolution (2026-07-14)
`discovery_call_booking` is **"Burchard design language applied to a booking flow,"** built
on the already-locked, pixel-verified **Burchard Productivity** design system — **no new
capture needed**. The Burchard Performance page (the discovery spec's subject) is a
*newsletter opt-in* whose mechanism must be authored into a booking CTA anyway, has no clean
high-res capture (SwipePages ~1080px only; brendon.com 502; live page is now a different
"Progress Mode" newsletter), and we already own a frozen Burchard design system. Detail in
`replication-specs/Brendon_Burchard_Performance_Coach_Visual_Replication_Report.md`.

### Rajsekar (webinar) — capture REJECTED (all candidates)
No clean, complete, uncontaminated Rajsekar capture exists yet:
- The supplied print-to-PDF ("Turn Your Knowledge Into ₹3L/Month…AI" masterclass) was blank
  below the fold (content scan 22.3%, one 52%-tall contiguous blank gap — lazy-load failure).
- Two earlier full-height PNGs were complete but **SwipePages-wrapped** (Swipe Pages nav +
  "Landing Page Inspirations" breadcrumb at the top) — browser-chrome contaminated; one was
  a different page (a course-enrollment page, not the AI Coaching Workshop).

NOT frozen. `webinar_registration` stays a review-draft until a COMPLETE, wrapper-free
live capture (all lazy sections forced to load) is supplied. Detail in
`replication-specs/Siddharth_Rajsekar_AI_Coaching_Workshop_...md`.

## Deferred post-launch (out of the launch set)

- **Jenna Kutcher / Amy Porterfield — Academy Waitlist** (`sales_page` alt): deferred; the
  original page is dead. Revisit when a live equivalent exists. Sales launches on Ali Abdaal.
- **Jeff Walker — Audience Monetization Blueprint** (`lead_magnet_download` alt): deferred;
  original page dead. Lead-magnet launches on Burchard Productivity.
- **Rajsekar AI Marketing Workshop** (`webinar_registration` proof-heavy variant): deferred;
  webinar launches on the AI Coaching page once re-captured.
- `styleMode` enum values for the deferred variants (`sales_jenna_kutcher`,
  `lead_magnet_jeff_walker`, `webinar_rajsekar_marketing`) remain declared/held so they need
  no future migration, but no builder or reference is planned for launch.

## Superseded / historical captures (do NOT use as build targets)

`discovery_call_booking--brendon-burchard.jpg`, `lead_magnet_download--jeff-walker.jpg`,
`sales_page--jenna-kutcher*.jpg`, `webinar_registration--marie-forleo*.jpg`,
`event_registration--ecom-mixer.jpg` — all ~1000px SwipePages downsamples from the earlier
5-persona set. Below the 4480px bar and/or the wrong persona for the locked mapping. Kept for
history only.

## Honest notes

- The 4480px bar is the resolution floor — a template can't be pixel-judged against a 1000px
  downsample. Reference-first is a hard gate (building before a verified capture caused
  template #1's reference chase).
- Live-page-is-truth: each frozen in-repo capture is the pixel authority and supersedes the
  older SwipePages evidence in its replication spec wherever they differ.
- Repo-size note: the three new event/sales PNGs total ~65 MB (very tall full pages at 4480px,
  no lossless optimizer was available). Consider git-lfs for these binaries if repo size matters.
