import {
  AccessTypes,
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import list from "#list";
import { ok, type ResultNice } from "@chocbite/ts-lib/result";
import state, {
  type StateOrVal,
  type StateREAW,
  type StateROSW,
} from "@chocbite/ts-lib/state";
import {
  CanvasLink,
  option_value_state,
  same_link,
  type OptionState,
} from "../link";
import { linked_field, LinkField, property_field } from "./fields";
import type { OwnedProperty, PropertyOwner } from "./owner";
import "./properties_editor.scss";

/**Inputs of the properties editor*/
const PROPERTIES = {
  /**The owner whose properties are shown, undefined shows that nothing is selected
   * Give canvas.selection_owner to show the selection of viewports*/
  owner: input_key<StateOrVal<PropertyOwner | undefined>>(),
};
export type CanvasPropertiesOptions = BaseOptions &
  InputOptions<typeof PROPERTIES>;

/**A row of the editor for a property, with what its states hold now*/
interface PropertyRow extends OwnedProperty {
  /**The link every state holds, undefined while it holds a value*/
  links: (CanvasLink | undefined)[];
  /**Whether every state holds the same value, always for one state*/
  same: boolean;
}

/**A row of the editor for a section, its properties are its sub rows*/
interface SectionRow {
  section: string;
  rows: PropertyRow[];
}

type EditorRow = PropertyRow | SectionRow;
const is_section = (row: EditorRow): row is SectionRow => "rows" in row;

/**Writes the value to every state, the first error when one refuses it*/
async function write_all(
  states: readonly (OptionState<unknown> | undefined)[],
  value: unknown,
): Promise<ResultNice<void>> {
  const results = await Promise.all(
    states.map((option) => Promise.resolve(option?.write?.(value))),
  );
  for (const result of results) if (result && !result.ok) return result;
  return ok(undefined);
}

/**A form element that only shows, the user can not change it*/
const read_only = (element: HTMLElement): HTMLElement => {
  (element as Base).set({ access: AccessTypes.Read });
  return element;
};

/**The rows of the properties, those of a section in a section row at the place of its first property, those without one at the root*/
function editor_rows(properties: PropertyRow[]): EditorRow[] {
  const rows: EditorRow[] = [];
  const sections = new Map<string, SectionRow>();
  for (const row of properties) {
    const name = row.property.section;
    if (!name) {
      rows.push(row);
      continue;
    }
    let section = sections.get(name);
    if (!section) {
      section = { section: name, rows: [] };
      sections.set(name, section);
      rows.push(section);
    }
    section.rows.push(row);
  }
  return rows;
}

/**The value a state holds now, NONE while it has none*/
const NONE = Symbol("none");
const held_now = (option: OptionState<unknown> | undefined): unknown => {
  const value = option?.rsync ? option.get() : undefined;
  return value?.ok ? value.value : NONE;
};

const NAME = Symbol("name");
const PROPERTY_LIST = Symbol("properties");

/**Shows the properties of an owner in a list, a row per property with a field bound to the states of its value
 * Properties with a section are the sub rows of a row for the section, so owners with many properties stay manageable
 *
 * A property with several states, like of several widgets shown together, shows the value they share and a change sets all of them,
 * the field is blank where the values differ, the chain links all of them, a property linked in only some of them is blank and read only*/
class PropertiesEditor extends Base {
  static element_name() {
    return "properties";
  }
  static element_name_space() {
    return "canvas";
  }

  #title = this.appendChild(document.createElement("div"));
  #rows = state.ok_w<EditorRow[]>([]);
  /**Whether a section is open, by its name, so it stays open when the rows are made again, like for another owner*/
  #open = new Map<string, StateROSW<boolean>>();
  /**The name of the owner, the title shows it while the owner has properties*/
  #name = "";
  /**Why the owner has no properties, the title shows it*/
  #error: string | undefined;

  constructor() {
    super();
    this.#title.className = "title";
    this.#title.textContent = "Nothing selected";
    this.appendChild(
      list.container(
        {
          transform: (row: EditorRow) =>
            is_section(row)
              ? ok({
                  key_field: { text: row.section },
                  openable: true,
                  opened: this.#opened(row.section),
                  sub_rows: () => row.rows,
                  values: { value: row, link: row },
                })
              : ok({
                  key_field: { text: row.property.name },
                  values: { value: row, link: row },
                }),
          headless: true,
          sub_rows: true,
        },
        {
          columns: {
            value: list.column({
              title: "Value",
              //A node field, as each property has an element of its own kind
              field_gen: () =>
                list.node_field<Node>(document.createTextNode("")),
              field_apply: (field, row: EditorRow) => {
                field.node = is_section(row)
                  ? document.createTextNode("")
                  : this.#field(row);
              },
            }),
            link: list.column({
              title: "Link",
              //As wide as the link icon needs, also when it is bigger in touch mode, so it does not take width from the values
              fixed_width: "min",
              field_gen: () => new LinkField(),
              field_apply: (field, row: EditorRow) =>
                is_section(row)
                  ? field.show(undefined)
                  : field.show(
                      row.states,
                      row.property,
                      row.links.some((link) => link !== undefined),
                    ),
            }),
          },
          rows: this.#rows,
        },
      ),
    );
  }

  set(options: CanvasPropertiesOptions): this {
    super.set(options);
    this.set_input(PROPERTIES.owner, options.owner, (owner) =>
      this.#show(owner.ok ? owner.value : undefined),
    );
    return this;
  }

  /**The field of a property, by what its states hold*/
  #field(row: PropertyRow): Node {
    const { property, states, links } = row;
    const first_link = links[0];
    if (
      first_link &&
      links.every((link) => link && same_link(link, first_link))
    )
      return linked_field(first_link, property);
    //Linked in only some of them, or to different states
    if (links.some((link) => link !== undefined))
      return read_only(property_field(property, undefined));
    if (states.length === 1) {
      const option = states[0];
      //Without a state the default is shown, which can not be changed here
      if (!option) return property_field(property, state.ok(property.default));
      return property_field(property, option_value_state(option));
    }
    const writable = states.every((option) => option?.writable);
    if (!row.same)
      return writable
        ? property_field(property, undefined, (value) => {
            void write_all(states, value);
          })
        : read_only(property_field(property, undefined));
    //The same value, shown from the first, written to all
    const first = option_value_state(states[0]!);
    if (!writable)
      return property_field(
        property,
        first.proxy((result) => result),
      );
    return property_field(
      property,
      (first as StateREAW<unknown>).proxy_w((result) => result, {
        write: (value) => write_all(states, value),
      }),
    );
  }

  /**Whether the section of the name is open, closed until the user opens it*/
  #opened(section: string): StateROSW<boolean> {
    let opened = this.#open.get(section);
    if (!opened) this.#open.set(section, (opened = state.ok_w(false)));
    return opened;
  }

  #show_title() {
    this.#title.textContent = this.#error ?? this.#name;
  }

  /**Shows the properties of the owner, following its name and properties*/
  #show(owner: PropertyOwner | undefined) {
    this.detach_state_from_symbol(NAME);
    this.detach_state_from_symbol(PROPERTY_LIST);
    this.#detach_states();
    this.#rows.set_ok([]);
    this.#name = "";
    this.#error = undefined;
    if (!owner) {
      this.#title.textContent = "Nothing selected";
      return;
    }
    //A rename changes only the title, not the rows
    this.attach_state_to_symbol(NAME, owner.name, (name) => {
      this.#name = name.value;
      this.#show_title();
    });
    this.attach_state_to_symbol(PROPERTY_LIST, owner.properties, (list) => {
      this.#detach_states();
      //An error is shown with its details, like the path of a widget that is not registered
      this.#error = list.ok ? undefined : list.error.toString();
      this.#show_title();
      if (list.ok) this.#follow(list.value);
      else this.#rows.set_ok([]);
    });
  }

  /**Symbols of the states of the values followed*/
  #followed: symbol[] = [];
  #detach_states() {
    for (const symbol of this.#followed) this.detach_state_from_symbol(symbol);
    this.#followed = [];
  }

  /**Shows a row per property, made again when a state switches between a value and a link,
   * or for several states when their values become the same or different*/
  #follow(properties: readonly OwnedProperty[]) {
    const links = new Map<string, (CanvasLink | undefined)[]>();
    const same = new Map<string, boolean>();
    /**Looks at the states of the property now, true when the row has to be made again*/
    const check = ({ key, states }: OwnedProperty): boolean => {
      const values = states.map(held_now);
      const now = values.map((value) =>
        value instanceof CanvasLink ? value : undefined,
      );
      const equal =
        states.length === 1 ||
        values.every(
          (value) =>
            value !== NONE &&
            !(value instanceof CanvasLink) &&
            value === values[0],
        );
      const before = links.get(key);
      const changed =
        !before ||
        before.some((link, i) => link !== now[i]) ||
        same.get(key) !== equal;
      links.set(key, now);
      same.set(key, equal);
      return changed;
    };
    const rows = () =>
      this.#rows.set_ok(
        editor_rows(
          properties.map((owned) => ({
            ...owned,
            links: links.get(owned.key) ?? owned.states.map(() => undefined),
            same: same.get(owned.key) ?? true,
          })),
        ),
      );
    let attaching = true;
    for (const owned of properties) {
      check(owned);
      for (const option of owned.states) {
        if (!option) continue;
        const symbol = Symbol(owned.key);
        this.#followed.push(symbol);
        this.attach_state_to_symbol(symbol, option, () => {
          if (!attaching && check(owned)) rows();
        });
      }
    }
    attaching = false;
    rows();
  }
}
define_element(PropertiesEditor);

export type { PropertiesEditor };

/**Creates a properties editor showing the properties of an owner, like canvas.properties({ owner: canvas.selection_owner({ selected, page }) })*/
export function canvas_properties(
  options: CanvasPropertiesOptions = {},
): PropertiesEditor {
  return PropertiesEditor.create(options);
}
