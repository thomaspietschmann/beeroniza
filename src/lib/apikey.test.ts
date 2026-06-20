import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { hashKey, generateApiKey } from "./apikey";

describe("apikey", () => {
  it("hashKey is deterministic sha256 hex", () => {
    expect(hashKey("abc")).toBe(
      crypto.createHash("sha256").update("abc").digest("hex"),
    );
    expect(hashKey("abc")).toHaveLength(64);
  });

  it("generateApiKey produces a bnz_ key whose stored hash matches the plaintext", () => {
    const { plaintext, prefix, hashedKey } = generateApiKey();
    expect(plaintext.startsWith("bnz_")).toBe(true);
    expect(prefix).toBe(plaintext.slice(0, 12));
    expect(hashedKey).toBe(hashKey(plaintext));
  });
});
