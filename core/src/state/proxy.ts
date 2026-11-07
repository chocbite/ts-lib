import { is_promise_like, sync_reject, sync_resolve } from "#common";
import { err, none, ok, OptionNone, ResultInferOk, ResultOk } from "#result";
import { StateBase } from "./base";
import {
  StateResult as SR,
  StateInferResult,
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

interface Owner<S extends State<any, any>, WIN, ROUT, WOUT, RROUT> {
  /**Sets the state that is being proxied, and updates subscribers with new value*/
  set_state(state: S): void;
  /**Changes the transform function of the proxy, and updates subscribers with new value*/
  set_transform_read(transform: (value: StateInferResult<S>) => RROUT): void;
  /**Changes the transform function of the proxy, and updates subscribers with new value*/
  set_transform_write(
    wout_win: (val: WOUT) => WIN,
    win_wout: (val: WIN) => WOUT,
  ): void;
  readonly state: State<ROUT, OptionNone, WOUT>;
}

export type StateProxyROA<
  S extends State<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
> = StateROA<ROUT, OptionNone, WOUT> &
  Owner<S, WIN, ROUT, WOUT, ResultOk<ROUT>> & {
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
  Owner<S, WIN, ROUT, WOUT, ResultOk<ROUT>> & {
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
  Owner<S, WIN, ROUT, WOUT, ResultOk<ROUT>> & {
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
  Owner<S, WIN, ROUT, WOUT, ResultOk<ROUT>> & {
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
  Owner<S, WIN, ROUT, WOUT, SR<ROUT>> & {
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
  Owner<S, WIN, ROUT, WOUT, SR<ROUT>> & {
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
  Owner<S, WIN, ROUT, WOUT, SR<ROUT>> & {
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
  Owner<S, WIN, ROUT, WOUT, SR<ROUT>> & {
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
  implements Owner<S, WIN, ROUT, WOUT, RROUT>
{
  constructor(
    rok: boolean,
    writable: boolean,
    state: S,
    transform_read?: (value: StateInferResult<S>) => RROUT,
    transform_write?: {
      wout_win: (val: WOUT) => WIN;
      win_wout: (val: WIN) => WOUT;
    },
  ) {
    super();
    this.#rok = rok;
    this.#writable = writable;
    this.#state = state;
    if (transform_read) this.transform_read = transform_read;
    if (transform_write) {
      this.transform_wout_win = transform_write.wout_win;
      this.transform_win_wout = transform_write.win_wout;
    }
  }

  #rok: boolean;
  #writable: boolean;
  #state: S;
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
  private transform_wout_win(value: WOUT): WIN {
    return value as unknown as WIN;
  }
  private transform_win_wout(value: WIN): WOUT {
    return value as unknown as WOUT;
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
  set_transform_write(
    wout_win: (val: WOUT) => WIN,
    win_wout: (val: WIN) => WOUT,
  ) {
    this.transform_wout_win = wout_win;
    this.transform_win_wout = win_wout;
  }
  get state() {
    return this as State<ROUT, OptionNone, WOUT>;
  }
  get read_only() {
    return this as State<ROUT, OptionNone, WOUT>;
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
      return sync_reject(error as any);
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
  write(value: WOUT): PromiseLike<SR<void>> {
    if (!this.#writable || !this.#state.write)
      return sync_resolve(err("not writable"));
    return this.#state.write(this.transform_wout_win(value));
  }

  //@ts-expect-error typescript workaround
  get limit(): ((value: WOUT) => PromiseLike<SR<WOUT>>) | undefined {
    const limit = this.#state.limit?.bind(this.#state);
    return limit
      ? (value) => {
          if (!this.#writable) return sync_resolve(err("not writable"));
          return limit(this.transform_wout_win(value)).then((res) => {
            if (res.err) return err(res.error);
            return ok(this.transform_win_wout(res.value));
          });
        }
      : undefined;
  }
  //@ts-expect-error typescript workaround
  get check(): ((value: WOUT) => PromiseLike<SR<WOUT>>) | undefined {
    const check = this.#state.check?.bind(this.#state);
    return check
      ? (value) => {
          if (!this.#writable) return sync_resolve(err("not writable"));
          return check(this.transform_wout_win(value)).then((res) => {
            if (res.err) return err(res.error);
            return ok(this.transform_win_wout(res.value));
          });
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

/**Creates a proxy state which mirrors another state, with an optional transform function.
 * @param state - state to proxy.
 * @param transform_read - Function to transform value of proxy*/
function roaw_from<
  S extends StateREAW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => ResultOk<ROUT>,
  transform_write?: {
    wout_win: (val: WOUT) => WIN;
    win_wout: (val: WIN) => WOUT;
  },
): StateProxyROAW<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, ResultOk<ROUT>>(
    true,
    true,
    state,
    transform_read,
    transform_write,
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
/**Creates a proxy state which mirrors another state, with an optional transform function.
 * @param state - state to proxy.
 * @param transform_read - Function to transform value of proxy*/
function rosw_from<
  S extends StateRESW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => ResultOk<ROUT>,
  transform_write?: {
    wout_win: (val: WOUT) => WIN;
    win_wout: (val: WIN) => WOUT;
  },
): StateProxyROSW<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, ResultOk<ROUT>>(
    true,
    true,
    state,
    transform_read,
    transform_write,
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
/**Creates a proxy state which mirrors another state, with an optional transform function.
 * @param state - state to proxy.
 * @param transform_read - Function to transform value of proxy*/
function reaw_from<
  S extends StateREAW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => SR<ROUT>,
  transform_write?: {
    wout_win: (val: WOUT) => WIN;
    win_wout: (val: WIN) => WOUT;
  },
): StateProxyREAW<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, SR<ROUT>>(
    false,
    true,
    state,
    transform_read,
    transform_write,
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

/**Creates a proxy state which mirrors another state, with an optional transform function.
 * @param state - state to proxy.
 * @param transform_read - Function to transform value of proxy*/
function resw_from<
  S extends StateRESW<RIN, any, WIN>,
  RIN = S extends State<infer RT> ? RT : never,
  WIN = S extends State<any, any, infer WT> ? WT : any,
  ROUT = RIN,
  WOUT = WIN,
>(
  state: S,
  transform_read?: (value: StateInferResult<S>) => SR<ROUT>,
  transform_write?: {
    wout_win: (val: WOUT) => WIN;
    win_wout: (val: WIN) => WOUT;
  },
): StateProxyRESW<S, RIN, WIN, ROUT, WOUT> {
  return new RXXX<S, RIN, WIN, ROUT, WOUT, SR<ROUT>>(
    false,
    true,
    state,
    transform_read,
    transform_write,
  ) as StateProxyRESW<S, RIN, WIN, ROUT, WOUT>;
}

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
};
