import type { Base } from "./base";

export type BaseIntersectObserverOptions = {
  /**Deffers updating visible state for so many milliseconds
   * this will also batch updates if they are constantly coming*/
  deffered_visible?: number;
  /**Deffers updating visible state for so many milliseconds
   * this will also batch updates if they are constantly coming*/
  deffered_hidden?: number;
} & IntersectionObserverInit;

const V2 = "delay" in new IntersectionObserver(() => {});
export class BaseIntersectObserver extends IntersectionObserver {
  #deffered_visible_time: number;
  #deffered_visible_timeout: number | null = null;
  #deffered_visible_queue: Base[] = [];
  #deffered_hidden_time: number;
  #deffered_hidden_timeout: number | null = null;
  #deffered_hidden_queue: Base[] = [];

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
        for (let i = 0; i < e.length; i++) {
          if (e[i].isIntersecting) {
            this.#deffered_visible_queue.push(e[i].target as Base);
            const index = this.#deffered_hidden_queue.indexOf(
              e[i].target as Base,
            );
            if (index !== -1) this.#deffered_hidden_queue.splice(index, 1);
          } else {
            this.#deffered_hidden_queue.push(e[i].target as Base);
            const index = this.#deffered_visible_queue.indexOf(
              e[i].target as Base,
            );
            if (index !== -1) this.#deffered_visible_queue.splice(index, 1);
          }
        }
        if (!this.#deffered_visible_timeout) {
          this.#deffered_visible_timeout = window.setTimeout(() => {
            for (let i = 0; i < this.#deffered_visible_queue.length; i++) {
              //@ts-expect-error Call of private method, is private to prevent external usage
              this.#deffered_visible_queue[i].internal_set_visible(true);
            }
            this.#deffered_visible_queue = [];
            this.#deffered_visible_timeout = null;
          }, this.#deffered_visible_time);
        }
        if (!this.#deffered_hidden_timeout) {
          this.#deffered_hidden_timeout = window.setTimeout(() => {
            for (let i = 0; i < this.#deffered_hidden_queue.length; i++) {
              //@ts-expect-error Call of private method, is private to prevent external usage
              this.#deffered_hidden_queue[i].internal_set_visible(false);
            }
            this.#deffered_hidden_queue = [];
            this.#deffered_hidden_timeout = null;
          }, this.#deffered_hidden_time);
        }
      },
      V2 && options.deffered_visible === options.deffered_hidden
        ? ({ delay: options.deffered_visible, ...options } as object)
        : options,
    );
    if (V2 && options.deffered_visible === options.deffered_hidden) {
      this.#deffered_visible_time = 0;
      this.#deffered_hidden_time = 0;
    } else {
      this.#deffered_visible_time = options.deffered_visible ?? 250;
      this.#deffered_hidden_time = options.deffered_hidden ?? 250;
    }
  }
}
