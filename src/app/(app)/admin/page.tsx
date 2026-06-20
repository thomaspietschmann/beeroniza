import { requireAdmin } from "@/lib/session";
import { AdminReset } from "@/components/admin/AdminReset";
import { UserManagement } from "@/components/admin/UserManagement";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-1">Admin</h1>
        <p className="text-secondary mb-0">Instance-wide maintenance. Handle with care.</p>
      </div>
      <div className="d-flex flex-column gap-4">
        <UserManagement currentUserId={user.id as string} />
        <AdminReset />
      </div>
    </div>
  );
}
