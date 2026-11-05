import type { BaseIntersectObserver } from "#base";
import { type Option } from "@chocbite/ts-lib/result";
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

export const ListDataType = {
  number: "number",
  string: "string",
  bool: "bool",
} as const;
export type ListDataType = (typeof ListDataType)[keyof typeof ListDataType];

export interface ListColumnOptions<V, C extends ListField> {
  /**Initial width of the column in rem, auto when undefined*/
  init_width?: number;
  /**If the column has a fixed width in rem, overrides init_width and disables resizing*/
  fixed_width?: number | "min" | "max";
  /**Initial order of the column, lower numbers appear first, will order by column object if undefined*/
  order?: number;
  /**Whether the column is reorderable by the user*/
  reorderable?: boolean;
  /**Data type of the column, used for sorting, will attempt auto detect if undefined*/
  type?: ListDataType;
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
): ListColumnOptions<string, ListTextField> {
  return {
    title,
    field_gen: () => list.text_field(),
    field_apply: (field, value) => (field.text = value),
  };
}

export type ListRowTransformer<
  R,
  T extends {},
  A extends ListType<any>,
  S extends boolean,
> = (
  /**Test */
  data: R,
  row: ListRow<R, T, A, S>,
  state: A,
) => ListRowOptions<R, T, S>;

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
  /**State associated with the row parent, if state is used */
  state: A;
}
