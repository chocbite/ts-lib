import type { Option } from "#result";
import {
  STATE_KEY,
  type StateRelated,
  type State,
  type StateREA,
  type StateREAW,
  type StateRES,
  type StateRESW,
  type StateROA,
  type StateROAW,
  type StateROS,
  type StateROSW,
} from "../types";

type REL = Option<StateRelated>;
function state_of<RT = never, L extends REL = Option<{}>, WT = unknown>(
  sov: NoInfer<RT> | StateROSW<RT, L, WT>,
): sov is StateROSW<RT, L, WT>;
function state_of<RT = never, L extends REL = Option<{}>, WT = unknown>(
  sov: NoInfer<RT> | StateRESW<RT, L, WT>,
): sov is StateRESW<RT, L, WT>;
function state_of<RT = never, L extends REL = Option<{}>, WT = unknown>(
  sov: NoInfer<RT> | StateROAW<RT, L, WT>,
): sov is StateROAW<RT, L, WT>;
function state_of<RT = never, L extends REL = Option<{}>, WT = unknown>(
  sov: NoInfer<RT> | StateREAW<RT, L, WT>,
): sov is StateREAW<RT, L, WT>;
function state_of<RT = never, L extends REL = Option<{}>, WT = unknown>(
  sov: NoInfer<RT> | StateROS<RT, L, WT>,
): sov is StateROS<RT, L, WT>;
function state_of<RT = never, L extends REL = Option<{}>, WT = unknown>(
  sov: NoInfer<RT> | StateRES<RT, L, WT>,
): sov is StateRES<RT, L, WT>;
function state_of<RT = never, L extends REL = Option<{}>, WT = unknown>(
  sov: NoInfer<RT> | StateROA<RT, L, WT>,
): sov is StateROA<RT, L, WT>;
function state_of<RT = never, L extends REL = Option<{}>, WT = unknown>(
  sov: NoInfer<RT> | StateREA<RT, L, WT>,
): sov is StateREA<RT, L, WT>;
function state_of(sov: unknown): sov is State<unknown, any, any>;
function state_of(sov: unknown): boolean {
  return Boolean(sov && (sov as { [STATE_KEY]: boolean })[STATE_KEY]);
}

export const IS = {
  state(s: any): s is State<any, any> {
    return Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]);
  },
  /**Narrows a StateOrVal to its state, the else branch is the fixed value
   * Unlike state it keeps the exact state type, so a StateOrValROSW narrows to StateROSW, also in generic code
   * The value type is only inferred from the state part, see as_state*/
  state_of,
  rea(s: any): s is StateREA<any> {
    return Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]);
  },
  roa(s: any): s is StateROA<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).rok
    );
  },
  res(s: any): s is StateRES<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).rsync
    );
  },
  ros(s: any): s is StateROS<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).rsync &&
      (s as State<any>).rok
    );
  },
  reaw(s: any): s is StateREAW<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).writable
    );
  },
  roaw(s: any): s is StateROAW<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).writable &&
      (s as State<any>).rok
    );
  },
  resw(s: any): s is StateRESW<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).writable &&
      (s as State<any>).rsync
    );
  },
  rosw(s: any): s is StateROSW<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).writable &&
      (s as State<any>).rsync &&
      (s as State<any>).rok
    );
  },
};
