import type { Base } from "#base";
import {
  icon_sort_1_9_rounded,
  icon_sort_9_1_rounded,
  icon_sort_a_z_rounded,
  icon_sort_z_a_rounded,
} from "#icons";
import type { SVGFunc } from "#svg";
import { list_search_read } from "./search";
import type { ListColumnOptions } from "./types";

/**Which way a column sorts, ascending is A to Z and 1 to 9 */
export type ListSortDirection = "asc" | "desc";

/**The column name of the key field in the sort, it has no column of its own and sorts by its text, see LIST_SORT_KEY_FIELD */
export type ListSortKeyField = "#key";
/**The column name of the key field in the sort, no key of a column can start with # without quotes, so it is not one */
export const LIST_SORT_KEY_FIELD: ListSortKeyField = "#key";

/**A column the list sorts by */
export interface ListSortKey {
  /**Key of the column, or #key for the text of the key field in a list with sub rows */
  column: string;
  direction: ListSortDirection;
}

/**The columns the rows are sorted by, the first sorts the rows, each next one sorts the rows the ones before it find equal, plain JSON so the app can store it
 * Rows all columns find equal keep the order of the data */
export type ListSort = ListSortKey[];

/**A value of a row the list sorts by, strings in the order of the language with numbers in them by number, numbers by number and false before true
 * An empty value, undefined, null, NaN or an empty string, comes before every other, so first A to Z and last Z to A */
export type ListSortValue = string | number | boolean | null | undefined;

/**A column of the sort, resolved by the list from a key of the sort, the key field has no column options */
export type ListSortColumn<K> = {
  readonly desc: boolean;
} & (
  | { readonly key: K; readonly column: ListColumnOptions<any, Base> }
  | { readonly key: ListSortKeyField; readonly column?: undefined }
);

/**Whether the user can sort by the column, see sortable of the column options */
export function list_sortable(column: ListColumnOptions<any, Base>): boolean {
  return (
    column.sortable ??
    (column.type !== undefined || column.sort_value !== undefined)
  );
}

/**What a row sorts by for a column, its sort_value, else its search_value, else the value of the row, without a column the text of the key field
 * A state the row follows, see list_sort_value for what its value sorts by */
export function list_sort_source(
  column: ListColumnOptions<any, Base> | undefined,
  value: unknown,
): unknown {
  if (column?.sort_value) return column.sort_value(value);
  return column?.search_value ? column.search_value(value) : value;
}

/**The value a row sorts by, from what it sorts by for the column or the value of the state it is, see list_sort_source
 * A sort_value as it is, otherwise as the search reads it, an enum value by the name of its choice and a value shown as a text by its text, as that is what the user sees, in a number column by its value */
export function list_sort_value(
  column: ListColumnOptions<any, Base> | undefined,
  value: unknown,
): ListSortValue {
  if (column?.sort_value) return value as ListSortValue;
  const read = list_search_read(column, value);
  if (typeof read === "object" && read !== null)
    return column?.type === "number" ? read.value : read.text;
  if (
    column?.type === "enum" &&
    column.choices &&
    (typeof read === "string" || typeof read === "number")
  )
    return column.choices[read]?.name ?? String(read);
  return read;
}

/**Numbers in strings are compared by number, item 2 before item 10, and case only decides between strings that are otherwise the same */
const collator = new Intl.Collator(undefined, { numeric: true });

/**Empty values first, then booleans, numbers and strings, so a column of mixed values still has one order */
const rank = (value: ListSortValue): number =>
  value === undefined ||
  value === null ||
  value === "" ||
  (typeof value === "number" && Number.isNaN(value))
    ? 0
    : typeof value === "boolean"
      ? 1
      : typeof value === "number"
        ? 2
        : 3;

/**Compares two values A to Z, negative when a comes first, see ListSortValue */
export function list_sort_compare(a: ListSortValue, b: ListSortValue): number {
  const rank_a = rank(a);
  const rank_b = rank(b);
  if (rank_a !== rank_b || rank_a === 0) return rank_a - rank_b;
  if (rank_a === 3) return collator.compare(a as string, b as string);
  return a! < b! ? -1 : a! > b! ? 1 : 0;
}

/**Compares the sort values of two rows by the columns of the sort, 0 when every column finds them equal */
export function list_sort_rows(
  sort: readonly { readonly desc: boolean }[],
  a: readonly ListSortValue[],
  b: readonly ListSortValue[],
): number {
  for (let i = 0; i < sort.length; i++) {
    const order = list_sort_compare(a[i], b[i]);
    if (order) return sort[i].desc ? -order : order;
  }
  return 0;
}

/**Icon of a column sorted in the direction, digits for a number column and letters for the rest */
export function list_sort_icon(desc: boolean, numeric: boolean): SVGFunc {
  if (numeric) return desc ? icon_sort_9_1_rounded : icon_sort_1_9_rounded;
  return desc ? icon_sort_z_a_rounded : icon_sort_a_z_rounded;
}
