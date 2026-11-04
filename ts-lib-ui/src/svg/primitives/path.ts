import { SVGAttributes } from "../attributes";
import { create_svg_element } from "./shared";

/**This creates a path element*/
export function path(path: string): SVGAttributes<SVGPathElement> {
  return create_svg_element("path").a("d", path);
}

/**This creates a line with a path element
 * @param start_x start point on x axis
 * @param start_y start point on y axis
 * @param end_x end point on x axis
 * @param end_y end point on y axis*/
export function path_line(
  start_x: number,
  start_y: number,
  end_x: number,
  end_y: number,
): SVGAttributes<SVGPathElement> {
  return create_svg_element("path").a(
    "d",
    `M ${start_x} ${start_y} L ${end_x} ${end_y}`,
  );
}
