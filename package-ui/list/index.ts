import { list_errors } from "./errors";
import { container } from "./container";
import { ListDragGroup } from "./drag";
import { node_field, number_field, text_field } from "./field";
import { column, column_string } from "./types";

export const list = {
  /**The kinds of the NiceErrors the list makes, like list.errors.NOT_SELECTABLE*/
  errors: list_errors,
  column,
  column_string,
  container,
  text_field,
  number_field,
  node_field,
  /**Group of lists that can give rows to each other by dragging, all lists of a group must have the same row type */
  drag_group<R>(): ListDragGroup<R> {
    return new ListDragGroup<R>();
  },
};

export { ListField } from "./field";
export type { ListDragGroup, ListDropTarget, ListReorderOptions } from "./drag";
export type {
  ListColumns,
  ListContainer,
  ListContainerConfig,
  ListContainerOptions,
} from "./container";
export type { ListAddRowOptions } from "./add_row";
export type { ListDataType, ListEnumChoices } from "./types";
export type {
  ListCondition,
  ListFilter,
  ListFilterGroup,
  ListFilterItem,
  ListFilterMode,
  ListNumberOperator,
  ListRangeCondition,
  ListRangeOperator,
  ListStringOperator,
  ListSearchFound,
  ListSearchQuery,
  ListSearchResult,
  ListSearchShown,
  ListSearchValue,
  ListSearchValues,
} from "./search";
export type {
  ListSort,
  ListSortDirection,
  ListSortKey,
  ListSortValue,
} from "./sort";

export default list;
