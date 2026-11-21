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
  "#FFFFFF",
  "#2B2B2B",
  "Color",
  undefined,
);
variables.make_variable(
  "text",
  "Text Color",
  "Color of text",
  GREY["900"],
  GREY["100"],
  "Color",
  undefined,
);
variables.make_variable(
  "hover",
  "Hover Color",
  "Background color of line when hovering over it",
  GREY["200"],
  "#3D3D3D",
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
  "Color of border and dividers",
  GREY["300"],
  GREY["700"],
  "Color",
  undefined,
);
variables.make_variable(
  "focus",
  "Focus Color",
  "Ring around the line with keyboard focus",
  BLUE["400"],
  BLUE["300"],
  "Color",
  undefined,
);
variables.make_variable(
  "shadow",
  "Shadow Color",
  "Shadow of the menu floating above the page",
  "rgba(0, 0, 0, 0.18)",
  "rgba(0, 0, 0, 0.6)",
  "Color",
  undefined,
);
