# Canvas plan

Working plan for pages and widgets as data in `@chocbite/ts-lib-ui/canvas`. Not published. Delete it, or replace it with the README, once it's built.

## Purpose

The same page can be shown in several viewports at once, like an editor and a preview. A DOM element can only be in one place, so pages and widgets become data, and every viewport makes its own elements from that data. The elements are bound to the same states, so a change made in one viewport shows in all of them. A properties editor will later bind to the same states.

## Concepts

| Concept           | What it is                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Page              | Data: the width, height and widgets of a page. Shown by viewports, never an element of its own for users.                              |
| Widget            | Data: a widget definition from the depot, and the options of the widget, positions and sizes included.                                 |
| Widget definition | The content of an entry of the `widgets` depot type: how to create the element of a widget. Later also its properties, for the editor. |
| Widget element    | An element made from a widget for one viewport, extends `WidgetBase`.                                                                  |
| Viewport          | Element showing a page. It makes a page element and the widget elements inside it.                                                     |

## Decisions

- **Data is plain objects of states.** Following the element pattern, every value is its own state (rule 8), so `x` can be connected to an editor field, or to a state of a machine, on its own.
- **Widget options are the options of the widget element.** A widget holds `options`, given to the definition's `create` for every viewport, so all of its elements are bound to the same states.
- **Position and size are inputs the user changes,** with the pattern's model:
  - **A writable state** is written by the transformer, and every viewport follows it.
  - **A read only state** locks the widget.
  - **An initial value** is the element's own. Each viewport's element would then move on its own, so shared pages use writable states.
- **The widget definition comes from the depot.** Canvas registers the `widgets` type. A widget holds the depot entry, which gives files a path to save later.
- **The page is an input of the viewport,** `StateOrVal<CanvasPage | undefined>`, so a state can switch which page a viewport shows.
- **The page element is internal.** The viewport makes it from the page data. `canvas.page()` as an element factory goes away.
- **Widget elements are made per item, and only when needed.** An array state of widgets uses its change metadata, so adding, removing or moving one widget touches only that one. The array order is the drawing order.
- **The content of a depot entry is a state,** and possibly async. Each widget therefore gets a small internal slot element with `display: contents`. It follows the entry's content and makes the widget element when the content arrives, or again if it changes.
- **Locked parts hide their handles.** Moving needs `x` and `y`, resizing needs `x`, `y`, `width` and `height`, because it keeps the opposite corner in place, which moves the position, and rotating needs `rotation`. A read only state for any of them hides the handles of the action.
- **The transformer writes through the widget.** `WidgetBase` gets an internal method that writes a change to the states of its inputs, or keeps it for initial values, and refuses it for read only states. The transformer reads the current values from internal getters. This is internal logic, outside the pattern.

## Sketch

Names are proposals.

```ts
import canvas from "@chocbite/ts-lib-ui/canvas";

//A widget definition, registered by whoever provides the widget
const basic = canvas.widgets.group("basic", "Basic", "Basic shapes");
const rectangle = basic.add("rectangle", "Rectangle", "A filled rectangle", {
  create: (options: RectangleOptions) => rectangle_widget(options),
});

//A page, data shared by every viewport showing it
const page: CanvasPage = {
  width: state.ok_w(800),
  height: state.ok_w(600),
  widgets: state.ok_w<CanvasWidget[]>([
    {
      widget: rectangle,
      options: {
        x: state.ok_w(20),
        y: state.ok_w(20),
        width: state.ok_w(160),
        height: state.ok_w(80),
        fill: state.ok_w("#2980b9"),
      },
    },
  ]),
};

//Two viewports showing the same page, moving the rectangle in one moves it in the other
const editor = canvas.viewport({ page, edit: true });
const preview = canvas.viewport({ page });
```

## Answered questions

1. **The selection is shared,** as a `selected` input of the viewport holding the widget data, a user-changed input. The transformer goes on whatever element the slot of the selected widget shows now, so it moves along when a placeholder is replaced by its widget. The viewport only changes the selection when the user presses, never on its own, like the list module: not when the page changes and not when leaving edit, then the transformer is only hidden. Otherwise a second viewport given the same selection state would clear it.
2. **A widget holds the path of its definition,** and every viewport looks it up with `depot.get`. A page can then be loaded before its widgets are registered, an error widget is shown in the place of a widget until its path is registered, and a widget registered again is made again.
3. **`canvas.widget(entry, options)`** makes a widget from a definition. It checks the options against the definition.

## Found while building

- **Typing of `canvas.widget`.** `add` of the depot keeps the type of the content for types of objects, so a definition keeps its options type and `canvas.widget` checks the options against it.
- **`undefined` leaves an input unchanged,** so `set({ page: undefined })` does not clear the page of a viewport. A state of the page clears it with `undefined`.
- **The array metadata of the widgets is not used.** It is kept on the array object, so after a page was out of the document it would be applied again. The page compares the array by identity every time instead, which is plain JavaScript work per change, and only touches the DOM for widgets that changed.

## Steps

1. **`WidgetBase` on the pattern.** `x`, `y`, `width`, `height` and `rotation` become inputs the user changes, and the transformer writes through the widget. Page and viewport stay as they are. Update the tests and the dev page.
2. **Pages and widgets as data.** The `widgets` depot type, widget definitions, `CanvasWidget` and `CanvasPage`. The viewport takes page data with `page` and `edit` as inputs, and makes the page and widget elements. Dev page: two viewports showing one page, an editing one and a viewing one, with buttons that add, remove and reorder widgets, and a cost case with many widgets.
3. **Selection** as an input of the viewport, if question 1 is yes.

Steps 1 to 3 are done.

## Next: properties, widget selector and saving

All three need to know which options a widget has, so they start from one thing: **the definition describes its properties.**

```ts
basic.add("rectangle", "Rectangle", "A filled rectangle", {
  create: (options: RectangleOptions) => rectangle_widget(options),
  /**Size of a new widget*/
  size: { width: 160, height: 80 },
  /**Options the user changes, in the order the properties editor shows them, position, size and rotation are added by canvas*/
  properties: {
    fill: { name: "Fill", kind: "color", default: "#2980b9" },
    corner: { name: "Corner radius", kind: "number", default: 0, min: 0 },
  },
});
```

- **Kinds** are `number`, `text`, `boolean`, `color` and `enum`, each with a default and the limits of its kind. A kind decides the field of the properties editor and how the value is saved.
- **The properties are typed by the options** of the definition, so a property for an option that does not exist, or a default of the wrong type, is a compile error.
- **Options without a property** are left out of the editor and of saving, like a state a widget is linked to by code.

### Decisions

1. **Properties editor fields.** `form.list_field` wrapped any form element as a field of a list column (since removed, form elements are list fields directly and the editor uses `list.node_field`), it is used with switches, steppers and dropdowns on the form list field dev page. Proposed: the properties editor uses it with the form elements, and only gets fields of its own in canvas if that turns out too slow or too big, measured on a dev page.
2. **Saving through settings.** `group.register` stores one state with `to_json` on every change of that state, but a page is states inside states: a change of the `x` of a widget is not a change of the array state of the widgets, and `to_json` of the array has no values in it. Proposed: canvas gets `page_to_json(page)` and `page_from_json(json)`, and `canvas.store_page(group, id, page)` that follows every state of the page and stores the JSON with `group.set`, which settings already has for values that are not registered, a fixed time after the last change. Loading is `page_from_json(group.get(id, fallback))`. Settings needs no change for it. The other way is a `register` in settings for nested states, which every other nested structure could use too.
3. **Links to other states.** An option linked to a state of the app, like `/states/machine/speed`, can not be saved as a value. Proposed: only property values are saved for now, links to depot states are added when they are needed.

Decided: 1, form elements in `form.list_field` for now (now `list.node_field`), kept in a file of their own in canvas so they are easy to replace with real list fields. 2, the state is the link to settings: `register_debounced` of settings follows every state in a page with the viewer of the state module, rewritten for it, and stores the page a delay after the last change, `canvas.page_from_json` is the check of `get` for loading. 3, options are only linked to states of the depot, so a link is saved as its path.

### Steps

Saving was done first, as it does not need the properties.

4. **Properties in definitions,** done: `size` and `properties` of a definition, `canvas.definition` to check the properties against the options, `canvas.widget_properties` and `canvas.new_widget`. A definition given to `add` directly is only checked against the base options, as the depot type holds definitions of any options.
5. **Widget selector,** done: `canvas.select_widget(options)` gives new widgets from the defaults of the picked definitions. Dev page: an add with selector button.
6. **Properties editor,** done: `canvas.properties({ selected })`, a list of the properties of the selected widget with form elements in a `list.node_field`, made in `fields.ts` to be replaced by real list fields. Dev page: the editor next to the two viewports.
7. **Saving and loading** a page, done: `group.register_debounced("page", ..., page_state)` and `group.get("page", fallback, canvas.page_from_json)`. Dev page: a page kept across reloads.
8. **Links to depot states,** done: `canvas.link(path)` in place of any option, the slot looks every link up next to the definition and gives the widget the registered state, showing an error until all are registered. Saved as `{ "link": path }`. The properties editor shows the path. Dev page: links to a counter and a writable x, and one to a state registered by a button.

9. **Options as states of a value or a link,** done: every option is a state, `canvas.widget` makes initial values and links writable states. The state holds the value or a `CanvasLink`, writing it switches. The slot follows every option and gives the widget the option state through a proxy, or the linked state, with `set`, so switching does not make the widget again and a missing state only faults its option. Links have transforms, `linear` first, in a table in `link.ts` that more kinds are added to, and are saved as `{ "$link": { ... } }`.

10. **Linking in the properties editor,** done: a link column with a chain per option, opening a link menu, a prompt with the path, Choose state with `depot_ui.select_state`, and fields per transform kind from a table in `link_menu.ts`. Unlink keeps the value shown. Linked values are converted to the type of the option by its property kind.

Later: several selected widgets, undo. The link menu shows each transform kind once, in a fixed order, a list of transforms to add and order is for when there are more kinds.

Each step ends with typecheck, tests and lint passing, and a stop for review.
