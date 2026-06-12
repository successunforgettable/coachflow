/**
 * ComplianceDial — Trail Sprint 3 C4 (spec 3.6, honesty rule).
 *
 * Shown ONLY while one of the 3 scored nodes (headlines, adCopy,
 * landingPage) is generating. The climb is theater capped at 90 — the dial
 * NEVER shows a score the row doesn't have; the REAL persisted score lands
 * on the reveal card when generation completes. prefers-reduced-motion:
 * no climb, static "checking" state.
 */
import { useEffect, useState } from "react";

const BRAND_PRIMARY = "#FF5B1D";
const TEXT_COLOR = "#1A1624";
const FONT_BODY = "'Instrument Sans', system-ui, sans-serif";

export default function ComplianceDial({ label }: { label: string }) {
  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    : false;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    // Ease-out climb to 90 over ~25s. Never reaches 100 — that's earned.
    const start = Date.now();
    const t = setInterval(() => {
      const elapsed = (Date.now() - start) / 25_000;
      const eased = 1 - Math.pow(1 - Math.min(elapsed, 1), 2);
      setValue(Math.min(90, Math.round(eased * 90)));
    }, 250);
    return () => clearInterval(t);
  }, [reducedMotion]);

  const pct = reducedMotion ? null : value;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "white",
      borderRadius: 12,
      padding: "8px 16px",
      boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
      marginTop: 8,
    }}>
      {/* Ring */}
      <div style={{ position: "relative", width: 34, height: 34, flexShrink: 0 }}>
        <svg width="34" height="34" viewBox="0 0 34 34">
          <circle cx="17" cy="17" r="14" fill="none" stroke="#E5E7EB" strokeWidth="4" />
          <circle
            cx="17" cy="17" r="14" fill="none"
            stroke={BRAND_PRIMARY} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${((pct ?? 30) / 100) * 88} 88`}
            transform="rotate(-90 17 17)"
            style={{ transition: reducedMotion ? "none" : "stroke-dasharray 0.25s linear" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: TEXT_COLOR,
        }}>
          {pct ?? "…"}
        </div>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_COLOR, opacity: 0.75 }}>
        Meta compliance — checking {label} line by line…
      </div>
    </div>
  );
}
