/**This compares two values of any type, returns true if they are equal
 * Objects are compared deeply, see object_equals_deep
 * Will return true for NaN equal to NaN*/
export function any_equals_deep(any1: unknown, any2: unknown): boolean {
  if (any1 === any2) return true;
  if (typeof any1 === "number" && typeof any2 === "number")
    return any1 !== any1 && any2 !== any2;
  if (
    typeof any1 !== "object" ||
    typeof any2 !== "object" ||
    any1 === null ||
    any2 === null
  )
    return false;
  return object_equals_deep(any1, any2);
}

/**This deep compares two objects, returns true if they are equal
 * Objects must have the same prototype, so an array never equals a plain object.
 * Plain objects compare all own keys in any order, arrays every index, dates their time.
 * Maps compare values deeply, their keys and the values of sets are matched by identity like Map.has and Set.has*/
export function object_equals_deep(object1: object, object2: object): boolean {
  if (object1 === object2) return true;
  if (Object.getPrototypeOf(object1) !== Object.getPrototypeOf(object2))
    return false;
  if (Array.isArray(object1))
    return array_equals_deep(object1, object2 as unknown[]);
  if (object1 instanceof Date)
    return object1.getTime() === (object2 as Date).getTime();
  if (object1 instanceof Map) {
    const map2 = object2 as Map<unknown, unknown>;
    if (object1.size !== map2.size) return false;
    for (const [key, value] of object1)
      if (!map2.has(key) || !any_equals_deep(value, map2.get(key)))
        return false;
    return true;
  }
  if (object1 instanceof Set) {
    const set2 = object2 as Set<unknown>;
    if (object1.size !== set2.size) return false;
    for (const value of object1) if (!set2.has(value)) return false;
    return true;
  }
  const keys = Object.keys(object1);
  if (keys.length !== Object.keys(object2).length) return false;
  for (const key of keys)
    if (
      !Object.hasOwn(object2, key) ||
      !any_equals_deep(
        (object1 as Record<string, unknown>)[key],
        (object2 as Record<string, unknown>)[key]
      )
    )
      return false;
  return true;
}

/**This deep compares two arrays, returns true if they have the same length and every index is equal*/
export function array_equals_deep(
  array1: readonly unknown[],
  array2: readonly unknown[]
): boolean {
  if (array1.length !== array2.length) return false;
  for (let i = 0; i < array1.length; i++)
    if (!any_equals_deep(array1[i], array2[i])) return false;
  return true;
}
