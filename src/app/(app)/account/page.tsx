import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ChangePassword } from "@/components/account/ChangePassword";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id as string },
    select: { email: true, name: true, passwordHash: true },
  });

  const hasPassword = !!dbUser?.passwordHash;

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-1">Account</h1>
        <p className="text-secondary mb-0">{dbUser?.email}</p>
      </div>
      <div className="d-flex flex-column gap-4">
        {hasPassword ? (
          <ChangePassword />
        ) : (
          <div className="bnz-card p-3 p-lg-4">
            <h2 className="h5 mb-1">Password</h2>
            <p className="text-secondary mb-0">
              Your account is managed via Single Sign-On. Change your password in your SSO provider.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
