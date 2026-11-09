# Dev

A dev server for trying out the libraries by hand: how things look and feel, whether sizes and hover effects make sense, what is missing. It is not tests, and it is never built or published.

```
npm run dev
```

## How it works

- `index.html` / `shell.ts` is the shell: the page list and the controls. It must never import from the libraries, so it keeps working while they are broken. It remembers the selected page and controls in localStorage.
- `trial.html` / `trial.ts` runs in the shell's iframe. It applies the theme, input mode and scale from the shell, then loads one page. Changing them in the shell applies them while the page runs, without a reload. Everything the libraries do to the document (global styles, custom elements, errors) stays in the frame.
- Libraries resolve to source through the `development` condition, so changes show without a build. A change reloads the frame and it scrolls back to where it was. SCSS changes apply without a reload.

## Pages

A page is any file in `pages/`, for example `pages/ui/list.ts` shows up as `list` under `ui`. No exports or registration, a page is a module that builds into `document.body` when imported. Import the libraries the way a consumer would, `@chocbite/ts-lib-ui/list`.

`helpers.ts` has plain DOM helpers for laying out a page: `section`, `row`, `box` and `controls`. Show variations side by side, that is where differences are easiest to judge.

The frame calls `theme_init`, so pages must not.

`npm run typecheck:dev` typechecks the shell and pages, it is not part of `npm run typecheck`.
