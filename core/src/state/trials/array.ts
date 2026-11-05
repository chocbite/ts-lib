import { ok } from "#result";
import state, { StateArrayHelper } from "..";

const setter = state.rosw<
  number[],
  boolean[],
  StateArrayHelper<number[], boolean[]>
>(state.a.help(ok([5])), async (val, s, o) => {
  if (state.a.is_write(val)) {
    state.a.read_set(
      state.a.write_apply(
        val,
        o?.value.map((v) => Boolean(v)),
      ),
      (r) => {
        s.set(ok(r.map((v) => Number(v))));
        s.set_ok(r.map((v) => Number(v)));
      },
    );
  } else {
    s.set_ok(val.map((v) => Number(v)));
  }
  return ok(undefined);
});
console.debug(setter);

const test = state.rosw(state.a.help(ok([5])));
test.sub((v) => {
  console.warn(v.value);
}, true);
test.array.push(10);
test.array.change(0, 15);
test.array.change(1, 15);
