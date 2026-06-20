import { withUser, json, badRequest, forbidden } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export const POST = withUser(async (req, userId) => {
  const body = (await req.json().catch(() => null)) as {
    currentPassword?: unknown; newPassword?: unknown;
  } | null;

  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!current || !next) return badRequest("currentPassword and newPassword are required.");
  if (next.length < 8) return badRequest("New password must be at least 8 characters.");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash) return forbidden(); // SSO-only account

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return badRequest("Current password is incorrect.");

  const passwordHash = await hashPassword(next);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return json({ ok: true });
});
