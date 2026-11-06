import { sync_resolve } from "#common";
import {
  err,
  ok,
  OptionSome,
  ResultInferOk as RIO,
  some,
} from "#result";
import { ros } from "../local";
import { StateResult as SR, StateHelper, StateROS } from "../types";
import {
  StateInitResult as SIR,
  StateHelperBase,
  StateHelperBaseOptions,
  StateInit,
  StateRelatedBase,
} from "./helpers";

//##################################################################################################################################################
//      _____  ______          _____
//     |  __ \|  ____|   /\   |  __ \
//     | |__) | |__     /  \  | |  | |
//     |  _  /|  __|   / /\ \ | |  | |
//     | | \ \| |____ / ____ \| |__| |
//     |_|  \_\______/_/    \_\_____/
export const STATE_ARRAY_READ_KEY = Symbol("state_array_read_key");

export type StateArrayReadTypes<RT> =
  | {
      type: "added";
      index: number;
      items: readonly RT[];
    }
  | {
      type: "removed";
      index: number;
      items: readonly RT[];
    }
  | {
      type: "changed";
      index: number;
      items: readonly RT[];
    }
  | {
      type: "fresh";
      items: readonly RT[];
    }
  | {
      type: "moved";
      from_index: number;
      to_index: number;
      items: readonly RT[];
    };

export type StateArrayRead<RT> = readonly RT[] & {
  [STATE_ARRAY_READ_KEY]?: StateArrayReadTypes<RT>[];
};

/**Returns the state array granular read object for an array, or a fake one if the array is not a state array read object */
function read<RT>(arr: readonly RT[]): StateArrayReadTypes<RT>[] {
  return (
    (arr as StateArrayRead<RT>)[STATE_ARRAY_READ_KEY] ?? [
      { type: "fresh", items: arr },
    ]
  );
}

/**Applies the state array read object to an array, returning the modified array or a new array
 * If a transform function is provided, elements will be transformed before being added to the array*/
function read_apply<T, U>(
  read: StateArrayRead<T>,
  array: U[],
  transform: (item: T) => U,
): U[];
// 2. Overload for when transform is NOT provided
function read_apply<T>(
  read: StateArrayRead<T>,
  array: T[],
  transform?: undefined,
): T[];
function read_apply<T, U>(
  read: StateArrayRead<T>,
  array: U[] | T[],
  transform?: (item: T) => U,
): U[] | T[] {
  if (transform) {
    if (read[STATE_ARRAY_READ_KEY]) {
      for (const r of read[STATE_ARRAY_READ_KEY]) {
        if (r.type === "added")
          array.splice(r.index, 0, ...r.items.map(transform));
        else if (r.type === "removed") array.splice(r.index, r.items.length);
        else if (r.type === "changed")
          r.items.forEach((item, i) => (array[r.index + i] = transform(item)));
        else if (r.type === "moved") {
          const items = array.splice(r.from_index, r.items.length);
          (array as any[]).splice(r.to_index, 0, ...items);
        } else if (r.type === "fresh") return read.map(transform);
      }
      return array;
    } else {
      return read.map(transform);
    }
  } else {
    if (read[STATE_ARRAY_READ_KEY]) {
      for (const r of read[STATE_ARRAY_READ_KEY]) {
        if (r.type === "added") array.splice(r.index, 0, ...r.items);
        else if (r.type === "removed") array.splice(r.index, r.items.length);
        else if (r.type === "changed")
          r.items.forEach((item, i) => (array[r.index + i] = item));
        else if (r.type === "moved") {
          const items = array.splice(r.from_index, r.items.length);
          (array as any[]).splice(r.to_index, 0, ...items);
        } else if (r.type === "fresh") return read as T[];
      }
      return array;
    } else {
      return read as T[];
    }
  }
}

/**Calls a setter function with a state array read object*/
function read_set<T>(
  read: [T[], StateArrayReadTypes<T>[] | undefined],
  setter: (value: StateArrayRead<T>) => void,
) {
  const [array, read_types] = read as [
    StateArrayRead<T>,
    StateArrayReadTypes<T>[] | undefined,
  ];
  if (read_types) array[STATE_ARRAY_READ_KEY] = read_types;
  setter(array);
  if (array[STATE_ARRAY_READ_KEY]) delete array[STATE_ARRAY_READ_KEY];
}

//##################################################################################################################################################
//     __          _______  _____ _______ ______
//     \ \        / /  __ \|_   _|__   __|  ____|
//      \ \  /\  / /| |__) | | |    | |  | |__
//       \ \/  \/ / |  _  /  | |    | |  |  __|
//        \  /\  /  | | \ \ _| |_   | |  | |____
//         \/  \/   |_|  \_\_____|  |_|  |______|

export const STATE_ARRAY_WRITE_KEY = Symbol("state_array_write_key");

export type StateArrayWriteTypes<WT> =
  | { type: "fresh"; items: WT[] }
  | { type: "push"; items: WT[] }
  | { type: "unshift"; items: WT[] }
  | { type: "pop" }
  | { type: "shift" }
  | { type: "delete"; delete: WT }
  | { type: "change"; index: number; items: WT[] }
  | { type: "splice"; index: number; delete_count: number; items: WT[] }
  | { type: "move"; from_index: number; to_index: number; count: number };

/**An array replacement optionally carrying a granular write instruction.*/
export type StateArrayWrite<WT> = WT[] & {
  [STATE_ARRAY_WRITE_KEY]?: StateArrayWriteTypes<WT>;
};

export type StateArrayWriteInstruction<WT> = StateArrayWrite<WT> & {
  [STATE_ARRAY_WRITE_KEY]: StateArrayWriteTypes<WT>;
};

type WithWriteKey<T> = T[] & {
  [STATE_ARRAY_WRITE_KEY]: StateArrayWriteTypes<T>;
};

const write = {
  fresh<T>(items: T[]): StateArrayWriteInstruction<T> {
    (items as T[] & WithWriteKey<T>)[STATE_ARRAY_WRITE_KEY] = {
      type: "fresh",
      items,
    };
    return items as StateArrayWriteInstruction<T>;
  },
  push<T>(...items: T[]): StateArrayWriteInstruction<T> {
    const obj = [] as unknown as WithWriteKey<T>;
    obj[STATE_ARRAY_WRITE_KEY] = { type: "push", items };
    return obj;
  },
  unshift<T>(...items: T[]): StateArrayWriteInstruction<T> {
    const obj = [] as unknown as WithWriteKey<T>;
    obj[STATE_ARRAY_WRITE_KEY] = { type: "unshift", items };
    return obj;
  },
  pop<T>(): StateArrayWriteInstruction<T> {
    const obj = [] as unknown as WithWriteKey<T>;
    obj[STATE_ARRAY_WRITE_KEY] = { type: "pop" };
    return obj;
  },
  shift<T>(): StateArrayWriteInstruction<T> {
    const obj = [] as unknown as WithWriteKey<T>;
    obj[STATE_ARRAY_WRITE_KEY] = { type: "shift" };
    return obj;
  },
  delete<T>(val: T): StateArrayWriteInstruction<T> {
    const obj = [] as unknown as WithWriteKey<T>;
    obj[STATE_ARRAY_WRITE_KEY] = { type: "delete", delete: val };
    return obj;
  },
  change<T>(index: number, ...items: T[]): StateArrayWriteInstruction<T> {
    const obj = [] as unknown as WithWriteKey<T>;
    obj[STATE_ARRAY_WRITE_KEY] = { type: "change", index, items };
    return obj;
  },
  splice<T>(
    start: number,
    delete_count: number = 0,
    ...items: T[]
  ): StateArrayWriteInstruction<T> {
    const obj = [] as unknown as WithWriteKey<T>;
    obj[STATE_ARRAY_WRITE_KEY] = {
      type: "splice",
      index: start,
      delete_count,
      items,
    };
    return obj;
  },
  move<T>(
    from_index: number,
    to_index: number,
    count: number = 1,
  ): StateArrayWriteInstruction<T> {
    const obj = [] as unknown as WithWriteKey<T>;
    obj[STATE_ARRAY_WRITE_KEY] = { type: "move", from_index, to_index, count };
    return obj;
  },
};

/**Modifies an array based on a StateArrayWrite instruction and returns the modified array and state array read types*/
function write_apply<T>(
  write: StateArrayWrite<T>,
  array: T[] = [],
): [T[], StateArrayReadTypes<T>[] | undefined] {
  const wk = (write as Partial<WithWriteKey<T>>)[STATE_ARRAY_WRITE_KEY];
  if (wk) {
    const w = wk;
    if (w.type === "fresh") return [write, [{ type: "fresh", items: write }]];
    else if (w.type === "push") {
      const index = array.length;
      array.push(...w.items);
      return [array, [{ type: "added", index, items: w.items }]];
    } else if (w.type === "unshift") {
      array.unshift(...w.items);
      return [array, [{ type: "added", index: 0, items: w.items }]];
    } else if (w.type === "pop") {
      if (!array.length) return [[], undefined];
      const items = [array.pop()!];
      return [array, [{ type: "removed", index: array.length, items }]];
    } else if (w.type === "shift") {
      if (!array.length) return [[], undefined];
      const items = [array.shift()!];
      return [array, [{ type: "removed", index: 0, items }]];
    } else if (w.type === "delete") {
      const operations = [] as StateArrayReadTypes<T>[];
      for (let i = 0; i < array.length; i++) {
        if (array[i] === w.delete) {
          array.splice(i, 1);
          operations.push({ type: "removed", index: i, items: [w.delete] });
          i--;
        }
      }
      return [array, operations];
    } else if (w.type === "change") {
      if (w.index >= array.length) return [array, undefined];
      const capped = w.items.slice(0, array.length - w.index);
      capped.forEach((item, i) => (array[w.index + i] = item));
      return [array, [{ type: "changed", index: w.index, items: capped }]];
    } else if (w.type === "splice") {
      const removed = array.splice(w.index, w.delete_count, ...w.items);
      const operations = [] as StateArrayReadTypes<T>[];
      if (removed.length > 0)
        operations.push({ type: "removed", index: w.index, items: removed });
      if (w.items.length > 0)
        operations.push({ type: "added", index: w.index, items: w.items });
      return [array, operations];
    } else if (w.type === "move") {
      if (w.count <= 0 || w.from_index < 0 || w.from_index >= array.length)
        return [array, undefined];
      const capped = Math.min(w.count, array.length - w.from_index);
      const items = array.splice(w.from_index, capped);
      array.splice(w.to_index, 0, ...items);
      return [
        array,
        [
          {
            type: "moved",
            from_index: w.from_index,
            to_index: w.to_index,
            items,
          },
        ],
      ];
    } else return [array, undefined];
  } else return [write, undefined];
}

//##################################################################################################################################################
//      _    _ ______ _      _____  ______ _____
//     | |  | |  ____| |    |  __ \|  ____|  __ \
//     | |__| | |__  | |    | |__) | |__  | |__) |
//     |  __  |  __| | |    |  ___/|  __| |  _  /
//     | |  | | |____| |____| |    | |____| | \ \
//     |_|  |_|______|______|_|    |______|_|  \_\
export const STATE_ARRAY_RELATED_KEY = Symbol("state_array_related");
export const STATE_ARRAY_HELPER_KEY = Symbol("state_array_helper");

export interface StateArrayRelated extends StateRelatedBase {
  readonly [STATE_ARRAY_RELATED_KEY]: true;
  length: StateROS<number>;
}

export interface StateArrayHelperOptions extends StateHelperBaseOptions {}

export interface StateArrayHelper<
  RT extends any[],
  WT extends any[] = RT,
> extends StateHelper<SR<RT>, WT, OptionSome<StateArrayRelated>> {}

export class StateArrayHelperBase<RT extends any[], WT extends any[]>
  extends StateHelperBase<SR<RT>, WT, OptionSome<StateArrayRelated>>
  implements StateArrayRelated
{
  get [STATE_ARRAY_RELATED_KEY](): true {
    return true;
  }
  get [STATE_ARRAY_HELPER_KEY](): true {
    return true;
  }

  readonly length = ros(ok(0));

  constructor(options?: StateArrayHelperOptions) {
    super(options);
  }

  on_change(value: SR<RT>): void {
    if (value.ok) this.length.set_ok(value.value.length);
    else this.length.set_ok(0);
  }

  limit(value: WT): PromiseLike<SR<WT>> {
    return sync_resolve(ok(value));
  }

  check(value: WT): PromiseLike<SR<WT>> {
    if (this.writable !== undefined && !this.writable)
      return sync_resolve(err("not writable"));
    return sync_resolve(ok(value));
  }

  related(): OptionSome<StateArrayRelated> {
    return some(this);
  }
}

//##################################################################################################################################################
//      ________   _______   ____  _____ _______ _____
//     |  ____\ \ / /  __ \ / __ \|  __ \__   __/ ____|
//     | |__   \ V /| |__) | |  | | |__) | | | | (___
//     |  __|   > < |  ___/| |  | |  _  /  | |  \___ \
//     | |____ / . \| |    | |__| | | \ \  | |  ____) |
//     |______/_/ \_\_|     \____/|_|  \_\ |_| |_____/

export const ARRAY = {
  /**Returns true if object is a array related */
  is_related(r: any): r is StateArrayRelated {
    return Boolean(
      r &&
      (r as { [STATE_ARRAY_RELATED_KEY]: boolean })[STATE_ARRAY_RELATED_KEY],
    );
  },
  /**Returns true if object is a array helper */
  is_helper(h: any): h is StateArrayHelperBase<any, any> {
    return Boolean(
      h && (h as { [STATE_ARRAY_HELPER_KEY]: boolean })[STATE_ARRAY_HELPER_KEY],
    );
  },
  /**Array helper*/
  help<
    I extends StateInit<any[]>,
    RRT extends SR<any> = SIR<I>,
    WT extends any[] = RIO<RRT>,
  >(
    init: I,
    options?: StateArrayHelperOptions,
  ): [I, StateArrayHelper<RIO<RRT>, WT>] {
    return [init, new StateArrayHelperBase<RIO<RRT>, WT>(options)];
  },
  //### Read
  /**Returns true if object is a array read object */
  is_read(a: any): a is StateArrayRead<any> {
    return Boolean(
      a && (a as { [STATE_ARRAY_READ_KEY]: boolean })[STATE_ARRAY_READ_KEY],
    );
  },
  read,
  read_apply,
  read_set,
  //### Write
  /**Returns true if object is a array write object */
  is_write(a: any): a is StateArrayWrite<any> & WithWriteKey<any> {
    return Boolean(
      a && (a as { [STATE_ARRAY_WRITE_KEY]: boolean })[STATE_ARRAY_WRITE_KEY],
    );
  },
  write,
  write_apply,
};
