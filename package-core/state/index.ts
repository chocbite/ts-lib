import { err, ok } from "#result";
import { StateBase } from "./base";
import { COLLECTED } from "./collected";
import {
  ARRAY,
  STATE_ARRAY_READ_KEY,
  STATE_ARRAY_WRITE_KEY,
} from "./helpers/array";
import { BOOL } from "./helpers/boolean";
import { ENUM } from "./helpers/enum";
import { IS } from "./helpers/is";
import { NUMBER } from "./helpers/number";
import {
  OBJECT,
  STATE_OBJECT_READ_KEY,
  STATE_OBJECT_WRITE_KEY,
} from "./helpers/object";
import { as_state } from "./helpers/state_or_val";
import { STRING } from "./helpers/string";
import { UTIL } from "./helpers/util";
import { VIEWER } from "./helpers/viewer";
import { rea, reaw, res, resw, roa, roaw, ros, rosw } from "./local";
import { PROXY } from "./proxy";
import { RESOURCE } from "./remote";
import { StateResult as SR, STATE_KEY } from "./types";

export const state = {
  //Quick access states
  /**Creates an ok state with the given initial value */
  ok<RT>(init: RT) {
    return ros(ok(init));
  },
  /**Creates an error state with the given initial error message */
  err<RT>(init: string) {
    return res(err(init) as SR<RT>);
  },
  /**Creates an errorable state with the given initial value */
  from<RT>(init: RT) {
    return res(ok(init) as SR<RT>);
  },
  /**Creates a writable ok state with the given initial value */
  ok_w<RT>(init: RT) {
    return rosw(ok(init));
  },
  /**Creates a writable error state with the given initial error message */
  err_w<RT>(init: string) {
    return resw(err(init) as SR<RT>);
  },
  /**Creates a writable errorable state with the given initial value */
  from_w<RT>(init: RT) {
    return resw(ok(init) as SR<RT>);
  },
  //Local
  /**Creates a sync ok state from an initial result */
  ros,
  /**Creates a writable sync ok state from an initial result */
  rosw,
  /**Creates a sync errorable state from an initial result */
  res,
  /**Creates a writable sync errorable state from an initial result */
  resw,
  /**Creates an async ok state from an initial result */
  roa,
  /**Creates a writable async ok state from an initial result */
  roaw,
  /**Creates an async errorable state from an initial result */
  rea,
  /**Creates a writable async errorable state from an initial result */
  reaw,
  /**Returns the state, or the fixed value wrapped in a read only sync ok state, see StateOrVal */
  as_state,
  //The "as typeof" casts make the declaration output reference the helper objects instead of inlining
  //their types, inlining would drop the doc comments on their members
  /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
  /**Proxy states, allows for creating states that proxy other states */
  p: PROXY as typeof PROXY,
  /**Proxy states, allows for creating states that proxy other states */
  proxy: PROXY as typeof PROXY,
  /**Collected states, collects values from multiple states and reduces it to one */
  c: COLLECTED as typeof COLLECTED,
  /**Collected states, collects values from multiple states and reduces it to one */
  collected: COLLECTED as typeof COLLECTED,
  /**Remote states, allows for creating states representing remote resources */
  r: RESOURCE as typeof RESOURCE,
  /**Remote states, allows for creating states representing remote resources */
  remote: RESOURCE as typeof RESOURCE,
  /**Helper functionality for arrays */
  a: ARRAY as typeof ARRAY,
  /**Helper functionality for arrays */
  array: ARRAY as typeof ARRAY,
  /**Helper functionality for objects */
  o: OBJECT as typeof OBJECT,
  /**Helper functionality for objects */
  object: OBJECT as typeof OBJECT,
  /**Helper functionality for numbers */
  n: NUMBER as typeof NUMBER,
  /**Helper functionality for numbers */
  number: NUMBER as typeof NUMBER,
  /**Helper functionality for strings */
  s: STRING as typeof STRING,
  /**Helper functionality for strings */
  string: STRING as typeof STRING,
  /**Helper functionality for enums */
  e: ENUM as typeof ENUM,
  /**Helper functionality for enums */
  enum: ENUM as typeof ENUM,
  /**Helper functionality for booleans */
  b: BOOL as typeof BOOL,
  /**Helper functionality for booleans */
  bool: BOOL as typeof BOOL,
  /**Utility functions for states */
  u: UTIL as typeof UTIL,
  /**Utility functions for states */
  util: UTIL as typeof UTIL,
  /**Functions to determine if a variable is a state*/
  is: IS as typeof IS,
  /**Helper functionality to recursively subscribe to any state changes in a tree of states */
  v: VIEWER as typeof VIEWER,
  /**Helper functionality to recursively subscribe to any state changes in a tree of states */
  viewer: VIEWER as typeof VIEWER,
  /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */
  /**The state key is a symbol used to identify state objects
   * To implement a custom state, set this key to true on the object */
  STATE_KEY,
  /**Utility base class for state, with basic state functionality */
  class: StateBase,
};
export default state;

//       _____ _______    _______ ______   _________     _______  ______  _____
//      / ____|__   __|/\|__   __|  ____| |__   __\ \   / /  __ \|  ____|/ ____|
//     | (___    | |  /  \  | |  | |__       | |   \ \_/ /| |__) | |__  | (___
//      \___ \   | | / /\ \ | |  |  __|      | |    \   / |  ___/|  __|  \___ \
//      ____) |  | |/ ____ \| |  | |____     | |     | |  | |    | |____ ____) |
//     |_____/   |_/_/    \_\_|  |______|    |_|     |_|  |_|    |______|_____/
export {
  type StateCollectedREA,
  type StateCollectedRES,
  type StateCollectedROA,
  type StateCollectedROS,
} from "./collected";
export {
  STATE_ARRAY_HELPER_KEY,
  STATE_ARRAY_RELATED_KEY,
  type StateArrayHelper,
  type StateArrayRead,
  type StateArrayReadTypes,
  type StateArrayRelated,
  type StateArrayWrite,
  type StateArrayWriteInstruction,
  type StateArrayWriteTypes,
} from "./helpers/array";
export {
  STATE_BOOL_HELPER_KEY,
  STATE_BOOL_RELATED_KEY,
  type StateBoolHelper,
  type StateBoolRelated,
} from "./helpers/boolean";
export {
  STATE_ENUM_HELPER_KEY,
  STATE_ENUM_RELATED_KEY,
  type StateEnumHelper,
  type StateEnumRelated,
} from "./helpers/enum";
export {
  STATE_NUMBER_HELPER_KEY,
  STATE_NUMBER_RELATED_KEY,
  type StateNumberHelper,
  type StateNumberRelated,
} from "./helpers/number";
export {
  STATE_OBJECT_HELPER_KEY,
  STATE_OBJECT_RELATED_KEY,
  type StateObjectHelper,
  type StateObjectRead,
  type StateObjectReadTypes,
  type StateObjectRelated,
  type StateObjectWrite,
  type StateObjectWriteTypes,
} from "./helpers/object";
export {
  STATE_STRING_HELPER_KEY,
  STATE_STRING_RELATED_KEY,
  type StateStringHelper,
  type StateStringRelated,
} from "./helpers/string";
export { viewer as observe } from "./helpers/viewer";
export {
  type StateLocalREA,
  type StateLocalREAW,
  type StateLocalRES,
  type StateLocalRESW,
  type StateLocalROA,
  type StateLocalROAW,
  type StateLocalROS,
  type StateLocalROSW,
} from "./local";
export {
  type StateProxyREA,
  type StateProxyREAW,
  type StateProxyRES,
  type StateProxyRESW,
  type StateProxyROA,
  type StateProxyROAW,
  type StateProxyROS,
  type StateProxyROSW,
} from "./proxy";
export {
  type StateRemote,
  type StateRemoteFuncREA,
  type StateRemoteFuncREAW,
  type StateRemoteFuncROA,
  type StateRemoteFuncROAW,
} from "./remote";
export type {
  State,
  STATE_KEY,
  StateInferResult,
  StateInferSub,
  StateInferType,
  StateJsonCompatible,
  StateOrVal,
  StateOrValREA,
  StateOrValREAW,
  StateOrValRES,
  StateOrValRESW,
  StateOrValROA,
  StateOrValROAW,
  StateOrValROS,
  StateOrValROSW,
  StateREA,
  StateReadType,
  StateREAW,
  StateRES,
  StateResult,
  StateRESW,
  StateROA,
  StateROAW,
  StateROS,
  StateROSW,
  StateSub,
  StateWriteType,
} from "./types";
export {
  STATE_ARRAY_READ_KEY,
  STATE_ARRAY_WRITE_KEY,
  STATE_OBJECT_READ_KEY,
  STATE_OBJECT_WRITE_KEY,
};
