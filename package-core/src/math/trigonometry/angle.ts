const DEG_CONST = 180 / Math.PI;
const RAD_CONST = Math.PI / 180;

/** Converts radians todegrees*/
export const radians_to_degrees = (radians: number) => {
  return radians * DEG_CONST;
};

/** Converts degrees to radians*/
export const degrees_to_radians = (degrees: number) => {
  return degrees * RAD_CONST;
};
