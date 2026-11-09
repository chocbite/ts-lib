import { define_element } from "#base";
import { Spinner } from "#spinner";
import "./buffer.scss";
import { MenuLine } from "./line";

export class Buffer extends MenuLine {
  /**Returns the name used to define the element */
  static element_name() {
    return "buffer";
  }

  constructor() {
    super();
    this.appendChild(new Spinner());
  }

  get skips_focus() {
    return true;
  }

  do_focus(dir: boolean) {
    this.focus_next(dir);
  }
}
define_element(Buffer);
