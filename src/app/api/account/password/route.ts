import { withUser, json, badRequest, forbidden } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/ratelimit";

export const POST = withUser(async (req, userId) => {
  const body = (await req.json().catch(() => null)) as {
    currentPassword?: unknown; newPassword?: unknown;
  } | null;

  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!current || !next) return badRequest("currentPassword and newPassword are required.");
  if (next.length < 8) return badRequest("New password must be at least 8 characters.");

  // 5 attempts per 15 minutes per user to throttle password-guessing.
  const rl = await checkRateLimit(`pw:${userId}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return json({ error: "Too many password change attempts. Please try again later." }, 429);
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash) return forbidden(); // SSO-only account

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return badRequest("Current password is incorrect.");

  const passwordHash = await hashPassword(next);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return json({ ok: true });
});
