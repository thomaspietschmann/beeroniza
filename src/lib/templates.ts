import { SCHEMA_VERSION, type TemplateDoc } from "./template/schema";

// A blank canvas document for a freshly created template.
export function emptyTemplateDoc(
  width: number,
  height: number,
  backgroundColor = "#ffffff",
): TemplateDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    canvas: { width, height, backgroundColor },
    fabric: {
      version: "6.0.0",
      objects: [],
      background: backgroundColor,
    },
    placeholders: [],
  };
}
