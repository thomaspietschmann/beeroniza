import { prisma } from "@/lib/db";
import { withUserParams, notFound, json } from "@/lib/api-helpers";

// Duplicate a template into a new, independent copy owned by the same user.
export const POST = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const src = await prisma.template.findFirst({ where: { id, userId } });
  if (!src) return notFound();

  const copy = await prisma.template.create({
    data: {
      userId,
      name: `${src.name} (copy)`,
      description: src.description,
      platform: src.platform,
      formatLabel: src.formatLabel,
      width: src.width,
      height: src.height,
      data: src.data as object,
    },
    select: { id: true, name: true },
  });

  return json({ id: copy.id, name: copy.name }, 201);
});
