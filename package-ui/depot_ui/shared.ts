import { theme_init_variable_root } from "#theme";
import { GREY } from "@chocbite/ts-lib/colors";

const theme_root = theme_init_variable_root(
  "depot",
  "Depot",
  "Theme variables for depot selectors",
);

const colors = theme_root.make_sub_group(
  "colors",
  "Colors",
  "Colors used in depot selectors",
);
colors.make_variable(
  "backdrop",
  "Backdrop Color",
  "Covers the page behind an open selector",
  GREY["900"] + "66",
  GREY["900"] + "99",
  "Color",
  undefined,
);
colors.make_variable(
  "background",
  "Background Color",
  "Background of the selector",
  GREY["50"],
  GREY["900"],
  "Color",
  undefined,
);
colors.make_variable(
  "text",
  "Text Color",
  "Title text of the selector",
  GREY["900"],
  GREY["50"],
  "Color",
  undefined,
);
colors.make_variable(
  "shadow",
  "Shadow Color",
  "Shadow around the selector",
  GREY["900"] + "88",
  GREY["50"] + "33",
  "Color",
  undefined,
);
