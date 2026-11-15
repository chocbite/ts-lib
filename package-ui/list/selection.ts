import { Base, define_element } from "#base";
import type { Result } from "@chocbite/ts-lib/result";
import { state, type StateREAW } from "@chocbite/ts-lib/state";
import "./selection.scss";

export interface ListSelectionOptions<R, K = R> {
  /**Single allows one selected row and shows radio buttons in front of the rows,
   * multi allows any amount and shows checkboxes, which toggle a row without modifier keys */
  mode: "single" | "multi";
  /**Identity of the data of a row, the selection is a list of these
   * Defaults to the data itself, give a key when rows can have equal data, like primitives
   * Keys must be unique among the rows of the list, sub rows included */
  key?: (data: R) => K;
}

/**What the selection needs from a row */
export interface ListSelectionRow {
  /**Shows the row as selected */
  selected: boolean;
  /**Cell to point at with a message about the row */
  readonly anchor: Element | undefined;
}

/**Selection of the rows of a list, kept in an array state of keys owned by the app
 * The list shows the keys of the state that have a visible row, and writes the state only on user actions,
 * keys of rows it does not show are left alone, except by select all and deselect all which replace the selection */
export class ListSelection<K> {
  readonly multi: boolean;
  readonly key: (data: any) => K;
  /**Called after a change of the shown selection or of the selectable rows */
  on_change?: () => void;
  /**Called when the state rejects a write, with the row the user acted on */
  on_error?: (row: ListSelectionRow | undefined, message: string) => void;
  /**State user actions are written to */
  target?: StateREAW<K[], any, K[]>;

  /**Element holding all rows of the list, sub rows included, in display order */
  #box: Element;
  #rows = new Map<K, ListSelectionRow & Element>();
  /**Mirror of the state array, the removed and changed entries of an update only give positions or new items */
  #keys: K[] = [];
  /**How often each key is in the state, a key that is in it twice stays selected when one is removed */
  #counts = new Map<K, number>();
  /**Amount of visible rows that are selected */
  #shown = 0;
  #anchor?: K;
  #batch = 0;
  #changed = false;

  constructor(options: ListSelectionOptions<any, K>, box: Element) {
    this.multi = options.mode === "multi";
    this.key = options.key ?? ((data) => data as K);
    this.#box = box;
  }

  /**Runs the function with the change notification delayed until all nested batches are done */
  batch<T>(func: () => T): T {
    this.#batch++;
    try {
      return func();
    } finally {
      if (--this.#batch === 0 && this.#changed) {
        this.#changed = false;
        this.on_change?.();
      }
    }
  }

  //      _____ _______    _______ ______
  //     / ____|__   __|/\|__   __|  ____|
  //    | (___    | |  /  \  | |  | |__
  //     \___ \   | | / /\ \ | |  |  __|
  //     ____) |  | |/ ____ \| |  | |____
  //    |_____/   |_/_/    \_\_|  |______|

  /**Applies a value of the state, only the changed keys are touched when the value carries its changes */
  apply(value: Result<readonly K[], string>) {
    this.batch(() => {
      if (!value.ok) {
        this.#fresh([]);
        return;
      }
      for (const change of state.a.read(value.value)) {
        if (change.type === "fresh") this.#fresh(change.items);
        else if (change.type === "added") {
          this.#keys.splice(change.index, 0, ...change.items);
          for (const key of change.items) this.#add(key);
        } else if (change.type === "removed") {
          for (const key of this.#keys.splice(
            change.index,
            change.items.length,
          ))
            this.#remove(key);
        } else if (change.type === "changed")
          change.items.forEach((key, i) => {
            const old = this.#keys[change.index + i];
            this.#keys[change.index + i] = key;
            this.#remove(old);
            this.#add(key);
          });
        else {
          const moved = this.#keys.splice(
            change.from_index,
            change.items.length,
          );
          this.#keys.splice(change.to_index, 0, ...moved);
        }
      }
    });
  }

  #fresh(keys: readonly K[]) {
    const old = this.#counts;
    this.#keys = [...keys];
    this.#counts = new Map();
    for (const key of keys)
      this.#counts.set(key, (this.#counts.get(key) ?? 0) + 1);
    for (const key of old.keys())
      if (!this.#counts.has(key)) this.#show(key, false);
    for (const key of this.#counts.keys())
      if (!old.has(key)) this.#show(key, true);
  }

  #add(key: K) {
    const count = this.#counts.get(key) ?? 0;
    this.#counts.set(key, count + 1);
    if (count === 0) this.#show(key, true);
  }

  #remove(key: K) {
    const count = this.#counts.get(key);
    if (!count) return;
    if (count > 1) this.#counts.set(key, count - 1);
    else {
      this.#counts.delete(key);
      this.#show(key, false);
    }
  }

  #show(key: K, selected: boolean) {
    const row = this.#rows.get(key);
    if (!row) return;
    row.selected = selected;
    this.#shown += selected ? 1 : -1;
    this.#changed = true;
  }

  /**Writes the state, a rejected write is reported at the row of the key the user acted on */
  #write(value: K[], key?: K) {
    const write = this.target?.write(value);
    if (!write) return;
    const row = key === undefined ? undefined : this.#rows.get(key);
    void write.then((result) => {
      if (result.err) this.on_error?.(row, result.error);
    });
  }

  //      _____   ______          _______
  //     |  __ \ / __ \ \        / / ____|
  //     | |__) | |  | \ \  /\  / / (___
  //     |  _  /| |  | |\ \/  \/ / \___ \
  //     | | \ \| |__| | \  /\  /  ____) |
  //     |_|  \_\\____/   \/  \/  |_____/

  /**Adds a visible row that can be selected, it shows whether its key is in the state */
  register(key: K, row: ListSelectionRow & Element) {
    this.#rows.set(key, row);
    row.selected = this.#counts.has(key);
    if (row.selected) this.#shown++;
    this.#changed = true;
  }

  /**Removes a row that is no longer visible or selectable, the state keeps its key */
  unregister(key: K, row: ListSelectionRow & Element) {
    if (this.#rows.get(key) === row) {
      this.#rows.delete(key);
      if (this.#counts.has(key)) this.#shown--;
    }
    row.selected = false;
    this.#changed = true;
  }

  /**Amount of visible rows that can be selected */
  get amount_selectable(): number {
    return this.#rows.size;
  }

  /**Amount of visible rows that are selected */
  get amount_selected(): number {
    return this.#shown;
  }

  is_selected(key: K): boolean {
    return this.#counts.has(key);
  }

  //      _    _  _____ ______ _____
  //     | |  | |/ ____|  ____|  __ \
  //     | |  | | (___ | |__  | |__) |
  //     | |  | |\___ \|  __| |  _  /
  //     | |__| |____) | |____| | \ \
  //      \____/|_____/|______|_|  \_\
  //Every user action writes the state, the rows show the change when the state gives it back

  /**Keys of the selectable rows from one row to another in display order, both included */
  #range(from: K, to: K): K[] {
    const keys: K[] = [];
    let inside = false;
    const rows = this.#box.querySelectorAll("list-row");
    const from_row = this.#rows.get(from);
    const to_row = this.#rows.get(to);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const edge = row === from_row || row === to_row;
      if (edge || inside) {
        const key = (row as unknown as { selection_key: K | undefined })
          .selection_key;
        if (key !== undefined && this.#rows.get(key) === row) keys.push(key);
      }
      if (edge) {
        if (inside || from_row === to_row) break;
        inside = true;
      }
    }
    return keys;
  }

  #select_range(to: K, add: boolean) {
    if (!this.#rows.has(to)) return;
    const anchor =
      this.#anchor !== undefined && this.#rows.has(this.#anchor)
        ? this.#anchor
        : to;
    const keys = this.#range(anchor, to);
    this.#anchor = anchor;
    if (!add) return this.#write(state.a.write.fresh(keys), to);
    const added = keys.filter((key) => !this.#counts.has(key));
    if (added.length) this.#write(state.a.write.push(...added), to);
  }

  /**Replaces the selection with only the row */
  select_only(key: K) {
    if (!this.#rows.has(key)) return;
    this.#anchor = key;
    if (this.#keys.length === 1 && this.#keys[0] === key) return;
    this.#write(state.a.write.fresh([key]), key);
  }

  /**Adds the row to the selection, in single mode it replaces the selection */
  select(key: K) {
    if (!this.multi) return this.select_only(key);
    if (!this.#rows.has(key)) return;
    this.#anchor = key;
    if (!this.#counts.has(key)) this.#write(state.a.write.push(key), key);
  }

  /**Removes the row from the selection */
  deselect(key: K) {
    if (this.#counts.has(key)) this.#write(state.a.write.delete(key), key);
  }

  /**Toggles the row, in single mode selecting replaces the selection */
  toggle(key: K) {
    if (!this.#rows.has(key)) return;
    if (this.#counts.has(key)) {
      this.#anchor = key;
      this.deselect(key);
    } else this.select(key);
  }

  /**Replaces the selection with all visible selectable rows, multi mode only */
  select_all() {
    if (this.multi) this.#write(state.a.write.fresh([...this.#rows.keys()]));
  }

  /**Clears the selection, also of keys without a visible row */
  clear() {
    if (this.#keys.length) this.#write(state.a.write.fresh([]));
  }

  /**Click on the checkbox or radio button of a row */
  check_click(key: K) {
    if (this.multi) this.toggle(key);
    else this.select_only(key);
  }

  /**Click on a row outside its checkbox or radio button */
  click(key: K, e: MouseEvent) {
    if (this.multi && e.shiftKey)
      this.#select_range(key, e.ctrlKey || e.metaKey);
    else if (e.ctrlKey || e.metaKey) this.toggle(key);
    else this.select_only(key);
  }

  /**Focus moved to a row with the arrow keys, only shift in multi mode extends the range, otherwise the focus moves alone and space selects */
  focus_moved(key: K, e: KeyboardEvent) {
    if (this.multi && e.shiftKey)
      this.#select_range(key, e.ctrlKey || e.metaKey);
  }

  /**Handles selection keys pressed on a row, returns true when the key was used */
  key_down(key: K | undefined, e: KeyboardEvent): boolean {
    if (e.key === " ") {
      if (key === undefined) return true;
      if (this.multi || e.ctrlKey || e.metaKey) this.toggle(key);
      else this.select_only(key);
    } else if (e.key === "Escape") this.clear();
    else if (this.multi && (e.ctrlKey || e.metaKey) && e.key === "a")
      this.select_all();
    else return false;
    return true;
  }
}

/**Checkbox or radio button cell in front of a row or in the header, its look comes from the selected class of the row or the header */
export class ListCheckField extends Base {
  static element_name() {
    return "checkfield";
  }
  static element_name_space() {
    return "list";
  }
}
define_element(ListCheckField);
