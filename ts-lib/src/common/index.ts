export * from "./array";
export * from "./async";
export * from "./bit";
export * from "./debounce";
export * from "./diffing";
export * from "./equals";
export * from "./hash";
export * from "./ip";
export * from "./number";
export * from "./throttle";


export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**Returns true if the object has no own enumerable string properties */
export function object_empty(obj: object): boolean {
  for (const key in obj) if (Object.hasOwn(obj, key)) return false;
  return true;
}
