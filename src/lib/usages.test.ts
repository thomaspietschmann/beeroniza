import { describe, it, expect } from "vitest";
import { usageValuesToModifications, fileIdsOf } from "./usages";

describe("usageValuesToModifications", () => {
  it("maps text / image (by fileId) / color values to modifications", () => {
    const mods = usageValuesToModifications({
      title: { text: "Hi" },
      avatar: { fileId: "abc" },
      bg: { color: "#ffffff" },
    });
    expect(mods).toContainEqual({ name: "title", text: "Hi" });
    expect(mods).toContainEqual({ name: "bg", color: "#ffffff" });
    const avatar = mods.find((m) => m.name === "avatar");
    expect(avatar?.image_url).toMatch(/\/api\/files\/abc$/);
  });

  it("skips empty values", () => {
    expect(usageValuesToModifications({ a: {}, b: { text: "" } })).toEqual([]);
  });
});

describe("fileIdsOf", () => {
  it("collects only the referenced file ids", () => {
    expect(
      fileIdsOf({ a: { fileId: "x" }, b: { text: "t" }, c: { fileId: "y" } }),
    ).toEqual(["x", "y"]);
  });
});
