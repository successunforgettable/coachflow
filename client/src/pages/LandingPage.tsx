/**
 * LandingPage — V2 Cream Aesthetic
 * Background: #F5F1EA | Text: #1A1624 | Orange: #FF5B1D | Purple: #8B5CF6
 * Fonts: Fraunces italic 900 (headings) + Instrument Sans (body/buttons)
 * Shape: border-radius 24px cards, 9999px pills, zero 90-degree angles
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import Confetti from "react-confetti";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const CREAM = "#F5F1EA";
const INK = "#1A1624";
const ORANGE = "#FF5B1D";
const GREEN = "#58CC02";

// ─── Zappy SVG paths ────────────────────────────────────────────────────────────
const ZAPPY_WAITING  = "/zappy-waiting.svg";
const ZAPPY_WORKING  = "/zappy-working.svg";
const ZAPPY_CHEERING = "/zappy-cheering.svg";
const ZAPPY_CONCERNED = "/zappy-concerned.svg";

// ─── Campaign tiles ─────────────────────────────────────────────────────────────
const CAMPAIGN_TILES = [
  { label: "Webinar",        desc: "Live training to sell a programme",  emoji: "🎙️" },
  { label: "Challenge",      desc: "5-day event to build an audience",   emoji: "🔥" },
  { label: "Course Launch",  desc: "Releasing a course to your list",    emoji: "🎓" },
  { label: "Product Launch", desc: "Releasing a new service",            emoji: "🚀" },
];

// ─── 11-step path nodes ─────────────────────────────────────────────────────────
const PATH_NODES = [
  "Service", "ICP", "Offer", "Unique Method", "Free Opt-In",
  "Headlines", "Ad Copy", "Landing Page", "Email Sequence",
  "WhatsApp Sequence", "Push to Meta",
];

// ─── Global keyframes ───────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  .lp-root { font-family: 'Instrument Sans', sans-serif; background: ${CREAM}; color: ${INK}; }
  .lp-h    { font-family: 'Fraunces', serif; font-style: italic; font-weight: 900; }

  @keyframes lp-breathe {
    0%,100% { transform: translateY(0px); }
    50%     { transform: translateY(-4px); }
  }
  @keyframes lp-fade-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lp-bounce-in {
    0%   { opacity: 0; transform: translateY(28px) scale(0.94); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes lp-wipe {
    0%   { clip-path: circle(0% at 50% 50%); }
    100% { clip-path: circle(160% at 50% 50%); }
  }
  @keyframes lp-pulse-orange {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,91,29,0.45); }
    50%     { box-shadow: 0 0 0 14px rgba(255,91,29,0); }
  }
  @keyframes lp-hop {
    0%  { transform: translateY(0); }
    35% { transform: translateY(-14px); }
    65% { transform: translateY(-6px); }
    100%{ transform: translateY(0); }
  }
  @keyframes lp-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes lp-slide-up {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-28px); }
  }

  .lp-tile { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer; }
  .lp-tile:hover { transform: translateY(-4px); box-shadow: 0 14px 36px rgba(26,22,36,0.13) !important; }
  .lp-breathe { animation: lp-breathe 3.2s ease-in-out infinite; }
  .lp-hop     { animation: lp-hop 0.55s ease-out; }
  .lp-pulse   { animation: lp-pulse-orange 1.6s ease-in-out infinite; }
  .lp-bounce-in { animation: lp-bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
  .lp-fade-up { animation: lp-fade-up 0.4s ease both; }

  .lp-nav-link { transition: background 0.15s; border-radius: 9999px; }
  .lp-nav-link:hover { background: rgba(26,22,36,0.07); }
`;

// ─── Pill Button ────────────────────────────────────────────────────────────────
function PillBtn({
  onClick, children, secondary = false, fullWidth = false, large = false,
}: {
  onClick: () => void; children: React.ReactNode;
  secondary?: boolean; fullWidth?: boolean; large?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Instrument Sans', sans-serif",
        fontWeight: 600, fontSize: large ? 18 : 15,
        background: secondary ? "transparent" : (hov ? "#e04e17" : ORANGE),
        color: secondary ? INK : "#fff",
        border: secondary ? `2px solid rgba(26,22,36,0.25)` : "none",
        borderRadius: 9999,
        padding: large ? "18px 48px" : "10px 22px",
        cursor: "pointer",
        width: fullWidth ? "100%" : undefined,
        transition: "background 0.15s, transform 0.1s, box-shadow 0.15s",
        transform: hov ? "translateY(-1px)" : "translateY(0)",
        boxShadow: large && !secondary ? (hov ? "0 12px 32px rgba(255,91,29,0.4)" : "0 8px 24px rgba(255,91,29,0.28)") : "none",
      }}
    >{children}</button>
  );
}

// ─── Navigation ─────────────────────────────────────────────────────────────────
function LandingNav({ onGetStarted }: { onGetStarted: () => void }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: CREAM,
      borderBottom: "1px solid rgba(26,22,36,0.09)",
      padding: "0 24px",
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => setLocation("/")}
        >
          <img src="/zap-logo.png" alt="ZAP" style={{ height: 36, width: 36, objectFit: "contain" }} />
          <span className="lp-h" style={{ fontSize: 22, color: INK }}>ZAP</span>
        </div>
        {/* Links */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {["#path", "#noblank", "#compliance"].map((href, i) => (
            <a key={href} href={href} className="lp-nav-link" style={{
              fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500,
              fontSize: 15, color: INK, textDecoration: "none", padding: "8px 14px",
            }}>
              {["How it Works", "Features", "Compliance"][i]}
            </a>
          ))}
          <a href="/pricing" className="lp-nav-link" style={{
            fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500,
            fontSize: 15, color: INK, textDecoration: "none", padding: "8px 14px",
          }}>Pricing</a>
          <div style={{ marginLeft: 8 }}>
            {isAuthenticated
              ? <PillBtn onClick={() => setLocation("/v2-dashboard")}>Go to Dashboard</PillBtn>
              : <PillBtn onClick={onGetStarted}>Start Free</PillBtn>
            }
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Section 1: Hero ─────────────────────────────────────────────────────────────
function HeroSection({ onStart }: { onStart: (name: string, type: string) => void }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [showTiles, setShowTiles] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEnter = () => {
    if (!value.trim()) return;
    setShowTiles(true);
  };

  const handleTile = (label: string) => {
    setSelectedTile(label);
    setWiping(true);
    setTimeout(() => onStart(value.trim(), label), 650);
  };

  return (
    <section style={{ background: CREAM, minHeight: "88vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", position: "relative", overflow: "hidden" }}>
      {/* Orange wipe overlay */}
      {wiping && (
        <div style={{
          position: "fixed", inset: 0, background: ORANGE, zIndex: 9999,
          animation: "lp-wipe 0.65s cubic-bezier(0.4,0,0.2,1) forwards",
        }} />
      )}

      <div style={{ maxWidth: 640, width: "100%", textAlign: "center" }}>
        {/* Headline */}
        <h1 className="lp-h" style={{ fontSize: "clamp(34px, 6vw, 62px)", lineHeight: 1.1, color: INK, marginBottom: 48 }}>
          Let's build your next campaign in minutes.
        </h1>

        {!showTiles ? (
          <>
            {/* Zappy floating on input */}
            <div style={{ position: "relative", display: "inline-block", marginBottom: -22, zIndex: 2 }}>
              <img
                src={focused ? ZAPPY_WORKING : ZAPPY_WAITING}
                alt="Zappy"
                className={focused ? "" : "lp-breathe"}
                style={{ width: 110, height: 110, objectFit: "contain", transition: "all 0.3s ease" }}
              />
              {/* Flat pill shadow */}
              <div style={{
                position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
                width: 56, height: 9, background: "rgba(26,22,36,0.13)",
                borderRadius: 9999, filter: "blur(4px)",
              }} />
            </div>

            {/* Input */}
            <div style={{ position: "relative", zIndex: 1 }}>
              <input
                ref={inputRef}
                value={value}
                onChange={e => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === "Enter" && handleEnter()}
                placeholder="What is your programme or offer called?"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "22px 130px 22px 32px",
                  fontSize: 17,
                  fontFamily: "'Instrument Sans', sans-serif",
                  background: "#fff", color: INK,
                  border: `2.5px solid ${focused ? ORANGE : "rgba(26,22,36,0.14)"}`,
                  borderRadius: 9999, outline: "none",
                  boxShadow: focused
                    ? "0 0 0 4px rgba(255,91,29,0.12), 0 8px 32px rgba(26,22,36,0.1)"
                    : "0 4px 24px rgba(26,22,36,0.07)",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              />
              {value && (
                <button
                  onClick={handleEnter}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: ORANGE, color: "#fff", border: "none", borderRadius: 9999,
                    padding: "12px 24px",
                    fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 14,
                    cursor: "pointer",
                  }}
                >Continue →</button>
              )}
            </div>
            <p style={{ marginTop: 14, fontSize: 13, color: "rgba(26,22,36,0.4)", fontFamily: "'Instrument Sans', sans-serif" }}>
              Press Enter to continue · No credit card required
            </p>
          </>
        ) : (
          /* Campaign type tiles */
          <div className="lp-fade-up">
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 17, color: "rgba(26,22,36,0.55)", marginBottom: 24 }}>
              What type of campaign is <strong style={{ color: INK }}>"{value}"</strong>?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {CAMPAIGN_TILES.map((tile, i) => (
                <div
                  key={tile.label}
                  className="lp-tile lp-bounce-in"
                  onClick={() => handleTile(tile.label)}
                  style={{
                    animationDelay: `${i * 0.07}s`,
                    background: "#fff", borderRadius: 24, padding: "28px 22px",
                    textAlign: "left",
                    border: `2px solid ${selectedTile === tile.label ? ORANGE : "rgba(26,22,36,0.08)"}`,
                    boxShadow: "0 4px 16px rgba(26,22,36,0.06)",
                  }}
                >
                  <div style={{ fontSize: 30, marginBottom: 10 }}>{tile.emoji}</div>
                  <div className="lp-h" style={{ fontSize: 19, color: INK, marginBottom: 6 }}>{tile.label}</div>
                  <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "rgba(26,22,36,0.5)" }}>{tile.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Section 2: Campaign Path ────────────────────────────────────────────────────
function PathSection() {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [zappyAt, setZappyAt] = useState(-1);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = nodeRefs.current.findIndex(r => r === entry.target);
            if (idx !== -1) {
              setActiveIdx(prev => Math.max(prev, idx));
              setZappyAt(idx);
            }
          }
        });
      },
      { threshold: 0.7 }
    );
    nodeRefs.current.forEach(r => r && observer.observe(r));
    return () => observer.disconnect();
  }, []);

  const state = (i: number) => i < activeIdx ? "done" : i === activeIdx ? "active" : "locked";
  const circleColor = (s: string) => s === "done" ? GREEN : s === "active" ? ORANGE : "rgba(26,22,36,0.18)";

  return (
    <section id="path" style={{ background: CREAM, padding: "100px 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <h2 className="lp-h" style={{ fontSize: "clamp(30px, 5vw, 50px)", color: INK, marginBottom: 14 }}>
            Stop guessing. Start walking the path.
          </h2>
          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 17, color: "rgba(26,22,36,0.55)", maxWidth: 480, margin: "0 auto" }}>
            ZAP guides you through a proven 11-step sequence to build your entire campaign from scratch.
          </p>
        </div>

        <div style={{ position: "relative" }}>
          {PATH_NODES.map((label, i) => {
            const isRight = i % 2 === 0;
            const s = state(i);
            const isZappyHere = zappyAt === i && activeIdx >= 0;
            return (
              <div
                key={label}
                ref={el => { nodeRefs.current[i] = el; }}
                style={{
                  display: "flex", alignItems: "center",
                  justifyContent: isRight ? "flex-start" : "flex-end",
                  marginBottom: 28, position: "relative",
                }}
              >
                {/* Connector */}
                {i < PATH_NODES.length - 1 && (
                  <div style={{
                    position: "absolute",
                    top: 80, left: isRight ? 40 : "auto", right: isRight ? "auto" : 40,
                    width: 2, height: 28,
                    background: s === "done" ? GREEN : "rgba(26,22,36,0.1)",
                    transition: "background 0.5s",
                  }} />
                )}

                {/* Zappy hopping */}
                {isZappyHere && (
                  <img
                    src={s === "done" ? ZAPPY_CHEERING : ZAPPY_WAITING}
                    alt="Zappy"
                    className="lp-hop"
                    style={{
                      position: "absolute",
                      left: isRight ? 96 : "auto", right: isRight ? "auto" : 96,
                      top: -8, width: 44, height: 44, objectFit: "contain", zIndex: 2,
                    }}
                  />
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 18, flexDirection: isRight ? "row" : "row-reverse" }}>
                  {/* Node circle */}
                  <div
                    className={s === "active" ? "lp-pulse" : ""}
                    style={{
                      width: 80, height: 80, borderRadius: "50%",
                      background: circleColor(s),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, opacity: s === "locked" ? 0.45 : 1,
                      transition: "background 0.5s, opacity 0.5s",
                    }}
                  >
                    {s === "done" ? (
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="lp-h" style={{ fontSize: 22, color: s === "locked" ? "rgba(26,22,36,0.35)" : "#fff" }}>{i + 1}</span>
                    )}
                  </div>
                  {/* Label */}
                  <div style={{ textAlign: isRight ? "left" : "right" }}>
                    <div className="lp-h" style={{ fontSize: 19, color: s === "locked" ? "rgba(26,22,36,0.3)" : INK, transition: "color 0.4s" }}>{label}</div>
                    <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, color: "rgba(26,22,36,0.38)", marginTop: 3 }}>
                      {s === "done" ? "✓ Done" : s === "active" ? "In progress" : "Locked"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: No Blank Pages ────────────────────────────────────────────────────
function NoBlankPagesSection() {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.25 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  const handleGenerate = () => {
    if (generating || done) return;
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setDone(true); }, 2200);
  };

  return (
    <section id="noblank" ref={sectionRef} style={{ background: CREAM, padding: "100px 24px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 className="lp-h" style={{ fontSize: "clamp(28px, 5vw, 48px)", color: INK, marginBottom: 14 }}>
            No blank pages. No massive forms.
          </h2>
          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 17, color: "rgba(26,22,36,0.55)", maxWidth: 440, margin: "0 auto" }}>
            Your AI Profile remembers everything about your business. Just click generate.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, alignItems: "center" }}>
          {/* Left: faded form */}
          <div style={{
            opacity: visible ? 0.32 : 0, filter: "blur(1.5px)",
            transition: "opacity 0.7s ease",
          }}>
            <div style={{ background: "#fff", borderRadius: 24, padding: 28, border: "2px solid rgba(26,22,36,0.07)" }}>
              <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, color: "rgba(26,22,36,0.4)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 18 }}>Old Way</div>
              {["Target Market", "Main Benefit", "Pain Points", "Desired Outcome", "Unique Mechanism", "Price Point", "Objections", "Call to Action", "Tone of Voice", "Campaign Goal"].map(f => (
                <div key={f} style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, color: "rgba(26,22,36,0.38)", marginBottom: 4 }}>{f}</div>
                  <div style={{ height: 34, background: "rgba(26,22,36,0.06)", borderRadius: 8 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Right: clean V2 card */}
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(22px)",
            transition: "all 0.65s ease 0.15s",
          }}>
            <div style={{
              background: "#fff", borderRadius: 24, padding: "40px 36px",
              border: "2px solid rgba(26,22,36,0.07)",
              boxShadow: "0 8px 32px rgba(26,22,36,0.08)",
              textAlign: "center",
            }}>
              <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, color: "rgba(26,22,36,0.4)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 18 }}>ZAP Way</div>
              <h3 className="lp-h" style={{ fontSize: 22, color: INK, marginBottom: 6 }}>Generate Ad Copy</h3>
              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "rgba(26,22,36,0.45)", marginBottom: 28 }}>using your AI Profile</p>

              {/* Zappy */}
              <div style={{ marginBottom: 24 }}>
                <img
                  src={generating ? ZAPPY_WORKING : done ? ZAPPY_CHEERING : ZAPPY_WAITING}
                  alt="Zappy"
                  style={{
                    width: 88, height: 88, objectFit: "contain",
                    animation: generating ? "lp-breathe 1.4s ease-in-out infinite" : "none",
                  }}
                />
              </div>

              {!done ? (
                <>
                  <button
                    onClick={handleGenerate}
                    style={{
                      background: generating ? "rgba(26,22,36,0.07)" : ORANGE,
                      color: generating ? INK : "#fff",
                      border: "none", borderRadius: 9999,
                      padding: "14px 40px",
                      fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 15,
                      cursor: generating ? "default" : "pointer",
                      width: "100%", transition: "all 0.2s",
                    }}
                  >
                    {generating ? (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <span style={{
                          display: "inline-block", width: 15, height: 15,
                          border: `2px solid ${INK}`, borderTopColor: "transparent",
                          borderRadius: "50%", animation: "lp-spin 0.7s linear infinite",
                        }} />
                        Zappy is writing your Meta-compliant assets...
                      </span>
                    ) : "Generate Now"}
                  </button>
                  <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, color: "rgba(26,22,36,0.3)", marginTop: 10 }}>Advanced: Edit AI Inputs</p>
                </>
              ) : (
                <div className="lp-fade-up">
                  <div style={{ background: "rgba(88,204,2,0.1)", borderRadius: 16, padding: "16px 20px", marginBottom: 14 }}>
                    <div className="lp-h" style={{ fontSize: 22, color: GREEN }}>100/100 — Meta Compliant!</div>
                    <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "rgba(26,22,36,0.55)", marginTop: 4 }}>Your assets are ready.</div>
                  </div>
                  <button
                    onClick={() => { setDone(false); setGenerating(false); }}
                    style={{
                      background: "transparent", border: "2px solid rgba(26,22,36,0.14)",
                      borderRadius: 9999, padding: "9px 22px",
                      fontFamily: "'Instrument Sans', sans-serif", fontSize: 13,
                      cursor: "pointer", color: "rgba(26,22,36,0.45)",
                    }}
                  >↺ Generate Again</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 4: Compliance Score ──────────────────────────────────────────────────
function ComplianceSection() {
  const [phase, setPhase] = useState<"idle" | "concerned" | "fixing" | "cheering">("idle");
  const [score, setScore] = useState(72);
  const [showConfetti, setShowConfetti] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !triggered.current) {
        triggered.current = true;
        setPhase("concerned");
        setTimeout(() => setPhase("fixing"), 1800);
        setTimeout(() => {
          setPhase("cheering");
          setScore(100);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3800);
        }, 3300);
      }
    }, { threshold: 0.4 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (phase !== "fixing") return;
    let s = 72;
    const iv = setInterval(() => {
      s += 2;
      setScore(s);
      if (s >= 100) clearInterval(iv);
    }, 65);
    return () => clearInterval(iv);
  }, [phase]);

  const scoreColor = score < 80 ? "#EF4444" : score < 95 ? ORANGE : GREEN;

  return (
    <section id="compliance" ref={sectionRef} style={{ background: CREAM, padding: "100px 24px" }}>
      {showConfetti && (
        <Confetti
          recycle={false}
          numberOfPieces={280}
          colors={[ORANGE, "#8B5CF6", GREEN, "#FFD700", "#FF85A1"]}
        />
      )}
      <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
        <h2 className="lp-h" style={{ fontSize: "clamp(28px, 5vw, 48px)", color: INK, marginBottom: 14 }}>
          Ad copy that Zuckerberg actually likes.
        </h2>
        <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 17, color: "rgba(26,22,36,0.55)", maxWidth: 420, margin: "0 auto 64px" }}>
          ZAP scores every piece of copy for Meta compliance before you launch.
        </p>

        <div style={{
          background: "#fff", borderRadius: 24, padding: "48px 40px",
          boxShadow: "0 8px 32px rgba(26,22,36,0.08)",
          border: "2px solid rgba(26,22,36,0.06)",
          display: "flex", alignItems: "center", gap: 36,
          flexWrap: "wrap", justifyContent: "center",
        }}>
          {/* Zappy */}
          <img
            src={phase === "cheering" ? ZAPPY_CHEERING : ZAPPY_CONCERNED}
            alt="Zappy"
            className={phase === "cheering" ? "lp-hop" : ""}
            style={{
              width: 120, height: 120, objectFit: "contain",
              transition: "all 0.5s ease",
              opacity: phase === "idle" ? 0 : 1,
            }}
          />

          {/* Score */}
          <div style={{ flex: 1, minWidth: 200, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
              <span className="lp-h" style={{ fontSize: 68, color: scoreColor, transition: "color 0.3s", lineHeight: 1 }}>{score}</span>
              <span className="lp-h" style={{ fontSize: 28, color: "rgba(26,22,36,0.28)" }}>/100</span>
            </div>
            {/* Bar */}
            <div style={{ height: 10, background: "rgba(26,22,36,0.08)", borderRadius: 9999, marginBottom: 18, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${score}%`,
                background: scoreColor, borderRadius: 9999,
                transition: "width 0.07s linear, background 0.3s",
              }} />
            </div>
            <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 16, color: INK, fontWeight: 600 }}>
              {phase === "cheering" ? "✓ Meta Compliant — ready to launch!" : "Let's fix a few things."}
            </div>
            <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: "rgba(26,22,36,0.42)", marginTop: 6 }}>
              {phase === "cheering"
                ? "Your ad copy passed all Meta policies."
                : "Zappy found 3 compliance issues in your copy."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 5: Footer CTA ─────────────────────────────────────────────────────────
function FooterCTASection({ onStart }: { onStart: () => void }) {
  return (
    <section style={{ background: CREAM, padding: "100px 24px 80px", textAlign: "center" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <img
          src={ZAPPY_WAITING}
          alt="Zappy waiting"
          className="lp-breathe"
          style={{ width: 120, height: 120, objectFit: "contain", marginBottom: 32 }}
        />
        <h2 className="lp-h" style={{ fontSize: "clamp(32px, 6vw, 58px)", color: INK, marginBottom: 18, lineHeight: 1.1 }}>
          Your campaign is waiting to be built.
        </h2>
        <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 17, color: "rgba(26,22,36,0.55)", marginBottom: 40 }}>
          Join coaches, speakers, and consultants building campaigns in minutes.
        </p>
        <PillBtn onClick={onStart} large>Start your first asset for free</PillBtn>
        <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "rgba(26,22,36,0.32)", marginTop: 16 }}>
          No credit card required · 7-day free trial · Cancel anytime
        </p>
      </div>

      {/* Footer links */}
      <div style={{ marginTop: 80, paddingTop: 32, borderTop: "1px solid rgba(26,22,36,0.08)", display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
        {[
          { label: "Privacy Policy", href: "#" },
          { label: "Terms of Service", href: "#" },
          { label: "Pricing", href: "/pricing" },
          { label: "Contact", href: "#" },
        ].map(l => (
          <a key={l.label} href={l.href} style={{
            fontFamily: "'Instrument Sans', sans-serif", fontSize: 14,
            color: "rgba(26,22,36,0.38)", textDecoration: "none",
          }}>{l.label}</a>
        ))}
      </div>
      <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "rgba(26,22,36,0.28)", marginTop: 14 }}>
        © 2026 ZAP. All rights reserved.
      </p>
    </section>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) setLocation("/v2-dashboard");
  }, [isAuthenticated, setLocation]);

  const handleStart = (name = "", type = "") => {
    if (name) sessionStorage.setItem("zap_programme_name", name);
    if (type) sessionStorage.setItem("zap_campaign_type", type);
    setLocation("/v2-dashboard");
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="lp-root" style={{ background: CREAM, minHeight: "100vh" }}>
      <style>{GLOBAL_STYLES}</style>
      <LandingNav onGetStarted={scrollToTop} />
      <HeroSection onStart={handleStart} />
      <PathSection />
      <NoBlankPagesSection />
      <ComplianceSection />
      <FooterCTASection onStart={scrollToTop} />
    </div>
  );
}
