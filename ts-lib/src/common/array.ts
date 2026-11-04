/** Creates an array of a specified range, populating it via an initializer function.
 * * @param start - The starting index.
 * @param end - The ending index (exclusive).
 * @param init - A callback that returns a value of type T for each index i.
 * @returns An array of type T[] containing the initialized values.*/
export function array_from_range<T>(
  start: number,
  end: number,
  init: (i: number) => T
): T[] {
  if (end < start) return [];
  const result: T[] = [];
  if (end > 0) result.length = end - start;
  for (let i = start; i < end; i++) result[i - start] = init(i);
  return result;
}

/** Generates an array of type T from an inclusive range [start, end].
 * * @param start - The starting integer index.
 * @param end - The ending integer index (inclusive).
 * @param init - A factory function that produces an element of type T given the current index i.
 * @returns An array of length (end - start + 1), or an empty array if end < start.*/
export function array_from_range_inclusive<T>(
  start: number,
  end: number,
  init: (i: number) => T
): T[] {
  if (end < start) return [];
  const result: T[] = [];
  if (end > 0) result.length = end - start + 1;
  for (let i = start; i <= end; i++) result[i - start] = init(i);
  return result;
}

/**Creates an array of a specified length, populating each index
 * using a provided initialization function.
 * * @param len - The desired number of elements in the array.
 * @param init - A function that takes the current index (i) and returns a value of type T.
 * @returns An array of length 'len', or an empty array if 'len' is zero or negative. */
export function array_from_length<T>(
  len: number,
  init: (i: number) => T,
  prepend: T[] = [],
  append: T[] = []
): T[] {
  if (len <= 0) return [];
  const result: T[] = [];
  result.length = len;
  for (let i = 0; i < len; i++) result[i] = init(i);
  return [...prepend, ...result, ...append];
}
