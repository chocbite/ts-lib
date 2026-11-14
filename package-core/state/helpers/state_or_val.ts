import { ok, type Option } from "#result";
import { ros } from "../local";
import type {
  State,
  StateREA,
  StateRelated,
  StateRES,
  StateROA,
  StateROS,
} from "../types";
import { IS } from "./is";

//The value type is only inferred from the state part, with NoInfer on the value part,
//otherwise the value type would swallow any state not matching the overload, so every state would match the first overload
//RT defaults to never, so a plain value fails the state overloads and falls through to the last overload

/**Returns the state, or the fixed value wrapped in a read only sync ok state
 * For elements that need a state internally, like to pass it on to a child or to hand it out,
 * while their users can give a fixed value
 * A wrapped value is read only, as a fixed value never changes*/
export function as_state<
  RT = never,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
>(sov: NoInfer<RT> | StateROS<RT, REL, WT>): StateROS<RT, REL, WT>;
export function as_state<
  RT = never,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
>(sov: NoInfer<RT> | StateRES<RT, REL, WT>): StateRES<RT, REL, WT>;
export function as_state<
  RT = never,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
>(sov: NoInfer<RT> | StateROA<RT, REL, WT>): StateROA<RT, REL, WT>;
export function as_state<
  RT = never,
  REL extends Option<StateRelated> = Option<{}>,
  WT = unknown,
>(sov: NoInfer<RT> | StateREA<RT, REL, WT>): StateREA<RT, REL, WT>;
export function as_state<RT>(sov: RT): StateROS<RT>;
export function as_state(sov: unknown): State<unknown, any, any> {
  return IS.state_of(sov) ? sov : ros(ok(sov));
}
