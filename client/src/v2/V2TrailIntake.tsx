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
  | "hasAssetsChoice" // waiting for upload/paste choice — chips visible, text input hidden
  | "hasAssets"    // Sprint 5 C1: has-assets flow — paste input active
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
  "Build it all for me ⚡": "auto",
  "I'll pick as we go": "manual",
  "I have some — use mine": "has_assets",
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
  const extractFromAssetsMutation = trpc.autoMode.extractFromAssets.useMutation();
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
        preview: ex.serviceDescription || `Helping: ${icpShort}. The win: ${ex.mainBenefit || "—"}`,
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
    if (phase === "hasAssets") {
      if (importTextResolve.current) {
        importTextResolve.current(text);
        importTextResolve.current = null;
      }
      // Guard: if resolver isn't ready yet, the text input shouldn't be active
      // during hasAssetsChoice. If it somehow fires, ignore silently (input is
      // hidden during choice phase so this shouldn't happen in practice).
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

    setPhase(path === "auto" ? "autorun" : path === "has_assets" ? "hasAssetsChoice" : "routing");
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
      addMsg({ type: "chip-row", chips: ["Build it all for me ⚡"] });
      setPhase("fork");
    }
  };

  /**
   * Has-assets in-chat flow — extract-then-confirm-then-gaps.
   * Upload or paste → LLM extraction → confirm cards → gap-only questions → import.
   */
  const runHasAssetsInChat = async () => {
    const serviceId = createdServiceId.current;
    if (serviceId == null) return;
    // Show the upload/paste choice FIRST — before expand, before paste input.
    // Phase stays "hasAssetsChoice" (set by handleFork) so the text input is hidden.
    try {
      // ── Plain-language gate: explain what helps, let user self-select ──
      addMsg({ type: "zappy-bubble", mood: "idle",
        text: "Great! Here's what helps me build the best campaign for you:\n\n• Something that describes your offer or program — what you sell, who it's for, what they get\n• Information about your ideal client — who they are, what they struggle with, what they want\n• Your unique approach or method — what makes the way you do it different\n\nThis could be a document, a sales page, a slide deck, notes — anything you have. I'll read through it and pull out what I need." });
      addMsg({ type: "chip-row", chips: ["I have stuff like that", "Actually, build it for me"] });

      const gateChoice = await new Promise<string>(r => { importConfirmResolve.current = r; });

      if (gateChoice === "Actually, build it for me") {
        // Cleanly hand off to the auto path — same as tapping "Build it all for me ⚡" at the fork.
        setPhase("autorun");
        await runAutoInChat();
        return;
      }

      // ── Step A: Collect material (upload or paste) ──
      addMsg({ type: "zappy-bubble", mood: "idle",
        text: "Upload your documents (PDF, Word, or text files) or paste your material below. I'll read everything and pull out what I need." });
      addMsg({ type: "chip-row", chips: ["Upload files", "I'll paste instead"] });

      // Enrichment runs in parallel — doesn't block the choice
      const expandPromise = expandProfileMutation.mutateAsync({ serviceId }).catch(() => { /* non-fatal */ });

      const entryChoice = await new Promise<string>(r => { importConfirmResolve.current = r; });

      let rawText = "";
      let uploadedImages: { filename: string; dataUrl: string }[] = [];

      if (entryChoice === "Upload files") {
        // Show a real file input button in the chat — direct user click opens
        // the OS picker (programmatic .click() gets blocked by browsers).
        addMsg({ type: "file-upload" });

        const files = await new Promise<FileList | null>(resolve => {
          fileSelectResolve.current = (f) => resolve(f);
          // Cancel fallback — if user doesn't pick within 5 min, resolve null
          setTimeout(() => { if (fileSelectResolve.current) { fileSelectResolve.current = null; resolve(null); } }, 300000);
        });
        if (!files || files.length === 0) {
          addMsg({ type: "zappy-bubble", mood: "idle", text: "No files selected. You can paste your material instead." });
          setPhase("hasAssets");
          rawText = await new Promise<string>(r => { importTextResolve.current = r; });
          addMsg({ type: "user-bubble", text: rawText.slice(0, 200) + (rawText.length > 200 ? "..." : "") });
        } else {
          addMsg({ type: "zappy-bubble", mood: "thinking", text: `Reading ${files.length} file${files.length > 1 ? "s" : ""}...` });
          const formData = new FormData();
          for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
          }

          const resp = await fetch("/api/extract-documents", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          const result = await resp.json();

          if (!resp.ok || !result.text) {
            const warnings = result.warnings?.join(" ") || "";
            addMsg({ type: "zappy-bubble", mood: "idle",
              text: `I couldn't read those files. ${warnings} Try pasting your material instead.` });
            setPhase("hasAssets");
            rawText = await new Promise<string>(r => { importTextResolve.current = r; });
            addMsg({ type: "user-bubble", text: rawText.slice(0, 200) + (rawText.length > 200 ? "..." : "") });
          } else {
            rawText = result.text;
            uploadedImages = result.images || [];
            if (result.warnings?.length > 0) {
              addMsg({ type: "zappy-bubble", mood: "idle", text: result.warnings.join(" ") });
            }
            addMsg({ type: "system-divider", text: `${result.fileCount} file${result.fileCount > 1 ? "s" : ""} read` });
          }
        }
      } else {
        // Paste path
        addMsg({ type: "zappy-bubble", mood: "idle", text: "Paste everything you've got — your offer, method, ICP, testimonials, whatever you have. I'll sort through it." });
        setPhase("hasAssets");
        rawText = await new Promise<string>(r => { importTextResolve.current = r; });
        addMsg({ type: "user-bubble", text: rawText.slice(0, 200) + (rawText.length > 200 ? "..." : "") });
      }

      if (rawText.length < 50) {
        addMsg({ type: "zappy-bubble", mood: "idle", text: "That's a bit short for me to work with. Tell me more about your business, offer, and who you help." });
        setPhase("hasAssets");
        const more = await new Promise<string>(r => { importTextResolve.current = r; });
        addMsg({ type: "user-bubble", text: more.slice(0, 200) + (more.length > 200 ? "..." : "") });
        rawText = rawText + "\n\n" + more;
      }

      // ── Step B: LLM extraction ──
      // Client-side size guard — friendly message instead of raw Zod error
      if (rawText.length > 150000) {
        addMsg({ type: "zappy-bubble", mood: "idle",
          text: "That's a lot of material! Try uploading just your most important file, or paste the key sections (your offer, method, and who you help). I work best with focused content." });
        setPhase("hasAssets");
        rawText = await new Promise<string>(r => { importTextResolve.current = r; });
        addMsg({ type: "user-bubble", text: rawText.slice(0, 200) + (rawText.length > 200 ? "..." : "") });
      }

      addMsg({ type: "zappy-bubble", mood: "thinking", text: rawText.length > 50000
        ? "That's a big document — reading through it now. This might take a moment..."
        : "Reading through your material and pulling out what I find..." });
      const extracted = await extractFromAssetsMutation.mutateAsync({ rawText, images: uploadedImages });

      // ── Step C: Show what was found — confirm cards ──
      const confirmedAssets: Record<string, Record<string, string>> = {};
      const categories = [
        { key: "icp", label: "IDEAL CUSTOMER", stopKey: "icp", nameField: "name", previewField: "pains" },
        { key: "offer", label: "OFFER", stopKey: "offer", nameField: "name", previewField: "valueProposition" },
        { key: "mechanism", label: "METHOD", stopKey: "uniqueMethod", nameField: "name", previewField: "description" },
        { key: "hvco", label: "LEAD MAGNET", stopKey: "freeOptIn", nameField: "title", previewField: "topic" },
      ] as const;

      const foundCategories: string[] = [];
      const missingCategories: string[] = [];

      for (const cat of categories) {
        const data = extracted[cat.key as keyof typeof extracted] as Record<string, string> | null;
        const confidence = extracted.perFieldConfidence?.[cat.key as keyof typeof extracted.perFieldConfidence];

        if (data && data[cat.nameField]) {
          foundCategories.push(cat.key);
          const confidenceNote = confidence === "low" ? " (I wasn't fully sure about this one)" : "";

          addMsg({
            type: "asset-reveal-card",
            nodeKey: cat.stopKey,
            reveal: {
              eyebrow: `FOUND — YOUR ${cat.label}${confidenceNote}`,
              title: data[cat.nameField] || cat.label,
              preview: data[cat.previewField] || "",
            },
          });
          addMsg({ type: "zappy-bubble", mood: "idle", text: "Look right?" });
          addMsg({ type: "chip-row", chips: ["Looks right", "Fix something"] });

          const choice = await new Promise<string>(r => { importConfirmResolve.current = r; });
          if (choice === "Looks right") {
            confirmedAssets[cat.key] = data;
          } else {
            addMsg({ type: "zappy-bubble", mood: "idle", text: `Tell me what's different about your ${cat.label.toLowerCase()}.` });
            setPhase("hasAssets");
            const correction = await new Promise<string>(r => { importTextResolve.current = r; });
            addMsg({ type: "user-bubble", text: correction });
            confirmedAssets[cat.key] = { ...data, [cat.nameField]: correction.split(/[,—\-]/)[0]?.trim() || correction.slice(0, 120), [cat.previewField]: correction };
          }
        } else {
          missingCategories.push(cat.key);
        }
      }

      // Handle testimonials separately (display only — wiring to services.testimonial columns is future work)
      if (extracted.testimonials && extracted.testimonials.length > 0) {
        addMsg({ type: "zappy-bubble", mood: "celebrating",
          text: `Found ${extracted.testimonials.length} testimonial${extracted.testimonials.length > 1 ? "s" : ""} — I'll keep them exactly as your clients said them.` });
        for (const t of extracted.testimonials) {
          addMsg({
            type: "asset-reveal-card",
            nodeKey: "service",
            reveal: {
              eyebrow: `TESTIMONIAL — ${t.name}`,
              title: t.name + (t.title ? ` (${t.title})` : ""),
              preview: `"${t.quote}"`,
            },
          });
        }
      }

      // ── Step D: Ask only about gaps ──
      if (missingCategories.length > 0) {
        const gapNames = missingCategories.map(k => {
          const cat = categories.find(c => c.key === k);
          return cat?.label.toLowerCase() || k;
        });
        addMsg({ type: "zappy-bubble", mood: "idle",
          text: `I found your ${foundCategories.map(k => categories.find(c => c.key === k)?.label.toLowerCase()).join(", ")}. I didn't find ${gapNames.length === 1 ? `a ${gapNames[0]}` : gapNames.join(" or ")} in your material.` });

        for (const gapKey of missingCategories) {
          const cat = categories.find(c => c.key === gapKey)!;
          addMsg({ type: "zappy-bubble", mood: "idle",
            text: `Do you have ${cat.label === "IDEAL CUSTOMER" ? "an ideal customer profile" : `a ${cat.label.toLowerCase()}`}? Tell me about it, or I can create one for you.` });
          addMsg({ type: "chip-row", chips: ["I'll describe it", "Create one for me"] });

          const gapChoice = await new Promise<string>(r => { importConfirmResolve.current = r; });
          if (gapChoice === "I'll describe it") {
            setPhase("hasAssets");
            const gapText = await new Promise<string>(r => { importTextResolve.current = r; });
            addMsg({ type: "user-bubble", text: gapText });

            if (gapKey === "icp") {
              confirmedAssets.icp = { name: gapText.split(",")[0]?.trim() || gapText.slice(0, 120), pains: gapText, goals: "", demographics: "", implementationBarriers: "" };
            } else if (gapKey === "offer") {
              confirmedAssets.offer = { name: gapText.split(",")[0]?.trim() || gapText.slice(0, 120), valueProposition: gapText, pricing: "", bonuses: "", guarantee: "", urgency: "", duration: "", cta: "Book a Free Call" };
            } else if (gapKey === "mechanism") {
              confirmedAssets.mechanism = { name: gapText.split(/[,—\-]/)[0]?.trim() || gapText.slice(0, 120), description: gapText };
            } else if (gapKey === "hvco") {
              confirmedAssets.hvco = { title: gapText.split(/[,—\-]/)[0]?.trim() || gapText.slice(0, 120), topic: gapText };
            }
          }
          // "Create one for me" — leave it out, cascade generates it
        }
      } else {
        addMsg({ type: "zappy-bubble", mood: "celebrating", text: "Got it all from your material — no extra questions needed." });
      }

      // ── Step E: ICP import or generate ──
      // Ensure enrichment finished before ICP work
      await expandPromise;
      addMsg({ type: "zappy-bubble", mood: "thinking", text: "Studying the people you help..." });
      let icpId: number;
      if (confirmedAssets.icp) {
        const result = await importIcpMutation.mutateAsync({
          serviceId,
          name: confirmedAssets.icp.name,
          pains: confirmedAssets.icp.pains || undefined,
          goals: confirmedAssets.icp.goals || undefined,
          implementationBarriers: confirmedAssets.icp.implementationBarriers || undefined,
          demographics: confirmedAssets.icp.demographics || undefined,
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

      // ── Step F: Kit creation ──
      const kit = await getOrCreateKitMutation.mutateAsync({
        icpId,
        path: "has_assets",
        campaignType: campaignType.current ?? undefined,
      });
      const kitId = (kit as { id: number }).id;

      // ── Step G: Import remaining confirmed assets ──
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

      // ── Step H: Mark imported nodes ──
      const importedNodes: string[] = [];
      if (confirmedAssets.icp) importedNodes.push("icp");
      if (confirmedAssets.offer) importedNodes.push("offer");
      if (confirmedAssets.mechanism) importedNodes.push("uniqueMethod");
      if (confirmedAssets.hvco) importedNodes.push("freeOptIn");
      for (const nodeType of importedNodes) {
        try { await markImportedMutation.mutateAsync({ campaignKitId: kitId, nodeType }); } catch { /* non-fatal */ }
      }

      // ── Step I: Navigate to trail ──
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
      addMsg({ type: "chip-row", chips: ["I have some — use mine"] });
      setPhase("fork");
    }
  };

  // Promise resolvers for the has-assets flow
  const importTextResolve = useRef<((text: string) => void) | null>(null);
  const importConfirmResolve = useRef<((choice: string) => void) | null>(null);
  const fileSelectResolve = useRef<((files: FileList) => void) | null>(null);

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
  const HAS_ASSETS_CHIPS = ["Upload files", "I'll paste instead", "Looks right", "Fix something", "I'll describe it", "Create one for me", "I have stuff like that", "Actually, build it for me"];
  const handleChipTap = (messageId: string, chip: string) => {
    // Has-assets flow chips — all resolve through importConfirmResolve
    if (HAS_ASSETS_CHIPS.includes(chip) && (phase === "hasAssets" || phase === "hasAssetsChoice")) {
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
      addMsg({ type: "zappy-bubble", mood: "idle", text: "One thing before we start — do you already have your own offer, method, or lead magnet? If you do, I'll use yours. If not, I'll build everything from scratch." });
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
              onFileSelect={(msgId, files) => {
                // Remove the file-upload message after selection
                setMessages(prev => prev.filter(m => m.id !== msgId));
                messagesRef.current = messagesRef.current.filter(m => m.id !== msgId);
                addMsg({ type: "user-bubble", text: `${files.length} file${files.length > 1 ? "s" : ""} selected` });
                if (fileSelectResolve.current) { fileSelectResolve.current(files); fileSelectResolve.current = null; }
              }}
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
