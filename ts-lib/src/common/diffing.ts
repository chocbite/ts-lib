export function array_diff<T>(
  main: T[],
  second: T[],
): { added: T[]; removed: T[] } {
  const added = second.filter((x) => !main.includes(x));
  const removed = main.filter((x) => !second.includes(x));
  return { added, removed };
}

export function object_key_diff<T1 extends object, T2 extends object>(
  main: T1,
  second: T2,
): { added: string[]; removed: string[] } {
  return array_diff(Object.keys(main), Object.keys(second));
}
