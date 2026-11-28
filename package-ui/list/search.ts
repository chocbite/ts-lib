import { Base, define_element } from "#base";
import { state } from "@chocbite/ts-lib/state";
import "./search.scss";
import type { ListColumnOptions } from "./types";

/**A row that matches, with the cells the text was found in, which the list highlights
 * @template K the keys of the columns */
export interface ListSearchFound<K extends PropertyKey = PropertyKey> {
  /**Columns whose cells have the text */
  readonly columns?: readonly K[];
  /**Whether the text of the key field has the text */
  readonly key?: boolean;
}

/**What a row answers to a search of the list
 * - found cells: the row matches, the cells are highlighted, see ListSearchQuery.match
 * - match: the row matches without highlighting a cell, like for text it does not show
 * - below: the row does not match, but something below it does, the list opens it for the search and filters its sub rows
 * - none: the row is hidden
 *
 * A row that matches is shown as it is, its sub rows are not filtered */
export type ListSearchResult<T extends {} = {}> =
  ListSearchFound<keyof T> | "match" | "below" | "none";

/**A value shown as a text, like an enum value shown by its name, the search text matches the text and conditions check the value */
export interface ListSearchShown {
  readonly value: string | number;
  readonly text: string;
}

/**A value of a row the search looks at, strings and numbers are matched as text, other values are left out of the text search */
export type ListSearchValue =
  string | number | boolean | null | undefined | ListSearchShown;

/**The value a condition checks, of a value shown as a text its value */
const value_of = (value: ListSearchValue) =>
  typeof value === "object" && value !== null ? value.value : value;
/**The value the search text matches, of a value shown as a text its text */
const text_of = (value: ListSearchValue) =>
  typeof value === "object" && value !== null ? value.text : value;

/**Values of a row by column key, for ListSearchQuery.match */
export type ListSearchValues<K extends PropertyKey = PropertyKey> = {
  readonly [C in K]?: ListSearchValue;
};

/**Operators of a condition on text, contains, does not contain, is the whole text, is not, starts or ends with it, all ignoring case */
export type ListStringOperator =
  "contains" | "not_contains" | "is" | "is_not" | "starts" | "ends";
/**Operators of a condition on a number */
export type ListNumberOperator = "=" | "!=" | "<" | "<=" | ">" | ">=";
/**Operators of a condition on a range of numbers, both ends are in the range */
export type ListRangeOperator = "between" | "not_between";

/**A condition on the value of a column, part of a ListFilter, plain JSON so the app can store it
 * A row without a value of the type of the condition for the column does not meet it */
export type ListCondition =
  | {
      column: string;
      type: "string";
      op: ListStringOperator;
      value: string;
    }
  | { column: string; type: "number"; op: ListNumberOperator; value: number }
  | {
      column: string;
      type: "number";
      op: ListRangeOperator;
      /**The ends of the range, in either order */
      value: [number, number];
    }
  | { column: string; type: "bool"; value: boolean }
  | {
      column: string;
      type: "enum";
      /**Whether the value is one of the values, or none of them */
      op: "in" | "not_in";
      value: (string | number)[];
    };

/**Conditions on the values of the columns, a row matches when it meets all of them, plain JSON so the app can store it */
/**How the conditions of a group combine: all of them are met, any one of them, or none of them */
export type ListFilterMode = "all" | "any" | "none";

/**A group of conditions in a filter, combined by its mode, it can hold groups */
export interface ListFilterGroup {
  type: "group";
  mode: ListFilterMode;
  conditions: ListFilterItem[];
}

/**A condition or a group of them */
export type ListFilterItem = ListCondition | ListFilterGroup;

/**A tree of conditions on the values of the columns, plain JSON so the app can store it
 * Its conditions combine by its mode, all of them when it has none, and an empty group is no condition */
export interface ListFilter {
  mode?: ListFilterMode;
  conditions: ListFilterItem[];
}

/**Whether the item is a group of conditions */
export function list_is_group(item: ListFilterItem): item is ListFilterGroup {
  return item.type === "group";
}

function prune(
  items: readonly ListFilterItem[],
  keep: (condition: ListCondition) => boolean,
): ListFilterItem[] {
  return items.flatMap((item): ListFilterItem[] => {
    if (!list_is_group(item)) return keep(item) ? [item] : [];
    const conditions = prune(item.conditions, keep);
    return conditions.length ? [{ ...item, conditions }] : [];
  });
}

/**The filter with only the conditions keep keeps, all by default, and without the groups that are empty then */
export function list_filter_prune(
  filter: ListFilter,
  keep: (condition: ListCondition) => boolean = () => true,
): ListFilter {
  return { ...filter, conditions: prune(filter.conditions, keep) };
}

/**Whether values meet the items combined by the mode */
function meets_all(
  mode: ListFilterMode,
  items: readonly ListFilterItem[],
  values: ListSearchValues,
): boolean {
  const met = (item: ListFilterItem): boolean =>
    list_is_group(item)
      ? meets_all(item.mode, item.conditions, values)
      : meets(item, values[item.column]);
  if (mode === "any") return items.some(met);
  if (mode === "none") return !items.some(met);
  return items.every(met);
}

/**A condition on a range of numbers */
export type ListRangeCondition = Extract<
  ListCondition,
  { op: ListRangeOperator }
>;
/**Whether the condition is on a range of numbers, between or not between */
export function list_is_range(
  condition: ListCondition,
): condition is ListRangeCondition {
  return (
    condition.type === "number" &&
    (condition.op === "between" || condition.op === "not_between")
  );
}

/**Whether a value meets a condition, a value of another type does not */
function meets(condition: ListCondition, shown: ListSearchValue): boolean {
  const value = value_of(shown);
  switch (condition.type) {
    case "string": {
      if (typeof value !== "string" && typeof value !== "number") return false;
      const text = String(value).toLowerCase();
      const part = condition.value.toLowerCase();
      if (condition.op === "contains") return text.includes(part);
      if (condition.op === "not_contains") return !text.includes(part);
      if (condition.op === "is") return text === part;
      if (condition.op === "is_not") return text !== part;
      if (condition.op === "ends") return text.endsWith(part);
      return text.startsWith(part);
    }
    case "number": {
      if (typeof value !== "number") return false;
      if (list_is_range(condition)) {
        const [a, b] = condition.value;
        const inside = value >= Math.min(a, b) && value <= Math.max(a, b);
        return inside === (condition.op === "between");
      }
      const other = condition.value;
      if (condition.op === "=") return value === other;
      if (condition.op === "!=") return value !== other;
      if (condition.op === "<") return value < other;
      if (condition.op === "<=") return value <= other;
      if (condition.op === ">") return value > other;
      return value >= other;
    }
    case "bool":
      return value === condition.value;
    case "enum": {
      if (typeof value !== "string" && typeof value !== "number") return false;
      //By text, the values of enum choices are keys, which are strings, also for values written as numbers
      const key = String(value);
      const has = condition.value.some((one) => String(one) === key);
      return has === (condition.op === "in");
    }
  }
}

/**Operators typed in front of the value of a text condition in a cell of the column search */
export const LIST_STRING_TYPED: { [op in ListStringOperator]: string } = {
  contains: "~",
  not_contains: "!~",
  is: "=",
  is_not: "!=",
  starts: "^",
  ends: "$",
};

/**Text conditions by the operator typed for them */
export const LIST_TYPED_STRING: {
  readonly [typed: string]: ListStringOperator;
} = Object.fromEntries(
  (Object.entries(LIST_STRING_TYPED) as [ListStringOperator, string][]).map(
    ([op, typed]) => [typed, op],
  ),
);

/**The operators of a condition on a number */
export const LIST_NUMBER_OPERATORS: readonly string[] = [
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
] satisfies ListNumberOperator[];

/**A range as it is typed, 30..50, and !=30..50 for not between */
export function list_range_text(
  op: ListRangeOperator,
  [a, b]: readonly [number, number],
): string {
  return (op === "between" ? "" : "!=") + a + ".." + b;
}

/**A range typed as two numbers with .. between them, a comma is a decimal point, undefined when it is not one */
export function list_range_read(text: string): [number, number] | undefined {
  const ends = text.split("..");
  if (ends.length !== 2) return undefined;
  const [a, b] = ends.map((end) => end.trim().replace(",", "."));
  if (!a || !b) return undefined;
  const range: [number, number] = [Number(a), Number(b)];
  return range.every(Number.isFinite) ? range : undefined;
}

/**Short text of a condition, as it is typed in a cell of the column search, for showing conditions where there is little space */
export function list_condition_text(condition: ListCondition): string {
  switch (condition.type) {
    case "string":
      return LIST_STRING_TYPED[condition.op] + condition.value;
    case "number":
      if (list_is_range(condition))
        return list_range_text(condition.op, condition.value);
      return condition.op + condition.value;
    case "bool":
      return condition.value ? "Yes" : "No";
    case "enum":
      return (
        (condition.op === "in" ? "" : "not ") + condition.value.join(" or ")
      );
  }
}

/**A search of the list, given to the search row option of every row the list filters
 * Not generic in the columns, so an answer written in the transform gets its type before the list knows the columns,
 * the keys given to match are checked when the answer returns what match found */
export interface ListSearchQuery {
  /**The searched text, trimmed and lower cased, empty while only conditions filter */
  readonly text: string;
  /**The conditions on columns, a tree of groups, only of columns the list has and without empty groups */
  readonly filter: ListFilter;
  /**Whether values meet the conditions and have the text, giving the columns and the key text that have the text, ignoring case, undefined when not
   * The answer of a row can return it, the list then highlights the text, conditions are not highlighted, and it is truthy for a check like some
   * @param values values by column key, they can be of data that has no row, like sub rows that are not open, a condition of a column without a value is not met
   * @param key text of the key field */
  match<K extends PropertyKey>(
    values: ListSearchValues<K>,
    key?: string,
  ): ListSearchFound<K> | undefined;
}

/**How the search applies to the rows of a parent: all shows them, filter asks each row, hide hides them as the parent is hidden */
export type ListSearchMode = "all" | "filter" | "hide";

class Query implements ListSearchQuery {
  readonly text: string;
  readonly filter: ListFilter;

  constructor(text: string, filter: ListFilter) {
    this.text = text;
    this.filter = filter;
  }

  match<K extends PropertyKey>(
    values: ListSearchValues<K>,
    key?: string,
  ): ListSearchFound<K> | undefined {
    const filter = this.filter;
    if (!meets_all(filter.mode ?? "all", filter.conditions, values))
      return undefined;
    const columns: K[] = [];
    if (!this.text) return { columns, key: false };
    for (const name in values) {
      const value = text_of(values[name]);
      if (
        (typeof value === "string" || typeof value === "number") &&
        String(value).toLowerCase().includes(this.text)
      )
        columns.push(name);
    }
    const in_key = key !== undefined && key.toLowerCase().includes(this.text);
    return columns.length || in_key ? { columns, key: in_key } : undefined;
  }
}

/**The query of a search text and a filter, undefined for an empty or blank text without conditions, which is no search
 * Empty groups are left out of the filter */
export function list_search_query(
  text: string,
  filter: ListFilter = { conditions: [] },
): ListSearchQuery | undefined {
  const trimmed = text.trim().toLowerCase();
  const pruned = list_filter_prune(filter);
  return trimmed || pruned.conditions.length
    ? new Query(trimmed, pruned)
    : undefined;
}

/**The value the search reads from a value that is no state, a string, number or boolean as it is, nothing for anything else */
export const list_search_plain_value = (value: unknown): ListSearchValue =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean"
    ? value
    : undefined;

/**The value the search reads from a value of a row, a string, number or boolean as it is, the value of a sync state of one, nothing for anything else */
export function list_search_plain(value: unknown): ListSearchValue {
  if (!state.is.state(value)) return list_search_plain_value(value);
  const result = value.rsync ? value.get?.() : undefined;
  return result?.ok ? list_search_plain_value(result.value) : undefined;
}

/**The value the search reads from what it reads of a column, its search_value or else the value, or from the value of the state that is
 * A search_value as it is, else a string, number or boolean as it is and nothing for anything else */
export function list_search_read(
  column: ListColumnOptions<any, Base> | undefined,
  value: unknown,
): ListSearchValue {
  return column?.search_value
    ? (value as ListSearchValue)
    : list_search_plain_value(value);
}

/**The columns the conditions of the filter are on */
export function list_filter_columns(filter: ListFilter): Set<string> {
  const columns = new Set<string>();
  const add = (items: readonly ListFilterItem[]) => {
    for (const item of items)
      if (list_is_group(item)) add(item.conditions);
      else columns.add(item.column);
  };
  add(filter.conditions);
  return columns;
}

//      ____          _____
//     |  _ \   /\   |  __ \
//     | |_) | /  \  | |__) |
//     |  _ < / /\ \ |  _  /
//     | |_) / ____ \| | \ \
//     |____/_/    \_\_|  \_\

/**Search bar above the rows of a list, a text input with a clear button
 * The list gives it the text and decides what a change does, so it follows the search input of the list */
export class ListSearchBar extends Base {
  static element_name() {
    return "searchbar";
  }
  static element_name_space() {
    return "list";
  }

  #input = document.createElement("input");
  /**Called with the text the user typed or cleared, now for enter, the clear button and escape, which search without waiting */
  on_input?: (text: string, now: boolean) => void;

  constructor() {
    super();
    this.appendChild(document.createElement("span")).className = "glyph";
    this.#input.type = "text";
    this.#input.placeholder = "Search";
    this.#input.spellcheck = false;
    this.#input.autocomplete = "off";
    this.appendChild(this.#input);
    const clear = this.appendChild(document.createElement("span"));
    clear.className = "clear";
    this.#input.oninput = () => this.#changed(this.#input.value, false);
    this.#input.onkeydown = (e) => {
      if (this.#input.readOnly) return;
      if (e.key === "Enter") {
        e.preventDefault();
        this.#changed(this.#input.value, true);
      }
      //Only while there is something to clear, so an empty bar lets escape through, like to a panel
      else if (e.key === "Escape" && this.#input.value) {
        e.preventDefault();
        e.stopPropagation();
        this.#input.value = "";
        this.#changed("", true);
      }
    };
    clear.onclick = () => {
      if (this.#input.readOnly) return;
      this.#input.value = "";
      this.#changed("", true);
      this.#input.focus();
    };
    this.classList.add("empty");
  }

  #changed(text: string, now: boolean) {
    this.classList.toggle("empty", !text);
    this.on_input?.(text, now);
  }

  /**The text in the bar, not set while it is the same, so the caret stays while typing */
  set value(text: string) {
    if (this.#input.value !== text) this.#input.value = text;
    this.classList.toggle("empty", !text);
  }

  /**Locks the bar, for a read only search state */
  set read_only(value: boolean) {
    this.#input.readOnly = value;
    this.classList.toggle("read-only", value);
  }
}
define_element(ListSearchBar);

/**Line shown instead of the rows while the search hides all of them */
export class ListSearchEmpty extends Base {
  static element_name() {
    return "searchempty";
  }
  static element_name_space() {
    return "list";
  }

  constructor() {
    super();
    this.textContent = "No matches";
  }
}
define_element(ListSearchEmpty);
