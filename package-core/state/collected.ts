import { sync_reject, sync_resolve } from "#common";
import {
  none,
  ok,
  OptionNone,
  ResultInferOk as RIOK,
  type ResultOk,
  err_nice,
} from "#result";
import { not_writable, state_errors } from "./errors";
import { STATE_DERIVED_KEY, StateBase, type StateDerivedSub } from "./base";
import {
  StateInferResult as SIR,
  StateResult as SR,
  StateREA,
  StateROA,
  StateSub,
  type State,
  type StateREAW,
  type StateRES,
  type StateRESW,
  type StateROAW,
  type StateROS,
  type StateROSW,
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

/**The plain values of the collected states, for the transform of the map forms like res_map*/
export type StateCollectedOkVal<IN extends State<any>[]> = {
  [I in keyof IN]: RIOK<SIR<IN[I]>>;
};

/**Writing of a writable collected state, each function gets the value and the collected states.
 * write sends the value on, usually by writing parts of it to the collected states.
 * check tells if a value can be written, limit gives the closest value that can, both give the value as it is when left out.
 * All three go through the write gate*/
export interface StateCollectedWrite<IN extends State<any>[], WT> {
  write(value: WT, states: IN): PromiseLike<SR<void>>;
  check?(value: WT, states: IN): PromiseLike<SR<WT>>;
  limit?(value: WT, states: IN): PromiseLike<SR<WT>>;
}

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

/**Owner of a writable collected state, it can gate its writes*/
interface WriteOwner {
  /**Sets the state that decides if writing is allowed right now, undefined removes the gate*/
  set_write_enabled(gate: State<boolean> | undefined): void;
}
export type StateCollectedROSW<
  RT,
  IN extends [StateRES<any>, ...StateRES<any>[]],
  WT,
> = StateROSW<RT, OptionNone, WT> &
  Owner<RT, IN, WT, ResultOk<RT>> &
  WriteOwner & {
    get read_only(): StateROS<RT, any, WT>;
  };
export type StateCollectedROAW<
  RT,
  IN extends [State<any>, ...State<any>[]],
  WT,
> = StateROAW<RT, OptionNone, WT> &
  Owner<RT, IN, WT, ResultOk<RT>> &
  WriteOwner & {
    get read_only(): StateROA<RT, any, WT>;
  };
export type StateCollectedRESW<RT, IN extends StateRES<any>[], WT> = StateRESW<
  RT,
  OptionNone,
  WT
> &
  Owner<RT, IN, WT, SR<RT>> &
  WriteOwner & {
    get read_only(): StateRES<RT, any, WT>;
  };
export type StateCollectedREAW<RT, IN extends State<any>[], WT> = StateREAW<
  RT,
  OptionNone,
  WT
> &
  Owner<RT, IN, WT, SR<RT>> &
  WriteOwner & {
    get read_only(): StateREA<RT, any, WT>;
  };

//Collected states tell their subscribers in a microtask, so changes of several of their states tell them once.
//One queue for all collected states: one microtask for all of them, and collected states of collected states,
//queued while it runs, are told in the same one
const collected_queue: ((() => void) | undefined)[] = [];
let collected_queued = 0;
/**Runs the queued jobs, also those queued while running.
 * The array keeps its size, emptying it would make V8 shrink and grow it again every flush*/
function flush_collected(): void {
  const queue = collected_queue;
  for (let i = 0; i < collected_queued; i++) {
    const job = queue[i]!;
    //Cleared so the queue does not keep the job and its collected state alive
    queue[i] = undefined;
    try {
      job();
    } catch (e) {
      console.error("Failed while telling the subscribers of a collected state ", e);
    }
  }
  collected_queued = 0;
}
/**Queues the job of a collected state, the first job queued schedules the flush.
 * Promise.resolve().then over queueMicrotask, it measured faster in Chromium and Node*/
function schedule_collected(job: () => void): void {
  collected_queue[collected_queued++] = job;
  if (collected_queued === 1) void Promise.resolve().then(flush_collected);
}

/**Gives a collected state its writing, internal so the constructor stays the same for subclasses*/
const SET_WRITE = Symbol("set_write");

/**A transform of the results made from a transform of plain values, the first error is passed on as it is*/
function ok_values<IN extends State<any>[], RT>(
  transform: (values: StateCollectedOkVal<IN>) => RT,
): (values: StateCollectedTransVal<IN>) => SR<RT> {
  return (values) => {
    const results = values as unknown as readonly SR<unknown>[];
    for (const result of results) if (result.err) return result;
    return ok(
      transform(
        //All are ok after the loop
        results.map(
          (result) => (result as ResultOk<unknown>).value,
        ) as StateCollectedOkVal<IN>,
      ),
    );
  };
}

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
  /**The values of the states and the subscribers to them, made on subscribe and dropped on unsubscribe,
   * so a collected state that is never subscribed has no arrays*/
  #state_buffers?: StateCollectedTransValUnk<IN>;
  #state_subscribers?: StateDerivedSub[];
  #subscription_id = 0;

  protected getter(values: StateCollectedTransVal<IN>): RRT {
    return values[0] as RRT;
  }

  /**Runs the getter on the buffered values, if the getter throws the error is logged and the last value is kept
   * @returns true if the getter succeeded*/
  #compute(): boolean {
    try {
      this.#buffer = this.getter(this.#values());
      return true;
    } catch (e) {
      console.error("Failed while calling collected getter ", e, this);
      return false;
    }
  }

  /**The buffered values of the states, a sync state that is stale is read with get*/
  #values(): StateCollectedTransVal<IN> {
    const buffers = this.#state_buffers as StateCollectedTransVal<IN>;
    //Only called while subscribed, when the buffers exist
    if (this.#stale_count === 0 || !this.#rsync) return buffers;
    const stale = this.#stale!;
    return buffers.map((value, i) =>
      stale[i] ? this.#states[i]!.get!() : value,
    ) as StateCollectedTransVal<IN>;
  }

  /**States that changed but have not told their value yet, see invalidate_derived.
   * Kept once made, stale_count says if any is stale*/
  #stale?: boolean[];
  #stale_count = 0;
  /**A state was invalidated, reads of it go through to it until it tells its value*/
  #invalidated(i: number): void {
    const stale = (this.#stale ??= []);
    if (!stale[i]) {
      stale[i] = true;
      this.#stale_count++;
    }
    this.#mark_dirty();
  }
  /**A state told its value, its buffer is current again*/
  #told(i: number): void {
    const stale = this.#stale;
    if (!stale?.[i]) return;
    stale[i] = false;
    this.#stale_count--;
  }
  /**Marks the buffer as older than the states, and tells the derived states of this one when it becomes so*/
  #mark_dirty(): void {
    if (this.#dirty) return;
    this.#dirty = true;
    this.invalidate_derived();
  }

  /**True when a state changed after the buffer was computed, while subscribed.
   * The subscribers are told in a microtask, so several changes run them once, reads in between recompute*/
  #dirty = false;
  /**Recomputes a dirty buffer, it stays dirty when the getter throws
   * @returns true if the buffer is current*/
  #refresh(): boolean {
    if (!this.#compute()) return false;
    this.#dirty = false;
    return true;
  }

  /**Called when subscriber is added*/
  protected on_sub() {
    this.#subscribe(false);
  }

  /**Subscribes to the states and computes the value
   * @param notify - true to tell the subscribers the new value, when resubscribing after the states or getter changed*/
  #subscribe(notify: boolean) {
    const subscription_id = ++this.#subscription_id;
    //Tells the subscribers once for all changes until the scheduled job runs, made once per subscription
    let scheduled = false;
    const job = () => {
      if (subscription_id !== this.#subscription_id) return;
      scheduled = false;
      //A read since the change may have recomputed it already
      if (this.#dirty && !this.#refresh()) return;
      this.update_subs(this.#buffer!);
    };
    const changed = () => {
      if (scheduled) return;
      scheduled = true;
      schedule_collected(job);
    };
    if (!this.#states.length) {
      this.#buffer = err_nice(
        state_errors.NO_STATES,
        "No states registered",
      ) as RRT;
      return;
    } else if (this.#rsync) {
      const buffers = (this.#state_buffers = this.#states.map((s) =>
        s.get!(),
      ) as StateCollectedTransValUnk<IN>);
      this.#buffer = this.getter(buffers as StateCollectedTransVal<IN>);
      if (notify) this.update_subs(this.#buffer);
      this.#state_subscribers = this.#states.map<StateDerivedSub>((s, i) => {
        const subscriber: StateDerivedSub = (value: SIR<IN[number]>) => {
          buffers[i] = value;
          this.#told(i);
          this.#mark_dirty();
          changed();
        };
        subscriber[STATE_DERIVED_KEY] = () => this.#invalidated(i);
        return s.sub(subscriber);
      });
    } else {
      const buffers = (this.#state_buffers = new Array(
        this.#states.length,
      ) as StateCollectedTransValUnk<IN>);
      //Updates are only buffered until all states have a value
      let initialized = false;
      let filled = 0;
      Promise.all(this.#states.map((s) => s.read())).then((vals) => {
        if (subscription_id !== this.#subscription_id) return;
        for (let i = 0; i < buffers.length; i++)
          buffers[i] = buffers[i]! ?? vals[i];
        initialized = true;
        if (!this.#compute()) return;
        if (notify) this.update_subs(this.#buffer!);
        this.ful_r_prom(this.#buffer!);
      });
      {
        this.#state_subscribers = this.#states.map<StateDerivedSub>((s, i) => {
          const subscriber: StateDerivedSub = (value: SIR<IN[number]>) => {
            if (!initialized) {
              if (buffers[i] === undefined) filled++;
              buffers[i] = value;
              if (filled < this.#states.length) return;
              initialized = true;
            } else buffers[i] = value;
            this.#told(i);
            this.#mark_dirty();
            changed();
          };
          //Before all states have a value there is no buffer to be stale
          subscriber[STATE_DERIVED_KEY] = () => {
            if (initialized) this.#invalidated(i);
          };
          return s.sub(subscriber);
        });
      }
    }
  }

  /**Called when subscriber is removed*/
  protected on_unsub() {
    this.#subscription_id++;
    this.#dirty = false;
    this.#stale = undefined;
    this.#stale_count = 0;
    const subscribers = this.#state_subscribers;
    if (subscribers)
      for (let i = 0; i < this.#states.length; i++)
        this.#states[i]!.unsub(subscribers[i] as any);
    this.#state_subscribers = undefined;
    this.#state_buffers = undefined;
    this.#buffer = undefined;
  }

  //#Owner
  set_states(...states: StateCollectedStates<IN>) {
    if (this.in_use()) {
      this.on_unsub();
      this.#states = [...states] as unknown as IN;
      this.#subscribe(true);
    } else this.#states = [...states] as unknown as IN;
  }
  set_getter(getter: (values: StateCollectedTransVal<IN>) => RRT) {
    if (this.in_use()) {
      this.on_unsub();
      this.getter = getter;
      this.#subscribe(true);
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
  read(): PromiseLike<RRT> {
    if (this.#dirty) {
      const stale = this.#stale;
      //Async states that are stale are read like without a subscriber, until they tell their value
      if (stale && this.#stale_count > 0 && !this.#rsync)
        return Promise.all(
          this.#states.map((s, i) =>
            stale[i] ? s.read() : sync_resolve(this.#state_buffers![i]),
          ),
        ).then((v) => this.getter(v as StateCollectedTransVal<IN>));
      this.#refresh();
    }
    if (this.#buffer) return sync_resolve(this.#buffer);
    if (this.#rsync) {
      try {
        return sync_resolve(this.get());
      } catch (error) {
        //The getter can throw
        return sync_reject(error);
      }
    }
    //Not subscribed, or subscribed without states
    if (!this.#state_buffers?.length)
      return Promise.all(this.#states.map((s) => s.read())).then((v) =>
        this.getter(v as StateCollectedTransVal<IN>),
      );
    return this.append_r_prom();
  }
  get(): RRT {
    if (this.#dirty) this.#refresh();
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
  #write?: StateCollectedWrite<IN, WT>;
  /**Makes the state writable, used by the writable factories*/
  [SET_WRITE](write: StateCollectedWrite<IN, WT>): this {
    this.#write = write;
    return this;
  }
  get writable(): boolean {
    return Boolean(this.#write);
  }
  set_write_enabled(gate: State<boolean> | undefined): void {
    super.set_write_enabled(gate);
  }
  write(value: WT): PromiseLike<SR<void>> {
    const write = this.#write;
    if (!write) return sync_resolve(not_writable());
    return this.write_gated(() => write.write(value, this.#states));
  }
  limit(value: WT): PromiseLike<SR<WT>> {
    const write = this.#write;
    if (!write) return sync_resolve(not_writable());
    return this.write_gated(
      () => write.limit?.(value, this.#states) ?? sync_resolve(ok(value)),
    );
  }
  check(value: WT): PromiseLike<SR<WT>> {
    const write = this.#write;
    if (!write) return sync_resolve(not_writable());
    return this.write_gated(
      () => write.check?.(value, this.#states) ?? sync_resolve(ok(value)),
    );
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
  /**Like res, the transform gets the plain values and gives a plain value, the first error of the states is passed on as it is.
   * @param transform - Function to translate the values of the collected states.
   * @param states - The states to collect.*/
  res_map<RT, IN extends StateRES<any>[], WT = any>(
    transform: (values: StateCollectedOkVal<IN>) => RT,
    ...states: IN
  ) {
    return COLLECTED.res<RT, IN, WT>(ok_values(transform), ...states);
  },
  /**Like rea, the transform gets the plain values and gives a plain value, the first error of the states is passed on as it is.
   * @param transform - Function to translate the values of the collected states.
   * @param states - The states to collect.*/
  rea_map<RT, IN extends State<any>[], WT = any>(
    transform: (values: StateCollectedOkVal<IN>) => RT,
    ...states: IN
  ) {
    return COLLECTED.rea<RT, IN, WT>(ok_values(transform), ...states);
  },
  /**Like ros, and writable through write, see StateCollectedWrite.
   * @param transform - Function to translate value of collected states, false means first states values is used.
   * @param write - Writes, checks and limits a value, given the collected states.
   * @param states - The states to collect.*/
  rosw<RT, IN extends [StateRES<any>, ...StateRES<any>[]], WT = RT>(
    transform: ((values: StateCollectedTransVal<IN>) => ResultOk<RT>) | false,
    write: StateCollectedWrite<IN, WT>,
    ...states: IN
  ) {
    return new RXX<RT, IN, WT, ResultOk<RT>>(true, true, transform, ...states)[
      SET_WRITE
    ](write) as unknown as StateCollectedROSW<RT, IN, WT>;
  },
  /**Like roa, and writable through write, see StateCollectedWrite.
   * @param transform - Function to translate value of collected states, false means first states values is used.
   * @param write - Writes, checks and limits a value, given the collected states.
   * @param states - The states to collect.*/
  roaw<RT, IN extends [State<any>, ...State<any>[]], WT = RT>(
    transform: ((values: StateCollectedTransVal<IN>) => ResultOk<RT>) | false,
    write: StateCollectedWrite<IN, WT>,
    ...states: IN
  ) {
    return new RXX<RT, IN, WT, ResultOk<RT>>(true, false, transform, ...states)[
      SET_WRITE
    ](write) as unknown as StateCollectedROAW<RT, IN, WT>;
  },
  /**Like res, and writable through write, see StateCollectedWrite.
   * @param transform - Function to translate value of collected states, false means first states values is used.
   * @param write - Writes, checks and limits a value, given the collected states.
   * @param states - The states to collect.*/
  resw<RT, IN extends StateRES<any>[], WT = RT>(
    transform: ((values: StateCollectedTransVal<IN>) => SR<RT>) | false,
    write: StateCollectedWrite<IN, WT>,
    ...states: IN
  ) {
    return new RXX<RT, IN, WT, SR<RT>>(false, true, transform, ...states)[
      SET_WRITE
    ](write) as unknown as StateCollectedRESW<RT, IN, WT>;
  },
  /**Like rea, and writable through write, see StateCollectedWrite.
   * @param transform - Function to translate value of collected states, false means first states values is used.
   * @param write - Writes, checks and limits a value, given the collected states.
   * @param states - The states to collect.*/
  reaw<RT, IN extends State<any>[], WT = RT>(
    transform: ((values: StateCollectedTransVal<IN>) => SR<RT>) | false,
    write: StateCollectedWrite<IN, WT>,
    ...states: IN
  ) {
    return new RXX<RT, IN, WT, SR<RT>>(false, false, transform, ...states)[
      SET_WRITE
    ](write) as unknown as StateCollectedREAW<RT, IN, WT>;
  },
  /**Like resw, the transform gets the plain values and gives a plain value, the first error of the states is passed on as it is.
   * @param transform - Function to translate the values of the collected states.
   * @param write - Writes, checks and limits a value, given the collected states.
   * @param states - The states to collect.*/
  resw_map<RT, IN extends StateRES<any>[], WT = RT>(
    transform: (values: StateCollectedOkVal<IN>) => RT,
    write: StateCollectedWrite<IN, WT>,
    ...states: IN
  ) {
    return COLLECTED.resw<RT, IN, WT>(ok_values(transform), write, ...states);
  },
  /**Like reaw, the transform gets the plain values and gives a plain value, the first error of the states is passed on as it is.
   * @param transform - Function to translate the values of the collected states.
   * @param write - Writes, checks and limits a value, given the collected states.
   * @param states - The states to collect.*/
  reaw_map<RT, IN extends State<any>[], WT = RT>(
    transform: (values: StateCollectedOkVal<IN>) => RT,
    write: StateCollectedWrite<IN, WT>,
    ...states: IN
  ) {
    return COLLECTED.reaw<RT, IN, WT>(ok_values(transform), write, ...states);
  },
  class: RXX,
};
