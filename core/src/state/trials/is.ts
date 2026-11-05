import state from "..";
import { State } from "../types";

async function is_test(s?: { a: string | State<string> }) {
  if (s && state.is.state(s.a)) {
    console.debug("State value:", await s.a);
  } else {
    console.debug("String value:", s?.a);
  }
}

console.warn(is_test);
