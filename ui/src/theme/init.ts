import { theme_engine } from "./engine";
import {
  theme_setting_init,
  theme_setting_system,
  Themes,
  type AppliedThemes,
} from "./settings";

export interface ThemeInitOptions {
  /**Offers a System theme that follows the light or dark mode of the operating system,
   * leave it off on devices without that feature*/
  system?: boolean;
  /**Theme used until the user chooses one, defaults to System when system is on, otherwise Light*/
  default?: Themes;
}

let initialized = false;

/**Starts the theme, the app must call it once, nothing of the theme is applied to the page before.
 * This is the only place the operating system dark mode is read, and only when system is on*/
export function theme_init(options: ThemeInitOptions = {}) {
  const default_theme =
    options.default ?? (options.system ? Themes.System : Themes.Light);
  if (default_theme === Themes.System && !options.system)
    throw new Error("The System theme can only be the default with system on");
  if (initialized) throw new Error("theme_init has already been called");
  initialized = true;
  let os_theme: AppliedThemes | undefined;
  if (options.system) {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const theme_of = (dark: boolean) => (dark ? Themes.Dark : Themes.Light);
    os_theme = theme_of(query.matches);
    theme_engine.set_os_theme(os_theme);
    query.addEventListener("change", (e) => {
      const changed = theme_of(e.matches);
      theme_setting_system(changed);
      theme_engine.set_os_theme(changed);
    });
  }
  theme_setting_init(os_theme, default_theme);
  theme_engine.start();
}
