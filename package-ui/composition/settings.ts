import { settings_init } from "#settings";
import { none, some, type Option } from "@chocbite/ts-lib/result";
import { state as st } from "@chocbite/ts-lib/state";
import { version } from "../../package.json";

const SETTINGS = settings_init(
  "@chocbite/ts-lib-composition",
  version,
  "Composition",
  "Settings for panels and windows",
);

//     __          _______ _   _ _____   ______          _______
//     \ \        / /_   _| \ | |  __ \ / __ \ \        / / ____|
//      \ \  /\  / /  | | |  \| | |  | | |  | \ \  /\  / / (___
//       \ \/  \/ /   | | | . ` | |  | | |  | |\ \/  \/ / \___ \
//        \  /\  /   _| |_| |\  | |__| | |__| | \  /\  /  ____) |
//         \/  \/   |_____|_| \_|_____/ \____/   \/  \/  |_____/
/**Where browser windows open again after a refresh of the page*/
export const WindowReopen = {
  /**As panels of the main window, with their panels*/
  Main: "main",
  /**As browser windows, the default, browsers open a window only on a click or key press of the user, so each waits for one,
   * unless the page may open popups*/
  Windows: "windows",
} as const;
export type WindowReopen = (typeof WindowReopen)[keyof typeof WindowReopen];

const WINDOW_REOPENS = st.ok(
  st.e.list<WindowReopen>({
    [WindowReopen.Main]: {
      name: "In the main window",
      description: "Windows open again as panels of the main window",
    },
    [WindowReopen.Windows]: {
      name: "In windows",
      description:
        "Windows open again as windows, one on each click or key press, as the browser allows",
    },
  }),
);

const WINDOW_REOPEN_ID = "window_reopen";
const PRIVATE_WINDOW_REOPEN = st.rosw(
  st.e.help(
    SETTINGS.get(
      WINDOW_REOPEN_ID,
      WindowReopen.Windows as WindowReopen,
      (stored: unknown): Option<WindowReopen> =>
        Object.values(WindowReopen).includes(stored as WindowReopen)
          ? some(stored as WindowReopen)
          : none(),
    ),
    { list: WINDOW_REOPENS },
  ),
  true,
);
SETTINGS.register(
  WINDOW_REOPEN_ID,
  "Windows after a refresh",
  "Whether browser windows open again in the main window or as windows after a refresh of the page",
  PRIVATE_WINDOW_REOPEN,
);

/**Where browser windows of the application manager open again after a refresh, set by the user, see WindowReopen*/
export const WINDOW_REOPEN = PRIVATE_WINDOW_REOPEN.read_write;
