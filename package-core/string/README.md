# @chocbite/ts-lib/string

String helpers: UTF-8 byte lengths and limits, for fields stored in a fixed number of bytes, and ISO 8601 time strings with a timezone offset.

```typescript
import { string_byte_length, string_byte_limit, time_and_timezone_to_string } from "@chocbite/ts-lib/string";
```

## Exports

| Export                                                       | Description                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `string_byte_length(string)`                                 | Length of the string in UTF-8 bytes.                                           |
| `string_byte_limit(string, limit)`                           | The string cut to at most `limit` UTF-8 bytes, never inside a character.       |
| `time_and_timezone_to_string(time, tz_minutes?, milliseconds?)` | ISO 8601 string of a `Date` as local time at a UTC offset.                   |

## Byte length and limit

```typescript
string_byte_length("abc"); // 3
string_byte_length("æøå"); // 6
string_byte_length("😀"); // 4

string_byte_limit("hello", 3); // "hel"
string_byte_limit("æøå", 3); // "æ", "ø" would be cut in half
string_byte_limit("a😀b", 3); // "a"
```

`string_byte_length` counts without encoding the string, which is faster for short strings. Strings longer than 2048 characters are encoded with `TextEncoder`. The text inputs in ts-lib-ui use both functions for their `max_bytes` option.

## Time with timezone

```typescript
const time = new Date(Date.UTC(2026, 0, 15, 12, 30, 45, 123));
time_and_timezone_to_string(time); // "2026-01-15T12:30:45Z"
time_and_timezone_to_string(time, 60); // "2026-01-15T13:30:45+01:00"
time_and_timezone_to_string(time, -330, true); // "2026-01-15T07:00:45.123-05:30"
```

- **`tz_minutes`** is the offset from UTC in minutes, positive east of UTC. The time is printed as the local time at that offset, followed by the offset, or `Z` for 0.
- **`milliseconds`** adds the milliseconds.

The offset is given, not read from the device, so the result is the same on every device.
