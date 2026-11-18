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
- **`properties`**: the options the user changes, in the order they are shown, each with a name, a kind and the value a new widget starts with. The kinds are `number` (with `min`, `max`, `step`, `decimals` and `unit`), `text` (with `max_length`), `color`, `boolean` and `enum` (with `list`, the values and their names). Position, size and rotation are added by canvas to every widget. Options without a property are left to code, like a state the widget is linked to.
- **`canvas.definition`** gives the definition as it is, typed by the parameter of `create`, so every property is checked against its option: a number option needs a number property, an enum default must be in its list. Without it the properties are only checked against the base options. The entry keeps the type of the definition, so `canvas.widget` checks the options against it too.

`canvas.widget_properties(definition)` lists every property of a widget, position, size and rotation first. `await canvas.new_widget(entry, { x, y })` makes a new widget with a writable state for every property, starting at its default, as a result that is the error of the definition when it has none.

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

- **`width` and `height`**: the size of the page in page units, 1920 by 1080 when not given.
- **`widgets`**: the widgets, the last is drawn on top. Change the array state to add, remove or reorder widgets. Only widgets that were added, removed or moved are touched, compared by identity. A widget given twice is shown once.
- **`canvas.widget(definition, options)`** makes a widget from a definition entry. An initial value or link is made a writable state, a state is used as it is. Or write `{ widget: path, options }` directly with a state for every option, like when a page is loaded.
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
- **Values are converted to the type of the option,** by the kind of its property: numbers with `Number`, so `true` is 1, texts with `String` and booleans with `Boolean`. Any state can be linked to any option, a value giving no number, like the text "abc" for a number, faults the option. A value the widget writes back gets the type of the value of the linked state. Position, size and rotation are numbers, options without a property are not converted.
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

`canvas.properties({ selected })` shows the properties of a widget in a list, a row per property with a field bound to the option of the widget. Give it the selection state of the viewports to follow the selection:

```ts
const selected = state.ok_w<CanvasWidget | undefined>(undefined);
const editor = canvas.viewport({ page, edit: true, selected });
const properties = canvas.properties({ selected });
```

- The fields follow the options like form elements do: a writable state is written, so a change shows in every viewport, and a move in a viewport shows in the editor. A read only state is only shown.
- Position, size and rotation come first, then the properties of the definition, see widget definitions.
- The title is the name of the definition, or tells that the widget is not registered.
- A linked option shows the path it is linked to and the value the link gives, read only, as it is a state of the app.
- **The link column** has a chain for every option with a writable state, filled when linked. Pressing it opens the link menu: the path of the state, typed or picked with Choose state from `depot_ui.select_state`, and the fields of the transforms. Link writes the link to the option, Unlink writes the value the link gives now, or the default of the property when it gives none. An option not given to the widget has no state, so it has no field and can not be linked, widgets made by `canvas.new_widget` and the selector have a state for every property.
- The fields are form elements in a `list.node_field` for now, as each property has an element of its own kind, numbers in number inputs, texts in text inputs, colors in color inputs, booleans in switches and enums in dropdowns.

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
const selected = state.ok_w<CanvasWidget | undefined>(undefined);
const editor = canvas.viewport({ page, edit: true, selected });
const preview = canvas.viewport({ page });
```

The viewport scales the page to fit its own size and centers it. Its options:

- **`page`**: the page shown. Give a state to switch pages, setting it to `undefined` shows nothing.
- **`edit`**: enables zooming, panning and changing widgets, with a checkerboard behind the page. Turning it off resets the view to fit the page.
- **`selected`**: the selected widget, see below.

In edit mode:

- Wheel and touchpad two finger swipe pan, shift pans the vertical wheel horizontally, ctrl with the wheel zooms toward the pointer, touchpad pinch zooms, alt slows wheel zoom and pan down 10 times.
- Two finger touch pinches to zoom and pan, the middle or right mouse button drags to pan.
- Pressing a widget selects it, pressing the page clears the selection.

## Selection

The `selected` option is the selected widget, as its data. The user changes it, like a value of a form element:

- **A writable state** is written when the user selects, so several viewports, and anything else, share the selection.
- **An initial value, or no value,** is kept by the viewport.
- **A read only state** is only shown, pressing does not change it.

The viewport only changes the selection when the user presses, never on its own. When the selected widget is not on the page, or the viewport is not in edit mode, the transformer is hidden and the selection stays.

## Moving, resizing and rotating

The transformer around the selected widget moves it by its outline and center handle, resizes it by its corner and side handles, keeping the opposite corner or side in place, and rotates it by the handle above it. Positions and sizes snap to 5 units and rotation to 15 degrees, alt snaps to 1 unit and 5 degrees, shift turns snapping off.

Position, size and rotation are inputs of the widget the user changes:

- **A writable state** is written, so every viewport showing the widget follows.
- **No value** is kept by each element itself. `canvas.widget` makes initial values writable states, so this only happens for an option left out.
- **A read only state** locks that part, and the handles needing it are hidden: moving needs `x` and `y`, resizing needs `x`, `y`, `width` and `height`, as it moves the position, and rotating needs `rotation`.

## Writing a widget

A widget element extends `WidgetBase` and follows the element pattern of ts-lib-ui, see `PATTERN.md`. Its options include `WidgetBaseOptions`, the position, size and rotation, and its `set` calls `super.set(options)`.

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
- **`original_size()`**: override it to lay the content out at a fixed size and scale it to the size of the widget, like a graphic. Without it the content is laid out at the size of the widget, like text. Call `relayout()` when the original size changes.
- **`WIDGET_TRANSFORM_EVENT`** is dispatched on the element whenever its position, size or rotation changes.

## Theme

The colors are the theme variables under `canvas`: the viewport background, the page background, the checkerboard of edit mode, and the transformer.
