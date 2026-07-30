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
const STILL_LIFE_STYLES: ReadonlySet<string> = new Set(["object", "screenshot"]);

export function rendererForStyle(style?: string, aspectRatio?: string): ImageRenderer {
  if (!style || !STILL_LIFE_STYLES.has(style)) return "flux-1.1-pro";
  const ratio = aspectRatio ?? "1:1";
  if (ratio !== "1:1") return "flux-1.1-pro";
  return "gpt-image-1";
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
async function renderOpenAI(prompt: string): Promise<Buffer> {
  const apiKey = ENV.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const attempt = async (): Promise<{ buffer?: Buffer; status: number; detail: string }> => {
    const resp = await fetch(OPENAI_IMAGE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
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
      const buffer = await renderOpenAI(options.prompt);
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
