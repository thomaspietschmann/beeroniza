// Browser-only rendering module shared by the editor preview and the server
// renderer (executed inside headless Chromium). Running the SAME code with the
// SAME fonts on both sides is what guarantees pixel parity between the editor
// preview and the generated image.

import * as fabric from "fabric";
import type { Modification, TemplateDoc, ClipShape, PlaceholderType } from "./schema";

// Custom Fabric object properties we persist in the template JSON.
//   bnzName        – stable key (the API/form field name)
//   bnzPlaceholder – { kind: "text"|"image"|"color", label? } marks it fillable
//   bnzClip        – crop shape for image layers
//   bnzFit         – text overflow strategy when filled: "shrink" | "truncate" | "wrap"
//   bnzMaxHeight   – max height (px) a fillable text box may occupy before fit kicks in
//   bnzKeepDefault – if true, keep the baked-in default when no value is supplied
//                    (e.g. a preset background); otherwise unfilled placeholders
//                    are dropped from the render entirely.
export const BNZ_PROPS = [
  "bnzName",
  "bnzPlaceholder",
  "bnzClip",
  "bnzFit",
  "bnzMaxHeight",
  "bnzImageFit",
  "bnzImageAlign",
  "bnzKeepDefault",
] as const;

export type TextFit = "shrink" | "truncate" | "wrap";
export type ImageFit = "cover" | "contain";
export type ImageAlign = "left" | "center" | "right";

type AnyObject = fabric.FabricObject & {
  bnzName?: string;
  bnzPlaceholder?: { kind: PlaceholderType; label?: string };
  bnzClip?: ClipShape;
  bnzFit?: TextFit;
  bnzMaxHeight?: number;
  // For image / image-frame placeholders: how the filled image fits the box.
  // "cover" (default) crops to fill; "contain" fits inside without cropping
  // (ideal for transparent logos), aligned left/center/right.
  bnzImageFit?: ImageFit;
  bnzImageAlign?: ImageAlign;
  // Keep the baked-in default when this placeholder receives no value, instead
  // of being dropped from the render (used for preset backgrounds).
  bnzKeepDefault?: boolean;
};

function isImage(obj: fabric.FabricObject): obj is fabric.FabricImage {
  return obj.type === "image" || obj.type === "Image";
}

function isShape(obj: fabric.FabricObject): boolean {
  const t = (obj.type || "").toLowerCase();
  return t === "rect" || t === "circle" || t === "ellipse" || t === "triangle" || t === "polygon";
}

function hasText(obj: fabric.FabricObject): obj is fabric.FabricText {
  const t = (obj.type || "").toLowerCase();
  return t === "text" || t === "i-text" || t === "textbox" || t === "itext";
}

// Map an object's geometry to a clip shape kind for image framing.
function clipKindFor(obj: fabric.FabricObject): ClipShape {
  const t = (obj.type || "").toLowerCase();
  if (t === "circle" || t === "ellipse") return "circle";
  const rx = (obj as fabric.Rect).rx ?? 0;
  return rx > 0 ? "rounded" : "rect";
}

// Build a clipPath for an image given its on-canvas size and desired shape.
export function makeClipPath(
  shape: ClipShape,
  width: number,
  height: number,
): fabric.FabricObject | undefined {
  const common = { originX: "center" as const, originY: "center" as const };
  switch (shape) {
    case "circle":
      return new fabric.Circle({ ...common, radius: Math.min(width, height) / 2 });
    case "rounded":
      return new fabric.Rect({
        ...common,
        width,
        height,
        rx: Math.min(width, height) * 0.12,
        ry: Math.min(width, height) * 0.12,
      });
    case "rect":
    default:
      return new fabric.Rect({ ...common, width, height });
  }
}

export function applyClipToImage(img: fabric.FabricImage, shape: ClipShape) {
  const path = makeClipPath(shape, img.width ?? 0, img.height ?? 0);
  if (path) img.clipPath = path;
}

// A normalized focal point (0..1) of the source image — typically a detected
// face center. Cover-cropping keeps it in view and as centered as possible.
type Focal = { x: number; y: number };

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// For a cover-fitted image (displayed size = natural × scale) inside a box,
// compute how far to translate the image (canvas px) so the focal point lands
// at the box center, clamped so no empty edge is revealed, plus the matching
// counter-offset for a center-anchored clipPath (in the image's local,
// unscaled coords) so the visible window stays over the box.
function coverFocalOffset(
  natW: number,
  natH: number,
  boxW: number,
  boxH: number,
  scale: number,
  focal: Focal,
): { dx: number; dy: number; clipLeft: number; clipTop: number } {
  const dispW = natW * scale;
  const dispH = natH * scale;
  const maxDX = Math.max(0, (dispW - boxW) / 2);
  const maxDY = Math.max(0, (dispH - boxH) / 2);
  const dx = clamp((0.5 - focal.x) * dispW, -maxDX, maxDX);
  const dy = clamp((0.5 - focal.y) * dispH, -maxDY, maxDY);
  return { dx, dy, clipLeft: -dx / scale, clipTop: -dy / scale };
}

async function replaceImageSrc(img: fabric.FabricImage, url: string, focal?: Focal | null) {
  const targetW = (img.width ?? 0) * (img.scaleX ?? 1);
  const targetH = (img.height ?? 0) * (img.scaleY ?? 1);
  const shape = (img as AnyObject).bnzClip as ClipShape | undefined;
  const origin = img.getCenterPoint();

  await img.setSrc(url, { crossOrigin: "anonymous" });

  const naturalW = img.width ?? targetW;
  const naturalH = img.height ?? targetH;
  let scale = 1;
  if (naturalW > 0 && naturalH > 0 && targetW > 0 && targetH > 0) {
    scale = Math.max(targetW / naturalW, targetH / naturalH);
    img.scaleX = scale;
    img.scaleY = scale;
  }
  if (shape) applyClipToImage(img, shape);

  // Face gravity: slide the (larger-than-box) image so the focal point sits at
  // the box center, then counter-shift the clip so it stays over the box.
  if (focal && naturalW > 0 && naturalH > 0 && targetW > 0 && targetH > 0) {
    const { dx, dy, clipLeft, clipTop } = coverFocalOffset(
      naturalW, naturalH, targetW, targetH, scale, focal,
    );
    img.set({ left: origin.x + dx, top: origin.y + dy, originX: "center", originY: "center" });
    if (img.clipPath) img.clipPath.set({ left: clipLeft, top: clipTop });
    img.setCoords();
  }
}

// Replace a shape (rect/circle/…) with an image that is cover-fitted and clipped
// to the shape's footprint. This is what makes "draw a shape, fill it with an
// image cropped to that shape" work — e.g. a circular avatar slot.
async function fillShapeWithImage(
  canvas: fabric.StaticCanvas | fabric.Canvas,
  shape: AnyObject,
  url: string,
  focal?: Focal | null,
) {
  const w = (shape.width ?? 0) * (shape.scaleX ?? 1);
  const h = (shape.height ?? 0) * (shape.scaleY ?? 1);
  if (w <= 0 || h <= 0) return;
  const center = shape.getCenterPoint();
  const angle = shape.angle ?? 0;
  const clip = clipKindFor(shape);
  const rx = (shape as fabric.Rect).rx ?? 0;
  const fit: ImageFit = shape.bnzImageFit ?? "cover";
  const align: ImageAlign = shape.bnzImageAlign ?? "center";

  const img = (await fabric.FabricImage.fromURL(url, {
    crossOrigin: "anonymous",
  })) as fabric.FabricImage;

  const natW = img.width ?? w;
  const natH = img.height ?? h;

  if (fit === "contain") {
    // Fit the whole image inside the box without cropping (keeps transparent
    // logos intact). Align it left / center / right within the box; no clip
    // needed because the image already fits inside.
    const scale = Math.min(w / natW, h / natH);
    const imgW = natW * scale;
    let cx = center.x;
    if (align === "left") cx = center.x - w / 2 + imgW / 2;
    else if (align === "right") cx = center.x + w / 2 - imgW / 2;
    img.set({
      originX: "center",
      originY: "center",
      left: cx,
      top: center.y,
      scaleX: scale,
      scaleY: scale,
      angle,
    });
  } else {
    // Cover: fill the box and crop to the shape.
    const scale = Math.max(w / natW, h / natH);
    // Face gravity: slide the image so the focal point lands at the box center
    // (clamped to keep the box covered); the clip is counter-shifted to stay put.
    const off = focal
      ? coverFocalOffset(natW, natH, w, h, scale, focal)
      : { dx: 0, dy: 0, clipLeft: 0, clipTop: 0 };
    img.set({
      originX: "center",
      originY: "center",
      left: center.x + off.dx,
      top: center.y + off.dy,
      scaleX: scale,
      scaleY: scale,
      angle,
    });
    // clipPath lives in the image's UNSCALED local coordinates and scales with
    // the image, so divide the visible size by the image scale.
    const clipW = w / scale;
    const clipH = h / scale;
    const common = { left: off.clipLeft, top: off.clipTop, originX: "center" as const, originY: "center" as const };
    const shapeType = (shape.type || "").toLowerCase();
    let clipPath: fabric.FabricObject;
    if (shapeType === "triangle") {
      clipPath = new fabric.Triangle({ width: clipW, height: clipH, ...common });
    } else if (shapeType === "polygon") {
      // Reuse the polygon's own points, scaled so its bounding box matches the
      // visible footprint — masks the image to the exact polygon/star outline.
      const pts = (shape as fabric.Polygon).points ?? [];
      const baseW = (shape.width ?? clipW) || clipW;
      const baseH = (shape.height ?? clipH) || clipH;
      clipPath = new fabric.Polygon(pts, {
        ...common,
        scaleX: clipW / baseW,
        scaleY: clipH / baseH,
      });
    } else if (clip === "circle") {
      clipPath = new fabric.Circle({ radius: Math.min(clipW, clipH) / 2, ...common });
    } else {
      clipPath = new fabric.Rect({
        width: clipW,
        height: clipH,
        rx: rx > 0 ? rx / (shape.scaleX ?? 1) / scale : 0,
        ry: rx > 0 ? rx / (shape.scaleY ?? 1) / scale : 0,
        ...common,
      });
    }
    img.clipPath = clipPath;
  }

  // Preserve the placeholder identity so re-renders keep matching by name.
  const a = img as AnyObject;
  a.bnzName = shape.bnzName;
  a.bnzClip = clip;
  a.bnzImageFit = fit;
  a.bnzImageAlign = align;
  (img as unknown as { bnzPlaceholder?: unknown }).bnzPlaceholder = (
    shape as unknown as { bnzPlaceholder?: unknown }
  ).bnzPlaceholder;

  const objects = canvas.getObjects();
  const index = objects.indexOf(shape);
  canvas.remove(shape);
  canvas.add(img);
  // Restore the original stacking position.
  if (index >= 0 && index < objects.length - 1) {
    canvas.moveObjectTo(img, index);
  }
}

// Shrink a text box's font size (and, as a last resort, truncate with an
// ellipsis) so it fits within its width and an optional max height. This
// prevents over-long API values from blowing out the layout.
function fitText(obj: fabric.FabricText & AnyObject) {
  const mode: TextFit = obj.bnzFit ?? "shrink";
  if (mode === "wrap") return;
  const maxHeight = obj.bnzMaxHeight;
  if (!maxHeight || maxHeight <= 0) return;

  const tb = obj as unknown as fabric.Textbox;
  const recompute = () => {
    if (typeof tb.initDimensions === "function") tb.initDimensions();
  };
  const MIN = 8;

  if (mode === "shrink") {
    let size = tb.fontSize ?? 32;
    recompute();
    while ((tb.height ?? 0) > maxHeight && size > MIN) {
      size -= 1;
      tb.set({ fontSize: size });
      recompute();
    }
  }

  // Truncate if still overflowing (covers "truncate" mode and shrink hitting MIN).
  let guard = 0;
  while ((tb.height ?? 0) > maxHeight && (tb.text ?? "").length > 1 && guard < 5000) {
    const t = tb.text ?? "";
    tb.set({ text: t.replace(/…?$/, "").slice(0, -1) + "…" });
    recompute();
    guard += 1;
  }
}

export function findByName(
  canvas: fabric.StaticCanvas | fabric.Canvas,
  name: string,
): AnyObject | undefined {
  return canvas
    .getObjects()
    .find((o) => (o as AnyObject).bnzName === name) as AnyObject | undefined;
}

// A modification "fills" a placeholder only if it carries a usable, non-empty
// value. Empty strings (e.g. a cleared form field) count as not filled.
function modFillsValue(mod: Modification): boolean {
  return (
    (typeof mod.text === "string" && mod.text.trim() !== "") ||
    (typeof mod.color === "string" && mod.color.trim() !== "") ||
    (typeof mod.image_url === "string" && mod.image_url.trim() !== "")
  );
}

export async function applyModifications(
  canvas: fabric.StaticCanvas | fabric.Canvas,
  modifications: Modification[],
) {
  // Which placeholders received a usable value this render.
  const filled = new Set<string>();
  for (const mod of modifications) {
    if (modFillsValue(mod)) filled.add(mod.name);
  }

  // Drop every fillable placeholder that wasn't filled — unless it opted to keep
  // its baked-in default (preset backgrounds). Static (non-placeholder) objects
  // are always kept. Removing up front also avoids loading images we'd discard
  // and keeps shape→image index restoration correct.
  for (const obj of [...canvas.getObjects()] as AnyObject[]) {
    if (!obj.bnzPlaceholder || !obj.bnzName) continue;
    if (obj.bnzKeepDefault) continue;
    if (!filled.has(obj.bnzName)) canvas.remove(obj);
  }

  for (const mod of modifications) {
    if (!modFillsValue(mod)) continue;
    const obj = findByName(canvas, mod.name);
    if (!obj) continue;

    if (mod.text !== undefined && hasText(obj)) {
      obj.set({ text: mod.text });
      fitText(obj as fabric.FabricText & AnyObject);
    }
    if (mod.color !== undefined && !isImage(obj)) {
      obj.set({ fill: mod.color });
    }
    if (mod.image_url !== undefined) {
      const focal = mod.focal_point ?? null;
      if (isImage(obj)) {
        await replaceImageSrc(obj, mod.image_url, focal);
      } else if (isShape(obj)) {
        await fillShapeWithImage(canvas, obj, mod.image_url, focal);
      }
    }
  }
  canvas.requestRenderAll();
}

export function collectFontFamilies(
  canvas: fabric.StaticCanvas | fabric.Canvas,
): string[] {
  const families = new Set<string>();
  for (const obj of canvas.getObjects()) {
    if (hasText(obj) && obj.fontFamily) families.add(obj.fontFamily);
  }
  return [...families];
}

export async function ensureFontsLoaded(families: string[]) {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    families.map((family) =>
      document.fonts.load(`16px "${family}"`).catch(() => undefined),
    ),
  );
  await document.fonts.ready;
}

export async function loadDocIntoCanvas(
  canvas: fabric.StaticCanvas | fabric.Canvas,
  doc: TemplateDoc,
) {
  canvas.setDimensions({ width: doc.canvas.width, height: doc.canvas.height });
  await canvas.loadFromJSON(doc.fabric);
  if (doc.canvas.backgroundColor) {
    canvas.backgroundColor = doc.canvas.backgroundColor;
  }
  canvas.requestRenderAll();
}

// Render a template document exactly as designed (no modifications applied, so
// placeholder layers keep their baked-in defaults) — used for list/grid preview
// thumbnails. multiplier scales the output (e.g. 0.3 for a small thumb).
export async function renderTemplatePreview(
  doc: TemplateDoc,
  options: { multiplier?: number } = {},
): Promise<string> {
  const { multiplier = 1 } = options;
  const el = document.createElement("canvas");
  const canvas = new fabric.StaticCanvas(el, {
    width: doc.canvas.width,
    height: doc.canvas.height,
    enableRetinaScaling: false,
  });
  await loadDocIntoCanvas(canvas, doc);
  await ensureFontsLoaded(collectFontFamilies(canvas));
  canvas.renderAll();
  const dataUrl = canvas.toDataURL({ format: "png", multiplier, quality: 0.9 });
  canvas.dispose();
  return dataUrl;
}

export interface RenderOptions {
  // "jpeg"/"webp" are passed straight to the Chromium canvas, which encodes
  // both natively; quality applies to the lossy encoders (jpeg, webp).
  format?: "png" | "jpeg" | "webp";
  multiplier?: number;
  quality?: number;
  // @font-face rules (with the font bytes inlined as data: URLs) for the user's
  // uploaded / Google-imported fonts. Injected before fonts are awaited so the
  // headless renderer can use them without authenticating against /api/files.
  fontFaceCss?: string;
}

// Inject (or replace) the custom-font @font-face block. Pages are pooled and
// reused across jobs, so we REPLACE the block each render rather than append —
// otherwise one job's fonts would leak into the next.
async function injectFontFaceCss(css: string): Promise<void> {
  if (typeof document === "undefined") return;
  let style = document.getElementById("bnz-custom-fonts") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "bnz-custom-fonts";
    document.head.appendChild(style);
  }
  style.textContent = css;
}

export async function renderTemplateToDataURL(
  doc: TemplateDoc,
  modifications: Modification[],
  options: RenderOptions = {},
): Promise<string> {
  const { format = "png", multiplier = 1, quality = 0.92 } = options;

  const el = document.createElement("canvas");
  const canvas = new fabric.StaticCanvas(el, {
    width: doc.canvas.width,
    height: doc.canvas.height,
    enableRetinaScaling: false,
  });

  await loadDocIntoCanvas(canvas, doc);
  await applyModifications(canvas, modifications);
  if (options.fontFaceCss) await injectFontFaceCss(options.fontFaceCss);
  await ensureFontsLoaded(collectFontFamilies(canvas));

  canvas.renderAll();

  // Fabric types `format` as png|jpeg, but the underlying Chromium canvas also
  // encodes webp natively — cast so the value passes through at runtime.
  const dataUrl = canvas.toDataURL({
    format: format as "png" | "jpeg",
    multiplier,
    quality,
  });
  canvas.dispose();
  return dataUrl;
}
