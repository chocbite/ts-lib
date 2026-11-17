import { err, ok, type Result } from "#result";

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

/**A rejection is any value, an Error is always given*/
const as_error = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

/**The global fetch with only the fetch caught, a status that is not ok becomes a FetchStatusError.
 * Not exported, the body of the response can still fail to load, so it is not safe on its own*/
async function fetch_ok(
  url: string,
  init: RequestInit | undefined,
): Promise<Result<Response, Error>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    return err(as_error(cause));
  }
  if (response.ok) return ok(response);
  let body = "";
  try {
    body = await response.text();
  } catch {
    //The status is the failure, a body that fails to load only loses the explanation
  }
  return err(new FetchStatusError(response.status, body));
}

/**The global fetch, gives the body text of the response.
 * Only the fetch and the body read are caught, so the failures of the request are errors and nothing else is:
 * - The rejection of fetch, unchanged, like a TypeError for a network failure or a DOMException named AbortError or TimeoutError.
 * - A FetchStatusError for a status that is not ok.
 * - The rejection of reading the body, like a connection that drops while it loads.*/
export async function fetch_text_safe(
  url: string,
  init?: RequestInit,
): Promise<Result<string, Error>> {
  const response = await fetch_ok(url, init);
  if (response.err) return response;
  try {
    return ok(await response.value.text());
  } catch (cause) {
    return err(as_error(cause));
  }
}

/**The global fetch, gives the status of the response, for requests whose answer is not needed, like a post or patch.
 * The body is not read, it is cancelled so it does not hold the connection.
 * Only the fetch is caught, so the failures of the request are errors and nothing else is:
 * - The rejection of fetch, unchanged, like a TypeError for a network failure or a DOMException named AbortError or TimeoutError.
 * - A FetchStatusError for a status that is not ok.*/
export async function fetch_status_safe(
  url: string,
  init?: RequestInit,
): Promise<Result<number, Error>> {
  const response = await fetch_ok(url, init);
  if (response.err) return response;
  //Releasing the connection is cleanup, a failure there changes nothing for the caller
  response.value.body?.cancel().catch(() => {});
  return ok(response.value.status);
}
