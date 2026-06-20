import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";

export const GET = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const template = await prisma.template.findFirst({ where: { id } });
  if (!template) return notFound();

  const usages = await prisma.usage.findMany({
    where: { templateId: id, userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return json({ usages });
});

const createSchema = z.object({ name: z.string().min(1).max(200) });

export const POST = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const template = await prisma.template.findFirst({ where: { id } });
  if (!template) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid usage", parsed.error.issues);

  const usage = await prisma.usage.create({
    data: { userId, templateId: id, name: parsed.data.name, values: {} },
    select: { id: true, name: true },
  });
  return json({ usage }, 201);
});
