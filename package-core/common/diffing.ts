import { any_equals_deep } from "./equals";

/**Above this length lookups go through a Set, below it includes is faster than building one*/
const SET_THRESHOLD = 16;

function has_lookup<T>(arr: readonly T[]): (x: T) => boolean {
  if (arr.length <= SET_THRESHOLD) return (x) => arr.includes(x);
  const set = new Set(arr);
  return (x) => set.has(x);
}

/**Returns the items of second that are not in main as added, and the items of main that are not in second as removed.
 * Items are compared like includes (SameValueZero), so objects match by identity. Runs in linear time for large arrays.*/
export function array_diff<T>(
  main: readonly T[],
  second: readonly T[],
): { added: T[]; removed: T[] } {
  const in_main = has_lookup(main);
  const in_second = has_lookup(second);
  const added = second.filter((x) => !in_main(x));
  const removed = main.filter((x) => !in_second(x));
  return { added, removed };
}

/**Like array_diff, but items match when the key function gives the same key, for example an id.
 * Keys are compared like includes (SameValueZero), each item's key is computed once. Runs in linear time for large arrays.*/
export function array_diff_by<T, K>(
  main: readonly T[],
  second: readonly T[],
  key: (item: T) => K,
): { added: T[]; removed: T[] } {
  const main_keys = main.map(key);
  const second_keys = second.map(key);
  const in_main = has_lookup(main_keys);
  const in_second = has_lookup(second_keys);
  const added = second.filter((_, i) => !in_main(second_keys[i]!));
  const removed = main.filter((_, i) => !in_second(main_keys[i]!));
  return { added, removed };
}

/**Like array_diff, but items match when any_equals_deep says they are equal, so objects match by content.
 * Every item is compared with the items of the other array, so the cost is length times length deep comparisons,
 * only use it for small arrays, prefer array_diff_by when items have a key.*/
export function array_diff_deep<T>(
  main: readonly T[],
  second: readonly T[],
): { added: T[]; removed: T[] } {
  const added = second.filter((x) => !main.some((y) => any_equals_deep(x, y)));
  const removed = main.filter((x) => !second.some((y) => any_equals_deep(x, y)));
  return { added, removed };
}

/**Diffs the own enumerable string keys of two objects, values are ignored*/
export function object_key_diff<T1 extends object, T2 extends object>(
  main: T1,
  second: T2,
): { added: string[]; removed: string[] } {
  return array_diff(Object.keys(main), Object.keys(second));
}
