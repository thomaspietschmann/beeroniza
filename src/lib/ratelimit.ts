import { prisma } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

// Sliding-window rate limiter backed by Postgres. Increments the counter for
// `key` within the current window and returns whether the request is allowed.
// Old rows (older than windowMs) are pruned opportunistically to keep the table
// small; the prune is fire-and-forget and never blocks the caller.
export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - opts.windowMs);

  const result = await prisma.$queryRaw<
    { count: bigint; windowStart: Date }[]
  >`
    INSERT INTO rate_limits (key, count, "windowStart")
    VALUES (${key}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count         = CASE WHEN rate_limits."windowStart" < ${windowStart}
                           THEN 1
                           ELSE rate_limits.count + 1 END,
      "windowStart" = CASE WHEN rate_limits."windowStart" < ${windowStart}
                           THEN ${now}
                           ELSE rate_limits."windowStart" END
    RETURNING count, "windowStart"
  `;

  const row = result[0];
  const count = Number(row.count);
  const allowed = count <= opts.limit;

  if (!allowed) {
    const windowEndMs = row.windowStart.getTime() + opts.windowMs;
    const retryAfterMs = Math.max(0, windowEndMs - now.getTime());
    return { allowed: false, retryAfterMs };
  }

  // Prune rows from expired windows (fire-and-forget).
  prisma.rateLimit
    .deleteMany({ where: { windowStart: { lt: windowStart } } })
    .catch(() => undefined);

  return { allowed: true, retryAfterMs: 0 };
}
