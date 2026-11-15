# List

Table-like lists of rows with resizable columns, optional sub rows, add row buttons and row selection. Rows come from an array or an array state. Only the rows that changed are touched when an array state changes.

```ts
import list from "@chocbite/ts-lib-ui/list";
import { ok } from "@chocbite/ts-lib/result";
```

## `list.container(columns, transform, rows, options?)`

- `columns`: an object of columns made with `list.column({...})` or `list.column_string(title)`. The keys are the column keys.
- `transform(data, row, rows)`: turns the data of a row into row options. It returns `ok({ values, ... })`, where `values` has a value per column key. Returning `err(text)` makes the row invalid: the text replaces its fields, and it gets no sub rows, add row, context menu or selection.
- `rows`: an array or an array state of row data.
- `options`: `headless`, `sub_rows`, `add_row`, `observer` and `selection`.

```ts
const users = state.ok_w([{ id: 1, name: "Ann" }]);
const container = list.container(
  { name: list.column_string("Name") },
  (user) => ok({ values: { name: user.name } }),
  users,
);
```

Row options besides `values`: `openable`, `opened`, `sub_rows` (with the `sub_rows` container option), `key_field`, `add_row`, `context_menu` and `selectable`.

## Resizing columns

Columns without a `fixed_width` get a handle at the right of their header, a double click on it resets the column. The first resize gives every auto width column the width it has, so only the dragged column changes. The key field column of sub rows never gets smaller than its widest key field needs for the indent, the opener, the icon and 4rem of the text, so it grows when deeper sub rows open. Text that does not fit wraps.

## Selection

The `selection` option lets the user select rows. It adds a column in front of the rows, with radio buttons in single mode and checkboxes in multi mode, so selection works on touch without modifier keys.

The selection is an array state of keys owned by the app, given to the list with `bind`, the same way form elements take their value. Several lists, or any other element, can share one state.

```ts
const selected = state.ok_w<number[]>([]);
const container = list
  .container(columns, transform, users, {
    selection: { mode: "multi", key: (user) => user.id },
  })
  .bind({ selection: selected });

selected.sub((keys) => console.log("selected", keys.value));
selected.write([1, 4]); // selects the rows with these keys
```

Options:

- `mode`: `"single"` (radio buttons) or `"multi"` (checkboxes). In multi mode the header checkbox selects all rows or clears, and shows whether some or all rows are selected. Right click (or long press) on it opens a menu with "Select all" and "Deselect all". In single mode the header cell is empty.
- `key`: the identity of the data of a row. Defaults to the data itself. Give a key whenever the data can be equal between rows, like primitives, or is replaced by new objects on updates. Keys must be unique among all rows, sub rows included.

A row with `selectable: false` in its row options, or an invalid row, can not be selected. Its radio button or checkbox cell is empty.

### The state

- The list shows a row as selected when its key is in the state. Keys without a visible row are kept in the state, they show as soon as their row is visible again, for example when its parent is opened, or the row comes back in the data.
- The list writes the state only on user actions, never on its own. Rows that are removed, closed away, become invalid or unselectable, or get another key do not change the state.
- Writes use array write instructions, so only the changed keys are sent and only their rows are touched: a toggle writes a `push` or `delete`, while a plain click, a range and single mode replace the selection with a `fresh` array. The bound state must apply these instructions, which local writable states like `state.ok_w` do.
- A toggle or ctrl shift range keeps the keys the list does not show, so lists showing different rows can share a state. Select all replaces the selection with all visible selectable rows of the list, deselect all and escape clear the whole selection.
- The rows show a change when the state gives it back, so a state that rejects a write, or writes asynchronously, is shown as it is. The reason of a rejected write is shown at the row as the validation message of the browser, like the form elements do. An error of the state shows nothing selected.
- The state is attached while the list is in the document, like other element states.
- Without `bind` the selection is kept in a state of the list nobody else can reach, `bind({})` goes back to that.

The selection follows the data, not the row elements. When a whole new array reuses row elements by position, each row shows the selection of its new key.

### Input

| Input                         | single                                                        | multi                                      |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| click                         | select only it                                                | select only it                             |
| ctrl click                    | toggle                                                        | toggle                                     |
| shift click                   | select only it                                                | select the range from the last clicked row |
| ctrl shift click              | select only it                                                | add the range                              |
| radio button / checkbox click | select only it                                                | toggle                                     |
| right click                   | only opens the menu of the row, the selection does not change | same                                       |

The keyboard works in the key field (lists with sub rows), or else in the radio button or checkbox cell:

- Arrow up and down only move the focus, the selection changes with space.
- Shift with arrows extends the range (multi).
- Space selects only the focused row in single mode, and toggles it in multi mode or with ctrl.
- Enter opens and closes sub rows. Right and left open and close.
- Ctrl+A selects all visible rows (multi). Escape clears.

### Row menu

The list adds lines in front of the row's own `context_menu`, each group with a devider after it:

1. "Open" or "Close" for a row that can be opened, in lists with sub rows, with or without selection.
2. "Select" or "Deselect" for a selectable row, and in multi mode "Select all" and "Deselect all".
3. The row's own lines.

Nothing has to be done for it, `context_menu` stays a menu or a function giving an option of a menu.

The menu is combined with `ctm.combine` of the context menu module when it opens, so it shows the open state and the selection at that moment (also for an `openable` state), and rows that are never right clicked cost nothing. A right click never changes the selection by itself, so the row line says "Select" or "Deselect" by the state of the row. A row with nothing to open or select uses its own menu as it is, and has no menu without one.

## Reorder

The `reorder` option adds a column of drag handles in front of the rows, before the selection column. Rows are moved by dragging their handle, or with alt and arrow up or down in the key field or selection cell.

```ts
const group = list.drag_group<File>();
list.container(columns, transform, files, {
  sub_rows: true,
  reorder: {
    group, // optional, lists of one group give rows to each other
    can_drop: (file, target) => target.parent?.kind !== "file",
  },
});
```

- Only rows in a writable array state can be moved, they show a handle. Rows of a plain array or a read only state have an empty handle cell.
- Like the selection, the list only writes the moves to the rows states, the rows move when the states give the change back. A rejected write leaves the rows where they are and shows the reason at the row, like the form elements do.
- A drop goes before or after a row, or into an openable row as its last sub rows. Dropping after an open row puts the rows first in its sub rows. Hovering into a closed row opens it after a moment, and a drop into it opens it. Below the last row drops at the end. Escape cancels a drag.
- Inside one parent a move is one `move` write. Moving to another parent or list first inserts into the target and then removes from the source, so a failed write can leave a row in both places but never loses it. If the app removes rows itself when they are added somewhere else, `no_remove: true` on the list the rows are dragged from makes it only insert.
- Dragging a selected row in multi mode moves all visible selected rows, in their order. Rows next to each other in one parent move with one write. Sub rows of a dragged row move with it.
- A row can not be dropped into itself or its sub rows. `can_drop(data, target)` decides the rest, `target.parent` is the data of the row the rows go into, undefined for the top level, and `target.list` the list.
- `list.drag_group<R>()` makes a group of lists that can give rows to each other. Only lists with exactly the same row type can join a group. Without a group rows only move inside their list.
- A row moved to another parent is a new row element, so its sub rows close.

## Look

Selected rows get the `selected` class and the theme variables `list.colors.background.row_selected` and `row_selected_hover`. The radio buttons, checkboxes and drag handles are glyphs of the bundled Material icon font, colored by `list.colors.icon.check` and `list.colors.icon.drag`. The drop line, the box around a row dropped into and the focus use `list.colors.focus.normal`. Dragged rows are dimmed until the move comes back from the state.
