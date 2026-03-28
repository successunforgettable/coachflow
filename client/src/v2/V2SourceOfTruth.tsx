/**
 * V2SourceOfTruth — Source of Truth editor page
 *
 * Two states: empty (show form) or populated (show inputs + AI profile).
 * Uses existing sourceOfTruth router: generate, get, update.
 */
import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import V2Layout from "./V2Layout";

const INPUT_FIELDS = [
  { key: "programName", label: "Program Name", type: "text", placeholder: "e.g. The 90-Day Identity Reset" },
  { key: "coreOffer", label: "Core Offer", type: "textarea", placeholder: "What do you actually deliver? e.g. 12 weeks of 1:1 coaching..." },
  { key: "targetAudience", label: "Target Audience", type: "text", placeholder: "e.g. High-achieving women 35-55 feeling lost in success" },
  { key: "mainPainPoint", label: "Main Pain Point", type: "textarea", placeholder: "The #1 problem your ideal client faces every day" },
  { key: "priceRange", label: "Price Range", type: "text", placeholder: "e.g. $3,997 or £2,500 – £10,000" },
] as const;

const AI_FIELDS = [
  { key: "description", label: "Description" },
  { key: "targetCustomer", label: "Target Customer" },
  { key: "mainBenefits", label: "Main Benefits" },
  { key: "painPoints", label: "Pain Points" },
  { key: "uniqueValue", label: "Unique Value" },
  { key: "idealCustomerAvatar", label: "Ideal Customer Avatar" },
] as const;

// ─── Editable field ─────────────────────────────────────────────────────────
function EditableField({ label, value, onChange, type }: {
  label: string; value: string; onChange: (v: string) => void; type: "text" | "textarea";
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ marginBottom: "20px" }}>
      <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", margin: "0 0 6px" }}>{label}</p>
      {editing ? (
        type === "textarea" ? (
          <textarea
            autoFocus
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            rows={3}
            style={{ width: "100%", fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#1A1624", lineHeight: 1.65, border: "1px solid rgba(139,92,246,0.40)", borderRadius: "8px", padding: "8px 10px", resize: "vertical", outline: "none", background: "#FAFAFA", boxSizing: "border-box" }}
          />
        ) : (
          <input
            autoFocus
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            style={{ width: "100%", fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#1A1624", border: "1px solid rgba(139,92,246,0.40)", borderRadius: "8px", padding: "8px 10px", outline: "none", background: "#FAFAFA", boxSizing: "border-box" }}
          />
        )
      ) : (
        <p
          onClick={() => setEditing(true)}
          style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#1A1624", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap", cursor: "text", minHeight: "20px" }}
          title="Click to edit"
        >
          {value || <span style={{ color: "#bbb" }}>—</span>}
        </p>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function V2SourceOfTruth() {
  const { data: sot, isLoading, refetch } = trpc.sourceOfTruth.get.useQuery();
  const generateMutation = trpc.sourceOfTruth.generate.useMutation();
  const updateMutation = trpc.sourceOfTruth.update.useMutation();

  const [form, setForm] = useState({ programName: "", coreOffer: "", targetAudience: "", mainPainPoint: "", priceRange: "" });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Sync form from loaded SOT
  useEffect(() => {
    if (sot) {
      setForm({
        programName: sot.programName ?? "",
        coreOffer: sot.coreOffer ?? "",
        targetAudience: sot.targetAudience ?? "",
        mainPainPoint: sot.mainPainPoint ?? "",
        priceRange: sot.priceRange ?? "",
      });
    }
  }, [sot]);

  function updateField(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  async function handleGenerate() {
    if (!form.programName || !form.coreOffer || !form.targetAudience || !form.mainPainPoint) {
      setError("Please fill in all required fields.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      await generateMutation.mutateAsync(form);
      await refetch();
      setDirty(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setError(null);
    try {
      await updateMutation.mutateAsync(form);
      setDirty(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (isLoading) {
    return (
      <V2Layout>
        <div style={{ textAlign: "center", padding: "80px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>Loading...</div>
      </V2Layout>
    );
  }

  const hasSOT = !!sot;

  return (
    <V2Layout>
      <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Back link */}
        <a href="/v2-dashboard" style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#888", textDecoration: "none", display: "inline-block", marginBottom: "24px" }}>← Back to Campaign Hub</a>

        {/* ── EMPTY STATE ── */}
        {!hasSOT && (
          <div style={{ textAlign: "center" }}>
            <img src="/zappy-waiting.svg" alt="Zappy" style={{ width: "80px", height: "80px", margin: "0 auto 20px" }} />
            <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "32px", color: "#1A1624", margin: "0 0 10px" }}>Your Source of Truth</h1>
            <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "15px", color: "#888", maxWidth: "28rem", margin: "0 auto 32px" }}>
              This is the foundation of everything ZAP generates. Fill it in once — every generator uses it automatically.
            </p>

            <div style={{ background: "#fff", borderRadius: "24px", padding: "32px", maxWidth: "40rem", margin: "0 auto", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", textAlign: "left" }}>
              {INPUT_FIELDS.map(f => (
                <div key={f.key} style={{ marginBottom: "20px" }}>
                  <label style={{ fontFamily: "var(--v2-font-body)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", display: "block", marginBottom: "6px" }}>{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={(form as any)[f.key]}
                      onChange={e => updateField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                      style={{ width: "100%", fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#1A1624", border: "1px solid rgba(26,22,36,0.12)", borderRadius: "10px", padding: "10px 12px", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                    />
                  ) : (
                    <input
                      value={(form as any)[f.key]}
                      onChange={e => updateField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      style={{ width: "100%", fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#1A1624", border: "1px solid rgba(26,22,36,0.12)", borderRadius: "10px", padding: "10px 12px", outline: "none", boxSizing: "border-box" }}
                    />
                  )}
                </div>
              ))}

              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  width: "100%",
                  background: generating ? "#ccc" : "#FF5B1D",
                  color: "#fff",
                  border: "none",
                  borderRadius: "9999px",
                  padding: "14px 0",
                  fontFamily: "var(--v2-font-body)",
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: generating ? "not-allowed" : "pointer",
                  marginTop: "8px",
                }}
              >
                {generating ? "Generating..." : "Generate My Source of Truth"}
              </button>
              {error && <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#DC2626", margin: "12px 0 0", textAlign: "center" }}>{error}</p>}
            </div>

            {generating && (
              <div style={{ textAlign: "center", marginTop: "32px" }}>
                <img src="/zappy-working.svg" alt="Zappy working" style={{ width: "64px", height: "64px", margin: "0 auto 12px" }} />
                <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888" }}>ZAP is building your foundation...</p>
              </div>
            )}
          </div>
        )}

        {/* ── POPULATED STATE ── */}
        {hasSOT && (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "32px", color: "#1A1624", margin: 0 }}>Your Source of Truth</h1>
                <span style={{ background: "rgba(88,204,2,0.12)", color: "#2E7D00", border: "1px solid rgba(88,204,2,0.30)", borderRadius: "9999px", padding: "3px 12px", fontFamily: "var(--v2-font-body)", fontSize: "11px", fontWeight: 600 }}>Active</span>
              </div>
              <button
                onClick={() => { if (confirm("Regenerate your AI profile from current inputs?")) handleGenerate(); }}
                disabled={generating}
                style={{ background: "#FF5B1D", color: "#fff", border: "none", borderRadius: "9999px", padding: "9px 22px", fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "13px", cursor: generating ? "not-allowed" : "pointer" }}
              >
                {generating ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
            <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", margin: "-20px 0 32px" }}>
              Every generator uses this automatically. Edit any field to update your outputs.
            </p>

            {/* Section 1: Your Inputs */}
            <div style={{ background: "#fff", borderRadius: "24px", padding: "32px", marginBottom: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "16px", color: "#1A1624", margin: "0 0 24px" }}>Your Inputs</h2>
              {INPUT_FIELDS.map(f => (
                <EditableField
                  key={f.key}
                  label={f.label}
                  value={(form as any)[f.key]}
                  onChange={v => updateField(f.key, v)}
                  type={f.type}
                />
              ))}
              {dirty && (
                <button
                  onClick={handleSave}
                  style={{ background: "#FF5B1D", color: "#fff", border: "none", borderRadius: "9999px", padding: "10px 28px", fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "13px", cursor: "pointer", marginTop: "4px" }}
                >
                  Save Changes
                </button>
              )}
              {error && <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#DC2626", margin: "12px 0 0" }}>{error}</p>}
            </div>

            {/* Section 2: Your AI Profile */}
            <div style={{ background: "#fff", borderRadius: "24px", padding: "32px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "16px", color: "#1A1624", margin: "0 0 4px" }}>Your AI Profile</h2>
              <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#999", margin: "0 0 24px" }}>ZAP generated this from your inputs. Every generator reads this automatically.</p>
              {AI_FIELDS.map((f, i) => (
                <div key={f.key}>
                  {i > 0 && <div style={{ borderTop: "1px solid rgba(26,22,36,0.06)", margin: "16px 0" }} />}
                  <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", margin: "0 0 6px" }}>{f.label}</p>
                  <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "15px", color: "#1A1624", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
                    {(sot as any)?.[f.key] || <span style={{ color: "#ccc" }}>Not generated yet</span>}
                  </p>
                </div>
              ))}
              <div style={{ textAlign: "right", marginTop: "20px" }}>
                <button
                  onClick={() => handleGenerate()}
                  disabled={generating}
                  style={{ background: "none", border: "none", fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#8B5CF6", cursor: "pointer", fontWeight: 600 }}
                >
                  ↺ Regenerate Profile
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </V2Layout>
  );
}
