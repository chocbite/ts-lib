import { ListRow } from "../row";

type AnyRow = ListRow<any, any, any, any>;

/**The row and what follows it in the flat row box of the list, its sub rows, their errors and add rows and its own,
 * up to the next element at its depth or above, a following row or the add row of its parent */
export function row_block(row: AnyRow): Element[] {
  const block: Element[] = [row];
  for (
    let next = row.nextElementSibling;
    next && !((next as Partial<AnyRow>).depth! <= row.depth);
    next = next.nextElementSibling
  )
    block.push(next);
  return block;
}

/**The first element matching the selector in the row or in what follows it, see row_block */
export function in_block(row: AnyRow, selector: string): Element | null {
  for (const element of row_block(row)) {
    if (element.matches(selector)) return element;
    const inner = element.querySelector(selector);
    if (inner) return inner;
  }
  return null;
}

/**The sub rows of the row shown in the row box, in order */
export function sub_rows_of(row: AnyRow): AnyRow[] {
  return row_block(row).filter(
    (element): element is AnyRow =>
      element instanceof ListRow && element.parent_row === row,
  );
}
