/**
 * V2Trail — Campaign Trail page.
 * Route: /v2-dashboard/trail/:campaignKitId
 *
 * Sprint 1: TrailBar + ChatThread on real kit data, transcript persistence.
 * Sprint 2: welcome-back resume beat (§10.4), transcript restore.
 * Sprint 3 C2: auto-loop driver — orchestrateStep job per node, reveal,
 *   persist; resume is structural (driver keys off kit state).
 * Sprint 3 C3: GenerationNarrator (§12.2 cadence 0/4/8s, patience >14s,
 *   long-wait >30s — all client timers, templated, no streaming),
 *   Love it / Tweak chips with silence-proceeds semantics (spec 5.1.4),
 *   tweak queue (regenerate THAT node between cascade nodes, re-reveal),
 *   fresh-handoff welcome-back suppression.
 *
 * TRANSCRIPT-WORTHINESS RULE: persisted = each node's opening narration
 * line, the divider + reveal card, tweak conversations (request, instruction,
 * updated reveal), Love-it echo + reaction, completion bubble. Ephemeral
 * (display-only, never persisted) = narration lines 2/3, patience and
 * long-wait reassurance, chip rows. A resumed thread reads as a clean
 * story without repeated-spam.
 */
import { useMemo, useRef, useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import V2Layout from "./V2Layout";
import TrailBar, { type TrailStop, type StopState } from "./components/TrailBar";
import ChatThread, { type ChatMessage } from "./components/ChatThread";
import { useMethodWalkthrough, type WalkthroughEmit } from "./components/V2MethodWalkthrough";
import ComplianceDial from "./components/ComplianceDial";
import { trpc } from "@/lib/trpc";
import { getNodePatience } from "./lib/patienceGuard";
import { getEarlyLines, getRevealLine, resetBuild } from "./lib/zappyWaitLines";
import { pickHvcoLongTitles, flattenHeadlineGroups, resolveDeckSourceId } from "@shared/deckCards";
import { humanizeUnresolvedTokens } from "@shared/placeholderLabels";
import { resolveTokensInText } from "./lib/resolveTokens";
import { lazy, Suspense } from "react";

const V2ICPResultPanel = lazy(() => import("./V2ICPResultPanel"));

const FONT_BODY = "'Instrument Sans', system-ui, sans-serif";
const FONT_HEADING = "'Fraunces', Georgia, serif";
const TEXT_COLOR = "#1A1624";

// 11 trail stops → real kit columns. service/icp derive from kit linkage;
// the other 9 from the selected*Id columns (batchId for adCreatives).
const STOP_DEFS: { key: string; label: string; field?: string }[] = [
  { key: "service",          label: "Service" },
  { key: "icp",              label: "ICP" },
  { key: "offer",            label: "Offer",        field: "selectedOfferId" },
  { key: "uniqueMethod",     label: "Method",       field: "selectedMechanismId" },
  { key: "freeOptIn",        label: "Lead Magnet",  field: "selectedHvcoId" },
  { key: "headlines",        label: "Headlines",    field: "selectedHeadlineId" },
  { key: "adCopy",           label: "Ad Copy",      field: "selectedAdCopyId" },
  { key: "landingPage",      label: "Landing Page", field: "selectedLandingPageId" },
  { key: "emailSequence",    label: "Email",        field: "selectedEmailSequenceId" },
  { key: "whatsappSequence", label: "WhatsApp",     field: "selectedWhatsAppSequenceId" },
  { key: "adCreatives",      label: "Ad Images",    field: "selectedAdCreativeBatchId" },
];

// ── Sprint 3 C2: the 9 cascade nodes the driver runs, in order ──
type AutoStepName =
  | "offer" | "mechanism" | "hvco" | "headlines" | "adCopy"
  | "landingPage" | "emailSequence" | "whatsappSequence" | "adCreatives";

// Sprint 4 C1: §12.3 manual-mode node intros (one line each).
const MANUAL_INTROS: Record<AutoStepName, string> = {
  offer:            "Time to build an offer they can't shrug off.",
  mechanism:        "Your method needs a name people remember.",
  hvco:             "What's the irresistible free thing?",
  headlines:        "Fifteen ways to stop the scroll. Ready?",
  adCopy:           "Words that earn the click.",
  landingPage:      "The page that does the convincing.",
  emailSequence:    "The follow-up that does the selling.",
  whatsappSequence: "Short messages, big results.",
  adCreatives:      "Let's make it look as good as it reads.",
};

// Sprint 4 C1: which nodes are dealable (multi-item set from the generator)
// vs single-item (auto-style reveal, no deck). Offer = 1 row w/ 3 JSON
// angles dealt as cards; LP = 1 row w/ 4 JSON angles; email/wa/adCreatives =
// single items; mechanism/hvco/headlines/adCopy = true set-based dealing.
type DealableConfig = {
  /** tRPC path to fetch the set items (e.g. "heroMechanisms.getBySetId") */
  fetchSet: "mechanism" | "hvco" | "headlines" | "adCopy" | "offerAngles" | "lpAngles";
  /** Which generators have a toggleFavorite surface — only show hearts on those */
  hasFavourite: boolean;
};

/** The post-reveal opt-in on the Unique Method node. Trail-level UI label, not part of the script. */
const WALKTHROUGH_CHIP = "Tell Zappy how I work";

const AUTO_STEPS: {
  step: AutoStepName;
  field: string;
  stopKey: string;
  revealLabel: string;
  /** true when an instruction-shaped tweak surface exists (C3 mapping table) */
  tweakable: boolean;
  /** C4: one of the 3 compliance-scored nodes (dial + real-score chip) */
  scored?: boolean;
  /** C4: milestone badge dropped after this node completes its grouping */
  milestone?: { name: string; line: string; insight: "fears" | "goals" | "pains" };
  /** Sprint 4 C1: dealable = show CardDeck in manual mode; null = auto-style reveal */
  dealable?: DealableConfig;
}[] = [
  { step: "offer",            field: "selectedOfferId",            stopKey: "offer",            revealLabel: "Offer",          tweakable: true,
    dealable: { fetchSet: "offerAngles", hasFavourite: false } },
  { step: "mechanism",        field: "selectedMechanismId",        stopKey: "uniqueMethod",     revealLabel: "Unique Method",  tweakable: true,
    dealable: { fetchSet: "mechanism", hasFavourite: true },
    milestone: { name: "FOUNDATION LOCKED", line: "The hard thinking is done. Everything from here builds on this.", insight: "fears" } },
  { step: "hvco",             field: "selectedHvcoId",             stopKey: "freeOptIn",        revealLabel: "Lead Magnet",    tweakable: true,
    dealable: { fetchSet: "hvco", hasFavourite: true } },
  { step: "headlines",        field: "selectedHeadlineId",         stopKey: "headlines",        revealLabel: "Headline",       tweakable: true, scored: true,
    dealable: { fetchSet: "headlines", hasFavourite: false } },
  { step: "adCopy",           field: "selectedAdCopyId",           stopKey: "adCopy",           revealLabel: "Ad Copy",        tweakable: true, scored: true,
    dealable: { fetchSet: "adCopy", hasFavourite: false },
    milestone: { name: "MAGNET READY", line: "You now attract attention on purpose.", insight: "goals" } },
  // landingPage: NOT scored — the landingPages table carries no
  // complianceScore column (verified against Drizzle + INFORMATION_SCHEMA
  // during C4). Showing a dial over a node with no real score to land
  // would violate the honesty rule. Page-level LP scoring is engine work
  // for a future slot; W5 per-section rewrites remain available in the Kit.
  { step: "landingPage",      field: "selectedLandingPageId",      stopKey: "landingPage",      revealLabel: "Landing Page",   tweakable: true,
    dealable: { fetchSet: "lpAngles", hasFavourite: false } },
  { step: "emailSequence",    field: "selectedEmailSequenceId",    stopKey: "emailSequence",    revealLabel: "Email Sequence", tweakable: true },
  { step: "whatsappSequence", field: "selectedWhatsAppSequenceId", stopKey: "whatsappSequence", revealLabel: "WhatsApp",       tweakable: true,
    milestone: { name: "CONVERSION ENGINE ON", line: "Clicks now have somewhere to become clients.", insight: "pains" } },
  // adCreatives' regenerate surface is image-shaped (headlineOverrideId), not
  // instruction-shaped — no Tweak chip in C3 (honest gap, flagged).
  { step: "adCreatives",      field: "selectedAdCreativeBatchId",  stopKey: "adCreatives",      revealLabel: "Ad Images",      tweakable: false },
];

// Dealable nodes deal an option deck (Manual mode) — used to show the
// "generating your options…" loading state only while an option deck is building.
const DEALABLE_STOP_KEYS = new Set(AUTO_STEPS.filter(s => s.dealable).map(s => s.stopKey));

// C4: scored-node mapping into the W5 complianceRewrites surface.
const REWRITE_SOURCE: Partial<Record<AutoStepName, { sourceTable: "headlines" | "adCopy"; sourceSubKey?: string }>> = {
  headlines: { sourceTable: "headlines" },
  adCopy: { sourceTable: "adCopy" },
};

// ── Sprint 3 C3: §12.2 narration (line1 / line2 / line3-tease) ──
// Narration + patience lines come from zappyWaitLines.ts (single source).
const LOVE_REACTIONS = ["Knew it.", "That's the one.", "Good eye.", "Locked. 🦊", "On we go."];

/** Polls /api/jobs/{jobId} until terminal. 5s cadence, 600s ceiling (adCreatives runs long). */
async function pollJob(jobId: string): Promise<{ status: string; result: Record<string, unknown> | null; error?: string }> {
  const start = Date.now();
  for (;;) {
    await new Promise(r => setTimeout(r, 5_000));
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Job poll failed (${res.status})`);
    const data = await res.json() as { status: string; result: Record<string, unknown> | null; error?: string };
    if (data.status === "complete" || data.status === "failed") return data;
    if (Date.now() - start > 600_000) throw new Error("Generation timed out");
  }
}

const parseMaybeJson = (v: unknown): Record<string, unknown> | null => {
  if (!v) return null;
  if (typeof v === "object") return v as Record<string, unknown>;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
  return null;
};

// §10.4 resume beat — built from real kit state, no history required.
function welcomeBackBubble(stops: TrailStop[]): ChatMessage {
  const doneCount = stops.filter(s => s.state === "done" || s.state === "imported" || s.state === "stale").length;
  const next = stops.find(s => s.state === "pending" || s.state === "generating");
  return {
    id: "trail-welcome-back",
    type: "zappy-bubble",
    mood: "idle",
    text: next
      ? `Welcome back. We're ${doneCount} of ${stops.length} — ${next.label} is up next.`
      : `Welcome back — all ${stops.length} pieces are done. This campaign is complete.`,
  };
}

export default function V2Trail() {
  const [, navigate] = useLocation();
  const params = useParams<{ campaignKitId: string }>();
  const campaignKitId = params.campaignKitId ? Number(params.campaignKitId) : null;
  const validId = campaignKitId != null && !isNaN(campaignKitId);

  const trailState = trpc.trail.getTrailState.useQuery(
    { campaignKitId: campaignKitId! },
    { enabled: validId },
  );
  const transcript = trpc.trail.getTranscript.useQuery(
    { campaignKitId: campaignKitId! },
    { enabled: validId },
  );
  const orchestrateStep = trpc.autoMode.orchestrateStep.useMutation();
  const appendMessages = trpc.trail.appendMessages.useMutation();
  // Sprint 4 C1: manual crown write (the proven wizard mutation)
  const updateSelection = trpc.campaignKits.updateSelection.useMutation();
  // Angle-picker persistence (P2 fix): the publisher reads landingPages.activeAngle and the offer cascade
  // reads offers.activeAngle — a picked angle MUST write these, or the chosen angle is lost (default ships).
  const updateLpAngle = trpc.landingPages.updateActiveAngle.useMutation();
  const updateOfferAngle = trpc.offers.updateActiveAngle.useMutation();
  // Phase 1 (Problem A): capture operator facts UPFRONT (before generation) → campaignKits.campaignFacts.
  const answerCampaignFact = trpc.campaignKits.answerCampaignFact.useMutation();
  // Sprint 4 C3: quota status for deal-more chips
  const quotaStatus = trpc.trail.getQuotaStatus.useQuery();
  // Sprint 4 C4: skip/import
  const skipNodeMutation = trpc.nodeSkips.skip.useMutation();
  // Sprint 4 C4: favourites — only mechanism + hvco have toggleFavorite
  const toggleMechanismFav = trpc.heroMechanisms.toggleFavorite.useMutation();
  const toggleHvcoFav = trpc.hvco.toggleFavorite.useMutation();
  const utils = trpc.useUtils();

  // Placeholder resolver map — same source the Kit page uses. Trail cards
  // resolve every fillable token to its value; humanizeUnresolvedTokens (applied
  // via cleanText below) turns any still-unfilled token into a human label so a
  // raw [INSERT_…] never leaks into a finished-looking card. Display-only —
  // stored rows keep the raw token; the Kit editor is where the real value is set.
  const tokenServiceId = trailState.data?.serviceId ?? undefined;
  const { data: placeholderEntries } = trpc.placeholders.list.useQuery(
    { serviceId: tokenServiceId! },
    { enabled: tokenServiceId != null },
  );
  const resolvedMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of placeholderEntries ?? []) m[e.token] = e.value;
    return m;
  }, [placeholderEntries]);
  const cleanText = (s: string): string => humanizeUnresolvedTokens(resolveTokensInText(s, resolvedMap));

  // C3 tweak surfaces (mapping table from the Sprint 3 pre-flight)
  const regenMechanism = trpc.heroMechanisms.regenerateSingle.useMutation();
  const regenHvco = trpc.hvco.regenerateSingle.useMutation();
  const regenHeadline = trpc.headlines.regenerateSingle.useMutation();
  const regenAdCopy = trpc.adCopy.regenerateSingle.useMutation();
  const regenOfferSection = trpc.offers.regenerateSection.useMutation();
  const regenLpSection = trpc.landingPages.regenerateSection.useMutation();
  const regenEmail = trpc.emailSequences.regenerateSingle.useMutation();
  const regenWhatsapp = trpc.whatsappSequences.regenerateSingle.useMutation();
  const markTweakStale = trpc.campaignKits.markTweakStale.useMutation();
  // C4: sub-100 "rewrite it safe" via the W5 compliance surface (quota-aware)
  const rewriteGenerateMore = trpc.complianceRewrites.generateMore.useMutation();
  const rewriteAccept = trpc.complianceRewrites.accept.useMutation();

  // Persisted messages, hydrated once from the transcript query.
  const [persisted, setPersisted] = useState<ChatMessage[] | null>(null);
  useEffect(() => {
    if (transcript.data !== undefined && persisted === null) {
      setPersisted((transcript.data?.messages as ChatMessage[] | undefined) ?? []);
    }
  }, [transcript.data, persisted]);

  // ── C3: fresh-handoff detection — welcome-back only on genuine resume ──
  const freshHandoff = useRef<boolean | null>(null);
  if (freshHandoff.current === null && validId) {
    try {
      const key = `zapTrailFreshHandoff:${campaignKitId}`;
      freshHandoff.current = sessionStorage.getItem(key) === "1";
      sessionStorage.removeItem(key);
    } catch { freshHandoff.current = false; }
  }

  // ── Land-on-node: read ?node=<stopKey>&action=swap from URL ──
  // Read once on mount, clear from URL so refresh doesn't re-trigger.
  // Used by Campaign Kit "Select Now" (generate empty node) and "Swap"
  // (NULL existing selection + regenerate). The driver loop uses the
  // existing skip-already-populated guard to fast-forward to the target.
  const landOnNode = useRef<{ stopKey: string; action: "swap" | "generate" } | null>(null);
  if (landOnNode.current === null && validId) {
    try {
      const url = new URL(window.location.href);
      const nodeParam = url.searchParams.get("node");
      const actionParam = url.searchParams.get("action");
      if (nodeParam && AUTO_STEPS.some(s => s.stopKey === nodeParam)) {
        landOnNode.current = { stopKey: nodeParam, action: actionParam === "swap" ? "swap" : "generate" };
        // Clear query params from URL without triggering navigation
        url.searchParams.delete("node");
        url.searchParams.delete("action");
        window.history.replaceState({}, "", url.pathname + url.hash);
      } else {
        landOnNode.current = { stopKey: "", action: "generate" }; // sentinel: no target
      }
    } catch { landOnNode.current = { stopKey: "", action: "generate" }; }
  }

  // ── Live driver messages (this session) + generating stop ──
  const [live, setLive] = useState<ChatMessage[]>([]);
  const liveRef = useRef<ChatMessage[]>([]);
  useEffect(() => { liveRef.current = live; }, [live]);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const liveCounter = useRef(0);
  const addLive = (m: Omit<ChatMessage, "id">): ChatMessage => {
    liveCounter.current += 1;
    const full = { ...m, id: `live-${Date.now()}-${liveCounter.current}` };
    setLive(prev => [...prev, full]);
    return full;
  };
  const removeLive = (id: string) => setLive(prev => prev.filter(m => m.id !== id));
  const persistMsgs = async (msgs: ChatMessage[]) => {
    try {
      type FlushMessages = Parameters<typeof appendMessages.mutateAsync>[0]["messages"];
      await appendMessages.mutateAsync({ campaignKitId: campaignKitId!, messages: msgs as unknown as FlushMessages });
    } catch { /* transcript is a nice-to-have */ }
  };

  const nodeRefMap = useRef(new Map<string, HTMLDivElement>());

  // ── Derive the 11 stop states from real kit data ──
  const stops: TrailStop[] = useMemo(() => {
    const kit = trailState.data?.kit as Record<string, unknown> | undefined;
    const statusMap = new Map(
      (trailState.data?.statuses ?? []).map(s => [s.nodeType, s.status]),
    );
    return STOP_DEFS.map(def => {
      let state: StopState = "pending";
      if (kit) {
        const override = statusMap.get(def.key);
        if (override === "needs_publish") {
          // A10: the LP was generated but publish failed → NOT complete (checked before the selected-id
          // fallthrough below, so a swallowed publish failure can't show a false "done" / 11-of-11).
          state = "pending";
        } else if (override === "imported" || override === "stale" || override === "dismissed") {
          state = override === "dismissed" ? "stale" : override; // dismissed shows as amber (stale) on trail bar
        } else if (def.key === "icp") {
          state = "done"; // a kit always has its ICP
        } else if (def.key === "service") {
          state = trailState.data?.serviceId != null ? "done" : "pending";
        } else if (def.field && kit[def.field] != null) {
          state = "done";
        }
      }
      if (def.key === generatingKey) state = "generating";
      return { key: def.key, label: def.label, state };
    });
  }, [trailState.data, generatingKey]);

  // ── C3: GenerationNarrator — templated cadence, all client timers ──
  // 0s line1 (persist-worthy, returned), 4s line2, 8s line3, then patience
  // at 14/22s, long-wait at 30s, patience every 12s after — nothing static
  // longer than ~4-8s while generating (§8). Lines 2+ are ephemeral.
  // Narration: 0s/4s/8s are step-specific lines, then the long-wait portion
  // uses node-aware patience lines from patienceGuard via getNodePatience.
  const startNarration = (step: AutoStepName): { line1: ChatMessage; stop: () => void } => {
    const early = getEarlyLines(step);
    const line1 = addLive({ type: "zappy-bubble", mood: "thinking", text: early[0] });
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, text: string) =>
      timers.push(setTimeout(() => addLive({ type: "zappy-bubble", mood: "thinking", text }), ms));
    // Early lines at 4s intervals (variable count: 2 or 3)
    const earlyGap = early.length >= 3 ? 4_000 : 6_000;
    for (let i = 1; i < early.length; i++) at(i * earlyGap, early[i]);
    // Long-wait: node-specific patience lines from zappyWaitLines
    for (const [ms, text] of getNodePatience(step)) {
      at(ms, text);
    }
    return { line1, stop: () => timers.forEach(clearTimeout) };
  };

  // ── Reveal builder — existing per-asset reads ──
  const buildRevealRaw = async (stepDef: (typeof AUTO_STEPS)[number], kit: Record<string, unknown>) => {
    const fallback = { eyebrow: stepDef.revealLabel.toUpperCase(), title: `${stepDef.revealLabel} ready`, preview: "Built — full detail in your Campaign Kit." };
    try {
      const idVal = kit[stepDef.field];
      if (idVal == null) return fallback;
      switch (stepDef.step) {
        case "offer": {
          const o = await utils.offers.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const angle = parseMaybeJson(o?.godfatherAngle ?? o?.freeAngle ?? o?.dollarAngle);
          return {
            eyebrow: "YOUR OFFER",
            title: String(angle?.offerName ?? o?.productName ?? "Your Offer"),
            preview: String(angle?.valueProposition ?? "") || "Full offer stack in your Kit.",
          };
        }
        case "mechanism": {
          const m = await utils.heroMechanisms.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          return {
            eyebrow: "YOUR METHOD",
            title: String(m?.mechanismName ?? "Your Method"),
            preview: String(m?.mechanismDescription ?? ""),
          };
        }
        case "hvco": {
          const h = await utils.hvco.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          return {
            eyebrow: "YOUR LEAD MAGNET",
            title: String(h?.title ?? "Your Lead Magnet"),
            preview: String(h?.hvcoTopic ?? "") || "The free thing that pulls people in.",
          };
        }
        case "headlines": {
          const h = await utils.headlines.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          return {
            eyebrow: "YOUR HEADLINE",
            title: String(h?.headline ?? "Your Headline"),
            preview: String(h?.subheadline ?? ""),
            score: typeof h?.complianceScore === "number" ? h.complianceScore : undefined,
          };
        }
        case "adCopy": {
          const a = await utils.adCopy.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const content = String(a?.content ?? "");
          return {
            eyebrow: "YOUR AD COPY",
            title: content.split("\n")[0] || "Your Ad",
            preview: content.split("\n").slice(1).join("\n"),
            score: typeof a?.complianceScore === "number" ? a.complianceScore : undefined,
          };
        }
        case "landingPage": {
          const lp = await utils.landingPages.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const angle = parseMaybeJson(lp?.originalAngle);
          return {
            eyebrow: "YOUR LANDING PAGE",
            title: String(angle?.mainHeadline ?? "Your Landing Page"),
            preview: [angle?.subheadline, angle?.primaryCta ? `CTA: ${angle.primaryCta}` : ""].filter(Boolean).join("\n") || "Published and ready — preview in your Kit.",
          };
        }
        case "emailSequence": {
          const e = await utils.emailSequences.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const emails = parseMaybeJson(e?.emails) as unknown;
          const list = Array.isArray(emails) ? emails : [];
          return {
            eyebrow: "YOUR EMAIL SEQUENCE",
            title: `${list.length || "Your"} emails, ready to send`,
            preview: list.map((em: Record<string, unknown>, i: number) => `Email ${i + 1}: "${String(em?.subject ?? "")}"`)
              .filter((s: string) => s.includes('"') && !s.includes('""'))
              .join("\n") || "Sequence in your Kit.",
          };
        }
        case "whatsappSequence": {
          const w = await utils.whatsappSequences.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const msgs = parseMaybeJson(w?.messages) as unknown;
          const list = Array.isArray(msgs) ? msgs : [];
          return {
            eyebrow: "YOUR WHATSAPP SEQUENCE",
            title: `${list.length || "Your"} messages queued`,
            preview: list.map((m: unknown, i: number) => {
              const text = typeof m === "string" ? m : String((m as Record<string, unknown>)?.message ?? (m as Record<string, unknown>)?.text ?? "");
              return `Message ${i + 1}: ${text.split("\n")[0]}`;
            }).join("\n") || "Sequence in your Kit.",
          };
        }
        case "adCreatives": {
          const batch = await utils.adCreatives.getBatch.fetch({ batchId: String(idVal) }) as unknown;
          const items = Array.isArray(batch) ? batch
            : Array.isArray((batch as Record<string, unknown>)?.creatives) ? (batch as Record<string, unknown>).creatives as unknown[]
            : [];
          const imageUrls = (items as Record<string, unknown>[])
            .map(c => String(c?.imageUrl ?? ""))
            .filter(u => u.startsWith("http"));
          return {
            eyebrow: "YOUR AD CREATIVES",
            title: `${imageUrls.length || 5} ad images, ready to use`,
            preview: imageUrls.length > 0 ? `__IMAGES__${imageUrls.join("|")}` : "Thumbnails in your Campaign Kit.",
          };
        }
      }
    } catch { /* fall through */ }
    return fallback;
  };

  // Reveal cards resolve/humanize tokens so no raw [INSERT_…] leaks (display-only).
  const buildReveal = async (stepDef: (typeof AUTO_STEPS)[number], kit: Record<string, unknown>) => {
    const r = await buildRevealRaw(stepDef, kit);
    return { ...r, title: cleanText(r.title), preview: cleanText(r.preview) };
  };

  // ── C3: Love it / Tweak chips with silence-proceeds (spec 5.1.4) ──
  // Chips live on the newest reveal only; when the next reveal arrives the
  // previous row quietly collapses (removed — the persisted card remains).
  const activeChips = useRef<{ msgId: string; step: AutoStepName } | null>(null);
  const lastReaction = useRef<number>(-1);
  const [tweakMode, setTweakMode] = useState<AutoStepName | null>(null);
  // Phase 1 (Problem A): when set, the wizard is asking an upfront campaign-fact question — the text input
  // + chip taps route to the fact-answer resolver instead of the tweak/deal handlers.
  const [factsMode, setFactsMode] = useState<{ token: string; inputType: "text" | "date" | "time" | "venue" | "price"; naBranches: { sentinel: string; label: string }[] } | null>(null);
  /**
   * The third input mode, beside factsMode and tweakMode — the "tell me how you actually work"
   * conversation on the Unique Method node. DELIBERATELY DISTINCT rather than folded into either:
   * factsMode answers an operator token and tweakMode carries a rewrite instruction, and a method
   * walkthrough answer is neither. Overloading one of them would make three unrelated meanings
   * share a handler and a placeholder.
   */
  const [walkthroughMode, setWalkthroughMode] = useState(false);
  const tweakQueue = useRef<{ step: AutoStepName; instruction: string }[]>([]);
  const driverBusy = useRef(false);

  // Whether this service already has a captured method — the offer is not made twice.
  const coachMethodQuery = trpc.methods.getMethod.useQuery(
    { serviceId: tokenServiceId! },
    { enabled: tokenServiceId != null },
  );
  const hasCoachMethod = !!coachMethodQuery.data;

  const collapsePreviousChips = () => {
    if (activeChips.current) {
      removeLive(activeChips.current.msgId);
      activeChips.current = null;
    }
  };

  const offerChips = (step: AutoStepName, tweakable: boolean) => {
    collapsePreviousChips();
    const chips = tweakable ? ["Love it ✓", "Tweak"] : ["Love it ✓"];
    if (step === "adCreatives") chips.push("Regenerate images");
    // POST-REVEAL, OPT-IN — mirrors the ICP sharpenWithLadder placement exactly: offered only once
    // the coach has SEEN a mechanism, so they are recognising rather than starting from nothing.
    // A coach who ignores it gets today's flow unchanged.
    if (step === "mechanism" && tokenServiceId != null && !hasCoachMethod) chips.push(WALKTHROUGH_CHIP);
    // Sprint 4 C3: path switch chip — only in auto mode (switch to manual)
    const kit = (trailState.data?.kit ?? {}) as Record<string, unknown>;
    if (kit.path === "auto") chips.push("Let me pick from here");
    const row = addLive({ type: "chip-row", nodeKey: step, chips });
    activeChips.current = { msgId: row.id, step };
  };

  // ── The method walkthrough — the HOOK, not the standalone component ──────────────────────────
  // V2MethodWalkthrough also ships a self-contained rendering with its own ChatThread (parity with
  // V2OperatorIntake). The trail deliberately uses the state machine instead and emits into ITS
  // thread, so the coach stays in one continuous conversation rather than being handed off to a
  // second one mid-trail. One machine, two renderings, no drift.
  const walkthroughEmit: WalkthroughEmit = {
    zappy: (text, mood) => { const m = addLive({ type: "zappy-bubble", mood, text }); void persistMsgs([m]); },
    user: (text) => { const m = addLive({ type: "user-bubble", text }); void persistMsgs([m]); },
    chips: (chips) => {
      collapsePreviousChips();
      const row = addLive({ type: "chip-row", nodeKey: "mechanism", chips });
      activeChips.current = { msgId: row.id, step: "mechanism" };
    },
    divider: (text) => { const m = addLive({ type: "system-divider", text }); void persistMsgs([m]); },
  };

  const walkthrough = useMethodWalkthrough({
    serviceId: tokenServiceId ?? 0,
    emit: walkthroughEmit,
    onSaved: async () => {
      setWalkthroughMode(false);
      await coachMethodQuery.refetch();
      // The method is now on file at tier coach_stated, so a plain re-run of the mechanism step
      // picks it up — the generator resolves the stored row before it reaches any fallback.
      //
      // Deliberately a SINGLE attempt with a plain failure line, not the full retry ladder the
      // autorun uses: the coach is sitting here watching, and if it fizzles the existing "Tweak"
      // chip is one tap away. Duplicating the ladder to save that tap would be the third copy of
      // it in this file.
      const kit = (trailState.data?.kit ?? {}) as Record<string, unknown>;
      const kitId = kit.id as number | undefined;
      const icpId = kit.icpId as number | undefined;
      if (!kitId || !icpId || tokenServiceId == null) return;
      try {
        await updateSelection.mutateAsync({ kitId, selectedMechanismId: null } as any);
      } catch { /* non-fatal — the step would skip, which is safe */ }
      setGeneratingKey("uniqueMethod");
      try {
        const { jobId } = await orchestrateStep.mutateAsync({
          serviceId: tokenServiceId,
          icpId,
          step: "mechanism",
          campaignType: (kit.campaignType ?? undefined) as never,
        });
        const job = await pollJob(jobId);
        if (job.status === "failed") throw new Error(job.error || "Generation failed");
        await trailState.refetch();
        walkthroughEmit.zappy("Here's your method, rebuilt from what you told me.", "celebrating");
      } catch (e) {
        walkthroughEmit.zappy(
          `Your method is saved, but the rebuild didn't take (${e instanceof Error ? e.message : "please try again"}). Tap Tweak whenever you want another run.`,
          "idle",
        );
      } finally {
        setGeneratingKey(null);
      }
    },
    onEnded: () => setWalkthroughMode(false),
  });

  const pickReaction = () => {
    let i = Math.floor(Math.random() * LOVE_REACTIONS.length);
    if (i === lastReaction.current) i = (i + 1) % LOVE_REACTIONS.length;
    lastReaction.current = i;
    return LOVE_REACTIONS[i];
  };

  // ── C4: sub-100 "rewrite it safe" via W5 generateMore → accept best ──
  const rewriteSafe = async (step: AutoStepName) => {
    const stepDef = AUTO_STEPS.find(s => s.step === step)!;
    const src = REWRITE_SOURCE[step];
    if (!src) return;
    const working = addLive({ type: "zappy-bubble", mood: "thinking", text: "Rewriting it safe — same punch, none of the flags…" });
    try {
      const kit = (await trailState.refetch()).data?.kit as Record<string, unknown>;
      const sourceId = kit[stepDef.field] as number;
      const rows = await rewriteGenerateMore.mutateAsync({ ...src, sourceId, count: 1 }) as { id: number; complianceScore: number }[];
      if (!rows?.length) throw new Error("No compliant rewrite came back");
      const best = [...rows].sort((a, b) => b.complianceScore - a.complianceScore)[0];
      await rewriteAccept.mutateAsync({ rewriteId: best.id });
      const refreshed = await trailState.refetch();
      const reveal = await buildReveal(stepDef, (refreshed.data?.kit ?? {}) as Record<string, unknown>);
      const safeReveal = getRevealLine(step);
      if (safeReveal) addLive({ type: "zappy-bubble", mood: "celebrating", text: safeReveal });
      const divider = addLive({ type: "system-divider", nodeKey: stepDef.stopKey, text: `${stepDef.revealLabel} rewritten safe` });
      const card = addLive({ type: "asset-reveal-card", nodeKey: stepDef.stopKey, reveal });
      offerChips(step, stepDef.tweakable);
      await persistMsgs([divider, card]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "rewrite failed";
      addLive({ type: "zappy-bubble", mood: "idle", text: `Couldn't get a safe rewrite through (${msg}). Your wording stays — you can revisit it in the Kit.` });
      offerChips(step, AUTO_STEPS.find(s => s.step === step)!.tweakable);
    }
  };

  /** Distinct from handleFactText and handleTweakInstruction — a method answer is neither. */
  const handleWalkthroughText = async (text: string) => {
    await walkthrough.submitText(text);
  };

  const handleChipTap = async (messageId: string, chip: string) => {
    // The walkthrough owns its chips while it is running — a tap is confirm/correct/skip, and the
    // hook interprets it against the labels the SERVER supplied rather than against literals here.
    if (walkthroughMode) {
      removeLive(messageId);
      if (activeChips.current?.msgId === messageId) activeChips.current = null;
      await walkthrough.submitChip(chip);
      return;
    }
    if (chip === WALKTHROUGH_CHIP) {
      removeLive(messageId);
      if (activeChips.current?.msgId === messageId) activeChips.current = null;
      const echo = addLive({ type: "user-bubble", text: chip });
      void persistMsgs([echo]);
      setWalkthroughMode(true);
      await walkthrough.start();
      return;
    }
    // Phase 1 (Problem A): while asking an upfront fact, a chip is an N/A answer ("It's free" → __FREE__)
    // or "Skip" → route it to the fact-answer resolver, not the deal/tweak handlers.
    if (factsMode) {
      removeLive(messageId);
      if (activeChips.current?.msgId === messageId) activeChips.current = null;
      const echo = addLive({ type: "user-bubble", text: chip });
      persistMsgs([echo]);
      const branch = factsMode.naBranches.find(b => b.label === chip);
      const answer = chip === "Skip" ? "__SKIP__" : branch ? branch.sentinel : chip;
      factAnswerResolve.current?.(answer);
      factAnswerResolve.current = null;
      return;
    }
    const target = activeChips.current?.msgId === messageId ? activeChips.current.step : null;
    removeLive(messageId);
    if (activeChips.current?.msgId === messageId) activeChips.current = null;

    // C4: completion chips (not tied to a node)
    if (chip === "Open my Campaign Kit") {
      navigate(`/v2-dashboard/campaign-kit/${campaignKitId}`);
      return;
    }
    if (chip === "Review piece by piece") {
      const first = nodeRefMap.current.get("offer") ?? nodeRefMap.current.get("icp");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Sprint 2: completion callout — open the Dream Buyer Profile via the existing ICP panel toggle.
    if (chip === "Meet your Dream Buyer") {
      setIcpPanelOpen(true);
      return;
    }
    if (!target) return;

    // Sprint 4 C1+C3: manual-mode chips that resolve the crown/deal wait
    if (chip === "Show me options" || chip === "Lock it in →" || chip.startsWith("Show me new options") || chip === "Skip — I already have this" || chip === "Try again") {
      const echo = addLive({ type: "user-bubble", text: chip });
      persistMsgs([echo]);
      dealMoreChipChoice.current = chip.startsWith("Show me new options") ? "deal"
        : chip === "Skip — I already have this" ? "skip"
        : chip === "Try again" ? "lock" : "lock"; // "Try again" resolves the same promise
      if (manualResolve.current) { manualResolve.current(); manualResolve.current = null; }
      return;
    }
    // B2 fix: swap-coherence chips ("Just change the offer", "Change everything to match")
    // Both resolve the manual-proceed promise; the driver distinguishes via user-bubble text.
    if (chip.startsWith("Just change the") || chip === "Change everything to match") {
      const echo = addLive({ type: "user-bubble", text: chip });
      persistMsgs([echo]);
      dealMoreChipChoice.current = "lock";
      if (manualResolve.current) { manualResolve.current(); manualResolve.current = null; }
      return;
    }
    // Sprint 4 C3: mid-campaign path switching
    if (chip === "Let me pick from here" || chip === "Let Zappy take over") {
      const newPath = chip === "Let Zappy take over" ? "auto" : "manual";
      const echo = addLive({ type: "user-bubble", text: chip });
      const ack = addLive({ type: "zappy-bubble", mood: newPath === "auto" ? "celebrating" : "idle",
        text: newPath === "auto" ? "Taking over — I'll handle the rest." : "Your turn — I'll deal options for each piece from here." });
      persistMsgs([echo, ack]);
      const kit = (trailState.data?.kit ?? {}) as Record<string, unknown>;
      const kitId = kit.id as number | undefined;
      if (kitId) {
        try { await updateSelection.mutateAsync({ kitId, path: newPath } as any); } catch { /* non-fatal */ }
        trailState.refetch();
      }
      return;
    }
    if (chip === "Love it ✓") {
      const echo = addLive({ type: "user-bubble", text: "Love it ✓" });
      const reaction = addLive({ type: "zappy-bubble", mood: "celebrating", text: pickReaction() });
      persistMsgs([echo, reaction]);
    } else if (chip === "Tweak") {
      const echo = addLive({ type: "user-bubble", text: "Tweak" });
      const ask = addLive({ type: "zappy-bubble", mood: "idle", text: "What should change? Tell me straight." });
      persistMsgs([echo, ask]);
      setTweakMode(target);
    } else if (chip === "Rewrite it safe") {
      const echo = addLive({ type: "user-bubble", text: "Rewrite it safe" });
      persistMsgs([echo]);
      rewriteSafe(target);
    } else if (chip === "Keep your wording") {
      const echo = addLive({ type: "user-bubble", text: "Keep your wording" });
      const ack = addLive({ type: "zappy-bubble", mood: "idle", text: "Your call — keeping it as written." });
      persistMsgs([echo, ack]);
      offerChips(target, AUTO_STEPS.find(s => s.step === target)!.tweakable);
    } else if (chip === "Rebuild to match") {
      const echo = addLive({ type: "user-bubble", text: "Rebuild to match" });
      persistMsgs([echo]);
      runUpdateTheRest();
    } else if (chip === "Leave them — they still work") {
      const echo = addLive({ type: "user-bubble", text: "Leave them — they still work" });
      const ack = addLive({ type: "zappy-bubble", mood: "idle", text: "No problem — everything still works. You can always rebuild later if you change your mind." });
      persistMsgs([echo, ack]);
      // Flip stale→dismissed so return-visit chips don't re-nag.
      // Amber persists (trail bar reads stale OR dismissed). Re-tweak resets to stale.
      const kitId = (trailState.data?.kit as Record<string, unknown> | undefined)?.id as number | undefined;
      if (kitId) {
        try { await dismissStaleMutation.mutateAsync({ campaignKitId: kitId }); } catch { /* non-fatal */ }
        trailState.refetch();
      }
    } else if (chip === "Regenerate images") {
      const echo = addLive({ type: "user-bubble", text: "Regenerate images" });
      persistMsgs([echo]);
      regenerateImages();
    }
  };

  // ── Part B: standalone ad-image regeneration (no upstream change) ──
  const regenerateImages = async () => {
    if (generatingKey) return; // guard: prevent double-invocation on fast double-tap
    resetBuild(); // fresh rotation for regen
    const state = trailState.data!;
    const serviceId = state.serviceId!;
    const kit0 = state.kit as Record<string, unknown>;
    const kitId = kit0.id as number;
    const icpId = kit0.icpId as number;
    const kitCampaignType = (kit0.campaignType ?? undefined) as
      | "webinar" | "challenge" | "course_launch" | "product_launch"
      | "discovery_call" | "lead_magnet" | "in_person_event" | undefined;
    const stepDef = AUTO_STEPS.find(s => s.step === "adCreatives")!;
    // Null the old batch so the skip-already-populated guard passes
    try {
      await updateSelection.mutateAsync({ kitId, selectedAdCreativeBatchId: null } as any);
    } catch { /* non-fatal */ }
    setGeneratingKey("adCreatives");
    const narration = startNarration("adCreatives");
    let ok = false;
    let lastError = "";
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      try {
        const { jobId } = await orchestrateStep.mutateAsync({
          serviceId, icpId, step: "adCreatives", campaignType: kitCampaignType,
        });
        const job = await pollJob(jobId);
        if (job.status === "failed") throw new Error(job.error || "Generation failed");
        if (job.result?.skipped) throw new Error("Step was skipped — field not cleared");
        ok = true;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt === 1)
          addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
      }
    }
    narration.stop();
    while (!ok) {
      setGeneratingKey(null);
      addLive({ type: "zappy-bubble", mood: "idle", text: `Still stuck on images (${lastError}). Want to try again?` });
      collapsePreviousChips();
      const retryChipImg = addLive({ type: "chip-row", nodeKey: "adCreatives", chips: ["Try again"] });
      activeChips.current = { msgId: retryChipImg.id, step: "adCreatives" };
      dealMoreChipChoice.current = null;
      await waitForManualProceed();
      if (cancelled.current) return;
      try { await updateSelection.mutateAsync({ kitId, selectedAdCreativeBatchId: null } as any); } catch { /* non-fatal */ }
      setGeneratingKey("adCreatives");
      const retryNarImg = startNarration("adCreatives");
      for (let ra = 1; ra <= 2 && !ok; ra++) {
        try {
          const { jobId: rjid } = await orchestrateStep.mutateAsync({ serviceId, icpId, step: "adCreatives", campaignType: kitCampaignType });
          const rj = await pollJob(rjid);
          if (rj.status === "failed") throw new Error(rj.error || "Generation failed");
          if (rj.result?.skipped) throw new Error("Step was skipped — field not cleared");
          ok = true;
        } catch (re) {
          lastError = re instanceof Error ? re.message : String(re);
          if (ra === 1) addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
        }
      }
      retryNarImg.stop();
    }
    const refreshed = await trailState.refetch();
    const kit = (refreshed.data?.kit ?? {}) as Record<string, unknown>;
    const reveal = await buildReveal(stepDef, kit);
    const revealLine = getRevealLine("adCreatives");
    if (revealLine) addLive({ type: "zappy-bubble", mood: "celebrating", text: revealLine });
    const divider = addLive({ type: "system-divider", nodeKey: "adCreatives", text: "Ad Images refreshed" });
    const card = addLive({ type: "asset-reveal-card", nodeKey: "adCreatives", reveal });
    setGeneratingKey(null);
    offerChips("adCreatives", false);
    await persistMsgs([divider, card]);
  };

  // Sprint 4 C1+C2: crown a card in the manual-mode deck + stale detection.
  const clearStaleMutation = trpc.trail.clearStale.useMutation();
  const dismissStaleMutation = trpc.trail.dismissStale.useMutation();

  // ── Sprint 4 C2: "Update the rest" — regenerate stale nodes with warning ──
  const runUpdateTheRest = async () => {
    resetBuild(); // fresh patience-line pool for stale-node refresh
    const state = trailState.data!;
    const serviceId = state.serviceId!;
    const kit0 = state.kit as Record<string, unknown>;
    const icpId = kit0.icpId as number;
    const kitId = kit0.id as number;
    const kitCampaignType = (kit0.campaignType ?? undefined) as
      | "webinar" | "challenge" | "course_launch" | "product_launch"
      | "discovery_call" | "lead_magnet" | "in_person_event" | undefined;
    const staleSteps = AUTO_STEPS.filter(s => {
      const st = (trailState.data?.statuses ?? []).find(x => x.nodeType === s.stopKey);
      return st?.status === "stale";
    });
    for (const stepDef of staleSteps) {
      if (cancelled.current) return;
      // NULL the old selection so the skip-already-populated guard lets the
      // step re-run (it checks selected*Id != null before generation).
      try {
        await updateSelection.mutateAsync({ kitId, [stepDef.field]: null } as any);
      } catch { /* non-fatal — the step will skip, which is safe */ }
      setGeneratingKey(stepDef.stopKey);
      const narration = startNarration(stepDef.step);
      let ok = false;
      let lastError = "";
      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        try {
          const { jobId } = await orchestrateStep.mutateAsync({
            serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType,
          });
          const job = await pollJob(jobId);
          if (job.status === "failed") throw new Error(job.error || "Generation failed");
          if (job.result?.skipped) throw new Error("Step was skipped — field not cleared");
          ok = true;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt === 1 && !cancelled.current)
            addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
        }
      }
      narration.stop();
      while (!ok) {
        setGeneratingKey(null);
        addLive({ type: "zappy-bubble", mood: "idle", text: `Still stuck on ${stepDef.revealLabel} (${lastError}). Want to try again?` });
        collapsePreviousChips();
        const retryChipS = addLive({ type: "chip-row", nodeKey: stepDef.step, chips: ["Try again"] });
        activeChips.current = { msgId: retryChipS.id, step: stepDef.step };
        dealMoreChipChoice.current = null;
        await waitForManualProceed();
        if (cancelled.current) return;
        try { await updateSelection.mutateAsync({ kitId, [stepDef.field]: null } as any); } catch { /* non-fatal */ }
        setGeneratingKey(stepDef.stopKey);
        const retryNarS = startNarration(stepDef.step);
        for (let ra = 1; ra <= 2 && !ok; ra++) {
          try {
            const { jobId: rjid } = await orchestrateStep.mutateAsync({ serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType });
            const rj = await pollJob(rjid);
            if (rj.status === "failed") throw new Error(rj.error || "Generation failed");
            if (rj.result?.skipped) throw new Error("Step was skipped — field not cleared");
            ok = true;
          } catch (re) {
            lastError = re instanceof Error ? re.message : String(re);
            if (ra === 1 && !cancelled.current) addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
          }
        }
        retryNarS.stop();
        if (cancelled.current) return;
      }
      // Clear stale + refresh
      try { await clearStaleMutation.mutateAsync({ campaignKitId: kitId, nodeType: stepDef.stopKey }); } catch { /* non-fatal */ }
      const refreshed = await trailState.refetch();
      const kit = (refreshed.data?.kit ?? {}) as Record<string, unknown>;
      const reveal = await buildReveal(stepDef, kit);
      const rl = getRevealLine(stepDef.step);
      if (rl) addLive({ type: "zappy-bubble", mood: "celebrating", text: rl });
      const divider = addLive({ type: "system-divider", nodeKey: stepDef.stopKey, text: `${stepDef.revealLabel} refreshed` });
      const card = addLive({ type: "asset-reveal-card", nodeKey: stepDef.stopKey, reveal });
      setGeneratingKey(null);
      await persistMsgs([divider, card]);
    }
    addLive({ type: "zappy-bubble", mood: "celebrating", text: "All refreshed — everything downstream matches your new pick." });
  };

  const handleDeckSelect = async (messageId: string, cardId: number) => {
    // Sprint 4 C4: search merged array so RESTORED decks (from persisted
    // transcript) are interactive, not just live-session decks.
    const allMsgs = [...(persisted ?? []), ...liveRef.current];
    const deckMsg = allMsgs.find(m => m.id === messageId);
    const nodeKey = deckMsg?.nodeKey;
    const stepDef = nodeKey ? AUTO_STEPS.find(s => s.stopKey === nodeKey) : null;
    if (!stepDef) return;

    const kit = (trailState.data?.kit ?? {}) as Record<string, unknown>;
    const kitId = kit.id as number | undefined;
    if (!kitId) return;

    const oldValue = kit[stepDef.field];

    // ── Angle-picker nodes (offer / landing page) ── the "cards" are ANGLES of ONE row, not separate
    // rows. Persist the ROW id to the selected*Id field AND the chosen ANGLE (the publisher reads
    // landingPages.activeAngle; the offer cascade reads offers.activeAngle). The generic path below would
    // write the synthetic card id and lose the angle — the selectedLandingPageAngle=NULL data-loss bug.
    const pickedCard = deckMsg?.deck?.cards?.find(c => c.id === cardId);
    const angleKey = pickedCard?.angleKey;
    if (angleKey && (nodeKey === "offer" || nodeKey === "landingPage")) {
      const rowId = Math.floor(cardId / 100); // id was rowId*100+i
      try {
        if (nodeKey === "landingPage") {
          await updateLpAngle.mutateAsync({ id: rowId, activeAngle: angleKey as "original" | "godfather" | "free" | "dollar" });
          await updateSelection.mutateAsync({ kitId, selectedLandingPageId: rowId, selectedLandingPageAngle: angleKey } as any);
        } else {
          await updateOfferAngle.mutateAsync({ id: rowId, activeAngle: angleKey as "godfather" | "free" | "dollar" });
          await updateSelection.mutateAsync({ kitId, selectedOfferId: rowId } as any);
        }
      } catch (err) {
        console.warn("[handleDeckSelect] angle persist failed:", err);
        return;
      }
      const markPick = (m: ChatMessage): ChatMessage =>
        m.id === messageId && m.deck
          ? { ...m, deck: { cards: m.deck.cards.map(c => ({ ...c, selected: c.id === cardId })) } }
          : m;
      setLive(prev => prev.map(markPick));
      setPersisted(prev => prev ? prev.map(markPick) : prev);
      return;
    }

    // Write the crown
    try {
      await updateSelection.mutateAsync({ kitId, [stepDef.field]: cardId } as any);
    } catch (err) {
      console.warn("[handleDeckSelect] crown write failed:", err);
      return;
    }

    // Visually mark the crowned card — works in both live AND persisted
    const markCrown = (m: ChatMessage): ChatMessage =>
      m.id === messageId && m.deck
        ? { ...m, deck: { cards: m.deck.cards.map(c => ({ ...c, selected: c.id === cardId })) } }
        : m;
    setLive(prev => prev.map(markCrown));
    setPersisted(prev => prev ? prev.map(markCrown) : prev);

    // ── Sprint 4 C2: detect re-crown → stale propagation ──
    // Server has already written stale rows via updateSelection. Refetch
    // trail state to get the fresh statuses, then post the warning.
    if (oldValue != null && oldValue !== cardId) {
      const refreshed = await trailState.refetch();
      const staleCount = (refreshed.data?.statuses ?? []).filter(s => s.status === "stale").length;
      if (staleCount > 0) {
        collapsePreviousChips();
        const warn = addLive({
          type: "zappy-bubble",
          mood: "idle",
          text: `New pick! ${staleCount} piece${staleCount > 1 ? "s" : ""} I built from the old one ${staleCount > 1 ? "are" : "is"} still on the old version — want me to rebuild ${staleCount > 1 ? "them" : "it"} to match?`,
        });
        const confirmWarn = addLive({
          type: "zappy-bubble",
          mood: "idle",
          text: `Rebuild ${staleCount} piece${staleCount > 1 ? "s" : ""}? They'll be freshly generated to match your changes. Any edits you made by hand will be replaced.`,
        });
        const row = addLive({ type: "chip-row", chips: ["Rebuild to match", "Leave them — they still work"] });
        activeChips.current = { msgId: row.id, step: stepDef.step };
        persistMsgs([warn, confirmWarn]);
      }
    }
  };

  // Sprint 4 C4: toggle favourite on a card (mechanism/hvco only).
  const handleDeckHeart = async (messageId: string, cardId: number) => {
    const allMsgs = [...(persisted ?? []), ...liveRef.current];
    const deckMsg = allMsgs.find(m => m.id === messageId);
    const nodeKey = deckMsg?.nodeKey;
    const stepDef = nodeKey ? AUTO_STEPS.find(s => s.stopKey === nodeKey) : null;
    if (!stepDef?.dealable?.hasFavourite) return;
    try {
      // Find the current favourited state from the card
      const card = deckMsg?.deck?.cards?.find(c => c.id === cardId);
      const newFav = !(card?.favourited);
      if (stepDef.step === "mechanism") {
        await toggleMechanismFav.mutateAsync({ mechanismId: cardId, isFavorite: newFav });
      } else if (stepDef.step === "hvco") {
        await toggleHvcoFav.mutateAsync({ titleId: cardId, isFavorite: newFav });
      }
    } catch { /* non-fatal */ }
    // Visually toggle the heart in the card
    const toggleHeart = (m: ChatMessage): ChatMessage =>
      m.id === messageId && m.deck
        ? { ...m, deck: { cards: m.deck.cards.map(c => c.id === cardId ? { ...c, favourited: !c.favourited } : c) } }
        : m;
    setLive(prev => prev.map(toggleHeart));
    setPersisted(prev => prev ? prev.map(toggleHeart) : prev);
  };

  // The tweak mapping table (Sprint 3 pre-flight item 3).
  const executeTweak = async (step: AutoStepName, instruction: string) => {
    const kit = (await trailState.refetch()).data?.kit as Record<string, unknown>;
    const stepDef = AUTO_STEPS.find(s => s.step === step)!;
    const id = kit[stepDef.field] as number;
    switch (step) {
      case "offer":
        // Section-shaped: apply the instruction to the offer's core sections.
        await regenOfferSection.mutateAsync({ id, angle: "godfather", sectionKey: "offerName", promptOverride: instruction });
        await regenOfferSection.mutateAsync({ id, angle: "godfather", sectionKey: "valueProposition", promptOverride: instruction });
        break;
      case "mechanism":
        await regenMechanism.mutateAsync({ id, promptOverride: instruction });
        break;
      case "hvco":
        await regenHvco.mutateAsync({ id, promptOverride: instruction });
        break;
      case "headlines":
        await regenHeadline.mutateAsync({ id, promptOverride: instruction });
        break;
      case "adCopy":
        await regenAdCopy.mutateAsync({ id, promptOverride: instruction });
        break;
      case "landingPage":
        await regenLpSection.mutateAsync({ landingPageId: id, angle: "original", sectionKey: "mainHeadline", userPrompt: instruction });
        break;
      case "emailSequence":
        await regenEmail.mutateAsync({ id, index: 0, promptOverride: instruction });
        break;
      case "whatsappSequence":
        await regenWhatsapp.mutateAsync({ id, index: 0, promptOverride: instruction });
        break;
      case "adCreatives":
        break; // not tweakable in C3
    }
  };

  const TWEAK_CATCHUP_LINES = [
    (node: string, n: number) =>
      `Nice tweak. Since your ${node} changed, the ${n} piece${n > 1 ? "s" : ""} I built using it ${n > 1 ? "are" : "is"} still on the old version — want me to rebuild ${n > 1 ? "them" : "it"} to match, or leave ${n > 1 ? "them" : "it"} as ${n > 1 ? "they are" : "it is"}?`,
    (node: string, n: number) =>
      `Updated your ${node}. The ${n} piece${n > 1 ? "s" : ""} I built from it ${n > 1 ? "are" : "is"} still on the old version — want me to rebuild ${n > 1 ? "them" : "it"} to match, or leave ${n > 1 ? "them" : "it"} as ${n > 1 ? "they are" : "it is"}?`,
  ];
  const TWEAK_CATCHUP_SINGLE = (node: string, downstream: string) =>
    `Done. Your ${node} changed, so your ${downstream} ${downstream === "Ad Images" ? "were" : "was"} built on the old version — want me to rebuild ${downstream === "Ad Images" ? "them" : "it"} to match, or leave ${downstream === "Ad Images" ? "them" : "it"} as ${downstream === "Ad Images" ? "they are" : "it is"}?`;

  const processTweakQueue = async () => {
    resetBuild(); // fresh patience-line pool for reworked nodes
    while (tweakQueue.current.length > 0) {
      const { step, instruction } = tweakQueue.current.shift()!;
      const stepDef = AUTO_STEPS.find(s => s.step === step)!;
      const working = startNarration(step);
      // Replace the opener with a tweak-specific line (keep cadence timers).
      removeLive(working.line1.id);
      const opener = addLive({ type: "zappy-bubble", mood: "thinking", text: `On it — reworking your ${stepDef.revealLabel.toLowerCase()}…` });
      try {
        await executeTweak(step, instruction);
        working.stop();
        const refreshed = await trailState.refetch();
        const kit = (refreshed.data?.kit ?? {}) as Record<string, unknown>;
        const reveal = await buildReveal(stepDef, kit);
        const tweakReveal = getRevealLine(step);
        if (tweakReveal) addLive({ type: "zappy-bubble", mood: "celebrating", text: tweakReveal });
        const divider = addLive({ type: "system-divider", nodeKey: stepDef.stopKey, text: `${stepDef.revealLabel} updated` });
        const card = addLive({ type: "asset-reveal-card", nodeKey: stepDef.stopKey, reveal });

        // ── Tweak-stale propagation: mark downstream nodes stale ──
        const kitId = kit.id as number | undefined;
        if (kitId) {
          try {
            const { staleCount } = await markTweakStale.mutateAsync({ kitId, tweakedNode: stepDef.stopKey });
            if (staleCount > 0) {
              await trailState.refetch();
              collapsePreviousChips();
              const nodeName = stepDef.revealLabel.toLowerCase();
              // Find the single stale downstream node's name for singular framing
              const staleStatuses = (trailState.data?.statuses ?? []).filter(s => s.status === "stale");
              const singleStaleLabel = staleCount === 1 && staleStatuses[0]
                ? (AUTO_STEPS.find(s => s.stopKey === staleStatuses[0].nodeType)?.revealLabel ?? "piece")
                : "piece";
              const catchupText = staleCount === 1
                ? TWEAK_CATCHUP_SINGLE(nodeName, singleStaleLabel)
                : TWEAK_CATCHUP_LINES[Math.floor(Math.random() * TWEAK_CATCHUP_LINES.length)](nodeName, staleCount);
              const warn = addLive({ type: "zappy-bubble", mood: "idle", text: catchupText });
              const confirmLabel = staleCount === 1 ? singleStaleLabel : `${staleCount} pieces`;
              const confirmWarn = addLive({
                type: "zappy-bubble",
                mood: "idle",
                text: `Rebuild ${confirmLabel}? They'll be freshly generated to match your changes. Any edits you made to ${staleCount > 1 ? "those pieces" : "it"} by hand will be replaced.`,
              });
              const row = addLive({ type: "chip-row", chips: ["Rebuild to match", "Leave them — they still work"] });
              activeChips.current = { msgId: row.id, step: stepDef.step };
              persistMsgs([divider, card, warn, confirmWarn]);
            } else {
              offerChips(step, stepDef.tweakable);
              await persistMsgs([divider, card]);
            }
          } catch {
            // Non-fatal: stale propagation failed, still show the tweak result
            offerChips(step, stepDef.tweakable);
            await persistMsgs([divider, card]);
          }
        } else {
          offerChips(step, stepDef.tweakable);
          await persistMsgs([divider, card]);
        }
      } catch (err) {
        working.stop();
        const msg = err instanceof Error ? err.message : "rewrite failed";
        addLive({ type: "zappy-bubble", mood: "idle", text: `Hm — that rework fizzled (${msg}). Tap Tweak on the card to try again.` });
      }
    }
  };

  // Phase 1 (Problem A): a typed answer to an upfront fact question (a date/venue/price value) → resolver.
  const handleFactText = (text: string) => {
    const echo = addLive({ type: "user-bubble", text });
    persistMsgs([echo]);
    factAnswerResolve.current?.(text.trim());
    factAnswerResolve.current = null;
  };

  // Batch A / item 3: a structured-input control (date/time picker, venue chip-or-place, price chip-or-number)
  // resolved. `value` is the canonical answer (ISO date / HH:MM / sentinel / number); the server normalizes it.
  const handleFactStructured = (_msgId: string, _token: string, value: string, echo: string) => {
    const bubble = addLive({ type: "user-bubble", text: echo });
    persistMsgs([bubble]);
    factAnswerResolve.current?.(value);
    factAnswerResolve.current = null;
  };

  const handleTweakInstruction = async (text: string) => {
    const step = tweakMode;
    if (!step) return;
    setTweakMode(null);
    const echo = addLive({ type: "user-bubble", text });
    persistMsgs([echo]);
    tweakQueue.current.push({ step, instruction: text });
    if (driverBusy.current) {
      addLive({ type: "zappy-bubble", mood: "idle", text: "Got it — I'll rework that the moment I finish this piece." });
    } else {
      await processTweakQueue();
    }
  };

  // ── The auto-loop driver ──
  const driverStarted = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const runAutoLoop = async () => {
    resetBuild(); // fresh rotation for this cascade run
    const state = trailState.data!;
    const serviceId = state.serviceId!;
    const kit0 = state.kit as Record<string, unknown>;
    const icpId = kit0.icpId as number;
    const kitCampaignType = (kit0.campaignType ?? undefined) as
      | "webinar" | "challenge" | "course_launch" | "product_launch"
      | "discovery_call" | "lead_magnet" | "in_person_event" | undefined;
    let kit = kit0;

    // Sprint 5 C2: bridge line for has-assets kits — shows once at the
    // start of the first gap-fill run. Suppressed on fresh handoff (the
    // intake already posted it before navigating here) AND on genuine
    // resume if the persisted transcript already contains the bridge line.
    if (kit0.path === "has_assets" && !freshHandoff.current) {
      const bridgeAlreadyInTranscript = (persisted ?? []).some(
        m => m.type === "zappy-bubble" && /already \d+ of 11 done/.test(m.text ?? "")
      );
      if (!bridgeAlreadyInTranscript) {
        const doneCount = AUTO_STEPS.filter(s => kit0[s.field] != null).length + 2; // +service+icp
        const gapCount = 11 - doneCount;
        if (gapCount > 0) {
          addLive({ type: "zappy-bubble", mood: "idle",
            text: `You're already ${doneCount} of 11 done. I'll build the missing ${gapCount} so they match what you have.`,
          });
        }
      }
    }

    // ── Testimonial prompt: offer before the cascade if no testimonials exist ──
    // Only on the first run (not resume with partially-generated nodes).
    // B8: skip on swap — the testimonial prompt is for fresh campaigns, not regen.
    const isSwapRegen = landOnNode.current?.action === "swap";
    const firstPending = AUTO_STEPS.find(s => kit[s.field] == null);
    if (firstPending?.step === "offer" && serviceId && !isSwapRegen) {
      // Check if service already has testimonials
      try {
        const svcCheck = await utils.services.get.fetch({ id: serviceId }) as Record<string, unknown> | null;
        const hasTestimonials = svcCheck?.testimonial1Name || svcCheck?.testimonial2Name;
        if (!hasTestimonials) {
          addLive({ type: "zappy-bubble", mood: "idle", text: "Got any client testimonials? Real quotes make your ads, emails, and landing page more convincing. Tap Use or Skip below." });
          const pickerMsg = addLive({ type: "testimonial-picker", testimonialPicker: { serviceId, mode: "campaign" } });
          const testimonialAction = await waitForTestimonialDone();
          if (cancelled.current) return;
          if (testimonialAction === "use") {
            addLive({ type: "zappy-bubble", mood: "celebrating", text: "Nice — real social proof makes everything hit harder. Let's build." });
          } else {
            // Remove picker (may have timed out or user skipped)
            removeLive(pickerMsg.id);
            addLive({ type: "zappy-bubble", mood: "idle", text: "No worries — skipping testimonials. You can add them later from Settings." });
          }
        }
      } catch { /* non-fatal — skip testimonial prompt if lookup fails */ }
    }

    for (const stepDef of AUTO_STEPS) {
      if (cancelled.current) return;
      // Tweaks queued during the previous node run between nodes —
      // downstream of the tweaked node hasn't started, by construction.
      driverBusy.current = false;
      await processTweakQueue();
      driverBusy.current = true;
      if (cancelled.current) return;
      if (kit[stepDef.field] != null) continue;

      // ── Style chooser: pause before adCreatives to let user pick style ──
      if (stepDef.step === "adCreatives" && !(kit as Record<string, unknown>).adImageStyle) {
        driverBusy.current = false;
        addLive({ type: "zappy-bubble", mood: "idle", text: "Last step — your ad images. Pick a style:" });
        let headlineText = "Your headline here";
        let testimonialForChooser: { quote: string; name: string; title?: string } | null = null;
        try {
          const hId = kit.selectedHeadlineId as number | undefined;
          if (hId) {
            const h = await utils.headlines.get.fetch({ id: hId });
            if (h?.headline) headlineText = h.headline;
          }
          // Fetch testimonial data for the testimonial card preview
          const svcData = await utils.services.get.fetch({ id: serviceId }) as Record<string, unknown> | null;
          if (svcData?.testimonial1Name && svcData?.testimonial1Quote) {
            testimonialForChooser = { quote: String(svcData.testimonial1Quote), name: String(svcData.testimonial1Name), title: svcData.testimonial1Title ? String(svcData.testimonial1Title) : undefined };
          }
        } catch { /* fallback is fine */ }
        addLive({ type: "style-chooser", styleChooserHeadline: headlineText, styleChooserTestimonial: testimonialForChooser });
        const chosenStyle = await waitForStyleChoice();
        if (cancelled.current) return;
        const autoKitId = kit0.id as number;
        try { await updateSelection.mutateAsync({ kitId: autoKitId, adImageStyle: chosenStyle } as any); } catch { /* non-fatal */ }
        // Refresh kit so orchestrator reads the style
        const refreshedState = await trailState.refetch();
        kit = (refreshedState.data?.kit ?? kit) as Record<string, unknown>;
        driverBusy.current = true;
      }

      setGeneratingKey(stepDef.stopKey);
      const narration = startNarration(stepDef.step);

      // One silent-ish retry per node (spec §11), then honest stop.
      let ok = false;
      let lastError = "";
      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        try {
          const { jobId } = await orchestrateStep.mutateAsync({
            serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType,
          });
          const job = await pollJob(jobId);
          if (job.status === "failed") throw new Error(job.error || "Generation failed");
          ok = true;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt === 1 && !cancelled.current) {
            addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
          }
        }
      }
      narration.stop();
      if (cancelled.current) return;
      while (!ok) {
        setGeneratingKey(null);
        addLive({ type: "zappy-bubble", mood: "idle", text: `Still stuck on ${stepDef.revealLabel} (${lastError}). Want to try again?` });
        collapsePreviousChips();
        const retryChip = addLive({ type: "chip-row", nodeKey: stepDef.step, chips: ["Try again"] });
        activeChips.current = { msgId: retryChip.id, step: stepDef.step };
        dealMoreChipChoice.current = null;
        await waitForManualProceed();
        if (cancelled.current) return;
        setGeneratingKey(stepDef.stopKey);
        const retryNarration = startNarration(stepDef.step);
        for (let retryAttempt = 1; retryAttempt <= 2 && !ok; retryAttempt++) {
          try {
            const { jobId: retryJobId } = await orchestrateStep.mutateAsync({
              serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType,
            });
            const retryJob = await pollJob(retryJobId);
            if (retryJob.status === "failed") throw new Error(retryJob.error || "Generation failed");
            ok = true;
          } catch (retryErr) {
            lastError = retryErr instanceof Error ? retryErr.message : String(retryErr);
            if (retryAttempt === 1 && !cancelled.current)
              addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
          }
        }
        retryNarration.stop();
        if (cancelled.current) return;
      }

      // Refresh real state — selected*Id is committed before the job completes.
      const refreshed = await trailState.refetch();
      kit = (refreshed.data?.kit ?? kit) as Record<string, unknown>;

      const reveal = await buildReveal(stepDef, kit);
      const revealLine = getRevealLine(stepDef.step);
      if (revealLine) addLive({ type: "zappy-bubble", mood: "celebrating", text: revealLine });
      const divider = addLive({ type: "system-divider", nodeKey: stepDef.stopKey, text: `${stepDef.revealLabel} ready` });
      const card = addLive({ type: "asset-reveal-card", nodeKey: stepDef.stopKey, reveal });
      setGeneratingKey(null);
      // B6: only persist narration on first generation, not regen/swap
      const hasExistingCard = (persisted ?? []).some(
        m => m.type === "asset-reveal-card" && m.nodeKey === stepDef.stopKey
      );
      const toPersist: ChatMessage[] = hasExistingCard ? [divider, card] : [narration.line1, divider, card];

      // C4: sub-100 honesty on scored nodes — surface it, offer the W5
      // rewrite or keep-wording choice. Never fake a 100.
      const realScore = (reveal as { score?: number }).score;
      if (stepDef.scored && typeof realScore === "number" && realScore < 100) {
        const honest = addLive({
          type: "zappy-bubble",
          mood: "idle",
          text: `This one's at ${realScore} — Meta may push back. Want me to rewrite it safe, or keep your wording?`,
        });
        toPersist.push(honest);
        collapsePreviousChips();
        const row = addLive({ type: "chip-row", nodeKey: stepDef.step, chips: ["Rewrite it safe", "Keep your wording"] });
        activeChips.current = { msgId: row.id, step: stepDef.step };
      } else {
        offerChips(stepDef.step, stepDef.tweakable);
      }

      // C4: milestone badge (Tier 2) + one "while I work" insight per
      // milestone, drawn from the user's REAL generated ICP — persisted
      // per the C3 transcript rule (real, specific, one per milestone).
      if (stepDef.milestone) {
        const badge = addLive({
          type: "milestone-badge",
          milestone: { name: stepDef.milestone.name, line: stepDef.milestone.line },
        });
        toPersist.push(badge);
        const insightText = await buildInsight(kit, stepDef.milestone.insight);
        if (insightText) {
          const insight = addLive({ type: "zappy-bubble", mood: "idle", text: insightText });
          toPersist.push(insight);
        }
      }

      await persistMsgs(toPersist);

      // Sprint 4 C3: check if path was switched mid-run
      const autoPathCheck = await trailState.refetch();
      const autoCurrentPath = ((autoPathCheck.data?.kit ?? {}) as Record<string, unknown>).path;
      if (autoCurrentPath !== "auto" && autoCurrentPath !== "has_assets") return; // let the unified loop re-enter with manual
    }

    driverBusy.current = false;
    await processTweakQueue();
    if (cancelled.current) return;

    // ── C4: Tier 3 — the §5.3 completion beat + Campaign Kit handoff ──
    const doneBadge = addLive({
      type: "milestone-badge",
      milestone: { name: "CAMPAIGN COMPLETE", line: "11 of 11 — every piece built and accounted for." },
    });
    const done1 = addLive({
      type: "zappy-bubble",
      mood: "celebrating",
      text: "Done. Eleven pieces, all singing the same song.",
    });
    const done2 = addLive({
      type: "zappy-bubble",
      mood: "celebrating",
      text: "Every piece matches your offer, your method, your voice.",
    });
    collapsePreviousChips();
    const row = addLive({ type: "chip-row", chips: ["Open my Campaign Kit", "Review piece by piece", "Meet your Dream Buyer"] });
    activeChips.current = null; // completion chips handled by name, not node
    void row;
    // B6: server dedup replaces old CAMPAIGN COMPLETE badge; done1/done2 only
    // persist on first completion (subsequent completions show in live only).
    const hasCompletionAlready = (persisted ?? []).some(
      m => m.type === "milestone-badge" && m.milestone?.name === "CAMPAIGN COMPLETE"
    );
    await persistMsgs(hasCompletionAlready ? [doneBadge] : [doneBadge, done1, done2]);
  };

  // C4: one real-ICP insight per milestone. Pulls the first line of the
  // matching ICP field — generated data, never canned tips.
  const insightUsed = useRef<Set<string>>(new Set());
  const buildInsight = async (kit: Record<string, unknown>, kind: "fears" | "goals" | "pains"): Promise<string | null> => {
    if (insightUsed.current.has(kind)) return null;
    insightUsed.current.add(kind);
    try {
      const icp = await utils.icps.get.fetch({ id: kit.icpId as number }) as Record<string, unknown> | null;
      const raw = String(icp?.[kind] ?? "").split("\n").map(s => s.trim()).filter(Boolean)[0] ?? "";
      const line = raw.replace(/^[-•*\d.\s]+/, "").slice(0, 140);
      if (!line) return null;
      if (kind === "fears") return `By the way — "${line}" is the fear we'll hammer in your ads. It's the one that moves people.`;
      if (kind === "goals") return `Notice the thread so far: everything points at "${line}". That's deliberate.`;
      return `Your follow-ups all press on "${line}" — that's what gets replies.`;
    } catch { return null; }
  };

  // ── Testimonial picker wait — resolves when user taps Use/Skip ──
  // 90s safety timeout: if the picker fails to load (lazy chunk error) or
  // the user doesn't interact, auto-skip so the trail never hangs.
  const testimonialResolve = useRef<((action: "use" | "skip") => void) | null>(null);
  const waitForTestimonialDone = (): Promise<"use" | "skip"> => new Promise(r => {
    testimonialResolve.current = r;
    setTimeout(() => { if (testimonialResolve.current === r) { testimonialResolve.current = null; r("skip"); } }, 90_000);
  });
  const handleTestimonialDone = (messageId: string, action: "use" | "skip") => {
    removeLive(messageId);
    const echo = addLive({ type: "user-bubble", text: action === "use" ? "Use these testimonials" : "Skip — no testimonials" });
    persistMsgs([echo]);
    testimonialResolve.current?.(action);
    testimonialResolve.current = null;
  };

  // ── Style chooser wait — resolves when user picks a style ──
  // 90s safety timeout: auto-pick "photo_ad" if the chooser stalls.
  const styleResolve = useRef<((style: string) => void) | null>(null);
  const waitForStyleChoice = (): Promise<string> => new Promise(r => {
    styleResolve.current = r;
    setTimeout(() => { if (styleResolve.current === r) { styleResolve.current = null; r("photo_ad"); } }, 90_000);
  });
  const handleStyleChoose = (messageId: string, style: string) => {
    removeLive(messageId);
    const styleName = style.startsWith("quote_card") ? "Quote Card" : style.startsWith("notification") ? "Notification" : style.startsWith("editorial") ? "Editorial" : "Photo Ad";
    const echo = addLive({ type: "user-bubble", text: styleName });
    persistMsgs([echo]);
    styleResolve.current?.(style);
    styleResolve.current = null;
  };

  // ── Sprint 4 C1: manual crown wait — a promise that resolves when the
  // user taps "Lock it in →" (or a card in the deck) ──
  const manualResolve = useRef<(() => void) | null>(null);
  const waitForManualProceed = () => new Promise<void>(r => { manualResolve.current = r; });
  // Phase 1 (Problem A): the upfront-facts answer resolver — resolves with the coach's answer string
  // (a typed value, an N/A sentinel via chip, or "__SKIP__"). Active only while factsMode is set.
  const factAnswerResolve = useRef<((answer: string) => void) | null>(null);
  const waitForFactAnswer = () => new Promise<string>(r => { factAnswerResolve.current = r; });
  // Sprint 4 C3: distinguishes Lock-it-in from Deal-a-fresh-set in the same
  // chip row. Both resolve the manual proceed promise; the loop checks which.
  const dealMoreChipChoice = useRef<"lock" | "deal" | "skip" | null>(null);

  // ── Sprint 4 C1: fetch the dealable set and build card-deck cards ──
  const fetchDeckCardsRaw = async (
    stepDef: (typeof AUTO_STEPS)[number],
    serviceId: number,
    jobResult: Record<string, unknown>,
  ): Promise<{ id: number; title: string; preview: string; selected?: boolean }[]> => {
    const ds = stepDef.dealable!;
    switch (ds.fetchSet) {
      case "mechanism": {
        // generatedId is a row ID (from pickFirstFromHeroMechanismSet).
        // Look up the row's mechanismSetId, then fetch the full set.
        const rowId = Number(jobResult.generatedId);
        const row = await utils.heroMechanisms.get.fetch({ id: rowId }) as Record<string, unknown> | null;
        const setId = String(row?.mechanismSetId ?? "");
        if (!setId) return [{ id: rowId, title: "Your Method", preview: "", selected: true }];
        const items = await utils.heroMechanisms.getBySetId.fetch({ mechanismSetId: setId }) as { id: number; mechanismName: string; mechanismDescription: string; tabType: string; isFavorite?: boolean }[];
        return items.filter(m => m.tabType === "hero_mechanisms").map((m) => ({
          id: m.id, title: m.mechanismName, preview: (m.mechanismDescription ?? "").slice(0, 120), selected: m.id === rowId,
          favouritable: true, favourited: !!m.isFavorite,
        }));
      }
      case "hvco": {
        // generatedId is a row ID. Look up the row's hvcoSetId.
        const rowId = Number(jobResult.generatedId);
        const row = await utils.hvco.get.fetch({ id: rowId }) as Record<string, unknown> | null;
        const setId = String(row?.hvcoSetId ?? "");
        if (!setId) return [{ id: rowId, title: "Your Lead Magnet", preview: "", selected: true }];
        const items = await utils.hvco.getBySetId.fetch({ hvcoSetId: setId }) as { id: number; title: string; tabType: string; isFavorite?: boolean }[];
        const long = pickHvcoLongTitles(items);
        return long.map((h) => ({ id: h.id, title: h.title, preview: "", selected: h.id === rowId,
          favouritable: true, favourited: !!h.isFavorite,
        }));
      }
      case "headlines": {
        // generatedId is a row ID. Look up the row's headlineSetId.
        const rowId = Number(jobResult.generatedId);
        const row = await utils.headlines.get.fetch({ id: rowId }) as Record<string, unknown> | null;
        const setId = String(row?.headlineSetId ?? "");
        if (!setId) return [{ id: rowId, title: "Your Headline", preview: "", selected: true }];
        // getBySetId returns a GROUPED object ({ headlines: { story, eyebrow, ... } }),
        // not a flat array — flatten to the first headline of each formula (max 5).
        const res = await utils.headlines.getBySetId.fetch({ headlineSetId: setId }) as unknown as { headlines?: Record<string, { id: number; headline: string; subheadline?: string }[]> };
        const picks = flattenHeadlineGroups(res);
        return picks.map((h) => ({ id: h.id, title: h.headline, preview: h.subheadline ?? "", selected: h.id === rowId }));
      }
      case "adCopy": {
        // generatedId is a row id (pickFirstFromAdSet), not the setId.
        // Fetch the row to get adSetId, then list all body rows from the set.
        const rowId = Number(jobResult.generatedId);
        const row = await utils.adCopy.get.fetch({ id: rowId }) as Record<string, unknown> | null;
        const setId = String(row?.adSetId ?? "");
        if (!setId) return [{ id: rowId, title: "Your Ad Copy", preview: "", selected: true }];
        // adCopy has no getBySetId — use list filtered by serviceId and
        // filter by adSetId client-side.
        const all = await utils.adCopy.list.fetch({ serviceId }) as { id: number; content: string; contentType: string; adSetId: string }[];
        const bodies = all.filter(a => a.adSetId === setId && a.contentType === "body");
        return bodies.slice(0, 5).map((a, i) => ({
          id: a.id, title: a.content.split("\n")[0].slice(0, 80), preview: a.content.split("\n").slice(1, 3).join(" ").slice(0, 120), selected: i === 0,
        }));
      }
      case "offerAngles": {
        const offerId = Number(jobResult.generatedId ?? jobResult.offerId);
        const o = await utils.offers.get.fetch({ id: offerId }) as Record<string, unknown> | null;
        if (!o) return [{ id: offerId, title: "Your Offer", preview: "", selected: true }];
        const angles: { key: string; label: string }[] = [
          { key: "godfatherAngle", label: "Godfather" },
          { key: "freeAngle", label: "Free" },
          { key: "dollarAngle", label: "Dollar" },
        ];
        // UNIQUE id per angle card (rowId*100+i) so single-select marks ONE card, not all (they used to
        // share `offerId`). The row id is recoverable as Math.floor(id/100) in the select handler.
        const offerActive = String((o as Record<string, unknown>).activeAngle ?? "godfather");
        return angles.filter(a => o[a.key] != null).map((a, i) => {
          const angle = parseMaybeJson(o[a.key]);
          const angleKey = a.key.replace("Angle", ""); // godfather | free | dollar
          return { id: offerId * 100 + i, angleKey, title: `${a.label}: ${String(angle?.offerName ?? "Offer")}`, preview: String(angle?.valueProposition ?? "").slice(0, 120), selected: angleKey === offerActive };
        });
      }
      case "lpAngles": {
        const lpId = Number(jobResult.generatedId ?? jobResult.landingPageId);
        const lp = await utils.landingPages.get.fetch({ id: lpId }) as Record<string, unknown> | null;
        if (!lp) return [{ id: lpId, title: "Your Landing Page", preview: "", selected: true }];
        const angles: { key: string; label: string }[] = [
          { key: "originalAngle", label: "Original" },
          { key: "godfatherAngle", label: "Godfather" },
          { key: "freeAngle", label: "Free" },
          { key: "dollarAngle", label: "Dollar" },
        ];
        // UNIQUE id per angle card (rowId*100+i) so single-select marks ONE card, not all (they used to
        // share `lpId`, so every card showed "✓ Selected" and the chosen angle was lost).
        const lpActive = String((lp as Record<string, unknown>).activeAngle ?? "original");
        return angles.filter(a => lp[a.key] != null).map((a, i) => {
          const angle = parseMaybeJson(lp[a.key]);
          const angleKey = a.key.replace("Angle", ""); // original | godfather | free | dollar
          return { id: lpId * 100 + i, angleKey, title: `${a.label}: ${String(angle?.mainHeadline ?? "Landing Page")}`, preview: String(angle?.subheadline ?? "").slice(0, 120), selected: angleKey === lpActive };
        });
      }
    }
  };

  // Deck option cards resolve/humanize tokens so no raw [INSERT_…] leaks into a
  // card the coach picks from (display-only — the stored row keeps the raw token).
  const fetchDeckCards = async (
    stepDef: (typeof AUTO_STEPS)[number],
    serviceId: number,
    jobResult: Record<string, unknown>,
  ) => {
    const cards = await fetchDeckCardsRaw(stepDef, serviceId, jobResult);
    return cards.map(c => ({ ...c, title: cleanText(c.title), preview: cleanText(c.preview) }));
  };

  // ── Sprint 4 C1: the manual-mode loop ──
  // Same structure as runAutoLoop: iterate steps, generate, BUT instead of
  // auto-select → reveal, it deals cards → waits for crown → proceeds.
  // Non-dealable nodes (ICP/email/whatsapp/adCreatives) use auto-style reveal.
  // The auto loop is UNTOUCHED — the driver entry chooses which to run.
  const runManualLoop = async () => {
    resetBuild(); // fresh rotation for this cascade run
    const state = trailState.data!;
    const serviceId = state.serviceId!;
    const kit0 = state.kit as Record<string, unknown>;
    const icpId = kit0.icpId as number;
    const kitId = kit0.id as number;
    const kitCampaignType = (kit0.campaignType ?? undefined) as
      | "webinar" | "challenge" | "course_launch" | "product_launch"
      | "discovery_call" | "lead_magnet" | "in_person_event" | undefined;
    let kit = kit0;

    // ── Testimonial prompt (same as auto-loop) ──
    // B8: skip on swap — testimonial prompt is for fresh campaigns only.
    const manualIsSwapRegen = landOnNode.current?.action === "swap";
    const manualFirstPending = AUTO_STEPS.find(s => kit[s.field] == null);
    if (manualFirstPending?.step === "offer" && serviceId && !manualIsSwapRegen) {
      try {
        const svcCheck = await utils.services.get.fetch({ id: serviceId }) as Record<string, unknown> | null;
        const hasTestimonials = svcCheck?.testimonial1Name || svcCheck?.testimonial2Name;
        if (!hasTestimonials) {
          addLive({ type: "zappy-bubble", mood: "idle", text: "Got any client testimonials? Real quotes make your ads, emails, and landing page more convincing. Tap Use or Skip below." });
          const pickerMsg2 = addLive({ type: "testimonial-picker", testimonialPicker: { serviceId, mode: "campaign" } });
          const testimonialAction = await waitForTestimonialDone();
          if (cancelled.current) return;
          if (testimonialAction === "use") {
            addLive({ type: "zappy-bubble", mood: "celebrating", text: "Nice — real social proof makes everything hit harder. Let's build." });
          } else {
            removeLive(pickerMsg2.id);
            addLive({ type: "zappy-bubble", mood: "idle", text: "No worries — skipping testimonials. You can add them later from Settings." });
          }
        }
      } catch { /* non-fatal */ }
    }

    // ── Phase 1 (Problem A): capture campaign facts UPFRONT, before ANY generation node ──
    // So email/whatsapp/LP generate with the coach's real date/venue/price (length derived from the date,
    // no [INSERT_*] placeholders patched later). Zappy-led, one at a time, N/A first-class, skippable.
    // Only runs on a FRESH manual build (skip on swap/resume where nodes already exist).
    if (!manualIsSwapRegen && manualFirstPending?.step === "offer") {
      try {
        let fr = await utils.campaignKits.getCampaignFactsReadiness.fetch({ kitId });
        if (!fr.ready && fr.questions.length > 0) {
          addLive({ type: "zappy-bubble", mood: "idle", text: `Before I build anything — ${fr.remaining} quick detail${fr.remaining === 1 ? "" : "s"} so it's all built with your real info, not placeholders.` });
          let guard = 0;
          while (!fr.ready && fr.questions.length > 0 && guard++ < 12) {
            if (cancelled.current) return;
            const q = fr.questions[0] as { token: string; question: string; category: string; inputType?: "text" | "date" | "time" | "venue" | "price"; naBranches: { sentinel: string; label: string }[] };
            addLive({ type: "zappy-bubble", mood: "idle", text: q.question });
            const inputType = q.inputType ?? "text";
            let structuredMsgId: string | null = null;
            if (inputType === "text") {
              // Free-text field → N/A chips + the bottom text bar (existing behaviour).
              const chips = [...q.naBranches.map(b => b.label), ...(q.category === "nudge" ? ["Skip"] : [])];
              if (chips.length) { collapsePreviousChips(); const cr = addLive({ type: "chip-row", chips }); activeChips.current = { msgId: cr.id, step: "offer" }; }
            } else {
              // Structured control — a malformed date/venue/price is impossible; its own chips carry the N/A.
              const si = addLive({ type: "structured-input", operatorInput: { token: q.token, inputType, naBranches: q.naBranches } });
              structuredMsgId = si.id;
            }
            setFactsMode({ token: q.token, inputType, naBranches: q.naBranches });
            const ans = await waitForFactAnswer();
            setFactsMode(null);
            if (structuredMsgId) removeLive(structuredMsgId);
            if (cancelled.current) return;
            fr = await answerCampaignFact.mutateAsync({ kitId, token: q.token, answer: ans });
          }
          addLive({ type: "zappy-bubble", mood: "celebrating", text: "Perfect — I'll build everything with that." });
        }
      } catch (e) { console.warn("[trail] upfront facts capture failed (non-fatal):", e); setFactsMode(null); }
    }

    for (const stepDef of AUTO_STEPS) {
      if (cancelled.current) return;
      if (kit[stepDef.field] != null) continue;

      // ── Manual intro + "Show me options" chip ──
      const intro = MANUAL_INTROS[stepDef.step];
      addLive({ type: "zappy-bubble", mood: "idle", text: intro });

      // For non-dealable nodes, skip the deal chip — generate + reveal like auto.
      if (!stepDef.dealable) {
        // Style chooser for adCreatives in manual mode
        if (stepDef.step === "adCreatives" && !kit.adImageStyle) {
          let headlineText = "Your headline here";
          let manualTestimonial: { quote: string; name: string; title?: string } | null = null;
          try {
            const hId = kit.selectedHeadlineId as number | undefined;
            if (hId) {
              const h = await utils.headlines.get.fetch({ id: hId });
              if (h?.headline) headlineText = h.headline;
            }
            const svcData = await utils.services.get.fetch({ id: serviceId }) as Record<string, unknown> | null;
            if (svcData?.testimonial1Name && svcData?.testimonial1Quote) {
              manualTestimonial = { quote: String(svcData.testimonial1Quote), name: String(svcData.testimonial1Name), title: svcData.testimonial1Title ? String(svcData.testimonial1Title) : undefined };
            }
          } catch { /* fallback */ }
          addLive({ type: "style-chooser", styleChooserHeadline: headlineText, styleChooserTestimonial: manualTestimonial });
          const chosenStyle = await waitForStyleChoice();
          if (cancelled.current) return;
          try { await updateSelection.mutateAsync({ kitId, adImageStyle: chosenStyle } as any); } catch { /* non-fatal */ }
          kit = { ...kit, adImageStyle: chosenStyle };
        }
        setGeneratingKey(stepDef.stopKey);
        const narration = startNarration(stepDef.step);
        let ok = false;
        let lastError = "";
        for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
          try {
            const { jobId } = await orchestrateStep.mutateAsync({
              serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType,
            });
            const job = await pollJob(jobId);
            if (job.status === "failed") throw new Error(job.error || "Generation failed");
            ok = true;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (attempt === 1 && !cancelled.current)
              addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
          }
        }
        narration.stop();
        if (cancelled.current) return;
        while (!ok) {
          setGeneratingKey(null);
          addLive({ type: "zappy-bubble", mood: "idle", text: `Still stuck on ${stepDef.revealLabel} (${lastError}). Want to try again?` });
          collapsePreviousChips();
          const retryChipM = addLive({ type: "chip-row", nodeKey: stepDef.step, chips: ["Try again"] });
          activeChips.current = { msgId: retryChipM.id, step: stepDef.step };
          dealMoreChipChoice.current = null;
          await waitForManualProceed();
          if (cancelled.current) return;
          setGeneratingKey(stepDef.stopKey);
          const retryNarM = startNarration(stepDef.step);
          for (let ra = 1; ra <= 2 && !ok; ra++) {
            try {
              const { jobId: rjid } = await orchestrateStep.mutateAsync({ serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType });
              const rj = await pollJob(rjid);
              if (rj.status === "failed") throw new Error(rj.error || "Generation failed");
              ok = true;
            } catch (re) {
              lastError = re instanceof Error ? re.message : String(re);
              if (ra === 1 && !cancelled.current) addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
            }
          }
          retryNarM.stop();
          if (cancelled.current) return;
        }
        const refreshed = await trailState.refetch();
        kit = (refreshed.data?.kit ?? kit) as Record<string, unknown>;
        const reveal = await buildReveal(stepDef, kit);
        const manReveal = getRevealLine(stepDef.step);
        if (manReveal) addLive({ type: "zappy-bubble", mood: "celebrating", text: manReveal });
        const divider = addLive({ type: "system-divider", nodeKey: stepDef.stopKey, text: `${stepDef.revealLabel} ready` });
        const card = addLive({ type: "asset-reveal-card", nodeKey: stepDef.stopKey, reveal });
        setGeneratingKey(null);
        const toPersist: ChatMessage[] = [divider, card];
        if (stepDef.milestone) {
          const badge = addLive({ type: "milestone-badge", milestone: { name: stepDef.milestone.name, line: stepDef.milestone.line } });
          toPersist.push(badge);
          const insightText = await buildInsight(kit, stepDef.milestone.insight);
          if (insightText) { const insight = addLive({ type: "zappy-bubble", mood: "idle", text: insightText }); toPersist.push(insight); }
        }
        await persistMsgs(toPersist);
        continue;
      }

      // ── Dealable node: "Show me options" + "Skip" ──
      collapsePreviousChips();
      const dealChip = addLive({ type: "chip-row", nodeKey: stepDef.step, chips: ["Show me options", "Skip — I already have this"] });
      activeChips.current = { msgId: dealChip.id, step: stepDef.step };
      dealMoreChipChoice.current = null;
      await waitForManualProceed();
      if (cancelled.current) return;
      // Sprint 4 C4: skip → mark imported, proceed to next
      if (dealMoreChipChoice.current === "skip") {
        try {
          const kitId = kit.id as number;
          // Mark as imported in nodeStatuses
          await clearStaleMutation.mutateAsync({ campaignKitId: kitId, nodeType: stepDef.stopKey });
          // Upsert imported status (reuse the clearStale pattern — insert imported)
          // Actually we need a dedicated write. Use the existing nodeSkips mutation.
          await skipNodeMutation.mutateAsync({ serviceId, nodeType: stepDef.stopKey });
          addLive({ type: "system-divider", text: `${stepDef.revealLabel} — skipped (imported)` });
        } catch { /* non-fatal */ }
        await trailState.refetch();
        continue;
      }

      setGeneratingKey(stepDef.stopKey);
      const narration = startNarration(stepDef.step);
      let jobResult: Record<string, unknown> | null = null;
      let ok = false;
      let lastError = "";
      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        try {
          const { jobId } = await orchestrateStep.mutateAsync({
            serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType,
          });
          const job = await pollJob(jobId);
          if (job.status === "failed") throw new Error(job.error || "Generation failed");
          jobResult = job.result;
          ok = true;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt === 1 && !cancelled.current)
            addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
        }
      }
      narration.stop();
      if (cancelled.current) return;
      while (!ok || !jobResult) {
        setGeneratingKey(null);
        addLive({ type: "zappy-bubble", mood: "idle", text: `Still stuck on ${stepDef.revealLabel} (${lastError}). Want to try again?` });
        collapsePreviousChips();
        const retryChipD = addLive({ type: "chip-row", nodeKey: stepDef.step, chips: ["Try again"] });
        activeChips.current = { msgId: retryChipD.id, step: stepDef.step };
        dealMoreChipChoice.current = null;
        await waitForManualProceed();
        if (cancelled.current) return;
        setGeneratingKey(stepDef.stopKey);
        const retryNarD = startNarration(stepDef.step);
        for (let ra = 1; ra <= 2 && !ok; ra++) {
          try {
            const { jobId: rjid } = await orchestrateStep.mutateAsync({ serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType });
            const rj = await pollJob(rjid);
            if (rj.status === "failed") throw new Error(rj.error || "Generation failed");
            jobResult = rj.result;
            ok = true;
          } catch (re) {
            lastError = re instanceof Error ? re.message : String(re);
            if (ra === 1 && !cancelled.current) addLive({ type: "zappy-bubble", mood: "idle", text: "Hm — that one fizzled. Let me try again." });
          }
        }
        retryNarD.stop();
        if (cancelled.current) return;
      }

      // Refresh kit so we know the auto-selected id
      const refreshed = await trailState.refetch();
      kit = (refreshed.data?.kit ?? kit) as Record<string, unknown>;

      // Fetch set → deal cards (350ms simulated dealing from the completed batch).
      // generatingKey stays set through the fetch so the loading state covers the
      // whole window; it clears the moment the real deck (or a retry) is shown.
      // Skipped-node guard: orchestrateStep returns generatedId:null when the node
      // was already populated — fall back to the committed selected id (kit is
      // freshly refetched just above) so the deck renders existing content, not empty.
      const dealJobResult = { ...jobResult, generatedId: resolveDeckSourceId(jobResult.generatedId, kit[stepDef.field]) };
      let cards: Awaited<ReturnType<typeof fetchDeckCards>> = [];
      try {
        cards = (await fetchDeckCards(stepDef, serviceId, dealJobResult)) ?? [];
      } catch (deckErr) {
        console.error("[trail] fetchDeckCards failed", stepDef.step, deckErr);
        cards = [];
      }
      setGeneratingKey(null);

      // Zero cards → the options didn't come through. Never render a "pick your
      // favourite" deck with nothing in it, and never let the node advance on an
      // unseen auto-selection. Offer an honest retry (node stays pending; the
      // unified driver re-enters and regenerates cleanly).
      if (cards.length === 0) {
        addLive({ type: "zappy-bubble", mood: "idle", text: `Hm — your ${stepDef.revealLabel.toLowerCase()} options didn't come through. Want me to try again?` });
        collapsePreviousChips();
        const zeroRetry = addLive({ type: "chip-row", nodeKey: stepDef.step, chips: ["Try again", "Skip — I already have this"] });
        activeChips.current = { msgId: zeroRetry.id, step: stepDef.step };
        dealMoreChipChoice.current = null;
        await waitForManualProceed();
        if (cancelled.current) return;
        if (dealMoreChipChoice.current === "skip") {
          try {
            await clearStaleMutation.mutateAsync({ campaignKitId: kitId, nodeType: stepDef.stopKey });
            await skipNodeMutation.mutateAsync({ serviceId, nodeType: stepDef.stopKey });
            addLive({ type: "system-divider", text: `${stepDef.revealLabel} — skipped (imported)` });
          } catch { /* non-fatal */ }
          await trailState.refetch();
          continue; // ADVANCE to the next node — skip marks it imported, so do NOT re-present it. (The
          // shared `return` below re-entered the driver and re-dealt THIS node = the ad-copy loop.)
        }
        return; // "Try again" only → re-enter the manual loop to retry THIS node cleanly (never bounce)
      }

      const deckReveal = getRevealLine(stepDef.step);
      if (deckReveal) addLive({ type: "zappy-bubble", mood: "celebrating", text: deckReveal });
      const divider = addLive({ type: "system-divider", nodeKey: stepDef.stopKey, text: `${stepDef.revealLabel} ready — pick your favourite` });
      const deckMsg = addLive({
        type: "card-deck",
        nodeKey: stepDef.stopKey,
        deck: { cards: [] },
      });
      // Simulated dealing: add cards one at a time at ~350ms
      for (let i = 0; i < cards.length; i++) {
        await new Promise(r => setTimeout(r, 350));
        if (cancelled.current) return;
        setLive(prev => prev.map(m => {
          if (m.id !== deckMsg.id || !m.deck) return m;
          const updated: ChatMessage = { ...m, deck: { cards: [...m.deck.cards, cards[i]] } };
          return updated;
        }));
      }

      // "Lock it in →" + optional "Show me new options · {n} left" chips.
      // The deal-more loop: user can tap "Show me new options" to regenerate
      // (new set replaces the deck), or "Lock it in" to proceed.
      let dealMoreLoop = true;
      while (dealMoreLoop) {
        collapsePreviousChips();
        const quota = (quotaStatus.data ?? []).find(q => q.step === stepDef.step);
        const remaining = quota?.remaining ?? 0;
        const unlimited = quota?.unlimited ?? false;
        const chips: string[] = ["Lock it in →"];
        if (remaining > 0 || unlimited) {
          const label = unlimited ? "Show me new options" : `Show me new options · ${remaining} left`;
          chips.push(label);
        }
        chips.push("Let Zappy take over");
        const chipRow = addLive({ type: "chip-row", nodeKey: stepDef.step, chips });
        activeChips.current = { msgId: chipRow.id, step: stepDef.step };
        // Wait for chip tap (resolved by handleChipTap for Lock/Deal)
        dealMoreChipChoice.current = null;
        await waitForManualProceed();
        if (cancelled.current) return;
        if (dealMoreChipChoice.current === "deal") {
          // Check quota honestly
          const freshQuota = await quotaStatus.refetch();
          const freshQ = (freshQuota.data ?? []).find(q => q.step === stepDef.step);
          if (freshQ && !freshQ.unlimited && freshQ.remaining <= 0) {
            addLive({ type: "zappy-bubble", mood: "idle", text: `You've used all your ${stepDef.revealLabel.toLowerCase()} generations for this period. Pick from what's here — they're good.` });
            continue;
          }
          // Capture the current selection BEFORE nulling it — if regeneration is
          // skipped (already-populated race), we fall back to this to render the
          // existing set instead of emptying the deck.
          const priorSelectedId = kit[stepDef.field] ?? null;
          // NULL the current selection so orchestrateStep re-generates
          try { await updateSelection.mutateAsync({ kitId, [stepDef.field]: null } as any); } catch { /* non-fatal */ }
          setGeneratingKey(stepDef.stopKey);
          const narration2 = startNarration(stepDef.step);
          let ok2 = false;
          let jr2: Record<string, unknown> | null = null;
          try {
            const { jobId: jid } = await orchestrateStep.mutateAsync({
              serviceId, icpId, step: stepDef.step, campaignType: kitCampaignType,
            });
            const job2 = await pollJob(jid);
            if (job2.status === "failed") throw new Error(job2.error || "failed");
            jr2 = job2.result;
            ok2 = true;
          } catch { /* handled below */ }
          narration2.stop();
          if (!ok2 || !jr2) {
            addLive({ type: "zappy-bubble", mood: "idle", text: "Couldn't generate a fresh set. Pick from the current options." });
            setGeneratingKey(null);
            continue;
          }
          const refreshed2 = await trailState.refetch();
          kit = (refreshed2.data?.kit ?? kit) as Record<string, unknown>;
          setGeneratingKey(null);
          // Re-deal with new cards
          const redealReveal = getRevealLine(stepDef.step);
          if (redealReveal) addLive({ type: "zappy-bubble", mood: "celebrating", text: redealReveal });
          const redealJobResult = { ...jr2, generatedId: resolveDeckSourceId(jr2.generatedId, priorSelectedId) };
          const newCards = await fetchDeckCards(stepDef, serviceId, redealJobResult);
          // Never replace the live deck with an empty one. If regeneration was
          // skipped (already-populated) or produced nothing, keep the current set.
          if (newCards.length === 0) {
            addLive({ type: "zappy-bubble", mood: "idle", text: "That's already locked in for now — showing your current options." });
          } else {
            setLive(prev => prev.map(m => {
              if (m.id !== deckMsg.id || !m.deck) return m;
              const updated: ChatMessage = { ...m, deck: { cards: newCards } };
              return updated;
            }));
          }
          await quotaStatus.refetch();
          continue;
        }
        // "Lock it in →" tapped — exit the deal-more loop
        dealMoreLoop = false;
      }
      if (cancelled.current) return;

      // Sprint 4 C3: check if path was switched mid-run
      const pathCheck = await trailState.refetch();
      const currentPath = ((pathCheck.data?.kit ?? {}) as Record<string, unknown>).path;
      if (currentPath !== "manual") return; // let the unified loop re-enter

      // Sprint 4 C4: persist the deck so a returning user can re-pick.
      // deckMsg ref holds the initial empty object; liveRef has the current
      // populated version (including deal-more replacements + crowns).
      const finalDeck = liveRef.current.find(m => m.id === deckMsg.id) ?? deckMsg;
      await persistMsgs([divider, finalDeck]);
      if (stepDef.milestone) {
        const badge = addLive({ type: "milestone-badge", milestone: { name: stepDef.milestone.name, line: stepDef.milestone.line } });
        const toPersist: ChatMessage[] = [badge];
        const insightText = await buildInsight(kit, stepDef.milestone.insight);
        if (insightText) { const insight = addLive({ type: "zappy-bubble", mood: "idle", text: insightText }); toPersist.push(insight); }
        await persistMsgs(toPersist);
      }
    }

    if (cancelled.current) return;
    // ── Completion beat — identical to auto ──
    const doneBadge = addLive({
      type: "milestone-badge",
      milestone: { name: "CAMPAIGN COMPLETE", line: "11 of 11 — every piece built and accounted for." },
    });
    const done1 = addLive({ type: "zappy-bubble", mood: "celebrating", text: "Done. Eleven pieces, all singing the same song." });
    const done2 = addLive({ type: "zappy-bubble", mood: "celebrating", text: "Every piece matches your offer, your method, your voice." });
    collapsePreviousChips();
    addLive({ type: "chip-row", chips: ["Open my Campaign Kit", "Review piece by piece", "Meet your Dream Buyer"] });
    activeChips.current = null;
    // B6: same completion dedup as auto loop
    const hasCompletionAlreadyM = (persisted ?? []).some(
      m => m.type === "milestone-badge" && m.milestone?.name === "CAMPAIGN COMPLETE"
    );
    await persistMsgs(hasCompletionAlreadyM ? [doneBadge] : [doneBadge, done1, done2]);
  };

  // ── Sprint 4 C3: unified driver with per-node path check for mid-run switching ──
  const runUnifiedLoop = async () => {
    while (true) {
      const state = await trailState.refetch();
      const kit = (state.data?.kit ?? {}) as Record<string, unknown>;
      const path = kit.path as string | null;
      if (path !== null && path !== "auto" && path !== "manual" && path !== "has_assets") return;
      const hasPending = AUTO_STEPS.some(s => kit[s.field] == null);
      if (!hasPending) break;
      if (cancelled.current) return;
      if (path === "manual") {
        await runManualLoop();
      } else {
        // auto AND has_assets both run the auto loop — imported nodes
        // skipped structurally (selected*Id populated).
        await runAutoLoop();
      }
      // After a loop exits (possibly due to a path switch), re-check
      if (cancelled.current) return;
      const recheck = await trailState.refetch();
      const recheckKit = (recheck.data?.kit ?? {}) as Record<string, unknown>;
      const stillPending = AUTO_STEPS.some(s => recheckKit[s.field] == null);
      if (!stillPending) break;
      // If path changed, the while loop re-enters with the new mode
    }
  };

  useEffect(() => {
    if (driverStarted.current) return;
    if (!trailState.data || persisted === null) return;
    const kit = trailState.data.kit as Record<string, unknown>;
    const path = kit.path as string | null;
    if (path !== null && path !== "auto" && path !== "manual" && path !== "has_assets") return;

    // Land-on-node: if ?action=swap was requested, NULL the target field
    // BEFORE evaluating hasPending. This makes the target node pending so
    // the loop naturally reaches it. The NULL mutation is async, so we
    // wrap the startup in an async IIFE.
    const target = landOnNode.current;
    const needsSwap = target?.stopKey && target.action === "swap";
    const stepDef = needsSwap ? AUTO_STEPS.find(s => s.stopKey === target.stopKey) : null;

    const hasPendingNow = AUTO_STEPS.some(s => kit[s.field] == null);
    // If no pending nodes AND no swap target, nothing to do
    if (!hasPendingNow && !needsSwap) return;

    driverStarted.current = true;
    (async () => {
      // ── Swap-with-coherence-choice ──────────────────────────────────────
      // When the user taps "Swap" on a node from the kit page, present a
      // choice BEFORE any generation fires:
      //   "Just change the [X]" → NULL only the target field
      //   "Change everything to match" → NULL target + all downstream fields
      // For nodes with no populated downstream, skip the choice and swap directly.
      if (stepDef && needsSwap) {
        const kitId = kit.id as number;

        // Downstream dependency map (same as server's STALE_NODE_DOWNSTREAM)
        const DOWNSTREAM: Record<string, string[]> = {
          offer: ["uniqueMethod", "freeOptIn", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
          uniqueMethod: ["freeOptIn", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
          freeOptIn: ["headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
          headlines: ["adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
          adCopy: ["landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
          landingPage: ["emailSequence", "whatsappSequence", "adCreatives"],
          emailSequence: ["whatsappSequence", "adCreatives"],
          whatsappSequence: ["adCreatives"],
        };

        const downstreamStopKeys = DOWNSTREAM[stepDef.step] ?? [];
        const populatedDownstream = downstreamStopKeys
          .map(sk => AUTO_STEPS.find(s => s.stopKey === sk))
          .filter((s): s is typeof AUTO_STEPS[number] => !!s && kit[s.field] != null);

        let nullDownstreamToo = false;

        if (populatedDownstream.length > 0) {
          // Present the choice — user decides before anything regenerates
          const downstreamNames = populatedDownstream.map(s => s.revealLabel.toLowerCase()).join(", ");
          addLive({ type: "zappy-bubble", mood: "idle",
            text: `Swapping your ${stepDef.revealLabel.toLowerCase()}. Your ${downstreamNames} ${populatedDownstream.length === 1 ? "was" : "were"} built from the current one — want me to rebuild ${populatedDownstream.length === 1 ? "it" : "them"} to match, or leave ${populatedDownstream.length === 1 ? "it" : "them"} as ${populatedDownstream.length === 1 ? "it is" : "they are"}?` });
          collapsePreviousChips();
          const choiceChip = addLive({ type: "chip-row", nodeKey: stepDef.step,
            chips: [`Just change the ${stepDef.revealLabel.toLowerCase()}`, "Change everything to match"] });
          activeChips.current = { msgId: choiceChip.id, step: stepDef.step };
          dealMoreChipChoice.current = null;
          await waitForManualProceed();
          if (cancelled.current) return;
          // dealMoreChipChoice is "lock" for the first chip, "lock" for the second
          // We need to distinguish — check which chip text was tapped
          // The chip handler sets dealMoreChipChoice to "lock" for both (neither is "deal" or "skip")
          // So we need a different signal. Let's use the chip text via a ref.
        }

        // Since both chips map to "lock" in the handler, I need to detect which
        // was tapped. The simplest way: check if the last user-bubble text matches.
        if (populatedDownstream.length > 0) {
          const lastUserBubble = liveRef.current.filter(m => m.type === "user-bubble").pop();
          nullDownstreamToo = lastUserBubble?.text === "Change everything to match";
        }

        // NULL the target field
        try {
          await updateSelection.mutateAsync({ kitId, [stepDef.field]: null } as any);
        } catch { /* non-fatal */ }

        // If "change everything" — NULL all populated downstream fields too
        if (nullDownstreamToo) {
          for (const ds of populatedDownstream) {
            try {
              await updateSelection.mutateAsync({ kitId, [ds.field]: null } as any);
            } catch { /* non-fatal */ }
          }
          addLive({ type: "zappy-bubble", mood: "idle",
            text: `Rebuilding your ${stepDef.revealLabel.toLowerCase()} and everything downstream. This takes a minute.` });
        } else {
          addLive({ type: "zappy-bubble", mood: "idle",
            text: `Swapping your ${stepDef.revealLabel.toLowerCase()} — building a fresh one now.` });
        }

        await trailState.refetch();
      }
      await runUnifiedLoop();
    })().catch((driverErr) => {
      // Defense-in-depth: an unhandled throw in the driver used to reject
      // silently, freezing the trail on wait-lines with no error surfaced.
      // Surface it and clear the loading state so the user isn't stranded.
      console.error("[trail] driver loop crashed", driverErr);
      setGeneratingKey(null);
      if (!cancelled.current) {
        addLive({ type: "zappy-bubble", mood: "idle", text: "Something tripped up on my end. Refresh and I'll pick up where we left off." });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailState.data, persisted]);

  // ── Return-visit stale chips: re-offer "Update the rest" when stale rows exist ──
  // Guard: useRef resets on every mount (page load / navigation), so chips are
  // offered once per return-session. Next visit → ref resets → chips re-appear
  // (stale rows persist until explicitly updated). Not re-offered on refetch.
  const staleChipsOffered = useRef(false);
  useEffect(() => {
    if (staleChipsOffered.current) return;
    if (freshHandoff.current) return; // fresh handoff from dashboard, not a return
    if (!trailState.data || persisted === null) return;
    if (driverStarted.current) return; // cascade is running, live chips handle it
    const staleStatuses = (trailState.data.statuses ?? []).filter(s => s.status === "stale");
    const staleCount = staleStatuses.length;
    if (staleCount === 0) return;
    staleChipsOffered.current = true;
    // Node-aware naming for singular case (e.g. "Ad Images" not "one piece")
    const singleLabel = staleCount === 1 && staleStatuses[0]
      ? (AUTO_STEPS.find(s => s.stopKey === staleStatuses[0].nodeType)?.revealLabel ?? "one piece")
      : "";
    const framing = staleCount === 1
      ? `Welcome back — your ${singleLabel} ${singleLabel === "Ad Images" ? "were" : "was"} built before your latest changes and ${singleLabel === "Ad Images" ? "don't" : "doesn't"} reflect them yet. Want me to rebuild ${singleLabel === "Ad Images" ? "them" : "it"} to match, or leave ${singleLabel === "Ad Images" ? "them" : "it"} as ${singleLabel === "Ad Images" ? "they are" : "it is"}?`
      : `Welcome back — ${staleCount} pieces were built before your latest changes and don't reflect them yet. Want me to rebuild them to match, or leave them as they are?`;
    const warn = addLive({ type: "zappy-bubble", mood: "idle", text: framing });
    const confirmLabel = staleCount === 1 ? singleLabel : `${staleCount} pieces`;
    const confirmWarn = addLive({
      type: "zappy-bubble",
      mood: "idle",
      text: `Rebuild ${confirmLabel}? They'll be freshly generated to match your changes. Any edits you made to ${staleCount > 1 ? "those pieces" : "it"} by hand will be replaced.`,
    });
    const row = addLive({ type: "chip-row", chips: ["Rebuild to match", "Leave them — they still work"] });
    activeChips.current = { msgId: row.id, step: AUTO_STEPS[0].step };
    persistMsgs([warn, confirmWarn]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailState.data, persisted]);

  // ── Return-visit "Regenerate images" chip: always available on completed campaigns ──
  const regenChipOffered = useRef(false);
  useEffect(() => {
    if (regenChipOffered.current) return;
    if (freshHandoff.current) return;
    if (!trailState.data || persisted === null) return;
    if (driverStarted.current) return;
    const kit = trailState.data.kit as Record<string, unknown>;
    if (kit.selectedAdCreativeBatchId == null) return; // no images yet
    const staleCount = (trailState.data.statuses ?? []).filter(s => s.status === "stale").length;
    if (staleCount > 0) return; // stale chips handle this case
    regenChipOffered.current = true;
    const row = addLive({ type: "chip-row", nodeKey: "adCreatives", chips: ["Regenerate images"] });
    activeChips.current = { msgId: row.id, step: "adCreatives" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailState.data, persisted]);

  // ── Thread: restored transcript (+ welcome-back on genuine resume) + live ──
  const messages: ChatMessage[] = useMemo(() => {
    const saved = persisted ?? [];
    const withWelcome = freshHandoff.current ? saved : [...saved, welcomeBackBubble(stops)];
    return [...withWelcome, ...live];
  }, [persisted, stops, live]);

  const [icpPanelOpen, setIcpPanelOpen] = useState(false);

  const handleStopClick = (key: string) => {
    if (key === "icp") {
      setIcpPanelOpen(prev => !prev);
      return;
    }
    setIcpPanelOpen(false); // close ICP panel when clicking other nodes
    const el = nodeRefMap.current.get(key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ── Invalid / not-found / loading states ──
  if (!validId) {
    return (
      <V2Layout>
        <div style={{ padding: 40, textAlign: "center", fontFamily: FONT_BODY, color: TEXT_COLOR }}>
          Invalid campaign link.
        </div>
      </V2Layout>
    );
  }
  if (trailState.error) {
    return (
      <V2Layout>
        <div style={{ padding: 40, textAlign: "center", fontFamily: FONT_BODY, color: TEXT_COLOR }}>
          Campaign not found.
        </div>
      </V2Layout>
    );
  }
  if (!trailState.data || persisted === null) {
    return (
      <V2Layout>
        <div style={{ padding: 40, textAlign: "center", fontFamily: FONT_BODY, color: TEXT_COLOR, opacity: 0.6 }}>
          Loading your trail…
        </div>
      </V2Layout>
    );
  }

  return (
    <V2Layout>
      <div style={{
        maxWidth: 720,
        margin: "0 auto",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px 0",
      }}>
        {/* Kit name header + standing View Campaign Kit affordance */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          margin: "0 0 12px",
          flexShrink: 0,
        }}>
          <h1 style={{
            fontFamily: FONT_HEADING,
            fontSize: 20,
            fontWeight: 700,
            fontStyle: "italic",
            color: TEXT_COLOR,
            margin: 0,
          }}>
            {(trailState.data.kit as { name?: string | null }).name || "Campaign Trail"}
          </h1>
          <button
            onClick={() => navigate(`/v2-dashboard/campaign-kit/${campaignKitId}`)}
            style={{
              flexShrink: 0,
              background: "var(--v2-primary-btn)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--v2-border-radius-pill)",
              padding: "8px 18px",
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            View Campaign Kit
          </button>
        </div>

        {/* TrailBar pinned at top */}
        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <TrailBar stops={stops} onStopClick={handleStopClick} />
          {/* C4: ComplianceDial — only while a SCORED node generates.
              Climb caps at 90; the real score lands on the reveal card. */}
          {(() => {
            const generating = AUTO_STEPS.find(s => s.stopKey === generatingKey);
            return generating?.scored
              ? <ComplianceDial label={generating.revealLabel.toLowerCase()} />
              : null;
          })()}
        </div>

        {/* ICP panel — toggles on ICP node click in trail bar */}
        {icpPanelOpen && trailState.data?.kit && (
          <div style={{
            flex: 1,
            minHeight: 0,
            background: "white",
            borderRadius: "20px 20px 0 0",
            overflow: "auto",
            padding: "16px 12px",
          }}>
            <Suspense fallback={<div style={{ padding: 20, fontFamily: FONT_BODY, color: TEXT_COLOR, opacity: 0.5 }}>Loading ICP...</div>}>
              <V2ICPResultPanel
                icpId={(trailState.data.kit as { icpId: number }).icpId}
                onClose={() => setIcpPanelOpen(false)}
              />
            </Suspense>
          </div>
        )}

        {/* ChatThread fills remaining space */}
        <div style={{
          flex: 1,
          minHeight: 0,
          background: "rgba(255,255,255,0.3)",
          borderRadius: "20px 20px 0 0",
          overflow: "hidden",
          display: icpPanelOpen ? "none" : undefined,
        }}>
          <ChatThread
            messages={messages}
            optionsGenerating={(trailState.data?.kit as Record<string, unknown> | undefined)?.path === "manual" && generatingKey != null && DEALABLE_STOP_KEYS.has(generatingKey)}
            campaignStatus={`Campaign: ${stops.filter(s => s.state === "done" || s.state === "imported" || s.state === "stale").length} of ${stops.length} complete`}
            nodeRefMap={nodeRefMap}
            onChipTap={handleChipTap}
            onDeckSelect={handleDeckSelect}
            onDeckHeart={handleDeckHeart}
            onStyleChoose={handleStyleChoose}
            onTestimonialDone={handleTestimonialDone}
            onStructuredSubmit={handleFactStructured}
            onSendText={
              walkthroughMode && walkthrough.active && !walkthrough.awaitingConfirm
                ? handleWalkthroughText
                : factsMode && factsMode.inputType === "text"
                ? handleFactText
                : tweakMode
                ? handleTweakInstruction
                : undefined
            }
            inputPlaceholder={
              walkthroughMode
                ? "Type your answer…"
                : factsMode && factsMode.inputType === "text"
                ? "Type your answer…"
                : "What should change?"
            }
            inputDisabled={
              walkthroughMode
                ? walkthrough.busy || !walkthrough.active || walkthrough.awaitingConfirm
                : !(factsMode && factsMode.inputType === "text") && !tweakMode
            }
          />
        </div>
      </div>
    </V2Layout>
  );
}
