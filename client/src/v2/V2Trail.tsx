/**
 * V2Trail — Campaign Trail page (Trail Sprint 1, Commit 4).
 * Route: /v2-dashboard/trail/:campaignKitId — direct-URL-only until the
 * Sprint 2 intake makes the Trail functional (button flips then, not now).
 *
 * TrailBar stop states derive from REAL kit data:
 *   - selected*Id columns → done
 *   - nodeStatuses rows → imported / stale (override)
 *   - otherwise → pending
 * ChatThread loads the kit's chatTranscripts row; kits without one get a
 * welcome state. The welcome chip proves the transcript persistence
 * round-trip (append → reload → restored). Intake logic is Sprint 2.
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

// §10.4 resume beat — built from real kit state, no history required.
function welcomeBackBubble(stops: TrailStop[]): ChatMessage {
  const doneCount = stops.filter(s => s.state === "done" || s.state === "imported" || s.state === "stale").length;
  const next = stops.find(s => s.state === "pending");
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
  // Persisted messages, hydrated once from the transcript query.
  const [persisted, setPersisted] = useState<ChatMessage[] | null>(null);
  useEffect(() => {
    if (transcript.data !== undefined && persisted === null) {
      setPersisted((transcript.data?.messages as ChatMessage[] | undefined) ?? []);
    }
  }, [transcript.data, persisted]);

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
      return { key: def.key, label: def.label, state };
    });
  }, [trailState.data]);

  // ── Thread: restored transcript + welcome-back bubble, or (no transcript —
  // legacy/wizard kits) the synthesized state-only welcome. The welcome-back
  // bubble is display-only: never written to chatTranscripts.
  const messages: ChatMessage[] = useMemo(() => {
    const saved = persisted ?? [];
    return [...saved, welcomeBackBubble(stops)];
  }, [persisted, stops]);

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
