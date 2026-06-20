import { prisma } from "@/lib/db";
import { withUserParams, notFound, json } from "@/lib/api-helpers";

// Revoke a key (soft-delete so it can no longer authenticate).
export const DELETE = withUserParams<{ id: string }>(async (_req, userId, { id }) => {
  const key = await prisma.apiKey.findFirst({ where: { id, userId } });
  if (!key) return notFound();

  await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return json({ ok: true });
});
