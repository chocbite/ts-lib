import { ok, ResultOk } from "#result";
import state, { StateLocalROS, StateLocalROSW, StateROS, StateROSW } from "..";

//Setting variable
const varrosw: StateLocalROSW<string> = state.rosw(ok("Hello world!"));
const varrosw2: StateROSW<string> = state.rosw(ok("Hello world!"));
const varros_ros: StateLocalROS<string> = state.rosw(ok("Hello world!"));
const varros2_ros: StateROS<string> = state.rosw(ok("Hello world!"));

function generic<T>(value: StateROS<T>): ResultOk<T> {
  return value.get();
}
console.debug(varrosw, varrosw2, varros_ros, varros2_ros, generic);
