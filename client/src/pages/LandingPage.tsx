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
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Confetti from "react-confetti";
import { trpc } from "@/lib/trpc";

// ─── Design tokens ──────────────────────────────────────────────────────────────
const CREAM  = "#F5F1EA";
const INK    = "#1A1624";
const ORANGE = "#FF5B1D";
const PURPLE = "#8B5CF6";
const MUTED  = "#7A6F6A";

// ─── Zappy SVG paths ────────────────────────────────────────────────────────────
const ZAPPY_WAITING   = "/zappy-waiting.svg";
const ZAPPY_WORKING   = "/zappy-working.svg";
const ZAPPY_CHEERING  = "/zappy-cheering.svg";
const ZAPPY_CONCERNED = "/zappy-concerned.svg";

// ─── Validation constants ────────────────────────────────────────────────────────
const VAGUE1 = new Set(["people","everyone","anyone","all","everybody","someone","humans","clients","customers"]);
const VAGUE2 = new Set(["success","money","happiness","help","better","growth","results","more","freedom"]);

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

// ─── Section 1: Hero — 3-step gamified flow ──────────────────────────────────────
const STEP1_MSGS = [
  "Yes! Let's build something great for them.",
  "Love it. Now the exciting part…",
  "Perfect. They're going to love what we build.",
];
const STEP2_MSGS = [
  "That's a powerful result. Last one…",
  "They need that. One more question…",
  "Brilliant. Almost there…",
];

type HeroStep = "step1" | "step2" | "step3" | "assembling" | "done";
type ZappyState = "waiting" | "cheering" | "working" | "concerned";

interface ConfettiConfig { run: boolean; colors: string[]; }

function HeroSection({ onCampaignSelect: _onCampaignSelect }: { onCampaignSelect: (type: string) => void }) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<HeroStep>("step1");
  const [ans1, setAns1] = useState("");
  const [ans2, setAns2] = useState("");
  const [ans3, setAns3] = useState("");
  const [zappy, setZappy] = useState<ZappyState>("waiting");
  const [bubble, setBubble] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<ConfettiConfig>({ run: false, colors: [] });
  const [sentence, setSentence] = useState("");
  const [displayedSentence, setDisplayedSentence] = useState("");
  const [editing, setEditing] = useState(false);
  const [assets, setAssets] = useState<{ headline: string; icpHook: string; adAngle: string } | null>(null);
  const [visibleCards, setVisibleCards] = useState(0);
  const [copiedCard, setCopiedCard] = useState<string | null>(null);
  const [fadeStep, setFadeStep] = useState(true);
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);
  const inputRef3 = useRef<HTMLInputElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);

  // Dynamic hero height on mobile — measure content and set section height
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = () => window.innerWidth <= 768;
    const content = heroContentRef.current;
    const section = heroSectionRef.current;
    if (!content || !section) return;

    const updateHeight = () => {
      if (isMobile()) {
        const contentH = content.getBoundingClientRect().height;
        // content height + top padding (16px) + bottom padding (16px) + buffer (24px)
        section.style.minHeight = `${contentH + 56}px`;
      } else {
        section.style.minHeight = "700px";
      }
    };

    const ro = new ResizeObserver(updateHeight);
    ro.observe(content);
    window.addEventListener("resize", updateHeight);
    updateHeight();

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [step]);

  const generateAssets = trpc.landing.generatePreviewAssets.useMutation();

  const zappySrc = useMemo(() => {
    if (zappy === "cheering") return ZAPPY_CHEERING;
    if (zappy === "working") return ZAPPY_WORKING;
    if (zappy === "concerned") return ZAPPY_CONCERNED;
    return ZAPPY_WAITING;
  }, [zappy]);

  const zappyAnim = useMemo(() => {
    if (zappy === "cheering") return "zappyHop 0.5s ease infinite";
    if (zappy === "working") return "zappyHop 0.6s ease infinite";
    if (zappy === "concerned") return "zappyBreathe 2s ease infinite";
    return "zappyBreathe 3s ease infinite";
  }, [zappy]);

  const showConcerned = useCallback((msg: string) => {
    setZappy("concerned");
    setBubble(msg);
    // Auto-clear after 4s so user can try again
    setTimeout(() => { setBubble(null); setZappy("waiting"); }, 4000);
  }, []);

  const fireConfetti = useCallback((colors: string[]) => {
    setConfetti({ run: true, colors });
    setTimeout(() => setConfetti({ run: false, colors }), 3500);
  }, []);

  const showBubble = useCallback((msg: string, duration = 1500) => {
    setBubble(msg);
    return new Promise<void>(res => setTimeout(() => { setBubble(null); res(); }, duration));
  }, []);

  const transitionTo = useCallback((nextStep: HeroStep) => {
    setFadeStep(false);
    setTimeout(() => { setStep(nextStep); setFadeStep(true); }, 350);
  }, []);

  const handleStep1 = useCallback(async () => {
    const v = ans1.trim();
    if (!v) { inputRef1.current?.focus(); return; }
    // Validation: too short
    if (v.length < 3) {
      showConcerned("That's a bit short — can you be more specific? For example: female coaches, corporate executives, new mums");
      return;
    }
    // Validation: vague word
    if (VAGUE1.has(v.toLowerCase())) {
      showConcerned("Who specifically? The more specific you are, the better your campaign. For example: burned out teachers, first-time entrepreneurs, online coaches");
      return;
    }
    setZappy("cheering");
    fireConfetti([ORANGE, PURPLE, "#FFD700"]);
    const msg = STEP1_MSGS[Math.floor(Math.random() * STEP1_MSGS.length)];
    await showBubble(msg, 1500);
    setZappy("waiting");
    transitionTo("step2");
    setTimeout(() => inputRef2.current?.focus(), 400);
  }, [ans1, fireConfetti, showBubble, showConcerned, transitionTo]);

  const handleStep2 = useCallback(async () => {
    const v = ans2.trim();
    if (!v) { inputRef2.current?.focus(); return; }
    // Validation: too short
    if (v.length < 4) {
      showConcerned("Can you say a bit more? For example: a fully booked practice, consistent 10k months, leaving their 9-5");
      return;
    }
    // Validation: vague word
    if (VAGUE2.has(v.toLowerCase())) {
      showConcerned("What's the actual outcome they get? Be specific — for example: a fully booked coaching practice in 90 days, doubling their revenue, getting off the hamster wheel");
      return;
    }
    setZappy("cheering");
    fireConfetti(["#22C55E", ORANGE, "#FFD700"]);
    const msg = STEP2_MSGS[Math.floor(Math.random() * STEP2_MSGS.length)];
    await showBubble(msg, 1500);
    setZappy("waiting");
    transitionTo("step3");
    setTimeout(() => inputRef3.current?.focus(), 400);
  }, [ans2, fireConfetti, showBubble, showConcerned, transitionTo]);

  const handleStep3 = useCallback(async () => {
    const v = ans3.trim();
    if (!v) { inputRef3.current?.focus(); return; }
    // Validation: too short
    if (v.length < 5) {
      showConcerned("Tell me a bit more about their frustration. For example: getting consistent leads, charging premium prices, wasting money on ads that don't convert");
      return;
    }
    // Validation: single word (no spaces)
    if (!v.includes(" ")) {
      showConcerned("Can you describe the struggle in a few words? For example: not knowing where their next client is coming from, feeling invisible online");
      return;
    }
    setZappy("working");
    setBubble("Zappy is building your service profile…");
    transitionTo("assembling");

    const full = `I help ${ans1.trim()} get ${ans2.trim()} even if they're struggling with ${ans3.trim()}`;
    setSentence(full);

    // Animate word-by-word assembly
    const words = full.split(" ");
    setDisplayedSentence("");
    let built = "";
    for (let i = 0; i < words.length; i++) {
      built += (i === 0 ? "" : " ") + words[i];
      setDisplayedSentence(built);
      await new Promise(r => setTimeout(r, 80));
    }

    // Sentence complete
    setBubble(null);
    setZappy("cheering");
    fireConfetti([ORANGE, PURPLE, "#22C55E", "#FFD700", "#FF69B4"]);
    await showBubble("Here's your service in one sentence — does this sound right?", 2000);
    setStep("done");
    setFadeStep(true);
  }, [ans1, ans2, ans3, fireConfetti, showBubble, showConcerned, transitionTo]);

  const handleAccept = useCallback(async (finalSentence: string) => {
    sessionStorage.setItem("zap_service_prefill", finalSentence.trim());
    setZappy("working");
    setBubble("Generating your first campaign assets…");
    setTimeout(() => setBubble(null), 2000);

    try {
      const result = await generateAssets.mutateAsync({ serviceSentence: finalSentence.trim() });
      setAssets(result);
      setZappy("cheering");
      // Stagger card reveal
      setVisibleCards(0);
      setTimeout(() => setVisibleCards(1), 300);
      setTimeout(() => setVisibleCards(2), 600);
      setTimeout(() => setVisibleCards(3), 900);
      setTimeout(() => {
        setBubble("Your campaign has already started.");
        fireConfetti([ORANGE, PURPLE, "#22C55E"]);
        setTimeout(() => setBubble(null), 3000);
      }, 1200);
    } catch {
      setBubble("Oops — couldn't generate assets. Try again!");
      setTimeout(() => setBubble(null), 3000);
      setZappy("waiting");
    }
  }, [generateAssets, fireConfetti]);

  const zappySize = "clamp(80px, 12vw, 120px)";

  // Mobile detection for static hero
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Both mobile and desktop heroes render — CSS controls visibility
  return (
    <>
    {/* ─── MOBILE: static hero (CSS hidden on desktop) ─── */}
    <section className="lp-hero-mobile" style={{ background: CREAM, padding: "24px 20px 20px", textAlign: "center" }}>
      <img src={ZAPPY_WAITING} alt="Zappy" style={{ width: 80, height: 80, display: "block", margin: "0 auto 16px" }} />
      <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "28px", color: INK, margin: "0 0 20px", lineHeight: 1.4 }}>
        Who do <span style={{ display: "inline", background: "#fff", borderRadius: "9999px", padding: "2px 10px", color: INK }}>you</span> <span style={{ display: "inline", background: "#fff", borderRadius: "9999px", padding: "2px 10px", color: INK }}>help?</span>
      </h1>
      <input
        type="text"
        value={ans1}
        onChange={e => setAns1(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleStep1()}
        placeholder="e.g. coaches, executives, mums, dentists"
        style={{ width: "100%", border: "2px solid rgba(26,22,36,0.12)", outline: "none", padding: "14px 20px", fontSize: 15, fontFamily: "'Instrument Sans', sans-serif", background: "#fff", color: INK, borderRadius: 9999, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 12 }}
      />
      <button
        onClick={() => { if (ans1.trim().length >= 3) navigate("/signup"); else handleStep1(); }}
        style={{ width: "100%", background: ORANGE, color: "#fff", border: "none", borderRadius: 9999, padding: "14px 28px", fontSize: 15, fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer" }}
      >
        Start Building Free →
      </button>
    </section>

    {/* ─── DESKTOP: full carousel (CSS hidden on mobile) ─── */}
    <section ref={heroSectionRef} className="lp-hero-section" style={{ background: CREAM, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(48px,8vw,100px) clamp(16px,4vw,24px) clamp(32px,4vw,48px)", position: "relative", overflow: "hidden" }}>
      {/* Confetti */}
      {confetti.run && (
        <Confetti
          width={typeof window !== "undefined" ? window.innerWidth : 1200}
          height={typeof window !== "undefined" ? window.innerHeight : 800}
          colors={confetti.colors}
          numberOfPieces={step === "done" && assets ? 300 : 120}
          recycle={false}
          style={{ position: "fixed", top: 0, left: 0, zIndex: 999, pointerEvents: "none" }}
        />
      )}

      {/* Background blobs */}
      <div style={{ position: "absolute", top: "8%", right: "-8%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,91,29,0.07) 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div ref={heroContentRef} style={{ maxWidth: 640, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Zappy */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 24 }}>
          <img
            src={zappySrc}
            alt="Zappy"
            style={{ width: zappySize, height: zappySize, display: "block", animation: zappyAnim, transition: "all 0.3s" }}
          />
          {/* Bubble */}
          {bubble && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
              background: INK, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13,
              fontFamily: "'Instrument Sans', sans-serif", whiteSpace: "normal", maxWidth: 280,
              textAlign: "center", lineHeight: 1.4,
              animation: "fadeUp 0.3s ease", zIndex: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}>
              {bubble}
              <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `6px solid ${INK}` }} />
            </div>
          )}
        </div>

        {/* Step content */}
        <div style={{ opacity: fadeStep ? 1 : 0, transform: fadeStep ? "translateY(0)" : "translateY(12px)", transition: "opacity 0.35s ease, transform 0.35s ease" }}>

          {/* ── STEP 1 ── */}
          {step === "step1" && (
            <>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(28px, 5vw, 36px)", color: INK, margin: "0 0 28px", lineHeight: 1.4, animation: "fadeUp 0.5s ease" }}>
                Who do <span style={{ display: "inline", background: "#fff", borderRadius: "9999px", padding: "2px 10px", color: INK }}>you</span> <span style={{ display: "inline", background: "#fff", borderRadius: "9999px", padding: "2px 10px", color: INK }}>help?</span>
              </h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520, margin: "0 auto" }} className="hero-input-row">
                <input
                  ref={inputRef1}
                  type="text"
                  value={ans1}
                  onChange={e => setAns1(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStep1()}
                  placeholder="e.g. coaches, executives, mums, dentists"
                  autoFocus
                  style={{ flex: 1, border: `2px solid rgba(26,22,36,0.12)`, outline: "none", padding: "14px 20px", fontSize: 15, fontFamily: "'Instrument Sans', sans-serif", background: "#fff", color: INK, borderRadius: 9999, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
                />
                <button
                  onClick={handleStep1}
                  style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 9999, padding: "14px 28px", fontSize: 15, fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", transition: "opacity 0.15s", whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  That's them →
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === "step2" && (
            <>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(28px, 5vw, 36px)", color: INK, margin: "0 0 28px", lineHeight: 1.2, animation: "fadeUp 0.5s ease" }}>
                What's the biggest result you give them?
              </h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520, margin: "0 auto" }} className="hero-input-row">
                <input
                  ref={inputRef2}
                  type="text"
                  value={ans2}
                  onChange={e => setAns2(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStep2()}
                  placeholder="e.g. fully booked practice, consistent leads, 6-figure income"
                  style={{ flex: 1, border: `2px solid rgba(26,22,36,0.12)`, outline: "none", padding: "14px 20px", fontSize: 15, fontFamily: "'Instrument Sans', sans-serif", background: "#fff", color: INK, borderRadius: 9999, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
                />
                <button
                  onClick={handleStep2}
                  style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 9999, padding: "14px 28px", fontSize: 15, fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", transition: "opacity 0.15s", whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  That's the result →
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3 ── */}
          {step === "step3" && (
            <>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(28px, 5vw, 36px)", color: INK, margin: "0 0 28px", lineHeight: 1.2, animation: "fadeUp 0.5s ease" }}>
                What are they struggling with right now?
              </h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520, margin: "0 auto" }} className="hero-input-row">
                <input
                  ref={inputRef3}
                  type="text"
                  value={ans3}
                  onChange={e => setAns3(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStep3()}
                  placeholder="e.g. getting consistent leads, charging premium prices, finding time"
                  style={{ flex: 1, border: `2px solid rgba(26,22,36,0.12)`, outline: "none", padding: "14px 20px", fontSize: 15, fontFamily: "'Instrument Sans', sans-serif", background: "#fff", color: INK, borderRadius: 9999, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
                />
                <button
                  onClick={handleStep3}
                  style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 9999, padding: "14px 28px", fontSize: 15, fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", transition: "opacity 0.15s", whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  Got it →
                </button>
              </div>
            </>
          )}

          {/* ── ASSEMBLING ── */}
          {step === "assembling" && (
            <>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(22px, 4vw, 30px)", color: INK, margin: "0 0 24px", lineHeight: 1.2 }}>
                Building your sentence…
              </h1>
              <div style={{ background: "#fff", borderRadius: 20, padding: "24px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: `1px solid rgba(26,22,36,0.06)`, minHeight: 72, textAlign: "left" }}>
                <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 700, fontSize: "clamp(16px, 3vw, 20px)", color: INK, margin: 0, lineHeight: 1.5 }}>
                  {displayedSentence}<span style={{ display: "inline-block", width: 2, height: "1em", background: ORANGE, marginLeft: 2, animation: "zappyBreathe 0.8s ease infinite", verticalAlign: "text-bottom" }} />
                </p>
              </div>
            </>
          )}

          {/* ── DONE — sentence review + asset cards ── */}
          {step === "done" && (
            <>
              {!assets ? (
                <>
                  <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(22px, 4vw, 28px)", color: INK, margin: "0 0 20px", lineHeight: 1.2, animation: "fadeUp 0.5s ease" }}>
                    Here's your service in one sentence
                  </h1>
                  {editing ? (
                    <textarea
                      value={sentence}
                      onChange={e => setSentence(e.target.value)}
                      rows={3}
                      style={{ width: "100%", border: `2px solid ${ORANGE}`, outline: "none", padding: "14px 18px", fontSize: 16, fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 700, background: "#fff", color: INK, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", resize: "vertical", lineHeight: 1.5, marginBottom: 16 }}
                    />
                  ) : (
                    <div style={{ background: "#fff", borderRadius: 20, padding: "20px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: `1px solid rgba(26,22,36,0.06)`, marginBottom: 20, animation: "fadeUp 0.5s ease" }}>
                      <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 700, fontSize: "clamp(16px, 3vw, 20px)", color: INK, margin: 0, lineHeight: 1.5 }}>
                        {sentence}
                      </p>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={() => editing ? handleAccept(sentence) : handleAccept(sentence)}
                      style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 9999, padding: "14px 32px", fontSize: 15, fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", transition: "opacity 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                    >
                      {editing ? "Save my sentence →" : "Yes, that's me →"}
                    </button>
                    {!editing && (
                      <button
                        onClick={() => setEditing(true)}
                        style={{ background: "transparent", color: INK, border: `2px solid rgba(26,22,36,0.2)`, borderRadius: 9999, padding: "14px 28px", fontSize: 15, fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", transition: "border-color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = INK)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(26,22,36,0.2)")}
                      >
                        Let me edit it
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Asset cards */}
                  {([
                    { key: "headline",  label: "Your headline",       value: assets.headline },
                    { key: "icpHook",   label: "Your ideal customer", value: assets.icpHook },
                    { key: "adAngle",   label: "Your ad angle",       value: assets.adAngle },
                  ] as const).map((card, i) => (
                    visibleCards > i && (
                      <div
                        key={card.key}
                        style={{
                          background: "#fff", borderRadius: 20, padding: "20px 24px",
                          boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: `1px solid rgba(26,22,36,0.06)`,
                          marginBottom: 12, textAlign: "left", position: "relative",
                          animation: "fadeUp 0.5s ease",
                        }}
                      >
                        {/* Copy button */}
                        <button
                          onClick={() => {
                            // Show tick immediately (optimistic), attempt clipboard in background
                            setCopiedCard(card.key);
                            setTimeout(() => setCopiedCard(null), 2000);
                            try { navigator.clipboard.writeText(card.value); } catch {}
                          }}
                          title="Copy to clipboard"
                          style={{
                            position: "absolute", top: 14, right: 14,
                            background: "transparent", border: "none", cursor: "pointer",
                            padding: 4, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                            color: copiedCard === card.key ? "#22c55e" : "rgba(26,22,36,0.3)",
                            transition: "color 0.2s",
                          }}
                          onMouseEnter={e => { if (copiedCard !== card.key) (e.currentTarget as HTMLElement).style.color = "rgba(26,22,36,0.6)"; }}
                          onMouseLeave={e => { if (copiedCard !== card.key) (e.currentTarget as HTMLElement).style.color = "rgba(26,22,36,0.3)"; }}
                        >
                          {copiedCard === card.key ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <rect x="5" y="1" width="9" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M11 4H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          )}
                        </button>
                        <p style={{ fontSize: 11, fontWeight: 700, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px", fontFamily: "'Instrument Sans', sans-serif" }}>
                          {card.label}
                        </p>
                        <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 700, fontSize: "clamp(15px, 2.5vw, 18px)", color: INK, margin: 0, lineHeight: 1.4, paddingRight: 28 }}>
                          {card.value}
                        </p>
                      </div>
                    )
                  ))}

                  {/* Final CTA */}
                  {visibleCards >= 3 && (
                    <div style={{ marginTop: 28, animation: "fadeUp 0.5s ease" }}>
                      <button
                        onClick={() => navigate("/signup")}
                        style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 9999, padding: "18px 48px", fontSize: 17, fontWeight: 700, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", transition: "opacity 0.15s, transform 0.15s", display: "block", width: "100%", maxWidth: 400, margin: "0 auto" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                      >
                        Build my full campaign free →
                      </button>
                      <p style={{ fontSize: 12, color: MUTED, marginTop: 10, fontFamily: "'Instrument Sans', sans-serif" }}>
                        No credit card required · Takes 2 minutes
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>{/* end fade wrapper */}

        {/* Step dots */}
        {(step === "step1" || step === "step2" || step === "step3") && (
          <div className="lp-hero-dots" style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
            {(["step1", "step2", "step3"] as HeroStep[]).map((s, i) => (
              <div key={s} style={{ width: 8, height: 8, borderRadius: "50%", background: step === s ? ORANGE : "rgba(26,22,36,0.15)", transition: "background 0.3s" }} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 480px) {
          .hero-input-row { flex-direction: row !important; }
        }
      `}</style>
      <style>{`
        .lp-hero-mobile { display: none; }
        @media (max-width: 768px) {
          .lp-hero-mobile { display: block !important; }
          .lp-hero-section { display: none !important; }
        }
      `}</style>
    </section>
    </>
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
    <section id="path" ref={sectionRef} className="lp-path-section" style={{ background: CREAM, padding: "clamp(56px,8vw,100px) clamp(16px,4vw,24px)" }}>
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
          <div className="lp-node-connector" style={{ position: "absolute", left: "50%", top: 22, bottom: 22, width: 2, background: `linear-gradient(to bottom, #22C55E 40%, ${ORANGE} 100%)`, opacity: 0.18, transform: "translateX(-50%)" }} />

          <div className="lp-node-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 40px" }}>
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
                      <img src={ZAPPY_WORKING} alt="" style={{ position: "absolute", top: -36, left: "50%", transform: "translateX(-50%)", width: 36, height: 36, animation: "zappyHop 0.6s ease infinite" }} />
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
          background: INK, padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px)",
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
            {/* Divider */}
            <div style={{ width: 48, height: 3, background: "rgba(239,68,68,0.4)", borderRadius: 2, marginBottom: 20 }} />
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, lineHeight: 1.7, margin: 0 }}>
              Hours of prompting. Copy-pasting between tools. Re-explaining your offer every time. And still getting generic output.
            </p>
          </div>
        </div>

        {/* RIGHT — With ZAP (cream) */}
        <div style={{
          background: CREAM, padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px)",
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
        .lp-hero-section { min-height: 700px; }
        @media (max-width: 768px) {
          .lp-hero-section {
            justify-content: flex-start !important;
            padding-top: 16px !important;
            padding-bottom: 16px !important;
          }
          .lp-hero-dots { margin-top: 16px !important; }
          .lp-split-grid { grid-template-columns: 1fr !important; }
          .lp-node-grid {
            grid-template-columns: 1fr !important;
            gap: 8px 0 !important;
          }
          .lp-node-grid > div {
            grid-column: 1 !important;
            flex-direction: row !important;
            justify-content: flex-start !important;
          }
          .lp-node-connector { display: none !important; }
          .lp-path-section { padding-top: 32px !important; padding-bottom: 32px !important; }
          .lp-path-section p { margin-bottom: 32px !important; }
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
    <section id="compliance" ref={sectionRef} style={{ background: CREAM, padding: "clamp(56px,8vw,100px) clamp(16px,4vw,24px)", textAlign: "center", position: "relative", overflow: "hidden" }}>
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
          background: "#fff", borderRadius: 32, padding: "clamp(28px,5vw,48px) clamp(20px,4vw,40px)",
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
        {isMax && (
          <img
            src={ZAPPY_CHEERING}
            alt="Zappy cheering"
            style={{ width: 100, height: 100, margin: "32px auto 0", display: "block", animation: "fadeUp 0.4s ease" }}
          />
        )}
      </div>
    </section>
  );
}

// ─── Section 5: Pricing Teaser ───────────────────────────────────────────────────
function PricingTeaserSection({ onCTA }: { onCTA: () => void }) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const isAnnual = billing === "annual";

  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      savings: null,
      desc: "1 ICP. See the quality before you commit.",
      cta: "Start Free",
      highlight: false,
    },
    {
      name: "ZAP Pro",
      price: isAnnual ? "$1,470" : "$147",
      period: isAnnual ? "/year" : "/month",
      savings: isAnnual ? "Saves $294 vs monthly" : null,
      desc: "$4.90/day. Less than one failed Meta ad click.",
      cta: "Start ZAP Pro",
      highlight: true,
    },
    {
      name: "ZAP Pro Plus",
      price: isAnnual ? "$4,970" : "$497",
      period: isAnnual ? "/year" : "/month",
      savings: isAnnual ? "Saves $994 vs monthly" : null,
      desc: "Unlimited everything. Run 10 campaigns simultaneously.",
      cta: "Go Pro Plus",
      highlight: false,
    },
  ];

  return (
    <section id="pricing-teaser" style={{ background: "#EDE8DF", padding: "clamp(56px,8vw,100px) clamp(16px,4vw,24px)", textAlign: "center" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <img
          src={ZAPPY_WAITING}
          alt="Zappy"
          style={{ width: 80, height: 80, margin: "0 auto 24px", display: "block", animation: "zappyBreathe 3s ease infinite" }}
        />
        <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(28px, 5vw, 48px)", color: INK, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
          One plan for serious operators.
        </h2>
        <p style={{ fontSize: 18, color: MUTED, margin: "0 0 32px", lineHeight: 1.6 }}>
          Start free. Upgrade when you're ready.
        </p>

        {/* Billing toggle */}
        <div style={{ display: "inline-flex", background: "rgba(26,22,36,0.08)", borderRadius: 9999, padding: 4, marginBottom: 48, gap: 4 }}>
          <button
            onClick={() => setBilling("monthly")}
            style={{
              borderRadius: 9999, border: "none", cursor: "pointer",
              padding: "8px 22px", fontSize: 14, fontWeight: 600,
              fontFamily: "'Instrument Sans', sans-serif",
              background: !isAnnual ? INK : "transparent",
              color: !isAnnual ? "#fff" : MUTED,
              transition: "all 0.2s",
            }}
          >Monthly</button>
          <button
            onClick={() => setBilling("annual")}
            style={{
              borderRadius: 9999, border: "none", cursor: "pointer",
              padding: "8px 22px", fontSize: 14, fontWeight: 600,
              fontFamily: "'Instrument Sans', sans-serif",
              background: isAnnual ? INK : "transparent",
              color: isAnnual ? "#fff" : MUTED,
              transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            Annual
            <span style={{ background: ORANGE, color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 9999, letterSpacing: 0.8, textTransform: "uppercase" as const }}>
              2 MONTHS FREE
            </span>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 40, alignItems: "center" }} className="lp-pricing-grid">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              style={{
                background: tier.highlight ? INK : "#fff",
                borderRadius: 24,
                padding: "clamp(24px,3vw,36px) clamp(16px,2.5vw,28px)",
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
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 40, color: tier.highlight ? "#fff" : INK }}>{tier.price}</span>
                <span style={{ fontSize: 14, color: tier.highlight ? "rgba(255,255,255,0.55)" : MUTED }}>{tier.period}</span>
              </div>
              {tier.savings && (
                <p style={{ fontSize: 12, color: ORANGE, fontWeight: 600, margin: "0 0 8px", fontFamily: "'Instrument Sans', sans-serif" }}>{tier.savings}</p>
              )}
              <p style={{ fontSize: 14, color: tier.highlight ? "rgba(255,255,255,0.6)" : MUTED, lineHeight: 1.5, marginBottom: 24, minHeight: 44, marginTop: tier.savings ? 0 : 8 }}>{tier.desc}</p>
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
    <section style={{ background: INK, padding: "clamp(56px,8vw,100px) clamp(16px,4vw,24px) clamp(48px,6vw,80px)", textAlign: "center" }}>
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
