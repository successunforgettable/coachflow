/**
 * Landing-page template registry + one shared render dispatch.
 *
 * BEFORE: `runLandingPagePublish` (initial publish) and `republishLandingPage`
 * (compliance re-render) each hand-maintained a parallel if/else that had to stay
 * in lockstep, and `orchestration.ts` picked the style with a hardcoded
 * `lead_magnet ? burchard : energetic` ternary. Drift between the two publish
 * branches silently swapped templates; the ternary didn't scale past one template.
 *
 * NOW: one data registry keyed by styleMode. Both publish paths call
 * `renderLandingPageHtml(styleMode, input)`; orchestration calls
 * `styleForPageType(pageType)`. Adding a template = one registry entry.
 *
 * Image slots: `slotImageUrl` (the tested-but-previously-uncalled structural
 * Cloudinary transform) is wired into the legacy/text/visual asset resolution so
 * those templates get correct crop/aspect/gravity. The Burchard lead-magnet
 * template is intentionally NOT routed through it — it resolves its own slots
 * (its composite is PASS-gated with hand-tuned positioning, and its product cover
 * is already a page-1 transform URL that must not be re-transformed).
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import type { CoachAssetOptions, LpPageType } from "./types";
import { slotImageUrl, type SlotAssetType } from "../images/imageSlots";

export type LpStyleMode =
  | "text" | "visual" | "executive" | "energetic" | "clinical" | "warm" | "bold"
  | "lead_magnet_burchard" | "discovery_burchard_performance";

export type AssetRow = { assetType: string; url: string };

export interface TemplateRenderInput {
  content: LandingPageContent;
  serviceName: string;
  coachName: string | null;
  coachBackground: string | null;
  /** Full coach-asset set (all slots) — each template picks what it needs. */
  assetRows: AssetRow[];
  serviceId: number | null;
  /** Owning coach — templates that resolve per-coach data (e.g. discovery's booking URL). */
  userId: number;
  /** LpPageType string (drives legacy renderTemplate section order). */
  pageType: string;
}

export type TemplateRenderFn = (input: TemplateRenderInput) => Promise<string> | string;

interface TemplateEntry {
  /**
   * The pageType this style is the per-reference design for — the reverse lookup
   * orchestration uses to pick a style for a fresh cascade. `null` = a legacy /
   * fallback style that can still re-render an already-published page but is never
   * auto-selected for a new page (so unbuilt page types stage as review-drafts).
   */
  pageType: string | null;
  render: TemplateRenderFn;
}

/** First url for a slot, structurally transformed (correct crop/aspect/gravity). */
function slotUrl(assetRows: AssetRow[], assetType: SlotAssetType): string | null {
  const raw = assetRows.find((a) => a.assetType === assetType)?.url ?? null;
  return raw ? slotImageUrl(raw, assetType) : null;
}
function slotUrlList(assetRows: AssetRow[], assetType: SlotAssetType): string[] {
  return assetRows.filter((a) => a.assetType === assetType).map((a) => slotImageUrl(a.url, assetType));
}

/**
 * Build the legacy renderTemplate CoachAssetOptions from the full asset set, with
 * every registered image slot correctly cropped. Shared by both publish paths so
 * they resolve IDENTICAL assets (fixes the prior compliance-path divergence that
 * dropped hero_image / press_logo and skipped per-LP scoping).
 * `logo` and `social_proof` are not structural IMAGE_SLOTS, so they pass through raw.
 */
export function coachAssetOptionsFrom(input: TemplateRenderInput): CoachAssetOptions {
  return {
    headshotUrl: slotUrl(input.assetRows, "headshot"),
    logoUrl: input.assetRows.find((a) => a.assetType === "logo")?.url ?? null,
    heroImageUrl: slotUrl(input.assetRows, "hero_image"),
    socialProofUrls: input.assetRows.filter((a) => a.assetType === "social_proof").map((a) => a.url),
    pressLogoUrls: slotUrlList(input.assetRows, "press_logo"),
    coachName: input.coachName,
    coachBackground: input.coachBackground,
  };
}

const TEMPLATE_STYLE_IDS = ["executive", "energetic", "clinical", "warm", "bold"] as const;

async function renderLegacyTemplate(
  input: TemplateRenderInput,
  style: (typeof TEMPLATE_STYLE_IDS)[number],
): Promise<string> {
  const { renderTemplate } = await import("./renderTemplate");
  const { getTemplate } = await import("./registry");
  return renderTemplate(
    input.content,
    getTemplate(style),
    coachAssetOptionsFrom(input),
    (input.pageType || "sales_page") as LpPageType,
  );
}

async function renderText(input: TemplateRenderInput): Promise<string> {
  const { buildTextStyleHtml } = await import("../landingPageHtml");
  return buildTextStyleHtml(input.content, input.serviceName);
}

async function renderVisual(input: TemplateRenderInput): Promise<string> {
  const { buildVisualStyleHtml } = await import("../landingPageHtml");
  const o = coachAssetOptionsFrom(input);
  return buildVisualStyleHtml(input.content, input.serviceName, {
    headshotUrl: o.headshotUrl,
    logoUrl: o.logoUrl,
    socialProofUrls: o.socialProofUrls,
    coachName: o.coachName,
    coachBackground: o.coachBackground,
  });
}

async function renderBurchard(input: TemplateRenderInput): Promise<string> {
  const { renderBurchardLeadMagnet } = await import("./leadMagnetPublish");
  return renderBurchardLeadMagnet({
    content: input.content,
    serviceName: input.serviceName,
    coachName: input.coachName,
    assetRows: input.assetRows,
    serviceId: input.serviceId,
  });
}

async function renderDiscovery(input: TemplateRenderInput): Promise<string> {
  const { renderDiscoveryBurchard } = await import("./discoveryPublish");
  return renderDiscoveryBurchard({
    content: input.content,
    serviceName: input.serviceName,
    coachName: input.coachName,
    assetRows: input.assetRows,
    userId: input.userId,
  });
}

/**
 * The registry. To add template N: add its styleMode entry with its `pageType`
 * (so orchestration auto-selects it) and a `render` that calls its builder.
 */
export const TEMPLATE_REGISTRY: Record<LpStyleMode, TemplateEntry> = {
  lead_magnet_burchard: { pageType: "lead_magnet_download", render: renderBurchard },
  discovery_burchard_performance: { pageType: "discovery_call_booking", render: renderDiscovery },
  executive: { pageType: null, render: (i) => renderLegacyTemplate(i, "executive") },
  energetic: { pageType: null, render: (i) => renderLegacyTemplate(i, "energetic") },
  clinical: { pageType: null, render: (i) => renderLegacyTemplate(i, "clinical") },
  warm: { pageType: null, render: (i) => renderLegacyTemplate(i, "warm") },
  bold: { pageType: null, render: (i) => renderLegacyTemplate(i, "bold") },
  visual: { pageType: null, render: renderVisual },
  text: { pageType: null, render: renderText },
};

/** One dispatch both publish paths call. Unknown styles fall back to text. */
export async function renderLandingPageHtml(
  styleMode: string,
  input: TemplateRenderInput,
): Promise<string> {
  const entry = TEMPLATE_REGISTRY[styleMode as LpStyleMode] ?? TEMPLATE_REGISTRY.text;
  return entry.render(input);
}

/**
 * The per-reference styleMode for a pageType, or `null` when no template is built
 * yet. Orchestration treats `null` as "stage a review-draft, do not auto-publish"
 * — which keeps the rejected energetic design un-shipped for unbuilt page types.
 */
export function styleForPageType(pageType: string): LpStyleMode | null {
  const hit = (Object.entries(TEMPLATE_REGISTRY) as [LpStyleMode, TemplateEntry][]).find(
    ([, e]) => e.pageType === pageType,
  );
  return hit ? hit[0] : null;
}
