import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  // If registration is disabled and at least one account exists, hide the form.
  const userCount = await prisma.user.count();
  const closed = !env.allowRegistration && userCount > 0;

  return (
    <>
      <h1 className="h4 mb-1">Create your account</h1>
      <p className="text-secondary mb-4">
        {closed
          ? "Registration is disabled on this instance."
          : "Start designing templates in minutes."}
      </p>
      {!closed && <RegisterForm />}
    </>
  );
}
