import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/apikey";
import { withUser, badRequest, json } from "@/lib/api-helpers";

export const GET = withUser(async (_req, userId) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      rotatedAt: true,
      createdAt: true,
    },
  });
  return json({ keys });
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  // ISO date string or null/omitted for "never expires".
  expiresAt: z.string().datetime().nullish(),
});

export const POST = withUser(async (req, userId) => {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid API key", parsed.error.issues);

  const { plaintext, prefix, hashedKey } = generateApiKey();
  const key = await prisma.apiKey.create({
    data: {
      userId,
      name: parsed.data.name,
      prefix,
      hashedKey,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
    select: { id: true, name: true, prefix: true, expiresAt: true, createdAt: true },
  });

  // The plaintext key is returned exactly once.
  return json({ key, plaintext }, 201);
});
