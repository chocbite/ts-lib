import { theme_init_variable_root } from "#theme";
import { GREY, ORANGE, RED } from "@chocbite/ts-lib/colors";

const theme_root = theme_init_variable_root(
  "list",
  "UI List Elements",
  "Theme variables for UI list elements",
);

//      _____  ______          _____     ____  _   _ _  __     __
//     |  __ \|  ____|   /\   |  __ \   / __ \| \ | | | \ \   / /
//     | |__) | |__     /  \  | |  | | | |  | |  \| | |  \ \_/ /
//     |  _  /|  __|   / /\ \ | |  | | | |  | | . ` | |   \   /
//     | | \ \| |____ / ____ \| |__| | | |__| | |\  | |____| |
//     |_|  \_\______/_/    \_\_____/   \____/|_| \_|______|_|
const read_only = theme_root.make_sub_group(
  "read",
  "Read Only",
  "Settings for list elements in read only mode",
);
read_only.make_variable(
  "filter",
  "Read Only Filter",
  "Filter applied to list elements in read only mode",
  "opacity(0.6)",
  "opacity(0.6)",
  "Filter",
  undefined,
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
  "Colors used in all list elements",
);

//      _______ ________   _________    _____ ____  _      ____  _____   _____
//     |__   __|  ____\ \ / /__   __|  / ____/ __ \| |    / __ \|  __ \ / ____|
//        | |  | |__   \ V /   | |    | |   | |  | | |   | |  | | |__) | (___
//        | |  |  __|   > <    | |    | |   | |  | | |   | |  | |  _  / \___ \
//        | |  | |____ / . \   | |    | |___| |__| | |___| |__| | | \ \ ____) |
//        |_|  |______/_/ \_\  |_|     \_____\____/|______\____/|_|  \_\_____/
const colors_text = colors.make_sub_group(
  "text",
  "Text Colors",
  "Text colors used in all list elements",
);
colors_text.make_variable(
  "header",
  "Header Text Color",
  "Header text color in list elements",
  GREY["900"],
  GREY["50"],
  "Color",
  undefined,
);
colors_text.make_variable(
  "field",
  "Field Text Color",
  "Text color of list field elements",
  GREY["800"],
  GREY["100"],
  "Color",
  undefined,
);
colors_text.make_variable(
  "key_field",
  "Special Column Text Color",
  "Text color of special first column elements",
  GREY["900"],
  GREY["50"],
  "Color",
  undefined,
);
colors_text.make_variable(
  "add",
  "Row Adder Text Color",
  "Text color of row adder button",
  GREY["900"],
  GREY["50"],
  "Color",
  undefined,
);
colors_text.make_variable(
  "error",
  "Error Text Color",
  "Text color of list errors and invalid rows",
  RED["800"],
  RED["200"],
  "Color",
  undefined,
);

//      _____ _____ ____  _   _    _____ ____  _      ____  _____   _____
//     |_   _/ ____/ __ \| \ | |  / ____/ __ \| |    / __ \|  __ \ / ____|
//       | || |   | |  | |  \| | | |   | |  | | |   | |  | | |__) | (___
//       | || |   | |  | | . ` | | |   | |  | | |   | |  | |  _  / \___ \
//      _| || |___| |__| | |\  | | |___| |__| | |___| |__| | | \ \ ____) |
//     |_____\_____\____/|_| \_|  \_____\____/|______\____/|_|  \_\_____/
const colors_icon = colors.make_sub_group(
  "icon",
  "Icon Colors",
  "Icon colors used in all form elements",
);
colors_icon.make_variable(
  "sub_opener",
  "Sub Row Opener Icon Color",
  "Color of the sub row opener icon",
  GREY["800"],
  GREY["200"],
  "Color",
  undefined,
);
colors_icon.make_variable(
  "key_icon",
  "Key Field Icon Color",
  "Color of the key field icon",
  GREY["800"],
  GREY["200"],
  "Color",
  undefined,
);
colors_icon.make_variable(
  "add_icon",
  "Add Row Icon Color",
  "Color of the add row icon",
  GREY["800"],
  GREY["200"],
  "Color",
  undefined,
);

//      ____          _____ _  _______ _____   ____  _    _ _   _ _____     _____ ____  _      ____  _____   _____
//     |  _ \   /\   / ____| |/ / ____|  __ \ / __ \| |  | | \ | |  __ \   / ____/ __ \| |    / __ \|  __ \ / ____|
//     | |_) | /  \ | |    | ' / |  __| |__) | |  | | |  | |  \| | |  | | | |   | |  | | |   | |  | | |__) | (___
//     |  _ < / /\ \| |    |  <| | |_ |  _  /| |  | | |  | | . ` | |  | | | |   | |  | | |   | |  | |  _  / \___ \
//     | |_) / ____ \ |____| . \ |__| | | \ \| |__| | |__| | |\  | |__| | | |___| |__| | |___| |__| | | \ \ ____) |
//     |____/_/    \_\_____|_|\_\_____|_|  \_\\____/ \____/|_| \_|_____/   \_____\____/|______\____/|_|  \_\_____/
const colors_background = colors.make_sub_group(
  "background",
  "Background Colors",
  "Background colors used in all list elements",
);
colors_background.make_variable(
  "row_even",
  "Even Row Background Color",
  "Color of even row element backgrounds",
  GREY["200"],
  GREY["800"],
  "Color",
  undefined,
);
colors_background.make_variable(
  "row_odd",
  "Odd Row Background Color",
  "Color of odd row element backgrounds",
  GREY["50"],
  GREY["900"],
  "Color",
  undefined,
);
colors_background.make_variable(
  "row_hover",
  "Hover Row Background Color",
  "Color of row element backgrounds when hovering",
  GREY["300"],
  GREY["700"],
  "Color",
  undefined,
);

//      ____   ____  _____  _____  ______ _____     _____ ____  _      ____  _____   _____
//     |  _ \ / __ \|  __ \|  __ \|  ____|  __ \   / ____/ __ \| |    / __ \|  __ \ / ____|
//     | |_) | |  | | |__) | |  | | |__  | |__) | | |   | |  | | |   | |  | | |__) | (___
//     |  _ <| |  | |  _  /| |  | |  __| |  _  /  | |   | |  | | |   | |  | |  _  / \___ \
//     | |_) | |__| | | \ \| |__| | |____| | \ \  | |___| |__| | |___| |__| | | \ \ ____) |
//     |____/ \____/|_|  \_\_____/|______|_|  \_\  \_____\____/|______\____/|_|  \_\_____/
const colors_border = colors.make_sub_group(
  "border",
  "Border Colors",
  "Border colors used in all list elements",
);
colors_border.make_variable(
  "header",
  "Header Border Color",
  "Color of borders under header",
  GREY["600"],
  GREY["400"],
  "Color",
  undefined,
);
colors_border.make_variable(
  "row",
  "Row Border Color",
  "Color of borders between rows",
  GREY["400"],
  GREY["600"],
  "Color",
  undefined,
);
colors_border.make_variable(
  "column",
  "Column Border Color",
  "Color of border between columns",
  GREY["500"],
  GREY["500"],
  "Color",
  undefined,
);

//      ______ ____   _____ _    _  _____
//     |  ____/ __ \ / ____| |  | |/ ____|
//     | |__ | |  | | |    | |  | | (___
//     |  __|| |  | | |    | |  | |\___ \
//     | |   | |__| | |____| |__| |____) |
//     |_|    \____/ \_____|\____/|_____/
const colors_focus = colors.make_sub_group(
  "focus",
  "Focus Colors",
  "Focus colors used in all list elements",
);
colors_focus.make_variable(
  "normal",
  "Focus Color",
  "Color of focussed list element",
  ORANGE["600"],
  ORANGE["300"],
  "Color",
  undefined,
);

//#################################################################################3
//#################################################################################3
//       _____ _____ ____________  _____
//      / ____|_   _|___  /  ____|/ ____|
//     | (___   | |    / /| |__  | (___
//      \___ \  | |   / / |  __|  \___ \
//      ____) |_| |_ / /__| |____ ____) |
//     |_____/|_____/_____|______|_____/
const sizes = theme_root.make_sub_group(
  "size",
  "Size",
  "Sizes used in all list elements",
);

sizes.make_variable(
  "row_min",
  "Row Minimum Height",
  "Minimum height for list rows",
  "1.4rem",
  "1.4rem",
  "Length",
  { min: 0.1, max: 10 },
);

sizes.make_variable(
  "touch_row_min",
  "Touch Row Minimum Height",
  "Minimum height for list rows on touch devices",
  "2.6rem",
  "2.6rem",
  "Length",
  { min: 0.1, max: 10 },
);

sizes.make_variable(
  "add_min",
  "Add Row Minimum Height",
  "Minimum height for add row button",
  "1rem",
  "1rem",
  "Length",
  { min: 0.1, max: 10 },
);

sizes.make_variable(
  "touch_add_min",
  "Touch Add Row Minimum Height",
  "Minimum height for add row button on touch devices",
  "2rem",
  "2rem",
  "Length",
  { min: 0.1, max: 10 },
);

//#################################################################################3
//#################################################################################3
//               _   _ _____ __  __       _______ _____ ____  _   _
//         /\   | \ | |_   _|  \/  |   /\|__   __|_   _/ __ \| \ | |
//        /  \  |  \| | | | | \  / |  /  \  | |    | || |  | |  \| |
//       / /\ \ | . ` | | | | |\/| | / /\ \ | |    | || |  | | . ` |
//      / ____ \| |\  |_| |_| |  | |/ ____ \| |   _| || |__| | |\  |
//     /_/    \_\_| \_|_____|_|  |_/_/    \_\_|  |_____\____/|_| \_|
const animation = theme_root.make_sub_group(
  "animation",
  "Animation",
  "Animation settings used in all list elements",
);

animation.make_variable(
  "transitionType",
  "Transition Type",
  "Type of transition used in list element animations",
  "ease-in-out",
  "ease-in-out",
  "TransitionType",
  undefined,
);

animation.make_variable(
  "transitionDuration",
  "Transition Duration",
  "Duration of transitions used in list element animations",
  "200ms",
  "200ms",
  "Time",
  { min: 0, max: 5000 },
);

//#################################################################################3
//#################################################################################3
//      ______ ____  _   _ _______
//     |  ____/ __ \| \ | |__   __|
//     | |__ | |  | |  \| |  | |
//     |  __|| |  | | . ` |  | |
//     | |   | |__| | |\  |  | |
//     |_|    \____/|_| \_|  |_|
const font = theme_root.make_sub_group(
  "font",
  "Font",
  "Font settings used in all list elements",
);

font.make_variable(
  "size",
  "Font Size",
  "Default font size used in all list elements",
  "1rem",
  "1rem",
  "Length",
  { min: 0.1, max: 10 },
);

font.make_variable(
  "touchSize",
  "Touch Font Size",
  "Font size used in all list elements for touch devices",
  "1.2rem",
  "1.2rem",
  "Length",
  { min: 0.1, max: 10 },
);
