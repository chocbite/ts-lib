import { SVGAnchorPoint } from "./anchorPoint";

/**Converts an angle to an anchor point
 * @param angle angle in radians*/
export const angle_to_anchor_point = (angle: number) => {
  const sec =
    angle >= 0 ? angle % 6.283185307179586 : -(angle % 6.283185307179586);
  if (sec > 5.93411945678072) {
    return SVGAnchorPoint.middleRight;
  } else if (sec > 4.974188368183839) {
    return SVGAnchorPoint.topRight;
  } else if (sec > 4.45058959258554) {
    return SVGAnchorPoint.topCenter;
  } else if (sec > 3.4906585039886591) {
    return SVGAnchorPoint.topLeft;
  } else if (sec > 2.792526803190927) {
    return SVGAnchorPoint.middleLeft;
  } else if (sec > 1.832595714594046) {
    return SVGAnchorPoint.bottomLeft;
  } else if (sec > 1.308996938995747) {
    return SVGAnchorPoint.bottomCenter;
  } else if (sec > 0.3490658503988659) {
    return SVGAnchorPoint.bottomRight;
  } else {
    return SVGAnchorPoint.middleRight;
  }
};
