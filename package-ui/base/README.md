# @chocbite/ts-lib-ui/base

`Base`, the class every element of ts-lib-ui extends, and what it gives elements: inputs that are initial values or states, states that are only followed while the element is shown, faults, access, and size and visibility.

```ts
import {
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "@chocbite/ts-lib-ui/base";
```

## Writing an element

Elements follow the element pattern, see [PATTERN.md](../PATTERN.md) for the rules and a complete example. In short: the inputs are keys made with `input_key`, `set(options)` applies them with `set_input`, and a factory creates the element with `create`.

```ts
const BOX = {
  /**Text in the box, shows the nice text of an error*/
  label: input_key<StateOrVal<string>>(),
};
export type MyBoxOptions = BaseOptions & InputOptions<typeof BOX>;

class MyBox extends Base {
  static element_name() {
    return "box";
  }
  static element_name_space() {
    return "myapp";
  }
  #text = this.appendChild(document.createElement("span"));

  set(options: MyBoxOptions): this {
    super.set(options);
    this.set_input(BOX.label, options.label, (label) => {
      this.#text.textContent = label.ok ? label.value : label.error.nice;
    });
    return this;
  }
}
define_element(MyBox);

export function my_box(options: MyBoxOptions = {}): MyBox {
  return MyBox.create(options);
}
```

- **`set_input(key, input, apply)`** takes an initial value or a state. An initial value is applied right away, a state is followed while the element is in the document. Setting the key again replaces the state it had.
- **`input_state(key)`** gives the state an input has now, to write to it when the user changes the value.
- **`Base.create(options, ...args)`** creates the element and applies the options. Arguments after the options go to the constructor, for required references like a device a page shows and values that never change, see [PATTERN.md](../PATTERN.md#required-references-and-fixed-values). Inputs other elements follow are given once, at creation, through the `[CREATE]` hook.
- **`super.set(options)`** must be called by every `set`, it applies the inputs every element has.

## Names

`define_element(MyBox)` defines the custom element, named `<element_name_space>-<element_name>`, here `myapp-box`. Abstract classes return `@abstract@` from `element_name`. A library or app can prefix every name with `set_base_element_global_namespace`.

Elements are only made in code, with their factory, never with HTML or `document.createElement`, as their constructor builds their children.

## Inputs every element has

- **`access`**: write by default. Read makes the element inert, shown but not usable, none hides it. A state in error gives read access. Elements react to it in the protected `on_access` hook.

```ts
my_box({ label: "Name", access: AccessTypes.Read });
```

## States, visibility and cost

States given as inputs are only subscribed while the element is in the document, so an element that is not shown costs nothing for its states, and is updated when it comes back. `attach_state(state, func)` does the same for states an element follows itself, and `detach_state(func)` stops it. `attach_state_to_symbol(symbol, state, func)` attaches under a key, replacing what was attached under it before, and `detach_state_from_symbol(symbol)` stops it.

A function can only be attached once per element, by either method, as the function is what identifies the attachment. Attaching it again, to the same or another state, logs an error and does nothing. Give each state its own function, also when they do the same:

```ts
this.attach_state(size.width, () => this.#draw());
this.attach_state(size.height, () => this.#draw());
```

To subscribe its states only while it is in view, give an element the intersection observer of its scrolling parent, `child.attach_to_intersect_observer(parent.intersect_observer())`. Then every state of the element, those of its inputs and those attached with `attach_state`, is subscribed while the observer sees it, and `is_visible` and the `on_visible` hook follow it. Without an observer they follow the connection.

- **The observer is given before the element is first connected.** After that it is fixed, an element never needs another one, and changing it logs an error. A list gives each field its observer between creating the field and inserting the row.
- **It applies to that element only.** Children it passes inputs on to follow their own observer, or the connection without one.
- **A hidden element does not follow its states.** Its values are the last ones it had while visible, so do not read values from elements that can be out of view, read the states.

## Faults

Every error of an input is a fault of the element. While it has faults, an element shows a small icon in its top right corner, a click on it opens a prompt listing them with their details. This needs no code in the element.

- **`element.faults`** gives the faults the element has now.
- **`this.fault(key, error)`** sets or clears a fault that is not an input, under a key of its own.
- **`fault_anchor()`** is the element the icon is put in, the element itself by default, override it to put the icon where the problem shows.

## Size

Elements follow sizes with `state_ui.size(element)` of [state_ui](../state_ui/README.md), width and height as states, attached with `attach_state` like any other state.

## Loop

`base_loop(generator, options)` makes an element with one child node per value. Give it the values as `array`, an array state reuses the nodes of the values its changes keep, like a push or a move, instead of making all nodes again.

```ts
const list = base_loop((name: string) => document.createTextNode(name), {
  array: names,
  change: (node, name) => (node.textContent = name),
});
```

`change` updates a node to a new value so it can be reused, `destructor` is called for every node that is removed. The generator gets the index of the node as a state as its second argument, `(name, index) => …`, see the index of a node in [state_ui](../state_ui/README.md#the-index-of-a-node).

## SVG elements

`BaseSVG` is the base for elements drawn in SVG, they implement `default_canvas()` to give the `<svg>` they live in.

## Older ways

Elements not converted to the element pattern yet still use `opts(...)` and the `attach_state_to_prop` and `attach_state_to_attribute` methods, which bind a state to a property or attribute. New elements take their inputs with `set`.
