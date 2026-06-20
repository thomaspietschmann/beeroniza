import { describe, it, expect } from "vitest";
import {
  modificationSchema,
  templateDocSchema,
  placeholdersOf,
  SCHEMA_VERSION,
} from "./schema";

describe("modificationSchema", () => {
  it("accepts text, hex color, and http(s) + data:image URLs", () => {
    expect(modificationSchema.safeParse({ name: "t", text: "x" }).success).toBe(true);
    expect(modificationSchema.safeParse({ name: "c", color: "#abcdef" }).success).toBe(true);
    expect(modificationSchema.safeParse({ name: "i", image_url: "https://e.com/a.png" }).success).toBe(true);
    expect(
      modificationSchema.safeParse({ name: "i", image_url: "data:image/png;base64,AAAA" }).success,
    ).toBe(true);
  });

  it("rejects bad colors, non-http(s)/data image urls, and missing name", () => {
    expect(modificationSchema.safeParse({ name: "c", color: "red" }).success).toBe(false);
    expect(modificationSchema.safeParse({ name: "i", image_url: "ftp://x" }).success).toBe(false);
    expect(modificationSchema.safeParse({ text: "x" }).success).toBe(false);
  });
});

describe("templateDocSchema + placeholdersOf", () => {
  it("validates a minimal doc and reads its placeholders", () => {
    const doc = {
      schemaVersion: SCHEMA_VERSION,
      canvas: { width: 1200, height: 630 },
      fabric: {},
      placeholders: [{ key: "title", type: "text" }],
    };
    const r = templateDocSchema.safeParse(doc);
    expect(r.success).toBe(true);
    if (r.success) expect(placeholdersOf(r.data)).toHaveLength(1);
  });

  it("derives placeholders from fabric layers when the index is empty", () => {
    const doc = {
      schemaVersion: SCHEMA_VERSION,
      canvas: { width: 1200, height: 630 },
      fabric: {
        objects: [
          { type: "Rect", bnzName: "bar" }, // static, no placeholder → ignored
          { type: "Textbox", bnzName: "title", text: "Hi", bnzPlaceholder: { kind: "text", label: "Title" } },
          { type: "Image", bnzName: "logo", bnzPlaceholder: { kind: "image", label: "Logo" } },
        ],
      },
      placeholders: [],
    };
    const r = templateDocSchema.safeParse(doc);
    expect(r.success).toBe(true);
    if (r.success) {
      const ph = placeholdersOf(r.data);
      expect(ph.map((p) => p.key)).toEqual(["title", "logo"]);
      expect(ph[0]).toMatchObject({ key: "title", type: "text", label: "Title", defaultValue: "Hi" });
      expect(ph[1]).toMatchObject({ key: "logo", type: "image", label: "Logo" });
    }
  });

  it("rejects non-positive canvas dimensions", () => {
    expect(
      templateDocSchema.safeParse({
        schemaVersion: SCHEMA_VERSION,
        canvas: { width: 0, height: 630 },
        fabric: {},
      }).success,
    ).toBe(false);
  });
});
