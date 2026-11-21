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

  /**What was changed to make room for the keyboard, to put back, the element moved up with its own transform, or the room added at the end of a page that scrolls*/
  #page?:
    | { moved: HTMLElement; transform: string; room?: undefined }
    | { moved?: undefined; room: HTMLElement };
  /**The room is made again when the height of the keyboard changes, like for the language list*/
  #resize = new ResizeObserver(() => {
    if (KeyboardBase.#open === this) this.#make_room();
  });

  /**Only one keyboard is open at a time, focus can move to another input without a pointer*/
  static #open?: KeyboardBase;

  open(element: HTMLElement): void {
    if (KeyboardBase.#open !== this) KeyboardBase.#open?.close();
    KeyboardBase.#open = this;
    this.elem = element;
    element.ownerDocument.documentElement.appendChild(this);
    this.#resize.observe(this);
    this.#make_room();
  }

  close(): void {
    if (KeyboardBase.#open === this) KeyboardBase.#open = undefined;
    this.#resize.disconnect();
    this.#restore_page();
    this.remove();
  }

  /**Moves the element above the keyboard when the keyboard covers it, but never so far that its top leaves the screen
   *
   * An element in a fixed layer, like a prompt, moves with its layer, scrolling the page would only move what is under the layer.
   * Otherwise a page that scrolls is scrolled, with room added at its end when it is too short, as moving the root while it is scrolled would move the keyboard with it.
   * Otherwise the whole root is moved up and the keyboard, which is in the root, moved back down.
   * Moving only the body does not work, the layers outside it stay, and a body at the end of its scrolling is scrolled back by the browser as much as it is moved*/
  #make_room(): void {
    const element = this.elem;
    if (!element) return;
    this.#restore_page();
    const top = this.getBoundingClientRect().top;
    if (element.getBoundingClientRect().bottom <= top) return;
    const root = element.ownerDocument.documentElement;
    const scroller = element.ownerDocument.scrollingElement ?? root;
    const layer = fixed_layer(element);
    element.scrollIntoView({ behavior: "instant", block: "center" });
    const rect = element.getBoundingClientRect();
    const lift = Math.min(rect.bottom - top, rect.top);
    if (lift <= 0) return;
    const end = scroller.scrollHeight - scroller.clientHeight;
    if (layer) this.#move(layer, lift);
    else if (end > 0) {
      //The room is after the end of everything that scrolls, padding of the root can be inside it, when the body overflows a root as high as the screen
      const room = end - scroller.scrollTop - lift;
      if (room < 0) {
        const spacer = element.ownerDocument.createElement("div");
        Object.assign(spacer.style, {
          position: "absolute",
          top: `${scroller.scrollHeight}px`,
          left: "0",
          width: "1px",
          height: `${-room}px`,
          visibility: "hidden",
          pointerEvents: "none",
        });
        this.#page = { room: root.appendChild(spacer) };
      }
      scroller.scrollTop += lift;
    } else {
      this.#move(root, lift);
      this.style.transform = `translateY(${root.clientHeight - this.getBoundingClientRect().bottom}px)`;
    }
  }

  /**Moves the element up, keeping its own transform to put back*/
  #move(element: HTMLElement, lift: number): void {
    this.#page = { moved: element, transform: element.style.transform };
    element.style.transform =
      `${this.#page.transform} translateY(${-lift}px)`.trim();
  }

  /**Puts back the page's own transform and removes the room, the scroll is kept so the element stays where it is*/
  #restore_page(): void {
    this.style.transform = "";
    if (!this.#page) return;
    if (this.#page.moved)
      this.#page.moved.style.transform = this.#page.transform;
    this.#page.room?.remove();
    this.#page = undefined;
  }
}

/**The outermost fixed ancestor of the element, a layer like a prompt or a drop down, which does not move when the page scrolls*/
function fixed_layer(element: HTMLElement): HTMLElement | undefined {
  let layer: HTMLElement | undefined;
  const view = element.ownerDocument.defaultView;
  for (
    let parent = element.parentElement;
    parent && parent !== element.ownerDocument.documentElement;
    parent = parent.parentElement
  )
    if (view?.getComputedStyle(parent).position === "fixed") layer = parent;
  return layer;
}
