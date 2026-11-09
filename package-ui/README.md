# @chocbite/ts-lib-ui

Browser UI TypeScript libraries, built on [@chocbite/ts-lib](https://www.npmjs.com/package/@chocbite/ts-lib).

## Install

```bash
npm install @chocbite/ts-lib-ui
```

`@chocbite/ts-lib` is installed with it as a dependency.

## Usage

Every module is its own subpath export, there is no root export.

```ts
import ctm from "@chocbite/ts-lib-ui/context-menu";
import { svg } from "@chocbite/ts-lib-ui/svg";
```

### Creating elements

Elements are created in code, with their factory functions (e.g. `form_button()`) or `new`. HTML is not supported: `document.createElement`, elements written in HTML, `innerHTML` and `cloneNode` do not work. Elements build their children in their constructor, which the browser only allows for `new`, and many constructors need arguments.

### Names of stored settings

Settings like the theme are stored in the local storage under the name of their package, e.g. `@chocbite/ts-lib-theme/theme`. `settings_set_name_transform` renames them for every package. The settings are read when their module is imported, so it must be called in a module that is imported before any other module of this library:

```ts
//setup.ts, the first import of main.ts
import { settings_set_name_transform } from "@chocbite/ts-lib-ui/settings";
settings_set_name_transform((name) => name.replace("@chocbite/ts-lib", "myapp"));
```

Called later, it reports the settings that already use their name with `console.error`. Renaming starts from empty settings, values stored under the old names are not moved.

## CSS

All styles are in one `style.css`, which every module imports itself. A bundler that handles CSS imports (e.g. Vite) picks it up automatically, nothing needs to be imported by hand.

SCSS mixins are available for use in your own styles:

```scss
@use "@chocbite/ts-lib-ui/theme/mixins" as scrollbar;
@use "@chocbite/ts-lib-ui/icons/mixins" as iconfont;
```

## Modules

- `@chocbite/ts-lib-ui/base`
- `@chocbite/ts-lib-ui/canvas`
- `@chocbite/ts-lib-ui/context-menu`
- `@chocbite/ts-lib-ui/document`
- `@chocbite/ts-lib-ui/dom`
- `@chocbite/ts-lib-ui/form`
- `@chocbite/ts-lib-ui/icons`
- `@chocbite/ts-lib-ui/keyboard`
- `@chocbite/ts-lib-ui/list`
- `@chocbite/ts-lib-ui/selection`
- `@chocbite/ts-lib-ui/settings`
- `@chocbite/ts-lib-ui/spinner`
- `@chocbite/ts-lib-ui/svg`
- `@chocbite/ts-lib-ui/theme`
- `@chocbite/ts-lib-ui/viewport`
