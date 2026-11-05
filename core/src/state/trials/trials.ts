import state from "..";
import "./collected";

const tup = state.ok_w([1, 2, 3, 4, 5] as [
  number,
  number,
  number,
  number,
  number,
]);

// @ts-expect-error Tuples retain their length.
tup.set_ok([1, 2, 3, 4]);
// @ts-expect-error Tuples retain their member types.
tup.set_ok([1, 2, 3, 4, undefined]);
// @ts-expect-error Tuple writes retain their length.
tup.write([1, 2, 3, 4, 5, 6]);
console.warn(tup);

const arr = state.ok_w([1, 2, 3, 4, 5]);

// @ts-expect-error Number arrays do not accept undefined elements.
arr.array.push(undefined);

const yo = state.ok<any>(new Date());
console.warn(await yo.to_json());
yo.set_ok({ a: 1, b: 2 });
console.warn(await yo.to_json());
