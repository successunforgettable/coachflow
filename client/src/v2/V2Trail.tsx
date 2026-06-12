/**
 * V2Trail — Campaign Trail page.
 * Route: /v2-dashboard/trail/:campaignKitId
 *
 * Sprint 1: TrailBar + ChatThread on real kit data, transcript persistence.
 * Sprint 2: welcome-back resume beat (§10.4), transcript restore.
 * Sprint 3 C2: the AUTO-LOOP DRIVER — for kits with path='auto' and pending
 * nodes, runs the cascade client-paced: one autoMode.orchestrateStep job per
 * node, poll, reveal the auto-selected asset, persist, next. Because the
 * driver keys purely off kit state, RESUME is structural: reopening
 * /trail/{kitId} mid-cascade continues from the first pending node.
 * (Narrator voice + Love it/Tweak chips are C3 — C2 reveals are simple.)
 *
 * TrailBar stop states derive from REAL kit data:
 *   selected*Id → done; nodeStatuses → imported/stale; running step →
 *   generating; otherwise pending.
 */
import { useMemo, useRef, useState, useEffect } from "react";
import { useParams } from "wouter";
import V2Layout from "./V2Layout";
import TrailBar, { type TrailStop, type StopState } from "./components/TrailBar";
import ChatThread, { type ChatMessage } from "./components/ChatThread";
import { trpc } from "@/lib/trpc";

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

const AUTO_STEPS: {
  step: AutoStepName;
  field: string;
  stopKey: string;
  revealLabel: string;
  workingLine: string;
}[] = [
  { step: "offer",            field: "selectedOfferId",            stopKey: "offer",            revealLabel: "Offer",         workingLine: "Crafting your premium offer angles…" },
  { step: "mechanism",        field: "selectedMechanismId",        stopKey: "uniqueMethod",     revealLabel: "Unique Method", workingLine: "Naming your unique method…" },
  { step: "hvco",             field: "selectedHvcoId",             stopKey: "freeOptIn",        revealLabel: "Lead Magnet",   workingLine: "Building your free opt-in title…" },
  { step: "headlines",        field: "selectedHeadlineId",         stopKey: "headlines",        revealLabel: "Headline",      workingLine: "Writing 100 headlines across 5 formulas…" },
  { step: "adCopy",           field: "selectedAdCopyId",           stopKey: "adCopy",           revealLabel: "Ad Copy",       workingLine: "Drafting your Meta-compliant ad sets…" },
  { step: "landingPage",      field: "selectedLandingPageId",      stopKey: "landingPage",      revealLabel: "Landing Page",  workingLine: "Building your landing page, angle by angle…" },
  { step: "emailSequence",    field: "selectedEmailSequenceId",    stopKey: "emailSequence",    revealLabel: "Email Sequence", workingLine: "Composing your email sequence…" },
  { step: "whatsappSequence", field: "selectedWhatsAppSequenceId", stopKey: "whatsappSequence", revealLabel: "WhatsApp",      workingLine: "Adding your WhatsApp follow-up…" },
  { step: "adCreatives",      field: "selectedAdCreativeBatchId",  stopKey: "adCreatives",      revealLabel: "Ad Images",     workingLine: "Generating 5 ad creative variations…" },
];

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
  const utils = trpc.useUtils();

  // Persisted messages, hydrated once from the transcript query.
  const [persisted, setPersisted] = useState<ChatMessage[] | null>(null);
  useEffect(() => {
    if (transcript.data !== undefined && persisted === null) {
      setPersisted((transcript.data?.messages as ChatMessage[] | undefined) ?? []);
    }
  }, [transcript.data, persisted]);

  // ── Sprint 3 C2: live driver messages (this session) + generating stop ──
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const liveCounter = useRef(0);
  const addLive = (m: Omit<ChatMessage, "id">): ChatMessage => {
    liveCounter.current += 1;
    const full = { ...m, id: `live-${Date.now()}-${liveCounter.current}` };
    setLive(prev => [...prev, full]);
    return full;
  };
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
        if (override === "imported" || override === "stale") {
          state = override;
        } else if (def.key === "icp") {
          state = "done"; // a kit always has its ICP
        } else if (def.key === "service") {
          state = trailState.data?.serviceId != null ? "done" : "pending";
        } else if (def.field && kit[def.field] != null) {
          state = "done";
        }
      }
      if (state === "pending" && def.key === generatingKey) state = "generating";
      return { key: def.key, label: def.label, state };
    });
  }, [trailState.data, generatingKey]);

  // ── Sprint 3 C2: reveal builder — existing per-asset reads, simple form ──
  const buildReveal = async (stepDef: (typeof AUTO_STEPS)[number], kit: Record<string, unknown>) => {
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
            preview: String(angle?.valueProposition ?? "").slice(0, 220) || "Full offer stack in your Kit.",
          };
        }
        case "mechanism": {
          const m = await utils.heroMechanisms.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          return {
            eyebrow: "YOUR UNIQUE METHOD",
            title: String(m?.mechanismName ?? "Your Method"),
            preview: String(m?.mechanismDescription ?? "").slice(0, 220),
          };
        }
        case "hvco": {
          const h = await utils.hvco.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          return {
            eyebrow: "YOUR LEAD MAGNET",
            title: String(h?.title ?? "Your Lead Magnet"),
            preview: "The free thing that pulls people in — worth paying for, that's the bar.",
          };
        }
        case "headlines": {
          const h = await utils.headlines.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          return {
            eyebrow: "YOUR HEADLINE",
            title: String(h?.headline ?? "Your Headline"),
            preview: String(h?.subheadline ?? "") || "+ more in your Kit.",
          };
        }
        case "adCopy": {
          const a = await utils.adCopy.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const content = String(a?.content ?? "");
          return {
            eyebrow: "YOUR AD COPY",
            title: content.split("\n")[0].slice(0, 80) || "Your Ad",
            preview: content.split("\n").slice(1, 4).join(" ").slice(0, 220),
          };
        }
        case "landingPage": {
          const lp = await utils.landingPages.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const angle = parseMaybeJson(lp?.originalAngle);
          return {
            eyebrow: "YOUR LANDING PAGE",
            title: String(angle?.mainHeadline ?? "Your Landing Page"),
            preview: String(angle?.subheadline ?? "").slice(0, 220) || "Published and ready — preview in your Kit.",
          };
        }
        case "emailSequence": {
          const e = await utils.emailSequences.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const emails = parseMaybeJson(e?.emails) as unknown;
          const list = Array.isArray(emails) ? emails : [];
          return {
            eyebrow: "YOUR EMAIL SEQUENCE",
            title: `${list.length || "Your"} emails, ready to send`,
            preview: list[0]?.subject ? `Email 1: "${String(list[0].subject)}"` : "Sequence in your Kit.",
          };
        }
        case "whatsappSequence": {
          const w = await utils.whatsappSequences.get.fetch({ id: idVal as number }) as Record<string, unknown> | null;
          const msgs = parseMaybeJson(w?.messages) as unknown;
          const list = Array.isArray(msgs) ? msgs : [];
          const first = list[0];
          const firstText = typeof first === "string" ? first : String((first as Record<string, unknown>)?.message ?? (first as Record<string, unknown>)?.text ?? "");
          return {
            eyebrow: "YOUR WHATSAPP FOLLOW-UP",
            title: `${list.length || "Your"} messages queued`,
            preview: firstText.slice(0, 220) || "Sequence in your Kit.",
          };
        }
        case "adCreatives": {
          const batch = await utils.adCreatives.getBatch.fetch({ batchId: String(idVal) }) as unknown;
          const count = Array.isArray(batch) ? batch.length
            : Array.isArray((batch as Record<string, unknown>)?.creatives) ? ((batch as Record<string, unknown>).creatives as unknown[]).length
            : 5;
          return {
            eyebrow: "YOUR AD IMAGES",
            title: `${count} ad creatives, composited and ready`,
            preview: "Thumbnails and downloads in your Campaign Kit.",
          };
        }
      }
    } catch { /* fall through */ }
    return fallback;
  };

  // ── Sprint 3 C2: the auto-loop driver ──
  const driverStarted = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const runAutoLoop = async () => {
    const state = trailState.data!;
    const serviceId = state.serviceId!;
    const kit0 = state.kit as Record<string, unknown>;
    const icpId = kit0.icpId as number;
    const kitCampaignType = (kit0.campaignType ?? undefined) as
      | "webinar" | "challenge" | "course_launch" | "product_launch"
      | "discovery_call" | "lead_magnet" | "in_person_event" | undefined;
    let kit = kit0;

    for (const stepDef of AUTO_STEPS) {
      if (cancelled.current) return;
      if (kit[stepDef.field] != null) continue;

      setGeneratingKey(stepDef.stopKey);
      addLive({ type: "zappy-bubble", mood: "thinking", text: stepDef.workingLine });

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
      if (cancelled.current) return;
      if (!ok) {
        addLive({ type: "zappy-bubble", mood: "idle", text: `Still stuck on ${stepDef.revealLabel} (${lastError}). Reload this page and I'll pick it up right here.` });
        setGeneratingKey(null);
        return;
      }

      // Refresh real state — selected*Id is committed before the job completes.
      const refreshed = await trailState.refetch();
      kit = (refreshed.data?.kit ?? kit) as Record<string, unknown>;

      const reveal = await buildReveal(stepDef, kit);
      const divider = addLive({ type: "system-divider", text: `${stepDef.revealLabel} ready` });
      const card = addLive({ type: "asset-reveal-card", nodeKey: stepDef.stopKey, reveal });
      setGeneratingKey(null);
      await persistMsgs([divider, card]);
    }

    if (cancelled.current) return;
    const done = addLive({
      type: "zappy-bubble",
      mood: "celebrating",
      text: "Done — every piece is built and singing the same song. It's all in your Campaign Kit.",
    });
    await persistMsgs([done]);
  };

  useEffect(() => {
    if (driverStarted.current) return;
    if (!trailState.data || persisted === null) return;
    const kit = trailState.data.kit as Record<string, unknown>;
    if (kit.path !== "auto") return;
    const hasPending = AUTO_STEPS.some(s => kit[s.field] == null);
    if (!hasPending) return;
    driverStarted.current = true;
    runAutoLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailState.data, persisted]);

  // ── Thread: restored transcript + welcome-back bubble + live driver beats ──
  const messages: ChatMessage[] = useMemo(() => {
    const saved = persisted ?? [];
    return [...saved, welcomeBackBubble(stops), ...live];
  }, [persisted, stops, live]);

  const handleStopClick = (key: string) => {
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
        {/* Kit name header */}
        <h1 style={{
          fontFamily: FONT_HEADING,
          fontSize: 20,
          fontWeight: 700,
          fontStyle: "italic",
          color: TEXT_COLOR,
          margin: "0 0 12px",
          flexShrink: 0,
        }}>
          {(trailState.data.kit as { name?: string | null }).name || "Campaign Trail"}
        </h1>

        {/* TrailBar pinned at top */}
        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <TrailBar stops={stops} onStopClick={handleStopClick} />
        </div>

        {/* ChatThread fills remaining space */}
        <div style={{
          flex: 1,
          minHeight: 0,
          background: "rgba(255,255,255,0.3)",
          borderRadius: "20px 20px 0 0",
          overflow: "hidden",
        }}>
          <ChatThread
            messages={messages}
            nodeRefMap={nodeRefMap}
          />
        </div>
      </div>
    </V2Layout>
  );
}
