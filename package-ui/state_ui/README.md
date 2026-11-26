# State UI

Connects states of `@chocbite/ts-lib/state` and the document: arrays applied to child nodes with `state_ui.a.apply`, and the width and height of an element as states with `state_ui.size`. Everything is on the `state_ui` object, named so it does not collide with `state` of `@chocbite/ts-lib/state`, which has array features of its own. Like `state`, short and long names point to the same thing: `state_ui.a` is `state_ui.array`.

```ts
import state_ui from "@chocbite/ts-lib-ui/state_ui";
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

- `create` gives the node for a value. Its second argument gives the index of the node as a state, see below.
- `update` is optional. When given, nodes are reused: changed values update their node, and a whole new array updates the existing nodes before adding or removing the difference. Without it, nodes of changed values are replaced.
- `destroy` is optional, called for every node that is removed or replaced.

The parent must contain nothing but the nodes made for the array.

### The index of a node

The second argument of `create`, typed as `StateUIArrayIndex`, gives the index of the node in the array as a read only `StateROS<number>`, for nodes placed by their index, like in a fixed position layout.

```ts
state_ui.a.apply(board, cards, {
  create: (card, index) => {
    const element = document.createElement("div");
    element.textContent = card.name;
    index().sub((i) => (element.style.top = i.value * 3 + "rem"), true);
    return element;
  },
});
```

- **Only nodes that call it are followed.** The state is made by the first call, later calls give the same state. Nodes that never call it cost nothing, and while no node of the parent has asked, `apply` does nothing extra.
- **It follows every change.** After the changes of an array are applied, the nodes in the positions that shifted get their new index: from an insert or removal to the end, and between the two ends of a move. A changed value or a whole new array keeps the index of every node it keeps. An index that stays the same tells no one, so only the subscribers of nodes that moved are told.
- **Asked later,** for example when the element is placed, it gives the current index of the node.
- **A removed or replaced node** is no longer followed, its state keeps its last index.

An insert at the start moves every node after it, so with thousands of nodes placed by index, add at the end where it can be done.

## `state_ui.size(element)`

```ts
const { width, height } = state_ui.size(canvas_box);
const redraw = () => draw(width.ok(), height.ok());
width.sub(redraw, true);
height.sub(redraw);
```

The width and height of the content box of an element, inside its padding, as two read only states in px. Two states, not one object, so each can be connected to other elements on its own. Code needing both subscribes the same function to both, like above, so a change of either reaches it. Both are updated before any subscriber is told, so it always reads the new value of the other with `ok()`. When both change it is called twice, once per state.

- **Only observed while subscribed.** The element is observed from the first subscriber of either state to the last, sizes nobody follows cost nothing. One `ResizeObserver` serves every element.
- **The same element gives the same states**, so asking again adds nothing.
- **No flicker.** Observations come after layout and before paint, so something sized from them shows at its new size in the same frame.
- **0 until measured**, and while the element is not rendered, like with `display: none`.
- In px, like the layout, `px_to_rem` of `@chocbite/ts-lib-ui/theme` converts them.

Content of `@chocbite/ts-lib-ui/composition` has it as `content_size()`.
