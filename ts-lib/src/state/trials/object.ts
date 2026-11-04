import { ok } from "#result";
import state from "..";

const state_inst = state.rosw(
  state.o.help(ok<Record<string, number>>({ a: 5 })),
);

state_inst.sub((v) => {
  console.warn(v.value);
}, true);
state_inst.write(state.o.write.add({ c: 10 }));
state_inst.object.add("4", 10);
