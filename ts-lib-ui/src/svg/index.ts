import { SVGAttributes } from "./attributes";
import { circle, circle_arc } from "./primitives/circle";
import { ellipse, ellipse_arc } from "./primitives/ellipse";
import { group } from "./primitives/group";
import { line } from "./primitives/line";
import { path } from "./primitives/path";
import {
  rectangle_from_center,
  rectangle_from_corner,
} from "./primitives/rectangle";
import { create_svg_element } from "./primitives/shared";
import { svg as svgsvg } from "./primitives/svg";
import { multi_line_text, text } from "./primitives/text";
import { isosceles_triangle } from "./primitives/triangle";
import { angle_to_anchor_point } from "./util/angleToAnchorPoint";

export const svg = {
  create: create_svg_element,
  attr: (elem: SVGElement) => new SVGAttributes(elem),
  //Primitives
  circle: circle,
  circle_arc: circle_arc,
  ellipse: ellipse,
  ellipse_arc: ellipse_arc,
  group: group,
  line: line,
  path: path,
  rectangle_from_center: rectangle_from_center,
  rectangle_from_corner: rectangle_from_corner,
  svg: svgsvg,
  text: text,
  multi_line_text: multi_line_text,
  isosceles_triangle: isosceles_triangle,
  //Utilities
  angle_to_anchor_point: angle_to_anchor_point,
};

export type SVGFunc = () => SVGSVGElement;
export { SVGAnchorPoint } from "./util/anchorPoint";

declare global {
  /**Types enum icons in @chocbite/ts-lib state as SVGFunc*/
  interface ChocbiteStateRegister {
    icon: SVGFunc;
  }
}
