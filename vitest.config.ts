import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Dummy env so modules that read configuration at import time don't throw.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test?schema=public",
      AUTH_SECRET: "test-secret",
      APP_URL: "https://example.test",
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
