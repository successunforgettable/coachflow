/**
 * HONEST COMPLETION — one readiness answer, used everywhere (COMPLETION_AND_FIRST_DEPLOY_PROPOSAL_2026-09-24
 * Part 1; Arfeen decision 5, 2026-09-27).
 *
 * THE DEFECT. "Complete" was decided in five places by three different rules: autoSelectBest required ad images,
 * updateSelection did not, neither looked at publishing, and the Trail's end beat said "11 of 11 — every piece built"
 * whenever its loop ended. So a coach could be told the campaign was done while Meta could not be pushed and the
 * kit page said "In Progress" with a disabled Push and no reason.
 *
 * THE RULE NOW.
 *   - BUILT = the nine kit fields, ad images included (`isKitBuilt`). Both server writers use it, so a kit is
 *     never `complete` by one path and not the other.
 *   - READY = built, the landing page is live, the ad-image batch actually holds images, and a service sits
 *     behind the kit. Anything short of that is a BLOCKER, each with a plain reason and the next step.
 *
 * Pure: the router gathers the facts, this decides. No I/O here, so every case is a unit test.
 */

/** The nine kit fields a campaign needs. Order = Trail order, which is the order blockers are listed in. */
export const KIT_COMPLETION_FIELDS = [
  "selectedOfferId",
  "selectedMechanismId",
  "selectedHvcoId",
  "selectedHeadlineId",
  "selectedAdCopyId",
  "selectedLandingPageId",
  "selectedEmailSequenceId",
  "selectedWhatsAppSequenceId",
  "selectedAdCreativeBatchId",
] as const;

type KitFields = Partial<Record<(typeof KIT_COMPLETION_FIELDS)[number], unknown>>;

const present = (v: unknown) => v != null && !(typeof v === "string" && v.trim() === "");

/** The ONE completeness rule. `autoSelectBest` and `updateSelection` both call this. */
export function isKitBuilt(kit: KitFields | Record<string, unknown> | null | undefined): boolean {
  if (!kit) return false;
  return KIT_COMPLETION_FIELDS.every((f) => present((kit as Record<string, unknown>)[f]));
}

/** Per field: the Trail stop it belongs to, the coach-facing name, and why it matters for a push. */
const NODE_META: Record<(typeof KIT_COMPLETION_FIELDS)[number], { node: string; label: string; needed: string }> = {
  selectedOfferId: { node: "offer", label: "Offer", needed: "every other piece is written from it" },
  selectedMechanismId: { node: "uniqueMethod", label: "Unique Method", needed: "your ads and page explain it" },
  selectedHvcoId: { node: "freeOptIn", label: "Lead Magnet", needed: "it's what people sign up for" },
  selectedHeadlineId: { node: "headlines", label: "Headline", needed: "Meta needs a headline for the ad" },
  selectedAdCopyId: { node: "adCopy", label: "Ad Copy", needed: "Meta can't run an ad without it" },
  selectedLandingPageId: { node: "landingPage", label: "Landing Page", needed: "your ad needs somewhere to send people" },
  selectedEmailSequenceId: { node: "emailSequence", label: "Email Sequence", needed: "it's what GoHighLevel sends your leads" },
  selectedWhatsAppSequenceId: { node: "whatsappSequence", label: "WhatsApp", needed: "it's what GoHighLevel sends your leads" },
  selectedAdCreativeBatchId: { node: "adCreatives", label: "Ad Images", needed: "Meta needs an image for the ad" },
};

export type KitBlocker = {
  /** Trail stop key — the client uses it to link straight to the node. */
  node: string;
  /** What kind of problem: a piece not built (or skipped), or a built piece that still stops a push. */
  kind: "not_built" | "skipped" | "not_published" | "no_images" | "no_service";
  label: string;
  /** One plain sentence: what is wrong. */
  reason: string;
  /** One plain sentence: what to do next. */
  action: string;
};

export type KitReadinessInput = {
  kit: Record<string, unknown>;
  /** A service sits behind the kit's ICP. Without one the push window cannot open. */
  hasService: boolean;
  /** The selected landing page, or null when none is selected. */
  landingPage: { publicUrl: string | null; leftoverTokens: number; needsPublish: boolean } | null;
  /** Images in the selected ad-image batch; null when no batch is selected. */
  adImageCount: number | null;
  /** Trail stop keys the coach skipped (legacy "Skip — I already have this"). */
  skippedNodes: string[];
};

export type KitReadiness = {
  /** ready = push-ready · built_with_blockers = all nine built, something still stops a push · in_progress = not all built */
  state: "ready" | "built_with_blockers" | "in_progress";
  builtCount: number;
  total: number;
  /** Meta needs every piece, a live page and an image. */
  metaReady: boolean;
  blockers: KitBlocker[];
};

export function computeKitReadiness(input: KitReadinessInput): KitReadiness {
  const blockers: KitBlocker[] = [];
  const skipped = new Set(input.skippedNodes);
  let builtCount = 0;

  if (!input.hasService) {
    blockers.push({
      node: "service",
      kind: "no_service",
      label: "Service",
      reason: "This campaign isn't linked to one of your services, so it can't be pushed.",
      action: "Start the campaign again from your service on the dashboard.",
    });
  }

  for (const field of KIT_COMPLETION_FIELDS) {
    const meta = NODE_META[field];
    const built = present(input.kit[field]);
    if (built) builtCount++;

    if (!built) {
      blockers.push({
        node: meta.node,
        kind: skipped.has(meta.node) ? "skipped" : "not_built",
        label: meta.label,
        reason: skipped.has(meta.node)
          ? `You skipped your ${meta.label.toLowerCase()}, so it isn't in this campaign — and ${meta.needed}.`
          : `Your ${meta.label.toLowerCase()} isn't built yet — and ${meta.needed}.`,
        action: `Build your ${meta.label.toLowerCase()} on the Trail.`,
      });
      continue;
    }

    if (field === "selectedLandingPageId") {
      const lp = input.landingPage;
      const live = !!lp && !!lp.publicUrl && !lp.needsPublish;
      if (!live) {
        const n = lp?.leftoverTokens ?? 0;
        blockers.push({
          node: meta.node,
          kind: "not_published",
          label: meta.label,
          reason: n > 0
            ? `Your landing page hasn't been published — ${n} details are still missing, and your ad needs a live page to send people to.`
            : "Your landing page hasn't been published, and your ad needs a live page to send people to.",
          action: n > 0 ? `Fill in the ${n} missing details, then publish your landing page.` : "Publish your landing page.",
        });
      }
    }

    if (field === "selectedAdCreativeBatchId" && (input.adImageCount ?? 0) < 1) {
      blockers.push({
        node: meta.node,
        kind: "no_images",
        label: meta.label,
        reason: "Your ad images didn't come through, and Meta needs an image for the ad.",
        action: "Make your ad images again.",
      });
    }
  }

  const total = KIT_COMPLETION_FIELDS.length;
  const state = blockers.length === 0 ? "ready" : builtCount === total ? "built_with_blockers" : "in_progress";
  const metaBlocking = new Set(["service", "headlines", "adCopy", "landingPage", "adCreatives"]);
  const metaReady = !blockers.some((b) => metaBlocking.has(b.node));
  return { state, builtCount, total, metaReady, blockers };
}
