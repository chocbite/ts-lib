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

  async to_json() {
    const v = await this;
    if (v.err) return "null";
    const val = v.value as unknown;
    if (!(val instanceof Object)) return JSON.stringify(val);
    const value = val[STATE_VIEWER_OVERRIDE_KEY]?.() ?? val;
    if (IS.state(value)) return await value.to_json();
    if (Array.isArray(value)) {
      let str = "[";
      for (let i = 0; i < value.length; i++) {
        if (i > 0) str += ",";
        const e = (value as unknown[])[i];
        if (IS.state(e)) str += await e.to_json();
        else str += JSON.stringify(e);
      }
      str += "]";
      return str;
    } else if (Object.getPrototypeOf(value) === Object.prototype) {
      let str = "{";
      let i = 0;
      for (const key in value) {
        if (i++ > 0) str += ",";
        const e = (value as { [key: string]: unknown })[key];
        str += JSON.stringify(key) + ":";
        if (IS.state(e)) str += await e.to_json();
        else str += JSON.stringify(e);
      }
      str += "}";
      return str;
    }
    return JSON.stringify(value);
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
