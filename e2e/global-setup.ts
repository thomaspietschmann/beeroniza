import { execSync } from "node:child_process";

// Seed the isolated test user (+ its starter templates) before any test runs.
// Delegated to a tsx script so it shares the app's Prisma/env exactly like
// `npm run db:seed`.
export default function globalSetup() {
  execSync("npx tsx e2e/seed-test-user.ts", { stdio: "inherit" });
}
