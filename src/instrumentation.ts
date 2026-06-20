// Next.js runs this once on server startup. We use it to start the in-process
// render worker so a single container handles both HTTP and rendering.
export async function register() {
  // Only run in the Node.js server runtime (not edge, not during build).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { env } = await import("@/lib/env");
  if (!env.runWorker) {
    console.log("[worker] RUN_WORKER=false — in-process worker disabled.");
    return;
  }

  try {
    const { startWorker } = await import("@/server/worker");
    await startWorker();
  } catch (err) {
    console.error("[worker] failed to start in-process worker", err);
  }
}
