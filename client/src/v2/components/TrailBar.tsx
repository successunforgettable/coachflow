/**
 * TrailBar — Trail Sprint 1, Commit 2
 *
 * 11-stop campaign trail rendered as a horizontal path with milestone groupings.
 * V2 inline-styles convention. All colours from v2-theme.css tokens + spec additions.
 *
 * Stop states: pending, generating, done, stale, imported
 * Milestone groups: FOUNDATION (4), MAGNET (3), CONVERT (3), CREATIVE (1)
 * Mobile: collapses to slim bar; tap expands bottom-sheet with all 11 stops.
 */
import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type StopState = "pending" | "generating" | "done" | "stale" | "imported";

export interface TrailStop {
  key: string;
  label: string;
  state: StopState;
}

export interface TrailBarProps {
  stops: TrailStop[];
  onStopClick?: (key: string, state: StopState) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BRAND_PRIMARY = "#FF5B1D";
const TRAIL_PENDING = "#D1D5DB";
const TRAIL_STALE = "#F59E0B";
const IMPORTED_FILL = BRAND_PRIMARY;
const BG_CREAM = "#F5F1EA";
const TEXT_COLOR = "#1A1624";
const FONT_BODY = "'Instrument Sans', system-ui, sans-serif";
const FONT_HEADING = "'Fraunces', Georgia, serif";

const MILESTONE_GROUPS: { name: string; count: number }[] = [
  { name: "FOUNDATION", count: 4 },
  { name: "MAGNET", count: 3 },
  { name: "CONVERT", count: 3 },
  { name: "CREATIVE", count: 1 },
];

// ─── Stop icon rendering ──────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7.5L5.5 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M10 3.5A4.5 4.5 0 003.17 3M2 8.5A4.5 4.5 0 008.83 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 1.5v2h-2M2 10.5v-2h2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8.5 5.5L5.5 8.5a1.5 1.5 0 01-2.12-2.12l4-4a2 2 0 012.83 2.83L6 9.4a2.5 2.5 0 01-3.54-3.54L5.5 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Single stop circle ──────────────────────────────────────────────────────
function StopCircle({ state, reducedMotion }: { state: StopState; reducedMotion: boolean }) {
  const size = 32;
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.25s ease",
  };

  if (state === "pending") {
    return (
      <div style={{ ...common, border: `2.5px solid ${TRAIL_PENDING}`, background: "transparent" }} />
    );
  }
  if (state === "generating") {
    return (
      <div style={{
        ...common,
        border: `2.5px solid ${BRAND_PRIMARY}`,
        background: "transparent",
        animation: reducedMotion ? "none" : "trailbar-pulse 1.5s ease-in-out infinite",
      }} />
    );
  }
  if (state === "done") {
    return (
      <div style={{ ...common, background: BRAND_PRIMARY, border: `2.5px solid ${BRAND_PRIMARY}` }}>
        <CheckIcon />
      </div>
    );
  }
  if (state === "stale") {
    return (
      <div style={{ ...common, background: TRAIL_STALE, border: `2.5px solid ${TRAIL_STALE}` }}>
        <RefreshIcon />
      </div>
    );
  }
  // imported
  return (
    <div style={{ ...common, background: IMPORTED_FILL, border: `2.5px solid ${IMPORTED_FILL}` }}>
      <PaperclipIcon />
    </div>
  );
}

// ─── Connector line between stops ─────────────────────────────────────────────
function Connector({ leftDone, rightDone }: { leftDone: boolean; rightDone: boolean }) {
  const filled = leftDone && rightDone;
  return (
    <div style={{
      flex: 1,
      height: 3,
      minWidth: 12,
      maxWidth: 40,
      background: filled ? BRAND_PRIMARY : TRAIL_PENDING,
      borderRadius: 2,
      transition: "background 0.3s ease",
    }} />
  );
}

function isDoneish(s: StopState) {
  return s === "done" || s === "imported";
}

// ─── Counter with tick animation ──────────────────────────────────────────────
function CompletionCounter({ count, total, reducedMotion }: { count: number; total: number; reducedMotion: boolean }) {
  const [displayed, setDisplayed] = useState(0);
  const prevCount = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayed(count);
      return;
    }
    const start = prevCount.current;
    const diff = count - start;
    if (diff === 0) return;
    const step = diff > 0 ? 1 : -1;
    const interval = Math.max(50, 300 / Math.abs(diff));
    let current = start;
    const timer = setInterval(() => {
      current += step;
      setDisplayed(current);
      if (current === count) clearInterval(timer);
    }, interval);
    prevCount.current = count;
    return () => clearInterval(timer);
  }, [count, reducedMotion]);

  return (
    <div style={{
      fontFamily: FONT_BODY,
      fontSize: 13,
      fontWeight: 600,
      color: TEXT_COLOR,
      opacity: 0.7,
      textAlign: "center",
      marginTop: 8,
    }}>
      {displayed} of {total} complete
    </div>
  );
}

// ─── Milestone bracket label ──────────────────────────────────────────────────
function MilestoneLabel({ name }: { name: string }) {
  return (
    <div style={{
      fontFamily: FONT_BODY,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.08em",
      color: TEXT_COLOR,
      opacity: 0.35,
      textAlign: "center",
      textTransform: "uppercase" as const,
      marginTop: 2,
    }}>
      {name}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: TEXT_COLOR,
          color: BG_CREAM,
          fontFamily: FONT_BODY,
          fontSize: 11,
          padding: "4px 10px",
          borderRadius: 6,
          whiteSpace: "nowrap",
          zIndex: 50,
          pointerEvents: "none",
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Mobile bottom-sheet ──────────────────────────────────────────────────────
function BottomSheet({ stops, onClose, onStopClick, reducedMotion }: {
  stops: TrailStop[];
  onClose: () => void;
  onStopClick?: (key: string, state: StopState) => void;
  reducedMotion: boolean;
}) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ flex: 1, background: "rgba(0,0,0,0.35)" }}
      />
      {/* Sheet */}
      <div style={{
        background: BG_CREAM,
        borderRadius: "20px 20px 0 0",
        padding: "20px 16px 28px",
        maxHeight: "70vh",
        overflowY: "auto",
      }}>
        <div style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          background: TRAIL_PENDING,
          margin: "0 auto 16px",
        }} />
        <div style={{
          fontFamily: FONT_HEADING,
          fontSize: 18,
          fontWeight: 700,
          fontStyle: "italic",
          color: TEXT_COLOR,
          marginBottom: 16,
          textAlign: "center",
        }}>
          Campaign Trail
        </div>
        {stops.map((stop, i) => {
          const clickable = stop.state === "done" || stop.state === "imported";
          return (
            <div
              key={stop.key}
              onClick={() => clickable && onStopClick?.(stop.key, stop.state)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                cursor: clickable ? "pointer" : "default",
                background: clickable ? "rgba(255,91,29,0.04)" : "transparent",
                marginBottom: 4,
              }}
            >
              <StopCircle state={stop.state} reducedMotion={reducedMotion} />
              <div style={{
                fontFamily: FONT_BODY,
                fontSize: 14,
                fontWeight: 500,
                color: TEXT_COLOR,
                opacity: stop.state === "pending" ? 0.45 : 1,
              }}>
                {stop.label}
              </div>
              <div style={{
                marginLeft: "auto",
                fontFamily: FONT_BODY,
                fontSize: 11,
                fontWeight: 600,
                color: stop.state === "stale" ? TRAIL_STALE : stop.state === "generating" ? BRAND_PRIMARY : TEXT_COLOR,
                opacity: stop.state === "pending" ? 0.35 : 0.6,
                textTransform: "uppercase" as const,
                letterSpacing: "0.04em",
              }}>
                {stop.state}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main TrailBar ────────────────────────────────────────────────────────────
export default function TrailBar({ stops, onStopClick }: TrailBarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    : false;

  const doneCount = stops.filter(s => isDoneish(s.state) || s.state === "stale").length;

  // Build grouped stops for milestone brackets
  let idx = 0;
  const groups = MILESTONE_GROUPS.map(g => {
    const groupStops = stops.slice(idx, idx + g.count);
    idx += g.count;
    return { ...g, stops: groupStops };
  });

  return (
    <>
      <style>{`
        @keyframes trailbar-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,91,29,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(255,91,29,0); }
        }
      `}</style>

      {/* ── Desktop bar ── */}
      <div style={{
        background: "white",
        borderRadius: 20,
        padding: "16px 20px 12px",
        boxShadow: "0 2px 16px 0 rgba(26,22,36,0.08)",
      }}>
        {/* Desktop: full trail (hidden on mobile) */}
        <div className="trailbar-desktop" style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 4,
        }}>
          {groups.map((group, gi) => (
            <div key={group.name} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0,
            }}>
              {/* Stops row */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 0,
                padding: "0 4px",
                borderBottom: `2px solid transparent`,
              }}>
                {group.stops.map((stop, si) => {
                  const globalIdx = MILESTONE_GROUPS.slice(0, gi).reduce((a, g) => a + g.count, 0) + si;
                  const clickable = stop.state === "done" || stop.state === "imported";
                  const isPending = stop.state === "pending";

                  const stopEl = (
                    <div
                      key={stop.key}
                      onClick={() => {
                        if (clickable) onStopClick?.(stop.key, stop.state);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        cursor: clickable ? "pointer" : "default",
                        minWidth: 44,
                      }}
                    >
                      <StopCircle state={stop.state} reducedMotion={reducedMotion} />
                      <div style={{
                        fontFamily: FONT_BODY,
                        fontSize: 10,
                        fontWeight: 500,
                        color: TEXT_COLOR,
                        opacity: isPending ? 0.4 : 0.75,
                        textAlign: "center",
                        lineHeight: 1.2,
                        maxWidth: 56,
                      }}>
                        {stop.label}
                      </div>
                    </div>
                  );

                  return (
                    <div key={stop.key} style={{ display: "flex", alignItems: "center" }}>
                      {si > 0 && (
                        <Connector
                          leftDone={isDoneish(group.stops[si - 1].state)}
                          rightDone={isDoneish(stop.state)}
                        />
                      )}
                      {/* Connector between groups */}
                      {si === 0 && gi > 0 && (
                        <Connector
                          leftDone={isDoneish(groups[gi - 1].stops[groups[gi - 1].stops.length - 1].state)}
                          rightDone={isDoneish(stop.state)}
                        />
                      )}
                      {isPending ? (
                        <Tooltip text="Finish the steps before this one first">
                          {stopEl}
                        </Tooltip>
                      ) : stopEl}
                    </div>
                  );
                })}
              </div>
              {/* Milestone label */}
              <MilestoneLabel name={group.name} />
            </div>
          ))}
        </div>

        {/* Mobile: slim bar (hidden on desktop) */}
        <div
          className="trailbar-mobile"
          onClick={() => setMobileExpanded(true)}
          style={{
            display: "none",
            cursor: "pointer",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Progress bar */}
          <div style={{
            flex: 1,
            height: 8,
            background: TRAIL_PENDING,
            borderRadius: 4,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${(doneCount / stops.length) * 100}%`,
              background: BRAND_PRIMARY,
              borderRadius: 4,
              transition: reducedMotion ? "none" : "width 0.3s ease",
            }} />
          </div>
          <div style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 600,
            color: TEXT_COLOR,
            whiteSpace: "nowrap",
          }}>
            {doneCount} of {stops.length}
          </div>
        </div>

        {/* Counter (desktop only) */}
        <div className="trailbar-counter-desktop">
          <CompletionCounter count={doneCount} total={stops.length} reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* Responsive styles — scoped via unique class names */}
      <style>{`
        .trailbar-desktop { display: flex !important; }
        .trailbar-mobile { display: none !important; }
        .trailbar-counter-desktop { display: block !important; }
        @media (max-width: 640px) {
          .trailbar-desktop { display: none !important; }
          .trailbar-mobile { display: flex !important; }
          .trailbar-counter-desktop { display: none !important; }
        }
      `}</style>

      {/* Mobile bottom-sheet */}
      {mobileExpanded && (
        <BottomSheet
          stops={stops}
          onClose={() => setMobileExpanded(false)}
          onStopClick={onStopClick}
          reducedMotion={reducedMotion}
        />
      )}
    </>
  );
}
