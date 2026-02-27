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

export type GenerateImageOptions = {
  prompt: string;
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
  const apiKey = process.env.REPLICATE_API_KEY;
  
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
        aspect_ratio: "1:1",
        output_format: "png",
        output_quality: 90,
        safety_tolerance: 2,
        prompt_upsampling: true,
      },
    }
  ) as any;

  // Replicate returns a URL to the generated image
  const imageUrl = typeof output === "string" ? output : output.url || output[0];
  
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
