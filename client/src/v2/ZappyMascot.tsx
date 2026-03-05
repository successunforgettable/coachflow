/**
 * ZappyMascot — Sprint 4
 * Renders the official Zappy character in one of four states.
 * All states use the same image; visual differentiation is achieved
 * via CSS animations and wrapper styling.
 */

const ZAPPY_CDN = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663026750612/EpdOCZXnsiLLghXc.png";

export type ZappyState = "idle" | "loading" | "cheering" | "concerned";

interface ZappyMascotProps {
  state: ZappyState;
  size?: number; // px, default 120
}

export default function ZappyMascot({ state, size = 120 }: ZappyMascotProps) {
  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  // State-specific image animation
  const imageStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    animation:
      state === "loading"  ? "zappy-float 1.4s ease-in-out infinite" :
      state === "cheering" ? "zappy-bounce 0.5s ease-in-out infinite alternate" :
      state === "concerned"? "zappy-shake 0.6s ease-in-out" :
      "none",
    filter:
      state === "concerned" ? "grayscale(30%) brightness(0.9)" :
      state === "cheering"  ? "brightness(1.1) saturate(1.2)" :
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
      `}</style>
      <div style={wrapperStyle}>
        <img
          src={ZAPPY_CDN}
          alt={`Zappy — ${state}`}
          style={imageStyle}
          draggable={false}
        />
      </div>
    </>
  );
}
