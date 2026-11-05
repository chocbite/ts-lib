import { defineConfig } from "vitest/config";

//ts-lib has no browser features so tests run in plain node
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
