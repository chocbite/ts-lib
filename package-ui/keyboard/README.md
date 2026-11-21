# @chocbite/ts-lib-ui/keyboard

On-screen keyboards for touch screens without a keyboard of their own, opened when the user focuses a text or number field, with a layout that fits the field.

```ts
import { VIRTUAL_KEYBOARD } from "@chocbite/ts-lib-ui/keyboard";

void VIRTUAL_KEYBOARD.write(true);
```

## Turning it on

**`VIRTUAL_KEYBOARD`** is a writable boolean state, a setting of the user stored with the settings of ts-lib-ui, off by default. While it is on, focusing a field in any document of `@chocbite/ts-lib-ui/document` opens a keyboard for it, and pressing or focusing outside the keyboard and the field closes it.

The layout comes from the field:

| Field                                               | Keyboard                                          |
| --------------------------------------------------- | ------------------------------------------------- |
| text inputs, textareas and contenteditable elements | the layout of the language, see below             |
| `email`, `tel`, `color`                             | email (always English), phone and color keyboards |
| `date`, `datetime-local`, `month`, `time`, `week`   | date and time keyboard                            |
| `number`                                            | numbers, see below                                |

A number input gets a keyboard without a minus when its `min` is 0 or more, and with a decimal point when its `step` is `any` or not a whole number.

Disabled, read only and hidden inputs, buttons, checkboxes, radio buttons, ranges and file inputs get no keyboard. Give a field `data-keyboard-manual="true"` to keep the keyboard from opening for it, and open one yourself.

## Languages

The text keyboard has the layout of a real keyboard of the language, from the Windows keyboards of Unicode CLDR: the number row, the three letter rows, shift, and dead keys, so `´` then `e` types `é`. 201 layouts are bundled, the languages needing an input method (Japanese, Korean, Chinese) are left out.

- **Holding a key** shows a row of what else it types above it: the AltGr character of the key on a real keyboard, like `@` on `2` of the Danish keyboard, then the letters its dead keys make, like `é è ê ë` on `e`. The accents are in the same order on every layout, acute, grave, circumflex, diaeresis, tilde, then the rest. The first is shown small in the corner of the key and is right above it, so holding and letting go types it, slide to another to type that instead.
- **The Sym key** switches to two pages of symbols, the same for every language, with all ASCII symbols and the common ones a layout may not have, like `€ £ § ° ± « » – … © ™ ½ × ÷ ≤ ≥ → “ ”`. The key where shift is turns the page, Sym goes back to the letters. The symbols are typed as they are, a dead key like `^` of the German keyboard types `^` there.

```ts
import { KEYBOARD_LANGUAGE, KEYBOARD_LAYOUT } from "@chocbite/ts-lib-ui/keyboard";

void KEYBOARD_LANGUAGE.write("de-CH");
KEYBOARD_LAYOUT.sub((layout) => console.log(layout.value.name), true); // Swiss German
```

- **`KEYBOARD_LANGUAGE`** is a writable string state, a setting stored with the settings of ts-lib-ui. It is the id of a layout, a locale like `da` or `de-CH`, with a variant like `en-dvorak` for the other layouts of a language. Empty, the default, follows the language of the browser.
- **The 🌐 key** opens a panel above the keyboard with the layouts by continent and country, and "Automatic" to follow the browser again. Choosing one writes `KEYBOARD_LANGUAGE`, so the choice is kept, and gives the focus back to the field.
- **`KEYBOARD_LAYOUT`** is a read only state of the layout in use, `KEYBOARD_LANGUAGE`, or the layout following the browser when it is empty or not a layout.
- **Following the browser** goes through `navigator.languages` and takes the first with a layout: the layout of the locale itself like `de-CH`, then for a locale with a region a layout used in that region, so `en-DK` gets the Danish keyboard, then the layout of the language. English (US) when none has one. **`keyboard_layout_for(languages)`** does the same for any list of locales.
- **`keyboard_layout(id)`** gives a layout, **`keyboard_layout_config(layout)`** the keyboard configuration the text keyboard uses for it, to open with `keyboard_open` or change in your own keyboard. **`KEYBOARD_LAYOUTS`** lists all layouts by id, name and countries, without their keys.

The email keyboard keeps one English layout, email addresses are in practice only ASCII.

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

**`keyboard_create(config)`** makes a keyboard from a layout, made once and opened as often as needed. Give a state of the layout to change it while the keyboard is in use, the keyboard is built again when the state changes. The types of a layout are exported for code building one: `KeyboardConfig`, `KeyboardLayers`, `KeyboardLayerConfig` and `KeyboardKeyConfig`.

- **A layout** has a `default` layer and optional `layers` by name. A layer has rows of keys, `max_width` in rem, and `key_rows` and `key_cols`, the size of a key in grid cells.
- **A key** is `{ text, key?, hold?, rows?, cols? }`. `text` is shown, and typed when there is no `key`. `rows` and `cols` make a key bigger than the default of its layer. `hold` is what the key types when held, shown in a row above it to slide to, the first also small in the corner of the key. A key with `hold` types when let go, like every key, but not after being held.
- **A number in a row** is an empty gap of that many columns.
- **Special keys** are given as `key`, from `KeyboardSpecialKeys`: `Backspace`, `Enter`, `Escape`, `Left`, `Right`, `Close` to close the keyboard, and `Language` to open the list of languages.
- **`dead_keys`** makes keys dead keys, like on a real keyboard: `{ "´e": "é", "´ ": "´" }` makes `´` type nothing until the next key, then what the two make, or both when they make nothing. Backspace cancels a waiting dead key. A layer with `dead_keys: false`, like a layer of symbols, types its keys as they are.
- **`"layer:<name>"`** switches to the layer with that name, the same key again switches back to the default layer, like shift.

A key acts like a key on a real keyboard: the field gets `keydown`, `beforeinput`, `input` and `keyup` events, and the text changes at the cursor. Enter and Escape are `keydown` events for the field to act on. When the keyboard closes after a change, the field gets a `change` event.

## Look

The keyboards sit in a grey tray at the bottom of the screen, with white keys that type, darker special keys (backspace, shift, close and the other keys given as `key` from `KeyboardSpecialKeys` or `layer:`), and the accent color on Enter, an active layer like shift, and the selected day or time. The colors are the theme variables of the `keyboard` group: `background` (the tray), `key`, `key_special`, `keytext`, `active` (a pressed key), `accent`, `accent_text`, `border` and `shadow`. Special keys carry a `special` attribute with the name of the key, or `layer` for a layer switch. Dead keys carry a `dead` attribute, and `active="true"` while they wait for the next key. A key with `hold` carries a `hint` attribute with the first of them, shown in its corner, and the row above a held key is an `onscreen-keyboard-hold` element, the chosen key in it with `active="true"`.
