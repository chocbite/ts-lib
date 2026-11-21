import { comp, CompAnchor } from "#composition";
import list from "#list";
import { px_to_rem } from "#theme";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import type { KeyboardBase } from "./base";
import {
  CLDR_CONTINENT_OF,
  CLDR_CONTINENTS,
  CLDR_TERRITORY_NAMES,
} from "./cldr_layouts";
import {
  type CldrLayoutInfo,
  KEYBOARD_LAYOUT,
  keyboard_layout_auto,
  KEYBOARD_LAYOUTS,
} from "./languages";
import { KEYBOARD_LANGUAGE } from "./settings";

/**A row of the list of languages, a continent, a country or a layout*/
interface PickerRow {
  /**Unique in the list, a layout is in the list once for every country it is used in*/
  key: string;
  text: string;
  /**The id of the layout a row chooses, empty for the layout following the browser*/
  layout?: string;
  open?: boolean;
  children?: PickerRow[];
}

const by_name = (a: { text: string }, b: { text: string }) =>
  a.text.localeCompare(b.text);

/**The rows of the list, the layout following the browser first, then the continents with their countries and their layouts*/
function rows_of(home?: string): {
  rows: PickerRow[];
  all: Map<string, PickerRow>;
} {
  const by_country = new Map<string, CldrLayoutInfo[]>();
  for (const layout of KEYBOARD_LAYOUTS)
    for (const country of layout.territories)
      by_country.set(country, [...(by_country.get(country) ?? []), layout]);

  const all = new Map<string, PickerRow>();
  const add = (row: PickerRow) => (all.set(row.key, row), row);
  const rows = [
    add({
      key: "auto",
      text: `Automatic, ${keyboard_layout_auto().name}`,
      layout: "",
    }),
    ...CLDR_CONTINENTS.map((continent) => {
      const countries = [...by_country]
        .filter(([country]) => CLDR_CONTINENT_OF[country] === continent)
        .map(([country, layouts]) =>
          add({
            key: `${continent}/${country}`,
            text: CLDR_TERRITORY_NAMES[country] ?? country,
            open: country === home,
            children: layouts
              .map((layout) =>
                add({
                  key: `${continent}/${country}/${layout.id}`,
                  text: layout.name,
                  layout: layout.id,
                }),
              )
              .sort(by_name),
          }),
        )
        .sort(by_name);
      return add({
        key: continent,
        text: CLDR_TERRITORY_NAMES[continent] ?? continent,
        open: home !== undefined && CLDR_CONTINENT_OF[home] === continent,
        children: countries,
      });
    }),
  ];
  return { rows, all };
}

/**The country to show open, the region of the browser when the layout is used there, or the only country of the layout*/
function home_of(layout: CldrLayoutInfo): string | undefined {
  for (const tag of typeof navigator === "undefined"
    ? []
    : navigator.languages) {
    const region = tag.split("-").find((s) => /^[A-Z]{2}$/.test(s));
    if (region && layout.territories.includes(region)) return region;
  }
  return layout.territories.length === 1 ? layout.territories[0] : undefined;
}

/**Opens the list of keyboard languages in a panel above the keyboard, choosing one writes KEYBOARD_LANGUAGE and gives the focus back to the field
 * @returns a function closing the panel*/
export function keyboard_language_picker(
  keyboard: KeyboardBase,
  field: HTMLElement,
): () => void {
  const current = KEYBOARD_LAYOUT.ok();
  const chosen = KEYBOARD_LANGUAGE.ok();
  const { rows, all } = rows_of(home_of(current));
  const selected = state.ok_w(
    [...all.values()]
      .filter((row) => row.layout === chosen)
      .map((row) => row.key),
  );

  const languages = list.container(
    {
      transform: (row: PickerRow) =>
        ok({
          values: {},
          key_field: { text: row.text },
          openable: Boolean(row.children),
          opened: row.open,
          sub_rows: () => row.children ?? [],
          selectable: row.layout !== undefined,
        }),
      sub_rows: true,
      headless: true,
      selection: { mode: "single", key: (row: PickerRow) => row.key },
    },
    { columns: {}, rows, selected },
  );
  const content = comp.content({
    title: "Keyboard language",
    closable: true,
    min_width: 16,
    min_height: 10,
  });
  content.append(languages);

  //Above the keyboard, as wide as fits up to 24rem
  const view = field.ownerDocument.defaultView ?? window;
  const top = px_to_rem(keyboard.getBoundingClientRect().top);
  const page = px_to_rem(view.innerWidth);
  const width = Math.min(24, page - 1);
  const panel = comp.panel_container(field).panel(content, {
    anchor: CompAnchor.BOT_LEFT,
    x: (page - width) / 2,
    y: top - 0.5,
    width,
    height: Math.max(Math.min(30, top - 1), 10),
    auto_close: true,
  });
  const remove_part = keyboard.add_part(panel);
  void panel.on_close().then(remove_part);

  selected.sub((keys) => {
    const row = all.get(keys.value[0]);
    if (row?.layout === undefined) return;
    KEYBOARD_LANGUAGE.write(row.layout);
    panel.close();
    field.focus();
  });
  return () => panel.close();
}
