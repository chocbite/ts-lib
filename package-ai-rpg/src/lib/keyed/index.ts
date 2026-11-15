//An array state of states, one per entry, kept in step with plain arrays of entries.
//Entries are matched by a key, so an entry keeps its state while its key stays, and a list showing it refreshes only the entries that changed.
//Every sync writes only the differences with the array helpers: removals, moves, insertions and changes of single entries.
import { ok } from "@chocbite/ts-lib/result";
import state, { type StateLocalROS, type StateROS } from "@chocbite/ts-lib/state";

export class Keyed<T> {
  readonly #key: (entry: T) => string;
  readonly #rows = state.ros(ok<StateROS<T>[]>([]));
  readonly #owners = new Map<string, StateLocalROS<T>>();

  /**The entries in order, each a state that stays the same object while its key stays*/
  readonly rows = this.#rows.read_only;

  constructor(key: (entry: T) => string, entries: readonly T[] = []) {
    this.#key = key;
    this.sync(entries);
  }

  /**Brings the states to the entries, entries are compared by value to find the changed ones*/
  sync(entries: readonly T[]) {
    const wanted = new Map(entries.map((e) => [this.#key(e), e]));
    const current = this.#rows.ok();
    for (let i = current.length - 1; i >= 0; i--) {
      const key = this.#key(current[i].ok());
      if (!wanted.has(key)) {
        this.#rows.array.splice(i, 1);
        this.#owners.delete(key);
      }
    }
    entries.forEach((entry, i) => {
      const key = this.#key(entry);
      let owner = this.#owners.get(key);
      const rows = this.#rows.ok();
      if (!owner) {
        this.#owners.set(key, (owner = state.ros(ok(entry))));
        this.#rows.array.splice(i, 0, owner.read_only);
        return;
      }
      const from = rows.indexOf(owner.read_only);
      if (from !== i) this.#rows.array.move(from, i);
      if (JSON.stringify(owner.ok()) !== JSON.stringify(entry)) {
        owner.set_ok(entry);
        this.#rows.array.change(i, owner.read_only);
      }
    });
  }
}
