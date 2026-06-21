import { z } from "zod";
import {
  modificationsSchema,
  outputFormatSchema,
} from "@/lib/template/schema";
import { createGeneration, GenerationQuotaError } from "@/lib/generations";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";

const bodySchema = z.object({
  modifications: modificationsSchema,
  format: outputFormatSchema,
});

// Internal endpoint used by the fill-in UI to queue a render.
export const POST = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) return badRequest("Invalid request", parsed.error.issues);

  let generation;
  try {
    generation = await createGeneration({
      userId,
      templateId: id,
      modifications: parsed.data.modifications,
      format: parsed.data.format,
    });
  } catch (err) {
    if (err instanceof GenerationQuotaError) return json({ error: err.message }, 429);
    throw err;
  }
  if (!generation) return notFound();

  return json({ id: generation.id, status: "queued" }, 202);
});
