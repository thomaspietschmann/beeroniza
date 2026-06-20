import Link from "next/link";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";
import { RecentGenerations, type RecentGenerationItem } from "@/components/dashboard/RecentGenerations";

export const dynamic = "force-dynamic";

function StatCard({ value, label, hint }: { value: number; label: string; hint?: string }) {
  return (
    <Col xs={12} md={4}>
      <div className="bnz-stat h-100">
        <div className="bnz-stat-value">{value.toLocaleString()}</div>
        <div className="bnz-stat-label">{label}</div>
        {hint && <div className="small text-secondary mt-1">{hint}</div>}
      </div>
    </Col>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const userId = user.id as string;
  const now = new Date();

  const [templateCount, generationCount, activeKeyCount, recent] = await Promise.all([
    prisma.template.count({ where: { userId } }),
    prisma.imageGeneration.count({ where: { userId } }),
    prisma.apiKey.count({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.imageGeneration.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        fileId: true,
        format: true,
        createdAt: true,
        templateId: true,
        usageId: true,
        template: { select: { name: true } },
      },
    }),
  ]);

  const recentItems: RecentGenerationItem[] = recent.map((g) => ({
    id: g.id,
    status: g.status,
    imageUrl: g.fileId ? `${env.appUrl}/api/files/${g.fileId}` : null,
    templateName: g.template?.name ?? "Untitled template",
    format: g.format,
    createdAt: g.createdAt.toISOString(),
    // Link back to the filled-in template (the usage) when the render came from
    // one; otherwise fall back to the template's page.
    href: g.usageId
      ? `/templates/${g.templateId}/usages/${g.usageId}`
      : `/templates/${g.templateId}`,
  }));

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Dashboard</h1>
          <p className="text-secondary mb-0">Welcome back{user.name ? `, ${user.name}` : ""}.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link href="/templates" className="btn btn-primary">
            New template
          </Link>
          <Link href="/api-keys" className="btn btn-outline-dark">
            Create API key
          </Link>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <StatCard value={templateCount} label="Templates" />
        <StatCard value={generationCount} label="Images generated" />
        <StatCard value={activeKeyCount} label="Active API keys" />
      </Row>

      <div className="bnz-card">
        <div className="d-flex align-items-center justify-content-between px-3 px-lg-4 py-3 border-bottom">
          <h2 className="h6 mb-0">Recent generations</h2>
          <Link href="/templates" className="small fw-semibold text-decoration-none">
            Generate more →
          </Link>
        </div>
        <RecentGenerations items={recentItems} />
      </div>
    </div>
  );
}
