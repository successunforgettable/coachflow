import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

// ─── V2 Design Tokens ────────────────────────────────────────────────────────
const CREAM  = "#F5F1EA";
const INK    = "#1A1624";
const ORANGE = "#FF5B1D";
const PURPLE = "#8B5CF6";
const MUTED  = "rgba(26,22,36,0.5)";
const BORDER = "rgba(26,22,36,0.10)";

const fontBody    = "'Instrument Sans', system-ui, sans-serif";
const fontDisplay = "'Fraunces', Georgia, serif";

// ─── Static Data ─────────────────────────────────────────────────────────────
const FREE_FEATURES = [
  "1 ICP Profile",
  "11-step campaign path visible",
  "3 generations per tool on nodes 3–5",
  "2 welcome video credits",
];

const PRO_FEATURES = [
  "3 ICP Profiles",
  "110+ assets across all 9 generators",
  "50–100 generations per tool",
  "Meta Compliance Scoring",
  "1-click GHL and Meta push integration",
  "PDF Export on all generators",
  "10 video credits per month",
];

const PRO_PLUS_FEATURES = [
  "Everything in ZAP Pro",
  "Unlimited ICP Profiles",
  "Unlimited Generations",
  "Multi-ICP Campaign Cloning",
  "Kill/Scale Automation",
  "White-Label Reports",
  "25 Video Credits per month",
  "Priority Support",
];

const COMPARISON_ROWS = [
  { label: "ICP Profiles",           free: "1",          pro: "3",          plus: "Unlimited" },
  { label: "Generations per tool",   free: "3",          pro: "50–100",     plus: "Unlimited" },
  { label: "Meta Compliance Scoring",free: false,        pro: true,         plus: true },
  { label: "GHL & Meta Push",        free: false,        pro: true,         plus: true },
  { label: "PDF Export",             free: false,        pro: true,         plus: true },
  { label: "Video Credits",          free: "2 welcome",  pro: "10/month",   plus: "25/month" },
  { label: "Campaign Cloning",       free: false,        pro: false,        plus: true },
  { label: "Kill/Scale Automation",  free: false,        pro: false,        plus: true },
  { label: "White-Label Reports",    free: false,        pro: false,        plus: true },
];

const FAQ_ITEMS = [
  {
    q: "How does the free plan work?",
    a: "Start immediately with no credit card required. You get 1 ICP Profile, can see the full 11-step campaign path, and generate up to 3 outputs per tool on nodes 3–5. Upgrade when you're ready to unlock the full system.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel your subscription at any time from your dashboard. You'll retain access until the end of your billing period.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards (Visa, Mastercard, American Express) through our secure Stripe payment processor.",
  },
  {
    q: "What makes ZAP unique?",
    a: "ZAP is built around an 11-step guided campaign path. You define your service and your ideal customer once, and Zappy — your AI campaign guide — builds every asset from that foundation. Ad copy, email sequences, landing pages, WhatsApp sequences and more all know exactly who they're talking to without you re-explaining anything. Plus every asset is scored for Meta compliance before you spend a dollar.",
  },
  {
    q: "Important Disclaimer",
    a: "Results may vary significantly. No income, revenue, profit, or business success guarantees are made or implied. Success depends on individual effort, skill level, market conditions, business model, competition, and numerous other factors beyond our control. ZAP is a software tool that assists with marketing content creation and campaign management; it does not guarantee business success, customer acquisition, sales, or financial outcomes.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function CheckIcon({ color = ORANGE }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="9" cy="9" r="9" fill={color} fillOpacity="0.12" />
      <path d="M5 9.5l2.5 2.5 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="9" cy="9" r="9" fill={INK} fillOpacity="0.06" />
      <path d="M6 6l6 6M12 6l-6 6" stroke={MUTED} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FeatureRow({ text, included = true, color = ORANGE }: { text: string; included?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
      {included ? <CheckIcon color={color} /> : <CrossIcon />}
      <span style={{ fontSize: 14, color: included ? INK : MUTED, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const { data: status } = trpc.subscription.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createCheckoutMutation = trpc.subscription.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.success("Redirecting to checkout...");
        window.open(data.url, "_blank");
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSubscribe = (tier: "pro" | "agency") => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    createCheckoutMutation.mutate({ tier, interval });
  };

  const isAnnual = interval === "yearly";

  // ─── Styles ──────────────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    background: CREAM,
    minHeight: "100vh",
    fontFamily: fontBody,
    color: INK,
  };

  const section: React.CSSProperties = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "clamp(40px, 6vw, 80px) clamp(16px, 4vw, 24px)",
  };

  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 28px",
    borderRadius: 9999,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    fontFamily: fontBody,
    transition: "all 0.2s",
    background: active ? INK : "transparent",
    color: active ? CREAM : INK,
    display: "flex",
    alignItems: "center",
    gap: 8,
  });

  const card = (highlight: boolean): React.CSSProperties => ({
    background: highlight ? INK : "#fff",
    borderRadius: 24,
    padding: "clamp(24px, 4vw, 36px) clamp(18px, 3vw, 32px)",
    border: highlight ? `2px solid ${ORANGE}` : `1px solid ${BORDER}`,
    boxShadow: highlight ? `0 16px 48px rgba(26,22,36,0.18)` : "0 4px 20px rgba(0,0,0,0.05)",
    position: "relative",
    transform: "scale(1)",
    transition: "transform 0.2s",
    display: "flex",
    flexDirection: "column" as const,
  });

  const ctaBtn = (primary: boolean): React.CSSProperties => ({
    display: "block",
    width: "100%",
    padding: "14px 0",
    borderRadius: 9999,
    border: primary ? "none" : `1.5px solid ${BORDER}`,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
    fontFamily: fontBody,
    textAlign: "center" as const,
    background: primary ? ORANGE : "transparent",
    color: primary ? "#fff" : INK,
    boxShadow: primary ? `0 4px 14px rgba(255,91,29,0.30)` : "none",
    transition: "opacity 0.15s",
    textDecoration: "none",
    marginBottom: 8,
  });

  return (
    <div style={page}>
      {/* ── Nav ── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(16px, 4vw, 32px)", height: 64,
        borderBottom: `1px solid ${BORDER}`,
        background: CREAM,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <img src="/zappy-waiting.svg" alt="Zappy" style={{ width: 28, height: 28 }} />
          <span style={{ fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900, fontSize: 20, color: INK }}>ZAP</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {isAuthenticated ? (
            <Link href="/v2-dashboard" style={{ ...ctaBtn(true), width: "auto", padding: "10px 24px", display: "inline-block", marginBottom: 0 }}>
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: INK, textDecoration: "none" }}>Sign in</Link>
              <Link href="/signup" style={{ ...ctaBtn(true), width: "auto", padding: "10px 24px", display: "inline-block", marginBottom: 0 }}>
                Start Free
              </Link>
            </>
          )}
        </div>
      </nav>

      <div style={section}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h1 style={{
            fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900,
            fontSize: "clamp(36px, 5vw, 56px)", color: INK, marginBottom: 12, lineHeight: 1.1,
          }}>
            Simple, Transparent Pricing
          </h1>
          <p style={{ fontSize: 18, color: MUTED, marginBottom: 32 }}>
            Start free. Upgrade when you're ready.
          </p>

          {/* ── Billing Toggle ── */}
          <div style={{
            display: "inline-flex",
            background: "rgba(26,22,36,0.07)",
            borderRadius: 9999,
            padding: 4,
            gap: 4,
          }}>
            <button onClick={() => setInterval("monthly")} style={pillBtn(!isAnnual)}>
              Monthly
            </button>
            <button onClick={() => setInterval("yearly")} style={pillBtn(isAnnual)}>
              Annual
              {isAnnual && (
                <span style={{
                  background: ORANGE, color: "#fff", fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "2px 8px", borderRadius: 9999, whiteSpace: "nowrap",
                }}>
                  2 Months Free
                </span>
              )}
            </button>
          </div>

          {/* Current plan banner */}
          {status && status.tier && status.tier !== "trial" && (
            <div style={{
              background: `${PURPLE}18`, border: `1px solid ${PURPLE}40`,
              borderRadius: 12, padding: "12px 20px", maxWidth: 480,
              margin: "24px auto 0", fontSize: 14,
            }}>
              <strong>Current Plan:</strong> {status.tier?.toUpperCase()} — {status.status?.replace("_", " ").toUpperCase()}
              {status.subscriptionEndsAt && (
                <div style={{ color: MUTED, marginTop: 4, fontSize: 13 }}>
                  {status.status === "canceled" ? "Access until: " : "Renews: "}
                  {new Date(status.subscriptionEndsAt).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Tier Cards ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          alignItems: "start",
          marginBottom: 80,
        }}>

          {/* Free */}
          <div style={card(false)}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900, fontSize: 22, color: INK, marginBottom: 6 }}>Free</div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>See the quality before you commit</div>
              <div>
                <span style={{ fontFamily: fontDisplay, fontWeight: 900, fontSize: 44, color: INK }}>$0</span>
                <span style={{ fontSize: 14, color: MUTED }}> forever</span>
              </div>
            </div>
            <a href="/signup" style={ctaBtn(false)}>Start Free</a>
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20, marginTop: 8 }}>
              {FREE_FEATURES.map((f, i) => <FeatureRow key={i} text={f} color={ORANGE} />)}
            </div>
          </div>

          {/* ZAP Pro — Most Popular */}
          <div style={card(true)}>
            {/* Badge */}
            <div style={{
              position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
              background: ORANGE, color: "#fff", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "4px 16px", borderRadius: 9999, whiteSpace: "nowrap",
            }}>
              Most Popular
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900, fontSize: 22, color: CREAM, marginBottom: 6 }}>ZAP Pro</div>
              <div style={{ fontSize: 13, color: "rgba(245,241,234,0.6)", marginBottom: 20 }}>For coaches and consultants ready to launch their first high-converting campaign</div>
              <div>
                <span style={{ fontFamily: fontDisplay, fontWeight: 900, fontSize: 44, color: CREAM }}>
                  ${isAnnual ? "1,470" : "147"}
                </span>
                <span style={{ fontSize: 14, color: "rgba(245,241,234,0.55)" }}>
                  {isAnnual ? "/year" : "/month"}
                </span>
              </div>
              {isAnnual && (
                <div style={{ fontSize: 13, color: ORANGE, fontWeight: 600, marginTop: 4 }}>
                  Saves $294 vs monthly
                </div>
              )}
            </div>
            <button
              onClick={() => handleSubscribe("pro")}
              disabled={createCheckoutMutation.isPending || status?.tier === "pro"}
              style={{
                ...ctaBtn(true),
                background: ORANGE,
                opacity: (createCheckoutMutation.isPending || status?.tier === "pro") ? 0.6 : 1,
              }}
            >
              {createCheckoutMutation.isPending ? "Processing…" : status?.tier === "pro" ? "Current Plan" : "Start ZAP Pro"}
            </button>
            {status?.tier !== "pro" && (
              <p style={{ textAlign: "center", fontSize: 12, color: "rgba(245,241,234,0.5)", marginBottom: 16 }}>
                New here?{" "}
                <a href="/signup" style={{ color: "rgba(245,241,234,0.75)", textDecoration: "underline" }}>Create a free account</a>
              </p>
            )}
            <div style={{ borderTop: "1px solid rgba(245,241,234,0.15)", paddingTop: 20, marginTop: 4 }}>
              {PRO_FEATURES.map((f, i) => <FeatureRow key={i} text={f} color={ORANGE} />)}
            </div>
          </div>

          {/* ZAP Pro Plus */}
          <div style={card(false)}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900, fontSize: 22, color: INK, marginBottom: 6 }}>ZAP Pro Plus</div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>For high-volume operators and multi-brand scalers running 10+ campaigns simultaneously</div>
              <div>
                <span style={{ fontFamily: fontDisplay, fontWeight: 900, fontSize: 44, color: INK }}>
                  ${isAnnual ? "4,970" : "497"}
                </span>
                <span style={{ fontSize: 14, color: MUTED }}>
                  {isAnnual ? "/year" : "/month"}
                </span>
              </div>
              {isAnnual && (
                <div style={{ fontSize: 13, color: ORANGE, fontWeight: 600, marginTop: 4 }}>
                  Saves $994 vs monthly
                </div>
              )}
            </div>
            <button
              onClick={() => handleSubscribe("agency")}
              disabled={createCheckoutMutation.isPending || status?.tier === "agency"}
              style={{
                ...ctaBtn(false),
                opacity: (createCheckoutMutation.isPending || status?.tier === "agency") ? 0.6 : 1,
              }}
            >
              {createCheckoutMutation.isPending ? "Processing…" : status?.tier === "agency" ? "Current Plan" : "Go Pro Plus"}
            </button>
            {status?.tier !== "agency" && (
              <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginBottom: 16 }}>
                New here?{" "}
                <a href="/signup" style={{ color: MUTED, textDecoration: "underline" }}>Create a free account</a>
              </p>
            )}
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20, marginTop: 4 }}>
              {PRO_PLUS_FEATURES.map((f, i) => <FeatureRow key={i} text={f} color={PURPLE} />)}
            </div>
          </div>
        </div>

        {/* ── Comparison Table ── */}
        <div style={{ marginBottom: 80 }}>
          <h2 style={{
            fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900,
            fontSize: 32, color: INK, textAlign: "center", marginBottom: 32,
          }}>
            Compare Plans
          </h2>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            <div style={{
              background: "#fff", borderRadius: 24, overflow: "hidden",
              border: `1px solid ${BORDER}`, fontFamily: fontBody, minWidth: 600,
            }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: INK }}>
                {["Feature", "Free", "ZAP Pro", "ZAP Pro Plus"].map((col, i) => (
                  <div key={col} style={{
                    padding: "16px 20px", fontSize: 13, fontWeight: 700,
                    color: CREAM, letterSpacing: "0.04em", textTransform: "uppercase",
                    borderLeft: i === 2 ? `3px solid ${ORANGE}` : "none",
                  }}>{col}</div>
                ))}
              </div>
              {/* Rows */}
              {COMPARISON_ROWS.map((row, ri) => (
                <div key={row.label} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  background: ri % 2 === 0 ? CREAM : "#fff",
                  borderTop: `1px solid ${BORDER}`,
                }}>
                  <div style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: INK }}>{row.label}</div>
                  {[row.free, row.pro, row.plus].map((val, ci) => (
                    <div key={ci} style={{
                      padding: "14px 20px", fontSize: 14, color: val === true ? ORANGE : val === false ? MUTED : INK,
                      fontWeight: val === true ? 700 : 400,
                      borderLeft: ci === 1 ? `3px solid ${ORANGE}` : "none",
                    }}>
                      {val === true ? "✓" : val === false ? "✗" : val}
                    </div>
                  ))}
                </div>
              ))}
            </div>
           </div>
          {/* Swipe hint — mobile only */}
          <p style={{
            textAlign: "center", fontSize: 12, color: "#9ca3af",
            fontFamily: fontBody, marginTop: 10, marginBottom: 0,
            display: "block",
          }} className="swipe-hint">← swipe to compare →</p>
        </div>
        {/* ── FAQ ── */}
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900,
            fontSize: 32, color: INK, textAlign: "center", marginBottom: 40,
          }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 16, padding: "24px 28px",
                border: `1px solid ${BORDER}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}>
                <h3 style={{ fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900, fontSize: 18, color: INK, marginBottom: 10 }}>
                  {item.q}
                </h3>
                <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer CTA ── */}
        <div style={{
          textAlign: "center", marginTop: 80, padding: "56px 24px",
          background: INK, borderRadius: 24,
        }}>
          <img src="/zappy-waiting.svg" alt="Zappy" style={{ width: 80, height: 80, marginBottom: 20 }} />
          <h2 style={{
            fontFamily: fontDisplay, fontStyle: "italic", fontWeight: 900,
            fontSize: 32, color: CREAM, marginBottom: 12,
          }}>
            Ready to build your first campaign?
          </h2>
          <p style={{ fontSize: 16, color: "rgba(245,241,234,0.6)", marginBottom: 28 }}>
            Start free. No credit card required.
          </p>
          <a href="/signup" style={{
            display: "inline-block", padding: "16px 40px", borderRadius: 9999,
            background: ORANGE, color: "#fff", fontWeight: 700, fontSize: 16,
            fontFamily: fontBody, textDecoration: "none",
            boxShadow: "0 4px 14px rgba(255,91,29,0.35)",
          }}>
            Start Free Today
          </a>
        </div>

      </div>
    </div>
  );
}
