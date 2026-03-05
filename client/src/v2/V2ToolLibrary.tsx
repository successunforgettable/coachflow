/**
 * V2ToolLibrary — Sprint 5
 * 9 generator cards in V2 cream design system.
 * Each card opens V2GeneratorWizard in-place (inline wizard mode).
 * Mobile: single column below 768px.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import ZappyMascot from "./ZappyMascot";

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
];

// ─── Generator Card ───────────────────────────────────────────────────────────
function GeneratorCard({ gen, onOpen }: { gen: typeof GENERATORS[0]; onOpen: (step: string) => void }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "var(--v2-border-radius-card)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Icon + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "28px", lineHeight: 1 }}>{gen.emoji}</span>
        <h3 style={{
          fontFamily: "var(--v2-font-heading)",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "18px",
          color: "var(--v2-text-color)",
          margin: 0,
          lineHeight: 1.2,
        }}>
          {gen.name}
        </h3>
      </div>

      {/* Description */}
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "13px",
        color: "#555",
        margin: 0,
        lineHeight: 1.55,
        flex: 1,
      }}>
        {gen.description}
      </p>

      {/* CTA Button */}
      <button
        onClick={() => onOpen(gen.step)}
        style={{
          background: "var(--v2-primary-btn)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--v2-border-radius-pill)",
          padding: "14px 24px",
          fontFamily: "var(--v2-font-body)",
          fontWeight: 700,
          fontSize: "15px",
          cursor: "pointer",
          transition: "opacity 0.15s ease, transform 0.1s ease",
          width: "100%",
          marginTop: "4px",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
      >
        Generate Now
      </button>
    </div>
  );
}

// ─── Main V2ToolLibrary ───────────────────────────────────────────────────────
export default function V2ToolLibrary() {
  const [, navigate] = useLocation();

  function handleOpen(step: string) {
    navigate(`/v2-dashboard/wizard/${step}`);
  }

  return (
    <div style={{ paddingBottom: "64px" }}>

      {/* ── Zappy intro banner ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        background: "#fff",
        borderRadius: "var(--v2-border-radius-card)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        padding: "20px 24px",
        marginBottom: "32px",
      }}>
        <div style={{ flexShrink: 0, width: "64px", height: "64px" }}>
          <ZappyMascot state="idle" size={64} />
        </div>
        <div>
          <p style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "17px",
            color: "var(--v2-text-color)",
            margin: "0 0 4px 0",
          }}>
            Pick any tool and generate in one click.
          </p>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#666",
            margin: 0,
          }}>
            Your AI Profile powers everything — no re-entering data, ever.
          </p>
        </div>
      </div>

      {/* ── Generator grid ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "20px",
      }}
        className="v2-tool-grid"
      >
        {GENERATORS.map(gen => (
          <GeneratorCard key={gen.step} gen={gen} onOpen={handleOpen} />
        ))}
      </div>
    </div>
  );
}
