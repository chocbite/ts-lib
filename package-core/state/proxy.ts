import { is_promise_like, sync_reject, sync_resolve } from "#common";
import {
  err_nice,
  none,
  ok,
  OptionNone,
  ResultInferOk,
  ResultOk,
} from "#result";
import { not_writable, state_errors } from "./errors";
import { set_proxy_maker, STATE_WRITE_DISABLED, StateBase } from "./base";
import {
  StateResult as SR,
  StateInferResult,
  StateInferType,
  StateRES,
  StateRESW,
  StateROS,
  StateROSW,
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

/**Runs func when the gate allows writing, otherwise resolves to a write disabled error, like the write gate of every state*/
function gated<T>(
  gate: State<boolean> | undefined,
  func: () => PromiseLike<SR<T>>,
): PromiseLike<SR<T>> {
  if (!gate) return func();
  return gate.then((res) =>
    res.ok && res.value
      ? func()
      : err_nice(state_errors.WRITE_DISABLED, "writing is disabled"),
  );
}

interface Owner<S extends State<any, any>, ROUT, WOUT, RROUT> {
  /**Sets the state that is being proxied, and updates subscribers with new value*/
  set_state(state: S): void;
  /**Changes the transform function of the proxy, and updates subscribers with new value*/
  set_transform_read(transform: (value: StateInferResult<S>) => RROUT): void;
  /**Changes how the proxy writes, see StateProxyWrite, undefined writes to the source as it is*/
  set_write(write: StateProxyWrite<S, WOUT> | undefined): void;
  readonly state: State<ROUT, OptionNone, WOUT>;
}

export type StateProxyROA<
  S extends State<RIN, any, WIN>,
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
  S extends StateREAW<RIN, any, WIN>,
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
  S extends StateRES<RIN, any, WIN>,
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
  S extends StateRESW<RIN, any, WIN>,
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
  S extends State<RIN, any, WIN>,
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
  S extends StateREAW<RIN, any, WIN>,
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
  S extends StateRES<RIN, any, WIN>,
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
  S extends StateRESW<RIN, any, WIN>,
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
    write?: StateProxyWrite<S, WOUT>,
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
  /**How to write a value, undefined writes it to the source as it is*/
  #write?: StateProxyWrite<S, WOUT>;
  #subscriber = (value: SR<RIN>) => {
    const transformed = this.transform_read(value as StateInferResult<S>);
    //Objects and arrays can be changed in place, so they are always passed on
    const changed =
      !this.#buffer?.compare(transformed) ||
      (transformed.ok && typeof transformed.value === "object");
    this.#buffer = transformed;
    if (changed) this.update_subs(transformed);
  };
  #buffer?: RROUT;

  private transform_read(value: StateInferResult<S>): RROUT {
    return value as unknown as RROUT;
  }
  protected on_sub(run: boolean = false): void {
    this.#state.sub(this.#subscriber, run);
  }
  protected on_unsub(): void {
    this.#state.unsub(this.#subscriber);
    this.#buffer = undefined;
  }

  //#Owner Context
  set_state(state: S) {
    if (this.in_use()) {
      this.on_unsub();
      this.#state = state;
      this.on_sub(true);
    } else this.#state = state;
  }
  set_transform_read(transform: (value: StateInferResult<S>) => RROUT) {
    if (this.in_use()) {
      this.on_unsub();
      this.transform_read = transform;
      this.on_sub(true);
    } else this.transform_read = transform;
  }
  set_write(write: StateProxyWrite<S, WOUT> | undefined) {
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
  then<TResult1 = RROUT, TResult2 = never>(
    on_fulfilled?: ((value: RROUT) => TResult1 | PromiseLike<TResult1>) | null,
    on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      if (this.#buffer) {
        const result = on_fulfilled ? on_fulfilled(this.#buffer) : this.#buffer;
        if (is_promise_like(result)) return result;
        return sync_resolve(result as TResult1);
      } else {
        return this.#state.then((v) => {
          const result = on_fulfilled
            ? on_fulfilled(this.transform_read(v as StateInferResult<S>))
            : this.transform_read(v as StateInferResult<S>);
          if (is_promise_like(result)) return result;
          return sync_resolve(result as TResult1);
        });
      }
    } catch (error) {
      if (on_rejected) {
        const rejected_result = on_rejected(error);
        if (is_promise_like(rejected_result)) return rejected_result;
        return sync_resolve(rejected_result);
      }
      return sync_reject(error);
    }
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
    if (write)
      return gated(this.#state.write_enabled, () =>
        write.write(value, this.#state),
      );
    //Without write the proxy has the write type of the source
    return this.#state.write(value as unknown as WIN);
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

//##################################################################################################################################################
//      _____   ____
//     |  __ \ / __ \   /\
//     | |__) | |  | | /  \
//     |  _  /| |  | |/ /\ \
//     | | \ \| |__| / ____ \
//     |_|  \_\\____/_/    \_\
/**Creates a guarenteed ok proxy state which mirrors another state, with an optional transform function.
 * @param state - state to proxy.
 * @param transform - Function to transform value of proxy*/
function roa_from<
  S extends StateREA<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  ROUT = RIN,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  WOUT = WIN,
>(
  state: S,
  transform?: (value: StateInferResult<S>) => ResultOk<ROUT>,
): StateProxyROA<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, ResultOk<ROUT>>(
    true,
    false,
    state,
    transform,
  ) as StateProxyROA<S, RIN, WIN, ROUT, WOUT>;
}

//##################################################################################################################################################
//      _____   ____     __          __
//     |  __ \ / __ \   /\ \        / /
//     | |__) | |  | | /  \ \  /\  / /
//     |  _  /| |  | |/ /\ \ \/  \/ /
//     | | \ \| |__| / ____ \  /\  /
//     |_|  \_\\____/_/    \_\/  \/

/**Creates a writable proxy state which mirrors another state, with an optional transform function.
 * Without write, writes, check and limit go to the source as they are, and the proxy has the write type of the source.
 * With write, see StateProxyWrite, the proxy can have a write type of its own, which needs write.
 * @param state - state to proxy.
 * @param transform_read - Function to transform value of proxy
 * @param write - Writes, checks and limits a value, given the source state*/
function roaw_from<
  S extends StateREAW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => ResultOk<ROUT>,
): StateProxyROAW<S, RIN, WIN, ROUT, WIN>;
function roaw_from<
  S extends StateREAW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
>(
  state: S,
  transform_read: ((value: StateInferResult<S>) => ResultOk<ROUT>) | undefined,
  write: StateProxyWrite<S, WOUT>,
): StateProxyROAW<S, RIN, WIN, ROUT, WOUT>;
function roaw_from<S extends StateREAW<RIN, any, WIN>, RIN, WIN, ROUT, WOUT>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => ResultOk<ROUT>,
  write?: StateProxyWrite<S, WOUT>,
): StateProxyROAW<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, ResultOk<ROUT>>(
    true,
    true,
    state,
    transform_read,
    write,
  ) as StateProxyROAW<S, RIN, WIN, ROUT, WOUT>;
}

//##################################################################################################################################################
//      _____   ____   _____
//     |  __ \ / __ \ / ____|
//     | |__) | |  | | (___
//     |  _  /| |  | |\___ \
//     | | \ \| |__| |____) |
//     |_|  \_\\____/|_____/
/**Creates a sync proxy state which mirrors another state, with an optional transform function.
 * @param state - state to proxy.
 * @param transform - Function to transform value of proxy*/
function ros_from<
  S extends StateRES<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  ROUT = RIN,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  WOUT = WIN,
>(
  state: S,
  transform?: (value: StateInferResult<S>) => ResultOk<ROUT>,
): StateProxyROS<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, ResultOk<ROUT>>(
    true,
    false,
    state,
    transform,
  ) as StateProxyROS<S, RIN, WIN, ROUT, WOUT>;
}

//##################################################################################################################################################
//      _____   ____   _______          __
//     |  __ \ / __ \ / ____\ \        / /
//     | |__) | |  | | (___  \ \  /\  / /
//     |  _  /| |  | |\___ \  \ \/  \/ /
//     | | \ \| |__| |____) |  \  /\  /
//     |_|  \_\\____/|_____/    \/  \/
/**Creates a writable proxy state which mirrors another state, with an optional transform function.
 * Without write, writes, check and limit go to the source as they are, and the proxy has the write type of the source.
 * With write, see StateProxyWrite, the proxy can have a write type of its own, which needs write.
 * @param state - state to proxy.
 * @param transform_read - Function to transform value of proxy
 * @param write - Writes, checks and limits a value, given the source state*/
function rosw_from<
  S extends StateRESW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => ResultOk<ROUT>,
): StateProxyROSW<S, RIN, WIN, ROUT, WIN>;
function rosw_from<
  S extends StateRESW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
>(
  state: S,
  transform_read: ((value: StateInferResult<S>) => ResultOk<ROUT>) | undefined,
  write: StateProxyWrite<S, WOUT>,
): StateProxyROSW<S, RIN, WIN, ROUT, WOUT>;
function rosw_from<S extends StateRESW<RIN, any, WIN>, RIN, WIN, ROUT, WOUT>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => ResultOk<ROUT>,
  write?: StateProxyWrite<S, WOUT>,
): StateProxyROSW<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, ResultOk<ROUT>>(
    true,
    true,
    state,
    transform_read,
    write,
  ) as StateProxyROSW<S, RIN, WIN, ROUT, WOUT>;
}

//##################################################################################################################################################
//      _____  ______
//     |  __ \|  ____|   /\
//     | |__) | |__     /  \
//     |  _  /|  __|   / /\ \
//     | | \ \| |____ / ____ \
//     |_|  \_\______/_/    \_\
/**Creates a proxy state which mirrors another state, with an optional transform function.
 * @param state - state to proxy.
 * @param transform - Function to transform value of proxy*/
function rea_from<
  S extends StateREA<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  ROUT = RIN,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  WOUT = WIN,
>(
  state: S,
  transform?: (value: StateInferResult<S>) => SR<ROUT>,
): StateProxyREA<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, SR<ROUT>>(
    false,
    false,
    state,
    transform,
  ) as StateProxyREA<S, RIN, WIN, ROUT, WOUT>;
}

//##################################################################################################################################################
//      _____  ______     __          __
//     |  __ \|  ____|   /\ \        / /
//     | |__) | |__     /  \ \  /\  / /
//     |  _  /|  __|   / /\ \ \/  \/ /
//     | | \ \| |____ / ____ \  /\  /
//     |_|  \_\______/_/    \_\/  \/
/**Creates a writable proxy state which mirrors another state, with an optional transform function.
 * Without write, writes, check and limit go to the source as they are, and the proxy has the write type of the source.
 * With write, see StateProxyWrite, the proxy can have a write type of its own, which needs write.
 * @param state - state to proxy.
 * @param transform_read - Function to transform value of proxy
 * @param write - Writes, checks and limits a value, given the source state*/
function reaw_from<
  S extends StateREAW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => SR<ROUT>,
): StateProxyREAW<S, RIN, WIN, ROUT, WIN>;
function reaw_from<
  S extends StateREAW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
>(
  state: S,
  transform_read: ((value: StateInferResult<S>) => SR<ROUT>) | undefined,
  write: StateProxyWrite<S, WOUT>,
): StateProxyREAW<S, RIN, WIN, ROUT, WOUT>;
function reaw_from<S extends StateREAW<RIN, any, WIN>, RIN, WIN, ROUT, WOUT>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => SR<ROUT>,
  write?: StateProxyWrite<S, WOUT>,
): StateProxyREAW<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, SR<ROUT>>(
    false,
    true,
    state,
    transform_read,
    write,
  ) as StateProxyREAW<S, RIN, WIN, ROUT, WOUT>;
}

//##################################################################################################################################################
//      _____  ______  _____
//     |  __ \|  ____|/ ____|
//     | |__) | |__  | (___
//     |  _  /|  __|  \___ \
//     | | \ \| |____ ____) |
//     |_|  \_\______|_____/

/**Creates a sync proxy state which mirrors another state, with an optional transform function.
 * @param state - state to proxy.
 * @param transform - Function to transform value of proxy*/
function res_from<
  S extends StateRES<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  ROUT = RIN,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  WOUT = WIN,
>(
  state: S,
  transform?: (value: StateInferResult<S>) => SR<ROUT>,
): StateProxyRES<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, SR<ROUT>>(
    false,
    false,
    state,
    transform,
  ) as StateProxyRES<S, RIN, WIN, ROUT, WOUT>;
}

//##################################################################################################################################################
//      _____  ______  _______          __
//     |  __ \|  ____|/ ____\ \        / /
//     | |__) | |__  | (___  \ \  /\  / /
//     |  _  /|  __|  \___ \  \ \/  \/ /
//     | | \ \| |____ ____) |  \  /\  /
//     |_|  \_\______|_____/    \/  \/

/**Creates a writable proxy state which mirrors another state, with an optional transform function.
 * Without write, writes, check and limit go to the source as they are, and the proxy has the write type of the source.
 * With write, see StateProxyWrite, the proxy can have a write type of its own, which needs write.
 * @param state - state to proxy.
 * @param transform_read - Function to transform value of proxy
 * @param write - Writes, checks and limits a value, given the source state*/
function resw_from<
  S extends StateRESW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => SR<ROUT>,
): StateProxyRESW<S, RIN, WIN, ROUT, WIN>;
function resw_from<
  S extends StateRESW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
>(
  state: S,
  transform_read: ((value: StateInferResult<S>) => SR<ROUT>) | undefined,
  write: StateProxyWrite<S, WOUT>,
): StateProxyRESW<S, RIN, WIN, ROUT, WOUT>;
function resw_from<S extends StateRESW<RIN, any, WIN>, RIN, WIN, ROUT, WOUT>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => SR<ROUT>,
  write?: StateProxyWrite<S, WOUT>,
): StateProxyRESW<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, SR<ROUT>>(
    false,
    true,
    state,
    transform_read,
    write,
  ) as StateProxyRESW<S, RIN, WIN, ROUT, WOUT>;
}

//##################################################################################################################################################
//      __  __          _____
//     |  \/  |   /\   |  __ \
//     | \  / |  /  \  | |__) |
//     | |\/| | / /\ \ |  ___/
//     | |  | |/ ____ \| |
//     |_|  |_/_/    \_\_|
/**A read transform of the result made from a function of the plain value, an error is passed on as it is*/
const mapped =
  <S extends State<any>, ROUT>(map: (value: StateInferType<S>) => ROUT) =>
  (result: StateInferResult<S>): SR<ROUT> =>
    (result as SR<StateInferType<S>>).map(map);

/**Like rea, the function gets the plain value and gives a plain value, an error of the state is passed on as it is.
 * @param state - state to proxy.
 * @param map - Function to transform the value of the state*/
function rea_map<S extends StateREA<any, any, any>, ROUT>(
  state: S,
  map: (value: StateInferType<S>) => ROUT,
) {
  return rea_from<S, StateInferType<S>, ROUT>(state, mapped<S, ROUT>(map));
}

/**Like res, the function gets the plain value and gives a plain value, an error of the state is passed on as it is.
 * @param state - state to proxy.
 * @param map - Function to transform the value of the state*/
function res_map<S extends StateRES<any, any, any>, ROUT>(
  state: S,
  map: (value: StateInferType<S>) => ROUT,
) {
  return res_from<S, StateInferType<S>, ROUT>(state, mapped<S, ROUT>(map));
}

/**Like reaw, the function gets the plain value and gives a plain value, an error of the state is passed on as it is.
 * Without write the proxy has the write type of the source, with write it can have one of its own, see StateProxyWrite.
 * @param state - state to proxy.
 * @param map - Function to transform the value of the state
 * @param write - Writes, checks and limits a value, given the source state*/
function reaw_map<
  S extends StateREAW<any, any, any>,
  ROUT,
  WIN = S extends State<any, any, infer WT> ? WT : any,
>(
  state: S,
  map: (value: StateInferType<S>) => ROUT,
): StateProxyREAW<S, StateInferType<S>, WIN, ROUT, WIN>;
function reaw_map<
  S extends StateREAW<any, any, any>,
  ROUT,
  WOUT,
  WIN = S extends State<any, any, infer WT> ? WT : any,
>(
  state: S,
  map: (value: StateInferType<S>) => ROUT,
  write: StateProxyWrite<S, WOUT>,
): StateProxyREAW<S, StateInferType<S>, WIN, ROUT, WOUT>;
function reaw_map<S extends StateREAW<any, any, any>, ROUT, WOUT>(
  state: S,
  map: (value: StateInferType<S>) => ROUT,
  write?: StateProxyWrite<S, WOUT>,
) {
  return new RXXX<S, StateInferType<S>, unknown, ROUT, WOUT, SR<ROUT>>(
    false,
    true,
    state,
    mapped<S, ROUT>(map),
    write,
  ) as unknown as StateProxyREAW<S, StateInferType<S>, any, ROUT, WOUT>;
}

/**Like resw, the function gets the plain value and gives a plain value, an error of the state is passed on as it is.
 * Without write the proxy has the write type of the source, with write it can have one of its own, see StateProxyWrite.
 * @param state - state to proxy.
 * @param map - Function to transform the value of the state
 * @param write - Writes, checks and limits a value, given the source state*/
function resw_map<
  S extends StateRESW<any, any, any>,
  ROUT,
  WIN = S extends State<any, any, infer WT> ? WT : any,
>(
  state: S,
  map: (value: StateInferType<S>) => ROUT,
): StateProxyRESW<S, StateInferType<S>, WIN, ROUT, WIN>;
function resw_map<
  S extends StateRESW<any, any, any>,
  ROUT,
  WOUT,
  WIN = S extends State<any, any, infer WT> ? WT : any,
>(
  state: S,
  map: (value: StateInferType<S>) => ROUT,
  write: StateProxyWrite<S, WOUT>,
): StateProxyRESW<S, StateInferType<S>, WIN, ROUT, WOUT>;
function resw_map<S extends StateRESW<any, any, any>, ROUT, WOUT>(
  state: S,
  map: (value: StateInferType<S>) => ROUT,
  write?: StateProxyWrite<S, WOUT>,
) {
  return new RXXX<S, StateInferType<S>, unknown, ROUT, WOUT, SR<ROUT>>(
    false,
    true,
    state,
    mapped<S, ROUT>(map),
    write,
  ) as unknown as StateProxyRESW<S, StateInferType<S>, any, ROUT, WOUT>;
}

//The proxy and proxy_map methods of every state make their proxies here, base.ts can not import this file,
//as the proxy class extends StateBase, which does not exist yet while base.ts loads
set_proxy_maker((base, map_ok, transform, writable, write) => {
  const state = base as State<unknown, any, unknown>;
  return new RXXX(
    map_ok && state.rok,
    writable,
    state,
    map_ok ? mapped(transform) : (transform as (value: SR<unknown>) => SR<unknown>),
    write as StateProxyWrite<State<unknown, any, unknown>, unknown> | undefined,
  );
});

//##################################################################################################################################################
//      ________   _______   ____  _____ _______ _____
//     |  ____\ \ / /  __ \ / __ \|  __ \__   __/ ____|
//     | |__   \ V /| |__) | |  | | |__) | | | | (___
//     |  __|   > < |  ___/| |  | |  _  /  | |  \___ \
//     | |____ / . \| |    | |__| | | \ \  | |  ____) |
//     |______/_/ \_\_|     \____/|_|  \_\ |_| |_____/

/**Proxy state redirecting another state */
export const PROXY = {
  /**Creates an async ok proxy state which mirrors another state */
  roa: roa_from,
  /**Creates a writable async ok proxy state which mirrors another state */
  roaw: roaw_from,
  /**Creates a sync ok proxy state which mirrors another state */
  ros: ros_from,
  /**Creates a writable sync ok proxy state which mirrors another state */
  rosw: rosw_from,
  /**Creates an async errorable proxy state which mirrors another state */
  rea: rea_from,
  /**Creates a writable async errorable proxy state which mirrors another state */
  reaw: reaw_from,
  /**Creates a sync errorable proxy state which mirrors another state */
  res: res_from,
  /**Creates a writable sync errorable proxy state which mirrors another state */
  resw: resw_from,
  /**Like rea, with a function of the plain value, an error is passed on as it is */
  rea_map,
  /**Like res, with a function of the plain value, an error is passed on as it is */
  res_map,
  /**Like reaw, with a function of the plain value, an error is passed on as it is */
  reaw_map,
  /**Like resw, with a function of the plain value, an error is passed on as it is */
  resw_map,
};
