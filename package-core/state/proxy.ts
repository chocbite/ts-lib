import { sync_resolve } from "#common";
import {
  err_nice,
  none,
  ok,
  OptionNone,
  ResultInferOk,
  ResultOk,
} from "#result";
import { not_writable, state_errors } from "./errors";
import {
  gate_closed_sync,
  set_proxy_maker,
  STATE_DERIVED_KEY,
  STATE_WRITE_DISABLED,
  StateBase,
  type StateDerivedSub,
} from "./base";
import {
  StateResult as SR,
  StateInferResult,
  StateInferType,
  StateRES,
  StateRESW,
  StateROS,
  StateROSW,
  StateRESWS,
  StateROSWS,
  type State,
  type StateREA,
  type StateREAW,
  type StateROA,
  type StateROAW,
} from "./types";

//##################################################################################################################################################
//      _________     _______  ______  _____
//     |__   __\ \   / /  __ \|  ____|/ ____|
//        | |   \ \_/ /| |__) | |__  | (___
//        | |    \   / |  ___/|  __|  \___ \
//        | |     | |  | |    | |____ ____) |
//        |_|     |_|  |_|    |______|_____/

/**Writing of a writable proxy state with a write type of its own, each function gets the value and the source state.
 * write sends the value on, usually by writing it, changed, to the source.
 * check tells if a value can be written, limit gives the closest value that can, both give the value as it is when left out.
 * All three go through the write gate of the source*/
export interface StateProxyWrite<S, WOUT> {
  write(value: WOUT, state: S): PromiseLike<SR<void>>;
  check?(value: WOUT, state: S): PromiseLike<SR<WOUT>>;
  limit?(value: WOUT, state: S): PromiseLike<SR<WOUT>>;
}

/**Writing of a writable proxy state that writes synchronously, like StateProxyWrite with the results given directly.
 * Only states that write synchronously take it, the proxy then writes synchronously too*/
export interface StateProxyWriteSync<S, WOUT> {
  write_sync(value: WOUT, state: S): SR<void>;
  check_sync?(value: WOUT, state: S): SR<WOUT>;
  limit_sync?(value: WOUT, state: S): SR<WOUT>;
}

/**Runs func when the gate allows writing, otherwise resolves to a write disabled error, like the write gate of every state*/
function gated<T>(
  gate: State<boolean> | undefined,
  func: () => PromiseLike<SR<T>>,
): PromiseLike<SR<T>> {
  if (!gate) return func();
  return gate.read().then((res) =>
    res.ok && res.value
      ? func()
      : err_nice(state_errors.WRITE_DISABLED, "writing is disabled"),
  );
}

/**The result the source of a proxy gives, from its read, as set_state takes a StateBase of the kind, see SourceOf in types.ts*/
type SourceResult<S> = S extends { read(): PromiseLike<infer R> } ? R : never;

interface Owner<S, ROUT, WOUT, RROUT> {
  /**Sets the state that is being proxied, and updates subscribers with new value*/
  set_state(state: S): void;
  /**Changes the transform function of the proxy, and updates subscribers with new value*/
  set_transform_read(transform: (value: SourceResult<S>) => RROUT): void;
  /**Changes how the proxy writes, see StateProxyWrite, undefined writes to the source as it is*/
  set_write(write: StateProxyWrite<S, WOUT> | undefined): void;
  readonly state: State<ROUT, OptionNone, WOUT>;
}

/**Owner of a proxy that writes synchronously, its write form must be sync too*/
type OwnerSync<S, ROUT, WOUT, RROUT> = Omit<Owner<S, ROUT, WOUT, RROUT>, "set_write"> & {
  /**Changes how the proxy writes, see StateProxyWriteSync, undefined writes to the source as it is*/
  set_write(write: StateProxyWriteSync<S, WOUT> | undefined): void;
};

export type StateProxyROSWS<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : never,
  ROUT = RIN,
  WOUT = WIN,
> = StateROSWS<ROUT, OptionNone, WOUT> &
  OwnerSync<S, ROUT, WOUT, ResultOk<ROUT>> & {
    readonly read_only: StateROS<ROUT, OptionNone, WOUT>;
    readonly read_write: StateROSWS<ROUT, OptionNone, WOUT>;
  };

export type StateProxyRESWS<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : never,
  ROUT = RIN,
  WOUT = WIN,
> = StateRESWS<ROUT, OptionNone, WOUT> &
  OwnerSync<S, ROUT, WOUT, SR<ROUT>> & {
    readonly read_only: StateRES<ROUT, OptionNone, WOUT>;
    readonly read_write: StateRESWS<ROUT, OptionNone, WOUT>;
  };

export type StateProxyROA<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
> = StateROA<ROUT, OptionNone, WOUT> &
  Owner<S, ROUT, WOUT, ResultOk<ROUT>> & {
    readonly read_only: StateROA<ROUT, OptionNone, WOUT>;
    readonly read_write?: StateROAW<ROUT, OptionNone, WOUT>;
  };

export type StateProxyROAW<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : never,
  ROUT = RIN,
  WOUT = WIN,
> = StateROAW<ROUT, OptionNone, WOUT> &
  Owner<S, ROUT, WOUT, ResultOk<ROUT>> & {
    readonly read_only: StateROA<ROUT, OptionNone, WOUT>;
    readonly read_write: StateROAW<ROUT, OptionNone, WOUT>;
  };

export type StateProxyROS<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
> = StateROS<ROUT, OptionNone, WOUT> &
  Owner<S, ROUT, WOUT, ResultOk<ROUT>> & {
    readonly read_only: StateROS<ROUT, OptionNone, WOUT>;
    readonly read_write?: StateROSW<ROUT, OptionNone, WOUT>;
  };

export type StateProxyROSW<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : never,
  ROUT = RIN,
  WOUT = WIN,
> = StateROSW<ROUT, OptionNone, WOUT> &
  Owner<S, ROUT, WOUT, ResultOk<ROUT>> & {
    readonly read_only: StateROS<ROUT, OptionNone, WOUT>;
    readonly read_write: StateROSW<ROUT, OptionNone, WOUT>;
  };

export type StateProxyREA<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
> = StateREA<ROUT, OptionNone, WOUT> &
  Owner<S, ROUT, WOUT, SR<ROUT>> & {
    readonly read_only: StateREA<ROUT, OptionNone, WOUT>;
    readonly read_write?: StateREAW<ROUT, OptionNone, WOUT>;
  };

export type StateProxyREAW<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : never,
  ROUT = RIN,
  WOUT = WIN,
> = StateREAW<ROUT, OptionNone, WOUT> &
  Owner<S, ROUT, WOUT, SR<ROUT>> & {
    readonly read_only: StateREA<ROUT, OptionNone, WOUT>;
    readonly read_write: StateREAW<ROUT, OptionNone, WOUT>;
  };

export type StateProxyRES<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
> = StateRES<ROUT, OptionNone, WOUT> &
  Owner<S, ROUT, WOUT, SR<ROUT>> & {
    readonly read_only: StateRES<ROUT, OptionNone, WOUT>;
    readonly read_write?: StateRESW<ROUT, OptionNone, WOUT>;
  };

export type StateProxyRESW<
  S,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : never,
  ROUT = RIN,
  WOUT = WIN,
> = StateRESW<ROUT, OptionNone, WOUT> &
  Owner<S, ROUT, WOUT, SR<ROUT>> & {
    readonly read_only: StateRES<ROUT, OptionNone, WOUT>;
    readonly read_write: StateRESW<ROUT, OptionNone, WOUT>;
  };

//##################################################################################################################################################
//       _____ _                _____ _____
//      / ____| |        /\    / ____/ ____|
//     | |    | |       /  \  | (___| (___
//     | |    | |      / /\ \  \___ \\___ \
//     | |____| |____ / ____ \ ____) |___) |
//      \_____|______/_/    \_\_____/_____/

class RXXX<
  S extends State<RIN, any, WIN>,
  RIN,
  WIN,
  ROUT,
  WOUT,
  RROUT extends SR<ROUT>,
>
  extends StateBase<RROUT, WOUT, OptionNone>
  implements Owner<S, ROUT, WOUT, RROUT>
{
  constructor(
    rok: boolean,
    writable: boolean,
    state: S,
    transform_read?: (value: StateInferResult<S>) => RROUT,
    write?: StateProxyWrite<S, WOUT> | StateProxyWriteSync<S, WOUT>,
  ) {
    super();
    this.#rok = rok;
    this.#writable = writable;
    this.#state = state;
    if (transform_read) this.transform_read = transform_read;
    this.#write = write;
  }

  #rok: boolean;
  #writable: boolean;
  #state: S;
  /**How to write a value, undefined writes it to the source as it is, a StateProxyWriteSync has write_sync*/
  #write?: StateProxyWrite<S, WOUT> | StateProxyWriteSync<S, WOUT>;
  /**The subscriber to the source, made on the first subscribe, a proxy nobody uses has none*/
  #subscriber?: StateDerivedSub;
  #make_subscriber(): StateDerivedSub {
    return (this.#subscriber ??= Object.assign(
      (value: SR<RIN>) => {
        const transformed = this.transform_read(value as StateInferResult<S>);
        const last = this.#buffer ?? this.#invalidated;
        this.#invalidated = undefined;
        this.#stale = false;
        //Objects and arrays can be changed in place, so they are always passed on
        const changed =
          !last?.compare(transformed) ||
          (transformed.ok && typeof transformed.value === "object");
        this.#buffer = transformed;
        if (changed) this.update_subs(transformed);
      },
      { [STATE_DERIVED_KEY]: () => this.#invalidate() },
    ));
  }
  #buffer?: RROUT;
  /**The buffer while the source changed but has not told the value yet, reads go through to the source until it does.
   * Kept to tell if the value then is a change*/
  #invalidated?: RROUT;
  /**True from an invalidate until the value is told, so a chain is invalidated once*/
  #stale = false;
  #invalidate(): void {
    if (this.#stale) return;
    this.#stale = true;
    if (this.#buffer) {
      this.#invalidated = this.#buffer;
      this.#buffer = undefined;
    }
    this.invalidate_derived();
  }

  private transform_read(value: StateInferResult<S>): RROUT {
    return value as unknown as RROUT;
  }
  protected on_sub(run: boolean = false): void {
    this.#state.sub(this.#make_subscriber(), run);
  }
  protected on_unsub(): void {
    this.#state.unsub(this.#subscriber!);
    this.#buffer = undefined;
    this.#invalidated = undefined;
    this.#stale = false;
  }

  //#Owner Context
  set_state(state: S) {
    if (this.in_use()) {
      this.on_unsub();
      this.#state = state;
      this.on_sub(true);
    } else this.#state = state;
  }
  set_transform_read(transform: (value: SourceResult<S>) => RROUT) {
    //The same result, read through set_state's StateBase of the kind
    const read = transform as (value: StateInferResult<S>) => RROUT;
    if (this.in_use()) {
      this.on_unsub();
      this.transform_read = read;
      this.on_sub(true);
    } else this.transform_read = read;
  }
  set_write(write: StateProxyWrite<S, WOUT> | StateProxyWriteSync<S, WOUT> | undefined) {
    this.#write = write;
  }
  get state() {
    return this as State<ROUT, OptionNone, WOUT>;
  }
  get read_only() {
    return this.read_only_view() as State<ROUT, OptionNone, WOUT>;
  }
  get read_write() {
    return this as State<ROUT, OptionNone, WOUT>;
  }

  //#Reader Context
  get rok(): boolean {
    return this.#rok;
  }
  get rsync(): boolean {
    return this.#state.rsync;
  }
  read(): PromiseLike<RROUT> {
    if (this.#buffer) return sync_resolve(this.#buffer);
    //A transform that throws gives a rejected thenable
    return this.#state
      .read()
      .then((v) => this.transform_read(v as StateInferResult<S>));
  }
  get(): RROUT {
    if (this.#buffer) return this.#buffer;
    return this.transform_read(this.#state.get!() as StateInferResult<S>);
  }
  ok(): ResultInferOk<RROUT> {
    return (this.get() as ResultOk<ResultInferOk<RROUT>>).value;
  }
  related(): OptionNone {
    return none();
  }

  //#Writer Context
  get writable(): boolean {
    return this.#writable && this.#state.writable;
  }
  /**The write gate of the source, writes and checks are passed to the source which applies it*/
  get write_enabled(): State<boolean> | undefined {
    return this.#writable ? this.#state.write_enabled : STATE_WRITE_DISABLED;
  }
  write(value: WOUT): PromiseLike<SR<void>> {
    if (!this.#writable || !this.#state.write)
      return sync_resolve(not_writable());
    const write = this.#write;
    if (write) {
      if ("write_sync" in write) return sync_resolve(this.write_sync(value));
      return gated(this.#state.write_enabled, () =>
        write.write(value, this.#state),
      );
    }
    //Without write the proxy has the write type of the source
    return this.#state.write(value as unknown as WIN);
  }

  /**Writes synchronously when the source does and the write form, if any, is sync*/
  get wsync(): boolean {
    return (
      this.#writable &&
      this.#state.wsync &&
      (!this.#write || "write_sync" in this.#write)
    );
  }
  //The sync methods are only in the types of proxies that write synchronously, the others give the not writable error
  write_sync(value: WOUT): SR<void> {
    if (!this.wsync) return not_writable();
    const write = this.#write as StateProxyWriteSync<S, WOUT> | undefined;
    if (!write) return this.#state.write_sync!(value as unknown as WIN);
    return (
      gate_closed_sync(this.#state.write_enabled) ??
      write.write_sync(value, this.#state)
    );
  }
  limit_sync(value: WOUT): SR<WOUT> {
    return this.#sync_helper("limit_sync", value);
  }
  check_sync(value: WOUT): SR<WOUT> {
    return this.#sync_helper("check_sync", value);
  }
  #sync_helper(name: "limit_sync" | "check_sync", value: WOUT): SR<WOUT> {
    if (!this.wsync) return not_writable();
    const write = this.#write as StateProxyWriteSync<S, WOUT> | undefined;
    if (!write)
      return this.#state[name]!(value as unknown as WIN) as unknown as SR<WOUT>;
    return (
      gate_closed_sync(this.#state.write_enabled) ??
      write[name]?.(value, this.#state) ??
      ok(value)
    );
  }

  //@ts-expect-error typescript workaround
  get limit(): ((value: WOUT) => PromiseLike<SR<WOUT>>) | undefined {
    return this.#write_helper("limit");
  }
  //@ts-expect-error typescript workaround
  get check(): ((value: WOUT) => PromiseLike<SR<WOUT>>) | undefined {
    return this.#write_helper("check");
  }

  /**limit or check, of the write form when given, else of the source with the value as it is, undefined when the source has none*/
  #write_helper(
    name: "limit" | "check",
  ): ((value: WOUT) => PromiseLike<SR<WOUT>>) | undefined {
    const write = this.#write;
    if (write && "write_sync" in write)
      return (value) => sync_resolve(this.#sync_helper(`${name}_sync`, value));
    if (write)
      return (value) => {
        if (!this.#writable) return sync_resolve(not_writable());
        return gated(
          this.#state.write_enabled,
          () => write[name]?.(value, this.#state) ?? sync_resolve(ok(value)),
        );
      };
    const helper = this.#state[name]?.bind(this.#state);
    return helper
      ? (value) => {
          if (!this.#writable) return sync_resolve(not_writable());
          return helper(value as unknown as WIN) as unknown as PromiseLike<
            SR<WOUT>
          >;
        }
      : undefined;
  }
}

/**A read transform of the result made from a function of the plain value, an error is passed on as it is*/
const mapped =
  <S extends State<any>, ROUT>(map: (value: StateInferType<S>) => ROUT) =>
  (result: StateInferResult<S>): SR<ROUT> =>
    (result as SR<StateInferType<S>>).map(map);

//The proxy and proxy_map methods of every state make their proxies here, base.ts can not import this file,
//as the proxy class extends StateBase, which does not exist yet while base.ts loads
set_proxy_maker((base, mode, transform, writable, write) => {
  const state = base as State<unknown, any, unknown>;
  return new RXXX(
    mode === "ok" || (mode === "map" && state.rok),
    writable,
    state,
    mode === "map" ? mapped(transform) : (transform as (value: SR<unknown>) => SR<unknown>),
    write as StateProxyWrite<State<unknown, any, unknown>, unknown> | undefined,
  );
});
