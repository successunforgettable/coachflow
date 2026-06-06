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

/** Human-readable labels for canonical tokens. */
const TOKEN_LABELS: Record<string, string> = {
  "[INSERT_HOST_NAME]": "Your Name",
  "[INSERT_CONTACT_EMAIL]": "Support Email",
  "[INSERT_OFFER_NAME]": "Offer Name",
  "[INSERT_OFFER_LINK]": "Offer / Checkout URL",
  "[INSERT_PRICE]": "Price",
  "[INSERT_DEADLINE]": "Sales Deadline",
  "[INSERT_BOOKING_URL]": "Booking / Calendar URL",
  "[INSERT_BOOKING_TIME]": "Booking Call Time",
  "[INSERT_BOOKING_TIMEZONE]": "Booking Timezone",
  "[INSERT_BOOKING_DURATION]": "Booking Call Duration",
  "[INSERT_EVENT_NAME]": "Event Name",
  "[INSERT_EVENT_DATE]": "Event Date",
  "[INSERT_EVENT_TIME]": "Event Time",
  "[INSERT_EVENT_TIMEZONE]": "Event Timezone",
  "[INSERT_EVENT_DURATION]": "Event Duration",
  "[INSERT_EVENT_VENUE]": "Event Venue",
  "[INSERT_EVENT_AGENDA]": "Event Agenda",
  "[INSERT_LEAD_MAGNET_NAME]": "Lead Magnet Name",
  "[INSERT_PROGRAMME_DURATION]": "Programme Duration",
  "[INSERT_GUARANTEE_TERMS]": "Guarantee Terms",
  "[INSERT_COHORT_LIMIT]": "Cohort Size Limit",
  "[INSERT_COHORT_CLOSE_DATE]": "Enrolment Close Date",
  "[INSERT_PROGRAMME_START_DATE]": "Programme Start Date",
  "[INSERT_FIRST_RESULT_TIMEFRAME]": "First-Result Timeframe",
  "[INSERT_BONUS_1_NAME]": "Bonus 1 Name",
  "[INSERT_BONUS_1_VALUE]": "Bonus 1 Value",
  "[INSERT_BONUS_2_NAME]": "Bonus 2 Name",
  "[INSERT_BONUS_2_VALUE]": "Bonus 2 Value",
  "[INSERT_BONUS_3_NAME]": "Bonus 3 Name",
  "[INSERT_BONUS_3_VALUE]": "Bonus 3 Value",
  "[INSERT_BONUS_4_NAME]": "Bonus 4 Name",
  "[INSERT_BONUS_4_VALUE]": "Bonus 4 Value",
  "[INSERT_BONUS_5_NAME]": "Bonus 5 Name",
  "[INSERT_BONUS_5_VALUE]": "Bonus 5 Value",
  "[INSERT_CART_OPEN_DATE]": "Cart Open Date",
  "[INSERT_CART_CLOSE_DATE]": "Cart Close Date",
  "[INSERT_CART_CLOSE_TIME]": "Cart Close Time",
  "[INSERT_REPLAY_URL]": "Replay URL",
  "[INSERT_REPLAY_EXPIRY]": "Replay Expiry",
  "[INSERT_REPLAY_AVAILABILITY]": "Replay Availability",
  "[INSERT_LAUNCH_PRODUCT_NAME]": "Launch Product Name",
  "[INSERT_BONUS_VALUE]": "Bonus Value",
  "[INSERT_LAST_ENGAGEMENT_TIMEFRAME]": "Last Engagement Timeframe",
  "[INSERT_INCENTIVE]": "Re-engagement Incentive",
  "[INSERT_PARKING_INFO]": "Parking Info",
  "[INSERT_DRESS_CODE]": "Dress Code",
  "[INSERT_WHAT_TO_BRING]": "What to Bring",
  "[INSERT_ROOM_OR_FLOOR_INFO]": "Room / Floor Info",
  "[INSERT_DIETARY_NOTES]": "Dietary Notes",
  "[INSERT_COACH_CREDENTIAL]": "Your Credential / Certification",
  "[INSERT_AUTHORITY_TITLE]": "Your Title / Role",
  "[INSERT_FEATURED_IN]": "Featured In (Media / Press)",
};

function labelForToken(token: string): string {
  return TOKEN_LABELS[token] ?? token.replace(/^\[INSERT_/, "").replace(/\]$/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
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
                <input
                  type="text"
                  value={val}
                  onChange={e => setValues(prev => ({ ...prev, [token]: e.target.value }))}
                  placeholder={token}
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
