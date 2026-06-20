import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { serializeGeneration } from "@/lib/generations";
import { withApiKeyParams, notFound, json } from "@/lib/api-helpers";

// GET /api/v1/images/:id — poll a generation's status / result.
export const GET = withApiKeyParams<{ id: string }>(async (_req, user, { id }) => {
  const gen = await prisma.imageGeneration.findFirst({
    where: { id, userId: user.id },
  });
  if (!gen) return notFound();

  return json(serializeGeneration(gen, env.appUrl));
});
