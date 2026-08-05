import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { renderAdCreative, textSafeZoneFor, reservedBandWording } from "./_core/compositeHeadline";
import { generateAdImagePrompt } from "./routers/adCreatives";
import { emittedCanvasFor } from "./_core/imageGeneration";

/**
 * THE COUPLING TEST. This is the regression guard for the 2026-08-05 Fix-3 failure, where the photo
 * prompt reserved a band in English and the compositor reserved a different band in pixels, and the
 * finished ad laid its headline across the work surface the scene had been told to keep clear.
 *
 * It renders a flat synthetic plate through the REAL compositor at worst-case content and measures
 * the topmost glyph. No image API is called, so this is free and deterministic.
 *
 * 9:16 IS TESTED ALONGSIDE 4:5 DELIBERATELY. `makeVertical` shares this code, and the reservation is
 * NOT ratio-invariant (measured 5.7pp apart), so a change that fixed 4:5 while breaking the vertical
 * path would otherwise pass unnoticed.
 */

const PLATE = { r: 64, g: 64, b: 64 };
const MAX_CONTENT = {
  headline: "The one repeatable planning method that finally survives a normal working week",
  emphasis: "finally survives",
  bodyText: "A repeatable way to lay the whole year out on a single surface, so the plan still holds when the week gets busy.",
  ctaLabel: "Get the method",
  zone: "lower" as const,
};

/** Topmost row carrying glyph pixels — white/gold type against a 64-grey plate. */
async function measureTextTopFrac(W: number, H: number): Promise<number> {
  const plate = await sharp({ create: { width: W, height: H, channels: 3, background: PLATE } }).png().toBuffer();
  const out = await renderAdCreative(plate, MAX_CONTENT);
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) {
    let bright = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 > 150) bright++;
    }
    if (bright >= 6) return y / info.height;
  }
  return 1;
}

const CANVASES: [string, number, number, string][] = [
  ["4:5", 1024, 1280, "4:5"],
  ["9:16", 1080, 1920, "9:16"],
  ["1:1", 1024, 1024, "1:1"],
];

describe("text-safe zone — the compositor and the photo prompt share ONE definition", () => {
  for (const [label, W, H] of CANVASES) {
    it(`${label} — the predicted zone matches what the compositor actually renders`, async () => {
      const measured = await measureTextTopFrac(W, H);
      const predicted = textSafeZoneFor(W, H).textTopFrac;
      // Two pixels of tolerance on the smallest canvas is ~0.002.
      expect(Math.abs(predicted - measured)).toBeLessThan(0.01);
    }, 30_000);

    it(`${label} — the RESERVED band covers the compositor's real reach`, async () => {
      // The actual guarantee: whatever the scene is told to keep clear must start at or above where
      // the compositor begins writing. If the compositor ever out-reaches the reservation, fail.
      const measured = await measureTextTopFrac(W, H);
      const { reservedFrac } = textSafeZoneFor(W, H);
      const reservationStartsAt = 1 - reservedFrac;
      expect(reservationStartsAt).toBeLessThanOrEqual(measured);
    }, 30_000);
  }

  it("is NOT ratio-invariant — which is why the reservation is derived, never a scalar", () => {
    const f45 = textSafeZoneFor(1024, 1280).reservedFrac;
    const f916 = textSafeZoneFor(1080, 1920).reservedFrac;
    expect(Math.abs(f45 - f916)).toBeGreaterThan(0.02);
  });

  it("is size-invariant WITHIN a ratio — 1024x1280 and 1440x1800 agree", () => {
    const a = textSafeZoneFor(1024, 1280).reservedFrac;
    const b = textSafeZoneFor(1440, 1800).reservedFrac;
    expect(Math.abs(a - b)).toBeLessThan(0.005);
  });

  it("the photo prompt quotes the band for the EMITTED canvas, not the nominal ratio", () => {
    for (const [, , , ratio] of CANVASES) {
      for (const style of ["person_intense", "screenshot"]) {
        const [W, H] = emittedCanvasFor(style, ratio);
        const prompt = generateAdImagePrompt(style, "n", "p", false, undefined, "solution_aware", "grounded", ratio);
        expect(prompt).toContain(reservedBandWording(W, H));
      }
    }
  });

  it("THE NEAR-MISS GUARD: the two renderers on the SAME nominal 4:5 reserve differently", () => {
    // Flux answers "4:5" with 896x1088 (0.824); gpt-image-1 with a true 1024x1280 (0.800). Those
    // straddle a band boundary, so keying off the ratio STRING under-reserved the person slots by
    // ~1pp on 2026-08-06. If someone collapses these back to one canvas, this fails.
    const [fw, fh] = emittedCanvasFor("person_intense", "4:5");
    const [gw, gh] = emittedCanvasFor("screenshot", "4:5");
    expect([fw, fh]).toEqual([896, 1088]);
    expect([gw, gh]).toEqual([1024, 1280]);
    expect(reservedBandWording(fw, fh)).not.toBe(reservedBandWording(gw, gh));
  });

  it("an UNMEASURED renderer/ratio pair falls back conservatively, never optimistically", () => {
    // flux@9:16 has never been measured. It must not silently borrow the 4:5 figure.
    const [W, H] = emittedCanvasFor("person_intense", "9:16");
    expect([W, H]).toEqual([1024, 1024]);
    expect(reservedBandWording(W, H)).toBe("the lower three-fifths"); // the widest band we issue
  });
});
