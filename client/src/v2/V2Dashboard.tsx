/**
 * V2Dashboard — Sprint 2
 * Components: Nav Tabs, 11-Step Winding Path, Progress Bar,
 *             Fork Point Modal (first-time only), Persistent Buttons
 * All isolated within [data-v2] scope. No existing routes touched.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
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

function PathNode({ node, isMobile, onNodeClick, isSkipped }: { node: PathNode; isMobile: boolean; onNodeClick: (node: PathNode) => void; isSkipped?: boolean }) {
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
        {node.state === "completed" && isSkipped && (
          <div style={{
            position: "absolute", top: -2, right: -2,
            width: 14, height: 14, borderRadius: 9999,
            background: "#999", color: "#fff",
            fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Instrument Sans, sans-serif", fontWeight: 700,
            zIndex: 1,
          }}>S</div>
        )}
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

  // ── ICP data for stats ──
  const { data: icpList } = trpc.icps.list.useQuery(undefined, { staleTime: 30_000 });
  // ── Campaign kits for "View Campaign Kit" link ──
  const { data: campaignKitsList } = trpc.campaignKits.getByUser.useQuery(undefined, { staleTime: 30_000 });

  // ── Service quality score for Node 1 pill ──
  const { data: servicesData } = trpc.services.list.useQuery();
  const currentServiceId = servicesData?.[0]?.id ?? 0;
  const { data: skippedNodesData } = trpc.nodeSkips.getSkippedNodes.useQuery(
    { serviceId: currentServiceId },
    { enabled: currentServiceId > 0 }
  );
  // Sprint 2 Commit 4 — the Trail is the front door. The Service row is now
  // created at the intake's "That's me" confirmation, so no empty-service
  // row is created on click anymore. Manual users reach the wizard via the
  // fork's "I'll pick as we go" chip.
  function handleStartNewCampaign() {
    navigate("/v2-dashboard/trail/new");
  }

  const skippedSet = new Set(skippedNodesData ?? []);
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

  // ── Stats computations ──
  const totalAssetsGenerated = useMemo(() => {
    if (!user) return 0;
    const u = user as any;
    return (u.headlineGeneratedCount || 0) + (u.hvcoGeneratedCount || 0) +
      (u.heroMechanismGeneratedCount || 0) + (u.icpGeneratedCount || 0) +
      (u.adCopyGeneratedCount || 0) + (u.emailSeqGeneratedCount || 0) +
      (u.whatsappSeqGeneratedCount || 0) + (u.landingPageGeneratedCount || 0) +
      (u.offerGeneratedCount || 0);
  }, [user]);

  const activeIcpName = useMemo(() => {
    if (!icpList || icpList.length === 0) return "None yet";
    return icpList[0].name || "Unnamed ICP";
  }, [icpList]);

  // ── Recent activity from completed milestones ──
  const MILESTONE_LABELS: Record<string, { emoji: string; label: string }> = {
    service: { emoji: "🏷", label: "Service Profile" },
    icp: { emoji: "🎯", label: "Ideal Customer Profile" },
    offer: { emoji: "💎", label: "Premium Offer" },
    heroMechanism: { emoji: "⚡", label: "Unique Method" },
    hvco: { emoji: "🎁", label: "Free Opt-In Titles" },
    headlines: { emoji: "✍️", label: "Headlines" },
    adCopy: { emoji: "📣", label: "Ad Copy" },
    landingPage: { emoji: "🖥️", label: "Landing Page" },
    emailSequence: { emoji: "✉️", label: "Email Sequence" },
    whatsappSequence: { emoji: "💬", label: "WhatsApp Sequence" },
    campaign: { emoji: "🚀", label: "Campaign Published" },
  };

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
  // ── Commit 7 (Item 7b): ICP switcher state for the kit sidebar ──
  // Defaults to first ICP via `?? icpList?.[0]?.id` at the read site so the
  // pre-Commit-7 single-ICP experience is preserved when only one ICP exists.
  const [selectedIcpId, setSelectedIcpId] = useState<number | null>(null);

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

  // Sprint 3 C1 side-fix: resolve the ACTIVE selection (kit-combobox choice,
  // falling back like the sidebar does) so path-node links open the wizard on
  // the selected service, not the default/newest one. Mirrors the sidebar's
  // effectiveIcpId resolution at the Campaign Kit IIFE below.
  const activeIcpForNav = (() => {
    const firstIcpWithKit = icpList && campaignKitsList
      ? icpList.find((i: any) => campaignKitsList.some((k: any) => k.icpId === i.id))
      : undefined;
    const effectiveIcpId = selectedIcpId ?? firstIcpWithKit?.id ?? icpList?.[0]?.id;
    return effectiveIcpId ? icpList?.find((i: any) => i.id === effectiveIcpId) : undefined;
  })();
  const activeNavServiceId: number | undefined =
    (activeIcpForNav as any)?.serviceId ?? servicesData?.[0]?.id;
  const wizardQuery = activeNavServiceId ? `?serviceId=${activeNavServiceId}` : "";

  function handleGuide() {
    setShowModal(false);
    setForkDismissed(true);
    localStorage.setItem("v2_fork_dismissed", "true");
    // Navigate to the first non-completed node that has a wizard step
    const nextNode = nodes.find(n => (n.state === "active" || n.state === "locked") && NODE_STEP_MAP[n.id]);
    navigate(`/v2-dashboard/wizard/${nextNode ? NODE_STEP_MAP[nextNode.id] : "offer"}${wizardQuery}`);
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

  // Gate map: which Campaign Kit selection must exist before entering each step
  const DASHBOARD_GATES: Record<string, string> = {
    uniqueMethod: "selectedOfferId",
    freeOptIn: "selectedMechanismId",
    headlines: "selectedHvcoId",
    adCopy: "selectedHeadlineId",
    landingPage: "selectedAdCopyId",
    emailSequence: "selectedLandingPageId",
    whatsappSequence: "selectedEmailSequenceId",
  };

  // Reverse map: which step PRODUCES a given kit field
  const FIELD_TO_PRODUCER: Record<string, string> = {
    selectedOfferId: "offer",
    selectedMechanismId: "uniqueMethod",
    selectedHvcoId: "freeOptIn",
    selectedHeadlineId: "headlines",
    selectedAdCopyId: "adCopy",
    selectedLandingPageId: "landingPage",
    selectedEmailSequenceId: "emailSequence",
  };

  function handleNodeClick(node: PathNode) {
    const step = NODE_STEP_MAP[node.id];
    if (!step) return;

    // Check Campaign Kit gate — block navigation if upstream selection is missing
    const gateField = DASHBOARD_GATES[step];
    if (gateField) {
      // Sprint 3 C1 side-fix: gate against the ACTIVE selection, not icpList[0].
      const currentIcpId = activeIcpForNav?.id ?? icpList?.[0]?.id;
      const activeKit = currentIcpId
        ? campaignKitsList?.find((k: any) => k.icpId === currentIcpId)
        : null;
      if (activeKit && (activeKit as Record<string, unknown>)[gateField] == null) {
        // Redirect to the earliest step that PRODUCES the missing field
        const gateEntries = Object.entries(DASHBOARD_GATES);
        for (const [, field] of gateEntries) {
          if ((activeKit as Record<string, unknown>)[field] == null) {
            const producerStep = FIELD_TO_PRODUCER[field];
            if (producerStep) {
              navigate(`/v2-dashboard/wizard/${producerStep}${wizardQuery}`);
              return;
            }
          }
        }
      }
    }
    navigate(`/v2-dashboard/wizard/${step}${wizardQuery}`);
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
                  {/* My Business Profile */}
                  <a href="/v2-dashboard/source-of-truth" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", fontSize: 13, color: "#333", textDecoration: "none", transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    My Business Profile
                  </a>
                  {/* Asset Library */}
                  <a href="/v2-dashboard/asset-library" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", fontSize: 13, color: "#333", textDecoration: "none", transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    Asset Library
                  </a>
                  {/* Testimonials */}
                  <a href="/v2-dashboard/testimonials" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", fontSize: 13, color: "#333", textDecoration: "none", transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    Testimonials
                  </a>
                  {/* Settings */}
                  <a href="/v2-dashboard/settings" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", fontSize: 13, color: "#333", textDecoration: "none", transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    Settings
                  </a>
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
              marginBottom: "20px",
              lineHeight: 1.3,
              maxWidth: "420px",
            }}>
              Let&apos;s build your first campaign.
            </h2>
            {/* Auto Mode Phase A: two-CTA fork. Primary = let Zappy generate
                everything from a paragraph; secondary = walk through the
                wizard manually with full control. */}
            <button
              onClick={() => handleStartNewCampaign()}
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
                marginBottom: "10px",
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
              Have Zappy Build It For You
            </button>
            <p style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "13px",
              color: "rgba(26,22,36,0.45)",
              margin: "0 0 18px",
              maxWidth: "320px",
              lineHeight: 1.5,
            }}>
              Describe your business in a paragraph. Zappy generates everything in about 5 minutes.
            </p>
            <p style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "12px",
              color: "rgba(26,22,36,0.40)",
              margin: "0 0 18px",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}>
              — or —
            </p>
            <button
              onClick={() => handleStartNewCampaign()}
              style={{
                background: "transparent",
                color: "var(--v2-text-color)",
                border: "1px solid rgba(26,22,36,0.15)",
                borderRadius: "var(--v2-border-radius-pill, 999px)",
                padding: "14px 36px",
                fontFamily: "var(--v2-font-body)",
                fontWeight: 600,
                fontSize: "15px",
                cursor: "pointer",
                marginBottom: "10px",
                transition: "border-color 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(26,22,36,0.35)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(26,22,36,0.15)"; }}
            >
              Set Up Manually
            </button>
            <p style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "13px",
              color: "rgba(26,22,36,0.45)",
              margin: 0,
              maxWidth: "320px",
              lineHeight: 1.5,
            }}>
              Walk through each step yourself with full control.
            </p>
          </div>
        ) : null}

        {!isFirstTime && (
        <>
        {/* ── CAMPAIGN PICKER — clean Duolingo-style campaign list ── */}
        {/* Piece 2: replaces dense dashboard with focused picker */}
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {/* Hero: + New Campaign */}
          <button
            onClick={() => handleStartNewCampaign()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "16px 0", marginBottom: 28,
              background: "var(--v2-primary-btn, #FF5B1D)", color: "#fff", border: "none",
              borderRadius: "var(--v2-border-radius-pill, 999px)",
              fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: 16,
              cursor: "pointer", boxShadow: "0 4px 20px rgba(255,91,29,0.25)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(255,91,29,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(255,91,29,0.25)"; }}
          >
            + New Campaign
          </button>

          {/* Campaign list */}
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: 12, fontWeight: 600, color: "rgba(26,22,36,0.40)", letterSpacing: "0.04em", margin: "0 0 12px", textTransform: "uppercase" }}>
            Your Campaigns
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(() => {
              if (!campaignKitsList || campaignKitsList.length === 0) {
                return <p style={{ fontFamily: "var(--v2-font-body)", fontSize: 14, color: "#999" }}>No campaigns yet. Start your first one above.</p>;
              }
              const KIT_FIELDS = ["selectedOfferId","selectedMechanismId","selectedHvcoId","selectedHeadlineId","selectedAdCopyId","selectedLandingPageId","selectedEmailSequenceId","selectedWhatsAppSequenceId"];
              const sorted = [...campaignKitsList].sort((a: any, b: any) => {
                const aComplete = KIT_FIELDS.every(f => a[f] != null);
                const bComplete = KIT_FIELDS.every(f => b[f] != null);
                if (aComplete !== bComplete) return aComplete ? 1 : -1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });
              const seqMap = new Map<number, number>();
              [...campaignKitsList].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .forEach((k: any, i: number) => seqMap.set(k.id, i + 1));
              return sorted.map((k: any) => {
                const filled = KIT_FIELDS.filter(f => k[f] != null).length;
                const total = KIT_FIELDS.length;
                const isComplete = filled === total;
                const dateStr = k.createdAt ? new Date(k.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
                const seqNum = seqMap.get(k.id) ?? k.id;
                return (
                  <div
                    key={k.id}
                    onClick={() => navigate(`/v2-dashboard/trail/${k.id}`)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 20px", background: "#fff", border: "1px solid #e5e0d8",
                      borderRadius: 14, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#FF5B1D"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(255,91,29,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e0d8"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: 16, color: "#1A1624", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {k.name || `Campaign #${seqNum}`}
                      </div>
                      <div style={{ fontFamily: "var(--v2-font-body)", fontSize: 13, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {k.icpName || ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: 14, color: isComplete ? "#2E7D00" : "#FF5B1D" }}>
                        {filled}/{total} {isComplete ? "✓" : "◉"}
                      </div>
                      <div style={{ fontFamily: "var(--v2-font-body)", fontSize: 11, color: "#aaa", marginTop: 2 }}>
                        {dateStr}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
        {/* END CAMPAIGN PICKER */}
        </>
        )}

      </div>
    </V2Layout>
  );
}
