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
  const BAR_W = 1080;
  const BAR_H = 200;

  const escaped = escapeXml(headline);

  // Step 1: render the text bar SVG → PNG using resvg + bundled TTF.
  // This SVG contains ONLY geometry and text — no embedded images — which resvg handles fully.
  const barSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_W}" height="${BAR_H}" viewBox="0 0 ${BAR_W} ${BAR_H}">
  <rect x="0" y="0" width="${BAR_W}" height="${BAR_H}" fill="black"/>
  <text
    x="${BAR_W / 2}"
    y="${BAR_H / 2}"
    font-family="DejaVu Sans"
    font-weight="bold"
    font-size="72"
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
  // sharp.composite() is PNG-on-PNG via libvips — does NOT invoke librsvg,
  // so font rendering on Railway is irrelevant here.
  const bgMeta = await sharp(rawBuffer).metadata();
  const bgH = bgMeta.height ?? 1080;

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
