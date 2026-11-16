import { err, ok, type Result } from "#result";

/**A response whose status is not ok*/
export class FetchStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = "FetchStatusError";
  }
}

/**A rejection is any value, an Error is always given*/
const as_error = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

/**The global fetch, gives the body text of the response.
 * Only the fetch and the body read are caught, so the failures of the request are errors and nothing else is:
 * - The rejection of fetch, unchanged, like a TypeError for a network failure or a DOMException named AbortError or TimeoutError.
 * - A FetchStatusError for a status that is not ok.
 * - The rejection of reading the body, like a connection that drops while it loads.*/
export async function fetch_text_safe(
  url: string,
  init?: RequestInit,
): Promise<Result<string, Error>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    return err(as_error(cause));
  }
  if (!response.ok) return err(new FetchStatusError(response.status));
  try {
    return ok(await response.text());
  } catch (cause) {
    return err(as_error(cause));
  }
}
