import {
  Base,
  type BaseOptions,
  CREATE,
  define_element,
  input_key,
  type InputOf,
} from "#base";
import ctm, { type ContextMenuLines } from "#context_menu";
import {
  material_close_rounded,
  material_horizontal_split_rounded,
  material_open_in_new_rounded,
  material_vertical_split_rounded,
} from "#icons";
import type { SVGFunc } from "#svg";
import {
  CONTENT_CLOSED,
  content_context_lines,
  CONTENT_CREATE,
  CONTENT_HOST,
  ContentBase,
  type ContentHost,
  HOST_CAN_CLOSE,
  HOST_CLOSE_CONTENT,
} from "../content";
import { LayoutSide, type LayoutTabsSide } from "./tree";
import { DRAG_DISTANCE, value_or, writable, write_if } from "./common";
import {
  can_leave,
  can_popout,
  can_split,
  type DropTarget,
  move_content,
  popout,
  take_out,
} from "./actions";
import { is_tabs, type LayoutTabs } from "./tabs";
import { drag_end, drag_start, find_target, show_indicator } from "./drag";
import "./tab.scss";

//      _______       ____
//     |__   __|/\   |  _ \
//        | |  /  \  | |_) |
//        | | / /\ \ |  _ <
//        | |/ ____ \| |_) |
//        |_/_/    \_\____/
/**Inputs of the content the tab follows, inner inputs that are not options*/
const TAB_CONTENT = {
  title: input_key<InputOf<typeof CONTENT_CREATE.title>>(),
  icon: input_key<InputOf<typeof CONTENT_CREATE.icon>>(),
  closable: input_key<InputOf<typeof CONTENT_CREATE.closable>>(),
};

/**The tab of every content shown by a layout, a content is in one place at a time, so its tab is moved with it*/
export const TABS = new WeakMap<ContentBase, LayoutTab>();
export function tab_of(content: ContentBase): LayoutTab {
  let tab = TABS.get(content);
  if (!tab) {
    tab = LayoutTab.create({}, content);
    TABS.set(content, tab);
  }
  return tab;
}

/**The group and layout showing the content, nothing when the app took it out of the layout by writing its states*/
function shown_in(content: ContentBase) {
  const group = TABS.get(content)?.group_element();
  const layout = group?.layout();
  return group && layout && group.contents().includes(content)
    ? { group, layout }
    : undefined;
}

/**Closes content shown by a layout, it is taken out of its group*/
const LAYOUT_HOST: ContentHost = {
  [HOST_CAN_CLOSE](content: ContentBase): boolean {
    const shown = shown_in(content);
    //Closing takes the tab out of its group, so it follows the same rule as dragging it out
    return !shown || can_leave(shown.layout, shown.group);
  },
  [HOST_CLOSE_CONTENT](content: ContentBase): boolean | undefined {
    const shown = shown_in(content);
    if (shown && !take_out(shown.layout, shown.group, content)) return false;
    TABS.delete(content);
    content[CONTENT_HOST] = undefined;
    //Content the app took out of the layout is not the layout's, it closes like any content, with the container showing it
    if (!shown) return undefined;
    content.remove();
    content[CONTENT_CLOSED]();
    return true;
  },
};

/**Sides of the tabs in the menu of a tab*/
const TAB_SIDES: [LayoutTabsSide, string][] = [
  ["top", "Top"],
  ["bottom", "Bottom"],
  ["left", "Left"],
  ["right", "Right"],
];

/**Tab of one content, follows its title, icon and close button*/
export class LayoutTab extends Base {
  static element_name() {
    return "layouttab";
  }
  static element_name_space() {
    return "composition";
  }

  readonly content: ContentBase;
  #closable = false;
  #dragging = false;
  #icon = this.appendChild(document.createElement("div"));
  /**First letter of the title, shown instead of the icon by compact tabs of content without one*/
  #letter = this.appendChild(document.createElement("div"));
  #title = this.appendChild(document.createElement("div"));
  #close = this.appendChild(document.createElement("div"));

  constructor(content: ContentBase) {
    super();
    this.content = content;
    content[CONTENT_HOST] = LAYOUT_HOST;
    this.tabIndex = -1;
    this.#icon.className = "icon";
    //Without an icon given the icon input never calls back
    this.#set_icon(undefined);
    this.#letter.className = "letter";
    this.#title.className = "title";
    this.#close.className = "close";
    this.#close.textContent = "×";
    this.#close.hidden = true;
    this.#close.onpointerdown = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    this.#close.onclick = (e) => {
      e.stopPropagation();
      this.content.content_close();
    };
    this.onpointerdown = (e) => this.#press(e);
    this.ondragstart = (e) => drag_start(this, e);
    this.ondragend = () => drag_end();
    this.onkeydown = (e) => this.#key(e);
    ctm.attach(
      this,
      ctm.combine(
        () => this.#lines(),
        () => content_context_lines(this.content),
      ),
      () => this.#dragging,
    );
  }

  [CREATE](options: BaseOptions): void {
    super[CREATE](options);
    const content = this.content;
    this.set_input(TAB_CONTENT.icon, content.content_icon, (icon) =>
      this.#set_icon(icon.ok ? icon.value : undefined),
    );
    this.set_input(TAB_CONTENT.title, content.content_title, (title) => {
      const text = title.ok ? title.value : "⚠ " + title.error.nice;
      this.#title.textContent = text;
      //The whole title on hover, for compact tabs and titles cut short
      this.title = text;
      this.#letter.textContent = (title.ok ? title.value : "⚠").slice(0, 1);
    });
    this.set_input(TAB_CONTENT.closable, content.content_closable, (c) => {
      this.#closable = c.ok && c.value;
      this.#close.hidden = !this.#closable;
    });
  }

  /**Element of the group the tab is in*/
  group_element(): LayoutTabs | undefined {
    const group = this.parentElement?.parentElement;
    return is_tabs(group) ? group : undefined;
  }

  set_selected(selected: boolean): void {
    this.classList.toggle("selected", selected);
    this.tabIndex = selected ? 0 : -1;
  }

  #set_icon(icon?: SVGFunc): void {
    this.#icon.replaceChildren();
    if (icon) this.#icon.appendChild(icon());
    this.#icon.hidden = !icon;
    this.classList.toggle("no-icon", !icon);
  }

  #lines(): ContextMenuLines {
    const lines: ContextMenuLines = [];
    const group = this.group_element();
    const layout = group?.layout();
    if (this.#closable && group?.can_close())
      lines.push(
        ctm.line({
          text: "Close",
          icon: material_close_rounded,
          on_click: () => this.content.content_close(),
        }),
      );
    //A tab alone in a layout is not popped out, it would leave an empty layout, a panel with one tab is moved instead
    if (
      group &&
      layout &&
      can_popout(layout) &&
      can_leave(layout, group) &&
      !(layout.root_node() === group && group.contents().length === 1)
    )
      lines.push(
        ctm.line({
          text: "Pop out",
          icon: material_open_in_new_rounded,
          on_click: () => popout(layout, group, this.content),
        }),
      );
    if (
      group &&
      layout &&
      writable(group.content_state()) &&
      group.contents().length > 1 &&
      can_split(layout, group)
    ) {
      const split = (side: LayoutSide) => () =>
        move_content(this.content, { layout, node: group, side });
      lines.push(
        ctm.line({
          text: "Split right",
          icon: material_vertical_split_rounded,
          on_click: split(LayoutSide.RIGHT),
        }),
        ctm.line({
          text: "Split down",
          icon: material_horizontal_split_rounded,
          on_click: split(LayoutSide.BOTTOM),
        }),
      );
    }
    const side = group?.side_state();
    if (writable(side))
      lines.push(
        ctm.sub({
          text: "Tabs at",
          menu: ctm.menu(
            TAB_SIDES.map(([value, text]) =>
              ctm.line({
                text,
                checked: value_or(side.get(), "top") === value,
                on_click: () => side.write_sync(value),
              }),
            ),
          ),
        }),
      );
    const compact = group?.compact_state();
    if (writable(compact)) {
      const on = value_or(compact.get(), false);
      lines.push(
        ctm.line({
          text: "Compact tabs",
          checked: on,
          on_click: () => compact.write_sync(!on),
        }),
      );
    }
    return lines;
  }

  #key(e: KeyboardEvent): void {
    const group = this.group_element();
    if (!group) return;
    const tabs = group.contents();
    const index = tabs.indexOf(this.content);
    let next: ContentBase | undefined;
    if (e.key === "ArrowLeft") next = tabs[index - 1] ?? tabs.at(-1);
    else if (e.key === "ArrowRight") next = tabs[index + 1] ?? tabs[0];
    else if (e.key === "Home") next = tabs[0];
    else if (e.key === "End") next = tabs.at(-1);
    else if (e.key === "Enter") {
      e.preventDefault();
      this.content.focus();
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    if (!next) return;
    write_if(group.active_state(), next);
    TABS.get(next)?.focus();
  }

  /**Shows the tab, a middle press closes it, and moving the pointer far enough drags it,
   * the mouse with the drag and drop of the browser, see drag_start, so it reaches other windows, touch and pens with pointer events*/
  #press(e: PointerEvent): void {
    const group = this.group_element();
    if (!group) return;
    if (e.button === 1) {
      e.preventDefault();
      if (this.#closable && group.can_close()) this.content.content_close();
      return;
    }
    if (e.button !== 0) return;
    write_if(group.active_state(), this.content);
    //A read only content state locks the tabs in the group
    const movable = writable(group.content_state());
    this.draggable = movable && e.pointerType === "mouse";
    if (!movable || this.draggable) return;
    const doc = this.ownerDocument;
    let target: DropTarget | undefined;
    this.setPointerCapture(e.pointerId);
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      target = undefined;
      end();
    };
    const end = () => {
      if (this.hasPointerCapture(e.pointerId))
        this.releasePointerCapture(e.pointerId);
      this.onpointermove = this.onpointerup = this.onpointercancel = null;
      doc.removeEventListener("keydown", key, true);
      this.classList.remove("dragging");
      show_indicator(undefined);
      //The context menu of the long press on touch comes after, it is blocked until then
      setTimeout(() => (this.#dragging = false));
    };
    this.onpointermove = (ev) => {
      if (!this.#dragging) {
        const moved = Math.hypot(
          ev.clientX - e.clientX,
          ev.clientY - e.clientY,
        );
        if (moved < DRAG_DISTANCE) return;
        this.#dragging = true;
        this.classList.add("dragging");
        doc.addEventListener("keydown", key, true);
      }
      target = find_target(this, ev.clientX, ev.clientY);
      show_indicator(target);
    };
    this.onpointerup = () => {
      const drop = this.#dragging ? target : undefined;
      end();
      if (drop) move_content(this.content, drop);
    };
    this.onpointercancel = () => {
      target = undefined;
      end();
    };
  }
}
define_element(LayoutTab);
