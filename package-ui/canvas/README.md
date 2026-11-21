# @chocbite/ts-lib-ui/canvas

Pages of widgets with a fixed position and size, shown in viewports that scale them to fit, with zooming, panning and a transformer to move, resize and rotate widgets.

Pages and widgets are data, not elements. Every viewport makes its own elements from the data, so one page can be shown in several viewports at once, like an editor and a preview. The elements are bound to the same states, so a change made in one viewport shows in all of them.

```ts
import canvas from "@chocbite/ts-lib-ui/canvas";
```

## Widget definitions

A widget definition says how to make the element of a widget, and which of its options the user changes. Definitions are registered in `canvas.widgets`, the `widgets` type of the depot of `@chocbite/ts-lib/depot`, so pages can refer to them by path, like `/widgets/basic/rectangle`.

```ts
const basic = canvas.widgets.group("basic", "Basic", "Basic shapes");
const rectangle = basic.add(
  "rectangle",
  "Rectangle",
  "A filled rectangle",
  canvas.definition({
    create: (options: RectangleOptions) => rectangle_widget(options),
    size: { width: 160, height: 80 },
    properties: {
      fill: { kind: "color", name: "Fill", default: "#2980b9" },
      corner: { kind: "number", name: "Corner radius", default: 0, min: 0 },
    },
  }),
);
```

- **`create`** is called once for every viewport showing the widget, always with the same options.
- **`size`**: the size of a new widget, 100 by 100 when not given.
- **`properties`**: the options the user changes, in the order they are shown, each with a name, a kind and the value a new widget starts with. The kinds are `number` (with `min`, `max`, `step`, `decimals` and `unit`), `text` (with `max_length`), `color` (with `alpha`, to set transparency), `boolean` and `enum` (with `list`, the values and their names). A `section` groups properties in the properties editor, see below. Position, size, rotation, opacity and visible are the base properties canvas adds to every widget, in the General section. Options without a property are left to code, like a state the widget is linked to.
- **`canvas.definition`** gives the definition as it is, typed by the parameter of `create`, so every property is checked against its option: a number option needs a number property, an enum default must be in its list. Without it the properties are only checked against the base options. The entry keeps the type of the definition, so `canvas.widget` checks the options against it too.

`canvas.widget_properties(definition)` lists every property of a widget, position, size, rotation, opacity and visible first. `await canvas.new_widget(entry, { x, y })` makes a new widget with a writable state for every property, starting at its default, as a result that is the error of the definition when it has none.

## Pages

A page is plain data: its size and its widgets, each an initial value or a state. A widget is the path of its definition and a state for every option.

```ts
const x = state.ok_w(20);
const widgets = state.ok_w<CanvasWidget[]>([
  canvas.widget(rectangle, {
    x,
    y: 20,
    width: 160,
    height: 80,
    fill: "#2980b9",
  }),
]);
const page: CanvasPage = { width: 800, height: 600, widgets };
```

- **`id`**: a name of the page, empty when not given.
- **`width` and `height`**: the size of the page in page units, 1920 by 1080 when not given.
- **`background`**: a CSS color, the page background of the theme when not given. `canvas.page_from_json` gives every page a state for each of these, the background white for pages saved without one.
- **`widgets`**: the widgets, the last is drawn on top. Change it with the array helpers of the state, like `widgets.array.push(widget)`, `delete(widget)` and `move(from, to)`, or the matching write instructions of `state.a.write`. The viewports apply the changes the state gives with `state_ui.a.apply`, so only the slots of added, removed or moved widgets are touched. A whole new array reuses the slots by place, a slot given another widget makes its element again, so prefer the helpers for small changes. A widget given twice is shown twice.
- **`canvas.widget(definition, options)`** makes a widget from a definition entry. An initial value or link is made a writable state, a state is used as it is. A base property not given gets a writable state at its default, the size from the definition when it is registered, so every widget can be moved, sized and linked. `canvas.page_from_json` does the same for a loaded widget. Or write `{ widget: path, options }` directly with a state for every option, like when a page is loaded.
- **Options are always states,** so every viewport shares them, the properties editor changes them, and storing the page follows them. A read only state locks the option. The state holds the value of the option, or a link to a state of the depot, see below.

A widget whose path is not registered, or is not a widget definition, shows an error in its place, made from its position and size. It is replaced by the widget as soon as the path is registered, so a page can be shown before the widgets it uses are registered.

## Links to depot states

The state of an option holds its value, or a link to a state registered in `depot.states`, like a measurement of a machine. Make links with `canvas.link(path)`, and write one to the state of an option to link it, or a value to unlink it:

```ts
const machine = depot.states.group("machine", "Machine", "");
machine.add("speed", "Speed", "Current speed in rpm", speed);

const widget = canvas.widget(gauge, {
  ...place,
  value: canvas.link<number>("/states/machine/speed"),
});
(widget.options.value as StateROSW<number | CanvasLink<number>>).set_ok(50); //unlinked
```

- Every viewport looks the path up and gives the widget the registered state, so it works like that state given to the option: a writable state is written by the user, a read only state locks the option. Widgets never see links.
- Until the path is registered as a state only that option is in error, the widget shows its fault, and it follows the state being registered, removed and registered again. Switching an option between a value and a link only changes that input, the widget is not made again.
- A link fits any option, as the state is only known once the page is shown. Give the value type, `canvas.link<number>(...)`, to check it against the option. `canvas.link(entry)` takes the entry instead of the path.
- **Values are converted to the type of the option,** by the kind of its property: numbers with `Number`, so `true` is 1, texts with `String` and booleans with `Boolean`. Any state can be linked to any option, a value giving no number, like the text "abc" for a number, faults the option. A value the widget writes back gets the type of the value of the linked state. Position, size, rotation and opacity are numbers, visible is a boolean, options without a property are not converted.
- The properties editor links and unlinks options, see below.

### Transforms

A link can change the value on its way, with transforms applied in order, and in reverse to a value the widget writes:

```ts
canvas.link<number>("/states/machine/x", {
  transforms: [canvas.linear([50, 100], [150, 200])],
});
```

- **`canvas.linear(from, to)`** maps a number from one range to the other, 75 becomes 175, and back when written. The value is made a number with `Number` first, so a boolean maps 0 and 1, like `canvas.linear([0, 1], [10, 50])` putting a widget at 10 or 50. A value giving no number faults the option.
- An option is read only when the linked state is, or when a transform can not be reversed, like a linear transform to a range of one value.
- More kinds can be added to canvas, each saved with its `kind`. A saved transform of a kind this version does not know is kept and faults the option.

### Saving

A link is saved as an object with only a `$link` key, so it is never mistaken for a value, and `canvas.page_from_json` makes it a link again:

```json
{
  "$link": {
    "kind": "depot",
    "path": "/states/machine/x",
    "transforms": [{ "kind": "linear", "from": [50, 100], "to": [150, 200] }]
  }
}
```

`kind` is what is linked to, only `depot` for now. An option value must never be an object with only a `$link` key.

## Adding widgets with a selector

`canvas.select_widget(options)` opens the selector of `depot_ui` for the registered widget definitions, and gives a new widget for every picked definition, made with `canvas.new_widget`, or none when cancelled. Add them to the widgets of a page:

```ts
const picked = await canvas.select_widget({
  mode: "multi",
  at: { x: 100, y: 50 },
});
widgets.set_ok([...widgets.ok(), ...picked]);
```

- `mode`: `"single"` (default) or `"multi"`.
- `at`: the position of the first new widget, every next one is placed 20 units further down and right.
- `filter`: only definitions passing it can be picked.
- `title`: the title of the selector, "Add widget" by default.

A definition whose content is in error is left out of the result, as it has no properties to make a widget from.

## Properties editor

`canvas.properties({ selected, page })` shows the properties of the selected widget in a list, or those several selected widgets have in common, see below, a row per property with a field bound to the option of the widget. Give it the selection state of the viewports to follow the selection:

```ts
const selected = state.ok_w<CanvasWidget[]>([]);
const editor = canvas.viewport({ page, edit: true, selected });
const properties = canvas.properties({ selected, page });
```

- The fields follow the options like form elements do: a writable state is written, so a change shows in every viewport, and a move in a viewport shows in the editor. A read only state is only shown.
- The base properties come first, in the General section, then the properties of the definition, see widget definitions.
- **Sections** keep widgets with many properties manageable. Properties with the same `section` are the sub rows of a row named by the section, placed where its first property is, Properties without a section, or with an empty one, are at the root. The editor remembers the open sections by name, so a section stays open when an option in it is linked or unlinked, and when another widget is selected.
- The title is the name of the definition, or tells that the widget is not registered.
- **With nothing selected** it shows the page given as `page`: its ID, Width, Height and Background, titled Page. A value that is not a writable state is only shown, and they can not be linked, as the page is not resolved like the options of widgets.
- A linked option shows the path it is linked to and the value the link gives, read only, as it is a state of the app.
- **The link column** has a chain for every option with a writable state, filled when linked. Pressing it opens the link menu: the path of the state, typed or picked with Choose state from `depot_ui.select_state`, and the fields of the transforms. Link writes the link to the option, Unlink writes the value the link gives now, or the default of the property when it gives none. An option of the definition not given to the widget has no state, so its field shows the default of the property read only and it can not be linked. Base properties always have a state, and widgets made by `canvas.new_widget` and the selector have a state for every property.
- The fields are form elements in a `list.node_field` for now, as each property has an element of its own kind, numbers in steppers, texts in text inputs, colors in color inputs, booleans in switches and enums in dropdowns. The link column has a fixed width.

### Several selected widgets

The title tells how many, like `3 × Box` when they are of one widget, or `3 widgets`. The editor shows the properties all of them have, with the same kind, in the order of the first, without the ID, as ids are unique:

- **A value they share** is shown, and a change sets it on all of them.
- **Where the values differ** the field is blank, a value entered sets all of them, after which the field shows it.
- **X, Y, Width, Height and Rotation** are the box around them, like the transformer shows it. Changing one moves or scales them like dragging the box does. They are blank and read only while the widgets are not shown in a viewport, and read only when a widget locks a part the change needs.
- **Rotation** is the rotation of the box, like the rotate handle turns it. A rotation entered turns the box to it, and the widgets with it around its center. X, Y, Width and Height are those of the box before turning, like for one widget.
- **The chain** links the option of all of them to the same state. Unlink gives each linked option the value its own link gives now. A link they share is shown like for one widget, a property linked in only some of them, or to different states, is blank and read only.
- Blank is the no-value look of the form elements: a grey line in text and number fields, a muted rainbow in color fields and the knob in the middle of a switch.

## Storing pages

A page in a state is stored with `register_debounced` of a settings group, which follows every state in the page and stores it shortly after the last change. `canvas.page_from_json` loads it again, with a writable state for every value and a link for every link:

```ts
const page = state.ok_w<CanvasPage>(
  group.get("page", default_page(), canvas.page_from_json).value,
);
group.register_debounced("page", "Page", "The page of the editor", page);
const editor = canvas.viewport({ page, edit: true });
```

## Viewports

```ts
const selected = state.ok_w<CanvasWidget[]>([]);
const editor = canvas.viewport({ page, edit: true, selected });
const preview = canvas.viewport({ page });
```

The viewport scales the page to fit its own size and centers it. Its options:

- **`page`**: the page shown. Give a state to switch pages, setting it to `undefined` shows nothing.
- **`edit`**: enables zooming, panning and changing widgets, with a checkerboard behind the page. Turning it off resets the view to fit the page.
- **`selected`**: the selected widgets, see below.

In edit mode:

- Wheel and touchpad two finger swipe pan, shift pans the vertical wheel horizontally, ctrl with the wheel zooms toward the pointer, touchpad pinch zooms, alt slows wheel zoom and pan down 10 times.
- Two finger touch pinches to zoom and pan, the middle or right mouse button drags to pan.
- Pressing a widget selects it, pressing the page clears the selection, see Selection.
- Widgets outside the page are shown, so they can be found and moved back.

## Selection

The `selected` option is the array of the selected widgets, as their data. In edit mode:

- **Pressing a widget** selects only it, **ctrl or shift** pressing it adds it to the selection, or takes it out.
- **Pressing the empty page** clears the selection, unless ctrl or shift is held. **Dragging on the empty page** draws a rectangle that selects the widgets whose whole outline is inside it, ctrl or shift adds them to the selection. On touch the first finger draws it, a second finger pinches instead.
- **Ctrl+A** selects all widgets while the viewport has focus, which pressing it gives, so ctrl+a in a text field is left alone. **Delete** or **backspace** then removes the selected widgets from the page.

The user changes it, like a value of a form element:

- **A writable state** is written when the user selects, with array instructions for adding and taking out, so several viewports, outlines and a properties editor share the selection.
- **An initial value, or no value,** is kept by the viewport.
- **A read only state** is only shown, pressing does not change it.

The viewport only changes the selection when the user presses, never on its own. Selected widgets that are not on the page are left out of the transformer, outside edit mode it is hidden, the selection stays.

## Widget IDs

Every widget has an `id`, the first base property in General. It is a text that can not be linked, it has no chain in the properties editor.

- **The page gives the ids.** A widget whose id is empty, or taken by a widget before it in the widgets of the page, gets the name of its widget and the first free number, like `Box-1`, written to its id state, so it is stored with the page. A page element does it when the widgets change or an id changes, so the ids are given while a viewport shows the page. A widget with a read only id state keeps its id.
- **The properties editor refuses an id** used by another widget of a page shown in the document, the field warns and the id stays.
- The outline and the viewport menu show the ids, the widget itself does not use its id.

## Outline

`canvas.outline({ page, selected })` lists the widgets of a page, the widget in front first, with its id and the name of its widget. A group is a row that opens to the widgets of its content, front first too, groups in groups as deep as they go, the outline shows the whole tree. The menus and keys of the outline act on the level of the row or of the selected widgets, deleting, pasting, grouping and ordering inside a group. The selection is of one level, selecting a widget of another level, like with ctrl click, keeps only the widgets of that level. Give it the selection state of the viewports. It selects like a list in multi mode: a click on a row selects only its widget, ctrl click and the checkboxes add or take out, shift click selects a range. The menu of a row orders or deletes the selected widgets when the row is one of them, else only its widget. Delete or backspace deletes the selected widgets while the outline has focus.

The add row below the widgets, Add widget, opens the widget selector of `canvas.select_widget`. The picked widgets are added in front, centered on the page, and selected. It is greyed out when the widgets of the page are not a writable state.

```ts
const outline = canvas.outline({ page, selected });
```

## Ordering and removing widgets

The last widget of a page is drawn on top. `await canvas.reorder(page, widgets, order)` moves widgets by writing move instructions to the widgets state of the page, so the viewports and outlines move only them, `order` is `"front"`, `"forward"` (one step), `"backward"` (one step) or `"back"`. Several widgets move together and keep their order, forward and backward move them past the next widget that is not one of them. It gives false when nothing can move that way or the widgets are not a writable state.

`await canvas.remove(page, widgets)` removes widgets by writing delete instructions to the widgets state of the page. It gives false when none of them is on the page, or the widgets are not a writable state.

The menus of the outline and the viewport have the same lines: Bring to front, Move forward, Move backward and Send to back, a line that can not move the widgets is greyed out, and Delete. Deleted widgets are taken out of the selection.

## Groups

A group is a widget whose content is a page of widgets of its own, registered by canvas as `/widgets/canvas/group`. Its options are the base ones and:

- **`display`**: how the content fits the group, `"scale"`, the default, scales it evenly to fit the group, centered, so it keeps its proportions, `"stretch"` scales each axis on its own to fill the group, like a picture, so text stretches and a turned widget in it shows slanted, `"fixed"` shows it at its own size from the top left, cut off, `"scroll"` at its own size with scrollbars when it is bigger.
- **`content_width` and `content_height`**: the size of the content.
- **`background`**: the background of the content, a CSS color like the background of a page, transparent by default.
- **`widgets`**: the widgets of the content, like the widgets of a page, not a property, so the properties editor does not show it.

Groups are saved, loaded and copied with their widgets. Every page element, the one inside a group too, keeps the ids of its own widgets unique, so ids are unique per level, the widgets in a group keep theirs.

`await canvas.group(page, widgets, rotation?)` groups widgets of a page into a new group, in the place of the front one of them in the drawing order, and gives it. The group is the box around them, turned by the rotation, its content the same size, displayed scaled, and the widgets keep their drawing order with positions relative to it. `await canvas.ungroup(page, groups)` puts the widgets of groups back in the place of each group, where the group shows them, and gives them. Linked positions keep their links.

A focused viewport or outline groups the selected widgets with ctrl+g, turned by the rotation of the box of the selection, and ungroups the selected groups with ctrl+shift+g, their widget menus have Group and Ungroup. The group, or the widgets that were in the groups, are selected after.

### Editing inside a group

An editing viewport edits inside a group with Edit in the menu of the group, or a double click on it, in place: the page stays where it is, grayed behind, with the group hidden in it, and the content of the group is shown on top exactly where the group shows it, moved, turned and scaled through every group of the path. Stretched content is edited fitted evenly, like scaled content, over the place of the group, as a stretch would slant turned widgets, which the transformer can not follow, so it lines up with the group as shown only roughly, and exactly again after leaving. Everything works on the content like on a page: selecting, the transformer, turned with the groups, the menus, the clipboard, grouping and ordering. Groups in groups go as deep as they go.

- **A double click** on a group edits inside it, on a spot without a widget of the level edited it goes up one level. The widget is found at the point, so a double click on a selected group works through its transformer.
- **The path** floats at the top left, a round exit button with a door, which goes up one level, then the levels by id as they change, the page first, each goes up to it. Going up selects the group it came out of. Entering clears the selection.
- **The content follows the groups:** a group of the path moved, scrolled, or given another content size or display, from another viewport too, places the content edited again.
- **Scrollbars:** a press on the scrollbar of a group displayed with scrollbars is left to the scrollbar, it does not select, and the edges of the transformer of a selected widget that scrolls let presses through, its center handle still moves it.
- **The path follows the structure:** a group of the path that is removed from its level, from another viewport or the outline, takes the viewport up to the deepest level left.
- **The id of the content** is the id of the group, it refuses an id another widget of the level of the group has, like the ID field of a widget.
- **Every viewport has its own path.** A viewport follows the selection to the level of the selected widgets, so selecting a widget in a group in the outline shows that group in the viewports.
- **Leaving edit mode** shows the page again.
- **`viewport.shown_page`** is a read only state of the page the viewport shows, the page given or the content of the group. Give it to a properties editor as its `page`, so with nothing selected it shows the level, for a group its id, content size and background.

```ts
const editor = canvas.viewport({ page, edit: true, selected });
const properties = canvas.properties({ selected, page: editor.shown_page });
```

## Cut, copy and paste

`canvas.copy(widgets)` copies widgets and gives their text for the clipboard of the system, `await canvas.cut(page, widgets)` copies them and removes them from the page, and `await canvas.paste(page, { at, text, within })` adds copies to the page, in front, and gives them.

- Widgets are copied as the JSON a page saves them as, so pasted widgets have states of their own, links included. The page gives them new ids, as theirs are taken.
- **The text** is `{"format":"chocbite-canvas-widgets","widgets":[...]}`. Pasting a text of this format pastes its widgets, so they can be copied between browsers, any other text pastes the widgets copied in the app. Options are copied as they are now, an option whose state has no value now is left out.
- **The copy is also kept in the app**, shared by every page and viewport of it, for where the clipboard of the system can not be used.
- Every paste is placed 20 units further down and right, so copies do not hide what they are copies of. The first paste after a cut, or of widgets copied in another browser, is where the widgets were. Given a point, the top left of the box around the copies is placed there. Given an area, the copies are kept inside it, a box around them that does not fit keeps its top left in it. A viewport keeps them inside the part of the page it shows, so a paste is never out of view.
- **Ctrl+x, ctrl+c and ctrl+v** in a focused viewport or outline cut, copy and paste the selected widgets through the clipboard of the system, with the cut, copy and paste events the browser gives the focused element, which need no permission. Pasted widgets are selected.
- **The menus** of widgets have Cut, Copy, Paste and Delete, Paste in the viewport menus pastes at the point of the menu. They write the clipboard of the system where the browser lets them, and read it only where reading it is granted already, so a menu never waits for the browser to ask, else Paste pastes the widgets copied in the app.

## Viewport menu

In edit mode a right click without moving, or a long press on touch, opens the menu of the widget in front at the point. A widget that is not selected is selected first, a selected one keeps the selection, and the ordering lines act on all selected widgets. A right drag pans as before. Where there is no widget, on the page or around it, the menu of the viewport opens, with Paste, Add widget, which opens the widget selector and adds the picked widgets with the top left of the first at the point, selected, Select all, and Center view, which resets zoom and pan so the page fits the viewport, like when it is made.

- Cut, Copy, Paste and Delete, Group and Ungroup, then the ordering lines, see above.
- **Select covered** opens a submenu of every widget whose outline covers the point, in front first, by id, the selected one checked. Picking one selects only it, so a widget hidden under others, or not visible, can be selected. The widgets are found by their rotated outline, when the submenu opens.

## Moving, resizing and rotating

The transformer around the selected widget moves it by its outline and center handle, resizes it by its corner and side handles, keeping the opposite corner or side in place, and rotates it by the handle above it. Positions and sizes snap to 5 units and rotation to 15 degrees, alt turns snapping off. While resizing, ctrl keeps the ratio of width and height and shift resizes around the center, both together work too.

Several selected widgets get one box, the box around their outlines, rotated widgets by their rotated outline. The box has a rotation of its own, shared by the viewports and properties editors given the same selection state. It starts at the rotation the widgets share, 0 when theirs differ, and is kept while the same widgets are selected:

- **Moving** moves all of them by the same amount.
- **Resizing** scales their positions and sizes relative to the box. A widget scales along its own axes, by how much the box stretches along them, so a rotated widget stays a rectangle. That is exact for widgets turned by a multiple of 90 degrees, and close for other angles.
- **Rotating** turns the box, and all of them with it around its center, each by the same angle. The box keeps the rotation, moving and resizing then go along its turned axes.

Position, size and rotation are inputs of the widget the user changes:

- **A writable state** is written, so every viewport showing the widget follows.
- **No value** is kept by each element itself. `canvas.widget` gives every base property a writable state, so this only happens for widget elements made without canvas.
- **A read only state** locks that part, and the handles needing it are hidden: moving needs `x` and `y`, resizing needs `x`, `y`, `width` and `height`, as it moves the position, and rotating needs `rotation`. With several widgets a handle is hidden when any of them locks a part it needs, rotating them also needs `x` and `y`, as they move around the center.

## Writing a widget

A widget element extends `WidgetBase` and follows the element pattern of ts-lib-ui, see `PATTERN.md`. Its options include `WidgetBaseOptions`, the position, size, rotation, opacity and visible, and its `set` calls `super.set(options)`.

```ts
const RECT = {
  /**Fill color*/
  fill: input_key<StateOrVal<string>>(),
};
type RectangleOptions = WidgetBaseOptions & InputOptions<typeof RECT>;

class Rectangle extends WidgetBase {
  static element_name() {
    return "rectangle";
  }
  static element_name_space() {
    return "myapp";
  }
  set(options: RectangleOptions): this {
    super.set(options);
    this.set_input(RECT.fill, options.fill, (fill) => {
      this.style.background = fill.ok ? fill.value : "grey";
    });
    return this;
  }
}
define_element(Rectangle);
const rectangle_widget = (options: RectangleOptions) =>
  Rectangle.create(options);
```

- **Position and size** are in page units, rotation in degrees clockwise around the center. An error of one of them keeps the last good value.
- **Opacity** is from 0 to 1, fully opaque until given. **Visible** false hides the widget, an editing viewport shows it faintly instead, so it can still be selected. An error of one of them shows the widget as if it was not given.
- **`original_size()`**: override it to lay the content out at a fixed size and scale it to the size of the widget, like a graphic. Without it the content is laid out at the size of the widget, like text. Call `relayout()` when the original size changes.
- **`WIDGET_TRANSFORM_EVENT`** is dispatched on the element whenever its position, size or rotation changes.

## Theme

The colors are the theme variables under `canvas`: the viewport background, the page background, the checkerboard of edit mode, and the transformer.
