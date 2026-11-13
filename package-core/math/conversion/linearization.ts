/**Performs a linear conversion using the given values
 * @param xin value to linearize
 * @param ends set true to limit linearization to end values
 * @param xy numbers to use for linearization first x values then y values, x values must be ascending
 * @returns NaN when there are less than two points or the amount of values is odd*/
export function linearise(xin: number, ends: boolean, ...xy: number[]) {
  const len = xy.length / 2;
  if (len < 2 || !Number.isInteger(len)) return NaN;
  if (ends) {
    if (xin <= xy[0]!) return xy[len]!;
    if (xin >= xy[len - 1]!) return xy[xy.length - 1]!;
  }
  //Segment containing xin, values outside the range use the first or last segment
  let i = 0;
  while (i < len - 2 && xin > xy[i + 1]!) i++;
  const x0 = xy[i]!;
  const x1 = xy[i + 1]!;
  const y0 = xy[len + i]!;
  const y1 = xy[len + i + 1]!;
  return y0 + ((xin - x0) * (y1 - y0)) / (x1 - x0);
}
