import {
  is_promise_like,
  sync_reject,
  sync_resolve,
} from "#common";
import {
  err,
  none,
  ok,
  OptionNone,
  ResultInferOk,
  ResultOk,
} from "#result";
import { StateBase } from "./base";
import { StateNoHelper as NoHelper, StateHelperBase } from "./helpers/helpers";
import {
  StateHelper as Helper,
  HelperRelated as HELToREL,
  StateResult as SR,
  StateROA,
  StateROAW,
  type State,
  type StateREA,
  type StateREAW,
} from "./types";

//##################################################################################################################################################
//      _________     _______  ______  _____
//     |__   __\ \   / /  __ \|  ____|/ ____|
//        | |   \ \_/ /| |__) | |__  | (___
//        | |    \   / |  ___/|  __|  \___ \
//        | |     | |  | |    | |____ ____) |
//        |_|     |_|  |_|    |______|_____/
export interface StateRemoteOwner<
  RRT extends SR<any>,
  WT,
  HEL extends Helper<RRT, WT, any>,
> {
  /**Updates the value and fulfills all promises for value
   * @param update if true, also updates the buffer and notifies subscribers, otherwise only fulfills the promises for single gets*/
  update_single(value: RRT, update?: boolean): void;
  /**Updates the value subscribers and buffer with the given value*/
  update_value(value: RRT): void;
  /**Gets the current buffer value*/
  get buffer(): RRT | undefined;
  get state(): State<ResultInferOk<RRT>, HELToREL<HEL>, WT>;
  /**Sets the state that decides if writing is allowed right now, undefined removes the gate */
  set_write_enabled(gate: State<boolean> | undefined): void;
}

export type StateRemoteFuncROA<
  RT,
  HEL extends Helper<ResultOk<RT>, WT, any> = NoHelper,
  WT = any,
> = StateROA<RT, HELToREL<HEL>, WT> &
  StateRemoteOwner<ResultOk<RT>, WT, HELToREL<HEL>> & {
    readonly read_only: StateROA<RT, HELToREL<HEL>, WT>;
    readonly read_write?: StateROAW<RT, HELToREL<HEL>, WT>;
  };

export type StateRemoteFuncREA<
  RT,
  HEL extends Helper<SR<RT>, WT, any> = NoHelper,
  WT = any,
> = StateREA<RT, HELToREL<HEL>, WT> &
  StateRemoteOwner<SR<RT>, WT, HEL> & {
    readonly read_only: StateREA<RT, HELToREL<HEL>, WT>;
    readonly read_write?: StateREAW<RT, HELToREL<HEL>, WT>;
  };

export type StateRemoteFuncROAW<
  RT,
  HEL extends Helper<ResultOk<RT>, WT, any> = NoHelper,
  WT = RT,
> = StateROAW<RT, HELToREL<HEL>, WT> &
  StateRemoteOwner<ResultOk<RT>, WT, HELToREL<HEL>> & {
    readonly read_only: StateROA<RT, HELToREL<HEL>, WT>;
    readonly read_write: StateROAW<RT, HELToREL<HEL>, WT>;
  };

export type StateRemoteFuncREAW<
  RT,
  HEL extends Helper<SR<RT>, WT, any> = NoHelper,
  WT = RT,
> = StateREAW<RT, HELToREL<HEL>, WT> &
  StateRemoteOwner<SR<RT>, WT, HELToREL<HEL>> & {
    readonly read_only: StateREA<RT, HELToREL<HEL>, WT>;
    readonly read_write: StateREAW<RT, HELToREL<HEL>, WT>;
  };

//##################################################################################################################################################
//      ____           _____ ______    _____ _                _____ _____
//     |  _ \   /\    / ____|  ____|  / ____| |        /\    / ____/ ____|
//     | |_) | /  \  | (___ | |__    | |    | |       /  \  | (___| (___
//     |  _ < / /\ \  \___ \|  __|   | |    | |      / /\ \  \___ \\___ \
//     | |_) / ____ \ ____) | |____  | |____| |____ / ____ \ ____) |___) |
//     |____/_/    \_\_____/|______|  \_____|______/_/    \_\_____/_____/

/**State Remote
 * state for representing a remote resource
 *
 * Debounce and Timout
 * example if the debounce is set to 50 and timeout to 200
 * singleGet will not be called until 50 ms after the first await of the state
 * when singleGet returns a Result, it is returned to all awaiters then buffered for the period of the timeout
 * any awaiters within the timeout will get the buffer, after that it starts over
 *
 * Debounce and Retention
 * When a subscriber is added the debounce delay is added before setupConnection is called
 * likevise when the last subscriber unsubscribes the retention delay is added before teardownConnection is called
 * this can prevent unneeded calls if the user is switching around quickly between things referencing states
 * @template RT - The type of the state’s value when read.
 * @template RRT - The type of the state’s result
 * @template REL - The type of related states, defaults to an empty object.*/
export abstract class StateRemote<
  RRT extends SR<any>,
  WT,
  HEL extends Helper<RRT, WT, OptionNone>,
>
  extends StateBase<RRT, WT, HELToREL<HEL>>
  implements StateRemoteOwner<RRT, WT, HEL>
{
  #valid: number | true = 0;
  #fetching: boolean = false;
  #buffer?: RRT;
  #retention_timout: ReturnType<typeof setTimeout> | 0 = 0;
  #debounce_timout: ReturnType<typeof setTimeout> | 0 = 0;
  #timeout_timout: ReturnType<typeof setTimeout> | 0 = 0;
  #write_buffer?: WT;
  #write_debounce_timout: ReturnType<typeof setTimeout> | 0 = 0;
  #write_promises: ((val: SR<void>) => void)[] = [];

  /**How long to wait for single_get to deliver a value, after which the next await calls single_get again*/
  abstract get timeout(): number;

  /**Debounce delaying one time value retrival*/
  abstract get debounce(): number;

  /**Timeout for validity of last buffered value, true keeps it valid while connected, until teardown after retention*/
  abstract get validity(): number | true;

  /**Retention delay before remote performs teardown of connection is performed*/
  abstract get retention(): number;

  /**How long to debounce write calls, before the last write call is used*/
  abstract get write_debounce(): number;

  protected on_sub(): void {
    if (this.#retention_timout) {
      clearTimeout(this.#retention_timout);
      this.#retention_timout = 0;
    } else {
      if (this.debounce > 0)
        this.#debounce_timout = setTimeout(() => {
          this.setup_connection(this);
          this.#debounce_timout = 0;
        }, this.debounce);
      else this.setup_connection(this);
    }
  }

  protected on_unsub(): void {
    if (this.#debounce_timout) {
      clearTimeout(this.#debounce_timout);
      this.#debounce_timout = 0;
      this.#invalidate_connected();
    } else {
      if (this.retention > 0) {
        this.#retention_timout = setTimeout(() => {
          this.teardown_connection(this);
          this.#retention_timout = 0;
          this.#invalidate_connected();
        }, this.retention);
      } else {
        this.teardown_connection(this);
        this.#invalidate_connected();
      }
    }
  }

  /**A validity of true means valid while connected, so the buffer is invalidated when the connection ends, after retention*/
  #invalidate_connected(): void {
    if (this.validity === true) this.#valid = 0;
  }

  /**Called if the state is awaited, returns the value once*/
  protected abstract single_get(state: StateRemoteOwner<RRT, WT, HEL>): void;

  /**Called when state is subscribed to to setup connection to remote resource*/
  protected abstract setup_connection(
    state: StateRemoteOwner<RRT, WT, HEL>,
  ): void;

  /**Called when state is no longer subscribed to to cleanup connection to remote resource*/
  protected abstract teardown_connection(
    state: StateRemoteOwner<RRT, WT, HEL>,
  ): void;

  /**Called after write debounce finished with the last written value*/
  protected abstract write_action(
    value: WT,
    state: StateRemoteOwner<RRT, WT, HEL>,
  ): PromiseLike<SR<void>>;

  update_single(value: RRT, update: boolean = false) {
    this.#fetching = false;
    clearTimeout(this.#timeout_timout);
    this.ful_r_prom(value);
    if (update) {
      if (!this.#buffer?.compare(value)) this.update_subs(value);
      this.#buffer = value;
      this.#valid =
        this.validity === true ? true : performance.now() + this.validity;
    }
  }

  update_value(value: RRT) {
    if (!this.#buffer?.compare(value)) this.update_subs(value);
    this.#buffer = value;
    this.#valid =
      this.validity === true ? true : performance.now() + this.validity;
  }

  get buffer(): RRT | undefined {
    return this.#buffer;
  }

  get state() {
    return this as State<ResultInferOk<RRT>, any, WT>;
  }
  get read_only() {
    return this.read_only_view() as StateREA<ResultInferOk<RRT>, any, WT>;
  }
  get read_write() {
    return this.writable
      ? (this as State<ResultInferOk<RRT>, any, WT>)
      : undefined;
  }
  set_write_enabled(gate: State<boolean> | undefined): void {
    super.set_write_enabled(gate);
  }

  //#Reader Context
  abstract get rok(): boolean;

  get rsync(): false {
    return false;
  }
  then<TResult1 = RRT, TResult2 = never>(
    on_fulfilled?: ((value: RRT) => TResult1 | PromiseLike<TResult1>) | null,
    on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      if (this.#valid === true || this.#valid >= performance.now()) {
        const result = on_fulfilled
          ? on_fulfilled(this.#buffer!)
          : this.#buffer!;
        if (is_promise_like(result)) return result;
        return sync_resolve(result as TResult1);
      } else {
        const prom = this.append_r_prom(
          on_fulfilled ?? ((v) => v as unknown as TResult1),
        );
        if (!this.#fetching) {
          this.#fetching = true;
          this.#timeout_timout = setTimeout(() => {
            this.#fetching = false;
            //Ok states have no error value, their reads wait and the next read retries
            if (!this.rok)
              this.ful_r_prom(
                err(`No response within ${this.timeout}ms`) as RRT,
              );
          }, this.timeout);
          if (this.debounce > 0)
            setTimeout(() => this.single_get(this), this.debounce);
          else this.single_get(this);
        }
        return prom;
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

  //#Writer Context
  abstract get writable(): boolean;

  write(value: WT): PromiseLike<SR<void>> {
    return this.write_gated(() => this.#write_debounced(value));
  }

  #write_debounced(value: WT): PromiseLike<SR<void>> {
    this.#write_buffer = value;
    if (this.write_debounce === 0) return this.#write_action_safe(value);
    else if (this.#write_debounce_timout === 0)
      this.#write_debounce_timout = setTimeout(async () => {
        this.#write_debounce_timout = 0;
        const write_buffer = this.#write_buffer;
        this.#write_buffer = undefined;
        const promises = this.#write_promises;
        this.#write_promises = [];
        const res = await this.#write_action_safe(write_buffer!);
        promises.forEach((a) => a(res));
      }, this.write_debounce);
    return new Promise<SR<void>>((a) => {
      this.#write_promises.push(a);
    });
  }

  /**Runs write_action, a throwing write_action gives an error result as write never rejects*/
  async #write_action_safe(value: WT): Promise<SR<void>> {
    try {
      return await this.write_action(value, this);
    } catch (e) {
      return err(`Write failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

//##################################################################################################################################################
//      ______ _    _ _   _  _____ _______ _____ ____  _   _    _____ _                _____ _____
//     |  ____| |  | | \ | |/ ____|__   __|_   _/ __ \| \ | |  / ____| |        /\    / ____/ ____|
//     | |__  | |  | |  \| | |       | |    | || |  | |  \| | | |    | |       /  \  | (___| (___
//     |  __| | |  | | . ` | |       | |    | || |  | | . ` | | |    | |      / /\ \  \___ \\___ \
//     | |    | |__| | |\  | |____   | |   _| || |__| | |\  | | |____| |____ / ____ \ ____) |___) |
//     |_|     \____/|_| \_|\_____|  |_|  |_____\____/|_| \_|  \_____|______/_/    \_\_____/_____/

/**Alternative state resource which can be initialized with functions
 * @template RT - The type of the state’s value when read.
 * @template WT - The type which can be written to the state.
 * @template REL - The type of related states, defaults to an empty object.*/
class Func<
  RRT extends SR<any>,
  WT,
  HEL extends Helper<RRT, WT, OptionNone>,
> extends StateRemote<RRT, WT, HEL> {
  constructor(
    read_ok: boolean,
    once: (state: StateRemoteOwner<RRT, WT, HEL>) => void,
    setup: (state: StateRemoteOwner<RRT, WT, HEL>) => void,
    teardown: (state: StateRemoteOwner<RRT, WT, HEL>) => void,
    timeout: number,
    debounce: number,
    validity: number | true,
    retention: number,
    write_debounce?: number,
    write_action?: (
      value: WT,
      state: StateRemoteOwner<RRT, WT, HEL>,
    ) => PromiseLike<SR<void>>,
    helper?: HEL,
  ) {
    super();
    if (helper) this.#helper = helper;
    this.#rok = read_ok;
    this.single_get = once;
    this.setup_connection = setup;
    this.teardown_connection = teardown;
    this.#write_action = write_action;
    this.timeout = timeout;
    this.debounce = debounce;
    this.validity = validity;
    this.retention = retention;
    this.write_debounce = write_debounce || 0;
  }

  #helper?: StateHelperBase<any, any, any>;

  readonly timeout: number;
  readonly debounce: number;
  readonly validity: number | true;
  readonly retention: number;
  readonly write_debounce: number;

  #rok: boolean;
  #write_action?: (
    value: WT,
    state: StateRemoteOwner<RRT, WT, HEL>,
  ) => PromiseLike<SR<void>>;

  get rok(): boolean {
    return this.#rok;
  }

  /**Called if the state is awaited, returns the value once*/
  protected single_get(_state: StateRemoteOwner<RRT, WT, HEL>): void {}

  /**Called when state is subscribed to to setup connection to remote resource*/
  protected setup_connection(_state: StateRemoteOwner<RRT, WT, HEL>): void {}

  /**Called when state is no longer subscribed to to cleanup connection to remote resource*/
  protected teardown_connection(_state: StateRemoteOwner<RRT, WT, HEL>): void {}

  get writable(): boolean {
    return Boolean(this.#write_action);
  }

  protected write_action(
    value: WT,
    state: StateRemoteOwner<RRT, WT, HEL>,
  ): PromiseLike<SR<void>> {
    if (this.#write_action) return this.#write_action(value, state);
    else return sync_resolve(err("not writable"));
  }

  related(): HELToREL<HEL> {
    return (this.#helper?.related() ?? none()) as HELToREL<HEL>;
  }
  limit(value: WT): PromiseLike<SR<WT>> {
    return this.#helper?.limit(value) ?? sync_resolve(ok(value));
  }
  check(value: WT): PromiseLike<SR<WT>> {
    return this.write_gated(
      () => this.#helper?.check(value) ?? sync_resolve(ok(value)),
    );
  }
}

//##################################################################################################################################################
//       _____ ______ _   _ ______ _____         _______ ____  _____   _____
//      / ____|  ____| \ | |  ____|  __ \     /\|__   __/ __ \|  __ \ / ____|
//     | |  __| |__  |  \| | |__  | |__) |   /  \  | | | |  | | |__) | (___
//     | | |_ |  __| | . ` |  __| |  _  /   / /\ \ | | | |  | |  _  / \___ \
//     | |__| | |____| |\  | |____| | \ \  / ____ \| | | |__| | | \ \ ____) |
//      \_____|______|_| \_|______|_|  \_\/_/    \_\_|  \____/|_|  \_\_____/

/**Timing options for remote states initialized with functions, all times are in milliseconds*/
interface FuncTimes {
  /**How long to wait for once to deliver a value, after which the next await calls once again, defaults to 1000*/
  timeout?: number;
  /**Delay before once is called after the first await, and before setup is called after the first subscribe,
   * collects multiple requests into a single one, defaults to 0*/
  debounce?: number;
  /**How long the last retrived value is considered valid, true keeps it valid while connected, until teardown after retention, defaults to 0*/
  validity?: number | true;
  /**Delay after the last subscriber unsubscribes before teardown is called, to allow quick resubscribe without teardown, defaults to 0*/
  retention?: number;
}

/**Timing options for writable remote states initialized with functions, all times are in milliseconds*/
interface FuncWriteTimes extends FuncTimes {
  /**Debounce delay for write calls, only the last write within the delay is used, defaults to 0*/
  write_debounce?: number;
}

const rea = {
  /**Alternative state resource which can be initialized with functions
   * @template RT - The type of the state’s value when read.
   * @template HEL - Helper to limit and check written values and to give related states, defaults to none.
   * @param once function called when state value is requested once
   * @param setup function called when state has been subscribed to
   * @param teardown function called when state has been unsubscribed from completely
   * @param times timing of value retrival and connection setup and teardown
   * @param helper helper to limit and check written values and to give related states
   * */
  from<RT, HEL extends Helper<ResultOk<RT>, WT, any> = NoHelper, WT = any>(
    once: (state: StateRemoteOwner<SR<RT>, WT, HEL>) => void,
    setup: (state: StateRemoteOwner<SR<RT>, WT, HEL>) => void,
    teardown: (state: StateRemoteOwner<SR<RT>, WT, HEL>) => void,
    times?: FuncTimes,
    helper?: HEL,
  ) {
    return new Func<SR<RT>, WT, HEL>(
      false,
      once,
      setup,
      teardown,
      times?.timeout ?? 1000,
      times?.debounce ?? 0,
      times?.validity ?? 0,
      times?.retention ?? 0,
      undefined,
      undefined,
      helper,
    ) as StateRemoteFuncREA<RT, HEL, WT>;
  },
};

const roa = {
  /**Alternative state resource which can be initialized with functions
   * @template RT - The type of the state’s value when read.
   * @template HEL - Helper to limit and check written values and to give related states, defaults to none.
   * @param once function called when state value is requested once
   * @param setup function called when state has been subscribed to
   * @param teardown function called when state has been unsubscribed from completely
   * @param times timing of value retrival and connection setup and teardown
   * @param helper helper to limit and check written values and to give related states
   * */
  from<RT, HEL extends Helper<ResultOk<RT>, WT, any> = NoHelper, WT = any>(
    once: (state: StateRemoteOwner<ResultOk<RT>, WT, HEL>) => void,
    setup: (state: StateRemoteOwner<ResultOk<RT>, WT, HEL>) => void,
    teardown: (state: StateRemoteOwner<ResultOk<RT>, WT, HEL>) => void,
    times?: FuncTimes,
    helper?: HEL,
  ) {
    return new Func<ResultOk<RT>, WT, HEL>(
      true,
      once,
      setup,
      teardown,
      times?.timeout ?? 1000,
      times?.debounce ?? 0,
      times?.validity ?? 0,
      times?.retention ?? 0,
      undefined,
      undefined,
      helper,
    ) as StateRemoteFuncROA<RT, HEL, WT>;
  },
};

const reaw = {
  /**Alternative state resource which can be initialized with functions
   * @template RT - The type of the state’s value when read.
   * @template HEL - Helper to limit and check written values and to give related states, defaults to none.
   * @template WT - The type which can be written to the state.
   * @param once function called when state value is requested once, returns a Err(string) on failure
   * @param setup function called when state has been subscribed to
   * @param teardown function called when state has been unsubscribed from completely
   * @param write_action function called after write debounce finished with the last written value
   * @param times timing of value retrival, connection setup and teardown and writes
   * @param helper helper to limit and check written values and to give related states
   * */
  from<RT, HEL extends Helper<ResultOk<RT>, WT, any> = NoHelper, WT = RT>(
    once: (state: StateRemoteOwner<SR<RT>, WT, HEL>) => void,
    setup: (state: StateRemoteOwner<SR<RT>, WT, HEL>) => void,
    teardown: (state: StateRemoteOwner<SR<RT>, WT, HEL>) => void,
    write_action?: (
      value: WT,
      state: StateRemoteOwner<SR<RT>, WT, HEL>,
    ) => PromiseLike<SR<void>>,
    times?: FuncWriteTimes,
    helper?: HEL,
  ) {
    return new Func<SR<RT>, WT, HEL>(
      false,
      once,
      setup,
      teardown,
      times?.timeout ?? 1000,
      times?.debounce ?? 0,
      times?.validity ?? 0,
      times?.retention ?? 0,
      times?.write_debounce ?? 0,
      write_action,
      helper,
    ) as StateRemoteFuncREAW<RT, HEL, WT>;
  },
};

const roaw = {
  /**Alternative state resource which can be initialized with functions
   * @template RT - The type of the state’s value when read.
   * @template HEL - Helper to limit and check written values and to give related states, defaults to none.
   * @template WT - The type which can be written to the state.
   * @param once function called when state value is requested once, returns a Err(string) on failure
   * @param setup function called when state has been subscribed to
   * @param teardown function called when state has been unsubscribed from completely
   * @param write_action function called after write debounce finished with the last written value
   * @param times timing of value retrival, connection setup and teardown and writes
   * @param helper helper to limit and check written values and to give related states
   * */
  from<RT, HEL extends Helper<ResultOk<RT>, WT, any> = NoHelper, WT = RT>(
    once: (state: StateRemoteOwner<ResultOk<RT>, WT, HEL>) => void,
    setup: (state: StateRemoteOwner<ResultOk<RT>, WT, HEL>) => void,
    teardown: (state: StateRemoteOwner<ResultOk<RT>, WT, HEL>) => void,
    write_action?: (
      value: WT,
      state: StateRemoteOwner<ResultOk<RT>, WT, HEL>,
    ) => PromiseLike<SR<void>>,
    times?: FuncWriteTimes,
    helper?: HEL,
  ) {
    return new Func<ResultOk<RT>, WT, HEL>(
      true,
      once,
      setup,
      teardown,
      times?.timeout ?? 1000,
      times?.debounce ?? 0,
      times?.validity ?? 0,
      times?.retention ?? 0,
      times?.write_debounce ?? 0,
      write_action,
      helper,
    ) as StateRemoteFuncROAW<RT, HEL, WT>;
  },
};

//##################################################################################################################################################
//      ________   _______   ____  _____ _______ _____
//     |  ____\ \ / /  __ \ / __ \|  __ \__   __/ ____|
//     | |__   \ V /| |__) | |  | | |__) | | | | (___
//     |  __|   > < |  ___/| |  | |  _  /  | |  \___ \
//     | |____ / . \| |    | |__| | | \ \  | |  ____) |
//     |______/_/ \_\_|     \____/|_|  \_\ |_| |_____/

/**State that represent a remote resource*/
export const RESOURCE = {
  /**Extension class for making custom state resources */
  class: StateRemote,
  /**Remote resource */
  rea,
  /**Remote resource, guarenteed ok */
  roa,
  /**Remote resource with write cabability */
  reaw,
  /**Remote resource with write cabability, guarenteed ok */
  roaw,
};
