import { SVGAttributes } from "../attributes";
import { create_svg_element } from "./shared";

/**This creates a rectangle with teh center as origin
 * @param center_x x coordinate of center
 * @param center_y y coordinate of center
 * @param width width
 * @param height height
 * @param corner_radius radius of corner*/
export function rectangle_from_center(
  center_x: number,
  center_y: number,
  width: number,
  height: number,
  corner_radius: number,
): SVGAttributes<SVGRectElement> {
  return create_svg_element("rect")
    .a("x", String(center_x - width / 2))
    .a("y", String(center_y - height / 2))
    .a("width", String(width))
    .a("height", String(height))
    .a("rx", String(corner_radius));
}

/**This creates a rectangle with teh center as origin
 * @param start_x x coordinate of center
 * @param start_y y coordinate of center
 * @param width width
 * @param height height
 * @param corner_radius radius of corner*/
export function rectangle_from_corner(
  start_x: number,
  start_y: number,
  width: number,
  height: number,
  corner_radius: number,
): SVGAttributes<SVGRectElement> {
  return create_svg_element("rect")
    .a("x", String(start_x))
    .a("y", String(start_y))
    .a("width", String(width))
    .a("height", String(height))
    .a("rx", String(corner_radius));
}
