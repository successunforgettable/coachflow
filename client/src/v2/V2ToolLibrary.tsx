/**
 * V2ToolLibrary — Sprint 5 + Pre-GitHub ICP Gate
 * - ICP Gate: if user has no ICPs, show Zappy prompt card to create one first
 * - ICP Selector: if user has ICPs, show "Generating for: [ICP Name]" dropdown
 * - 9 generator cards in V2 cream design system
 * - Mobile: single column below 768px
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import ZappyMascot from "./ZappyMascot";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import V2AdImageCreator from "./V2AdImageCreator";
import V2VideoCreator from "./V2VideoCreator";

// ─── Generator definitions ────────────────────────────────────────────────────
const GENERATORS = [
  {
    step: "icp",
    name: "Ideal Customer Profile",
    description: "17-section deep-dive into who your perfect buyer is, what they fear, and what makes them buy.",
    emoji: "🎯",
  },
  {
    step: "adCopy",
    name: "Ad Copy",
    description: "15 Meta-compliant ad variations across proven frameworks — hooks, body copy, and CTAs included.",
    emoji: "📣",
  },
  {
    step: "emailSequence",
    name: "Email Sequences",
    description: "Full Soap Opera Sequence — 5-day story-driven emails that warm leads and drive conversions.",
    emoji: "✉️",
  },
  {
    step: "whatsappSequence",
    name: "WhatsApp Sequences",
    description: "Short, punchy WhatsApp messages timed for maximum open rates and reply engagement.",
    emoji: "💬",
  },
  {
    step: "landingPage",
    name: "Landing Pages",
    description: "Complete landing page copy with headline, subheadline, bullets, social proof, and CTA.",
    emoji: "🖥️",
  },
  {
    step: "offer",
    name: "Premium Offer",
    description: "Irresistible offer stack with bonuses, guarantee, urgency, and premium pricing framing.",
    emoji: "💎",
  },
  {
    step: "headlines",
    name: "Headlines",
    description: "25 high-converting headlines across 5 proven formulas for ads, emails, and landing pages.",
    emoji: "✍️",
  },
  {
    step: "freeOptIn",
    name: "Free Opt-In Titles",
    description: "50 compelling lead magnet titles that attract your ideal customer and grow your list fast.",
    emoji: "🎁",
  },
  {
    step: "uniqueMethod",
    name: "Unique Method",
    description: "15 unique mechanism names and supporting copy that set your offer apart from every competitor.",
    emoji: "⚡",
  },
  {
    step: "adImages",
    name: "Ad Images",
    description: "5 scroll-stopping ad image variations — tabloid aesthetic, Meta-compliant headlines, ready to download.",
    emoji: "🖼️",
  },
  {
    step: "videoCreator",
    name: "Video Creator",
    description: "AI-generated video ads with voiceover and motion graphics — script first (free), then render with credits.",
    emoji: "🎬",
  },
];

// ─── Generator Card ───────────────────────────────────────────────────────────
function GeneratorCard({
  gen,
  onOpen,
  disabled,
}: {
  gen: typeof GENERATORS[0];
  onOpen: (step: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        background: disabled ? "#fafafa" : "#fff",
        borderRadius: "var(--v2-border-radius-card)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        opacity: disabled ? 0.55 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      {/* Icon + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "28px", lineHeight: 1 }}>{gen.emoji}</span>
        <h3
          style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "18px",
            color: "var(--v2-text-color)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {gen.name}
        </h3>
      </div>

      {/* Description */}
      <p
        style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "13px",
          color: "#555",
          margin: 0,
          lineHeight: 1.55,
          flex: 1,
        }}
      >
        {gen.description}
      </p>

      {/* CTA Button */}
      <button
        onClick={() => !disabled && onOpen(gen.step)}
        disabled={disabled}
        style={{
          background: disabled ? "#ccc" : "var(--v2-primary-btn)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--v2-border-radius-pill)",
          padding: "14px 24px",
          fontFamily: "var(--v2-font-body)",
          fontWeight: 700,
          fontSize: "15px",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "opacity 0.15s ease, transform 0.1s ease",
          width: "100%",
          marginTop: "4px",
        }}
        onMouseEnter={(e) => {
          if (!disabled)
            (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        }}
      >
        Generate Now
      </button>
    </div>
  );
}

// ─── Main V2ToolLibrary ───────────────────────────────────────────────────────
export default function V2ToolLibrary() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const isFreeTier = !authUser || (authUser.role !== "superuser" && authUser.role !== "admin" && authUser.subscriptionTier !== "pro" && authUser.subscriptionTier !== "agency");
  const [selectedIcpId, setSelectedIcpId] = useState<number | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  // Demo mode: ?demo=noIcp forces the ICP gate for screenshot purposes
  const demoNoIcp = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('demo') === 'noIcp';

  // Fetch all ICPs for the current user
  const { data: icpList, isLoading: icpsLoading } = trpc.icps.list.useQuery(
    undefined,
    { staleTime: 30_000 }
  );

  const hasIcps = !icpsLoading && icpList && icpList.length > 0 && !demoNoIcp;
  const noIcps = demoNoIcp || (!icpsLoading && (!icpList || icpList.length === 0));

  // Auto-select first ICP when list loads
  const effectiveIcpId = useMemo(() => {
    if (selectedIcpId) return selectedIcpId;
    if (icpList && icpList.length > 0) return icpList[0].id;
    return null;
  }, [selectedIcpId, icpList]);

  const selectedIcp = useMemo(
    () => icpList?.find((icp) => icp.id === effectiveIcpId) ?? icpList?.[0],
    [effectiveIcpId, icpList]
  );

  function handleOpen(step: string) {
    // Ad Images opens inline in the Tool Library (no route change)
    if (step === "adImages") {
      setOpenPanel("adImages");
      return;
    }
    // Video Creator opens inline in the Tool Library (no route change)
    if (step === "videoCreator") {
      setOpenPanel("videoCreator");
      return;
    }
    // Pass selected ICP id as query param so wizard can use it
    const icpParam = effectiveIcpId ? `?icpId=${effectiveIcpId}` : "";
    navigate(`/v2-dashboard/wizard/${step}${icpParam}`);
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (icpsLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          gap: "16px",
        }}
      >
        <ZappyMascot state="waiting" size={80} />
        <p
          style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "14px",
            color: "#888",
            margin: 0,
          }}
        >
          Loading your AI Profile…
        </p>
      </div>
    );
  }

  // ── ICP Gate: no ICPs exist (Scenario 4) ────────────────────────────────────
  if (noIcps) {
    return (
      <div style={{ paddingBottom: "64px" }}>
        {/* Gate card — Scenario 4: ICP not selected */}
        <div
          style={{
            background: "#fff",
            borderRadius: "var(--v2-border-radius-card)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            padding: "40px 32px",
            textAlign: "center",
            marginBottom: "32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <ZappyMascot state="waiting" size={100} />
          <div>
            <h2
              style={{
                fontFamily: "var(--v2-font-heading)",
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "22px",
                color: "var(--v2-text-color)",
                margin: "0 0 10px 0",
                lineHeight: 1.3,
              }}
            >
              Pick an ICP first so Zappy knows who we&apos;re targeting.
            </h2>
            <p
              style={{
                fontFamily: "var(--v2-font-body)",
                fontSize: "15px",
                color: "#666",
                margin: 0,
                lineHeight: 1.6,
                maxWidth: "380px",
              }}
            >
              Your Ideal Customer Profile powers every generator — no re-entering data, ever.
            </p>
          </div>
          <button
            onClick={() => navigate("/v2-dashboard/wizard/icp")}
            style={{
              background: "var(--v2-primary-btn)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--v2-border-radius-pill)",
              padding: "16px 40px",
              fontFamily: "var(--v2-font-body)",
              fontWeight: 700,
              fontSize: "16px",
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
          >
            Create My ICP
          </button>
        </div>

        {/* Greyed-out generator grid (locked) */}
        <p
          style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "12px",
            color: "#aaa",
            textAlign: "center",
            marginBottom: "20px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Unlocks after ICP is created
        </p>
        <div
          className="v2-tool-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {GENERATORS.filter((g) => g.step !== "icp").map((gen) => (
            <GeneratorCard key={gen.step} gen={gen} onOpen={handleOpen} disabled />
          ))}
        </div>
      </div>
    );
  }

  // ── Normal view: ICPs exist ────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: "64px" }}>

      {/* ── ICP Selector ── */}
      <div
        style={{
          background: "#fff",
          borderRadius: "var(--v2-border-radius-card)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          padding: "18px 24px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <ZappyMascot state="idle" size={44} />
        <div style={{ flex: 1, minWidth: "200px" }}>
          <label
            htmlFor="icp-selector"
            style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "11px",
              fontWeight: 600,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Generating for
          </label>
          <select
            id="icp-selector"
            value={effectiveIcpId ?? ""}
            onChange={(e) => setSelectedIcpId(Number(e.target.value))}
            style={{
              fontFamily: "var(--v2-font-heading)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: "16px",
              color: "var(--v2-text-color)",
              background: "transparent",
              border: "none",
              outline: "none",
              cursor: "pointer",
              padding: 0,
              appearance: "auto",
              maxWidth: "100%",
            }}
          >
            {icpList?.map((icp) => (
              <option key={icp.id} value={icp.id}>
                {icp.name}
              </option>
            ))}
          </select>
        </div>
        <p
          style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "12px",
            color: "#aaa",
            margin: 0,
            whiteSpace: "nowrap",
          }}
        >
          {icpList?.length} profile{(icpList?.length ?? 0) > 1 ? "s" : ""} available
        </p>
      </div>

      {/* ── Zappy intro banner ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          background: "rgba(139,92,246,0.06)",
          borderRadius: "var(--v2-border-radius-card)",
          padding: "16px 24px",
          marginBottom: "28px",
          border: "1px solid rgba(139,92,246,0.12)",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--v2-font-heading)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: "15px",
              color: "var(--v2-text-color)",
              margin: "0 0 2px 0",
            }}
          >
            Pick any tool and generate in one click.
          </p>
          <p
            style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "12px",
              color: "#666",
              margin: 0,
            }}
          >
            All generators are powered by{" "}
            <strong>{selectedIcp?.name ?? "your AI Profile"}</strong>.
          </p>
        </div>
      </div>

      {/* ── Ad Images inline panel ── */}
      {openPanel === "adImages" && (
        <div style={{ marginBottom: "32px" }}>
          <button
            onClick={() => setOpenPanel(null)}
            style={{ background: "transparent", border: "none", fontFamily: "var(--v2-font-body)", fontSize: "13px", fontWeight: 700, color: "#888", cursor: "pointer", padding: "0 0 16px 0", display: "flex", alignItems: "center", gap: "6px" }}
          >
            ← Back to Tool Library
          </button>
          <V2AdImageCreator />
        </div>
      )}

      {/* ── Video Creator inline panel ── */}
      {openPanel === "videoCreator" && (
        <div style={{ marginBottom: "32px" }}>
          <button
            onClick={() => setOpenPanel(null)}
            style={{ background: "transparent", border: "none", fontFamily: "var(--v2-font-body)", fontSize: "13px", fontWeight: 700, color: "#888", cursor: "pointer", padding: "0 0 16px 0", display: "flex", alignItems: "center", gap: "6px" }}
          >
            ← Back to Tool Library
          </button>
          <V2VideoCreator isFreeTier={isFreeTier} />
        </div>
      )}

      {/* ── Generator grid (hidden when panel is open) ── */}
      {!openPanel && (
        <div
          className="v2-tool-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {GENERATORS.map((gen) => (
            <GeneratorCard key={gen.step} gen={gen} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
