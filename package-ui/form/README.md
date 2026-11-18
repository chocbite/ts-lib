# @chocbite/ts-lib-ui/form

Form elements: buttons, switches, number and text inputs, selectors, and groups laying them out and collecting their values.

```ts
import form from "@chocbite/ts-lib-ui/form";
```

Every element follows the element pattern of ts-lib-ui: `form.switch(options)` creates it, every option is an initial value or a state, and `set(options)` changes options later. Options every element takes, like `access`, are in [PATTERN.md](../PATTERN.md).

## The value

Elements with a value take it as the `value` option, and the user changes it:

- **An initial value** is where the element starts. The element keeps the user's changes itself.
- **A writable state** is written when the user changes the value, so the element is live: everything following the state sees the change right away.
- **A read only state** is only shown, a change by the user is refused with a warning.
- **Not given**, the element starts without a value and keeps it itself.

```ts
const volume = state.ok_w(40);
form.slider({ value: volume, unit: "%" }); //Live, writes volume
form.switch({ value: true }); //Starts on, the user switches it
form.lamp({
  value: alarm.read_only,
  colors: [FormColors.None, FormColors.Red],
});
```

An error of the state shows as the fault icon on the element, a click on it explains the error.

- **`change`** is called with every value the user changes the element to, after it is accepted. `set({ change })` replaces it.
- **`description`** is shown as a tooltip.
- **`element.get_value`** gives the value, wherever it comes from, as a `ResultNice`. While its state is in error it is that error, with all its details, and without a value yet it is a `form.errors.NO_VALUE` error. **`element.changed`** is true once the user changed it.

### Settings from the value state

Number, text and selector elements take settings like `min`, `max`, `unit`, `max_length` and `selections`. Not given, they come from the related states of the value state, like those of `state.n.help(...)`, so a setting state brings its own limits:

```ts
form.stepper({ value: SCALE }); //Min, max, step and unit of the scale setting
form.stepper({ value: SCALE, max: 200 }); //A given setting wins
```

## Groups

A group lays out elements in columns or rows, and its value is the values of its elements by `id`, typed from the elements:

```ts
const group = form.group({
  column: ["8rem", "12rem"],
  elements: [
    form.text({ text: "Name" }),
    form.text_input({ id: "name" }),
    form.text({ text: "Admin" }),
    form.switch({ id: "admin", value: false }),
  ],
});
group.get_value; //ResultNice<{ name: string; admin: boolean }>
```

- **`get_value`** gives every value. When elements have no valid value it is a `form.errors.INVALID` error naming them, like `Elements without a valid value: name`, with the error of each element in its `errors`.
- **`value_partial`** gives the values of the elements that have one.
- **`value_changed`** gives the values the user changed.
- **`set({ value })`** gives each element its value from an object by id, as an initial value.

The `id` and the `elements` are given at creation, as they decide the value of the group. Only elements the user changes have a value in a group, a lamp or progress bar is not part of it. A group `change` listener gets the values every time an element with an id changes.

`form.group_collapser(group, { collapsed })` holds a group the user collapses and opens with a button, `collapsed` works like a value.

Prompts made with `prompts.form` of `@chocbite/ts-lib-ui/prompts` are a group in a modal panel.

## Elements

| Factory                       | Value                | Options                                                                           |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `form.button`                 | boolean              | `text`, `icon`, `on_click`, `toggle`, `color`, `center`                           |
| `form.switch`                 | boolean              | `icon`, `on_color`, `off_color`                                                   |
| `form.lamp`                   | boolean or number    | `colors` (two for a boolean, more for a number), `text`, `icon`, `center`         |
| `form.number_input`           | number               | `min`, `max`, `step`, `start`, `decimals`, `unit`                                 |
| `form.stepper`, `form.slider` | number               | as number input, and `live`, `icon_decrease`, `icon_increase`                     |
| `form.progress`               | number, only shown   | `min`, `max`, `decimals`, `unit`                                                  |
| `form.text_input`             | string               | `placeholder`, `max_length`, `max_bytes`, `filter`                                |
| `form.text_multiline`         | string               | as text input                                                                     |
| `form.password`               | string               | `filter`                                                                          |
| `form.toggle_button`          | one of `selections`  | `selections`                                                                      |
| `form.dropdown`               | one of `selections`  | `selections`, `default`, `default_icon`                                           |
| `form.color`                  | hex color string     | `live`                                                                            |
| `form.date_time`              | Date, string, number | `mode` (at creation, decides the value), `type`, `precision`                      |
| `form.ip`                     | `IPAddress`          | `type`                                                                            |
| `form.text`                   | none, a label        | `text`, `size`                                                                    |
| `form.spacer`                 | none                 | `space`                                                                           |
| `form.group`                  | object by id         | `elements` and `id` at creation, `column`, `row`, `border`, `embed`, `max_height` |
| `form.group_collapser`        | none                 | `collapsed`, `opened_text`, `closed_text`                                         |

Limits of 0, like `max_length: 0`, mean no limit. Every option of the elements is described on its key, an editor shows it on hover.

## Keyboard

Text and number inputs revert typed text on Escape, with nothing to revert Escape is left to parents, like a prompt closing. A switch toggles on Space, Enter is left to parents, like a form submitting. Buttons press on Enter and Space.
