import { z } from "zod";
import { prisma } from "@/lib/db";
import { usageValuesToModifications, type UsageValues } from "@/lib/usages";
import { createGeneration, GenerationQuotaError } from "@/lib/generations";
import { outputFormatSchema } from "@/lib/template/schema";
import { withUserParams, notFound, json } from "@/lib/api-helpers";

const bodySchema = z.object({ format: outputFormatSchema }).partial();

// Render this usage against the CURRENT template and queue a generation.
export const POST = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const usage = await prisma.usage.findFirst({ where: { id, userId } });
  if (!usage) return notFound();

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  const format = parsed.success && parsed.data.format ? parsed.data.format : "png";

  let generation;
  try {
    generation = await createGeneration({
      userId,
      templateId: usage.templateId,
      usageId: usage.id,
      modifications: usageValuesToModifications(usage.values as UsageValues),
      format,
    });
  } catch (err) {
    if (err instanceof GenerationQuotaError) return json({ error: err.message }, 429);
    throw err;
  }
  if (!generation) return notFound();

  return json({ id: generation.id, status: "queued" }, 202);
});
