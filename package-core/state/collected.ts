import {
  is_promise_like,
  sync_reject,
  sync_resolve,
} from "#common";
import {
  err,
  none,
  OptionNone,
  ResultInferOk as RIOK,
  type ResultOk,
} from "#result";
import { StateBase } from "./base";
import {
  StateInferResult as SIR,
  StateResult as SR,
  StateREA,
  StateROA,
  StateSub,
  type State,
  type StateRES,
  type StateROS,
} from "./types";

//##################################################################################################################################################
//      _________     _______  ______  _____
//     |__   __\ \   / /  __ \|  ____|/ ____|
//        | |   \ \_/ /| |__) | |__  | (___
//        | |    \   / |  ___/|  __|  \___ \
//        | |     | |  | |    | |____ ____) |
//        |_|     |_|  |_|    |______|_____/
export type StateCollectedTransVal<IN extends State<any>[]> = {
  [I in keyof IN]: SIR<IN[I]>;
};

export type StateCollectedTransValUnk<IN extends State<any>[]> = {
  [I in keyof IN]: IN[I] extends StateROA<infer RT>
    ? ResultOk<RT>
    : IN[I] extends StateREA<infer RT>
      ? SR<RT>
      : unknown;
};

export type StateCollectedSubs<IN extends State<any>[]> = {
  [I in keyof IN]: StateSub<SIR<IN[I]>>;
};

export type StateCollectedStates<IN extends State<any>[]> = {
  [I in keyof IN]: IN[I] extends StateROA<infer RT>
    ? StateROA<RT>
    : IN[I] extends StateREA<infer RT>
      ? StateREA<RT>
      : never;
};

interface Owner<RT, IN extends State<any>[], WT, RRT extends SR<RT>> {
  /**The `setStates` method is used to update the states used by the `StateDerived` class.
   * @param states - The new states. This function should accept an array of states and return the derived state.*/
  set_states(...states: StateCollectedStates<IN>): void;
  /**The `setGetter` method is used to update the getter function used by the `StateDerived` class.
   * This function is used to compute the derived state based on the current states.
   * @param getter - The new getter function. This function should accept an array of states and return the derived state.*/
  set_getter(getter: (values: StateCollectedTransVal<IN>) => RRT): void;
  get state(): State<RT, any, WT>;
}
export type StateCollectedROS<
  RT,
  IN extends [StateRES<any>, ...StateRES<any>[]],
  WT = any,
> = StateROS<RT, OptionNone, WT> &
  Owner<RT, IN, WT, ResultOk<RT>> & {
    get read_only(): StateROS<RT, any, WT>;
  };

export type StateCollectedROA<
  RT,
  IN extends [State<any>, ...State<any>[]],
  WT = any,
> = StateROA<RT, OptionNone, WT> &
  Owner<RT, IN, WT, ResultOk<RT>> & {
    get read_only(): StateROA<RT, any, WT>;
  };

export type StateCollectedRES<
  RT,
  IN extends StateRES<any>[],
  WT = any,
> = StateRES<RT, OptionNone, WT> &
  Owner<RT, IN, WT, SR<RT>> & {
    get read_only(): StateRES<RT, any, WT>;
  };

export type StateCollectedREA<RT, IN extends State<any>[], WT = any> = StateREA<
  RT,
  OptionNone,
  WT
> &
  Owner<RT, IN, WT, SR<RT>> & {
    get read_only(): StateREA<RT, any, WT>;
  };

//##################################################################################################################################################
//       _____ _                _____ _____
//      / ____| |        /\    / ____/ ____|
//     | |    | |       /  \  | (___| (___
//     | |    | |      / /\ \  \___ \\___ \
//     | |____| |____ / ____ \ ____) |___) |
//      \_____|______/_/    \_\_____/_____/

export class RXX<RT, IN extends State<any>[], WT, RRT extends SR<RT>>
  extends StateBase<RRT, WT, OptionNone>
  implements Owner<RT, IN, WT, RRT>
{
  constructor(
    rok: boolean,
    rsync: boolean,
    transform: ((values: StateCollectedTransVal<IN>) => RRT) | false,
    ...states: IN
  ) {
    super();
    this.#rok = rok;
    this.#rsync = rsync;
    if (transform) this.getter = transform;
    this.#states = states;
  }

  #rok: boolean;
  #rsync: boolean;
  #buffer?: RRT;
  #states: IN;
  #state_buffers: StateCollectedTransValUnk<IN> =
    [] as StateCollectedTransValUnk<IN>;
  #state_subscribers: StateCollectedSubs<IN>[] = [];
  #subscription_id = 0;

  protected getter(values: StateCollectedTransVal<IN>): RRT {
    return values[0] as RRT;
  }

  /**Runs the getter on the buffered values, if the getter throws the error is logged and the last value is kept
   * @returns true if the getter succeeded*/
  #compute(): boolean {
    try {
      this.#buffer = this.getter(
        this.#state_buffers as StateCollectedTransVal<IN>,
      );
      return true;
    } catch (e) {
      console.error("Failed while calling collected getter ", e, this);
      return false;
    }
  }

  /**Called when subscriber is added*/
  protected on_sub() {
    const subscription_id = ++this.#subscription_id;
    if (!this.#states.length) {
      this.#buffer = err("No states registered") as RRT;
      return;
    } else if (this.#rsync) {
      //Correct size of buffer array
      this.#state_buffers.length = this.#states.length;
      this.#state_buffers = this.#states.map((s) =>
        s.get!(),
      ) as StateCollectedTransVal<IN>;
      this.#buffer = this.getter(
        this.#state_buffers as StateCollectedTransVal<IN>,
      );
      this.update_subs(this.#buffer);
      let calc = false;
      this.#states.forEach((s, i) => {
        this.#state_subscribers[i] = s.sub((value) => {
          this.#state_buffers[i] = value;
          if (!calc) {
            calc = true;
            Promise.resolve().then(() => {
              if (subscription_id !== this.#subscription_id) return;
              calc = false;
              if (this.#compute()) this.update_subs(this.#buffer!);
            });
          }
        });
      });
    } else {
      //Correct size of buffer array
      this.#state_buffers.length = this.#states.length;
      //Updates are only buffered until all states have a value
      let initialized = false;
      let filled = 0;
      Promise.all(this.#states).then((vals) => {
        if (subscription_id !== this.#subscription_id) return;
        for (let i = 0; i < this.#state_buffers.length; i++)
          this.#state_buffers[i] = this.#state_buffers[i]! ?? vals[i];
        initialized = true;
        if (this.#compute()) this.ful_r_prom(this.#buffer!);
      });
      //Creates a new scope to hold the calc variable
      {
        let calc = false;
        this.#state_subscribers = this.#states.map((s, i) =>
          s.sub((value) => {
            if (!initialized) {
              if (this.#state_buffers[i] === undefined) filled++;
              this.#state_buffers[i] = value;
              if (filled < this.#states.length) return;
              initialized = true;
            } else this.#state_buffers[i] = value;
            if (!calc) {
              calc = true;
              Promise.resolve().then(() => {
                if (subscription_id !== this.#subscription_id) return;
                calc = false;
                if (this.#compute()) this.update_subs(this.#buffer!);
              });
            }
          }),
        );
      }
    }
  }

  /**Called when subscriber is removed*/
  protected on_unsub() {
    this.#subscription_id++;
    for (let i = 0; i < this.#states.length; i++)
      this.#states[i]!.unsub(this.#state_subscribers[i] as any);
    this.#state_subscribers = [];
    this.#state_buffers = [] as StateCollectedTransVal<IN>;
    this.#buffer = undefined;
  }

  //#Owner
  set_states(...states: StateCollectedStates<IN>) {
    if (this.in_use()) {
      this.on_unsub();
      this.#states = [...states] as unknown as IN;
      this.on_sub();
    } else this.#states = [...states] as unknown as IN;
  }
  set_getter(getter: (values: StateCollectedTransVal<IN>) => RRT) {
    if (this.in_use()) {
      this.on_unsub();
      this.getter = getter;
      this.on_sub();
    } else this.getter = getter;
  }
  get state() {
    return this as State<RT, any, WT>;
  }
  get read_only() {
    return this.read_only_view() as StateROS<RT, any, WT>;
  }

  //#Reader Context
  get rok(): boolean {
    return this.#rok;
  }
  get rsync(): boolean {
    return this.#rsync;
  }
  then<TResult1 = RRT, TResult2 = never>(
    on_fulfilled?: ((value: RRT) => TResult1 | PromiseLike<TResult1>) | null,
    on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      if (this.#buffer) {
        const result = on_fulfilled ? on_fulfilled(this.#buffer) : this.#buffer;
        if (is_promise_like(result)) return result;
        return sync_resolve(result as TResult1);
      }
      if (this.#rsync) {
        const result = on_fulfilled ? on_fulfilled(this.get()) : this.get();
        if (is_promise_like(result)) return result;
        return sync_resolve(result as TResult1);
      }
      if (!this.#state_buffers.length) {
        return Promise.all(this.#states).then((v) => {
          const result = on_fulfilled
            ? on_fulfilled(this.getter(v as StateCollectedTransVal<IN>))
            : this.getter(v as StateCollectedTransVal<IN>);
          if (is_promise_like(result)) return result;
          return sync_resolve(result as TResult1);
        });
      }
      return new Promise((resolve, reject) => {
        this.append_r_prom(on_fulfilled ?? ((v) => v as unknown as TResult1))
          .then(resolve)
          .catch(reject);
      });
    } catch (error) {
      if (on_rejected) {
        const rejected_result = on_rejected(error);
        if (is_promise_like(rejected_result)) return rejected_result;
        return sync_resolve(rejected_result);
      }
      return sync_reject(error);
    }
  }
  get(): RRT {
    if (this.#buffer) return this.#buffer;
    return this.getter(
      this.#states.map((s) => s.get!()) as StateCollectedTransVal<IN>,
    );
  }
  ok(): RIOK<RRT> {
    return (this.get() as ResultOk<RIOK<RRT>>).value;
  }
  related(): OptionNone {
    return none();
  }

  //#Writer Context
  get writable(): false {
    return false;
  }
  limit(_value: WT): PromiseLike<SR<WT>> {
    return sync_resolve(err("not writable"));
  }
  check(_value: WT): PromiseLike<SR<WT>> {
    return sync_resolve(err("not writable"));
  }
}

export const COLLECTED = {
  /**Creates a guarenteed ok state that collects multiple states values and reduces it to one.
   * @param transform - Function to translate value of collected states, false means first states values is used.
   * @param states - The states to collect.*/
  ros<RT, IN extends [StateRES<any>, ...StateRES<any>[]], WT = any>(
    transform: ((values: StateCollectedTransVal<IN>) => ResultOk<RT>) | false,
    ...states: IN
  ) {
    return new RXX<RT, IN, WT, ResultOk<RT>>(
      true,
      true,
      transform,
      ...states,
    ) as StateCollectedROS<RT, IN, WT>;
  },
  /**Creates a guarenteed ok state that collects multiple states values and reduces it to one.
   * @param transform - Function to translate value of collected states, false means first states values is used.
   * @param states - The states to collect.*/
  roa<RT, IN extends [State<any>, ...State<any>[]], WT = any>(
    transform: ((values: StateCollectedTransVal<IN>) => ResultOk<RT>) | false,
    ...states: IN
  ) {
    return new RXX<RT, IN, WT, ResultOk<RT>>(
      true,
      false,
      transform,
      ...states,
    ) as StateCollectedROA<RT, IN, WT>;
  },
  /**Creates a state that collects multiple states values and reduces it to one.
   * @param transform - Function to translate value of collected states, false means first states values is used.
   * @param states - The states to collect.*/
  res<RT, IN extends StateRES<any>[], WT = any>(
    transform: ((values: StateCollectedTransVal<IN>) => SR<RT>) | false,
    ...states: IN
  ) {
    return new RXX<RT, IN, WT, SR<RT>>(
      false,
      true,
      transform,
      ...states,
    ) as StateCollectedRES<RT, IN, WT>;
  },
  /**Creates a state that collects multiple states values and reduces it to one.
   * @param transform - Function to translate value of collected states, false means first states values is used.
   * @param states - The states to collect.*/
  rea<RT, IN extends State<any>[], WT = any>(
    transform: ((values: StateCollectedTransVal<IN>) => SR<RT>) | false,
    ...states: IN
  ) {
    return new RXX<RT, IN, WT, SR<RT>>(
      false,
      false,
      transform,
      ...states,
    ) as StateCollectedREA<RT, IN, WT>;
  },
  class: RXX,
};
