import { Keyboard_Keys } from "./keyboard_keys";
import { KeyboardSpecialKeys } from "./types";

export const TEXT_KEYBOARD = new Keyboard_Keys({
  default: {
    max_width: 60,
    key_cols: 4,
    keys: [
      [
        ..."1234567890".split("").map((n) => ({ text: n })),
        { text: "⌫", key: KeyboardSpecialKeys.Backspace },
      ],
      [2, ..."qwertyuiop".split("").map((n) => ({ text: n }))],
      [
        { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: 3 },
        ..."asdfghjkl".split("").map((n) => ({ text: n })),
        { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 5 },
      ],
      [
        { text: "⇧", key: "layer:shift", cols: 5 },
        ..."zxcvbnm,.".split("").map((n) => ({ text: n })),
      ],
      [
        { text: "Sym", key: "layer:sym", cols: 5 },
        6,
        { text: "Space", key: " ", cols: 20 },
        { text: "🡸", key: KeyboardSpecialKeys.Left },
        { text: "🡺", key: KeyboardSpecialKeys.Right },
        { text: "🗙", key: KeyboardSpecialKeys.Close, cols: 5 },
      ],
    ],
  },
  layers: {
    shift: {
      max_width: 60,
      key_cols: 4,
      keys: [
        [
          ..."1234567890".split("").map((n) => ({ text: n })),
          { text: "⌫", key: KeyboardSpecialKeys.Backspace },
        ],
        [2, ..."QWERTYUIOP".split("").map((n) => ({ text: n }))],
        [
          { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: 3 },
          ..."ASDFGHJKL".split("").map((n) => ({ text: n })),
          { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 5 },
        ],
        [
          { text: "⇧", key: "layer:shift", cols: 5 },
          ..."ZXCVBNM;:".split("").map((n) => ({ text: n })),
        ],
        [
          { text: "Sym", key: "layer:sym", cols: 5 },
          6,
          { text: "Space", key: " ", cols: 20 },
          { text: "🡸", key: KeyboardSpecialKeys.Left },
          { text: "🡺", key: KeyboardSpecialKeys.Right },
          { text: "🗙", key: KeyboardSpecialKeys.Close, cols: 5 },
        ],
      ],
    },
    sym: {
      max_width: 60,
      key_cols: 4,
      keys: [
        [
          ...'!"#¤%&/()='.split("").map((n) => ({ text: n })),
          { text: "⌫", key: KeyboardSpecialKeys.Backspace },
        ],
        [2, ..."+@£$€?{[]}".split("").map((n) => ({ text: n }))],
        [
          { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: 3 },
          ..."-_½§¨^~'*".split("").map((n) => ({ text: n })),
          { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 5 },
        ],
        [
          { text: "⇧", key: "layer:shift", cols: 5 },
          ..."<>|\\°`¶".split("").map((n) => ({ text: n })),
        ],
        [
          { text: "Sym", key: "layer:sym", cols: 5 },
          6,
          { text: "Space", key: " ", cols: 20 },
          { text: "🡸", key: KeyboardSpecialKeys.Left },
          { text: "🡺", key: KeyboardSpecialKeys.Right },
          { text: "🗙", key: KeyboardSpecialKeys.Close, cols: 5 },
        ],
      ],
    },
  },
});

export const EMAIL_KEYBOARD = new Keyboard_Keys({
  default: {
    max_width: 60,
    key_cols: 4,
    keys: [
      [
        ..."1234567890".split("").map((n) => ({ text: n })),
        { text: "⌫", key: KeyboardSpecialKeys.Backspace },
      ],
      [2, ..."qwertyuiop".split("").map((n) => ({ text: n }))],
      [
        { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: 3 },
        ..."asdfghjkl".split("").map((n) => ({ text: n })),
        { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 5 },
      ],
      [
        { text: "⇧", key: "layer:shift", cols: 5 },
        ..."zxcvbnm,.".split("").map((n) => ({ text: n })),
      ],
      [
        { text: "Sym", key: "layer:sym", cols: 5 },
        2,
        { text: "@" },
        { text: "Space", key: " ", cols: 20 },
        { text: "🡸", key: KeyboardSpecialKeys.Left },
        { text: "🡺", key: KeyboardSpecialKeys.Right },
        { text: "🗙", key: KeyboardSpecialKeys.Close, cols: 5 },
      ],
    ],
  },
  layers: {
    shift: {
      max_width: 60,
      key_cols: 4,
      keys: [
        [
          ..."1234567890@".split("").map((n) => ({ text: n })),
          { text: "⌫", key: KeyboardSpecialKeys.Backspace },
        ],
        [2, ..."QWERTYUIOP".split("").map((n) => ({ text: n }))],
        [
          { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: 3 },
          ..."ASDFGHJKL".split("").map((n) => ({ text: n })),
          { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 5 },
        ],
        [
          { text: "⇧", key: "layer:shift", cols: 5 },
          ..."ZXCVBNM;:".split("").map((n) => ({ text: n })),
        ],
        [
          { text: "Sym", key: "layer:sym", cols: 5 },
          6,
          { text: "Space", key: " ", cols: 20 },
          { text: "🡸", key: KeyboardSpecialKeys.Left },
          { text: "🡺", key: KeyboardSpecialKeys.Right },
          { text: "🗙", key: KeyboardSpecialKeys.Close, cols: 5 },
        ],
      ],
    },
    sym: {
      max_width: 60,
      key_cols: 4,
      keys: [
        [
          ...'!"#¤%&/()='.split("").map((n) => ({ text: n })),
          { text: "⌫", key: KeyboardSpecialKeys.Backspace },
        ],
        [2, ..."+@£$€?{[]}".split("").map((n) => ({ text: n }))],
        [
          { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: 3 },
          ..."-_½§¨^~'*".split("").map((n) => ({ text: n })),
          { text: "⏎", key: KeyboardSpecialKeys.Enter, cols: 5 },
        ],
        [
          { text: "⇧", key: "layer:shift", cols: 5 },
          ..."<>|\\°`¶".split("").map((n) => ({ text: n })),
        ],
        [
          { text: "Sym", key: "layer:sym", cols: 5 },
          6,
          { text: "Space", key: " ", cols: 20 },
          { text: "🡸", key: KeyboardSpecialKeys.Left },
          { text: "🡺", key: KeyboardSpecialKeys.Right },
          { text: "🗙", key: KeyboardSpecialKeys.Close, cols: 5 },
        ],
      ],
    },
  },
});
