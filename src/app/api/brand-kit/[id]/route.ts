import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const paletteSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  colors: z.array(hexColor).max(48),
});
const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  isDefault: z.literal(true).optional(),
  palettes: z.array(paletteSchema).max(20).optional(),
  fonts: z.array(z.string().min(1).max(120)).max(48).optional(),
});

// Returns the full kit (with palettes + fonts).
export const GET = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const kit = await prisma.brandKit.findFirst({ where: { id, userId } });
  if (!kit) return notFound();
  return json({ id: kit.id, name: kit.name, isDefault: kit.isDefault, palettes: kit.palettes, fonts: kit.fonts });
});

// Updates name, palettes, fonts, or promotes this kit to default.
export const PUT = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const kit = await prisma.brandKit.findFirst({ where: { id, userId } });
  if (!kit) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update", parsed.error.issues);

  // Setting isDefault = true: unset all other kits for this user first.
  if (parsed.data.isDefault) {
    await prisma.brandKit.updateMany({ where: { userId, NOT: { id } }, data: { isDefault: false } });
  }

  const updated = await prisma.brandKit.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.isDefault ? { isDefault: true } : {}),
      ...(parsed.data.palettes !== undefined ? { palettes: parsed.data.palettes } : {}),
      ...(parsed.data.fonts !== undefined ? { fonts: parsed.data.fonts } : {}),
    },
  });
  return json({ id: updated.id, name: updated.name, isDefault: updated.isDefault, palettes: updated.palettes, fonts: updated.fonts });
});

// Deletes the kit. The default kit cannot be deleted if other kits exist.
export const DELETE = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const kit = await prisma.brandKit.findFirst({ where: { id, userId } });
  if (!kit) return notFound();

  if (kit.isDefault) {
    const otherCount = await prisma.brandKit.count({ where: { userId, NOT: { id } } });
    if (otherCount > 0) return badRequest("Cannot delete the default kit — set another kit as default first.");
  }

  await prisma.brandKit.delete({ where: { id } });

  // If the user still has kits but none is default, promote the most-recently
  // updated one (handles edge cases after bulk deletes or manual DB changes).
  const remaining = await prisma.brandKit.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
  if (remaining) {
    await prisma.brandKit.update({ where: { id: remaining.id }, data: { isDefault: true } });
  }

  return json({ ok: true });
});
