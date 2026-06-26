import { z } from "zod";
import { prisma } from "@/lib/db";
import { templateDocSchema } from "@/lib/template/schema";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";
import { lockBlockingWrite } from "@/lib/template-lock-server";

export const GET = withUserParams<{ id: string }>(async (_req, _userId, { id }) => {
  const template = await prisma.template.findFirst({
    where: { id },
  });
  if (!template) return notFound();
  return json({ template });
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  width: z.number().int().positive().max(8000).optional(),
  height: z.number().int().positive().max(8000).optional(),
  data: templateDocSchema.optional(),
  // When set, the update is conditional: if updatedAt no longer matches, 409 is returned.
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const PUT = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const existing = await prisma.template.findFirst({ where: { id } });
  if (!existing) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update", parsed.error.issues);

  const { name, width, height, data, expectedUpdatedAt } = parsed.data;
  const updateData = {
    ...(name !== undefined ? { name } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(data !== undefined ? { data: data as object } : {}),
  };

  // Soft-lock guard: reject the write if another user currently holds the lock.
  const blocking = await lockBlockingWrite(id, userId);
  if (blocking) return json({ error: "locked", lock: blocking }, 409);

  if (expectedUpdatedAt !== undefined) {
    const result = await prisma.template.updateMany({
      where: { id, updatedAt: new Date(expectedUpdatedAt) },
      data: updateData,
    });
    if (result.count === 0) {
      const current = await prisma.template.findFirst({ where: { id } });
      return json({ error: "conflict", current }, 409);
    }
    const template = await prisma.template.findFirst({ where: { id } });
    return json({ template });
  }

  const template = await prisma.template.update({ where: { id }, data: updateData });
  return json({ template });
});

export const DELETE = withUserParams<{ id: string }>(async (_req, _userId, { id }) => {
  const existing = await prisma.template.findFirst({ where: { id } });
  if (!existing) return notFound();

  await prisma.template.delete({ where: { id } });
  return json({ ok: true });
});
