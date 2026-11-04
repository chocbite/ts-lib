import { ok } from ".";

console.error("TESTETSWE");
const sync = ok(100);
const native = Promise.resolve(sync);
console.warn(native);
