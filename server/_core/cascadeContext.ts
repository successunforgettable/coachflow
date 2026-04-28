/**
 * Cascade context helper.
 *
 * Reads the user's `campaignKits` row by `(userId, icpId)`, dereferences
 * the upstream `selected*Id` foreign keys per the canonical cascade
 * order, and returns a single `UPSTREAM CONTEXT — SELECTED ASSETS:` block
 * ready to prepend to a downstream generator's user-prompt string.
 *
 * Empty-kit behaviour (locked decision): partial cascade. If `icpId` is
 * null, no kit row exists, or every relevant `selected*Id` is null, the
 * helper returns the empty string. Generators detect this and fall back
 * to their existing SOT+ICP-only prompt construction. This preserves
 * Tool Library dual-access (a user entering a generator standalone
 * without going through upstream nodes still gets a working call). The
 * observability log line below distinguishes "no kit" vs "kit present
 * but empty selections" vs "partial cascade" vs "full cascade" so we
 * can tell at runtime which case fired.
 *
 * ─── Architectural design decisions (do NOT revert without consensus) ───
 *
 * 1. Email's UPSTREAM list omits Headlines and Ad Copy on purpose.
 *    Email is post-conversion content — by the time the recipient is
 *    reading the welcome / engagement / sales sequence, they've already
 *    opted in via the HVCO and (typically) seen the landing page. Some
 *    of that traffic is paid (saw the Headlines + Ad Copy), but some is
 *    organic, referral, direct, or list-import — the recipient may have
 *    never seen the paid-media assets. Cascading paid-media context
 *    into emails risks the email referencing creative the recipient
 *    didn't see, which reads worse than no reference at all. Email
 *    cascades the narrative layer (offer / mechanism / HVCO / landing-
 *    page) that every recipient has touched, regardless of acquisition
 *    channel. WhatsApp DOES include Headlines + Ad Copy because by the
 *    time WhatsApp continuity fires, the recipient is far enough down
 *    the funnel that they've engaged with everything upstream.
 *
 * 2. HVCO carries `title` only, not `hvcoTopic` body. The lead magnet
 *    is referenced downstream by NAME, not by content description.
 *    Downstream copywriters need "Reference '[HVCO_TITLE]' as the
 *    free resource the user opted in for" — not "the HVCO covers X,
 *    Y, Z topics." The topic body is implementation detail for the
 *    lead-magnet-creation step itself, not for downstream cascading.
 *    Including it would bloat the cascade context without giving
 *    downstream prompts anything they can act on.
 *
 * Locked observability format (Stage 2 plan):
 *   `[cascade] forNode=<node> userId=<id> icpId=<id|null>
 *      kit=<found|missing> selectionsResolved=<n>/<expected>
 *      contextLength=<chars> preview="<first 100 chars>"`
 *
 * Removable when launched and the cascade is no longer load-bearing
 * for diagnostics. For now, it's the only runtime evidence that the
 * cascade is firing as designed.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  campaignKits,
  offers,
  heroMechanisms,
  hvcoTitles,
  headlines,
  adCopy,
  landingPages,
  emailSequences,
} from "../../drizzle/schema";

export type CascadeNode =
  | "offer"
  | "mechanism"
  | "hvco"
  | "headlines"
  | "adCopy"
  | "landingPage"
  | "email"
  | "whatsapp";

/**
 * Canonical cascade map. Single source of truth for which upstream
 * selections each downstream node should consume. See the design-
 * decision comment above for why Email omits Headlines + Ad Copy.
 */
const UPSTREAM: Record<CascadeNode, CascadeNode[]> = {
  offer:       [],
  mechanism:   ["offer"],
  hvco:        ["offer", "mechanism"],
  headlines:   ["offer", "mechanism", "hvco"],
  adCopy:      ["offer", "mechanism", "hvco", "headlines"],
  landingPage: ["offer", "mechanism", "hvco", "headlines", "adCopy"],
  email:       ["offer", "mechanism", "hvco", "landingPage"],
  whatsapp:    ["offer", "mechanism", "hvco", "headlines", "adCopy", "landingPage", "email"],
};

// ─── Truncation utilities ─────────────────────────────────────────────

/**
 * Sentence-aware truncation, first-boundary semantics.
 * Locked rule: first sentence OR `maxChars`, whichever comes first.
 * - If a sentence-ender (`.`, `!`, `?` followed by whitespace) appears
 *   within `maxChars`, cut right after it (single sentence only).
 * - Else if the text is shorter than `maxChars`, return it as-is.
 * - Else hard-truncate at `maxChars`.
 * Used for mechanism descriptions to keep cascade context terse.
 */
function truncateAtSentence(text: string, maxChars: number): string {
  if (!text) return "";
  const trimmed = text.trim();
  const match = /[.!?]\s/.exec(trimmed);
  if (match && match.index + 1 <= maxChars) {
    return trimmed.slice(0, match.index + 1);
  }
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars);
}

/**
 * Sentence-or-clause-aware truncation. Looks within `lookRange` for any
 * sentence (`.!?`) or clause (`,;:—–`) boundary; if found, cuts there.
 * Otherwise falls back to a hard cut at `hardMax`. Used for ad-copy
 * snippets where the opening hook is often clause-delimited rather than
 * sentence-complete.
 */
function truncateAtBoundary(text: string, lookRange: number, hardMax: number): string {
  if (!text || text.length <= hardMax) return text.trim();
  const slice = text.slice(0, lookRange);
  const boundaries = /[.!?,;:—–]\s/g;
  let lastBoundary = -1;
  let match: RegExpExecArray | null;
  while ((match = boundaries.exec(slice)) !== null) {
    lastBoundary = match.index + 1;
  }
  if (lastBoundary > 0) return text.slice(0, lastBoundary).trim();
  return text.slice(0, hardMax).trim();
}

// ─── Per-upstream description functions ──────────────────────────────
// Each returns `null` if the row is missing or its content is unusable;
// the dispatcher skips `null` results and surfaces them as "not resolved"
// in the observability log line's `selectionsResolved` count.

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function describeOffer(db: Db, id: number): Promise<string | null> {
  const [offer] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!offer) return null;
  const angleKey = offer.activeAngle ?? "godfather";
  const rawAngle =
    angleKey === "free"   ? offer.freeAngle :
    angleKey === "dollar" ? offer.dollarAngle :
                            offer.godfatherAngle;
  const content = typeof rawAngle === "string"
    ? (() => { try { return JSON.parse(rawAngle); } catch { return null; } })()
    : (rawAngle as { valueProposition?: string; cta?: string } | null);
  if (!content) return null;
  const valueProp = content.valueProposition ?? "";
  const cta = content.cta ?? "";
  return `Selected offer: "${offer.productName}" (${angleKey} angle). Value proposition: "${valueProp}". Offer CTA: "${cta}".`;
}

async function describeMechanism(db: Db, id: number): Promise<string | null> {
  const [m] = await db.select().from(heroMechanisms).where(eq(heroMechanisms.id, id)).limit(1);
  if (!m) return null;
  const description = truncateAtSentence(m.mechanismDescription ?? "", 250);
  return `Selected hero mechanism: "${m.mechanismName}". Description: "${description}".`;
}

async function describeHvco(db: Db, id: number): Promise<string | null> {
  const [h] = await db.select().from(hvcoTitles).where(eq(hvcoTitles.id, id)).limit(1);
  if (!h) return null;
  return `Selected lead magnet (free opt-in): "${h.title}".`;
}

// Deliberate deviation from the locked spec: the spec rendered the
// `Subheadline: "..."` clause unconditionally, but we omit it when the
// subheadline column is empty/null because rendering `Subheadline: ""`
// is uglier than no clause at all and adds noise to downstream prompts.
// All other description functions match their locked spec verbatim.
async function describeHeadline(db: Db, id: number): Promise<string | null> {
  const [h] = await db.select().from(headlines).where(eq(headlines.id, id)).limit(1);
  if (!h) return null;
  const sub = h.subheadline ? ` Subheadline: "${h.subheadline}".` : "";
  return `Selected headline: "${h.headline}".${sub}`;
}

async function describeAdCopy(db: Db, id: number): Promise<string | null> {
  const [a] = await db.select().from(adCopy).where(eq(adCopy.id, id)).limit(1);
  if (!a) return null;
  const angleLabel = a.bodyAngle ?? a.contentType;
  const snippet = truncateAtBoundary(a.content ?? "", 180, 150);
  return `Selected ad copy direction (${angleLabel}): "${snippet}".`;
}

async function describeLandingPage(db: Db, id: number, angleOverride: string | null): Promise<string | null> {
  const [lp] = await db.select().from(landingPages).where(eq(landingPages.id, id)).limit(1);
  if (!lp) return null;
  const angleKey = angleOverride ?? lp.activeAngle ?? "original";
  const rawAngle =
    angleKey === "godfather" ? lp.godfatherAngle :
    angleKey === "free"      ? lp.freeAngle :
    angleKey === "dollar"    ? lp.dollarAngle :
                               lp.originalAngle;
  const content = typeof rawAngle === "string"
    ? (() => { try { return JSON.parse(rawAngle); } catch { return null; } })()
    : (rawAngle as { mainHeadline?: string; primaryCta?: string } | null);
  if (!content || typeof content.mainHeadline !== "string" || typeof content.primaryCta !== "string") return null;
  return `Selected landing-page direction: hero headline "${content.mainHeadline}". Primary CTA: "${content.primaryCta}".`;
}

async function describeEmail(db: Db, id: number): Promise<string | null> {
  const [seq] = await db.select().from(emailSequences).where(eq(emailSequences.id, id)).limit(1);
  if (!seq) return null;
  const emailsArr = typeof seq.emails === "string"
    ? (() => { try { return JSON.parse(seq.emails as string); } catch { return null; } })()
    : (seq.emails as Array<{ subject?: string }> | null);
  const firstSubject = Array.isArray(emailsArr) && emailsArr.length > 0
    ? (emailsArr[0]?.subject ?? "untitled")
    : "untitled";
  return `Selected email sequence: "${seq.name}" (${seq.sequenceType ?? "unspecified"}). First email subject: "${firstSubject}".`;
}

/**
 * Dispatcher: given an upstream node and a kit row, fetches and formats
 * the upstream entity. Returns `null` if the kit's relevant `selected*Id`
 * is null OR if the dereference returns no row.
 */
async function describeUpstream(
  db: Db,
  upstream: CascadeNode,
  kit: typeof campaignKits.$inferSelect,
): Promise<string | null> {
  switch (upstream) {
    case "offer":
      return kit.selectedOfferId ? describeOffer(db, kit.selectedOfferId) : null;
    case "mechanism":
      return kit.selectedMechanismId ? describeMechanism(db, kit.selectedMechanismId) : null;
    case "hvco":
      return kit.selectedHvcoId ? describeHvco(db, kit.selectedHvcoId) : null;
    case "headlines":
      return kit.selectedHeadlineId ? describeHeadline(db, kit.selectedHeadlineId) : null;
    case "adCopy":
      return kit.selectedAdCopyId ? describeAdCopy(db, kit.selectedAdCopyId) : null;
    case "landingPage":
      return kit.selectedLandingPageId
        ? describeLandingPage(db, kit.selectedLandingPageId, kit.selectedLandingPageAngle ?? null)
        : null;
    case "email":
      return kit.selectedEmailSequenceId ? describeEmail(db, kit.selectedEmailSequenceId) : null;
    case "whatsapp":
      // WhatsApp itself is never an upstream of anything in this codebase
      // (it's the most-downstream node). Defensive default — should never
      // be invoked because no node lists "whatsapp" in its UPSTREAM array.
      return null;
    default:
      return null;
  }
}

/**
 * Public entry point. Returns a formatted UPSTREAM CONTEXT block that
 * downstream generators prepend to their user-prompt string before
 * calling invokeLLM. Returns the empty string if cascade isn't
 * applicable (no ICP, no kit, no relevant selections).
 */
export async function getCascadeContext(
  userId: number,
  icpId: number | null | undefined,
  forNode: CascadeNode,
): Promise<string> {
  const expected = UPSTREAM[forNode]?.length ?? 0;

  // No ICP → no kit lookup possible.
  if (icpId == null) {
    console.log(
      `[cascade] forNode=${forNode} userId=${userId} icpId=null kit=missing ` +
      `selectionsResolved=0/${expected} contextLength=0 preview=""`,
    );
    return "";
  }

  const db = await getDb();
  if (!db) {
    console.warn(`[cascade] forNode=${forNode} userId=${userId} icpId=${icpId} db=unavailable`);
    return "";
  }

  // Fetch the kit row keyed on (userId, icpId).
  const [kit] = await db
    .select()
    .from(campaignKits)
    .where(and(eq(campaignKits.userId, userId), eq(campaignKits.icpId, icpId)))
    .limit(1);

  if (!kit) {
    console.log(
      `[cascade] forNode=${forNode} userId=${userId} icpId=${icpId} kit=missing ` +
      `selectionsResolved=0/${expected} contextLength=0 preview=""`,
    );
    return "";
  }

  // Resolve each upstream selection in declared order.
  const parts: string[] = [];
  for (const upstream of UPSTREAM[forNode]) {
    const part = await describeUpstream(db, upstream, kit);
    if (part) parts.push(part);
  }

  if (parts.length === 0) {
    console.log(
      `[cascade] forNode=${forNode} userId=${userId} icpId=${icpId} kit=found ` +
      `selectionsResolved=0/${expected} contextLength=0 preview=""`,
    );
    return "";
  }

  const contextBlock = `UPSTREAM CONTEXT — SELECTED ASSETS:\n${parts.join("\n")}\n\n`;
  const preview = contextBlock.slice(0, 100).replace(/\n/g, " ");
  console.log(
    `[cascade] forNode=${forNode} userId=${userId} icpId=${icpId} kit=found ` +
    `selectionsResolved=${parts.length}/${expected} contextLength=${contextBlock.length} ` +
    `preview="${preview}"`,
  );

  return contextBlock;
}
