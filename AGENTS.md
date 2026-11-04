# ts-lib

Monorepo (npm workspaces) publishing two packages:

| Package | Folder | Rule |
|---|---|---|
| `@chocbite/ts-lib` | `ts-lib` | Platform independent. **No browser features** (no DOM, no `window`, no `localStorage`). |
| `@chocbite/ts-lib-ui` | `ts-lib-ui` | Browser UI. Depends on `@chocbite/ts-lib`. |

ts-lib-ui must never be imported from ts-lib.

## Layout

Each module is a folder `<pkg>/src/<module>/` with an `index.ts` and its own `README.md`.
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
```

ts-lib tests run in plain Node. ts-lib-ui tests run in Chromium via `@vitest/browser-playwright` (`npx playwright install chromium` once).

## Conventions

- `*.trials.ts` and `trials/` folders are manual demo code. Never export them from an `index.ts`, they must not end up in builds.
- ts-lib enforces DOM-free code three ways: tsconfig `lib` has no `DOM`, eslint `no-restricted-globals`, and Node-only tests.
- Enum icons in `state` are typed through the global `ChocbiteStateRegister` interface. ts-lib-ui augments it with `icon: SVGFunc` (see `ts-lib-ui/src/svg/index.ts`). Without ts-lib-ui no icon can be given.
- ts-lib-ui settings groups are named `<package name>/<module>` so modules do not collide.
- ts-lib-ui CSS is one `dist/style.css`, imported by every built file.
- Ask the user before modifying files unless they asked for the change.
