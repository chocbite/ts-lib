import { container } from "./container";
import { ListDragGroup } from "./drag";
import { node_field, number_field, text_field } from "./field";
import { column, column_string } from "./types";

export const list = {
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

export default list;
