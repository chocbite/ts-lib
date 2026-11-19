import {
  AccessTypes,
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import ctm from "#context_menu";
import list from "#list";
import { none, ok, some } from "@chocbite/ts-lib/result";
import state, { type State, type StateOrVal } from "@chocbite/ts-lib/state";
import type { CanvasPage, CanvasWidget } from "./data";
import { widget_id, widget_name } from "./ids";
import { clipboard_events, edit_lines } from "./clipboard";
import { delete_line, order_lines, remove_widgets } from "./order";
import { select_widget } from "./select";
import "./outline.scss";

/**Inputs of the outline*/
const OUTLINE = {
  /**Page whose widgets are listed, undefined lists nothing*/
  page: input_key<StateOrVal<CanvasPage | undefined>>(),
  /**Selected widgets, give the selection state of the viewports to share it
   * A click on a row selects only its widget, ctrl click and the checkboxes toggle, shift click selects a range, see the list:
   * a writable state is written, an initial value or no value is kept by the outline, a read only state can not be changed by the user*/
  selected: input_key<StateOrVal<readonly CanvasWidget[]>>(),
};
export type CanvasOutlineOptions = BaseOptions & InputOptions<typeof OUTLINE>;

/**A row of the outline, a widget of the page*/
interface OutlineRow {
  widget: CanvasWidget;
  id: string;
  /**Name of the definition of the widget*/
  name: string;
}

const WIDGETS_STATE = Symbol("widgets");

/**List of the widgets of a page, the widget in front first, with their id and the name of their widget
 * A click on a row selects its widget, the menu of a row cuts, copies, deletes or orders it on the page,
 * delete removes the selected ones, ctrl+x, ctrl+c and ctrl+v cut, copy and paste them through the clipboard of the system
 * The add row below opens the widget selector, the picked widgets are added in front, at the center of the page, and selected*/
class Outline extends Base {
  static element_name() {
    return "outline";
  }
  static element_name_space() {
    return "canvas";
  }

  #page: CanvasPage | undefined;
  #rows = state.ok_w<OutlineRow[]>([]);
  #list;
  /**The selected widgets now, for the menus*/
  #selected: readonly CanvasWidget[] = [];
  /**Symbol of the id state followed for every widget*/
  #ids = new Map<CanvasWidget, symbol>();
  /**Whether the rows are being applied, the id states attached then call back once each, the rows have the ids already*/
  #attaching = false;

  constructor() {
    super();
    //Ctrl+x, ctrl+c and ctrl+v of the focused outline, with the clipboard of the system
    clipboard_events(
      this,
      () => this.#page,
      () => this.#selected,
      (removed) => this.#deselect(removed),
      (pasted) => this.#select(pasted),
    );
    this.addEventListener("keydown", (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      const page = this.#page;
      const targets = this.#selected;
      if (page && targets.length)
        void remove_widgets(page, targets).then((done) => {
          if (done) this.#deselect(targets);
        });
    });
    this.#list = this.appendChild(
      list.container(
        {
          transform: (row: OutlineRow) =>
            ok({
              key_field: { text: row.id },
              values: { widget: row.name },
              //The menu acts on all selected widgets when the row is one of them, a right click does not select
              context_menu: () => {
                const page = this.#page;
                if (!page) return none();
                const targets = this.#selected.includes(row.widget)
                  ? this.#selected
                  : [row.widget];
                return some(
                  ctm.menu([
                    ...edit_lines(
                      page,
                      targets,
                      () => this.#deselect(targets),
                      (pasted) => this.#select(pasted),
                    ),
                    delete_line(page, targets, () => this.#deselect(targets)),
                    ctm.divider(),
                    ...order_lines(page, targets),
                  ]),
                );
              },
            }),
          //A key column for the ids
          sub_rows: true,
          headless: true,
          selection: { mode: "multi", key: (row: OutlineRow) => row.widget },
        },
        {
          columns: { widget: list.column_string("Widget", { align: "left" }) },
          rows: this.#rows,
        },
      ),
    );
  }

  set(options: CanvasOutlineOptions): this {
    super.set(options);
    this.set_input(OUTLINE.page, options.page, (page) =>
      this.#show(page.ok ? page.value : undefined),
    );
    //The list does the selecting, an initial value is put in a state of the outline, so the menus see the changes
    const given = options.selected;
    if (given !== undefined) {
      const selected = state.is.state(given)
        ? given
        : state.ok_w<CanvasWidget[]>([...given]);
      //The list writes array instructions to the state, it never keeps the array it reads
      this.#list.set({ selected: selected as State<CanvasWidget[]> });
      this.set_input(OUTLINE.selected, selected, (value) => {
        this.#selected = value.ok ? value.value : [];
      });
    }
    return this;
  }

  /**Selects the widgets, like pasted ones, a selection the outline can not write is left*/
  #select(widgets: readonly CanvasWidget[]) {
    const selected = this.input_state(OUTLINE.selected);
    if (selected?.writable) void selected.write?.([...widgets]);
  }

  /**Takes removed widgets out of the selection, a selection the outline can not write keeps them*/
  #deselect(widgets: readonly CanvasWidget[]) {
    const selected = this.input_state(OUTLINE.selected);
    if (!selected?.writable) return;
    const left = this.#selected.filter((widget) => !widgets.includes(widget));
    if (left.length !== this.#selected.length) void selected.write?.(left);
  }

  /**Adds the widgets picked in the widget selector in front, centered on the page, and selects them*/
  async #add() {
    const page = this.#page;
    const widgets = page?.widgets;
    if (!page || !state.is.state(widgets) || !widgets.writable) return;
    const size = (value: StateOrVal<number> | undefined, fallback: number) => {
      if (!state.is.state(value)) return value ?? fallback;
      const now = value.rsync ? value.get() : undefined;
      return now?.ok ? now.value : fallback;
    };
    const picked = await select_widget({
      mode: "multi",
      at: { x: size(page.width, 1920) / 2, y: size(page.height, 1080) / 2 },
    });
    if (!picked.length) return;
    //Centered, the selector places the top left corner
    for (const widget of picked) {
      const options = widget.options as Record<
        string,
        State<unknown, any, any> | undefined
      >;
      const half = (key: string) => {
        const value = options[key]?.rsync ? options[key].get() : undefined;
        return value?.ok && typeof value.value === "number"
          ? value.value / 2
          : 0;
      };
      for (const [key, length] of [
        ["x", "width"],
        ["y", "height"],
      ] as const) {
        const value = options[key]?.rsync ? options[key].get() : undefined;
        if (value?.ok && typeof value.value === "number")
          void options[key]?.write?.(value.value - half(length));
      }
    }
    await widgets.write?.(state.a.write.push<CanvasWidget>(...picked));
    const selected = this.input_state(OUTLINE.selected);
    if (selected?.writable) void selected.write?.(picked);
  }

  #show(page: CanvasPage | undefined) {
    this.#page = page;
    //Adding needs widgets the outline can write
    const writable = state.is.state(page?.widgets) && page.widgets.writable;
    this.#list.set({
      add_row: page
        ? {
            text: "Add widget",
            on_add: () => void this.#add(),
            access: writable ? AccessTypes.Write : AccessTypes.Read,
          }
        : null,
    });
    this.detach_state_from_symbol(WIDGETS_STATE);
    const widgets = page?.widgets;
    if (state.is.state(widgets))
      this.attach_state_to_symbol(WIDGETS_STATE, widgets, (result) =>
        this.#apply(result.ok ? result.value : []),
      );
    else this.#apply(widgets ?? []);
  }

  #row(widget: CanvasWidget): OutlineRow {
    return { widget, id: widget_id(widget), name: widget_name(widget) };
  }

  /**Applies the changes the widgets give to the rows, mirrored as the rows are in front first,
   * so a widget moved, added or removed moves, adds or removes only its row, see state_ui.a.apply*/
  #apply(widgets: readonly CanvasWidget[]) {
    const rows = this.#rows.array;
    this.#attaching = true;
    for (const change of state.a.read(widgets)) {
      //The index in the rows of the first of k widgets at index i, counted from the other end
      const at = (i: number, k: number) => rows.get.length - i - k;
      const mirrored = (items: readonly CanvasWidget[]) =>
        items.map((widget) => this.#row(widget)).reverse();
      switch (change.type) {
        case "fresh":
          this.#rows.set_ok(mirrored(change.items));
          break;
        case "added":
          rows.splice(
            rows.get.length - change.index,
            0,
            ...mirrored(change.items),
          );
          break;
        case "removed":
          rows.splice(
            at(change.index, change.items.length),
            change.items.length,
          );
          break;
        case "changed":
          rows.change(
            at(change.index, change.items.length),
            ...mirrored(change.items),
          );
          break;
        case "moved": {
          const k = change.items.length;
          rows.move(at(change.from_index, k), at(change.to_index, k), k);
          break;
        }
      }
    }
    this.#follow_ids(widgets);
    this.#attaching = false;
  }

  /**Follows the id of every widget, a changed id changes the row of the widget*/
  #follow_ids(widgets: readonly CanvasWidget[]) {
    const now = new Set(widgets);
    for (const [widget, symbol] of this.#ids)
      if (!now.has(widget)) {
        this.detach_state_from_symbol(symbol);
        this.#ids.delete(widget);
      }
    for (const widget of now) {
      if (this.#ids.has(widget)) continue;
      const id = (widget.options as Record<string, State<unknown> | undefined>)
        .id;
      if (!id) continue;
      const symbol = Symbol("id");
      this.#ids.set(widget, symbol);
      this.attach_state_to_symbol(symbol, id, () => {
        if (this.#attaching) return;
        const rows = this.#rows.ok();
        for (let i = 0; i < rows.length; i++)
          if (rows[i].widget === widget)
            this.#rows.array.change(i, this.#row(widget));
      });
    }
  }
}
define_element(Outline);

export type { Outline };

/**Creates an outline, a list of the widgets of a page sharing the selection with the viewports*/
export function canvas_outline(options: CanvasOutlineOptions = {}): Outline {
  return Outline.create(options);
}
