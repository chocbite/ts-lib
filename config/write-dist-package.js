//Writes dist/package.json and dist/README.md for publishing from dist.
//Only consumer facing fields are kept, so scripts, devDependencies, imports
//and the development export condition never end up in the published package.
//Only run by the release script after tests pass, a plain build leaves dist
//without a package.json so it cannot be published by accident.
//The version only exists in the root package.json, every package gets it here,
//dependencies between the packages become a range of that version.
//Usage, from the repo root: node config/write-dist-package.js <package folder>...
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
const read_json = (path) => JSON.parse(readFileSync(path, "utf8"));

const { version } = read_json("package.json");
if (!version) throw new Error("root package.json has no version");

const folders = process.argv.slice(2);
const internal = new Set(
  folders.map((folder) => read_json(join(folder, "package.json")).name),
);

for (const folder of folders) {
  const dist_folder = join(folder, "dist");
  if (!existsSync(dist_folder))
    throw new Error(`${dist_folder} does not exist, build first`);

  const source = read_json(join(folder, "package.json"));
  source.version = version;
  if (source.dependencies)
    source.dependencies = Object.fromEntries(
      Object.entries(source.dependencies).map(([name, range]) => [
        name,
        internal.has(name) ? `^${version}` : range,
      ]),
    );

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
