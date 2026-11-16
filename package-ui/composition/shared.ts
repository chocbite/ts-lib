import { GREY, ORANGE, RED } from "@chocbite/ts-lib/colors";
import { px_to_rem, theme_init_variable_root } from "#theme";

/** Type to store a position related to composition
 * position is always in rem*/
export interface CompPosition {
  x: number;
  y: number;
}

/**A point of a box, like the corner of a panel that its position places*/
export const CompAnchor = {
  TOP_RIGHT: "top_right",
  TOP_LEFT: "top_left",
  BOT_RIGHT: "bot_right",
  BOT_LEFT: "bot_left",
  CENTER: "center",
} as const;
export type CompAnchor = (typeof CompAnchor)[keyof typeof CompAnchor];

/**Where the anchor is in a box, as parts of its width and height from the top left*/
export function anchor_fraction(anchor: CompAnchor): [number, number] {
  if (anchor === CompAnchor.CENTER) return [0.5, 0.5];
  const [f, l] = anchor.split("_");
  return [l === "left" ? 0 : 1, f === "top" ? 0 : 1];
}

/**Position in rem of the anchor point of the element, from the top left of the page*/
export function get_element_anchor_position(
  element: Element,
  anchor: CompAnchor,
): CompPosition {
  const rect = element.getBoundingClientRect();
  const [ax, ay] = anchor_fraction(anchor);
  return {
    x: px_to_rem(rect.left + rect.width * ax),
    y: px_to_rem(rect.top + rect.height * ay),
  };
}

const theme_root = theme_init_variable_root(
  "composition",
  "Composition",
  "Theme variables for page composition, panels and top bar",
);

//       _____ ____  _      ____  _____   _____
//      / ____/ __ \| |    / __ \|  __ \ / ____|
//     | |   | |  | | |   | |  | | |__) | (___
//     | |   | |  | | |   | |  | |  _  / \___ \
//     | |___| |__| | |___| |__| | | \ \ ____) |
//      \_____\____/|______\____/|_|  \_\_____/
const colors = theme_root.make_sub_group(
  "colors",
  "Colors",
  "Colors used in all form elements",
);

colors.make_variable(
  "titlebar",
  "Title Bar Background",
  "Background color for the title bar of UI panels",
  GREY[500],
  GREY[800],
  "Color",
  undefined,
);

colors.make_variable(
  "titlebarHover",
  "Title Bar Hover Background",
  "Background color for the title bar of UI panels when hovered",
  GREY[400],
  GREY[700],
  "Color",
  undefined,
);

colors.make_variable(
  "titlebarCloseHover",
  "Title Bar Close Hover Background",
  "Background color for the title bar close button of UI panels when hovered",
  RED[400],
  RED[700],
  "Color",
  undefined,
);

colors.make_variable(
  "titlebarText",
  "Title Bar Text",
  "Text color for the title bar of UI panels",
  GREY[900],
  GREY[50],
  "Color",
  undefined,
);

colors.make_variable(
  "background",
  "Content Background",
  "Default background color for content areas",
  GREY[100],
  "#000000",
  "Color",
  undefined,
);

colors.make_variable(
  "icons",
  "Icons Color",
  "Default color for icons",
  GREY[900],
  GREY[100],
  "Color",
  undefined,
);

colors.make_variable(
  "sizers",
  "Sizers",
  "Background color of the sizers of panels, shown in touch mode",
  GREY[300],
  GREY[900],
  "Color",
  undefined,
);

colors.make_variable(
  "shadow",
  "Border Shadow",
  "Shadow color for borders and outlines",
  "#000000",
  GREY[50],
  "Color",
  undefined,
);

colors.make_variable(
  "shadowFocus",
  "Border Shadow In Focus",
  "Shadow color for borders and outlines when in focus",
  ORANGE[500],
  ORANGE[500],
  "Color",
  undefined,
);
