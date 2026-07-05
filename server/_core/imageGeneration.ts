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
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
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
        prompt_upsampling: true,
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
