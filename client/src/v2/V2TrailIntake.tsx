/**
 * V2TrailIntake — Trail Sprint 2, Commit 1. Spec v1.3 Section 4, beats 1–4.
 * Route: /v2-dashboard/trail/new — pre-kit intake home.
 *
 * Deterministic script state-machine (no LLM conversation logic):
 *   greeting → describe → [<120 chars: gentle gate] → extracting
 *   → confirm (echo card + That's me / Not quite)
 *   → Not quite ×2: correction re-extraction loops → 3rd: TweakBox
 *   → That's me / TweakBox confirm: services.create → fork placeholder beat.
 *
 * The Service row is created ONLY at confirmation — no empty-service
 * creation up front. Pre-kit messages don't persist (accepted limit).
 * The fork chips are Commit 2; the script ends cleanly after creation.
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import V2Layout from "./V2Layout";
import TrailBar, { type TrailStop } from "./components/TrailBar";
import ChatThread, { type ChatMessage } from "./components/ChatThread";
import TweakBox, { type TweakBoxFields } from "./components/TweakBox";
import { trpc } from "@/lib/trpc";

const MIN_DESCRIPTION_CHARS = 120; // mirrors services.extractFromText z.min(120)
const MAX_NOT_QUITE_LOOPS = 2;

type Phase =
  | "greeting"     // posting the opening bubbles
  | "describe"     // waiting for the business description
  | "extracting"   // extractFromText in flight
  | "confirm"      // echo card up, chips live
  | "correction"   // waiting for "what did I get wrong" free text
  | "tweakbox"     // field-edit fallback after loops maxed
  | "creating"     // services.create in flight
  | "fork"         // Beat 5: path chips live
  | "routing";     // fork chip tapped, navigating out

interface Extraction {
  serviceName: string;
  serviceCategory: "coaching" | "speaking" | "consulting";
  serviceDescription: string;
  targetCustomer: string;
  mainBenefit: string;
  icpDescriptor: string;
  confidence: "high" | "medium" | "low";
  lowConfidenceFields: string[];
}

const INTAKE_STOPS: TrailStop[] = [
  { key: "service",          label: "Service",      state: "pending" },
  { key: "icp",              label: "ICP",          state: "pending" },
  { key: "offer",            label: "Offer",        state: "pending" },
  { key: "uniqueMethod",     label: "Method",       state: "pending" },
  { key: "freeOptIn",        label: "Lead Magnet",  state: "pending" },
  { key: "headlines",        label: "Headlines",    state: "pending" },
  { key: "adCopy",           label: "Ad Copy",      state: "pending" },
  { key: "landingPage",      label: "Landing Page", state: "pending" },
  { key: "emailSequence",    label: "Email",        state: "pending" },
  { key: "whatsappSequence", label: "WhatsApp",     state: "pending" },
  { key: "adCreatives",      label: "Ad Images",    state: "pending" },
];

// Beat 5 fork chips → campaignKits.path values
const FORK_CHIPS: Record<string, "auto" | "manual" | "has_assets"> = {
  "Build it for me ⚡": "auto",
  "I'll pick as we go": "manual",
  "I already have some pieces": "has_assets",
};

export default function V2TrailIntake() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<Phase>("greeting");
  const [serviceCreated, setServiceCreated] = useState(false);

  // Script state kept in refs — these drive the machine, not renders.
  const baseText = useRef("");
  const corrections = useRef<string[]>([]);
  const notQuiteCount = useRef(0);
  const extraction = useRef<Extraction | null>(null);
  const pendingFields = useRef<TweakBoxFields | null>(null);
  const createdServiceId = useRef<number | null>(null);
  const msgCounter = useRef(0);
  const didInit = useRef(false);

  const extractMutation = trpc.services.extractFromText.useMutation();
  const createMutation = trpc.services.create.useMutation();
  const trackEventMutation = trpc.campaignKits.trackWizardEvent.useMutation();

  const addMsg = (msg: Omit<ChatMessage, "id">) => {
    msgCounter.current += 1;
    const id = `intake-${msgCounter.current}`;
    setMessages(prev => [...prev, { ...msg, id }]);
  };

  // ── Beats 1–2: greeting ──
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    addMsg({ type: "zappy-bubble", mood: "idle", text: "Hey! Let's build you a campaign. 🦊" });
    const t = setTimeout(() => {
      addMsg({ type: "zappy-bubble", mood: "idle", text: "Tell me about your business — who do you help, and what do you do for them?" });
      setPhase("describe");
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // ── Beat 3: extraction ──
  const runExtract = async (isCorrection: boolean) => {
    setPhase("extracting");
    addMsg({
      type: "zappy-bubble",
      mood: "thinking",
      text: isCorrection ? "On it — re-reading with that in mind…" : "Got it. Reading that like a strategist…",
    });
    const rawText = (
      baseText.current +
      corrections.current.map(c => `\n\nUser correction: ${c}`).join("")
    ).slice(0, 4000);
    try {
      const ex = await extractMutation.mutateAsync({ rawText });
      extraction.current = ex as Extraction;
      showEcho(ex as Extraction);
    } catch {
      addMsg({
        type: "zappy-bubble",
        mood: "idle",
        text: "Hm — that one fizzled. Send it again and I'll take another run at it.",
      });
      setPhase(isCorrection ? "correction" : "describe");
    }
  };

  // ── Beat 4: extraction echo (trust moment) ──
  const showEcho = (ex: Extraction) => {
    const categoryNoun = ex.serviceCategory === "speaking" ? "speaker"
      : ex.serviceCategory === "consulting" ? "consultant"
      : "coach";
    const icpShort = ex.targetCustomer || ex.icpDescriptor || "your people";
    addMsg({
      type: "asset-reveal-card",
      nodeKey: "service",
      reveal: {
        eyebrow: "WHAT I HEARD",
        title: ex.serviceName || "Your Business",
        preview: `${ex.serviceDescription || "—"} Helping: ${icpShort}. The win: ${ex.mainBenefit || "—"}`,
      },
    });
    addMsg({ type: "zappy-bubble", mood: "idle", text: `So: you're a ${categoryNoun} helping ${icpShort.charAt(0).toLowerCase()}${icpShort.slice(1)}. Right?` });
    addMsg({ type: "chip-row", chips: ["That's me", "Not quite"] });
    setPhase("confirm");
  };

  // ── Service creation (the moment the row exists) ──
  const createService = async (fields: TweakBoxFields) => {
    pendingFields.current = fields;
    setPhase("creating");
    addMsg({ type: "zappy-bubble", mood: "thinking", text: "Locking that in…" });
    try {
      const created = await createMutation.mutateAsync({
        name: fields.serviceName,
        category: fields.serviceCategory,
        description: fields.serviceDescription,
        targetCustomer: fields.targetCustomer,
        mainBenefit: fields.mainBenefit,
      });
      createdServiceId.current = (created as { id: number }).id;
      setServiceCreated(true);
      addMsg({ type: "system-divider", text: "Service profile created" });
      addMsg({
        type: "zappy-bubble",
        mood: "celebrating",
        text: `Done — ${fields.serviceName || "your service"} is on the board. 🦊`,
      });
      // ── Beat 5: the fork ──
      addMsg({ type: "zappy-bubble", mood: "idle", text: "How do you want to do this?" });
      addMsg({ type: "chip-row", chips: Object.keys(FORK_CHIPS) });
      setPhase("fork");
    } catch {
      addMsg({ type: "zappy-bubble", mood: "idle", text: "Hm — that save fizzled. Want me to try again?" });
      addMsg({ type: "chip-row", chips: ["Try again"] });
      setPhase("confirm");
    }
  };

  const extractionToFields = (ex: Extraction): TweakBoxFields => ({
    serviceName: ex.serviceName,
    serviceCategory: ex.serviceCategory,
    serviceDescription: ex.serviceDescription,
    targetCustomer: ex.targetCustomer,
    mainBenefit: ex.mainBenefit,
  });

  // ── Free-text input ──
  const handleSendText = (text: string) => {
    if (phase === "describe") {
      addMsg({ type: "user-bubble", text });
      baseText.current = baseText.current ? `${baseText.current}\n${text}` : text;
      if (baseText.current.length < MIN_DESCRIPTION_CHARS) {
        addMsg({ type: "zappy-bubble", mood: "idle", text: "I need a little more — even one messy sentence about who you help works." });
        return;
      }
      runExtract(false);
    } else if (phase === "correction") {
      addMsg({ type: "user-bubble", text });
      corrections.current.push(text);
      runExtract(true);
    }
  };

  // ── Beat 5: fork routing ──
  const assembledRawText = () =>
    (baseText.current + corrections.current.map(c => `\n\nUser correction: ${c}`).join("")).slice(0, 4000);

  const buildExtractedState = () => {
    const f = pendingFields.current!;
    return {
      serviceName: f.serviceName,
      serviceCategory: f.serviceCategory,
      serviceDescription: f.serviceDescription,
      targetCustomer: f.targetCustomer,
      mainBenefit: f.mainBenefit,
      icpDescriptor: extraction.current?.icpDescriptor ?? "",
      confidence: "high" as const,
      lowConfidenceFields: [] as string[],
    };
  };

  const handleFork = async (chip: string) => {
    const path = FORK_CHIPS[chip];
    const serviceId = createdServiceId.current;
    setPhase("routing");
    // Analytics FIRST — the choice is recorded before any navigation.
    try {
      await trackEventMutation.mutateAsync({
        eventType: "trail_fork_selected",
        metadata: { path, serviceId },
      });
    } catch { /* never block routing on analytics */ }

    if (path === "manual") {
      // Interim: existing wizard, service pre-created. Kit path stays NULL
      // (it's a wizard campaign). Destination swaps when Sprint 4 lands.
      navigate(`/v2-dashboard/wizard/service?serviceId=${serviceId}`);
    } else {
      // auto / has_assets — existing confirm screen pre-filled. It updates
      // the Trail-created service (existingServiceId) and writes kit.path
      // (trailPath) once the ICP exists. Sprint 3 retires this screen.
      navigate("/v2-dashboard/auto-mode/confirm", {
        state: {
          extracted: buildExtractedState(),
          rawText: assembledRawText(),
          existingServiceId: serviceId,
          trailPath: path,
        },
      });
    }
  };

  // ── Chips ──
  const handleChipTap = (messageId: string, chip: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    addMsg({ type: "user-bubble", text: chip });

    if (FORK_CHIPS[chip]) {
      handleFork(chip);
    } else if (chip === "That's me") {
      if (extraction.current) createService(extractionToFields(extraction.current));
    } else if (chip === "Try again") {
      if (pendingFields.current) createService(pendingFields.current);
    } else if (chip === "Not quite") {
      notQuiteCount.current += 1;
      if (notQuiteCount.current > MAX_NOT_QUITE_LOOPS) {
        addMsg({ type: "zappy-bubble", mood: "idle", text: "Let's do it the direct way — fix the fields below and we're off." });
        setPhase("tweakbox");
      } else {
        addMsg({ type: "zappy-bubble", mood: "idle", text: "What did I get wrong? Tell me straight." });
        setPhase("correction");
      }
    }
  };

  const handleTweakConfirm = (fields: TweakBoxFields) => {
    addMsg({ type: "user-bubble", text: "Fixed the details ✍️" });
    createService(fields);
  };

  const inputActive = phase === "describe" || phase === "correction";
  // Hide the bar entirely on chips-only beats — no dead input (Commit 2 fix).
  const showInput = phase === "greeting" || phase === "describe" || phase === "correction" || phase === "extracting";
  const stops: TrailStop[] = INTAKE_STOPS.map(s =>
    s.key === "service" && serviceCreated ? { ...s, state: "done" } : s
  );

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
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 20,
          fontWeight: 700,
          fontStyle: "italic",
          color: "#1A1624",
          margin: "0 0 12px",
          flexShrink: 0,
        }}>
          New Campaign
        </h1>

        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <TrailBar stops={stops} />
        </div>

        <div style={{
          flex: 1,
          minHeight: 0,
          background: "rgba(255,255,255,0.3)",
          borderRadius: "20px 20px 0 0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatThread
              messages={messages}
              onChipTap={handleChipTap}
              onSendText={showInput ? handleSendText : undefined}
              inputPlaceholder={
                phase === "correction" ? "What did I get wrong?" : "Tell me about your business…"
              }
              inputDisabled={!inputActive}
            />
          </div>

          {phase === "tweakbox" && extraction.current && (
            <div style={{ flexShrink: 0, padding: "0 16px 16px" }}>
              <TweakBox
                initial={extractionToFields(extraction.current)}
                onConfirm={handleTweakConfirm}
              />
            </div>
          )}
        </div>
      </div>
    </V2Layout>
  );
}
