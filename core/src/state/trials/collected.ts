import { ok, ResultOk } from "#result";
import state from "..";

const p1 = state.p.ros(state.ok(false));
const p2 = state.p.ros(state.ok(false));
const asdf = state.c.ros(
  (v) => {
    console.warn(v);
    return ok(v[0].value && v[1].value);
  },
  p1,
  p2,
);
asdf.sub(() => {
  console.warn("yo");
}, true);

p1.set_state(state.ok(true));

const ros = state.c.ros(
  (v) => ok(String(v[0].value) + v[1].unwrap_or("default")),
  state.ok(1),
  state.err<string>("1"),
);

const roa = state.c.roa(
  (v) => ok(String(v[0].value) + v[1].unwrap_or("default")),
  state.ok(1),
  state.err<string>("1"),
  state.roa<ResultOk<number>>(undefined),
);

const res = state.c.res(
  (v) => ok(String(v[0].value) + v[1].unwrap_or("default")),
  state.ok(1),
  state.err<string>("1"),
);

const rea = state.c.rea(
  (v) => ok(String(v[0].value) + v[1].unwrap_or("default")),
  state.ok(1),
  state.err<string>("1"),
  state.roa<ResultOk<number>>(undefined),
);

console.debug(ros, res, roa, rea);
