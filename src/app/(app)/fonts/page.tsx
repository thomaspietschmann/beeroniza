import { requireUser } from "@/lib/session";
import { FontsManager } from "@/components/fonts/FontsManager";

export const dynamic = "force-dynamic";

export default async function FontsPage() {
  await requireUser();
  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-1">Fonts</h1>
        <p className="text-secondary mb-0">
          The fonts available in the editor. Upload your own font files or import
          families from Google Fonts — imported fonts are downloaded onto this
          instance and used at render time (no external CDN).
        </p>
      </div>
      <div className="bnz-card p-3 p-lg-4">
        <FontsManager />
      </div>
    </div>
  );
}
