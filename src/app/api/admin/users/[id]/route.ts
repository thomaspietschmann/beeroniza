import { withAdminParams, json, badRequest, notFound, forbidden } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

type Params = { id: string };

export const PATCH = withAdminParams<Params>(async (req, userId, { id }) => {
  const body = (await req.json().catch(() => null)) as {
    role?: unknown; password?: unknown;
  } | null;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return notFound();

  if (body?.role !== undefined) {
    if (body.role !== "ADMIN" && body.role !== "USER") return badRequest("role must be ADMIN or USER.");
    // Prevent the last admin from demoting themselves.
    if (body.role === "USER" && id === userId) {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) return badRequest("Cannot remove the last admin.");
    }
    await prisma.user.update({ where: { id }, data: { role: body.role } });
  }

  if (body?.password !== undefined) {
    const pw = String(body.password);
    if (pw.length < 8) return badRequest("Password must be at least 8 characters.");
    const passwordHash = await hashPassword(pw);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  return json({ ok: true });
});

export const DELETE = withAdminParams<Params>(async (_req, userId, { id }) => {
  if (id === userId) return forbidden();
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return notFound();
  await prisma.user.delete({ where: { id } });
  return json({ ok: true });
});
