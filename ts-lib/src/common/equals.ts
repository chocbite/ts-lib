/**This compares two values of any type, returns true if they are equal
 * For any object type it will deep compare, with the exception of objects which have an objectEquals method, which can provide a custom comparisson
 * Will return true for NaN equal to NaN*/
export function any_equals_deep(any1: any, any2: any): boolean {
  const type = typeof any1;
  if (type !== typeof any2) return false;
  if (any1 === null) return any2 === null;
  switch (type) {
    case "object":
      return object_equals_deep(any1 as {}, any2 as {});
    case "number": {
      if (any1 !== any1 || any2 !== any2) {
        if (any1 !== any1 && any2 !== any2) return true;
        else return false;
      } else return any1 === any2;
    }
    default:
      return any1 === any2;
  }
}

/**This deep compares two objects, returns true if they are equal
 * It compares all keys in the object, with the exception of objects which have an objectEquals method, which can provide a custom comparisson*/
export function object_equals_deep(object1: object, object2: object): boolean {
  const props = Object.keys(object1);
  if (!array_equals_deep(props, Object.keys(object2))) return false;
  for (let i = 0, m = props.length; i < m; i++) {
    const prop = props[i];
    const e1 = object1[prop as keyof typeof object1];
    const e2 = object2[prop as keyof typeof object2];
    const type = typeof e1;
    if (type !== typeof e2) return false;
    if (!any_equals_deep(e1, e2)) return false;
  }
  return true;
}

/**This deep compares two arrays, returns true if they are equal
 * It compares all indexes in the array, with the exception of arrays which have an objectEquals method, which can provide a custom comparisson*/
export function array_equals_deep(
  array1: unknown[],
  array2: unknown[]
): boolean {
  if (array1.length != array2.length) return false;
  for (let i = 0, l = array1.length; i < l; i++) {
    const e1 = array1[i];
    const e2 = array2[i];
    const type = typeof e1;
    if (type !== typeof e2) return false;
    if (!any_equals_deep(e1, e2)) return false;
  }
  return true;
}
