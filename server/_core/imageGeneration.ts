/**
 * Image generation helper using Replicate API (flux-1.1-pro)
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 */
import { storagePut } from "server/storage";
import Replicate from "replicate";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  aspectRatio?: string;      // "1:1" (default, feed) | "9:16" (vertical) | …
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /**
   * The ad-creative variation style for this slot. Drives renderer selection —
   * see rendererForStyle. Omitted (the legacy call sites) renders on Flux,
   * which is exactly what those sites did before.
   */
  style?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

export type ImageRenderer = "flux-1.1-pro" | "gpt-image-1";

/**
 * ─── THE HYBRID SWITCH ──────────────────────────────────────────────────────
 * Still-life slots render on gpt-image-1; anything with a person stays on Flux.
 *
 * Evidence — 6-niche still-life bake-off, 2026-07-30 (commit d3d7312, images in
 * docs/screenshots/run-2026-07-30-niches/). On the `object` style:
 *
 *   niche relevance   gpt-image-1 medium 6/6   ·   flux-1.1-pro 2/6
 *   house style       gpt-image-1 medium 6/6   ·   flux-1.1-pro 3/6
 *   latency (median)  gpt-image-1 medium 18.2s ·   flux-1.1-pro 6.1s
 *
 * Both of Flux's two "hits" carried a defect (a garbled brand name; a hand in
 * frame on a person-free style), and its four misses were generic stock props —
 * a pink flat-lay with earbuds for strength training, a floral flat-lay for
 * reactive dogs. The house-style column is the one that actually forces this:
 * compositeHeadline paints a FIXED #0A0A0E scrim and never inspects the plate,
 * so a bright plate is a legibility failure, not merely an aesthetic one.
 *
 * Person slots stay on Flux deliberately: casting was a 15/15 tie across models
 * and Flux is ~3× faster, so moving them would buy nothing and cost ~36s.
 * Two of five slots move ⇒ ~24s added per campaign. Cost is neutral
 * ($0.042 vs $0.040 per five-creative deck).
 *
 * ⚠️ 1:1 ONLY. gpt-image-1 renders 1024x1024 / 1024x1536 / 1536x1024 and cannot
 * produce 9:16. adCreatives.makeVertical asks for "9:16", so it stays on Flux —
 * enforced here rather than left for a call site to remember.
 */
// `object` was retired from the tabloid deck on 2026-08-01 (see
// _core/adVariations.ts). The set itself is LOAD-BEARING and stays — `screenshot`
// depends on it for gpt-image-1 routing, and deleting the set would silently
// drop the surviving still life back onto Flux.
const STILL_LIFE_STYLES: ReadonlySet<string> = new Set(["screenshot"]);

/**
 * ⚠️ WIDENED 2026-08-06 to keep the still life on gpt-image-1 at 4:5.
 *
 * gpt-image-1 emits ONLY 1024x1024, 1024x1536 and 1536x1024 — 4:5 does not exist on it (verified
 * against the API). The previous rule bounced every non-1:1 request to Flux, so moving the feed to
 * 4:5 would have silently moved the still life off the model the bake-off chose (6/6 vs 2/6 on niche
 * relevance) without anyone noticing. Instead 4:5 is served by rendering its legal 2:3 (1024x1536)
 * and cropping to 1024x1280 — full width, no upscaling, no quality loss.
 *
 * 9:16 still has no gpt-image-1 equivalent and correctly stays on Flux.
 */
const GPT_IMAGE_RATIOS: ReadonlySet<string> = new Set(["1:1", "4:5"]);

export function rendererForStyle(style?: string, aspectRatio?: string): ImageRenderer {
  if (!style || !STILL_LIFE_STYLES.has(style)) return "flux-1.1-pro";
  return GPT_IMAGE_RATIOS.has(aspectRatio ?? "1:1") ? "gpt-image-1" : "flux-1.1-pro";
}

/** Which gpt-image-1 size to ask for, and what to crop it down to. */
export function openAiPlanFor(aspectRatio?: string): { size: string; crop?: { w: number; h: number } } {
  return (aspectRatio ?? "1:1") === "4:5"
    ? { size: "1024x1536", crop: { w: 1024, h: 1280 } }
    : { size: "1024x1024" };
}

/**
 * Which 256px band to discard when cropping 1024x1536 down to 4:5.
 * ✅ SETTLED 2026-08-06 ON PIXELS, not argument. One 1024x1536 plate was rendered and BOTH crops
 * emitted side by side (docs/screenshots/run-2026-08-06-layer3-45/08-crop-A vs 08-crop-B).
 *   A ("top", keep lower 1280) pushed the laptop and paper stack hard against the top edge and left
 *     over half the frame as empty tabletop — cramped and top-heavy.
 *   B ("bottom", keep upper 1280) kept the composed headroom AND still left a clean lower third.
 * B discards dead space; A discarded composition. Arfeen's call, taken on the two images.
 */
export type CropDirection = "top" | "bottom" | "center";
export const DEFAULT_CROP_DIRECTION: CropDirection = "bottom";

/**
 * WHAT EACH RENDERER ACTUALLY EMITS — measured, not inferred from the ratio string.
 *
 * ⚠️ THIS EXISTS BECAUSE OF A NEAR-MISS. The 2026-08-06 run asked Flux for "4:5" and got
 * 896x1088 — ratio 0.824, NOT 0.800. gpt-image-1 returns a true 1024x1280. The prompt builder had
 * assumed 1024x1280 for both, so the three person slots were prompted with a band ~1pp SMALLER than
 * their canvas needed. The composite happened to come out clean, but on margin rather than by
 * design, and the two values straddle a band boundary ("lower half" vs "lower three-fifths").
 *
 * Flux is NOT forced to an exact 4:5 — 896x1088 is a valid Meta feed asset. We reserve against what
 * it really emits instead of what we asked for.
 */
export const EMITTED_CANVAS: Record<string, readonly [number, number]> = {
  "flux-1.1-pro|1:1": [1024, 1024],   // measured
  "flux-1.1-pro|4:5": [896, 1088],    // MEASURED 2026-08-06 — the near-miss above
  "gpt-image-1|1:1": [1024, 1024],    // API-fixed
  "gpt-image-1|4:5": [1024, 1280],    // API-fixed 1024x1536, cropped here
};

/**
 * The canvas a slot will actually be rendered on.
 *
 * ⚠️ flux@9:16 is DELIBERATELY ABSENT and therefore takes the conservative fallback. Flux's real
 * 9:16 emission has never been measured, and guessing it is exactly the mistake this map exists to
 * correct. Over-reserving costs a little composition freedom; under-reserving puts type on content.
 * `makeVertical` passes no awareness stage today, so it takes the legacy path and never reads this —
 * but that must be measured before any stage-led 9:16 ships.
 */
export function emittedCanvasFor(style: string | undefined, aspectRatio?: string | null): readonly [number, number] {
  const ratio = aspectRatio ?? "1:1";
  const key = `${rendererForStyle(style, ratio)}|${ratio}`;
  return EMITTED_CANVAS[key] ?? [1024, 1024]; // conservative: the widest reservation we know
}

export async function cropToAspect(buf: Buffer, w: number, h: number, from: CropDirection = DEFAULT_CROP_DIRECTION): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(buf).metadata();
  const H = meta.height ?? h;
  if ((meta.width ?? w) === w && H === h) return buf;
  const top = from === "top" ? H - h : from === "bottom" ? 0 : Math.round((H - h) / 2);
  return sharp(buf).extract({ left: 0, top: Math.max(0, top), width: w, height: h }).png().toBuffer();
}

/**
 * ─── THE OPENAI FAILURE PATH — A DECISION, NOT A try/catch ──────────────────
 *
 *   On any OpenAI failure the slot RE-RENDERS ON FLUX and the deck stays at five.
 *
 * Why fallback rather than failing the slot: a deck missing 2 of 5 is worse for
 * the coach than two slightly weaker images. It is also what STANDING RULE 1
 * requires — an ad-creative slot is a required TYPE in a five-deck, not an
 * interchangeable variant, so the disposition is screen-and-log, never drop.
 *
 * Retry policy is deliberately asymmetric:
 *   - 429 / 5xx / network  → ONE retry, then Flux. These are transient.
 *   - 4xx (moderation, malformed) → NO retry, straight to Flux. Deterministic:
 *     the identical request will fail identically, so a retry only adds latency.
 *
 * Every fallback logs FALLBACK_LOG_PREFIX with the style and the reason. The
 * adCreatives table has no column recording which model rendered a row, so the
 * log line is currently the only record — a `renderer` column is a migration and
 * migrations stay off logic sprints (CLAUDE.md §5.6). `sceneBrief` is NOT
 * repurposed for it: that column is editorial-scene-typed and overloading it
 * would make the schema lie.
 */
export const FALLBACK_LOG_PREFIX = "[imageGeneration] FALLBACK gpt-image-1 -> flux-1.1-pro";

const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";

/** Renders on gpt-image-1 and returns the PNG bytes. Throws on any failure. */
async function renderOpenAI(prompt: string, aspectRatio?: string): Promise<Buffer> {
  const plan = openAiPlanFor(aspectRatio);
  const apiKey = ENV.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const attempt = async (): Promise<{ buffer?: Buffer; status: number; detail: string }> => {
    const resp = await fetch(OPENAI_IMAGE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: plan.size,
        quality: "medium",
        n: 1,
      }),
    });
    if (!resp.ok) {
      return { status: resp.status, detail: (await resp.text()).slice(0, 300) };
    }
    const json = (await resp.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json?.data?.[0]?.b64_json;
    // OpenAI returns base64 inline, so there is no CDN round-trip to make here —
    // one fewer network hop than the Replicate path.
    if (!b64) return { status: resp.status, detail: "response carried no b64_json" };
    return { buffer: Buffer.from(b64, "base64"), status: resp.status, detail: "" };
  };

  let result = await attempt();
  if (result.buffer) return result.buffer;

  const transient = result.status === 429 || result.status >= 500;
  if (transient) {
    console.warn(
      `[imageGeneration] gpt-image-1 transient failure (${result.status}) — one retry: ${result.detail}`,
    );
    await new Promise((r) => setTimeout(r, 1500));
    result = await attempt();
    if (result.buffer) return result.buffer;
  }

  throw new Error(`gpt-image-1 ${result.status}: ${result.detail}`);
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // ── Hybrid switch: still-life slots on gpt-image-1, everything else on Flux ──
  if (rendererForStyle(options.style, options.aspectRatio) === "gpt-image-1") {
    try {
      const t0 = Date.now();
      const rendered = await renderOpenAI(options.prompt, options.aspectRatio);
      const plan = openAiPlanFor(options.aspectRatio);
      const buffer = plan.crop ? await cropToAspect(rendered, plan.crop.w, plan.crop.h) : rendered;
      console.log(
        `[imageGeneration] gpt-image-1 rendered style=${options.style} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      );
      const { url } = await storagePut(
        `generated/${Date.now()}-${Math.random().toString(36).substring(7)}.png`,
        buffer,
        "image/png",
      );
      return { url };
    } catch (err) {
      // The recorded decision: keep the deck at five, log loudly, render on Flux.
      console.error(`${FALLBACK_LOG_PREFIX} style=${options.style} reason=${String((err as Error)?.message ?? err)}`);
    }
  }

  const apiKey = ENV.replicateApiKey;

  console.log("[imageGeneration] API Key check:", {
    exists: !!apiKey,
    length: apiKey?.length,
    startsWithR8: apiKey?.startsWith("r8_"),
    first10: apiKey?.substring(0, 10)
  });
  
  if (!apiKey) {
    throw new Error("REPLICATE_API_KEY is not configured");
  }

  const replicate = new Replicate({ auth: apiKey });

  // Use flux-1.1-pro model for high-quality ad creatives
  const output = await replicate.run(
    "black-forest-labs/flux-1.1-pro" as any,
    {
      input: {
        prompt: options.prompt,
        aspect_ratio: options.aspectRatio ?? "1:1",
        output_format: "png",
        output_quality: 90,
        safety_tolerance: 2,
        // FIX C (2026-07-29): upsampling OFF. flux-1.1-pro's upsampler rewrites
        // the prompt with an LLM before generation — it dropped the scene
        // constraints and embellished the stated aesthetic. Evidence from the
        // 2026-07-28 run: the "object" style (explicitly "no person in frame")
        // returned a person, and "tabloid aesthetic" was elaborated into a full
        // newsprint page. We now send the prompt we actually wrote.
        prompt_upsampling: false,
      },
    }
  ) as any;

  // Replicate returns FileOutput objects
  console.log("[imageGeneration] Replicate output type:", typeof output, Array.isArray(output));
  
  // Handle different output formats:
  // - FileOutput object with url() method
  // - Array of FileOutput objects: output[0].url()
  // - Direct URL string: output
  let imageUrl: string;
  if (typeof output === "string") {
    imageUrl = output;
  } else if (Array.isArray(output)) {
    // Array of FileOutput objects
    const firstOutput = output[0];
    if (typeof firstOutput === "string") {
      imageUrl = firstOutput;
    } else if (firstOutput && typeof firstOutput.url === "function") {
      imageUrl = firstOutput.url();
    } else if (firstOutput && typeof firstOutput.url === "string") {
      imageUrl = firstOutput.url;
    } else {
      throw new Error("Unexpected FileOutput format in array");
    }
  } else if (output && typeof output === "object") {
    // Single FileOutput object
    if (typeof (output as any).url === "function") {
      imageUrl = (output as any).url();
    } else if (typeof (output as any).url === "string") {
      imageUrl = (output as any).url;
    } else {
      throw new Error("FileOutput object missing url property/method");
    }
  } else {
    throw new Error("Unexpected output format from Replicate");
  }
  
  console.log("[imageGeneration] Extracted imageUrl:", imageUrl);
  
  if (!imageUrl) {
    throw new Error("Failed to generate image: No URL returned from Replicate");
  }

  // Download the image from Replicate
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image from Replicate: ${response.statusText}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());

  // Upload to S3 for permanent storage
  const { url } = await storagePut(
    `generated/${Date.now()}-${Math.random().toString(36).substring(7)}.png`,
    imageBuffer,
    "image/png"
  );

  return { url };
}

// ─── Stage 3: editorial photo via flux-2-pro ─────────────────────────────────
// Separate from generateImage (which stays on flux-1.1-pro for the tabloid
// style, unchanged). flux-2-pro takes a plain-text prompt, aspect_ratio, and an
// optional input_images array (max 8, image-to-image reference conditioning).
export type GenerateEditorialOptions = {
  prompt: string;
  aspectRatio?: string;      // "1:1" (default), "4:5", "9:16", …
  inputImages?: string[];    // optional reference URLs (max 8) — image-to-image
};

export async function generateEditorialImage(
  options: GenerateEditorialOptions,
): Promise<GenerateImageResponse> {
  const apiKey = ENV.replicateApiKey;
  if (!apiKey) throw new Error("REPLICATE_API_KEY is not configured");
  const replicate = new Replicate({ auth: apiKey });

  const input: Record<string, unknown> = {
    prompt: options.prompt,
    aspect_ratio: options.aspectRatio ?? "1:1",
    output_format: "png",
    output_quality: 90,
    safety_tolerance: 2,
  };
  if (options.inputImages && options.inputImages.length > 0) {
    input.input_images = options.inputImages.slice(0, 8);
  }

  const output = (await replicate.run("black-forest-labs/flux-2-pro" as any, { input })) as any;

  let imageUrl: string;
  if (typeof output === "string") {
    imageUrl = output;
  } else if (Array.isArray(output)) {
    const first = output[0];
    imageUrl = typeof first === "string" ? first : (typeof first?.url === "function" ? first.url() : first?.url);
  } else if (output && typeof output === "object") {
    imageUrl = typeof (output as any).url === "function" ? (output as any).url() : (output as any).url;
  } else {
    throw new Error("Unexpected output format from Replicate (flux-2-pro)");
  }
  if (!imageUrl) throw new Error("flux-2-pro returned no image URL");

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download flux-2 image: ${response.statusText}`);
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const { url } = await storagePut(
    `generated/editorial-${Date.now()}-${Math.random().toString(36).substring(7)}.png`,
    imageBuffer,
    "image/png",
  );
  return { url };
}
