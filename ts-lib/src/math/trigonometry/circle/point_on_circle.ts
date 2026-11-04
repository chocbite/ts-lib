import type { Radians } from "../shared";

/**Finds a point on a circle
 * @param center_x x coordinate of circle center
 * @param center_y y coordinate of circle center
 * @param radius radius of circle
 * @param angle angle of point in radians*/
export const point_on_circle = (
  center_x: number,
  center_y: number,
  radius: number,
  angle: Radians,
) => {
  return {
    x: radius * Math.cos(angle) + center_x,
    y: radius * Math.sin(angle) + center_y,
  };
};
