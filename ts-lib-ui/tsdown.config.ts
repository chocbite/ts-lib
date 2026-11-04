import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "tsdown";

//One entry per module folder, published as subpath exports
const entry = Object.fromEntries(
  readdirSync("src", { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`src/${d.name}/index.ts`))
    .map((d) => [`${d.name}/index`, `src/${d.name}/index.ts`]),
);

export default defineConfig({
  entry,
  dts: { eager: true },
  sourcemap: true,
  deps: { skipNodeModulesBundle: true },
  plugins: [
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
      },
    },
  ],
});
