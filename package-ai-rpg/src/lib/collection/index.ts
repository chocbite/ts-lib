//A keyed collection of states: every item is its own state, and the collection is an array state of those states.
//Changing an item sets its state, and marks its index as changed in the array state,
//so subscribers of the collection, like a list, hear which item changed through the array's change record.
//Items are never removed, an item's state is made once and stays the same object, so it identifies the item.
//Items are kept in order of their id.
import { ok } from "@chocbite/ts-lib/result";
import state, { type StateLocalROS, type StateROS } from "@chocbite/ts-lib/state";

export class Collection<T extends { id: string }> {
  readonly #list = state.ros(ok<StateROS<T>[]>([]));
  readonly #owners = new Map<string, StateLocalROS<T>>();
  readonly #index = new Map<string, number>();

  /**The items in order of id, each a read only state that stays the same object*/
  readonly list = this.#list.read_only;

  /**The state of the item with the id*/
  get(id: string): StateROS<T> | undefined {
    return this.#owners.get(id)?.read_only;
  }

  /**Current value of the item with the id*/
  value(id: string): T | undefined {
    return this.#owners.get(id)?.ok();
  }

  /**Current values of all items*/
  *values(): Iterable<T> {
    for (const owner of this.#owners.values()) yield owner.ok();
  }

  /**Replaces all items, every item gets a new state*/
  reset(items: readonly T[]) {
    this.#owners.clear();
    this.#index.clear();
    const list = [...items].sort((a, b) => compare(a.id, b.id)).map((item, i) => {
      const owner = state.ros(ok(item));
      this.#owners.set(item.id, owner);
      this.#index.set(item.id, i);
      return owner.read_only;
    });
    this.#list.set_ok(list);
  }

  /**Sets the item with the id of the value, adding it when it is new*/
  put(item: T) {
    const owner = this.#owners.get(item.id);
    if (owner) {
      owner.set_ok(item);
      this.#list.array.change(this.#index.get(item.id)!, owner.read_only);
    } else {
      const added = state.ros(ok(item));
      this.#owners.set(item.id, added);
      //Kept in id order, so the order is the same after loading, where records come in key order
      const list = this.#list.ok();
      let index = list.length;
      while (index > 0 && compare(list[index - 1].ok().id, item.id) > 0) index--;
      for (let i = index; i < list.length; i++) this.#index.set(list[i].ok().id, i + 1);
      this.#index.set(item.id, index);
      this.#list.array.splice(index, 0, added.read_only);
    }
  }
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
