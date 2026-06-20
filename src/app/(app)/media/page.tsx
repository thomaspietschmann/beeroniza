import { requireUser } from "@/lib/session";
import { MediaLibrary } from "@/components/media/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireUser();
  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-1">Media</h1>
        <p className="text-secondary mb-0">
          Your uploaded images. Reuse them across templates and usages — pick from here whenever
          you fill an image field.
        </p>
      </div>
      <div className="bnz-card p-3 p-lg-4">
        <MediaLibrary />
      </div>
    </div>
  );
}
