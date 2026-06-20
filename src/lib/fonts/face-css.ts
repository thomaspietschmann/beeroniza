import { cssFormatFor } from "@/lib/font-type";

// One @font-face's worth of inputs. `src` is either a same-origin URL
// ("/api/files/<id>") for the browser or a "data:font/…;base64,…" URL for the
// headless renderer (which can't authenticate against /api/files).
export interface FontFaceInput {
  family: string;
  weight: number;
  style: string;
  format: string;
  src: string;
}

// Build @font-face rules. Used for BOTH the editor/browser (url src) and the
// Playwright renderer (data src) so custom + Google-imported fonts render
// identically in the preview and the generated image.
export function fontFaceCss(faces: FontFaceInput[]): string {
  return faces
    .map(
      (f) =>
        `@font-face{font-family:${JSON.stringify(f.family)};` +
        `font-style:${f.style || "normal"};` +
        `font-weight:${f.weight || 400};` +
        `font-display:swap;` +
        `src:url(${JSON.stringify(f.src)}) format(${JSON.stringify(cssFormatFor(f.format))});}`,
    )
    .join("\n");
}