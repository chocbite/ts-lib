import { fetch_parse_errors } from "./fetch_errors";
import { make_fetch_parser } from "./fetch_parse";
import { make_parser } from "./parse";

export * from "./fetch_parse";
export * from "./parse";

export const parse = {
  make_parser,
  make_fetch_parser,
  fetch: {
    /**The kinds of the NiceErrors make_fetch_parser makes, like parse.fetch.errors.NO_VALUE*/
    errors: fetch_parse_errors,
  },
};

export default parse;
