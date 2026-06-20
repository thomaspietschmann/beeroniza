import { z } from "zod";
import { saveFile } from "@/lib/storage";
import { sniffImageMime } from "@/lib/image-type";
import { env } from "@/lib/env";
import { withApiKey, badRequest, json } from "@/lib/api-helpers";

const MAX_BYTES = 10 * 1024 * 1024;

const jsonSchema = z.object({
  // Base64-encoded image bytes (with or without a data: prefix).
  file_base64: z.string().min(1),
  mime_type: z.string().default("image/png"),
});

// POST /api/v1/uploads — upload an image and get back a URL you can use as an
// `image_url` in a modification. Accepts either multipart/form-data (field
// "file") or JSON { file_base64, mime_type }. Authenticated with an API key.
export const POST = withApiKey(async (req, user) => {
  const contentType = req.headers.get("content-type") ?? "";
  let bytes: Buffer;

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const parsed = jsonSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid request", parsed.error.issues);
    const base64 = parsed.data.file_base64.replace(/^data:[^;]+;base64,/, "");
    bytes = Buffer.from(base64, "base64");
  } else {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return badRequest("No file provided");
    bytes = Buffer.from(await file.arrayBuffer());
  }

  if (bytes.length === 0) return badRequest("Empty file");
  if (bytes.length > MAX_BYTES) return badRequest("File too large (max 10 MB)");
  // Determine the type from the bytes themselves — the client-supplied
  // mime_type / form content-type is not trusted.
  const mimeType = sniffImageMime(bytes);
  if (!mimeType) {
    return badRequest("Unsupported image format (PNG, JPEG, GIF, WebP, AVIF only)");
  }

  const saved = await saveFile({ userId: user.id, kind: "UPLOAD", mimeType, bytes });
  const url = `${env.appUrl}/api/files/${saved.id}`;
  return json({ id: saved.id, url }, 201);
});
