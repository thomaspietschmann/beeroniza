import { prisma } from "@/lib/db";
import { readFileBytes } from "@/lib/storage";
import { fontFaceCss } from "./face-css";

// A user's per-instance fonts (uploaded + Google-imported) all carry a fileId
// pointing at the StoredFile bytes. Bundled fonts have no fileId — they're
// already declared in the build-time _fonts.scss — so they're excluded here.

// @font-face CSS with same-origin url() sources, for the authenticated browser
// (editor canvas, template thumbnails, fonts overview). The browser fetches the
// font bytes from /api/files/<id> with the session cookie.
export async function userFontFaceCssUrl(userId: string): Promise<string> {
  const fonts = await prisma.font.findMany({
    where: { userId, fileId: { not: null } },
    select: { family: true, weight: true, style: true, format: true, fileId: true },
  });
  return fontFaceCss(
    fonts.map((f) => ({
      family: f.family,
      weight: f.weight,
      style: f.style,
      format: f.format,
      src: `/api/files/${f.fileId}`,
    })),
  );
}

// @font-face CSS with the font bytes inlined as data: URLs, for the headless
// renderer (which loads /internal/render and can't authenticate to /api/files).
// `families` optionally narrows to just the families a template actually uses.
export async function userFontFaceCssData(
  userId: string,
  families?: string[],
): Promise<string> {
  const wanted = families ? new Set(families) : null;
  const fonts = await prisma.font.findMany({
    where: {
      userId,
      fileId: { not: null },
      ...(wanted ? { family: { in: [...wanted] } } : {}),
    },
    include: { file: true },
  });

  const faces = [];
  for (const f of fonts) {
    if (!f.file) continue;
    const bytes = await readFileBytes(f.file);
    faces.push({
      family: f.family,
      weight: f.weight,
      style: f.style,
      format: f.format,
      src: `data:${f.file.mimeType};base64,${bytes.toString("base64")}`,
    });
  }
  return fontFaceCss(faces);
}