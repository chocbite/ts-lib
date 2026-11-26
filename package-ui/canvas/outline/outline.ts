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
import { ok, some, type ResultNice } from "@chocbite/ts-lib/result";
import state, {
  type State,
  type StateOrVal,
  type StateROS,
} from "@chocbite/ts-lib/state";
import {
  CanvasGroup,
  CanvasWidget,
  path_of,
  type CanvasPage,
  type CanvasWidgetData,
} from "../data";
import { clipboard_events, edit_lines } from "../clipboard";
import {
  is_page,
  selected_widgets,
  selection_of,
  selection_rotation,
  type CanvasSelection,
} from "../selection";
import { group_key, group_lines } from "../group_widget";
import { option_now, value_now } from "../now";
import { delete_line, order_lines, remove_widgets } from "../order";
import { select_widget } from "../select";
import type { OutlineItem } from "./item";
import "./outline.scss";

/**Inputs of the outline*/
const OUTLINE = {
  /**Page listed as the root row, its widgets below it, undefined lists nothing*/
  page: input_key<StateOrVal<CanvasPage | undefined>>(),
  /**Selected items, widgets or the page, give the selection state of the viewports to share it, a CanvasSelection is given as it is
   * A click on a row selects only its widget or page, ctrl click and the checkboxes toggle, shift click selects a range, see the list:
   * a writable state is written, an initial value or no value is kept by the outline, a read only state can not be changed by the user*/
  selected: input_key<StateOrVal<CanvasSelection>>(),
};
export type CanvasOutlineOptions = BaseOptions & InputOptions<typeof OUTLINE>;

/**A row of the outline, an item and the level it is on*/
interface OutlineRow {
  item: OutlineItem;
  /**The level the item is on, for the root row the level of its items*/
  level: OutlineLevel;
  /**The root row, opened at first, its sub rows the rows of its level*/
  root?: boolean;
}

/**Whether an item is a widget, the menus and keys act on widgets*/
const is_widget = (item: OutlineItem): item is CanvasWidget =>
  item instanceof CanvasWidget;

const LIST_SELECTED = Symbol("list selected");

/**Whether two lists have the same items, in any order*/
const same_items = (a: readonly OutlineItem[], b: readonly OutlineItem[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**The level of the page in the selection, above the level of its widgets*/
const PAGE_LEVEL = Symbol("page level");

/**What a level needs of the outline, to follow states while the outline is in the document*/
interface LevelOwner {
  attach_state_to_symbol<T>(
    symbol: symbol,
    state: State<T>,
    func: (value: ResultNice<T>) => void,
  ): unknown;
  detach_state_from_symbol(symbol: symbol): unknown;
}

/**The rows of the items inside an item, like the widgets of the page or of the content of a group, front first
 * The rows apply the changes the children state gives, mirrored as they are in front first, so an item moved, added or removed
 * moves, adds or removes only its row, see state_ui.a.apply*/
class OutlineLevel {
  #rows = state.ok_w<OutlineRow[]>([]);
  /**The rows, the list shows them*/
  get rows(): StateROS<OutlineRow[]> {
    return this.#rows;
  }
  readonly #owner: LevelOwner;
  /**The page of the level, the page or the content of a group, the menus act on it*/
  readonly page: CanvasPage;
  readonly #symbol = Symbol("children");
  /**The levels of the groups of this level, made when a group is opened*/
  #inner = new Map<CanvasGroup, OutlineLevel>();

  constructor(owner: LevelOwner, page: CanvasPage) {
    this.#owner = owner;
    this.page = page;
    owner.attach_state_to_symbol(this.#symbol, page.children, (result) =>
      this.#apply(result.ok ? result.value : []),
    );
  }

  /**The level of the content of a group of this level*/
  inner(group: CanvasGroup): OutlineLevel {
    let level = this.#inner.get(group);
    if (!level) {
      level = new OutlineLevel(this.#owner, group.content);
      this.#inner.set(group, level);
    }
    return level;
  }

  /**Stops following the widgets, of the groups too*/
  detach() {
    this.#owner.detach_state_from_symbol(this.#symbol);
    for (const level of this.#inner.values()) level.detach();
    this.#inner.clear();
  }

  #row(item: OutlineItem): OutlineRow {
    return { item, level: this };
  }

  #apply(children: readonly OutlineItem[]) {
    const rows = this.#rows.array;
    for (const change of state.a.read(children)) {
      //The index in the rows of the first of k items at index i, counted from the other end
      const at = (i: number, k: number) => rows.get.length - i - k;
      const mirrored = (items: readonly OutlineItem[]) =>
        items.map((item) => this.#row(item)).reverse();
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
  }
}

/**List of a page and its widgets, the page is the root row, its widgets the widget in front first, with their id and the name of their widget,
 * a group is a row that opens to the widgets of its content
 * The rows show OutlineItems, their id, name and the items inside them, the menus and keys act on widgets
 * The selection is of one level, the page or widgets of one level, selecting on another level replaces it,
 * the menus and keys act on the level of the selected widgets
 * A click on a row selects its widget or page, the menu of a widget row cuts, copies, deletes or orders it on the page,
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
  #root: OutlineLevel | undefined;
  #list;
  /**The selection now, widgets or the page*/
  #selection: CanvasSelection;
  /**The items the list shows selected, the list writes array instructions to it, the outline turns it into the selection*/
  #list_selected = state.ok_w<OutlineItem[]>([]);
  /**The selected widgets now, for the menus and keys*/
  #selected: readonly CanvasWidget[] = [];
  /**The group the widget is in, null on the page, undefined when it is not in the page, found through the levels*/
  #parent_of(widget: CanvasWidget): CanvasGroup | null | undefined {
    const path = this.#page ? path_of(this.#page, widget) : undefined;
    return path ? (path.at(-1) ?? null) : undefined;
  }

  /**The page of the level of the selected widgets, the page itself when they are not in it*/
  #selected_page(): CanvasPage | undefined {
    const widget = this.#selected[0];
    return widget && this.#parent_of(widget) !== undefined
      ? widget.page
      : this.#page;
  }

  constructor() {
    super();
    //Ctrl+x, ctrl+c and ctrl+v of the focused outline, with the clipboard of the system
    clipboard_events(
      this,
      () => this.#selected_page(),
      () => this.#selected,
      (removed) => this.#deselect(removed),
      (pasted) => this.#select(pasted),
    );
    this.addEventListener("keydown", (e) => {
      if (
        group_key(
          e,
          this.#selected_page(),
          this.#selected,
          this.#group_rotation(),
          (widgets) => this.#select(widgets),
        )
      ) {
        e.preventDefault();
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      const page = this.#selected_page();
      const targets = this.#selected;
      if (page && targets.length)
        void remove_widgets(page, targets).then((done) => {
          if (done) this.#deselect(targets);
        });
    });
    this.#list = this.appendChild(
      list.container(
        {
          transform: (row: OutlineRow) => {
            const item = row.item;
            //An item with items inside opens to them, like a page or a group, the root row is opened at first
            const shown = {
              key_field: { text: item.id ?? "" },
              values: { widget: item.name },
              openable: item.children !== undefined,
              opened: row.root ?? false,
              sub_rows: () =>
                row.root
                  ? row.level.rows
                  : item instanceof CanvasGroup
                    ? row.level.inner(item).rows
                    : [],
            };
            //The menus act on widgets, the page has none yet
            if (!is_widget(item)) return ok(shown);
            return ok({
              ...shown,
              //The menu acts on all selected widgets when the row is one of them, a right click does not select
              context_menu: () => {
                const page = row.level.page;
                const targets = this.#selected.includes(item)
                  ? this.#selected
                  : [item];
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
                    ...group_lines(
                      page,
                      targets,
                      this.#group_rotation(),
                      (widgets) => this.#select(widgets),
                    ),
                    ctm.divider(),
                    ...order_lines(page, targets),
                  ]),
                );
              },
            });
          },
          //A key column for the ids
          sub_rows: true,
          headless: true,
          selection: { mode: "multi", key: (row: OutlineRow) => row.item },
        },
        {
          columns: {
            //The name the definition of the widget is registered with, followed, so a rename shows
            widget: list.column({
              title: "Widget",
              align: "left",
              field_gen: () => list.text_field(),
              field_apply: (field, name: StateROS<string>) =>
                field.attach_state_to_prop("text", name, (e) => some(e.nice)),
            }),
          },
          rows: [] as OutlineRow[],
        },
      ),
    );
    //The list does the selecting, writing array instructions to the items, the outline turns them into the selection
    this.#list.set({ selected: this.#list_selected });
    this.attach_state_to_symbol(LIST_SELECTED, this.#list_selected, (items) =>
      this.#list_changed(items.value),
    );
  }

  /**The level of a selected item, the page is above its widgets*/
  #level_of(item: OutlineItem) {
    return is_widget(item) ? this.#parent_of(item) : PAGE_LEVEL;
  }

  set(options: CanvasOutlineOptions): this {
    super.set(options);
    this.set_input(OUTLINE.page, options.page, (page) =>
      this.#show(page.ok ? page.value : undefined),
    );
    this.set_input(OUTLINE.selected, options.selected, (selected) =>
      this.#selection_changed(selected.ok ? selected.value : undefined),
    );
    return this;
  }

  /**The selection is shown in the list, as the items it has*/
  #selection_changed(selection: CanvasSelection) {
    this.#selection = selection;
    this.#selected = selected_widgets(selection);
    const items: OutlineItem[] = is_page(selection)
      ? [selection]
      : [...this.#selected];
    if (!same_items(items, this.#list_selected.ok()))
      this.#list_selected.set_ok(items);
  }

  /**The items selected in the list are made the selection, of one level, the level of the last one selected,
   * the same items in any order keep the selection, so a CanvasTransformer keeps its box*/
  #list_changed(items: readonly OutlineItem[]) {
    const current: OutlineItem[] = is_page(this.#selection)
      ? [this.#selection]
      : [...this.#selected];
    if (same_items(items, current)) return;
    const last = items.at(-1);
    if (!last || !is_widget(last))
      return this.#write(last as CanvasPage | undefined);
    const level = this.#level_of(last);
    this.#write(
      selection_of(
        items.filter(
          (item): item is CanvasWidget =>
            is_widget(item) && this.#level_of(item) === level,
        ),
      ),
    );
  }

  /**Selects like the user does: a writable state is written, an initial value or no value is kept, a read only state is left*/
  #write(selection: CanvasSelection) {
    const given = this.input_state(OUTLINE.selected);
    if (given === undefined) this.#selection_changed(selection);
    else if (given.writable) void given.write?.(selection);
    else this.#selection_changed(this.#selection);
  }

  /**The rotation a group made of the selection is turned by*/
  #group_rotation(): number {
    return selection_rotation(this.#selection);
  }

  /**Selects the widgets, like pasted ones*/
  #select(widgets: readonly CanvasWidget[]) {
    this.#write(selection_of(widgets));
  }

  /**Takes removed widgets out of the selection*/
  #deselect(widgets: readonly CanvasWidget[]) {
    const left = this.#selected.filter((widget) => !widgets.includes(widget));
    if (left.length !== this.#selected.length) this.#select(left);
  }

  /**Adds the widgets picked in the widget selector in front, centered on the page, and selects them*/
  async #add() {
    const page = this.#page;
    if (!page?.widgets.writable) return;
    const number = (value: unknown) => (typeof value === "number" ? value : 0);
    const picked = await select_widget({
      mode: "multi",
      at: {
        x: number(value_now(page.width)) / 2,
        y: number(value_now(page.height)) / 2,
      },
    });
    if (!picked.length) return;
    await page.widgets.write?.(
      state.a.write.push<CanvasWidgetData>(...picked),
    );
    const made = picked.map((data) => page.widget_of(data));
    //Centered, the selector places the top left corner
    for (const widget of made)
      for (const [key, length] of [
        ["x", "width"],
        ["y", "height"],
      ] as const) {
        const at = option_now(widget, key);
        if (typeof at === "number")
          void widget
            .option(key)
            ?.write?.(at - number(option_now(widget, length)) / 2);
      }
    this.#select(made);
  }

  #show(page: CanvasPage | undefined) {
    this.#page = page;
    //Adding needs widgets the outline can write
    const writable = page?.widgets.writable ?? false;
    this.#list.set({
      add_row: page
        ? {
            text: "Add widget",
            on_add: () => void this.#add(),
            access: writable ? AccessTypes.Write : AccessTypes.Read,
          }
        : null,
    });
    this.#root?.detach();
    this.#root = page ? new OutlineLevel(this, page) : undefined;
    //The page is the one row of the list, its sub rows the rows of the root level, so the list gets the changes they give
    this.#list.set({
      rows:
        page && this.#root
          ? [{ item: page, level: this.#root, root: true }]
          : [],
    });
  }
}
define_element(Outline);

export type { Outline };

/**Creates an outline, a list of the widgets of a page sharing the selection with the viewports*/
export function canvas_outline(options: CanvasOutlineOptions = {}): Outline {
  return Outline.create(options);
}
