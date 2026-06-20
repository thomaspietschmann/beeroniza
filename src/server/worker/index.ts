import { type JobWithMetadata } from "pg-boss";
import {
  getBoss,
  RENDER_QUEUE,
  CLEANUP_API_KEYS_QUEUE,
  scheduleApiKeyCleanup,
  type RenderJobData,
} from "@/server/queue";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { processRenderJob } from "./process";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

let started = false;

// Starts the in-process render worker. Called from instrumentation.ts on boot
// (RUN_WORKER=true) and from the standalone worker entrypoint.
export async function startWorker(): Promise<void> {
  if (started) return;
  started = true;

  const boss = await getBoss();

  await boss.work<RenderJobData>(
    RENDER_QUEUE,
    { localConcurrency: env.workerConcurrency, includeMetadata: true },
    async (jobs: JobWithMetadata<RenderJobData>[]) => {
      for (const job of jobs) {
        await processRenderJob(job.data.generationId, {
          isFinalAttempt: job.retryCount >= job.retryLimit,
        });
      }
    },
  );

  await boss.work(CLEANUP_API_KEYS_QUEUE, async () => {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const { count } = await prisma.apiKey.deleteMany({
      where: {
        OR: [
          { revokedAt: { not: null, lte: cutoff } },
          { expiresAt: { not: null, lte: cutoff } },
        ],
      },
    });
    if (count > 0) console.log(`[worker] deleted ${count} stale API key(s)`);
  });

  await scheduleApiKeyCleanup();

  console.log(
    `[worker] render worker started (concurrency=${env.workerConcurrency})`,
  );
}
