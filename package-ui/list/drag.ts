import { Base, define_element } from "#base";
import type { Option, Result } from "@chocbite/ts-lib/result";
import { state, type State, type StateREAW } from "@chocbite/ts-lib/state";
import "./drag.scss";
import type { ListWarn } from "./warn";

/**What moving needs from a row */
export interface ListMovableRow extends HTMLElement {
  readonly data: unknown;
  /**Moving of the list the row is in */
  readonly reorder: object | undefined;
  readonly parent_rows: unknown;
  readonly parent_row: ListMovableRow | undefined;
  readonly next_row: ListMovableRow | undefined;
  readonly first_sub_row: ListMovableRow | undefined;
  readonly movable: boolean;
  readonly droppable: boolean;
  readonly selected: boolean;
  readonly multi_selected: boolean;
  readonly label: string;
  readonly anchor: Element | undefined;
  readonly index: number;
  readonly openable: boolean;
  open: boolean;
  drop_rows(): unknown;
  focus_cell(): void;
}

type AnyRow = ListMovableRow;
type Rows = StateREAW<unknown[], Option<{}>, unknown[]>;

/**Lists that rows can be dragged between, rows are given from one list to another of the same group
 * The type is checked both ways, so only lists with exactly the same row type can join */
export class ListDragGroup<R> {
  declare readonly type: (value: R) => R;
}

/**Where rows are dropped, given to can_drop */
export interface ListDropTarget<R> {
  /**Row the rows become sub rows of, undefined for the top level */
  parent: R | undefined;
  /**List the rows are dropped in */
  list: HTMLElement;
}

export interface ListReorderOptions<R> {
  /**Lists of the same group can give rows to each other, without a group rows only move inside the list */
  group?: ListDragGroup<R>;
  /**Whether the row data can be dropped at the target, all dropped rows must be allowed for a drop */
  can_drop?(data: R, target: ListDropTarget<R>): boolean;
  /**Rows moved to another parent or list are only inserted there, not removed from where they came from
   * For apps that remove the rows themselves when they are added, set on the list the rows are dragged from
   * Moves inside one parent are still one move write */
  no_remove?: boolean;
}

/**Drag handle cell in front of a row, empty in the header */
export class ListDragField extends Base {
  static element_name() {
    return "dragfield";
  }
  static element_name_space() {
    return "list";
  }
}
define_element(ListDragField);

/**Place rows are dropped at, before or after a row, or into it as its last sub rows */
export interface ListDropPlace {
  row: AnyRow;
  mode: "before" | "after" | "into";
}

/**Pixels the pointer moves before a press on the handle becomes a drag */
const DRAG_THRESHOLD = 5;
/**Milliseconds hovering into a closed row before it opens */
const OPEN_DELAY = 600;
/**Thickness of the drop line in pixels, it is drawn inside the row it is about */
const LINE_WIDTH = 5;
/**Distance from the top or bottom edge of a list in pixels where dragging scrolls it */
const SCROLL_EDGE = 32;

/**A rows state that the list can write moves to */
function writable(rows: unknown): rows is Rows {
  return state.is.state(rows) && (rows as State<unknown>).writable;
}

/**Moving rows of a list by dragging their handle or with alt and the arrow keys
 * Like the selection, moves are only written to the rows states, the rows move when the states give the change back */
export class ListReorder<R> {
  readonly group: ListDragGroup<R>;
  readonly container: HTMLElement;
  #options: ListReorderOptions<R>;
  #warn: ListWarn;
  /**Shows where rows are dropped in this list */
  #indicator: HTMLSpanElement;

  constructor(
    container: HTMLElement,
    options: ListReorderOptions<R>,
    warn: ListWarn,
  ) {
    this.container = container;
    this.group = options.group ?? new ListDragGroup<R>();
    this.#options = options;
    this.#warn = warn;
    this.#indicator = container.appendChild(document.createElement("span"));
    this.#indicator.className = "list-drop";
    this.#indicator.hidden = true;
  }

  /**Makes the handle cell of a row */
  handle(row: AnyRow): ListDragField {
    const handle = new ListDragField();
    handle.onpointerdown = (e) => this.#press(row, handle, e);
    return handle;
  }

  //      _____  _____            _____
  //     |  __ \|  __ \     /\   / ____|
  //     | |  | | |__) |   /  \ | |  __
  //     | |  | |  _  /   / /\ \| | |_ |
  //     | |__| | | \ \  / ____ \ |__| |
  //     |_____/|_|  \_\/_/    \_\_____|

  #press(row: AnyRow, handle: ListDragField, e: PointerEvent) {
    if (e.button !== 0 || !row.movable) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const start_x = e.clientX;
    const start_y = e.clientY;
    let x = start_x;
    let y = start_y;
    let rows: AnyRow[] | undefined;
    let place: ListDropPlace | undefined;
    let shown: ListReorder<R> | undefined;
    let frame = 0;
    let open_timer = 0;
    let open_row: AnyRow | undefined;
    const label = document.createElement("span");
    label.className = "list-drag-label";

    const update = () => {
      frame = requestAnimationFrame(update);
      this.#scroll(x, y);
      const next = this.#place(x, y, rows!);
      shown?.indicate(undefined);
      shown = next?.row.reorder as ListReorder<R> | undefined;
      shown?.indicate(next);
      place = next;
      label.style.left = x + 12 + "px";
      label.style.top = y + 12 + "px";
      label.classList.toggle("none", !next);
      //Hovering into a closed row opens it after a moment
      const hover =
        next?.mode === "into" && !next.row.open ? next.row : undefined;
      if (hover !== open_row) {
        clearTimeout(open_timer);
        open_row = hover;
        if (hover)
          open_timer = window.setTimeout(() => (hover.open = true), OPEN_DELAY);
      }
    };
    const end = (drop: boolean) => {
      handle.onpointermove = null;
      handle.onpointerup = null;
      handle.onpointercancel = null;
      handle.onlostpointercapture = null;
      document.removeEventListener("keydown", escape, true);
      cancelAnimationFrame(frame);
      clearTimeout(open_timer);
      shown?.indicate(undefined);
      label.remove();
      if (!rows) return;
      for (const dragged of rows) dragged.classList.remove("dragging");
      if (drop && place) void this.#drop(rows, place);
    };
    const escape = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      end(false);
    };

    handle.onpointermove = (ev) => {
      x = ev.clientX;
      y = ev.clientY;
      if (rows) return;
      if (Math.hypot(x - start_x, y - start_y) < DRAG_THRESHOLD) return;
      rows = this.#dragged(row);
      for (const dragged of rows) dragged.classList.add("dragging");
      label.textContent =
        rows.length > 1 ? rows.length + " rows" : row.label || "1 row";
      //In the body, a list is a stacking context, so a label in it would be covered by the lists after it
      document.body.appendChild(label);
      document.addEventListener("keydown", escape, true);
      update();
    };
    handle.onpointerup = () => end(true);
    handle.onpointercancel = () => end(false);
    handle.onlostpointercapture = () => end(false);
  }

  /**Rows a drag from the row moves, the visible selected movable rows when the row is selected in multi mode
   * Sub rows of a dragged row move with it, so they are left out */
  #dragged(row: AnyRow): AnyRow[] {
    if (!row.selected || !row.multi_selected) return [row];
    const rows = [
      ...this.container.querySelectorAll<AnyRow>("list-row.selected.movable"),
    ].filter((selected) => selected.reorder === this);
    const dragged = new Set(rows);
    return rows.filter((selected) => {
      for (let parent = selected.parent_row; parent; parent = parent.parent_row)
        if (dragged.has(parent)) return false;
      return true;
    });
  }

  /**Scrolls the list under the pointer when the pointer is near its top or bottom edge */
  #scroll(x: number, y: number) {
    const list = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("list-container");
    const target = list ?? this.container;
    const rect = target.getBoundingClientRect();
    if (x < rect.left || x > rect.right) return;
    if (y < rect.top + SCROLL_EDGE)
      target.scrollTop -= Math.ceil((rect.top + SCROLL_EDGE - y) / 4);
    else if (y > rect.bottom - SCROLL_EDGE)
      target.scrollTop += Math.ceil((y - rect.bottom + SCROLL_EDGE) / 4);
  }

  //      _____  _____   ____  _____
  //     |  __ \|  __ \ / __ \|  __ \
  //     | |  | | |__) | |  | | |__) |
  //     | |  | |  _  /| |  | |  ___/
  //     | |__| | | \ \| |__| | |
  //     |_____/|_|  \_\\____/|_|

  /**The place under the pointer, undefined when the rows can not be dropped there */
  #place(x: number, y: number, rows: AnyRow[]): ListDropPlace | undefined {
    const element = document.elementFromPoint(x, y);
    let row = element?.closest<AnyRow>("list-row") ?? undefined;
    let mode: ListDropPlace["mode"];
    if (!row) {
      //Below the last row of a list drops after it
      const list = element?.closest<HTMLElement>("list-container");
      const last = list?.querySelector<AnyRow>(
        ":scope > div > div > list-row:last-child",
      );
      if (!last?.anchor || y < last.anchor.getBoundingClientRect().bottom)
        return undefined;
      row = last;
      mode = "after";
    } else {
      const rect = row.anchor?.getBoundingClientRect();
      if (!rect) return undefined;
      const part = (y - rect.top) / rect.height;
      if (row.openable)
        mode = part < 0.25 ? "before" : part > 0.75 ? "after" : "into";
      else mode = part < 0.5 ? "before" : "after";
    }
    const reorder = row.reorder as ListReorder<R> | undefined;
    if (reorder?.group !== this.group) return undefined;
    //After an open row is before its first sub row
    if (mode === "after" && row.open) {
      const first = row.first_sub_row;
      if (first) {
        row = first;
        mode = "before";
      }
    }
    const place: ListDropPlace = { row, mode };
    return reorder.#allowed(place, rows) ? place : undefined;
  }

  /**Whether the rows can be dropped at the place of this list */
  #allowed(place: ListDropPlace, rows: AnyRow[]): boolean {
    const parent = place.mode === "into" ? place.row : place.row.parent_row;
    if (place.mode !== "into" && rows.includes(place.row)) return false;
    //Not into itself or its own sub rows
    for (let up: AnyRow | undefined = parent; up; up = up.parent_row)
      if (rows.includes(up)) return false;
    if (place.mode === "into" ? !place.row.droppable : !place.row.movable)
      return false;
    const options = this.#options;
    if (!options.can_drop) return true;
    const target: ListDropTarget<R> = {
      parent: parent?.data as R | undefined,
      list: this.container,
    };
    return rows.every((row) => options.can_drop!(row.data as R, target));
  }

  /**Shows where rows are dropped in this list, undefined hides it */
  indicate(place: ListDropPlace | undefined) {
    const indicator = this.#indicator;
    const cell = place?.row.anchor;
    if (!place || !cell) {
      indicator.hidden = true;
      return;
    }
    const list = this.container;
    const box = list.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    const top = rect.top - box.top + list.scrollTop;
    //A line starts at the tree indent of the row, so the depth the rows land at shows,
    //after the last sub row of an open row and before the next row are at the same height
    const opener =
      place.mode === "into"
        ? undefined
        : place.row.querySelector(
            ":scope > div > list-keyfield > span:not(.text)",
          );
    const left =
      (opener ?? cell).getBoundingClientRect().left -
      box.left +
      list.scrollLeft;
    //Ends at the right edge of the rows, not the scroll width of the list, which includes the indicator itself,
    //rounded down so it never makes the list wider and flashes a scrollbar
    const grid = list.querySelector(":scope > div") ?? list;
    const right =
      grid.getBoundingClientRect().right - box.left + list.scrollLeft;
    indicator.hidden = false;
    indicator.className = "list-drop " + place.mode;
    indicator.style.left = left + "px";
    indicator.style.width = Math.max(Math.floor(right - left), 0) + "px";
    //Drawn inside the row it is about, at its top or bottom edge
    indicator.style.top =
      (place.mode === "after" ? top + rect.height - LINE_WIDTH : top) + "px";
    indicator.style.height =
      (place.mode === "into" ? rect.height : LINE_WIDTH) + "px";
  }

  //      __  __  ______      ________
  //     |  \/  |/ __ \ \    / /  ____|
  //     | \  / | |  | \ \  / /| |__
  //     | |\/| | |  | |\ \/ / |  __|
  //     | |  | | |__| | \  /  | |____
  //     |_|  |_|\____/   \/   |______|

  /**Writes the moves of the rows to the place, rows next to each other in one parent move with one write
   * Moving to another parent inserts first and removes after, so a failure can leave a row twice but never loses it */
  async #drop(rows: AnyRow[], place: ListDropPlace) {
    const errors: string[] = [];
    const into = place.mode === "into" ? place.row : undefined;
    //Rows are dropped in order before this row, undefined appends to the parent
    const before: AnyRow | undefined =
      place.mode === "before"
        ? place.row
        : place.mode === "after"
          ? place.row.next_row
          : undefined;
    const target_box =
      place.mode === "into" ? undefined : place.row.parentElement;
    const target_rows = into ? into.drop_rows() : place.row.parent_rows;
    if (!writable(target_rows)) return;
    for (const chunk of this.#chunks(rows)) {
      const first = chunk[0];
      const source_box = first.parentElement;
      const same = into ? first.parent_row === into : source_box === target_box;
      if (same) {
        const from = first.index;
        const end = before ? before.index : source_box!.childElementCount;
        const to = from < end ? end - chunk.length : end;
        if (from === to) continue;
        const result = await target_rows.write(
          state.a.write.move(from, to, chunk.length),
        );
        if (result.err) errors.push(result.error);
        continue;
      }
      const items = chunk.map((row) => row.data);
      const inserted: Result<void, string> = await target_rows.write(
        before
          ? state.a.write.splice(before.index, 0, ...items)
          : state.a.write.push(...items),
      );
      if (inserted.err) {
        errors.push(inserted.error);
        continue;
      }
      //The app already took the rows out of the source while inserting
      if (this.#options.no_remove || !first.parentElement) continue;
      const source_rows = first.parent_rows;
      if (!writable(source_rows)) continue;
      const removed = await source_rows.write(
        state.a.write.splice(first.index, chunk.length),
      );
      if (removed.err) errors.push(removed.error);
    }
    if (into && errors.length === 0) into.open = true;
    if (errors.length)
      (place.row.reorder as ListReorder<R> | undefined)?.warn(
        place.row,
        [...new Set(errors)].join("\n"),
      );
  }

  /**Splits rows in display order into runs of rows next to each other in one parent */
  #chunks(rows: AnyRow[]): AnyRow[][] {
    const chunks: AnyRow[][] = [];
    for (const row of rows) {
      const last = chunks[chunks.length - 1]?.at(-1);
      if (
        last &&
        last.parentElement === row.parentElement &&
        last.next_row === row
      )
        chunks[chunks.length - 1].push(row);
      else chunks.push([row]);
    }
    return chunks;
  }

  /**Shows why a move failed at the row, in the list of the row */
  warn(row: AnyRow, message: string) {
    this.#warn.show(row.anchor, message);
  }

  /**Moves the row one place up or down in its parent, from the keyboard, the row keeps the focus */
  async key_move(row: AnyRow, direction: -1 | 1) {
    const rows = row.parent_rows;
    if (!row.movable || !writable(rows)) return;
    const from = row.index;
    const to = from + direction;
    if (to < 0 || to >= row.parentElement!.childElementCount) return;
    const result = await rows.write(state.a.write.move(from, to, 1));
    //Moving takes the row out of the document for a moment, which loses the focus
    row.focus_cell();
    if (result.err) this.warn(row, result.error);
  }
}
