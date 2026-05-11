/**
 * V2CampaignKit — Campaign Kit review page
 * Route: /v2-dashboard/campaign-kit/:kitId
 * Shows all selected assets in one scrollable page with export actions.
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import V2Layout from "./V2Layout";
import ZappyMascot from "./ZappyMascot";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { downloadCampaignBrief } from "./lib/exportUtils";

// ─── Asset section config ──────────────────────────────────────────────────────
const SECTIONS = [
  { key: "selectedOfferId", label: "Offer", step: "offer", query: "offers" },
  { key: "selectedMechanismId", label: "Unique Method", step: "uniqueMethod", query: "heroMechanisms" },
  { key: "selectedHvcoId", label: "Lead Magnet", step: "freeOptIn", query: "hvco" },
  { key: "selectedHeadlineId", label: "Headline", step: "headlines", query: "headlines" },
  { key: "selectedAdCopyId", label: "Ad Copy", step: "adCopy", query: "adCopy" },
  { key: "selectedLandingPageId", label: "Landing Page", step: "landingPage", query: "landingPages" },
  { key: "selectedEmailSequenceId", label: "Email Sequence", step: "emailSequence", query: "emailSequences" },
  { key: "selectedWhatsAppSequenceId", label: "WhatsApp Sequence", step: "whatsappSequence", query: "whatsappSequences" },
] as const;

// ─── Content preview helpers ───────────────────────────────────────────────────
function OfferPreview({ data }: { data: any }) {
  if (!data) return null;
  const angle = data.godfatherAngle || data.freeAngle || data.dollarAngle;
  const parsed = typeof angle === "string" ? JSON.parse(angle) : angle;
  return (
    <div>
      <p style={previewHeading}>{parsed?.offerName || "Offer"}</p>
      <p style={previewBody}>{parsed?.valueProposition || ""}</p>
      <p style={previewMuted}>Pricing: {parsed?.pricing || "—"}</p>
    </div>
  );
}

function MechanismPreview({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div>
      <p style={previewHeading}>{data.mechanismName || "Mechanism"}</p>
      <p style={previewBody}>{data.mechanismDescription || ""}</p>
    </div>
  );
}

function HvcoPreview({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div>
      <p style={previewHeading}>{data.title || "Lead Magnet"}</p>
    </div>
  );
}

function HeadlinePreview({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div>
      <p style={previewHeading}>{data.headline || "Headline"}</p>
      {data.subheadline && <p style={previewMuted}>{data.subheadline}</p>}
    </div>
  );
}

function AdCopyPreview({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div>
      <p style={previewHeading}>{data.content?.substring(0, 120) || "Ad Copy"}...</p>
    </div>
  );
}

function LandingPagePreview({ data, angle }: { data: any; angle?: string }) {
  if (!data) return null;
  const angleData = angle === "godfather" ? data.godfatherAngle : angle === "free" ? data.freeAngle : angle === "dollar" ? data.dollarAngle : data.originalAngle;
  const parsed = typeof angleData === "string" ? JSON.parse(angleData) : angleData;
  return (
    <div>
      <p style={previewHeading}>{parsed?.mainHeadline || "Landing Page"}</p>
      <p style={previewBody}>{parsed?.subheadline || ""}</p>
      <p style={previewMuted}>Angle: {angle || "original"}</p>
    </div>
  );
}

function EmailPreview({ data }: { data: any }) {
  if (!data) return null;
  const emails = typeof data.emails === "string" ? JSON.parse(data.emails) : (data.emails || []);
  return (
    <div>
      <p style={previewHeading}>{data.name || "Email Sequence"}</p>
      <p style={previewMuted}>{emails.length} emails</p>
      {emails.slice(0, 3).map((e: any, i: number) => (
        <p key={i} style={{ ...previewBody, fontSize: "12px", margin: "2px 0" }}>
          {i + 1}. {e.subject || "Untitled"}
        </p>
      ))}
    </div>
  );
}

function WhatsAppPreview({ data }: { data: any }) {
  if (!data) return null;
  const messages = typeof data.messages === "string" ? JSON.parse(data.messages) : (data.messages || []);
  return (
    <div>
      <p style={previewHeading}>{data.name || "WhatsApp Sequence"}</p>
      <p style={previewMuted}>{messages.length} messages</p>
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const previewHeading: React.CSSProperties = {
  fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--v2-text-dark, #1A1624)",
  margin: "0 0 4px",
};
const previewBody: React.CSSProperties = {
  fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
  fontSize: "13px",
  color: "var(--v2-text-dark, #1A1624)",
  margin: "0 0 4px",
  lineHeight: 1.5,
};
const previewMuted: React.CSSProperties = {
  fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
  fontSize: "12px",
  color: "#999",
  margin: 0,
};

// ─── Asset content fetcher component ───────────────────────────────────────────
function AssetSection({ sectionKey, label, step, selectedId, angle, navigate }: {
  sectionKey: string;
  label: string;
  step: string;
  selectedId: number | null;
  angle?: string;
  navigate: (path: string) => void;
}) {
  // Fetch the actual content for each selected asset
  const offerQuery = trpc.offers.get.useQuery({ id: selectedId! }, { enabled: sectionKey === "selectedOfferId" && !!selectedId });
  const mechQuery = trpc.heroMechanisms.get.useQuery({ id: selectedId! }, { enabled: sectionKey === "selectedMechanismId" && !!selectedId });
  const hvcoQuery = trpc.hvco.get.useQuery({ id: selectedId! }, { enabled: sectionKey === "selectedHvcoId" && !!selectedId });
  const headlineQuery = trpc.headlines.get.useQuery({ id: selectedId! }, { enabled: sectionKey === "selectedHeadlineId" && !!selectedId });
  const adCopyQuery = trpc.adCopy.get.useQuery({ id: selectedId! }, { enabled: sectionKey === "selectedAdCopyId" && !!selectedId });
  const lpQuery = trpc.landingPages.get.useQuery({ id: selectedId! }, { enabled: sectionKey === "selectedLandingPageId" && !!selectedId });
  const emailQuery = trpc.emailSequences.get.useQuery({ id: selectedId! }, { enabled: sectionKey === "selectedEmailSequenceId" && !!selectedId });
  const waQuery = trpc.whatsappSequences.get.useQuery({ id: selectedId! }, { enabled: sectionKey === "selectedWhatsAppSequenceId" && !!selectedId });

  const isEmpty = !selectedId;

  return (
    <div style={{ marginBottom: "20px" }}>
      {/* Section label */}
      <p style={{
        fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--v2-primary-btn, #FF5B1D)",
        margin: "0 0 8px",
      }}>
        {label}
      </p>

      {isEmpty ? (
        /* Empty placeholder */
        <div style={{
          border: "2px dashed #ddd",
          borderRadius: "16px",
          padding: "24px",
          textAlign: "center",
        }}>
          <p style={{ ...previewMuted, marginBottom: "12px" }}>Not selected yet</p>
          <button
            onClick={() => navigate(`/v2-dashboard/wizard/${step}`)}
            style={{
              background: "transparent",
              border: "2px solid var(--v2-primary-btn, #FF5B1D)",
              color: "var(--v2-primary-btn, #FF5B1D)",
              borderRadius: "var(--v2-border-radius-pill, 9999px)",
              padding: "8px 20px",
              fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Select Now
          </button>
        </div>
      ) : (
        /* Content preview card */
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "20px",
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          {sectionKey === "selectedOfferId" && <OfferPreview data={offerQuery.data} />}
          {sectionKey === "selectedMechanismId" && <MechanismPreview data={mechQuery.data} />}
          {sectionKey === "selectedHvcoId" && <HvcoPreview data={hvcoQuery.data} />}
          {sectionKey === "selectedHeadlineId" && <HeadlinePreview data={headlineQuery.data} />}
          {sectionKey === "selectedAdCopyId" && <AdCopyPreview data={adCopyQuery.data} />}
          {sectionKey === "selectedLandingPageId" && <LandingPagePreview data={lpQuery.data} angle={angle} />}
          {sectionKey === "selectedEmailSequenceId" && <EmailPreview data={emailQuery.data} />}
          {sectionKey === "selectedWhatsAppSequenceId" && <WhatsAppPreview data={waQuery.data} />}

          <button
            onClick={() => navigate(`/v2-dashboard/wizard/${step}`)}
            style={{
              marginTop: "12px",
              background: "transparent",
              border: "1px solid #ddd",
              borderRadius: "var(--v2-border-radius-pill, 9999px)",
              padding: "6px 16px",
              fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
              fontWeight: 600,
              fontSize: "12px",
              color: "#666",
              cursor: "pointer",
            }}
          >
            Swap
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page component ───────────────────────────────────────────────────────
export default function V2CampaignKit() {
  const [, navigate] = useLocation();
  const params = useParams<{ kitId: string }>();
  const kitId = params.kitId ? Number(params.kitId) : null;
  const [timedOut, setTimedOut] = useState(false);

  // Debug log
  useEffect(() => {
    console.log("[CampaignKit] params:", params, "kitId:", kitId);
  }, [kitId]);

  // Timeout fallback
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(t);
  }, []);

  const { data: kit, isLoading, isError, error } = trpc.campaignKits.getById.useQuery(
    { kitId: kitId! },
    { enabled: !!kitId && !isNaN(kitId) }
  );

  // Fetch ICP name
  const { data: icpData } = trpc.icps.get.useQuery(
    { id: kit?.icpId! },
    { enabled: !!kit?.icpId }
  );

  // Brief data queries
  const { data: briefOffer } = trpc.offers.get.useQuery({ id: kit?.selectedOfferId! }, { enabled: !!kit?.selectedOfferId });
  const { data: briefMech } = trpc.heroMechanisms.get.useQuery({ id: kit?.selectedMechanismId! }, { enabled: !!kit?.selectedMechanismId });
  const { data: briefHvco } = trpc.hvco.get.useQuery({ id: kit?.selectedHvcoId! }, { enabled: !!kit?.selectedHvcoId });
  const { data: briefHeadline } = trpc.headlines.get.useQuery({ id: kit?.selectedHeadlineId! }, { enabled: !!kit?.selectedHeadlineId });
  const { data: briefAdCopy } = trpc.adCopy.get.useQuery({ id: kit?.selectedAdCopyId! }, { enabled: !!kit?.selectedAdCopyId });
  const { data: briefLP } = trpc.landingPages.get.useQuery({ id: kit?.selectedLandingPageId! }, { enabled: !!kit?.selectedLandingPageId });
  const { data: briefEmail } = trpc.emailSequences.get.useQuery({ id: kit?.selectedEmailSequenceId! }, { enabled: !!kit?.selectedEmailSequenceId });

  // B4: post-Auto-Mode greeting overlay. Shows once per kit when the user
  // arrives via /v2-dashboard/campaign-kit/<id>?from=auto-mode (the redirect
  // V2AutoModeProgress fires on cascade complete). localStorage key persists
  // the dismissal so the overlay does not reappear on subsequent visits.
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (!kit || kitId == null) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "auto-mode") return;
    try {
      if (localStorage.getItem(`autoMode_kit_${kitId}_greeted`)) return;
    } catch { /* private mode / disabled storage — fall through and show */ }
    setShowOverlay(true);
  }, [kit, kitId]);

  function dismissOverlay() {
    if (kitId != null) {
      try { localStorage.setItem(`autoMode_kit_${kitId}_greeted`, "true"); } catch { /* non-fatal */ }
    }
    setShowOverlay(false);
  }

  // Shared push handler — single source of truth for the placeholder toast
  // (Node 11 push surface not yet built). Called from both the floating
  // action bar's "Push to Meta / GHL" button and the greeting overlay's
  // primary CTA so a future swap to the real push lands in one place.
  const handlePush = () => toast("Push coming soon");

  const handleDownloadBrief = () => {
    const icp = icpData as any;
    const offer = briefOffer as any;
    const mech = briefMech as any;
    const hvco = briefHvco as any;
    const headline = briefHeadline as any;
    const adCopy = briefAdCopy as any;
    const lp = briefLP as any;
    const email = briefEmail as any;

    // Extract ICP summary (top 3 pain points)
    const icpSummary = [icp?.pains, icp?.frustrations, icp?.goals].filter(Boolean).map((s: string) => s.split("\n")[0]).join("\n• ");

    // Extract offer name from active angle
    const offerAngle = offer?.godfatherAngle ? (typeof offer.godfatherAngle === "string" ? JSON.parse(offer.godfatherAngle) : offer.godfatherAngle) : null;
    const offerName = offerAngle?.offerName || offer?.productName || "";

    // Mechanism name
    const mechanismName = mech?.mechanismName || "";

    // HVCO title
    const hvcoTitle = hvco?.title || "";

    // Headline text
    const headlineText = headline?.headline || "";

    // Ad hook (first line of first body)
    const adHook = adCopy?.content ? adCopy.content.split("\n")[0] : "";

    // Landing page headline
    const lpAngle = lp?.originalAngle ? (typeof lp.originalAngle === "string" ? JSON.parse(lp.originalAngle) : lp.originalAngle) : null;
    const lpHeadline = lpAngle?.mainHeadline || "";

    // Email 1 subject
    const emails = email?.emails ? (typeof email.emails === "string" ? JSON.parse(email.emails) : email.emails) : [];
    const email1Subject = Array.isArray(emails) && emails.length > 0 ? emails[0].subject || "" : "";

    downloadCampaignBrief({
      serviceName: kit?.name || "Campaign",
      icpSummary: icpSummary ? `• ${icpSummary}` : "",
      offerName,
      mechanismName,
      hvcoTitle,
      headline: headlineText,
      adHook,
      landingPageHeadline: lpHeadline,
      email1Subject,
    });
  };

  // Error state
  if (isError) {
    return (
      <V2Layout>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          <p style={{ fontFamily: "var(--v2-font-body)", color: "#C0390A", fontWeight: 700 }}>Failed to load Campaign Kit</p>
          <p style={{ fontFamily: "var(--v2-font-body)", color: "#999", fontSize: "13px" }}>{error?.message || "Unknown error"}</p>
          <p style={{ fontFamily: "var(--v2-font-body)", color: "#999", fontSize: "12px" }}>kitId from URL: {String(kitId)}</p>
          <a href="/v2-dashboard" style={{ fontFamily: "var(--v2-font-body)", color: "var(--v2-primary-btn, #FF5B1D)", fontSize: "13px" }}>← Back to Dashboard</a>
        </div>
      </V2Layout>
    );
  }

  // Invalid param
  if (!kitId || isNaN(kitId)) {
    return (
      <V2Layout>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          <p style={{ fontFamily: "var(--v2-font-body)", color: "#C0390A", fontWeight: 700 }}>Invalid Campaign Kit ID</p>
          <p style={{ fontFamily: "var(--v2-font-body)", color: "#999", fontSize: "12px" }}>Raw param: "{params.kitId}"</p>
          <a href="/v2-dashboard" style={{ fontFamily: "var(--v2-font-body)", color: "var(--v2-primary-btn, #FF5B1D)", fontSize: "13px" }}>← Back to Dashboard</a>
        </div>
      </V2Layout>
    );
  }

  if (isLoading || !kit) {
    return (
      <V2Layout>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <p style={{ fontFamily: "var(--v2-font-body)", color: "#999" }}>Loading Campaign Kit...</p>
          {timedOut && (
            <>
              <p style={{ fontFamily: "var(--v2-font-body)", color: "#C0390A", fontSize: "12px" }}>Still loading after 10s — kitId: {kitId}</p>
              <a href="/v2-dashboard" style={{ fontFamily: "var(--v2-font-body)", color: "var(--v2-primary-btn, #FF5B1D)", fontSize: "13px" }}>← Back to Dashboard</a>
            </>
          )}
        </div>
      </V2Layout>
    );
  }

  const filledCount = SECTIONS.filter(s => kit[s.key as keyof typeof kit] != null).length;
  const isComplete = kit.status === "complete";

  return (
    <V2Layout>
      {showOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-mode-greeting-heading"
          onClick={dismissOverlay}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,22,36,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
            zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "relative",
              background: "#ffffff",
              borderRadius: "24px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
              padding: "44px 36px 36px",
              maxWidth: "520px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <button
              aria-label="Dismiss"
              onClick={dismissOverlay}
              style={{
                position: "absolute",
                top: "14px",
                right: "16px",
                background: "transparent",
                border: "none",
                fontSize: "22px",
                lineHeight: 1,
                color: "#999",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ×
            </button>
            <ZappyMascot state="cheering" size={140} />
            <h2
              id="auto-mode-greeting-heading"
              style={{
                fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "clamp(24px, 5vw, 30px)",
                color: "var(--v2-text-dark, #1A1624)",
                lineHeight: 1.2,
                margin: "20px 0 12px",
              }}
            >
              Your campaign is built.
            </h2>
            <p
              style={{
                fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                fontSize: "14px",
                color: "#555",
                lineHeight: 1.55,
                margin: "0 0 28px",
                maxWidth: "420px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              All 9 assets generated and ready. Take a look around — or push live now.
            </p>
            <button
              onClick={() => { dismissOverlay(); handlePush(); }}
              style={{
                display: "block",
                width: "100%",
                background: "var(--v2-primary-btn, #FF5B1D)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--v2-border-radius-pill, 9999px)",
                padding: "14px 28px",
                fontSize: "16px",
                fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              Push Live to Meta + GHL →
            </button>
            <button
              onClick={dismissOverlay}
              style={{
                display: "block",
                width: "100%",
                background: "transparent",
                color: "#777",
                border: "1px solid rgba(26,22,36,0.15)",
                borderRadius: "var(--v2-border-radius-pill, 9999px)",
                padding: "12px 24px",
                fontSize: "14px",
                fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Look Around First
            </button>
          </div>
        </div>
      )}
      <div style={{
        minHeight: "100vh",
        padding: "48px 16px 120px",
        maxWidth: 720,
        margin: "0 auto",
      }}>
        {/* Back link */}
        <a
          href="/v2-dashboard"
          style={{
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontSize: "13px",
            color: "#999",
            textDecoration: "none",
            display: "inline-block",
            marginBottom: "24px",
          }}
        >
          ← Back to Dashboard
        </a>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: "28px",
              color: "var(--v2-text-dark, #1A1624)",
              margin: 0,
            }}>
              {kit.name || "Campaign Kit"}
            </h1>
            <span style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "var(--v2-border-radius-pill, 9999px)",
              background: isComplete ? "rgba(88,204,2,0.12)" : "rgba(255,91,29,0.12)",
              color: isComplete ? "#2E7D00" : "#FF5B1D",
              fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
              fontSize: "12px",
              fontWeight: 700,
            }}>
              {isComplete ? "Complete" : "In Progress"}
            </span>
          </div>
          <p style={{
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontSize: "14px",
            color: "#999",
            margin: "6px 0 0",
          }}>
            {(icpData as any)?.name || "Loading ICP..."} · {filledCount} of {SECTIONS.length} selected
          </p>
        </div>

        {/* Asset sections */}
        {SECTIONS.map(section => (
          <AssetSection
            key={section.key}
            sectionKey={section.key}
            label={section.label}
            step={section.step}
            selectedId={kit[section.key as keyof typeof kit] as number | null}
            angle={section.key === "selectedLandingPageId" ? (kit.selectedLandingPageAngle || "original") : undefined}
            navigate={navigate}
          />
        ))}
      </div>

      {/* Floating action bar */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#fff",
        borderTop: "1px solid #e5e0d8",
        padding: "14px 24px",
        display: "flex",
        justifyContent: "center",
        gap: "12px",
        zIndex: 100,
      }}>
        <button
          disabled={filledCount < 2}
          onClick={handleDownloadBrief}
          style={{
            padding: "10px 24px",
            borderRadius: "var(--v2-border-radius-pill, 9999px)",
            border: "none",
            background: filledCount >= 2 ? "var(--v2-primary-btn, #FF5B1D)" : "#e5e0d8",
            color: filledCount >= 2 ? "#fff" : "#999",
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontWeight: 700,
            fontSize: "14px",
            cursor: filledCount >= 2 ? "pointer" : "default",
          }}
        >
          📑 Download Campaign Brief
        </button>
        <button
          disabled={!isComplete}
          onClick={handlePush}
          style={{
            padding: "10px 24px",
            borderRadius: "var(--v2-border-radius-pill, 9999px)",
            border: isComplete ? "2px solid var(--v2-primary-btn, #FF5B1D)" : "2px solid #e5e0d8",
            background: "transparent",
            color: isComplete ? "var(--v2-primary-btn, #FF5B1D)" : "#999",
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontWeight: 700,
            fontSize: "14px",
            cursor: isComplete ? "pointer" : "default",
          }}
        >
          Push to Meta / GHL
        </button>
      </div>
    </V2Layout>
  );
}
