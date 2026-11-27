# List

Table-like lists of rows with resizable columns, optional sub rows, add row buttons and row selection. Rows come from an array or an array state. Only the rows that changed are touched when an array state changes.

```ts
import list from "@chocbite/ts-lib-ui/list";
import { ok } from "@chocbite/ts-lib/result";
```

## `list.container(config, options)`

The list follows the element pattern, see [PATTERN.md](../PATTERN.md). The configuration is fixed for the life of the list, as the header, the lead columns and the rows are built from it. The options are its inputs, `container.set(options)` changes them later, options left out stay as they are.

The row elements are internal. The list is used through its data, its transform, its options and states, never by reading or changing its row elements.

Configuration:

- `transform(data, row, rows)`: turns the data of a row into row options. It returns `ok({ values, ... })`, where `values` has a value per column key. Returning `err(text)` makes the row invalid: the text replaces its fields, and it gets no sub rows, add row, context menu or selection.
- `headless`, `sub_rows`, `observer`, `selection` (mode and key) and `reorder`.
- `search_delay` and `search_menu`, see [Search](#search).

Inputs:

- `columns`: an object of columns made with `list.column({...})` or `list.column_string(title)`, the keys are the column keys. Required at creation, as it decides the keys and value types the transform gives values for. `set` can replace them with columns of the same keys and types, to change titles, widths or order.
- `rows`: an array or an array state of row data. An error of the state shows as the error row and the fault icon.
- `add_row`: the add row below the rows, `{ text, icon, on_add, access }`, `null` removes it. Each option is a fixed value or a state, `access` locks it like any element.
- `selected`: the keys of the selected rows, with the selection configuration, see [Selection](#selection).
- `search` and `search_bar`: the text the rows are searched for, and a search bar above the list, see [Search](#search).
- `filter` and `column_search`: conditions on the values of the columns, and the cells under the titles that edit them, see [Column search](#column-search).
- `access`, like every element.

```ts
const users = state.ok_w([{ id: 1, name: "Ann" }]);
const container = list.container(
  { transform: (user) => ok({ values: { name: user.name } }) },
  { columns: { name: list.column_string("Name") }, rows: users },
);
container.set({ rows: other_users });
```

### Fields

A column makes a field per row with `field_gen()` and gives it the value of the row with `field_apply(field, value)`. A field can be any element of the library:

- **`list.text_field()`, `list.number_field()`, `list.node_field(node)`** are the plain fields, the cheapest for columns that only show values. `column_string(title)` is a column of text fields.
- **An element following the element pattern, like a form element,** is used directly, `field_apply` gives it its value with `set`. A writable state then changes with the user, and a row reused for other data swaps its states. The row wraps it in a `list-cell`, which gets the row background, borders and padding, so the element keeps its own look and fills the width of the column, giving up minimum widths of its own like the 14rem of a stepper in touch mode:

```ts
list.column({
  title: "Speed",
  field_gen: () => form.stepper({ min: 0, max: 100 }),
  field_apply: (field, speed: StateROSW<number>) => field.set({ value: speed }),
});
```

With the `observer` option every field gets the observer, so the states of a field are only subscribed while it is in view, see the base README. Without it they are subscribed while the field is in the document, which for a long list is every row.

Row options besides `values`: `openable`, `opened`, `sub_rows` (with the `sub_rows` container option), `key_field`, `add_row`, `context_menu`, `selectable` and `search` (see [Search](#search)).

With sub rows, add rows and error texts sit in the key field after the tree lines and run from the key column to the end of the row. A list can therefore have no value columns at all, `{}` as columns with the names as key field text.

### Open rows

`opened` is whether a row is open, an input the user changes, like the selected keys:

- **A plain value** is where the row starts, applied when the row is made. Later data does not open or close it, so a row the user closed stays closed when the rows are set again. The row keeps the user's opening and closing itself, also when it is reused for other data, so give a state when whether an entry is open has to follow the entry.
- **A writable state** is written when the user opens or closes the row: with the opener, the keys of the key field, a click on a row that can only be opened, the "Open" and "Close" lines of the row menu, open all, close all and a drag that opens a row. The row opens and closes when the state gives the value back, so a state that rejects a write leaves the row as it is.
- **A read only state** is only followed. The user can not open or close the row: it has no opener arrow, the tree lines show in its place and an open row keeps its line down to the sub rows, its row menu has no "Open" or "Close" line, and open all and close all leave it as it is.

A row opens to its state whenever it can be opened: an `openable` state that is false first, or turns false and back to true, opens the row again while the state is true. Closing because the row can not be opened, or has no sub rows, does not write the state, the list only writes it on user actions. An error of the state closes the row.

Because the state belongs to the data and not to the row element, a list that rebuilds its rows keeps them open. Keep one state per entry and give it in the transform. A row reused for other data follows the state of the new data and lets go of the old one.

```ts
const open = new Map<string, StateROSW<boolean>>();
const opened = (name: string) =>
  open.get(name) ?? open.set(name, state.ok_w(false)).get(name)!;

list.container(
  {
    transform: (section: Section) =>
      ok({
        openable: true,
        opened: opened(section.name),
        sub_rows: () => section.properties,
        values: {},
      }),
    sub_rows: true,
  },
  { columns: {}, rows: sections },
);
```

## Opening and closing all rows

With sub rows the key column header has an open all and a close all button. The [menu of the list](#the-menu-of-the-list) has "Open all", and "Close all" while a row is open, also on every row, so lists without a header can open and close all too. `container.open_all()` and `container.close_all()` do the same for buttons of the app.

Open all opens level by level, so the upper levels are open first. It stops after opening 1000 rows and warns at the key column header, opening all again continues. That keeps a mistake that makes the sub rows recursive from freezing the app. Rows whose sub rows come from a state that delivers later open with what they have.

Close all closes every open row, sub rows included, so every writable `opened` state is set to false and sub rows do not open again with their parent.

## Resizing columns

Columns without a `fixed_width` get a handle at the right of their header, a double click on it resets the column. The first resize gives every auto width column the width it has, so only the dragged column changes. The key field column of sub rows never gets smaller than its widest key field needs for the indent, the opener, the icon and 4rem of the text, so it grows when deeper sub rows open. Text that does not fit wraps. A list without value columns has its key column fill the list until it is resized.

A `headless` list has no handles, so `init_width` does not apply and columns without a `fixed_width` get an automatic width.

## The menu of the list

A list with sub rows, multi mode selection or `search_menu` has a context menu of its own, a group of lines each:

1. With sub rows, "Open all", and "Close all" while a row is open.
2. In multi mode, "Select all" and "Deselect all".
3. With `search_menu`, the lines of the search, see [The search menu](#the-search-menu).

It opens for a right click on any part of the list without a menu of its own: the headers, the search bar and the cells of the column search, their text inputs included, the space below the rows, and a sub row without a menu, like an invalid one. Rows put their own lines in front of it, see [Row menu](#row-menu). A list with none of these still takes the right clicks on it, the menu has no lines then and nothing opens, so the menu of the browser never opens on a list.

## Selection

The `selection` configuration lets the user select rows. It adds a column in front of the rows, with radio buttons in single mode and checkboxes in multi mode, so selection works on touch without modifier keys. Single mode with sub rows has no such column, a click on the row selects it and the key field takes the keyboard, so radio buttons would only take space.

The selected keys are the `selected` input, an input the user changes, like the value of a form element:

- **A fixed value** is where the selection starts, the list keeps the user's changes itself.
- **A writable state** is written when the user changes the selection, so several lists, or any other element, can share one state.
- **A read only state** is only shown, a change by the user is refused with "Selection read only" at the row, an error of kind `list.errors.SELECTION_READ_ONLY`.
- **Not given**, the list starts with nothing selected and keeps the selection itself.

```ts
const selected = state.ok_w<number[]>([]);
const container = list.container(
  { transform, selection: { mode: "multi", key: (user) => user.id } },
  { columns, rows: users, selected },
);

selected.sub((keys) => console.log("selected", keys.value));
selected.write([1, 4]); // selects the rows with these keys
```

Options:

- `mode`: `"single"` (radio buttons, none with sub rows) or `"multi"` (checkboxes). In multi mode the header checkbox selects all rows or clears, and shows whether some or all rows are selected, and the [menu of the list](#the-menu-of-the-list) has "Select all" and "Deselect all". In single mode the header cell is empty.
- `key`: the identity of the data of a row. Defaults to the data itself. Give a key whenever the data can be equal between rows, like primitives, or is replaced by new objects on updates. Keys must be unique among all rows, sub rows included.

A row with `selectable: false` in its row options, or an invalid row, can not be selected. Its radio button or checkbox cell is empty, and trying to select it shows "Not selectable" at the row, an error of kind `list.errors.NOT_SELECTABLE`.

A row that can not be selected but can be opened, like a folder in a tree where only the entries are picked, opens and closes with a click on the row or space in its key field instead, without a warning. Only the first click of a double click counts, so a double click opens it and leaves it open. A click on its radio button or checkbox cell still warns.

### The state

- The list shows a row as selected when its key is in the state. Keys without a visible row are kept in the state, they show as soon as their row is visible again, for example when its parent is opened, or the row comes back in the data.
- The list writes the state only on user actions, never on its own. Rows that are removed, closed away, hidden by the search, become invalid or unselectable, or get another key do not change the state.
- Writes use array write instructions, so only the changed keys are sent and only their rows are touched: a toggle writes a `push` or `delete`, while a plain click, a range and single mode replace the selection with a `fresh` array. The bound state must apply these instructions, which local writable states like `state.ok_w` do.
- A toggle or ctrl shift range keeps the keys the list does not show, so lists showing different rows can share a state. Select all replaces the selection with all visible selectable rows of the list, deselect all and escape clear the whole selection.
- The rows show a change when the state gives it back, so a state that rejects a write, or writes asynchronously, is shown as it is. The nice text of the error of a rejected write is shown at the row as the validation message of the browser. An error of the state shows nothing selected.
- The state is attached while the list is in the document, like other element states.
- `set({ selected })` swaps the state, and a fixed value gives the list a selection of its own again.

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

The list adds lines in front of the row's own `context_menu`, each group with a divider after it:

1. In lists with sub rows, "Open" or "Close" for a row that can be opened, not for a row with a read only `opened` state, then "Open all", and "Close all" while a row is open.
2. "Select" or "Deselect" for a selectable row, then in multi mode "Select all" and "Deselect all".
3. With `search_menu`, the lines of the search, see [The search menu](#the-search-menu).
4. The row's own lines.

Groups 1 to 3 without the lines of the row are the [menu of the list](#the-menu-of-the-list), so every row has them.

Nothing has to be done for it, `context_menu` stays a menu or a function giving an option of a menu.

The menu is combined with `ctm.combine` of the context menu module when it opens, so it shows the open state and the selection at that moment (also for an `openable` state), and rows that are never right clicked cost nothing. A right click never changes the selection by itself, so the row line says "Select" or "Deselect" by the state of the row. A row with nothing to select, in a list without a menu of its own, uses its own menu as it is, and has no menu without one.

## Search

The `search` input is the text the rows are searched for, an input the user changes, like the selected keys:

- **A fixed value** is where the search starts, the search bar changes it.
- **A writable state** is written by the search bar, so a search field elsewhere in the app can share the state.
- **A read only state** is only followed, the search bar is locked.
- **Not given**, the list starts without a search.

`search_bar: true` shows a bar with a text input and a clear button above the list, the header sticks below it and escape clears it. Without the bar the search still applies, so the app can put its own field anywhere. An empty or blank text shows every row, otherwise the text is matched as part of a value, ignoring case.

The search waits until the text has not changed for the `search_delay` of the configuration, 200 ms by default, so typing searches once the user pauses instead of at every key. The first text of the input, and enter, the clear button and escape in the bar, search right away. `search_delay: 0` searches at every change.

```ts
const text = state.ok_w("");
list.container(config, {
  columns,
  rows: users,
  search: text,
  search_bar: true,
});
```

### What matches

Each row answers with its `search` row option, a function of the query that gives:

- What `query.match(values, key)` found: the row matches, and the columns and the key field text it found the text in are highlighted.
- `"match"`: the row matches without highlighting anything, like for text it does not show.
- `"below"`: the row does not match, but something below it does. The list opens it for the search and filters its sub rows by their own answers.
- `"none"`: the row is hidden.

A row that matches is shown as it is, its sub rows are not filtered when it is open.

A row without the option matches when the text is in one of its values or in its key field text, which are highlighted, and the search never opens it. Strings and numbers are matched as text, a sync state by its value, and anything else only through the `search_value(value)` option of its column, which gives a string or number for it, like the name of an object a node field shows. The value of an enum column with `choices` is matched by the name of its choice.

A value can also be given as `{ value, text }`, a value shown as a text: the search text matches the text and conditions check the value, the way an enum value is shown by its name.

The list never opens rows to search them, it has no rows for sub rows that are not open, while the app has the data. So in a tree, rows below closed rows are only found through the `search` option. `query.match(values, key)` matches the text the way the list does, also for data without a row. `values` are by column key, so the answer can return what it found, and it gives `undefined` when nothing has the text:

```ts
const found_below = (folder: Folder, query: ListSearchQuery): boolean =>
  folder.children.some(
    (child) => query.match({}, child.name) || found_below(child, query),
  );

list.container(
  {
    transform: (folder: Folder) =>
      ok({
        openable: folder.children.length > 0,
        key_field: { text: folder.name },
        sub_rows: () => folder.children,
        search: (query) =>
          query.match({}, folder.name) ??
          (found_below(folder, query) ? "below" : "none"),
        values: {},
      }),
    sub_rows: true,
  },
  { columns: {}, rows: folders, search: text, search_bar: true },
);
```

An answer can also give the columns itself, `{ columns: ["name"], key: true }`. A row opened for what is below it highlights nothing.

The rows answer again when the text or their data changes, not when a value state changes.

### Rows the search opens

- The search opens level by level, and stops after opening 1000 rows with a warning at the bar, like open all, so an answer that keeps finding something below can not freeze the app.
- Opening for the search is not the user's, it does not write `opened` states. When the search no longer finds something below a row it opened, the row closes again, unless its `opened` state is true. Rows that were open before the search stay open.
- A row the user closes stays closed until the text changes.

### Hidden rows

- Hidden rows leave the selection like rows that are closed away, their keys stay in the state and show as selected again when the search clears. Select all selects only the rows that are shown.
- The arrow keys and open all skip them, and alt with the arrow keys moves a row past them.
- Invalid rows are hidden while searching, and "No matches" shows while nothing matches.
- The rows that are shown keep alternating their backgrounds.

### Column search

The `filter` input holds conditions on the values of the columns. A row matches when it meets every condition and has the search text, and only the text is highlighted. It is plain JSON, so the app can store it in a state and restore it, and conditions of columns the list does not have are left out, like after an update of the app:

```ts
const filter = state.ok_w<ListFilter>({
  conditions: [
    { column: "age", type: "number", op: ">=", value: 30 },
    { column: "name", type: "string", op: "contains", value: "an" },
  ],
});
```

| `type`   | `op`                                                         | `value`                                               |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `string` | `contains`, `not_contains`, `is`, `is_not`, `starts`, `ends` | text, ignoring case                                   |
| `number` | `=`, `!=`, `<`, `<=`, `>`, `>=`                              | number                                                |
| `number` | `between`, `not_between`                                     | `[from, to]`, both ends in the range, in either order |
| `bool`   | none                                                         | `true` or `false`                                     |
| `enum`   | `in`, `not_in`                                               | array of values                                       |

The conditions check the value the search reads from a column, see [What matches](#what-matches), and a row without a value of the type of a condition does not meet it.

The filter is a tree. Its `mode` says how its conditions combine: `"all"` of them are met, the default, `"any"` one of them, or `"none"` of them. A condition can also be a group, with a mode and conditions of its own, also groups, to any depth:

```ts
//Active, and younger than 20 or paused
const filter = state.ok_w<ListFilter>({
  conditions: [
    { column: "active", type: "bool", value: true },
    {
      type: "group",
      mode: "any",
      conditions: [
        { column: "age", type: "number", op: "<", value: 20 },
        { column: "status", type: "enum", op: "in", value: ["paused"] },
      ],
    },
  ],
});
```

None of a group is not the group: none of status paused or younger than 20 keeps the rows that are neither. An empty group is no condition, and a group left empty by leaving out conditions of columns the list does not have is left out with them. `filter` is an input the user changes like `search`: a writable state is written by the cells, a read only state locks them, a fixed value is where the list starts.

The `column_search` input shows a cell under the title of each column, by the `type` of the column, `column_string` gives `"string"`:

- `string` and `number`: a text input, the value typed after an operator, see below.
- `bool`: a press goes from any to yes to no and back.
- `enum`: a press folds the `choices` of the column down under the cell, over the rows, a press on one picks it or leaves it out, rows with one of the picked values show. They stay until a press outside, escape or another press on the cell, and fit in the list, turning to the left at its right side. The cell shows the names of the picked choices.
- A column without a type gets an empty cell.

The choices are the values by the name they are shown by, the shape of the list of an enum of the state module, so its value can be given as is:

```ts
const STATUS = { running: { name: "Running" }, stopped: { name: "Stopped" } };
list.column({
  title: "Status",
  type: "enum",
  choices: STATUS,
  field_gen: () => list.text_field(),
  field_apply: (field, status: keyof typeof STATUS) =>
    (field.text = STATUS[status].name),
});
```

The values are the keys, so they are strings, a row value written as a number matches the key it is written as.

A text or number cell starts with `~`, and focusing it puts the caret after it, so typing finds a similar value. Backspace and another operator change it, a value typed without one is `~`:

| Operator | Text column               | Number column                                |
| -------- | ------------------------- | -------------------------------------------- |
| `~`      | contains the text         | has the number as text, `4` finds 45 and 2.4 |
| `!~`     | does not contain the text | does not have the number as text             |
| `=`      | is the whole text         | is the number                                |
| `!=`     | is not the whole text     | is not the number                            |
| `^`      | starts with the text      |                                              |
| `$`      | ends with the text        |                                              |
| `>` `>=` |                           | is bigger, or bigger or the same             |
| `<` `<=` |                           | is smaller, or smaller or the same           |

Two numbers with `..` between them are a range with both ends in it: `30..50` is between, also after `=` or `~`, and `!=30..50` is not between, `!~` as well. A range can not be bigger or smaller.

Text is compared ignoring case. `≥ ≤ ≠`, single keys on the symbol page of the keyboard module, are the same as `>= <= !=`, and a comma is a decimal point. A value the cell can not read, like `=4x` or `>b` on text, shows in the error color and does not filter. What is typed stays as it is while it means the same, a condition from the app shows written with its operator, like `>=30`.

A cell means "and its condition": it edits the conditions of its column on the root of the filter while the root is all of them. A column with a condition in a group, or on a root of any or none, shows a summary ending in `…`, as more goes into it than the cell can show. A condition typed in a cell of a column without one goes on the root, and a root of any or none is first put in a group under all of them, so what it says stays the same. The cross of a cell clears its column in the whole tree.

Typing waits for the search delay, enter searches right away, escape and the cross clear a cell back to `~`. The cells do not change the widths of the columns. Conditions a cell can not edit, like a range the app gives, show as a summary after `&`, the sign of the advanced filter, like `& >=30, <=50`, with a cross that clears them. A press on the summary opens the [advanced search](#advanced-search), and so does `&` typed in a text or number cell, starting a new condition of its column. The enum cell has "Clear all" above its choices. `column_search` is an input the user changes too, the menu writes it. Without it the filter still applies, and a headless list shows only the cells.

A row answering the search itself gives `query.match` the values of the columns with conditions, a condition of a column `match` gets no value for is not met. In a tree that is also what decides whether something below a row meets them:

```ts
search: (query) =>
  query.match({ size: file.size }, file.name) ??
  (found_below(file, query) ? "below" : "none"),
```

`query.filter` gives the tree of conditions to an answer that checks them itself, only of columns the list has and without empty groups.

### The search menu

With `search_menu: true` in the configuration the [menu of the list](#the-menu-of-the-list) and the menus of the rows get the lines of the search:

- "Search columns" or "Hide column search", unless `column_search` is a read only state. Search columns needs a column with a type. Hiding also clears the filter, so no filter that can not be seen stays.
- "Advanced search…", while there is a column with a type and the filter is not a read only state, see below.
- "Clear search", while there is a text or a filter the user can change, clears both.

### Advanced search

A dialog for what a cell can not make, like a range, `>=30` and `<=50` on one column, and for groups of conditions. It opens from the menu, from a press on the summary of a cell, from `&` typed in a text or number cell, and from `container.advanced_search(column?)` for a button of the app, given a column it starts a new condition of it.

It shows the filter as a tree of groups. A group has a header with its mode, "All of these", "Any of these" or "None of these", Add condition, Add group and a button that removes it with what is in it. Under the header are its conditions and groups, a nested group indented with a line down its left, in a collapser of `form`, whose Collapse button under them hides them, the button then shows a line of what is in it. The root is the whole filter, it can not be collapsed or removed.

A condition is a row: a dropdown of the columns with a type, a dropdown of the operators of the type, the value, and a button that removes the row. The operators are those of the cells, written with words, `>= at least`, with "between" and "not between" for numbers. The value is a text input for text and numbers, two for a range, yes or no for a bool, and the choices of an enum to pick several from. A row without a value is left out, and a group left empty with it. A condition of a column without a type or not in the list is shown as it is, it is kept, and its button removes it. Clear all removes everything.

It edits a copy: Apply, or enter in a value, writes the filter and closes, Cancel, escape and the close button close without changing it. It is a modal panel of `composition` in the document of the list, and gives the focus back to where it was when it closes. The panel fits the dialog until the user sizes it, then only the conditions scroll and the buttons stay at its bottom. A read only filter state does not open it.

## Reorder

The `reorder` option adds a column of drag handles in front of the rows, before the selection column. Rows are moved by dragging their handle, or with alt and arrow up or down in the key field or selection cell.

```ts
const group = list.drag_group<File>();
list.container(
  {
    transform,
    sub_rows: true,
    reorder: {
      group, // optional, lists of one group give rows to each other
      can_drop: (file, target) => target.parent?.kind !== "file",
    },
  },
  { columns, rows: files },
);
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

Selected rows get the `selected` class and the theme variables `list.colors.background.row_selected` and `row_selected_hover`. The cells the search found its text in are covered by `list.colors.background.found`, see through so the background of the row shows under it. The radio buttons, checkboxes and drag handles are glyphs of the bundled Material icon font, colored by `list.colors.icon.check` and `list.colors.icon.drag`. The drop line, the box around a row dropped into and the focus use `list.colors.focus.normal`. Dragged rows are dimmed until the move comes back from the state.
