/**
 * ZappyMascot — Sprint 4 (updated: four production SVG emotional states)
 *
 * state="loading"   → zappy-working.svg   (focused, typing on laptop)
 * state="cheering"  → zappy-cheering.svg  (arms raised, confetti, pure joy)
 * state="concerned" → zappy-concerned.svg (worried brows, red clipboard)
 * state="waiting"   → zappy-waiting.svg   (pointing at watch, playfully impatient)
 * state="idle"      → zappy-working.svg   (default fallback)
 */

import React from "react";

const ZAPPY_SVGS: Record<string, string> = {
  loading:   "/zappy-working.svg",
  cheering:  "/zappy-cheering.svg",
  concerned: "/zappy-concerned.svg",
  waiting:   "/zappy-waiting.svg",
  idle:      "/zappy-working.svg",
};

export type ZappyState = "idle" | "loading" | "cheering" | "concerned" | "waiting";

interface ZappyMascotProps {
  state: ZappyState;
  size?: number; // px, default 120
}

export default function ZappyMascot({ state, size = 120 }: ZappyMascotProps) {
  const src = ZAPPY_SVGS[state] ?? ZAPPY_SVGS.idle;

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  const imageStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    animation:
      state === "loading"   ? "zappy-float 1.4s ease-in-out infinite" :
      state === "cheering"  ? "zappy-bounce 0.5s ease-in-out infinite alternate" :
      state === "concerned" ? "zappy-shake 0.6s ease-in-out" :
      state === "waiting"   ? "zappy-tap 1.2s ease-in-out infinite" :
      "none",
    transition: "filter 0.3s ease",
  };

  return (
    <>
      <style>{`
        @keyframes zappy-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes zappy-bounce {
          from { transform: translateY(0px) rotate(-3deg) scale(1); }
          to   { transform: translateY(-10px) rotate(3deg) scale(1.05); }
        }
        @keyframes zappy-shake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-6px) rotate(-2deg); }
          40%      { transform: translateX(6px) rotate(2deg); }
          60%      { transform: translateX(-4px) rotate(-1deg); }
          80%      { transform: translateX(4px) rotate(1deg); }
        }
        @keyframes zappy-tap {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          30%      { transform: translateY(-3px) rotate(-1deg); }
          60%      { transform: translateY(2px) rotate(1deg); }
        }
      `}</style>
      <div style={wrapperStyle}>
        <img
          src={src}
          alt={`Zappy — ${state}`}
          style={imageStyle}
          draggable={false}
        />
      </div>
    </>
  );
}
