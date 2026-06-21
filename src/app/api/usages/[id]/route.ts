import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { usageValuesSchema, fileIdsOf, type UsageValues } from "@/lib/usages";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";

// Returns the usage plus its template (incl. data) so the fill view can render a
// live preview against the CURRENT template.
export const GET = withUserParams<{ id: string }>(async (_req, _userId, { id }) => {
  const usage = await prisma.usage.findUnique({
    where: { id },
    include: { template: true },
  });
  if (!usage) return notFound();

  return json({
    usage: { id: usage.id, name: usage.name, values: usage.values, templateId: usage.templateId, brandKitId: usage.brandKitId },
    template: {
      id: usage.template.id,
      name: usage.template.name,
      width: usage.template.width,
      height: usage.template.height,
      data: usage.template.data,
    },
  });
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  values: usageValuesSchema.optional(),
});

export const PUT = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const existing = await prisma.usage.findUnique({ where: { id } });
  if (!existing) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update", parsed.error.issues);

  const usage = await prisma.usage.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.values !== undefined
        ? { values: parsed.data.values as unknown as Prisma.InputJsonValue }
        : {}),
    },
    select: { id: true, name: true, values: true },
  });
  return json({ usage });
});

export const DELETE = withUserParams<{ id: string }>(async (_req, _userId, { id }) => {
  const existing = await prisma.usage.findUnique({ where: { id } });
  if (!existing) return notFound();

  // Best-effort cleanup of uploaded assets this usage referenced.
  const ids = fileIdsOf(existing.values as UsageValues);
  await prisma.usage.delete({ where: { id } });
  if (ids.length) {
    await prisma.storedFile
      .deleteMany({ where: { id: { in: ids }, userId: existing.userId, kind: "UPLOAD" } })
      .catch(() => undefined);
  }
  return json({ ok: true });
});
