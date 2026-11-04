import { Base } from "./base";
import { base_element_name } from "./define_element";

/**Shared svg class for elements to extend
 * See Base for more information on how to define elements, and the element lifecycle */
export abstract class BaseSVG extends Base {
  /**Returns the name used to define the element, Abstract classes should return @abstract@ */
  static element_name() {
    return "@abstract@";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "lib";
  }

  protected abstract default_canvas(): SVGSVGElement;

  readonly canvas: SVGSVGElement = this.default_canvas();

  constructor() {
    super();
    this.canvas.classList.add(
      base_element_name(this.constructor as typeof BaseSVG),
    );
    this.canvas.appendChild(this);
  }
}
