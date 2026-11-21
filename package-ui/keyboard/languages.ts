import { CLDR_DEAD_KEYS, CLDR_LAYOUTS } from "./cldr_layouts";
import { KEYBOARD_LANGUAGE } from "./settings";
import {
  KeyboardConfig,
  KeyboardKeyConfig,
  KeyboardLayerConfig,
  KeyboardSpecialKeys,
} from "./types";

/**Keys of a layer, the number row from the key left of 1, then the three letter rows from the key right of tab, caps lock and left shift
 * An empty string is a position without a key*/
export type CldrRows = readonly (readonly string[])[];

/**What a layout is and where it is used, without its keys*/
export interface CldrLayoutInfo {
  /**The locale of the layout, with a variant like -extended after it*/
  readonly id: string;
  /**English name of the layout, from Windows*/
  readonly name: string;
  /**The countries the layout is used in*/
  readonly territories: readonly string[];
}

/**A keyboard layout from Unicode CLDR*/
export interface CldrLayout extends CldrLayoutInfo {
  readonly default: CldrRows;
  readonly shift?: CldrRows;
  readonly altgr?: CldrRows;
  /**What a dead key followed by a key types, by the two of them, like "´e" to "é"*/
  readonly dead_keys?: { readonly [keys: string]: string };
}

//The layouts are stored as one string each, which loads much faster than arrays,
//only the information is split at load, the keys when a layout is used
interface Entry extends CldrLayoutInfo {
  readonly index: number;
}

/**All layouts, without their keys, sorted by id*/
export const KEYBOARD_LAYOUTS: readonly CldrLayoutInfo[] = CLDR_LAYOUTS.map(
  (data, index): Entry => {
    const [id, name, territories] = data.split("\f", 3);
    return { id, name, territories: territories.split(","), index };
  },
);

const BY_ID = new Map(KEYBOARD_LAYOUTS.map((l) => [l.id, l as Entry]));
const DECODED = new Map<string, CldrLayout>();

function decode(entry: Entry): CldrLayout {
  let layout = DECODED.get(entry.id);
  if (layout) return layout;
  const fields = CLDR_LAYOUTS[entry.index].split("\f");
  const [base, shift, altgr] = fields[4]
    .split("\v")
    .map((layer) =>
      layer ? layer.split("\n").map((row) => row.split("\t")) : undefined,
    );
  const dead = fields[3] === "" ? undefined : CLDR_DEAD_KEYS[Number(fields[3])];
  layout = {
    id: entry.id,
    name: entry.name,
    territories: entry.territories,
    default: base ?? [],
    ...(shift && { shift }),
    ...(altgr && { altgr }),
    ...(dead && {
      dead_keys: Object.fromEntries(
        dead.split("\n").map((pair) => pair.split("\t") as [string, string]),
      ),
    }),
  };
  DECODED.set(entry.id, layout);
  return layout;
}

const FALLBACK = "en";

/**Whether the layout is a variant, like da-extended or en-dvorak, variant subtags are lower case unlike scripts and regions*/
const is_variant = (layout: CldrLayoutInfo) =>
  layout.id
    .split("-")
    .slice(1)
    .some((s) => /^([a-z]|\d+[a-z])/.test(s));

/**The layout with the id, like "da" or "de-CH"*/
export function keyboard_layout(id: string): CldrLayout | undefined {
  const entry = BY_ID.get(id);
  return entry && decode(entry);
}

/**The layout for the languages, the first that has one, like navigator.languages
 * A language with a region, like de-CH, takes the layout of the region if there is one,
 * then a layout of an official language of the region, as en-DK is typed on a Danish keyboard,
 * then the layout of the language without the region, English (US) when none of the languages has one*/
export function keyboard_layout_for(languages: readonly string[]): CldrLayout {
  return decode(BY_ID.get(layout_id_for(languages))!);
}

function layout_id_for(languages: readonly string[]): string {
  for (const tag of languages) {
    const exact = BY_ID.get(tag);
    if (exact) return exact.id;
    const [language, ...subtags] = tag.split("-");
    const region = subtags.find((s) => /^[A-Z]{2}$/i.test(s))?.toUpperCase();
    if (region) {
      const of_region = KEYBOARD_LAYOUTS.filter(
        (l) => l.territories.includes(region) && !is_variant(l),
      );
      const found =
        of_region.find((l) => l.id.split("-")[0] === language) ??
        //A layout made for the region, like de-CH for Switzerland, before the layouts of languages used in many countries
        of_region.find((l) => l.id.endsWith("-" + region)) ??
        [...of_region].sort(
          (a, b) => a.territories.length - b.territories.length,
        )[0];
      if (found) return found.id;
    }
    if (BY_ID.has(language)) return language;
  }
  return FALLBACK;
}

/**The layout following the browser, used while KEYBOARD_LANGUAGE is empty*/
export function keyboard_layout_auto(): CldrLayout {
  return keyboard_layout_for(
    typeof navigator === "undefined" ? [] : navigator.languages,
  );
}

/**The layout the text keyboard uses, KEYBOARD_LANGUAGE, or the layout following the browser when it is empty or unknown*/
export const KEYBOARD_LAYOUT = KEYBOARD_LANGUAGE.proxy_map(
  (id) => keyboard_layout(id) ?? keyboard_layout_auto(),
);

//      _  __________     ______   ____          _____  _____
//     | |/ /  ____\ \   / /  _ \ / __ \   /\   |  __ \|  __ \
//     | ' /| |__   \ \_/ /| |_) | |  | | /  \  | |__) | |  | |
//     |  < |  __|   \   / |  _ <| |  | |/ /\ \ |  _  /| |  | |
//     | . \| |____   | |  | |_) | |__| / ____ \| | \ \| |__| |
//     |_|\_\______|  |_|  |____/ \____/_/    \_\_|  \_\_____/
//The keys are 4 columns wide, the rows are 60 columns, the letter rows are staggered like a real keyboard
const KEY = 4;
const WIDTH = 60;
const LEFT = [0, 6, 7, 5];

/**What a key types when held, by the key: its AltGr character, then the letters of the dead keys on it, like é è ê ë on e*/
type Holds = Map<string, string[]>;

function holds_of(layout: CldrLayout): Holds {
  const holds: Holds = new Map();
  const add = (key: string, alternative: string) => {
    if (!key || !alternative || key === alternative) return;
    const list = holds.get(key) ?? [];
    if (!list.includes(alternative)) holds.set(key, [...list, alternative]);
  };
  for (const layer of [layout.default, layout.shift])
    layer?.forEach((row, r) =>
      row.forEach((key, k) => add(key, layout.altgr?.[r]?.[k] ?? "")),
    );
  //The letters of the dead keys in the same order on every layout, the most common accents first
  const letters = Object.entries(layout.dead_keys ?? {})
    .map(([keys, typed]) => ({ base: [...keys].pop()!, typed }))
    .filter(({ base }) => base !== " ")
    .map((letter, index) => ({
      ...letter,
      rank: accent_rank(letter.typed),
      index,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  for (const { base, typed } of letters) add(base, typed);
  return holds;
}

/**Acute, grave, circumflex, diaeresis and tilde, the accents in the order a held key shows them, other letters after them*/
const ACCENTS = ["\u0301", "\u0300", "\u0302", "\u0308", "\u0303"];

/**The place of a letter by its accent, from the combining mark the letter decomposes into, like é into e and \u0301*/
function accent_rank(letter: string): number {
  const mark = [...letter.normalize("NFD")].find((c) => COMBINING.test(c));
  const rank = mark === undefined ? -1 : ACCENTS.indexOf(mark);
  return rank === -1 ? ACCENTS.length : rank;
}

const COMBINING = /^\p{M}/u;

function key_of(text: string, holds?: Holds): KeyboardKeyConfig | number {
  if (!text) return KEY;
  const hold = holds?.get(text);
  //A combining mark is shown on a dotted circle, alone it would sit on nothing
  return {
    ...(COMBINING.test(text) ? { text: "◌" + text, key: text } : { text }),
    ...(hold && { hold }),
  };
}

/**The rows of a layer of the grid, number row, three letter rows, and the bottom row
 * @param left the key left of the bottom letter row, shift or the page key of the symbols
 * @param sym the symbol key of the bottom row*/
function grid_of(
  rows: (KeyboardKeyConfig | number)[][],
  left: KeyboardKeyConfig | number,
  sym: KeyboardKeyConfig,
): KeyboardLayerConfig {
  const [number, top, middle, bottom] = [0, 1, 2, 3].map((i) => rows[i] ?? []);
  const pad = (keys: (KeyboardKeyConfig | number)[], count: number) => [
    ...keys,
    ...(Array(Math.max(count - keys.length, 0)).fill(KEY) as number[]),
  ];
  const bottom_keys = pad(bottom, 11);
  const right = WIDTH - LEFT[3] - bottom_keys.length * KEY;
  return {
    max_width: 80,
    key_cols: KEY,
    keys: [
      [
        ...pad(number, 13),
        {
          text: "⌫",
          key: KeyboardSpecialKeys.Backspace,
          cols: WIDTH - 13 * KEY,
        },
      ],
      [
        { text: "Esc", key: KeyboardSpecialKeys.Escape, cols: LEFT[1] },
        ...pad(top, 12),
        1,
        {
          text: "⏎",
          key: KeyboardSpecialKeys.Enter,
          cols: WIDTH - LEFT[2] - 12 * KEY,
          rows: 2,
        },
      ],
      [
        { text: "🌐", key: KeyboardSpecialKeys.Language, cols: LEFT[2] },
        ...pad(middle, 12),
      ],
      [
        left,
        ...bottom_keys,
        ...(typeof left === "number" || right < KEY
          ? []
          : [{ ...left, cols: right }]),
      ],
      [
        { ...sym, cols: 7 },
        5,
        { text: "Space", key: " ", cols: 28 },
        4,
        { text: "🡸", key: KeyboardSpecialKeys.Left },
        { text: "🡺", key: KeyboardSpecialKeys.Right },
        { text: "🗙", key: KeyboardSpecialKeys.Close, cols: 8 },
      ],
    ],
  };
}

/**The symbol pages, the same for every layout, the ASCII symbols and common ones on the first, the rest on the second*/
const SYMBOLS = [
  ["`1234567890-=", "!@#$%^&*()_+", "[]{}\\|;:'\"~°", "<>,./?€£¥§±"],
  ["¹²³¼½¾‰¢µ¤¬¦·", "¡¿«»‹›„“”‚‘’", "×÷√∞≠≈≤≥∑π•¶", "–—…©®™†←→↑↓"],
];

/**The two symbol layers, sym and sym2, a page key where shift is switches between them, the symbol key goes back to the letters*/
function symbol_layers(): {
  sym: KeyboardLayerConfig;
  sym2: KeyboardLayerConfig;
} {
  const page = (rows: string[], left: KeyboardKeyConfig, layer: string) =>
    grid_of(
      rows.map((row) => [...row].map((text) => ({ text }))),
      { ...left, cols: LEFT[3] },
      { text: "Sym", key: "layer:" + layer },
    );
  return {
    sym: {
      ...page(SYMBOLS[0], { text: "1/2", key: "layer:sym2" }, "sym"),
      dead_keys: false,
    },
    sym2: {
      ...page(SYMBOLS[1], { text: "2/2", key: "layer:sym" }, "sym2"),
      dead_keys: false,
    },
  };
}

function layer_of(
  rows: CldrRows,
  layout: CldrLayout,
  holds: Holds,
): KeyboardLayerConfig {
  return grid_of(
    rows.map((row) => row.map((text) => key_of(text, holds))),
    layout.shift ? { text: "⇧", key: "layer:shift", cols: LEFT[3] } : LEFT[3],
    { text: "Sym", key: "layer:sym" },
  );
}

const CONFIGS = new WeakMap<CldrLayout, KeyboardConfig>();

/**The text keyboard of the layout, a number row, three rows of letters, a shift layer when the layout has one, and two pages of symbols
 * The AltGr characters and the letters of the dead keys are typed by holding a key*/
export function keyboard_layout_config(layout: CldrLayout): KeyboardConfig {
  let config = CONFIGS.get(layout);
  if (config) return config;
  const holds = holds_of(layout);
  config = {
    default: layer_of(layout.default, layout, holds),
    layers: {
      ...(layout.shift && { shift: layer_of(layout.shift, layout, holds) }),
      ...symbol_layers(),
    },
    ...(layout.dead_keys && { dead_keys: layout.dead_keys }),
  };
  CONFIGS.set(layout, config);
  return config;
}

/**The configuration of the text keyboard, following KEYBOARD_LAYOUT*/
export const TEXT_KEYBOARD_CONFIG = KEYBOARD_LAYOUT.proxy_map(
  keyboard_layout_config,
);
