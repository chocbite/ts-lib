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

A change that is refused, by a read only state, a setting like `max`, or the state rejecting the write, is warned about, and the element shows its value again at once, or that it has none, so what the user entered is never left looking like the value.

- **`change`** is called with every value the user changes the element to, after it is accepted. `set({ change })` replaces it.
- **`description`** is shown as a tooltip.
- **`element.get_value`** gives the value, wherever it comes from, as a `ResultNice`. While its state is in error it is that error, with all its details, and without a value yet it is a `form.errors.NO_VALUE` error. **`element.changed`** is true once the user changed it.
- **Without a value**, not given one yet, or after `element.clear()`, the element has the `no-value` attribute and shows it has none, see Look. Giving no value and a `change` listener makes a field that starts blank, like for several things with different values.

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

The `id` is given at creation, and the ids and value types of the `elements` given at creation decide the value of the group. `set({ elements })`, also with a state, gives it other elements with the same ids and value types, like another layout of the same values, a type error otherwise. Elements without an id, like labels, are free to change. Elements in both stay where they are, new ones bring their own values, a `value` in the same `set` is given to them. `value_elements` is typed by value, not by the element a value was created with. A group made from an array built at runtime has no typed value, it takes any elements. Only elements the user changes have a value in a group, a lamp or progress bar is not part of it. A group `change` listener gets the values every time an element with an id changes.

`form.group_array` holds items in order, and its value is their values, an array. The items are value elements of one value type, typed by the items or declared, `form.group_array<string>()`. Whoever uses it builds the items and gives them with `elements`, like a list the user adds to and removes from:

```ts
const items = state.ok_w([form.ip(), form.ip()]);
const addresses = form.group_array({ elements: items }); //ResultNice<IPAddress[]>
items.set_ok([...items.ok(), form.ip()]); //Another address
```

- **It keeps the instances it is given.** Items in both the old and the new list stay where they are, so a field the user is typing in keeps the focus, only an item that changes place is moved.
- **`get_value`** is an error naming the indexes of the items without a value, like `Items without a valid value at index 1`, with the error of each item in its `errors`.
- **`value_partial`** gives the values of the items that have one, in order, without gaps.
- **`set({ value })`** gives each item its value by position, values without an item are left out.
- Its `change` listener gets the partial values every time an item changes. In a group it has an id like any element, items in it need none.

It lays out like a group, with the same `column`, `row`, `border`, `embed` and `max_height`.

With `foldable` it has a bar over the items. Folded it shows one item at a time, with a pager like a stepper, `‹ 3 / 12 ›`, paged by its arrows, the arrow keys, Home and End, and a button beside it shows all items, `12 entries`, and folds again. Meant for arrays of tens of items, as every item is still built.

- **`folded`**, true by default, and **`index`**, 0 by default, are changed by the user with the bar and work like a value: an initial value is where it starts, a writable state is written, a read only state locks the bar.
- **Folding shows the item the focus was last in** while unfolded, so the user stays where they were.
- **The index follows the shown item** when items are put in or taken out before it, a writable index state is written. When the shown item is taken out, the one now at its place is shown, or the last.
- **Hidden items are out of the document**, so they cost nothing while not shown, their values are still in the value of the group.

`form.group_collapser(group, { collapsed })` holds a group or an array group the user collapses and opens with a button, `collapsed` works like a value.

Prompts made with `prompts.form` of `@chocbite/ts-lib-ui/prompts` are a group in a modal panel.

## Elements

| Factory                       | Value                 | Options                                                                                          |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `form.button`                 | boolean               | `text`, `icon`, `on_click`, `toggle`, `color`, `center`                                          |
| `form.switch`                 | boolean               | `icon`, `on_color`, `off_color`                                                                  |
| `form.lamp`                   | boolean or number     | `colors` (two for a boolean, more for a number), `text`, `icon`, `center`                        |
| `form.number_input`           | number                | `min`, `max`, `step`, `start`, `decimals`, `unit`                                                |
| `form.stepper`, `form.slider` | number                | as number input, and `live`, `icon_decrease`, `icon_increase`                                    |
| `form.progress`               | number, only shown    | `min`, `max`, `decimals`, `unit`                                                                 |
| `form.text_input`             | string                | `placeholder`, `max_length`, `max_bytes`, `filter`, `live`                                       |
| `form.text_multiline`         | string                | as text input                                                                                    |
| `form.password`               | string                | `filter`, `live`                                                                                 |
| `form.toggle_button`          | one of `selections`   | `selections`                                                                                     |
| `form.dropdown`               | one of `selections`   | `selections`, `default`, `default_icon`                                                          |
| `form.dropdown_multi`         | array of `selections` | `selections`, `default`, `min`, `max`                                                            |
| `form.color`                  | hex color string      | `live`, `alpha`                                                                                  |
| `form.date_time`              | Date, string, number  | `mode` (at creation, decides the value), `type`, `precision`                                     |
| `form.ip`                     | `IPAddress`           | `type`                                                                                           |
| `form.text`                   | none, a label         | `text`, `size`                                                                                   |
| `form.spacer`                 | none                  | `space`                                                                                          |
| `form.group`                  | object by id          | `id` at creation, `elements`, `column`, `row`, `border`, `embed`, `max_height`                   |
| `form.group_array`            | array of item values  | `elements`, value elements of one type, `foldable`, `folded`, `index`, and the layout of a group |
| `form.group_collapser`        | none                  | `collapsed`, `opened_text`, `closed_text`                                                        |

Limits of 0, like `max_length: 0`, mean no limit. Every option of the elements is described on its key, an editor shows it on hover.

The value of `form.dropdown_multi` is the selected ones in the order of the selections, `[]` when nothing is selected, which is a value. Its popup has check boxes and stays open while the user checks and unchecks, each of which writes the whole array, so a state sees every change. Values not in the selections are left out of what the user writes, the value is what the popup shows. `min` and `max` are how many can be selected, a change past them is refused with a warning. The dropdowns share one popup per document. Its `selections`, `min` and `max` are given as options.

## Look

The elements are flat. Fields that take input (text, numbers, dropdowns) are white with a faint border that darkens on hover and gets a ring with focus, buttons are filled grey, and what is on or selected (a switch that is on, the selected option, a toggled button) uses one accent color. Shadows are only on things floating above the page, the open dropdown and the switch knob. Lamps and progress bars are read only and have no hover.

All of it comes from the theme variables of the `form` group: `form.colors.accent` (`normal`, `hover`, `text`), `form.colors.button` (`normal`, `hover`, `active`), `form.colors.background`, `form.colors.border` (`normal`, `hover`), `form.colors.focus` and `form.colors.shadow`. The height is fixed by the styles, 1.5rem, 2rem in touch mode. A `color` option (`FormColors`) fills a button, lamp or switch with that color instead.

The color input shows its color on a checkerboard, so a color with alpha shows as one. Its value is a hex color like `#ff8800`. With `alpha` it has an alpha slider beside the swatch and writes colors like `#ff880080`, taking `#rgb`, `#rrggbb`, `#rrggbbaa` and `transparent`. The color picker of the browser has no alpha, it only picks the color and the alpha is kept. The native color input inside has the alpha as `data-alpha`, from 0 to 1, which the color keyboard of `@chocbite/ts-lib-ui/keyboard` shows and changes. Without `alpha` a value with alpha is still shown with it, but a picked color is written without.

An element without a value has the `no-value` attribute, and these elements show it, so it is never taken for a value: text and number inputs a short grey line where the value would be, hidden while typing, the color input a muted rainbow, the switch its knob in the middle on a lighter track, a press turns it on. Dropdowns ask to select something, the multi dropdown in grey, as nothing selected is a value. Other elements have the attribute without a look of their own yet.

## Keyboard

Text and number inputs revert typed text on Escape, with nothing to revert Escape is left to parents, like a prompt closing. Typed text is set as the value as soon as the field loses the focus, so a click on a button reads the new value, and on Enter, which is then left to parents, like a prompt submitting. With `live` the text inputs and the password write every change as it is typed, like for a search, so Escape has nothing to revert and is left to parents. Every text on the way is written, so it fits where any text can be written, numbers have no live typing for that reason. A switch toggles on Space, Enter is left to parents, like a form submitting. Buttons press on Enter and Space.
