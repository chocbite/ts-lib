import { define_element } from "#base";
import { ContentBase, type ContentCreateOptions } from "../content";

/**Content that is asked before it closes, it gives answer and counts how often it was asked*/
export class Guarded extends ContentBase {
  static element_name() {
    return "guarded";
  }
  static element_name_space() {
    return "contenttest";
  }
  answer: boolean | PromiseLike<boolean> = true;
  asked = 0;
  protected content_closing(): boolean | PromiseLike<boolean> {
    this.asked++;
    return this.answer;
  }
}
define_element(Guarded);

export const guarded = (
  answer: boolean | PromiseLike<boolean>,
  options: ContentCreateOptions = {},
): Guarded => {
  const content = Guarded.create(options);
  content.answer = answer;
  return content;
};

/**A promise with its resolve, for an answer given later*/
export function later<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
