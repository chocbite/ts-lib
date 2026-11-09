import type { BaseIntersectObserver } from "#base";
import { type Option, type Result } from "@chocbite/ts-lib/result";
import type { State } from "@chocbite/ts-lib/state";
import list from ".";
import type { ListField, ListTextField } from "./field";
import type { ListRow, ListRowOptions } from "./row";

export type ListType<R> = R[] | State<R[]>;

export type ListTypeExtract<A extends ListType<any>> = A extends (infer U)[]
  ? U
  : A extends State<(infer U)[]>
    ? U
    : never;

/**Rows of a row parent, the top level rows or sub rows, which can be an array or a state regardless of the top level rows */
export type ListParentRows<A extends ListType<any>> =
  | A
  | ListType<ListTypeExtract<A>>;

export const ListDataType = {
  number: "number",
  string: "string",
  bool: "bool",
} as const;
export type ListDataType = (typeof ListDataType)[keyof typeof ListDataType];

export type ListColumnAlign = "left" | "center" | "right";

export interface ListColumnOptions<V, C extends ListField> {
  /**Initial width of the column in rem, auto when undefined*/
  init_width?: number;
  /**If the column has a fixed width in rem, overrides init_width and disables resizing*/
  fixed_width?: number | "min" | "max";
  /**Initial order of the column, lower numbers appear first, will order by column object if undefined
   * A column without order uses its position in the column object as order*/
  order?: number;
  /**Whether the column is reorderable by the user*/
  reorderable?: boolean;
  /**Data type of the column, used for sorting, will attempt auto detect if undefined*/
  type?: ListDataType;
  /**Horizontal alignment of the title and the fields, center when undefined
   * Text, number and node fields follow it, more complex fields like form fields do not */
  align?: ListColumnAlign;
  /**Column title*/
  title: string;
  /**Generates the field element, only called during row or column creation */
  field_gen(): C;
  /**Applies the value to the field */
  field_apply(field: C, value: V): void;
}

/**Helper to create a column object */
export function column<V, C extends ListField>(
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
  readonly columns: Map<keyof T, ListColumnOptions<T[keyof T], ListField>>;
  /**Order of visible columns by column key */
  columns_visible: (keyof T)[];
  /**Function to transform a row data into row options */
  transform: ListRowTransformer<R, T, A, S>;
  /**Observer for the container if observer is active */
  observer?: BaseIntersectObserver;
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
}
