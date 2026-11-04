import { Keyboard_Keys } from "./keyboard_keys";
import { KeyboardSpecialKeys } from "./types";

export const NUMBER_RATIONAL_KEYBOARD = new Keyboard_Keys({
  default: {
    max_width: 24,
    keys: [
      [
        ..."789-".split("").map((n) => ({ text: n })),
        { text: "⌫", key: KeyboardSpecialKeys.Backspace },
      ],
      [
        ..."456.".split("").map((n) => ({ text: n })),
        { text: "Esc", key: KeyboardSpecialKeys.Escape },
      ],
      [
        ..."123".split("").map((n) => ({ text: n })),
        { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 2 },
      ],
      [
        { text: "0", cols: 2 },
        { text: "🡸", key: KeyboardSpecialKeys.Left },
        { text: "🡺", key: KeyboardSpecialKeys.Right },

        { text: "🗙", key: KeyboardSpecialKeys.Close },
      ],
    ],
  },
});

export const NUMBER_WHOLE_KEYBOARD = new Keyboard_Keys({
  default: {
    max_width: 24,
    keys: [
      [
        ..."789".split("").map((n) => ({ text: n })),
        { text: "⌫", key: KeyboardSpecialKeys.Backspace, cols: 2 },
      ],
      [
        ..."456".split("").map((n) => ({ text: n })),
        { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: 2 },
      ],
      [
        ..."123".split("").map((n) => ({ text: n })),
        { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 2 },
      ],
      [
        { text: "0", cols: 2 },
        { text: "🡸", key: KeyboardSpecialKeys.Left },
        { text: "🡺", key: KeyboardSpecialKeys.Right },
        { text: "🗙", key: KeyboardSpecialKeys.Close },
      ],
    ],
  },
});

export const NUMBER_HEX_KEYBOARD = new Keyboard_Keys({
  default: {
    max_width: 24,
    keys: [
      [
        ..."789A".split("").map((n) => ({ text: n })),
        { text: "⌫", key: KeyboardSpecialKeys.Backspace },
      ],
      [
        ..."456B".split("").map((n) => ({ text: n })),
        { text: "Esc", key: KeyboardSpecialKeys.Escape },
      ],
      [
        ..."123C".split("").map((n) => ({ text: n })),
        { text: "⏎", key: KeyboardSpecialKeys.Enter },
      ],
      [
        { text: "0", cols: 2 },
        { text: "D" },
        { text: "E" },
        { text: "F" },
        { text: "🗙", key: KeyboardSpecialKeys.Close },
      ],
    ],
  },
});

export const NUMBER_INTEGER_KEYBOARD = new Keyboard_Keys({
  default: {
    max_width: 24,
    keys: [
      [
        ..."789-".split("").map((n) => ({ text: n })),
        { text: "⌫", key: KeyboardSpecialKeys.Backspace },
      ],
      [
        ..."456".split("").map((n) => ({ text: n })),
        { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: 2 },
      ],
      [
        ..."123".split("").map((n) => ({ text: n })),
        { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 2 },
      ],
      [
        { text: "0", cols: 2 },
        { text: "🡸", key: KeyboardSpecialKeys.Left },
        { text: "🡺", key: KeyboardSpecialKeys.Right },
        { text: "🗙", key: KeyboardSpecialKeys.Close },
      ],
    ],
  },
});

export const NUMBER_RATIONAL_POSITIVE_KEYBOARD = new Keyboard_Keys({
  default: {
    max_width: 24,
    keys: [
      [
        ..."789".split("").map((n) => ({ text: n })),
        { text: "⌫", key: KeyboardSpecialKeys.Backspace, cols: 2 },
      ],
      [
        ..."456.".split("").map((n) => ({ text: n })),
        { text: "Esc", key: KeyboardSpecialKeys.Escape },
      ],
      [
        ..."123".split("").map((n) => ({ text: n })),
        { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 2 },
      ],
      [
        { text: "0", cols: 2 },
        { text: "🡸", key: KeyboardSpecialKeys.Left },
        { text: "🡺", key: KeyboardSpecialKeys.Right },
        { text: "🗙", key: KeyboardSpecialKeys.Close },
      ],
    ],
  },
});

export const PHONE_KEYBOARD = new Keyboard_Keys({
  default: {
    max_width: 24,
    keys: [
      [
        ..."789".split("").map((n) => ({ text: n })),
        1,
        { text: "⌫", key: KeyboardSpecialKeys.Backspace },
      ],
      [
        ..."456".split("").map((n) => ({ text: n })),
        { text: "+", rows: 2 },
        { text: "Esc", key: KeyboardSpecialKeys.Escape },
      ],
      [
        ..."123".split("").map((n) => ({ text: n })),
        1,
        { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 1 },
      ],
      [
        { text: "0", cols: 2 },
        { text: "🡸", key: KeyboardSpecialKeys.Left },
        { text: "🡺", key: KeyboardSpecialKeys.Right },
        { text: "🗙", key: KeyboardSpecialKeys.Close },
      ],
    ],
  },
});
