import { playwright } from "@vitest/browser-playwright";
import { resolve } from "node:path";
import { defaultClientConditions, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

const at_root = (path: string) => resolve(import.meta.dirname, "..", path);

/**Moves the built script and css into index.html, so the build is one self contained file.
 * Everything else is already inlined by the build options below.*/
function single_file(): Plugin {
  return {
    name: "single-file",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = bundle["index.html"];
      if (html?.type !== "asset") throw new Error("single-file: no index.html in the bundle");
      const take = (url: string) => {
        const file = url.replace(/^\.?\//, "");
        const item = bundle[file];
        if (!item) throw new Error(`single-file: ${file} is not in the bundle`);
        delete bundle[file];
        return item.type === "chunk" ? item.code : String(item.source);
      };
      //A function replacement, so $ in the code is not read as a replacement pattern
      //An inline script ends at the first </script, so it is escaped, <\/script means the same in javascript
      html.source = String(html.source)
        .replace(
          /<script type="module"[^>]*\ssrc="([^"]+)"[^>]*><\/script>/g,
          (_m, url: string) =>
            `<script type="module">${take(url).replace(/<\/script/gi, "<\\/script")}</script>`,
        )
        .replace(
          /<link rel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>/g,
          (_m, url: string) => `<style>${take(url)}</style>`,
        );
      const left = Object.keys(bundle).filter((file) => file !== "index.html");
      if (left.length) throw new Error(`single-file: not inlined: ${left.join(", ")}`);
    },
  };
}

//Build, dev server and tests of the game, separate from the library build in ../../config
//Used with --config config/vite.config.ts, see the scripts in package.json
export default defineConfig({
  root: at_root("."),
  //Resolves @chocbite/ts-lib and @chocbite/ts-lib-ui to their source, library changes show without a library build
  resolve: { conditions: ["development", ...defaultClientConditions] },
  server: { open: true, host: true, port: 9997 },
  base: "./",
  plugins: [single_file()],
  build: {
    outDir: at_root("dist"),
    emptyOutDir: true,
    //The build is one html file, fonts and images become data urls, css and code go into the html
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rolldownOptions: { output: { codeSplitting: false } },
  },
  test: {
    include: ["src/**/*.test.ts"],
    browser: {
      enabled: true,
      //Use --browser.headless=false to watch the tests run
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
