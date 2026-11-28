import {
  Base,
  CREATE,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import { ok, type ResultOk } from "@chocbite/ts-lib/result";
import state, {
  type StateArrayRead,
  type StateOrVal,
  type StateOrValROS,
  type StateROS,
} from "@chocbite/ts-lib/state";
import type { ContentBase } from "./content";
import {
  Layout,
  layout_tabs,
  OWNER_CAN_EMPTY,
  OWNER_CAN_POPOUT,
  OWNER_EMPTY,
  OWNER_POPOUT,
  type LayoutNode,
  type LayoutOpenOptions,
  type LayoutOwner,
} from "./layout/index";
import { group_of, popout_group, popout_place } from "./layout/actions";
import { Change, value_or, writable, write_if } from "./layout/common";
import { panel_container, type PanelContainer } from "./container";
import type { Panel } from "./panel";
import "./workspace.scss";

//      _____       _______
//     |  __ \   /\|__   __|/\
//     | |  | | /  \  | |  /  \
//     | |  | |/ /\ \ | | / /\ \
//     | |__| / ____ \| |/ ____ \
//     |_____/_/    \_\_/_/    \_\
/**Where a panel is, in rem, the position of its top left corner in the panel container, which covers the page, and its size*/
export interface WorkspacePlace {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**A panel of a workspace, a layout floating above the layout of a window, the workspace writes its states when the user changes it*/
export interface WorkspacePanel {
  /**The top node of the layout in the panel, see layout_tabs and layout_split*/
  readonly root: StateROS<LayoutNode>;
  /**Position of the top left corner in rem, in the panel container of its window*/
  readonly x: StateROS<number>;
  readonly y: StateROS<number>;
  /**Size in rem*/
  readonly width: StateROS<number>;
  readonly height: StateROS<number>;
}

/**A window of a workspace, the page or a browser window, a layout with panels floating above it, the workspace writes its states
 * when the user changes it*/
export interface WorkspaceWindow {
  /**The top node of the layout filling the window, see layout_tabs and layout_split*/
  readonly root: StateROS<LayoutNode>;
  /**Panels floating above the layout, see workspace_panel, written when tabs are popped out into them and they are emptied*/
  readonly panels: StateROS<WorkspacePanel[]>;
  /**Place of a browser window, as a panel of the page, it opens from there and goes back there when it closes, see workspace_panel,
   * not used for the page*/
  readonly x?: StateROS<number>;
  readonly y?: StateROS<number>;
  readonly width?: StateROS<number>;
  readonly height?: StateROS<number>;
}

/**A workspace panel with writable states, showing the node*/
export function workspace_panel(
  root: LayoutNode,
  place: WorkspacePlace,
): WorkspacePanel {
  return {
    root: state.ok_w(root),
    x: state.ok_w(place.x),
    y: state.ok_w(place.y),
    width: state.ok_w(place.width),
    height: state.ok_w(place.height),
  };
}

/**A workspace window with writable states, showing the node with the panels above it, a browser window gets a place*/
export function workspace_window(
  root: LayoutNode,
  panels: WorkspacePanel[] = [],
  place?: WorkspacePlace,
): WorkspaceWindow {
  return {
    root: state.ok_w(root),
    panels: state.ok_w(panels),
    ...(place && {
      x: state.ok_w(place.x),
      y: state.ok_w(place.y),
      width: state.ok_w(place.width),
      height: state.ok_w(place.height),
    }),
  };
}

/**Opens content in a workspace, internal to this module*/
export const WORKSPACE_OPEN = Symbol("workspace_open");

/**Place of a browser window as a panel when it was given none*/
const WINDOW_PLACE: WorkspacePlace = { x: 4, y: 4, width: 40, height: 25 };

//     __          ______  _____  _  __ _____ _____        _____ ______
//     \ \        / / __ \|  __ \| |/ // ____|  __ \ /\   / ____|  ____|
//      \ \  /\  / / |  | | |__) | ' /| (___ | |__) /  \ | |    | |__
//       \ \/  \/ /| |  | |  _  /|  <  \___ \|  ___/ /\ \| |    |  __|
//        \  /\  / | |__| | | \ \| . \ ____) | |  / ____ \ |____| |____
//         \/  \/   \____/|_|  \_\_|\_\_____/|_| /_/    \_\_____|______|
/**Inputs of the workspace*/
const WORKSPACE = {
  /**The windows, see workspace_window, the first is the page, its layout is the main layout, the others are browser windows
   * Not given the workspace starts with the page with an empty tab group, an initial value is where it starts and the workspace keeps the changes itself,
   * a writable state is written with array instructions when panels are opened in windows and windows close,
   * a read only state keeps the windows, panels can then not be opened in windows*/
  windows: input_key<StateOrValROS<WorkspaceWindow[]>>(),
  /**Layer of the panels in the panel container, see the layer of a panel, 0 by default,
   * so the panels of a workspace can be kept above or below other panels*/
  layer: input_key<StateOrVal<number>>(),
};
export type WorkspaceOptions = BaseOptions & InputOptions<typeof WORKSPACE>;

/**A window of the workspace as it is shown*/
interface Shown {
  readonly data: WorkspaceWindow;
  /**Layout filling the window, the main layout for the page*/
  readonly layout: Layout;
  /**Panel whose content is shown in the browser window, not for the page*/
  readonly panel?: Panel;
  /**Panels of the window, in the order of its panels state*/
  readonly panels: Panel[];
  /**Applies the changes of the panels state*/
  readonly apply: (value: ResultOk<StateArrayRead<WorkspacePanel>>) => void;
  /**Whether the panels state is applied, for a browser window once it is open, its panels are shown in it*/
  attached: boolean;
}

/**Windows each with a layout and panels floating above it, the page is the first, tabs move between all of them
 * Tabs are popped out into panels of their window, a panel is removed when its last tab leaves, panels are opened in browser windows,
 * and come back as panels of the page with the panels of the window when it closes
 * The panels are shown in the panel containers of their windows while the workspace is in the document*/
class Workspace extends Base implements LayoutOwner {
  static element_name() {
    return "workspace";
  }
  static element_name_space() {
    return "composition";
  }

  /**The main layout, private, contents come in through the application that can save them, not by opening them here*/
  readonly #layout: Layout = this.appendChild(Layout.create({}, this));
  /**Windows in the order of the windows state, empty while the workspace is not in the document*/
  #windows: Shown[] = [];
  /**Layer input, passed on to every panel*/
  #layer: StateOrVal<number> = 0;

  [CREATE](options: WorkspaceOptions): void {
    super[CREATE](options);
    if (options.windows === undefined)
      this.set({ windows: [workspace_window(layout_tabs())] });
  }

  set(options: WorkspaceOptions): this {
    super.set(options);
    if (options.layer !== undefined) {
      this.#layer = options.layer;
      for (const shown of this.#windows) {
        shown.panel?.set({ layer: options.layer });
        for (const panel of shown.panels) panel.set({ layer: options.layer });
      }
    }
    //An initial value is kept in a state of the workspace, so it changes with array instructions like a given state.
    //The state gives all windows again when the workspace comes back into the document
    const windows = options.windows;
    const given =
      windows === undefined || state.is.state(windows)
        ? windows
        : state.ok_w(windows);
    this.set_input(WORKSPACE.windows, given, (value) => {
      if (value.ok) this.#apply_windows(value.value);
    });
    //The main layout shows the page also while the workspace is not in the document, so content can be opened in it before
    const page = given?.ok()[0];
    if (page) this.#layout.set({ root: page.root });
    return this;
  }

  /**The panels and windows leave with the workspace*/
  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#remove_windows(0, this.#windows.length);
  }

  /**The panel container of the page*/
  #container(): PanelContainer {
    return panel_container(this);
  }

  /**The windows state*/
  #windows_state(): StateROS<WorkspaceWindow[]> | undefined {
    return this.input_state(WORKSPACE.windows);
  }

  /**Shows the content where it is, in the layout or a panel of a window, or opens it in the main layout, gives whether it is shown*/
  [WORKSPACE_OPEN](content: ContentBase, options?: LayoutOpenOptions): boolean {
    for (const window of this.#windows_state()?.ok() ?? []) {
      const roots = [window.root, ...window.panels.ok().map((p) => p.root)];
      for (const root of roots) {
        const node = value_or(root.get(), undefined);
        const group = node && group_of(node, content);
        if (group) {
          write_if(group.active_state(), content);
          return true;
        }
      }
    }
    return this.#layout.open(content, options);
  }

  //     __          _______ _   _ _____   ______          _______
  //     \ \        / /_   _| \ | |  __ \ / __ \ \        / / ____|
  //      \ \  /\  / /  | | |  \| | |  | | |  | \ \  /\  / / (___
  //       \ \/  \/ /   | | | . ` | |  | | |  | |\ \/  \/ / \___ \
  //        \  /\  /   _| |_| |\  | |__| | |__| | \  /\  /  ____) |
  //         \/  \/   |_____|_| \_|_____/ \____/   \/  \/  |_____/
  /**Applies only the changes the array write carries, a change of the first window, the page, shows all windows again*/
  #apply_windows(windows: StateArrayRead<WorkspaceWindow>): void {
    for (const change of state.a.read(windows)) {
      const page =
        change.type === "fresh" ||
        (change.type === "moved"
          ? change.from_index === 0 || change.to_index === 0
          : change.index === 0);
      if (page) {
        this.#remove_windows(0, this.#windows.length);
        this.#insert_windows(0, windows);
        return;
      }
      switch (change.type) {
        case "added":
          this.#insert_windows(change.index, change.items);
          break;
        case "removed":
          this.#remove_windows(change.index, change.items.length);
          break;
        case "changed":
          this.#remove_windows(change.index, change.items.length);
          this.#insert_windows(change.index, change.items);
          break;
        case "moved": {
          //The order of the browser windows is not shown
          const moved = this.#windows.splice(
            change.from_index,
            change.items.length,
          );
          this.#windows.splice(change.to_index, 0, ...moved);
        }
      }
    }
  }

  #insert_windows(index: number, windows: readonly WorkspaceWindow[]): void {
    const made = windows.map((data, i) => {
      const page = index + i === 0;
      let layout = this.#layout;
      let panel: Panel | undefined;
      if (page) this.#layout.set({ root: data.root });
      else {
        layout = Layout.create({ root: data.root }, this);
        //Opened in its browser window when added to the container
        panel = this.#container().panel(layout, {
          x: data.x ?? WINDOW_PLACE.x,
          y: data.y ?? WINDOW_PLACE.y,
          width: data.width ?? WINDOW_PLACE.width,
          height: data.height ?? WINDOW_PLACE.height,
          layer: this.#layer,
          window: this.#window_state(data),
        });
      }
      const shown: Shown = {
        data,
        layout,
        panel,
        panels: [],
        apply: (value) => this.#apply_panels(shown, value.value),
        attached: false,
      };
      return shown;
    });
    this.#windows.splice(index, 0, ...made);
    for (const shown of made) {
      const attach = () => {
        if (!this.#windows.includes(shown)) return;
        shown.attached = true;
        this.attach_state(shown.data.panels, shown.apply);
      };
      //A window waiting for a click of the user is not open yet, its layout is still in the panel
      if (!shown.panel || shown.layout.ownerDocument !== this.ownerDocument)
        attach();
      else
        shown.panel.addEventListener("window_opened", attach, { once: true });
    }
  }

  /**The panel of a browser window closes its window, the panels in the window go to the page, then the panels close*/
  #remove_windows(index: number, count: number): void {
    for (const shown of this.#windows.splice(index, count)) {
      if (shown.attached) this.detach_state(shown.apply);
      shown.panel?.close();
      for (const panel of shown.panels.splice(0)) panel.close();
    }
  }

  /**The window input of the panel showing a browser window, written false when the window closes, the window then goes back
   * to the page as a panel, with its panels, a read only true when the windows can not be written*/
  #window_state(data: WorkspaceWindow): StateROS<boolean> {
    if (!writable(this.#windows_state())) return state.ok(true);
    return state.rosws(ok(true), (value) => {
      //After the panel is done with the window
      if (!value) queueMicrotask(() => this.#to_page(data));
      return ok(undefined);
    });
  }

  /**The window input of a panel, written true by the user opening it in a window, the panel then becomes a browser window,
   * a read only false when the windows can not be written*/
  #panel_window(
    from: WorkspaceWindow,
    data: WorkspacePanel,
  ): StateROS<boolean> {
    if (!writable(this.#windows_state()) || !writable(from.panels))
      return state.ok(false);
    return state.rosws(ok(false), (value) => {
      if (value) queueMicrotask(() => this.#to_window(from, data));
      return ok(undefined);
    });
  }

  /**Moves the panel out of its window into a browser window of its own*/
  #to_window(from: WorkspaceWindow, data: WorkspacePanel): void {
    const index = from.panels.ok().indexOf(data);
    if (index === -1) return;
    const change = new Change();
    change.write(from.panels, state.a.write.splice(index, 1));
    change.write(
      this.#windows_state(),
      state.a.write.push({
        root: data.root,
        panels: state.ok_w<WorkspacePanel[]>([]),
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
      }),
    );
  }

  /**Moves the browser window back to the page as a panel, followed by the panels of the window, which the panel of the window
   * already moved to where they were over its content*/
  #to_page(data: WorkspaceWindow): void {
    const windows = this.#windows_state();
    const list = windows?.ok() ?? [];
    const index = list.indexOf(data);
    if (index < 1) return;
    const panel: WorkspacePanel = {
      root: data.root,
      x: data.x ?? state.ok_w(WINDOW_PLACE.x),
      y: data.y ?? state.ok_w(WINDOW_PLACE.y),
      width: data.width ?? state.ok_w(WINDOW_PLACE.width),
      height: data.height ?? state.ok_w(WINDOW_PLACE.height),
    };
    const change = new Change();
    change.write(windows, state.a.write.splice(index, 1));
    change.write(
      list[0].panels,
      state.a.write.push(panel, ...data.panels.ok()),
    );
  }

  /**Drops the browser window whose layout was emptied, its panels go to the page, moved there by the panel of the window as it closes*/
  #drop_window(data: WorkspaceWindow): void {
    const windows = this.#windows_state();
    const list = windows?.ok() ?? [];
    const index = list.indexOf(data);
    if (index < 1) return;
    const panels = data.panels.ok();
    const change = new Change();
    change.write(windows, state.a.write.splice(index, 1));
    if (panels.length)
      change.write(list[0].panels, state.a.write.push(...panels));
  }

  //      _____        _   _ ______ _       _____
  //     |  __ \ /\   | \ | |  ____| |     / ____|
  //     | |__) /  \  |  \| | |__  | |    | (___
  //     |  ___/ /\ \ | . ` |  __| |     \___ \
  //     | |  / ____ \| |\  | |____| |____ ____) |
  //     |_| /_/    \_\_| \_|______|______|_____/
  /**Applies only the changes the array write carries, the panels are shown in the panel container of the window*/
  #apply_panels(shown: Shown, panels: StateArrayRead<WorkspacePanel>): void {
    for (const change of state.a.read(panels)) {
      switch (change.type) {
        case "fresh":
          this.#remove_panels(shown, 0, shown.panels.length);
          this.#insert_panels(shown, 0, change.items);
          break;
        case "added":
          this.#insert_panels(shown, change.index, change.items);
          break;
        case "removed":
          this.#remove_panels(shown, change.index, change.items.length);
          break;
        case "changed":
          this.#remove_panels(shown, change.index, change.items.length);
          this.#insert_panels(shown, change.index, change.items);
          break;
        case "moved": {
          //The order of the panels is not shown, the one worked in last is on top
          const moved = shown.panels.splice(
            change.from_index,
            change.items.length,
          );
          shown.panels.splice(change.to_index, 0, ...moved);
        }
      }
    }
  }

  #insert_panels(
    shown: Shown,
    index: number,
    panels: readonly WorkspacePanel[],
  ): void {
    const container = panel_container(shown.layout);
    const made = panels.map((data) =>
      container.panel(Layout.create({ root: data.root }, this), {
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        layer: this.#layer,
        window: this.#panel_window(shown.data, data),
      }),
    );
    shown.panels.splice(index, 0, ...made);
  }

  #remove_panels(shown: Shown, index: number, count: number): void {
    for (const panel of shown.panels.splice(index, count)) panel.close();
  }

  /**The window and panel of the layout, nothing for the main layout and the layout of a browser window*/
  #find(layout: Layout): { shown: Shown; index?: number } | undefined {
    for (const shown of this.#windows) {
      if (shown.layout === layout) return { shown };
      const index = shown.panels.findIndex((p) => p.content === layout);
      if (index !== -1) return { shown, index };
    }
    return undefined;
  }

  //      ____  __          ___   _ ______ _____
  //     / __ \ \ \        / / \ | |  ____|  __ \
  //    | |  | | \ \  /\  / /|  \| | |__  | |__) |
  //    | |  | |  \ \/  \/ / | . ` |  __| |  _  /
  //    | |__| |   \  /\  /  | |\  | |____| | \ \
  //     \____/     \/  \/   |_| \_|______|_|  \_\
  /**Tabs are popped out into panels of the window of the layout*/
  [OWNER_CAN_POPOUT](layout: Layout): boolean {
    return writable(this.#find(layout)?.shown.data.panels);
  }

  /**The new panel is in the window of the layout, near where the group was, its tabs at the bottom, its title bar is at the top*/
  [OWNER_POPOUT](layout: Layout, content: ContentBase, rect: DOMRect): void {
    const found = this.#find(layout);
    if (!found) return;
    const place = popout_place(panel_container(layout), rect);
    write_if(
      found.shown.data.panels,
      state.a.write.push(workspace_panel(popout_group(content), place)),
    );
  }

  /**The main layout can be left empty, a panel when it can be removed, the layout of a browser window when the window can be,
   * with its panels going to the page*/
  [OWNER_CAN_EMPTY](layout: Layout): boolean {
    if (layout === this.#layout) return true;
    const found = this.#find(layout);
    if (!found) return false;
    if (found.index !== undefined) return writable(found.shown.data.panels);
    const page = this.#windows[0]?.data.panels;
    return (
      writable(this.#windows_state()) &&
      (found.shown.data.panels.ok().length === 0 || writable(page))
    );
  }

  [OWNER_EMPTY](layout: Layout): void {
    const found = this.#find(layout);
    if (!found || layout === this.#layout) return;
    if (found.index === undefined) return this.#drop_window(found.shown.data);
    write_if(found.shown.data.panels, state.a.write.splice(found.index, 1));
  }
}
define_element(Workspace);

export type { Workspace };

/**Creates a workspace, windows with a layout and panels floating above it, the first is the page, tabs are popped out into panels
 * and move between the layouts and the panels by dragging, the empty space of a tab bar in a panel moves the panel,
 * panels are opened in browser windows from the menu of their title bar*/
export function workspace(options: WorkspaceOptions = {}): Workspace {
  return Workspace.create(options);
}
