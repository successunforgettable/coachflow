import type { LpPageType } from "./types";

/**
 * WHICH PER-REFERENCE TEMPLATE SOURCES CAN RENDER EACH pageType.
 *
 * This exists so the "SECTIONS TO LEAVE EMPTY" lists in `landingPageGenerator.ts`
 * PAGETYPE_PROMPTS can be checked against what the renderer is actually able to display,
 * instead of the two drifting apart silently.
 *
 * They DID drift. `webinar_registration` blanked `uniqueMechanism` and `whyOldFail` while
 * `webinarLight.ts` built its entire "why this works" band from exactly those two fields — so
 * the band never rendered on a single webinar page, and `webinarLight.ts` carried a comment
 * saying both were "always generated". Nothing connected the two files, so nothing caught it.
 *
 * Includes the upgrade-only variants (`pageType: null` in TEMPLATE_REGISTRY), because
 * `resolveWebinarStyle` / `resolveEventStyle` / `resolveSalesStyle` promote a page onto them at
 * (re)publish time — a field one variant renders is a field that pageType can display.
 *
 * NOT included: the generic legacy renderers (`text` / `visual`, in `server/lib/landingPageHtml.ts`),
 * which are reachable for every pageType and render nearly every field. Holding the blank lists to
 * those would forbid blanking anything. The per-reference template is what a new page publishes
 * with, and is the standard the prompt is held to here.
 */
export const PAGE_TYPE_TEMPLATE_SOURCES: Record<LpPageType, string[]> = {
  sales_page: ["salesLight.ts", "salesAliAbdaal.ts"],
  webinar_registration: ["webinarLight.ts", "webinarRajsekar.ts"],
  discovery_call_booking: ["discoveryBurchard.ts"],
  lead_magnet_download: ["burchardProductivity.ts"],
  event_registration: ["eventImanGadzhi.ts", "eventHormozi.ts"],
};
