import {
  Base,
  CREATE,
  define_element,
  input_key,
  type InputOf,
  type InputOptions,
  type BaseOptions,
} from "#base";
import ctm from "#context_menu";
import { material_new_window_rounded } from "#icons";
import type { SVGFunc } from "#svg";
import { px_to_rem, rem_to_px } from "#theme";
import type { StateOrVal, StateOrValROS } from "@chocbite/ts-lib/state";
import {
  CONTENT_CLOSED,
  CONTENT_CREATE,
  content_context_lines,
  type ContentBase,
} from "./content";
import "./panel.scss";
import { anchor_fraction, clamp, CompAnchor } from "./shared";
import {
  content_window,
  type ContentWindow,
  open_on_interaction,
  page_on_screen,
  user_active,
  WINDOW_CLOSED,
  WINDOW_CONTENT_CLOSED,
  WINDOW_LEAVING,
  type WindowHost,
  type WindowPlace,
} from "./window";

/**Inputs of the panel*/
const PANEL = {
  /**Layer of the panel, panels in a higher layer are always above panels in a lower one*/
  layer: input_key<StateOrVal<number>>(),
  /**Horizontal position in rem from the left of the page, of the anchor point of the panel
   * Not given the panel starts centered, an initial value is where it starts, the user moves it from there,
   * a writable state is written when the user moves the panel, a read only state can not be moved*/
  x: input_key<StateOrValROS<number>>(),
  /**Vertical position in rem from the top of the page, of the anchor point of the panel, works like x*/
  y: input_key<StateOrValROS<number>>(),
  /**Point of the panel that x and y place, top_left by default*/
  anchor: input_key<StateOrVal<CompAnchor>>(),
  /**Width in rem, not given the panel fits its content
   * An initial value is the width it starts with, the user sizes it from there,
   * a writable state is written when the user sizes the panel, a read only state can not be sized*/
  width: input_key<StateOrValROS<number>>(),
  /**Height in rem, works like width*/
  height: input_key<StateOrValROS<number>>(),
  /**Whether the user can size the panel, at the sides where width and height can be written, true by default*/
  sizeable: input_key<StateOrVal<boolean>>(),
  /**Whether the panel is hidden, auto_hide changes it, so give a writable state to show the panel again*/
  hidden: input_key<StateOrValROS<boolean>>(),
  /**Hides the panel when the user presses outside it*/
  auto_hide: input_key<StateOrVal<boolean>>(),
  /**Closes the panel when the user presses outside it, when its content agrees, see content_close*/
  auto_close: input_key<StateOrVal<boolean>>(),
  /**Darkens the page behind the panel and keeps the focus in it*/
  modal: input_key<StateOrVal<boolean>>(),
  /**Whether the title bar is shown, true by default*/
  titlebar: input_key<StateOrVal<boolean>>(),
  /**Whether the content is shown in a browser window of its own instead of in the panel, the user opens it from the menu of the title bar,
   * closing the window puts the content back in the panel, where the window was
   * An initial value is where it starts, a writable state is written when the user opens or closes the window, a read only state keeps it,
   * when the browser blocks the window, as it does without a click or key press of the user, the panel stays and writes false*/
  window: input_key<StateOrValROS<boolean>>(),
};
export type PanelOptions = BaseOptions & InputOptions<typeof PANEL>;

/**Inputs of the content the panel follows, inner inputs that are not options*/
const PANEL_CONTENT = {
  title: input_key<InputOf<typeof CONTENT_CREATE.title>>(),
  icon: input_key<InputOf<typeof CONTENT_CREATE.icon>>(),
  closable: input_key<InputOf<typeof CONTENT_CREATE.closable>>(),
  min_width: input_key<InputOf<typeof CONTENT_CREATE.min_width>>(),
  min_height: input_key<InputOf<typeof CONTENT_CREATE.min_height>>(),
};

/**Smallest size of a panel in rem*/
const MIN_SIZE = 4;
/**How much of the panel is kept inside the container, at the top in rem, at the sides as part of its width*/
const KEEP_TOP = 2;
const KEEP_SIDE = 0.5;
/**Height of the title bar in rem, and in touch mode, the only place they are given,
 * panel.scss uses them through the variables set below, the size calculation of the panel reads them here.
 * Exported for the tests, not from the module*/
export const TITLEBAR_HEIGHT = 1.6;
export const TITLEBAR_HEIGHT_TOUCH = 2.6;
document.documentElement.style.setProperty(
  "--composition-titlebar-height",
  TITLEBAR_HEIGHT + "rem",
);
document.documentElement.style.setProperty(
  "--composition-titlebar-height-touch",
  TITLEBAR_HEIGHT_TOUCH + "rem",
);

//Internal to this module, between the panel and its container
export const PANEL_ADDED = Symbol("panel_added");
export const PANEL_PLACE = Symbol("panel_place");
export const PANEL_LAYER = Symbol("panel_layer");
export const PANEL_MOVE = Symbol("panel_move");
export const HOST_LAYER = Symbol("host_layer");
export const HOST_RAISE = Symbol("host_raise");
export const HOST_REMOVE = Symbol("host_remove");
export const HOST_ADOPT = Symbol("host_adopt");

/**The container of a panel, as the panel sees it*/
export interface PanelHost {
  /**Width and height in rem, from one measurement*/
  size(): { width: number; height: number };
  /**Moves the panel into the given layer*/
  [HOST_LAYER](panel: Panel, layer: number): void;
  /**Puts the panel above the others in its layer*/
  [HOST_RAISE](panel: Panel): void;
  /**Forgets the panel, it is closed or shown by another container*/
  [HOST_REMOVE](panel: Panel): void;
  /**Takes the panels of the container of the document, moved by dx and dy in rem*/
  [HOST_ADOPT](from: Document, dx: number, dy: number): void;
}

/**Size in rem of the page of a window opened for a panel that is not shown, like a hidden one*/
const WINDOW_SIZE = { width: 40, height: 25 };

/**Values of the inputs the user can change by moving, sizing, hiding or opening the panel in a window*/
interface ChangeableValues {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  hidden: boolean;
  window: boolean;
}
type Changeable = keyof ChangeableValues;

class Panel extends Base implements WindowHost {
  static element_name() {
    return "panel";
  }
  static element_name_space() {
    return "composition";
  }

  #host: PanelHost;
  readonly #content: ContentBase;
  /**Whether the container shows the panel, until then it is not in the document and can not be placed*/
  #shown = false;
  /**The document listened to for presses outside the panel*/
  #listening?: Document;

  #sizer = this.appendChild(document.createElement("div"));
  #titlebar = this.appendChild(document.createElement("div"));
  #icon?: HTMLDivElement;
  #title = this.#titlebar.appendChild(document.createElement("div"));
  #close_button?: HTMLSpanElement;
  #content_box = this.appendChild(document.createElement("div"));
  #focus_catcher?: HTMLDivElement;
  /**Darkens the page behind a modal panel, a sibling before the panel in its layer
   * Not a child, the translate placing the panel would make it fixed to the panel instead of the page*/
  #backdrop?: HTMLDivElement;

  #layer = 0;
  #anchor: CompAnchor = CompAnchor.TOP_LEFT;
  #sizeable = true;
  #auto_hide = false;
  #auto_close = false;
  #min_width = 0;
  #min_height = 0;
  /**Values of the changeable inputs, the panel owns them until they are given*/
  #values: ChangeableValues = { hidden: false, window: false };
  /**Browser window showing the content, while it is open*/
  #window?: ContentWindow;
  /**Stops waiting for a click or key press to open the window, while the panel waits hidden for one*/
  #waiting?: () => void;
  /**Height of the title bar in rem when the window opened, the panel is not shown while it is open*/
  #titlebar_height = 0;
  #moving = false;
  #on_close: (() => void)[] = [];

  /**@param content what the panel shows
   * @param host the container showing the panel, until another one takes it*/
  constructor(content: ContentBase, host: PanelHost) {
    super();
    this.#content = content;
    this.#host = host;
    this.#content_box.appendChild(content);
    this.tabIndex = 0;
    this.addEventListener("focus", () => this.#content.focus());
    this.addEventListener("focusin", () => {
      if (this.#shown) this.#raise();
    });
    this.addEventListener("content_closed", (e) => {
      e.stopPropagation();
      this.close();
    });

    this.#titlebar.tabIndex = 0;
    this.#title.classList.add("title");
    ctm.attach(
      this.#titlebar,
      ctm.combine(
        () => content_context_lines(this.#content),
        () => this.#window_lines(),
      ),
      () => this.#moving,
    );
    this.#titlebar.onpointerdown = (e) => this.#move_start(e);
    this.#titlebar.onkeydown = (e) => this.#move_key(e);

    for (const side of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
      const handle = this.#sizer.appendChild(document.createElement("div"));
      handle.classList.add(side);
      if (side.length === 1)
        handle.appendChild(document.createElement("div")).textContent =
          "\ue25d";
      handle.onpointerdown = (e) => this.#size_start(e, handle, side);
    }
    this.#show_sizers();
  }

  [CREATE](options: object): void {
    super[CREATE](options);
    const content = this.#content;
    this.set_input(PANEL_CONTENT.icon, content.content_icon, (icon) =>
      this.#set_icon(icon.ok ? icon.value : undefined),
    );
    this.set_input(PANEL_CONTENT.title, content.content_title, (title) => {
      this.#title.textContent = title.ok
        ? title.value
        : "⚠ " + title.error.nice;
    });
    this.set_input(PANEL_CONTENT.closable, content.content_closable, (c) =>
      this.#set_closable(c.ok && c.value),
    );
    this.set_input(PANEL_CONTENT.min_width, content.content_min_width, (w) => {
      this.#min_width = w.ok ? w.value : 0;
      this.style.minWidth = Math.max(MIN_SIZE, this.#min_width) + "rem";
    });
    this.set_input(
      PANEL_CONTENT.min_height,
      content.content_min_height,
      (h) => {
        this.#min_height = h.ok ? h.value : 0;
        this.style.minHeight = `calc(${Math.max(MIN_SIZE, this.#min_height)}rem + var(--titlebar-height))`;
      },
    );
  }

  set(options: PanelOptions): this {
    super.set(options);
    this.set_input(PANEL.layer, options.layer, (layer) => {
      this.#layer = layer.ok ? layer.value : 0;
      if (this.#shown) {
        this.#host[HOST_LAYER](this, this.#layer);
        this.#place_backdrop();
      }
    });
    this.set_input(PANEL.anchor, options.anchor, (anchor) => {
      this.#anchor = anchor.ok ? anchor.value : CompAnchor.TOP_LEFT;
      this.#place();
    });
    for (const name of ["x", "y"] as const) {
      this.set_input(PANEL[name], options[name], (value) => {
        this.#values[name] = value.value;
        this.#place();
      });
    }
    this.set_input(PANEL.width, options.width, (width) => {
      this.#values.width = width.value;
      this.#show_width();
      this.#show_sizers();
    });
    this.set_input(PANEL.height, options.height, (height) => {
      this.#values.height = height.value;
      this.#show_height();
      this.#show_sizers();
    });
    this.set_input(PANEL.hidden, options.hidden, (hidden) => {
      this.#values.hidden = hidden.value;
      this.#show_hidden();
    });
    this.set_input(PANEL.sizeable, options.sizeable, (sizeable) => {
      this.#sizeable = sizeable.ok && sizeable.value;
      this.#show_sizers();
    });
    this.set_input(PANEL.auto_hide, options.auto_hide, (auto_hide) => {
      this.#auto_hide = auto_hide.ok && auto_hide.value;
    });
    this.set_input(PANEL.auto_close, options.auto_close, (auto_close) => {
      this.#auto_close = auto_close.ok && auto_close.value;
    });
    this.set_input(PANEL.modal, options.modal, (modal) =>
      this.#set_modal(modal.ok && modal.value),
    );
    this.set_input(PANEL.titlebar, options.titlebar, (titlebar) =>
      this.classList.toggle("no-titlebar", !(titlebar.ok && titlebar.value)),
    );
    this.set_input(PANEL.window, options.window, (windowed) => {
      this.#values.window = windowed.value;
      this.#show_window();
    });
    return this;
  }

  /**Content the panel shows, given when the panel is created*/
  get content(): ContentBase {
    return this.#content;
  }

  /**Resolves when the panel is closed*/
  on_close(): Promise<void> {
    return new Promise<void>((resolve) => this.#on_close.push(resolve));
  }

  /**Closes the panel and its content without asking the content, content_close asks it*/
  close(): void {
    this.#stop_waiting();
    this.#close_window();
    if (this.#shown) this.#host[HOST_REMOVE](this);
    this.#shown = false;
    this.#backdrop?.remove();
    this.remove();
    this.#content[CONTENT_CLOSED]();
    for (const resolve of this.#on_close.splice(0)) resolve();
  }

  /**Called by the container once, after creating the panel, puts it in the document and places it*/
  [PANEL_ADDED](): void {
    this.#shown = true;
    this.#host[HOST_LAYER](this, this.#layer);
    this.#raise();
    this.#place();
    this.#show_window();
  }

  protected connectedCallback(): void {
    super.connectedCallback();
    this.#listen();
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listen();
  }

  /**Listens for presses outside the panel in the document it is in while it is shown, it moves with the panel to other documents*/
  #listen(): void {
    const doc =
      this.#shown && this.isConnected ? this.ownerDocument : undefined;
    if (doc === this.#listening) return;
    this.#listening?.removeEventListener("pointerdown", this.#outside, {
      capture: true,
    });
    doc?.addEventListener("pointerdown", this.#outside, {
      capture: true,
      passive: true,
    });
    this.#listening = doc;
  }

  /**Called by the container when its size changes, the panel is kept inside it*/
  [PANEL_PLACE](): void {
    this.#place();
  }

  /**Called by the container taking the panel from another container, the panel moves into its document,
   * its position moved by dx and dy in rem*/
  [PANEL_MOVE](host: PanelHost, dx: number, dy: number): void {
    this.#host[HOST_REMOVE](this);
    this.#host = host;
    host[HOST_LAYER](this, this.#layer);
    this.#raise();
    const { x, y } = this.#values;
    if (x !== undefined && this.#can_change("x")) this.#change("x", x + dx);
    if (y !== undefined && this.#can_change("y")) this.#change("y", y + dy);
    this.#place();
  }

  /**The layer input of the panel, the state it was given or its value, see panel_layer*/
  [PANEL_LAYER](): StateOrVal<number> {
    return this.input_state(PANEL.layer) ?? this.#layer;
  }

  //       _____ _    _          _   _  _____ ______
  //      / ____| |  | |   /\   | \ | |/ ____|  ____|
  //     | |    | |__| |  /  \  |  \| | |  __| |__
  //     | |    |  __  | / /\ \ | . ` | | |_ |  __|
  //     | |____| |  | |/ ____ \| |\  | |__| | |____
  //      \_____|_|  |_/_/    \_\_| \_|\_____|______|
  /**Whether the user can change the input, every input but a read only state*/
  #can_change(name: Changeable): boolean {
    const state = this.#state_of(name);
    return state === undefined || state.writable;
  }

  /**The state the input has, undefined for an initial value or one never given*/
  #state_of(name: Changeable) {
    return this.input_state<StateOrValROS<number | boolean>>(PANEL[name]);
  }

  /**Writes a change by the user, to a writable state, or to the panel for an initial value or one never given*/
  #change<N extends Changeable>(
    name: N,
    value: NonNullable<ChangeableValues[N]>,
  ): void {
    const state = this.#state_of(name);
    if (state) {
      if (state.writable) void state.write?.(value);
    } else {
      this.#values[name] = value;
      if (name === "x" || name === "y") this.#place();
      else if (name === "width") this.#show_width();
      else if (name === "height") this.#show_height();
      else if (name === "hidden") this.#show_hidden();
      else this.#show_window();
    }
  }

  #outside = (e: Event) => {
    if (this.#values.hidden || this.#window || this.#waiting) return;
    if (this.contains(e.target as Node) && e.target !== this) return;
    //Through the content, which can refuse, like to ask about unsaved changes
    if (this.#auto_close) void this.#content.content_close();
    else if (this.#auto_hide) this.#change("hidden", true);
  };

  //      _           __     ______  _    _ _______
  //     | |        /\\ \   / / __ \| |  | |__   __|
  //     | |       /  \\ \_/ / |  | | |  | |  | |
  //     | |      / /\ \\   /| |  | | |  | |  | |
  //     | |____ / ____ \| | | |__| | |__| |  | |
  //     |______/_/    \_\_|  \____/ \____/   |_|
  /**Places the anchor point of the panel at x and y, the browser keeps it there when the size of the panel changes,
   * left and top place the anchor point and the translate moves the panel by its own size.
   * Without a position the panel is centered. The position is clamped for showing, so part of the panel stays
   * inside the container, the inputs keep their values*/
  #place(): void {
    if (!this.#shown || this.#values.hidden || this.#window || this.#waiting)
      return;
    const [ax, ay] = anchor_fraction(this.#anchor);
    const { x, y } = this.#values;
    if (x !== undefined || y !== undefined) {
      //Clamping needs the size of the panel, from width and height when they give it, else one measurement for both axes
      const host = this.#host.size();
      let w = this.#known_width(host.width);
      let h = this.#known_height(host.height);
      if (w === undefined || h === undefined) {
        const rect = this.getBoundingClientRect();
        w = px_to_rem(rect.width);
        h = px_to_rem(rect.height);
      }
      const corner = this.#clamp_corner(
        (x ?? 0) - w * ax,
        (y ?? 0) - h * ay,
        w,
        host,
      );
      if (x !== undefined) this.style.left = corner.left + w * ax + "rem";
      if (y !== undefined) this.style.top = corner.top + h * ay + "rem";
    }
    if (x === undefined) this.style.left = "50%";
    if (y === undefined) this.style.top = "50%";
    this.style.transform = `translate(${-(x === undefined ? 0.5 : ax) * 100}%, ${-(y === undefined ? 0.5 : ay) * 100}%)`;
  }

  /**Width shown for the width input, as the styles give it, the minimum wins over the container*/
  #known_width(host_width: number): number | undefined {
    const { width } = this.#values;
    if (width === undefined) return undefined;
    return Math.max(MIN_SIZE, this.#min_width, Math.min(width, host_width));
  }

  /**Height shown for the height input, unknown near the minimum, as that adds the title bar whose height the styles decide*/
  #known_height(host_height: number): number | undefined {
    const { height } = this.#values;
    if (height === undefined) return undefined;
    const shown = Math.min(height, host_height);
    return shown >= Math.max(MIN_SIZE, this.#min_height) + TITLEBAR_HEIGHT_TOUCH
      ? shown
      : undefined;
  }

  /**Top left corner clamped so part of the panel stays inside the container,
   * half its width at the sides and the title bar at the bottom, the top edge never above the container*/
  #clamp_corner(
    left: number,
    top: number,
    w: number,
    host = this.#host.size(),
  ): { left: number; top: number } {
    const keep = w * KEEP_SIDE;
    return {
      left: clamp(left, -keep, host.width - keep),
      top: clamp(top, 0, Math.max(0, host.height - KEEP_TOP)),
    };
  }

  #show_width(): void {
    const { width } = this.#values;
    this.style.width = width === undefined ? "" : width + "rem";
  }

  #show_height(): void {
    const { height } = this.#values;
    this.style.height = height === undefined ? "" : height + "rem";
  }

  /**The sides the user can size, where sizeable allows it and the size is not a read only state*/
  #show_sizers(): void {
    const x = this.#sizeable && this.#can_change("width");
    const y = this.#sizeable && this.#can_change("height");
    this.#sizer.classList.toggle("x", x);
    this.#sizer.classList.toggle("y", y);
    this.classList.toggle("size-x", x);
    this.classList.toggle("size-y", y);
  }

  #show_hidden(): void {
    this.classList.toggle("hidden", this.#values.hidden);
    this.#place_backdrop();
    //A hidden panel is not placed, it is placed when shown again
    this.#place();
  }

  /**Top left corner of the panel as shown, in rem, the container fills the page from its top left*/
  #corner(): { left: number; top: number; width: number; height: number } {
    const rect = this.getBoundingClientRect();
    return {
      left: px_to_rem(rect.left),
      top: px_to_rem(rect.top),
      width: px_to_rem(rect.width),
      height: px_to_rem(rect.height),
    };
  }

  //      __  __  ______      _______ _   _  _____
  //     |  \/  |/ __ \ \    / /_   _| \ | |/ ____|
  //     | \  / | |  | \ \  / /  | | |  \| | |  __
  //     | |\/| | |  | |\ \/ /   | | | . ` | | |_ |
  //     | |  | | |__| | \  /   _| |_| |\  | |__| |
  //     |_|  |_|\____/   \/   |_____|_| \_|\_____|
  /**Moves the panel so its top left corner is at the given position, clamped, on the axes the user can change*/
  #move_to(left: number, top: number, w: number, h: number): void {
    const [ax, ay] = anchor_fraction(this.#anchor);
    const corner = this.#clamp_corner(left, top, w);
    if (this.#can_change("x")) this.#change("x", corner.left + w * ax);
    if (this.#can_change("y")) this.#change("y", corner.top + h * ay);
  }

  #move_start(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (!this.#can_change("x") && !this.#can_change("y")) return;
    const titlebar = this.#titlebar;
    titlebar.setPointerCapture(e.pointerId);
    titlebar.classList.add("moving");
    this.#moving = true;
    const start = this.#corner();
    titlebar.onpointermove = (ev) =>
      this.#move_to(
        start.left + px_to_rem(ev.clientX - e.clientX),
        start.top + px_to_rem(ev.clientY - e.clientY),
        start.width,
        start.height,
      );
    titlebar.onpointerup = (ev) => {
      titlebar.releasePointerCapture(ev.pointerId);
      titlebar.classList.remove("moving");
      this.#moving = false;
      titlebar.onpointermove = null;
      titlebar.onpointerup = null;
    };
  }

  #move_key(e: KeyboardEvent): void {
    const step = e.shiftKey ? 5 : e.ctrlKey ? 0.1 : 1;
    const [dx, dy] =
      {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[e.key] ?? [];
    if (dx === undefined || dy === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    const at = this.#corner();
    this.#move_to(at.left + dx, at.top + dy, at.width, at.height);
  }

  //       _____ _____ ___________ _   _  _____
  //      / ____|_   _|___  /_   _| \ | |/ ____|
  //     | (___   | |    / /  | | |  \| | |  __
  //      \___ \  | |   / /   | | | . ` | | |_ |
  //      ____) |_| |_ / /__ _| |_| |\  | |__| |
  //     |_____/|_____/_____|_____|_| \_|\_____|
  /**Sizes the panel from one side or corner, the opposite side stays where it is when x and y can be written*/
  #size_start(e: PointerEvent, handle: HTMLDivElement, side: string): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    const host = this.#host.size();
    handle.setPointerCapture(e.pointerId);
    const { left: left0, top: top0, width: w0, height: h0 } = this.#corner();
    const [ax, ay] = anchor_fraction(this.#anchor);
    const min_w = Math.max(MIN_SIZE, this.#min_width);
    const min_h =
      Math.max(MIN_SIZE, this.#min_height) +
      px_to_rem(this.#titlebar.getBoundingClientRect().height);
    const horizontal = this.#sizer.classList.contains("x");
    const vertical = this.#sizer.classList.contains("y");
    handle.onpointermove = (ev) => {
      const dx = px_to_rem(ev.clientX - e.clientX);
      const dy = px_to_rem(ev.clientY - e.clientY);
      if (horizontal && (side.includes("e") || side.includes("w"))) {
        const east = side.includes("e");
        const w = clamp(east ? w0 + dx : w0 - dx, min_w, host.width);
        this.#change("width", w);
        if (this.#can_change("x"))
          this.#change("x", (east ? left0 : left0 + w0 - w) + w * ax);
      }
      if (vertical && (side.includes("n") || side.includes("s"))) {
        const south = side.includes("s");
        const h = clamp(south ? h0 + dy : h0 - dy, min_h, host.height);
        this.#change("height", h);
        if (this.#can_change("y"))
          this.#change("y", (south ? top0 : top0 + h0 - h) + h * ay);
      }
    };
    handle.onpointerup = (ev) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.onpointermove = null;
      handle.onpointerup = null;
      this.#titlebar.focus();
    };
  }

  //     __          _______ _   _ _____   ______          __
  //     \ \        / /_   _| \ | |  __ \ / __ \ \        / /
  //      \ \  /\  / /  | | |  \| | |  | | |  | \ \  /\  / /
  //       \ \/  \/ /   | | | . ` | |  | | |  | |\ \/  \/ /
  //        \  /\  /   _| |_| |\  | |__| | |__| | \  /\  /
  //         \/  \/   |_____|_| \_|_____/ \____/   \/  \/
  #window_lines() {
    if (this.#window || !this.#can_change("window")) return [];
    return [
      ctm.line({
        text: "Open in window",
        icon: material_new_window_rounded,
        on_click: () => this.#change("window", true),
      }),
    ];
  }

  /**Opens or closes the window to match the window input, opened once the panel is shown
   * Without a click or key press of the user the browser blocks the window, the panel then waits hidden for the next one,
   * blocked during one the browser does not let the page open windows, the panel stays and writes false
   * The panel fires window_opened when the window opened*/
  #show_window(): void {
    if (this.#values.window && !this.#window && !this.#waiting && this.#shown) {
      this.#titlebar_height = px_to_rem(
        this.#titlebar.getBoundingClientRect().height,
      );
      const opened = content_window(this.#content, this.#window_place(), this);
      if (!opened) {
        if (user_active()) return this.#change("window", false);
        this.classList.add("windowed");
        this.#place_backdrop();
        this.#waiting = open_on_interaction(() => {
          this.#waiting = undefined;
          this.classList.remove("windowed");
          this.#place_backdrop();
          this.#show_window();
          this.#place();
        });
        return;
      }
      this.#window = opened;
      this.classList.add("windowed");
      this.#place_backdrop();
      this.dispatchEvent(new Event("window_opened"));
    } else if (!this.#values.window) {
      this.#stop_waiting();
      this.#close_window();
    }
  }

  /**Stops waiting for a click or key press to open the window, the panel is shown again*/
  #stop_waiting(): void {
    if (!this.#waiting) return;
    this.#waiting();
    this.#waiting = undefined;
    this.classList.remove("windowed");
    this.#place_backdrop();
    this.#place();
  }

  /**Closes the window, its content and the panels in it come back first*/
  #close_window(): void {
    const open = this.#window;
    if (!open) return;
    this.#window = undefined;
    this.#back(open, open.place());
    open.close();
  }

  /**Where the window goes on the screen, its frame where the panel is and its page the size of the content box*/
  #window_place(): WindowPlace {
    const rect = this.getBoundingClientRect();
    const box = this.#content_box.getBoundingClientRect();
    const view = this.ownerDocument.defaultView;
    const page = view ? page_on_screen(view) : undefined;
    const shown = box.width > 0 && box.height > 0;
    return {
      left: page && shown ? page.left + rect.left : undefined,
      top: page && shown ? page.top + rect.top : undefined,
      width: shown ? box.width : rem_to_px(WINDOW_SIZE.width),
      height: shown ? box.height : rem_to_px(WINDOW_SIZE.height),
    };
  }

  /**Takes back what is in the window, the content into the panel, which gets the size and place of the window,
   * and the panels opened in the window into the container of the panel, where they were over the content*/
  #back(open: ContentWindow, place: WindowPlace): void {
    this.#content_box.appendChild(this.#content);
    this.classList.remove("windowed");
    this.#place_backdrop();
    this.#take_place(place);
    this.#place();
    const box = this.#content_box.getBoundingClientRect();
    this.#host[HOST_ADOPT](
      open.document,
      px_to_rem(box.left),
      px_to_rem(box.top),
    );
  }

  /**Gives the panel the size of the window and puts it where the window is,
   * where the user can change them and the browser tells where the window is*/
  #take_place(place: WindowPlace): void {
    if (this.#sizeable && this.#can_change("width"))
      this.#change("width", px_to_rem(place.width));
    if (this.#sizeable && this.#can_change("height"))
      this.#change("height", px_to_rem(place.height) + this.#titlebar_height);
    const view = this.ownerDocument.defaultView;
    if (!view || place.left === undefined || place.top === undefined) return;
    const page = page_on_screen(view);
    const [ax, ay] = anchor_fraction(this.#anchor);
    const width = this.#values.width ?? px_to_rem(place.width);
    const height =
      this.#values.height ?? px_to_rem(place.height) + this.#titlebar_height;
    const corner = this.#clamp_corner(
      px_to_rem(place.left - page.left),
      px_to_rem(place.top - page.top),
      width,
    );
    if (this.#can_change("x")) this.#change("x", corner.left + width * ax);
    if (this.#can_change("y")) this.#change("y", corner.top + height * ay);
  }

  [WINDOW_CLOSED](place: WindowPlace): void {
    const open = this.#window;
    this.#window = undefined;
    if (open) this.#back(open, place);
    this.#change("window", false);
  }

  [WINDOW_LEAVING](place: WindowPlace): void {
    this.#take_place(place);
  }

  [WINDOW_CONTENT_CLOSED](): void {
    this.close();
  }

  //               _____ _____ ______  _____ _____  ____  _____  _____ ______  _____
  //         /\   / ____/ ____|  ____|/ ____/ ____|/ __ \|  __ \|_   _|  ____|/ ____|
  //        /  \ | |   | |    | |__  | (___| (___ | |  | | |__) | | | | |__  | (___
  //       / /\ \| |   | |    |  __|  \___ \\___ \| |  | |  _  /  | | |  __|  \___ \
  //      / ____ \ |___| |____| |____ ____) |___) | |__| | | \ \ _| |_| |____ ____) |
  //     /_/    \_\_____\_____|______|_____/_____/ \____/|_|  \_\_____|______|_____/
  #set_icon(icon?: SVGFunc): void {
    if (icon) {
      this.#icon ??= this.#titlebar.insertBefore(
        document.createElement("div"),
        this.#title,
      );
      this.#icon.classList.add("icon");
      this.#icon.replaceChildren(icon());
    } else {
      this.#icon?.remove();
      this.#icon = undefined;
    }
  }

  #set_closable(closable: boolean): void {
    if (closable && !this.#close_button) {
      const button = (this.#close_button = this.#titlebar.appendChild(
        document.createElement("span"),
      ));
      button.classList.add("close-button");
      button.textContent = "×";
      button.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        button.setPointerCapture(e.pointerId);
        button.onpointerup = (e) => {
          button.releasePointerCapture(e.pointerId);
          button.onpointerup = null;
          const rect = button.getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          )
            //Through the content, which closes the panel with it, or decides how it is closed
            this.#content.content_close();
        };
      };
      button.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      button.ontouchend = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      };
    } else if (!closable && this.#close_button) {
      this.#close_button.remove();
      this.#close_button = undefined;
    }
  }

  /**Puts the panel above the others of its layer, with its backdrop right under it*/
  #raise(): void {
    this.#host[HOST_RAISE](this);
    this.#place_backdrop();
  }

  /**Keeps the backdrop right before the panel in its layer, at its height, shown while the panel is*/
  #place_backdrop(): void {
    const backdrop = this.#backdrop;
    if (!backdrop) return;
    if (!this.#shown) return backdrop.remove();
    if (backdrop.nextSibling !== this) this.before(backdrop);
    backdrop.style.zIndex = this.style.zIndex;
    backdrop.hidden = this.#values.hidden || !!this.#window || !!this.#waiting;
  }

  #set_modal(modal: boolean): void {
    this.classList.toggle("modal", modal);
    if (modal && !this.#backdrop) {
      this.#backdrop = document.createElement("div");
      this.#backdrop.classList.add("backdrop");
      this.#place_backdrop();
    } else if (!modal && this.#backdrop) {
      this.#backdrop.remove();
      this.#backdrop = undefined;
    }
    if (modal && !this.#focus_catcher) {
      //Tabbing past the end of the panel comes back to its content
      this.#focus_catcher = this.appendChild(document.createElement("div"));
      this.#focus_catcher.tabIndex = 0;
      this.#focus_catcher.onfocus = () => this.#content.focus();
    } else if (!modal && this.#focus_catcher) {
      this.#focus_catcher.remove();
      this.#focus_catcher = undefined;
    }
  }
}
define_element(Panel);

export { Panel };
