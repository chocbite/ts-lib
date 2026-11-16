# @chocbite/ts-lib/safe

Standard JavaScript functions that throw for ordinary failures, wrapped so they return a `Result` from `@chocbite/ts-lib/result` instead.

JavaScript throws the same kind of error for a failure you have to expect, like a network error, as for a bug, like reading a property of `undefined`. Code that catches one with a `try` around a whole block catches the other too, and the bug then looks like a network problem. The functions here catch only the call that can fail. Everything around them keeps throwing, so a bug still shows up as a bug.

```typescript
import { fetch_text_safe, FetchStatusError } from "@chocbite/ts-lib/safe";
```

## fetch_text_safe

`fetch_text_safe(url, init?)` calls the global `fetch` and gives the body text as `Result<string, Error>`. The error is one of:

| Failure                                  | Error                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `fetch` rejects                          | The rejection unchanged: a `TypeError` for a network failure, a `DOMException` named `AbortError` or `TimeoutError` for an aborted request. |
| The status is not ok                     | A `FetchStatusError` with the `status`, message `HTTP 404`.                               |
| The body fails to load                   | The rejection of `response.text()`, like a connection that drops while the body loads.   |

A rejection that is not an `Error` is wrapped in one, so the error is always an `Error`.

```typescript
const result = await fetch_text_safe("/api/device", { signal: AbortSignal.timeout(5000) });
if (result.ok) show(result.value);
else if (result.error instanceof FetchStatusError && result.error.status === 401) log_in();
else if (result.error.name === "TimeoutError") show_offline();
```

As a custom fetch for `make_fetch_parser` from `@chocbite/ts-lib/parse`, map the error to a string:

```typescript
make_fetch_parser(() => "/api/device", 1000, schema, {
  fetch: async (url, init) =>
    (await fetch_text_safe(url, { ...init, headers: { Authorization: `Bearer ${token()}` } })).map_err((e) => e.message),
});
```
