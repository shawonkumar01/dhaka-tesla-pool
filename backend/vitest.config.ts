import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 15000,
    fileParallelism: false, // tests share one database; run sequentially
  },
});
