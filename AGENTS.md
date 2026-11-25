# ts-lib

Monorepo (npm workspaces) publishing two packages:

| Package               | Folder         | Rule                                                                                    |
| --------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `@chocbite/ts-lib`    | `package-core` | Platform independent. **No browser features** (no DOM, no `window`, no `localStorage`). |
| `@chocbite/ts-lib-ui` | `package-ui`   | Browser UI. Depends on `@chocbite/ts-lib`.                                              |

ts-lib-ui must never be imported from ts-lib.

## Intended use

ts-lib-ui is for single page applications that run offline on low end hardware. Runtime performance wins over file size, download size is a one time cost. The following are deliberate, do not flag or change them:

- Zoom and page panning are disabled (`touch-action: none` on `html`).
- Global styling of `html` and scrollbars, and side effects at import (custom element definitions, observers, singletons).
- No accessibility support (no `role` / `aria-*`).
- HTML is not supported, elements are only created in code with their factory functions or `new`. Constructors build children and set attributes, so `document.createElement`, HTML markup, `innerHTML` and `cloneNode` do not work.
- Fonts and icons are bundled, fonts inlined into `style.css`, so nothing is fetched at runtime.
- Icons exist both as SVGs (`SVGFunc`, lets library users pass custom icons) and as the Material icon font (`icons/mixins.scss`). The font is used where many icons are rendered, e.g. lists, because a glyph is cheaper than an svg subtree.

Bundling is fine, but unused icons must still be tree-shakeable by the consumer's bundler.

## Layout

Each module is a folder `<folder>/<module>/` directly in the package folder, with an `index.ts` and its own `README.md`. A package folder holds only its modules, `package.json` and `README.md`, and in `package-ui` also `PATTERN.md`.
The tests of a module are in its `tests/` folder, `<module>/tests/<name>.test.ts`, one flat folder also for the sources in sub folders, with helpers only the tests use next to them. They import the files of their own module with `../`, like `../number/slider/slider`, which is fine as it stays inside the module. `tests/` folders are never built or put in `SOURCE.md`.
A module can have a `scripts/` folder with TypeScript scripts that generate its data, run with plain `node` from the repo root, like `package-ui/keyboard/scripts/cldr_layouts.ts`. Like `tests/` they are never built or put in `SOURCE.md`, and they are typechecked through `tsconfig.node.json`. Notes for working on the module itself, like how to run its scripts, go in an `INTERNAL.md` next to its `README.md`, which is not published.
Every module is published as a subpath export, e.g. `@chocbite/ts-lib/state` and `@chocbite/ts-lib-ui/theme`. There is no root export.

- ts-lib: `colors common depot event math parse result safe state string`
- ts-lib-ui: `base canvas composition context_menu document dom form icons keyboard list prompts selection settings spinner state_ui svg theme`

## Element pattern

ts-lib-ui elements take their inputs with one pattern: factory functions taking optional options, inputs declared as keys with `input_key`, and `set(options)` with initial values or states. The pattern is for the interface users of the library see, configuration that never changes, references up the tree and internal logic stay out of it. **Read [package-ui/PATTERN.md](package-ui/PATTERN.md) before writing a new element or reworking an existing one, and copy from its complete example [package-ui/pattern_example](package-ui/pattern_example/index.ts).** It is the pattern to use from now on, new elements must follow it. When the pattern changes, update both. The build copies PATTERN.md into the published ts-lib-ui, its `AGENTS.md` points to it, and puts the example source in its `SOURCE.md`, so agents in consumer projects find them too.

Most existing elements still use the older styles: constructor options, setters and getters, or `opts`. Do not copy them into new code, and do not convert an element nobody asked to change.

## Imports

- Same package: `import { x } from "#common"` (the `#*` pattern in the `imports` field of the package's `package.json`). No `../../` paths between modules.
- ts-lib-ui to ts-lib: `import { x } from "@chocbite/ts-lib/common"`. The `development` export condition resolves this to source, so no build is needed while developing.
- Adding a module: create `<folder>/<name>/index.ts`, nothing else. The `exports` and `imports` of the package are `./*` and `#*` patterns, and the tsdown config builds every folder with an `index.ts`. A folder without an `index.ts` is not a module. The one exception is `package-ui/pattern_example`, listed in `NOT_BUILT` in `config/tsdown.config.ts`: it is typechecked, tested and used by its dev page, but never built or exported.

## Commands

Everything runs from the repo root, the packages have no scripts or config files of their own. Prefer the narrow test forms.

```
npm install
npm run dev                           # dev server for trying out the libraries by hand, see dev/README.md
npm run typecheck
npm run lint
npm test                              # all, typecheck then tests
npm run vitest -- run --project core  # one package (core or ui), no typecheck, core is node and fast
npm run vitest -- run --project ui list  # one module, the path is relative to the package folder
npm run build                         # both packages into dist/ts-lib and dist/ts-lib-ui
npm run release                       # typecheck, test, build, publish both dist folders
```

Config files are all in `config/`, the scripts pass them with `--config`, so run tools through the npm scripts (`npm run vitest` instead of `npx vitest`): `vite.config.ts` (dev server, and the `core` and `ui` vitest projects), `tsdown.config.ts`, `eslint.config.js`, and `tsconfig.core.json`, `tsconfig.ui.json`, `tsconfig.dev.json` and `tsconfig.node.json` (the config files themselves and the module `scripts/`) on `tsconfig.base.json`. Core and ui are separate TypeScript programs because only ui gets the `DOM` lib. The root `tsconfig.json` only references them, it stays in the root because editors and typescript-eslint look for a `tsconfig.json` next to or above a file. `.vscode/settings.json` points the ESLint and Vitest extensions at `config/`.

ts-lib tests run in plain Node. ts-lib-ui tests run in Chromium via `@vitest/browser-playwright` (`npx playwright install chromium` once).

Vitest strips types without checking them, so type tests (`expectTypeOf`, `// @ts-expect-error`) only fail through `tsc`. That is why `npm test` runs `npm run typecheck` first.

When fixing a bug, write the test first and run it to see it fail for the reason of the bug, then fix the code and see it pass. A test that never failed does not show it catches the bug. A type bug is seen failing through `npm run typecheck`, not vitest.

## Publishing

Packages are published from `dist/ts-lib` and `dist/ts-lib-ui` in the repo root, never from the package folder (those are `"private": true`). `main` publishes itself: Forgejo mirrors the repo to `https://github.com/chocbite/ts-lib`, where the GitHub Actions workflow `.github/workflows/release.yml` runs on every push to `main`, runs the tests, and publishes each package whose version is not on npm yet, so bumping the version in the root `package.json` on `main` is a release. It uses npm trusted publishing, no token, which npm only supports from GitHub, GitLab and CircleCI, not Forgejo: each package on npmjs.com trusts that workflow file by name, so renaming it breaks publishing. npm adds provenance, which needs the `repository.url` of the packages to be the GitHub repo. By hand only `npm run release` publishes: it runs typecheck and all tests first, then builds and runs `config/write-dist-package.js`, which writes a `package.json` into each dist folder with only consumer facing fields (no scripts, devDependencies, `imports` or the `development` condition). The `./dist/` paths in the package `exports` are rewritten to the dist folder. A plain build leaves the dist folders without a `package.json`, so it cannot be published by hand without the tests. A new top level `package.json` field that consumers need must be added to the script's `KEEP` list.

`npm run build` also runs `config/write-dist-agent-docs.js`. It copies the docs into each dist folder in the layout of the package folder: the package `README.md`, `PATTERN.md` and every module `README.md`, so links between them work, and a relative link to anything else fails the build. It writes `AGENTS.md` (version and commit, where the docs are with a line per module, how to report library problems), which refers to the docs instead of holding them, and `SOURCE.md` (all source except tests, each file under a `## <repo path>` heading). Agents in consumer projects read these from `node_modules` instead of a full source tree. Usage notes for consumers therefore belong in the package or module `README.md`.

## Dev pages

`npm run dev` serves `dev/`, where the user tries out the libraries by hand: how things look and feel, sizes, hover effects, what is missing. See `dev/README.md`.

- When adding or changing a feature, add or update its page in `dev/pages/<package>/<module>.ts` (e.g. `dev/pages/ui/list.ts`). Big modules get a folder with several pages, e.g. `dev/pages/ui/form/`.
- A page is a plain module that builds into `document.body` when imported, no exports. Every `.ts` file in `dev/pages/` is a page, so shared code goes in `dev/helpers.ts`.
- Import the libraries like a consumer, `@chocbite/ts-lib-ui/list`, never `#` imports or relative paths into the package folders.
- Show variations side by side with `section`, `row`, `box` and `controls` from `dev/helpers.ts`, with a note per section on what to look at. Deterministic data, expensive cases (thousands of elements) behind a button.
- The trial frame calls `theme_init` and applies theme, input mode, scale and animation level from the shell, pages must not call `theme_init`.
- The shell (`dev/index.html`, `dev/shell.ts`) must never import from the libraries, so it keeps working while they are broken.
- Check with `npm run typecheck:dev` (not part of `npm run typecheck`) and by loading the page.
- Agents only use ports 50000 and up for anything they start for testing, the dev server included: `npm run dev -- --port 50000`. The lower ports, like the default 9998, belong to the user's own servers. Other agents use the same range, so let the server move on to a free port and use the port it prints. Address it as `127.0.0.1`, since `localhost` can reach another server on the same port.

## Git

Work is done on a branch, not on `main`. At the start of a task that changes files, check the branch, and if it is `main`, warn the user before making changes and offer to create a branch for the work.

## Conventions

- Temporary files, like scripts that drive the dev pages with Playwright, go in `tmp/` in the repo root, which git ignores. Scripts there resolve `playwright` from the repo's `node_modules`. Never put them in the repo root or other tracked folders.
- `*.trials.ts` and `trials/` folders are old manual demo code, kept as reference. Do not add new ones, use dev pages. Never export them from an `index.ts`, they must not end up in builds.
- ts-lib enforces DOM-free code three ways: tsconfig `lib` has no `DOM`, eslint `no-restricted-globals`, and Node-only tests.
- Enum icons in `state` are typed through the global `ChocbiteStateRegister` interface. ts-lib-ui augments it with `icon: SVGFunc` (see `package-ui/svg/index.ts`). Without ts-lib-ui no icon can be given.
- ts-lib-ui settings groups are named `@chocbite/ts-lib-xxx` so modules do not collide.
- ts-lib-ui CSS is one `dist/style.css`, imported by every built file.
- The ts-lib-ui theme applies nothing until the app calls `theme_init` once (deliberate, the app decides if the device has an operating system dark mode). Tests that check applied theme values must call it.
- Ask the user before modifying files unless they asked for the change.
- A bug or missing feature found in another module, for example in ts-lib while working on ts-lib-ui, is reported to the user and fixed at its source, never worked around in the calling code or its tests. Stop and ask before continuing past it.
