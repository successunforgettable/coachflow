/**
 * LandingPage — Full rebuild per brief (March 2026)
 * 6 sections: Hero · 11-Step Path · Problem/Solution · Compliance · Pricing Teaser · Footer CTA
 *
 * Design system:
 *   Background: #F5F1EA (cream)   Primary: #FF5B1D (orange)   Secondary: #8B5CF6 (purple)
 *   Dark: #1A1624                 Body: Instrument Sans        Display: Fraunces italic 900
 *   Pills: border-radius 9999px   Cards: border-radius 24px min
 */
import { useLocation } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import Confetti from "react-confetti";

// ─── Design tokens ──────────────────────────────────────────────────────────────
const CREAM  = "#F5F1EA";
const INK    = "#1A1624";
const ORANGE = "#FF5B1D";
const PURPLE = "#8B5CF6";
const MUTED  = "#7A6F6A";

// ─── Zappy SVG paths ────────────────────────────────────────────────────────────
const ZAPPY_WAITING  = "/zappy-waiting.svg";
const ZAPPY_WORKING  = "/zappy-working.svg";
const ZAPPY_CHEERING = "/zappy-cheering.svg";

// ─── Campaign tiles ─────────────────────────────────────────────────────────────
const CAMPAIGN_TILES = [
  { label: "Webinar Launch",     desc: "Live training to sell a programme",    emoji: "🎙️" },
  { label: "Challenge Campaign", desc: "5-day event to build an audience",     emoji: "🔥" },
  { label: "Course Launch",      desc: "Releasing a course to your list",      emoji: "🎓" },
  { label: "Product Launch",     desc: "Releasing a new service or offer",     emoji: "🚀" },
];

// ─── 11-step path nodes ─────────────────────────────────────────────────────────
const PATH_NODES = [
  { id: 1,  label: "Service",             tier: "free" },
  { id: 2,  label: "ICP",                tier: "free" },
  { id: 3,  label: "Offer",              tier: "free" },
  { id: 4,  label: "Unique Method",      tier: "free" },
  { id: 5,  label: "Free Opt-In",        tier: "free" },
  { id: 6,  label: "Headlines",          tier: "pro"  },
  { id: 7,  label: "Ad Copy",            tier: "pro"  },
  { id: 8,  label: "Landing Page",       tier: "pro"  },
  { id: 9,  label: "Email Sequence",     tier: "pro"  },
  { id: 10, label: "WhatsApp Sequence",  tier: "pro"  },
  { id: 11, label: "Push to Meta & GHL", tier: "pro"  },
];

// ─── Global keyframes injected once ─────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseRing {
    0%   { box-shadow: 0 0 0 0 rgba(255,91,29,0.4); }
    70%  { box-shadow: 0 0 0 16px rgba(255,91,29,0); }
    100% { box-shadow: 0 0 0 0 rgba(255,91,29,0); }
  }
  @keyframes nodeLight {
    from { transform: scale(0.6); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  @keyframes zappyHop {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-8px); }
  }
  @keyframes zappyBreathe {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-6px); }
  }
  @keyframes tileIn {
    from { opacity: 0; transform: translateY(20px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes wipeOrange {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }
  html { scroll-behavior: smooth; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Instrument Sans', sans-serif; background: ${CREAM}; }
`;

function GlobalStyles() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);
  return null;
}

// ─── Pill Button ────────────────────────────────────────────────────────────────
interface PillBtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "orange" | "dark" | "outline" | "purple";
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
  href?: string;
}
function PillBtn({ children, onClick, variant = "orange", size = "md", style, href }: PillBtnProps) {
  const base: React.CSSProperties = {
    borderRadius: 9999,
    border: "none",
    cursor: "pointer",
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "transform 0.15s, box-shadow 0.15s, opacity 0.15s",
    textDecoration: "none",
    ...style,
  };
  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: "8px 20px", fontSize: 13 },
    md: { padding: "12px 28px", fontSize: 15 },
    lg: { padding: "16px 40px", fontSize: 17 },
  };
  const variants: Record<string, React.CSSProperties> = {
    orange:  { background: ORANGE, color: "#fff" },
    dark:    { background: INK, color: "#fff" },
    outline: { background: "transparent", color: INK, border: `2px solid ${INK}` },
    purple:  { background: PURPLE, color: "#fff" },
  };
  const combined = { ...base, ...sizes[size], ...variants[variant] };
  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
    (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)";
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.transform = "scale(1)";
    (e.currentTarget as HTMLElement).style.boxShadow = "none";
  };
  if (href) {
    return (
      <a href={href} style={combined} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {children}
      </a>
    );
  }
  return (
    <button style={combined} onClick={onClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
    </button>
  );
}

// ─── Signup Modal ────────────────────────────────────────────────────────────────
function SignupModal({ onClose, campaignType }: { onClose: () => void; campaignType: string }) {
  const [, navigate] = useLocation();
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(26,22,36,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: CREAM, borderRadius: 24, padding: "40px 36px", maxWidth: 440, width: "100%", textAlign: "center", position: "relative", animation: "fadeUp 0.3s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <img src={ZAPPY_CHEERING} alt="Zappy cheering" style={{ width: 80, height: 80, margin: "0 auto 16px", display: "block" }} />
        <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 26, color: INK, margin: "0 0 8px" }}>
          Let's build your {campaignType}!
        </h2>
        <p style={{ color: MUTED, fontSize: 15, margin: "0 0 28px", lineHeight: 1.5 }}>
          Create your free account and Zappy will guide you through every step.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PillBtn size="lg" onClick={() => navigate("/signup")} style={{ width: "100%" }}>
            Create Free Account
          </PillBtn>
          <PillBtn size="md" variant="outline" onClick={() => navigate("/login")} style={{ width: "100%" }}>
            Already have an account? Sign in
          </PillBtn>
        </div>
        <p style={{ color: MUTED, fontSize: 12, marginTop: 16 }}>No credit card required. Your first ICP is always free.</p>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: MUTED }}
          aria-label="Close"
        >×</button>
      </div>
    </div>
  );
}

// ─── Navigation ─────────────────────────────────────────────────────────────────
function LandingNav({ onCTA }: { onCTA: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        background: scrolled ? "rgba(245,241,234,0.96)" : CREAM,
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid rgba(26,22,36,0.08)` : "none",
        transition: "all 0.3s",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src={ZAPPY_WAITING} alt="ZAP" style={{ width: 32, height: 32 }} />
            <span style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 22, color: INK, letterSpacing: "-0.5px" }}>
              ZAP
            </span>
          </div>

          {/* Desktop links */}
          <div style={{ display: "flex", alignItems: "center", gap: 28 }} className="lp-desktop-links">
            {[["#path", "How It Works"], ["#noblank", "Why ZAP"], ["#compliance", "Compliance"], ["/pricing", "Pricing"]].map(([href, label]) => (
              <a key={label} href={href} style={{ color: INK, textDecoration: "none", fontSize: 14, fontWeight: 500, opacity: 0.65, transition: "opacity 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.65")}
              >{label}</a>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/login" className="lp-desktop-signin" style={{ color: INK, textDecoration: "none", fontSize: 14, fontWeight: 500, opacity: 0.65 }}>Sign in</a>
            <PillBtn size="sm" onClick={onCTA}>Start Free</PillBtn>
            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lp-hamburger"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "none" }}
              aria-label="Menu"
            >
              <div style={{ width: 22, height: 2, background: INK, marginBottom: 5, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
              <div style={{ width: 22, height: 2, background: INK, marginBottom: 5, opacity: menuOpen ? 0 : 1, transition: "all 0.2s" }} />
              <div style={{ width: 22, height: 2, background: INK, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 198, background: "rgba(26,22,36,0.4)" }}
          onClick={() => setMenuOpen(false)}
        />
      )}
      {/* Mobile sheet */}
      <div style={{
        position: "fixed", top: 64, left: 0, right: 0, zIndex: 199,
        background: CREAM, borderBottom: `1px solid rgba(26,22,36,0.1)`,
        padding: "16px 24px 24px",
        transform: menuOpen ? "translateY(0)" : "translateY(-110%)",
        transition: "transform 0.25s ease",
        display: "flex", flexDirection: "column",
      }}>
        {[["#path", "How It Works"], ["#noblank", "Why ZAP"], ["#compliance", "Compliance"], ["/pricing", "Pricing"]].map(([href, label]) => (
          <a key={label} href={href} onClick={() => setMenuOpen(false)}
            style={{ color: INK, textDecoration: "none", fontSize: 16, fontWeight: 500, padding: "14px 0", borderBottom: `1px solid rgba(26,22,36,0.07)` }}
          >{label}</a>
        ))}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <PillBtn size="md" onClick={() => { setMenuOpen(false); onCTA(); }} style={{ width: "100%" }}>Start Free</PillBtn>
          <PillBtn size="md" variant="outline" onClick={() => { setMenuOpen(false); navigate("/login"); }} style={{ width: "100%" }}>Sign in</PillBtn>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .lp-desktop-links { display: none !important; }
          .lp-desktop-signin { display: none !important; }
          .lp-hamburger { display: block !important; }
        }
      `}</style>
    </>
  );
}

// ─── Section 1: Hero ─────────────────────────────────────────────────────────────
function HeroSection({ onCampaignSelect }: { onCampaignSelect: (type: string) => void }) {
  const [inputVal, setInputVal] = useState("");
  const [showTiles, setShowTiles] = useState(false);
  const [zappyState, setZappyState] = useState<"waiting" | "working">("waiting");
  const [showWipe, setShowWipe] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleShowMe = useCallback(() => {
    if (!inputVal.trim()) {
      inputRef.current?.focus();
      return;
    }
    setZappyState("working");
    setShowWipe(true);
    setTimeout(() => {
      setShowWipe(false);
      setShowTiles(true);
    }, 500);
  }, [inputVal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleShowMe();
  };

  return (
    <section style={{ background: CREAM, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 24px 80px", position: "relative", overflow: "hidden" }}>
      {/* Background blobs */}
      <div style={{ position: "absolute", top: "8%", right: "-8%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,91,29,0.07) 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)`, pointerEvents: "none" }} />

      {/* Orange wipe overlay */}
      {showWipe && (
        <div style={{ position: "absolute", inset: 0, background: ORANGE, zIndex: 10, transformOrigin: "left", animation: "wipeOrange 0.5s ease forwards" }} />
      )}

      <div style={{ maxWidth: 700, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Zappy */}
        <img
          src={zappyState === "working" ? ZAPPY_WORKING : ZAPPY_WAITING}
          alt="Zappy"
          style={{
            width: 110, height: 110, margin: "0 auto 24px", display: "block",
            animation: zappyState === "working" ? "zappyHop 0.6s ease infinite" : "zappyBreathe 3s ease infinite",
            transition: "all 0.3s",
          }}
        />

        {/* Headline */}
        <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(36px, 6vw, 62px)", color: INK, margin: "0 0 16px", lineHeight: 1.1, letterSpacing: "-1px" }}>
          Your next campaign starts<br />with one sentence.
        </h1>

        {/* Sub */}
        <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: "clamp(16px, 2.5vw, 20px)", color: MUTED, margin: "0 0 40px", lineHeight: 1.6 }}>
          Type what you do below and watch Zappy build your campaign path live.
        </p>

        {/* Input row */}
        <div style={{ display: "flex", maxWidth: 600, margin: "0 auto 16px", background: "#fff", borderRadius: 9999, border: `2px solid rgba(26,22,36,0.12)`, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. I help coaches fill their programmes with Meta ads"
            style={{ flex: 1, border: "none", outline: "none", padding: "16px 20px", fontSize: 15, fontFamily: "'Instrument Sans', sans-serif", background: "transparent", color: INK, minWidth: 0 }}
          />
          <button
            onClick={handleShowMe}
            style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 9999, margin: 4, padding: "12px 24px", fontSize: 15, fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "opacity 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Show Me
          </button>
        </div>

        {/* Campaign tiles — appear after typing */}
        {showTiles && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 24 }} className="lp-tiles-grid">
            {CAMPAIGN_TILES.map((tile, i) => (
              <div
                key={tile.label}
                style={{
                  background: "#fff", borderRadius: 24, padding: "24px 20px", textAlign: "center", cursor: "pointer",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid rgba(26,22,36,0.06)`,
                  animation: `tileIn 0.4s ease ${i * 0.12}s both`,
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(0,0,0,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"; }}
              >
                <div style={{ fontSize: 30, marginBottom: 8 }}>{tile.emoji}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 16, color: INK, marginBottom: 6 }}>{tile.label}</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 16, lineHeight: 1.4 }}>{tile.desc}</div>
                <PillBtn size="sm" onClick={() => onCampaignSelect(tile.label)} style={{ width: "100%" }}>
                  Build This Free
                </PillBtn>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 13, color: MUTED, marginTop: showTiles ? 20 : 8, fontFamily: "'Instrument Sans', sans-serif" }}>
          No credit card required. Your first ICP is always free.
        </p>

        {/* Scroll hint */}
        {!showTiles && (
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.35, animation: "zappyBreathe 2.5s ease infinite" }}>
            <span style={{ fontSize: 12, color: INK, fontFamily: "'Instrument Sans', sans-serif" }}>Scroll to see how it works</span>
            <svg width="14" height="20" viewBox="0 0 14 20" fill="none"><path d="M7 0v14M1 8l6 6 6-6" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 480px) {
          .lp-tiles-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

// ─── Section 2: 11-Step Path ─────────────────────────────────────────────────────
function PathSection({ onCTA }: { onCTA: () => void }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [litCount, setLitCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || litCount >= PATH_NODES.length) return;
    const t = setTimeout(() => setLitCount(c => c + 1), 400);
    return () => clearTimeout(t);
  }, [started, litCount]);

  return (
    <section id="path" ref={sectionRef} style={{ background: CREAM, padding: "100px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(28px, 5vw, 48px)", color: INK, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
          One path. Every asset you need to launch.
        </h2>
        <p style={{ fontSize: 18, color: MUTED, margin: "0 0 64px", lineHeight: 1.6 }}>
          Zappy guides you through 11 steps. Each one builds on the last. Nothing to figure out.
        </p>

        {/* Winding path — alternating left/right */}
        <div style={{ maxWidth: 680, margin: "0 auto 56px", position: "relative" }}>
          {/* Vertical connector line */}
          <div style={{ position: "absolute", left: "50%", top: 22, bottom: 22, width: 2, background: `linear-gradient(to bottom, #22C55E 40%, ${ORANGE} 100%)`, opacity: 0.18, transform: "translateX(-50%)" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 40px" }}>
            {PATH_NODES.map((node, i) => {
              const isLit = i < litCount;
              const isLeft = i % 2 === 0;
              const zappyHere = i === litCount - 1 && litCount < PATH_NODES.length;
              return (
                <div
                  key={node.id}
                  style={{
                    gridColumn: isLeft ? 1 : 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexDirection: isLeft ? "row-reverse" : "row",
                    justifyContent: isLeft ? "flex-end" : "flex-start",
                    opacity: isLit ? 1 : 0.2,
                    transition: "opacity 0.4s",
                    animation: isLit ? "nodeLight 0.35s ease both" : "none",
                    padding: "6px 0",
                  }}
                >
                  {/* Node circle */}
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: isLit ? (node.tier === "free" ? "#22C55E" : ORANGE) : "rgba(26,22,36,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 15, color: "#fff",
                    boxShadow: isLit ? `0 4px 16px ${node.tier === "free" ? "rgba(34,197,94,0.35)" : "rgba(255,91,29,0.35)"}` : "none",
                    position: "relative",
                    transition: "background 0.3s, box-shadow 0.3s",
                  }}>
                    {isLit ? "✓" : node.id}
                    {zappyHere && (
                      <img src={ZAPPY_WORKING} alt="" style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", width: 28, height: 28, animation: "zappyHop 0.6s ease infinite" }} />
                    )}
                  </div>
                  {/* Label */}
                  <div style={{ textAlign: isLeft ? "right" : "left" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: INK, marginBottom: 3 }}>{node.label}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                      background: node.tier === "free" ? "rgba(34,197,94,0.12)" : "rgba(255,91,29,0.12)",
                      color: node.tier === "free" ? "#16A34A" : ORANGE,
                      textTransform: "uppercase" as const, letterSpacing: 0.5,
                    }}>
                      {node.tier === "free" ? "Free" : "Pro"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <PillBtn size="lg" onClick={onCTA}>Start Building Free</PillBtn>
      </div>
    </section>
  );
}

// ─── Section 3: Problem / Solution Split ─────────────────────────────────────────
function ProblemSolutionSection({ onCTA }: { onCTA: () => void }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  const tools = [
    { icon: "📄", name: "Google Docs" },
    { icon: "🎨", name: "Canva" },
    { icon: "🤖", name: "ChatGPT" },
    { icon: "📊", name: "Meta Ads" },
    { icon: "📱", name: "GoHighLevel" },
  ];

  return (
    <section id="noblank" ref={sectionRef} style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 580 }} className="lp-split-grid">
        {/* LEFT — Before ZAP (dark) */}
        <div style={{
          background: INK, padding: "80px 48px",
          opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(-40px)",
          transition: "all 0.7s ease",
        }}>
          <div style={{ maxWidth: 400, marginLeft: "auto" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#EF4444", textTransform: "uppercase" as const }}>Before ZAP</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(24px, 3.5vw, 38px)", color: "#fff", margin: "12px 0 32px", lineHeight: 1.2 }}>
              Stop stitching tools together.
            </h2>

            {/* Tool chaos */}
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10, marginBottom: 20 }}>
              {tools.map((t, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <span>{t.name}</span>
                </div>
              ))}
            </div>
            {/* Messy arrows */}
            <div style={{ fontSize: 20, color: "rgba(255,255,255,0.18)", marginBottom: 20, letterSpacing: 6 }}>↔ ↕ ↗ ↙ ↔</div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, lineHeight: 1.7, margin: 0 }}>
              Hours of prompting. Copy-pasting between tools. Re-explaining your offer every time. And still getting generic output.
            </p>
          </div>
        </div>

        {/* RIGHT — With ZAP (cream) */}
        <div style={{
          background: CREAM, padding: "80px 48px",
          opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(40px)",
          transition: "all 0.7s ease 0.15s",
        }}>
          <div style={{ maxWidth: 400 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: ORANGE, textTransform: "uppercase" as const }}>With ZAP</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(24px, 3.5vw, 38px)", color: INK, margin: "12px 0 32px", lineHeight: 1.2 }}>
              One sentence. 110+ assets.
            </h2>

            {/* Big CTA card */}
            <div style={{ background: "#fff", borderRadius: 24, padding: "32px 28px", marginBottom: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.07)", textAlign: "center" }}>
              <img src={ZAPPY_CHEERING} alt="Zappy" style={{ width: 64, height: 64, margin: "0 auto 16px", display: "block" }} />
              <PillBtn size="lg" onClick={onCTA} style={{ width: "100%", animation: "pulseRing 2s ease infinite" }}>
                Generate All Assets
              </PillBtn>
            </div>

            <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.7, margin: 0 }}>
              One sentence about what you do. Zappy builds 110+ assets across 9 generators — all knowing exactly who you're talking to.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom stat bar */}
      <div style={{ background: ORANGE, padding: "28px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(16px, 2.5vw, 22px)", color: "#fff", margin: 0 }}>
          "The average ZAP user goes from blank page to full campaign in under 12 minutes."
        </p>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .lp-split-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

// ─── Section 4: Meta Compliance Score Card ───────────────────────────────────────
function ComplianceSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(47);
  const [showConfetti, setShowConfetti] = useState(false);
  const [checks, setChecks] = useState([false, false, false]);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const onResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) setStarted(true); }, { threshold: 0.25 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    if (score < 100) {
      const t = setTimeout(() => setScore(s => Math.min(s + 3, 100)), 28);
      return () => clearTimeout(t);
    } else {
      setShowConfetti(true);
      setTimeout(() => setChecks([true, false, false]), 200);
      setTimeout(() => setChecks([true, true, false]), 700);
      setTimeout(() => setChecks([true, true, true]), 1200);
      setTimeout(() => setShowConfetti(false), 4500);
    }
  }, [started, score]);

  const checkItems = ["No prohibited claims", "Compliant CTA language", "Landing page match verified"];
  const scoreColor = score < 60 ? "#EF4444" : score < 80 ? "#F59E0B" : ORANGE;
  const isMax = score === 100;

  return (
    <section id="compliance" ref={sectionRef} style={{ background: CREAM, padding: "100px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      {showConfetti && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={300} colors={[ORANGE, PURPLE, "#22C55E", "#F59E0B"]} />}

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(28px, 5vw, 48px)", color: INK, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
          Your ads won't just convert. They'll stay live.
        </h2>
        <p style={{ fontSize: 18, color: MUTED, margin: "0 0 56px", lineHeight: 1.6 }}>
          Meta bans accounts for non-compliant copy every day. ZAP scores every asset before you spend a dollar.
        </p>

        {/* Score card */}
        <div style={{
          background: "#fff", borderRadius: 32, padding: "48px 40px",
          boxShadow: isMax ? `0 0 0 3px ${ORANGE}, 0 20px 60px rgba(255,91,29,0.18)` : "0 8px 40px rgba(0,0,0,0.07)",
          transition: "box-shadow 0.5s",
          maxWidth: 380, margin: "0 auto 32px",
        }}>
          {/* Score ring */}
          <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 32px" }}>
            <svg viewBox="0 0 140 140" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
              <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" />
              <circle
                cx="70" cy="70" r="60" fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 60}`}
                strokeDashoffset={`${2 * Math.PI * 60 * (1 - score / 100)}`}
                style={{ transition: "stroke-dashoffset 0.05s linear, stroke 0.3s" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 40, color: scoreColor, lineHeight: 1, transition: "color 0.3s" }}>{score}</span>
              <span style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>/ 100</span>
            </div>
          </div>

          {/* Compliance checks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {checkItems.map((item, i) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 12, background: checks[i] ? "rgba(34,197,94,0.08)" : "rgba(0,0,0,0.03)", transition: "background 0.4s" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: checks[i] ? "#22C55E" : "rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.4s" }}>
                  {checks[i] && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: checks[i] ? INK : MUTED, transition: "color 0.4s" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6 }}>
          Meta compliance scoring is included on every ZAP Pro campaign. No extra tool. No extra cost.
        </p>
      </div>
    </section>
  );
}

// ─── Section 5: Pricing Teaser ───────────────────────────────────────────────────
function PricingTeaserSection({ onCTA }: { onCTA: () => void }) {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      desc: "1 ICP. See the quality before you commit.",
      cta: "Start Free",
      highlight: false,
    },
    {
      name: "ZAP Pro",
      price: "$147",
      period: "/month",
      desc: "$4.90/day. Less than one failed Meta ad click.",
      cta: "Start ZAP Pro",
      highlight: true,
    },
    {
      name: "ZAP Pro Plus",
      price: "$497",
      period: "/month",
      desc: "Unlimited everything. Run 10 campaigns simultaneously.",
      cta: "Go Pro Plus",
      highlight: false,
    },
  ];

  return (
    <section id="pricing-teaser" style={{ background: "#EDE8DF", padding: "100px 24px", textAlign: "center" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(28px, 5vw, 48px)", color: INK, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
          One plan for serious operators.
        </h2>
        <p style={{ fontSize: 18, color: MUTED, margin: "0 0 56px", lineHeight: 1.6 }}>
          Start free. Upgrade when you're ready.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 40, alignItems: "center" }} className="lp-pricing-grid">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              style={{
                background: tier.highlight ? INK : "#fff",
                borderRadius: 24,
                padding: "36px 28px",
                boxShadow: tier.highlight ? `0 16px 48px rgba(26,22,36,0.2)` : "0 4px 20px rgba(0,0,0,0.05)",
                border: tier.highlight ? `2px solid ${ORANGE}` : "1px solid rgba(0,0,0,0.06)",
                position: "relative" as const,
                transform: tier.highlight ? "scale(1.05)" : "scale(1)",
              }}
            >
              {tier.highlight && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: ORANGE, color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 16px", borderRadius: 9999, letterSpacing: 1, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
                  Most Popular
                </div>
              )}
              <div style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 20, color: tier.highlight ? "#fff" : INK, marginBottom: 8 }}>{tier.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 40, color: tier.highlight ? "#fff" : INK }}>{tier.price}</span>
                <span style={{ fontSize: 14, color: tier.highlight ? "rgba(255,255,255,0.55)" : MUTED }}>{tier.period}</span>
              </div>
              <p style={{ fontSize: 14, color: tier.highlight ? "rgba(255,255,255,0.6)" : MUTED, lineHeight: 1.5, marginBottom: 24, minHeight: 44 }}>{tier.desc}</p>
              <PillBtn
                size="md"
                variant={tier.highlight ? "orange" : "outline"}
                onClick={onCTA}
                style={{ width: "100%" }}
              >
                {tier.cta}
              </PillBtn>
            </div>
          ))}
        </div>

        <PillBtn size="md" variant="dark" href="/pricing">
          See Full Pricing →
        </PillBtn>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .lp-pricing-grid { grid-template-columns: 1fr !important; }
          .lp-pricing-grid > div { transform: scale(1) !important; }
        }
      `}</style>
    </section>
  );
}

// ─── Section 6: Footer CTA ───────────────────────────────────────────────────────
function FooterCTASection({ onCTA }: { onCTA: () => void }) {
  return (
    <section style={{ background: INK, padding: "100px 24px 80px", textAlign: "center" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <img src={ZAPPY_WAITING} alt="Zappy waiting" style={{ width: 120, height: 120, margin: "0 auto 32px", display: "block", animation: "zappyBreathe 3s ease infinite" }} />
        <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(28px, 5vw, 52px)", color: CREAM, margin: "0 0 16px", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
          Your campaign is waiting to be built.
        </h2>
        <p style={{ fontSize: 18, color: "rgba(245,241,234,0.5)", margin: "0 0 40px", lineHeight: 1.6 }}>
          It starts with one sentence. Takes 2 minutes. Zappy does the rest.
        </p>
        <PillBtn size="lg" onClick={onCTA}>Build My Campaign Free</PillBtn>
        <p style={{ fontSize: 13, color: "rgba(245,241,234,0.3)", marginTop: 16 }}>No credit card required</p>

        {/* Footer links */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid rgba(245,241,234,0.08)", display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" as const }}>
          {[["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"], ["Pricing", "/pricing"], ["Login", "/login"]].map(([label, href]) => (
            <a key={label} href={href} style={{ color: "rgba(245,241,234,0.3)", fontSize: 13, textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(245,241,234,0.65)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(245,241,234,0.3)")}
            >{label}</a>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "rgba(245,241,234,0.18)", marginTop: 20 }}>© 2026 ZAP Campaigns. All rights reserved.</p>
      </div>
    </section>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [modal, setModal] = useState<{ open: boolean; campaignType: string }>({ open: false, campaignType: "" });

  const openModal = useCallback((campaignType = "campaign") => setModal({ open: true, campaignType }), []);
  const closeModal = useCallback(() => setModal({ open: false, campaignType: "" }), []);

  return (
    <>
      <GlobalStyles />
      <LandingNav onCTA={() => openModal()} />

      <main style={{ paddingTop: 64 }}>
        <HeroSection onCampaignSelect={openModal} />
        <PathSection onCTA={() => openModal()} />
        <ProblemSolutionSection onCTA={() => openModal()} />
        <ComplianceSection />
        <PricingTeaserSection onCTA={() => openModal()} />
        <FooterCTASection onCTA={() => openModal()} />
      </main>

      {modal.open && <SignupModal onClose={closeModal} campaignType={modal.campaignType} />}
    </>
  );
}
