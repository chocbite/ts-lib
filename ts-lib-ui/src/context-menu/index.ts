import { context_devider } from "./devider";
import {
  context_menu_attach,
  context_menu_default,
  context_menu_detach,
  context_menu_summon,
  CONTEXT_MENY_SYMBOL,
} from "./engine";
import { context_menu } from "./menu";
import { context_line } from "./option";
import { context_sub } from "./submenu";

export const ctm = {
  attach: context_menu_attach,
  default: context_menu_default,
  detach: context_menu_detach,
  summon: context_menu_summon,
  has(element: Element) {
    return Boolean(element[CONTEXT_MENY_SYMBOL]);
  },
  menu: context_menu,
  line: context_line,
  sub: context_sub,
  devider: context_devider,
};
export default ctm;

export type { ContextMenu, ContextMenuLines } from "./menu";
