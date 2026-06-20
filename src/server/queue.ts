import { PgBoss } from "pg-boss";
import { env } from "@/lib/env";

// pg-boss runs the job queue inside the SAME PostgreSQL database (its own
// schema), so no Redis or extra broker is needed.
export const RENDER_QUEUE = "render-image";

export interface RenderJobData {
  generationId: string;
}

let bossPromise: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    const boss = new PgBoss(env.databaseUrl);
    boss.on("error", (err: Error) => console.error("[pg-boss]", err));
    bossPromise = (async () => {
      await boss.start();
      // Idempotent: ignore "already exists".
      await boss.createQueue(RENDER_QUEUE).catch(() => undefined);
      return boss;
    })();
  }
  return bossPromise;
}

export async function enqueueRender(
  data: RenderJobData,
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(RENDER_QUEUE, data, {
    retryLimit: 2,
    retryDelay: 5,
    expireInSeconds: 180,
  });
}
