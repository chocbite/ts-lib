import list from "#list";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { list_scroll_to } from "./helpers";
import { UNICODE_BLOCKS } from "./unicode_blocks";
import { UNICODE_EMOJI } from "./unicode_emoji";

/**What the character picker shows the characters of, a Unicode block by its code points, or a subgroup of emoji*/
export type UnicodeBlock =
  | {
      readonly name: string;
      /**First code point*/
      readonly start: number;
      /**Last code point*/
      readonly end: number;
    }
  | {
      readonly name: string;
      /**The emoji separated by spaces, an emoji can be several code points*/
      readonly emoji: string;
    };

/**A row of the list of blocks, a group or a block*/
interface BlockRow {
  key: string;
  text: string;
  block?: UnicodeBlock;
  open?: boolean;
  children?: BlockRow[];
}

//Characters that are not typed, control, format, surrogate, private use and unassigned,
//by the Unicode version of the browser, so a block newer than the browser has no characters
const NOT_TYPED = /\p{C}/u;

const CHARACTERS = new Map<UnicodeBlock, readonly string[]>();

/**The characters of the block the browser knows, the ones that can be typed*/
export function unicode_block_characters(
  block: UnicodeBlock,
): readonly string[] {
  let characters = CHARACTERS.get(block);
  if (characters) return characters;
  if ("emoji" in block) {
    characters = block.emoji.split(" ");
    CHARACTERS.set(block, characters);
    return characters;
  }
  const found: string[] = [];
  for (let code = block.start; code <= block.end; code++) {
    const char = String.fromCodePoint(code);
    if (!NOT_TYPED.test(char)) found.push(char);
  }
  characters = found;
  CHARACTERS.set(block, characters);
  return characters;
}

const BLOCKS: readonly UnicodeBlock[] = UNICODE_BLOCKS.map(
  ([name, start, end]) => ({ name, start, end }),
);

/**A subgroup name of Unicode, like face-smiling, as Face smiling*/
const subgroup_name = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");

/**The emoji, by group and subgroup in the order of Unicode, a group is a block too, with the emoji of all its subgroups*/
const EMOJI_GROUPS = UNICODE_EMOJI.map(([group, subgroups]) => ({
  block: {
    name: group,
    emoji: subgroups.map(([, emoji]) => emoji).join(" "),
  },
  subgroups: subgroups.map(([name, emoji]): UnicodeBlock => ({
    name: subgroup_name(name),
    emoji,
  })),
}));

/**The block shown first, until another is chosen, the emoji of Smileys & Emotion*/
export const UNICODE_FIRST_BLOCK: UnicodeBlock = EMOJI_GROUPS[0].block;

/**Whether the row is the block or holds it*/
const holds = (row: BlockRow, block: UnicodeBlock): boolean =>
  row.block === block || Boolean(row.children?.some((c) => holds(c, block)));

/**The emoji by group and subgroup, a group choosing all its emoji, then the blocks in two groups, symbols and scripts, each by name,
 * the groups holding the current block open*/
function rows_of(current: UnicodeBlock): BlockRow[] {
  const group = (key: string, text: string, script: 0 | 1): BlockRow => {
    const children = UNICODE_BLOCKS.flatMap(([, , , s], i) =>
      s === script
        ? [
            {
              key: `${key}/${BLOCKS[i].name}`,
              text: BLOCKS[i].name,
              block: BLOCKS[i],
            },
          ]
        : [],
    ).sort((a, b) => a.text.localeCompare(b.text));
    return {
      key,
      text,
      open: children.some((c) => c.block === current),
      children,
    };
  };
  const emoji_groups = EMOJI_GROUPS.map((g): BlockRow => ({
    key: `emoji/${g.block.name}`,
    text: g.block.name,
    block: g.block,
    children: g.subgroups.map((block) => ({
      key: `emoji/${g.block.name}/${block.name}`,
      text: block.name,
      block,
    })),
  }));
  const emoji: BlockRow = {
    key: "emoji",
    text: "Emoji",
    children: emoji_groups,
  };
  //A group is open when it holds the current block in a subgroup, not when it is the current block
  for (const row of [emoji, ...emoji_groups])
    row.open = row.children!.some((c) => holds(c, current));
  return [
    emoji,
    group("symbols", "Symbols", 0),
    group("scripts", "Scripts", 1),
  ];
}

/**The list of Unicode blocks and emoji subgroups, choosing one calls the function with it*/
export function unicode_block_list(
  current: UnicodeBlock,
  chosen: (block: UnicodeBlock) => void,
): HTMLElement {
  const rows = rows_of(current);
  const flat = (row: BlockRow): BlockRow[] => [
    row,
    ...(row.children ?? []).flatMap(flat),
  ];
  const all = new Map(rows.flatMap(flat).map((r) => [r.key, r]));
  const selected = state.ok_w(
    [...all.values()].filter((r) => r.block === current).map((r) => r.key),
  );
  selected.sub((keys) => {
    const block = all.get(keys.value[0])?.block;
    if (block) chosen(block);
  });
  const container = list.container(
    {
      transform: (row: BlockRow) =>
        ok({
          values: {},
          key_field: { text: row.text },
          openable: Boolean(row.children),
          opened: row.open,
          sub_rows: () => row.children ?? [],
          selectable: row.block !== undefined,
        }),
      sub_rows: true,
      headless: true,
      selection: { mode: "single", key: (row: BlockRow) => row.key },
    },
    { columns: {}, rows, selected },
  );
  list_scroll_to(container, current.name);
  return container;
}
