import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { sniffFontType } from "@/lib/font-type";
import { withUser, badRequest, json } from "@/lib/api-helpers";

// Import a Google Fonts family into this instance. We download the actual font
// binaries SERVER-SIDE (at import time) and store them as StoredFile bytes, so
// at render time the fonts are served from our own instance — never a CDN, in
// line with the project's hard no-CDN rule.
//
// We use the v1 `css` API (not css2): it returns one full, non-subset TTF per
// weight with a single url() each, which maps cleanly to one Font row per
// weight. (css2 would hand back many woff2 unicode-range subsets, and the legacy
// user-agent trick yields unusable EOT files.)
const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAX_FACES = 12;

export const POST = withUser(async (req, userId) => {
  const body = (await req.json().catch(() => null)) as
    | { family?: unknown; weights?: unknown }
    | null;

  const family = String(body?.family ?? "").trim().slice(0, 100);
  // Google family names are letters/digits/spaces (e.g. "Playfair Display").
  if (!family || !/^[\p{L}\p{N} ]+$/u.test(family)) {
    return badRequest("Invalid font family name");
  }

  const weights = normalizeWeights(body?.weights);
  // v1 css API: family=Family+Name:400,700 (family is validated to letters /
  // digits / spaces above, so a simple space→'+' is safe).
  const familyParam = family.replace(/ /g, "+");
  const cssUrl = `https://fonts.googleapis.com/css?family=${familyParam}:${weights.join(",")}`;

  const cssRes = await fetch(cssUrl, { headers: { "User-Agent": DESKTOP_UA } }).catch(
    () => null,
  );
  if (!cssRes || !cssRes.ok) {
    return badRequest(`Could not find "${family}" on Google Fonts`);
  }
  const css = await cssRes.text();

  const faces = parseFontFaces(css).slice(0, MAX_FACES);
  if (faces.length === 0) {
    return badRequest(`No downloadable faces found for "${family}"`);
  }

  let imported = 0;
  for (const face of faces) {
    // Skip a weight/style we already have for this family+user.
    const already = await prisma.font.findFirst({
      where: { userId, family, weight: face.weight, style: face.style },
      select: { id: true },
    });
    if (already) continue;

    const fontRes = await fetch(face.url).catch(() => null);
    if (!fontRes || !fontRes.ok) continue;
    const bytes = Buffer.from(await fontRes.arrayBuffer());
    const type = sniffFontType(bytes);
    if (!type) continue;

    const saved = await saveFile({
      userId,
      kind: "FONT",
      mimeType: type.mime,
      bytes,
      originalName: `${family} ${face.weight}${face.style === "italic" ? " Italic" : ""}.${type.format}`,
      dedupe: true,
    });
    await prisma.font.create({
      data: {
        userId,
        family,
        weight: face.weight,
        style: face.style,
        format: type.format,
        fileId: saved.id,
        isBundled: false,
        source: "google",
      },
    });
    imported += 1;
  }

  if (imported === 0) {
    return badRequest(`"${family}" is already imported, or no faces could be downloaded`);
  }
  return json({ family, imported }, 201);
});

// Parse the @font-face blocks Google returns into { weight, style, url } tuples.
// Google may return several unicode-range subsets per weight (latin, latin-ext,
// greek, cyrillic, …). We only keep blocks that cover basic ASCII (U+0000–00FF)
// — i.e. where the first code point in the unicode-range is ≤ U+00FF — or blocks
// with no unicode-range at all (older API responses with a single full TTF/WOFF2).
function parseFontFaces(css: string): { weight: number; style: string; url: string }[] {
  const out: { weight: number; style: string; url: string }[] = [];
  const blocks = css.split("@font-face");
  for (const block of blocks) {
    const url = block.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) continue;

    // Skip subsets that don't cover basic ASCII.
    // The "latin" block starts at U+0000; "latin-ext" starts at U+0100+.
    const unicodeRange = block.match(/unicode-range:\s*([^;]+)/)?.[1];
    if (unicodeRange) {
      const firstHex = unicodeRange.match(/U\+([0-9A-Fa-f]+)/)?.[1];
      if (firstHex && parseInt(firstHex, 16) > 0xff) continue;
    }

    const weight = Number.parseInt(block.match(/font-weight:\s*(\d+)/)?.[1] ?? "400", 10);
    const style = /font-style:\s*italic/.test(block) ? "italic" : "normal";
    out.push({ weight: Number.isFinite(weight) ? weight : 400, style, url });
  }
  return out;
}

function normalizeWeights(raw: unknown): number[] {
  const arr = Array.isArray(raw) ? raw : [400, 700];
  const weights = arr
    .map((w) => Number.parseInt(String(w), 10))
    .filter((w) => Number.isFinite(w) && w >= 100 && w <= 900);
  const unique = [...new Set(weights.length ? weights : [400, 700])].sort((a, b) => a - b);
  return unique.slice(0, 6);
}
