import { sync_resolve } from "#common";
import {
  err,
  none,
  ok,
  Option,
  OptionNone,
  ResultInferOk,
  ResultOk,
} from "#result";
import { IS } from "./helpers/is";
import {
  StateResult as SR,
  STATE_KEY,
  STATE_VIEWER_OVERRIDE_KEY,
  StateRelated,
  type State,
  type StateBase as Base,
  type StateSub,
} from "./types";

export abstract class StateBase<
  RRT extends SR<any>,
  WT,
  REL extends Option<StateRelated>,
> implements Base<RRT, REL, WT> {
  get [STATE_KEY](): true {
    return true;
  }

  //#Reader Context
  abstract then<TResult1 = RRT, TResult2 = never>(
    on_fulfilled?: ((value: RRT) => TResult1 | PromiseLike<TResult1>) | null,
    on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;

  async to_json(): Promise<string> {
    return result_to_json(await this, "state");
  }

  abstract readonly rsync: boolean;
  get?(): RRT;

  abstract readonly rok: boolean;
  ok?(): ResultInferOk<RRT>;

  abstract related(): REL;

  #subscribers: Set<StateSub<RRT>> = new Set();
  sub<T = StateSub<RRT>>(func: StateSub<RRT>, update?: boolean): T {
    if (this.#subscribers.has(func)) {
      console.error("Function already registered as subscriber", this, func);
      return func as T;
    }
    if (this.#subscribers.size === 0) this.on_sub();
    this.#subscribers.add(func);
    if (update) this.then(func);
    return func as T;
  }
  unsub<T = StateSub<RRT>>(func: T): T {
    if (this.#subscribers.delete(func as StateSub<RRT>)) {
      if (this.#subscribers.size == 0) this.on_unsub();
    } else console.error("Subscriber not found with state", this, func);
    return func;
  }

  in_use(): this | undefined {
    return this.#subscribers.size > 0 ? this : undefined;
  }
  has(subscriber: StateSub<RRT>): this | undefined {
    return this.#subscribers.has(subscriber) ? this : undefined;
  }
  amount(): number {
    return this.#subscribers.size;
  }

  //#Writer Context
  abstract readonly writable: boolean;
  write?(value: WT): PromiseLike<SR<void>>;
  abstract limit(value: WT): PromiseLike<SR<WT>>;
  abstract check(value: WT): PromiseLike<SR<WT>>;

  #write_enabled?: State<boolean>;
  /**State that decides if writing is allowed right now, undefined when writing is not gated*/
  get write_enabled(): State<boolean> | undefined {
    return this.#write_enabled;
  }
  /**Sets the state that decides if writing is allowed right now, undefined removes the gate.
   * Subclasses that allow it make this public, and must run their writes through write_gated*/
  protected set_write_enabled(gate: State<boolean> | undefined): void {
    this.#write_enabled = gate;
  }
  /**Runs func when the write gate allows writing, otherwise resolves to a not writable error*/
  protected write_gated<T>(func: () => PromiseLike<SR<T>>): PromiseLike<SR<T>> {
    const gate = this.#write_enabled;
    if (!gate) return func();
    return gate.then((res) =>
      res.ok && res.value ? func() : err("not writable"),
    );
  }

  #read_only?: StateReadOnly<RRT, WT, REL>;
  /**Returns the read only view of this state, created on first use*/
  protected read_only_view(): StateReadOnly<RRT, WT, REL> {
    return (this.#read_only ??= new StateReadOnly(this));
  }

  /**Called when first subscriber is added*/
  protected on_sub(): void {}
  /**Called when last subscriber is removed*/
  protected on_unsub(): void {}

  /**Updates all subscribers with a value */
  protected update_subs(value: RRT): void {
    for (const subscriber of this.#subscribers) {
      try {
        subscriber(value);
      } catch (e) {
        console.error("Failed while calling subscribers ", e, this, subscriber);
      }
    }
  }

  //Promises
  #read_promises?: ((val: RRT) => void)[];
  /**Creates a promise which can be fulfilled later with fulRProm */
  protected async append_r_prom<TResult1 = RRT>(
    func: (value: RRT) => TResult1 | PromiseLike<TResult1>,
  ): Promise<TResult1> {
    return func(
      await new Promise<RRT>((a) => {
        (this.#read_promises ??= []).push(a);
      }),
    );
  }
  /**Fulfills all read promises with given value */
  protected ful_r_prom(value: RRT): RRT {
    if (this.#read_promises) this.#read_promises.forEach((f) => f(value));
    this.#read_promises = [];
    return value;
  }
}

//##################################################################################################################################################
//      _____  ______          _____     ____  _   _ _  __     __
//     |  __ \|  ____|   /\   |  __ \   / __ \| \ | | | \ \   / /
//     | |__) | |__     /  \  | |  | | | |  | |  \| | |  \ \_/ /
//     |  _  /|  __|   / /\ \ | |  | | | |  | | . ` | |   \   /
//     | | \ \| |____ / ____ \| |__| | | |__| | |\  | |____| |
//     |_|  \_\______/_/    \_\_____/   \____/|_| \_|______|_|

/**Read only view of a state, forwards reading to the state and has no way to write.
 * Subscribers are added to the state itself, so the view keeps no state of its own*/
export class StateReadOnly<
  RRT extends SR<any>,
  WT,
  REL extends Option<StateRelated>,
> implements Base<RRT, REL, WT> {
  readonly #state: StateBase<RRT, WT, REL>;
  constructor(state: StateBase<RRT, WT, REL>) {
    this.#state = state;
  }

  get [STATE_KEY](): true {
    return true;
  }

  //#Reader Context
  then<TResult1 = RRT, TResult2 = never>(
    on_fulfilled?: ((value: RRT) => TResult1 | PromiseLike<TResult1>) | null,
    on_rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.#state.then(on_fulfilled, on_rejected);
  }
  to_json(): Promise<string> {
    return this.#state.to_json();
  }
  get rsync(): boolean {
    return this.#state.rsync;
  }
  /**Only valid when rsync is true*/
  get(): RRT {
    return this.#state.get!();
  }
  get rok(): boolean {
    return this.#state.rok;
  }
  /**Only valid when rsync and rok are true*/
  ok(): ResultInferOk<RRT> {
    return this.#state.ok!();
  }
  related(): REL {
    return this.#state.related();
  }
  sub<T = StateSub<RRT>>(func: StateSub<RRT>, update?: boolean): T {
    return this.#state.sub<T>(func, update);
  }
  unsub<T = StateSub<RRT>>(func: T): T {
    return this.#state.unsub<T>(func);
  }
  in_use(): this | undefined {
    return this.#state.in_use() ? this : undefined;
  }
  has(subscriber: StateSub<RRT>): this | undefined {
    return this.#state.has(subscriber) ? this : undefined;
  }
  amount(): number {
    return this.#state.amount();
  }

  //#Writer Context
  get writable(): false {
    return false;
  }
  get write_enabled(): State<boolean> {
    return STATE_WRITE_DISABLED;
  }
  limit(_value: WT): PromiseLike<SR<WT>> {
    return sync_resolve(err("not writable"));
  }
  check(_value: WT): PromiseLike<SR<WT>> {
    return sync_resolve(err("not writable"));
  }
}

/**State that is always false, the write gate of states that can never be written*/
class StateFalse extends StateBase<ResultOk<boolean>, never, OptionNone> {
  readonly #value = ok(false);
  then<TResult1 = ResultOk<boolean>, TResult2 = never>(
    on_fulfilled?:
      | ((value: ResultOk<boolean>) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    return sync_resolve(this.#value).then(on_fulfilled);
  }
  get rsync(): true {
    return true;
  }
  get(): ResultOk<boolean> {
    return this.#value;
  }
  get rok(): true {
    return true;
  }
  ok(): boolean {
    return false;
  }
  related(): OptionNone {
    return none();
  }
  get writable(): false {
    return false;
  }
  limit(_value: never): PromiseLike<SR<never>> {
    return sync_resolve(err("not writable"));
  }
  check(_value: never): PromiseLike<SR<never>> {
    return sync_resolve(err("not writable"));
  }
}

/**Write gate shared by all states that can never be written*/
export const STATE_WRITE_DISABLED = new StateFalse() as State<boolean>;

//##################################################################################################################################################
//          _  _____  ____  _   _
//         | |/ ____|/ __ \| \ | |
//         | | (___ | |  | |  \| |
//     _   | |\___ \| |  | | . ` |
//    | |__| |____) | |__| | |\  |
//     \____/|_____/ \____/|_| \_|

/**Values JSON can not represent are written as null, with an error logged, the types should prevent this from happening*/
function json_invalid(path: string, reason: string): string {
  console.error(`${path} ${reason}, written as null in JSON`);
  return "null";
}

/**Converts a state result to JSON, states in error are written as null*/
async function result_to_json(result: SR<unknown>, path: string) {
  if (result.err) return json_invalid(path, `is in error "${result.error}"`);
  return value_to_json(result.value, path);
}

/**Converts a value to JSON, including states nested in plain objects and arrays*/
async function value_to_json(val: unknown, path: string): Promise<string> {
  const value =
    val instanceof Object
      ? ((val as { [STATE_VIEWER_OVERRIDE_KEY]?: () => unknown })[
          STATE_VIEWER_OVERRIDE_KEY
        ]?.() ?? val)
      : val;
  if (IS.state(value)) return result_to_json(await value, path);
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let i = 0; i < value.length; i++)
      items.push(await value_to_json(value[i], `${path}[${i}]`));
    return "[" + items.join(",") + "]";
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toJSON?: unknown }).toJSON !== "function"
  ) {
    const entries: string[] = [];
    for (const [key, entry] of Object.entries(value)) {
      //Optional fields are left out like JSON.stringify does, reading them back gives undefined again
      if (entry === undefined) continue;
      entries.push(
        JSON.stringify(key) + ":" + (await value_to_json(entry, `${path}.${key}`)),
      );
    }
    return "{" + entries.join(",") + "}";
  }
  if (typeof value === "number" && !Number.isFinite(value))
    return json_invalid(path, `is ${value}`);
  if (typeof value === "bigint") return json_invalid(path, "is a bigint");
  const json = JSON.stringify(value);
  if (json === undefined) return json_invalid(path, `is ${typeof value}`);
  return json;
}
