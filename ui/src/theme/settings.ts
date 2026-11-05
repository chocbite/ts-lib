import {
  material_dark_mode_rounded,
  material_edit_rounded,
  material_light_mode_rounded,
  material_mouse_rounded,
  material_touch_app_rounded,
} from "#icons";
import { settings_init } from "#settings";
import { state as st } from "@chocbite/ts-lib/state";
import { version } from "../../package.json";

const SETTINGS = settings_init(
  "@chocbite/ts-lib-theme",
  version,
  "Theme/UI",
  "Settings for UI elements and color themes",
);

//      _______ _    _ ______ __  __ ______
//     |__   __| |  | |  ____|  \/  |  ____|
//        | |  | |__| | |__  | \  / | |__
//        | |  |  __  |  __| | |\/| |  __|
//        | |  | |  | | |____| |  | | |____
//        |_|  |_|  |_|______|_|  |_|______|
export const Themes = {
  Light: "light",
  Dark: "dark",
} as const;
export type Themes = (typeof Themes)[keyof typeof Themes];

const THEMES = st.ok(
  st.e.list<Themes>({
    [Themes.Light]: {
      name: "Light",
      description: "Theme optimized for daylight",
      icon: material_light_mode_rounded,
    },
    [Themes.Dark]: {
      name: "Dark",
      description: "Theme optimized for night time",
      icon: material_dark_mode_rounded,
    },
  }),
);

const THEME_ID = "theme";
const PRIVATE_THEME = st.rosw(
  st.e.help(
    SETTINGS.get(
      THEME_ID,
      window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? (Themes.Dark as Themes)
        : (Themes.Light as Themes),
    ),
    { list: THEMES },
  ),
  true,
);
SETTINGS.register(THEME_ID, "Theme", "Theme to use for the UI", PRIVATE_THEME);

export const THEME = PRIVATE_THEME.read_write;

//Sets up automatic theme change based on operating system
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    PRIVATE_THEME.write(e.matches ? Themes.Dark : Themes.Light);
  });

//       _____  _____          _      ______
//      / ____|/ ____|   /\   | |    |  ____|
//     | (___ | |       /  \  | |    | |__
//      \___ \| |      / /\ \ | |    |  __|
//      ____) | |____ / ____ \| |____| |____
//     |_____/ \_____/_/    \_\______|______|
const SCALE_ID = "scale";
const PRIVATE_SCALE = st.rosw(
  st.n.help(SETTINGS.get(SCALE_ID, 100), {
    min: st.ok(50),
    max: st.ok(400),
    unit: st.ok("%"),
    start: st.ok(0),
    step: st.ok(1),
  }),
  true,
);
SETTINGS.register(SCALE_ID, "Scale", "UI scale", PRIVATE_SCALE);
export const SCALE = PRIVATE_SCALE.read_write;

//       _____  _____ _____   ____  _      _      ____          _____
//      / ____|/ ____|  __ \ / __ \| |    | |    |  _ \   /\   |  __ \
//     | (___ | |    | |__) | |  | | |    | |    | |_) | /  \  | |__) |
//      \___ \| |    |  _  /| |  | | |    | |    |  _ < / /\ \ |  _  /
//      ____) | |____| | \ \| |__| | |____| |____| |_) / ____ \| | \ \
//     |_____/ \_____|_|  \_\\____/|______|______|____/_/    \_\_|  \_\
export const ScrollbarModes = {
  Thin: "thin",
  Medium: "medium",
  Wide: "wide",
} as const;
export type ScrollbarModes =
  (typeof ScrollbarModes)[keyof typeof ScrollbarModes];

const SCROLLBAR_MODES = st.ok(
  st.e.list<ScrollbarModes>({
    [ScrollbarModes.Thin]: {
      name: "Thin",
      description: "Thin modern scrollbar",
    },
    [ScrollbarModes.Medium]: {
      name: "Medium",
      description: "Normal scrollbar",
    },
    [ScrollbarModes.Wide]: {
      name: "Wide",
      description: "Large touch friendly scrollbar",
    },
  }),
);

const SCROLLBAR_ID = "scrollbar";
const PRIVATE_SCROLLBAR_MODE = st.rosw(
  st.e.help(SETTINGS.get(SCROLLBAR_ID, ScrollbarModes.Thin as ScrollbarModes), {
    list: SCROLLBAR_MODES,
  }),
  true,
);
SETTINGS.register(
  "scrollbar",
  "Scrollbar Mode",
  "Size of the scrollbar to use",
  PRIVATE_SCROLLBAR_MODE,
);

export const SCROLLBAR_MODE = PRIVATE_SCROLLBAR_MODE.read_write;

//      _____ _   _ _____  _    _ _______   __  __  ____  _____  ______
//     |_   _| \ | |  __ \| |  | |__   __| |  \/  |/ __ \|  __ \|  ____|
//       | | |  \| | |__) | |  | |  | |    | \  / | |  | | |  | | |__
//       | | | . ` |  ___/| |  | |  | |    | |\/| | |  | | |  | |  __|
//      _| |_| |\  | |    | |__| |  | |    | |  | | |__| | |__| | |____
//     |_____|_| \_|_|     \____/   |_|    |_|  |_|\____/|_____/|______|
export const InputModes = {
  Mouse: "mouse",
  Pen: "pen",
  Touch: "touch",
} as const;
export type InputModes = (typeof InputModes)[keyof typeof InputModes];

const INPUT_MODES = st.ok(
  st.e.list<InputModes>({
    [InputModes.Mouse]: {
      name: "Mouse",
      description: "Mouse input",
      icon: material_mouse_rounded,
    },
    [InputModes.Pen]: {
      name: "Pen",
      description: "Pen input",
      icon: material_edit_rounded,
    },
    [InputModes.Touch]: {
      name: "Touch",
      description: "Touch input",
      icon: material_touch_app_rounded,
    },
  }),
);

const INPUT_MODE_ID = "input_mode";
const PRIVATE_INPUT_MODE = st.rosw(
  st.e.help(
    SETTINGS.get(
      INPUT_MODE_ID,
      matchMedia("(pointer: coarse)").matches
        ? InputModes.Touch
        : (InputModes.Mouse as InputModes),
    ),
    { list: INPUT_MODES },
  ),
  true,
);
SETTINGS.register(
  INPUT_MODE_ID,
  "Input Mode",
  "Setting for preffered input mode, changes UI elements to be more optimized for the selected input mode",
  PRIVATE_INPUT_MODE,
);

export const INPUT_MODE = PRIVATE_INPUT_MODE.read_write;

//               _   _ _____ __  __       _______ _____ ____  _   _   _      ________      ________ _
//         /\   | \ | |_   _|  \/  |   /\|__   __|_   _/ __ \| \ | | | |    |  ____\ \    / /  ____| |
//        /  \  |  \| | | | | \  / |  /  \  | |    | || |  | |  \| | | |    | |__   \ \  / /| |__  | |
//       / /\ \ | . ` | | | | |\/| | / /\ \ | |    | || |  | | . ` | | |    |  __|   \ \/ / |  __| | |
//      / ____ \| |\  |_| |_| |  | |/ ____ \| |   _| || |__| | |\  | | |____| |____   \  /  | |____| |____
//     /_/    \_\_| \_|_____|_|  |_/_/    \_\_|  |_____\____/|_| \_| |______|______|   \/   |______|______|
export const AnimationLevels = {
  All: "all",
  Some: "some",
  None: "none",
} as const;
export type AnimationLevels =
  (typeof AnimationLevels)[keyof typeof AnimationLevels];

const ANIMATION_LEVELS = st.ok(
  st.e.list<AnimationLevels>({
    [AnimationLevels.All]: { name: "All", description: "All animations" },
    [AnimationLevels.Some]: {
      name: "Functional",
      description: "Only functional animations that improve usability",
    },
    [AnimationLevels.None]: { name: "None", description: "No animations" },
  }),
);

const ANIMATION_LEVEL_ID = "animation_level";
const PRIVATE_ANIMATION_LEVEL = st.rosw(
  st.e.help(
    SETTINGS.get(ANIMATION_LEVEL_ID, AnimationLevels.None as AnimationLevels),
    { list: ANIMATION_LEVELS },
  ),
  true,
);
SETTINGS.register(
  ANIMATION_LEVEL_ID,
  "Animation Level",
  "Setting for animation level, changes the amount of animations used in the UI",
  PRIVATE_ANIMATION_LEVEL,
);

export const ANIMATION_LEVEL = PRIVATE_ANIMATION_LEVEL.read_write;

//               _   _ _____ __  __       _______ _____ ____  _   _    _____ _____  ______ ______ _____
//         /\   | \ | |_   _|  \/  |   /\|__   __|_   _/ __ \| \ | |  / ____|  __ \|  ____|  ____|  __ \
//        /  \  |  \| | | | | \  / |  /  \  | |    | || |  | |  \| | | (___ | |__) | |__  | |__  | |  | |
//       / /\ \ | . ` | | | | |\/| | / /\ \ | |    | || |  | | . ` |  \___ \|  ___/|  __| |  __| | |  | |
//      / ____ \| |\  |_| |_| |  | |/ ____ \| |   _| || |__| | |\  |  ____) | |    | |____| |____| |__| |
//     /_/    \_\_| \_|_____|_|  |_/_/    \_\_|  |_____\____/|_| \_| |_____/|_|    |______|______|_____/
const ANIMATION_SPEED_ID = "animation_speed";
const PRIVATE_ANIMATION_SPEED = st.rosw(
  st.n.help(SETTINGS.get(ANIMATION_SPEED_ID, 200), {
    min: st.ok(50),
    max: st.ok(1000),
    unit: st.ok("ms"),
    start: st.ok(0),
    step: st.ok(50),
  }),
  true,
);
SETTINGS.register(
  ANIMATION_SPEED_ID,
  "Animation Speed",
  "Setting for animation speed, changes the speed of animations in the UI",
  PRIVATE_ANIMATION_SPEED,
);

export const ANIMATION_SPEED = PRIVATE_ANIMATION_SPEED.read_write;
