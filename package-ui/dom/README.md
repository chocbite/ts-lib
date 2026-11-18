# @chocbite/ts-lib-ui/dom

Small helpers for plain DOM nodes.

```ts
import { node_clone } from "@chocbite/ts-lib-ui/dom";

const copy = node_clone(template_svg);
```

**`node_clone(node)`** is a deep copy of a node, typed as the node given. The icons of `@chocbite/ts-lib-ui/icons` use it to give a fresh copy of an svg parsed once.

It is for plain nodes only, like parsed svg or elements made with `document.createElement`. Elements of ts-lib-ui build their children and state in their constructor and in `create`, a copy of one is not a working element, make another with its factory instead.
