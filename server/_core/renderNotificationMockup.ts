/**
 * renderNotificationMockup — generates a 1080×1080 notification-style ad image.
 *
 * Mimics an iOS notification or Notes-app screenshot. The headline appears
 * as if typed into the user's own phone — stops the scroll because it looks
 * native, not like an ad.
 *
 * No Flux call, no AI imagery, $0 per image, renders in <1s.
 * Reuses the existing opentype.js → resvg-js → sharp pipeline.
 */

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import opentype, { Font } from "opentype.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// ── Font loading (shared pattern with compositeHeadline + renderQuoteCard) ──

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = (() => {
  const candidates = [
    path.resolve(__moduleDir, "../assets/fonts/DejaVuSans-Bold.ttf"),
    path.resolve(__moduleDir, "../../assets/fonts/DejaVuSans-Bold.ttf"),
    path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf"),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? candidates[0];
})();

let cachedFont: Font | null = null;
function getFont(): Font {
  if (cachedFont) return cachedFont;
  const buf = fs.readFileSync(FONT_PATH);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  cachedFont = opentype.parse(arrayBuffer);
  return cachedFont;
}

// ── Palette (reuses the same 5 dark presets — tints the notification chrome) ──

export { QUOTE_CARD_PALETTES as NOTIFICATION_PALETTES } from "./renderQuoteCard";

// ── Text layout ──

function wrapGreedy(font: Font, text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.getAdvanceWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Renderer ──

export interface NotificationMockupOptions {
  headline: string;
  appName?: string; // service name shown as the "app" source
  palette?: string;
}

export async function renderNotificationMockup(options: NotificationMockupOptions): Promise<Buffer> {
  const font = getFont();
  const W = 1080;
  const H = 1080;

  // Import palette from quote card (shared presets)
  const { QUOTE_CARD_PALETTES } = await import("./renderQuoteCard");
  const pal = QUOTE_CARD_PALETTES[options.palette || "charcoal"]
    ?? QUOTE_CARD_PALETTES["charcoal"];

  const appName = options.appName || "Notes";
  const headlineText = options.headline;

  // ── Status bar (top) — time, signal, battery icons ──
  const statusBarY = 45;
  const timeText = "9:41";
  const timeFontSize = 28;
  const timeW = font.getAdvanceWidth(timeText, timeFontSize);
  const timeX = 60;
  const timePath = font.getPath(timeText, timeX, statusBarY, timeFontSize);

  // Signal dots (3 filled + 1 empty)
  const signalX = W - 160;
  const signalDots = [0, 14, 28].map(dx =>
    `<circle cx="${signalX + dx}" cy="${statusBarY - 8}" r="4" fill="white" opacity="0.7" />`
  ).join("\n    ");
  const signalEmpty = `<circle cx="${signalX + 42}" cy="${statusBarY - 8}" r="4" fill="none" stroke="white" stroke-width="1.5" opacity="0.4" />`;

  // Battery icon
  const batX = W - 80;
  const batY = statusBarY - 16;
  const batteryIcon = `<rect x="${batX}" y="${batY}" width="32" height="16" rx="3" fill="none" stroke="white" stroke-width="1.5" opacity="0.7" />
    <rect x="${batX + 3}" y="${batY + 3}" width="22" height="10" rx="1.5" fill="white" opacity="0.7" />
    <rect x="${batX + 32}" y="${batY + 4}" width="3" height="8" rx="1" fill="white" opacity="0.4" />`;

  // ── Notification card ──
  const cardMargin = 60;
  const cardX = cardMargin;
  const cardY = 200;
  const cardW = W - cardMargin * 2;
  const cardRadius = 32;
  const cardBg = "rgba(255,255,255,0.12)";
  const cardBorder = "rgba(255,255,255,0.18)";

  // App icon circle
  const iconR = 22;
  const iconCx = cardX + 40;
  const iconCy = cardY + 42;
  // First letter of app name as icon
  const iconLetter = appName.charAt(0).toUpperCase();
  const iconLetterSize = 22;
  const iconLetterW = font.getAdvanceWidth(iconLetter, iconLetterSize);
  const iconLetterPath = font.getPath(iconLetter, iconCx - iconLetterW / 2, iconCy + iconLetterSize * 0.35, iconLetterSize);

  // App name + "now" label
  const appNameSize = 24;
  const appNameX = cardX + 74;
  const appNameY = cardY + 36;
  const appNamePath = font.getPath(appName.toUpperCase(), appNameX, appNameY, appNameSize);
  const nowSize = 20;
  const nowX = appNameX;
  const nowY = appNameY + 26;
  const nowPath = font.getPath("now", nowX, nowY, nowSize);

  // Headline text inside the card
  const headlineFontSize = 38;
  const headlineMaxW = cardW - 80;
  const headlineLines = wrapGreedy(font, headlineText, headlineMaxW, headlineFontSize);
  const headlineLineHeight = headlineFontSize * 1.25;
  const headlineStartY = cardY + 90;

  const headlinePaths = headlineLines.slice(0, 5).map((line, i) => {
    const x = cardX + 40;
    const y = headlineStartY + headlineLineHeight * (i + 0.85);
    const glyphPath = font.getPath(line, x, y, headlineFontSize);
    return `<path d="${glyphPath.toPathData(2)}" />`;
  }).join("\n    ");

  const headlineBlockH = Math.min(headlineLines.length, 5) * headlineLineHeight;
  const cardH = 90 + headlineBlockH + 40; // header + text + padding

  // ── Subtle home indicator bar (bottom) ──
  const homeBarY = H - 30;
  const homeBar = `<rect x="${W / 2 - 70}" y="${homeBarY}" width="140" height="5" rx="2.5" fill="white" opacity="0.25" />`;

  // ── Assemble SVG ──
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${pal.bg}" />

  <!-- Status bar -->
  <path d="${timePath.toPathData(2)}" fill="white" opacity="0.8" />
  ${signalDots}
  ${signalEmpty}
  ${batteryIcon}

  <!-- Notification card -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRadius}" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1" />

  <!-- App icon -->
  <circle cx="${iconCx}" cy="${iconCy}" r="${iconR}" fill="${pal.accent}" />
  <path d="${iconLetterPath.toPathData(2)}" fill="white" />

  <!-- App name + now -->
  <path d="${appNamePath.toPathData(2)}" fill="white" opacity="0.6" />
  <path d="${nowPath.toPathData(2)}" fill="white" opacity="0.35" />

  <!-- Headline text -->
  <g fill="white">
    ${headlinePaths}
  </g>

  <!-- Home indicator -->
  ${homeBar}
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  const pngData = resvg.render().asPng();

  return sharp(Buffer.from(pngData)).png().toBuffer();
}
