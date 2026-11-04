import state from "..";
import { State } from "../types";

function pass(value: State<string>): void {
  console.debug("State value:", value);
}

pass(state.ok("test"));
