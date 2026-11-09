# @chocbite/ts-lib

Platform independent TypeScript libraries. No browser features are used, so everything works in Node, browsers and workers.

For browser UI, see [@chocbite/ts-lib-ui](https://www.npmjs.com/package/@chocbite/ts-lib-ui), which builds on this package.

## Install

```bash
npm install @chocbite/ts-lib
```

## Usage

Every module is its own subpath export, there is no root export.

```ts
import state from "@chocbite/ts-lib/state";
import { ok, err } from "@chocbite/ts-lib/result";
```

## Modules

- `@chocbite/ts-lib/colors`
- `@chocbite/ts-lib/common`
- `@chocbite/ts-lib/depot`
- `@chocbite/ts-lib/event`
- `@chocbite/ts-lib/math`
- `@chocbite/ts-lib/parse`
- `@chocbite/ts-lib/result`
- `@chocbite/ts-lib/state`
- `@chocbite/ts-lib/string`
