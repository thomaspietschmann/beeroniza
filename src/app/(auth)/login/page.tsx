import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  // Only offer the "Create one" link when registration is actually open (the
  // bootstrap first account is still allowed when no users exist yet).
  const userCount = await prisma.user.count();
  const allowRegistration = env.allowRegistration || userCount === 0;

  const oidcEnabled = !!(env.oidcIssuer && env.oidcClientId && env.oidcClientSecret);

  return (
    <>
      <h1 className="h4 mb-1">Welcome back</h1>
      <p className="text-secondary mb-4">Sign in to your Beeroniza account.</p>
      <LoginForm
        allowRegistration={allowRegistration}
        oidcEnabled={oidcEnabled}
        oidcName={env.oidcName}
      />
    </>
  );
}
