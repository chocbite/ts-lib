import { sync_resolve } from "#common";
import {
  type NiceError,
  none,
  ok,
  Option,
  OptionNone,
  ResultInferOk,
  ResultOk,
  err_nice,
} from "#result";
import { not_writable, state_errors } from "./errors";
import { IS } from "./helpers/is";
import { STATE_ARRAY_READ_KEY, STATE_OBJECT_READ_KEY } from "./helpers/read_keys";
import {
  StateResult as SR,
  STATE_KEY,
  STATE_VIEWER_OVERRIDE_KEY,
  StateRelated,
  type State,
  type StateBase as Base,
  type StateSub,
} from "./types";

/**How the transform of a proxy reads the state.
 * result: transform gets the result and gives a result, the proxy can fail.
 * map: transform gets the plain value and an error is passed on, the proxy is ok when the state is.
 * ok: transform gets the result and gives an ok result, the proxy is ok*/
export type StateProxyMode = "result" | "map" | "ok";
/**Makes the proxies of the proxy methods, writable: writes go to the state, through write when given, see StateProxyWrite*/
type ProxyMaker = (
  state: Base<any, any, any>,
  mode: StateProxyMode,
  transform: (value: any) => any,
  writable: boolean,
  write?: unknown,
) => unknown;
let proxy_maker: ProxyMaker = () => {
  throw new Error("The proxy module is not loaded, import states from the state module");
};
/**The states telling their subscribers right now, innermost last, a state telling again from one of its subscribers is in it twice.
 * An entry is the state, or once something subscribes to it while it tells, a record with the subscribers added since it started,
 * they were given the value or chose not to be, so that telling skips them, see update_subs*/
interface Telling {
  state: unknown;
  added: Set<StateSub<any>>;
}
const TELLING: unknown[] = [];

/**Notes a subscriber added to a state while it tells its subscribers, for every telling of it going on*/
function added_while_telling(state: unknown, func: StateSub<any>): void {
  for (let i = 0; i < TELLING.length; i++) {
    const entry = TELLING[i];
    if (entry === state) TELLING[i] = { state, added: new Set([func]) } satisfies Telling;
    else if ((entry as Telling).state === state) (entry as Telling).added.add(func);
  }
}

/**Calls a new subscriber with the whole value of its state.
 * While a state tells its subscribers of an array or object change, the value carries the change list,
 * which the new subscriber must not apply, it gets the value without it, put back for the subscribers still to be told*/
function call_whole(func: StateSub<any>, value: unknown): void {
  const inner = (value as { value?: unknown }).value;
  if (typeof inner !== "object" || inner === null) return void func(value);
  const keyed = inner as { [STATE_ARRAY_READ_KEY]?: unknown; [STATE_OBJECT_READ_KEY]?: unknown };
  const array = keyed[STATE_ARRAY_READ_KEY];
  const object = keyed[STATE_OBJECT_READ_KEY];
  if (array === undefined && object === undefined) return void func(value);
  delete keyed[STATE_ARRAY_READ_KEY];
  delete keyed[STATE_OBJECT_READ_KEY];
  try {
    func(value);
  } finally {
    if (array !== undefined) keyed[STATE_ARRAY_READ_KEY] = array;
    if (object !== undefined) keyed[STATE_OBJECT_READ_KEY] = object;
  }
}

/**Marks the subscriber function of a derived state, a proxy or collected state, its value is called by invalidate_derived.
 * Internal to the state module, a derived state subscribes with such a function only while it has subscribers itself*/
export const STATE_DERIVED_KEY = Symbol("state_derived");
/**The subscriber function of a derived state, see STATE_DERIVED_KEY*/
export type StateDerivedSub = ((value: any) => void) & {
  [STATE_DERIVED_KEY]?: () => void;
};

/**Makes the states of the nested method, see nested in types.ts*/
type NestedMaker = (
  state: Base<any, any, any>,
  select: (value: any) => unknown,
  error?: NiceError,
) => unknown;
let nested_maker: NestedMaker = () => {
  throw new Error("The nested module is not loaded, import states from the state module");
};
/**Given by nested.ts when it loads, this file can not import it, as its class extends StateBase*/
export function set_nested_maker(maker: NestedMaker): void {
  nested_maker = maker;
}

/**Given by proxy.ts when it loads, this file can not import it, as its proxy class extends StateBase*/
export function set_proxy_maker(maker: ProxyMaker): void {
  proxy_maker = maker;
}

/**The error of a sync write while the gate does not allow writing, undefined when it does or there is no gate.
 * Only for gates of states with sync writes, which are sync states*/
export function gate_closed_sync(gate: State<boolean> | undefined): SR<never> | undefined {
  if (!gate) return undefined;
  const res = (gate as { get(): SR<boolean> }).get();
  return res.ok && res.value
    ? undefined
    : err_nice(state_errors.WRITE_DISABLED, "writing is disabled");
}

export abstract class StateBase<
  RRT extends SR<any>,
  WT,
  REL extends Option<StateRelated>,
> implements Base<RRT, REL, WT> {
  get [STATE_KEY](): true {
    return true;
  }

  //#Reader Context
  /**The current value of the state, the thenable resolves once the state has a value.
   * On a sync state the then of the thenable calls its function at once, without waiting for a microtask.
   * The state itself is not a thenable, so promises can resolve to it*/
  abstract read(): PromiseLike<RRT>;

  async to_json(): Promise<string> {
    return result_to_json(await this.read(), "state");
  }

  /**A state of the state in the value of this state, see nested in types.ts for its type*/
  nested(select: (value: ResultInferOk<RRT>) => unknown, error?: NiceError): any {
    return nested_maker(this, select, error);
  }
  /**A read only proxy of the state, transform gets the result and gives a result.
   * any as a class can not know its kind, the state types give the proxy its type, and subclasses fit them unchanged*/
  proxy(transform: (value: RRT) => SR<unknown>): any {
    return proxy_maker(this, "result", transform, false);
  }
  /**A read only proxy of the state, map gets the plain value and an error is passed on as it is, see the state types for its type*/
  proxy_map(map: (value: ResultInferOk<RRT>) => unknown): any {
    return proxy_maker(this, "map", map, false);
  }
  /**A read only ok proxy of the state, transform gets the result and gives an ok result, handling the error of a state that can fail*/
  proxy_ok(transform: (value: RRT) => ResultOk<unknown>): any {
    return proxy_maker(this, "ok", transform, false);
  }
  /**A writable proxy of the state, like proxy, writes go to the state, through write when given, see StateProxyWrite.
   * The state types only give it to writable states*/
  proxy_w(transform: (value: RRT) => SR<unknown>, write?: unknown): any {
    return proxy_maker(this, "result", transform, true, write);
  }
  /**A writable proxy of the state, like proxy_map, writes go to the state, through write when given, see StateProxyWrite*/
  proxy_w_map(map: (value: ResultInferOk<RRT>) => unknown, write?: unknown): any {
    return proxy_maker(this, "map", map, true, write);
  }
  /**A writable ok proxy of the state, like proxy_ok, writes go to the state, through write when given, see StateProxyWrite*/
  proxy_ok_w(transform: (value: RRT) => ResultOk<unknown>, write?: unknown): any {
    return proxy_maker(this, "ok", transform, true, write);
  }

  abstract readonly rsync: boolean;
  get?(): RRT;

  abstract readonly rok: boolean;
  ok?(): ResultInferOk<RRT>;

  abstract related(): REL;

  /**Created on the first subscriber, an empty Set is about half the memory of a state, and most states are never subscribed*/
  #subscribers?: Set<StateSub<RRT>>;
  /**Subscribers that are derived states, proxies and collected states, marked with STATE_DERIVED_KEY.
   * They are told before the other subscribers, so derived states read in those are current, see invalidate_derived*/
  #derived?: Set<StateSub<RRT>>;
  //The state types type sub and unsub by the state they are called on, see SubValue, a class only knows RRT
  sub<F extends StateSub<any>>(func: F, update?: boolean): F {
    const subscribers = (func as StateDerivedSub)[STATE_DERIVED_KEY]
      ? (this.#derived ??= new Set())
      : (this.#subscribers ??= new Set());
    if (subscribers.has(func)) {
      console.error("Function already registered as subscriber", this, func);
      return func;
    }
    if (this.amount() === 0) this.on_sub();
    subscribers.add(func);
    if (TELLING.length) added_while_telling(this, func);
    if (update) this.read().then((value) => call_whole(func, value));
    return func;
  }
  unsub<F extends StateSub<any>>(func: F): F {
    const subscribers = (func as StateDerivedSub)[STATE_DERIVED_KEY]
      ? this.#derived
      : this.#subscribers;
    if (subscribers?.delete(func)) {
      if (this.amount() === 0) this.on_unsub();
    } else console.error("Subscriber not found with state", this, func);
    return func;
  }

  in_use(): this | undefined {
    return this.amount() > 0 ? this : undefined;
  }
  has(subscriber: StateSub<RRT>): this | undefined {
    return this.#subscribers?.has(subscriber) || this.#derived?.has(subscriber)
      ? this
      : undefined;
  }
  amount(): number {
    return (this.#subscribers?.size ?? 0) + (this.#derived?.size ?? 0);
  }

  //#Writer Context
  abstract readonly writable: boolean;
  write?(value: WT): PromiseLike<SR<void>>;
  abstract limit(value: WT): PromiseLike<SR<WT>>;
  abstract check(value: WT): PromiseLike<SR<WT>>;

  /**Is state guarenteed to write synchronously, local states made for it override this*/
  get wsync(): boolean {
    return false;
  }

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
    return gate.read().then((res) =>
      res.ok && res.value
        ? func()
        : err_nice(state_errors.WRITE_DISABLED, "writing is disabled"),
    );
  }

  /**The error of a sync write while the write gate does not allow writing, undefined when it does.
   * Only for states with sync writes, their gate is a sync state*/
  protected write_closed_sync(): SR<never> | undefined {
    return gate_closed_sync(this.#write_enabled);
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

  /**Updates all subscribers with a value, the derived states first.
   * Several are all invalidated before any is told, so a subscriber of one reads the others current,
   * a single one is told before anything else can run*/
  protected update_subs(value: RRT): void {
    //The Sets are iterated live, which also visits subscribers added meanwhile, those are skipped, see TELLING
    //Nothing between the push and the pop may throw, a state left in TELLING would skip its later subscribers,
    //subscribers are called through #call and invalidate_derived, which catch
    const at = TELLING.push(this) - 1;
    const derived = this.#derived;
    if (derived) {
      if (derived.size > 1) this.invalidate_derived();
      for (const subscriber of derived) {
        const entry = TELLING[at];
        if (entry === this || !(entry as Telling).added.has(subscriber))
          this.#call(subscriber, value);
      }
    }
    const subscribers = this.#subscribers;
    if (subscribers)
      for (const subscriber of subscribers) {
        const entry = TELLING[at];
        if (entry === this || !(entry as Telling).added.has(subscriber))
          this.#call(subscriber, value);
      }
    TELLING.pop();
  }
  #call(subscriber: StateSub<RRT>, value: RRT): void {
    try {
      subscriber(value);
    } catch (e) {
      console.error("Failed while calling subscribers ", e, this, subscriber);
    }
  }

  /**Tells the derived states subscribed to this one that its value changed before they are told the value,
   * which comes later in a microtask, until then their reads must go through to this state.
   * Called by a collected state when one of its states changes, and passed on by every derived state*/
  protected invalidate_derived(): void {
    const derived = this.#derived;
    if (!derived) return;
    for (const subscriber of derived) {
      try {
        (subscriber as StateDerivedSub)[STATE_DERIVED_KEY]!();
      } catch (e) {
        console.error("Failed while invalidating derived state ", e, this, subscriber);
      }
    }
  }

  //Promises
  #read_promises?: ((val: RRT) => void)[];
  /**Creates a promise of the next value, fulfilled by ful_r_prom */
  protected append_r_prom(): Promise<RRT> {
    return new Promise<RRT>((a) => {
      (this.#read_promises ??= []).push(a);
    });
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
  read(): PromiseLike<RRT> {
    return this.#state.read();
  }
  to_json(): Promise<string> {
    return this.#state.to_json();
  }
  proxy(transform: (value: RRT) => SR<unknown>): any {
    return proxy_maker(this, "result", transform, false);
  }
  proxy_map(map: (value: ResultInferOk<RRT>) => unknown): any {
    return proxy_maker(this, "map", map, false);
  }
  proxy_ok(transform: (value: RRT) => ResultOk<unknown>): any {
    return proxy_maker(this, "ok", transform, false);
  }
  nested(select: (value: ResultInferOk<RRT>) => unknown, error?: NiceError): any {
    return nested_maker(this, select, error);
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
  sub<F extends StateSub<any>>(func: F, update?: boolean): F {
    return this.#state.sub(func, update);
  }
  unsub<F extends StateSub<any>>(func: F): F {
    return this.#state.unsub(func);
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
  get wsync(): false {
    return false;
  }
  get write_enabled(): State<boolean> {
    return STATE_WRITE_DISABLED;
  }
  limit(_value: WT): PromiseLike<SR<WT>> {
    return sync_resolve(not_writable());
  }
  check(_value: WT): PromiseLike<SR<WT>> {
    return sync_resolve(not_writable());
  }
}

/**State that is always false, the write gate of states that can never be written*/
class StateFalse extends StateBase<ResultOk<boolean>, never, OptionNone> {
  readonly #value = ok(false);
  read(): PromiseLike<ResultOk<boolean>> {
    return sync_resolve(this.#value);
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
    return sync_resolve(not_writable());
  }
  check(_value: never): PromiseLike<SR<never>> {
    return sync_resolve(not_writable());
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
  if (result.err) return json_invalid(path, `is in error "${result.error.toString()}"`);
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
  if (IS.state(value)) return result_to_json(await value.read(), path);
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
