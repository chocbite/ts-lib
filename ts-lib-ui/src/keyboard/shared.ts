import { GREY } from "@chocbite/ts-lib/colors";
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

colors.make_variable(
  "background",
  "Background Color",
  "",
  GREY["50"],
  GREY["900"],
  "Color",
  undefined,
);
colors.make_variable(
  "keytext",
  "Key Text Color",
  "",
  GREY["800"],
  GREY["200"],
  "Color",
  undefined,
);
colors.make_variable(
  "border",
  "Border Color",
  "",
  GREY["900"],
  GREY["50"],
  "Color",
  undefined,
);
colors.make_variable(
  "shadow",
  "Shadow Color",
  "",
  GREY["900"] + "88",
  GREY["50"] + "FF",
  "Color",
  undefined,
);
colors.make_variable(
  "active",
  "Pressed Color",
  "Color of the key when pressed",
  GREY["400"],
  GREY["700"],
  "Color",
  undefined,
);
