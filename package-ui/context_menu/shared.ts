import { BLUE, GREY } from "@chocbite/ts-lib/colors";
import { theme_init_variable_root } from "#theme";

const variables = theme_init_variable_root(
  "contextmenu",
  "Context Menu",
  "Right click or touch and hold context menu appearance",
);
variables.make_variable(
  "background",
  "Background Color",
  "Color of background",
  GREY["50"],
  GREY["900"],
  "Color",
  undefined,
);
variables.make_variable(
  "text",
  "Text Color",
  "Color of text",
  GREY["600"],
  GREY["400"],
  "Color",
  undefined,
);
variables.make_variable(
  "hover",
  "Hover Color",
  "Background color of line when hovering over it",
  BLUE["200"],
  BLUE["900"],
  "Color",
  undefined,
);
variables.make_variable(
  "hoverText",
  "Text Color",
  "Standard text color",
  GREY["900"],
  GREY["50"],
  "Color",
  undefined,
);
variables.make_variable(
  "border",
  "Border Color",
  "Color of border and deviders",
  GREY["300"],
  GREY["800"],
  "Color",
  undefined,
);
