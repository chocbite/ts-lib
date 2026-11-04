import { SVGAttributes } from "../attributes";
import { SVGAnchorPoint } from "../util/anchorPoint";
import { create_svg_element } from "./shared";

/**Creates a text nodes for an svg
 * @param x x coordinate of text
 * @param y y coordinate of text
 * @param text text
 * @param size size of text in px
 * @param anchor anchor point of text*/
export function text(
  x: number,
  y: number,
  text: string,
  size: number,
  anchor: SVGAnchorPoint,
): SVGAttributes<SVGTextElement> {
  const text_elem = create_svg_element("text")
    .a("x", String(x))
    .a("y", String(y))
    .a("font-size", String(size));
  text_elem.elem.innerHTML = text;
  switch (anchor) {
    case SVGAnchorPoint.bottomLeft:
    case SVGAnchorPoint.middleLeft:
    case SVGAnchorPoint.topLeft: {
      text_elem.a("text-anchor", "start");
      break;
    }
    case SVGAnchorPoint.topCenter:
    case SVGAnchorPoint.bottomCenter:
    case SVGAnchorPoint.middleCenter: {
      text_elem.a("text-anchor", "middle");
      break;
    }
    case SVGAnchorPoint.topRight:
    case SVGAnchorPoint.middleRight:
    case SVGAnchorPoint.bottomRight: {
      text_elem.a("text-anchor", "end");
      break;
    }
  }
  switch (anchor) {
    case SVGAnchorPoint.bottomLeft:
    case SVGAnchorPoint.bottomRight:
    case SVGAnchorPoint.bottomCenter: {
      text_elem.a("dominant-baseline", "auto");
      break;
    }
    case SVGAnchorPoint.middleLeft:
    case SVGAnchorPoint.middleRight:
    case SVGAnchorPoint.middleCenter: {
      text_elem.a("dominant-baseline", "central");
      break;
    }
    case SVGAnchorPoint.topLeft:
    case SVGAnchorPoint.topCenter:
    case SVGAnchorPoint.topRight: {
      text_elem.a("dominant-baseline", "hanging");
      break;
    }
  }
  return text_elem;
}

/**Creates a text nodes for an svg
 * @param x x coordinate of text
 * @param y y coordinate of text
 * @param width width of text
 * @param height height of text
 * @param text text
 * @param size size of text in px
 * @param anchor anchor point of */
export function multi_line_text(
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  size: number,
  anchor: SVGAnchorPoint,
): SVGAttributes<SVGForeignObjectElement> {
  const text_element = create_svg_element("foreignObject");
  const text_div = text_element.elem.appendChild(document.createElement("div"));
  text_element.a("width", String(width));
  text_element.a("height", String(height));
  text_element.a("x", String(x));
  text_element.a("y", String(y));
  text_div.style.fontSize = size + "px";
  text_div.style.width = "100%";
  text_div.style.height = "100%";
  text_div.style.display = "flex";
  text_div.innerHTML = text;
  switch (anchor) {
    case SVGAnchorPoint.bottomLeft:
    case SVGAnchorPoint.middleLeft:
    case SVGAnchorPoint.topLeft: {
      text_div.style.textAlign = "start";
      text_div.style.justifyContent = "flex-start";
      break;
    }
    case SVGAnchorPoint.topCenter:
    case SVGAnchorPoint.bottomCenter:
    case SVGAnchorPoint.middleCenter: {
      text_div.style.textAlign = "center";
      text_div.style.justifyContent = "center";
      break;
    }
    case SVGAnchorPoint.topRight:
    case SVGAnchorPoint.middleRight:
    case SVGAnchorPoint.bottomRight: {
      text_div.style.textAlign = "end";
      text_div.style.justifyContent = "flex-end";
      break;
    }
  }
  switch (anchor) {
    case SVGAnchorPoint.bottomLeft:
    case SVGAnchorPoint.bottomRight:
    case SVGAnchorPoint.bottomCenter: {
      text_div.style.alignItems = "flex-end";
      break;
    }
    case SVGAnchorPoint.middleLeft:
    case SVGAnchorPoint.middleRight:
    case SVGAnchorPoint.middleCenter: {
      text_div.style.alignItems = "center";
      break;
    }
    case SVGAnchorPoint.topLeft:
    case SVGAnchorPoint.topCenter:
    case SVGAnchorPoint.topRight: {
      text_div.style.alignItems = "flex-start";
      break;
    }
  }
  return text_element;
}
