import type { WidgetGeometry } from "./widget";

/**Turns a point by the angle in degrees, clockwise on the page*/
const turn = (x: number, y: number, degrees: number): [number, number] => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [x * cos - y * sin, x * sin + y * cos];
};

/**The box around the outlines of the widgets, rotated widgets by their rotated outline
 * @param rotation of the box, the widgets are bounded in a frame turned by it, its x and y are those of the box before turning,
 * like those of a widget, 0 bounds them on the page*/
export function group_bounds(
  geometries: readonly WidgetGeometry[],
  rotation = 0,
): WidgetGeometry {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const { x, y, width, height, rotation: own } of geometries) {
    const radians = ((own - rotation) * Math.PI) / 180;
    //Half the size of the box around the outline, in the frame
    const half_x =
      (Math.abs(Math.cos(radians)) * width +
        Math.abs(Math.sin(radians)) * height) /
      2;
    const half_y =
      (Math.abs(Math.sin(radians)) * width +
        Math.abs(Math.cos(radians)) * height) /
      2;
    //The center in the frame
    const [center_x, center_y] = turn(x + width / 2, y + height / 2, -rotation);
    left = Math.min(left, center_x - half_x);
    top = Math.min(top, center_y - half_y);
    right = Math.max(right, center_x + half_x);
    bottom = Math.max(bottom, center_y + half_y);
  }
  if (left > right) return { x: 0, y: 0, width: 0, height: 0, rotation };
  const width = right - left;
  const height = bottom - top;
  //The center of the box back on the page
  const [center_x, center_y] = turn(
    left + width / 2,
    top + height / 2,
    rotation,
  );
  return {
    x: center_x - width / 2,
    y: center_y - height / 2,
    width,
    height,
    rotation,
  };
}

/**The geometry of every widget after their box changed from one frame to another,
 * the widgets keep their place in the box, scaled with it along its axes and turned with it
 * A widget scales along its own axes, by how much the box stretches along them, so a rotated widget stays a rectangle,
 * exact for widgets turned by a multiple of 90 degrees to the box, close for other angles
 * @param geometries of the widgets when the box was the from frame
 * @param from the box at the start, usually from group_bounds
 * @param to the box now, the widgets turn by the difference of the rotations*/
export function transform_group(
  geometries: readonly WidgetGeometry[],
  from: WidgetGeometry,
  to: WidgetGeometry,
): WidgetGeometry[] {
  const scale_x = from.width > 0 ? to.width / from.width : 1;
  const scale_y = from.height > 0 ? to.height / from.height : 1;
  const turned = to.rotation - from.rotation;
  const from_x = from.x + from.width / 2;
  const from_y = from.y + from.height / 2;
  const to_x = to.x + to.width / 2;
  const to_y = to.y + to.height / 2;
  return geometries.map(({ x, y, width, height, rotation }) => {
    //The center in the frame of the box, scaled with it, then turned with it
    const [local_x, local_y] = turn(
      x + width / 2 - from_x,
      y + height / 2 - from_y,
      -from.rotation,
    );
    const [moved_x, moved_y] = turn(
      local_x * scale_x,
      local_y * scale_y,
      to.rotation,
    );
    //How much the box stretches along the axes of the widget
    const radians = ((rotation - from.rotation) * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const new_width = width * Math.hypot(scale_x * cos, scale_y * sin);
    const new_height = height * Math.hypot(scale_x * sin, scale_y * cos);
    return {
      x: to_x + moved_x - new_width / 2,
      y: to_y + moved_y - new_height / 2,
      width: new_width,
      height: new_height,
      rotation: rotation + turned,
    };
  });
}

/**An angle from 0 up to 360*/
export const wrap_angle = (degrees: number): number =>
  ((degrees % 360) + 360) % 360;
