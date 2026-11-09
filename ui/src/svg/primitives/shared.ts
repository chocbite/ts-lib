import { SVGAttributes } from "../attributes";
import { NAME_SPACE } from "../shared";

export function create_svg_element<K extends keyof SVGElementTagNameMap>(
  name: K,
): SVGAttributes<SVGElementTagNameMap[K]> {
  return new SVGAttributes(document.createElementNS(NAME_SPACE, name));
}
