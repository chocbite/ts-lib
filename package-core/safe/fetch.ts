import { err_nice, ok, type ResultNice } from "#result";

//Exported for index.ts only, the module gives it as safe.fetch.errors so kinds stay namespaced
/**The kinds of the NiceErrors of the fetch functions, their descriptions are the nice texts*/
export const fetch_errors = Object.freeze({
  /**fetch rejected, like a network that is down, the server not answering or a request the browser blocks*/
  CONNECTION_FAILED: Symbol("Connection failed"),
  /**fetch rejected with a TimeoutError, from a signal like AbortSignal.timeout*/
  TIMED_OUT: Symbol("Request timed out"),
  /**fetch rejected with an AbortError, the request was aborted through its signal*/
  ABORTED: Symbol("Request aborted"),
  /**The status of the response is not ok, the cause is a FetchStatusError with the status and body*/
  REJECTED: Symbol("Request rejected by server"),
  /**The body of the response failed to load, like a connection that drops while it loads*/
  CONNECTION_LOST: Symbol("Connection lost"),
});

/**A response whose status is not ok, with the body text, which often explains why*/
export class FetchStatusError extends Error {
  constructor(
    readonly status: number,
    /**Empty when the body failed to load*/
    readonly body: string,
  ) {
    super(`HTTP ${status}`);
    this.name = "FetchStatusError";
  }
}

/**A rejection of fetch as a NiceError, its kind from the name of the error.
 * A rejection is any value, one that is not an Error becomes the message, no Error is made for it*/
function rejected(cause: unknown, kind: symbol) {
  if (!(cause instanceof Error)) return err_nice(kind, String(cause));
  if (cause.name === "TimeoutError") return err_nice(fetch_errors.TIMED_OUT, cause);
  if (cause.name === "AbortError") return err_nice(fetch_errors.ABORTED, cause);
  return err_nice(kind, cause);
}

/**The global fetch with only the fetch caught, a status that is not ok is an error.
 * Not exported, the body of the response can still fail to load, so it is not safe on its own*/
async function fetch_ok(
  url: string,
  init: RequestInit | undefined,
): Promise<ResultNice<Response>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    return rejected(cause, fetch_errors.CONNECTION_FAILED);
  }
  if (response.ok) return ok(response);
  let body = "";
  try {
    body = await response.text();
  } catch {
    //The status is the failure, a body that fails to load only loses the explanation
  }
  return err_nice(fetch_errors.REJECTED, new FetchStatusError(response.status, body));
}

/**A response whose body is read or cancelled already, for its status, headers and url.
 * The body and the methods reading it are left out, reading it again would throw*/
export type FetchResponse = Omit<
  Response,
  "body" | "bodyUsed" | "text" | "json" | "blob" | "arrayBuffer" | "formData" | "bytes" | "clone"
>;

/**The global fetch, gives the body text and the response, for its status and headers, as [text, response].
 * Only the fetch and the body read are caught, so the failures of the request are errors and nothing else is.
 * The error is a NiceError of kind from safe.fetch.errors, with the original error as cause*/
export async function fetch_text_safe(
  url: string,
  init?: RequestInit,
): Promise<ResultNice<[string, FetchResponse]>> {
  const response = await fetch_ok(url, init);
  if (response.err) return response;
  try {
    return ok([await response.value.text(), response.value]);
  } catch (cause) {
    return rejected(cause, fetch_errors.CONNECTION_LOST);
  }
}

/**The global fetch, gives the response, for requests whose answer is not needed, like a post or patch, its status is response.status.
 * The body is not read, it is cancelled so it does not hold the connection.
 * Only the fetch is caught, so the failures of the request are errors and nothing else is.
 * The error is a NiceError of kind from safe.fetch.errors, with the original error as cause*/
export async function fetch_status_safe(
  url: string,
  init?: RequestInit,
): Promise<ResultNice<FetchResponse>> {
  const response = await fetch_ok(url, init);
  if (response.err) return response;
  //Releasing the connection is cleanup, a failure there changes nothing for the caller
  response.value.body?.cancel().catch(() => {});
  return ok(response.value);
}
