/**
 * ZERO-COST MEASUREMENT — how far does the compositor's text block actually reach?
 *
 * No image API is called. A flat synthetic plate is pushed through the REAL
 * `renderAdCreative(..., zone: "lower")` at worst-case content (3-line headline + full body + CTA),
 * and the output is scanned for the topmost glyph pixel.
 *
 * WHY THIS EXISTS: Fix 3 failed because the scene's reserved band and the compositor's text block
 * were two independent English sentences that happened to disagree. The research's safe-zone figures
 * ([SEPARATION §3], [COHERENCE §4]) describe META'S UI clearance, not our own type. Only the
 * compositor can answer how much canvas our type consumes.
 *
 * RATIO-INVARIANCE IS THE POINT OF THE 9:16 ROWS. `makeVertical` shares this code. If the fraction
 * differs between 4:5 and 9:16, a single exported scalar would silently mis-reserve the vertical
 * path, and the reserved value must be derived from the canvas instead.
 *
 * Plate is mid-dark grey. The scrim only ever DARKENS; headline/CTA are white and gold. So the
 * topmost pixel markedly BRIGHTER than the plate is the first glyph, and the topmost pixel markedly
 * DARKER than the plate is the top of the scrim.
 */
import sharp from "sharp";
import { appendFileSync, writeFileSync } from "fs";

const LOG = "/private/tmp/claude-501/-Users-arfeenkhan-zap-deploy/6155d573-7bd3-4107-bb81-b6658d20cbc6/scratchpad/safezone.log";
writeFileSync(LOG, "");
const log = (m: string) => { console.log(m); appendFileSync(LOG, `${m}\n`); };

const PLATE = { r: 64, g: 64, b: 64 };
const CANVASES: [string, number, number][] = [
  ["4:5   1024x1280", 1024, 1280],
  ["4:5   1440x1800", 1440, 1800],
  ["1:1   1024x1024", 1024, 1024],
  ["9:16  1080x1920", 1080, 1920],
];

// Worst case the compositor can be handed: a headline that wraps to three lines, a full body, a CTA.
const MAX_CONTENT = {
  headline: "The one repeatable planning method that finally survives a normal working week",
  emphasis: "finally survives",
  bodyText: "A repeatable way to lay the whole year out on a single surface, so the plan still holds when the week gets busy.",
  ctaLabel: "Get the method",
  zone: "lower" as const,
};

(async () => {
  const { renderAdCreative } = await import("../server/_core/compositeHeadline");
  log("canvas               textTop   textFrac   scrimTop  scrimFrac   reservedFrac(1-scrimFrac)");
  log("-".repeat(88));
  const results: { label: string; textFrac: number; scrimFrac: number }[] = [];

  for (const [label, W, H] of CANVASES) {
    const plate = await sharp({
      create: { width: W, height: H, channels: 3, background: PLATE },
    }).png().toBuffer();

    const out = await renderAdCreative(plate, MAX_CONTENT);
    const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;

    let textTop = -1, scrimTop = -1;
    for (let y = 0; y < info.height && (textTop < 0 || scrimTop < 0); y++) {
      let bright = 0, dark = 0;
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * ch;
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum > 150) bright++;          // white/gold glyph against a 64-grey plate
        if (lum < PLATE.r - 6) dark++;    // scrim gradient
      }
      // A handful of stray pixels is antialiasing; require a real run of them.
      if (textTop < 0 && bright >= 6) textTop = y;
      if (scrimTop < 0 && dark >= Math.round(info.width * 0.5)) scrimTop = y;
    }

    const textFrac = textTop / info.height;
    const scrimFrac = scrimTop / info.height;
    results.push({ label, textFrac, scrimFrac });
    log(
      `${label.padEnd(20)} ${String(textTop).padStart(5)}   ${textFrac.toFixed(4)}    ` +
      `${String(scrimTop).padStart(6)}   ${scrimFrac.toFixed(4)}     ${(1 - scrimFrac).toFixed(4)}`,
    );
  }

  // ── IS IT RATIO-INVARIANT? ──────────────────────────────────────────────────
  log("\n--- ratio-invariance check ---");
  const fracs = results.map((r) => r.textFrac);
  const spread = Math.max(...fracs) - Math.min(...fracs);
  log(`textFrac spread across all canvases : ${spread.toFixed(4)}`);
  const s45 = results.filter((r) => r.label.startsWith("4:5")).map((r) => r.textFrac);
  log(`4:5 at two SIZES (size-invariance)  : ${s45.map((f) => f.toFixed(4)).join(" vs ")} — diff ${Math.abs(s45[0] - s45[1]).toFixed(4)}`);
  const f45 = results.find((r) => r.label.startsWith("4:5"))!.textFrac;
  const f916 = results.find((r) => r.label.startsWith("9:16"))!.textFrac;
  log(`4:5 vs 9:16 (RATIO-invariance)      : ${f45.toFixed(4)} vs ${f916.toFixed(4)} — diff ${Math.abs(f45 - f916).toFixed(4)}`);
  log(
    Math.abs(f45 - f916) <= 0.02
      ? "\nVERDICT: ratio-INVARIANT within 2pp — a single exported scalar is safe."
      : "\nVERDICT: NOT ratio-invariant — the reserved value must be DERIVED FROM THE CANVAS, not a scalar.",
  );
  process.exit(0);
})().catch((e) => { log(`FATAL ${e instanceof Error ? e.message : e}`); process.exit(2); });
