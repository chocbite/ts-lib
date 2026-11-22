import { sync_resolve } from "#common";
import { err, none, ok, type NiceError, type OptionNone } from "#result";
import {
  set_nested_maker,
  STATE_DERIVED_KEY,
  STATE_WRITE_DISABLED,
  StateBase,
  type StateDerivedSub,
} from "./base";
import { not_writable } from "./errors";
import { IS } from "./helpers/is";
import type { State, StateResult as SR } from "./types";

/**What select gives for a value of the outer state, a state, or a result of a plain value or an error*/
type Picked = State<unknown, any, unknown> | SR<unknown>;

/**The state in the value of a state, see nested in types.ts.
 * Like proxies and collected states it follows its states only while it has subscribers,
 * then it subscribes to the outer state and the current inner state, and moves to the new inner state when the outer one changes*/
class StateNested extends StateBase<SR<unknown>, unknown, OptionNone> {
  readonly #outer: State<unknown, any, unknown>;
  readonly #select: (value: unknown) => unknown;
  readonly #error?: NiceError;

  constructor(
    outer: State<unknown, any, unknown>,
    select: (value: unknown) => unknown,
    error?: NiceError,
  ) {
    super();
    this.#outer = outer;
    this.#select = select;
    this.#error = error;
  }

  /**What select gives for a result of the outer state.
   * undefined is the error given for it, without an error the types allow no undefined, so it is a plain value*/
  #pick(outer: SR<unknown>): Picked {
    if (outer.err) return outer;
    const inner = this.#select(outer.value);
    if (inner === undefined && this.#error) return err(this.#error);
    return IS.state(inner) ? inner : ok(inner);
  }

  //#Subscribed
  /**The current inner state while subscribed, undefined when the value is plain or an error*/
  #inner?: State<unknown, any, unknown>;
  /**True once the inner state is known while subscribed, an async outer state is read first*/
  #known = false;
  #buffer?: SR<unknown>;
  /**The buffer while a state changed but has not told its value yet, reads go through until it does.
   * Kept to tell if the value then is a change*/
  #invalidated?: SR<unknown>;
  #stale = false;
  /**Counts switches, a read of an async state that comes back after the next switch is dropped*/
  #version = 0;

  /**The subscribers to the outer and the inner state, made on the first subscribe, a nested state nobody uses has none*/
  #outer_sub?: StateDerivedSub;
  #inner_sub?: StateDerivedSub;

  #invalidate(): void {
    if (this.#stale) return;
    this.#stale = true;
    if (this.#buffer) {
      this.#invalidated = this.#buffer;
      this.#buffer = undefined;
    }
    this.invalidate_derived();
  }

  /**Takes the new value, telling the subscribers when it changed.
   * The first value after subscribing is not told, like no state tells its value on subscribing*/
  #tell(value: SR<unknown>): void {
    const last = this.#buffer ?? this.#invalidated;
    this.#invalidated = undefined;
    this.#stale = false;
    this.#buffer = value;
    //Objects and arrays can be changed in place, so they are always passed on
    if (last && (!last.compare(value) || (value.ok && typeof value.value === "object")))
      this.update_subs(value);
  }

  /**Moves to the inner state of a new value of the outer state*/
  #switch(outer: SR<unknown>): void {
    const version = ++this.#version;
    this.#known = true;
    const picked = this.#pick(outer);
    const inner = IS.state(picked) ? picked : undefined;
    if (inner !== this.#inner) {
      this.#inner?.unsub(this.#inner_sub!);
      this.#inner = inner;
      inner?.sub(this.#inner_sub!);
    } else if (inner && this.#buffer) return;
    if (!inner) return this.#tell(picked as SR<unknown>);
    if (inner.rsync) return this.#tell(inner.get());
    //Reads go through to the async inner state until it has given its value
    if (this.#buffer) {
      this.#invalidated = this.#buffer;
      this.#buffer = undefined;
    }
    inner.read().then((value) => {
      if (version === this.#version) this.#tell(value);
    });
  }

  protected on_sub(): void {
    if (!this.#outer_sub) {
      const invalidate = () => this.#invalidate();
      this.#outer_sub = Object.assign((value: SR<unknown>) => this.#switch(value), {
        [STATE_DERIVED_KEY]: invalidate,
      });
      this.#inner_sub = Object.assign((value: SR<unknown>) => this.#tell(value), {
        [STATE_DERIVED_KEY]: invalidate,
      });
    }
    this.#outer.sub(this.#outer_sub);
    if (this.#outer.rsync) return this.#switch(this.#outer.get());
    const version = this.#version;
    this.#outer.read().then((value) => {
      if (version === this.#version && this.in_use()) this.#switch(value);
    });
  }
  protected on_unsub(): void {
    this.#version++;
    this.#outer.unsub(this.#outer_sub!);
    this.#inner?.unsub(this.#inner_sub!);
    this.#inner = undefined;
    this.#known = false;
    this.#buffer = undefined;
    this.#invalidated = undefined;
    this.#stale = false;
  }

  /**Runs func with the current inner state, undefined when the value is plain or an error,
   * at once when it is known, otherwise once the outer state has been read.
   * Not known while invalidated, the outer state can have changed without having told its value yet*/
  #with_inner<T>(func: (inner: State<unknown, any, unknown> | undefined) => PromiseLike<T>): PromiseLike<T> {
    if (this.#known && !this.#stale) return func(this.#inner);
    const of = (outer: SR<unknown>) => {
      const picked = this.#pick(outer);
      return func(IS.state(picked) ? picked : undefined);
    };
    if (this.#outer.rsync) return of(this.#outer.get());
    return this.#outer.read().then(of);
  }
  /**The current inner state when it can be known without reading, see with_inner*/
  #inner_now(): State<unknown, any, unknown> | undefined {
    if (this.#known && !this.#stale) return this.#inner;
    if (!this.#outer.rsync) return undefined;
    const picked = this.#pick(this.#outer.get());
    return IS.state(picked) ? picked : undefined;
  }

  //#Reader Context
  read(): PromiseLike<SR<unknown>> {
    if (this.#buffer) return sync_resolve(this.#buffer);
    return this.#outer.read().then((outer) => {
      const picked = this.#pick(outer);
      return IS.state(picked) ? picked.read() : picked;
    });
  }
  get(): SR<unknown> {
    if (this.#buffer) return this.#buffer;
    const picked = this.#pick(this.#outer.get!());
    return IS.state(picked) ? picked.get!() : picked;
  }
  ok(): unknown {
    return (this.get() as { value: unknown }).value;
  }
  get rsync(): boolean {
    if (!this.#outer.rsync) return false;
    return this.#inner_now()?.rsync ?? true;
  }
  get rok(): boolean {
    if (!this.#outer.rok || this.#error) return false;
    return this.#inner_now()?.rok ?? true;
  }
  related(): OptionNone {
    return none();
  }

  //#Writer Context
  get writable(): boolean {
    return this.#inner_now()?.writable ?? false;
  }
  get write_enabled(): State<boolean> | undefined {
    const inner = this.#inner_now();
    return inner?.writable ? inner.write_enabled : STATE_WRITE_DISABLED;
  }
  write(value: unknown): PromiseLike<SR<void>> {
    return this.#with_inner((inner) =>
      inner?.writable ? inner.write(value) : sync_resolve(not_writable()),
    );
  }
  limit(value: unknown): PromiseLike<SR<unknown>> {
    return this.#with_inner((inner) =>
      inner?.writable ? inner.limit(value) : sync_resolve(not_writable()),
    );
  }
  check(value: unknown): PromiseLike<SR<unknown>> {
    return this.#with_inner((inner) =>
      inner?.writable ? inner.check(value) : sync_resolve(not_writable()),
    );
  }
  get read_only() {
    return this.read_only_view();
  }
}

//The nested method of every state makes its states here, base.ts can not import this file,
//as the nested class extends StateBase, which does not exist yet while base.ts loads
set_nested_maker(
  (outer, select, error) =>
    new StateNested(outer as State<unknown, any, unknown>, select, error),
);
