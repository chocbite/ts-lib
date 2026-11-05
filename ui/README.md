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
