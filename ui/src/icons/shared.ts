import { node_clone } from "#dom";
import type { SVGFunc } from "#svg";

export function generate_function(name: string, icon: string): SVGFunc {
  let svg: SVGSVGElement;
  return function (this: any) {
    if (svg) {
      return node_clone(svg);
    } else {
      svg = new DOMParser().parseFromString(icon, "image/svg+xml")
        .firstChild as SVGSVGElement;
      svg.setAttribute("icon", name);
      return node_clone(svg);
    }
  };
}
