export const LOCK_TTL_MS = 90_000;
export const LOCK_HEARTBEAT_MS = 30_000;

export function isLockStale(lockedAt: Date | null): boolean {
  if (!lockedAt) return true;
  return Date.now() - lockedAt.getTime() > LOCK_TTL_MS;
}

export interface LockInfo {
  lockedById: string;
  lockedByName: string | null;
  lockedAt: string;
}
