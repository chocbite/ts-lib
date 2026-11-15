//Two panes side by side with a divider between them that is dragged to resize the first pane.
//The size is in rem, so it follows the page scale, and is given back on every change so the app can keep it.
//The first pane can be hidden, which hides the divider with it.
import { el } from "#lib/dom";
import "./style.scss";

export interface SplitOptions {
  /**Width of the first pane in rem*/
  size: number;
  /**Smallest width of the first pane in rem*/
  min?: number;
  /**Largest width of the first pane in rem*/
  max?: number;
  /**Called when a drag ends with the new width in rem*/
  on_size?: (size: number) => void;
}

export interface Split {
  /**The element holding the panes, the divider and the first and second pane are its children*/
  element: HTMLDivElement;
  /**Width of the first pane in rem*/
  size: number;
  /**Whether the first pane, and the divider with it, is shown*/
  first_shown: boolean;
}

const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/**Puts the panes side by side with a divider between them*/
export function split(first: HTMLElement, second: HTMLElement, options: SplitOptions): Split {
  const min = options.min ?? 5;
  const max = options.max ?? Infinity;
  const divider = el("div", "split-divider");
  const element = el("div", "split", first, divider, second);
  let size = 0;
  let shown = true;
  const set_size = (value: number) => {
    size = Math.min(max, Math.max(min, value));
    element.style.setProperty("--split-size", size + "rem");
  };
  set_size(options.size);

  divider.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);
    const start_x = e.clientX;
    const start_size = size;
    const unit = rem();
    divider.classList.add("dragging");
    divider.onpointermove = (m) => set_size(start_size + (m.clientX - start_x) / unit);
    divider.onpointerup = divider.onpointercancel = () => {
      divider.onpointermove = divider.onpointerup = divider.onpointercancel = null;
      divider.classList.remove("dragging");
      options.on_size?.(size);
    };
  };

  return {
    element,
    get size() {
      return size;
    },
    set size(value: number) {
      set_size(value);
    },
    get first_shown() {
      return shown;
    },
    set first_shown(value: boolean) {
      shown = value;
      element.classList.toggle("first-hidden", !value);
    },
  };
}
