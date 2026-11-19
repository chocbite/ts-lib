import { BLUE, GREY, RED } from "@chocbite/ts-lib/colors";
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
  "Colors of the top bar and panels",
);

colors.make_variable(
  "titlebar",
  "Title Bar Color",
  "Background of the top bar and the title bars of panels",
  GREY[100],
  "#262626",
  "Color",
  undefined,
);
colors.make_variable(
  "titlebarHover",
  "Title Bar Hover Color",
  "Background of title bars and top bar buttons when hovering",
  GREY[200],
  "#363636",
  "Color",
  undefined,
);
colors.make_variable(
  "titlebarCloseHover",
  "Close Hover Color",
  "Background of the close button of a panel when hovering",
  RED[600],
  RED[700],
  "Color",
  undefined,
);
colors.make_variable(
  "titlebarText",
  "Title Bar Text Color",
  "Text of the top bar and the title bars",
  GREY[900],
  GREY[100],
  "Color",
  undefined,
);
colors.make_variable(
  "background",
  "Background Color",
  "Background of the content of panels",
  "#FFFFFF",
  "#2B2B2B",
  "Color",
  undefined,
);
colors.make_variable(
  "icons",
  "Icon Color",
  "Icons in title bars and the sizers",
  GREY[800],
  GREY[200],
  "Color",
  undefined,
);
colors.make_variable(
  "sizers",
  "Sizer Color",
  "Frame around a panel with the sizers in touch mode",
  GREY[200],
  "#333333",
  "Color",
  undefined,
);
colors.make_variable(
  "border",
  "Border Color",
  "Line around panels and below the top bar and title bars",
  GREY[300],
  GREY[700],
  "Color",
  undefined,
);
colors.make_variable(
  "shadow",
  "Shadow Color",
  "Shadow of panels floating above the page",
  "rgba(0, 0, 0, 0.18)",
  "rgba(0, 0, 0, 0.6)",
  "Color",
  undefined,
);
colors.make_variable(
  "glow",
  "Glow Color",
  "Light halo around panels, a dark shadow does not show on a dark page so dark mode lifts panels with this instead",
  "rgba(255, 255, 255, 0)",
  "rgba(255, 255, 255, 0.25)",
  "Color",
  undefined,
);
colors.make_variable(
  "shadowFocus",
  "Focus Color",
  "Border of the panel that has focus",
  BLUE[400],
  BLUE[300],
  "Color",
  undefined,
);
