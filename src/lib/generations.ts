import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { enqueueRender } from "@/server/queue";
import type { Modification, OutputFormat } from "./template/schema";

// Creates an ImageGeneration row and enqueues a render job. Shared by the
// internal UI endpoint and the public REST API.
export async function createGeneration(opts: {
  userId: string;
  templateId: string;
  modifications: Modification[];
  format: OutputFormat;
  webhookUrl?: string | null;
  usageId?: string | null;
}) {
  const template = await prisma.template.findFirst({
    where: { id: opts.templateId, userId: opts.userId },
  });
  if (!template) return null;

  const generation = await prisma.imageGeneration.create({
    data: {
      userId: opts.userId,
      templateId: template.id,
      usageId: opts.usageId ?? null,
      status: "QUEUED",
      modifications: opts.modifications as unknown as Prisma.InputJsonValue,
      format: opts.format,
      width: template.width,
      height: template.height,
      webhookUrl: opts.webhookUrl ?? null,
    },
  });

  const jobId = await enqueueRender({ generationId: generation.id });
  if (jobId) {
    await prisma.imageGeneration.update({
      where: { id: generation.id },
      data: { jobId },
    });
  }

  return generation;
}

// Public-facing serialization of a generation (used by the REST API).
export function serializeGeneration(
  gen: {
    id: string;
    status: string;
    templateId: string;
    width: number;
    height: number;
    format: string;
    fileId: string | null;
    error: string | null;
    createdAt: Date;
    completedAt: Date | null;
  },
  appUrl: string,
) {
  return {
    id: gen.id,
    status: gen.status.toLowerCase(),
    template_id: gen.templateId,
    width: gen.width,
    height: gen.height,
    format: gen.format,
    image_url: gen.fileId ? `${appUrl}/api/files/${gen.fileId}` : null,
    error: gen.error,
    created_at: gen.createdAt.toISOString(),
    completed_at: gen.completedAt?.toISOString() ?? null,
  };
}
