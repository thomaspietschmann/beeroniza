import { requireUser } from "@/lib/session";
import { BrandKitsManager } from "@/components/account/BrandKitsManager";

export const dynamic = "force-dynamic";

export default async function BrandKitsPage() {
  await requireUser();
  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-1">Brand Kits</h1>
        <p className="text-secondary mb-0">
          Farbpaletten für den Editor und Usage-Formulare. Kits sind instanzweit geteilt.
        </p>
      </div>
      <BrandKitsManager />
    </div>
  );
}
