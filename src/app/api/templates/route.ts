import { z } from "zod";
import { prisma } from "@/lib/db";
import { emptyTemplateDoc } from "@/lib/templates";
import { withUser, badRequest, json } from "@/lib/api-helpers";

export const GET = withUser(async (_req, userId) => {
  const templates = await prisma.template.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      platform: true,
      formatLabel: true,
      width: true,
      height: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  return json({ templates });
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  width: z.number().int().positive().max(8000),
  height: z.number().int().positive().max(8000),
  backgroundColor: z.string().optional(),
  platform: z.string().max(100).optional(),
  formatLabel: z.string().max(100).optional(),
});

export const POST = withUser(async (req, userId) => {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid template", parsed.error.issues);

  const { name, width, height, backgroundColor, platform, formatLabel } = parsed.data;
  const template = await prisma.template.create({
    data: {
      userId,
      name,
      width,
      height,
      platform: platform || null,
      formatLabel: formatLabel || null,
      data: emptyTemplateDoc(width, height, backgroundColor) as object,
    },
    select: { id: true, name: true, platform: true, formatLabel: true, width: true, height: true },
  });

  return json({ template }, 201);
});
