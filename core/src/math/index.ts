export * from "./conversion/linearization";
export * from "./hash";
export * from "./trigonometry";

export function number_step_start_decimal(
  value: number,
  step: number = 0,
  start: number = 0,
  decimals: number = -1,
): number {
  if (step === 0) return value;
  const val = start
    ? Math.round((value - start + Number.EPSILON) / step) * step + start
    : Math.round((value + Number.EPSILON) / step) * step;
  return decimals === -1 ? val : parseFloat(val.toFixed(decimals));
}
