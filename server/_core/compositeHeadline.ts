import { Resvg, ResvgRenderOptions } from "@resvg/resvg-js";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// resvg does NOT support embedded <image> data URIs — it is a pure SVG renderer.
// Strategy: use resvg to render ONLY the text bar (black rect + white text),
// then use sharp to composite the resulting PNG bar onto the background image.
// sharp's composite() is PNG-on-PNG via libvips — no librsvg, no font system dependency.

const FONT_PATH = path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function compositeHeadline(
  rawBuffer: Buffer,
  headline: string,
  designStyle: string
): Promise<Buffer> {
  // Read actual background dimensions — Flux output may not be exactly 1080×1080.
  // The bar MUST match the background width exactly or sharp will throw
  // "Image to composite must have same dimensions or smaller".
  const bgMeta = await sharp(rawBuffer).metadata();
  const bgW = bgMeta.width  ?? 1080;
  const bgH = bgMeta.height ?? 1080;

  // Scale bar height proportionally if image isn't 1080px tall
  const BAR_H = Math.round(200 * (bgH / 1080));
  // Font size scales with bar height so text fills the bar
  const fontSize = Math.round(72 * (bgH / 1080));

  const escaped = escapeXml(headline);

  // Step 1: render the text bar SVG → PNG using resvg + bundled TTF.
  // This SVG contains ONLY geometry and text — no embedded images — which resvg handles fully.
  const barSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bgW}" height="${BAR_H}" viewBox="0 0 ${bgW} ${BAR_H}">
  <rect x="0" y="0" width="${bgW}" height="${BAR_H}" fill="black"/>
  <text
    x="${bgW / 2}"
    y="${BAR_H / 2}"
    font-family="DejaVu Sans"
    font-weight="bold"
    font-size="${fontSize}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
  >${escaped}</text>
</svg>`;

  const opts: ResvgRenderOptions = {
    font: {
      loadSystemFonts: false, // only our bundled TTF — zero system font dependency
      fontFiles: [FONT_PATH],
    },
  };

  const resvg = new Resvg(barSvg, opts);
  const rendered = resvg.render();
  const barPng = Buffer.from(rendered.asPng());

  // Step 2: composite the bar PNG onto the background image using sharp.
  // sharp.composite() is PNG-on-PNG via libvips — does NOT invoke librsvg.
  // Bar vertical position: top for screenshot, centre for object, bottom for person styles
  const top =
    designStyle === "screenshot" ? 0 :
    designStyle === "object"     ? Math.round((bgH - BAR_H) / 2) :
    bgH - BAR_H; // south — person_shocked, person_intense, person_curious

  const composited = await sharp(rawBuffer)
    .composite([{ input: barPng, top, left: 0 }])
    .png()
    .toBuffer();

  return composited;
}
