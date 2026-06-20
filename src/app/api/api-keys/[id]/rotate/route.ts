import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/apikey";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";

const rotateSchema = z
  .object({
    // Optionally set a new expiration on rotation.
    expiresAt: z.string().datetime().nullish(),
  })
  .nullish();

// Rotate a key: issue a new secret for the same record and invalidate the old
// secret immediately. The new plaintext is returned exactly once.
export const POST = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const existing = await prisma.apiKey.findFirst({ where: { id, userId } });
  if (!existing) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = rotateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid rotation", parsed.error.issues);

  const { plaintext, prefix, hashedKey } = generateApiKey();
  const key = await prisma.apiKey.update({
    where: { id },
    data: {
      prefix,
      hashedKey,
      rotatedAt: new Date(),
      revokedAt: null,
      lastUsedAt: null,
      ...(parsed.data && parsed.data.expiresAt !== undefined
        ? { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null }
        : {}),
    },
    select: { id: true, name: true, prefix: true, expiresAt: true, rotatedAt: true },
  });

  return json({ key, plaintext });
});
