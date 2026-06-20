import { z } from "zod";
import {
  modificationsSchema,
  outputFormatSchema,
} from "@/lib/template/schema";
import { createGeneration } from "@/lib/generations";
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

  const generation = await createGeneration({
    userId,
    templateId: id,
    modifications: parsed.data.modifications,
    format: parsed.data.format,
  });
  if (!generation) return notFound();

  return json({ id: generation.id, status: "queued" }, 202);
});
