import { define_element } from "#base";
import type { Result } from "@chocbite/ts-lib/result";
import state, {
  type StateArrayRead,
  type StateREA,
} from "@chocbite/ts-lib/state";
import { ContentBase } from "../content";
import { TITLEBAR_HEIGHT_TOUCH } from "../panel";
import type { LayoutTabs, LayoutTabsSide } from "./tree";
import {
  as_any_state,
  collect,
  type Collected,
  MIN_HEIGHT,
  MIN_WIDTH,
  SIDE_BAR_WIDTH,
  value_or,
} from "./common";
import { can_leave } from "./actions";
import { NodeElement } from "./node";
import { type LayoutTab, tab_of } from "./tab";
import "./tabs.scss";

//      _______       ____   _____
//     |__   __|/\   |  _ \ / ____|
//        | |  /  \  | |_) | (___
//        | | / /\ \ |  _ < \___ \
//        | |/ ____ \| |_) |____) |
//        |_/_/    \_\____/|_____/
/**A tab bar and the content of the shown tab, the other contents are not in the document*/
export class TabsElement extends NodeElement {
  static element_name() {
    return "layouttabs";
  }

  declare readonly node: LayoutTabs;
  readonly bar = this.appendChild(document.createElement("div"));
  readonly body = this.appendChild(document.createElement("div"));
  /**Tabs in order, a tab moved to another group is no longer a child of the bar*/
  #tabs: LayoutTab[] = [];
  #side: LayoutTabsSide = "top";
  #compact = false;
  /**Content whose title and icon are shown*/
  #shown?: ContentBase;
  readonly #side_state: StateREA<LayoutTabsSide>;
  readonly #compact_state: StateREA<boolean>;
  /**Closable when the tabs can be changed and every content can be closed*/
  readonly closable: Collected<boolean>;
  /**The biggest content, and the bar beside it at the left or right side, or above or below it*/
  readonly min_width: Collected<number>;
  readonly min_height: Collected<number>;

  constructor(node: LayoutTabs) {
    super(node);
    this.#side_state = node.side ?? as_any_state<LayoutTabsSide>("top");
    this.#compact_state = node.compact ?? as_any_state(false);
    const at_side = (side: Result<any, unknown>) => {
      const at = value_or<LayoutTabsSide>(side, "top");
      return at === "left" || at === "right";
    };
    const biggest = (contents: Result<any, unknown>[], least: number) =>
      Math.max(least, ...contents.map((c) => value_or<number>(c, 0)));
    this.closable = collect(
      ([, ...contents]) =>
        node.tabs.writable &&
        contents.length > 0 &&
        contents.every((c) => value_or(c, false)),
      node.tabs,
    );
    this.min_width = collect(([, side, compact, ...contents]) => {
      const width = biggest(contents, MIN_WIDTH);
      if (!at_side(side)) return width;
      return (
        width +
        (value_or(compact, false) ? TITLEBAR_HEIGHT_TOUCH : SIDE_BAR_WIDTH)
      );
    }, node.tabs);
    this.min_height = collect(([, side, ...contents]) => {
      const height = biggest(contents, MIN_HEIGHT);
      return at_side(side) ? height : height + TITLEBAR_HEIGHT_TOUCH;
    }, node.tabs);
    this.bar.className = "bar";
    this.body.className = "body";
    this.classList.add("side-top");
    //A group with read only tabs hides the close buttons, also before it is in a layout
    this.classList.toggle("locked", !node.tabs.writable);
    this.attach_state(node.tabs, (tabs) => this.#apply(tabs.value));
    this.attach_state(node.active, () => this.#show_active());
    this.attach_state(this.#side_state, (side) => {
      this.classList.remove("side-" + this.#side);
      this.#side = value_or(side, "top");
      this.classList.add("side-" + this.#side);
    });
    this.attach_state(this.#compact_state, (compact) => {
      this.#compact = value_or(compact, false);
      this.classList.toggle("compact", this.#compact);
    });
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
    this.classList.toggle("locked", !this.can_close());
  }

  /**Whether its tabs can be closed, they can leave the group, the last tab of a group in a read only split,
   * or of a layout whose owner keeps it, can not*/
  can_close(): boolean {
    const layout = this.layout();
    return layout ? can_leave(layout, this.node) : this.node.tabs.writable;
  }

  /**Collects from the contents again*/
  #collect(): void {
    const contents = this.#tabs.map((t) => t.content);
    const items = this.node.tabs;
    this.closable.set_states(
      items,
      ...contents.map((c) => as_any_state(c.content_closable)),
    );
    this.min_width.set_states(
      items,
      this.#side_state,
      this.#compact_state,
      ...contents.map((c) => as_any_state(c.content_min_width)),
    );
    this.min_height.set_states(
      items,
      this.#side_state,
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
    const active = this.node.active.ok();
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
define_element(TabsElement);
