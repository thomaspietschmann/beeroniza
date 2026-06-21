import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  isDefault: z.literal(true).optional(),
  colors: z.array(hexColor).max(48).optional(),
  fonts: z.array(z.string().min(1).max(120)).max(48).optional(),
});

// Returns the full kit. Instance-wide access.
export const GET = withUserParams<{ id: string }>(async (_req, _userId, { id }) => {
  const kit = await prisma.brandKit.findUnique({ where: { id } });
  if (!kit) return notFound();
  return json({ id: kit.id, name: kit.name, isDefault: kit.isDefault, colors: kit.colors, fonts: kit.fonts });
});

// Updates name, colors, fonts, or promotes this kit to default.
export const PUT = withUserParams<{ id: string }>(async (req, _userId, { id }) => {
  const kit = await prisma.brandKit.findUnique({ where: { id } });
  if (!kit) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update", parsed.error.issues);

  // Setting isDefault = true: unset all other kits instance-wide first.
  if (parsed.data.isDefault) {
    await prisma.brandKit.updateMany({ where: { NOT: { id } }, data: { isDefault: false } });
  }

  const updated = await prisma.brandKit.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.isDefault ? { isDefault: true } : {}),
      ...(parsed.data.colors !== undefined ? { colors: parsed.data.colors } : {}),
      ...(parsed.data.fonts !== undefined ? { fonts: parsed.data.fonts } : {}),
    },
  });
  return json({ id: updated.id, name: updated.name, isDefault: updated.isDefault, colors: updated.colors, fonts: updated.fonts });
});

// Deletes the kit. Promotes another to default if this was the default.
export const DELETE = withUserParams<{ id: string }>(async (_req, _userId, { id }) => {
  const kit = await prisma.brandKit.findUnique({ where: { id } });
  if (!kit) return notFound();

  if (kit.isDefault) {
    const otherCount = await prisma.brandKit.count({ where: { NOT: { id } } });
    if (otherCount > 0) return badRequest("Cannot delete the default kit — set another kit as default first.");
  }

  await prisma.brandKit.delete({ where: { id } });

  // Promote another kit to default if any remain.
  const remaining = await prisma.brandKit.findFirst({ orderBy: { updatedAt: "desc" } });
  if (remaining) {
    await prisma.brandKit.update({ where: { id: remaining.id }, data: { isDefault: true } });
  }

  return json({ ok: true });
});
