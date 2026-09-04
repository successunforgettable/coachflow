/**
 * V2CampaignKit — Campaign Kit review page
 * Route: /v2-dashboard/campaign-kit/:kitId
 * Shows all selected assets in one scrollable page with export actions.
 */
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation } from "wouter";
import V2Layout from "./V2Layout";
import ZappyMascot from "./ZappyMascot";
import PushKitModal from "./PushKitModal";
import V2QuizReviewModal from "./V2QuizReviewModal";
import KitPlaceholderBanner from "./components/KitPlaceholderBanner";
import ComplianceAdvisoryBanner from "./components/ComplianceAdvisoryBanner";
import PlaceholderEditor from "./components/PlaceholderEditor";
import V2OperatorIntake from "./components/V2OperatorIntake";
import { detectPlaceholders } from "./lib/placeholderDetector";
import { resolveTokensInObject, resolveTokensInText } from "./lib/resolveTokens";
import { trpc } from "@/lib/trpc";
import { downloadCampaignBrief, formatIcpTxt, downloadPdf } from "./lib/exportUtils";
import { isIcpRich } from "./lib/icpRichness";
import { downloadRemoteFile, adCreativeFilename } from "./lib/downloadImage";

// Lazy — the full 17-section reader is only mounted when the user opens the modal.
const V2ICPResultPanel = lazy(() => import("./V2ICPResultPanel"));

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
  const [showIntake, setShowIntake] = useState(false);
  const [justPublished, setJustPublished] = useState<string | null>(null);
  if (!data) return null;
  const angleData = angle === "godfather" ? data.godfatherAngle : angle === "free" ? data.freeAngle : angle === "dollar" ? data.dollarAngle : data.originalAngle;
  const parsed = typeof angleData === "string" ? JSON.parse(angleData) : angleData;
  // publicUrl is set by the orchestrator's auto-publish OR the operator intake below. When it's absent
  // the page ISN'T live — instead of the old silent state, surface a "finish your page" entry that opens
  // the Zappy-led operator intake (the token-driven conversation). This replaces the review-draft silence
  // (Finding 3): the coach is told the page needs a couple of details, and answering them makes it live.
  const publicUrl = justPublished || (data as { publicUrl?: string | null }).publicUrl;
  return (
    <div>
      <p style={previewHeading}>{parsed?.mainHeadline || "Landing Page"}</p>
      <p style={previewBody}>{parsed?.subheadline || ""}</p>
      <p style={previewMuted}>Angle: {angle || "original"}</p>
      {publicUrl ? (
        <p style={previewMuted}>
          Live at: <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--v2-primary-btn, #FF5B1D)", textDecoration: "underline" }}>{publicUrl} →</a>
        </p>
      ) : showIntake ? (
        <div style={{ marginTop: 12, border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", height: 480, display: "flex", flexDirection: "column" }}>
          <V2OperatorIntake landingPageId={data.id} onPublished={(u) => setJustPublished(u)} />
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 16, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 14 }}>
          <p style={{ ...previewMuted, marginBottom: 10 }}>This page isn't live yet — a couple of quick details will finish it.</p>
          <button type="button" onClick={() => setShowIntake(true)} style={{ padding: "10px 22px", borderRadius: 9999, background: "var(--v2-primary-btn, #FF5B1D)", color: "#fff", border: 0, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Finish your page →
          </button>
        </div>
      )}
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

// ─── Ad Creatives section (image thumbnails) ─────────────────────────────────
function AdCreativesSection({ batchId }: { batchId: string }) {
  const batchQuery = trpc.adCreatives.getBatch.useQuery({ batchId }, { enabled: !!batchId });
  const items = Array.isArray(batchQuery.data)
    ? batchQuery.data
    : Array.isArray((batchQuery.data as any)?.creatives)
      ? (batchQuery.data as any).creatives
      : [];
  // Keep the WHOLE row, not just the URL — the filename is built from
  // variationNumber / headlineFormula / headline, so a coach downloading four
  // of these can tell them apart in their Downloads folder.
  const creatives = (items as any[]).filter((c: any) => typeof c?.imageUrl === "string" && c.imageUrl.startsWith("http"));

  // Per-image download state, keyed by row id. Downloads are ~1MB and finish
  // fast, but a coach on hotel wifi needs to see that the click registered.
  const [downloading, setDownloading] = useState<Record<string, "busy" | "error">>({});

  async function handleDownload(creative: any) {
    const key = String(creative.id ?? creative.variationNumber ?? creative.imageUrl);
    setDownloading((s) => ({ ...s, [key]: "busy" }));
    try {
      await downloadRemoteFile(creative.imageUrl, adCreativeFilename(creative));
      setDownloading((s) => { const n = { ...s }; delete n[key]; return n; });
    } catch {
      setDownloading((s) => ({ ...s, [key]: "error" }));
      setTimeout(() => setDownloading((s) => { const n = { ...s }; delete n[key]; return n; }), 4000);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--v2-text-dark, #1A1624)",
        }}>
          Ad Images
        </span>
        {creatives.length > 0 && (
          <span style={{
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontSize: 11,
            color: "#999",
          }}>
            {creatives.length} images
          </span>
        )}
      </div>
      {creatives.length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 10,
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          {creatives.map((creative: any, i: number) => {
            const key = String(creative.id ?? creative.variationNumber ?? creative.imageUrl);
            const state = downloading[key];
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <a href={creative.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                  <img
                    src={creative.imageUrl}
                    alt={creative.headline || `Ad creative ${i + 1}`}
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      background: "#F3F4F6",
                      cursor: "pointer",
                    }}
                    loading="lazy"
                  />
                </a>
                <button
                  type="button"
                  onClick={() => handleDownload(creative)}
                  disabled={state === "busy"}
                  title={`Download ${adCreativeFilename(creative)}`}
                  style={{
                    fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 14px",
                    borderRadius: 9999,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: state === "error" ? "#FEF2F2" : "var(--v2-primary-btn, #1A1624)",
                    color: state === "error" ? "#B91C1C" : "#fff",
                    cursor: state === "busy" ? "default" : "pointer",
                    opacity: state === "busy" ? 0.6 : 1,
                    width: "100%",
                    lineHeight: 1.4,
                  }}
                >
                  {state === "busy" ? "Saving…" : state === "error" ? "Retry" : "Download"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          background: "#fff",
          borderRadius: 16,
          padding: "20px",
          border: "1px solid rgba(0,0,0,0.06)",
          textAlign: "center",
        }}>
          <p style={previewMuted}>
            {batchQuery.isLoading ? "Loading images..." : "No images generated yet."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Asset content fetcher component ───────────────────────────────────────────
function AssetSection({ sectionKey, label, step, selectedId, angle, navigate, serviceId, kitId, resolvedMap }: {
  sectionKey: string;
  label: string;
  step: string;
  selectedId: number | null;
  angle?: string;
  navigate: (path: string) => void;
  serviceId?: number;
  kitId: number;
  resolvedMap?: Record<string, string>;
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

  // Quiz review surface — a quiz lead magnet is a diagnostic instrument the coach
  // reviews (and brands) before it goes live. Derived from the hvco itself: quiz
  // format + no magnetHtmlUrl = review required (blocking); published = optional
  // review. Static magnets and non-quiz formats never show this.
  const [showQuizReview, setShowQuizReview] = useState(false);
  const hvcoData = hvcoQuery.data as { assetBody?: { format?: string } | null; magnetHtmlUrl?: string | null } | undefined;
  const isQuiz = sectionKey === "selectedHvcoId" && hvcoData?.assetBody?.format === "quiz";
  const quizNeedsReview = isQuiz && !hvcoData?.magnetHtmlUrl;

  const isEmpty = !selectedId;
  // Phase D Sprint 3: data-section-key anchor for KitPlaceholderBanner's
  // "Review & Complete" CTA scroll-to target. Inert otherwise.

  return (
    <div data-section-key={sectionKey} style={{ marginBottom: "20px" }}>
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
            onClick={() => navigate(`/v2-dashboard/trail/${kitId}?node=${step}`)}
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
          {/* Resolve [INSERT_*] tokens at render so filled registry values
              (e.g. price=£1,500) appear in the kit preview instead of the raw
              token. resolveTokensInObject is a no-op when resolvedMap is absent. */}
          {sectionKey === "selectedOfferId" && <OfferPreview data={resolveTokensInObject(offerQuery.data, resolvedMap)} />}
          {sectionKey === "selectedMechanismId" && <MechanismPreview data={resolveTokensInObject(mechQuery.data, resolvedMap)} />}
          {sectionKey === "selectedHvcoId" && <HvcoPreview data={resolveTokensInObject(hvcoQuery.data, resolvedMap)} />}
          {isQuiz && (
            <div style={{ marginTop: 14, padding: quizNeedsReview ? "14px 16px" : 0, background: quizNeedsReview ? "rgba(255,91,29,0.06)" : "transparent", border: quizNeedsReview ? "1px solid rgba(255,91,29,0.3)" : "none", borderRadius: 12 }}>
              {quizNeedsReview && (
                <p style={{ fontFamily: "var(--v2-font-body)", fontSize: 13, fontWeight: 600, color: "#a03c00", margin: "0 0 10px" }}>
                  Review required — your scorecard isn't live yet. Take a look, add your logo, and publish it.
                </p>
              )}
              <button
                onClick={() => setShowQuizReview(true)}
                style={{
                  background: quizNeedsReview ? "var(--v2-primary-btn, #FF5B1D)" : "transparent",
                  color: quizNeedsReview ? "#fff" : "#1A1624",
                  border: quizNeedsReview ? "none" : "1px solid #ddd",
                  borderRadius: "var(--v2-border-radius-pill, 9999px)",
                  padding: quizNeedsReview ? "10px 22px" : "6px 16px",
                  fontFamily: "var(--v2-font-body)", fontWeight: quizNeedsReview ? 700 : 600,
                  fontSize: 13, cursor: "pointer",
                }}
              >
                {quizNeedsReview ? "Review your scorecard →" : "Review your quiz"}
              </button>
            </div>
          )}
          {showQuizReview && selectedId && (
            <V2QuizReviewModal hvcoId={selectedId} onClose={() => { setShowQuizReview(false); hvcoQuery.refetch(); }} />
          )}
          {sectionKey === "selectedHeadlineId" && <HeadlinePreview data={resolveTokensInObject(headlineQuery.data, resolvedMap)} />}
          {sectionKey === "selectedAdCopyId" && <AdCopyPreview data={resolveTokensInObject(adCopyQuery.data, resolvedMap)} />}
          {sectionKey === "selectedLandingPageId" && <LandingPagePreview data={resolveTokensInObject(lpQuery.data, resolvedMap)} angle={angle} />}
          {sectionKey === "selectedEmailSequenceId" && <EmailPreview data={resolveTokensInObject(emailQuery.data, resolvedMap)} />}
          {sectionKey === "selectedWhatsAppSequenceId" && <WhatsAppPreview data={resolveTokensInObject(waQuery.data, resolvedMap)} />}

          <button
            onClick={() => {
              if (!window.confirm(`Swap your ${label.toLowerCase()}? This will take you to the trail to pick a new one.`)) return;
              navigate(`/v2-dashboard/trail/${kitId}?node=${step}&action=swap`);
            }}
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

// ─── Bonuses section (Layer 2) — the coach's reachable surface for the 3 hosted bonus PDFs ──────────────
// Reads bonuses.listForKit; shows title + shortLine + a Download PDF link when ready, or "Generating…" while
// the fire-and-forget PDF job runs (polls until all are ready). Renders nothing until bonuses exist.
function BonusesSection({ kitId }: { kitId: number }) {
  const q = trpc.bonuses.listForKit.useQuery(
    { campaignKitId: kitId },
    { refetchInterval: (query: any) => (Array.isArray(query?.state?.data) && query.state.data.some((b: any) => b.status !== "ready") ? 5000 : false) },
  );
  const list = q.data ?? [];
  if (list.length === 0) return null;
  const pill = "var(--v2-border-radius-pill, 9999px)";
  const bodyFont = "var(--v2-font-body, 'Instrument Sans', sans-serif)";
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontFamily: "var(--v2-font-heading, 'Fraunces', serif)", fontStyle: "italic", fontWeight: 900, fontSize: 18, color: "#1A1624", margin: "0 0 8px" }}>
        Your Bonuses
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((b) => (
          <div key={b.id} style={{ border: "1px solid #e5e0d8", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: 15, color: "#1A1624" }}>{b.title}</div>
              <div style={{ fontFamily: bodyFont, fontSize: 13, color: "#666", marginTop: 2 }}>{b.shortLine}</div>
            </div>
            {b.status === "ready" && b.pdfUrl ? (
              <a href={b.pdfUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0, background: "var(--v2-primary-btn, #FF6B35)", color: "#fff", borderRadius: pill, padding: "10px 20px", fontFamily: bodyFont, fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>↓ Download PDF</a>
            ) : (
              <span style={{ flexShrink: 0, fontFamily: bodyFont, fontSize: 13, color: "#999", whiteSpace: "nowrap" }}>Generating…</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page component ───────────────────────────────────────────────────────
export default function V2CampaignKit() {
  const utils = trpc.useUtils();
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
  const { data: advisoryData } = trpc.compliance.advisoriesForKit.useQuery(
    { campaignKitId: kitId! },
    { enabled: !!kitId && !isNaN(kitId) },
  );
  const complianceAdvisories = advisoryData?.advisories ?? [];
  const [rewordDone, setRewordDone] = useState(false);
  const rewordMutation = trpc.compliance.rewordForAdvisory.useMutation({
    onSuccess: () => {
      setRewordDone(true);
      utils.compliance.advisoriesForKit.invalidate();
      utils.campaignKits.getById.invalidate();
    },
  });

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
  // Phase D Sprint 3: additional queries needed for kit-level placeholder
  // detection across ALL assets (the existing brief queries above were scoped
  // to the campaign brief export feature). Loaded lazily — only enabled when
  // the kit has a selection for the respective asset.
  const { data: briefWa } = trpc.whatsappSequences.get.useQuery({ id: kit?.selectedWhatsAppSequenceId! }, { enabled: !!kit?.selectedWhatsAppSequenceId });
  const { data: briefAdCreatives } = trpc.adCreatives.getBatch.useQuery({ batchId: kit?.selectedAdCreativeBatchId! }, { enabled: !!kit?.selectedAdCreativeBatchId });

  // B4: post-Auto-Mode greeting overlay. Shows once per kit when the user
  // arrives via /v2-dashboard/campaign-kit/<id>?from=auto-mode (the redirect
  // V2AutoModeProgress fires on cascade complete). localStorage key persists
  // the dismissal so the overlay does not reappear on subsequent visits.
  const [showOverlay, setShowOverlay] = useState(false);
  const [showPlaceholderEditor, setShowPlaceholderEditor] = useState(false);
  // Sprint 2: Dream Buyer Profile discoverability — read-only modal on the kit page.
  const [showIcpModal, setShowIcpModal] = useState(false);

  // T2: all user kits for sequential number derivation
  const { data: allUserKits } = trpc.campaignKits.getByUser.useQuery(undefined, { staleTime: 30_000 });
  const campaignSeqNum = useMemo(() => {
    if (!allUserKits || !kitId) return null;
    const sorted = [...allUserKits].sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const idx = sorted.findIndex((k: any) => k.id === kitId);
    return idx >= 0 ? idx + 1 : null;
  }, [allUserKits, kitId]);
  const campaignDateStr = kit?.createdAt
    ? new Date(kit.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  // T2: inline rename
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameMut = trpc.campaignKits.updateName.useMutation();

  // Placeholder registry: resolve serviceId from ICP data
  const serviceId = (icpData as any)?.serviceId as number | undefined;
  const { data: placeholderEntries } = trpc.placeholders.list.useQuery(
    { serviceId: serviceId! },
    { enabled: !!serviceId },
  );
  const resolvedMap = useMemo(() => {
    if (!placeholderEntries) return undefined;
    const m: Record<string, string> = {};
    for (const e of placeholderEntries) m[e.token] = e.value;
    return m;
  }, [placeholderEntries]);

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

  // Phase D Sprint 3: kit-level placeholder detection. Aggregates canonical
  // operator-fill [INSERT_X] tokens across every loaded asset and produces a
  // structured report consumed by KitPlaceholderBanner (kit page) and
  // PushKitModal (compact warning). Memoized on the loaded brief data so the
  // detector doesn't re-scan on unrelated re-renders.
  const placeholderReport = useMemo(() => detectPlaceholders({
    offer: briefOffer,
    lp: briefLP,
    email: briefEmail,
    whatsapp: briefWa,
    headlines: briefHeadline,
    adCopy: briefAdCopy,
    hvco: briefHvco,
    heroMechanism: briefMech,
    adCreatives: briefAdCreatives,
  }, resolvedMap), [briefOffer, briefLP, briefEmail, briefWa, briefHeadline, briefAdCopy, briefHvco, briefMech, briefAdCreatives, resolvedMap]);

  // Full report (without resolvedMap subtraction) for the editor to show all tokens
  const fullPlaceholderReport = useMemo(() => detectPlaceholders({
    offer: briefOffer,
    lp: briefLP,
    email: briefEmail,
    whatsapp: briefWa,
    headlines: briefHeadline,
    adCopy: briefAdCopy,
    hvco: briefHvco,
    heroMechanism: briefMech,
    adCreatives: briefAdCreatives,
  }), [briefOffer, briefLP, briefEmail, briefWa, briefHeadline, briefAdCopy, briefHvco, briefMech, briefAdCreatives]);

  // Phase C C3: Push to Meta + GHL — opens the unified PushKitModal.
  // Single source of truth for both the floating-action-bar button and the
  // greeting-overlay CTA. Modal handles per-platform OAuth-at-click-time,
  // partial-failure recovery via Promise.allSettled, and post-push result
  // rendering. See PushKitModal.tsx for the full UX spec.
  const [showPushModal, setShowPushModal] = useState(false);
  const handlePush = () => setShowPushModal(true);

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

    // Resolve [INSERT_*] tokens to their filled registry values before export,
    // so the downloaded brief carries e.g. "£1,500" rather than "[INSERT_PRICE]".
    // No-op when resolvedMap is absent (still loading / no serviceId).
    const r = (s: string) => resolveTokensInText(s, resolvedMap);
    downloadCampaignBrief({
      serviceName: kit?.name || "Campaign",
      icpSummary: icpSummary ? `• ${r(icpSummary)}` : "",
      offerName: r(offerName),
      mechanismName: r(mechanismName),
      hvcoTitle: r(hvcoTitle),
      headline: r(headlineText),
      adHook: r(adHook),
      landingPageHeadline: r(lpHeadline),
      email1Subject: r(email1Subject),
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

  // Phase C C1.1: TOTAL_KIT_ASSETS = SECTIONS.length (8 text assets, each
  // with a rendered section card on this page) PLUS 1 for the
  // selectedAdCreativeBatchId field — which is populated by Auto Mode's
  // cascade step 9 but doesn't yet have its own section card on this page
  // (deferred to a future C1.x commit that adds an AdCreativesPreview
  // component). The counter line and the greeting-overlay subhead both
  // read TOTAL_KIT_ASSETS so they cannot drift out of sync again.
  const TOTAL_KIT_ASSETS = SECTIONS.length + 1;
  const filledCount =
    SECTIONS.filter(s => kit[s.key as keyof typeof kit] != null).length +
    (kit.selectedAdCreativeBatchId != null ? 1 : 0);
  const isComplete = kit.status === "complete";

  // Sprint 2: Dream Buyer Profile card gating. Keyed purely off profile richness
  // (not kit status), so it surfaces as soon as a rich ICP exists and never touches
  // TOTAL_KIT_ASSETS / filledCount / completion math above. Plain consts (not hooks)
  // as this runs after the loading/error early-returns.
  const icpIsRich = isIcpRich(icpData);
  const icpTeaser = (() => {
    const intro = (icpData as any)?.introduction as string | undefined;
    if (intro && intro.trim()) {
      const firstSentence = intro.trim().split(/(?<=[.!?])\s/)[0];
      return firstSentence.length > 160 ? firstSentence.slice(0, 157) + "…" : firstSentence;
    }
    return "17 sections — fears, hopes, pains, objections, buying triggers & more.";
  })();
  const icpName = ((icpData as any)?.name as string | undefined) || "Your ideal customer";

  return (
    <V2Layout backLabel="Campaign Trail" backHref={`/v2-dashboard/trail/${kitId}`}>
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
              All {TOTAL_KIT_ASSETS} assets generated and ready. Take a look around — or push live now.
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
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          {/* Campaign number + date */}
          {campaignSeqNum && (
            <div style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "12px",
              fontWeight: 600,
              color: "#999",
              marginBottom: "6px",
            }}>
              Campaign #{campaignSeqNum} · {campaignDateStr}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {isRenaming ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!renameValue.trim() || !kitId) return;
                  await renameMut.mutateAsync({ kitId, name: renameValue.trim() });
                  utils.campaignKits.getById.invalidate({ kitId });
                  utils.campaignKits.getByUser.invalidate();
                  setIsRenaming(false);
                }}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  autoFocus
                  style={{
                    fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
                    fontStyle: "italic",
                    fontWeight: 900,
                    fontSize: "28px",
                    color: "var(--v2-text-dark, #1A1624)",
                    border: "none",
                    borderBottom: "2px solid var(--v2-primary-btn, #FF5B1D)",
                    outline: "none",
                    background: "transparent",
                    padding: "0 0 2px",
                    width: "100%",
                    maxWidth: "400px",
                  }}
                  onKeyDown={e => { if (e.key === "Escape") setIsRenaming(false); }}
                />
                <button type="submit" disabled={renameMut.isPending} style={{
                  background: "var(--v2-primary-btn)", color: "#fff", border: "none",
                  borderRadius: 9999, padding: "6px 14px", fontSize: 12, fontWeight: 700,
                  fontFamily: "var(--v2-font-body)", cursor: "pointer",
                }}>
                  {renameMut.isPending ? "..." : "Save"}
                </button>
                <button type="button" onClick={() => setIsRenaming(false)} style={{
                  background: "none", border: "none", fontSize: 12, color: "#999",
                  fontFamily: "var(--v2-font-body)", cursor: "pointer",
                }}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
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
                <button
                  onClick={() => { setRenameValue(kit.name || ""); setIsRenaming(true); }}
                  title="Rename campaign"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 16, color: "#999", padding: "4px", lineHeight: 1,
                    display: "inline-flex", alignItems: "center",
                  }}
                >
                  ✎
                </button>
              </>
            )}
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
            {(icpData as any)?.name || "Loading ICP..."} · {filledCount} of {TOTAL_KIT_ASSETS} selected
          </p>
          {(fullPlaceholderReport.allUniqueTokens?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowPlaceholderEditor(true)}
              style={{
                marginTop: 10,
                padding: "7px 18px",
                borderRadius: "var(--v2-border-radius-pill, 9999px)",
                border: "1px solid rgba(26,22,36,0.15)",
                background: "transparent",
                color: "var(--v2-text-color)",
                fontFamily: "var(--v2-font-body)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "border-color 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(26,22,36,0.35)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(26,22,36,0.15)"; }}
            >
              Edit Campaign Details
            </button>
          )}
        </div>

        {/* Sprint 2: Dream Buyer Profile — surfaced deliverable card. Bespoke insert
            (NOT part of SECTIONS.map / the 9-asset counter). Gated on profile richness
            so thin imported profiles never render a broken/empty card. Placed high so
            it reads as a headline deliverable, not a buried record. */}
        {icpData && icpIsRich && (
          <div style={{ marginBottom: 20 }}>
            <p style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--v2-primary-btn, #FF5B1D)",
              margin: "0 0 8px",
              fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            }}>
              Dream Buyer Profile
            </p>
            <div style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              border: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}>
              <ZappyMascot state="cheering" size={44} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{
                  fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
                  fontStyle: "italic",
                  fontWeight: 900,
                  fontSize: 18,
                  color: "var(--v2-text-dark, #1A1624)",
                  margin: "0 0 4px",
                }}>
                  {icpName}
                </p>
                <p style={{
                  fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#555",
                  margin: 0,
                }}>
                  {icpTeaser} <span style={{ color: "#999" }}>· 17 sections</span>
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
                <button
                  onClick={() => setShowIcpModal(true)}
                  style={{
                    background: "var(--v2-primary-btn, #FF5B1D)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--v2-border-radius-pill, 9999px)",
                    padding: "10px 22px",
                    fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Read profile
                </button>
                <button
                  onClick={() => downloadPdf(formatIcpTxt(icpData), icpName.slice(0, 30), "ICP")}
                  style={{
                    background: "none",
                    color: "var(--v2-text-dark, #1A1624)",
                    border: "1px solid rgba(26,22,36,0.15)",
                    borderRadius: "var(--v2-border-radius-pill, 9999px)",
                    padding: "10px 20px",
                    fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  ↓ Download PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase D Sprint 3: kit-level placeholder banner. Self-hides when
            placeholderReport.total === 0 (clean kit). When placeholders exist,
            shows aggregate count + per-asset breakdown + "Review & Complete"
            CTA that scrolls to the first affected asset section. */}
        <KitPlaceholderBanner
          report={placeholderReport}
          onReviewClick={() => setShowPlaceholderEditor(true)}
        />

        {/* Compliance advisories — computed on read, never persisted, never gating.
            Surfaced at the campaign because if one fires the cost has already landed
            on a real coach; the remedies are attached so it is actionable rather than
            just a warning. Self-hides when there is nothing to say. */}
        <ComplianceAdvisoryBanner
          advisories={complianceAdvisories}
          onReword={() => kitId && rewordMutation.mutate({ campaignKitId: kitId })}
          rewording={rewordMutation.isPending}
          rewordError={rewordMutation.error?.message ?? null}
          rewordDone={rewordDone}
        />

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
            serviceId={serviceId}
            kitId={kit.id}
            resolvedMap={resolvedMap}
          />
        ))}

        {/* Ad Creatives section */}
        {kit.selectedAdCreativeBatchId ? (
          <AdCreativesSection batchId={kit.selectedAdCreativeBatchId as string} />
        ) : (
          <div style={{ marginBottom: 28 }}>
            <p style={{
              fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: 18,
              color: "#1A1624",
              margin: "0 0 8px",
            }}>
              Ad Images
            </p>
            <div style={{
              border: "2px dashed #ddd",
              borderRadius: "16px",
              padding: "24px",
              textAlign: "center",
            }}>
              <p style={{ fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)", fontSize: 14, color: "#999", margin: 0 }}>Not generated yet</p>
            </div>
          </div>
        )}

        {kitId && <BonusesSection kitId={kitId} />}
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

      {/* Phase C C3: unified push modal — Meta + GHL, OAuth-at-click-time.
          Phase D Sprint 3: passes placeholderReport so the modal can render
          a compact warning section if placeholders exist (kit page banner
          carries the full UX; modal just nudges the user to review first). */}
      {/* `serviceId` is required: the server refuses a publish without it (the compliance
          gate cannot run), so rendering the modal without one would offer a button that
          can only fail. Matches the placeholder-editor guard below. */}
      {showPushModal && kitId != null && serviceId != null && (
        <PushKitModal
          kitId={kitId}
          kitName={kit.name || "Campaign"}
          serviceId={serviceId}
          onClose={() => setShowPushModal(false)}
          placeholderReport={placeholderReport}
          onReviewPlaceholdersFromModal={() => {
            setShowPushModal(false);
            setShowPlaceholderEditor(true);
          }}
        />
      )}

      {/* Placeholder Editor modal overlay */}
      {showPlaceholderEditor && serviceId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center",
          padding: 16,
        }}>
          <PlaceholderEditor
            serviceId={serviceId}
            report={fullPlaceholderReport}
            onClose={() => setShowPlaceholderEditor(false)}
            onSaved={() => {
              // Invalidate the placeholder list so resolvedMap updates,
              // which triggers banner re-count via the memoized detectPlaceholders.
              utils.placeholders.list.invalidate({ serviceId });
            }}
          />
        </div>
      )}

      {/* Sprint 2: Dream Buyer Profile read-only modal — reuses V2ICPResultPanel in
          read-only mode (Delete hidden, editing/regen off, close × shown) so the user
          reads the full 17 sections without leaving the kit page. */}
      {showIcpModal && kit.icpId && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "flex-start", justifyContent: "center",
            padding: 16, overflowY: "auto",
          }}
          onClick={() => setShowIcpModal(false)}
        >
          <div
            style={{ width: "100%", maxWidth: 660, margin: "24px 0" }}
            onClick={e => e.stopPropagation()}
          >
            <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "var(--v2-font-body)", color: "#F5F1EA" }}>Loading your Dream Buyer Profile…</div>}>
              <V2ICPResultPanel
                icpId={kit.icpId}
                readOnly
                onClose={() => setShowIcpModal(false)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </V2Layout>
  );
}
