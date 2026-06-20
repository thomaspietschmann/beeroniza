import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser, badRequest, json } from "@/lib/api-helpers";

// Returns the current user's brand kit (empty when none saved yet).
export const GET = withUser(async (_req, userId) => {
  const kit = await prisma.brandKit.findUnique({ where: { userId } });
  return json({ colors: kit?.colors ?? [], fonts: kit?.fonts ?? [] });
});

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const updateSchema = z.object({
  colors: z.array(hexColor).max(48).optional(),
  fonts: z.array(z.string().min(1).max(120)).max(48).optional(),
});

// Replaces the saved colors and/or fonts for the current user.
export const PUT = withUser(async (req, userId) => {
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid brand kit", parsed.error.issues);

  const data = {
    ...(parsed.data.colors !== undefined ? { colors: parsed.data.colors } : {}),
    ...(parsed.data.fonts !== undefined ? { fonts: parsed.data.fonts } : {}),
  };
  const kit = await prisma.brandKit.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return json({ colors: kit.colors, fonts: kit.fonts });
});
