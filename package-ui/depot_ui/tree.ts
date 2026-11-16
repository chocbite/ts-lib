import type {
  DepotChild,
  DepotEntry,
  DepotGroup,
} from "@chocbite/ts-lib/depot";
import { ok } from "@chocbite/ts-lib/result";
import state, {
  type StateLocalROS,
  type StateROS,
} from "@chocbite/ts-lib/state";

/**A filtered view of a group and everything below it, following the children states of the depot.
 * Entries are shown when they pass the filter and the search, groups when something below them is shown*/
export class DepotTree<T> {
  #root: DepotGroup<T>;
  #filter: (entry: DepotEntry<T>) => boolean;
  #search = "";
  /**Rows shown per group*/
  #rows = new Map<DepotGroup<T>, StateLocalROS<DepotChild<T>[]>>();
  /**Subscriptions to the children of every group below the root*/
  #subs = new Map<DepotGroup<T>, () => void>();
  #pending = false;
  #disposed = false;

  constructor(root: DepotGroup<T>, filter?: (entry: DepotEntry<T>) => boolean) {
    this.#root = root;
    this.#filter = filter ?? (() => true);
    this.#update(false);
  }

  /**Rows shown for a group, the root rows when no group is given*/
  rows(group: DepotGroup<T> = this.#root): StateROS<DepotChild<T>[]> {
    return this.#rows_of(group).read_only;
  }

  /**True while a search text is set, rows of groups should be open then*/
  get searching(): boolean {
    return this.#search !== "";
  }

  /**Text matched against the names and paths of entries, case insensitive*/
  set search(text: string) {
    const search = text.trim().toLowerCase();
    if (search === this.#search) return;
    this.#search = search;
    //Every row is given again, so the rows of groups open or close with the search
    this.#update(true);
  }

  /**Drops the subscriptions to the depot*/
  dispose(): void {
    this.#disposed = true;
    for (const [group, sub] of this.#subs) group.children.unsub(sub);
    this.#subs.clear();
  }

  #rows_of(group: DepotGroup<T>): StateLocalROS<DepotChild<T>[]> {
    let rows = this.#rows.get(group);
    if (!rows)
      this.#rows.set(group, (rows = state.ros(ok<DepotChild<T>[]>([]))));
    return rows;
  }

  #matches(entry: DepotEntry<T>): boolean {
    if (!this.#filter(entry)) return false;
    if (!this.#search) return true;
    return (
      entry.name.toLowerCase().includes(this.#search) ||
      entry.path.toLowerCase().includes(this.#search)
    );
  }

  /**Changes in the depot often come in bursts, like a group being registered, so they are handled once after the burst*/
  #changed = () => {
    if (this.#pending || this.#disposed) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      if (!this.#disposed) this.#update(false);
    });
  };

  /**Works out the shown rows of every group again
   * @param fresh give every group its rows again, even when they did not change*/
  #update(fresh: boolean): void {
    const seen = new Set<DepotGroup<T>>();
    const visit = (group: DepotGroup<T>): DepotChild<T>[] => {
      seen.add(group);
      if (!this.#subs.has(group))
        this.#subs.set(group, group.children.sub(this.#changed));
      const shown: DepotChild<T>[] = [];
      for (const child of group.children.ok())
        if (child.kind === "entry" ? this.#matches(child) : visit(child).length)
          shown.push(child);
      const rows = this.#rows_of(group);
      const old = rows.ok();
      if (
        fresh ||
        old.length !== shown.length ||
        old.some((child, i) => child !== shown[i])
      )
        rows.set_ok(shown);
      return shown;
    };
    visit(this.#root);
    //Groups that were removed, or are below a removed group
    for (const [group, sub] of this.#subs) {
      if (seen.has(group)) continue;
      group.children.unsub(sub);
      this.#subs.delete(group);
      this.#rows.get(group)?.set_ok([]);
      this.#rows.delete(group);
    }
  }
}
