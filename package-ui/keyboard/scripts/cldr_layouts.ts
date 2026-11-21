//Generates ../cldr_layouts.ts, the text keyboard layouts, from the Windows keyboards of Unicode CLDR, see ../INTERNAL.md
//Run from the repo root with: node package-ui/keyboard/scripts/cldr_layouts.ts
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

//Release 43 is the last with the platform keyboards, later releases only have the few keyboards of the new format
const RELEASE = "release-43";
const RAW = `https://raw.githubusercontent.com/unicode-org/cldr/${RELEASE}/`;
const LISTING = `https://api.github.com/repos/unicode-org/cldr/contents/keyboards/windows?ref=${RELEASE}`;
const OUTPUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../cldr_layouts.ts",
);

//Languages that need an input method, a key typing one character does not work for them
const EXCLUDED_LANGUAGES = new Set(["ja", "ko", "zh"]);
//The continents of the UN M49 regions, every country is in one
const CONTINENTS = ["150", "019", "142", "002", "009"];
//The first key of each row in the data, E is the number row and B the row of the left shift
const ROWS: [string, number, number][] = [
  ["E", 0, 12],
  ["D", 1, 12],
  ["C", 1, 12],
  ["B", 0, 11],
];

async function get(path: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(path.startsWith("http") ? path : RAW + path);
    if (response.ok) return response.text();
    if (attempt === 3) throw new Error(`${response.status} for ${path}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}

/**Runs the function over the items, a few at a time, so GitHub does not refuse the requests*/
async function map_limited<T, R>(
  items: T[],
  limit: number,
  func: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await func(items[i]);
      }
    }),
  );
  return results;
}

//      __   ____  __ _
//      \ \ / /  \/  | |
//       \ V /| |\/| | |
//        > < | |  | | |
//       / . \| |  | | |____
//      /_/ \_\_|  |_|______|
const ENTITIES: { [entity: string]: string } = {
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  quot: '"',
};

/**Text of an attribute, with the XML entities and the \u{...} escapes of CLDR replaced*/
function decode(text: string): string {
  return text
    .replace(/&(\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_m, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    );
}

function attributes(tag: string): { [name: string]: string } {
  const result: { [name: string]: string } = {};
  for (const [, name, value] of tag.matchAll(/([\w:]+)="([^"]*)"/g))
    result[name] = decode(value);
  return result;
}

/**Every tag of the name in the xml, as its attributes*/
function tags(xml: string, name: string): { [name: string]: string }[] {
  return [...xml.matchAll(new RegExp(`<${name}\\s([^>]*?)/?>`, "g"))].map((m) =>
    attributes(m[1]),
  );
}

const without_comments = (xml: string) => xml.replace(/<!--[\s\S]*?-->/g, "");

//      _                     ____  _    _ _______ _____
//     | |        /\  \ \   / / __ \| |  | |__   __/ ____|
//     | |       /  \  \ \_/ / |  | | |  | |  | | | (___
//     | |      / /\ \  \   /| |  | | |  | |  | |  \___ \
//     | |____ / ____ \  | | | |__| | |__| |  | |  ____) |
//     |______/_/    \_\ |_|  \____/ \____/   |_| |_____/
type Rows = string[][];
interface Layout {
  id: string;
  name: string;
  language: string;
  script?: string;
  region?: string;
  territories: string[];
  default: Rows;
  shift?: Rows;
  altgr?: Rows;
  dead: { [from: string]: string };
}

//The layer a keyMap is, from its modifiers, which are alternatives separated by spaces, a ? marks an optional modifier
function layer_of(
  modifiers: string | undefined,
): "default" | "shift" | "altgr" | undefined {
  if (modifiers === undefined) return "default";
  for (const alternative of modifiers.split(/\s+/)) {
    const required = alternative
      .split("+")
      .filter((m) => !m.endsWith("?"))
      .sort()
      .join("+");
    if (required === "shift") return "shift";
    if (required === "altR" || required === "alt+ctrl") return "altgr";
  }
  return undefined;
}

function rows_of(maps: { [name: string]: string }[]): Rows {
  const keys = new Map(maps.map((m) => [m.iso, m.to]));
  return ROWS.map(([row, first, last]) => {
    const keys_of_row: string[] = [];
    for (let i = first; i <= last; i++)
      keys_of_row.push(keys.get(row + String(i).padStart(2, "0")) ?? "");
    while (keys_of_row.length && keys_of_row[keys_of_row.length - 1] === "")
      keys_of_row.pop();
    return keys_of_row;
  });
}

function parse_layout(file: string, xml: string): Layout | undefined {
  //like da-t-k0-windows.xml or de-CH-t-k0-windows-extended.xml
  const match = /^(.+?)-t-k0-windows(?:-(.+))?\.xml$/.exec(file);
  if (!match) return undefined;
  const [, locale, variant] = match;
  const [language, ...subtags] = locale.split("-");
  if (EXCLUDED_LANGUAGES.has(language)) return undefined;
  const script = subtags.find((s) => /^[A-Z][a-z]{3}$/.test(s));
  const region = subtags.find((s) => /^([A-Z]{2}|\d{3})$/.test(s));

  xml = without_comments(xml);
  const layout: Layout = {
    id: locale + (variant ? "-" + variant : ""),
    name: tags(xml, "name")[0]?.value ?? locale,
    language,
    script,
    region,
    territories: [],
    default: [],
    dead: {},
  };
  for (const [, modifiers, body] of xml.matchAll(
    /<keyMap(?:\s+modifiers="([^"]*)")?\s*>([\s\S]*?)<\/keyMap>/g,
  )) {
    const layer = layer_of(modifiers);
    if (!layer || layout[layer]?.length) continue;
    const rows = rows_of(tags(body, "map"));
    if (rows.some((r) => r.length)) layout[layer] = rows;
  }
  if (!layout.default.length) return undefined;
  for (const transform of tags(xml, "transform"))
    layout.dead[transform.from] = transform.to;
  return layout;
}

//      _______ ______ _____  _____  _____ _______ ____  _____  _____ ______  _____
//     |__   __|  ____|  __ \|  __ \|_   _|__   __/ __ \|  __ \|_   _|  ____|/ ____|
//        | |  | |__  | |__) | |__) | | |    | | | |  | | |__) | | | | |__  | (___
//        | |  |  __| |  _  /|  _  /  | |    | | | |  | |  _  /  | | |  __|  \___ \
//        | |  | |____| | \ \| | \ \ _| |_   | | | |__| | | \ \ _| |_| |____ ____) |
//        |_|  |______|_|  \_\_|  \_\_____|  |_|  \____/|_|  \_\_____|______|_____/
interface Territories {
  /**The countries in a region, for continents and regions like 419*/
  countries(region: string): string[];
  continent_of: Map<string, string>;
  /**The countries where the language, like da or az_Cyrl, is an official language*/
  official: Map<string, Set<string>>;
  /**The most likely full tag of a language, like da_Latn_DK for da*/
  likely: Map<string, string>;
  names: Map<string, string>;
}

async function territories(): Promise<Territories> {
  const supplemental = without_comments(
    await get("common/supplemental/supplementalData.xml"),
  );
  const likely_xml = await get("common/supplemental/likelySubtags.xml");
  const english = await get("common/main/en.xml");

  const contains = new Map<string, string[]>();
  for (const group of tags(supplemental, "group"))
    if (group.contains && !group.status)
      contains.set(group.type, [
        ...(contains.get(group.type) ?? []),
        ...group.contains.split(" "),
      ]);
  const countries = (region: string): string[] =>
    (contains.get(region) ?? []).flatMap((r) =>
      contains.has(r) ? countries(r) : [r],
    );
  const continent_of = new Map<string, string>();
  for (const continent of CONTINENTS)
    for (const country of countries(continent))
      continent_of.set(country, continent);

  const official = new Map<string, Set<string>>();
  for (const [, country, body] of supplemental.matchAll(
    /<territory type="(\w+)"[^>]*>([\s\S]*?)<\/territory>/g,
  ))
    for (const population of tags(body, "languagePopulation"))
      if (
        /^(official|de_facto_official)$/.test(population.officialStatus ?? "")
      )
        official.set(
          population.type,
          (official.get(population.type) ?? new Set()).add(country),
        );

  const likely = new Map(
    tags(likely_xml, "likelySubtag").map((t) => [t.from, t.to]),
  );

  const names = new Map<string, string>();
  for (const [, code, alt, name] of english.matchAll(
    /<territory type="(\w+)"( alt="\w+")?>([^<]*)<\/territory>/g,
  ))
    if (!alt) names.set(code, decode(name));
  return { countries, continent_of, official, likely, names };
}

//Puts each layout under the countries it is used in
function place(layouts: Layout[], t: Territories): void {
  //The countries a layout of a region covers, its language gets no other layout there
  const regional = new Map<string, Set<string>>();
  const covered = (l: Layout): string[] => {
    if (!l.region) return [];
    if (!/^\d+$/.test(l.region)) return [l.region];
    const official = t.official.get(l.language) ?? new Set();
    return t.countries(l.region).filter((c) => official.has(c));
  };
  for (const l of layouts)
    for (const country of covered(l))
      regional.set(
        l.language,
        (regional.get(l.language) ?? new Set()).add(country),
      );

  for (const l of layouts) {
    let found: string[];
    if (l.region) found = covered(l);
    else {
      const tag = l.script ? `${l.language}_${l.script}` : l.language;
      const likely = t.likely.get(tag) ?? t.likely.get(l.language);
      const home = likely?.split("_")[2];
      const default_script = t.likely.get(l.language)?.split("_")[1];
      //A layout of another script than the usual one of the language is only for its home country
      const official =
        l.script && l.script !== default_script
          ? []
          : [...(t.official.get(l.language) ?? [])].filter(
              (c) => !regional.get(l.language)?.has(c),
            );
      found = [...new Set([...(home ? [home] : []), ...official])];
    }
    l.territories = found.filter((c) => t.continent_of.has(c)).sort();
  }
}

//      ______ _____ _      ______
//     |  ____|_   _| |    |  ____|
//     | |__    | | | |    | |__
//     |  __|   | | | |    |  __|
//     | |     _| |_| |____| |____
//     |_|    |_____|______|______|
//Separators of the strings, characters no key types, so the strings are split without escaping
const LAYER = "\v";
const ROW = "\n";
const KEY = "\t";
const FIELD = "\f";

function separators_free(text: string, what: string): string {
  if (/[\v\n\t\f]/.test(text))
    throw new Error(`${what} has a separator in ${JSON.stringify(text)}`);
  return text;
}

function write(layouts: Layout[], t: Territories, license: string): void {
  //Many layouts have the same dead keys, they are written once and referred to by index
  const dead_keys: string[] = [];
  const dead_index = new Map<string, number>();
  const used = new Set<string>(CONTINENTS);
  //A layout is one string, a string literal loads much faster than the arrays it holds,
  //and only the layouts in use are split, see INTERNAL.md
  const entries = layouts.map((l) => {
    l.territories.forEach((c) => used.add(c));
    const dead = Object.entries(l.dead)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(
        ([from, to]) =>
          separators_free(from, l.id) + KEY + separators_free(to, l.id),
      )
      .join(ROW);
    if (dead && !dead_index.has(dead)) {
      dead_index.set(dead, dead_keys.length);
      dead_keys.push(dead);
    }
    const layers = [l.default, l.shift ?? [], l.altgr ?? []]
      .map((rows) =>
        rows
          .map((row) => row.map((k) => separators_free(k, l.id)).join(KEY))
          .join(ROW),
      )
      .join(LAYER);
    return JSON.stringify(
      [
        l.id,
        l.name,
        l.territories.join(","),
        dead ? dead_index.get(dead) : "",
        layers,
      ].join(FIELD),
    );
  });
  const continent_of = Object.fromEntries(
    [...t.continent_of].filter(([c]) => used.has(c)).sort(),
  );
  const names = Object.fromEntries(
    [...used].sort().map((c) => [c, t.names.get(c) ?? c]),
  );

  const code = `//Generated by scripts/cldr_layouts.ts from the Windows keyboards of Unicode CLDR ${RELEASE}, do not edit, see INTERNAL.md
/*
${license.trim().replace(/\*\//g, "* /")}
*/

/**What a dead key followed by a key types, one string per set of dead keys, the pairs separated by \\n, the two keys and what they type by \\t*/
export const CLDR_DEAD_KEYS: readonly string[] = [
${dead_keys.map((d) => "  " + JSON.stringify(d) + ",").join("\n")}
];

/**The layouts, one string each, fields separated by \\f: id, English name, countries separated by commas, index in CLDR_DEAD_KEYS or empty, keys
 * The keys are the default, shift and AltGr layers separated by \\v, an empty layer when the layout does not have it, the rows of a layer by \\n, the keys of a row by \\t
 * The rows are the number row from the key left of 1, then the three letter rows from the key right of tab, caps lock and left shift, an empty key is a position without a key*/
export const CLDR_LAYOUTS: readonly string[] = [
${entries.map((e) => "  " + e + ",").join("\n")}
];

/**The continents, as UN M49 regions*/
export const CLDR_CONTINENTS: readonly string[] = ${JSON.stringify(CONTINENTS)};

/**The continent of each country with a layout*/
export const CLDR_CONTINENT_OF: { readonly [country: string]: string } = ${JSON.stringify(continent_of)};

/**English names of the continents and countries*/
export const CLDR_TERRITORY_NAMES: { readonly [code: string]: string } = ${JSON.stringify(names)};
`;
  writeFileSync(OUTPUT, code);
}

const listing = JSON.parse(await get(LISTING)) as { name: string }[];
const files = listing.map((f) => f.name).filter((n) => n.endsWith(".xml"));
const xmls = await map_limited(files, 8, (f) => get(`keyboards/windows/${f}`));
const layouts = files
  .map((f, i) => parse_layout(f, xmls[i]))
  .filter((l): l is Layout => l !== undefined)
  .sort((a, b) => (a.id < b.id ? -1 : 1));
const t = await territories();
place(layouts, t);
write(layouts, t, await get("unicode-license.txt"));
console.log(
  `Wrote ${layouts.length} layouts to ${OUTPUT}, ${layouts.filter((l) => !l.territories.length).length} without a country`,
);
