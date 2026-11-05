import { existsSync, readdirSync } from "node:fs";
import { defineConfig } from "tsdown";

//One entry per module folder, published as subpath exports
const entry = Object.fromEntries(
  readdirSync("src", { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`src/${d.name}/index.ts`))
    .map((d) => [`${d.name}/index`, `src/${d.name}/index.ts`]),
);

export default defineConfig({
  entry,
  dts: true,
  sourcemap: true,
  deps: { skipNodeModulesBundle: true },
});
