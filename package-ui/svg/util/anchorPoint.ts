//Enum describing the diffrent possible anchor points
export const SVGAnchorPoint = {
  bottomLeft: 0,
  middleLeft: 1,
  topLeft: 2,
  topCenter: 3,
  topRight: 4,
  middleRight: 5,
  bottomRight: 6,
  bottomCenter: 7,
  middleCenter: 8,
} as const;
export type SVGAnchorPoint =
  (typeof SVGAnchorPoint)[keyof typeof SVGAnchorPoint];
