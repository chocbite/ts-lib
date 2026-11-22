import { sync_resolve } from "@chocbite/ts-lib/common";
import { err_nice, none, ok, type OptionNone, type ResultNice, type ResultOk } from "@chocbite/ts-lib/result";
import { state, type StateROS } from "@chocbite/ts-lib/state";

/**Width and height of an element as read only states, in px*/
export interface StateUISize {
  /**Width of the content box, inside the padding, 0 until measured and while the element is not rendered*/
  readonly width: StateROS<number>;
  /**Height of the content box, works like width*/
  readonly height: StateROS<number>;
}

/**One dimension of the size of an element, observing the element while it or the other dimension has subscribers*/
class SizeState extends state.class<ResultOk<number>, never, OptionNone> {
  #value = ok(0);
  readonly #sizes: ElementSizes;
  constructor(sizes: ElementSizes) {
    super();
    this.#sizes = sizes;
  }
  /**Takes a new value without telling the subscribers yet, true when it changed*/
  measured(value: number): boolean {
    if (value === this.#value.value) return false;
    this.#value = ok(value);
    return true;
  }
  /**Gives the subscribers the value*/
  tell(): void {
    this.update_subs(this.#value);
  }
  protected on_sub(): void {
    this.#sizes.in_use(1);
  }
  protected on_unsub(): void {
    this.#sizes.in_use(-1);
  }
  read(): PromiseLike<ResultOk<number>> {
    return sync_resolve(this.#value);
  }
  get rsync(): true {
    return true;
  }
  get(): ResultOk<number> {
    return this.#value;
  }
  get rok(): true {
    return true;
  }
  ok(): number {
    return this.#value.value;
  }
  related(): OptionNone {
    return none();
  }
  get writable(): false {
    return false;
  }
  limit(_value: never): PromiseLike<ResultNice<never>> {
    return sync_resolve(not_writable());
  }
  check(_value: never): PromiseLike<ResultNice<never>> {
    return sync_resolve(not_writable());
  }
}

/**Writing a size is a bug, the size comes from the layout of the page*/
const not_writable = () =>
  err_nice(state.errors.NOT_WRITABLE, new Error("The size of an element can not be written"));

/**The size states of one element, the element is observed while either has subscribers*/
class ElementSizes {
  readonly width: SizeState;
  readonly height: SizeState;
  /**What users get, the same object every time*/
  readonly states: StateUISize;
  #subscribed = 0;
  constructor(readonly element: Element) {
    this.width = new SizeState(this);
    this.height = new SizeState(this);
    this.states = Object.freeze({
      width: this.width,
      height: this.height,
    });
  }
  /**Counts the states in use, observing starts with the first and stops with the last*/
  in_use(change: 1 | -1): void {
    this.#subscribed += change;
    if (change === 1 && this.#subscribed === 1) observer.observe(this.element);
    else if (this.#subscribed === 0) observer.unobserve(this.element);
  }
}

const sizes_of = new WeakMap<Element, ElementSizes>();

//One observer for every element, its observations come after layout and before paint, so a change is shown in the same frame
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const sizes = sizes_of.get(entry.target);
    if (!sizes) continue;
    //Both are set before anyone is told, so a subscriber of one reads the new value of the other
    const width = sizes.width.measured(entry.contentRect.width);
    const height = sizes.height.measured(entry.contentRect.height);
    if (width) sizes.width.tell();
    if (height) sizes.height.tell();
  }
});

/**Width and height of the content box of an element, as read only states in px.
 * The element is only observed while something is subscribed, so sizes nobody follows cost nothing.
 * The same element always gives the same states*/
export function state_ui_size(element: Element): StateUISize {
  let sizes = sizes_of.get(element);
  if (!sizes) sizes_of.set(element, (sizes = new ElementSizes(element)));
  return sizes.states;
}
