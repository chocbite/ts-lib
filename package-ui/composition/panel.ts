import {
  Base,
  CREATE,
  define_element,
  input_key,
  type InputOf,
  type InputOptions,
} from "#base";
import ctm from "#context-menu";
import type { SVGFunc } from "#svg";
import { px_to_rem } from "#theme";
import type { StateOrVal, StateOrValROSW } from "@chocbite/ts-lib/state";
import {
  CONTENT_CLOSED,
  CONTENT_CREATE,
  content_context_lines,
  type ContentBase,
} from "./content";
import "./panel.scss";
import { anchor_fraction, CompAnchor } from "./shared";

/**Inputs of the panel*/
const PANEL = {
  /**Layer of the panel, panels in a higher layer are always above panels in a lower one*/
  layer: input_key<StateOrVal<number>>(),
  /**Horizontal position in rem from the left of the page, of the anchor point of the panel
   * Not given the panel starts centered, a fixed value can not be moved by the user, a writable state is written when the user moves the panel*/
  x: input_key<StateOrValROSW<number>>(),
  /**Vertical position in rem from the top of the page, of the anchor point of the panel, works like x*/
  y: input_key<StateOrValROSW<number>>(),
  /**Point of the panel that x and y place, top_left by default*/
  anchor: input_key<StateOrVal<CompAnchor>>(),
  /**Width in rem, not given the panel fits its content
   * A fixed value can not be sized by the user, a writable state is written when the user sizes the panel*/
  width: input_key<StateOrValROSW<number>>(),
  /**Height in rem, works like width*/
  height: input_key<StateOrValROSW<number>>(),
  /**Whether the user can size the panel, at the sides where width and height can be written, true by default*/
  sizeable: input_key<StateOrVal<boolean>>(),
  /**Whether the panel is hidden, auto_hide writes it, so give a writable state to show the panel again*/
  hidden: input_key<StateOrValROSW<boolean>>(),
  /**Hides the panel when the user presses outside it*/
  auto_hide: input_key<StateOrVal<boolean>>(),
  /**Closes the panel when the user presses outside it*/
  auto_close: input_key<StateOrVal<boolean>>(),
  /**Darkens the page behind the panel and keeps the focus in it*/
  modal: input_key<StateOrVal<boolean>>(),
  /**Whether the title bar is shown, true by default*/
  titlebar: input_key<StateOrVal<boolean>>(),
};
export type PanelOptions = InputOptions<typeof PANEL>;

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

//Internal to this module, between the panel and its container
export const PANEL_ADDED = Symbol("panel_added");
export const PANEL_LAYOUT = Symbol("panel_layout");
export const HOST_LAYER = Symbol("host_layer");
export const HOST_RAISE = Symbol("host_raise");
export const HOST_REMOVE = Symbol("host_remove");

/**The container of a panel, as the panel sees it*/
export interface PanelHost {
  /**Width in rem*/
  readonly width: number;
  /**Height in rem*/
  readonly height: number;
  /**Moves the panel into the given layer*/
  [HOST_LAYER](panel: Panel, layer: number): void;
  /**Puts the panel above the others in its layer*/
  [HOST_RAISE](panel: Panel): void;
  /**Forgets the panel, it is closed*/
  [HOST_REMOVE](panel: Panel): void;
}

/**Values of the inputs the user can change by moving, sizing or hiding the panel*/
interface ChangeableValues {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  hidden: boolean;
}
type Changeable = keyof ChangeableValues;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

class Panel extends Base {
  static element_name() {
    return "panel";
  }
  static element_name_space() {
    return "composition";
  }

  #host?: PanelHost;
  #content!: ContentBase;

  #sizer = this.appendChild(document.createElement("div"));
  #titlebar = this.appendChild(document.createElement("div"));
  #icon?: HTMLDivElement;
  #title = this.#titlebar.appendChild(document.createElement("div"));
  #close_button?: HTMLSpanElement;
  #content_box = this.appendChild(document.createElement("div"));
  #focus_catcher?: HTMLDivElement;

  #layer = 0;
  #anchor: CompAnchor = CompAnchor.TOP_LEFT;
  #sizeable = true;
  #auto_hide = false;
  #auto_close = false;
  #min_width = 0;
  #min_height = 0;
  /**Values of the changeable inputs, the panel owns them until they are given*/
  #values: ChangeableValues = { hidden: false };
  #given = new Set<Changeable>();
  /**Position shown last, in rem, the start of moving and sizing*/
  #left = 0;
  #top = 0;
  #moving = false;
  #on_close: (() => void)[] = [];

  constructor() {
    super();
    this.tabIndex = 0;
    this.attach_to_resize_observer();
    this.addEventListener("focus", () => this.#content.focus());
    this.addEventListener("focusin", () => this.#host?.[HOST_RAISE](this));
    this.addEventListener("content_closed", (e) => {
      e.stopPropagation();
      this.close();
    });

    this.#titlebar.tabIndex = 0;
    this.#title.classList.add("title");
    ctm.attach(
      this.#titlebar,
      ctm.combine(() => content_context_lines(this.#content)),
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
  }

  [CREATE](options: { content: ContentBase }): void {
    super[CREATE](options);
    const content = (this.#content = options.content);
    this.#content_box.appendChild(content);
    this.set_input(PANEL_CONTENT.icon, content.content_icon, (icon) =>
      this.#set_icon(icon.ok ? icon.value : undefined),
    );
    this.set_input(PANEL_CONTENT.title, content.content_title, (title) => {
      this.#title.textContent = title.ok ? title.value : "⚠ " + title.error.nice;
    });
    this.set_input(PANEL_CONTENT.closable, content.content_closable, (c) =>
      this.#set_closable(c.ok && c.value),
    );
    this.set_input(PANEL_CONTENT.min_width, content.content_min_width, (w) => {
      this.#min_width = w.ok ? w.value : 0;
      this.#layout();
    });
    this.set_input(
      PANEL_CONTENT.min_height,
      content.content_min_height,
      (h) => {
        this.#min_height = h.ok ? h.value : 0;
        this.#layout();
      },
    );
  }

  set(options: PanelOptions): this {
    this.set_input(PANEL.layer, options.layer, (layer) => {
      this.#layer = layer.ok ? layer.value : 0;
      this.#host?.[HOST_LAYER](this, this.#layer);
    });
    this.set_input(PANEL.anchor, options.anchor, (anchor) => {
      this.#anchor = anchor.ok ? anchor.value : CompAnchor.TOP_LEFT;
      this.#layout();
    });
    for (const name of ["x", "y", "width", "height"] as const) {
      if (options[name] !== undefined) this.#given.add(name);
      this.set_input(PANEL[name], options[name], (value) => {
        this.#values[name] = value.value;
        this.#layout();
      });
    }
    if (options.hidden !== undefined) this.#given.add("hidden");
    this.set_input(PANEL.hidden, options.hidden, (hidden) => {
      this.#values.hidden = hidden.value;
      this.classList.toggle("hidden", hidden.value);
      this.#layout();
    });
    this.set_input(PANEL.sizeable, options.sizeable, (sizeable) => {
      this.#sizeable = sizeable.ok && sizeable.value;
      this.#layout();
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
    this.set_input(PANEL.titlebar, options.titlebar, (titlebar) => {
      this.classList.toggle("no-titlebar", !(titlebar.ok && titlebar.value));
      this.#layout();
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

  /**Closes the panel and its content*/
  close(): void {
    this.ownerDocument.removeEventListener("pointerdown", this.#outside, {
      capture: true,
    });
    this.#host?.[HOST_REMOVE](this);
    this.#host = undefined;
    this.remove();
    this.#content[CONTENT_CLOSED]();
    for (const resolve of this.#on_close.splice(0)) resolve();
  }

  /**Called by the container that shows the panel, once, after creating it*/
  [PANEL_ADDED](host: PanelHost): void {
    this.#host = host;
    host[HOST_LAYER](this, this.#layer);
    host[HOST_RAISE](this);
    this.ownerDocument.addEventListener("pointerdown", this.#outside, {
      capture: true,
      passive: true,
    });
    this.#layout();
  }

  /**Called by the container when its size changes*/
  [PANEL_LAYOUT](): void {
    this.#layout();
  }

  protected on_resize(): void {
    this.#layout();
  }

  //       _____ _    _          _   _  _____ ______
  //      / ____| |  | |   /\   | \ | |/ ____|  ____|
  //     | |    | |__| |  /  \  |  \| | |  __| |__
  //     | |    |  __  | / /\ \ | . ` | | |_ |  __|
  //     | |____| |  | |/ ____ \| |\  | |__| | |____
  //      \_____|_|  |_/_/    \_\_| \_|\_____|______|
  /**Whether the user can change the input, when the panel owns it or it is a writable state*/
  #can_change(name: Changeable): boolean {
    return !this.#given.has(name) || this.#state_of(name) !== undefined;
  }

  /**The writable state the input has, undefined for a fixed value or one never given*/
  #state_of(name: Changeable) {
    return this.input_state<StateOrValROSW<number | boolean>>(PANEL[name]);
  }

  /**Writes a change by the user, to the state of the input, or to the panel when it owns the input*/
  #change<N extends Changeable>(
    name: N,
    value: NonNullable<ChangeableValues[N]>,
  ): void {
    const state = this.#state_of(name);
    if (state) void state.write(value);
    else if (!this.#given.has(name)) {
      this.#values[name] = value;
      if (name === "hidden") this.classList.toggle("hidden", value === true);
      this.#layout();
    }
  }

  #outside = (e: Event) => {
    if (this.#values.hidden) return;
    if (this.contains(e.target as Node) && e.target !== this) return;
    if (this.#auto_close) this.close();
    else if (this.#auto_hide) this.#change("hidden", true);
  };

  //      _           __     ______  _    _ _______
  //     | |        /\\ \   / / __ \| |  | |__   __|
  //     | |       /  \\ \_/ / |  | | |  | |  | |
  //     | |      / /\ \\   /| |  | | |  | |  | |
  //     | |____ / ____ \| | | |__| | |__| |  | |
  //     |______/_/    \_\_|  \____/ \____/   |_|
  /**Left edge shown for the given one, keeping part of the panel inside the container*/
  #clamp_left(left: number, width: number): number {
    const keep = width * KEEP_SIDE;
    return clamp(left, -keep, this.#host!.width - keep);
  }
  /**Top edge shown for the given one, keeping the title bar inside the container*/
  #clamp_top(top: number): number {
    return clamp(top, 0, Math.max(0, this.#host!.height - KEEP_TOP));
  }

  /**Applies size and position, the position is only clamped for showing, the inputs keep their values*/
  #layout(): void {
    if (!this.#host || !this.isConnected) return;
    const { width, height } = this.#values;
    this.style.width = width === undefined ? "" : width + "rem";
    this.style.height = height === undefined ? "" : height + "rem";
    this.style.minWidth = Math.max(MIN_SIZE, this.#min_width) + "rem";
    this.style.minHeight = `calc(${Math.max(MIN_SIZE, this.#min_height)}rem + var(--titlebar-height))`;
    this.#sizer.classList.toggle(
      "x",
      this.#sizeable && this.#can_change("width"),
    );
    this.#sizer.classList.toggle(
      "y",
      this.#sizeable && this.#can_change("height"),
    );
    this.classList.toggle("size-x", this.#sizer.classList.contains("x"));
    this.classList.toggle("size-y", this.#sizer.classList.contains("y"));
    if (this.#values.hidden) return;

    const rect = this.getBoundingClientRect();
    const w = px_to_rem(rect.width);
    const h = px_to_rem(rect.height);
    const [ax, ay] = anchor_fraction(this.#anchor);
    const { x, y } = this.#values;
    this.#left = this.#clamp_left(
      x === undefined ? (this.#host.width - w) / 2 : x - w * ax,
      w,
    );
    this.#top = this.#clamp_top(
      y === undefined ? (this.#host.height - h) / 2 : y - h * ay,
    );
    this.style.left = this.#left + "rem";
    this.style.top = this.#top + "rem";
  }

  //      __  __  ______      _______ _   _  _____
  //     |  \/  |/ __ \ \    / /_   _| \ | |/ ____|
  //     | \  / | |  | \ \  / /  | | |  \| | |  __
  //     | |\/| | |  | |\ \/ /   | | | . ` | | |_ |
  //     | |  | | |__| | \  /   _| |_| |\  | |__| |
  //     |_|  |_|\____/   \/   |_____|_| \_|\_____|
  /**Moves the panel so its top left corner is at the given position, clamped, on the axes the user can change*/
  #move_to(left: number, top: number): void {
    const rect = this.getBoundingClientRect();
    const w = px_to_rem(rect.width);
    const h = px_to_rem(rect.height);
    const [ax, ay] = anchor_fraction(this.#anchor);
    if (this.#can_change("x"))
      this.#change("x", this.#clamp_left(left, w) + w * ax);
    if (this.#can_change("y")) this.#change("y", this.#clamp_top(top) + h * ay);
  }

  #move_start(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (!this.#can_change("x") && !this.#can_change("y")) return;
    const titlebar = this.#titlebar;
    titlebar.setPointerCapture(e.pointerId);
    titlebar.classList.add("moving");
    this.#moving = true;
    const left = this.#left;
    const top = this.#top;
    titlebar.onpointermove = (ev) =>
      this.#move_to(
        left + px_to_rem(ev.clientX - e.clientX),
        top + px_to_rem(ev.clientY - e.clientY),
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
    this.#move_to(this.#left + dx, this.#top + dy);
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
    const host = this.#host;
    if (!host) return;
    handle.setPointerCapture(e.pointerId);
    const rect = this.getBoundingClientRect();
    const w0 = px_to_rem(rect.width);
    const h0 = px_to_rem(rect.height);
    const left0 = this.#left;
    const top0 = this.#top;
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
            this.close();
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

  #set_modal(modal: boolean): void {
    this.classList.toggle("modal", modal);
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
