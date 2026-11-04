import { settings_init } from "#settings";
import { state as st } from "@chocbite/ts-lib/state";
import { name, version } from "../../package.json";

const SETTINGS = settings_init(
  `${name}/keyboard`,
  version,
  "Keyboard",
  "Settings for virtual keyboard",
);

const THEME_ID = "virtual_keyboard";
const PRIVATE_VIRTUAL_KEYBOARD = st.rosw(SETTINGS.get(THEME_ID, false), true);
SETTINGS.register(
  THEME_ID,
  "Virtual Keyboard",
  "Enable or disable the virtual keyboard",
  PRIVATE_VIRTUAL_KEYBOARD,
);
export const VIRTUAL_KEYBOARD = PRIVATE_VIRTUAL_KEYBOARD.read_write;
