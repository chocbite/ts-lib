# @chocbite/ts-lib/common

Small general purpose helpers: arrays, async, bits, timing, diffing, deep equality, hashing (SHA-1 and MD5), IP addresses and number formatting.

```typescript
import { debounce, any_equals_deep, IPAddress } from "@chocbite/ts-lib/common";
```

## Array

Build arrays from an index callback. The array is allocated once at its final size.

```typescript
array_from_range(2, 5, (i) => i * 10); // [20, 30, 40], end is exclusive
array_from_range_inclusive(1, 3, (i) => i); // [1, 2, 3], end is inclusive
array_from_length(3, (i) => i, [-1], [99]); // [-1, 0, 1, 2, 99]
```

`array_from_length` takes optional `prepend` and `append` arrays. The range functions return `[]` when `end < start`, and `array_from_length` returns only `prepend` and `append` when `len <= 0`.

## Async

| Function                    | Description                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `is_promise_like(value)`    | True for any object with a `then` function, narrows to `PromiseLike<T>`.                    |
| `sleep(ms, arg?)`           | Promise that resolves with `arg` after `ms`.                                                |
| `sleep_lazy(ms, fn?)`       | Promise that resolves with `fn()` after `ms`, `fn` is called when the timer fires.          |
| `deferrer(ms, fn, arg?)`    | Returns a function that, every time it is called, runs `fn(arg)` after `ms`.                |
| `sync_resolve(value)`       | `PromiseLike` whose `then` runs synchronously. A promise like `value` is returned as is.    |
| `sync_reject(error)`        | `PromiseLike` whose `then` calls `on_rejected` synchronously.                               |

`sync_resolve` lets code that may or may not be async use one `then` chain without waiting a microtask when the value is already there:

```typescript
const out: number[] = [];
sync_resolve(5).then((v) => out.push(v));
out; // [5], already pushed
```

It behaves like a native promise: an error thrown in `on_fulfilled` gives a rejected result and is not passed to the `on_rejected` of the same `then`. Like `Promise.reject`, `sync_reject` does not await a promise given as the reason.

## Bit

Read and write bits of a number. They work on 32 bit integers, like the JavaScript bit operators.

```typescript
get_bit(0b0100, 2); // true
set_bit(0, 3); // 8, omit the state to toggle
set_bit(0b1111, 0, false); // 14
toggle_bit(0b0001, 0); // 0
get_bits(0b1011_0000, 4, 4); // 11, reads 4 bits starting at bit 4
set_bits(0, 4, 4, 0b1010); // 160, writes 4 bits starting at bit 4
```

`set_bits` masks `bits` to `bit_count`, so it never changes bits outside the field.

## Debounce and throttle

```typescript
const save = debounce((text: string) => store(text), 500);
save("a");
save("ab"); // only store("ab") runs, 500 ms after the last call

const move = throttle((x: number) => draw(x), 16);
```

- **`debounce(fn, wait = 0, leading = false)`**: runs `fn` with the latest arguments once `wait` ms pass without a call. With `wait` 0 it only merges calls made in the same cycle. With `leading` the first call runs at once, and calls made while it is waiting run once at the end.
- **`throttle(fn, wait = 0)`**: runs `fn` at once on the first call, then at most once per `wait` ms with the latest arguments, so the last call is never lost.

Both return a function with no return value and a `cancel()` method (type `Cancelable<F>`). `cancel()` drops the pending call, stops the timer and resets the function, so the next call behaves like the first one. Call it when the owner is torn down so `fn` does not run afterwards.

```typescript
const save = debounce((text: string) => store(text), 500);
save("a");
save.cancel(); // store is never called
```

## Diffing

```typescript
array_diff([1, 2, 3], [2, 3, 4]); // { added: [4], removed: [1] }
object_key_diff({ a: 1, b: 2 }, { b: 0, c: 0 }); // { added: ["c"], removed: ["a"] }
```

`added` is what is in the second argument and not in the first, `removed` the opposite. Items are compared like `includes` (`NaN` matches `NaN`), so objects match by identity, not by content. Arrays longer than 16 items are looked up through a `Set`, so large diffs run in linear time. `object_key_diff` compares only own enumerable string keys, values are ignored.

To match objects that are not the same instance, use one of these:

```typescript
const old_rows = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
const new_rows = [{ id: 2, v: "changed" }, { id: 3, v: "c" }];
array_diff_by(old_rows, new_rows, (row) => row.id);
// { added: [{ id: 3, v: "c" }], removed: [{ id: 1, v: "a" }] }

array_diff_deep([{ id: 1, tags: ["a"] }], [{ id: 1, tags: ["a"] }]);
// { added: [], removed: [] }
```

- **`array_diff_by(main, second, key)`**: items match when `key` gives the same value, compared like `includes`. `key` is called once per item, and it stays linear for large arrays. Prefer this whenever items have something that identifies them, like an id.
- **`array_diff_deep(main, second)`**: items match when `any_equals_deep` says they are equal. Every item is compared with the items of the other array, so the cost is length times length deep comparisons. Only use it for small arrays.

All diff functions return the original items, not copies.

## Equality

```typescript
any_equals_deep({ a: [1, { b: NaN }] }, { a: [1, { b: NaN }] }); // true
any_equals_deep([], {}); // false
```

- **`any_equals_deep(a, b)`**: any two values. Primitives with `===`, except that `NaN` equals `NaN`, and objects with `object_equals_deep`.
- **`object_equals_deep(a, b)`**: both must have the same prototype. Plain objects compare all own enumerable string keys in any order, arrays compare every index, and dates compare their time. Map values are compared deeply, but map keys and set values are matched by identity, like `Map.has` and `Set.has`.
- **`array_equals_deep(a, b)`**: same length and every index equal.

## Hash

```typescript
sha1("abc").hex_small; // "a9993e364706816aba3e25717850c26c9cd0d89d"
md5("abc").hex_small; // "900150983cd24fb0d6963f7d28e17f72"
md5(new Uint8Array([1, 2, 3])).number_array; // 16 byte values
```

Pure TypeScript SHA-1 and MD5 over UTF-8 text or bytes, for places where Web Crypto is not available. Both are synchronous. Neither is collision resistant, so use them for checksums and cache keys, not for security.

Both return a `Hash` holding the digest bytes:

| Member        | Description                                        |
| ------------- | -------------------------------------------------- |
| `hex_small`   | Lowercase hex string, computed once and cached.    |
| `hex_big`     | Uppercase hex string.                              |
| `number_array`| The bytes as a new `number[]`.                     |
| `uint8_array` | The bytes as a new `Uint8Array`.                   |

The arrays are copies, so changing them does not change the hash.

## IP address

```typescript
const ip = new IPAddress("192.168.1.10");
ip.version; // 4
ip.as_array; // [192, 168, 1, 10]
ip.as_big_int; // 3232235786n
ip.to_string(); // "192.168.1.10"

const ip6 = new IPAddress("fe80::1");
ip6.to_string(); // "fe80::1"
ip6.equals(new IPAddress([0xfe80, 0, 0, 0, 0, 0, 0, 1])); // true
```

The constructor takes:

- an IPv4 or IPv6 string (IPv6 may use `::` once)
- a `number` for a 32 bit IPv4 address
- a `bigint` for a 128 bit IPv6 address
- an array of 4 IPv4 octets or 8 IPv6 groups

Invalid input throws an `Error` naming the input and the reason, for example `Invalid IP address "300.1.1.1": 300 is not a whole number from 0 to 255`.

| Member              | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| `version`           | `IPVersion.V4` (4) or `IPVersion.V6` (6).                           |
| `is_v4`, `is_v6`    | Version checks.                                                     |
| `as_big_int`        | The address as one `bigint`.                                        |
| `as_array`          | Octets (IPv4) or groups (IPv6) as numbers.                          |
| `to_string()`       | Dotted IPv4, or IPv6 in the RFC 5952 form (see below).              |
| `equals(other)`     | True for the same version and value, even for different objects.    |

IPv6 `to_string()` gives the RFC 5952 form: lowercase hex without leading zeros, and the longest run of two or more zero groups shortened to `::` (the first run when two are equally long). A single zero group stays `0`, so `"2001:db8:0:0:1:0:0:1"` gives `"2001:db8::1:0:0:1"`.

## Number

```typescript
number_limit_decimals(3.14159, 3); // "3.142"
number_limit_decimals(1.5, 2); // "1.5", trailing zeros are dropped
number_limit_decimals(2.0001, 2); // "2"
number_limit_decimals(2.0001, undefined); // "2.0001", no rounding
```

It returns a string, rounded with `toFixed`.

## Misc

- **`object_empty(obj)`**: true if the object has no own enumerable string keys.
- **`Prettify<T>`**: type that flattens an intersection into one object type, so editor tooltips show its fields.
