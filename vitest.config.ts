import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    globalSetup: ["tests/integration/setup.ts"],
    env: {
      DATABASE_URL: "postgresql://postgres@127.0.0.1:54329/teamfit_test",
      AUTH_MODE: "dev",
      APP_SECRET: "test-secret",
      AI_PROVIDER: "demo",
      ANTHROPIC_API_KEY: "",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
