/**
 * StyleChooser — inline card picker for ad-image style.
 * Shows 2+ style options with preview images.
 * Photo Ad: fixed sample image. Quote Card: live canvas preview with user's headline.
 */
import React, { useRef, useEffect, useState } from "react";

// ── Palette presets (must match server/renderQuoteCard.ts) ──

const PALETTES = [
  { key: "charcoal", bg: "#1a1a2e", accent: "#e94560", label: "Charcoal" },
  { key: "navy",     bg: "#0a1628", accent: "#4ea8de", label: "Navy" },
  { key: "forest",   bg: "#0b2418", accent: "#52b788", label: "Forest" },
  { key: "slate",    bg: "#1e293b", accent: "#94a3b8", label: "Slate" },
  { key: "burgundy", bg: "#2d0a1e", accent: "#e76f8b", label: "Burgundy" },
];

// ── Fixed sample for photo-ad style ──
// A hand-picked representative example uploaded to Cloudinary
const PHOTO_AD_SAMPLE = "https://res.cloudinary.com/dunshei0y/image/upload/v1718710000/ad-style-sample-photo-ad.png";

// ── Live canvas preview for quote card ──

function QuoteCardPreview({ headline, bg, accent }: { headline: string; bg: string; accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 200;
    const H = 200;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Headline text — centre-positioned, white, bold
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = headline.toUpperCase();
    // Scale font to fit ~3 lines
    let fontSize = 18;
    ctx.font = `bold ${fontSize}px sans-serif`;
    const maxWidth = W - 30;

    // Simple word wrap
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    // Shrink font if too many lines
    if (lines.length > 4) {
      fontSize = 14;
      ctx.font = `bold ${fontSize}px sans-serif`;
    }

    const lineHeight = fontSize * 1.3;
    const blockH = lines.length * lineHeight;
    const startY = (H - blockH) / 2 - 10;

    lines.slice(0, 5).forEach((l, i) => {
      ctx.fillText(l, W / 2, startY + lineHeight * (i + 0.5), maxWidth);
    });

    // Accent divider
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(W * 0.3, startY + blockH + 8, W * 0.4, 1.5);
    ctx.globalAlpha = 1;
  }, [headline, bg, accent]);

  return <canvas ref={canvasRef} style={{ width: 200, height: 200, borderRadius: 12 }} />;
}

// ── Live canvas preview for notification mockup ──

function NotificationPreview({ headline, bg, accent }: { headline: string; bg: string; accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 200;
    const H = 200;
    canvas.width = W;
    canvas.height = H;

    // Dark background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Status bar
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("9:41", 12, 16);
    // Battery
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(W - 28, 8, 16, 8);
    ctx.fillRect(W - 26, 10, 10, 4);

    // Notification card
    const cardX = 14;
    const cardY = 38;
    const cardW = W - 28;
    const cardR = 12;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, 130, cardR);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // App icon circle
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cardX + 18, cardY + 18, 8, 0, Math.PI * 2);
    ctx.fill();

    // App name + "now"
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("NOTES", cardX + 32, cardY + 16);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "7px sans-serif";
    ctx.fillText("now", cardX + 32, cardY + 26);

    // Headline text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    const maxWidth = cardW - 24;
    const words = headline.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    lines.slice(0, 4).forEach((l, i) => {
      ctx.fillText(l, cardX + 12, cardY + 48 + i * 16, maxWidth);
    });

    // Home bar
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - 20, H - 10, 40, 3, 1.5);
    ctx.fill();
  }, [headline, bg, accent]);

  return <canvas ref={canvasRef} style={{ width: 200, height: 200, borderRadius: 12 }} />;
}

// ── Main chooser ──

export interface StyleChoice {
  style: string; // "photo_ad" | "quote_card:navy" etc.
}

interface StyleChooserProps {
  headline: string;
  onChoose: (choice: StyleChoice) => void;
}

export default function StyleChooser({ headline, onChoose }: StyleChooserProps) {
  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0]);
  const [notifPalette, setNotifPalette] = useState(PALETTES[1]); // default Navy for notification
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null);

  const cardBase: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 16,
    border: "2px solid transparent",
    background: "#fff",
    cursor: "pointer",
    transition: "border-color 0.15s, box-shadow 0.15s",
    width: 230,
    flexShrink: 0,
  };

  const cardHover: React.CSSProperties = {
    borderColor: "#FF5B1D",
    boxShadow: "0 2px 12px rgba(255,91,29,0.15)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
      <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
        {/* Photo Ad card */}
        <div
          style={{ ...cardBase, ...(hoveredStyle === "photo_ad" ? cardHover : {}) }}
          onMouseEnter={() => setHoveredStyle("photo_ad")}
          onMouseLeave={() => setHoveredStyle(null)}
          onClick={() => onChoose({ style: "photo_ad" })}
        >
          <div style={{
            width: 200, height: 200, borderRadius: 12, overflow: "hidden",
            background: "#1a1a2e",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img
              src={PHOTO_AD_SAMPLE}
              alt="Photo Ad sample"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                // Fallback if sample image not uploaded yet
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML =
                  '<div style="color:#fff;font-size:13px;text-align:center;padding:20px">AI-generated photo<br/>+ headline overlay</div>';
              }}
            />
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 15 }}>
            Photo Ad
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#666", textAlign: "center" }}>
            AI-generated scene with headline overlay
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChoose({ style: "photo_ad" }); }}
            style={{
              background: "#FF5B1D", color: "#fff", border: "none",
              borderRadius: 9999, padding: "8px 24px", cursor: "pointer",
              fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 14,
            }}
          >
            Choose
          </button>
        </div>

        {/* Quote Card */}
        <div
          style={{ ...cardBase, ...(hoveredStyle === "quote_card" ? cardHover : {}) }}
          onMouseEnter={() => setHoveredStyle("quote_card")}
          onMouseLeave={() => setHoveredStyle(null)}
          onClick={() => onChoose({ style: `quote_card:${selectedPalette.key}` })}
        >
          <QuoteCardPreview headline={headline || "Your headline here"} bg={selectedPalette.bg} accent={selectedPalette.accent} />
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 15 }}>
            Quote Card
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#666", textAlign: "center" }}>
            Clean text on branded background
          </div>
          {/* Palette swatches */}
          <div style={{ display: "flex", gap: 6 }}>
            {PALETTES.map(p => (
              <div
                key={p.key}
                title={p.label}
                onClick={(e) => { e.stopPropagation(); setSelectedPalette(p); }}
                style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: p.bg, cursor: "pointer",
                  border: p.key === selectedPalette.key ? "2px solid #FF5B1D" : "2px solid transparent",
                  transition: "border-color 0.15s",
                }}
              />
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChoose({ style: `quote_card:${selectedPalette.key}` }); }}
            style={{
              background: "#FF5B1D", color: "#fff", border: "none",
              borderRadius: 9999, padding: "8px 24px", cursor: "pointer",
              fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 14,
            }}
          >
            Choose
          </button>
        </div>

        {/* Notification Mockup */}
        <div
          style={{ ...cardBase, ...(hoveredStyle === "notification" ? cardHover : {}) }}
          onMouseEnter={() => setHoveredStyle("notification")}
          onMouseLeave={() => setHoveredStyle(null)}
          onClick={() => onChoose({ style: `notification:${notifPalette.key}` })}
        >
          <NotificationPreview headline={headline || "Your headline here"} bg={notifPalette.bg} accent={notifPalette.accent} />
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 15 }}>
            Notification
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#666", textAlign: "center" }}>
            Looks like a real phone alert
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {PALETTES.map(p => (
              <div
                key={p.key}
                title={p.label}
                onClick={(e) => { e.stopPropagation(); setNotifPalette(p); }}
                style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: p.bg, cursor: "pointer",
                  border: p.key === notifPalette.key ? "2px solid #FF5B1D" : "2px solid transparent",
                  transition: "border-color 0.15s",
                }}
              />
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChoose({ style: `notification:${notifPalette.key}` }); }}
            style={{
              background: "#FF5B1D", color: "#fff", border: "none",
              borderRadius: 9999, padding: "8px 24px", cursor: "pointer",
              fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 14,
            }}
          >
            Choose
          </button>
        </div>
      </div>
    </div>
  );
}
