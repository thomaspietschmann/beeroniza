import { prisma } from "@/lib/db";
import { BUNDLED_FONTS } from "@/lib/fonts/bundled";
import { saveFile, deleteFile } from "@/lib/storage";
import { sniffFontType } from "@/lib/font-type";
import { withUser, badRequest, json } from "@/lib/api-helpers";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — fonts are small; reject anything large

// A family-level summary used by both the editor font picker (needs `family` +
// `category` + `bundled`) and the fonts overview page (needs `source` + counts).
export interface FontFamilyInfo {
  family: string;
  category: string;
  bundled: boolean;
  source: string; // "bundled" | "upload" | "google"
  faceCount: number;
  createdAt: string | null;
}

// Returns the bundled fonts plus the user's own (uploaded / Google-imported)
// fonts, grouped by family.
export const GET = withUser(async (_req, userId) => {
  const bundled: FontFamilyInfo[] = BUNDLED_FONTS.map((f) => ({
    family: f.family,
    category: f.category,
    bundled: true,
    source: "bundled",
    faceCount: f.faces.length,
    createdAt: null,
  }));

  const rows = await prisma.font.findMany({
    where: { userId },
    select: { family: true, source: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group the per-face rows into one entry per family.
  const byFamily = new Map<string, FontFamilyInfo>();
  for (const r of rows) {
    const existing = byFamily.get(r.family);
    if (existing) {
      existing.faceCount += 1;
    } else {
      byFamily.set(r.family, {
        family: r.family,
        category: r.source === "google" ? "google" : "custom",
        bundled: false,
        source: r.source,
        faceCount: 1,
        createdAt: r.createdAt.toISOString(),
      });
    }
  }

  return json({ fonts: [...bundled, ...byFamily.values()] });
});

// Upload a custom font file. The family name is supplied by the caller (the
// @font-face we emit uses exactly this name, so it need not match the font's
// internal name); the file format is sniffed from magic bytes, never trusted
// from the client content-type.
export const POST = withUser(async (req, userId) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("No file provided");

  const family = String(form?.get("family") ?? "").trim().slice(0, 100);
  if (!family) return badRequest("A font family name is required");
  const weight = clampWeight(form?.get("weight"));
  const style = form?.get("style") === "italic" ? "italic" : "normal";

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) return badRequest("Empty file");
  if (bytes.length > MAX_BYTES) return badRequest("File too large (max 5 MB)");

  const type = sniffFontType(bytes);
  if (!type) return badRequest("Unsupported font format (TTF, OTF, WOFF, WOFF2 only)");

  const saved = await saveFile({
    userId,
    kind: "FONT",
    mimeType: type.mime,
    bytes,
    originalName: typeof file.name === "string" ? file.name.slice(0, 200) : null,
    dedupe: true,
  });

  await prisma.font.create({
    data: {
      userId,
      family,
      weight,
      style,
      format: type.format,
      fileId: saved.id,
      isBundled: false,
      source: "upload",
    },
  });

  return json({ family, weight, style, format: type.format }, 201);
});

// Delete one of the user's font families (all its faces + the backing files).
// Bundled fonts (userId = null) are never reachable here.
export const DELETE = withUser(async (req, userId) => {
  const family = new URL(req.url).searchParams.get("family")?.trim();
  if (!family) return badRequest("A family is required");

  const fonts = await prisma.font.findMany({
    where: { userId, family },
    select: { id: true, fileId: true },
  });
  if (fonts.length === 0) return badRequest("No such font");

  await prisma.font.deleteMany({ where: { userId, family } });

  // Remove each backing file unless another font row still references it (e.g. a
  // byte-identical dedupe across families).
  for (const f of fonts) {
    if (!f.fileId) continue;
    const stillUsed = await prisma.font.count({ where: { fileId: f.fileId } });
    if (stillUsed === 0) await deleteFile(f.fileId).catch(() => undefined);
  }

  return json({ ok: true });
});

function clampWeight(v: FormDataEntryValue | null | undefined): number {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return 400;
  return Math.min(900, Math.max(100, n));
}