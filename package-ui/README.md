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

## Errors

The errors of states are `NiceError`s from `@chocbite/ts-lib/result`: a kind whose description is a short nice text for the user, the message with the details, and for failures that aren't supposed to happen an `Error` as `cause` with its stack. Each element shows what fits its space:

- Most elements, like the error row of a list, a topbar label or the title of a container, show only the nice text.
- The warning of a form element, shown for a moment when a change is refused, has room for both: `Value too high: Maximum value 10`. `warn` also takes a plain string, for feedback of the element itself while typing.
- A form element keeps the error of its state, readable as `element.error`, with all its details.
- Callbacks like `map_err` of the state bindings of `Base` and `on_error` of a list selection get the `NiceError`.

**The fault icon:** an element following the element pattern, see [PATTERN.md](PATTERN.md#the-fault-icon), shows a small broken link icon in its corner while any of its inputs is in error. A click on it opens a prompt, see [prompts](prompts/README.md#faults), with the nice text and message of each problem, and the stack traces with their causes on request. It needs no code in the element, so problems look the same across the whole UI. Its colors are the theme variables of `base`.

Kinds made by the elements are in `form.errors` (`READ_ONLY`, a change to an element bound to a read only state) and `list.errors` (`NOT_SELECTABLE`). The number and text inputs check their own limits with the kinds of `state.errors`, like `ABOVE_MAX`.

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
- `@chocbite/ts-lib-ui/composition`
- `@chocbite/ts-lib-ui/context-menu`
- `@chocbite/ts-lib-ui/document`
- `@chocbite/ts-lib-ui/dom`
- `@chocbite/ts-lib-ui/form`
- `@chocbite/ts-lib-ui/icons`
- `@chocbite/ts-lib-ui/keyboard`
- `@chocbite/ts-lib-ui/list`
- `@chocbite/ts-lib-ui/prompts`
- `@chocbite/ts-lib-ui/selection`
- `@chocbite/ts-lib-ui/settings`
- `@chocbite/ts-lib-ui/spinner`
- `@chocbite/ts-lib-ui/state_ui`
- `@chocbite/ts-lib-ui/svg`
- `@chocbite/ts-lib-ui/theme`
