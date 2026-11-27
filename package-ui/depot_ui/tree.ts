import type { ListSearchQuery, ListSearchResult } from "#list";
import type {
  DepotChild,
  DepotEntry,
  DepotGroup,
} from "@chocbite/ts-lib/depot";
import { ok } from "@chocbite/ts-lib/result";
import state, {
  type StateLocalROS,
  type StateOrValROS,
  type StateROS,
} from "@chocbite/ts-lib/state";

/**The text a name or description shows now*/
const text_now = (text: StateOrValROS<string>): string =>
  state.is.state(text) ? text.ok() : text;

/**What the row of a child answers to a search, the description column and the key field can be highlighted*/
export type DepotSearchResult = ListSearchResult<{ description: unknown }>;

/**A filtered view of a group and everything below it, following the children states of the depot.
 * Entries are shown when they pass the filter, groups when something below them is shown*/
export class DepotTree<T> {
  #root: DepotGroup<T>;
  #filter: (entry: DepotEntry<T>) => boolean;
  /**Rows shown per group*/
  #rows = new Map<DepotGroup<T>, StateLocalROS<DepotChild<T>[]>>();
  /**Every group below the root that was visited, with what stops following its children, nothing for constant children*/
  #subs = new Map<DepotGroup<T>, (() => void) | undefined>();
  /**Whether something below a group matches a search, by search, worked out once per group as the list asks every row*/
  #below = new WeakMap<ListSearchQuery, Map<DepotGroup<T>, boolean>>();
  #pending = false;
  #disposed = false;

  constructor(root: DepotGroup<T>, filter?: (entry: DepotEntry<T>) => boolean) {
    this.#root = root;
    this.#filter = filter ?? (() => true);
    this.#update();
  }

  /**Rows shown for a group, the root rows when no group is given*/
  rows(group: DepotGroup<T> = this.#root): StateROS<DepotChild<T>[]> {
    return this.#rows_of(group).read_only;
  }

  /**What the row of a child answers to a search of a list showing the tree, give it as the search row option
   * An entry matches by its name and description, which are highlighted, or else by its path,
   * a group is opened when something shown below it matches, or else matches by its own name and description*/
  search(child: DepotChild<T>, query: ListSearchQuery): DepotSearchResult {
    const found = query.match(
      { description: text_now(child.description) },
      text_now(child.name),
    );
    if (child.kind === "entry")
      return found ?? (query.match({}, child.path) ? "match" : "none");
    if (this.#found_below(child, query)) return "below";
    return found ?? "none";
  }

  /**Drops the subscriptions to the depot*/
  dispose(): void {
    this.#disposed = true;
    for (const unsub of this.#subs.values()) unsub?.();
    this.#subs.clear();
  }

  #found_below(group: DepotGroup<T>, query: ListSearchQuery): boolean {
    let found = this.#below.get(query);
    if (!found)
      this.#below.set(query, (found = new Map<DepotGroup<T>, boolean>()));
    let below = found.get(group);
    if (below === undefined) {
      below = this.rows(group)
        .ok()
        .some((child) => this.search(child, query) !== "none");
      found.set(group, below);
    }
    return below;
  }

  #rows_of(group: DepotGroup<T>): StateLocalROS<DepotChild<T>[]> {
    let rows = this.#rows.get(group);
    if (!rows)
      this.#rows.set(group, (rows = state.ros(ok<DepotChild<T>[]>([]))));
    return rows;
  }

  /**Changes in the depot often come in bursts, like a group being registered, so they are handled once after the burst*/
  #changed = () => {
    if (this.#pending || this.#disposed) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      if (!this.#disposed) this.#update();
    });
  };

  /**Works out the shown rows of every group again, setting only those that changed*/
  #update(): void {
    //What was found below the groups is of the rows before
    this.#below = new WeakMap();
    const seen = new Set<DepotGroup<T>>();
    const visit = (group: DepotGroup<T>): DepotChild<T>[] => {
      seen.add(group);
      //Children that are a state are followed, constant children never change
      const children = group.children;
      if (!this.#subs.has(group))
        this.#subs.set(
          group,
          state.is.state(children)
            ? (children.sub(this.#changed), () => children.unsub(this.#changed))
            : undefined,
        );
      const shown: DepotChild<T>[] = [];
      for (const child of state.is.state(children) ? children.ok() : children)
        if (child.kind === "entry" ? this.#filter(child) : visit(child).length)
          shown.push(child);
      const rows = this.#rows_of(group);
      const old = rows.ok();
      if (
        old.length !== shown.length ||
        old.some((child, i) => child !== shown[i])
      )
        rows.set_ok(shown);
      return shown;
    };
    visit(this.#root);
    //Groups that were removed, or are below a removed group
    for (const [group, unsub] of this.#subs) {
      if (seen.has(group)) continue;
      unsub?.();
      this.#subs.delete(group);
      this.#rows.get(group)?.set_ok([]);
      this.#rows.delete(group);
    }
  }
}
