import { Base } from "#base";

export abstract class KeyboardBase extends Base {
  static element_name(): string {
    return "@abstract@";
  }

  static element_name_space(): string {
    return "onscreen-keyboard";
  }

  protected elem?: HTMLElement;

  constructor() {
    super();
    this.addEventListener("mousedown", (event) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLButtonElement
      )
        return;
      event.preventDefault();
    });
  }

  /**Closes on a press or focus outside the keyboard and the edited element*/
  #listener = (e: Event) => {
    if (e.target === this || this.contains(e.target as Node)) return;
    if (
      this.elem &&
      (e.target === this.elem || this.elem.contains(e.target as Node))
    )
      return;
    this.close();
  };
  /**The document the listeners are on, the element can move to another document*/
  #listening?: Document;

  protected connectedCallback(): void {
    super.connectedCallback();
    this.#listening = this.ownerDocument;
    this.#listening.addEventListener("pointerdown", this.#listener, {
      capture: true,
    });
    this.#listening.addEventListener("focusin", this.#listener, {
      capture: true,
    });
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listening?.removeEventListener("pointerdown", this.#listener, {
      capture: true,
    });
    this.#listening?.removeEventListener("focusin", this.#listener, {
      capture: true,
    });
    this.#listening = undefined;
  }

  /**The page's own body transform, kept while the page is shifted so it can be restored*/
  #body_transform?: string;

  /**Only one keyboard is open at a time, focus can move to another input without a pointer*/
  static #open?: KeyboardBase;

  open(element: HTMLElement): void {
    if (KeyboardBase.#open !== this) KeyboardBase.#open?.close();
    KeyboardBase.#open = this;
    this.elem = element;
    this.elem.ownerDocument.documentElement.appendChild(this);
    const erect = element.getBoundingClientRect();
    const krect = this.getBoundingClientRect();

    if (erect.top + erect.height > krect.top) {
      element.scrollIntoView({ behavior: "instant", block: "center" });
      const erect = element.getBoundingClientRect();
      //Moves the page up until the element is above the keyboard, but never so far that its top leaves the screen
      const shift = Math.max(krect.top - (erect.top + erect.height), -erect.top);
      if (shift < 0) {
        const body = element.ownerDocument.body;
        this.#body_transform ??= body.style.transform;
        body.style.transform =
          `${this.#body_transform} translateY(${shift}px)`.trim();
      }
    }
  }

  close(): void {
    if (KeyboardBase.#open === this) KeyboardBase.#open = undefined;
    this.remove();
    if (this.elem && this.#body_transform !== undefined) {
      this.elem.ownerDocument.body.style.transform = this.#body_transform;
      this.#body_transform = undefined;
    }
  }
}
