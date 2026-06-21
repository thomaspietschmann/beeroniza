import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";
import { LOCK_TTL_MS, type LockInfo } from "@/lib/template-lock";

const lockSchema = z.object({
  action: z.enum(["acquire", "heartbeat", "release"]),
  force: z.boolean().optional(),
});

async function currentLockInfo(id: string): Promise<LockInfo | null> {
  const t = await prisma.template.findFirst({
    where: { id },
    include: { lockedBy: { select: { name: true } } },
  });
  if (!t?.lockedById || !t.lockedAt) return null;
  return {
    lockedById: t.lockedById,
    lockedByName: t.lockedBy?.name ?? null,
    lockedAt: t.lockedAt.toISOString(),
  };
}

export const POST = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const body = await req.json().catch(() => null);
  const parsed = lockSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid lock action", parsed.error.issues);

  const { action, force } = parsed.data;

  const existing = await prisma.template.findFirst({ where: { id } });
  if (!existing) return notFound();

  if (action === "release") {
    await prisma.template.updateMany({
      where: { id, lockedById: userId },
      data: { lockedById: null, lockedAt: null },
    });
    return json({ ok: true });
  }

  if (action === "acquire") {
    if (force) {
      await prisma.template.update({
        where: { id },
        data: { lockedById: userId, lockedAt: new Date() },
      });
      return json({ ok: true });
    }

    const staleThreshold = new Date(Date.now() - LOCK_TTL_MS);
    const result = await prisma.template.updateMany({
      where: {
        id,
        OR: [
          { lockedById: null },
          { lockedById: userId },
          { lockedAt: { lt: staleThreshold } },
        ],
      },
      data: { lockedById: userId, lockedAt: new Date() },
    });

    if (result.count === 0) {
      const lock = await currentLockInfo(id);
      return json({ ok: false, lock }, 409);
    }
    return json({ ok: true });
  }

  // heartbeat
  const result = await prisma.template.updateMany({
    where: { id, lockedById: userId },
    data: { lockedAt: new Date() },
  });

  if (result.count === 0) {
    const lock = await currentLockInfo(id);
    return json({ ok: false, lock }, 409);
  }
  return json({ ok: true });
});
