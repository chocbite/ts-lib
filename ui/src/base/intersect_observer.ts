import type { Base } from "./base";

export type BaseIntersectObserverOptions = {
  /**Deffers updating visible state for so many milliseconds, defaults to 250
   * this will also batch updates if they are constantly coming*/
  deffered_visible?: number;
  /**Deffers updating visible state for so many milliseconds, defaults to 250
   * this will also batch updates if they are constantly coming*/
  deffered_hidden?: number;
} & IntersectionObserverInit;

export class BaseIntersectObserver extends IntersectionObserver {
  #deffered_visible_time: number;
  #deffered_visible_timeout: number | null = null;
  #deffered_visible_queue: Set<Base> = new Set();
  #deffered_hidden_time: number;
  #deffered_hidden_timeout: number | null = null;
  /**Elements with the time they hide, in order of that time as the deferral is the same for all*/
  #deffered_hidden_queue: Map<Base, number> = new Map();

  constructor(options: BaseIntersectObserverOptions) {
    super(
      (e) => {
        if (
          this.#deffered_hidden_time === 0 &&
          this.#deffered_visible_time === 0
        ) {
          for (let i = 0; i < e.length; i++) {
            //@ts-expect-error Call of private method, is private to prevent external usage
            (<Base>e[i].target).internal_set_visible(e[i].isIntersecting);
          }
          return;
        }
        const now = performance.now();
        for (let i = 0; i < e.length; i++) {
          const target = e[i].target as Base;
          if (e[i].isIntersecting) {
            this.#deffered_visible_queue.add(target);
            this.#deffered_hidden_queue.delete(target);
          } else {
            this.#deffered_hidden_queue.delete(target);
            this.#deffered_hidden_queue.set(
              target,
              now + this.#deffered_hidden_time,
            );
            this.#deffered_visible_queue.delete(target);
          }
        }
        if (!this.#deffered_visible_timeout && this.#deffered_visible_queue.size)
          this.#deffered_visible_timeout = window.setTimeout(() => {
            for (const element of this.#deffered_visible_queue)
              //@ts-expect-error Call of private method, is private to prevent external usage
              element.internal_set_visible(true);
            this.#deffered_visible_queue.clear();
            this.#deffered_visible_timeout = null;
          }, this.#deffered_visible_time);
        if (!this.#deffered_hidden_timeout && this.#deffered_hidden_queue.size)
          this.#hide_after(this.#deffered_hidden_time);
      },
      options,
    );
    this.#deffered_visible_time = options.deffered_visible ?? 250;
    this.#deffered_hidden_time = options.deffered_hidden ?? 250;
  }

  /**Hides the elements whose time has come, then waits for the next*/
  #hide_after(time: number): void {
    this.#deffered_hidden_timeout = window.setTimeout(() => {
      this.#deffered_hidden_timeout = null;
      const now = performance.now();
      for (const [element, at] of this.#deffered_hidden_queue) {
        if (at > now) return this.#hide_after(at - now);
        this.#deffered_hidden_queue.delete(element);
        //@ts-expect-error Call of private method, is private to prevent external usage
        element.internal_set_visible(false);
      }
    }, time);
  }

  /**Also drops the element from pending deferred updates, so it does not change visibility after it is unobserved*/
  unobserve(target: Element): void {
    super.unobserve(target);
    this.#deffered_visible_queue.delete(target as Base);
    this.#deffered_hidden_queue.delete(target as Base);
  }
}
