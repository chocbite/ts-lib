# @chocbite/ts-lib-ui/base

`Base`, the class every element of ts-lib-ui extends, and what it gives elements: inputs that are fixed values or states, states that are only followed while the element is shown, faults, access, and size and visibility.

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

Elements follow the element pattern, see `PATTERN.md` of ts-lib-ui for the rules and a complete example. In short: the inputs are keys made with `input_key`, `set(options)` applies them with `set_input`, and a factory creates the element with `create`.

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

- **`set_input(key, input, apply)`** takes a fixed value or a state. A fixed value is applied right away, a state is followed while the element is in the document. Setting the key again replaces the state it had.
- **`input_state(key)`** gives the state an input has now, to write to it when the user changes the value.
- **`Base.create(options)`** creates the element and applies the options. Inputs other elements follow are given once, at creation, through the `[CREATE]` hook.
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

States given as inputs are only subscribed while the element is in the document, so an element that is not shown costs nothing for its states, and is updated when it comes back. `attach_state(state, func)` does the same for states an element follows itself, and `detach_state(func)` stops it.

To also unsubscribe its states while it is scrolled out of view, attach an element to the intersection observer of its scrolling parent, `child.attach_to_intersect_observer(parent.intersect_observer())`. `is_visible` and the `on_visible` hook follow it.

## Faults

Every error of an input is a fault of the element. While it has faults, an element shows a small icon in its top right corner, a click on it opens a prompt listing them with their details. This needs no code in the element.

- **`element.faults`** gives the faults the element has now.
- **`this.fault(key, error)`** sets or clears a fault that is not an input, under a key of its own.
- **`fault_anchor()`** is the element the icon is put in, the element itself by default, override it to put the icon where the problem shows.

## Size

`attach_to_resize_observer()` makes the element follow its own size through one shared resize observer, `on_resize` is called with it and `actual_size` gives it without a layout.

## Loop

`base_loop(generator, options)` makes an element with one child node per value. Give it the values as `array`, an array state reuses the nodes of the values its changes keep, like a push or a move, instead of making all nodes again.

```ts
const list = base_loop((name: string) => document.createTextNode(name), {
  array: names,
  change: (node, name) => (node.textContent = name),
});
```

`change` updates a node to a new value so it can be reused, `destructor` is called for every node that is removed.

## SVG elements

`BaseSVG` is the base for elements drawn in SVG, they implement `default_canvas()` to give the `<svg>` they live in.

## Older ways

Elements not converted to the element pattern yet still use `opts(...)` and the `attach_state_to_prop` and `attach_state_to_attribute` methods, which bind a state to a property or attribute. New elements take their inputs with `set`.
