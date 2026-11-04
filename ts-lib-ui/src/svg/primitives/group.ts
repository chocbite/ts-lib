import { SVGAttributes } from "../attributes";
import { create_svg_element } from "./shared";

/**This draws a triangle*/
export function group(): SVGAttributes<SVGGElement> {
  return create_svg_element("g");
}
