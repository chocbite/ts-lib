//Writes AGENTS.md and SOURCE.md into the dist folder of each package, so agents working in a consumer
//project have the docs and source of the installed version in node_modules,
//as two files instead of the whole source tree.
//AGENTS.md: version, how to report problems, the package README, the element pattern of the package if it has one,
//and every module README.
//SOURCE.md: all source files of the package, each under a header with its repo path.
//Run by the build script, so the files can be inspected without releasing.
//Usage, from the repo root: node config/write-dist-agent-docs.js <package folder>...
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_EXTENSIONS = [".ts", ".scss"];

//Module folders that are not built, the same as NOT_BUILT in config/tsdown.config.ts
//Their README is not a module section, their source is still in SOURCE.md
const NOT_BUILT = new Set(["pattern_example"]);

//How elements of a package are written, PATTERN.md in the package folder with its example module
const PATTERN = "PATTERN.md";
const PATTERN_EXAMPLE = "pattern_example";

//Never part of SOURCE.md
const is_excluded = (path) =>
  path.endsWith(".test.ts") ||
  path.endsWith(".trials.ts") ||
  /(^|\/)(tests|trials)\//.test(path);

//Replaced by a note in SOURCE.md, generated files too big to be worth reading
const OMITTED = {
  "icons/material/material-symbols-rounded.ts": (code) =>
    `Omitted, generated file with ${code.match(/^export const /gm)?.length ?? 0} icons. ` +
    "Every icon is `export const material_<name>_rounded = generate_function(...)`, e.g. `material_10k_rounded`, " +
    "exported from `@chocbite/ts-lib-ui/icons`. Search the `.d.mts` files of this package for the available names.",
};

const git = (command) =>
  execSync(`git ${command}`, { encoding: "utf8" }).trim();

//Build output and dependencies are never in a package folder, skipped in case they appear
const SKIPPED_FOLDERS = new Set(["node_modules", "dist"]);

const list_files = (folder) =>
  readdirSync(folder, { withFileTypes: true })
    .filter(
      (entry) => !(entry.isDirectory() && SKIPPED_FOLDERS.has(entry.name)),
    )
    .flatMap((entry) => {
      const path = `${folder}/${entry.name}`;
      return entry.isDirectory() ? list_files(path) : [path];
    })
    .sort();

//A fence longer than any backtick run in the content, so the content cannot close it
const fence = (content) =>
  "`".repeat(
    Math.max(3, ...(content.match(/`+/g) ?? []).map((run) => run.length + 1)),
  );

const fenced = (language, content) => {
  const f = fence(content);
  return `${f}${language}\n${content.trimEnd()}\n${f}`;
};

//Pushes markdown headings down by levels, so a README fits under a section heading
const demote = (markdown, levels) => {
  let in_code = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^(```|~~~)/.test(line)) in_code = !in_code;
      return !in_code && /^#+ /.test(line) ? "#".repeat(levels) + line : line;
    })
    .join("\n");
};

const read_json = (path) => JSON.parse(readFileSync(path, "utf8"));

//Build output of a package, dist/<name without scope> in the repo root, the same as DIST in config/tsdown.config.ts
const dist_of = (name) => join("dist", name.split("/").pop());

const { version } = read_json("package.json");
if (!version) throw new Error("root package.json has no version");
const commit = git("rev-parse --short HEAD");
const dirty = git("status --porcelain") !== "";

const folders = process.argv.slice(2);
const packages = folders.map((folder) =>
  read_json(join(folder, "package.json")),
);
const internal = new Set(packages.map((pkg) => pkg.name));

for (const [i, folder] of folders.entries()) {
  const pkg = packages[i];
  const internal_deps = Object.keys(pkg.dependencies ?? {}).filter((name) =>
    internal.has(name),
  );
  const repository = pkg.repository?.url;
  const dist = dist_of(pkg.name);
  if (!existsSync(dist)) throw new Error(`${dist} does not exist, build first`);

  const header =
    `${pkg.name} ${version}, built from ` +
    (repository ? `${repository} at ` : "") +
    `commit ${commit}${dirty ? ", with uncommitted changes" : ""}.`;

  //AGENTS.md
  const module_readmes = list_files(folder).filter(
    (path) =>
      /^[^/]+\/[^/]+\/README\.md$/.test(path) &&
      !NOT_BUILT.has(path.split("/")[1]),
  );
  const pattern = existsSync(join(folder, PATTERN))
    ? [
        "## Writing your own elements",
        `Elements of this package, and elements you write on its \`Base\`, follow the pattern below. ` +
          `Read it before writing an element. ` +
          `It names files by their repo path, find them in \`SOURCE.md\` under \`## <path>\`. ` +
          `The complete example it refers to is \`${folder}/${PATTERN_EXAMPLE}/\` in \`SOURCE.md\`, ` +
          `it is not exported from the package, copy from it instead of importing it. ` +
          `Paths under \`dev/\` are dev pages of the library repo and not part of the package.`,
        demote(readFileSync(join(folder, PATTERN), "utf8").trim(), 2),
        ...(existsSync(join(folder, PATTERN_EXAMPLE, "README.md"))
          ? [
              demote(
                readFileSync(
                  join(folder, PATTERN_EXAMPLE, "README.md"),
                  "utf8",
                ).trim(),
                2,
              ),
            ]
          : []),
      ]
    : [];
  const agents = [
    `# ${pkg.name}, notes for agents`,
    header,
    "Read the sections for the modules you use before using them. " +
      "The full source of this version is in `SOURCE.md` next to this file, every file under a `## <repo path>` heading, " +
      "e.g. search it for `## " +
      folder +
      "/<module>/` to find a module.",
    ...internal_deps.map(
      (dep) =>
        `This package builds on \`${dep}\`, its notes and source are in \`node_modules/${dep}/AGENTS.md\` and \`SOURCE.md\`.`,
    ),
    "## Reporting problems with this library",
    "This library is developed alongside the projects that use it, problems found while using it should be fixed in the library. " +
      "If something is wrong, missing, undocumented or awkward to use:",
    [
      "- Do not patch it in `node_modules` and do not silently work around it.",
      "- Tell the user, with the package name and version, the repo path and function or class from `SOURCE.md`, " +
        "what you expected, what happened, and what you did instead.",
    ].join("\n"),
    demote(readFileSync(join(folder, "README.md"), "utf8").trim(), 1),
    ...pattern,
    ...module_readmes.map((path) => {
      const module = path.split("/")[1];
      return `## Module ${pkg.name}/${module}\n\n${demote(readFileSync(path, "utf8").trim(), 2)}`;
    }),
  ];
  writeFileSync(join(dist, "AGENTS.md"), agents.join("\n\n") + "\n");

  //SOURCE.md
  const sources = list_files(folder).filter(
    (path) =>
      SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext)) && !is_excluded(path),
  );
  const source = [
    `# ${pkg.name} source`,
    header,
    "Every source file of the package, tests excluded, under a heading with its path in the repo. " +
      "Usage notes are in `AGENTS.md` next to this file.",
    ...sources.map((path) => {
      const code = readFileSync(path, "utf8");
      const omitted = OMITTED[path.slice(folder.length + 1)];
      const body = omitted
        ? omitted(code)
        : fenced(path.endsWith(".scss") ? "scss" : "ts", code);
      return `## ${path}\n\n${body}`;
    }),
  ];
  writeFileSync(join(dist, "SOURCE.md"), source.join("\n\n") + "\n");
}
