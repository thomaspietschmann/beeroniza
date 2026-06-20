import crypto from "node:crypto";
import { prisma } from "./db";
import type { User } from "@prisma/client";

const KEY_PREFIX = "bnz_";

export function hashKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

// Returns the plaintext key (shown to the user exactly once), the visible
// prefix, and the stored hash.
export function generateApiKey(): {
  plaintext: string;
  prefix: string;
  hashedKey: string;
} {
  const secret = crypto.randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX}${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 12),
    hashedKey: hashKey(plaintext),
  };
}

// Validates an Authorization header (or raw token) and returns the owning user,
// or null. Rejects revoked and expired keys.
export async function authenticateApiKey(
  authHeader: string | null,
): Promise<User | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = (match ? match[1] : authHeader).trim();
  if (!token) return null;

  const key = await prisma.apiKey.findUnique({
    where: { hashedKey: hashKey(token) },
    include: { user: true },
  });
  if (!key || key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null;

  // Best-effort last-used timestamp; don't block the request on it.
  void prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return key.user;
}
