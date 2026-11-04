import type { Radians } from "../shared";

/** Calculates the bounding box width and height of a rotated rectangle
 * @param width width of rectangle
 * @param height height of rectangle
 * @param angle angle of rotation in radians*/
export const bounding_width_and_height_of_rotated_rectangle = (
  width: number,
  height: number,
  angle: Radians
) => {
  const ct = Math.cos(angle);
  const st = Math.sin(angle);
  const x = -width / 2;
  const y = height / 2;

  if (st > 0) {
    if (ct > 0) {
      return {
        width: -x * ct + y * st - (x * ct + -y * st),
        height: -x * st + y * ct - (x * st + -y * ct),
      };
    } else {
      return {
        width: x * ct + y * st - (-x * ct + -y * st),
        height: -x * st + -y * ct - (x * st + y * ct),
      };
    }
  } else {
    if (ct > 0) {
      return {
        width: -x * ct + -y * st - (x * ct + y * st),
        height: x * st + y * ct - (-x * st + -y * ct),
      };
    } else {
      return {
        width: x * ct + -y * st - (-x * ct + y * st),
        height: x * st + -y * ct - (-x * st + y * ct),
      };
    }
  }
};
