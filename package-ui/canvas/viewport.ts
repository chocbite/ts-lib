import {
  AccessTypes,
  Base,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import ctm from "#context_menu";
import { state_ui } from "#state_ui";
import state, {
  type State,
  type StateOrVal,
  type StateROS,
} from "@chocbite/ts-lib/state";
import type { CanvasPage, CanvasWidget } from "./data";
import { GroupRotation } from "./group";
import { select_widget } from "./select";
import {
  content_fit,
  group_key,
  group_lines,
  path_to,
  is_group,
} from "./group_widget";
import { refuse_taken_ids, widget_id, widget_name } from "./ids";
import { material_door_open_rounded } from "#icons";
import { clipboard_events, edit_lines, paste_line } from "./clipboard";
import { delete_line, order_lines, remove_widgets } from "./order";
import { page_element, type PageElement } from "./page";
import { WIDGET_ELEMENTS_EVENT, WidgetSlot } from "./slot";
import "./shared";
import { Transformer } from "./transformer";
import "./viewport.scss";
import {
  WIDGET_GEOMETRY,
  WIDGET_TRANSFORM_EVENT,
  WidgetBase,
  scrolls,
  type WidgetGeometry,
} from "./widget";

/**Inputs of the viewport*/
const VIEWPORT = {
  /**Page shown, data that any number of viewports can show at once, undefined shows nothing*/
  page: input_key<StateOrVal<CanvasPage | undefined>>(),
  /**Enables zooming, panning and changing widgets, leaving it resets the view and clears the selection*/
  edit: input_key<StateOrVal<boolean>>(),
  /**Selected widgets of the page, the transformer is shown on them in edit mode
   * Pressing a widget selects only it, ctrl or shift toggles it, pressing the page clears the selection and dragging on it selects
   * the widgets inside the rectangle: a writable state is written, with array instructions, so viewports, outlines and a properties editor
   * can share the selection, an initial value or no value is kept by the viewport, a read only state can not be changed by the user
   * The viewport only changes the selection when the user presses, never on its own*/
  selected: input_key<StateOrVal<readonly CanvasWidget[]>>(),
};
export type CanvasViewportOptions = BaseOptions & InputOptions<typeof VIEWPORT>;

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 20;
/**Zoom factor per wheel pixel */
const WHEEL_ZOOM_SPEED = 0.002;
/**Zoom factor per wheel pixel for touchpad pinch, which reports much smaller deltas than a mouse wheel */
const PINCH_ZOOM_SPEED = 0.01;
/**Screen pixels panned per wheel pixel */
const WHEEL_PAN_SPEED = 0.5;
/**Pixels per line, for wheel events reported in lines */
const WHEEL_LINE_HEIGHT = 16;
/**Speed multiplier for wheel zoom and pan while alt is held */
const WHEEL_SLOW = 0.1;
/**Pixels a right press can move and still open the menu instead of panning */
const MENU_SLOP = 4;

/**The value of a state now, undefined while it has none*/
const widgets_value = (value: StateROS<unknown> | State<unknown>): unknown => {
  const now = value.rsync ? value.get() : undefined;
  return now?.ok ? now.value : undefined;
};

/**The widgets of a page now*/
const widgets_now = (page: CanvasPage | undefined): readonly CanvasWidget[] => {
  const widgets = page?.widgets;
  if (!state.is.state(widgets)) return widgets ?? [];
  const now = widgets_value(widgets);
  return Array.isArray(now) ? (now as CanvasWidget[]) : [];
};

/**The content of a group as a page, its id, content size, background and widgets,
 * the id refuses an id another widget of the level of the group has
 * @param level the widgets of the level of the group now*/
function group_page(
  group: CanvasWidget,
  level: () => readonly CanvasWidget[],
): CanvasPage {
  const options = group.options as Record<string, unknown>;
  const id = options.id as State<unknown, any, any> | undefined;
  return {
    id: (id
      ? refuse_taken_ids(group, id, level)
      : undefined) as CanvasPage["id"],
    width: options.content_width as CanvasPage["width"],
    height: options.content_height as CanvasPage["height"],
    //Transparent when not given, as the group shows it
    background: (options.background ??
      "transparent") as CanvasPage["background"],
    widgets: options.widgets as CanvasPage["widgets"],
  };
}

/**The corners of the outline of a widget, turned around its center*/
function outline_corners({
  x,
  y,
  width,
  height,
  rotation,
}: WidgetGeometry): DOMPoint[] {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = x + width / 2;
  const cy = y + height / 2;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([dx, dy]) => {
    const px = (dx * width) / 2;
    const py = (dy * height) / 2;
    return new DOMPoint(cx + px * cos - py * sin, cy + px * sin + py * cos);
  });
}

/**Viewport showing a page of widgets
 * The viewport makes its own elements for the page and its widgets, so a page can be shown in several viewports at once
 * The page is scaled to fit inside the viewport element while keeping its aspect ratio, and centered
 *
 * When edit is true the page can be zoomed and panned, and a checkerboard is shown behind it
 * Wheel and touchpad two finger swipe pans, ctrl + wheel or swipe zooms toward the cursor
 * Shift + vertical wheel pans horizontally
 * Touchpad pinch zooms toward the cursor
 * Holding alt makes wheel zoom and pan 10 times slower
 * Two finger touch pinch zooms and pans, middle or right mouse drag pans
 *
 * Pressing a widget in edit mode selects it and attaches a transformer to move, resize and rotate it
 * Pressing outside any widget clears the selection, see the selected input
 *
 * A right click without moving, or a long press on touch, selects the widget in front at the point and opens its menu,
 * to order it on the page, or select another widget covering the point, where there is no widget the menu of the viewport opens
 *
 * In edit mode widgets outside the page are shown, pressing the viewport gives it focus, then ctrl+a selects all widgets,
 * delete or backspace removes the selected widgets from the page, and ctrl+x, ctrl+c and ctrl+v cut, copy and paste them,
 * through the clipboard of the system, so they can be copied between browsers*/
class Viewport extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "viewport";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "canvas";
  }

  #background: HTMLDivElement = this.appendChild(document.createElement("div"));
  #container: HTMLDivElement = this.appendChild(document.createElement("div"));
  #transformer: Transformer = this.appendChild(new Transformer());
  #page: PageElement | undefined;
  /**The page data shown*/
  #page_data: CanvasPage | undefined;
  /**The page given, the groups of the edit path are in it*/
  #root: CanvasPage | undefined;
  /**The groups entered, the viewport shows the content of the last, the page itself without any*/
  #path: CanvasWidget[] = [];
  #path_bar: HTMLDivElement | undefined;
  /**The page element of the page given, behind the level edited while editing inside a group*/
  #root_element: PageElement | undefined;
  /**The layer of the content of the group edited inside, on top of the page*/
  #level: HTMLDivElement | undefined;
  /**The canvas of the group edited inside, in viewport pixels, a checkerboard behind the level and a dashed outline on top of it*/
  #area_back = Object.assign(document.createElement("div"), {
    className: "area-back",
  });
  #area_line = (() => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("area-line");
    //The canvas, and the bounds of the group itself, its x, y, width, height and rotation on the level above,
    //each over a line of the contrast color that shows in its gaps
    for (const name of ["canvas", "bounds"])
      for (const contrast of [true, false])
        svg
          .appendChild(
            document.createElementNS("http://www.w3.org/2000/svg", "polygon"),
          )
          .classList.add(
            ...(contrast ? ["contrast", name + "-contrast"] : [name]),
          );
    return svg;
  })();
  /**The group elements of the path in the page, the level follows them, the last is hidden while edited*/
  #chain: WidgetBase[] = [];
  /**Maps the level edited to viewport pixels, the view, and for the content of a group the groups of the path*/
  #level_matrix = new DOMMatrix();
  /**Symbols of the widgets states of the levels of the path, followed to go up when a group is removed*/
  #path_followed: symbol[] = [];
  #shown = state.ok_w<CanvasPage | undefined>(undefined);
  /**The page the viewport shows now, the page given, or the content of the group it edits inside,
   * give it to a properties editor as its page, to show the level while nothing is selected*/
  get shown_page(): StateROS<CanvasPage | undefined> {
    return this.#shown;
  }
  /**Where a right press started, it opens the menu when released without moving */
  #menu_press: { id: number; x: number; y: number } | undefined;
  #selected: readonly CanvasWidget[] = [];
  /**The selection rectangle being dragged, from where it started in client pixels, ctrl or shift adds to the selection*/
  #marquee:
    | {
        id: number;
        x: number;
        y: number;
        add: boolean;
        element?: HTMLDivElement;
      }
    | undefined;
  #page_observer = new ResizeObserver(() => {
    this.#update_view();
  });
  #scale: number = 1;
  #fit_x: number = 0;
  #fit_y: number = 0;
  #edit: boolean = false;
  #zoom: number = 1;
  #pan_x: number = 0;
  #pan_y: number = 0;
  #touches = new Map<number, { x: number; y: number }>();
  #pan_pointer_id: number | undefined;
  #pan_pointer_last = { x: 0, y: 0 };
  /**Whether the ctrl key is physically held, to tell touchpad pinch from ctrl + wheel */
  #ctrl_held: boolean = false;

  constructor() {
    super();
    this.#background.className = "checkerboard";
    this.#container.className = "container";
    //The transformer moves to the element the slot of the selected widget shows now
    this.#container.addEventListener(WIDGET_ELEMENTS_EVENT, () =>
      this.#attach(),
    );
    //Ctrl+x, ctrl+c and ctrl+v of the focused viewport in edit mode, with the clipboard of the system
    clipboard_events(
      this,
      () => (this.#edit ? this.#page_data : undefined),
      () => this.#selected,
      (removed) => this.#deselect(removed),
      (pasted) => this.#select(pasted),
      () => this.#shown_area(),
    );
    //Refits when the viewport changes size, a function can only be attached once per element, so one per state
    this.attach_state(this.#size.width, () => this.#update_view());
    this.attach_state(this.#size.height, () => this.#update_view());
  }

  readonly #size = state_ui.size(this);

  /**Size of the viewport in px, from the observed size, measured when not observed yet*/
  #measure(): { width: number; height: number } {
    const width = this.#size.width.ok();
    const height = this.#size.height.ok();
    if (width === 0 || height === 0) return this.getBoundingClientRect();
    return { width, height };
  }

  set(options: CanvasViewportOptions): this {
    super.set(options);
    this.set_input(VIEWPORT.page, options.page, (page) => {
      //An error shows no page, the fault icon explains it
      this.#root = page.ok ? page.value : undefined;
      this.#path = [];
      this.#show_root();
      this.#show_level();
    });
    this.set_input(VIEWPORT.edit, options.edit, (edit) => {
      this.#set_edit(edit.ok && edit.value);
    });
    this.set_input(VIEWPORT.selected, options.selected, (selected) => {
      this.#selected = selected.ok ? selected.value : [];
      //Shared by everything given the same selection state, kept while the same widgets are selected
      const group = GroupRotation.of(
        this.input_state(VIEWPORT.selected) ?? this,
      );
      group.select(this.#selected);
      this.#transformer.group = group;
      this.#attach();
      this.#follow_selection();
    });
    return this;
  }

  /**Shows the level of the edit path, the content of the last group entered, or the page itself*/
  #show_level() {
    const group = this.#path[this.#path.length - 1];
    const parent = this.#level_page(this.#path.length - 1);
    this.#level?.remove();
    this.#level = undefined;
    this.#area_back.remove();
    this.#area_line.remove();
    for (const element of this.#chain) {
      element.removeEventListener(WIDGET_TRANSFORM_EVENT, this.#on_chain);
      element.removeEventListener("scroll", this.#on_chain);
      element.style.removeProperty("visibility");
    }
    this.#chain = [];
    let page: CanvasPage | undefined;
    if (!group) {
      page = this.#root;
      this.#page = this.#root_element;
      this.#container.classList.remove("behind");
    } else {
      page = group_page(group, () => widgets_now(parent));
      //The page is shown grayed behind, the group edited hidden in it, its content is shown on top where the group shows it
      this.#container.classList.add("behind");
      this.#chain = this.#chain_elements();
      //Moved or scrolled, the content edited follows the group
      for (const element of this.#chain) {
        element.addEventListener(WIDGET_TRANSFORM_EVENT, this.#on_chain);
        element.addEventListener("scroll", this.#on_chain);
      }
      this.#chain[this.#path.length - 1]?.style.setProperty(
        "visibility",
        "hidden",
      );
      const level = document.createElement("div");
      level.className = "level";
      this.insertBefore(level, this.#transformer);
      this.insertBefore(this.#area_back, level);
      this.insertBefore(this.#area_line, this.#transformer);
      this.#page = level.appendChild(page_element(page));
      this.#level = level;
    }
    this.#page_data = page;
    this.#follow_path();
    if (this.#shown.ok() !== page) this.#shown.set_ok(page);
    this.#render_path();
    this.#attach();
    this.#update_view();
  }

  /**The group elements of the path in the page element, as far as they are made*/
  #chain_elements(): WidgetBase[] {
    const elements: WidgetBase[] = [];
    let page: PageElement | null | undefined = this.#root_element;
    for (const group of this.#path) {
      const element: WidgetBase | undefined = page?.slot_of(group)?.element;
      if (!element) break;
      elements.push(element);
      page = element.querySelector<PageElement>(":scope > canvas-page");
    }
    return elements;
  }

  /**A group of the path moved, the level follows it*/
  #on_chain = () => this.#update_view();

  /**Maps the content of the last group of the path to the page, through every group of the path, like the groups show it:
   * moved to the group, turned around its center, scrolled, and scaled evenly and centered when displayed scaled*/
  /**The box of the last group of the path in its own units, mapped to the level above by the matrix, set by #chain_matrix*/
  #bounds = { matrix: new DOMMatrix(), width: 0, height: 0 };

  #chain_matrix(): DOMMatrix {
    let matrix = new DOMMatrix();
    this.#path.forEach((group, i) => {
      const element = this.#chain[i];
      const options = group.options as Record<
        string,
        StateROS<unknown> | undefined
      >;
      const number = (key: string) => {
        const value = options[key] ? widgets_value(options[key]) : undefined;
        return typeof value === "number" ? value : 0;
      };
      const frame = element
        ? element[WIDGET_GEOMETRY]
        : {
            x: number("x"),
            y: number("y"),
            width: number("width"),
            height: number("height"),
            rotation: number("rotation"),
          };
      const display = options.display
        ? widgets_value(options.display)
        : "scale";
      //Stretched content is edited fitted evenly, a stretch would slant turned widgets, which the transformer can not follow
      const fit = content_fit(
        display === "stretch" ? "scale" : display,
        { width: number("content_width"), height: number("content_height") },
        frame,
      );
      matrix = matrix
        .translate(frame.x + frame.width / 2, frame.y + frame.height / 2)
        .rotate(frame.rotation)
        .translate(-frame.width / 2, -frame.height / 2);
      this.#bounds = { matrix, width: frame.width, height: frame.height };
      if (display === "scroll" && element)
        matrix = matrix.translate(-element.scrollLeft, -element.scrollTop);
      matrix = matrix.translate(fit.x, fit.y).scale(fit.scale_x, fit.scale_y);
    });
    return matrix;
  }

  /**Makes the page element of the page given*/
  #show_root() {
    if (this.#root_element) {
      this.#page_observer.unobserve(this.#root_element);
      this.#root_element.remove();
    }
    this.#root_element = this.#root
      ? this.#container.appendChild(page_element(this.#root))
      : undefined;
    if (this.#root_element) this.#page_observer.observe(this.#root_element);
  }

  /**The point of the level edited under a client point*/
  #to_level(client_x: number, client_y: number): DOMPoint {
    const local = this.#local({ clientX: client_x, clientY: client_y });
    return this.#level_matrix
      .inverse()
      .transformPoint(new DOMPoint(local.x, local.y));
  }

  /**The page of a level of the path, 0 is the page given, a level n is the content of the group n - 1 of the path*/
  #level_page(depth: number): CanvasPage | undefined {
    if (depth <= 0) return this.#root;
    const group = this.#path[depth - 1];
    return group
      ? {
          widgets: (group.options as Record<string, unknown>)
            .widgets as CanvasPage["widgets"],
        }
      : undefined;
  }

  /**Follows the widgets of every level of the path, a group of the path that is no longer on its level cuts the path there*/
  #follow_path() {
    for (const symbol of this.#path_followed)
      this.detach_state_from_symbol(symbol);
    this.#path_followed = [];
    //The path shows the ids of the page and the groups as they change
    const ids = [
      this.#root?.id,
      ...this.#path.map(
        (group) => (group.options as Record<string, unknown>).id,
      ),
    ];
    if (this.#path.length)
      for (const id of ids) {
        if (!state.is.state(id)) continue;
        const symbol = Symbol("id");
        this.#path_followed.push(symbol);
        this.attach_state_to_symbol(symbol, id, () => this.#render_path());
      }
    this.#path.forEach((group, depth) => {
      //How the group places its content, changed elsewhere the content edited is placed again
      const options = group.options as Record<string, unknown>;
      for (const key of ["content_width", "content_height", "display"]) {
        const option = options[key];
        if (!state.is.state(option)) continue;
        const symbol = Symbol(key);
        this.#path_followed.push(symbol);
        this.attach_state_to_symbol(symbol, option, () => this.#update_view());
      }
      const widgets = this.#level_page(depth)?.widgets;
      if (!state.is.state(widgets)) return;
      const symbol = Symbol("level");
      this.#path_followed.push(symbol);
      //After the state has told every subscriber, while it tells them its array carries the change,
      //which the page element made for the level would apply as if it was its own
      this.attach_state_to_symbol(symbol, widgets, () =>
        queueMicrotask(() => this.#check_path()),
      );
    });
  }

  /**Cuts the path at the first group that is no longer on its level, the viewport then shows the deepest level left*/
  #check_path() {
    const cut = this.#path.findIndex(
      (group, depth) => !widgets_now(this.#level_page(depth)).includes(group),
    );
    if (cut === -1) return;
    this.#path = this.#path.slice(0, cut);
    this.#show_level();
  }

  /**Goes to the level of the selected widgets when they are not on the level shown, the outline selects at any level*/
  #follow_selection() {
    const first = this.#selected[0];
    if (!this.#edit || !first) return;
    if (widgets_now(this.#page_data).includes(first)) return;
    const path = path_to(widgets_now(this.#root), first);
    if (!path) return;
    this.#path = path;
    this.#show_level();
  }

  /**Edits inside the group, the selection is cleared, as it is of the level above*/
  #enter(group: CanvasWidget) {
    this.#select([]);
    this.#path = [...this.#path, group];
    this.#show_level();
  }

  /**Goes up to a level of the path, 0 is the page, and selects the group it came out of*/
  #go_to(depth: number) {
    if (depth >= this.#path.length) return;
    const left = this.#path[depth];
    this.#path = this.#path.slice(0, depth);
    this.#show_level();
    this.#select([left]);
  }

  /**The bar at the top while editing inside a group, the levels by id, each goes up to it, and exit goes up one level*/
  #render_path() {
    this.#path_bar?.remove();
    this.#path_bar = undefined;
    if (!this.#path.length) return;
    //Floats at the top left, a round exit button with a door, then the levels
    const bar = this.appendChild(document.createElement("div"));
    bar.className = "path";
    const exit = bar.appendChild(document.createElement("span"));
    exit.className = "exit";
    exit.title = "Exit";
    exit.appendChild(material_door_open_rounded());
    exit.onclick = () => this.#go_to(this.#path.length - 1);
    //The bar is not part of the page, presses on it select nothing
    bar.addEventListener("pointerdown", (e) => e.stopPropagation());
    const root_id = this.#root?.id;
    const root_name = state.is.state(root_id)
      ? widgets_value(root_id)
      : root_id;
    const names = [
      typeof root_name === "string" && root_name ? root_name : "Page",
      ...this.#path.map((group) => widget_id(group) || "Group"),
    ];
    names.forEach((name, depth) => {
      if (depth)
        bar.appendChild(document.createElement("span")).textContent = "/";
      const crumb = bar.appendChild(document.createElement("span"));
      crumb.className = "crumb";
      crumb.textContent = name;
      if (depth < this.#path.length) {
        crumb.classList.add("up");
        crumb.onclick = () => this.#go_to(depth);
      }
    });
    this.#path_bar = bar;
  }

  /**Selects like the user does, a writable state is written, an initial value or no value is kept, a read only state is left
   * @param next the selection after the change
   * @param write what is written to a state, an array instruction for a small change, next when undefined*/
  #select(next: readonly CanvasWidget[], write?: CanvasWidget[]) {
    const given = this.input_state(VIEWPORT.selected);
    if (given === undefined) {
      this.#selected = next;
      this.#attach();
    } else if (given.writable) void given.write?.(write ?? [...next]);
  }

  /**Selects only the widget, none clears the selection*/
  #select_only(widget: CanvasWidget | undefined) {
    const next = widget ? [widget] : [];
    if (
      next.length === this.#selected.length &&
      next.every((w, i) => w === this.#selected[i])
    )
      return;
    this.#select(next);
  }

  /**Adds the widget to the selection, or takes it out when it is selected*/
  #toggle(widget: CanvasWidget) {
    if (this.#selected.includes(widget))
      this.#select(
        this.#selected.filter((w) => w !== widget),
        state.a.write.delete(widget),
      );
    else this.#select([...this.#selected, widget], state.a.write.push(widget));
  }

  /**Puts the transformer on the elements of the selected widgets on the page, hidden outside edit mode*/
  #attach() {
    const page = this.#page;
    const elements: WidgetBase[] = [];
    if (this.#edit && page)
      for (const widget of this.#selected) {
        const element = page.slot_of(widget)?.element;
        if (element) elements.push(element);
      }
    this.#transformer.widgets = elements;
  }

  /**Enables zooming, panning and changing widgets, leaving it resets the view to fit the page */
  #set_edit(edit: boolean) {
    if (this.#edit === edit) return;
    this.#edit = edit;
    this.toggleAttribute("edit", edit);
    this.#attach();
    this.#listen_keys(edit && this.isConnected);
    if (edit) {
      this.tabIndex = 0;
      this.addEventListener("keydown", this.#on_view_key);
      this.addEventListener("dblclick", this.#on_double_click);
      this.addEventListener("wheel", this.#on_wheel, { passive: false });
      this.addEventListener("pointerdown", this.#on_pointer_down);
      this.addEventListener("pointermove", this.#on_pointer_move);
      this.addEventListener("pointerup", this.#on_pointer_up);
      this.addEventListener("pointercancel", this.#on_pointer_up);
      this.addEventListener("mousedown", this.#on_mouse_down);
      this.addEventListener("contextmenu", this.#on_context_menu);
    } else {
      this.removeAttribute("tabindex");
      //Editing inside groups ends with edit mode
      if (this.#path.length) {
        this.#path = [];
        this.#show_level();
      }
      this.removeEventListener("keydown", this.#on_view_key);
      this.removeEventListener("dblclick", this.#on_double_click);
      this.removeEventListener("wheel", this.#on_wheel);
      this.removeEventListener("pointerdown", this.#on_pointer_down);
      this.removeEventListener("pointermove", this.#on_pointer_move);
      this.removeEventListener("pointerup", this.#on_pointer_up);
      this.removeEventListener("pointercancel", this.#on_pointer_up);
      this.removeEventListener("mousedown", this.#on_mouse_down);
      this.removeEventListener("contextmenu", this.#on_context_menu);
      this.#touches.clear();
      this.#pan_pointer_id = undefined;
      this.#zoom = 1;
      this.#pan_x = 0;
      this.#pan_y = 0;
      this.#update_view();
    }
  }

  /**Returns the current scale from page units to screen pixels */
  get scale(): number {
    return this.#scale;
  }

  protected connectedCallback(): void {
    super.connectedCallback();
    if (this.#edit) this.#listen_keys(true);
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listen_keys(false);
  }

  /**Adds or removes the window listeners tracking the ctrl key */
  #listen_keys(listen: boolean) {
    if (listen) {
      window.addEventListener("keydown", this.#on_key);
      window.addEventListener("keyup", this.#on_key);
      window.addEventListener("blur", this.#on_blur);
    } else {
      window.removeEventListener("keydown", this.#on_key);
      window.removeEventListener("keyup", this.#on_key);
      window.removeEventListener("blur", this.#on_blur);
      this.#ctrl_held = false;
    }
  }

  #update_view() {
    const root = this.#root_element;
    if (!root) return;
    const width = root.page_width;
    const height = root.page_height;
    if (width <= 0 || height <= 0) return;
    const rect = this.#measure();
    const fit = Math.min(rect.width / width, rect.height / height);
    this.#fit_x = (rect.width - width * fit) / 2;
    this.#fit_y = (rect.height - height * fit) / 2;
    this.#scale = fit * this.#zoom;
    const view = new DOMMatrix()
      .translate(this.#fit_x + this.#pan_x, this.#fit_y + this.#pan_y)
      .scale(this.#scale);
    this.#container.style.transform = `translate(${this.#fit_x + this.#pan_x}px, ${this.#fit_y + this.#pan_y}px) scale(${this.#scale})`;
    this.#level_matrix = this.#level
      ? view.multiply(this.#chain_matrix())
      : view;
    if (this.#level) {
      this.#level.style.transform = this.#level_matrix.toString();
      this.#draw_area(view);
    }
    this.#transformer.view(this.#level_matrix);
  }

  /**Places the backdrop and outline on the canvas of the group edited, its corners through the level matrix,
   * and the outline of the bounds of the group, through the view and the groups above it*/
  #draw_area(view: DOMMatrix) {
    const page = this.#page;
    if (!page) return;
    const box = (matrix: DOMMatrix, width: number, height: number) =>
      [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ].map(([x, y]) => matrix.transformPoint(new DOMPoint(x, y)));
    const points = (corners: DOMPoint[]) =>
      corners.map((point) => `${point.x},${point.y}`).join(" ");
    const canvas = box(this.#level_matrix, page.page_width, page.page_height);
    this.#area_back.style.clipPath = `polygon(${canvas
      .map((point) => `${point.x}px ${point.y}px`)
      .join(", ")})`;
    /**Places a line and the contrast line under it*/
    const line = (name: string, corners: DOMPoint[]) => {
      for (const polygon of this.#area_line.querySelectorAll(
        `.${name}, .${name}-contrast`,
      ))
        polygon.setAttribute("points", points(corners));
    };
    line("canvas", canvas);
    //The view times the groups up to the last, and its box
    line(
      "bounds",
      box(
        view.multiply(this.#bounds.matrix),
        this.#bounds.width,
        this.#bounds.height,
      ),
    );
  }

  /**Zooms by the factor, keeping the given point in viewport coordinates in place */
  #zoom_at(x: number, y: number, factor: number) {
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.#zoom * factor));
    const ratio = zoom / this.#zoom;
    this.#pan_x += (x - this.#fit_x - this.#pan_x) * (1 - ratio);
    this.#pan_y += (y - this.#fit_y - this.#pan_y) * (1 - ratio);
    this.#zoom = zoom;
  }

  /**Returns the position of the event in viewport coordinates */
  #local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /**Selects the widget under the pointer, ctrl or shift toggles it,
   * on the empty page it clears the selection, unless ctrl or shift is held, and starts a selection rectangle*/
  #select_at(e: PointerEvent) {
    const page = this.#page;
    //Widgets sit in a slot of the page, a slot has display contents so it is never the target itself
    let element = e.target instanceof Element ? e.target : null;
    while (element && element.parentElement !== page)
      element = element.parentElement;
    const add = e.ctrlKey || e.shiftKey;
    if (page && element instanceof WidgetSlot) {
      if (add) this.#toggle(element.widget);
      else this.#select_only(element.widget);
      return;
    }
    if (!add) this.#select_only(undefined);
    this.#marquee = { id: e.pointerId, x: e.clientX, y: e.clientY, add };
    this.setPointerCapture(e.pointerId);
  }

  /**Draws the selection rectangle to the pointer*/
  #draw_marquee(e: PointerEvent) {
    const marquee = this.#marquee!;
    if (!marquee.element) {
      marquee.element = this.appendChild(document.createElement("div"));
      marquee.element.className = "marquee";
    }
    const start = this.#local({ clientX: marquee.x, clientY: marquee.y });
    const now = this.#local(e);
    Object.assign(marquee.element.style, {
      left: Math.min(start.x, now.x) + "px",
      top: Math.min(start.y, now.y) + "px",
      width: Math.abs(now.x - start.x) + "px",
      height: Math.abs(now.y - start.y) + "px",
    });
  }

  /**Selects the widgets fully inside the selection rectangle, added to the selection with ctrl or shift*/
  #end_marquee(e: PointerEvent) {
    const marquee = this.#marquee!;
    this.#marquee = undefined;
    if (!marquee.element) return;
    marquee.element.remove();
    const page = this.#page;
    if (!page || this.#scale <= 0) return;
    //On the screen, so it works in a turned group too, a widget is inside when its whole outline is
    const a = this.#local({ clientX: marquee.x, clientY: marquee.y });
    const b = this.#local(e);
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    const inside: CanvasWidget[] = [];
    for (const slot of page.children as HTMLCollectionOf<WidgetSlot>) {
      const element = slot.element;
      if (!element) continue;
      const corners = outline_corners(element[WIDGET_GEOMETRY]).map((point) =>
        this.#level_matrix.transformPoint(point),
      );
      if (
        corners.every(
          (point) =>
            point.x >= left &&
            point.x <= right &&
            point.y >= top &&
            point.y <= bottom,
        )
      )
        inside.push(slot.widget);
    }
    if (!marquee.add) return this.#select(inside);
    const added = inside.filter((widget) => !this.#selected.includes(widget));
    if (added.length)
      this.#select([...this.#selected, ...added], state.a.write.push(...added));
  }

  /**Returns center and distance of the first two touches */
  #pinch(): { x: number; y: number; distance: number } | undefined {
    if (this.#touches.size < 2) return undefined;
    const [a, b] = this.#touches.values();
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }

  #on_wheel = (e: WheelEvent) => {
    e.preventDefault();
    const unit =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? WHEEL_LINE_HEIGHT
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? this.#measure().height
          : 1;
    const delta_x = e.deltaX * unit;
    const delta_y = e.deltaY * unit;
    const speed = e.altKey ? WHEEL_SLOW : 1;
    if (e.ctrlKey) {
      //Browsers report touchpad pinch as ctrl + wheel, without the ctrl key being held
      const zoom_speed = this.#ctrl_held ? WHEEL_ZOOM_SPEED : PINCH_ZOOM_SPEED;
      const point = this.#local(e);
      this.#zoom_at(point.x, point.y, Math.exp(-delta_y * zoom_speed * speed));
    } else {
      //Shift makes the vertical wheel pan horizontally, some browsers already swap the deltas themselves
      const swap = e.shiftKey && delta_x === 0;
      this.#pan_x -= (swap ? delta_y : delta_x) * speed * WHEEL_PAN_SPEED;
      this.#pan_y -= (swap ? 0 : delta_y) * speed * WHEEL_PAN_SPEED;
    }
    this.#update_view();
  };

  #on_pointer_down = (e: PointerEvent) => {
    //A press on a widget that scrolls, not on its content, is on its scrollbar, which takes it
    const target = e.target;
    if (target instanceof WidgetBase && scrolls(target)) return;
    //For ctrl+a, a press does not focus an element on its own
    this.focus({ preventScroll: true });
    if (e.pointerType === "touch") {
      //Only the first touch selects, so a second finger can pinch without changing the selection
      if (this.#touches.size === 0 && !this.#transformer.dragging)
        this.#select_at(e);
      //A second finger pinches instead
      else if (this.#marquee) {
        this.#marquee.element?.remove();
        this.#marquee = undefined;
      }
      this.#touches.set(e.pointerId, this.#local(e));
      this.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      this.#select_at(e);
    } else if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      this.#menu_press =
        e.button === 2
          ? { id: e.pointerId, x: e.clientX, y: e.clientY }
          : undefined;
      this.#pan_pointer_id = e.pointerId;
      this.#pan_pointer_last = this.#local(e);
      this.setPointerCapture(e.pointerId);
    }
  };

  #on_pointer_move = (e: PointerEvent) => {
    this.#ctrl_held = e.ctrlKey;
    if (e.pointerId === this.#marquee?.id) {
      this.#draw_marquee(e);
      return;
    }
    if (this.#touches.has(e.pointerId)) {
      const before = this.#pinch();
      this.#touches.set(e.pointerId, this.#local(e));
      const after = this.#pinch();
      if (!before || !after || before.distance <= 0) return;
      this.#pan_x += after.x - before.x;
      this.#pan_y += after.y - before.y;
      this.#zoom_at(after.x, after.y, after.distance / before.distance);
      this.#update_view();
    } else if (e.pointerId === this.#pan_pointer_id) {
      const point = this.#local(e);
      this.#pan_x += point.x - this.#pan_pointer_last.x;
      this.#pan_y += point.y - this.#pan_pointer_last.y;
      this.#pan_pointer_last = point;
      this.#update_view();
    }
  };

  #on_pointer_up = (e: PointerEvent) => {
    if (e.pointerId === this.#marquee?.id) this.#end_marquee(e);
    const press = this.#menu_press;
    if (press?.id === e.pointerId) {
      this.#menu_press = undefined;
      if (
        Math.hypot(e.clientX - press.x, e.clientY - press.y) <= MENU_SLOP &&
        e.type === "pointerup"
      )
        this.#open_menu(e.clientX, e.clientY);
    }
    this.#touches.delete(e.pointerId);
    if (e.pointerId === this.#pan_pointer_id) this.#pan_pointer_id = undefined;
  };

  /**Prevents the browser autoscroll on middle mouse button */
  #on_mouse_down = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  /**Prevents the context menu of the browser, as the right mouse button pans in edit mode, the viewport opens its own menu
   * when a right press is released without moving, a long press on touch gives this event, which opens it too*/
  #on_context_menu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ((e as PointerEvent).pointerType === "touch" && this.#touches.size <= 1)
      this.#open_menu(e.clientX, e.clientY);
  };

  /**The part of the page the viewport shows, in page units, pasted widgets are kept in it*/
  #shown_area():
    { x: number; y: number; width: number; height: number } | undefined {
    if (this.#scale <= 0) return undefined;
    const { width, height } = this.#measure();
    //The box around the viewport in the level, a turned level gives a box around the turned viewport
    const inverse = this.#level_matrix.inverse();
    const corners = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ].map(([x, y]) => inverse.transformPoint(new DOMPoint(x, y)));
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  /**Adds the widgets picked in the widget selector to the level edited, the first with its top left at the point, and selects them*/
  async #add_at(x: number, y: number) {
    const widgets = this.#page_data?.widgets;
    if (!state.is.state(widgets) || !widgets.writable) return;
    const picked = await select_widget({ mode: "multi", at: { x, y } });
    if (!picked.length) return;
    const written = await widgets.write?.(
      state.a.write.push<CanvasWidget>(...picked),
    );
    if (written?.ok) this.#select(picked);
  }

  /**A double click on a group edits inside it, one where there is no widget of the level edited goes up one level
   * The widget is found at the point, like for the menu, as the transformer of a selected group lies over it*/
  #on_double_click = (e: MouseEvent) => {
    const page = this.#page;
    if (!page) return;
    const { x, y } = this.#to_level(e.clientX, e.clientY);
    const [widget] = page.widgets_at(x, y);
    if (widget && is_group(widget)) {
      e.preventDefault();
      this.#enter(widget);
    } else if (!widget && this.#path.length) {
      e.preventDefault();
      this.#go_to(this.#path.length - 1);
    }
  };

  /**Resets zoom and pan, so the page fits the viewport again, like when the viewport is made*/
  #center_view() {
    this.#zoom = 1;
    this.#pan_x = 0;
    this.#pan_y = 0;
    this.#update_view();
  }

  /**The rotation of the box of the selection, a group made of it is turned by it*/
  #group_rotation(): number {
    return GroupRotation.of(
      this.input_state(VIEWPORT.selected) ?? this,
    ).rotation.ok();
  }

  /**Selects every widget of the page, in drawing order*/
  #select_all() {
    const page = this.#page;
    if (page) this.#select([...page.widgets]);
  }

  /**Keys of the focused viewport, ctrl+a selects all widgets, delete and backspace remove the selected ones*/
  #on_view_key = (e: KeyboardEvent) => {
    if (
      group_key(
        e,
        this.#page_data,
        this.#selected,
        this.#group_rotation(),
        (widgets) => this.#select(widgets),
      )
    ) {
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      this.#select_all();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      void this.#remove(this.#selected);
    }
  };

  /**Removes the widgets from the page, and takes them out of the selection*/
  async #remove(widgets: readonly CanvasWidget[]) {
    const data = this.#page_data;
    if (!data || !widgets.length) return;
    if (await remove_widgets(data, widgets)) this.#deselect(widgets);
  }

  /**Takes removed widgets out of the selection*/
  #deselect(widgets: readonly CanvasWidget[]) {
    const left = this.#selected.filter((widget) => !widgets.includes(widget));
    if (left.length !== this.#selected.length) this.#select(left);
  }

  /**Opens the menu of the widget in front at the client point, the menu of the viewport when no widget is there
   * A widget that is not selected is selected first, the menu acts on all selected widgets*/
  #open_menu(client_x: number, client_y: number) {
    const page = this.#page;
    const data = this.#page_data;
    if (!page || !data) return;
    const { x, y } = this.#to_level(client_x, client_y);
    const [widget] = page.widgets_at(x, y);
    const pasted = (widgets: CanvasWidget[]) => this.#select(widgets);
    const shown = this.#shown_area();
    if (!widget)
      return ctm.summon(
        ctm.menu([
          paste_line(data, pasted, { x, y }, shown),
          ctm.line({
            text: "Add widget",
            access:
              state.is.state(data.widgets) && data.widgets.writable
                ? AccessTypes.Write
                : AccessTypes.Read,
            on_click: () => void this.#add_at(x, y),
          }),
          ctm.divider(),
          ctm.line({
            text: "Select all",
            shortcut: "Ctrl+A",
            on_click: () => this.#select_all(),
          }),
          ctm.line({
            text: "Center view",
            on_click: () => this.#center_view(),
          }),
        ]),
        { element: this, x: client_x, y: client_y },
      );
    const targets = this.#selected.includes(widget) ? this.#selected : [widget];
    if (targets !== this.#selected) this.#select_only(widget);
    ctm.summon(
      ctm.menu([
        ...edit_lines(
          data,
          targets,
          () => this.#deselect(targets),
          pasted,
          { x, y },
          shown,
        ),
        delete_line(data, targets, () => this.#deselect(targets)),
        ctm.divider(),
        ...group_lines(data, targets, this.#group_rotation(), pasted),
        ...(targets.length === 1 && is_group(targets[0])
          ? [
              ctm.line({
                text: "Edit",
                on_click: () => this.#enter(targets[0]),
              }),
            ]
          : []),
        ctm.divider(),
        ...order_lines(data, targets),
        ctm.divider(),
        ctm.sub({
          text: "Select covered",
          //The widgets at the point when the submenu opens, as they can have moved since
          menu: ctm.menu(() =>
            Promise.resolve(
              page.widgets_at(x, y).map((covered) =>
                ctm.line({
                  text: widget_id(covered) || widget_name(covered),
                  checked: this.#selected.includes(covered),
                  on_click: () => this.#select_only(covered),
                }),
              ),
            ),
          ),
        }),
      ]),
      { element: this, x: client_x, y: client_y },
    );
  }

  #on_key = (e: KeyboardEvent) => {
    this.#ctrl_held = e.ctrlKey;
  };

  #on_blur = () => {
    this.#ctrl_held = false;
  };
}
define_element(Viewport);

export type { Viewport };

/**Creates a viewport showing a page of widgets */
export function canvas_viewport(options: CanvasViewportOptions = {}): Viewport {
  return Viewport.create(options);
}
