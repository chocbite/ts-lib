//Not exported from the module on its own, it is given as parse.fetch.errors so kinds stay namespaced
/**The kinds of the NiceErrors make_fetch_parser makes, their descriptions are the nice texts.
 * Errors from its fetch function, like the safe.fetch.errors of fetch_text_safe, reach the states unchanged*/
export const fetch_parse_errors = Object.freeze({
  /**The response is not what the schema describes, the message is the one of the parser*/
  INVALID_DATA: Symbol("Invalid data from server"),
  /**No value has been received yet, a write that needs the last value is refused*/
  NO_VALUE: Symbol("Waiting for data"),
  /**A member or item the server left out, that the schema does not mark as optional*/
  MEMBER_MISSING: Symbol("Value missing"),
  /**A write to an item that is no longer in the last received value*/
  ITEM_GONE: Symbol("Item no longer exists"),
  /**A bug in the request, fetch or write function given, it threw or returned something wrong, it is also logged*/
  UNEXPECTED: Symbol("Unexpected error"),
});
