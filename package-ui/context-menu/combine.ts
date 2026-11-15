import result, { none, some, type Option } from "@chocbite/ts-lib/result";
import { context_devider } from "./devider";
import type { ContextMenuLine } from "./line";
import { context_menu, ContextMenu } from "./menu";

type Lines = (ContextMenuLine | undefined)[];

/**A group for ctm.combine, undefined for no group
 * - lines, undefined lines are skipped like in ctm.menu
 * - a menu, its lines are taken when the combined menu opens
 * - a function called every time the combined menu opens, giving lines, a menu, or an option of a menu like ctm.attach takes*/
export type ContextMenuGroup =
  | Lines
  | ContextMenu
  | (() => Lines | ContextMenu | Option<ContextMenu>)
  | undefined;

function group_lines(group: ContextMenuGroup): Lines | Promise<Lines> {
  let value = typeof group === "function" ? group() : group;
  if (result.is_option(value)) value = value.unwrap_or(undefined);
  if (value instanceof ContextMenu) return value.read_lines();
  return value ?? [];
}

/**Joins groups with a devider between those with lines */
function join(groups: Lines[]): ContextMenuLine[] {
  const lines: ContextMenuLine[] = [];
  for (const group of groups) {
    const group_lines = group.filter((line) => line !== undefined);
    if (group_lines.length === 0) continue;
    if (lines.length) lines.push(context_devider());
    lines.push(...group_lines);
  }
  return lines;
}

/**Combines groups of lines and menus into one menu with a devider between groups, built every time the menu opens
 * Empty groups are left out with their devider, and when all groups are empty there is no menu
 * A group with promised lines makes the combined menu wait for all groups, showing a spinner, it then always opens
 * Give the result to ctm.attach, or anything else taking a menu factory
 * @param groups groups in menu order, see ContextMenuGroup*/
export function context_combine(
  ...groups: ContextMenuGroup[]
): () => Option<ContextMenu> {
  return () => {
    const parts = groups.map(group_lines);
    if (parts.some((part) => part instanceof Promise))
      return some(
        context_menu(
          Promise.all(parts.map((part) => Promise.resolve(part))).then(join),
        ),
      );
    const lines = join(parts as Lines[]);
    return lines.length ? some(context_menu(lines)) : none();
  };
}
