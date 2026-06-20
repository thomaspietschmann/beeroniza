import { z } from "zod";
import { prisma } from "@/lib/db";
import { templateDocSchema } from "@/lib/template/schema";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";

export const GET = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const template = await prisma.template.findFirst({
    where: { id, userId },
  });
  if (!template) return notFound();
  return json({ template });
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  width: z.number().int().positive().max(8000).optional(),
  height: z.number().int().positive().max(8000).optional(),
  data: templateDocSchema.optional(),
});

export const PUT = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const existing = await prisma.template.findFirst({ where: { id, userId } });
  if (!existing) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update", parsed.error.issues);

  const { name, width, height, data } = parsed.data;
  const template = await prisma.template.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(data !== undefined ? { data: data as object } : {}),
    },
  });
  return json({ template });
});

export const DELETE = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const existing = await prisma.template.findFirst({ where: { id, userId } });
  if (!existing) return notFound();

  await prisma.template.delete({ where: { id } });
  return json({ ok: true });
});
