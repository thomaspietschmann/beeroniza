import { prisma } from "@/lib/db";
import { LOCK_TTL_MS, isLockStale, type LockInfo } from "@/lib/template-lock";

export type LockResult = { ok: true } | { ok: false; lock: LockInfo | null };

/** Current holder of a template's soft-lock, or null when free. */
export async function currentLockInfo(templateId: string): Promise<LockInfo | null> {
  const lock = await prisma.templateLock.findUnique({
    where: { templateId },
    include: { lockedBy: { select: { name: true } } },
  });
  if (!lock) return null;
  return {
    lockedById: lock.lockedById,
    lockedByName: lock.lockedBy?.name ?? null,
    lockedAt: lock.lockedAt.toISOString(),
  };
}

/**
 * Returns the blocking lock when `userId` may NOT write to the template (someone
 * else holds a fresh lock), or null when the write is allowed (free, owned, or
 * stale lock). Used to guard content mutations.
 */
export async function lockBlockingWrite(templateId: string, userId: string): Promise<LockInfo | null> {
  const lock = await prisma.templateLock.findUnique({
    where: { templateId },
    include: { lockedBy: { select: { name: true } } },
  });
  if (!lock || lock.lockedById === userId || isLockStale(lock.lockedAt)) return null;
  return {
    lockedById: lock.lockedById,
    lockedByName: lock.lockedBy?.name ?? null,
    lockedAt: lock.lockedAt.toISOString(),
  };
}

/** Acquire (or take over a stale/own) lock. `force` always wins. */
export async function acquireLock(templateId: string, userId: string, force = false): Promise<LockResult> {
  const now = new Date();
  if (force) {
    await prisma.templateLock.upsert({
      where: { templateId },
      create: { templateId, lockedById: userId, lockedAt: now },
      update: { lockedById: userId, lockedAt: now },
    });
    return { ok: true };
  }

  // Take over an existing row we own or that has gone stale.
  const staleThreshold = new Date(now.getTime() - LOCK_TTL_MS);
  const taken = await prisma.templateLock.updateMany({
    where: { templateId, OR: [{ lockedById: userId }, { lockedAt: { lt: staleThreshold } }] },
    data: { lockedById: userId, lockedAt: now },
  });
  if (taken.count > 0) return { ok: true };

  // No row we can take: try to claim a free lock; a unique-constraint failure
  // means another user holds a fresh lock (concurrent claim).
  try {
    await prisma.templateLock.create({ data: { templateId, lockedById: userId, lockedAt: now } });
    return { ok: true };
  } catch {
    return { ok: false, lock: await currentLockInfo(templateId) };
  }
}

/** Refresh the lock's timestamp; fails if the caller no longer holds it. */
export async function heartbeatLock(templateId: string, userId: string): Promise<LockResult> {
  const r = await prisma.templateLock.updateMany({
    where: { templateId, lockedById: userId },
    data: { lockedAt: new Date() },
  });
  if (r.count > 0) return { ok: true };
  return { ok: false, lock: await currentLockInfo(templateId) };
}

/** Release the lock if held by `userId` (no-op otherwise). */
export async function releaseLock(templateId: string, userId: string): Promise<void> {
  await prisma.templateLock.deleteMany({ where: { templateId, lockedById: userId } });
}
