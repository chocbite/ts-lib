# @chocbite/ts-lib/safe

Standard JavaScript functions that throw for ordinary failures, wrapped so they return a `Result` from `@chocbite/ts-lib/result` instead.

JavaScript throws the same kind of error for a failure you have to expect, like a network error, as for a bug, like reading a property of `undefined`. Code that catches one with a `try` around a whole block catches the other too, and the bug then looks like a network problem. The functions here catch only the call that can fail. Everything around them keeps throwing, so a bug still shows up as a bug.

```typescript
import { fetch_status_safe, fetch_text_safe, FetchStatusError } from "@chocbite/ts-lib/safe";
```

## Fetch

Both call the global `fetch` and take the same `(url, init?)`. They differ in what they give:

| Function                       | Gives                     | Use for                                                    |
| ------------------------------ | ------------------------- | ---------------------------------------------------------- |
| `fetch_text_safe(url, init?)`   | `Result<string, Error>`, the body text | Reading, like a GET whose answer you parse.     |
| `fetch_status_safe(url, init?)` | `Result<number, Error>`, the status    | Sending, like a POST or PATCH whose answer you don't need. The body isn't read. It's cancelled, so it doesn't hold the connection open. |

The error is one of:

| Failure                                  | Error                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `fetch` rejects                          | The rejection unchanged: a `TypeError` for a network failure, a `DOMException` named `AbortError` or `TimeoutError` for an aborted request. |
| The status is not ok                     | A `FetchStatusError` with the `status` and the `body` text, message `HTTP 404`. Servers often explain a rejection in the body. `body` is `""` when it fails to load. |
| The body fails to load (`fetch_text_safe` only) | The rejection of `response.text()`, like a connection that drops while the body loads. |

A rejection that is not an `Error` is wrapped in one, so the error is always an `Error`.

```typescript
const result = await fetch_text_safe("/api/device", { signal: AbortSignal.timeout(5000) });
if (result.ok) show(result.value);
else if (result.error instanceof FetchStatusError && result.error.status === 401) log_in();
else if (result.error.name === "TimeoutError") show_offline();

const saved = await fetch_status_safe("/api/device", { method: "PATCH", body: JSON.stringify(change) });
if (saved.err && saved.error instanceof FetchStatusError) show_warning(saved.error.body);
```

With `make_fetch_parser` from `@chocbite/ts-lib/parse`, map the error to a string. `fetch_text_safe` fits the `fetch` option and `fetch_status_safe` the `write` option:

```typescript
make_fetch_parser(() => "/api/device", 1000, schema, {
  fetch: async (url, init) =>
    (await fetch_text_safe(url, { ...init, headers: { Authorization: `Bearer ${token()}` } })).map_err((e) => e.message),
  write: async (payload) =>
    (await fetch_status_safe("/api/device", { method: "PATCH", body: JSON.stringify(payload) }))
      .map(() => undefined)
      .map_err((e) => (e instanceof FetchStatusError && e.body) || e.message),
});
```
