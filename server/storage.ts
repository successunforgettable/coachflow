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

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  ensureConfigured();

  const publicId = sanitizePublicId(relKey);
  const url = cloudinary.url(publicId, { secure: true });

  return { key: relKey, url };
}
