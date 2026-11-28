import { none, type Option, some } from "@chocbite/ts-lib/result";
import state, {
  type StateOrVal,
  type StateROS,
  type StateROSWS,
} from "@chocbite/ts-lib/state";
import type { SettingsGroup, SettingsJson } from "#settings";
import { CONTENT_ID, type ContentBase } from "./content";
import {
  layout_split,
  layout_tabs,
  type LayoutDirection,
  type LayoutNode,
  type LayoutOpenOptions,
  type LayoutTabsSide,
} from "./layout/index";
import {
  workspace,
  WORKSPACE_OPEN,
  workspace_panel,
  workspace_window,
  type Workspace,
  type WorkspacePlace,
  type WorkspaceWindow,
} from "./workspace";
import { WINDOW_REOPEN, WindowReopen } from "./settings";

/**Key of the main content of an application*/
const MAIN = "main";

/**Called on an application by its manager, internal to this module*/
const APP_CONTENT = Symbol("app_content");
const APP_CLOSED = Symbol("app_closed");

//                _____  _____  _      _____ _____       _______ _____ ____  _   _
//          /\   |  __ \|  __ \| |    |_   _/ ____|   /\|__   __|_   _/ __ \| \ | |
//         /  \  | |__) | |__) | |      | || |       /  \  | |    | || |  | |  \| |
//        / /\ \ |  ___/|  ___/| |      | || |      / /\ \ | |    | || |  | | . ` |
//       / ____ \| |    | |    | |____ _| || |____ / ____ \| |   _| || |__| | |\  |
//      /_/    \_\_|    |_|    |______|_____\_____/_/    \_\_|  |_____\____/|_| \_|
/**The props of an application class*/
export type ApplicationProps<A> = A extends Application<infer P> ? P : never;

/**A class of applications, registered with the manager, see Application*/
export interface ApplicationClass<
  A extends Application<any> = Application<any>,
> {
  new (manager: AppManager, key: string, props: ApplicationProps<A>): A;
  /**Type of the application, saved with it, unique among the applications of a manager*/
  readonly type: string;
  /**Tells open applications of the type apart, opening one with the key of an open one shows that one instead.
   * Not given every application of the type has the same key, so one is open at a time*/
  key?(props: ApplicationProps<A>): string;
}

/**An application, a part of an app with contents of its own, opened by the application manager with props.
 * Library users extend it, things shared by its contents live in it. It is open while its main content is,
 * and the manager saves it with its props and opens it again after a refresh, with its contents where they were.
 * @example
 * class Editor extends Application<{ file: string }> {
 *   static readonly type = "editor";
 *   static key(props: { file: string }) { return props.file; }
 *   protected main() { return editor_view(this); }
 *   protected restore(key: string) { return key === "outline" ? outline(this) : undefined; }
 *   show_outline() { this.open_content("outline", () => outline(this), { side: LayoutSide.RIGHT }); }
 * }*/
export abstract class Application<P extends SettingsJson = SettingsJson> {
  readonly manager: AppManager;
  /**Tells the application apart from the others of its type, see ApplicationClass.key*/
  readonly key: string;
  /**Props it was opened with, saved, write it to change what it opens with after a refresh*/
  readonly props: StateROSWS<P>;
  /**Open contents by their key*/
  readonly #contents = new Map<string, ContentBase>();

  /**Made by the manager, see AppManager.open*/
  constructor(manager: AppManager, key: string, props: P) {
    this.manager = manager;
    this.key = key;
    this.props = state.ok_w(props);
  }

  /**Type of the application, see ApplicationClass.type*/
  get type(): string {
    return (this.constructor as ApplicationClass).type;
  }

  /**Makes the main content, called once when the application opens, the application is open while the main content is,
   * closing it closes the other contents*/
  protected abstract main(): ContentBase;

  /**Makes a content again after a refresh, from the key it was opened with, undefined leaves it out*/
  protected restore(_key: string): ContentBase | undefined {
    return undefined;
  }

  /**Called once the application is closed*/
  protected closed(): void {}

  /**Opens a content of the application, the content open with the key is shown instead, make is not called then.
   * The key is saved with the content, so restore can make it again after a refresh, "main" is the main content*/
  open_content(
    key: string,
    make: () => ContentBase,
    options?: LayoutOpenOptions,
  ): ContentBase {
    //make always gives a content
    const content = this[APP_CONTENT](key, make)!;
    this.manager.workspace[WORKSPACE_OPEN](content, options);
    return content;
  }

  /**The open content with the key, "main" for the main content*/
  content(key: string): ContentBase | undefined {
    return this.#contents.get(key);
  }

  /**Shows the main content*/
  show(): void {
    const main = this.#contents.get(MAIN);
    if (main) this.manager.workspace[WORKSPACE_OPEN](main);
  }

  /**Closes the application, asks every content, the main content last, gives whether it closed.
   * A content that refuses keeps the application open*/
  async close(): Promise<boolean> {
    for (const [key, content] of [...this.#contents])
      if (key !== MAIN && !(await content.content_close())) return false;
    const main = this.#contents.get(MAIN);
    return main ? main.content_close() : true;
  }

  /**Saved as its type, key and props, see to_json and the viewer of the state module*/
  [state.v.OVERRIDE_KEY]() {
    return { type: this.type, key: this.key, props: this.props };
  }

  /**The content with the key, made by make, by main for the main content, or by restore, undefined when none is made*/
  [APP_CONTENT](
    key: string,
    make: () => ContentBase | undefined = () =>
      key === MAIN ? this.main() : this.restore(key),
  ): ContentBase | undefined {
    const open = this.#contents.get(key);
    if (open) return open;
    const content = make();
    if (!content) return undefined;
    this.#contents.set(key, content);
    content[CONTENT_ID] = [this.type, this.key, key];
    void content.content_on_close().then(() => {
      if (this.#contents.get(key) !== content) return;
      this.#contents.delete(key);
      content[CONTENT_ID] = undefined;
      if (key === MAIN) this.manager[MANAGER_CLOSED](this);
    });
    return content;
  }

  /**The main content closed, the other contents are closed, they are asked and are no longer saved*/
  [APP_CLOSED](): void {
    for (const content of this.#contents.values()) {
      content[CONTENT_ID] = undefined;
      void content.content_close();
    }
    this.#contents.clear();
    this.closed();
  }
}

//      __  __          _   _          _____ ______ _____
//     |  \/  |   /\   | \ | |   /\   / ____|  ____|  __ \
//     | \  / |  /  \  |  \| |  /  \ | |  __| |__  | |__) |
//     | |\/| | / /\ \ | . ` | / /\ \| | |_ |  __| |  _  /
//     | |  | |/ ____ \| |\  |/ ____ \ |__| | |____| | \ \
//     |_|  |_/_/    \_\_| \_/_/    \_\_____|______|_|  \_\
/**Called on the manager by an application, internal to this module*/
const MANAGER_CLOSED = Symbol("manager_closed");

/**A content as saved, the type and key of its application and its own key*/
type SavedContent = [type: string, app_key: string, key: string];
interface SavedTabs {
  content: (SavedContent | null)[];
  active?: SavedContent | null;
  size: number;
  side?: LayoutTabsSide;
  compact?: boolean;
}
interface SavedSplit {
  direction: LayoutDirection;
  size: number;
  children: SavedNode[];
}
type SavedNode = SavedTabs | SavedSplit;
type SavedPanel = { root: SavedNode } & WorkspacePlace;
/**A window as saved, the first is the page, the others are browser windows with a place*/
type SavedWindow = {
  root: SavedNode;
  panels: SavedPanel[];
} & Partial<WorkspacePlace>;
/**What the manager saves, the open applications and the windows of the workspace, see to_json*/
export interface AppManagerSaved {
  apps: { type: string; key: string; props: SettingsJson }[];
  windows: SavedWindow[];
}

export interface AppManagerOptions {
  /**Applications that can be opened, never changes, an application is opened again after a refresh only when its class is here*/
  apps: ApplicationClass[];
  /**Settings group the applications and where they are shown are saved in, and opened from when the manager is made,
   * see the settings module. Not given nothing is saved*/
  settings?: SettingsGroup;
  /**Id of the setting in the group, workspace when not given*/
  id?: string;
  /**Saved value to open instead of the one in the settings, like one from to_json*/
  restore?: unknown;
  /**Layer of the panels of the workspace, see workspace*/
  layer?: StateOrVal<number>;
}

/**Owns a workspace and the applications open in it, saves them and opens them again after a refresh*/
class AppManager {
  /**The workspace the applications are shown in, put it in the page*/
  readonly workspace: Workspace;
  readonly #classes = new Map<string, ApplicationClass>();
  readonly #apps: StateROSWS<Application[]>;
  readonly #windows: StateROSWS<WorkspaceWindow[]>;
  /**The applications and the trees of the workspace, saved as JSON, see to_json*/
  readonly #saved: StateROS<unknown>;

  constructor(options: AppManagerOptions) {
    for (const app of options.apps) this.#classes.set(app.type, app);
    const id = options.id ?? "workspace";
    const saved =
      options.restore !== undefined
        ? parse_saved(options.restore)
        : (options.settings?.get(id, none(), (v) => some(parse_saved(v)))
            .value ?? none());
    const restored = saved.some ? this.#restore(saved.value) : undefined;
    this.#apps = state.ok_w(restored?.apps ?? []);
    this.#windows = state.ok_w<WorkspaceWindow[]>([
      workspace_window(restored?.main ?? layout_tabs(), restored?.panels),
      ...(restored?.windows ?? []),
    ]);
    this.#saved = state.ok({ apps: this.#apps, windows: this.#windows });
    this.workspace = workspace({
      windows: this.#windows,
      layer: options.layer,
    });
    //The value holds the states and elements of the workspace, what is stored is the JSON of AppManagerSaved
    if (options.settings)
      options.settings.register_debounced(
        id,
        "Workspace",
        "Open applications and where they are shown",
        this.#saved as unknown as StateROS<AppManagerSaved> as never,
      );
  }

  /**Opens an application with the props, an open one with the same key is shown instead, gives the application*/
  open<A extends Application<any>>(
    app: ApplicationClass<A>,
    props: ApplicationProps<A>,
  ): A {
    if (this.#classes.get(app.type) !== app)
      throw new Error(
        `Application ${app.type} is not in the apps of the manager`,
      );
    const key = app.key?.(props) ?? "";
    const open = this.find(app, key);
    if (open) {
      open.show();
      return open;
    }
    const made = new app(this, key, props);
    const main = made[APP_CONTENT](MAIN);
    if (!main) throw new Error(`Application ${app.type} made no main content`);
    this.#apps.write_sync(state.a.write.push(made));
    this.workspace[WORKSPACE_OPEN](main);
    return made;
  }

  /**The open application of the class with the key*/
  find<A extends Application<any>>(
    app: ApplicationClass<A>,
    key: string,
  ): A | undefined {
    return this.#apps
      .ok()
      .find((a): a is A => a instanceof app && a.key === key);
  }

  /**The open applications, in the order they were opened*/
  apps(): readonly Application[] {
    return this.#apps.ok();
  }

  /**What the manager saves, as JSON, see AppManagerSaved, give it as restore to open it again*/
  to_json(): PromiseLike<string> {
    return this.#saved.to_json();
  }

  [MANAGER_CLOSED](app: Application): void {
    const index = this.#apps.ok().indexOf(app);
    if (index !== -1) this.#apps.write_sync(state.a.write.splice(index, 1));
    app[APP_CLOSED]();
  }

  /**Makes the applications and the trees again, contents an application does not make again are left out,
   * and so are applications whose main content is not shown, groups and splits left empty go,
   * browser windows are made as windows again, or as panels of the page followed by their panels, moved to where they were
   * over its content, as the user set WINDOW_REOPEN*/
  #restore(saved: AppManagerSaved) {
    const shown = new Set<string>();
    const walk = (node: SavedNode) => {
      if ("children" in node) node.children.forEach(walk);
      else
        for (const id of node.content)
          if (is_id(id) && id[2] === MAIN) shown.add(app_id(id[0], id[1]));
    };
    for (const window of saved.windows) {
      walk(window.root);
      window.panels.forEach((p) => walk(p.root));
    }
    const apps = new Map<string, Application>();
    for (const record of saved.apps) {
      const app = this.#classes.get(record.type);
      const id = app_id(record.type, record.key);
      if (app && shown.has(id) && !apps.has(id))
        apps.set(id, new app(this, record.key, record.props) as Application);
    }
    const content_of = (id: unknown) =>
      is_id(id)
        ? apps.get(app_id(id[0], id[1]))?.[APP_CONTENT](id[2])
        : undefined;
    const build = (node: SavedNode): LayoutNode | undefined => {
      if ("children" in node) {
        const children = node.children.flatMap((c) => build(c) ?? []);
        if (children.length === 0) return undefined;
        if (children.length === 1) {
          children[0].set({ size: node.size });
          return children[0];
        }
        return layout_split({
          direction: node.direction,
          children,
          size: node.size,
        });
      }
      const content = node.content.flatMap((id) => content_of(id) ?? []);
      if (content.length === 0) return undefined;
      const active = content_of(node.active);
      return layout_tabs({
        content,
        active: active && content.includes(active) ? active : content[0],
        size: node.size,
        side: node.side,
        compact: node.compact,
      });
    };
    const panels_of = (saved: SavedPanel[], dx = 0, dy = 0) =>
      saved.flatMap((p) => {
        const root = build(p.root);
        return root
          ? [workspace_panel(root, { ...p, x: p.x + dx, y: p.y + dy })]
          : [];
      });
    const [page, ...windows] = saved.windows;
    const main = build(page.root);
    const panels = panels_of(page.panels);
    const as_windows = WINDOW_REOPEN.ok() === WindowReopen.Windows;
    const made: WorkspaceWindow[] = [];
    for (const window of windows) {
      const place: WorkspacePlace = {
        x: window.x ?? 0,
        y: window.y ?? 0,
        width: window.width ?? 40,
        height: window.height ?? 25,
      };
      const root = build(window.root);
      if (root && as_windows) {
        made.push(workspace_window(root, panels_of(window.panels), place));
        continue;
      }
      if (root) panels.push(workspace_panel(root, place));
      panels.push(...panels_of(window.panels, place.x, place.y));
    }
    //Every made application has its main content, contents it made are in the trees
    return { apps: [...apps.values()], main, panels, windows: made };
  }
}

export type { AppManager };

/**Creates an application manager, it owns a workspace, see AppManager.workspace, and the applications open in it.
 * The applications and where their contents are shown are saved in the settings group, and opened again when it is made*/
export function app_manager(options: AppManagerOptions): AppManager {
  return new AppManager(options);
}

//       _____         __      ________ _____
//      / ____|  /\    \ \    / /  ____|  __ \
//     | (___   /  \    \ \  / /| |__  | |  | |
//      \___ \ / /\ \    \ \/ / |  __| | |  | |
//      ____) / ____ \    \  /  | |____| |__| |
//     |_____/_/    \_\    \/   |______|_____/
const app_id = (type: string, key: string) => JSON.stringify([type, key]);

const is_object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const is_number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const is_id = (value: unknown): value is SavedContent =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((v) => typeof v === "string");
const SIDES: unknown[] = ["top", "bottom", "left", "right"];

function is_node(value: unknown): value is SavedNode {
  if (!is_object(value) || !is_number(value.size)) return false;
  if ("children" in value)
    return (
      (value.direction === "row" || value.direction === "column") &&
      Array.isArray(value.children) &&
      value.children.every(is_node)
    );
  return (
    Array.isArray(value.content) &&
    (value.side === undefined || SIDES.includes(value.side)) &&
    (value.compact === undefined || typeof value.compact === "boolean")
  );
}

/**The saved value when it has the form of AppManagerSaved, a stored value can come from an older version or the user*/
function parse_saved(value: unknown): Option<AppManagerSaved> {
  if (
    !is_object(value) ||
    !Array.isArray(value.apps) ||
    !Array.isArray(value.windows) ||
    value.windows.length === 0
  )
    return none();
  const apps = value.apps.every(
    (a) =>
      is_object(a) && typeof a.type === "string" && typeof a.key === "string",
  );
  const is_panel = (p: unknown) =>
    is_object(p) &&
    is_node(p.root) &&
    is_number(p.x) &&
    is_number(p.y) &&
    is_number(p.width) &&
    is_number(p.height);
  const place = (w: Record<string, unknown>, key: string) =>
    w[key] === undefined || is_number(w[key]);
  const windows = value.windows.every(
    (w) =>
      is_object(w) &&
      is_node(w.root) &&
      Array.isArray(w.panels) &&
      w.panels.every(is_panel) &&
      ["x", "y", "width", "height"].every((key) => place(w, key)),
  );
  return apps && windows ? some(value as unknown as AppManagerSaved) : none();
}
