/**
 * CampaignDashboard — Item 2.1 / Item 2.3
 *
 * Full page wrapped in .zap-onboarding design system.
 * Item 2.3: Generate All Missing — real sequential mutation logic with progress modal.
 */
import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, Download, Zap, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CampaignCreativesDialog } from "@/components/CampaignCreativesDialog";
import { CampaignCreativesSection } from "@/components/CampaignCreativesSection";
import GuidedCampaignBuilder from "@/components/GuidedCampaignBuilder";
import { GenerateAllProgressModal, StepState } from "@/components/GenerateAllProgressModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Step definitions (Step 5 / ICP is auto-generated, omitted from the run list) ──
const GENERATE_STEPS: { id: number; label: string }[] = [
  { id: 1, label: "Your Sales Offer" },
  { id: 2, label: "Your Unique Method" },
  { id: 3, label: "Your Free Opt-In" },
  { id: 4, label: "Your Headlines" },
  { id: 6, label: "Your Ads" },
  { id: 7, label: "Your Ad Images" },
  { id: 8, label: "Your Ad Videos" },
  { id: 9, label: "Your Landing Page" },
  { id: 10, label: "Your Email Follow-Up" },
  { id: 11, label: "Your WhatsApp Follow-Up" },
];

// ── Null-fallback helper ─────────────────────────────────────────────────────
function requireField(value: string | null | undefined, fieldName: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(
      `Step skipped — "${fieldName}" is missing from your service profile. Open your service and fill in the "${fieldName}" field, then retry.`
    );
  }
  return trimmed;
}

// ── Truncate helper — prevents Zod max-length violations ─────────────────────
function trunc(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 3) + "..." : value;
}

export default function CampaignDashboard() {
  const { id } = useParams<{ id: string }>();
  const campaignId = id ? parseInt(id) : null;

  // ── Modal state ──────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const cancelledRef = useRef(false);

  const [isCreativesDialogOpen, setIsCreativesDialogOpen] = useState(false);
  // ── Route guard dialog (in-app navigation interception) ──────────────────
  const [routeGuardOpen, setRouteGuardOpen] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [, navigate] = useLocation();

  const handleNavAttempt = (target: string) => {
    if (isRunning) {
      setPendingNavTarget(target);
      setRouteGuardOpen(true);
    } else {
      navigate(target);
    }
  };

  const handleMinimiseModal = () => {
    setModalOpen(false);
  };

  const utils = trpc.useUtils();

  const { data: campaign, isLoading } = trpc.campaigns.getById.useQuery(
    { id: campaignId! },
    { enabled: !!campaignId }
  );

  // ── Video credit balance (fetched to check BEFORE script generation) ─────
  const { data: creditBalance } = trpc.videoCredits.getBalance.useQuery(undefined, {
    enabled: !!campaignId,
  });

  // ── Generator mutations (ALL hooks MUST be above any early returns) ──────
  const generateOffer = trpc.offers.generate.useMutation();
  const generateHeroMechanism = trpc.heroMechanisms.generate.useMutation();
  const generateHvco = trpc.hvco.generate.useMutation();
  const generateHeadlines = trpc.headlines.generate.useMutation();
  const generateAdCopy = trpc.adCopy.generate.useMutation();
  const generateAdCreatives = trpc.adCreatives.generate.useMutation();
  const generateVideoScript = trpc.videoScripts.generate.useMutation();
  const generateVideo = trpc.videos.generate.useMutation();
  const generateLandingPage = trpc.landingPages.generate.useMutation();
  const generateEmailSequence = trpc.emailSequences.generate.useMutation();
  const generateWhatsAppSequence = trpc.whatsappSequences.generate.useMutation();

  // ── Route guard: block browser navigation while running ──────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning) {
        e.preventDefault();
        e.returnValue = "Generation is in progress. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning]);

  // Dispatch a custom event so DashboardLayout can disable sidebar links
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("zap:generation-running", { detail: { running: isRunning } }));
  }, [isRunning]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="zap-onboarding" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 32, height: 32, color: "var(--charge)" }} className="animate-spin" />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!campaign) {
    return (
      <div className="zap-onboarding" style={{ padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--ink-2)", marginBottom: "16px" }}>Campaign not found</p>
        <Link href="/campaigns">
          <button className="btn-primary" style={{ width: "auto", padding: "12px 24px" }}>
            Back to Campaigns
          </button>
        </Link>
      </div>
    );
  }

  // ── Update a single step's status ────────────────────────────────────────
  const updateStep = (stepId: number, update: Partial<StepState>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...update } : s))
    );
  };

  // ── Run a single step ─────────────────────────────────────────────────────
  const runStep = async (stepId: number, service: any, cId: number) => {
    updateStep(stepId, { status: "running", error: undefined });
    try {
      switch (stepId) {
        case 1: {
          await generateOffer.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            offerType: "standard",
          });
          break;
        }
        case 2: {
          const targetMarket = requireField(service.targetCustomer, "Target Customer");
          const pressingProblem = requireField(service.painPoints || service.mainBenefit, "Pain Points");
          const whyProblem = requireField(service.whyProblemExists || service.description, "Why Problem Exists");
          const whatTried = requireField(service.failedSolutions || service.description, "Failed Solutions");
          const whyExistingNotWork = requireField(service.hiddenReasons || service.description, "Hidden Reasons");
          const desiredOutcome = requireField(service.mainBenefit, "Main Benefit");
          const credibility = requireField(service.name, "Service Name");
          const socialProof = (service.pressFeatures || service.name || "").trim() || service.name;
          await generateHeroMechanism.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            targetMarket: trunc(targetMarket, 100),
            pressingProblem: trunc(pressingProblem, 200),
            whyProblem: trunc(whyProblem, 300),
            whatTried: trunc(whatTried, 300),
            whyExistingNotWork: trunc(whyExistingNotWork, 300),
            desiredOutcome: trunc(desiredOutcome, 200),
            credibility: trunc(credibility, 200),
            socialProof: trunc(socialProof, 200),
            descriptor: service.mechanismDescriptor ? trunc(service.mechanismDescriptor, 50) : undefined,
            application: service.applicationMethod ? trunc(service.applicationMethod, 100) : undefined,
          });
          break;
        }
        case 3: {
          const targetMarket3 = requireField(service.targetCustomer, "Target Customer");
          const hvcoTopic = requireField(service.hvcoTopic || service.description, "Free Opt-In Topic");
          await generateHvco.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            targetMarket: targetMarket3,
            hvcoTopic,
          });
          break;
        }
        case 4: {
          const targetMarket4 = requireField(service.targetCustomer, "Target Customer");
          await generateHeadlines.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            targetMarket: targetMarket4,
            pressingProblem: service.painPoints || "",
            desiredOutcome: service.mainBenefit || "",
            uniqueMechanism: service.uniqueMechanismSuggestion || "",
          });
          break;
        }
        case 6: {
          const targetMarket6 = requireField(service.targetCustomer, "Target Customer");
          const productCategory = requireField(service.category, "Category");
          const specificProductName = requireField(service.name, "Service Name");
          const pressingProblem6 = requireField(service.painPoints || service.mainBenefit, "Pain Points");
          const desiredOutcome6 = requireField(service.mainBenefit, "Main Benefit");
          await generateAdCopy.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            adStyle: "story",
            adCallToAction: "Learn More",
            targetMarket: targetMarket6,
            productCategory,
            specificProductName,
            pressingProblem: pressingProblem6,
            desiredOutcome: desiredOutcome6,
            uniqueMechanism: service.uniqueMechanismSuggestion || undefined,
            credibleAuthority: service.name || undefined,
            featuredIn: service.pressFeatures || undefined,
          });
          break;
        }
        case 7: {
          const niche = requireField(service.category, "Category");
          const productName7 = requireField(service.name, "Service Name");
          const targetAudience7 = requireField(service.targetCustomer, "Target Customer");
          const mainBenefit7 = requireField(service.mainBenefit, "Main Benefit");
          const pressingProblem7 = requireField(service.painPoints || service.mainBenefit, "Pain Points");
          await generateAdCreatives.mutateAsync({
            serviceId: service.id,
            niche,
            productName: productName7,
            targetAudience: targetAudience7,
            mainBenefit: mainBenefit7,
            pressingProblem: pressingProblem7,
            uniqueMechanism: service.uniqueMechanismSuggestion || "",
            adType: "lead_gen",
          });
          break;
        }
        case 8: {
          // Credit check FIRST — before any script generation
          const balance = creditBalance?.balance ?? 0;
          if (balance < 1) {
            throw new Error(
              `Insufficient video credits — need 1, have ${balance}. Purchase credits to generate videos.`
            );
          }
          const scriptResult = await generateVideoScript.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            videoType: "explainer",
            duration: "30",
            visualStyle: "motion_graphics",
          });
          await generateVideo.mutateAsync({
            scriptId: scriptResult.scriptId,
            visualStyle: "motion_graphics",
          });
          break;
        }
        case 9: {
          await generateLandingPage.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            avatarName: service.avatarName || undefined,
            avatarDescription: service.avatarTitle || undefined,
          });
          break;
        }
        case 10: {
          const serviceName10 = requireField(service.name, "Service Name");
          await generateEmailSequence.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            sequenceType: "welcome",
            name: `${serviceName10} Welcome Sequence`,
          });
          break;
        }
        case 11: {
          const serviceName11 = requireField(service.name, "Service Name");
          await generateWhatsAppSequence.mutateAsync({
            serviceId: service.id,
            campaignId: cId,
            sequenceType: "engagement",
            name: `${serviceName11} WhatsApp Sequence`,
          });
          break;
        }
        default:
          throw new Error(`Unknown step ${stepId}`);
      }
      updateStep(stepId, { status: "done" });
    } catch (err: any) {
      updateStep(stepId, {
        status: "failed",
        error: err?.message || "Generation failed — please retry",
      });
    }
  };

  // ── Map step id → assetCounts key — used to pre-fill completed steps on re-open ─
  const STEP_ASSET_KEY: Record<number, string> = {
    1: "offer",
    2: "hero_mechanism",
    3: "hvco",
    4: "headline",
    6: "ad_copy",
    7: "ad_creatives",
    8: "videos",
    9: "landing_page",
    10: "email_sequence",
    11: "whatsapp_sequence",
  };

  // ── Main generate-all handler — opens modal in preview state first ──────────
  const handleGenerateAll = () => {
    if (!campaignId || !campaign?.service) {
      toast.error("Campaign service not found. Please link a service first.");
      return;
    }
    const counts = (campaign.assetCounts as Record<string, number>) ?? {};
    const initialSteps: StepState[] = GENERATE_STEPS.map((s) => {
      const key = STEP_ASSET_KEY[s.id];
      const alreadyDone = key ? (counts[key] ?? 0) > 0 : false;
      return {
        id: s.id,
        label: s.label,
        status: alreadyDone ? "done" : "queued",
      };
    });
    setSteps(initialSteps);
    cancelledRef.current = false;
    setIsRunning(false); // open in preview state — completed steps show green, queued show grey
    setModalOpen(true);
  };

  // ── Start the actual generation run (called from modal Start button) ────────
  const handleStartRun = async () => {
    if (!campaignId || !campaign?.service) return;
    const service = campaign.service;
    setIsRunning(true);
    for (const step of GENERATE_STEPS) {
      if (cancelledRef.current) break;
      await runStep(step.id, service, campaignId);
      utils.campaigns.getById.invalidate({ id: campaignId });
    }
    setIsRunning(false);
    utils.campaigns.getById.invalidate({ id: campaignId });
  };

  // ── Retry a single failed step ────────────────────────────────────────────
  const handleRetry = async (stepId: number) => {
    if (!campaignId || !campaign?.service) return;
    setIsRunning(true);
    cancelledRef.current = false;
    await runStep(stepId, campaign.service, campaignId);
    setIsRunning(false);
    utils.campaigns.getById.invalidate({ id: campaignId });
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    cancelledRef.current = true;
    setSteps((prev) =>
      prev.map((s) => (s.status === "queued" ? { ...s, status: "skipped" } : s))
    );
  };

  // ── Close modal ───────────────────────────────────────────────────────────
  const handleCloseModal = () => {
    if (isRunning) return;
    setModalOpen(false);
  };

    // ── Export handler (fetch + blob URL for authenticated download) ────────
  const handleExportCampaign = async () => {
    if (!campaignId || isExporting) return;
    setIsExporting(true);
    toast.info("Preparing your campaign ZIP… download will start shortly.");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/export-zip`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from Content-Disposition header if present
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : `campaign-${campaignId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Campaign ZIP downloaded successfully.");
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const isGenerating = isRunning;

  return (
    <div className="zap-onboarding" style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <button
              onClick={() => handleNavAttempt("/campaigns")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "'Instrument Sans', sans-serif",
                fontSize: "13px",
                color: "var(--ink-3)",
                padding: "0 0 10px 0",
                transition: "color 150ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-3)")}
            >
              <ArrowLeft size={14} />
              All Campaigns
            </button>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: "28px",
                color: "var(--ink)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {campaign.name}
            </h1>
            {campaign.description && (
              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: "14px", color: "var(--ink-2)", margin: "6px 0 0 0" }}>
                {campaign.description}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={handleExportCampaign}
              disabled={isExporting}
              style={{
                background: "transparent",
                border: "1.5px solid var(--ink-4)",
                borderRadius: "10px",
                padding: "9px 16px",
                cursor: isExporting ? "not-allowed" : "pointer",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "13px",
                color: "var(--ink-2)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                opacity: isExporting ? 0.6 : 1,
                transition: "border-color 150ms ease, opacity 150ms ease",
              }}
              onMouseEnter={e => { if (!isExporting) e.currentTarget.style.borderColor = "var(--ink-2)"; }}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--ink-4)")}
            >
              {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {isExporting ? "Preparing ZIP…" : "Export Campaign"}
            </button>
            <button
              onClick={isGenerating ? () => setModalOpen(true) : handleGenerateAll}
              style={{
                background: isGenerating ? "var(--charge)" : "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "9px 16px",
                cursor: "pointer",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "opacity 150ms ease",
              }}
            >
              {isGenerating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Zap size={15} />
              )}
              {isGenerating ? "Generating…" : "Generate All Missing"}
            </button>
          </div>
        </div>

        {/* ── Guided Campaign Builder (replaces old tile grid) ─────────────── */}
        <GuidedCampaignBuilder campaign={{
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          campaignType: campaign.campaignType,
          icpId: campaign.icpId,
          serviceId: campaign.serviceId,
          assetCounts: campaign.assetCounts as any,
        }} />

        {/* ── Ad Creatives Dialog ──────────────────────────────────────────── */}
        <CampaignCreativesDialog
          open={isCreativesDialogOpen}
          onOpenChange={setIsCreativesDialogOpen}
          campaignId={campaignId!}
          serviceId={campaign.serviceId}
          onSuccess={() => {
            window.location.reload();
          }}
        />

        {/* ── Campaign Creatives Section ───────────────────────────────────── */}
        <div style={{ marginTop: "48px" }}>
          <CampaignCreativesSection campaignId={campaignId!} />
        </div>

        {/* ── Linked Service Card ──────────────────────────────────────────── */}
        {campaign.service && (
          <div style={{
            marginTop: "32px",
            background: "var(--card)",
            borderRadius: "var(--rL)",
            boxShadow: "var(--sh-sm)",
            border: "1.5px solid var(--ink-4)",
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}>
            <div>
              <p style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 700,
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
                margin: "0 0 6px 0",
              }}>
                Linked Service
              </p>
              <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 700, fontSize: "20px", color: "var(--ink)", margin: 0 }}>
                {campaign.service.name}
              </p>
              {campaign.service.description && (
                <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: "13px", color: "var(--ink-2)", margin: "4px 0 0 0" }}>
                  {campaign.service.description}
                </p>
              )}
            </div>
            <Link href={`/services/${campaign.service.id}`}>
              <button style={{
                background: "transparent",
                border: "1.5px solid var(--ink-4)",
                borderRadius: "10px",
                padding: "9px 16px",
                cursor: "pointer",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "13px",
                color: "var(--ink-2)",
                transition: "border-color 150ms ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--ink-2)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--ink-4)")}
              >
                Edit Service
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* ── Route Guard Dialog ───────────────────────────────────────────────── */}
      <AlertDialog open={routeGuardOpen} onOpenChange={setRouteGuardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generation in progress</AlertDialogTitle>
            <AlertDialogDescription>
              Your campaign is still being generated. If you leave now, the current run will be cancelled and any incomplete steps will need to be retried manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRouteGuardOpen(false)}>Stay on page</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cancelledRef.current = true;
                setIsRunning(false);
                setRouteGuardOpen(false);
                if (pendingNavTarget) navigate(pendingNavTarget);
              }}
              style={{ background: "var(--charge)", color: "white" }}
            >
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Generate All Progress Modal ──────────────────────────────────────── */}
      <GenerateAllProgressModal
        open={modalOpen}
        steps={steps}
        cancelledRef={cancelledRef}
        onStart={handleStartRun}
        onCancel={handleCancel}
        onClose={handleCloseModal}
        onRetry={handleRetry}
        onMinimise={handleMinimiseModal}
        isRunning={isRunning}
      />
    </div>
  );
}
