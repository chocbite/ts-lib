import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["development"] },
  test: {
    browser: {
      enabled: true,
      //Use --browser.headless=false to watch the tests run
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
