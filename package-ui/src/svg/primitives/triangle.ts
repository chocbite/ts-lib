import { SVGAttributes } from "../attributes";
import { create_svg_element } from "./shared";

/**This draws a triangle
 * @param center_x x coordinate of center
 * @param center_y y coordinate of center
 * @param width width
 * @param height height*/
export function isosceles_triangle(
  center_x: number,
  center_y: number,
  width: number,
  height: number,
): SVGAttributes<SVGPathElement> {
  const half_w = width / 2;
  const half_h = height / 2;
  return create_svg_element("path").a(
    "d",
    "M" +
      (center_x - half_w) +
      "," +
      (center_y + half_h) +
      " " +
      (center_x + half_w) +
      "," +
      (center_y + half_h) +
      " " +
      center_x +
      "," +
      (center_y - half_h) +
      "Z",
  );
}
