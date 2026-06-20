import { z } from "zod";
import { env } from "./env";
import type { Modification } from "./template/schema";

// A usage stores input VALUES keyed by placeholder key (not a baked image), so
// it always re-renders against the current template.
export const usageValueSchema = z.object({
  text: z.string().optional(),
  fileId: z.string().optional(),
  color: z.string().optional(),
  // Face gravity: when enabled for an image value, cover-cropping keeps the
  // stored focal point (0..1) in view. The focal point is copied from the
  // picked file (detected face center) so the renderer needs no DB lookup.
  faceGravity: z.boolean().optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
});

export const usageValuesSchema = z.record(z.string(), usageValueSchema);
export type UsageValues = z.infer<typeof usageValuesSchema>;

// Convert stored values into the render `modifications` array. Image values are
// referenced by stored fileId and resolved to a same-origin file URL.
export function usageValuesToModifications(values: UsageValues): Modification[] {
  const mods: Modification[] = [];
  for (const [name, v] of Object.entries(values ?? {})) {
    if (!v) continue;
    if (typeof v.text === "string" && v.text.length > 0) {
      mods.push({ name, text: v.text });
    } else if (v.fileId) {
      const mod: Modification = { name, image_url: `${env.appUrl}/api/files/${v.fileId}` };
      if (v.faceGravity && typeof v.focalX === "number" && typeof v.focalY === "number") {
        mod.focal_point = { x: v.focalX, y: v.focalY };
      }
      mods.push(mod);
    } else if (v.color) {
      mods.push({ name, color: v.color });
    }
  }
  return mods;
}

// Collect the uploaded file ids referenced by a usage (for cleanup on delete).
export function fileIdsOf(values: UsageValues): string[] {
  const ids: string[] = [];
  for (const v of Object.values(values ?? {})) {
    if (v?.fileId) ids.push(v.fileId);
  }
  return ids;
}
