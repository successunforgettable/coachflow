/**
 * CampaignDashboard — Item 2.1
 *
 * Full page wrapped in .zap-onboarding design system.
 * The old tile grid is replaced by GuidedCampaignBuilder.
 * Header, Export/GenerateAll stubs, CampaignCreativesSection, and Service card are preserved.
 */

import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Zap, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CampaignCreativesDialog } from "@/components/CampaignCreativesDialog";
import { CampaignCreativesSection } from "@/components/CampaignCreativesSection";
import GuidedCampaignBuilder from "@/components/GuidedCampaignBuilder";

export default function CampaignDashboard() {
  const { id } = useParams<{ id: string }>();
  const campaignId = id ? parseInt(id) : null;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreativesDialogOpen, setIsCreativesDialogOpen] = useState(false);

  const { data: campaign, isLoading } = trpc.campaigns.getById.useQuery(
    { id: campaignId! },
    { enabled: !!campaignId }
  );

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

  // ── Stubs: Generate All Missing (Item 2.3) and Export Campaign (Item 2.4) ──
  const handleGenerateAll = async () => {
    if (!campaignId) return;
    setIsGenerating(true);
    toast.info("Generating all missing assets… This may take a few minutes.");
    try {
      // Item 2.3 will implement this
      toast.info("Generate All Missing — coming in Item 2.3");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate assets");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCampaign = async () => {
    if (!campaignId) return;
    toast.info("Export Campaign — coming in Item 2.4");
  };

  return (
    <div className="zap-onboarding" style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link href="/campaigns">
              <button style={{
                background: "transparent",
                border: "1.5px solid var(--ink-4)",
                borderRadius: "10px",
                padding: "8px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: "var(--ink-2)",
                transition: "border-color 150ms ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--ink-2)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--ink-4)")}
              >
                <ArrowLeft size={18} />
              </button>
            </Link>
            <div>
              <h1 style={{ margin: 0, lineHeight: 1.1 }}>{campaign.name}</h1>
              <p style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontSize: "14px",
                color: "var(--ink-2)",
                margin: "4px 0 0 0",
              }}>
                {campaign.description || "Campaign Dashboard"}
                {campaign.campaignType && (
                  <span style={{
                    marginLeft: "10px",
                    background: "var(--cg)",
                    color: "var(--charge)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "capitalize",
                    letterSpacing: "0.04em",
                  }}>
                    {campaign.campaignType.replace("_", " ")}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Header action buttons — stubs for Items 2.3 and 2.4 */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={handleExportCampaign}
              style={{
                background: "transparent",
                border: "1.5px solid var(--ink-4)",
                borderRadius: "10px",
                padding: "9px 16px",
                cursor: "pointer",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "13px",
                color: "var(--ink-2)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "border-color 150ms ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--ink-2)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--ink-4)")}
            >
              <Download size={15} />
              Export Campaign
            </button>
            <button
              onClick={handleGenerateAll}
              disabled={isGenerating}
              style={{
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "9px 16px",
                cursor: isGenerating ? "not-allowed" : "pointer",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                opacity: isGenerating ? 0.6 : 1,
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
    </div>
  );
}
