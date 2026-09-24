import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    env: { DATABASE_URL: "file:./test.db", SMS_PROVIDER: "console", APP_URL: "http://localhost:3000" },
    fileParallelism: false,
  },
});
