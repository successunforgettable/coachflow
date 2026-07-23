// Cloudinary storage helpers — replaces Manus/Forge storage proxy
// Permanent public URLs, no expiry, free tier: 25GB

import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

function ensureConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary credentials not set: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

function sanitizePublicId(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\//g, "_");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  ensureConfigured();

  const publicId = sanitizePublicId(relKey);
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  const result = await new Promise<any>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "auto",
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });

  return { key: relKey, url: result.secure_url };
}

// Delete a stored asset (used by the E2E bonus teardown so a prod smoke run leaves no hosted PDF).
// PDFs uploaded with resource_type:auto land as "image" in Cloudinary; try that then "raw". Idempotent.
export async function storageDelete(relKey: string): Promise<void> {
  ensureConfigured();
  const publicId = sanitizePublicId(relKey);
  for (const resource_type of ["image", "raw"] as const) {
    try {
      const r = await cloudinary.uploader.destroy(publicId, { resource_type, invalidate: true });
      if (r?.result === "ok") return;
    } catch { /* try next resource_type */ }
  }
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  ensureConfigured();

  const publicId = sanitizePublicId(relKey);
  const url = cloudinary.url(publicId, { secure: true });

  return { key: relKey, url };
}
