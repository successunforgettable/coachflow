/**
 * PlaceholderEditor — P3 of Placeholder Editor sprint.
 *
 * Fill-once editor for [INSERT_*] tokens. Shows one input per unique
 * token actually present in the kit's assets. Pre-fills from the
 * two-level registry (campaign value > account default > empty).
 *
 * Save dual-writes campaign row + account default via placeholders.save.
 * Display surfaces call placeholders.resolve to show resolved text.
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { PlaceholderReport } from "../lib/placeholderDetector";
import { labelForToken } from "@shared/placeholderLabels";

/** Hint text shown under fields that benefit from explanation. */
const TOKEN_HINTS: Record<string, string> = {
  "[INSERT_GUARANTEE_TERMS]": "Your guarantee — e.g. '30-day money-back if you complete the programme'",
  "[INSERT_COHORT_CLOSE_DATE]": "When enrolment closes — e.g. 'Friday 20 June at midnight'",
  "[INSERT_DEADLINE]": "When the offer expires — e.g. 'Friday 20 June at midnight'",
  "[INSERT_CART_CLOSE_DATE]": "When the cart closes — e.g. 'Friday 20 June at midnight'",
  "[INSERT_COHORT_LIMIT]": "How many spots are available — e.g. '20 spots'",
  "[INSERT_FIRST_RESULT_TIMEFRAME]": "How soon clients see results — e.g. 'within the first 30 days'",
  "[INSERT_PROGRAMME_DURATION]": "How long the programme runs — e.g. '12 weeks' or '6 months'",
  "[INSERT_PROGRAMME_START_DATE]": "When the next cohort begins — e.g. '1 July 2026'",
  "[INSERT_OFFER_LINK]": "The URL where people sign up or pay — e.g. 'https://yoursite.com/enroll'",
  "[INSERT_BOOKING_URL]": "Your calendar link — e.g. 'https://cal.com/yourname'",
  "[INSERT_REPLAY_AVAILABILITY]": "Who's allowed to watch it and for how long — e.g. 'registrants only, 48 hours'",
  "[INSERT_REPLAY_EXPIRY]": "When the replay stops being available — e.g. '72 hours after the live event'",
  "[INSERT_INCENTIVE]": "An offer for people who haven't bought yet — e.g. '20% off if you enrol this week'",
  "[INSERT_LAST_ENGAGEMENT_TIMEFRAME]": "How long since they were last active — e.g. '30 days'",
  "[INSERT_LEAD_MAGNET_NAME]": "The name of your free resource — e.g. 'The Consultant's Playbook'",
  "[INSERT_LAUNCH_PRODUCT_NAME]": "The product you're launching — e.g. 'Authority Stack Accelerator'",
  "[INSERT_EVENT_AGENDA]": "What happens at the event — e.g. 'Keynote, Q&A, networking lunch'",
  "[INSERT_BONUS_VALUE]": "The perceived dollar value of the bonus — e.g. '$497'",
  "[INSERT_COACH_CREDENTIAL]": "Your relevant qualification — e.g. 'ICF-certified coach'",
  "[INSERT_FEATURED_IN]": "Where you've been featured — e.g. 'Forbes, Entrepreneur, TEDx'",
};

function hintForToken(token: string): string | undefined {
  return TOKEN_HINTS[token];
}

type Props = {
  serviceId: number;
  report: PlaceholderReport;
  onClose: () => void;
  onSaved?: () => void;
};

export default function PlaceholderEditor({ serviceId, report, onClose, onSaved }: Props) {
  const { data: registryEntries, isLoading } = trpc.placeholders.list.useQuery({ serviceId });
  const saveMut = trpc.placeholders.save.useMutation();
  const utils = trpc.useUtils();

  // Local form state: token → value
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Pre-fill from registry once loaded
  useEffect(() => {
    if (!registryEntries) return;
    const prefilled: Record<string, string> = {};
    for (const entry of registryEntries) {
      prefilled[entry.token] = entry.value;
    }
    setValues(prev => {
      const merged = { ...prefilled };
      // Preserve any local edits the user already made before registry loaded
      for (const [k, v] of Object.entries(prev)) {
        if (v) merged[k] = v;
      }
      return merged;
    });
  }, [registryEntries]);

  // Source map for showing filled/default/empty state
  const sourceMap = useMemo(() => {
    const m: Record<string, "campaign" | "default"> = {};
    for (const entry of registryEntries ?? []) {
      m[entry.token] = entry.source as "campaign" | "default";
    }
    return m;
  }, [registryEntries]);

  // Only show tokens actually present in this kit's assets
  const tokensToShow = report.uniqueTokens;

  async function handleSave() {
    const entries = tokensToShow
      .filter(t => (values[t] ?? "").trim())
      .map(t => ({ token: t, value: values[t].trim() }));
    if (entries.length === 0) return;
    await saveMut.mutateAsync({ serviceId, entries });
    utils.placeholders.list.invalidate({ serviceId });
    setSaved(true);
    onSaved?.();
    setTimeout(() => setSaved(false), 2000);
  }

  const filledCount = tokensToShow.filter(t => (values[t] ?? "").trim()).length;
  const totalCount = tokensToShow.length;

  return (
    <div style={{
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      padding: "32px 28px",
      maxWidth: 580,
      width: "100%",
      maxHeight: "80vh",
      overflow: "auto",
      fontFamily: "var(--v2-font-body)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "var(--v2-font-heading)",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: 22,
          color: "var(--v2-text-color)",
          margin: 0,
        }}>
          Fill Your Campaign Details
        </h2>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 20, color: "#999", padding: "4px 8px", lineHeight: 1,
        }}>
          &times;
        </button>
      </div>

      <p style={{ fontSize: 13, color: "#777", margin: "0 0 20px", lineHeight: 1.5 }}>
        {filledCount} of {totalCount} filled. Values you enter here are remembered for future campaigns.
      </p>

      {isLoading ? (
        <p style={{ color: "#999", fontSize: 14 }}>Loading saved values...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tokensToShow.map(token => {
            const val = values[token] ?? "";
            const source = sourceMap[token];
            const isFilled = val.trim().length > 0;
            const hint = hintForToken(token);
            return (
              <div key={token}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
                }}>
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
                  <label style={{
                    fontSize: 13, fontWeight: 600, color: "var(--v2-text-color)",
                  }}>
                    {labelForToken(token)}
                  </label>
                  {source === "default" && isFilled && (
                    <span style={{
                      fontSize: 10, color: "#999", fontWeight: 500,
                      background: "rgba(26,22,36,0.05)", borderRadius: 9999,
                      padding: "1px 8px",
                    }}>
                      from last campaign
                    </span>
                  )}
                </div>
                {hint && (
                  <p style={{ fontSize: 11, color: "#999", margin: "0 0 4px", lineHeight: 1.4 }}>
                    {hint}
                  </p>
                )}
                <input
                  type="text"
                  value={val}
                  onChange={e => setValues(prev => ({ ...prev, [token]: e.target.value }))}
                  placeholder={hint ? hint.split(" — e.g. ")[1]?.replace(/^'|'$/g, "") ?? token : token}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    fontSize: 14,
                    fontFamily: "var(--v2-font-body)",
                    borderRadius: 10,
                    border: isFilled ? "1px solid rgba(22,163,74,0.25)" : "1px solid rgba(26,22,36,0.15)",
                    background: isFilled ? "rgba(22,163,74,0.03)" : "#fff",
                    color: "var(--v2-text-color)",
                    outline: "none",
                    transition: "border-color 0.15s ease",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#FF5B1D"; }}
                  onBlur={e => { e.target.style.borderColor = isFilled ? "rgba(22,163,74,0.25)" : "rgba(26,22,36,0.15)"; }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={{
            padding: "10px 20px", borderRadius: 9999, border: "1px solid rgba(26,22,36,0.15)",
            background: "transparent", color: "var(--v2-text-color)",
            fontFamily: "var(--v2-font-body)", fontWeight: 600, fontSize: 14,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saveMut.isPending || filledCount === 0}
          style={{
            padding: "10px 24px", borderRadius: 9999, border: "none",
            background: "var(--v2-primary-btn)", color: "#fff",
            fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: 14,
            cursor: saveMut.isPending || filledCount === 0 ? "not-allowed" : "pointer",
            opacity: saveMut.isPending || filledCount === 0 ? 0.55 : 1,
          }}
        >
          {saveMut.isPending ? "Saving..." : saved ? "Saved ✓" : `Save ${filledCount} Value${filledCount === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
