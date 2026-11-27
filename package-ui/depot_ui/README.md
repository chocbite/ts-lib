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

Groups can not be selected, only entries. The search bar is the one of `list`, see its Search section: it searches once typing pauses, or at once on Enter. Entries match by their name, description or path, without case. A group with a match below it opens for the search and closes again when the search no longer finds it, a group whose own name or description matches with nothing below it shows closed. Escape clears the search, and with nothing to clear cancels. The selector follows the depot while it is open, entries registered or removed show right away.

## `depot_ui.select_state(options?)`

The selector for the states type, with a column of the live value of every state. It works like `select`, the entries it gives hold the state as `entry.value`, or a value for an entry registered with one that never changes, `state.as_state(entry.value)` gives a state either way.

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

The filtered view the selector is built on, for building other selectors. `new DepotTree(group, filter?)` gives `rows(group?)`, a state of the shown children of a group, made for the rows and sub rows of a `list` container. `search(child, query)` is the answer of the row of a child to the search of the list, give it as the `search` row option so the list search works as in the selector. Call `dispose()` when done to drop the subscriptions to the depot. Changes in the depot are applied once after a burst of changes, in a microtask.

```ts
const tree = new DepotTree(group);
list.container(
  {
    transform: (child) =>
      ok({
        key_field: { text: child.name },
        openable: child.kind !== "entry",
        sub_rows: child.kind === "entry" ? undefined : () => tree.rows(child),
        search: (query) => tree.search(child, query),
        values: { description: child.description },
      }),
    sub_rows: true,
  },
  { columns, rows: tree.rows(), search_bar: true },
);
```

The answer can highlight the key field and a column named `description`, so name the column of the descriptions that.
