import { playwright } from "@vitest/browser-playwright";
import { resolve } from "node:path";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

const at_root = (path: string) => resolve(import.meta.dirname, path);

//Dev server for trying out the libraries by hand (dev/), never built or published
//The tests of both packages are vitest projects, run one with --project core or --project ui
export default defineConfig({
  root: at_root("dev"),
  resolve: { conditions: ["development", ...defaultClientConditions] },
  server: { open: true, host: true, port: 9998 },
  //Outside the package folders, otherwise every package gets a node_modules for the cache
  cacheDir: at_root("node_modules/.vite"),
  test: {
    projects: [
      {
        //ts-lib has no browser features so tests run in plain node
        test: {
          name: "core",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
        root: at_root("package-core"),
        cacheDir: at_root("node_modules/.vite"),
      },
      {
        resolve: { conditions: ["development"] },
        root: at_root("package-ui"),
        cacheDir: at_root("node_modules/.vite"),
        test: {
          name: "ui",
          include: ["src/**/*.test.ts"],
          //Failure screenshots go to the repo root
          attachmentsDir: at_root(".vitest/attachments"),
          browser: {
            enabled: true,
            //Use --browser.headless=false to watch the tests run
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
