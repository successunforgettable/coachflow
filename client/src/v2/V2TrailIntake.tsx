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
import { useAuth } from "@/_core/hooks/useAuth";
import { patienceGuard } from "./lib/patienceGuard";

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
  | "campaignType" // Sprint 3 C2: "What are you inviting people to?" chips live
  | "fork"         // Beat 5: path chips live
  | "autorun"      // Sprint 3 C2: in-chat auto path — ICP gen + kit creation
  | "hasAssets"    // Sprint 5 C1: has-assets flow — chip grid + forms + import
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

// Sprint 3 C2: campaign-type beat — all 7 enum values are fully wired
// (6 generators read kit.campaignType; LP pageType + adCopy CTA dispatch).
export type CampaignTypeValue =
  | "webinar" | "challenge" | "course_launch" | "product_launch"
  | "discovery_call" | "lead_magnet" | "in_person_event";

const CAMPAIGN_TYPE_CHIPS: Record<string, CampaignTypeValue> = {
  "Webinar": "webinar",
  "Challenge": "challenge",
  "Course": "course_launch",
  "Product launch": "product_launch",
  "Free call": "discovery_call",
  "Lead magnet": "lead_magnet",
  "Live event": "in_person_event",
};

/** Polls /api/jobs/{jobId} until terminal status. 5s cadence, 300s ceiling. */
async function pollJob(jobId: string): Promise<{ status: string; result: Record<string, unknown> | null; error?: string }> {
  const start = Date.now();
  for (;;) {
    await new Promise(r => setTimeout(r, 5_000));
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Job poll failed (${res.status})`);
    const data = await res.json() as { status: string; result: Record<string, unknown> | null; error?: string };
    if (data.status === "complete" || data.status === "failed") return data;
    if (Date.now() - start > 300_000) throw new Error("Generation timed out after 300 seconds");
  }
}

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
  // Sprint 5 C1: has-assets import mutations
  const importIcpMutation = trpc.autoMode.importIcp.useMutation();
  const importAssetsMutation = trpc.autoMode.importAssets.useMutation();
  const markImportedMutation = trpc.trail.markImported.useMutation();
  // Sprint 3 C2: in-chat auto path
  const expandProfileMutation = trpc.services.expandProfile.useMutation();
  const generateIcpMutation = trpc.icps.generateAsync.useMutation();
  const getOrCreateKitMutation = trpc.campaignKits.getOrCreate.useMutation();
  const appendMessagesMutation = trpc.trail.appendMessages.useMutation();
  const utils = trpc.useUtils();
  const campaignType = useRef<CampaignTypeValue | null>(null);
  // Snapshot of the thread for the direct flush — kept by a ref so async
  // beats (ICP poll) read the latest without stale closures.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Tier mirror — server gate at autoMode.ts isAutoModeTierAllowed stays
  // ground truth; this only produces the friendly in-chat message.
  const { user: authUser } = useAuth();
  const isFreeTier = !authUser
    || (authUser.role !== "superuser"
        && authUser.role !== "admin"
        && authUser.subscriptionTier !== "pro"
        && authUser.subscriptionTier !== "agency");

  const addMsg = (msg: Omit<ChatMessage, "id">) => {
    msgCounter.current += 1;
    const full = { ...msg, id: `intake-${msgCounter.current}` };
    // Keep the ref synchronously true — async beats read it between renders.
    messagesRef.current = [...messagesRef.current, full];
    setMessages(prev => [...prev, full]);
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
        text: fields.serviceName
          ? `Done — ${fields.serviceName} is on the board. 🦊`
          : "Done — your campaign is on the board. 🦊",
      });
      // ── Sprint 3 C2: campaign-type beat (before the fork) ──
      addMsg({ type: "zappy-bubble", mood: "idle", text: "What are you inviting people to?" });
      addMsg({ type: "chip-row", chips: Object.keys(CAMPAIGN_TYPE_CHIPS) });
      setPhase("campaignType");
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
    if (phase === "hasAssets" && importTextResolve.current) {
      importTextResolve.current(text);
      importTextResolve.current = null;
      return;
    }
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

  const handleFork = async (chip: string, threadAtTap: ChatMessage[]) => {
    const path = FORK_CHIPS[chip];
    const serviceId = createdServiceId.current;

    // Sprint 3 C2: tier mirror for the auto path — friendly in-chat message,
    // fork stays live so the user can pick another route. Server gate
    // remains ground truth.
    if (path === "auto" && isFreeTier) {
      addMsg({ type: "zappy-bubble", mood: "idle", text: "Building it for you is a Pro feature — upgrade and I'll handle the whole campaign. Or pick a path below and we'll do it together." });
      addMsg({ type: "chip-row", chips: Object.keys(FORK_CHIPS) });
      return;
    }

    setPhase(path === "auto" ? "autorun" : path === "has_assets" ? "hasAssets" : "routing");
    // Analytics FIRST — the choice is recorded before any navigation.
    try {
      await trackEventMutation.mutateAsync({
        eventType: "trail_fork_selected",
        metadata: { path, serviceId, campaignType: campaignType.current },
      });
    } catch { /* never block routing on analytics */ }

    if (path === "manual") {
      runManualInChat();
    } else if (path === "has_assets") {
      // Sprint 5 C1: has-assets now runs in-chat — no more confirm screen.
      runHasAssetsInChat();
    } else {
      // ── Sprint 3 C2: the auto path runs IN the chat ──
      runAutoInChat();
    }
  };

  /**
   * Sprint 3 C2 — in-chat auto path. Replaces the confirm-screen handoff:
   * expandProfile → narrated ICP generation (node 2) → getOrCreate with
   * path + campaignType → direct transcript flush → /trail/{kitId}, where
   * V2Trail's step-loop driver runs the remaining 9 nodes (and resumes
   * them on any future open).
   */
  const runAutoInChat = async () => {
    const serviceId = createdServiceId.current;
    if (serviceId == null) return;
    try {
      // Enrichment — non-fatal, fire-and-forget semantics like the screen had.
      try { await expandProfileMutation.mutateAsync({ serviceId }); } catch { /* non-fatal */ }

      // ── Node 2: ICP, narrated ──
      addMsg({ type: "zappy-bubble", mood: "thinking", text: "Studying the people you help…" });
      const icpName = extraction.current?.icpDescriptor?.trim()
        || `${pendingFields.current?.serviceName?.trim() || "My Service"} Profile`;
      const { jobId } = await generateIcpMutation.mutateAsync({ serviceId, name: icpName });
      const job = await patienceGuard(pollJob(jobId), addMsg);
      if (job.status === "failed" || typeof job.result?.icpId !== "number") {
        throw new Error(job.error || "ICP generation failed.");
      }
      const icpId = job.result.icpId as number;

      // ICP reveal (simple C2 form — full reveal format lands in C3).
      const icp = await utils.icps.get.fetch({ id: icpId });
      addMsg({ type: "system-divider", text: "ICP generated" });
      addMsg({
        type: "asset-reveal-card",
        nodeKey: "icp",
        reveal: {
          eyebrow: "YOUR IDEAL CUSTOMER",
          title: (icp as { name?: string } | null)?.name || "Your Ideal Customer",
          preview: ((icp as { introduction?: string | null } | null)?.introduction || "").split("\n")[0].slice(0, 220) || "Profile generated — full detail in your Kit.",
        },
      });

      // ── Kit row: path + campaignType recorded at the first icpId moment ──
      const kit = await getOrCreateKitMutation.mutateAsync({
        icpId,
        path: "auto",
        campaignType: campaignType.current ?? undefined,
      });
      const kitId = (kit as { id: number }).id;

      // ── Direct transcript flush (no sessionStorage carry needed in-chat) ──
      addMsg({ type: "zappy-bubble", mood: "celebrating", text: "Foundation set. Building the rest now — watch the trail fill in." });
      try {
        type FlushMessages = Parameters<typeof appendMessagesMutation.mutateAsync>[0]["messages"];
        const flush = messagesRef.current.filter(m => m.type !== "chip-row") as unknown as FlushMessages;
        if (flush.length > 0) {
          await appendMessagesMutation.mutateAsync({ campaignKitId: kitId, messages: flush });
        }
      } catch { /* transcript is a nice-to-have */ }

      // C3: mark this as a fresh handoff so the Trail skips the
      // welcome-back bubble — it only plays on genuine resume.
      try { sessionStorage.setItem(`zapTrailFreshHandoff:${kitId}`, "1"); } catch { /* fine */ }
      navigate(`/v2-dashboard/trail/${kitId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not set up your campaign.";
      addMsg({ type: "zappy-bubble", mood: "idle", text: `Hm — that one fizzled (${msg}). One more go?` });
      addMsg({ type: "chip-row", chips: ["Build it for me ⚡"] });
      setPhase("fork");
    }
  };

  // ── Sprint 5 C1: importable asset definitions ──
  const IMPORTABLE_ASSETS = [
    { key: "icp", label: "My Ideal Customer", stopKey: "icp" },
    { key: "offer", label: "My Offer", stopKey: "offer" },
    { key: "mechanism", label: "My Method / Mechanism", stopKey: "uniqueMethod" },
    { key: "hvco", label: "My Lead Magnet", stopKey: "freeOptIn" },
  ] as const;

  // Sprint 5 C1: state for the has-assets import flow
  const selectedImports = useRef<Set<string>>(new Set());
  const importedData = useRef<Record<string, Record<string, string>>>({});

  /**
   * Sprint 5 C1 — has-assets in-chat flow. The user picks which of the 4
   * importable assets they have, fills a mini form for each, confirms via
   * echo card, then the mutations fire. Gap nodes run in the Trail driver.
   */
  const runHasAssetsInChat = async () => {
    const serviceId = createdServiceId.current;
    if (serviceId == null) return;
    setPhase("hasAssets");
    try {
      // Enrichment
      try { await expandProfileMutation.mutateAsync({ serviceId }); } catch { /* non-fatal */ }

      // ── Chip-grid: "What have you got?" ──
      addMsg({ type: "zappy-bubble", mood: "idle", text: "Nice — what have you got? Tap everything you already have, then tap Done." });

      // Show chips for the 4 importable assets + "Done choosing"
      // The user taps multiple, then Done. We handle this with a promise
      // that resolves when "Done choosing" is tapped.
      const gridChips = [...IMPORTABLE_ASSETS.map(a => a.label), "Done choosing"];
      selectedImports.current = new Set();

      // We need a custom multi-select pattern: tapping an asset toggles it
      // (visually echoed), tapping "Done choosing" resolves. Implementation:
      // use chip-row + handleChipTap; track toggles in selectedImports ref.
      addMsg({ type: "chip-row", chips: gridChips });
      // Wait for "Done choosing" — the chip handler sets the flag
      await new Promise<void>(r => { gridDoneResolve.current = r; });

      const chosen = Array.from(selectedImports.current);
      if (chosen.length === 0) {
        addMsg({ type: "zappy-bubble", mood: "idle", text: "No worries — I'll build everything from scratch." });
      } else {
        addMsg({ type: "zappy-bubble", mood: "idle", text: `Got it — you have ${chosen.length} piece${chosen.length > 1 ? "s" : ""}. Let me get the details for each.` });
      }

      // ── Per-asset mini form + echo-confirm ──
      const confirmedAssets: Record<string, Record<string, string>> = {};
      for (const key of chosen) {
        const asset = IMPORTABLE_ASSETS.find(a => a.label === key);
        if (!asset) continue;

        let confirmed = false;
        let fields: Record<string, string> = importedData.current[asset.key] ?? {};
        while (!confirmed) {
          // Show the mini form as a Zappy prompt
          let prompt = "";
          if (asset.key === "icp") {
            prompt = "Tell me about your ideal customer. What's their name/title, what pains them, and what are their goals?";
          } else if (asset.key === "offer") {
            prompt = "Paste your offer — what's it called, what's the promise, and what's the CTA?";
          } else if (asset.key === "mechanism") {
            prompt = "What's your method called, and how would you describe it in a sentence?";
          } else if (asset.key === "hvco") {
            prompt = "What's your lead magnet called, and what topic does it cover?";
          }
          addMsg({ type: "zappy-bubble", mood: "idle", text: prompt });

          // Wait for the user to type (free-text input active during hasAssets)
          setPhase("hasAssets");
          const userText = await new Promise<string>(r => { importTextResolve.current = r; });
          addMsg({ type: "user-bubble", text: userText });

          // Parse the free text into structured fields (simple split, not LLM)
          if (asset.key === "icp") {
            fields = { name: userText.split(",")[0]?.trim() || userText.slice(0, 100), pains: userText };
          } else if (asset.key === "offer") {
            fields = { name: userText.split(",")[0]?.trim() || userText.slice(0, 100), valueProposition: userText, cta: "Book a Free Call" };
          } else if (asset.key === "mechanism") {
            const parts = userText.split(/[—\-,]/);
            fields = { name: parts[0]?.trim() || userText.slice(0, 100), description: userText };
          } else if (asset.key === "hvco") {
            const parts = userText.split(/[—\-,]/);
            fields = { title: parts[0]?.trim() || userText.slice(0, 100), topic: userText };
          }

          // Echo-confirm
          const echoTitle = asset.key === "icp" ? fields.name
            : asset.key === "offer" ? fields.name
            : asset.key === "mechanism" ? fields.name
            : fields.title;
          const echoPreview = asset.key === "icp" ? (fields.pains || "")
            : asset.key === "offer" ? (fields.valueProposition || "")
            : asset.key === "mechanism" ? (fields.description || "")
            : (fields.topic || "");
          addMsg({
            type: "asset-reveal-card",
            nodeKey: asset.stopKey,
            reveal: {
              eyebrow: `YOUR ${asset.label.replace("My ", "").toUpperCase()}`,
              title: echoTitle || asset.label,
              preview: echoPreview.slice(0, 220),
            },
          });
          addMsg({ type: "zappy-bubble", mood: "idle", text: "Look right?" });
          addMsg({ type: "chip-row", chips: ["Correct", "Fix something"] });

          const choice = await new Promise<string>(r => { importConfirmResolve.current = r; });
          if (choice === "Correct") {
            confirmed = true;
            confirmedAssets[asset.key] = fields;
          }
          // "Fix something" loops back
        }
      }

      // ── ICP: import or generate ──
      addMsg({ type: "zappy-bubble", mood: "thinking", text: "Studying the people you help…" });
      let icpId: number;
      if (confirmedAssets.icp) {
        const result = await importIcpMutation.mutateAsync({
          serviceId,
          name: confirmedAssets.icp.name,
          pains: confirmedAssets.icp.pains || undefined,
          goals: confirmedAssets.icp.goals || undefined,
        });
        icpId = result.icpId;
        addMsg({ type: "system-divider", text: "ICP imported" });
      } else {
        const icpName = extraction.current?.icpDescriptor?.trim()
          || `${pendingFields.current?.serviceName?.trim() || "My Service"} Profile`;
        const { jobId } = await generateIcpMutation.mutateAsync({ serviceId, name: icpName });
        const job = await patienceGuard(pollJob(jobId), addMsg);
        if (job.status === "failed" || typeof job.result?.icpId !== "number") {
          throw new Error(job.error || "ICP generation failed.");
        }
        icpId = job.result.icpId as number;
        addMsg({ type: "system-divider", text: "ICP generated" });
      }

      // ICP reveal
      const icp = await utils.icps.get.fetch({ id: icpId });
      addMsg({
        type: "asset-reveal-card",
        nodeKey: "icp",
        reveal: {
          eyebrow: "YOUR IDEAL CUSTOMER",
          title: (icp as { name?: string } | null)?.name || "Your Ideal Customer",
          preview: ((icp as { introduction?: string | null } | null)?.introduction || "").split("\n")[0].slice(0, 220) || "Profile ready.",
        },
      });

      // ── Kit creation ──
      const kit = await getOrCreateKitMutation.mutateAsync({
        icpId,
        path: "has_assets",
        campaignType: campaignType.current ?? undefined,
      });
      const kitId = (kit as { id: number }).id;

      // ── Import remaining confirmed assets (offer/mechanism/hvco) ──
      const hasOffer = !!confirmedAssets.offer;
      const hasMechanism = !!confirmedAssets.mechanism;
      const hasHvco = !!confirmedAssets.hvco;
      if (hasOffer || hasMechanism || hasHvco) {
        await importAssetsMutation.mutateAsync({
          serviceId,
          icpId,
          offer: hasOffer ? {
            name: confirmedAssets.offer.name,
            valueProposition: confirmedAssets.offer.valueProposition,
            cta: confirmedAssets.offer.cta || "Book a Free Call",
          } : undefined,
          mechanism: hasMechanism ? {
            name: confirmedAssets.mechanism.name,
            description: confirmedAssets.mechanism.description,
          } : undefined,
          hvco: hasHvco ? {
            title: confirmedAssets.hvco.title,
            topic: confirmedAssets.hvco.topic,
          } : undefined,
        });
      }

      // ── Mark imported nodes in nodeStatuses ──
      const importedNodes: string[] = [];
      if (confirmedAssets.icp) importedNodes.push("icp");
      if (confirmedAssets.offer) importedNodes.push("offer");
      if (confirmedAssets.mechanism) importedNodes.push("uniqueMethod");
      if (confirmedAssets.hvco) importedNodes.push("freeOptIn");
      for (const nodeType of importedNodes) {
        try { await markImportedMutation.mutateAsync({ campaignKitId: kitId, nodeType }); } catch { /* non-fatal */ }
      }

      // ── Transcript flush + navigate ──
      const importCount = importedNodes.length;
      addMsg({ type: "zappy-bubble", mood: "celebrating",
        text: importCount > 0
          ? `You're already ${importCount + 2} of 11 done. I'll build the missing pieces so they match what you have.`
          : "Foundation set. Building the rest now — watch the trail fill in.",
      });

      try {
        type FlushMessages = Parameters<typeof appendMessagesMutation.mutateAsync>[0]["messages"];
        const flush = messagesRef.current.filter(m => m.type !== "chip-row") as unknown as FlushMessages;
        if (flush.length > 0) {
          await appendMessagesMutation.mutateAsync({ campaignKitId: kitId, messages: flush });
        }
      } catch { /* nice-to-have */ }

      try { sessionStorage.setItem(`zapTrailFreshHandoff:${kitId}`, "1"); } catch { /* fine */ }
      navigate(`/v2-dashboard/trail/${kitId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not set up your campaign.";
      addMsg({ type: "zappy-bubble", mood: "idle", text: `Hm — that one fizzled (${msg}). One more go?` });
      addMsg({ type: "chip-row", chips: ["I already have some pieces"] });
      setPhase("fork");
    }
  };

  // Sprint 5 C1: promise resolvers for the has-assets flow
  const gridDoneResolve = useRef<(() => void) | null>(null);
  const importTextResolve = useRef<((text: string) => void) | null>(null);
  const importConfirmResolve = useRef<((choice: string) => void) | null>(null);

  /**
   * Sprint 4 C1 — in-chat manual path. Same shape as runAutoInChat but
   * creates the kit with path='manual'. The manual loop in V2Trail takes
   * over once we navigate to /trail/{kitId}.
   */
  const runManualInChat = async () => {
    const serviceId = createdServiceId.current;
    if (serviceId == null) return;
    try {
      try { await expandProfileMutation.mutateAsync({ serviceId }); } catch { /* non-fatal */ }
      addMsg({ type: "zappy-bubble", mood: "thinking", text: "Studying the people you help…" });
      const icpName = extraction.current?.icpDescriptor?.trim()
        || `${pendingFields.current?.serviceName?.trim() || "My Service"} Profile`;
      const { jobId } = await generateIcpMutation.mutateAsync({ serviceId, name: icpName });
      const job = await patienceGuard(pollJob(jobId), addMsg);
      if (job.status === "failed" || typeof job.result?.icpId !== "number") {
        throw new Error(job.error || "ICP generation failed.");
      }
      const icpId = job.result.icpId as number;
      const icp = await utils.icps.get.fetch({ id: icpId });
      addMsg({ type: "system-divider", text: "ICP generated" });
      addMsg({
        type: "asset-reveal-card",
        nodeKey: "icp",
        reveal: {
          eyebrow: "YOUR IDEAL CUSTOMER",
          title: (icp as { name?: string } | null)?.name || "Your Ideal Customer",
          preview: ((icp as { introduction?: string | null } | null)?.introduction || "").split("\n")[0].slice(0, 220) || "Profile generated — full detail in your Kit.",
        },
      });
      const kit = await getOrCreateKitMutation.mutateAsync({
        icpId,
        path: "manual",
        campaignType: campaignType.current ?? undefined,
      });
      const kitId = (kit as { id: number }).id;
      addMsg({ type: "zappy-bubble", mood: "celebrating", text: "Foundation set. Now let's pick each piece together." });
      try {
        type FlushMessages = Parameters<typeof appendMessagesMutation.mutateAsync>[0]["messages"];
        const flush = messagesRef.current.filter(m => m.type !== "chip-row") as unknown as FlushMessages;
        if (flush.length > 0) {
          await appendMessagesMutation.mutateAsync({ campaignKitId: kitId, messages: flush });
        }
      } catch { /* nice-to-have */ }
      try { sessionStorage.setItem(`zapTrailFreshHandoff:${kitId}`, "1"); } catch { /* fine */ }
      navigate(`/v2-dashboard/trail/${kitId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not set up your campaign.";
      addMsg({ type: "zappy-bubble", mood: "idle", text: `Hm — that one fizzled (${msg}). One more go?` });
      addMsg({ type: "chip-row", chips: ["I'll pick as we go"] });
      setPhase("fork");
    }
  };

  // ── Chips ──
  const handleChipTap = (messageId: string, chip: string) => {
    // Sprint 5 C1: multi-select grid — toggle without removing the chip row
    const importableLabels: string[] = IMPORTABLE_ASSETS.map(a => a.label);
    if (importableLabels.includes(chip) && phase === "hasAssets") {
      if (selectedImports.current.has(chip)) {
        selectedImports.current.delete(chip);
      } else {
        selectedImports.current.add(chip);
      }
      // m4: update selectedChips on the chip-row message so it re-renders filled
      const sel = Array.from(selectedImports.current);
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, selectedChips: sel } : m
      ));
      messagesRef.current = messagesRef.current.map(m =>
        m.id === messageId ? { ...m, selectedChips: sel } : m
      );
      return; // don't remove chip-row, don't echo — toggle is visual only
    }
    if (chip === "Done choosing" && phase === "hasAssets") {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      messagesRef.current = messagesRef.current.filter(m => m.id !== messageId);
      addMsg({ type: "user-bubble", text: chip });
      if (gridDoneResolve.current) { gridDoneResolve.current(); gridDoneResolve.current = null; }
      return;
    }
    if ((chip === "Correct" || chip === "Fix something") && phase === "hasAssets") {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      messagesRef.current = messagesRef.current.filter(m => m.id !== messageId);
      addMsg({ type: "user-bubble", text: chip });
      if (importConfirmResolve.current) { importConfirmResolve.current(chip); importConfirmResolve.current = null; }
      return;
    }
    // Standard chip handling: remove the row + echo for all other chips
    setMessages(prev => prev.filter(m => m.id !== messageId));
    messagesRef.current = messagesRef.current.filter(m => m.id !== messageId);
    addMsg({ type: "user-bubble", text: chip });

    if (CAMPAIGN_TYPE_CHIPS[chip] && phase === "campaignType") {
      // ── Sprint 3 C2: campaign-type chosen → Beat 5 fork ──
      campaignType.current = CAMPAIGN_TYPE_CHIPS[chip];
      addMsg({ type: "zappy-bubble", mood: "idle", text: "How do you want to do this?" });
      addMsg({ type: "chip-row", chips: Object.keys(FORK_CHIPS) });
      setPhase("fork");
    } else if (FORK_CHIPS[chip] && (phase === "fork")) {
      // messagesRef is synchronously true (includes the echo just added).
      handleFork(chip, messagesRef.current);
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

  const inputActive = phase === "describe" || phase === "correction" || phase === "hasAssets";
  // Hide the bar entirely on chips-only beats — no dead input (Commit 2 fix).
  const showInput = phase === "greeting" || phase === "describe" || phase === "correction" || phase === "extracting" || phase === "hasAssets";
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
                phase === "hasAssets" ? "Paste it here…"
                  : phase === "correction" ? "What did I get wrong?"
                  : "Tell me about your business…"
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
