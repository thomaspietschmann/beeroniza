import { prisma } from "@/lib/db";
import { saveFile, getFile, readFileBytes } from "@/lib/storage";
import { env } from "@/lib/env";
import { safeFetchImage, safePostWebhook } from "@/lib/http-guard";
import { userFontFaceCssData } from "@/lib/fonts/server";
import { renderImage } from "@/server/render";
import {
  templateDocSchema,
  modificationsSchema,
  type Modification,
} from "@/lib/template/schema";

// Extract the file id when a URL points at this instance's own /api/files/:id
// endpoint (relative, APP_URL-absolute, or loopback). Such files are read
// directly from storage with an ownership check — never via a loopback HTTP
// request that would bypass the public proxy's auth.
function localFileId(rawUrl: string): string | null {
  const rel = rawUrl.match(/^\/api\/files\/([^/?#]+)/);
  if (rel) return rel[1];
  try {
    const u = new URL(rawUrl);
    const appHost = new URL(env.appUrl).host;
    const isLocal =
      u.host === appHost || u.hostname === "127.0.0.1" || u.hostname === "localhost";
    if (!isLocal) return null;
    const m = u.pathname.match(/^\/api\/files\/([^/?#]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// Inline a stored file the requesting user owns, straight from storage. Returns
// null (image dropped) when the file is missing or owned by someone else.
async function inlineLocalFile(id: string, ownerUserId: string): Promise<string | null> {
  const file = await getFile(id);
  if (!file || file.userId !== ownerUserId) return null;
  const bytes = await readFileBytes(file);
  return `data:${file.mimeType};base64,${bytes.toString("base64")}`;
}

// Fetch a remote image server-side (SSRF-guarded) and inline it as a data URL so
// the canvas stays CORS-clean (a tainted canvas cannot be exported).
async function inlineRemoteImage(url: string): Promise<string | null> {
  const img = await safeFetchImage(url);
  if (!img) return null;
  return `data:${img.contentType};base64,${img.bytes.toString("base64")}`;
}

async function preprocessModifications(
  mods: Modification[],
  ownerUserId: string,
): Promise<Modification[]> {
  return Promise.all(
    mods.map(async (m) => {
      if (!m.image_url) return m;
      const isHttp = /^https?:\/\//i.test(m.image_url);
      const isLocalRel = m.image_url.startsWith("/api/files/");
      if (!isHttp && !isLocalRel) return m; // data: URLs etc. pass through

      const fileId = localFileId(m.image_url);
      const inlined = fileId
        ? await inlineLocalFile(fileId, ownerUserId)
        : await inlineRemoteImage(m.image_url);
      // Drop the image when it can't be safely read/fetched, so the render
      // doesn't hang on an unreachable URL (the placeholder is removed).
      return { ...m, image_url: inlined ?? undefined };
    }),
  );
}

// Walk a fabric object tree and inline every image src that would otherwise be
// fetched by Chromium (SSRF via template body). Mirrors preprocessModifications.
async function inlineObjectSrc(
  obj: Record<string, unknown>,
  ownerUserId: string,
): Promise<void> {
  const src = typeof obj.src === "string" ? obj.src : null;
  if (src) {
    const isHttp = /^https?:\/\//i.test(src);
    if (isHttp) {
      const fileId = localFileId(src);
      const inlined = fileId
        ? await inlineLocalFile(fileId, ownerUserId)
        : await inlineRemoteImage(src);
      obj.src = inlined ?? ""; // empty string → Fabric skips the image load
    } else if (!/^data:/i.test(src)) {
      // Reject file:, blob:, or any other scheme.
      obj.src = "";
    }
  }
  // Recurse into nested backgroundImage / clipPath objects.
  for (const key of ["backgroundImage", "clipPath"]) {
    const child = obj[key];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      await inlineObjectSrc(child as Record<string, unknown>, ownerUserId);
    }
  }
  // Walk nested objects arrays (groups, etc.).
  if (Array.isArray(obj.objects)) {
    for (const child of obj.objects) {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        await inlineObjectSrc(child as Record<string, unknown>, ownerUserId);
      }
    }
  }
}

// Replace every remote image src in the template's Fabric JSON with a server-
// side-fetched data: URL (SSRF-guarded). Must run before renderImage so the
// headless browser never makes outbound requests for template images.
async function inlineDocImages(
  doc: { fabric: Record<string, unknown> },
  ownerUserId: string,
): Promise<void> {
  const objects = doc.fabric?.objects;
  if (Array.isArray(objects)) {
    await Promise.all(
      objects.map((o) => {
        if (o && typeof o === "object" && !Array.isArray(o)) {
          return inlineObjectSrc(o as Record<string, unknown>, ownerUserId);
        }
      }),
    );
  }
  const bg = doc.fabric?.backgroundImage;
  if (bg && typeof bg === "object" && !Array.isArray(bg)) {
    await inlineObjectSrc(bg as Record<string, unknown>, ownerUserId);
  }
}

// Distinct fontFamily values referenced by a template's layers, used to narrow
// which of the owner's fonts get inlined into the render.
function docFontFamilies(doc: { fabric: Record<string, unknown> }): string[] {
  const objects = doc.fabric?.objects;
  if (!Array.isArray(objects)) return [];
  const families = new Set<string>();
  for (const o of objects) {
    const fam = (o as { fontFamily?: unknown })?.fontFamily;
    if (typeof fam === "string" && fam) families.add(fam);
  }
  return [...families];
}

async function notifyWebhook(url: string, generationId: string, status: string) {
  try {
    await safePostWebhook(url, {
      id: generationId,
      status,
      url: `${env.appUrl}/api/v1/images/${generationId}`,
    });
  } catch (err) {
    console.error("[worker] webhook delivery failed", err);
  }
}

export interface ProcessOptions {
  // True when pg-boss has exhausted its retries for this job. The generation is
  // only marked FAILED (and the failed webhook fired) on the final attempt, so a
  // transient failure that later succeeds doesn't produce contradictory status
  // flips or two webhooks for one generation.
  isFinalAttempt: boolean;
}

export async function processRenderJob(
  generationId: string,
  opts: ProcessOptions = { isFinalAttempt: true },
): Promise<void> {
  const gen = await prisma.imageGeneration.findUnique({
    where: { id: generationId },
    include: { template: true },
  });
  if (!gen) return;

  await prisma.imageGeneration.update({
    where: { id: gen.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  try {
    let rawDoc: unknown = gen.template.data;
    if (gen.templateVersion != null) {
      const version = await prisma.templateVersion.findUnique({
        where: {
          templateId_version: {
            templateId: gen.templateId,
            version: gen.templateVersion,
          },
        },
      });
      if (version) rawDoc = version.data;
    }

    const doc = templateDocSchema.parse(rawDoc);
    await inlineDocImages(doc, gen.userId);
    const modifications = await preprocessModifications(
      modificationsSchema.parse(gen.modifications),
      gen.userId,
    );

    // Inline the owner's custom / Google-imported fonts (only the families this
    // template actually uses) so the headless renderer can use them.
    const fontFaceCss = await userFontFaceCssData(gen.userId, docFontFamilies(doc));

    const buffer = await renderImage({
      doc,
      modifications,
      format: gen.format === "jpg" ? "jpg" : gen.format === "webp" ? "webp" : "png",
      multiplier: 1,
      fontFaceCss,
    });

    // Record the dimensions actually rendered (the doc's canvas size), which is
    // the source of truth the renderer uses — the template's width/height
    // columns can drift from data.canvas.* across independent updates.
    const width = doc.canvas?.width ?? gen.width;
    const height = doc.canvas?.height ?? gen.height;

    const mimeType =
      gen.format === "jpg"
        ? "image/jpeg"
        : gen.format === "webp"
          ? "image/webp"
          : "image/png";
    const file = await saveFile({
      userId: gen.userId,
      kind: "GENERATED",
      mimeType,
      bytes: buffer,
      width,
      height,
    });

    await prisma.imageGeneration.update({
      where: { id: gen.id },
      data: {
        status: "COMPLETED",
        fileId: file.id,
        width,
        height,
        completedAt: new Date(),
        error: null,
      },
    });

    if (gen.webhookUrl) await notifyWebhook(gen.webhookUrl, gen.id, "completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] render failed for ${gen.id}:`, message);
    // On a non-final attempt, leave the row PROCESSING and rethrow so pg-boss
    // retries; only commit FAILED + fire the failed webhook once retries run out.
    if (opts.isFinalAttempt) {
      // Store a generic message — the full error (with internal hostnames /
      // paths) is already logged above and must not leak to API callers.
      const publicError = "Rendering failed. Please check your inputs and try again.";
      await prisma.imageGeneration.update({
        where: { id: gen.id },
        data: { status: "FAILED", error: publicError, completedAt: new Date() },
      });
      if (gen.webhookUrl) await notifyWebhook(gen.webhookUrl, gen.id, "failed");
    }
    throw err;
  }
}
