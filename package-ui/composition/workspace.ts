import {
  Base,
  CREATE,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";
import { px_to_rem } from "#theme";
import state, {
  type StateArrayRead,
  type StateOrVal,
  type StateOrValROS,
  type StateROS,
} from "@chocbite/ts-lib/state";
import { ContentBase } from "./content";
import {
  Layout,
  OWNER_CAN_EMPTY,
  OWNER_CAN_POPOUT,
  OWNER_EMPTY,
  OWNER_POPOUT,
  type LayoutNode,
  type LayoutOpenOptions,
  type LayoutOwner,
  type LayoutTabs,
} from "./layout";
import { panel_container, type PanelContainer } from "./container";
import { PANEL_MOVE, type Panel } from "./panel";
import "./workspace.scss";

//      _____       _______
//     |  __ \   /\|__   __|/\
//     | |  | | /  \  | |  /  \
//     | |  | |/ /\ \ | | / /\ \
//     | |__| / ____ \| |/ ____ \
//     |_____/_/    \_\_/_/    \_\
/**A panel of a workspace, a layout floating above the main layout, the workspace writes its states when the user changes it*/
export interface WorkspacePanel {
  /**The top node of the layout in the panel, see layout_tabs and layout_split*/
  readonly root: StateROS<LayoutNode>;
  /**Position of the top left corner in rem, in the panel container, the page for the default container*/
  readonly x: StateROS<number>;
  readonly y: StateROS<number>;
  /**Size in rem*/
  readonly width: StateROS<number>;
  readonly height: StateROS<number>;
}

/**A workspace panel with writable states, showing the node*/
export function workspace_panel(
  root: LayoutNode,
  place: { x: number; y: number; width: number; height: number },
): WorkspacePanel {
  return {
    root: state.ok_w(root),
    x: state.ok_w(place.x),
    y: state.ok_w(place.y),
    width: state.ok_w(place.width),
    height: state.ok_w(place.height),
  };
}

/**Distance in rem a popped out panel is moved from where its group was, so it is seen as new*/
const POPOUT_OFFSET = 1.5;
/**Part of the size of the group a popped out panel gets, so it does not cover where it came from*/
const POPOUT_PART = 0.6;
/**Size in rem a popped out panel gets at most and at least*/
const POPOUT_MAX = { width: 40, height: 28 };
const POPOUT_MIN = { width: 16, height: 10 };

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**Writes the state when it is writable, writes of local states apply at once*/
function write(target: StateROS<unknown>, value: unknown): void {
  if (target.writable)
    void (target as unknown as { write(v: unknown): unknown }).write(value);
}

//      _____        _   _ ______ _
//     |  __ \ /\   | \ | |  ____| |
//     | |__) /  \  |  \| | |__  | |
//     |  ___/ /\ \ | . ` |  __| | |
//     | |  / ____ \| |\  | |____| |____
//     |_| /_/    \_\_| \_|______|______|
/**Content of a panel of a workspace, the layout of the panel, the empty space of its tab bars moves the panel*/
class WorkspacePanelContent extends ContentBase {
  static element_name() {
    return "workspacepanel";
  }
  static element_name_space() {
    return "composition";
  }

  readonly layout: Layout;
  panel?: Panel;

  constructor(layout: Layout) {
    super();
    this.layout = this.appendChild(layout);
    this.addEventListener("pointerdown", (e) => {
      const bar = e.target as HTMLDivElement;
      if (
        this.panel &&
        bar.classList.contains("bar") &&
        bar.parentElement?.tagName === "COMPOSITION-LAYOUTTABS"
      )
        this.panel[PANEL_MOVE](e, bar);
    });
  }
}
define_element(WorkspacePanelContent);

//     __          ______  _____  _  __ _____ _____        _____ ______
//     \ \        / / __ \|  __ \| |/ // ____|  __ \ /\   / ____|  ____|
//      \ \  /\  / / |  | | |__) | ' /| (___ | |__) /  \ | |    | |__
//       \ \/  \/ /| |  | |  _  /|  <  \___ \|  ___/ /\ \| |    |  __|
//        \  /\  / | |__| | | \ \| . \ ____) | |  / ____ \ |____| |____
//         \/  \/   \____/|_|  \_\_|\_\_____/|_| /_/    \_\_____|______|
/**Inputs of the workspace*/
const WORKSPACE = {
  /**The top node of the main layout, works like the root of a layout*/
  root: input_key<StateOrValROS<LayoutNode>>(),
  /**Panels floating above the main layout, see workspace_panel
   * Not given the workspace starts without panels, an initial value is where it starts and the workspace keeps the changes itself,
   * a writable state is written with array instructions when tabs are popped out and panels are emptied,
   * a read only state keeps the panels, tabs can then not be popped out*/
  panels: input_key<StateOrValROS<WorkspacePanel[]>>(),
};
export type WorkspaceOptions = BaseOptions & InputOptions<typeof WORKSPACE>;

/**What a workspace is given at creation, never changed*/
export interface WorkspaceConfig {
  /**Panel container the panels are shown in, the one of the document of the workspace by default*/
  container?: PanelContainer;
  /**Layer of the panels in the container, see the layer of a panel, 0 by default,
   * so workspaces sharing a container can keep their panels above or below each other*/
  layer?: StateOrVal<number>;
}

/**A main layout with panels floating above it, each panel holds a layout, tabs move between all of them
 * Tabs are popped out into panels, a panel is removed when its last tab leaves
 * The panels are shown in a panel container while the workspace is in the document*/
class Workspace extends Base implements LayoutOwner {
  static element_name() {
    return "workspace";
  }
  static element_name_space() {
    return "composition";
  }

  readonly layout: Layout = this.appendChild(Layout.create({}, this));
  readonly #config: WorkspaceConfig;
  /**Panels in the order of the panels state, empty while the workspace is not in the document*/
  #panels: Panel[] = [];

  constructor(config: WorkspaceConfig = {}) {
    super();
    this.#config = config;
  }

  [CREATE](options: WorkspaceOptions): void {
    super[CREATE](options);
    if (options.panels === undefined) this.set({ panels: [] });
  }

  set(options: WorkspaceOptions): this {
    super.set(options);
    if (options.root !== undefined) this.layout.set({ root: options.root });
    //An initial value is kept in a state of the workspace, so it changes with array instructions like a given state.
    //The state gives all panels again when the workspace comes back into the document
    const panels = options.panels;
    this.set_input(
      WORKSPACE.panels,
      panels === undefined || state.is.state(panels)
        ? panels
        : state.ok_w(panels),
      (value) => {
        if (value.ok) this.#apply(value.value);
      },
    );
    return this;
  }

  /**The panels leave the container with the workspace*/
  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#remove(0, this.#panels.length);
  }

  /**The panel container the panels are shown in*/
  get container(): PanelContainer {
    return this.#config.container ?? panel_container(this);
  }

  /**The panels state*/
  #panels_state(): StateROS<WorkspacePanel[]> | undefined {
    return this.input_state(WORKSPACE.panels);
  }

  /**Opens content in the main layout, content already in it is shown*/
  open(content: ContentBase, options?: LayoutOpenOptions): void {
    this.layout.open(content, options);
  }

  //      _____        _   _ ______ _       _____
  //     |  __ \ /\   | \ | |  ____| |     / ____|
  //     | |__) /  \  |  \| | |__  | |    | (___
  //     |  ___/ /\ \ | . ` |  __| | |     \___ \
  //     | |  / ____ \| |\  | |____| |____ ____) |
  //     |_| /_/    \_\_| \_|______|______|_____/
  /**Applies only the changes the array write carries*/
  #apply(panels: StateArrayRead<WorkspacePanel>): void {
    for (const change of state.a.read(panels)) {
      switch (change.type) {
        case "fresh":
          this.#remove(0, this.#panels.length);
          this.#insert(0, change.items);
          break;
        case "added":
          this.#insert(change.index, change.items);
          break;
        case "removed":
          this.#remove(change.index, change.items.length);
          break;
        case "changed":
          this.#remove(change.index, change.items.length);
          this.#insert(change.index, change.items);
          break;
        case "moved": {
          //The order of the panels is not shown, the one worked in last is on top
          const moved = this.#panels.splice(
            change.from_index,
            change.items.length,
          );
          this.#panels.splice(change.to_index, 0, ...moved);
        }
      }
    }
  }

  #insert(index: number, panels: readonly WorkspacePanel[]): void {
    const container = this.container;
    const made = panels.map((data) => {
      const content = WorkspacePanelContent.create(
        {},
        Layout.create({ root: data.root }, this),
      );
      const panel = container.panel(content, {
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        layer: this.#config.layer,
        titlebar: false,
      });
      content.panel = panel;
      return panel;
    });
    this.#panels.splice(index, 0, ...made);
  }

  #remove(index: number, count: number): void {
    for (const panel of this.#panels.splice(index, count)) panel.close();
  }

  //      ____  __          ___   _ ______ _____
  //     / __ \ \ \        / / \ | |  ____|  __ \
  //    | |  | | \ \  /\  / /|  \| | |__  | |__) |
  //    | |  | |  \ \/  \/ / | . ` |  __| |  _  /
  //    | |__| |   \  /\  /  | |\  | |____| | \ \
  //     \____/     \/  \/   |_| \_|______|_|  \_\
  [OWNER_CAN_POPOUT](): boolean {
    return this.#panels_state()?.writable ?? false;
  }

  [OWNER_POPOUT](_layout: Layout, node: LayoutTabs, rect: DOMRect): void {
    const panels = this.#panels_state();
    if (!panels) return;
    const container = this.container;
    const origin = container.getBoundingClientRect();
    const area = container.size();
    const width = clamp(
      px_to_rem(rect.width) * POPOUT_PART,
      POPOUT_MIN.width,
      POPOUT_MAX.width,
    );
    const height = clamp(
      px_to_rem(rect.height) * POPOUT_PART,
      POPOUT_MIN.height,
      POPOUT_MAX.height,
    );
    write(
      panels,
      state.a.write.push(
        workspace_panel(node, {
          x: clamp(
            px_to_rem(rect.left - origin.left) + POPOUT_OFFSET,
            0,
            Math.max(0, area.width - width),
          ),
          y: clamp(
            px_to_rem(rect.top - origin.top) + POPOUT_OFFSET,
            0,
            Math.max(0, area.height - height),
          ),
          width,
          height,
        }),
      ),
    );
  }

  /**The main layout can be left empty, a panel only when it can be removed*/
  [OWNER_CAN_EMPTY](layout: Layout): boolean {
    return layout === this.layout || this[OWNER_CAN_POPOUT]();
  }

  [OWNER_EMPTY](layout: Layout): void {
    const panels = this.#panels_state();
    if (!panels) return;
    const index = this.#panels.findIndex(
      (p) =>
        p.content instanceof WorkspacePanelContent &&
        p.content.layout === layout,
    );
    if (index !== -1) write(panels, state.a.write.splice(index, 1));
  }
}
define_element(Workspace);

export type { Workspace };

/**Creates a workspace, a main layout with panels floating above it, tabs are popped out into panels
 * and move between the main layout and the panels by dragging, the empty space of a tab bar in a panel moves the panel
 * @param config the panel container and layer of the panels, given once*/
export function workspace(
  options: WorkspaceOptions = {},
  config: WorkspaceConfig = {},
): Workspace {
  return Workspace.create(options, config);
}
