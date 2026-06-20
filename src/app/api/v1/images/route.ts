import { z } from "zod";
import { env } from "@/lib/env";
import {
  modificationsSchema,
  outputFormatSchema,
} from "@/lib/template/schema";
import { createGeneration, serializeGeneration } from "@/lib/generations";
import { withApiKey, badRequest, json } from "@/lib/api-helpers";

const bodySchema = z.object({
  template_id: z.string().min(1),
  modifications: modificationsSchema,
  format: outputFormatSchema,
  webhook_url: z.string().url().nullish(),
});

// POST /api/v1/images — submit an asynchronous render job.
// Returns 202 with the generation; poll GET /api/v1/images/:id or supply a
// webhook_url to be notified on completion.
export const POST = withApiKey(async (req, user) => {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request", parsed.error.issues);

  const generation = await createGeneration({
    userId: user.id,
    templateId: parsed.data.template_id,
    modifications: parsed.data.modifications,
    format: parsed.data.format,
    webhookUrl: parsed.data.webhook_url ?? null,
  });
  if (!generation) return json({ error: "Template not found" }, 404);

  // createGeneration returns the freshly-created row, which already has every
  // field serializeGeneration reads — no second query needed.
  return json(serializeGeneration(generation, env.appUrl), 202);
});
