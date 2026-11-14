//Theme variables of the game, the library applies the light or dark value, used in style.scss as var(--rpg-<id>)
import { theme_init_variable_root } from "@chocbite/ts-lib-ui/theme";

const VARIABLES = theme_init_variable_root("rpg", "AI RPG", "Colors of the game");
VARIABLES.make_variable("panel", "Panel", "Background of panels", "#f4f4f4", "#1e1f22", "Color", undefined);
VARIABLES.make_variable("panelText", "Panel text", "Text in panels", "#1a1a1a", "#e6e6e6", "Color", undefined);
