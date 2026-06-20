import { execSync } from "node:child_process";

// Remove the test user and all its data after the run, so the environment is
// left clean (important when running against a shared dev database).
export default function globalTeardown() {
  execSync("npx tsx e2e/cleanup-test-user.ts", { stdio: "inherit" });
}
