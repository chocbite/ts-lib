import { degrees_to_radians } from "@chocbite/ts-lib/math";
import { SVGAttributes } from "../attributes";
import { create_svg_element } from "./shared";

/**This creates a svg ellipse
 * @param center_x x coordinate of center
 * @param center_y y coordinate of center
 * @param radius_x x radius of circle
 * @param radius_y y radius of circle*/
export function ellipse(
  center_x: number,
  center_y: number,
  radius_x: number,
  radius_y: number,
): SVGAttributes<SVGEllipseElement> {
  return create_svg_element("ellipse")
    .a("cx", String(center_x))
    .a("cy", String(center_y))
    .a("rx", String(radius_x))
    .a("ry", String(radius_y));
}

/**This draws parts of a circle/ellipse, the circle direction is reversed
 * @param center_x the center point on the x axis
 * @param center_y the center point on the y axis
 * @param radius_x radius in x axis
 * @param radius_y radius in y axis
 * @param start_angle start angle in degrees
 * @param end_angle end angle in degrees, a sweep of 360 degrees or more draws the whole ellipse*/
export function ellipse_arc(
  center_x: number,
  center_y: number,
  radius_x: number,
  radius_y: number,
  start_angle: number,
  end_angle: number,
): SVGAttributes<SVGPathElement> {
  const start_radian = degrees_to_radians(start_angle);
  const sweep = degrees_to_radians(end_angle - start_angle);
  const point = (radian: number) =>
    `${radius_x * Math.cos(radian) + center_x} ${radius_y * Math.sin(radian) + center_y}`;
  const f_s = sweep > 0 ? 1 : 0;
  const arc = `A ${radius_x} ${radius_y} 0`;
  //An arc ending where it starts draws nothing, so the whole ellipse is two halves
  if (Math.abs(sweep) >= 2 * Math.PI) {
    const half = start_radian + (sweep > 0 ? Math.PI : -Math.PI);
    return create_svg_element("path").a(
      "d",
      `M ${point(start_radian)} ${arc} 0 ${f_s} ${point(half)} ${arc} 0 ${f_s} ${point(start_radian)}`,
    );
  }
  const f_a = Math.abs(sweep) > Math.PI ? 1 : 0;
  return create_svg_element("path").a(
    "d",
    `M ${point(start_radian)} ${arc} ${f_a} ${f_s} ${point(start_radian + sweep)}`,
  );
}
