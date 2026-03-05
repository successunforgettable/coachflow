/**
 * V2Dashboard — Sprint 2
 * Components: Nav Tabs, 11-Step Winding Path, Progress Bar,
 *             Fork Point Modal (first-time only), Persistent Buttons
 * All isolated within [data-v2] scope. No existing routes touched.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import V2Layout from "./V2Layout";

// ─── Types ───────────────────────────────────────────────────────────────────
type NodeState = "completed" | "active" | "locked";

interface PathNode {
  id: number;
  label: string;
  state: NodeState;
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
      <div style={nodeStyle}>
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
        maxWidth: isMobile ? "70px" : "90px",
        lineHeight: 1.3,
      }}>
        {node.label}
      </span>
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function V2Dashboard() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"guided" | "tools">("guided");
  const [nodes, setNodes] = useState<PathNode[]>(INITIAL_NODES);
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

  const completedCount = nodes.filter(n => n.state === "completed").length;
  const totalCount = nodes.length;

  function handleGuide() {
    setShowModal(false);
    setForkDismissed(true);
    localStorage.setItem("v2_fork_dismissed", "true");
  }

  function handleJump() {
    setShowModal(false);
    setForkDismissed(true);
    localStorage.setItem("v2_fork_dismissed", "true");
    navigate("/dashboard");
  }

  function handleTabTools() {
    navigate("/dashboard");
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
        <header style={{ marginBottom: "32px" }}>
          <span style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "22px",
            color: "var(--v2-text-color)",
          }}>ZAP</span>
        </header>

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
              background: "transparent",
              color: "rgba(26,22,36,0.50)",
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
              onClick={() => navigate("/dashboard")}
            >
              Use a Generator
            </button>
          </div>
        )}



        {/* ── COMPONENT 2: 11-Step Winding Path ── */}
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

      </div>
    </V2Layout>
  );
}
