import { CREATE, define_element, input_key, type InputOptions } from "#base";
import type { Result } from "@chocbite/ts-lib/result";
import state, {
  type StateArrayRead,
  type StateOrValRES,
  type StateRES,
} from "@chocbite/ts-lib/state";
import { ContentBase } from "../content";
import { TITLEBAR_HEIGHT_TOUCH } from "../panel";
import type { LayoutTabsSide } from "./tree";
import {
  as_any_state,
  collect,
  MIN_HEIGHT,
  MIN_WIDTH,
  own,
  SIDE_BAR_WIDTH,
  value_or,
  writable,
} from "./common";
import { can_leave } from "./actions";
import { type LayoutNodeOptions, NodeElement } from "./node";
import { type LayoutTab, tab_of } from "./tab";
import "./tabs.scss";

//      _______       ____   _____
//     |__   __|/\   |  _ \ / ____|
//        | |  /  \  | |_) | (___
//        | | / /\ \ |  _ < \___ \
//        | |/ ____ \| |_) |____) |
//        |_/_/    \_\____/|_____/
/**Inputs of a tab group, the user changes each of them,
 * a state that does not write synchronously is read only to the layout, the user then can not change it*/
const GROUP = {
  /**Contents shown as tabs, in order, the user moves tabs in and out, a read only state keeps them in the group*/
  content: input_key<StateOrValRES<ContentBase[]>>(),
  /**Content of the shown tab, the first tab is shown when it is not among the tabs*/
  active: input_key<StateOrValRES<ContentBase | undefined>>(),
  /**Side the tabs are on, top when not given, the user changes it from the menu of a tab*/
  side: input_key<StateOrValRES<LayoutTabsSide>>(),
  /**Whether the tabs show only their icon, false when not given, the user changes it from the menu of a tab*/
  compact: input_key<StateOrValRES<boolean>>(),
};
export type LayoutTabsOptions = LayoutNodeOptions & InputOptions<typeof GROUP>;

/**A tab bar and the content of the shown tab, the other contents are not in the document*/
class LayoutTabs extends NodeElement {
  static element_name() {
    return "layouttabs";
  }

  readonly bar = this.appendChild(document.createElement("div"));
  readonly body = this.appendChild(document.createElement("div"));
  /**Tabs in order, a tab moved to another group is no longer a child of the bar*/
  #tabs: LayoutTab[] = [];
  #side: LayoutTabsSide = "top";
  /**Content whose title and icon are shown*/
  #shown?: ContentBase;
  /**The active state as saved, null without an active content, as JSON has no undefined*/
  readonly #active_saved = as_any_state<ContentBase | undefined>(
    undefined,
  ).proxy_map((active) => active ?? null);
  /**Closable when the tabs can be changed and every content can be closed*/
  readonly closable = collect(
    (contents) =>
      writable(this.content_state()) &&
      contents.length > 0 &&
      contents.every((c) => value_or(c, false)),
  );
  /**The biggest content, and the bar beside it at the left or right side, or above or below it*/
  readonly min_width = collect(([side, compact, ...contents]) => {
    const width = biggest(contents, MIN_WIDTH);
    if (!at_side(side)) return width;
    return (
      width +
      (value_or(compact, false) ? TITLEBAR_HEIGHT_TOUCH : SIDE_BAR_WIDTH)
    );
  });
  readonly min_height = collect(([side, ...contents]) => {
    const height = biggest(contents, MIN_HEIGHT);
    return at_side(side) ? height : height + TITLEBAR_HEIGHT_TOUCH;
  });

  constructor() {
    super();
    this.bar.className = "bar";
    this.body.className = "body";
    this.classList.add("side-top");
  }

  [CREATE](options: LayoutTabsOptions): void {
    super[CREATE](options);
    this.set({
      content: options.content === undefined ? [] : undefined,
      //undefined is no input, so the default is a state
      active:
        options.active === undefined
          ? state.ok_w<ContentBase | undefined>(undefined)
          : undefined,
      side: options.side === undefined ? "top" : undefined,
      compact: options.compact === undefined ? false : undefined,
    });
  }

  set(options: LayoutTabsOptions): this {
    super.set(options);
    this.set_input(GROUP.content, own(options.content), (contents) =>
      this.#apply(contents.ok ? contents.value : []),
    );
    this.set_input(GROUP.active, own(options.active), () =>
      this.#show_active(),
    );
    if (options.active !== undefined)
      this.#active_saved.set_state(this.active_state());
    this.set_input(GROUP.side, own(options.side), (side) => {
      this.classList.remove("side-" + this.#side);
      this.#side = value_or(side, "top");
      this.classList.add("side-" + this.#side);
    });
    this.set_input(GROUP.compact, own(options.compact), (compact) => {
      this.classList.toggle("compact", value_or(compact, false));
    });
    if (options.content || options.side || options.compact) this.#collect();
    return this;
  }

  /**The states of the inputs, internal to this module*/
  content_state(): StateRES<ContentBase[]> {
    return this.input_state(GROUP.content)!;
  }
  active_state(): StateRES<ContentBase | undefined> {
    return this.input_state(GROUP.active)!;
  }
  side_state(): StateRES<LayoutTabsSide> {
    return this.input_state(GROUP.side)!;
  }
  compact_state(): StateRES<boolean> {
    return this.input_state(GROUP.compact)!;
  }
  /**The contents as the state gives them, internal to this module*/
  contents(): readonly ContentBase[] {
    return value_or(this.content_state().get(), []);
  }
  /**The content of the shown tab as the state gives it, internal to this module*/
  active(): ContentBase | undefined {
    return value_or(this.active_state().get(), undefined);
  }

  /**Saved as the states of its inputs, see to_json and the viewer of the state module*/
  [state.v.OVERRIDE_KEY]() {
    return {
      content: this.content_state(),
      active: this.#active_saved,
      size: this.size_state(),
      side: this.side_state(),
      compact: this.compact_state(),
    };
  }

  /**Whether the tabs are above each other, at the left or right side*/
  get vertical(): boolean {
    return this.#side === "left" || this.#side === "right";
  }

  /**Applies only the changes the array write carries*/
  #apply(contents: StateArrayRead<ContentBase>): void {
    for (const change of state.a.read(contents)) {
      switch (change.type) {
        case "fresh":
          this.#remove(0, this.#tabs.length);
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
          const moved = this.#tabs.splice(
            change.from_index,
            change.items.length,
          );
          this.#tabs.splice(change.to_index, 0, ...moved);
          const ref = this.#tabs[change.to_index + moved.length] ?? null;
          for (const tab of moved) this.bar.insertBefore(tab, ref);
        }
      }
    }
    this.#show_active();
    this.#collect();
    //Close buttons are hidden when the tabs can not leave, like the last tab of a group in a read only split
    this.show_locked();
  }

  /**Whether its tabs can be closed, they can leave the group, the last tab of a group in a read only split,
   * or of a layout whose owner keeps it, can not*/
  can_close(): boolean {
    const layout = this.layout();
    return layout ? can_leave(layout, this) : writable(this.content_state());
  }

  /**Hides the close buttons when the tabs can not leave*/
  show_locked(): void {
    this.classList.toggle("locked", !this.can_close());
  }

  /**Collects from the contents again*/
  #collect(): void {
    const contents = this.#tabs.map((t) => t.content);
    this.closable.set_states(
      ...contents.map((c) => as_any_state(c.content_closable)),
    );
    this.min_width.set_states(
      this.side_state(),
      this.compact_state(),
      ...contents.map((c) => as_any_state(c.content_min_width)),
    );
    this.min_height.set_states(
      this.side_state(),
      ...contents.map((c) => as_any_state(c.content_min_height)),
    );
  }

  #insert(index: number, contents: readonly ContentBase[]): void {
    const tabs = contents.map(tab_of);
    const ref = this.#tabs[index] ?? null;
    for (const tab of tabs) this.bar.insertBefore(tab, ref);
    this.#tabs.splice(index, 0, ...tabs);
  }

  #remove(index: number, count: number): void {
    for (const tab of this.#tabs.splice(index, count)) {
      //A tab already moved to another group stays there
      if (tab.parentElement !== this.bar) continue;
      tab.remove();
      tab.set_selected(false);
      if (tab.content.parentElement === this.body) tab.content.remove();
    }
  }

  /**Shows the content of the active tab, the first tab when the active content is not a tab here*/
  #show_active(): void {
    const active = this.active();
    const shown = this.#tabs.find((t) => t.content === active) ?? this.#tabs[0];
    for (const tab of this.#tabs) tab.set_selected(tab === shown);
    if (!shown) this.body.replaceChildren();
    else if (this.body.firstChild !== shown.content)
      this.body.replaceChildren(shown.content);
    const content = shown?.content;
    if (content === this.#shown) return;
    this.#shown = content;
    this.shown_title.set_state(
      as_any_state(content ? content.content_title : ""),
    );
    this.shown_icon.set_state(as_any_state(content?.content_icon));
  }
}
define_element(LayoutTabs);

export type { LayoutTabs };

/**Creates a tab group, its contents shown as tabs*/
export function layout_tabs(options: LayoutTabsOptions = {}): LayoutTabs {
  return LayoutTabs.create(options);
}

/**Whether the element is a tab group*/
export const is_tabs = (element: unknown): element is LayoutTabs =>
  element instanceof LayoutTabs;

const at_side = (side: Result<any, unknown>) => {
  const at = value_or<LayoutTabsSide>(side, "top");
  return at === "left" || at === "right";
};
const biggest = (contents: Result<any, unknown>[], least: number) =>
  Math.max(least, ...contents.map((c) => value_or<number>(c, 0)));
