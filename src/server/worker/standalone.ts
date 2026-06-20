import "dotenv/config";
import { startWorker } from "./index";

// Standalone worker entrypoint (`npm run worker`). NOTE: the renderer calls
// http://127.0.0.1:PORT/internal/render — it needs a co-located Next.js server
// on PORT, not a remote one. To scale rendering horizontally, run multiple
// replicas of the full app image and use RUN_WORKER=true/false to control
// which replicas pull jobs from the shared pg-boss queue in Postgres.
startWorker()
  .then(() => {
    console.log("[worker] standalone worker running. Press Ctrl+C to stop.");
  })
  .catch((err) => {
    console.error("[worker] failed to start", err);
    process.exit(1);
  });

// Keep the event loop alive.
setInterval(() => undefined, 1 << 30);
