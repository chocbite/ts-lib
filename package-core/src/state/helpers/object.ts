import { sync_resolve } from "#common";
import {
  ok,
  OptionSome,
  ResultInferOk as RIO,
  some,
} from "#result";
import { StateResult as SR, StateHelper } from "../types";
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
export const STATE_OBJECT_READ_KEY = Symbol("state_object_read_key");

export type StateObjectReadTypes<TYPE> =
  | {
      type: "added";
      items: Readonly<Record<PropertyKey, TYPE>>;
    }
  | {
      type: "removed";
      items: Readonly<Record<PropertyKey, TYPE>>;
    }
  | {
      type: "changed";
      items: Readonly<Record<PropertyKey, TYPE>>;
    }
  | {
      type: "fresh";
      items: Readonly<Record<PropertyKey, TYPE>>;
    };

export type StateObjectRead<TYPE> = {
  [key: PropertyKey]: TYPE;
} & {
  [STATE_OBJECT_READ_KEY]?: StateObjectReadTypes<TYPE>[];
};

/**Returns the state object granular read object for an object, or a fake one if the object is not a state object read object */
function read<TYPE>(
  obj: Record<PropertyKey, TYPE>,
): StateObjectReadTypes<TYPE>[] {
  return (
    (obj as StateObjectRead<TYPE>)[STATE_OBJECT_READ_KEY] ?? [
      { type: "fresh", items: obj },
    ]
  );
}

/**Applies the state object read object to an object, returning the modified object or a new object
 * If a transform function is provided, values will be transformed before being added to the object*/
function read_apply<T, U>(
  read: StateObjectRead<T>,
  obj: Record<PropertyKey, U>,
  transform: (item: T) => U,
): Record<PropertyKey, U>;
function read_apply<T>(
  read: StateObjectRead<T>,
  obj: Record<PropertyKey, T>,
  transform?: undefined,
): Record<PropertyKey, T>;
function read_apply<T, U>(
  read: StateObjectRead<T>,
  obj: Record<PropertyKey, U> | Record<PropertyKey, T>,
  transform?: (item: T) => U,
): Record<PropertyKey, U> | Record<PropertyKey, T> {
  if (transform) {
    if (read[STATE_OBJECT_READ_KEY]) {
      for (const r of read[STATE_OBJECT_READ_KEY]) {
        if (r.type === "added" || r.type === "changed")
          Object.entries(r.items).forEach(
            ([key, value]) =>
              ((obj as Record<PropertyKey, U>)[key] = transform(value)),
          );
        else if (r.type === "removed")
          for (const key of Object.keys(r.items)) delete obj[key];
        else if (r.type === "fresh") {
          const result: Record<PropertyKey, U> = {};
          Object.entries(r.items).forEach(
            ([key, value]) => (result[key] = transform(value)),
          );
          return result;
        }
      }
      return obj;
    } else {
      const result: Record<PropertyKey, U> = {};
      Object.entries(read).forEach(
        ([key, value]) => (result[key] = transform(value)),
      );
      return result;
    }
  } else {
    if (read[STATE_OBJECT_READ_KEY]) {
      for (const r of read[STATE_OBJECT_READ_KEY]) {
        if (r.type === "added") Object.assign(obj, r.items);
        else if (r.type === "removed")
          for (const key of Object.keys(r.items)) delete obj[key];
        else if (r.type === "changed") Object.assign(obj, r.items);
        else if (r.type === "fresh") return { ...r.items };
      }
      return obj;
    } else {
      return read;
    }
  }
}

/**Calls a setter function with a state object read object*/
function read_set<T>(
  read: [Record<PropertyKey, T>, StateObjectReadTypes<T>[] | undefined],
  setter: (value: Record<PropertyKey, T> | StateObjectRead<T>) => void,
) {
  const [obj, read_types] = read as [
    StateObjectRead<T>,
    StateObjectReadTypes<T>[] | undefined,
  ];
  if (read_types) obj[STATE_OBJECT_READ_KEY] = read_types;
  setter(obj);
  if (obj[STATE_OBJECT_READ_KEY]) delete obj[STATE_OBJECT_READ_KEY];
}

//##################################################################################################################################################
//     __          _______  _____ _______ ______
//     \ \        / /  __ \|_   _|__   __|  ____|
//      \ \  /\  / /| |__) | | |    | |  | |__
//       \ \/  \/ / |  _  /  | |    | |  |  __|
//        \  /\  /  | | \ \ _| |_   | |  | |____
//         \/  \/   |_|  \_\_____|  |_|  |______|

export const STATE_OBJECT_WRITE_KEY = Symbol("state_object_write_key");

export type StateObjectWriteTypes<TYPE> =
  | { type: "fresh"; items: Record<PropertyKey, TYPE> }
  | { type: "add"; items: Record<PropertyKey, TYPE> }
  | { type: "remove"; items: readonly PropertyKey[] }
  | { type: "change"; items: Record<PropertyKey, TYPE> };

export type StateObjectWrite<TYPE> =
  | {
      [key: PropertyKey]: TYPE;
    }
  | {
      [STATE_OBJECT_WRITE_KEY]: StateObjectWriteTypes<TYPE>;
    };

type WithWriteKey<T> = { [STATE_OBJECT_WRITE_KEY]: StateObjectWriteTypes<T> };

const write = {
  fresh<T>(items: Record<PropertyKey, T>): StateObjectWrite<T> {
    (items as Record<PropertyKey, T> & WithWriteKey<T>)[
      STATE_OBJECT_WRITE_KEY
    ] = {
      type: "fresh",
      items,
    };
    return items;
  },
  add<T>(items: Record<PropertyKey, T>): StateObjectWrite<T> {
    const obj: WithWriteKey<T> = {
      [STATE_OBJECT_WRITE_KEY]: { type: "add", items },
    };
    return obj;
  },
  remove<T>(...keys: PropertyKey[]): StateObjectWrite<T> {
    const obj: WithWriteKey<T> = {
      [STATE_OBJECT_WRITE_KEY]: { type: "remove", items: keys },
    };
    return obj;
  },
  change<T>(items: Record<PropertyKey, T>): StateObjectWrite<T> {
    const obj: WithWriteKey<T> = {
      [STATE_OBJECT_WRITE_KEY]: { type: "change", items },
    };
    return obj;
  },
};

/**Modifies an object based on a StateObjectWrite instruction and returns the modified object and state object read types*/
function write_apply<T>(
  write: StateObjectWrite<T>,
  obj: Record<PropertyKey, T> = {},
): [Record<PropertyKey, T>, StateObjectReadTypes<T>[] | undefined] {
  const wk = (write as Partial<WithWriteKey<T>>)[STATE_OBJECT_WRITE_KEY];
  if (wk) {
    const w = wk;
    if (w.type === "fresh") {
      const result: Record<PropertyKey, T> = {};
      Object.entries(w.items).forEach(([key, value]) => (result[key] = value));
      return [result, [{ type: "fresh", items: w.items }]];
    } else if (w.type === "add") {
      Object.assign(obj, w.items);
      return [obj, [{ type: "added", items: w.items }]];
    } else if (w.type === "remove") {
      const removed: Record<PropertyKey, T> = {};
      for (const key of w.items) {
        if (key in obj) {
          removed[key] = obj[key]!;
          delete obj[key];
        }
      }
      return [obj, [{ type: "removed", items: removed }]];
    } else if (w.type === "change") {
      Object.assign(obj, w.items);
      return [obj, [{ type: "changed", items: w.items }]];
    } else return [obj, undefined];
  } else return [write as Record<PropertyKey, T>, undefined];
}

//##################################################################################################################################################
//      _    _ ______ _      _____  ______ _____
//     | |  | |  ____| |    |  __ \|  ____|  __ \
//     | |__| | |__  | |    | |__) | |__  | |__) |
//     |  __  |  __| | |    |  ___/|  __| |  _  /
//     | |  | | |____| |____| |    | |____| | \ \
//     |_|  |_|______|______|_|    |______|_|  \_\
export const STATE_OBJECT_RELATED_KEY = Symbol("state_object_related");
export const STATE_OBJECT_HELPER_KEY = Symbol("state_object_helper");

export interface StateObjectRelated extends StateRelatedBase {
  readonly [STATE_OBJECT_RELATED_KEY]: true;
}

export interface StateObjectHelperOptions extends StateHelperBaseOptions {}

export interface StateObjectHelper<
  RT extends Record<PropertyKey, any>,
> extends StateHelper<SR<RT>, RT, OptionSome<StateObjectRelated>> {}

export class StateObjectHelperBase<RT extends Record<PropertyKey, any>>
  extends StateHelperBase<SR<RT>, RT, OptionSome<StateObjectRelated>>
  implements StateObjectRelated
{
  get [STATE_OBJECT_RELATED_KEY](): true {
    return true;
  }
  get [STATE_OBJECT_HELPER_KEY](): true {
    return true;
  }

  constructor(options?: StateObjectHelperOptions) {
    super(options);
  }

  limit(value: RT): PromiseLike<SR<RT>> {
    return sync_resolve(ok(value));
  }

  check(value: RT): PromiseLike<SR<RT>> {
    return this.check_writable(value);
  }

  related(): OptionSome<StateObjectRelated> {
    return some(this);
  }
}

export interface StateObjectMethods<T> {
  add(key: string, value: T): void;
  remove(key: string): void;
  change(key: string, value: T): void;
}

//##################################################################################################################################################
//      ________   _______   ____  _____ _______ _____
//     |  ____\ \ / /  __ \ / __ \|  __ \__   __/ ____|
//     | |__   \ V /| |__) | |  | | |__) | | | | (___
//     |  __|   > < |  ___/| |  | |  _  /  | |  \___ \
//     | |____ / . \| |    | |__| | | \ \  | |  ____) |
//     |______/_/ \_\_|     \____/|_|  \_\ |_| |_____/

export const OBJECT = {
  /**Unique key to check if object is an object related */
  RELATED_KEY: STATE_OBJECT_RELATED_KEY,
  /**Returns true if object is an object related */
  is_related(r: any): r is StateObjectRelated {
    return Boolean(
      r &&
      (r as { [STATE_OBJECT_RELATED_KEY]: boolean })[STATE_OBJECT_RELATED_KEY],
    );
  },
  /**Unique key to check if object is an object helper */
  HELPER_KEY: STATE_OBJECT_HELPER_KEY,
  /**Returns true if object is an object helper */
  is_helper(h: any): h is StateObjectHelperBase<any> {
    return Boolean(
      h &&
      (h as { [STATE_OBJECT_HELPER_KEY]: boolean })[STATE_OBJECT_HELPER_KEY],
    );
  },
  /**Object helper*/
  help<
    I extends StateInit<Record<PropertyKey, any>>,
    RRT extends SR<any> = SIR<I>,
  >(
    init: I,
    options?: StateObjectHelperOptions,
  ): [I, StateObjectHelper<RIO<RRT>>] {
    return [init, new StateObjectHelperBase<RIO<RRT>>(options)];
  },
  //### Read
  /**Unique key to check if an object contains an object read object */
  READ_KEY: STATE_OBJECT_READ_KEY,
  /**Returns true if object is an object read object */
  is_read(a: any): a is StateObjectRead<any> {
    return Boolean(
      a && (a as { [STATE_OBJECT_READ_KEY]: boolean })[STATE_OBJECT_READ_KEY],
    );
  },
  read,
  read_apply,
  read_set,
  //### Write
  WRITE_KEY: STATE_OBJECT_WRITE_KEY,
  is_write(
    a: any,
  ): a is { [STATE_OBJECT_WRITE_KEY]: StateObjectWriteTypes<any> } {
    return Boolean(
      a && (a as { [STATE_OBJECT_WRITE_KEY]: boolean })[STATE_OBJECT_WRITE_KEY],
    );
  },
  write,
  write_apply,
};
