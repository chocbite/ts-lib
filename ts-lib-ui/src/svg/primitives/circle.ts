import { SVGAttributes } from "../attributes";
import { ellipse_arc } from "./ellipse";
import { create_svg_element } from "./shared";

/**This creates a svg circle
 * @param center_x x coordinate of center
 * @param center_y y coordinate of center
 * @param radius radius of circle*/
export function circle(
  center_x: number,
  center_y: number,
  radius: number,
): SVGAttributes<SVGCircleElement> {
  const circle = create_svg_element("circle");
  circle.a("cx", String(center_x));
  circle.a("cy", String(center_y));
  circle.a("r", String(radius));
  return circle;
}

/**This draws parts of a circle/ellipse, the circle direction is reversed
 * @param center_x the center point on the x axis
 * @param center_y the center point on the y axis
 * @param radius radius in x axis
 * @param start_angle start angle in radians
 * @param end_angle end anglein  radians*/
export function circle_arc(
  center_x: number,
  center_y: number,
  radius: number,
  start_angle: number,
  end_angle: number,
): SVGAttributes<SVGPathElement> {
  return ellipse_arc(
    center_x,
    center_y,
    radius,
    radius,
    start_angle,
    end_angle,
  );
}
