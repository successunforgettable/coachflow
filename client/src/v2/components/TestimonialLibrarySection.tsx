/**
 * TestimonialLibrarySection — the coach's persistent testimonial library, for V2Settings.
 *
 * The last link in the proof chain: the 3-cap fix, the coach-proof partition and presence-based
 * rich/light routing only matter if a coach can get their testimonials into the library. This is where
 * they do it — see everything they've added, delete a bad one, and bulk-import the ones already sitting
 * in a doc (via TestimonialBulkImport). Coach-level (portable), not campaign-scoped: the in-chat picker
 * handles per-campaign selection separately. Real testimonials only — nothing generated.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import TestimonialBulkImport from "./TestimonialBulkImport";

const ORANGE = "#FF5B1D";
const INK = "#1A1624";
const MUTE = "#6B7280";
const LINE = "#EFEAE2";
const OKGREEN = "#065F46";
const FONT = "'Instrument Sans', 'Inter', system-ui, sans-serif";

export default function TestimonialLibrarySection() {
  const list = trpc.testimonials.list.useQuery();
  const utils = trpc.useUtils();
  const del = trpc.testimonials.delete.useMutation({ onSuccess: () => utils.testimonials.list.invalidate() });
  const [importing, setImporting] = useState(false);
  const [justAdded, setJustAdded] = useState<number | null>(null);

  const rows = list.data ?? [];
  const count = rows.length;

  return (
    <div style={{ fontFamily: FONT }}>
      <p style={{ fontSize: 13, color: MUTE, lineHeight: 1.5, margin: "0 0 16px" }}>
        Your real testimonials. These appear as proof on your landing pages — a page shows the ones tied
        to its offer, and your other testimonials as trust for you as a coach. We never write these for you.
      </p>

      {/* Value banner — what the last import unlocked, in plain language (not a silent toast) */}
      {justAdded != null && justAdded > 0 && (
        <div style={{ background: "#ECFDF5", border: "1px solid #C7EBD9", borderRadius: 12, padding: "12px 14px", margin: "0 0 16px", fontSize: 13, color: OKGREEN, lineHeight: 1.5 }}>
          <strong>{justAdded} testimonial{justAdded === 1 ? "" : "s"} added.</strong> Your landing pages will now show your real proof — the more you add, the more your pages have to show.
        </div>
      )}

      {/* Count + import toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0 0 12px" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>
          {list.isLoading ? "Loading…" : count === 0 ? "No testimonials yet" : `${count} in your library`}
        </span>
        {!importing && (
          <button
            onClick={() => { setImporting(true); setJustAdded(null); }}
            style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 9999, padding: "9px 20px", fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {count === 0 ? "Add your testimonials" : "Import more"}
          </button>
        )}
      </div>

      {/* Bulk import (paste / CSV) — collapsible */}
      {importing && (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 18, margin: "0 0 18px", background: "#FCFBF9" }}>
          <TestimonialBulkImport
            onImported={(r) => setJustAdded(r.added)}
            onDone={() => setImporting(false)}
          />
        </div>
      )}

      {/* Empty state */}
      {!list.isLoading && count === 0 && !importing && (
        <div style={{ border: `1px dashed ${LINE}`, borderRadius: 16, padding: "28px 20px", textAlign: "center", color: MUTE, fontSize: 13, lineHeight: 1.6 }}>
          Add the testimonials you already have — paste them or upload a CSV.<br />
          Until you do, your landing pages have no real proof to show.
        </div>
      )}

      {/* The list — see what's there, delete a bad one */}
      {count > 0 && (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden" }}>
          {rows.map((t: { id: number; name: string; title: string | null; quote: string }, i: number) => (
            <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, color: INK, lineHeight: 1.5, margin: "0 0 4px" }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ fontSize: 12, color: MUTE }}>
                  <strong style={{ color: "#4B5563" }}>{t.name}</strong>{t.title ? ` — ${t.title}` : ""}
                </div>
              </div>
              <button
                onClick={() => { if (confirm(`Delete this testimonial from ${t.name}?`)) del.mutate({ id: t.id }); }}
                disabled={del.isPending}
                title="Delete"
                style={{ flexShrink: 0, background: "none", border: "none", color: "#9CA3AF", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: "2px 6px" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
