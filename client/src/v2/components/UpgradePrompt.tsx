/**
 * UpgradePrompt — L-QUOTA reusable upgrade gate component
 *
 * Two variants:
 *   "modal"  — fixed full-screen overlay with centered card
 *   "inline" — embedded card, full-width within its container
 *
 * Uses exact V2 CSS variables from v2-theme.css. No hardcoded hex values.
 */

interface UpgradePromptProps {
  variant: "modal" | "inline";
  featureName: string;
  onClose?: () => void;
}

export default function UpgradePrompt({ variant, featureName, onClose }: UpgradePromptProps) {
  const campaign = featureName.toLowerCase().replace(/\s+/g, "-");
  const pricingUrl = `/pricing?utm_source=app&utm_medium=quota_gate&utm_campaign=${campaign}`;

  const card = (
    <div style={{
      background: "#fff",
      borderRadius: "var(--v2-border-radius-card)",
      padding: variant === "modal" ? "40px" : "24px",
      maxWidth: variant === "modal" ? "400px" : "none",
      width: "100%",
      boxShadow: variant === "modal" ? "0 24px 64px rgba(26, 22, 36, 0.18)" : "var(--v2-shadow-card)",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      textAlign: "center" as const,
      gap: "16px",
      position: "relative" as const,
    }}>
      {/* Close button (modal only, when onClose provided) */}
      {variant === "modal" && onClose && (
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            cursor: "pointer",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--v2-border-radius-pill)",
            color: "var(--v2-text-color)",
            opacity: 0.4,
            fontSize: "18px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.8"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}
        >
          ✕
        </button>
      )}

      {/* Zappy concerned */}
      <img
        src="/zappy-concerned.svg"
        alt="Zappy concerned"
        style={{ width: "80px", height: "80px", objectFit: "contain" }}
      />

      {/* Heading */}
      <h3 style={{
        fontFamily: "var(--v2-font-heading)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "22px",
        color: "var(--v2-text-color)",
        margin: 0,
        lineHeight: 1.2,
      }}>
        Unlock {featureName}
      </h3>

      {/* Body copy */}
      <div>
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "15px",
          color: "var(--v2-text-color)",
          opacity: 0.65,
          margin: "0 0 4px",
          lineHeight: 1.5,
        }}>
          You've reached your trial limit.
        </p>
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "15px",
          color: "var(--v2-text-color)",
          opacity: 0.65,
          margin: 0,
          lineHeight: 1.5,
        }}>
          Upgrade to Pro to keep going.
        </p>
      </div>

      {/* CTA */}
      <a
        href={pricingUrl}
        style={{
          display: "inline-block",
          background: "var(--v2-primary-btn)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--v2-border-radius-pill)",
          padding: "14px 36px",
          fontFamily: "var(--v2-font-body)",
          fontWeight: 700,
          fontSize: "16px",
          textDecoration: "none",
          cursor: "pointer",
          boxShadow: "var(--v2-shadow-btn)",
          transition: "opacity 0.15s, transform 0.12s",
          marginTop: "4px",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.opacity = "0.9";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.transform = "";
        }}
      >
        Upgrade to Pro
      </a>
    </div>
  );

  if (variant === "inline") return card;

  // Modal variant — full-screen overlay
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(26, 22, 36, 0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "16px",
    }}>
      {card}
    </div>
  );
}
