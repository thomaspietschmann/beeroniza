import { UsageFillView } from "@/components/usages/UsageFillView";

export const dynamic = "force-dynamic";

// Client-driven fill view: it fetches GET /api/usages/:id itself (giving the
// stored values plus the CURRENT template incl. data) so the live preview always
// reflects the latest template layout.
export default async function UsageFillPage({
  params,
}: {
  params: Promise<{ id: string; usageId: string }>;
}) {
  const { usageId } = await params;
  return <UsageFillView usageId={usageId} />;
}
