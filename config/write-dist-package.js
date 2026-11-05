//Writes dist/package.json and dist/README.md for publishing from dist.
//Only consumer facing fields are kept, so scripts, devDependencies, imports
//and the development export condition never end up in the published package.
//Only run by the release script after tests pass, a plain build leaves dist
//without a package.json so it cannot be published by accident.
//Usage: node config/write-dist-package.js <package folder>...
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEEP = [
  "name",
  "version",
  "description",
  "keywords",
  "author",
  "license",
  "homepage",
  "bugs",
  "repository",
  "type",
  "exports",
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "engines",
  "publishConfig",
];

const strip_dist = (path) => path.replace(/^\.\/dist\//, "./");

for (const folder of process.argv.slice(2)) {
  const dist_folder = join(folder, "dist");
  if (!existsSync(dist_folder))
    throw new Error(`${dist_folder} does not exist, build first`);

  const source = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
  const exports = Object.fromEntries(
    Object.entries(source.exports).map(([key, target]) => {
      if (typeof target === "string") return [key, strip_dist(target)];
      const conditions = Object.entries(target)
        .filter(([condition]) => condition !== "development")
        .map(([condition, path]) => [condition, strip_dist(path)]);
      return [key, Object.fromEntries(conditions)];
    }),
  );

  const dist = {};
  for (const field of KEEP)
    if (field === "exports") dist.exports = exports;
    else if (source[field] !== undefined) dist[field] = source[field];

  writeFileSync(
    join(dist_folder, "package.json"),
    JSON.stringify(dist, null, 2) + "\n",
  );
  const readme = join(folder, "README.md");
  if (existsSync(readme)) copyFileSync(readme, join(dist_folder, "README.md"));
}
