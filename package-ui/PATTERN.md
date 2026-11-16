# Element pattern

This is how elements of `@chocbite/ts-lib-ui` take their inputs, and the pattern to use from now on. Every new element follows it, and an existing element is converted to it when it is reworked.

Most existing elements still use an older style: constructor options, setters and getters, or `opts`. Don't copy those into new code.

The mechanics live in `Base` (`package-ui/base/base.ts`) and the key helpers in `package-ui/base/input.ts`. **`package-ui/pattern_example` is a complete example of every case below**, with tests. Copy from it when writing an element. It is not exported, and in the repo the dev page `dev/pages/ui/pattern_example.ts` shows it.

## The rules

1. **Anything that changes is a state.** An input is a `StateOrVal<T>`, either a fixed value or a state (see `StateOrVal` in the state README). A fixed value is a constant and never changes. Elements have no setters or getters for their inputs, so an element never deals with properties and states for the same thing.
2. **A factory without arguments creates the element.** The class is exported only as a type, so nobody outside the module calls `new`.
3. **The constructor takes no arguments.** It builds the children and sets visible defaults, so an element that never gets inputs still shows something sensible.
4. **Inputs are declared as keys.** Each element has a module-level object of keys made with `input_key`, and its options type is `InputOptions` of that object.
5. **`set(options)` gives the inputs and returns the element.** Each input is applied with `set_input`. `set` can be called any number of times, and options left out stay as they are.
6. **States are handed down from parent to child.** A parent passes its inputs on to its children unchanged. It does not wrap them or copy their values.
7. **Every input is its own state.** Use one state per value, like `x`, `y` and `width`, never one state holding an object of them, so each value can be connected to other elements on its own.

```ts
my_box().set({ width: 100, label: label_state });
row.set({ label: other_state }); // width stays 100
```

## Writing an element

```ts
import { Base, define_element, input_key, type InputOptions } from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";

/**Inputs of the box*/
const BOX = {
  /**Width in px, keeps the last good value on errors*/
  width: input_key<StateOrVal<number>>(),
  /**Text in the box, shows the error on errors*/
  label: input_key<StateOrVal<string>>(),
};
export type MyBoxOptions = InputOptions<typeof BOX>;

class MyBox extends Base {
  static element_name() {
    return "box";
  }
  static element_name_space() {
    return "my";
  }

  //Children and defaults, nothing that depends on inputs
  #text = this.appendChild(document.createElement("span"));

  set(options: MyBoxOptions): this {
    this.set_input(BOX.width, options.width, (width) => {
      if (width.ok) this.style.width = width.value + "px";
    });
    this.set_input(BOX.label, options.label, (label) => {
      this.#text.textContent = label.ok ? label.value : "⚠ " + label.error;
    });
    return this;
  }
}
define_element(MyBox);

export type { MyBox };
export function my_box(): MyBox {
  return new MyBox();
}
```

## Keys

A key is a symbol that carries the type of its input. The keys object of an element is the only place where its inputs are declared.

- **`input_key<S>()`** makes a key. `S` is a `StateOrVal` variant, or a plain value type for configuration that never needs a state. A plain `Symbol()` is not accepted as a key.
- **`InputOptions<typeof KEYS>`** gives the options type, with every option optional. The doc comments written on the keys show up on the options when you hover them, so document inputs on the keys.
- **`InputOf<typeof KEYS.name>`** gives the input type of one key. It's for options interfaces built by hand, like a parent that passes an option on to a child, and for keys that aren't options, like an inner input.

Keys are module constants, so they can't be generic. An element that is generic in its value type, like a selector of `T`, writes its options interface by hand and uses loosely typed keys.

## `set_input(key, input, apply)`

- `undefined` leaves the input unchanged.
- A fixed value detaches the state the key had and calls `apply` right away with an ok result.
- A state replaces the state the key had. `apply` is subscribed while the element is in the document, like every element state, so an element that is never shown costs nothing for its states.
- Giving a key a new value always drops the old state, also while the element is not in the document.
- The key decides the type: an input that doesn't match the key is a compile error.

### Errors

The key's type decides whether the element must handle errors:

- **Can't be an error:** `StateOrValROS`, `StateOrValROSW`, `StateOrValROA` and plain values give `apply` a `ResultOk`, so it reads `.value`.
- **Can be an error:** `StateOrVal`, `StateOrValRES` and `StateOrValREA` give a `StateResult`, and TypeScript makes `apply` handle the error.

Every element decides what an error looks like for each input. `ExampleBox` keeps its last width, shows the error text in its label, and greys out its color. Pick what makes sense for the user, and never throw.

### Writable inputs and `input_state(key)`

An element that writes, like a slider, uses a writable key such as `input_key<StateOrValROSW<number>>()`.

`input_state(key)` returns the state the input has right now, typed by the key, so a writable key gives a state with `write`. It returns `undefined` for a fixed value or an input that was never set. The element keeps no reference of its own, because `Base` already stores the state under the key:

```ts
constructor() {
  super();
  //Writes to whatever state the value input has now
  this.#input.oninput = () =>
    void this.input_state(SLIDER.value)?.write(Number(this.#input.value));
}

set(options: SliderOptions): this {
  this.set_input(SLIDER.value, options.value, (v) => (this.#input.value = String(v.value)));
  //A fixed value can not be written
  this.#input.disabled = !this.input_state(SLIDER.value);
  return this;
}
```

### Plain values

Configuration that never needs a state, like the step of a slider, gets a key with a plain type, `input_key<number>()`, and goes through `set_input` like every other input. Use a plain type only when a state would make no sense. When in doubt, use `StateOrVal`.

## Subclasses

A subclass has its own keys object for the inputs it adds, and its options type combines them with the parent's options. It overrides `set` and calls `super.set(options)` once, before or after its own inputs as it needs.

```ts
const LABEL_BOX = {
  /**Bold text in front of the label*/
  badge: input_key<StateOrVal<string>>(),
};
export type MyLabelBoxOptions = MyBoxOptions & InputOptions<typeof LABEL_BOX>;

class MyLabelBox extends MyBox {
  #badge = this.appendChild(document.createElement("b"));

  set(options: MyLabelBoxOptions): this {
    super.set(options);
    this.set_input(LABEL_BOX.badge, options.badge, (badge) => {
      this.#badge.textContent = badge.ok ? badge.value : "";
    });
    return this;
  }
}
```

Inputs are never applied in the constructor. When a base constructor applies a fixed value, a subclass override called from it runs before the subclass's own fields exist. That throws for `#private` fields and silently gives `undefined` for plain fields. `set` runs after every constructor has finished, so overrides called from it can use all fields.

Elements meant to be subclassed by library users are exported as classes. The user's factory then creates the subclass, and the user calls `set`.

## Parents and children

- **Children are built in the constructor**, as field initializers or in the constructor body. They get their defaults there too, for example `child().set({ min: 0, max: 3 })`.
- **A parent's `set` passes inputs on unchanged**, like `this.#view.set({ scale: options.scale })`. Only convert with `state.as_state` when the parent needs a state itself, for example to derive a value with a proxy, or to hand it out.
- **A parent's options for inputs it only passes on** are written by hand with `InputOf`, so they always match the child: `scale?: InputOf<typeof SLIDER.value>`.
- **A value an element hands out**, like a state other elements follow, is kept in a private field with a getter. Setting that input again gives a new state, so anything following the old one must read the getter again. Document this on the getter.
- **Inputs inside inputs**, like a group state whose value holds an items state, use their own key for the inner input, typed with `InputOf` of the inner key. Setting the outer input again replaces the inner subscription automatically. Fixed inner values need their own branch, since nothing is subscribed for them.

## Reused elements

Because `set` can be called again, an element can be reused for other data, like a list row showing another entry. Each call replaces the states of the inputs it is given, and only states of elements in the document are subscribed. Scrolling through thousands of entries with a few reused elements therefore keeps only the visible states subscribed.

## When not to use it

Elements created in large numbers, like list rows, list fields and canvas widgets, can keep a lighter way of taking their data when the pattern costs too much. Measure it on a dev page with thousands of elements. In the example, 5000 boxes took about 17ms with fixed values against about 16ms for the old setters, see the Cost section of the dev page.

## `set` and `bind`

`set` gives inputs. A few elements also have a `bind` method that two-way binds a writable state the element owns the meaning of: form elements bind their `value`, and list containers their `selection`. These are older than this pattern, and they are their own methods, not part of `Base`.

## Status

- **Done and tested** in `package-ui/base/base.test.ts`: `Base.set`, `Base.set_input`, `Base.input_state`, and the key helpers `input_key`, `InputOptions` and `InputOf`.
- **Not converted yet:** no production element uses the pattern. Existing elements are converted one at a time, and canvas `Page` and `Viewport` are next, after the depot work.
- **Example:** `package-ui/pattern_example` is kept as the reference and must stay in line with this file. It is never built or exported, its source reaches consumers through the `SOURCE.md` of the package.

## Checklist for a new or converted element

- [ ] The class is exported only as a type, and a factory without arguments creates it.
- [ ] The constructor takes no arguments, builds the children and sets visible defaults.
- [ ] A module-level keys object made with `input_key` declares every input, with a doc comment on each key.
- [ ] The options type is `InputOptions<typeof KEYS>`, or `InputOf` for options built by hand.
- [ ] Every input is applied in `set` with `set_input`.
- [ ] Each input handles its errors in a way that makes sense to the user.
- [ ] Writable inputs use `input_state` to write, and fixed values are shown as read only.
- [ ] Subclasses have their own keys object and call `super.set(options)` once.
- [ ] Tests cover fixed values, states, setting again with both, and errors.
- [ ] A dev page shows fixed values and states side by side.
- [ ] When the pattern itself changes, this file and `package-ui/pattern_example` change with it.
