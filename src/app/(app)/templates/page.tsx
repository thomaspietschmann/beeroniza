import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { TemplateGrid, type TemplateListItem } from "@/components/templates/TemplateGrid";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireUser();
  const userId = user.id as string;

  const rows = await prisma.template.findMany({
    where: { userId },
    orderBy: [{ platform: "asc" }, { formatLabel: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      platform: true,
      formatLabel: true,
      width: true,
      height: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const templates: TemplateListItem[] = rows.map((t) => ({
    id: t.id,
    name: t.name,
    platform: t.platform,
    formatLabel: t.formatLabel,
    width: t.width,
    height: t.height,
    updatedAt: t.updatedAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
  }));

  return <TemplateGrid templates={templates} />;
}
