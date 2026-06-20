import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ApiKeysManager, type ApiKeyItem } from "@/components/apikeys/ApiKeysManager";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const user = await requireUser();
  const userId = user.id as string;

  const rows = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      rotatedAt: true,
      createdAt: true,
    },
  });

  const keys: ApiKeyItem[] = rows.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    rotatedAt: k.rotatedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return <ApiKeysManager keys={keys} />;
}
