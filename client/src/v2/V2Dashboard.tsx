/**
 * V2Dashboard — Sprint 2
 * Components: Nav Tabs, 11-Step Winding Path, Progress Bar,
 *             Fork Point Modal (first-time only), Persistent Buttons
 * All isolated within [data-v2] scope. No existing routes touched.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import V2Layout from "./V2Layout";
import V2ToolLibrary from "./V2ToolLibrary";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Types ───────────────────────────────────────────────────────────────────
type NodeState = "completed" | "active" | "locked";

interface PathNode {
  id: number;
  label: string;
  state: NodeState;
  qualityScore?: number; // 0–7, only used for node 1
}

// ─── Initial 11-step data (mock states per spec) ─────────────────────────────
const INITIAL_NODES: PathNode[] = [
  { id: 1,  label: "Service",               state: "completed" },
  { id: 2,  label: "ICP",                   state: "active"    },
  { id: 3,  label: "Offer",                 state: "locked"    },
  { id: 4,  label: "Unique Method",         state: "locked"    },
  { id: 5,  label: "Free Opt-In",           state: "locked"    },
  { id: 6,  label: "Headlines",             state: "locked"    },
  { id: 7,  label: "Ad Copy",               state: "locked"    },
  { id: 8,  label: "Landing Page",          state: "locked"    },
  { id: 9,  label: "Email Sequence",        state: "locked"    },
  { id: 10, label: "WhatsApp Sequence",     state: "locked"    },
  { id: 11, label: "Push to Meta / GoHighLevel", state: "locked" },
];

// ─── Checkmark SVG ───────────────────────────────────────────────────────────
function Checkmark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M6 14.5l5.5 5.5L22 9" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Lock SVG ────────────────────────────────────────────────────────────────
function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="4" y="10" width="14" height="9" rx="2" stroke="#999" strokeWidth="1.8"/>
      <path d="M7 10V7a4 4 0 0 1 8 0v3" stroke="#999" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Node ID to wizard step mapping ─────────────────────────────────────────
const NODE_STEP_MAP: Record<number, string> = {
  1:  "service",
  2:  "icp",
  3:  "offer",
  4:  "uniqueMethod",
  5:  "freeOptIn",
  6:  "headlines",
  7:  "adCopy",
  8:  "landingPage",
  9:  "emailSequence",
  10: "whatsappSequence",
  11: "pushToMeta",
};

// ─── Single Path Node ────────────────────────────────────────────────────────
function QualityPill({ score }: { score: number }) {
  if (score === 0) return null;
  const label = score <= 2 ? "Basic" : score <= 5 ? "Good" : "Strong";
  const color = score <= 2 ? "#FF5B1D" : score <= 5 ? "#F59E0B" : "#22C55E";
  const bg   = score <= 2 ? "rgba(255,91,29,0.12)" : score <= 5 ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "999px",
      background: bg,
      color,
      fontFamily: "var(--v2-font-body)",
      fontSize: "11px",
      fontWeight: 600,
      letterSpacing: "0.02em",
    }}>{label}</span>
  );
}

function PathNode({ node, isMobile, onNodeClick }: { node: PathNode; isMobile: boolean; onNodeClick: (node: PathNode) => void }) {
  const size = isMobile ? 60 : 80;

  const bgColor =
    node.state === "completed" ? "#58CC02" :
    node.state === "active"    ? "#FF5B1D" :
    "#E5E5E5";

  const nodeStyle: React.CSSProperties = {
    width:  size,
    height: size,
    borderRadius: "50%",
    background: bgColor,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: node.state === "locked" ? 0.5 : 1,
    cursor: node.state === "locked" ? "not-allowed" : "pointer",
    flexShrink: 0,
    position: "relative",
    animation: node.state === "active" ? "v2-pulse 1.8s ease-in-out infinite" : "none",
    transition: "transform 0.15s ease",
    pointerEvents: node.state === "locked" ? "none" : "auto",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <div style={nodeStyle} onClick={() => node.state !== "locked" && onNodeClick(node)}>
        {node.state === "completed" && <Checkmark />}
        {node.state === "active" && (
          <span style={{ color: "#fff", fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: isMobile ? "13px" : "15px" }}>
            {node.id}
          </span>
        )}
        {node.state === "locked" && <LockIcon />}
      </div>
      <span style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "13px",
        fontWeight: 500,
        color: node.state === "locked" ? "rgba(26,22,36,0.35)" : "var(--v2-text-color)",
        textAlign: "center",
        maxWidth: isMobile ? "80px" : "110px",
        lineHeight: 1.3,
      }}>
        {node.label}
      </span>
      {node.id === 1 && node.qualityScore !== undefined && node.qualityScore > 0 && (
        <QualityPill score={node.qualityScore} />
      )}
    </div>
  );
}

// ─── Connector line between nodes ────────────────────────────────────────────
function Connector({ fromCompleted }: { fromCompleted: boolean }) {
  return (
    <div style={{
      width: "3px",
      height: "32px",
      background: fromCompleted ? "#58CC02" : "rgba(26,22,36,0.12)",
      borderRadius: "2px",
      flexShrink: 0,
      margin: "0 auto",
    }} />
  );
}

// ─── Fork Point Modal ─────────────────────────────────────────────────────────
function ForkModal({ onGuide, onJump }: { onGuide: () => void; onJump: () => void }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(26,22,36,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "16px",
    }}>
      {/* Bottom-sheet on mobile handled via CSS class */}
      <div className="v2-fork-modal">
        <img
          src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026750612/yEmwjxjbsCjMaqII.png"
          alt="Zappy the fox mascot"
          style={{ width: "120px", height: "120px", objectFit: "contain", borderRadius: "0", margin: "0 auto 20px", display: "block" }}
        />
        <h2 style={{
          fontFamily: "var(--v2-font-heading)",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "28px",
          color: "var(--v2-text-color)",
          textAlign: "center",
          marginBottom: "8px",
          lineHeight: 1.2,
        }}>
          Your AI Profile is Ready!
        </h2>
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "16px",
          color: "rgba(26,22,36,0.60)",
          textAlign: "center",
          marginBottom: "28px",
          lineHeight: 1.5,
        }}>
          How do you want to continue?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            className="v2-btn v2-btn-primary"
            style={{ width: "100%", justifyContent: "center", fontSize: "16px", padding: "14px 28px" }}
            onClick={onGuide}
          >
            Guide Me Step by Step
          </button>
          <button
            className="v2-btn v2-btn-secondary"
            style={{ width: "100%", justifyContent: "center", fontSize: "16px", padding: "14px 28px" }}
            onClick={onJump}
          >
            Jump to Tool Library
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Milestone id → PathNode index mapping ───────────────────────────────────
const MILESTONE_TO_NODE: Record<string, number> = {
  service:          0,
  icp:              1,
  offer:            2,
  heroMechanism:    3,
  hvco:             4,
  headlines:        5,
  adCopy:           6,
  landingPage:      7,
  emailSequence:    8,
  whatsappSequence: 9,
  campaign:         10,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function V2Dashboard() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [activeTab, setActiveTab] = useState<"guided" | "tools">(
    () => new URLSearchParams(window.location.search).get("tab") === "tools" ? "tools" : "guided"
  );

  // Source of Truth check
  const { data: sotData, isLoading: sotLoading } = trpc.sourceOfTruth.get.useQuery();

  // ── Real progress data from backend ──
  const { data: progressData, isLoading: progressLoading } = trpc.progress.getProgress.useQuery();

  // ── Service quality score for Node 1 pill ──
  const { data: servicesData } = trpc.services.list.useQuery();
  const serviceQualityScore = useMemo(() => {
    const svc = servicesData?.[0];
    if (!svc) return 0;
    const fields = [
      svc.name,
      svc.description,
      svc.targetCustomer,
      svc.mainBenefit,
      svc.painPoints,
      svc.hvcoTopic,
      svc.uniqueMechanismSuggestion,
    ];
    return fields.filter(f => f && String(f).trim().length > 0).length;
  }, [servicesData]);

  // ── First-time gate: no service saved yet ──
  // While loading we show nothing to avoid flicker.
  // Once loaded, if the "service" milestone is not completed the user sees the
  // welcome screen instead of the winding path + tabs.
  // ?demo=welcome forces the welcome screen for screenshot/QA purposes.
  const demoWelcome = new URLSearchParams(window.location.search).get("demo") === "welcome";
  const isFirstTime = demoWelcome || (!progressLoading &&
    progressData !== undefined &&
    !progressData.milestones?.some(
      (m: { id: string; completed: boolean }) => m.id === "service" && m.completed
    ));

  // ── Derive node states from real data (strict sequential logic) ──
  const nodes = useMemo<PathNode[]>(() => {
    // Start all nodes as locked
    const base: PathNode[] = INITIAL_NODES.map(n => ({ ...n, state: "locked" as NodeState }));

    if (!progressData?.milestones) {
      // While loading: node 1 is active, rest locked
      base[0].state = "active";
      return base;
    }

    // Build a set of completed milestone IDs from real backend data
    const completedIds = new Set(
      progressData.milestones.filter((m: { id: string; completed: boolean }) => m.completed).map((m: { id: string }) => m.id)
    );

    // Sequential pass:
    //   - A node is Completed only if its milestone is done AND all previous nodes are Completed.
    //   - The first non-Completed node becomes Active.
    //   - All nodes after the Active node remain Locked.
    let activeSet = false;
    for (let i = 0; i < base.length; i++) {
      const milestoneId = Object.keys(MILESTONE_TO_NODE).find(
        k => MILESTONE_TO_NODE[k] === i
      );
      const isDone = milestoneId ? completedIds.has(milestoneId) : false;

      if (!activeSet) {
        if (isDone) {
          base[i].state = "completed";
        } else {
          base[i].state = "active";
          activeSet = true;
        }
      }
      // Nodes after the active node remain "locked"
    }

    // Attach quality score to node 1
    base[0].qualityScore = serviceQualityScore;

    return base;
  }, [progressData, serviceQualityScore]);
  const [showModal, setShowModal] = useState(false);
  const [forkDismissed, setForkDismissed] = useState(() => {
    return localStorage.getItem("v2_fork_dismissed") === "true";
  });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Show fork modal when ICP (node 2) is first completed
  useEffect(() => {
    if (forkDismissed) return;
    const icpNode = nodes.find(n => n.id === 2);
    if (icpNode && icpNode.state === "completed") {
      setShowModal(true);
    }
  }, [nodes, forkDismissed]);

  // Real counts from derived node states
  const completedCount = nodes.filter(n => n.state === "completed").length;
  const totalCount = nodes.length;

  function handleGuide() {
    setShowModal(false);
    setForkDismissed(true);
    localStorage.setItem("v2_fork_dismissed", "true");
    // Navigate to the first non-completed node that has a wizard step
    const nextNode = nodes.find(n => (n.state === "active" || n.state === "locked") && NODE_STEP_MAP[n.id]);
    navigate(`/v2-dashboard/wizard/${nextNode ? NODE_STEP_MAP[nextNode.id] : "offer"}`);
  }

  function handleJump() {
    setShowModal(false);
    setForkDismissed(true);
    localStorage.setItem("v2_fork_dismissed", "true");
    setActiveTab("tools");
  }

  function handleTabTools() {
    setActiveTab("tools");
  }

  const progressPct = Math.round((completedCount / totalCount) * 100);

  function handleNodeClick(node: PathNode) {
    const step = NODE_STEP_MAP[node.id];
    if (step) {
      navigate(`/v2-dashboard/wizard/${step}`);
    }
  }

  return (
    <V2Layout>
      {/* Fork Modal */}
      {showModal && <ForkModal onGuide={handleGuide} onJump={handleJump} />}

      <div className="v2-container" style={{ paddingTop: "32px", paddingBottom: "64px" }}>

        {/* ── Header ── */}
        <header style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "22px",
            color: "var(--v2-text-color)",
          }}>ZAP</span>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* User menu */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "none",
                  border: "1.5px solid rgba(139,92,246,0.25)",
                  borderRadius: "999px",
                  padding: "4px 12px 4px 4px",
                  cursor: "pointer",
                  fontFamily: "var(--v2-font-body)",
                  fontSize: "13px",
                  color: "var(--v2-text-color)",
                  transition: "border-color 0.15s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)")}
              >
                {/* Avatar circle */}
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #FF5B1D, #8B5CF6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "12px",
                  flexShrink: 0,
                }}>
                  {user?.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.name || "Account"}
                </span>
                {/* Chevron */}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5, transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  minWidth: "180px",
                  zIndex: 100,
                  overflow: "hidden",
                  fontFamily: "var(--v2-font-body)",
                }}>
                  {/* User info */}
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a", marginBottom: "2px" }}>{user?.name}</div>
                    <div style={{ fontSize: "11px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
                  </div>
                  {/* Settings */}
                  <a
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 16px",
                      fontSize: "13px",
                      color: "#333",
                      textDecoration: "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Settings
                  </a>
                  {/* Start New Campaign */}
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/v2-dashboard/wizard/service"); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 16px",
                      fontSize: "13px",
                      color: "#FF5B1D",
                      background: "none",
                      border: "none",
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background 0.1s",
                      fontFamily: "var(--v2-font-body)",
                      fontWeight: 600,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,91,29,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Start New Campaign
                  </button>
                  {/* Sign out */}
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 16px",
                      fontSize: "13px",
                      color: "#ef4444",
                      background: "none",
                      border: "none",
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fef2f2")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── FIRST-TIME WELCOME SCREEN ── */}
        {isFirstTime ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            textAlign: "center",
            padding: "0 24px",
          }}>
            <img
              src="/zappy-waiting.svg"
              alt="Zappy waiting"
              style={{ width: "180px", height: "180px", marginBottom: "28px" }}
            />
            <h2 style={{
              fontFamily: "var(--v2-font-heading)",
              fontWeight: 800,
              fontSize: "22px",
              color: "var(--v2-text-color)",
              marginBottom: "12px",
              lineHeight: 1.3,
              maxWidth: "420px",
            }}>
              Let&apos;s build your first campaign. It starts with one sentence about what you do.
            </h2>
            <button
              onClick={() => navigate("/v2-dashboard/wizard/service")}
              style={{
                background: "var(--v2-primary-btn, #FF5B1D)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--v2-border-radius-pill, 999px)",
                padding: "16px 40px",
                fontFamily: "var(--v2-font-body)",
                fontWeight: 700,
                fontSize: "17px",
                cursor: "pointer",
                marginBottom: "14px",
                boxShadow: "0 4px 20px rgba(255,91,29,0.30)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(255,91,29,0.40)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = "";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(255,91,29,0.30)";
              }}
            >
              Define My Service
            </button>
            <p style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "13px",
              color: "rgba(26,22,36,0.45)",
              margin: 0,
            }}>
              Takes 2 minutes. Powers everything else.
            </p>
          </div>
        ) : null}

        {!isFirstTime && (
        <>
        {/* ── Source of Truth card ── */}
        <div
          onClick={() => navigate("/v2-dashboard/source-of-truth")}
          style={{
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid rgba(26,22,36,0.08)",
            padding: "14px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "box-shadow 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(26,22,36,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/zappy-waiting.svg" alt="" style={{ width: "28px", height: "28px" }} />
            <span style={{ fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "14px", color: "#1A1624" }}>Source of Truth</span>
          </div>
          {sotLoading ? (
            <span style={{ fontFamily: "var(--v2-font-body)", fontSize: "11px", color: "#999", fontWeight: 500 }}>Checking...</span>
          ) : sotData ? (
            <span style={{ background: "rgba(88,204,2,0.12)", color: "#2E7D00", border: "1px solid rgba(88,204,2,0.30)", borderRadius: "9999px", padding: "3px 12px", fontFamily: "var(--v2-font-body)", fontSize: "11px", fontWeight: 600 }}>Active</span>
          ) : (
            <span style={{ background: "rgba(255,91,29,0.10)", color: "#FF5B1D", border: "1px solid rgba(255,91,29,0.25)", borderRadius: "9999px", padding: "3px 12px", fontFamily: "var(--v2-font-body)", fontSize: "11px", fontWeight: 600 }}>Set Up Now</span>
          )}
        </div>

        {/* ── COMPONENT 1: Nav Tabs ── */}
        <div style={{
          display: "inline-flex",
          background: "rgba(26,22,36,0.07)",
          borderRadius: "var(--v2-border-radius-pill)",
          padding: "4px",
          marginBottom: "32px",
          gap: "4px",
        }}>
          <button
            onClick={() => setActiveTab("guided")}
            style={{
              borderRadius: "var(--v2-border-radius-pill)",
              padding: "10px 22px",
              fontFamily: "var(--v2-font-body)",
              fontWeight: 600,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.18s ease",
              background: activeTab === "guided" ? "#fff" : "transparent",
              color: activeTab === "guided" ? "var(--v2-text-color)" : "rgba(26,22,36,0.50)",
              boxShadow: activeTab === "guided" ? "0 1px 6px rgba(26,22,36,0.10)" : "none",
            }}
          >
            Guided Campaign
          </button>
          <button
            onClick={handleTabTools}
            style={{
              borderRadius: "var(--v2-border-radius-pill)",
              padding: "10px 22px",
              fontFamily: "var(--v2-font-body)",
              fontWeight: 600,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.18s ease",
              background: activeTab === "tools" ? "#fff" : "transparent",
              color: activeTab === "tools" ? "var(--v2-text-color)" : "rgba(26,22,36,0.50)",
              boxShadow: activeTab === "tools" ? "0 1px 6px rgba(26,22,36,0.10)" : "none",
            }}
          >
            Tool Library
          </button>
        </div>

        {/* ── COMPONENT 3: Progress Bar ── */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}>
            <span style={{
              fontFamily: "var(--v2-font-body)",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--v2-text-color)",
            }}>
              Campaign Kit: {completedCount} of {totalCount} Assets Completed
            </span>
            <span style={{
              fontFamily: "var(--v2-font-body)",
              fontWeight: 700,
              fontSize: "14px",
              color: "#58CC02",
            }}>
              {progressPct}%
            </span>
          </div>
          <div style={{
            width: "100%",
            height: "10px",
            background: "rgba(26,22,36,0.10)",
            borderRadius: "var(--v2-border-radius-pill)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #58CC02, #7BE82A)",
              borderRadius: "var(--v2-border-radius-pill)",
              transition: "width 0.5s ease",
            }} />
          </div>
        </div>

        {/* ── COMPONENT 4 (persistent): Fork Buttons — shown after modal dismissed ── */}
        {forkDismissed && (
          <div className="v2-fork-persistent" style={{ marginBottom: "32px" }}>
            <button
              className="v2-btn v2-btn-primary"
              onClick={() => {}}
            >
              Continue Campaign
            </button>
            <button
              className="v2-btn v2-btn-secondary"
              onClick={() => setActiveTab("tools")}
            >
              Use a Generator
            </button>
          </div>
        )}



        {/* ── COMPONENT 2: 11-Step Winding Path (Guided) OR Tool Library ── */}
        {activeTab === "guided" ? (
          <div className="v2-path-wrapper">
            {nodes.map((node, idx) => (
              <div key={node.id} className="v2-path-column">
                {/* Connector above (except first node) */}
                {idx > 0 && (
                  <Connector fromCompleted={nodes[idx - 1].state === "completed"} />
                )}
                <PathNode node={node} isMobile={isMobile} onNodeClick={handleNodeClick} />
              </div>
            ))}
          </div>
        ) : (
          <V2ToolLibrary />
        )}

        </>
        )}

      </div>
    </V2Layout>
  );
}
