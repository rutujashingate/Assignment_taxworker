import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql:///miraflores_workpaper_test?host=/tmp";
export default defineConfig({
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
  } },
  test: { include: ["tests/*.test.ts"], fileParallelism: false, testTimeout: 20000 },
});
