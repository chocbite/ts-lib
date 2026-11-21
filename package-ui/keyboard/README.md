# @chocbite/ts-lib-ui/keyboard

On-screen keyboards for touch screens without a keyboard of their own, opened when the user focuses a text or number field, with a layout that fits the field.

```ts
import { VIRTUAL_KEYBOARD } from "@chocbite/ts-lib-ui/keyboard";

void VIRTUAL_KEYBOARD.write(true);
```

## Turning it on

**`VIRTUAL_KEYBOARD`** is a writable boolean state, a setting of the user stored with the settings of ts-lib-ui, off by default. While it is on, focusing a field in any document of `@chocbite/ts-lib-ui/document` opens a keyboard for it, and pressing or focusing outside the keyboard and the field closes it.

The layout comes from the field:

| Field                                                    | Keyboard                                         |
| -------------------------------------------------------- | ------------------------------------------------ |
| text inputs, textareas and contenteditable elements      | letters, with shift and symbol layers            |
| `email`, `tel`, `color`                                   | email, phone and color keyboards                 |
| `date`, `datetime-local`, `month`, `time`, `week`        | date and time keyboard                           |
| `number`                                                 | numbers, see below                               |

The color keyboard has a hue square and hue, red, green and blue sliders. A color input with a `data-alpha` attribute, the alpha from 0 to 1, gets an alpha slider too, which writes the attribute and sends input and change like the other sliders, as the value of a color input has no alpha. The color input of the form with `alpha` on has it.

A number input gets a keyboard without a minus when its `min` is 0 or more, and with a decimal point when its `step` is `any` or not a whole number.

Disabled, read only and hidden inputs, buttons, checkboxes, radio buttons, ranges and file inputs get no keyboard. Give a field `data-keyboard-manual="true"` to keep the keyboard from opening for it, and open one yourself.

## Opening one yourself

```ts
import { KeyboardType, keyboard_open } from "@chocbite/ts-lib-ui/keyboard";

const close = keyboard_open(input, KeyboardType.NumberRationalPositive);
```

**`keyboard_open(element, mode)`** opens a keyboard for the element, whether the setting is on or not, and returns a function that closes it. `mode` is a `KeyboardType` (`Text`, `Email`, `Color`, `Date`, `DateTimeLocal`, `Month`, `Time`, `Week`, `NumberWhole`, `NumberHex`, `NumberInteger`, `NumberRationalPositive`, `NumberRational`, `Phone`), a layout like below, or a keyboard from `keyboard_create`.

## Own layouts

```ts
import { KeyboardSpecialKeys, keyboard_create, keyboard_open } from "@chocbite/ts-lib-ui/keyboard";

const PIN = keyboard_create({
  default: {
    max_width: 16,
    keys: [
      [{ text: "1" }, { text: "2" }, { text: "3" }],
      [{ text: "4" }, { text: "5" }, { text: "6" }],
      [{ text: "7" }, { text: "8" }, { text: "9" }],
      [{ text: "⌫", key: KeyboardSpecialKeys.Backspace }, { text: "0" }, { text: "⏎", key: KeyboardSpecialKeys.Enter }],
    ],
  },
});
keyboard_open(pin_input, PIN);
```

**`keyboard_create(config)`** makes a keyboard from a layout, made once and opened as often as needed. The types of a layout are exported for code building one: `KeyboardConfig`, `KeyboardLayers`, `KeyboardLayerConfig` and `KeyboardKeyConfig`.

- **A layout** has a `default` layer and optional `layers` by name. A layer has rows of keys, `max_width` in rem, and `key_rows` and `key_cols`, the size of a key in grid cells.
- **A key** is `{ text, key?, rows?, cols? }`. `text` is shown, and typed when there is no `key`. `rows` and `cols` make a key bigger than the default of its layer.
- **A number in a row** is an empty gap of that many columns.
- **Special keys** are given as `key`, from `KeyboardSpecialKeys`: `Backspace`, `Enter`, `Escape`, `Left`, `Right`, and `Close` to close the keyboard.
- **`"layer:<name>"`** switches to the layer with that name, the same key again switches back to the default layer, like shift.

A key acts like a key on a real keyboard: the field gets `keydown`, `beforeinput`, `input` and `keyup` events, and the text changes at the cursor. Enter and Escape are `keydown` events for the field to act on. When the keyboard closes after a change, the field gets a `change` event.

## Look

The keyboards sit in a grey tray at the bottom of the screen, with white keys that type, darker special keys (backspace, shift, close and the other keys given as `key` from `KeyboardSpecialKeys` or `layer:`), and the accent color on Enter, an active layer like shift, and the selected day or time. The colors are the theme variables of the `keyboard` group: `background` (the tray), `key`, `key_special`, `keytext`, `active` (a pressed key), `accent`, `accent_text`, `border` and `shadow`. Special keys carry a `special` attribute with the name of the key, or `layer` for a layer switch.
