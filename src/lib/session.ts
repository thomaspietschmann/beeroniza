import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Server-side guard for protected pages. Redirects to /login when there is no
// authenticated user, otherwise returns the user.
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}

// True when the user has the ADMIN role (role isn't in the JWT session, so we
// read it from the database).
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "ADMIN";
}

// Server-side guard for admin-only pages. Redirects non-admins to the dashboard.
export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdmin(user.id as string))) {
    redirect("/dashboard");
  }
  return user;
}
