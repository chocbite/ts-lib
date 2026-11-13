import {
  material_dark_mode_rounded,
  material_edit_rounded,
  material_light_mode_rounded,
  material_mouse_rounded,
  material_touch_app_rounded,
} from "#icons";
import { settings_init } from "#settings";
import { none, ok, some, type Option } from "@chocbite/ts-lib/result";
import { state as st } from "@chocbite/ts-lib/state";
import { version } from "../../package.json";

const SETTINGS = settings_init(
  "@chocbite/ts-lib-theme",
  version,
  "Theme/UI",
  "Settings for UI elements and color themes",
);

/**Accepts a stored setting only when it is one of the given values, otherwise the default is used*/
const one_of =
  <T>(values: { [key: string]: T }) =>
  (stored: unknown): Option<T> =>
    Object.values(values).includes(stored as T) ? some(stored as T) : none();

/**Accepts a stored setting only when it is a number within the range, otherwise the default is used*/
const in_range =
  (min: number, max: number) =>
  (stored: unknown): Option<number> =>
    typeof stored === "number" && stored >= min && stored <= max
      ? some(stored)
      : none();

//      _______ _    _ ______ __  __ ______
//     |__   __| |  | |  ____|  \/  |  ____|
//        | |  | |__| | |__  | \  / | |__
//        | |  |  __  |  __| | |\/| |  __|
//        | |  | |  | | |____| |  | | |____
//        |_|  |_|  |_|______|_|  |_|______|
export const Themes = {
  Light: "light",
  Dark: "dark",
  /**Follows the light or dark mode of the operating system, only offered when theme_init enables system*/
  System: "system",
} as const;
export type Themes = (typeof Themes)[keyof typeof Themes];
/**Themes that can be applied to the page, System is resolved to one of these*/
export type AppliedThemes = typeof Themes.Light | typeof Themes.Dark;

type ThemeList = Parameters<typeof st.e.list<Themes>>[0];
const LIGHT = {
  name: "Light",
  description: "Theme optimized for daylight",
  icon: material_light_mode_rounded,
};
const DARK = {
  name: "Dark",
  description: "Theme optimized for night time",
  icon: material_dark_mode_rounded,
};
/**Theme choices, the System choice shows the theme the operating system currently uses
 * @param system theme of the operating system, undefined when the System choice is not offered*/
const theme_list = (system?: AppliedThemes): ThemeList => {
  const list: Partial<ThemeList> = {
    [Themes.Light]: LIGHT,
    [Themes.Dark]: DARK,
  };
  if (system) {
    const active = system === Themes.Dark ? DARK : LIGHT;
    list[Themes.System] = {
      name: "System (" + active.name + ")",
      description: "Follows the light or dark mode of the operating system",
      icon: active.icon,
    };
  }
  return list as ThemeList;
};
const THEMES = st.ok_w(theme_list());

const THEME_ID = "theme";
/**Theme the user chose, undefined when nothing has been chosen yet*/
const STORED_THEME = SETTINGS.get<Themes | undefined>(
  THEME_ID,
  undefined,
  one_of(Themes),
).value;
const PRIVATE_THEME = st.rosw(
  st.e.help(ok(STORED_THEME ?? (Themes.Light as Themes)), { list: THEMES }),
  true,
);

export const THEME = PRIVATE_THEME.read_write;

/**Sets up the theme setting, called once by theme_init
 * @param system theme of the operating system, undefined when the System choice is not offered
 * @param default_theme theme used when the user has not chosen one*/
export function theme_setting_init(
  system: AppliedThemes | undefined,
  default_theme: Themes,
) {
  if (system) THEMES.set_ok(theme_list(system));
  //Set before registering, so the default is not stored as if the user chose it
  if (STORED_THEME === undefined || (STORED_THEME === Themes.System && !system))
    PRIVATE_THEME.set_ok(default_theme);
  SETTINGS.register(
    THEME_ID,
    "Theme",
    "Theme to use for the UI",
    PRIVATE_THEME,
  );
}

/**Updates the System choice to show the theme the operating system uses*/
export function theme_setting_system(system: AppliedThemes) {
  THEMES.set_ok(theme_list(system));
}

//       _____  _____          _      ______
//      / ____|/ ____|   /\   | |    |  ____|
//     | (___ | |       /  \  | |    | |__
//      \___ \| |      / /\ \ | |    |  __|
//      ____) | |____ / ____ \| |____| |____
//     |_____/ \_____/_/    \_\______|______|
const SCALE_ID = "scale";
const PRIVATE_SCALE = st.rosw(
  st.n.help(SETTINGS.get(SCALE_ID, 100, in_range(50, 400)), {
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
  st.e.help(
    SETTINGS.get(
      SCROLLBAR_ID,
      ScrollbarModes.Thin as ScrollbarModes,
      one_of(ScrollbarModes),
    ),
    { list: SCROLLBAR_MODES },
  ),
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
      one_of(InputModes),
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
    SETTINGS.get(
      ANIMATION_LEVEL_ID,
      AnimationLevels.None as AnimationLevels,
      one_of(AnimationLevels),
    ),
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
  st.n.help(SETTINGS.get(ANIMATION_SPEED_ID, 200, in_range(50, 1000)), {
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
