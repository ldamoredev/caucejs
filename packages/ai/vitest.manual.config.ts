import { defineConfig } from "vitest/config";

// The run by hand with a key, out of CI: `pnpm test` never includes it.
export default defineConfig({
  test: {
    include: ["manual/**/*.manual.ts"],
    testTimeout: 600_000,
  },
});
