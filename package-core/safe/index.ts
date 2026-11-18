import { fetch_errors, fetch_status_safe, fetch_text_safe } from "./fetch";

//Named so fetch_errors stays internal, it is reached as safe.fetch.errors
export { fetch_status_safe, fetch_text_safe, FetchStatusError, type FetchResponse } from "./fetch";

export const safe = {
  fetch: {
    text: fetch_text_safe,
    status: fetch_status_safe,
    /**The kinds of the NiceErrors of the fetch functions, like safe.fetch.errors.TIMED_OUT*/
    errors: fetch_errors,
  },
};

export default safe;
