import { state } from "@chocbite/ts-lib/state";
import type { ListRow } from "./row";
import { list_sort_rows } from "./sort";
import type { ListRoot, ListType } from "./types";

/**The first row from the index on in the direction that the search does not hide */
export function list_rows_shown<
  R,
  T extends {},
  A extends ListType<R>,
  S extends boolean,
>(
  rows: readonly ListRow<R, T, A, S>[],
  index: number,
  direction: 1 | -1,
): ListRow<R, T, A, S> | undefined {
  while (rows[index]?.search_hidden) index += direction;
  return rows[index];
}

/**Which entries of the sequence are in a longest run of it that only goes up, entries below 0 never are
 * The rows of such a run of their old places keep their order, so only the others are moved
 * @param through an entry the run must have, the runs through it are the runs of the entries before it below it and the entries after it above it */
function list_rising(sequence: readonly number[], through = -1): boolean[] {
  const at = sequence[through] ?? -1;
  if (at >= 0)
    sequence = sequence.map((value, i) =>
      i === through ||
      (i < through && value < at) ||
      (i > through && value > at)
        ? value
        : -1,
    );
  const keep = new Array<boolean>(sequence.length).fill(false);
  //The entry ending the run of each length with the smallest last value, and the entry before each in its run
  const ends: number[] = [];
  const before = new Array<number>(sequence.length);
  for (let i = 0; i < sequence.length; i++) {
    const value = sequence[i];
    if (value < 0) continue;
    let low = 0;
    let high = ends.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sequence[ends[middle]] < value) low = middle + 1;
      else high = middle;
    }
    before[i] = low > 0 ? ends[low - 1] : -1;
    ends[low] = i;
  }
  for (let i = ends.length ? ends[ends.length - 1] : -1; i >= 0; i = before[i])
    keep[i] = true;
  return keep;
}

/**The rows of a parent, the top rows of the list or the sub rows of a row, in the order of the data and in the order shown
 * The list has one flat row box, every row is in it followed by its sub rows, its error and its add row, so the box has the rows in the order they are shown
 * and the rows can alternate their backgrounds over every row shown
 * The rows of a row are in the box while the row is, a row made with sub rows, like one opened by its data, brings them along when it is put in the box
 * While the list sorts the rows are shown in the order of the sort, otherwise in the order of the data
 * Shared by the list for its top rows and by the rows for their sub rows, a row makes it once it first has sub rows*/
export class ListRowGroup<
  R,
  T extends {},
  A extends ListType<R>,
  S extends boolean,
> {
  readonly #root: ListRoot<R, T, A, S>;
  /**Makes the row for data, a row of the parent */
  readonly #make: (data: R) => ListRow<R, T, A, S>;
  /**The row the rows follow, undefined for the top rows */
  readonly #after?: ListRow<R, T, A, S>;
  /**The row box the top rows start */
  readonly #start?: HTMLElement;
  readonly #rows: ListRow<R, T, A, S>[] = [];
  /**The rows in the order shown, the same array as the rows while the list does not sort */
  #shown: ListRow<R, T, A, S>[] = this.#rows;
  /**Whether an add row follows the rows, then none of them is the last */
  #tail = false;
  #last?: ListRow<R, T, A, S>;

  /**@param make makes the row for data, with the parent of the rows
   * @param place the row of the parent the rows follow, or the row box the top rows of the list start */
  constructor(
    root: ListRoot<R, T, A, S>,
    make: (data: R) => ListRow<R, T, A, S>,
    place: { after: ListRow<R, T, A, S> } | { start: HTMLElement },
  ) {
    this.#root = root;
    this.#make = make;
    if ("after" in place) this.#after = place.after;
    else this.#start = place.start;
  }

  /**The rows in the order of the data */
  get rows(): readonly ListRow<R, T, A, S>[] {
    return this.#rows;
  }

  /**The rows in the order shown, the order of the sort while the list sorts */
  get shown(): readonly ListRow<R, T, A, S>[] {
    return this.#shown;
  }

  /**Whether the rows are in the row box, the rows of a row are only while the row is
   * A removed row is in a fragment that is dropped, so its parent is no element */
  get #placed(): boolean {
    return !this.#after || this.#after.parentElement !== null;
  }

  /**The last node of the rows and what follows them, undefined without rows */
  end(): ChildNode | undefined {
    return this.#shown.at(-1)?.block_end();
  }

  /**Puts the rows with what follows each into the node, see block_nodes of the row */
  nodes(into: DocumentFragment) {
    for (const row of this.#shown) row.block_nodes(into);
  }

  /**Whether an add row follows the rows */
  set tail(tail: boolean) {
    if (tail === this.#tail) return;
    this.#tail = tail;
    this.last_update();
  }

  /**Marks the last row the search shows as the last, unless an add row follows the rows */
  last_update() {
    let last: ListRow<R, T, A, S> | undefined;
    if (!this.#tail)
      last = list_rows_shown(this.#shown, this.#shown.length - 1, -1);
    if (last === this.#last) return;
    if (this.#last) this.#last.last = false;
    this.#last = last;
    if (last) last.last = true;
  }

  /**Applies the data of the rows, arrays from array states carry what changed, so only the changed rows are touched, a plain array reuses the rows in order
   * Removed rows leave the selection, which updates once after all changes,
   * rows the search opens wait until all rows are applied, so the search opens breadth first instead of deep into the first row
   * While the list sorts the rows are put in their places once all changes are applied */
  apply(data: readonly R[]) {
    const apply = () => {
      const sorted = this.#root.sort !== undefined;
      for (const change of state.a.read(data)) {
        switch (change.type) {
          case "fresh": {
            const reused = Math.min(this.#rows.length, change.items.length);
            for (let i = 0; i < reused; i++)
              this.#rows[i].data = change.items[i];
            this.#remove(reused, this.#rows.length - reused);
            this.#add(reused, change.items.slice(reused), sorted);
            break;
          }
          case "added":
            this.#add(change.index, change.items, sorted);
            break;
          case "removed":
            this.#remove(change.index, change.items.length);
            break;
          case "changed":
            for (let i = 0; i < change.items.length; i++) {
              const row = this.#rows[change.index + i];
              if (row) row.data = change.items[i];
            }
            break;
          case "moved": {
            const moved = this.#rows.splice(
              change.from_index,
              change.items.length,
            );
            this.#rows.splice(change.to_index, 0, ...moved);
            if (!sorted) this.#place(change.to_index, moved);
            break;
          }
        }
      }
      if (sorted) this.#order();
      this.last_update();
    };
    const root = this.#root;
    root.search_hold(() =>
      root.selection ? root.selection.batch(apply) : apply(),
    );
  }

  /**Applies a changed sort of the list to the rows and the rows below them, every row reads its values for it again */
  sort_update() {
    for (const row of this.#rows) row.sort_update();
    this.#order();
    this.last_update();
  }

  /**Puts the rows in their places after the values of some of them changed, see sort_settle of the row */
  sort_order() {
    this.#order();
    this.last_update();
  }

  #add(index: number, data: readonly R[], sorted: boolean) {
    if (!data.length) return;
    const rows = data.map(this.#make);
    if (index >= this.#rows.length)
      for (const row of rows) this.#rows.push(row);
    else this.#rows.splice(index, 0, ...rows);
    //Sorted rows are placed by their order
    if (!sorted) this.#place(index, rows);
  }

  #remove(index: number, count: number) {
    if (count <= 0) return;
    const removed = this.#rows.splice(index, count);
    //Appending to a fragment that is dropped takes them out of the row box
    const out = document.createDocumentFragment();
    for (const row of removed) {
      row.selection_leave();
      row.block_nodes(out);
    }
  }

  /**Puts the rows, which are at the index in the rows, into the row box with what follows each, before the next row or after the previous
   * Only while the list does not sort, so the rows are shown in the order of the data */
  #place(index: number, rows: readonly ListRow<R, T, A, S>[]) {
    if (!rows.length || !this.#placed) return;
    const nodes = document.createDocumentFragment();
    for (const row of rows) row.block_nodes(nodes);
    const next = this.#rows[index + rows.length];
    if (next) {
      next.before(nodes);
      return;
    }
    const previous = index > 0 ? this.#rows[index - 1].block_end() : undefined;
    if (previous) previous.after(nodes);
    else if (this.#after) this.#after.after(nodes);
    else this.#start!.prepend(nodes);
  }

  /**Shows the rows in the order of the sort of the list, or in the order of the data while it does not sort
   * Rows the sort finds equal keep the order of the data */
  #order() {
    const sort = this.#root.sort;
    if (!sort) {
      if (this.#shown === this.#rows) return;
      this.#arrange(this.#rows);
      this.#shown = this.#rows;
      return;
    }
    const index = new Map<ListRow<R, T, A, S>, number>();
    for (let i = 0; i < this.#rows.length; i++) index.set(this.#rows[i], i);
    //Starting from the order shown, which is mostly sorted already, so the sort has little to do
    const order = this.#shown.filter((row) => index.has(row));
    if (order.length < this.#rows.length) {
      const had = new Set(order);
      for (const row of this.#rows) if (!had.has(row)) order.push(row);
    }
    order.sort(
      (a, b) =>
        list_sort_rows(sort, a.sort_values, b.sort_values) ||
        index.get(a)! - index.get(b)!,
    );
    this.#arrange(order);
    this.#shown = order;
  }

  /**Moves the rows in the row box into the order, the rows shown are in the order shown before, rows not in it yet are not in the row box
   * The longest run of rows that keeps its order stays, so a changed row moves alone, the rest move one block at a time
   * A row with the focus in or below it is in the run, as moving it out of the row box would take the focus away */
  #arrange(order: readonly ListRow<R, T, A, S>[]) {
    if (!this.#placed) return;
    const was = new Map<ListRow<R, T, A, S>, number>();
    for (let i = 0; i < this.#shown.length; i++) was.set(this.#shown[i], i);
    const focus = this.#root.focus_rows;
    const keep = list_rising(
      order.map((row) => was.get(row) ?? -1),
      focus.size ? order.findIndex((row) => focus.has(row)) : -1,
    );
    let previous: ChildNode | undefined;
    for (let i = 0; i < order.length; i++) {
      const row = order[i];
      if (!keep[i]) {
        const nodes = document.createDocumentFragment();
        row.block_nodes(nodes);
        if (previous) previous.after(nodes);
        else if (this.#after) this.#after.after(nodes);
        else this.#start!.prepend(nodes);
      }
      previous = row.block_end();
    }
  }
}
