import * as fabric from "fabric";
import type { ClipShape, PlaceholderType } from "@/lib/template/schema";

// The custom per-object metadata we attach to Fabric objects. These are
// declared in BNZ_PROPS (see fabric-render.ts) and round-trip through
// canvas.toJSON(BNZ_PROPS).
export interface BnzPlaceholder {
  type: PlaceholderType;
  label?: string;
}

// A Fabric object carrying our custom props. Fabric objects are plain enough
// that we just intersect the extra fields on top.
export type TextFit = "shrink" | "truncate" | "wrap";
export type ImageFit = "cover" | "contain";
export type ImageAlign = "left" | "center" | "right";

export type EditorObject = fabric.FabricObject & {
  bnzName?: string;
  bnzPlaceholder?: BnzPlaceholder;
  bnzClip?: ClipShape;
  bnzFit?: TextFit;
  bnzMaxHeight?: number;
  bnzImageFit?: ImageFit;
  bnzImageAlign?: ImageAlign;
};

export interface FontInfo {
  family: string;
  category: string;
  bundled: boolean;
}

export interface TemplateResponse {
  template: {
    id: string;
    name: string;
    width: number;
    height: number;
    data: unknown;
  };
}

export type ObjectKind =
  | "text"
  | "image"
  | "rect"
  | "circle"
  | "triangle"
  | "polygon"
  | "line"
  | "other";

export function objectKind(obj: fabric.FabricObject): ObjectKind {
  const t = (obj.type || "").toLowerCase();
  if (t === "image") return "image";
  if (t === "textbox" || t === "i-text" || t === "text") return "text";
  if (t === "rect") return "rect";
  if (t === "circle" || t === "ellipse") return "circle";
  if (t === "triangle") return "triangle";
  if (t === "polygon") return "polygon";
  if (t === "line") return "line";
  return "other";
}

// Shapes that take a fill/stroke and can act as image frames or color slots.
export function isShapeKind(kind: ObjectKind): boolean {
  return (
    kind === "rect" ||
    kind === "circle" ||
    kind === "triangle" ||
    kind === "polygon" ||
    kind === "line"
  );
}

export function isImage(obj: fabric.FabricObject): obj is fabric.FabricImage {
  return objectKind(obj) === "image";
}

export function isText(
  obj: fabric.FabricObject,
): obj is fabric.Textbox | fabric.IText | fabric.FabricText {
  return objectKind(obj) === "text";
}

let counter = 0;
// Generate a readable, unique default layer name.
export function nextLayerName(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function displayName(obj: EditorObject): string {
  if (obj.bnzName) return obj.bnzName;
  return objectKind(obj);
}
