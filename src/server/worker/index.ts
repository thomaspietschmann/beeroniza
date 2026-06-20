import { type JobWithMetadata } from "pg-boss";
import { getBoss, RENDER_QUEUE, type RenderJobData } from "@/server/queue";
import { env } from "@/lib/env";
import { processRenderJob } from "./process";

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
  console.log(
    `[worker] render worker started (concurrency=${env.workerConcurrency})`,
  );
}
