import { withAdmin, json, badRequest } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { platformStarterTemplates } from "@/lib/platform-templates";
import { RegistrationError } from "@/lib/users";

export const GET = withAdmin(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true, passwordHash: true },
    orderBy: { createdAt: "asc" },
  });
  return json(users.map((u) => ({ ...u, hasPassword: !!u.passwordHash, passwordHash: undefined })));
});

export const POST = withAdmin(async (req) => {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown; name?: unknown; password?: unknown; role?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const role = body?.role === "ADMIN" ? "ADMIN" : "USER";

  if (!email || !email.includes("@")) return badRequest("Valid email required.");
  if (password.length < 8) return badRequest("Password must be at least 8 characters.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return badRequest("An account with this email already exists.");

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, name: name || null, passwordHash, role },
    });
    await prisma.template.createMany({
      data: platformStarterTemplates().map((t) => ({
        userId: user.id, name: t.name, platform: t.platform,
        formatLabel: t.formatLabel, width: t.width, height: t.height, data: t.data,
      })),
    });
    return json({ id: user.id, email: user.email, name: user.name, role: user.role }, 201);
  } catch (e) {
    if (e instanceof RegistrationError) return badRequest(e.message);
    throw e;
  }
});
