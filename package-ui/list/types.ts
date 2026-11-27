import type { Base, BaseIntersectObserver } from "#base";
import type { ContextMenu, ContextMenuLines } from "#context_menu";
import type { SVGFunc } from "#svg";
import { type Option, type Result } from "@chocbite/ts-lib/result";
import type { State, StateOrVal } from "@chocbite/ts-lib/state";
import list from ".";
import type { ListTextField } from "./field";
import type { ListRow, ListRowOptions } from "./row";
import type { ListReorder } from "./drag";
import type { ListSearchQuery, ListSearchValue } from "./search";
import type { ListSelection } from "./selection";

/**Rows of a list or of the sub rows of a row, a fixed array or an array state*/
export type ListType<R> = StateOrVal<R[]>;

export type ListTypeExtract<A extends ListType<any>> = A extends (infer U)[]
  ? U
  : A extends State<(infer U)[]>
    ? U
    : never;

/**Rows of a row parent, the top level rows or sub rows, which can be an array or a state regardless of the top level rows */
export type ListParentRows<A extends ListType<any>> =
  A | ListType<ListTypeExtract<A>>;

export const ListDataType = {
  number: "number",
  string: "string",
  bool: "bool",
  enum: "enum",
} as const;
export type ListDataType = (typeof ListDataType)[keyof typeof ListDataType];

export type ListColumnAlign = "left" | "center" | "right";

/**Choices of an enum column by value, with the name each is shown by, like the list of an enum of the state module
 * The values are the keys, so they are strings, a number value of a row matches the key it is written as*/
export type ListEnumChoices = {
  readonly [value: string]: { readonly name: string; readonly icon?: SVGFunc };
};

/**Options of a column, its fields can be any element, like the list fields or form elements*/
export interface ListColumnOptions<V, C extends Base> {
  /**Initial width of the column in rem, auto when undefined, ignored in a headless list as nothing can resize it*/
  init_width?: number;
  /**If the column has a fixed width in rem, overrides init_width and disables resizing*/
  fixed_width?: number | "min" | "max";
  /**Initial order of the column, lower numbers appear first, will order by column object if undefined
   * A column without order uses its position in the column object as order*/
  order?: number;
  /**Whether the column is reorderable by the user*/
  reorderable?: boolean;
  /**Data type of the values, decides the cell of the column in the column search, without it the column has none
   * The column search compares the value the search reads, see search_value*/
  type?: ListDataType;
  /**Choices of a column of the enum type, the cell of the column search lets the user pick from them, and the search text matches their names*/
  choices?: ListEnumChoices;
  /**Horizontal alignment of the title and the fields, center when undefined
   * Text, number and node fields follow it, more complex fields like form fields do not */
  align?: ListColumnAlign;
  /**Column title*/
  title: string;
  /**Generates the field element, only called during row or column creation */
  field_gen(): C;
  /**Applies the value to the field */
  field_apply(field: C, value: V): void;
  /**The value of the column the search of the list looks at, for values it can not read itself, like an object a node field shows
   * Without it a string, number or boolean is used as it is, a sync state of one by its value, and anything else is left out
   * Strings and numbers are matched as text, return undefined to leave the column out of the search */
  search_value?(value: V): ListSearchValue;
}

/**Helper to create a column object */
export function column<V, C extends Base>(
  options: ListColumnOptions<V, C>,
): ListColumnOptions<V, C> {
  return options;
}

/**Special helper to create a string value column */
export function column_string(
  /**Column title*/
  title: string,
  options?: { align?: ListColumnAlign },
): ListColumnOptions<string, ListTextField> {
  return {
    title,
    type: ListDataType.string,
    align: options?.align,
    field_gen: () => list.text_field(),
    field_apply: (field, value) => (field.text = value),
  };
}

/**Transforms the data of a row into row options
 * Returning an error makes the row invalid, the error text then replaces the fields of the row
 * An invalid row is for failures with no other options, so it has no sub rows, add row or context menu */
export type ListRowTransformer<
  R,
  T extends {},
  A extends ListType<any>,
  S extends boolean,
> = (
  /**Data of the row */
  data: R,
  /**The row the options are for */
  row: ListRow<R, T, A, S>,
  /**Rows the data is from, sub rows can come from an array or a state regardless of the top level rows */
  state: S extends true ? A | ListType<R> : A,
) => Result<ListRowOptions<R, T, S>, string>;

export interface ListRoot<
  R,
  T extends {},
  A extends ListType<any>,
  S extends boolean,
> {
  /**Sub rows */
  readonly sub_rows: S;
  /**Columns options mapped by column key */
  readonly columns: Map<keyof T, ListColumnOptions<T[keyof T], Base>>;
  /**Order of visible columns by column key */
  columns_visible: (keyof T)[];
  /**Function to transform a row data into row options */
  transform: ListRowTransformer<R, T, A, S>;
  /**Observer for the container if observer is active */
  observer?: BaseIntersectObserver;
  /**Selection of rows, when enabled */
  selection?: ListSelection<any>;
  /**Moving of rows, when enabled */
  reorder?: ListReorder<R>;
  /**The search of the list, undefined while it does not search */
  search?: ListSearchQuery;
  /**Runs the function with the rows the search opens waiting, they open breadth first once the outermost hold ends, see search_queue */
  search_hold<F>(func: () => F): F;
  /**Opens a row the search found something below, once the running hold ends or right away without one, breadth first and a limited amount at a time */
  search_queue(row: ListRow<R, T, A, S>): void;
  /**Whether the list has lines of its own for its menus, with sub rows, in multi mode or with search_menu
   * Set once the list is built, without them the menu of the list has no lines and opens nothing */
  has_menu: boolean;
  /**Open all, and close all while a row is open, with sub rows */
  open_all_lines(): ContextMenuLines;
  /**Select all and deselect all in multi mode */
  select_all_lines(): ContextMenuLines;
  /**Lines of the menus of the list to search the columns and clear the search, empty without search_menu */
  search_lines(): ContextMenuLines;
  /**The menu of the list, its lines in groups, for right clicks on the list where nothing has a menu of its own, none without lines */
  menu(): Option<ContextMenu>;
  /**Opens every openable row, a limited amount of rows at a time */
  open_all(): void;
  /**Closes every open row */
  close_all(): void;
}

export interface ListRowParent<A extends ListType<any>> {
  /**Sub row depth */
  readonly depth: number;
  /**Whether the row is open to show sub rows */
  open: boolean;
  /**Selects the adjacent row in the given direction */
  select_adjacent(
    direction: "next" | "previous" | "p_next" | "p_previous" | "last",
    field: Option<number>,
  ): void;
  /**Rows of the parent, the rows of the container or the sub rows of a row */
  state: ListParentRows<A>;
  /**Handles a key pressed in the key field before the key field does, returns true when the key was used */
  key_down?(e: KeyboardEvent): boolean;
}
