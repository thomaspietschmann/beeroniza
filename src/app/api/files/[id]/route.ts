import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getFile, readFileBytes, deleteFile } from "@/lib/storage";
import { authenticateApiKey } from "@/lib/apikey";
import { sessionUserId, unauthorized, badRequest, json, notFound } from "@/lib/api-helpers";
import { type UsageValues } from "@/lib/usages";

type Ctx = { params: Promise<{ id: string }> };

// Resolve the caller from either a logged-in session (browser <img>, editor) or
// an API-key bearer token (programmatic download of a generated image_url).
async function callerId(req: Request): Promise<string | null> {
  const sid = await sessionUserId();
  if (sid) return sid;
  const user = await authenticateApiKey(req.headers.get("authorization"));
  return user?.id ?? null;
}

// MIME types we serve inline (raster images safe to render in-page). Anything
// else (e.g. SVG, which can carry script) is forced to download.
const INLINE_SAFE = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

// Map a stored MIME type to a sensible file extension so downloads aren't saved
// as extension-less blobs.
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "application/font-woff": "woff",
  "application/octet-stream": "bin",
};

function extFor(mime: string): string {
  return EXT_BY_MIME[mime.toLowerCase()] ?? mime.split("/")[1]?.replace(/[^a-z0-9]+/gi, "") ?? "bin";
}

// Turn an arbitrary requested name into a safe, single-segment file base (no
// path separators, no extension — we always append the MIME-derived one).
function safeBase(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  const base = raw
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^\p{L}\p{N} _.-]+/gu, "-")
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || fallback;
}

// Serves stored files (uploads & generated images) by id. The caller must own
// the file (session or API key) — ids are not a capability. Generated results
// are reached via the API's image_url with the same bearer token.
//
// Query params:
//   ?name=<base>  give the saved file a meaningful base name (extension is
//                 always derived from the stored MIME type).
//   ?dl=1         send as an attachment (force a download) rather than inline.
export async function GET(req: Request, { params }: Ctx) {
  const callerUserId = await callerId(req);
  if (!callerUserId) return unauthorized();

  const { id } = await params;
  const file = await getFile(id);
  // 404 (not 403) for someone else's file so existence isn't disclosed.
  if (!file || file.userId !== callerUserId) return notFound();

  const bytes = await readFileBytes(file);

  const url = new URL(req.url);
  const ext = extFor(file.mimeType);
  const fallback = `beeroniza-${file.kind.toLowerCase()}-${id.slice(-8)}`;
  const filename = `${safeBase(url.searchParams.get("name"), fallback)}.${ext}`;
  const inlineSafe = INLINE_SAFE.has(file.mimeType.toLowerCase());
  // Never render non-raster types (e.g. SVG) inline — force a download so any
  // embedded script can't execute in the app origin.
  const disposition =
    url.searchParams.get("dl") || !inlineSafe ? "attachment" : "inline";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": file.mimeType,
      "content-length": String(bytes.length),
      // Give the browser a real name + extension for "Save image as…" / direct
      // opens / API consumers. RFC 5987 filename* covers non-ASCII names.
      "content-disposition": `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, max-age=31536000, immutable",
      // Defense-in-depth against content-sniffing and any document-context
      // interpretation of served bytes.
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}

// Find the user's usages that still reference this file, filtering DB-side
// (jsonb_each over the values map) instead of loading every usage into Node.
async function usagesReferencing(userId: string, fileId: string) {
  return prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM usages
    WHERE "userId" = ${userId}
      AND EXISTS (
        SELECT 1 FROM jsonb_each("values") AS kv
        WHERE kv.value->>'fileId' = ${fileId}
      )
  `;
}

// Rename an uploaded file (media library). Only the owner may rename, and only
// their own UPLOAD files.
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const { id } = await params;

  const file = await prisma.storedFile.findFirst({ where: { id, userId, kind: "UPLOAD" } });
  if (!file) return notFound();

  const body = (await req.json().catch(() => null)) as { originalName?: unknown } | null;
  const name = typeof body?.originalName === "string" ? body.originalName.trim().slice(0, 200) : "";
  if (!name) return badRequest("A name is required");

  const updated = await prisma.storedFile.update({
    where: { id },
    data: { originalName: name },
    select: { id: true, originalName: true },
  });
  return json({ id: updated.id, originalName: updated.originalName });
}

// Delete an uploaded file. If usages still reference it, refuse with 409 and the
// reference count unless ?force=1, in which case the references are stripped from
// those usages first so they don't point at a missing file.
export async function DELETE(req: Request, { params }: Ctx) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const { id } = await params;

  const file = await prisma.storedFile.findFirst({ where: { id, userId, kind: "UPLOAD" } });
  if (!file) return notFound();

  const force = new URL(req.url).searchParams.get("force") === "1";
  const refs = await usagesReferencing(userId, id);

  if (refs.length > 0 && !force) {
    return json(
      {
        error: `Still used by ${refs.length} usage${refs.length === 1 ? "" : "s"}`,
        references: refs.map((u) => ({ id: u.id, name: u.name })),
      },
      409,
    );
  }

  // Strip dangling references so forced deletes don't leave usages pointing at a
  // missing file. Only the matched usages are loaded here (a small set).
  if (refs.length > 0) {
    const full = await prisma.usage.findMany({
      where: { id: { in: refs.map((r) => r.id) } },
      select: { id: true, values: true },
    });
    for (const u of full) {
      const values = (u.values as UsageValues) ?? {};
      const cleaned: UsageValues = {};
      for (const [k, v] of Object.entries(values)) {
        if (v?.fileId === id) continue;
        cleaned[k] = v;
      }
      await prisma.usage.update({
        where: { id: u.id },
        data: { values: cleaned as unknown as Prisma.InputJsonValue },
      });
    }
  }

  await deleteFile(id);
  return json({ ok: true });
}
