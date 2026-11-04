/**Rounds a number to at most the requested number of decimal places without using a regular expression.
 * * @param value - The number to round.
 * @param decimals - The maximum number of decimal places, or undefined to not round at all.
 * @returns The rounded number as a string.*/
export function number_limit_decimals(
  value: number,
  decimals: number | undefined,
): string {
  if (decimals === undefined) return value.toString();
  const result = value.toFixed(decimals);
  const decimal_index = result.indexOf(".");
  if (decimal_index === -1) return result;

  let end = result.length;
  while (result[end - 1] === "0") end--;
  if (end === decimal_index + 1) end--;
  return result.slice(0, end);
}
