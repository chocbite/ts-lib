import { context_combine } from "./combine";
import { context_divider } from "./divider";
import {
  context_menu_attach,
  context_menu_default,
  context_menu_detach,
  context_menu_summon,
  CONTEXT_MENU_SYMBOL,
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
    return Boolean(element[CONTEXT_MENU_SYMBOL]);
  },
  menu: context_menu,
  line: context_line,
  sub: context_sub,
  divider: context_divider,
  combine: context_combine,
};
export default ctm;

export type { ContextMenuGroup } from "./combine";
export type { ContextMenuDivider } from "./divider";
export type { ContextMenuSummonOptions } from "./engine";
export type { ContextMenuLabelOptions, ContextMenuLine } from "./line";
export type {
  ContextMenu,
  ContextMenuLines,
  ContextMenuLinesInput,
} from "./menu";
export type { ContextMenuOption, ContextMenuOptionOptions } from "./option";
export type { ContextMenuSub, ContextMenuSubOptions } from "./submenu";
