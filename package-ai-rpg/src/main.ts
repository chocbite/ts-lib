import { theme_init, Themes } from "@chocbite/ts-lib-ui/theme";
import { ui_start } from "#ui";

theme_init({ system: true, default: Themes.Dark });
ui_start();
