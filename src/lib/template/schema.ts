import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// The template document is the central contract shared by the editor, the
// renderer and the API.
//
// A template stores the raw Fabric.js canvas JSON (so the server renderer can
// reproduce the editor preview pixel-for-pixel by loading the exact same JSON),
// plus a derived list of *placeholders*: named layers whose text / image / fill
// can be overridden per generation.
//
// Custom per-object properties we add to Fabric objects and persist:
//   bnzName        – stable, human-friendly layer name (used by the API)
//   bnzPlaceholder – marks the layer as fillable and declares its kind
//   bnzClip        – how an image layer is clipped (rect | circle | rounded)
// ─────────────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1 as const;

export const placeholderTypeSchema = z.enum(["text", "image", "color"]);
export type PlaceholderType = z.infer<typeof placeholderTypeSchema>;

export const clipShapeSchema = z.enum(["rect", "rounded", "circle"]);
export type ClipShape = z.infer<typeof clipShapeSchema>;

export const placeholderSchema = z.object({
  // Stable key referenced by API modifications and the fill-in UI.
  key: z.string().min(1).max(120),
  type: placeholderTypeSchema,
  // Human-readable label shown in the UI.
  label: z.string().max(200).optional(),
  // Default value used when no modification is supplied.
  defaultValue: z.string().optional(),
});
export type PlaceholderDef = z.infer<typeof placeholderSchema>;

export const templateDocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  canvas: z.object({
    width: z.number().int().positive().max(8000),
    height: z.number().int().positive().max(8000),
    backgroundColor: z.string().optional(),
  }),
  // Raw Fabric.js canvas serialization (canvas.toJSON()). Opaque to the API
  // layer; only the renderer and editor interpret it.
  fabric: z.record(z.string(), z.unknown()),
  // Derived index of fillable layers, kept in sync by the editor.
  placeholders: z.array(placeholderSchema).default([]),
});
export type TemplateDoc = z.infer<typeof templateDocSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Per-generation modifications — mirrors the well-known "modifications" array:
//   [{ "name": "title", "text": "Hello" },
//    { "name": "avatar", "image_url": "https://…/me.png" },
//    { "name": "bg", "color": "#0b0b0b" }]
// ─────────────────────────────────────────────────────────────────────────

export const modificationSchema = z.object({
  name: z.string().min(1),
  text: z.string().optional(),
  // Either a public http(s) URL or an inline data:image/... URL (so LLM agents
  // can send image bytes directly without a separate upload step).
  image_url: z
    .string()
    .refine(
      (v) => /^(https?:\/\/|data:image\/)/i.test(v),
      "image_url must be an http(s) URL or a data:image/... URL",
    )
    .optional(),
  color: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
    .optional(),
  // Normalized focal point (0..1) of the source image. When present (e.g. a
  // detected face with "gravity" enabled), cover-cropping keeps this point in
  // view and centered instead of cropping around the geometric center.
  focal_point: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
    .optional(),
});
export type Modification = z.infer<typeof modificationSchema>;

export const modificationsSchema = z.array(modificationSchema).default([]);

export const outputFormatSchema = z.enum(["png", "jpg", "webp"]).default("png");
export type OutputFormat = z.infer<typeof outputFormatSchema>;

// Derive the placeholder list directly from the Fabric layers — the canonical
// source the editor itself reads (each fillable layer carries `bnzName` +
// `bnzPlaceholder`). Deriving here keeps the editor view and the usage / API
// view in lock-step even if the stored `placeholders` index is missing or stale.
function placeholdersFromFabric(doc: TemplateDoc): PlaceholderDef[] {
  const objects = (doc.fabric as { objects?: unknown })?.objects;
  if (!Array.isArray(objects)) return [];

  const out: PlaceholderDef[] = [];
  const seen = new Set<string>();
  for (const raw of objects) {
    const o = raw as {
      bnzName?: unknown;
      bnzPlaceholder?: { kind?: unknown; label?: unknown };
      text?: unknown;
      fill?: unknown;
    };
    const ph = o?.bnzPlaceholder;
    const name = typeof o?.bnzName === "string" ? o.bnzName : undefined;
    if (!ph || !name || seen.has(name)) continue;

    const parsed = placeholderTypeSchema.safeParse(ph.kind);
    if (!parsed.success) continue;
    const type = parsed.data;

    const def: PlaceholderDef = { key: name, type };
    if (typeof ph.label === "string") def.label = ph.label;
    // A text layer's current text doubles as its default fill value.
    if (type === "text" && typeof o.text === "string" && o.text) {
      def.defaultValue = o.text;
    }
    // A color layer's fill color is its template default.
    if (type === "color" && typeof o.fill === "string" && o.fill) {
      def.defaultValue = o.fill;
    }
    seen.add(name);
    out.push(def);
  }
  return out;
}

// Helper: the fillable layers of a template document. Prefers the live Fabric
// layers; falls back to the stored `placeholders` index for legacy docs that
// have no marked layers.
export function placeholdersOf(doc: TemplateDoc): PlaceholderDef[] {
  const derived = placeholdersFromFabric(doc);
  if (derived.length > 0) return derived;
  return doc.placeholders ?? [];
}
