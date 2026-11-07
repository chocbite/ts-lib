export * from "./conversion/linearization";
export * from "./hash";
export * from "./trigonometry";

/**Snaps a value to the nearest step counted from start, then rounds it to the given decimals
 * @param step 0 to not snap
 * @param decimals -1 to not round*/
export function number_step_start_decimal(
  value: number,
  step: number = 0,
  start: number = 0,
  decimals: number = -1,
): number {
  const val =
    step === 0
      ? value
      : start
        ? Math.round((value - start + Number.EPSILON) / step) * step + start
        : Math.round((value + Number.EPSILON) / step) * step;
  return decimals === -1 ? val : parseFloat(val.toFixed(decimals));
}
