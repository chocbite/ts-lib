import { SVGAttributes } from "../attributes";
import { NAME_SPACE } from "../shared";

type SVGElements = {
  ellipse: SVGEllipseElement;
  circle: SVGCircleElement;
  path: SVGPathElement;
  line: SVGLineElement;
  rect: SVGRectElement;
  text: SVGTextElement;
  g: SVGGElement;
  svg: SVGSVGElement;
  foreignObject: SVGForeignObjectElement;
};

export function create_svg_element<K extends keyof SVGElements>(
  name: K,
): SVGAttributes<SVGElements[K]> {
  return new SVGAttributes(document.createElementNS(NAME_SPACE, name));
}
