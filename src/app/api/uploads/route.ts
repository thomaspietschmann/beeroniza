import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { withUser, badRequest, json } from "@/lib/api-helpers";
import { sniffImageMime } from "@/lib/image-type";
import { clampInt } from "@/lib/math";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const LIST_MAX = 200;
const LIST_DEFAULT = 60;

// Image upload for templates (backgrounds, avatars, …). Stored via the
// configured storage driver and served from /api/files/:id (same origin, so
// the renderer's canvas stays CORS-clean).
//
// Optional form fields (sent by the client after running face detection):
//   originalName  the picked file's name, shown in the media library
//   focalX/focalY normalized face focal point (0..1) for "face gravity" crops
//   hasFace       "true" when a face was detected
export const POST = withUser(async (req, userId) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("No file provided");

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) return badRequest("Empty file");
  if (bytes.length > MAX_BYTES) return badRequest("File too large (max 10 MB)");
  // Trust the bytes, not the client-declared type: reject SVG/HTML masquerading
  // as an image.
  const mimeType = sniffImageMime(bytes);
  if (!mimeType) return badRequest("Unsupported image format (PNG, JPEG, GIF, WebP, AVIF only)");

  const focalX = numOrNull(form?.get("focalX"));
  const focalY = numOrNull(form?.get("focalY"));
  const hasFace = form?.get("hasFace") === "true";

  const saved = await saveFile({
    userId,
    kind: "UPLOAD",
    mimeType,
    bytes,
    originalName: typeof file.name === "string" ? file.name.slice(0, 200) : null,
    focalX,
    focalY,
    hasFace,
    dedupe: true,
  });

  return json(
    {
      id: saved.id,
      url: `/api/files/${saved.id}`,
      originalName: saved.originalName,
      hasFace: saved.hasFace,
      focalX: saved.focalX,
      focalY: saved.focalY,
    },
    201,
  );
});

// Lists the current user's uploaded images for the media library. Newest first,
// with optional name search and pagination.
export const GET = withUser(async (req, userId) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = clampInt(url.searchParams.get("limit"), LIST_DEFAULT, 1, LIST_MAX);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  const where = {
    userId,
    kind: "UPLOAD" as const,
    ...(q ? { originalName: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.storedFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
        width: true,
        height: true,
        hasFace: true,
        focalX: true,
        focalY: true,
        createdAt: true,
      },
    }),
    prisma.storedFile.count({ where }),
  ]);

  return json({
    files: rows.map((f) => ({
      id: f.id,
      url: `/api/files/${f.id}`,
      originalName: f.originalName,
      mimeType: f.mimeType,
      byteSize: f.byteSize,
      width: f.width,
      height: f.height,
      hasFace: f.hasFace,
      focalX: f.focalX,
      focalY: f.focalY,
      createdAt: f.createdAt.toISOString(),
    })),
    total,
  });
});

function numOrNull(v: FormDataEntryValue | null | undefined): number | null {
  if (typeof v !== "string" || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
