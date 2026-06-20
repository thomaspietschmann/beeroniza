import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { deleteFile } from "@/lib/storage";
import { platformStarterTemplates } from "@/lib/platform-templates";

export interface ResetSummary {
  deletedTemplates: number;
  deletedUsages: number;
  deletedGenerations: number;
  deletedFiles: number;
  deletedFonts: number;
  createdTemplates: number;
}

// Full application reset (ADMIN only): wipe all templates, usages, generations,
// uploaded/generated media, and user-uploaded fonts across every user, then
// recreate the starter templates for the admin who triggered it. Bundled fonts
// and user accounts / API keys are preserved.
export async function resetApplication(adminUserId: string): Promise<ResetSummary> {
  // Count first (for the summary), then delete in FK-safe order.
  const [tplCount, usageCount, genCount, fileCount, userFonts] = await Promise.all([
    prisma.template.count(),
    prisma.usage.count(),
    prisma.imageGeneration.count(),
    prisma.storedFile.count({ where: { kind: { in: ["UPLOAD", "GENERATED"] } } }),
    prisma.font.findMany({ where: { isBundled: false }, select: { fileId: true } }),
  ]);

  const userFontFileIds = [...new Set(userFonts.map((f) => f.fileId).filter(Boolean))] as string[];

  // Generations reference templates/usages/files; delete them first, then
  // usages, then templates, then the media blobs (bundled FONT files stay).
  await prisma.imageGeneration.deleteMany({});
  await prisma.usage.deleteMany({});
  await prisma.template.deleteMany({});
  await prisma.storedFile.deleteMany({ where: { kind: { in: ["UPLOAD", "GENERATED"] } } });

  // Delete user-uploaded and Google-imported font rows, then their backing files.
  await prisma.font.deleteMany({ where: { isBundled: false } });
  for (const fileId of userFontFileIds) {
    const stillUsed = await prisma.font.count({ where: { fileId } });
    if (stillUsed === 0) await deleteFile(fileId).catch(() => undefined);
  }

  // With the local storage driver, also drop the on-disk blobs so they don't
  // linger as orphans. (The db driver keeps bytes in Postgres — already gone.)
  if (env.storageDriver === "local") {
    for (const kind of ["upload", "generated"]) {
      await fs.rm(path.join(env.storageLocalPath, kind), { recursive: true, force: true }).catch(() => undefined);
    }
  }

  // Recreate the starter templates, owned by the admin who reset.
  const starters = platformStarterTemplates();
  await prisma.template.createMany({
    data: starters.map((t) => ({
      userId: adminUserId,
      name: t.name,
      platform: t.platform,
      formatLabel: t.formatLabel,
      width: t.width,
      height: t.height,
      data: t.data as object,
    })),
  });

  return {
    deletedTemplates: tplCount,
    deletedUsages: usageCount,
    deletedGenerations: genCount,
    deletedFiles: fileCount,
    deletedFonts: userFonts.length,
    createdTemplates: starters.length,
  };
}
