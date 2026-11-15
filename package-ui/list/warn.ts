/**Shows why a write of the list failed as the validation message of the browser, at the row it is about, like the form elements do
 * One hidden input in the container is placed over the row before the message is shown, it clears after 5 seconds */
export class ListWarn {
  #container: HTMLElement;
  #input: HTMLInputElement;
  #timeout?: number;

  constructor(container: HTMLElement) {
    this.#container = container;
    this.#input = container.appendChild(document.createElement("input"));
    this.#input.className = "list-warn";
    this.#input.tabIndex = -1;
  }

  /**Shows the message at the element, or at the top of the list without element
   * @param at element to point at, rows are display contents, so give one of their cells */
  show(at: Element | undefined, message: string) {
    const input = this.#input;
    const container = this.#container;
    const box = container.getBoundingClientRect();
    const rect = at?.getBoundingClientRect() ?? box;
    input.style.top = rect.top - box.top + container.scrollTop + "px";
    input.style.left =
      Math.max(rect.left - box.left, 0) + container.scrollLeft + "px";
    input.style.width = rect.width + "px";
    input.style.height = rect.height + "px";
    //Showing the message can move the focus to the input, the keyboard cell keeps it
    const focused = document.activeElement;
    input.setCustomValidity(message);
    input.reportValidity();
    if (focused instanceof HTMLElement && focused !== document.activeElement)
      focused.focus({ preventScroll: true });
    if (this.#timeout) clearTimeout(this.#timeout);
    this.#timeout = window.setTimeout(() => {
      input.setCustomValidity("");
      input.reportValidity();
    }, 5000);
  }
}
