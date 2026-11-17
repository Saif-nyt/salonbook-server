import { env } from "../config/env.js";
import { serviceUnavailable } from "../utils/app-error.js";

interface ImgBBResponse {
  data?: {
    url?: string;
    display_url?: string;
    thumb?: { url?: string };
    delete_url?: string;
  };
  success?: boolean;
  error?: { message?: string };
}

export interface UploadedImage {
  url: string;
  thumbnailUrl: string | null;
  deleteUrl: string | null;
}

export async function uploadImageToImgBB(
  buffer: Buffer,
  mimeType: string,
): Promise<UploadedImage> {
  if (!env.IMGBB_API_KEY) {
    throw serviceUnavailable("Image uploads are not configured on this server");
  }

  const form = new FormData();
  form.append("image", buffer.toString("base64"));
  form.append("name", `salonbook-${Date.now()}`);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`,
    {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    },
  );

  const payload = (await response.json().catch(() => null)) as ImgBBResponse | null;

  if (!response.ok || !payload?.success || !payload.data?.url) {
    throw serviceUnavailable(
      payload?.error?.message ?? "The image could not be uploaded. Please try again.",
    );
  }

  return {
    url: payload.data.url,
    thumbnailUrl: payload.data.thumb?.url ?? payload.data.display_url ?? null,
    deleteUrl: payload.data.delete_url ?? null,
  };
}

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
