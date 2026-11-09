import { Option, ResultInferOk } from "#result";
import { IS } from "./helpers/is";
import {
  StateResult as SR,
  STATE_KEY,
  STATE_VIEWER_OVERRIDE_KEY,
  StateRelated,
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
