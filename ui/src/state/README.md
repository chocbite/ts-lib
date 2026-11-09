# State UI

Shows states of `@chocbite/ts-lib/state` in the document. Everything is on the `state_ui` object, named so it does not collide with `state` of `@chocbite/ts-lib/state`, which has array features of its own. Like `state`, short and long names point to the same thing: `state_ui.a` is `state_ui.array`.

```ts
import state_ui from "@chocbite/ts-lib-ui/state";
```

## `state_ui.a.apply(parent, array, handlers)`

Applies an array to the child nodes of a parent, one node per value. Arrays from array states carry what changed (added, removed, changed, moved), so only those nodes are touched. A plain array is applied as a whole.

```ts
const list = document.createElement("div");
names.sub((names) => {
  state_ui.a.apply(list, names.ok ? names.value : [], {
    create: (name) => {
      const line = document.createElement("div");
      line.textContent = name;
      return line;
    },
    update: (line, name) => (line.textContent = name),
    destroy: (line) => console.log("removed", line.textContent),
  });
}, true);
```

Handlers, typed as `StateUIArrayApplyHandlers`:

- `create` gives the node for a value.
- `update` is optional. When given, nodes are reused: changed values update their node, and a whole new array updates the existing nodes before adding or removing the difference. Without it, nodes of changed values are replaced.
- `destroy` is optional, called for every node that is removed or replaced.

The parent must contain nothing but the nodes made for the array.
