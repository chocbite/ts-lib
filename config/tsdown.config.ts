import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type UserConfig } from "tsdown";

const at_root = (path: string) => resolve(import.meta.dirname, "..", path);

/**Build output of a package, dist/<name without scope>, where it is published from */
export const DIST = { core: "dist/ts-lib", ui: "dist/ts-lib-ui" };

/**Config shared by both packages, one entry per module folder, published as subpath exports */
function package_config(
  folder: string,
  dist: string,
  tsconfig: string,
): UserConfig {
  const root = at_root(folder);
  return {
    name: folder,
    //The package folder, so its package.json decides which dependencies are external
    cwd: root,
    entry: Object.fromEntries(
      readdirSync(root, { withFileTypes: true })
        .filter(
          (d) => d.isDirectory() && existsSync(`${root}/${d.name}/index.ts`),
        )
        .map((d) => [`${d.name}/index`, `${d.name}/index.ts`]),
    ),
    outDir: at_root(dist),
    tsconfig: resolve(import.meta.dirname, tsconfig),
    dts: true,
    sourcemap: true,
    //Fails the build if anything from node_modules would be bundled, dependencies stay imports
    deps: { onlyBundle: [] },
  };
}

export default defineConfig([
  package_config("package-core", DIST.core, "tsconfig.core.json"),
  {
    ...package_config("package-ui", DIST.ui, "tsconfig.ui.json"),
    //Sass mixins are published as source for consumers to use
    copy: ["icons", "theme"].map((module) => ({
      from: `${module}/mixins.scss`,
      to: at_root(`${DIST.ui}/${module}`),
    })),
    plugins: [
      {
        //The icons chunk is huge and gets no sourcemap, everything else does
        name: "no-icons-sourcemap",
        generateBundle(_options, bundle) {
          for (const [file, item] of Object.entries(bundle)) {
            if (item.type !== "chunk" || item.moduleIds.length === 0) continue;
            const only_icons = item.moduleIds.every((id) =>
              id.replaceAll("\\", "/").includes("/package-ui/icons/"),
            );
            if (!only_icons) continue;
            delete bundle[`${file}.map`];
            item.map = null;
            item.code = item.code.replace(/\n?\/\/# sourceMappingURL=.*$/m, "");
          }
        },
      },
      {
        //All css ends up in one style.css in the dist root, every output file imports it
        name: "import-style",
        banner(chunk) {
          const depth = chunk.fileName.split("/").length - 1;
          return `import '${depth ? "../".repeat(depth) : "./"}style.css';`;
        },
      },
      {
        name: "inline-woff2",
        transform(code, id) {
          if (id.endsWith(".scss") || id.endsWith(".css")) {
            const replaced = code.replace(
              /url\(["']?(\.[^"')]+\.woff2)["']?\)/g,
              (_match, relPath: string) => {
                const abs = resolve(dirname(id), relPath);
                const b64 = readFileSync(abs).toString("base64");
                return `url("data:font/woff2;base64,${b64}")`;
              },
            );
            if (replaced !== code) return replaced;
          }
          return null;
        },
      },
    ],
  },
]);
