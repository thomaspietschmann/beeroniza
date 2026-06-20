import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { UsagesList, type UsageListItem } from "@/components/usages/UsagesList";

export const dynamic = "force-dynamic";

export default async function TemplateUsagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const userId = user.id as string;

  const template = await prisma.template.findFirst({
    where: { id },
    select: { id: true, name: true, width: true, height: true, data: true },
  });

  if (!template) notFound();

  const usages = await prisma.usage.findMany({
    where: { templateId: id, userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  const usageItems: UsageListItem[] = usages.map((u) => ({
    id: u.id,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-4">
        <Link href="/templates" className="small text-decoration-none">
          ← Templates
        </Link>
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mt-2">
          <div>
            <h1 className="h3 mb-1">{template.name}</h1>
            <p className="text-secondary mb-0">
              {template.width}×{template.height}
            </p>
          </div>
          <Link href={`/editor/${template.id}`} className="btn btn-outline-dark">
            Edit template
          </Link>
        </div>
      </div>

      <UsagesList templateId={template.id} usages={usageItems} />
    </div>
  );
}
