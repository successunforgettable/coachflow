/**
 * QuickFillChatCard — Fix A Phase 2 (has-assets intake quick-fill, in-chat).
 *
 * An inline chat-card Zappy offers after the confirm cards / gap questions and
 * BEFORE the ICP import + enrichment poll + cascade (V2TrailIntake step E). A
 * fixed, curated Tier-1 set of the few operator facts ZAP cannot invent (price,
 * name, support email, conversion link, duration, start date, offer close date).
 *
 * No-front-wall: every field optional, blank by default. Blank === skipped ===
 * the [INSERT_*] token stays a fill-in-later placeholder (caught later by the
 * end-of-flow editor + push-modal banner). Nothing here gates the build, and
 * "Skip all" is a single, plainly visible action.
 *
 * Filled values save via placeholders.save (campaign row + account default), so
 * they flow through the live Phase 1 substitution rails into rendered/exported
 * assets. Unlike the end-of-flow PlaceholderEditor (which scans REAL generated
 * assets), the kit's assets don't exist yet at intake — so this is a fixed
 * curated list, not a kit scan.
 *
 * Rendered as the "quick-fill-card" ChatThread message type; signals completion
 * via onDone("saved" | "skip"), mirroring TestimonialPicker's onDone contract.
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";

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
    { key: "price", tokens: ["[INSERT_PRICE]"], label: "Price",
      hint: "What you charge — e.g. £1,500 or $2,000/month", placeholder: "£1,500" },
    { key: "host", tokens: ["[INSERT_HOST_NAME]"], label: "Your Name",
      hint: "The name your campaigns are signed with", placeholder: "Arfeen Khan" },
    { key: "email", tokens: ["[INSERT_CONTACT_EMAIL]"], label: "Support Email",
      hint: "Where replies and refund questions go", placeholder: "support@yoursite.com" },
    { key: "link", tokens: ["[INSERT_OFFER_LINK]", "[INSERT_BOOKING_URL]"], label: linkLabelFor(campaignType),
      hint: "Your checkout or calendar link — the one people click to convert", placeholder: "https://…" },
    { key: "duration", tokens: ["[INSERT_PROGRAMME_DURATION]"], label: "Programme Duration",
      hint: "How long the programme runs — e.g. 12 weeks or 6 months", placeholder: "12 weeks" },
    { key: "start", tokens: ["[INSERT_PROGRAMME_START_DATE]"], label: "Start Date",
      hint: "When the next cohort begins — e.g. 1 July 2026", placeholder: "1 July 2026" },
    { key: "close", tokens: ["[INSERT_COHORT_CLOSE_DATE]"], label: "Offer Close Date",
      hint: "When enrolment closes — drives the urgency lines — e.g. Friday 20 June at midnight", placeholder: "Friday 20 June at midnight" },
  ];
}

const FONT_BODY = "var(--v2-font-body)";
const TEXT_COLOR = "var(--v2-text-color)";

type Props = {
  serviceId: number;
  campaignType?: string;
  onDone: (action: "saved" | "skip") => void;
};

export default function QuickFillChatCard({ serviceId, campaignType, onDone }: Props) {
  const fields = useMemo(() => buildFields(campaignType), [campaignType]);
  const { data: registryEntries } = trpc.placeholders.list.useQuery({ serviceId });
  const saveMut = trpc.placeholders.save.useMutation();

  const [values, setValues] = useState<Record<string, string>>({});
  const [fromDefault, setFromDefault] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "saved" | "skip">(null);

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
        if ((prev[f.key] ?? "").trim()) continue; // don't clobber a live edit
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

  async function handleSave() {
    if (busy || done) return;
    const entries: { token: string; value: string }[] = [];
    for (const f of fields) {
      const v = (values[f.key] ?? "").trim();
      if (!v) continue; // blank = skipped = token left as a placeholder
      for (const token of f.tokens) entries.push({ token, value: v });
    }
    if (entries.length > 0) {
      setBusy(true);
      try {
        await saveMut.mutateAsync({ serviceId, entries });
      } catch {
        // Saving is enhancement, not gating — never block the build on it.
        // Unsaved tokens stay placeholders, caught by the end editor.
      } finally {
        setBusy(false);
      }
    }
    setDone("saved");
    onDone("saved");
  }

  function handleSkip() {
    if (busy || done) return;
    setDone("skip");
    onDone("skip");
  }

  // Post-action compact state — keeps the thread tidy, can't re-fire.
  if (done) {
    return (
      <div style={{ ...shell, opacity: 0.85 }}>
        <p style={{ margin: 0, fontFamily: FONT_BODY, fontSize: 13, color: "#777" }}>
          {done === "saved"
            ? (filledCount > 0 ? `Saved ${filledCount} detail${filledCount === 1 ? "" : "s"} — they'll drop straight into your assets.` : "No details added — I'll keep them as fill-in-later placeholders.")
            : "Skipped — I'll keep these as fill-in-later placeholders."}
        </p>
      </div>
    );
  }

  return (
    <div style={shell}>
      {fields.map(f => {
        const val = values[f.key] ?? "";
        const isFilled = val.trim().length > 0;
        return (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
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
              <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: TEXT_COLOR }}>
                {f.label}
              </label>
              {fromDefault[f.key] && isFilled && (
                <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: "#999", fontWeight: 500, background: "rgba(26,22,36,0.05)", borderRadius: 9999, padding: "1px 8px" }}>
                  from last campaign
                </span>
              )}
            </div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: "#999", margin: "0 0 4px", lineHeight: 1.4 }}>
              {f.hint}
            </p>
            <input
              type="text"
              value={val}
              onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              disabled={busy}
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 14px",
                fontSize: 14, fontFamily: FONT_BODY, borderRadius: 10,
                border: isFilled ? "1px solid rgba(22,163,74,0.25)" : "1px solid rgba(26,22,36,0.15)",
                background: isFilled ? "rgba(22,163,74,0.03)" : "#fff",
                color: TEXT_COLOR, outline: "none", transition: "border-color 0.15s ease",
              }}
              onFocus={e => { e.target.style.borderColor = "#FF5B1D"; }}
              onBlur={e => { e.target.style.borderColor = isFilled ? "rgba(22,163,74,0.25)" : "rgba(26,22,36,0.15)"; }}
            />
          </div>
        );
      })}

      <button
        onClick={handleSave}
        disabled={busy}
        style={{
          display: "block", width: "100%", background: "var(--v2-primary-btn)", color: "#fff",
          border: "none", borderRadius: "var(--v2-border-radius-pill)", padding: "14px 28px",
          fontSize: 15, fontFamily: FONT_BODY, fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, marginTop: 6,
        }}
      >
        {busy ? "Saving your details…" : "Save & continue →"}
      </button>
      <button
        onClick={handleSkip}
        disabled={busy}
        style={{
          display: "block", width: "100%", background: "none", border: "none",
          color: "#999", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer", marginTop: 10, padding: 4,
        }}
      >
        {filledCount > 0 ? "Skip the rest — I'll add them later" : "Skip all — I'll add these later"}
      </button>
    </div>
  );
}

const shell: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
  padding: "18px 18px",
  maxWidth: 440,
  width: "100%",
  fontFamily: FONT_BODY,
};
