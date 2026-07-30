/**
 * Renderer selection for the hybrid image switch.
 *
 * The decision has to be made in ONE place, because the same five-slot loop is
 * written out at three call sites and the 2026-07-30 site sweep showed that
 * per-site wiring is exactly what drifts (P8 rotation and the P6 subject
 * resolver each landed on some loops and missed others while STATE.md recorded
 * them as universal). rendererForStyle is that one place; these tests pin it.
 */
import { describe, it, expect } from "vitest";
import { rendererForStyle } from "./imageGeneration";
import { AD_VARIATIONS } from "./adVariations";

describe("rendererForStyle", () => {
  it("routes the two still-life slots to gpt-image-1 at 1:1", () => {
    expect(rendererForStyle("object", "1:1")).toBe("gpt-image-1");
    expect(rendererForStyle("screenshot", "1:1")).toBe("gpt-image-1");
  });

  it("keeps all three person slots on flux-1.1-pro", () => {
    expect(rendererForStyle("person_shocked", "1:1")).toBe("flux-1.1-pro");
    expect(rendererForStyle("person_intense", "1:1")).toBe("flux-1.1-pro");
    expect(rendererForStyle("person_curious", "1:1")).toBe("flux-1.1-pro");
  });

  it("defaults the aspect ratio to 1:1 when omitted", () => {
    expect(rendererForStyle("object")).toBe("gpt-image-1");
  });

  it("forces vertical back to flux — gpt-image-1 cannot render 9:16", () => {
    // gpt-image-1 offers 1024x1024 / 1024x1536 / 1536x1024 only. makeVertical
    // asks for "9:16", so it must stay on Flux; enforced here rather than left
    // for a call site to remember.
    expect(rendererForStyle("object", "9:16")).toBe("flux-1.1-pro");
    expect(rendererForStyle("screenshot", "9:16")).toBe("flux-1.1-pro");
  });

  it("falls back to flux for an unknown or absent style", () => {
    // The legacy call sites pass no style at all. They must render exactly as
    // they did before the switch.
    expect(rendererForStyle(undefined)).toBe("flux-1.1-pro");
    expect(rendererForStyle("")).toBe("flux-1.1-pro");
    expect(rendererForStyle("desk_focus", "1:1")).toBe("flux-1.1-pro");
  });

  it("moves exactly 2 of the 5 canonical slots", () => {
    // The latency and cost arithmetic in the switch decision depends on this
    // being two, not three or five: ~24s added per campaign, cost neutral.
    const moved = AD_VARIATIONS.filter((v) => rendererForStyle(v.style, "1:1") === "gpt-image-1");
    expect(moved.map((v) => v.style)).toEqual(["screenshot", "object"]);
  });
});
