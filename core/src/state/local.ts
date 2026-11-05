import { is_promise_like, sync_reject, sync_resolve } from "#common";
import {
  err,
  none,
  ok,
  type OptionNone,
  type ResultInferOk as RIOK,
  type ResultOk as RO,
} from "#result";
import { StateBase } from "./base";
import {
  ARRAY,
  STATE_ARRAY_READ_KEY as SARK,
  type StateArrayRead as SAR,
  type StateArrayReadTypes as SART,
} from "./helpers/array";
import {
  type StateNoHelper as NoHelper,
  type StateHelperBase as SHB,
} from "./helpers/helpers";
import {
  OBJECT,
  STATE_OBJECT_READ_KEY as SORK,
  type StateObjectRead as SOR,
  type StateObjectReadTypes as SORT,
} from "./helpers/object";
import type {
  StateHelper as Helper,
  HelperRelated as HELToREL,
  StateResult as SR,
  StateReadType as SRT,
  State,
  StateREA,
  StateREAW,
  StateRES,
  StateResult,
  StateRESW,
  StateROA,
  StateROAW,
  StateROS,
  StateROSW,
  StateWriteType as SWT,
} from "./types";

//##################################################################################################################################################
//      _________     _______  ______  _____
//     |__   __\ \   / /  __ \|  ____|/ ____|
//        | |   \ \_/ /| |__) | |__  | (___
//        | |    \   / |  ___/|  __|  \___ \
//        | |     | |  | |    | |____ ____) |
//        |_|     |_|  |_|    |______|_____/

type Setter<
  RRT extends StateResult<any>,
  HEL extends Helper<RRT, WT, any>,
  WT,
> = (
  value: WT,
  state: Owner<RRT, HEL, WT>,
  old?: RRT,
) => PromiseLike<StateResult<void>>;

export interface Owner<
  RRT extends StateResult<any>,
  HEL extends Helper<RRT, WT, any>,
  WT,
> {
  /**Changes state value */
  set(value: RRT | RO<SRT<RIOK<RRT>>>): void;
  /**Changes state value to a ResultOk value */
  set_ok(value: RIOK<RRT> | SRT<RIOK<RRT>>): void;
  /**Changes state setter function, if done on a none writable state, it will become writable */
  setter?: Setter<RRT, HEL, WT>;
  /**Returns state as a simple state type */
  readonly state: State<RIOK<RRT>, HELToREL<HEL>, WT>;
  /**Sets a function to be called when the state is initially subscribed to */
  set_onsub(func: () => void): void;
  /**Sets a function to be called when the state is terminally unsubscribed from */
  set_onunsub(func: () => void): void;
  /**Array operations when the state is an array type */
  readonly array: RRT extends SR<readonly any[]> ? LocalArrayOwner<RRT> : never;
  /**Object operations when the state is an object record type */
  readonly object: RRT extends SR<readonly any[]>
    ? never
    : RRT extends SR<Record<string, any>>
      ? LocalObjectOwner<RRT>
      : never;
}

export type StateLocalROS<
  RT,
  HEL extends Helper<RO<RT>, WT, any> = any,
  WT = unknown,
> = StateROS<RT, HELToREL<HEL>, WT> &
  Owner<RO<RT>, HEL, WT> & {
    readonly read_only: StateROS<RT, HELToREL<HEL>, WT>;
    readonly read_write?: StateROSW<RT, HELToREL<HEL>, WT>;
  };

export type StateLocalRES<
  RT,
  HEL extends Helper<RO<RT>, WT, any> = any,
  WT = unknown,
> = StateRES<RT, HELToREL<HEL>, WT> &
  Owner<StateResult<RT>, HEL, WT> & {
    set_err(error: string): void;
    readonly read_only: StateRES<RT, HELToREL<HEL>, WT>;
    readonly read_write?: StateRESW<RT, HELToREL<HEL>, WT>;
  };

export type StateLocalROA<
  RT,
  HEL extends Helper<RO<RT>, WT, any> = any,
  WT = unknown,
> = StateROA<RT, HELToREL<HEL>, WT> &
  Owner<RO<RT>, HEL, WT> & {
    readonly read_only: StateROA<RT, HELToREL<HEL>, WT>;
    readonly read_write?: StateROAW<RT, HELToREL<HEL>, WT>;
  };

export type StateLocalREA<
  RT,
  HEL extends Helper<RO<RT>, WT, any> = any,
  WT = unknown,
> = StateREA<RT, HELToREL<HEL>, WT> &
  Owner<StateResult<RT>, HEL, WT> & {
    set_err(error: string): void;
    readonly read_only: StateREA<RT, HELToREL<HEL>, WT>;
    readonly read_write?: StateREAW<RT, HELToREL<HEL>, WT>;
  };

export type StateLocalROSW<
  RT,
  HEL extends Helper<RO<RT>, WT, any> = any,
  WT = RT,
> = StateROSW<RT, HELToREL<HEL>, WT> &
  Owner<RO<RT>, HEL, WT> & {
    setter: Setter<RO<RT>, HEL, WT>;
    readonly read_only: StateROS<RT, HELToREL<HEL>, WT>;
    readonly read_write: StateROSW<RT, HELToREL<HEL>, WT>;
  };

export type StateLocalRESW<
  RT,
  HEL extends Helper<RO<RT>, WT, any> = any,
  WT = RT,
> = StateRESW<RT, HELToREL<HEL>, WT> &
  Owner<StateResult<RT>, HEL, WT> & {
    set_err(error: string): void;
    readonly read_only: StateROS<RT, HELToREL<HEL>, WT>;
    readonly read_write: StateROSW<RT, HELToREL<HEL>, WT>;
  };

export type StateLocalROAW<
  RT,
  HEL extends Helper<RO<RT>, WT, any> = any,
  WT = RT,
> = StateROAW<RT, HELToREL<HEL>, WT> &
  Owner<RO<RT>, HEL, WT> & {
    readonly read_only: StateROS<RT, HELToREL<HEL>, WT>;
    readonly read_write: StateROSW<RT, HELToREL<HEL>, WT>;
  };

export type StateLocalREAW<
  RT,
  HEL extends Helper<RO<RT>, WT, any> = any,
  WT = RT,
> = StateREAW<RT, HELToREL<HEL>, WT> &
  Owner<StateResult<RT>, HEL, WT> & {
    set_err(error: string): void;
    readonly read_only: StateROS<RT, HELToREL<HEL>, WT>;
    readonly read_write: StateROSW<RT, HELToREL<HEL>, WT>;
  };

//##################################################################################################################################################
//               _____  _____        __     __
//         /\   |  __ \|  __ \     /\\ \   / /
//        /  \  | |__) | |__) |   /  \\ \_/ /
//       / /\ \ |  _  /|  _  /   / /\ \\   /
//      / ____ \| | \ \| | \ \  / ____ \| |
//     /_/    \_\_|  \_\_|  \_\/_/    \_\_|

export class LocalArrayOwner<RT extends StateResult<SAR<any>>> {
  #local: RXXX<RT, any, any>;
  constructor(local: RXXX<RT, any, any>) {
    this.#local = local;
  }
  get get(): Readonly<RIOK<RT>> {
    return this.#local.get().unwrap_or([]) as RIOK<RT>;
  }
  /** Sorts the elements of an array in place and returns the LocalArrayOwner instance.
   * @param fn — Function used to determine the order of the elements. */
  sort(fn: (a: RIOK<RT>[number], b: RIOK<RT>[number]) => number): this {
    const arr = this.#local.get().unwrap_or<RIOK<RT>>([] as RIOK<RT>);
    (arr as any[]).sort(fn);
    arr[SARK] = [{ type: "fresh", items: arr }];
    this.#local.set(ok(arr) as RT);
    delete arr[SARK];
    return this;
  }
  /** Appends new elements to the end of an array, and returns the new length of the array.
   * @param items — New elements to add to the array.*/
  push(...items: RIOK<RT>): number {
    const arr = this.#local.get().unwrap_or<RIOK<RT>>([] as RIOK<RT>);
    if (items.length === 0) return arr.length;
    const index = arr.length;
    const new_len = (arr as any[]).push(...items);
    arr[SARK] = [{ type: "added", index, items }];
    this.#local.set(ok(arr) as RT);
    delete arr[SARK];
    return new_len;
  }
  /** Inserts new elements at the start of an array, and returns the new length of the array.
   * @param items — Elements to insert at the start of the array.*/
  unshift(...items: RIOK<RT>): number {
    const arr = this.#local.get().unwrap_or<RIOK<RT>>([] as RIOK<RT>);
    if (items.length === 0) return arr.length;
    const new_len = (arr as any[]).unshift(...items);
    arr[SARK] = [{ type: "added", index: 0, items }];
    this.#local.set(ok(arr) as RT);
    delete arr[SARK];
    return new_len;
  }
  /**Removes the last element from an array and returns it. If the array is empty, undefined is returned and the array is not modified. */
  pop(): RIOK<RT> | undefined {
    const r = this.#local.get();
    if (r.err) return undefined;
    const arr = r.value;
    const l = arr.length;
    const p = (arr as RIOK<RT>[number][]).pop();
    if (arr.length < l) {
      arr[SARK] = [{ type: "removed", index: arr.length, items: [p!] }];
      this.#local.set(ok(arr) as RT);
      delete arr[SARK];
    }
    return p;
  }
  /**Removes the first element from an array and returns it. If the array is empty, undefined is returned and the array is not modified. */
  shift(): RIOK<RT> | undefined {
    const r = this.#local.get();
    if (r.err) return undefined;
    const arr = r.value;
    const l = arr.length;
    const s = (arr as RIOK<RT>[number][]).shift();
    if (arr.length < l) {
      arr[SARK] = [{ type: "removed", index: 0, items: [s!] }];
      this.#local.set(ok(arr) as RT);
      delete arr[SARK];
    }
    return s;
  }
  /**Removes all elements that are equal to the given value from an array*/
  delete(val: RIOK<RT>[number]): this {
    const arr = this.#local.get().unwrap_or<RIOK<RT>>([] as RIOK<RT>);
    const operations = [] as SART<RIOK<RT>>[];
    for (let i = 0; i < arr.length; i++)
      if (arr[i] === val) {
        (arr as any[]).splice(i, 1);
        operations.push({ type: "removed", index: i, items: [val] });
        i--;
      }
    arr[SARK] = operations;
    this.#local.set(ok(arr) as RT);
    delete arr[SARK];
    return this;
  }
  /**Changes elements at the specified index in an array*/
  change(index: number, ...items: RIOK<RT>): this {
    if (items.length === 0) return this;
    const arr = this.#local.get().unwrap_or<RIOK<RT>>([] as RIOK<RT>);
    const old_length = arr.length;
    for (let i = 0; i < items.length; i++)
      (arr as RIOK<RT>[number][])[index + i] = (items as RIOK<RT>[number][])[i];
    const operations = [] as SART<RIOK<RT>>[];
    const changed_length = Math.max(
      0,
      Math.min(items.length, old_length - index),
    );
    if (changed_length > 0)
      operations.push({
        type: "changed",
        index,
        items: items.slice(0, changed_length),
      });
    if (changed_length < items.length)
      operations.push({
        type: "added",
        index: index + changed_length,
        items: items.slice(changed_length),
      });
    arr[SARK] = operations;
    this.#local.set(ok(arr) as RT);
    delete arr[SARK];
    return this;
  }
  /**Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.
   * @param start — The zero-based location in the array from which to start removing elements.
   * @param deleteCount — The number of elements to remove. If value of this argument is either a negative number, zero, undefined, or a type that cannot be converted to an integer, the function will evaluate the argument as zero and not remove any elements.
   * @param items — Elements to insert into the array in place of the deleted elements.
   * @returns — An array containing the elements that were deleted.*/
  splice(
    index: number,
    delete_count: number = 0,
    ...items: RIOK<RT>
  ): RIOK<RT> {
    const arr = this.#local.get().unwrap_or<RIOK<RT>>([] as RIOK<RT>);
    const removed = (arr as any[]).splice(index, delete_count, ...items);
    const operations = [] as SART<RIOK<RT>>[];
    if (removed.length > 0)
      operations.push({ type: "removed", index: index, items: removed });
    if (items.length > 0)
      operations.push({ type: "added", index: index, items });
    arr[SARK] = operations;
    this.#local.set(ok(arr) as RT);
    delete arr[SARK];
    return removed as RIOK<RT>;
  }
  /**Moves elements within the array from one position to another.
   * @param from_index — The zero-based index from which to start taking elements.
   * @param to_index — The zero-based index at which to insert the elements (after they have been removed).
   * @param count — The number of elements to move. Defaults to 1.
   * @returns — this, for chaining.*/
  move(from_index: number, to_index: number, count: number = 1): this {
    const arr = this.#local.get().unwrap_or<RIOK<RT>>([] as RIOK<RT>);
    if (count <= 0 || from_index < 0 || from_index >= arr.length) return this;
    const capped = Math.min(count, arr.length - from_index);
    const items = (arr as RIOK<RT>[number][]).splice(from_index, capped);
    (arr as RIOK<RT>[number][]).splice(to_index, 0, ...items);
    arr[SARK] = [{ type: "moved", from_index, to_index, items }];
    this.#local.set(ok(arr) as RT);
    delete arr[SARK];
    return this;
  }
}

//##################################################################################################################################################
//       ____  ____       _ ______ _____ _______
//      / __ \|  _ \     | |  ____/ ____|__   __|
//     | |  | | |_) |    | | |__ | |      | |
//     | |  | |  _ < _   | |  __|| |      | |
//     | |__| | |_) | |__| | |___| |____  | |
//      \____/|____/ \____/|______\\_____||_|

type WithObjReadKey<T> = { [SORK]?: SORT<T>[] };

export class LocalObjectOwner<RT extends StateResult<Record<string, any>>> {
  #local: RXXX<RT, any, any>;
  constructor(local: RXXX<RT, any, any>) {
    this.#local = local;
  }
  get get(): Readonly<RIOK<RT>> {
    return this.#local.get().unwrap_or({}) as RIOK<RT>;
  }
  /**Adds a key-value pair to the object
   * @param key — The key to add.
   * @param value — The value to add.*/
  add(key: string, value: RIOK<RT>[string]): this {
    const obj = this.#local.get().unwrap_or<RIOK<RT>>({} as RIOK<RT>);
    const items = { [key]: value } as Record<string, RIOK<RT>[string]>;
    (obj as Record<string, any>)[key] = value;
    (obj as RIOK<RT> & WithObjReadKey<RIOK<RT>[string]>)[SORK] = [
      { type: "added", items },
    ];
    this.#local.set(ok(obj) as RT);
    delete (obj as RIOK<RT> & WithObjReadKey<RIOK<RT>[string]>)[SORK];
    return this;
  }
  /**Removes a key-value pair from the object
   * @param key — The key to remove.*/
  remove(key: string): this {
    const obj = this.#local.get().unwrap_or<RIOK<RT>>({} as RIOK<RT>);
    if (!(key in (obj as Record<string, any>))) return this;
    const removed: Record<string, RIOK<RT>[string]> = {
      [key]: (obj as Record<string, RIOK<RT>[string]>)[key]!,
    };
    delete (obj as Record<string, RIOK<RT>[string]>)[key];
    (obj as RIOK<RT> & WithObjReadKey<RIOK<RT>[string]>)[SORK] = [
      { type: "removed", items: removed },
    ];
    this.#local.set(ok(obj) as RT);
    delete (obj as RIOK<RT> & WithObjReadKey<RIOK<RT>[string]>)[SORK];
    return this;
  }
  /**Changes the value for a key in the object
   * @param key — The key to change.
   * @param value — The new value.*/
  change(key: string, value: RIOK<RT>[string]): this {
    const obj = this.#local.get().unwrap_or<RIOK<RT>>({} as RIOK<RT>);
    const items = { [key]: value } as Record<string, RIOK<RT>[string]>;
    (obj as Record<string, any>)[key] = value;
    (obj as RIOK<RT> & WithObjReadKey<RIOK<RT>[string]>)[SORK] = [
      { type: "changed", items },
    ];
    this.#local.set(ok(obj) as RT);
    delete (obj as RIOK<RT> & WithObjReadKey<RIOK<RT>[string]>)[SORK];
    return this;
  }
}

//##################################################################################################################################################
//       _____ _                _____ _____
//      / ____| |        /\    / ____/ ____|
//     | |    | |       /  \  | (___| (___
//     | |    | |      / /\ \  \___ \\___ \
//     | |____| |____ / ____ \ ____) |___) |
//      \_____|______/_/    \_\_____/_____/

class RXXX<
  RRT extends StateResult<any>,
  HEL extends Helper<RRT, WT, OptionNone>,
  WT,
>
  extends StateBase<RRT, WT, HELToREL<HEL>>
  implements Owner<RRT, HEL, WT>
{
  constructor(
    init:
      | [0, boolean, RRT]
      | [1, boolean, () => RRT]
      | [2, boolean, (() => PromiseLike<RRT>) | undefined],
    helper?: HEL,
    setter?: Setter<RRT, HEL, WT> | true,
  ) {
    super();
    if (helper) this.#helper = helper as unknown as SHB<any, any, any>;
    this.#rok = init[1];
    if (setter !== true) this.#setter = setter;
    if (init[0] === 0) {
      if (setter === true) this.#setter = this.#make_setter(init[2]);
      this.set(init[2]);
    } else if (init[0] === 1) {
      if (setter === true) this.#setter = this.#make_setter(undefined);
      const f = init[2];
      this.get = () => this.#clean() ?? (this.#value = f());
      this.set = (value) => this.set(this.#clean() ?? value);
      const write = this.write.bind(this);
      this.write = (value) =>
        write(value).then((val) => val.map((valu) => this.#clean() ?? valu));
    } else if (init[0] === 2) {
      if (setter === true) this.#setter = this.#make_setter(undefined);
      const f = init[2];
      //Temporary override until first access
      let initializing = false;
      this.then = <TResult1 = RRT>(
        func: (value: RRT) => TResult1 | PromiseLike<TResult1>,
      ): Promise<TResult1> => {
        if (f)
          if (!initializing) {
            initializing = true;
            (async () => {
              try {
                const value = await f();
                this.ful_r_prom((this.#value = value));
                this.#helper?.on_change(value);
              } catch (e) {
                console.error(
                  "Failed to initialize delayed RO state: ",
                  e,
                  this,
                );
              }
              this.#clean();
            })();
          }
        return this.append_r_prom(func);
      };
      this.set = (value) => {
        this.#clean();
        this.set(this.ful_r_prom(value as RRT));
      };
      const write = this.write.bind(this);
      this.write = async (value) =>
        (await write(value)).map((val) => this.#clean() ?? val);
    }
  }

  #clean(): void {
    (["then", "get", "set", "write"] as const).forEach((k) => delete this[k]);
  }

  #helper?: SHB<any, any, any>;

  #value?: RRT;
  #setter?: Setter<RRT, HEL, WT>;

  #make_setter(type?: StateResult<any>): Setter<RRT, HEL, WT> {
    if (type === undefined || type.err) {
      return (value, state, old) => {
        if (old && !old.err && value === old.value)
          return sync_resolve(ok(undefined));
        if (this.#helper) {
          return this.#helper.limit(value).then((e) => {
            if (e.err) return err(e.error);
            if (ARRAY.is_write(e.value))
              ARRAY.read_set(
                ARRAY.write_apply(e.value, old?.unwrap_or(undefined) as never),
                state.set_ok.bind(state) as (value: any[] | SAR<any>) => void,
              );
            else if (OBJECT.is_write(e.value))
              OBJECT.read_set(
                OBJECT.write_apply(e.value, old?.unwrap_or(undefined) as never),
                state.set_ok.bind(state) as (
                  value: Record<PropertyKey, any> | SOR<any>,
                ) => void,
              );
            else state.set_ok(e.value as RIOK<RRT>);
            return ok(undefined);
          });
        }
        if (ARRAY.is_write(value))
          ARRAY.read_set(
            ARRAY.write_apply(value, old?.unwrap_or(undefined) as never),
            state.set_ok.bind(state) as (value: any[] | SAR<any>) => void,
          );
        else if (OBJECT.is_write(value))
          OBJECT.read_set(
            OBJECT.write_apply(value, old?.unwrap_or(undefined) as never),
            state.set_ok.bind(state) as (
              value: Record<PropertyKey, any> | SOR<any>,
            ) => void,
          );
        else state.set_ok(value as RIOK<RRT>);
        return sync_resolve(ok(undefined));
      };
    } else if (typeof type.value !== "object") {
      return (value, state, old) => {
        if (old && !old.err && value === old.value)
          return sync_resolve(ok(undefined));
        if ((state as this).#helper)
          return (state as this).#helper!.limit(value).then((e) => {
            if (e.err) return err(e.error);
            return ok(state.set_ok(e.value as RIOK<RRT>));
          });
        return sync_resolve(ok(state.set_ok(value as RIOK<RRT>)));
      };
    } else if (Array.isArray(type.value)) {
      return (value, state, old) => {
        if (old && !old.err && value === old.value)
          return sync_resolve(ok(undefined));
        if (this.#helper) {
          return this.#helper.limit(value).then((e) => {
            if (e.err) return err(e.error);
            if (ARRAY.is_write(e.value))
              ARRAY.read_set(
                ARRAY.write_apply(e.value, old?.unwrap_or([]) as never),
                state.set_ok.bind(state) as (value: any[] | SAR<any>) => void,
              );
            else state.set_ok(e.value as RIOK<RRT>);
            return ok(undefined);
          });
        }
        if (ARRAY.is_write(value))
          ARRAY.read_set(
            ARRAY.write_apply(value, old?.unwrap_or([]) as never),
            state.set_ok.bind(state) as (value: any[] | SAR<any>) => void,
          );
        else state.set_ok(value as RIOK<RRT>);
        return sync_resolve(ok(undefined));
      };
    } else {
      return (value, state, old) => {
        if (old && !old.err && value === old.value)
          return sync_resolve(ok(undefined));
        if (this.#helper) {
          return this.#helper.limit(value).then((e) => {
            if (e.err) return err(e.error);
            if (OBJECT.is_write(e.value))
              OBJECT.read_set(
                OBJECT.write_apply(e.value, old?.unwrap_or({}) as never),
                state.set_ok.bind(state) as (
                  value: Record<PropertyKey, any> | SOR<any>,
                ) => void,
              );
            else state.set_ok(e.value as RIOK<RRT>);
            return ok(undefined);
          });
        }
        if (OBJECT.is_write(value))
          OBJECT.read_set(
            OBJECT.write_apply(value, old?.unwrap_or({}) as never),
            state.set_ok.bind(state) as (
              value: Record<PropertyKey, any> | SOR<any>,
            ) => void,
          );
        else state.set_ok(value as RIOK<RRT>);
        return sync_resolve(ok(undefined));
      };
    }
  }

  //#Owner Context
  set(value: RRT | RO<SRT<RIOK<RRT>>>) {
    this.#helper?.on_change(value);
    this.update_subs((this.#value = value as RRT));
  }
  set_ok(value: RIOK<RRT> | SRT<RIOK<RRT>>): void {
    this.set(ok(value) as RRT);
  }
  set_err(error: string): void {
    this.set(err(error) as RRT);
  }
  set setter(setter: Setter<RRT, HEL, WT> | undefined) {
    this.#setter = setter;
  }
  get setter(): Setter<RRT, HEL, WT> | undefined {
    return this.#setter;
  }
  get state() {
    return this as State<RIOK<RRT>, HELToREL<HEL>, WT>;
  }
  get read_only() {
    return this as State<RIOK<RRT>, HELToREL<HEL>, WT>;
  }
  get read_write() {
    return this.#setter
      ? (this as State<RIOK<RRT>, HELToREL<HEL>, WT>)
      : undefined;
  }
  set_onsub(func: () => void): void {
    this.on_sub = func;
  }
  set_onunsub(func: () => void): void {
    this.on_unsub = func;
  }
  #array?: LocalArrayOwner<RRT>;
  get array(): RRT extends SR<readonly any[]> ? LocalArrayOwner<RRT> : never {
    return (this.#array ??= new LocalArrayOwner(this)) as RRT extends SR<
      readonly any[]
    >
      ? LocalArrayOwner<RRT>
      : never;
  }
  #object?: LocalObjectOwner<RRT>;
  get object(): RRT extends SR<readonly any[]>
    ? never
    : RRT extends SR<Record<string, any>>
      ? LocalObjectOwner<RRT>
      : never {
    return (this.#object ??= new LocalObjectOwner(this)) as RRT extends SR<
      readonly any[]
    >
      ? never
      : RRT extends SR<Record<string, any>>
        ? LocalObjectOwner<RRT>
        : never;
  }

  //#Reader Context
  #rok: boolean;
  get rok(): boolean {
    return this.#rok;
  }
  get rsync(): boolean {
    return Boolean(this.#value);
  }
  then<TResult1 = RRT, TResult2 = never>(
    on_fulfilled?: ((value: RRT) => TResult1 | PromiseLike<TResult1>) | null,
    on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      const result = on_fulfilled ? on_fulfilled(this.get()) : this.get();
      if (is_promise_like(result)) return result;
      return sync_resolve(result as TResult1);
    } catch (error) {
      if (on_rejected) {
        const rejected_result = on_rejected(error);
        if (is_promise_like(rejected_result)) return rejected_result;
        return sync_resolve(rejected_result);
      }
      return sync_reject(error as any);
    }
  }
  get(): RRT {
    return this.#value!;
  }
  ok(): RIOK<RRT> {
    return (this.get() as RO<RIOK<RRT>>).value;
  }
  related(): HELToREL<HEL> {
    return (this.#helper?.related() ?? none()) as HELToREL<HEL>;
  }

  //#Writer Context
  get writable(): boolean {
    return this.#setter !== undefined;
  }
  write(value: WT): PromiseLike<StateResult<void>> {
    if (this.#setter) {
      const res = this.#setter(value, this, this.#value);
      return sync_resolve(res);
    }
    return sync_resolve(err("not writable"));
  }
  limit(value: WT): PromiseLike<StateResult<WT>> {
    return this.#helper?.limit(value) ?? sync_resolve(ok(value));
  }
  check(value: WT): PromiseLike<StateResult<WT>> {
    return this.#helper?.check(value) ?? sync_resolve(ok(value));
  }
}

//##################################################################################################################################################
//       _______     ___   _  _____
//      / ____\ \   / / \ | |/ ____|
//     | (___  \ \_/ /|  \| | |
//      \___ \  \   / | . ` | |
//      ____) |  | |  | |\  | |____
//     |_____/   |_|  |_| \_|\_____|

/**Creates a sync ok state from an initial result.
 * @param init initial result for state or helper.*/
export function ros<
  RT,
  HEL extends Helper<RO<RT>, SWT<WT>, any> = NoHelper,
  WT = unknown,
>(init: (RO<RT> | (() => RO<RT>)) | [RO<RT> | (() => RO<RT>), HEL]) {
  const [i, h] = Array.isArray(init) ? [init[0], init[1]] : [init, undefined];
  return new RXXX<RO<RT>, HEL, SWT<WT>>(
    typeof i === "function" ? [1, true, i] : [0, true, i],
    h,
  ) as StateLocalROS<RT, HEL, SWT<WT>>;
}

/**Creates a sync ok state from an initial result.
 * @param init initial result for state or helper.*/
export function rosw<
  RT,
  WT = RT,
  HEL extends Helper<RO<RT>, SWT<WT>, any> = NoHelper,
>(
  init: (RO<RT> | (() => RO<RT>)) | [RO<RT> | (() => RO<RT>), HEL],
  setter: Setter<RO<RT>, HEL, SWT<WT>> | true = true,
) {
  const [i, h] = Array.isArray(init) ? [init[0], init[1]] : [init, undefined];
  return new RXXX<RO<RT>, HEL, SWT<WT>>(
    typeof i === "function" ? [1, true, i] : [0, true, i],
    h,
    setter,
  ) as StateLocalROSW<RT, HEL, SWT<WT>>;
}

/**Creates a sync state from an initial result.
 * @param init initial result for state.
 * @param helper functions to check and limit the value, and to return related states.*/
export function res<
  RT,
  HEL extends Helper<SR<RT>, SWT<WT>, any> = NoHelper,
  WT = unknown,
>(init: (SR<RT> | (() => SR<RT>)) | [SR<RT> | (() => SR<RT>), HEL]) {
  const [i, h] = Array.isArray(init) ? [init[0], init[1]] : [init, undefined];
  return new RXXX<SR<RT>, HEL, SWT<WT>>(
    typeof i === "function" ? [1, false, i] : [0, false, i],
    h,
  ) as StateLocalRES<RT, HEL, SWT<WT>>;
}

/**Creates a writable sync state from an initial result.
 * @param init initial result for state.
 * @param helper functions to check and limit the value, and to return related states.*/
export function resw<
  RT,
  WT = RT,
  HEL extends Helper<SR<RT>, SWT<WT>, any> = NoHelper,
>(
  init: (SR<RT> | (() => SR<RT>)) | [SR<RT> | (() => SR<RT>), HEL],
  setter: Setter<SR<RT>, HEL, SWT<WT>> | true = true,
) {
  const [i, h] = Array.isArray(init) ? [init[0], init[1]] : [init, undefined];
  return new RXXX<SR<RT>, HEL, SWT<WT>>(
    typeof i === "function" ? [1, false, i] : [0, false, i],
    h,
    setter,
  ) as StateLocalRESW<RT, HEL, SWT<WT>>;
}

/**Creates a sync ok state from an initial result.
 * @param init initial result for state or helper.*/
export function roa<
  RT,
  HEL extends Helper<SR<RT>, SWT<WT>, any> = NoHelper,
  WT = unknown,
>(init?: (() => Promise<SR<RT>>) | [() => Promise<SR<RT>>, HEL]) {
  const [i, h] = Array.isArray(init) ? [init[0], init[1]] : [init, undefined];
  return new RXXX<SR<RT>, HEL, SWT<WT>>([2, true, i], h) as StateLocalROA<
    RT,
    HEL,
    SWT<WT>
  >;
}

/**Creates a sync ok state from an initial result.
 * @param init initial result for state or helper.*/
export function roaw<
  RT,
  WT = RT,
  HEL extends Helper<SR<RT>, SWT<WT>, any> = NoHelper,
>(
  init?: (() => Promise<SR<RT>>) | [() => Promise<SR<RT>>, HEL],
  setter: Setter<SR<RT>, HEL, SWT<WT>> | true = true,
) {
  const [i, h] = Array.isArray(init) ? [init[0], init[1]] : [init, undefined];
  return new RXXX<SR<RT>, HEL, SWT<WT>>(
    [2, true, i],
    h,
    setter,
  ) as StateLocalROAW<RT, HEL, SWT<WT>>;
}

/**Creates a sync state from an initial result.
 * @param init initial result for state.
 * @param helper functions to check and limit the value, and to return related states.*/
export function rea<
  RT,
  HEL extends Helper<SR<RT>, SWT<WT>, any> = NoHelper,
  WT = unknown,
>(init?: (() => Promise<SR<RT>>) | [() => Promise<SR<RT>>, HEL]) {
  const [i, h] = Array.isArray(init) ? [init[0], init[1]] : [init, undefined];
  return new RXXX<SR<RT>, HEL, SWT<WT>>([2, false, i], h) as StateLocalREA<
    RT,
    HEL,
    SWT<WT>
  >;
}

/**Creates a writable sync state from an initial result.
 * @param init initial result for state.
 * @param helper functions to check and limit the value, and to return related states.*/
export function reaw<
  RT,
  WT = RT,
  HEL extends Helper<SR<RT>, SWT<WT>, any> = NoHelper,
>(
  init?: (() => Promise<SR<RT>>) | [() => Promise<SR<RT>>, HEL],
  setter: Setter<SR<RT>, HEL, SWT<WT>> | true = true,
) {
  const [i, h] = Array.isArray(init) ? [init[0], init[1]] : [init, undefined];
  return new RXXX<SR<RT>, HEL, SWT<WT>>(
    [2, false, i],
    h,
    setter,
  ) as StateLocalREAW<RT, HEL, SWT<WT>>;
}
