import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { serializeGeneration } from "@/lib/generations";
import { withUserParams, notFound, json } from "@/lib/api-helpers";

export const GET = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const gen = await prisma.imageGeneration.findFirst({
    where: { id, userId },
  });
  if (!gen) return notFound();

  return json(serializeGeneration(gen, env.appUrl));
});
