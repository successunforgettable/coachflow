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

## The 9-template mapping (templates 2–9 queue)

| # | pageType | Persona / reference | styleMode (registry + enum) | Status |
|---|---|---|---|---|
| 1 | `lead_magnet_download` | **Brendon Burchard — Productivity Sheet** | `lead_magnet_burchard` | ✅ built · wired · shipping-proven |
| 2 | `discovery_call_booking` | **Brendon Burchard — Performance Coach** (design-language only; real mechanism is a newsletter opt-in → booking CTA is AUTHORED) | `discovery_burchard_performance` | ⏳ queued |
| 3 | `webinar_registration` | **Siddharth Rajsekar — AI Coaching Workshop** (lean default) | `webinar_rajsekar_coaching` | ⏳ queued |
| 4 | `webinar_registration` | **Siddharth Rajsekar — AI Marketing Workshop** (proof-heavy variant) | `webinar_rajsekar_marketing` | ⏳ queued |
| 5 | `event_registration` | **Iman Gadzhi — Faceless Product Launch** (free-event default) | `event_iman_gadzhi` | ⏳ queued |
| 6 | `event_registration` | **Alex Hormozi — Scale Business Workshop** (paid variant) | `event_hormozi` | ⏳ queued |
| 7 | `sales_page` | **Ali Abdaal — YouTube Creator Course** (default) | `sales_ali_abdaal` | ⏳ queued |
| 8 | `sales_page` | **Jenna Kutcher / Amy Porterfield — Academy Waitlist** (alt) | `sales_jenna_kutcher` | ⏳ queued |
| — | `lead_magnet_download` | **Jeff Walker — Audience Monetization Blueprint** (alt) | `lead_magnet_jeff_walker` | ⏳ queued |

The styleMode values are declared in `drizzle/schema.ts` and added to the prod enum by
migration `0085_lp_templates_2_9_publishedstyle.sql` (**held — not applied**). Legacy
`executive/energetic/clinical/warm/bold` are render-only and are deliberately NOT a valid
prod publishedStyle (they would re-ship the rejected energetic design).

## Reference-capture readiness (audited 2026-07-13)

Only template #1's reference is launch-ready. The replication specs were written against
the locked personas above, but the **frozen captures on disk are an older SwipePages set**
— most locked personas have no matching high-DPR capture yet.

| Reference | On-disk capture | Resolution | Launch-ready? |
|---|---|---|---|
| Burchard Productivity (#1) | `lead_magnet_download--brendon-burchard--productivity-sheet.png` | 4480×4202 | ✅ the bar |
| Burchard Performance (discovery) | `discovery_call_booking--brendon-burchard.jpg` | 1000×2383 | ⚠️ right persona, too low-res |
| Jeff Walker (lead-magnet alt) | `lead_magnet_download--jeff-walker.jpg` | 1000×3031 | ⚠️ right persona, too low-res |
| Rajsekar (webinar ×2) | — | — | ❌ no capture |
| Iman Gadzhi (event) | — (`event_registration--ecom-mixer.jpg` is a different persona) | — | ❌ no capture |
| Alex Hormozi (event variant) | — | — | ❌ no capture |
| Ali Abdaal (sales) | — | — | ❌ no capture |
| Jenna/Amy (sales alt) | `sales_page--jenna-kutcher*.jpg` | 1000px | ⚠️ wrong Jenna page + low-res |
| Marie Forleo (`webinar_registration--marie-forleo*.jpg`) | present | 1000px | ⚠️ superseded — not in the locked mapping |
| Ecom Mixer (`event_registration--ecom-mixer.jpg`) | present | 1000px | ⚠️ superseded — not in the locked mapping |

**Batch-capture needed** (high-DPR ~2×, full-page desktop + mobile) before building each
template: Rajsekar AI Coaching, Rajsekar AI Marketing, Iman Gadzhi, Alex Hormozi, Ali
Abdaal, Jenna/Amy DCA waitlist (confirm canonical page first), and recaptures of Burchard
Performance + Jeff Walker at high-DPR. Source URLs are in each persona's replication spec.

## Honest notes

- The 4480px Burchard PNG is the resolution bar — a template can't be pixel-judged against
  a 1000px downsample. Reference-first is a hard gate (building before a verified capture is
  what caused template #1's reference chase).
- Marie Forleo and Ecom Mixer captures are from the earlier 5-persona set and are **not**
  in the locked 9-template mapping; kept for history, not used as build targets.
- Burchard's page goal is newsletter signup, not a discovery-call booking — mapped for its
  authority/face-forward design language; the booking CTA/mechanism is authored.
