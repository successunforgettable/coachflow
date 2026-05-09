/**
 * V2AutoModeIntake — Auto Mode Phase A
 *
 * Single-textarea entry surface. User describes their business in a
 * paragraph; on submit, services.extractFromText (LLM) returns a
 * structured profile draft. We navigate to V2AutoModeIntakeConfirm
 * carrying the extracted result via wouter location state.
 *
 * No DB writes here. The user reviews + edits on the confirm screen,
 * then services.create + services.expandProfile + icps.generateAsync
 * fire from there (Phase A terminal state). Phase B orchestration
 * picks up from the resulting Service + ICP later.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import V2Layout from "./V2Layout";

const PLACEHOLDER_EXAMPLE = "I'm a business coach for new consultants who want to land their first $10k clients. My method is the Authority Stack — LinkedIn positioning, outbound scripts, and a tiered offer ladder. Most clients book their first paid call within 30 days. I sell a 12-week accelerator at $4,500.";

const CHAR_MIN = 120;

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  padding: "40px 36px",
  maxWidth: "640px",
  margin: "0 auto",
  width: "100%",
};

export default function V2AutoModeIntake() {
  const [, navigate] = useLocation();
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const extractMutation = trpc.services.extractFromText.useMutation();

  const charCount = rawText.length;
  const meetsMinimum = charCount >= CHAR_MIN;
  const submitDisabled = !meetsMinimum || extractMutation.isPending;

  async function handleSubmit() {
    if (submitDisabled) return;
    setError(null);
    try {
      const extracted = await extractMutation.mutateAsync({ rawText: rawText.trim() });
      navigate("/v2-dashboard/auto-mode/confirm", { state: { extracted, rawText: rawText.trim() } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed. Please refine your description and try again.";
      setError(msg);
    }
  }

  return (
    <V2Layout>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 16px 64px" }}>
        <button
          onClick={() => navigate("/v2-dashboard")}
          style={{ alignSelf: "flex-start", marginBottom: "24px", fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#777", background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center", gap: "6px" }}
        >
          ← Back to Dashboard
        </button>
        <div style={cardStyle}>
          <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(24px, 5vw, 32px)", color: "var(--v2-text-color)", lineHeight: 1.2, marginBottom: "8px", marginTop: 0, textAlign: "center" }}>
            Tell Zappy About Your Business
          </h1>
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "15px", color: "#555", lineHeight: 1.55, margin: "0 0 28px", textAlign: "center" }}>
            One paragraph. The more specific, the better the campaign.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`e.g. ${PLACEHOLDER_EXAMPLE}`}
            disabled={extractMutation.isPending}
            rows={8}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "16px",
              fontSize: "15px",
              fontFamily: "var(--v2-font-body)",
              lineHeight: 1.55,
              border: "1px solid rgba(26,22,36,0.15)",
              borderRadius: "12px",
              background: "#fff",
              color: "var(--v2-text-color)",
              resize: "vertical",
              minHeight: "180px",
              outline: "none",
            }}
          />
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#777", lineHeight: 1.5, margin: "10px 0 24px" }}>
            Mention: who you help, what you sell, what you call your method, and a rough price. Zappy reads this like a profile, not a description — the more concrete details, the better everything else generates.
          </p>
          {error && (
            <div style={{ background: "rgba(255,91,29,0.06)", border: "1px solid rgba(255,91,29,0.20)", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px", fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#B5421A" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", color: meetsMinimum ? "#FF5B1D" : (charCount > 0 ? "#B5421A" : "#999"), fontWeight: 600 }}>
              {meetsMinimum ? `📝 ${charCount} characters` : `${charCount} / ${CHAR_MIN} minimum`}
            </span>
            <button
              onClick={handleSubmit}
              disabled={submitDisabled}
              style={{
                background: "var(--v2-primary-btn)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--v2-border-radius-pill)",
                padding: "16px 28px",
                fontSize: "16px",
                fontFamily: "var(--v2-font-body)",
                fontWeight: 700,
                cursor: submitDisabled ? "not-allowed" : "pointer",
                letterSpacing: "0.01em",
                transition: "opacity 0.18s ease, transform 0.12s ease",
                opacity: submitDisabled ? 0.55 : 1,
              }}
            >
              {extractMutation.isPending ? "Reading…" : "Have Zappy Read This →"}
            </button>
          </div>
        </div>
      </div>
    </V2Layout>
  );
}
