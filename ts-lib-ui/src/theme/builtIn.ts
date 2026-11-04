import { GREY } from "@chocbite/ts-lib/colors";
import { theme_init_variable_root } from "./variables";

export const BUILT_IN = 0;

const root = theme_init_variable_root(
  "common",
  "Shared Variables",
  "Shared variables across features",
);

const scroll_bar = root.make_sub_group(
  "scrollbar",
  "Scrollbar",
  "Scrollbar variables",
);
const scroll_bar_thumb = scroll_bar.make_sub_group(
  "thumb",
  "Thumb",
  "Scrollbar Thumb variables",
);
scroll_bar_thumb.make_variable(
  "color",
  "Thumb Color",
  "Color of the scrollbar thumb in normal state",
  GREY["400"],
  GREY["800"],
  "Font",
  undefined,
);
scroll_bar_thumb.make_variable(
  "hoverColor",
  "Thumb Hover Color",
  "Color of the scrollbar thumb when hovered",
  GREY["600"],
  GREY["600"],
  "Font",
  undefined,
);
scroll_bar_thumb.make_variable(
  "activeColor",
  "Thumb Color",
  "Color of the scrollbar thumb in normal state",
  GREY["500"],
  GREY["700"],
  "Font",
  undefined,
);

const fonts = root.make_sub_group("fonts", "Fonts", "Font variables");
fonts.make_variable(
  "base",
  "UI Base Font",
  "The base font for the UI",
  '"Roboto", Arial, Helvetica, sans-serif',
  '"Roboto", Arial, Helvetica, sans-serif',
  "Font",
  undefined,
);

//       _____ ____  _      ____  _____   _____
//      / ____/ __ \| |    / __ \|  __ \ / ____|
//     | |   | |  | | |   | |  | | |__) | (___
//     | |   | |  | | |   | |  | |  _  / \___ \
//     | |___| |__| | |___| |__| | | \ \ ____) |
//      \_____\____/|______\____/|_|  \_\_____/

const colors = root.make_sub_group("colors", "Colors", "Color variables");
colors.make_variable(
  "layer1",
  "UI Layer 1",
  "Color of the first layer of the UI",
  GREY[50],
  "#111111",
  "Color",
  undefined,
);
