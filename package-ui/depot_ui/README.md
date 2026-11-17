# @chocbite/ts-lib-ui/depot_ui

Selectors for the depot of `@chocbite/ts-lib/depot`.

Importing `@chocbite/ts-lib-ui` types depot icons as `SVGFunc`, so `type`, `group` and `add` take an icon as their last argument.

## `depot_ui.select(from, options?)`

Opens a selector for the entries of a type or group in a modal panel of `composition`, like the prompts of `prompts`, and returns a promise of the selected entries. Cancelling, with the Cancel button, the close button of the panel or Escape, gives an empty array. The panel can be moved and sized, and its colors come from the composition theme.

```ts
import depot from "@chocbite/ts-lib/depot";
import depot_ui from "@chocbite/ts-lib-ui/depot_ui";

const picked = await depot_ui.select(widgets, {
  mode: "multi",
  filter: (entry) => entry.parent === basic, // only basic widgets can be picked
});
for (const entry of picked) console.log(entry.path);
```

Options:

- `mode`: `"single"` (default) or `"multi"`. In single mode a double click on an entry picks it right away.
- `filter(entry)`: only entries passing the filter are shown and can be selected, groups with no shown entry below them are hidden. Use it for what the caller needs.
- `selected`: entries selected when the selector opens.
- `title`: shown at the top, the name of the group when undefined.

Groups can not be selected, only entries. The search box filters while typing on names and paths without case, and opens the groups while a search is set. The selector follows the depot while it is open, entries registered or removed show right away.

## `depot_ui.select_state(options?)`

The selector for the states type, with a column of the live value of every state. It works like `select`, the entries it gives hold the state as `entry.value`.

```ts
const [entry] = await depot_ui.select_state({ writable: true, kind: "number" });
if (entry) bind_to(entry.path, entry.value);
```

Options, besides `mode`, `filter`, `selected` and `title` of `select`:

- `from`: a group of the states type to select from, all states when undefined. A group of another type throws.
- `writable`: only writable states can be selected.
- `kind`: `"number"`, `"string"`, `"boolean"`, `"enum"` or an array of them, only states of these kinds can be selected. The kind comes from the helper of the state (`state.n`, `state.s`, `state.b`, `state.e`), or else from the current value of a sync state. A state whose kind can not be known, like an async state without a helper, is hidden when `kind` is given. The kind is worked out when the tree changes, a sync state without a helper changing kind while the selector is open is not followed.

The value column uses the unit and decimals of a number helper and the names of an enum helper, when those are sync states. Errors are shown dimmed. Values are only subscribed while their row is shown.

## `DepotTree`

The filtered view the selector is built on, for building other selectors. `new DepotTree(group, filter?)` gives `rows(group?)`, a state of the shown children of a group, made for the rows and sub rows of a `list` container. Set `search` to filter by text, and call `dispose()` when done to drop the subscriptions to the depot. Changes in the depot are applied once after a burst of changes, in a microtask.
