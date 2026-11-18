# Element pattern

This is how elements of `@chocbite/ts-lib-ui` take their inputs, and the pattern to use from now on. Every new element follows it, and an existing element is converted to it when it is reworked.

Most existing elements still use an older style: constructor options, setters and getters, or `opts`. Don't copy those into new code.

The mechanics live in `Base` (`package-ui/base/base.ts`) and the key helpers in `package-ui/base/input.ts`. **`package-ui/pattern_example` is a complete example of every case below**, with tests. Copy from it when writing an element. It is not exported, and in the repo the dev page `dev/pages/ui/pattern_example.ts` shows it.

## Scope

The pattern is the interface an element gives to users of the library: the inputs they can change while the element lives. Its point is a consistent interface for users, so it does not cover:

- **Configuration that never changes** after creation. It is a plain value, given in the factory options or as a plain input key, never a state.
- **References up the tree**, like the container, parent or document an element lives in. They are found from the DOM or given directly, never as states.
- **Internal logic** of a feature: private fields, children wired to each other, communication between the elements of one module. Use what is simplest and fastest.

## The rules

1. **Inputs changed from outside are states.** An input is a `StateOrVal<T>`, either an initial value or a state (see `StateOrVal` in the state README). An initial value is applied once and not followed: it stays until `set` gives the input again, or, for an input the user changes, it is where the element starts. Anything else that changes the element while it lives is a state. Elements have no setters or getters for their inputs, so an element never deals with properties and states for the same thing.
2. **A factory creates the element.** It takes optional options and creates the element with `create`, which applies them. It may take required arguments for things outside the pattern, like a device a page shows, and passes them on to the constructor through `create`. The class is exported only as a type, unless it is meant to be subclassed, so nobody outside the module calls `new`.
3. **The constructor takes only required references, never inputs.** It builds the children and sets visible defaults, so an element that never gets inputs still shows something sensible. Its arguments are things the element can not exist without and that never change, like a device a page shows, so they are kept in fields that are never unset. Inputs are never given or applied in it.
4. **Inputs are declared as keys.** Each element has a module-level object of keys made with `input_key`, and its options type is `BaseOptions & InputOptions` of that object, `BaseOptions` being the inputs every element has, like `access`.
5. **`set(options)` can be called again.** Each input is applied with `set_input`. Options left out stay as they are.
6. **Handed out inputs are given once.** An input that other elements follow is a creation input, applied by `[CREATE]` and left out of the options of `set`, so it can not be replaced while others follow it.
7. **States are handed down from parent to child.** A parent passes its inputs on to its children unchanged. It does not wrap them or copy their values.
8. **Every input is its own state.** Use one state per value, like `x`, `y` and `width`, never one state holding an object of them, so each value can be connected to other elements on its own.

```ts
const box = my_box({ width: 100, label: label_state });
box.set({ label: other_state }); // width stays 100
```

## Writing an element

```ts
import {
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import type { StateOrVal } from "@chocbite/ts-lib/state";

/**Inputs of the box*/
const BOX = {
  /**Width in px, keeps the last good value on errors*/
  width: input_key<StateOrVal<number>>(),
  /**Text in the box, shows the error on errors*/
  label: input_key<StateOrVal<string>>(),
};
export type MyBoxOptions = BaseOptions & InputOptions<typeof BOX>;

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
    //Applies the inputs every element has, like access
    super.set(options);
    this.set_input(BOX.width, options.width, (width) => {
      if (width.ok) this.style.width = width.value + "px";
    });
    this.set_input(BOX.label, options.label, (label) => {
      this.#text.textContent = label.ok ? label.value : "⚠ " + label.error.nice;
    });
    return this;
  }
}
define_element(MyBox);

export type { MyBox };
export function my_box(options: MyBoxOptions = {}): MyBox {
  return MyBox.create(options);
}
```

## Inputs every element has

`Base` has inputs of its own, its options are `BaseOptions`, and every element takes them because its options type includes `BaseOptions` and its `set` calls `super.set(options)`. Leaving out the call silently drops them.

- **`access`**: `StateOrVal<AccessTypes>`, write by default. Read makes the element inert, so it is shown but can not be used, none hides it. A state in error gives read access, and the fault icon explains why. Elements react to it in the protected `on_access` hook, like a form group making itself focusable while read only.

```ts
my_box({ label: "Name", access: AccessTypes.Read });
my_box().set({ access: user_access_state });
```

## `create(options)`

`Base.create` is static, every element has it. It creates the element it is called on, then applies the options in two steps, both after every constructor has finished:

1. `[CREATE](options)` applies the creation inputs, see [Inputs given at creation](#inputs-given-at-creation). It runs once, and does nothing for an element without creation inputs.
2. `set(options)` applies the rest.

Its options type is the options of `[CREATE]` and `set` together, taken from the class it is called on, so `MyBox.create({ nope: 1 })` is a compile error. Called on a subclass it creates the subclass with the subclass's options. An abstract class can not be created.

Every factory calls `create`, also for elements without creation inputs, so all factories look the same.

### Required references

Arguments after the options go to the constructor (rule 3), typed by it, so a missing or wrong one is a compile error. They are for references the element needs from its start and never changes, not for inputs. In the constructor they go into `readonly` fields, so TypeScript knows they are always set, no optional field and no `!`. A subclass passes them on to `super`, with arguments of its own after them. The factory takes them as required arguments in front of the options:

```ts
class DevicePage extends Base {
  readonly #device: Device;
  constructor(device: Device) {
    super();
    this.#device = device;
    this.#name.textContent = device.name;
  }
  // set and [CREATE] can use this.#device, it is set before both
}

export function device_page(device: Device, options: DevicePageOptions = {}): DevicePage {
  return DevicePage.create(options, device);
}
```

A reference that exists once in the app, like the connection to a server, needs no argument, the module imports it. Classes without constructor arguments are created with only the options, like before.

## Keys

A key is a symbol that carries the type of its input. The keys object of an element is the only place where its inputs are declared.

- **`input_key<S>()`** makes a key. `S` is a `StateOrVal` variant, or a plain value type for configuration that never needs a state. A plain `Symbol()` is not accepted as a key.
- **`InputOptions<typeof KEYS>`** gives the options type, with every option optional. The doc comments written on the keys show up on the options when you hover them, so document inputs on the keys.
- **`InputOf<typeof KEYS.name>`** gives the input type of one key. It's for options interfaces built by hand, like a parent that passes an option on to a child, and for keys that aren't options, like an inner input.

Keys are module constants, so they can't be generic. An element that is generic in its value type, like a selector of `T`, writes its options interface by hand and uses loosely typed keys.

## `set_input(key, input, apply)`

- `undefined` leaves the input unchanged.
- An initial value detaches the state the key had and calls `apply` right away with an ok result.
- A state replaces the state the key had. `apply` is subscribed while the element is in the document, like every element state, so an element that is never shown costs nothing for its states.
- Giving a key a new value always drops the old state, also while the element is not in the document.
- The key decides the type: an input that doesn't match the key is a compile error.

### Errors

The key's type decides whether the element must handle errors:

- **Can't be an error:** `StateOrValROS`, `StateOrValROSW`, `StateOrValROA` and plain values give `apply` a `ResultOk`, so it reads `.value`.
- **Can be an error:** `StateOrVal`, `StateOrValRES` and `StateOrValREA` give a `StateResult`, and TypeScript makes `apply` handle the error.

Every element decides what an error looks like for each input. `ExampleBox` keeps its last width, shows the nice text of the error in its label, and greys out its color. The error is a `NiceError`, see the result module: show `error.nice` where space is short, add `error.message` where there is room. Pick what makes sense for the user, and never throw.

#### The fault icon

On top of that, `set_input` reports every error of an input as a fault of the element, and clears it when the input is ok again or gets an initial value. While an element has a fault it shows a small broken link icon in its top right corner, and a click on it opens `prompts.faults` listing the faults: the nice text, the message, and the stack with its causes for errors with an `Error`. This needs no code in the element and can't be turned off, so every element shows problems the same way, even one too small for any text.

- **An element only shows what fits.** Like the dot that just turns grey, or a label showing a dash, the icon explains the rest.
- **`fault_anchor()`** is the element the icon is put in, the element itself by default. Override it to put the icon on the part with the problem, like the value box of a field.
- **Writing `textContent` of the anchor removes the icon,** like it removes every child. Base puts it back after every input is applied, so text written in `apply` is fine. Text written elsewhere, like in an event handler, loses the icon until the next input changes, so keep such text in a child element instead.
- **`this.fault(key, error | undefined)`** sets or clears a fault that isn't an input, under a key of its own, like `Symbol("connection")`.
- **`element.faults`** gives the faults the element has now.
- **It costs nothing without faults.** The icon is made on the first fault and removed with the last, and one listener on the document handles every icon. An element not in the document has no subscribed inputs, so no faults.
- **The icon sits at the top right corner**, absolutely positioned. An element without a position of its own gets `position: relative` from a rule without specificity, so any position the element sets wins.

### Inputs the user changes and `input_state(key)`

An input the user changes, like the value of a slider or the position of a moveable panel, works the same way in every element:

- **An initial value** is the element's own value, starting at what was given. The user changes it, and the element keeps the change itself.
- **A writable state** is written when the user changes the value, and every element following the state sees it.
- **A read only state** is only shown, the user can not change it. This is how an element is locked, like a panel that can not be moved.
- **Not given**, the element keeps a value of its own, like an initial value.

The key takes any state, such as `input_key<StateOrValROS<number>>()`, and the element checks `writable` at runtime. `input_state(key)` returns the state the input has right now, typed by the key, or `undefined` for an initial value or an input that was never set. The element keeps no reference of its own, because `Base` already stores the state under the key:

```ts
constructor() {
  super();
  //Writes to whatever state the value input has now, without a state the input keeps the value itself
  this.#input.oninput = () => {
    const value = this.input_state(SLIDER.value);
    if (value?.writable) void value.write?.(Number(this.#input.value));
  };
}

set(options: SliderOptions): this {
  super.set(options);
  this.set_input(SLIDER.value, options.value, (v) => (this.#input.value = String(v.value)));
  //Only a read only state can not be changed
  const value = this.input_state(SLIDER.value);
  this.#input.disabled = value !== undefined && !value.writable;
  return this;
}
```

A parent that hands out a value its child changes, like an editor handing out the scale its slider changes, makes a writable state from an initial value, so everything following the value sees the change. See `ExampleEditor`.

### Plain values

Configuration that never needs a state, like the step of a slider, gets a key with a plain type, `input_key<number>()`, and goes through `set_input` like every other input. Use a plain type only when a state would make no sense. When in doubt, use `StateOrVal`.

## Inputs given at creation

An input that the element hands out to other elements, like the items of a group that a watcher follows, is given once when the element is created (rule 6). If `set` could replace it, everything following the old state would keep following it without knowing. A state given at creation can still change its value, only the state itself can not be swapped.

These inputs get their own keys object, and the element overrides `[CREATE]` (the `CREATE` symbol from `#base`) to apply them, the same way it overrides `set`. `create` calls it once, before `set`. The options of `set` leave the creation inputs out, so TypeScript refuses them there, while the factory takes both.

```ts
import {
  Base,
  CREATE,
  define_element,
  input_key,
  type InputOptions,
} from "#base";

/**Inputs of the group that can be set again*/
const GROUP = {
  /**Space between the boxes in px*/
  gap: input_key<StateOrVal<number>>(),
};
export type GroupOptions = BaseOptions & InputOptions<typeof GROUP>;
/**Inputs of the group given at creation, handed out to other elements*/
const GROUP_CREATE = {
  /**Boxes shown in the group, handed out as items*/
  items: input_key<StateOrVal<Box[]>>(),
};
export type GroupCreateOptions = GroupOptions &
  InputOptions<typeof GROUP_CREATE>;

class Group extends Base {
  #items: StateOrVal<Box[]> = [];
  /**Given at creation and never replaced*/
  get items(): StateOrVal<Box[]> {
    return this.#items;
  }

  [CREATE](options: GroupCreateOptions) {
    super[CREATE](options);
    if (options.items === undefined) return;
    this.#items = options.items;
    this.set_input(GROUP_CREATE.items, options.items, (items) => {
      if (items.ok) this.replaceChildren(...items.value);
    });
  }

  set(options: GroupOptions): this {
    super.set(options);
    this.set_input(GROUP.gap, options.gap, (gap) => {
      if (gap.ok) this.style.gap = gap.value + "px";
    });
    return this;
  }
}

export function group(options: GroupCreateOptions = {}): Group {
  return Group.create(options);
}

group({ items: items_state, gap: 4 }).set({ gap: 8 }); // set({ items }) is a compile error
```

`[CREATE]` is public in TypeScript, as `create` must call it on the class it is created for, but it is keyed by a symbol, so only code that imports `CREATE` can reach it. That is code writing elements, users of an element never see it.

Only use creation inputs for values others follow. Everything else goes through `set`, so the element can still be reused.

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

A subclass that adds creation inputs does the same with `[CREATE]`: its own keys object, an options type combining its creation options with the parent's, and an override calling `super[CREATE](options)` once. `create` takes the options of the subclass automatically.

Inputs are never applied in the constructor. When a base constructor applies an initial value, a subclass override called from it runs before the subclass's own fields exist. That throws for `#private` fields and silently gives `undefined` for plain fields. `[CREATE]` and `set` run after every constructor has finished, so overrides called from them can use all fields.

Elements meant to be subclassed by library users are exported as classes. The user creates the subclass with `MySubclass.create(options)`, never with `new`, which would skip the creation inputs.

## Parents and children

- **Children are built in the constructor**, as field initializers or in the constructor body. They get their defaults there too, for example `child({ min: 0, max: 3 })`.
- **A parent passes inputs on unchanged**, like `this.#view.set({ scale: options.scale })`. Only convert with `state.as_state` when the parent needs a state itself, for example to derive a value with a proxy, or to hand it out.
- **A parent's options for inputs it only passes on** are written by hand with `InputOf`, so they always match the child: `scale?: InputOf<typeof SLIDER.value>`.
- **A value an element hands out**, like a state other elements follow, is a creation input, kept in a private field with a getter, see [Inputs given at creation](#inputs-given-at-creation).
- **Inputs inside inputs**, like a group state whose value holds an items state, use their own key for the inner input, typed with `InputOf` of the inner key. Setting the outer input again replaces the inner subscription automatically. Initial inner values need their own branch, since nothing is subscribed for them.
- **References up the tree** are outside the pattern. A child that needs its parent or container finds it from the DOM, or the parent gives it directly.

## Reused elements

Because `set` can be called again, an element can be reused for other data, like a list row showing another entry. Each call replaces the states of the inputs it is given, and only states of elements in the document are subscribed. Scrolling through thousands of entries with a few reused elements therefore keeps only the visible states subscribed.

## When not to use it

Elements created in large numbers, like list rows, list fields and canvas widgets, can keep a lighter way of taking their data when the pattern costs too much. Measure it on a dev page with thousands of elements. In the example, 5000 boxes took about 17ms with initial values against about 16ms for the old setters, see the Cost section of the dev page.

## `set` and `bind`

`set` gives inputs. Form elements take their value as the `value` input like any other, see the form README. List containers still have a `bind` that two-way binds their `selection`, which is older than this pattern.

## Status

- **Done and tested** in `package-ui/base/base.test.ts`: `Base.create` with `[CREATE]`, `Base.set` with the `access` input, `Base.set_input`, `Base.input_state`, and the key helpers `input_key`, `InputOptions` and `InputOf`.
- **Being converted:** `composition` is the first production module written to the pattern. `form` is converted too, every form element takes its inputs with `set`, with the value model of the form README. Other elements are converted one at a time, canvas `Page` and `Viewport` after the depot work.
- **Example:** `package-ui/pattern_example` is kept as the reference and must stay in line with this file. It is never built or exported, its source reaches consumers through the `SOURCE.md` of the package.

## Checklist for a new or converted element

- [ ] The class is exported only as a type, unless meant to be subclassed, and a factory taking optional options creates it with `create`.
- [ ] The constructor takes only required references, kept in `readonly` fields, builds the children and sets visible defaults.
- [ ] A module-level keys object made with `input_key` declares every input, with a doc comment on each key.
- [ ] The options type is `BaseOptions & InputOptions<typeof KEYS>`, or extends `BaseOptions` with `InputOf` for options built by hand.
- [ ] `set` calls `super.set(options)`, so the inputs every element has, like `access`, work on it.
- [ ] Every input is applied with `set_input`, in `set`, or in `[CREATE]` for creation inputs.
- [ ] Inputs handed out to other elements are creation inputs, applied by overriding `[CREATE]`, and left out of the options of `set`.
- [ ] Each input handles its errors in a way that makes sense to the user, the fault icon explains them, and `fault_anchor` puts it where the problem shows if that isn't the element itself.
- [ ] Inputs the user changes write a writable state with `input_state`, keep an initial value themselves, and lock for a read only state.
- [ ] Subclasses have their own keys objects and call `super.set(options)` and `super[CREATE](options)` once.
- [ ] Configuration that never changes, references up the tree and internal logic are kept out of the inputs.
- [ ] Tests cover initial values, states, setting again with both, and errors.
- [ ] A dev page shows initial values and states side by side.
- [ ] When the pattern itself changes, this file and `package-ui/pattern_example` change with it.
