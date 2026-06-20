import { prisma } from "@/lib/db";
import { withUserParams, notFound, json } from "@/lib/api-helpers";

// Lightweight template fetch for the thumbnail grid: returns only the canvas doc
// and its dimensions, so rendering many thumbnails doesn't pull the full
// template rows (name, platform, timestamps, …) the grid doesn't use.
export const GET = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const template = await prisma.template.findFirst({
    where: { id, userId },
    select: { data: true, width: true, height: true },
  });
  if (!template) return notFound();
  return json(template);
});
