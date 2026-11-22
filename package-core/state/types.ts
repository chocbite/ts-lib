import {
  ResultInferOk,
  type NiceError,
  type Option,
  type ResultNice,
  type ResultOk,
} from "#result";
import type {
  StateArrayRead,
  StateArrayWrite,
  StateArrayWriteInstruction,
} from "./helpers/array";
import type { StateObjectRead, StateObjectWrite } from "./helpers/object";
import type {
  StateProxyREA,
  StateProxyREAW,
  StateProxyRES,
  StateProxyRESW,
  StateProxyROA,
  StateProxyROAW,
  StateProxyROS,
  StateProxyROSW,
  StateProxyROSWS,
  StateProxyRESWS,
  StateProxyWrite,
  StateProxyWriteSync,
} from "./proxy";

export const STATE_VIEWER_OVERRIDE_KEY = Symbol("STATE_VIEWER_OVERRIDE_KEY");

export type StateResult<T> = ResultNice<T>;

/**Automatically maps array types to StateArrayRead and object record types to StateObjectRead when reading state values.
 * For primitive types and non-record objects, returns the type unchanged.*/
export type StateReadType<RT> = 0 extends 1 & RT
  ? RT
  : RT extends readonly (infer E)[]
    ? number extends RT["length"]
      ? StateArrayRead<E>
      : RT
    : string extends keyof RT
      ? StateObjectRead<RT[string & keyof RT]>
      : RT;

/**Automatically maps array types to StateArrayWrite and object record types to StateObjectWrite when writing state values.
 * For primitive types and non-record objects, returns the type unchanged.*/
export type StateWriteType<RT> = 0 extends 1 & RT
  ? RT
  : RT extends readonly (infer E)[]
    ? number extends RT["length"]
      ? StateArrayWrite<E>
      : RT | StateArrayWriteInstruction<E>
    : string extends keyof RT
      ? StateObjectWrite<RT[string & keyof RT]>
      : RT;

/**The result a state gives its subscribers, read from its read, so sub and unsub are the same in every kind of state
 * and can be called on the union types like StateREA, which gives the result of all its kinds*/
export type SubValue<S> = S extends { read(): PromiseLike<infer R extends StateResult<any>> }
  ? R
  : never;

/**Function used to subscribe to state changes
 * @template RT - The type of the state’s value when read.*/
export type StateSub<RRT extends StateResult<any>> = (value: RRT) => void;

export type StateInferResult<S extends State<any>> =
  S extends StateROA<infer RT>
    ? ResultOk<RT>
    : S extends StateREA<infer RT>
      ? StateResult<RT>
      : never;

export type StateInferType<S extends State<any>> =
  S extends State<infer RT> ? RT : never;

export type StateInferSub<S extends State<any>> = StateSub<StateInferResult<S>>;

export interface StateRelated {}

/**Map of values or states related to a state */
export interface StateHelper<RRT, WT, REL extends StateRelated> {
  /**Returns data related to the state */
  related(): REL;
  /**Limits given value to valid range if possible or error reason if not possible */
  limit(value: WT): PromiseLike<StateResult<WT>>;
  /**Checks if the value is valid and returns reason for invalidity */
  check(value: WT): PromiseLike<StateResult<WT>>;
  /**Called with every new value of the state, an empty function when not needed*/
  on_change(value: RRT): void;
}

/**A helper that can also check and limit synchronously, which the helper of a state with sync writes must be.
 * The number, string and enum helpers are when every state in their options is a sync state*/
export interface StateHelperSync<RRT, WT, REL extends StateRelated>
  extends StateHelper<RRT, WT, REL> {
  /**Limits given value to valid range if possible or error reason if not possible */
  limit_sync(value: WT): StateResult<WT>;
  /**Checks if the value is valid and returns reason for invalidity */
  check_sync(value: WT): StateResult<WT>;
}

export type HelperRelated<HEL extends StateHelper<any, any, any>> = ReturnType<
  HEL["related"]
>;

//###########################################################################################################################################################
//###########################################################################################################################################################
//      _____  ______          _____  ______ _____     _____ ____  _   _ _______ ________   _________
//     |  __ \|  ____|   /\   |  __ \|  ____|  __ \   / ____/ __ \| \ | |__   __|  ____\ \ / /__   __|
//     | |__) | |__     /  \  | |  | | |__  | |__) | | |   | |  | |  \| |  | |  | |__   \ V /   | |
//     |  _  /|  __|   / /\ \ | |  | |  __| |  _  /  | |   | |  | | . ` |  | |  |  __|   > <    | |
//     | | \ \| |____ / ____ \| |__| | |____| | \ \  | |___| |__| | |\  |  | |  | |____ / . \   | |
//     |_|  \_\______/_/    \_\_____/|______|_|  \_\  \_____\____/|_| \_|  |_|  |______/_/ \_\  |_|

export const STATE_KEY = Symbol("state");

/**true for types JSON can represent, states holding such types included, false otherwise*/
type StateJsonPart<T> = 0 extends 1 & T
  ? true
  : T extends string | number | boolean | null
    ? true
    : T extends StateBase<infer R, any, any>
      ? StateJsonPart<ResultInferOk<R>>
      : T extends (...args: any[]) => any
        ? false
        : T extends { toJSON(): any }
          ? true
          : T extends readonly (infer E)[]
            ? StateJsonPart<E>
            : T extends object
              ? //Optional fields are allowed, undefined values are left out of the JSON
                StateJsonPart<Exclude<T[Exclude<keyof T, symbol>], undefined>>
              : false;

/**true when a value of type T can be stored as JSON, states holding such values included*/
export type StateJsonCompatible<T> =
  false extends StateJsonPart<T> ? false : true;

export interface StateBase<
  RRT extends StateResult<any>,
  REL extends Option<StateRelated>,
  WT,
> {
  [STATE_KEY]: true;

  //#Reader Context
  /**Gives the current value of the state, the thenable resolves once the state has a value.
   * On a sync state the then of the thenable calls its function at once, without waiting for a microtask.
   * The state itself is not a thenable, so promises can resolve to it*/
  read(): PromiseLike<RRT>;
  /**Returns the value as JSON, use StateJsonCompatible to require a value type JSON can represent.
   * States in error, NaN and Infinity are written as null and logged with console.error*/
  to_json(): PromiseLike<string>;

  /**Is state guarenteed sync*/
  readonly rsync: boolean;
  /**Gets the current value of the state if state is sync*/
  get?(): RRT;

  /**Is state guarenteed OK*/
  readonly rok: boolean;
  /**Gets the value of the state without result, only works when state is OK */
  ok?(): ResultInferOk<RRT>;

  /**This adds a function as a subscriber to changes to the state
   * @param update set true to update subscriber immediatly*/
  sub<S, F extends StateSub<SubValue<S>>>(this: S, func: F, update?: boolean): NoInfer<F>;
  /**This removes a function as a subscriber to the state*/
  unsub<S, F extends StateSub<SubValue<S>>>(this: S, func: F): NoInfer<F>;

  /**This returns related states if any*/
  related(): REL;

  /**Returns if the state is being used */
  in_use(): this | undefined;
  /**Returns if the state has a subscriber */
  has(subscriber: StateSub<RRT>): this | undefined;
  /**Returns the amount of subscribers the state has */
  amount(): number;

  //#Writer Context
  /**Is state guarenteed writable*/
  readonly writable: boolean;
  /**State that decides if writing is allowed right now, undefined when writing is not gated.
   * writable says if the state can be written at all, this can disable writing temporarily,
   * write and check give a not writable error while it is not true*/
  readonly write_enabled?: State<boolean>;
  /** This attempts a write to the state, write is not guaranteed to succeed
   * @returns promise of result with error for the write*/
  write?(value: WT): PromiseLike<StateResult<void>>;
  /**Limits given value to valid range if possible returns None if not possible */
  limit?(value: WT): PromiseLike<StateResult<WT>>;
  /**Checks if the value is valid and returns reason for invalidity */
  check?(value: WT): PromiseLike<StateResult<WT>>;

  /**Is state guarenteed to write synchronously, its write gate is then a sync state*/
  readonly wsync: boolean;
  /**Writes to the state synchronously, only when wsync is true, the value is set when it gives ok.
   * Like write it is not guaranteed to succeed*/
  write_sync?(value: WT): StateResult<void>;
  /**Limits given value to valid range synchronously, only when wsync is true*/
  limit_sync?(value: WT): StateResult<WT>;
  /**Checks if the value is valid synchronously, only when wsync is true*/
  check_sync?(value: WT): StateResult<WT>;
}

/**The kind of a state type, the most specific of the ten it fits.
 * Wrapped in [] so a union like StateREA is one kind, not one per member*/
type KindOf<S> = [S] extends [StateROSWS<any, any, any>]
  ? "ROSWS"
  : [S] extends [StateRESWS<any, any, any>]
    ? "RESWS"
    : [S] extends [StateROSW<any, any, any>]
  ? "ROSW"
  : [S] extends [StateRESW<any, any, any>]
    ? "RESW"
    : [S] extends [StateROAW<any, any, any>]
      ? "ROAW"
      : [S] extends [StateREAW<any, any, any>]
        ? "REAW"
        : [S] extends [StateROS<any, any, any>]
          ? "ROS"
          : [S] extends [StateRES<any, any, any>]
            ? "RES"
            : [S] extends [StateROA<any, any, any>]
              ? "ROA"
              : "REA";
type ReadKind<K> = K extends "ROSWS" | "ROSW" | "ROS"
  ? "ROS"
  : K extends "RESWS" | "RESW" | "RES"
    ? "RES"
    : K extends "ROAW" | "ROA"
      ? "ROA"
      : "REA";
type IsSync<K> = K extends "ROS" | "ROSW" | "ROSWS" | "RES" | "RESW" | "RESWS"
  ? true
  : false;
type IsOk<K> = K extends "ROS" | "ROSW" | "ROSWS" | "ROA" | "ROAW" ? true : false;
/**Writes synchronously*/
type IsWS<K> = K extends "ROSWS" | "RESWS" ? true : false;
/**The kind without sync writes, of a proxy with an async write form*/
type DropWS<K> = K extends "ROSWS" ? "ROSW" : K extends "RESWS" ? "RESW" : K;
/**The result a state of a kind gives*/
type ResultOf<K, RT> = IsOk<K> extends true ? ResultOk<RT> : StateResult<RT>;
type IsWritable<K> = K extends "ROSWS" | "RESWS" | "ROSW" | "RESW" | "ROAW" | "REAW"
  ? true
  : false;
/**A state a proxy can follow, what set_state of a proxy takes, narrowed to the kind of the proxy by SourceOf.
 * Made of StateBase, which has no proxy methods, the state types would make TypeScript recurse,
 * as their proxy methods give owners which take them again*/
export interface StateProxySource<RRT extends StateResult<any>, WT>
  extends StateBase<RRT, any, WT> {}
/**A state of the kind a proxy of a kind follows*/
type SourceOf<K, RT, WT> = StateProxySource<ResultOf<K, RT>, WT> &
  (IsSync<K> extends true ? { readonly rsync: true; get(): ResultOf<K, RT> } : unknown) &
  (IsOk<K> extends true ? { readonly rok: true } : unknown) &
  (IsWritable<K> extends true
    ? { readonly writable: true; write(value: WT): PromiseLike<StateResult<void>> }
    : unknown) &
  (IsWS<K> extends true
    ? { readonly wsync: true; write_sync(value: WT): StateResult<void> }
    : unknown);
/**The proxy of a kind with its owner, see the StateProxy types*/
type ProxyOwner<K, SRC, RT, WT, T, W> = K extends "ROSWS"
  ? StateProxyROSWS<SRC, RT, WT, T, W>
  : K extends "RESWS"
    ? StateProxyRESWS<SRC, RT, WT, T, W>
    : K extends "ROSW"
  ? StateProxyROSW<SRC, RT, WT, T, W>
  : K extends "RESW"
    ? StateProxyRESW<SRC, RT, WT, T, W>
    : K extends "ROAW"
      ? StateProxyROAW<SRC, RT, WT, T, W>
      : K extends "REAW"
        ? StateProxyREAW<SRC, RT, WT, T, W>
        : K extends "ROS"
          ? StateProxyROS<SRC, RT, WT, T, W>
          : K extends "RES"
            ? StateProxyRES<SRC, RT, WT, T, W>
            : K extends "ROA"
              ? StateProxyROA<SRC, RT, WT, T, W>
              : StateProxyREA<SRC, RT, WT, T, W>;
/**Read only proxies follow the read kind of the state, ROSW is followed as ROS*/
type ReadProxy<S, K, RT, WT, T> = ProxyOwner<K, SourceOf<ReadKind<KindOf<S>>, RT, WT>, RT, WT, T, WT>;
/**A writable proxy of kind K, following states of kind SK*/
type WriteProxy<SK, K, RT, WT, T, W> = ProxyOwner<K, SourceOf<SK, RT, WT>, RT, WT, T, W>;
/**The kind of a writable proxy from the kind of the state, see the proxy methods.
 * sync and ok decide the kind, else it is the kind of the state, it writes synchronously when the state does*/
type WriteKind<K, OK> = IsSync<K> extends true
  ? IsWS<K> extends true
    ? OK extends true
      ? "ROSWS"
      : OK extends false
        ? "RESWS"
        : K
    : OK extends true
      ? "ROSW"
      : OK extends false
        ? "RESW"
        : K
  : OK extends true
    ? "ROAW"
    : OK extends false
      ? "REAW"
      : K;

/**What nested can get from its select, a state, the rest are plain values*/
type StateLike = StateBase<any, any, any>;
type NestedStates<R> = Extract<Exclude<R, undefined>, StateLike>;
type NestedPlain<R> = Exclude<Exclude<R, undefined>, StateLike>;
/**The value of a state, distributed over a union of states*/
type ValueOfState<X> = X extends { read(): PromiseLike<infer RR extends StateResult<any>> }
  ? ResultInferOk<RR>
  : never;
/**The write type of a state, distributed over a union of states*/
type WriteOfState<X> = X extends { write(value: infer W): any } ? W : never;
/**The kind of state nested gives, from the kind of the state it is called on and what its select can give.
 * Sync when the state and every inner state are, plain values are sync and ok.
 * Ok when the state and every inner state are, and no inner state can be missing.
 * Writable when every inner value is a writable state*/
type NestedKind<K, R> = [
  IsSync<K> extends true
    ? [NestedStates<R>] extends [StateRES<any, any, any>]
      ? true
      : false
    : false,
  IsOk<K> extends true
    ? undefined extends R
      ? false
      : [NestedStates<R>] extends [StateROA<any, any, any>]
        ? true
        : false
    : false,
  undefined extends R
    ? false
    : [NestedPlain<R>] extends [never]
      ? [NestedStates<R>] extends [never]
        ? false
        : [NestedStates<R>] extends [StateREAW<any, any, any>]
          ? true
          : false
      : false,
  //Sync writes need the inner state at once, so the state must be sync
  IsSync<K> extends true
    ? undefined extends R
      ? false
      : [NestedPlain<R>] extends [never]
        ? [NestedStates<R>] extends [never]
          ? false
          : [NestedStates<R>] extends [StateRESWS<any, any, any>]
            ? true
            : false
        : false
    : false,
];
/**The state type of a kind given as [sync, ok, writable, sync writes]*/
type StateOfFlags<F, T, W> = F extends [true, true, true, true]
  ? StateROSWS<T, Option<{}>, W>
  : F extends [true, false, true, true]
    ? StateRESWS<T, Option<{}>, W>
    : F extends [true, true, true, boolean]
      ? StateROSW<T, Option<{}>, W>
      : F extends [true, false, true, boolean]
        ? StateRESW<T, Option<{}>, W>
        : F extends [false, true, true, boolean]
          ? StateROAW<T, Option<{}>, W>
          : F extends [false, false, true, boolean]
            ? StateREAW<T, Option<{}>, W>
            : F extends [true, true, false, boolean]
              ? StateROS<T>
              : F extends [true, false, false, boolean]
                ? StateRES<T>
                : F extends [false, true, false, boolean]
                  ? StateROA<T>
                  : StateREA<T>;
/**The state nested gives*/
type Nested<S, R> = StateOfFlags<
  NestedKind<KindOf<S>, R>,
  ValueOfState<NestedStates<R>> | NestedPlain<R>,
  WriteOfState<NestedStates<R>>
>;

/**The proxy methods of every state, they give the proxy with its owner, so it can be pointed at another state or get another transform.
 * The same in all eight kinds, so they can be called on the union types like StateREA, this is the declared type of the state,
 * and decides the kind of the proxy and what set_state takes.
 * proxy: transform gets the result and gives a result, the proxy can fail, it is sync when the state is.
 * proxy_map: map gets the plain value, an error of the state is passed on as it is, the proxy is of the same kind as the state.
 * proxy_ok: transform gets the result and gives an ok result, handling the error of a state that can fail, the proxy is ok*/
interface ProxyMethods<RT, WT> {
  /**A state of the state in the value of this state, select picks it from the value, like (person) => person.name.
   * Follows the inner state, and moves to the new one when the value of this state changes.
   * select can give a plain value, which is given as it is, or a state or plain value.
   * When select can give undefined, error is given for it, and is needed.
   * An error of this state or the inner state is passed on as it is, writes go to the inner state.
   * The kind follows from this state and every inner state select can give*/
  nested<S, R extends {} | null>(this: S, select: (value: RT) => R): Nested<S, R>;
  /**The same as nested, for a select that can give undefined, error is given for it.
   * Two overloads of fixed length, with a rest parameter TypeScript fixes R before it looks at select*/
  nested<S, R>(
    this: S,
    select: (value: RT) => R,
    error: undefined extends R ? NiceError : never,
  ): Nested<S, R>;
  /**A read only proxy of the state, transform gets the result and gives a result, the proxy can fail, it is sync when the state is*/
  proxy<S, T>(
    this: S,
    transform: (value: ResultOf<KindOf<S>, RT>) => StateResult<T>,
  ): ReadProxy<S, IsSync<KindOf<S>> extends true ? "RES" : "REA", RT, WT, T>;
  /**A read only proxy of the state, map gets the plain value and an error of the state is passed on as it is,
   * the proxy is of the same kind as the state*/
  proxy_map<S, T>(
    this: S,
    map: (value: RT) => T,
  ): ReadProxy<S, ReadKind<KindOf<S>>, RT, WT, T>;
  /**A read only ok proxy of the state, transform gets the result and gives an ok result, handling the error of a state that can fail.
   * The proxy is sync when the state is*/
  proxy_ok<S, T>(
    this: S,
    transform: (value: ResultOf<KindOf<S>, RT>) => ResultOk<T>,
  ): ReadProxy<S, IsSync<KindOf<S>> extends true ? "ROS" : "ROA", RT, WT, T>;
}

/**proxy_w, proxy_w_map and proxy_ok_w of a writable state, writable proxies, like the read only ones.
 * Without write, writes, check and limit go to the state as they are, and the proxy has the write type of the state.
 * With write, see StateProxyWrite, the proxy can have a write type of its own, which needs write, W is only inferred from it.
 * The proxy writes synchronously when the state does, and write, if given, is a StateProxyWriteSync, which only those states take*/
interface WriteProxyMethods<RT, WT> {
  /**A writable proxy of the state, transform gets the result and gives a result, the proxy can fail, it is sync when the state is.
   * Writes go to the state as they are, or through write, see StateProxyWrite*/
  proxy_w<S, T>(
    this: S,
    transform: (value: ResultOf<KindOf<S>, RT>) => StateResult<T>,
  ): WriteProxy<KindOf<S>, WriteKind<KindOf<S>, false>, RT, WT, T, WT>;
  proxy_w<S, T, W = WT>(
    this: S & { readonly wsync: true },
    transform: (value: ResultOf<KindOf<S>, RT>) => StateResult<T>,
    write: StateProxyWriteSync<StateRESWS<RT, any, WT>, W>,
  ): WriteProxy<KindOf<S>, WriteKind<KindOf<S>, false>, RT, WT, T, NoInfer<W>>;
  proxy_w<S, T, W = WT>(
    this: S,
    transform: (value: ResultOf<KindOf<S>, RT>) => StateResult<T>,
    write: StateProxyWrite<StateREAW<RT, any, WT>, W>,
  ): WriteProxy<
    DropWS<KindOf<S>>,
    DropWS<WriteKind<KindOf<S>, false>>,
    RT,
    WT,
    T,
    NoInfer<W>
  >;
  /**A writable proxy of the state, map gets the plain value and an error of the state is passed on as it is,
   * the proxy is of the same kind as the state. Writes go to the state as they are, or through write, see StateProxyWrite*/
  proxy_w_map<S, T>(
    this: S,
    map: (value: RT) => T,
  ): WriteProxy<KindOf<S>, KindOf<S>, RT, WT, T, WT>;
  proxy_w_map<S, T, W = WT>(
    this: S & { readonly wsync: true },
    map: (value: RT) => T,
    write: StateProxyWriteSync<StateRESWS<RT, any, WT>, W>,
  ): WriteProxy<KindOf<S>, KindOf<S>, RT, WT, T, NoInfer<W>>;
  proxy_w_map<S, T, W = WT>(
    this: S,
    map: (value: RT) => T,
    write: StateProxyWrite<StateREAW<RT, any, WT>, W>,
  ): WriteProxy<DropWS<KindOf<S>>, DropWS<KindOf<S>>, RT, WT, T, NoInfer<W>>;
  /**A writable ok proxy of the state, like proxy_ok.
   * Writes go to the state as they are, or through write, see StateProxyWrite*/
  proxy_ok_w<S, T>(
    this: S,
    transform: (value: ResultOf<KindOf<S>, RT>) => ResultOk<T>,
  ): WriteProxy<KindOf<S>, WriteKind<KindOf<S>, true>, RT, WT, T, WT>;
  proxy_ok_w<S, T, W = WT>(
    this: S & { readonly wsync: true },
    transform: (value: ResultOf<KindOf<S>, RT>) => ResultOk<T>,
    write: StateProxyWriteSync<StateRESWS<RT, any, WT>, W>,
  ): WriteProxy<KindOf<S>, WriteKind<KindOf<S>, true>, RT, WT, T, NoInfer<W>>;
  proxy_ok_w<S, T, W = WT>(
    this: S,
    transform: (value: ResultOf<KindOf<S>, RT>) => ResultOk<T>,
    write: StateProxyWrite<StateREAW<RT, any, WT>, W>,
  ): WriteProxy<
    DropWS<KindOf<S>>,
    DropWS<WriteKind<KindOf<S>, true>>,
    RT,
    WT,
    T,
    NoInfer<W>
  >;
}

interface REA<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<StateResult<RT>, REL, WT>,
    ProxyMethods<RT, WT> {
  readonly rsync: false;
  readonly rok: false;
  readonly writable: false;
  readonly wsync: false;
}

interface ROA<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<ResultOk<RT>, REL, WT>,
    ProxyMethods<RT, WT> {
  readonly rsync: false;
  readonly rok: true;
  readonly writable: false;
  readonly wsync: false;
}

interface RES<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<StateResult<RT>, REL, WT>,
    ProxyMethods<RT, WT> {
  readonly rsync: true;
  get(): StateResult<RT>;
  readonly rok: false;
  readonly writable: false;
  readonly wsync: false;
}

interface ROS<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<ResultOk<RT>, REL, WT>,
    ProxyMethods<RT, WT> {
  readonly rsync: true;
  get(): ResultOk<RT>;
  readonly rok: true;
  ok(): RT;
  readonly writable: false;
  readonly wsync: false;
}

interface REAW<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<StateResult<RT>, REL, WT>,
    ProxyMethods<RT, WT>,
    WriteProxyMethods<RT, WT> {
  readonly rsync: false;
  readonly rok: false;
  readonly writable: true;
  readonly wsync: false;
  write(value: WT): PromiseLike<StateResult<void>>;
  limit(value: WT): PromiseLike<StateResult<WT>>;
  check(value: WT): PromiseLike<StateResult<WT>>;
}

interface ROAW<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<ResultOk<RT>, REL, WT>,
    ProxyMethods<RT, WT>,
    WriteProxyMethods<RT, WT> {
  readonly rsync: false;
  readonly rok: true;
  readonly writable: true;
  readonly wsync: false;
  write(value: WT): PromiseLike<StateResult<void>>;
  limit(value: WT): PromiseLike<StateResult<WT>>;
  check(value: WT): PromiseLike<StateResult<WT>>;
}

interface RESW<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<StateResult<RT>, REL, WT>,
    ProxyMethods<RT, WT>,
    WriteProxyMethods<RT, WT> {
  readonly rsync: true;
  get(): StateResult<RT>;
  readonly rok: false;
  readonly writable: true;
  readonly wsync: false;
  write(value: WT): PromiseLike<StateResult<void>>;
  limit(value: WT): PromiseLike<StateResult<WT>>;
  check(value: WT): PromiseLike<StateResult<WT>>;
}

interface ROSW<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<ResultOk<RT>, REL, WT>,
    ProxyMethods<RT, WT>,
    WriteProxyMethods<RT, WT> {
  readonly rsync: true;
  get(): ResultOk<RT>;
  readonly rok: true;
  ok(): RT;
  readonly writable: true;
  readonly wsync: false;
  write(value: WT): PromiseLike<StateResult<void>>;
  limit(value: WT): PromiseLike<StateResult<WT>>;
  check(value: WT): PromiseLike<StateResult<WT>>;
}

interface RESWS<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<StateResult<RT>, REL, WT>,
    ProxyMethods<RT, WT>,
    WriteProxyMethods<RT, WT> {
  readonly rsync: true;
  get(): StateResult<RT>;
  readonly rok: false;
  readonly writable: true;
  write(value: WT): PromiseLike<StateResult<void>>;
  limit(value: WT): PromiseLike<StateResult<WT>>;
  check(value: WT): PromiseLike<StateResult<WT>>;
  readonly wsync: true;
  readonly write_enabled?: StateRES<boolean>;
  write_sync(value: WT): StateResult<void>;
  limit_sync(value: WT): StateResult<WT>;
  check_sync(value: WT): StateResult<WT>;
}

interface ROSWS<RT, REL extends Option<StateRelated>, WT>
  extends StateBase<ResultOk<RT>, REL, WT>,
    ProxyMethods<RT, WT>,
    WriteProxyMethods<RT, WT> {
  readonly rsync: true;
  get(): ResultOk<RT>;
  readonly rok: true;
  ok(): RT;
  readonly writable: true;
  write(value: WT): PromiseLike<StateResult<void>>;
  limit(value: WT): PromiseLike<StateResult<WT>>;
  check(value: WT): PromiseLike<StateResult<WT>>;
  readonly wsync: true;
  readonly write_enabled?: StateRES<boolean>;
  write_sync(value: WT): StateResult<void>;
  limit_sync(value: WT): StateResult<WT>;
  check_sync(value: WT): StateResult<WT>;
}

//###########################################################################################################################################################
//      _________     _______  ______  _____
//     |__   __\ \   / /  __ \|  ____|/ ____|
//        | |   \ \_/ /| |__) | |__  | (___
//        | |    \   / |  ___/|  __|  \___ \
//        | |     | |  | |    | |____ ____) |
//        |_|     |_|  |_|    |______|_____/

export type State<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> =
  | StateREA<RT, REL, WT>
  | StateROA<RT, REL, WT>
  | StateRES<RT, REL, WT>
  | StateROS<RT, REL, WT>
  | StateREAW<RT, REL, WT>
  | StateROAW<RT, REL, WT>
  | StateRESW<RT, REL, WT>
  | StateROSW<RT, REL, WT>;

export type StateREA<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> =
  | REA<RT, REL, WT>
  | StateREAW<RT, REL, WT>
  | StateROA<RT, REL, WT>
  | StateROS<RT, REL, WT>
  | StateRES<RT, REL, WT>;

export type StateROA<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = ROA<RT, REL, WT> | StateROAW<RT, REL, WT> | StateROS<RT, REL, WT>;

export type StateRES<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RES<RT, REL, WT> | StateRESW<RT, REL, WT> | StateROS<RT, REL, WT>;

export type StateROS<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = ROS<RT, REL, WT> | StateROSW<RT, REL, WT>;

export type StateREAW<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> =
  | REAW<RT, REL, WT>
  | StateROAW<RT, REL, WT>
  | StateROSW<RT, REL, WT>
  | StateRESW<RT, REL, WT>;

export type StateROAW<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = ROAW<RT, REL, WT> | StateROSW<RT, REL, WT>;

export type StateRESW<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RESW<RT, REL, WT> | StateROSW<RT, REL, WT> | StateRESWS<RT, REL, WT>;

export type StateROSW<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = ROSW<RT, REL, WT> | StateROSWS<RT, REL, WT>;

/**A writable sync state that writes synchronously, see write_sync, its write gate is a sync state*/
export type StateRESWS<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RESWS<RT, REL, WT> | StateROSWS<RT, REL, WT>;

/**A writable sync ok state that writes synchronously, see write_sync, its write gate is a sync state*/
export type StateROSWS<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = ROSWS<RT, REL, WT>;

//###########################################################################################################################################################
//       _____ _______    _______ ______    ____  _____   __      __     _
//      / ____|__   __|/\|__   __|  ____|  / __ \|  __ \  \ \    / /\   | |
//     | (___    | |  /  \  | |  | |__    | |  | | |__) |  \ \  / /  \  | |
//      \___ \   | | / /\ \ | |  |  __|   | |  | |  _  /    \ \/ / /\ \ | |
//      ____) |  | |/ ____ \| |  | |____  | |__| | | \ \     \  / ____ \| |____
//     |_____/   |_/_/    \_\_|  |______|  \____/|_|  \_\     \/_/    \_\______|
//An initial value or a state giving the value, an initial value is applied once and not followed, so a value changed from outside must be a state
//The value type must not itself be a state, as it could not be told apart from the state

/**An initial value or any state */
export type StateOrVal<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | State<RT, REL, WT>;
/**An initial value or an async errorable state */
export type StateOrValREA<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateREA<RT, REL, WT>;
/**An initial value or an async ok state */
export type StateOrValROA<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateROA<RT, REL, WT>;
/**An initial value or a sync errorable state */
export type StateOrValRES<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateRES<RT, REL, WT>;
/**An initial value or a sync ok state */
export type StateOrValROS<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateROS<RT, REL, WT>;
/**An initial value or a writable async errorable state */
export type StateOrValREAW<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateREAW<RT, REL, WT>;
/**An initial value or a writable async ok state */
export type StateOrValROAW<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateROAW<RT, REL, WT>;
/**An initial value or a writable sync errorable state */
export type StateOrValRESW<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateRESW<RT, REL, WT>;
/**An initial value or a writable sync errorable state that writes synchronously */
export type StateOrValRESWS<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateRESWS<RT, REL, WT>;
/**An initial value or a writable sync ok state that writes synchronously */
export type StateOrValROSWS<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateROSWS<RT, REL, WT>;
/**An initial value or a writable sync ok state */
export type StateOrValROSW<
  RT,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
> = RT | StateROSW<RT, REL, WT>;
