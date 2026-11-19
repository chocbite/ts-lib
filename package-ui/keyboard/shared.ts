import { BLUE, GREY } from "@chocbite/ts-lib/colors";
import { theme_init_variable_root } from "#theme";

const theme_root = theme_init_variable_root(
  "keyboard",
  "Virtual Keyboard",
  "Theme variables for the virtual keyboard",
);

//#################################################################################3
//#################################################################################3
//       _____ ____  _      ____  _____   _____
//      / ____/ __ \| |    / __ \|  __ \ / ____|
//     | |   | |  | | |   | |  | | |__) | (___
//     | |   | |  | | |   | |  | |  _  / \___ \
//     | |___| |__| | |___| |__| | | \ \ ____) |
//      \_____\____/|______\____/|_|  \_\_____/
const colors = theme_root.make_sub_group(
  "colors",
  "Colors",
  "Colors used in the virtual keyboard",
);

//A grey tray with white typing keys, special keys darker, and the accent for enter, an active layer and selections
colors.make_variable(
  "background",
  "Background Color",
  "Background of the keyboard tray",
  "#E4E4E4",
  "#202020",
  "Color",
  undefined,
);
colors.make_variable(
  "key",
  "Key Color",
  "Background of the keys that type",
  "#FFFFFF",
  "#3B3B3B",
  "Color",
  undefined,
);
colors.make_variable(
  "key_special",
  "Special Key Color",
  "Background of special keys like backspace, shift and close",
  "#C9C9C9",
  "#545454",
  "Color",
  undefined,
);
colors.make_variable(
  "keytext",
  "Key Text Color",
  "Text of the keys and the keyboard",
  GREY["900"],
  GREY["100"],
  "Color",
  undefined,
);
colors.make_variable(
  "border",
  "Border Color",
  "Lines in the keyboards, like around the week rows and the color fields",
  GREY["400"],
  GREY["700"],
  "Color",
  undefined,
);
colors.make_variable(
  "shadow",
  "Shadow Color",
  "Shadow under the keys and above the tray",
  "rgba(0, 0, 0, 0.3)",
  "rgba(0, 0, 0, 0.6)",
  "Color",
  undefined,
);
colors.make_variable(
  "active",
  "Pressed Color",
  "Color of the key when pressed",
  GREY["400"],
  "#707070",
  "Color",
  undefined,
);
colors.make_variable(
  "accent",
  "Accent Color",
  "Enter key, an active layer like shift, and the selected day or time",
  BLUE["700"],
  BLUE["300"],
  "Color",
  undefined,
);
colors.make_variable(
  "accent_text",
  "Accent Text Color",
  "Text on the accent color",
  "#FFFFFF",
  GREY["900"],
  "Color",
  undefined,
);
