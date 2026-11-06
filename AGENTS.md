# ts-lib

Monorepo (npm workspaces) publishing two packages:

| Package               | Folder | Rule                                                                                    |
| --------------------- | ------ | --------------------------------------------------------------------------------------- |
| `@chocbite/ts-lib`    | `core` | Platform independent. **No browser features** (no DOM, no `window`, no `localStorage`). |
| `@chocbite/ts-lib-ui` | `ui`   | Browser UI. Depends on `@chocbite/ts-lib`.                                              |

ts-lib-ui must never be imported from ts-lib.

## Intended use

ts-lib-ui is for single page applications that run offline on low end hardware. Runtime performance wins over file size, download size is a one time cost. The following are deliberate, do not flag or change them:

- Zoom and page panning are disabled (`touch-action: none` on `html`).
- Global styling of `html` and scrollbars, and side effects at import (custom element definitions, observers, singletons).
- No accessibility support (no `role` / `aria-*`).
- Fonts and icons are bundled, fonts inlined into `style.css`, so nothing is fetched at runtime.
- Icons exist both as SVGs (`SVGFunc`, lets library users pass custom icons) and as the Material icon font (`icons/mixins.scss`). The font is used where many icons are rendered, e.g. lists, because a glyph is cheaper than an svg subtree.

Bundling is fine, but unused icons must still be tree-shakeable by the consumer's bundler.

## Layout

Each module is a folder `<folder>/src/<module>/` with an `index.ts` and its own `README.md`.
Every module is published as a subpath export, e.g. `@chocbite/ts-lib/state` and `@chocbite/ts-lib-ui/theme`. There is no root export.

- ts-lib: `colors common depot event math parse result state string`
- ts-lib-ui: `base canvas context-menu document dom form icons keyboard list selection settings spinner svg theme viewport`

## Imports

- Same package: `import { x } from "#common"` (the `imports` field in the package's `package.json`, one entry per module). No `../../` paths between modules.
- ts-lib-ui to ts-lib: `import { x } from "@chocbite/ts-lib/common"`. The `development` export condition resolves this to source, so no build is needed while developing.
- Adding a module: create `src/<name>/index.ts`; add `exports` and `imports` entries to that package's `package.json` (the `exports` entry has `development`, `types`, `import`). The tsdown config picks up the folder automatically.

## Commands

Run from the repo root for everything, or with `-w @chocbite/ts-lib` / `-w @chocbite/ts-lib-ui` for one package. Prefer the narrow form.

```
npm install
npm run typecheck
npm run lint
npm test                              # all
npm test -w @chocbite/ts-lib          # node, fast
npx vitest run src/state              # inside a package folder, one module
npm run build                         # ts-lib first, then ts-lib-ui
npm run release                       # typecheck, test, build, publish both dist folders
```

ts-lib tests run in plain Node. ts-lib-ui tests run in Chromium via `@vitest/browser-playwright` (`npx playwright install chromium` once).

## Publishing

Packages are published from `dist`, never from the package folder (those are `"private": true`). Only `npm run release` publishes: it runs typecheck and all tests first, then builds and runs `config/write-dist-package.js`, which writes `dist/package.json` with only consumer facing fields (no scripts, devDependencies, `imports` or the `development` condition) and copies the package `README.md`. A plain build leaves `dist` without a `package.json`, so it cannot be published by hand without the tests. A new top level `package.json` field that consumers need must be added to the script's `KEEP` list.

## Conventions

- `*.trials.ts` and `trials/` folders are manual demo code. Never export them from an `index.ts`, they must not end up in builds.
- ts-lib enforces DOM-free code three ways: tsconfig `lib` has no `DOM`, eslint `no-restricted-globals`, and Node-only tests.
- Enum icons in `state` are typed through the global `ChocbiteStateRegister` interface. ts-lib-ui augments it with `icon: SVGFunc` (see `ui/src/svg/index.ts`). Without ts-lib-ui no icon can be given.
- ts-lib-ui settings groups are named `@chocbite/ts-lib-xxx` so modules do not collide.
- ts-lib-ui CSS is one `dist/style.css`, imported by every built file.
- Ask the user before modifying files unless they asked for the change.
