//Writes the docs, AGENTS.md and SOURCE.md into the dist folder of each package, so agents working in a consumer
//project have the docs and source of the installed version in node_modules, instead of the whole source tree.
//Docs: the package README.md, PATTERN.md if the package has one, and every module README.md,
//as files in the same layout as in the package folder, so the links between them work. A broken link fails the build.
//AGENTS.md: version, where the docs are, one line per module, and how to report problems.
//It refers to the docs, it does not hold them.
//SOURCE.md: all source files of the package, each under a header with its repo path.
//Run by the build script, so the files can be inspected without releasing.
//Usage, from the repo root: node config/write-dist-agent-docs.js <package folder>...
import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";

const SOURCE_EXTENSIONS = [".ts", ".scss"];

//Module folders that are not built, the same as NOT_BUILT in config/tsdown.config.ts
//Their README is copied but not listed as a module, their source is still in SOURCE.md
const NOT_BUILT = new Set(["pattern_example"]);

//How elements of a package are written, PATTERN.md in the package folder with its example module
const PATTERN = "PATTERN.md";
const PATTERN_EXAMPLE = "pattern_example";

//Never part of SOURCE.md
const is_excluded = (path) =>
  path.endsWith(".test.ts") ||
  path.endsWith(".trials.ts") ||
  /(^|\/)(tests|trials|scripts)\//.test(path);

//Replaced by a note in SOURCE.md, generated files too big to be worth reading
const OMITTED = {
  "icons/material/material-symbols-rounded.ts": (code) =>
    `Omitted, generated file with ${code.match(/^export const /gm)?.length ?? 0} icons. ` +
    "Every icon is `export const material_<name>_rounded = generate_function(...)`, e.g. `material_10k_rounded`, " +
    "exported from `@chocbite/ts-lib-ui/icons`. Search the `.d.mts` files of this package for the available names.",
  "keyboard/cldr_layouts.ts": (code) =>
    `Omitted, generated file with ${code.match(/^\s*"(?:[^"\\]|\\.)*\\f(?:[^"\\]|\\.)*",?$/gm)?.length ?? 0} keyboard layouts from Unicode CLDR. ` +
    "It exports `CLDR_LAYOUTS`, one string per layout, decoded by `package-ui/keyboard/languages.ts`, where the `id` of a layout is a locale like `da` or `de-CH`, " +
    "and the tables `CLDR_DEAD_KEYS`, `CLDR_CONTINENTS`, `CLDR_CONTINENT_OF` and `CLDR_TERRITORY_NAMES`.",
  "keyboard/unicode_blocks.ts": (code) =>
    `Omitted, generated file with ${code.match(/^\s*\["/gm)?.length ?? 0} Unicode blocks. ` +
    "It exports `UNICODE_BLOCKS`, an array of `[name, first code point, last code point, script]`, script 1 for a block of a script and 0 for symbols.",
  "keyboard/unicode_emoji.ts": (code) =>
    `Omitted, generated file with ${[...code.matchAll(/^ {4}\["[^"]*", "(.*)"\],$/gm)].reduce((n, match) => n + match[1].split(" ").length, 0)} emoji from Unicode. ` +
    "It exports `UNICODE_EMOJI`, an array of `[group, [[subgroup, emoji separated by spaces]]]` in the order of Unicode.",
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

//Markdown without its code, fenced blocks and inline code, where text looking like a link is not one
const without_code = (markdown) => {
  let in_code = false;
  return markdown
    .split("\n")
    .filter((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        in_code = !in_code;
        return false;
      }
      return !in_code;
    })
    .join("\n")
    .replace(/`+[^`]*`+/g, "");
};

//Relative link targets of a markdown file, without their anchors
const relative_links = (markdown) =>
  [...without_code(markdown).matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1].split("#")[0])
    .filter((target) => target && !/^[a-z]+:/i.test(target));

//The first sentence of a README after its title, a summary for the list of modules
const summary = (markdown) => {
  const paragraph = markdown
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("#") && !part.startsWith("```"));
  return paragraph ? paragraph.replace(/\s+/g, " ").split(/(?<=\.)\s/)[0] : "";
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

  //Docs, copied in the layout of the package folder, so the links between them work
  const doc_paths = [
    "README.md",
    ...(existsSync(join(folder, PATTERN)) ? [PATTERN] : []),
    ...list_files(folder)
      .map((path) => path.slice(folder.length + 1))
      .filter((path) => /^[^/]+\/README\.md$/.test(path)),
  ];
  for (const path of doc_paths) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    copyFileSync(join(folder, path), join(dist, path));
  }
  //A link to a file that is not a doc of the package is broken in node_modules
  for (const path of doc_paths)
    for (const target of relative_links(
      readFileSync(join(folder, path), "utf8"),
    )) {
      const resolved = posix.normalize(posix.join(posix.dirname(path), target));
      if (!doc_paths.includes(resolved))
        throw new Error(
          `${folder}/${path} links to ${target}, which is not a doc of the package, the link would be broken in node_modules`,
        );
    }

  //AGENTS.md, refers to the docs
  const modules = doc_paths
    .filter(
      (path) =>
        /^[^/]+\/README\.md$/.test(path) && !NOT_BUILT.has(path.split("/")[0]),
    )
    .map((path) => {
      const module = path.split("/")[0];
      const about = summary(readFileSync(join(folder, path), "utf8"));
      return `- \`${pkg.name}/${module}\`, \`${path}\`${about ? ": " + about : ""}`;
    });
  const pattern = doc_paths.includes(PATTERN)
    ? [
        "## Writing your own elements",
        `Elements of this package, and elements you write on its \`Base\`, follow the element pattern in \`${PATTERN}\` next to this file. ` +
          `Read it before writing an element. ` +
          `It names files by their repo path, find them in \`SOURCE.md\` under \`## <path>\`. ` +
          `Its complete example is described in \`${PATTERN_EXAMPLE}/README.md\`, its source is \`${folder}/${PATTERN_EXAMPLE}/\` in \`SOURCE.md\`, ` +
          `it is not exported from the package, copy from it instead of importing it. ` +
          `Paths under \`dev/\` are dev pages of the library repo and not part of the package.`,
      ]
    : [];
  const agents = [
    `# ${pkg.name}, notes for agents`,
    header,
    "The docs of this version are files next to this one. Read `README.md` for the package, " +
      "and the README of each module you use before using it. Every module is a subpath export, like `" +
      pkg.name +
      "/<module>`.",
    ...internal_deps.map(
      (dep) =>
        `This package builds on \`${dep}\`, its docs and source are in \`node_modules/${dep}/\`, start with its \`AGENTS.md\`.`,
    ),
    "## Modules",
    modules.join("\n"),
    ...pattern,
    "## Source",
    "The full source of this version is in `SOURCE.md` next to this file, every file under a `## <repo path>` heading, " +
      "e.g. search it for `## " +
      folder +
      "/<module>/` to find a module.",
    "## Reporting problems with this library",
    "This library is developed alongside the projects that use it, problems found while using it should be fixed in the library. " +
      "If something is wrong, missing, undocumented or awkward to use:",
    [
      "- Do not patch it in `node_modules` and do not silently work around it.",
      "- Tell the user, with the package name and version, the repo path and function or class from `SOURCE.md`, " +
        "what you expected, what happened, and what you did instead.",
    ].join("\n"),
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
      "The docs are in `AGENTS.md` and the README files next to this file.",
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
