/**
 * QuickFillCard — Fix A Phase 2 (has-assets intake quick-fill).
 *
 * A fixed, curated Tier-1 set of the few operator facts ZAP literally cannot
 * invent (price, name, support email, conversion link, duration, start date,
 * offer close date). Shown AFTER the confirm cards and BEFORE handleConfirm
 * runs — so it sits entirely before the Fix B enrichment wait, never overlaps
 * it. Writes via placeholders.save (campaign row + account default), so a value
 * filled here flows straight through the Phase 1 substitution rails into every
 * rendered/exported asset.
 *
 * Unlike the end-of-flow PlaceholderEditor (which scans REAL generated assets
 * for tokens), the kit's assets don't exist yet at intake — so this is a fixed
 * curated list, not a kit scan.
 *
 * No-front-wall: every field optional, blank by default. Blank === skipped ===
 * the [INSERT_*] token stays a fill-in-later placeholder (caught later by the
 * end-of-flow editor + push-modal banner). Nothing here gates the build.
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";

/** One Tier-1 field. `tokens` is the registry token(s) it writes to. */
type Tier1Field = {
  key: string;
  tokens: string[]; // >1 → the same value dual-writes to each (the link field)
  label: string;
  hint: string;
  placeholder: string;
};

/**
 * The conversion-link field's label flexes by campaign type, but the value
 * always dual-writes to BOTH [INSERT_OFFER_LINK] and [INSERT_BOOKING_URL] —
 * coaches have one conversion URL, and generators emit either token depending
 * on the copy, so writing both guarantees it resolves everywhere.
 */
function linkLabelFor(campaignType?: string): string {
  switch (campaignType) {
    case "discovery_call":
    case "webinar":
    case "in_person_event":
      return "Booking / calendar link";
    case "course_launch":
    case "product_launch":
      return "Checkout / sign-up link";
    default:
      return "Where people sign up or book";
  }
}

/** Fixed Tier-1 essentials. Labels/hints mirror the end-of-flow editor; the
 *  three that had no editor hint (price/name/email) get intake-friendly ones. */
function buildFields(campaignType?: string): Tier1Field[] {
  return [
    {
      key: "price",
      tokens: ["[INSERT_PRICE]"],
      label: "Price",
      hint: "What you charge — e.g. £1,500 or $2,000/month",
      placeholder: "£1,500",
    },
    {
      key: "host",
      tokens: ["[INSERT_HOST_NAME]"],
      label: "Your Name",
      hint: "The name your campaigns are signed with",
      placeholder: "Arfeen Khan",
    },
    {
      key: "email",
      tokens: ["[INSERT_CONTACT_EMAIL]"],
      label: "Support Email",
      hint: "Where replies and refund questions go",
      placeholder: "support@yoursite.com",
    },
    {
      key: "link",
      tokens: ["[INSERT_OFFER_LINK]", "[INSERT_BOOKING_URL]"],
      label: linkLabelFor(campaignType),
      hint: "Your checkout or calendar link — the one people click to convert",
      placeholder: "https://…",
    },
    {
      key: "duration",
      tokens: ["[INSERT_PROGRAMME_DURATION]"],
      label: "Programme Duration",
      hint: "How long the programme runs — e.g. 12 weeks or 6 months",
      placeholder: "12 weeks",
    },
    {
      key: "start",
      tokens: ["[INSERT_PROGRAMME_START_DATE]"],
      label: "Start Date",
      hint: "When the next cohort begins — e.g. 1 July 2026",
      placeholder: "1 July 2026",
    },
    {
      key: "close",
      tokens: ["[INSERT_COHORT_CLOSE_DATE]"],
      label: "Offer Close Date",
      hint: "When enrolment closes — drives the urgency lines — e.g. Friday 20 June at midnight",
      placeholder: "Friday 20 June at midnight",
    },
  ];
}

type Props = {
  serviceId: number;
  campaignType?: string;
  /** Parent's submit lifecycle, so the build button mirrors the same label
   *  rotation as the confirm screen during the (post-card) Fix B wait. */
  submitting: boolean;
  loadingPhase: "saving" | "icp" | null;
  /** Proceed into handleConfirm. Card has already saved by the time this fires
   *  on the Build path; on Skip-all it fires immediately with no save. */
  onProceed: () => void;
};

export default function QuickFillCard({ serviceId, campaignType, submitting, loadingPhase, onProceed }: Props) {
  const fields = useMemo(() => buildFields(campaignType), [campaignType]);
  const { data: registryEntries } = trpc.placeholders.list.useQuery({ serviceId });
  const saveMut = trpc.placeholders.save.useMutation();

  // Local form state, keyed by field.key.
  const [values, setValues] = useState<Record<string, string>>({});
  // Which field.keys pre-filled from an account default (→ "from last campaign").
  const [fromDefault, setFromDefault] = useState<Record<string, boolean>>({});
  const [savingDetails, setSavingDetails] = useState(false);

  // Pre-fill from the two-level registry (campaign value > account default).
  // For the link field, prefer OFFER_LINK then BOOKING_URL.
  useEffect(() => {
    if (!registryEntries) return;
    const byToken: Record<string, { value: string; source: string }> = {};
    for (const e of registryEntries) byToken[e.token] = { value: e.value, source: e.source };

    setValues(prev => {
      const next = { ...prev };
      const seededDefault: Record<string, boolean> = {};
      for (const f of fields) {
        // Don't clobber an edit the user already typed before the registry loaded.
        if ((prev[f.key] ?? "").trim()) continue;
        const hit = f.tokens.map(t => byToken[t]).find(Boolean);
        if (hit?.value) {
          next[f.key] = hit.value;
          if (hit.source === "default") seededDefault[f.key] = true;
        }
      }
      setFromDefault(seededDefault);
      return next;
    });
  }, [registryEntries, fields]);

  const filledCount = fields.filter(f => (values[f.key] ?? "").trim()).length;
  const busy = savingDetails || submitting;

  async function handleBuild() {
    if (busy) return;
    // Expand filled fields into registry entries; the link field dual-writes.
    const entries: { token: string; value: string }[] = [];
    for (const f of fields) {
      const v = (values[f.key] ?? "").trim();
      if (!v) continue; // blank = skipped = token left as a placeholder
      for (const token of f.tokens) entries.push({ token, value: v });
    }
    if (entries.length > 0) {
      setSavingDetails(true);
      try {
        await saveMut.mutateAsync({ serviceId, entries });
      } catch {
        // Saving these is enhancement, not gating — never block the build on it.
        // Unsaved tokens simply stay placeholders, caught by the end editor.
      } finally {
        setSavingDetails(false);
      }
    }
    onProceed();
  }

  function handleSkipAll() {
    if (busy) return;
    onProceed();
  }

  const buildLabel = submitting
    ? (loadingPhase === "icp" ? "Setting up your profile…" : "Saving…")
    : savingDetails
      ? "Saving your details…"
      : "Build my campaign →";

  return (
    <V2Shell>
      <div style={cardStyle}>
        <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(22px, 5vw, 30px)", color: "var(--v2-text-color)", lineHeight: 1.2, margin: "0 0 8px", textAlign: "center" }}>
          A few quick details
        </h1>
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555", lineHeight: 1.55, margin: "0 0 8px", textAlign: "center" }}>
          Got your price or link handy? Drop them in and ZAP slots them straight into every asset. Skip anything you don&apos;t have — you can always fill it in later.
        </p>
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#999", lineHeight: 1.5, margin: "0 0 22px", textAlign: "center" }}>
          All optional. Anything you leave blank, ZAP keeps as a fill-in-later placeholder — nothing here holds up your build.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {fields.map(f => {
            const val = values[f.key] ?? "";
            const isFilled = val.trim().length > 0;
            return (
              <div key={f.key}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: isFilled ? "rgba(22,163,74,0.12)" : "rgba(26,22,36,0.06)",
                    color: isFilled ? "#16a34a" : "#999",
                    border: isFilled ? "1px solid rgba(22,163,74,0.3)" : "1px solid rgba(26,22,36,0.12)",
                  }}>
                    {isFilled ? "✓" : "○"}
                  </span>
                  <label style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", fontWeight: 600, color: "var(--v2-text-color)" }}>
                    {f.label}
                  </label>
                  {fromDefault[f.key] && isFilled && (
                    <span style={{ fontFamily: "var(--v2-font-body)", fontSize: 10, color: "#999", fontWeight: 500, background: "rgba(26,22,36,0.05)", borderRadius: 9999, padding: "1px 8px" }}>
                      from last campaign
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: "var(--v2-font-body)", fontSize: 11, color: "#999", margin: "0 0 4px", lineHeight: 1.4 }}>
                  {f.hint}
                </p>
                <input
                  type="text"
                  value={val}
                  onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  disabled={busy}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "12px 14px",
                    fontSize: 14, fontFamily: "var(--v2-font-body)", borderRadius: 10,
                    border: isFilled ? "1px solid rgba(22,163,74,0.25)" : "1px solid rgba(26,22,36,0.15)",
                    background: isFilled ? "rgba(22,163,74,0.03)" : "#fff",
                    color: "var(--v2-text-color)", outline: "none", transition: "border-color 0.15s ease",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#FF5B1D"; }}
                  onBlur={e => { e.target.style.borderColor = isFilled ? "rgba(22,163,74,0.25)" : "rgba(26,22,36,0.15)"; }}
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={handleBuild}
          disabled={busy}
          style={{
            display: "block", width: "100%", background: "var(--v2-primary-btn)", color: "#fff",
            border: "none", borderRadius: "var(--v2-border-radius-pill)", padding: "18px 32px",
            fontSize: "17px", fontFamily: "var(--v2-font-body)", fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer", letterSpacing: "0.01em",
            opacity: busy ? 0.7 : 1, marginTop: "22px",
          }}
        >
          {buildLabel}
        </button>
        <button
          onClick={handleSkipAll}
          disabled={busy}
          style={{
            display: "block", width: "100%", background: "none", border: "none",
            color: "#999", fontFamily: "var(--v2-font-body)", fontSize: "13px", fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer", marginTop: "12px", padding: "4px",
          }}
        >
          {filledCount > 0 ? "Skip the rest — I'll add them later" : "Skip all — I'll add these later"}
        </button>
      </div>
    </V2Shell>
  );
}

/** Page shell matching the confirm screen's centered column. */
function V2Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 16px 64px" }}>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  padding: "40px 36px",
  maxWidth: "640px",
  margin: "0 auto",
  width: "100%",
};
