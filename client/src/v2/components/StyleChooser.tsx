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
// A real generated photo-ad from the production pipeline (kit 140, variation 1)
const PHOTO_AD_SAMPLE = "https://res.cloudinary.com/dunshei0y/image/upload/v1781629783/ad-creatives_1_batch-1781629772360-327f2ba7_variation-1.png.png";
const EDITORIAL_SAMPLE = "https://res.cloudinary.com/dunshei0y/image/upload/v1783272342/comparison_editorial-proof-1783272341278.png.png";

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
  /** Real testimonial quote for the testimonial card preview. Null = no testimonials, card hidden. */
  testimonialQuote?: { quote: string; name: string; title?: string } | null;
  onChoose: (choice: StyleChoice) => void;
}

// ── Live canvas preview for testimonial card ──

function TestimonialPreview({ quote, name, bg, accent }: { quote: string; name: string; bg: string; accent: string }) {
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

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Quote text — centered, white, italic feel via curly quotes
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "center";
    ctx.font = "bold 11px sans-serif";

    const text = `\u201C${quote}\u201D`;
    const maxWidth = W - 28;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else { line = test; }
    }
    if (line) lines.push(line);

    const lineHeight = 14;
    const blockH = Math.min(lines.length, 6) * lineHeight;
    const startY = (H - blockH - 30) / 2;

    lines.slice(0, 6).forEach((l, i) => {
      ctx.fillText(l, W / 2, startY + lineHeight * (i + 0.5), maxWidth);
    });

    // Divider
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(W * 0.3, startY + blockH + 6, W * 0.4, 1.5);
    ctx.globalAlpha = 1;

    // Name
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(name, W / 2, startY + blockH + 22);
  }, [quote, name, bg, accent]);

  return <canvas ref={canvasRef} style={{ width: 200, height: 200, borderRadius: 12 }} />;
}

// ── Live canvas preview for comparison card (✗/✓ us-vs-them) ──

function ComparisonPreview({ bg }: { bg: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 200, H = 200;
    canvas.width = W; canvas.height = H;

    // Premium dark card (gold-on-dark editorial register)
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#D4A24A"; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, W, 2); ctx.globalAlpha = 1;

    // Two-tier headline: prefix (near-white) + method (gold)
    ctx.textAlign = "center";
    ctx.fillStyle = "#F6F1E6";
    ctx.font = "italic bold 11px Georgia, serif";
    ctx.fillText("The old way vs.", W / 2, 24);
    ctx.fillStyle = "#D4A24A";
    ctx.font = "italic bold 16px Georgia, serif";
    ctx.fillText("Your Method", W / 2, 42);
    ctx.fillStyle = "#D4A24A"; ctx.fillRect(W / 2 - 20, 50, 40, 2);

    // Column headers (gold)
    const hY = 68;
    ctx.font = "bold 8px sans-serif"; ctx.fillStyle = "#D4A24A";
    ctx.fillText("OLD WAY", 56, hY); ctx.fillText("WITH YOU", 148, hY);
    // Gold divider
    ctx.fillStyle = "#D4A24A"; ctx.globalAlpha = 0.55;
    ctx.fillRect(W / 2 - 1, hY + 8, 2, 108); ctx.globalAlpha = 1;

    // Rows
    const rowsY = hY + 24;
    for (let i = 0; i < 3; i++) {
      const y = rowsY + i * 34;
      // ✗ disc left
      ctx.fillStyle = "#E05A3F"; ctx.beginPath(); ctx.arc(22, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(18, y - 4); ctx.lineTo(26, y + 4); ctx.moveTo(26, y - 4); ctx.lineTo(18, y + 4); ctx.stroke();
      ctx.fillStyle = "#B4AC9C"; ctx.fillRect(36, y - 4, 52, 3); ctx.fillRect(36, y + 2, 34, 3);
      // ✓ disc right
      ctx.fillStyle = "#33A867"; ctx.beginPath(); ctx.arc(114, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(110, y + 1); ctx.lineTo(113, y + 4); ctx.lineTo(119, y - 3); ctx.stroke();
      ctx.fillStyle = "#F4EFE4"; ctx.fillRect(128, y - 4, 52, 3); ctx.fillRect(128, y + 2, 34, 3);
    }
  }, [bg]);
  return <canvas ref={canvasRef} style={{ width: 200, height: 200, borderRadius: 12 }} />;
}

export default function StyleChooser({ headline, testimonialQuote, onChoose }: StyleChooserProps) {
  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0]);
  const [notifPalette, setNotifPalette] = useState(PALETTES[1]); // default Navy for notification
  const [testimonialPalette, setTestimonialPalette] = useState(PALETTES[4]); // default Burgundy
  const [comparisonPalette, setComparisonPalette] = useState(PALETTES[0]); // default Charcoal (premium near-black)
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
                  '<div style="color:#fff;font-size:13px;text-align:center;padding:20px">Photo scene with<br/>your headline on it</div>';
              }}
            />
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 15 }}>
            Photo Ad
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#666", textAlign: "center" }}>
            A real-looking photo with your headline on it
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

        {/* Editorial Ad card (Stage 3 — gold-on-black flux-2, zone-aware text) */}
        <div
          style={{ ...cardBase, ...(hoveredStyle === "editorial" ? cardHover : {}) }}
          onMouseEnter={() => setHoveredStyle("editorial")}
          onMouseLeave={() => setHoveredStyle(null)}
          onClick={() => onChoose({ style: "editorial" })}
        >
          <div style={{
            width: 200, height: 200, borderRadius: 12, overflow: "hidden",
            background: "#0A0A0E",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img
              src={EDITORIAL_SAMPLE}
              alt="Editorial ad sample"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML =
                  '<div style="color:#D4A24A;font-size:13px;text-align:center;padding:20px">Cinematic gold-on-black<br/>with your headline</div>';
              }}
            />
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 15 }}>
            Editorial
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#666", textAlign: "center" }}>
            A cinematic gold-on-black shoot with your headline in a clean zone
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChoose({ style: "editorial" }); }}
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
          {/* Palette picker */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "#999", fontWeight: 500 }}>
              Background: {selectedPalette.label}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {PALETTES.map(p => (
                <div
                  key={p.key}
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "#999", fontWeight: 500 }}>
              Background: {notifPalette.label}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {PALETTES.map(p => (
                <div
                  key={p.key}
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

        {/* Testimonial Card — only shown when real testimonials exist */}
        {testimonialQuote && (
        <div
          style={{ ...cardBase, ...(hoveredStyle === "testimonial" ? cardHover : {}) }}
          onMouseEnter={() => setHoveredStyle("testimonial")}
          onMouseLeave={() => setHoveredStyle(null)}
          onClick={() => onChoose({ style: `testimonial:${testimonialPalette.key}` })}
        >
          <TestimonialPreview quote={testimonialQuote.quote} name={testimonialQuote.name} bg={testimonialPalette.bg} accent={testimonialPalette.accent} />
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 15 }}>
            Testimonial
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#666", textAlign: "center" }}>
            Your client's words as the ad
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "#999", fontWeight: 500 }}>
              Background: {testimonialPalette.label}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {PALETTES.map(p => (
                <div
                  key={p.key}
                  onClick={(e) => { e.stopPropagation(); setTestimonialPalette(p); }}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: p.bg, cursor: "pointer",
                    border: p.key === testimonialPalette.key ? "2px solid #FF5B1D" : "2px solid transparent",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChoose({ style: `testimonial:${testimonialPalette.key}` }); }}
            style={{
              background: "#FF5B1D", color: "#fff", border: "none",
              borderRadius: 9999, padding: "8px 24px", cursor: "pointer",
              fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 14,
            }}
          >
            Choose
          </button>
        </div>
        )}

        {/* Comparison Card — designed ✗/✓ us-vs-them checklist, no photo */}
        <div
          style={{ ...cardBase, ...(hoveredStyle === "comparison_card" ? cardHover : {}) }}
          onMouseEnter={() => setHoveredStyle("comparison_card")}
          onMouseLeave={() => setHoveredStyle(null)}
          onClick={() => onChoose({ style: `comparison_card:${comparisonPalette.key}` })}
        >
          <ComparisonPreview bg={comparisonPalette.bg} />
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontWeight: 600, fontSize: 15 }}>
            Comparison
          </div>
          <div style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#666", textAlign: "center" }}>
            The old way vs. your offer, side by side
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "#999", fontWeight: 500 }}>
              Header: {comparisonPalette.label}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {PALETTES.map(p => (
                <div
                  key={p.key}
                  onClick={(e) => { e.stopPropagation(); setComparisonPalette(p); }}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: p.bg, cursor: "pointer",
                    border: p.key === comparisonPalette.key ? "2px solid #FF5B1D" : "2px solid transparent",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChoose({ style: `comparison_card:${comparisonPalette.key}` }); }}
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
      <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "#999", margin: 0, textAlign: "center" }}>
        These are previews — your final images will be full-size and high quality.
      </p>
    </div>
  );
}
