import {
  BLUE,
  GREEN,
  GREY,
  ORANGE,
  RED,
  YELLOW,
} from "@chocbite/ts-lib/colors";
import { theme_init_variable_root } from "#theme";

const theme_root = theme_init_variable_root(
  "form",
  "UI Form Elements",
  "Theme variables for UI form Elements",
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
  "Settings for form elements in read only mode",
);
read_only.make_variable(
  "filter",
  "Read Only Filter",
  "Filter applied to form elements in read only mode",
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
  "Colors used in all form elements",
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
  "Text colors used in all form elements",
);
colors_text.make_variable(
  "label",
  "Label Color",
  "Color of form elements labels",
  GREY["700"],
  GREY["300"],
  "Color",
  undefined,
);
colors_text.make_variable(
  "normal",
  "Normal Text Color",
  "Normal text color in form elements",
  GREY["800"],
  GREY["200"],
  "Color",
  undefined,
);
colors_text.make_variable(
  "selected",
  "Selected Text Color",
  "Selected text color in form elements",
  GREY["900"],
  GREY["50"],
  "Color",
  undefined,
);
colors_text.make_variable(
  "unselected",
  "Unselected Text Color",
  "Unselected text color in form elements",
  GREY["600"],
  GREY["400"],
  "Color",
  undefined,
);

//      _______ ________   _________   ____  _               _____ _  __
//     |__   __|  ____\ \ / /__   __| |  _ \| |        /\   / ____| |/ /
//        | |  | |__   \ V /   | |    | |_) | |       /  \ | |    | ' /
//        | |  |  __|   > <    | |    |  _ <| |      / /\ \| |    |  <
//        | |  | |____ / . \   | |    | |_) | |____ / ____ \ |____| . \
//        |_|  |______/_/ \_\  |_|    |____/|______/_/    \_\_____|_|\_\
//
//
const colors_text_black = colors.make_sub_group(
  "textBlack",
  "Text Colors Black Background",
  "Text colors used for black background in all form elements",
);
colors_text_black.make_variable(
  "normal",
  "Normal Text Color",
  "Normal text color in form elements",
  GREY["200"],
  GREY["200"],
  "Color",
  undefined,
);
colors_text_black.make_variable(
  "selected",
  "Selected Text Color",
  "Selected text color in form elements",
  GREY["50"],
  GREY["50"],
  "Color",
  undefined,
);
colors_text_black.make_variable(
  "unselected",
  "Unselected Text Color",
  "Unselected text color in form elements",
  GREY["600"],
  GREY["400"],
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
  "normal",
  "Normal Icon Color",
  "Color of icons in form elements",
  GREY["800"],
  GREY["200"],
  "Color",
  undefined,
);
colors_icon.make_variable(
  "selected",
  "Selected Icon Color",
  "Color of selected icons in form elements",
  GREY["900"],
  GREY["50"],
  "Color",
  undefined,
);
colors_icon.make_variable(
  "unselected",
  "Unselected Icon Color",
  "Color of unselected icons in form elements",
  GREY["600"],
  GREY["400"],
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
  "Background colors used in all form elements",
);
colors_background.make_variable(
  "normal",
  "Normal Background Color",
  "Color of normal form element backgrounds",
  GREY["50"],
  GREY["900"],
  "Color",
  undefined,
);
colors_background.make_variable(
  "hover",
  "Hover Background Color",
  "Color of form element backgrounds when hovering",
  GREY["400"],
  GREY["700"],
  "Color",
  undefined,
);
colors_background.make_variable(
  "unselected",
  "Unselected Background Color",
  "Color of unselected form element backgrounds",
  GREY["300"],
  GREY["800"],
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
  "Border colors used in all form elements",
);
colors_border.make_variable(
  "normal",
  "Normal Border Color",
  "Color of normal form element borders",
  GREY["700"],
  GREY["300"],
  "Color",
  undefined,
);
colors_border.make_variable(
  "unselected",
  "Unselected Border Color",
  "Color of unselected form element borders",
  GREY["700"],
  GREY["300"],
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
  "Focus colors used in all form elements",
);
colors_focus.make_variable(
  "normal",
  "Focus Color",
  "Color of focussed form element",
  ORANGE["600"],
  ORANGE["300"],
  "Color",
  undefined,
);

//      ____           _____ _____ _____    _____ ____  _      ____  _____   _____
//     |  _ \   /\    / ____|_   _/ ____|  / ____/ __ \| |    / __ \|  __ \ / ____|
//     | |_) | /  \  | (___   | || |      | |   | |  | | |   | |  | | |__) | (___
//     |  _ < / /\ \  \___ \  | || |      | |   | |  | | |   | |  | |  _  / \___ \
//     | |_) / ____ \ ____) |_| || |____  | |___| |__| | |___| |__| | | \ \ ____) |
//     |____/_/    \_\_____/|_____\_____|  \_____\____/|______\____/|_|  \_\_____/
const colors_basic = colors.make_sub_group(
  "basic",
  "Basic Colors",
  "Basic colors used in all form elements",
);
colors_basic.make_variable(
  "black",
  "Basic Black Color",
  "Commonly used black color in form elements",
  GREY["900"],
  GREY["900"],
  "Color",
  undefined,
);
colors_basic.make_variable(
  "white",
  "Basic White Color",
  "Commonly used white color in form elements",
  GREY["100"],
  GREY["100"],
  "Color",
  undefined,
);
colors_basic.make_variable(
  "green",
  "Basic Green Color",
  "Commonly used green color in form elements",
  GREEN["300"],
  GREEN["900"],
  "Color",
  undefined,
);
colors_basic.make_variable(
  "red",
  "Basic Red Color",
  "Commonly used red color in form elements",
  RED["300"],
  RED["900"],
  "Color",
  undefined,
);
colors_basic.make_variable(
  "blue",
  "Basic Blue Color",
  "Commonly used blue color in form elements",
  BLUE["300"],
  BLUE["900"],
  "Color",
  undefined,
);
colors_basic.make_variable(
  "yellow",
  "Basic Yellow Color",
  "Commonly used yellow color in form elements",
  YELLOW["300"],
  ORANGE["900"],
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
  "Sizes used in all form elements",
);

sizes.make_variable(
  "height",
  "Height",
  "Default height used in all form elements",
  "1.3rem",
  "1.3rem",
  "Length",
  { min: 0.1, max: 10 },
);

sizes.make_variable(
  "touchHeight",
  "Touch Height",
  "Minimum height for touch devices used in all form elements",
  "2.0rem",
  "2.0rem",
  "Length",
  { min: 0.1, max: 10 },
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
  "Font settings used in all form elements",
);

font.make_variable(
  "size",
  "Font Size",
  "Default font size used in all form elements",
  "0.9rem",
  "0.9rem",
  "Length",
  { min: 0.1, max: 10 },
);

font.make_variable(
  "touch_size",
  "Touch Font Size",
  "Font size used in all form elements for touch devices",
  "1.1rem",
  "1.1rem",
  "Length",
  { min: 0.1, max: 10 },
);
