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

  #listener = (e: Event) => {
    if (e.target === this || this.contains(e.target as Node)) return;
    if (
      this.elem &&
      (e.target === this.elem || this.elem.contains(e.target as Node))
    )
      return;
    this.close();
  };

  protected connectedCallback(): void {
    super.connectedCallback();
    this.elem?.ownerDocument.addEventListener("pointerdown", this.#listener, {
      capture: true,
    });
    this.elem?.ownerDocument.addEventListener("blur", this.#listener, {
      capture: true,
    });
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    this.elem?.ownerDocument.removeEventListener(
      "pointerdown",
      this.#listener,
      { capture: true },
    );
    this.elem?.ownerDocument.removeEventListener("blur", this.#listener, {
      capture: true,
    });
  }

  open(element: HTMLElement): void {
    this.elem = element;
    this.elem.ownerDocument.documentElement.appendChild(this);
    const erect = element.getBoundingClientRect();
    const krect = this.getBoundingClientRect();

    if (erect.top + erect.height > krect.top) {
      element.scrollIntoView({ behavior: "instant", block: "center" });
      const erect = element.getBoundingClientRect();
      element.ownerDocument.body.style.transform = `translateY(${krect.top - (erect.top + erect.height)}px)`;
    }
  }

  close(): void {
    this.remove();
    if (this.elem) this.elem.ownerDocument.body.style.transform = "";
  }
}
