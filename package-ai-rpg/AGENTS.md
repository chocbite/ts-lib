# ai-rpg

A text based AI RPG, a browser single page application. It is a private app in the ts-lib monorepo, never published.
It exists alongside `@chocbite/ts-lib` (`../package-core`) and `@chocbite/ts-lib-ui` (`../package-ui`) and is also a test bed for them.

The game design is in `DESIGN.md`, read it before working on the game. Decided points are not changed without the user, and new decisions are written there.

## Use the library first

The game is built on ts-lib and ts-lib-ui. Before writing anything that is not specific to the game, check whether the library already has it:

- Read the root `README.md` of each package and the `README.md` of each module, e.g. `../package-core/state/README.md`, `../package-ui/list/README.md`.
- ts-lib (platform independent): `colors common depot event math parse result state string`
- ts-lib-ui (browser UI): `base canvas context-menu document dom form icons keyboard list selection settings spinner state_ui svg theme`

Use the library's patterns too: `state` for values that change and are shown, `result` for errors, elements created in code with their factory functions or `new` (no HTML, `innerHTML` or `document.createElement` for library elements), `settings` for stored user settings, `theme` for colors and scale.

`form` elements are for forms only, like the settings and review panels. The game screen (prompt bar, menu button, status line) uses plain elements styled by the game. Labels and notes in a form are `form.text`, form elements have no label option on purpose.

## Patterns that may belong in the library

The library grows from what its apps need, but whether something belongs there is decided from working code, not a description.

- **Something generic** (a helper, a UI element, a state or event pattern, parsing, formatting, storage, anything another app could use): build it in `src/lib/`, in its own module with no game specific code in it, so it could be moved to the library as is. Tell the user when you have built it, so it can be considered for the library.
- **A pattern repeated** in the game, or between the game and the library: point it out to the user.
- **The library has something close** but it is missing an option, is awkward to use, or has a bug: tell the user before working around it, do not work around library bugs silently.

Do not change the library on your own. When the user decides to move something there, follow the root `../AGENTS.md` (ts-lib stays DOM free, module README, tests, dev page).

## Dependencies

Runtime dependencies are only `@chocbite/ts-lib` and `@chocbite/ts-lib-ui`. Do not add npm packages, dev dependencies included, without asking the user. If something is missing, it is likely a library candidate, see above.

## Build

The game has its own build, separate from the library's. The root scripts (`npm test`, `npm run build`, `npm run lint`, ...) do not touch this folder, and the scripts here do not build the library.

Run from this folder, or from the repo root with `-w @chocbite/ai-rpg`:

```
npm run dev          # dev server on port 9997
npm run typecheck
npm run lint
npm test             # typecheck then tests, in Chromium
npm run build        # typecheck then build to dist/index.html
```

Configs are in `config/`, the scripts pass them with `--config`. Only `tsconfig.json` stays in the package root, because editors look for it there, it only references the configs in `config/`.

The library is resolved to its source through the `development` export condition (in `config/vite.config.ts` and `config/tsconfig.base.json`), in dev, tests and build. Library changes show in the game right away, and no library build is needed.
Library source is typechecked with the game's tsconfig, so keep its compiler options compatible with the library's (`../config/tsconfig.base.json`).

The build is a single self contained `dist/index.html`: code, css, fonts and images are all inlined, nothing else is emitted and nothing is fetched at runtime besides the AI server. The `single-file` plugin in `config/vite.config.ts` fails the build if anything would end up as a separate file, so do not add code that loads files at runtime (`fetch` of assets, `new URL(..., import.meta.url)`, workers from separate files, lazy loaded chunks expecting their own file).

## Layout

- `index.html`, `src/main.ts`: entry.
- Code is split into modules, `src/<module>/index.ts`, imported within the game as `#<module>` (the `imports` field in `package.json`). No `../` paths between modules.
- `src/lib/<module>/`, imported as `#lib/<module>`: everything generic, with nothing game specific in it, the candidates for the library. Anything library like goes here and nowhere else, so the user can review it in one place, and lib modules never import game modules.
  - `ids`: readable ids (`char:mara-2`) and random record ids
  - `mention`: `[Name](id)` mentions in text
  - `schema`: a JSON schema subset, sent to the LLM and used to check its reply
  - `db`: promise based IndexedDB with results
  - `file`: save a file to the user, let the user pick a file
  - `llm`: client for OpenAI compatible servers, streaming, cancelling, JSON schema replies
  - `later`: debounce by key with a flush, flushed when the page is hidden
  - `dom`: `el()`, make an element with a class and children
  - `local`: local storage that never throws, for conveniences
- Game modules:
  - `world`: characters, locations, the change list and applying it
  - `game`: stored records, rounds and phases
  - `options`: user settings
  - `prompts`: prompt and reply schema of every role
  - `store`: IndexedDB layout, continuous saving, save files
  - `engine`: runs the rounds, the only place game state changes
  - `ui`: the views
  - `quick`: a ready made game for development, started with Quick game in the menu, so rounds can be tried without the game builder
- The library is imported like a consumer, `@chocbite/ts-lib/state`, `@chocbite/ts-lib-ui/list`. Never relative paths into `../package-core` or `../package-ui`.
- Tests are `*.test.ts` next to the code, run in Chromium via vitest browser mode. Vitest strips types without checking them, so `npm test` runs `tsc -b` first.

## Conventions

- Ask the user before modifying files unless they asked for the change.
