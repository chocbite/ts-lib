import { sync_resolve } from "#common";
import { err, none, ok } from "#result";
import { describe, expect, it, vi } from "vitest";
import { state as st, type StateResult } from "..";

//##################################################################################################################################################
//      _   _ _    _ __  __ ____  ______ _____
//     | \ | | |  | |  \/  |  _ \|  ____|  __ \
//     |  \| | |  | | \  / | |_) | |__  | |__) |
//     | . ` | |  | | |\/| |  _ <|  __| |  _  /
//     | |\  | |__| | |  | | |_) | |____| | \ \
//     |_| \_|\____/|_|  |_|____/|______|_|  \_\
describe("State Number Min Max", async () => {
  it("Checking limiter min max", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), { min: st.ok(0), max: st.ok(10) }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect((await state_inst.limit(11)).unwrap()).to.equal(10);
    expect((await state_inst.limit(-11)).unwrap()).to.equal(0);
    expect(await state_inst.write(11)).toEqual(
      err("11 is bigger than the limit of 10"),
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect(await state_inst.write(-11)).toEqual(
      err("-11 is smaller than the limit of 0"),
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect(await state_inst.write(7)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).to.equal(7);
  });
  it("Checking checker min max", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), { min: st.ok(0), max: st.ok(10) }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect(await state_inst.check(11)).toEqual(
      err("11 is bigger than the limit of 10"),
    );
    expect(await state_inst.check(-11)).toEqual(
      err("-11 is smaller than the limit of 0"),
    );
  });
  it("Checking related min max", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), { min: st.ok(0), max: st.ok(10) }),
      true,
    );
    const related = state_inst.related().unwrap();
    expect((await related.min!).unwrap()).to.equal(0);
    expect((await related.max!).unwrap()).to.equal(10);
  });
});
describe("State Number Unit", async () => {
  it("Checking related unit", async () => {
    const state_inst = st.rosw(st.n.help(ok(5), { unit: st.ok("test") }), true);
    const related = state_inst.related().unwrap();
    expect((await related.unit!).unwrap()).to.equal("test");
  });
});
describe("State Number decimals", async () => {
  it("Checking related decimals", async () => {
    const state_inst = st.rosw(st.n.help(ok(5), { decimals: st.ok(2) }), true);
    const related = state_inst.related().unwrap();
    expect((await related.decimals!).unwrap()).to.equal(2);
  });
  it("Checking limiter decimals step", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), { decimals: st.ok(1), step: st.ok(0.13) }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect((await state_inst.limit(11)).unwrap()).to.equal(11.1);
    expect((await state_inst.limit(-11)).unwrap()).to.equal(-11.1);
    expect((await state_inst.write(11)).ok).toBe(false);
    expect((await state_inst).unwrap()).to.equal(5);
    expect(await state_inst.write(11.1)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).to.equal(11.1);
    expect(await state_inst.write(-11.1)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).to.equal(-11.1);
  });
  it("Checking limiter decimals step start", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), {
        decimals: st.ok(3),
        step: st.ok(0.003),
        start: st.ok(0.07),
      }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect((await state_inst.limit(11)).unwrap()).to.equal(10.999);
    expect((await state_inst.limit(-11)).unwrap()).to.equal(-11);
    expect((await state_inst.write(11)).ok).toBe(false);
    expect((await state_inst).unwrap()).to.equal(5);
    expect(await state_inst.write(10.999)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).to.equal(10.999);
    expect(await state_inst.write(-11)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).to.equal(-11);
  });
  it("Checking checker decimals", async () => {
    const state_inst = st.rosw(st.n.help(ok(5), { decimals: st.ok(2) }), true);
    expect(await state_inst.check(5.12)).toEqual(ok(5.12));
    expect(await state_inst.check(5.123)).toEqual(
      err("5.123 has more than 2 decimals"),
    );
  });
});
describe("State Number step start", async () => {
  it("Checking limiter step", async () => {
    const state_inst = st.rosw(st.n.help(ok(5), { step: st.ok(0.13) }), true);
    expect((await state_inst).unwrap()).to.equal(5);
    expect((await state_inst.limit(11)).unwrap()).to.equal(11.05);
    expect((await state_inst.limit(-11)).unwrap()).to.equal(-11.05);
    expect(await state_inst.write(11)).toEqual(
      err("11 is not on a step of 0.13"),
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect(await state_inst.write(11.05)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).to.equal(11.05);
    expect(await state_inst.write(-11.05)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).to.equal(-11.05);
  });
  it("Checking limiter step start", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), { step: st.ok(0.13), start: st.ok(0.02) }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect((await state_inst.limit(11)).unwrap()).to.equal(10.94);
    expect((await state_inst.limit(-11)).unwrap().toFixed(2)).to.equal(
      "-11.03",
    );
    expect(await state_inst.write(11)).toEqual(
      err("11 is not on a step of 0.13 starting from 0.02"),
    );
    expect((await state_inst).unwrap()).to.equal(5);
    expect(await state_inst.write(10.94)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).to.equal(10.94);
  });
  it("Checking checker accepts floating point noise", async () => {
    const state_inst = st.rosw(st.n.help(ok(0), { step: st.ok(0.1) }), true);
    expect((await state_inst.check(0.1 + 0.2)).ok).toBe(true);
    expect(await state_inst.write(0.1 + 0.2)).toEqual(ok(undefined));
    expect((await state_inst).unwrap()).toBeCloseTo(0.3);
  });
  it("Checking checker accepts min and max when they are not on a step", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), { min: st.ok(0.05), max: st.ok(10), step: st.ok(0.13) }),
      true,
    );
    expect(await state_inst.check(10)).toEqual(ok(10));
    expect(await state_inst.check(0.05)).toEqual(ok(0.05));
  });
  it("Checking checker accepts every value limit returns", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), {
        min: st.ok(-3),
        max: st.ok(10),
        step: st.ok(0.13),
        start: st.ok(0.02),
        decimals: st.ok(2),
      }),
      true,
    );
    for (let value = -5; value <= 12; value += 0.37) {
      const limited = (await state_inst.limit(value)).unwrap();
      expect(await state_inst.check(limited)).toEqual(ok(limited));
    }
  });
});
//##################################################################################################################################################
//       _____ _______ _____  _____ _   _  _____
//      / ____|__   __|  __ \|_   _| \ | |/ ____|
//     | (___    | |  | |__) | | | |  \| | |  __
//      \___ \   | |  |  _  /  | | | . ` | | |_ |
//      ____) |  | |  | | \ \ _| |_| |\  | |__| |
//     |_____/   |_|  |_|  \_\_____|_| \_|\_____|
describe("State String Max Len", async () => {
  it("Checking limiter max len", async () => {
    const state_inst = st.rosw(
      st.s.help(ok("5"), { max_length: st.ok(10) }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal("5");
    expect((await state_inst.limit("12345678901")).unwrap()).to.equal(
      "1234567890",
    );
    await state_inst.write("12345678901");
    expect((await state_inst).unwrap()).to.equal("5");
  });
  it("Checking checker max len", async () => {
    const state_inst = st.rosw(
      st.s.help(ok("5"), { max_length: st.ok(10) }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal("5");
    expect(await state_inst.check("123456789012")).toEqual(
      err("the text is longer than the limit of 10 characters"),
    );
  });
  it("Checking related max len", async () => {
    const state_inst = st.rosw(
      st.s.help(ok("5"), { max_length: st.ok(10) }),
      true,
    );
    const related = state_inst.related().unwrap();
    expect((await related.max_length!).unwrap()).to.equal(10);
  });
});

describe("State String Max Byte Len", async () => {
  it("Checking limiter max byte len", async () => {
    const state_inst = st.rosw(
      st.s.help(ok("5"), { max_length_bytes: st.ok(10) }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal("5");
    expect((await state_inst.limit("1æøåæ01")).unwrap()).to.equal("1æøåæ0");
    await state_inst.write("1æøåæ01");
    expect((await state_inst).unwrap()).to.equal("5");
  });
  it("Checking checker max byte len", async () => {
    const state_inst = st.rosw(
      st.s.help(ok("5"), { max_length_bytes: st.ok(10) }),
      true,
    );
    expect((await state_inst).unwrap()).to.equal("5");
    expect(await state_inst.check("1æøåæ01")).toEqual(
      err("the text is longer than the limit of 10 bytes"),
    );
  });
  it("Checking related max byte len", async () => {
    const state_inst = st.rosw(
      st.s.help(ok("5"), { max_length_bytes: st.ok(10) }),
      true,
    );
    const related = state_inst.related().unwrap();
    expect((await related.max_length_bytes!).unwrap()).to.equal(10);
  });
});

describe("Helper writable option", async () => {
  it("Array helper check fails when writable is false", async () => {
    const state_inst = st.rosw(
      st.a.help(ok([1]), { writable: st.ok(false) }),
      true,
    );
    expect(await state_inst.check([2])).toEqual(err("not writable"));
  });
  it("Array helper check passes when writable is true", async () => {
    const state_inst = st.rosw(
      st.a.help(ok([1]), { writable: st.ok(true) }),
      true,
    );
    expect(await state_inst.check([2])).toEqual(ok([2]));
  });
  it("Object helper check fails when writable is false", async () => {
    const state_inst = st.rosw(
      st.o.help(ok({ a: 1 }), { writable: st.ok(false) }),
      true,
    );
    expect(await state_inst.check({ a: 2 })).toEqual(err("not writable"));
  });
  it("Boolean helper check fails when writable is false", async () => {
    const state_inst = st.rosw(
      st.b.help(ok(true), { writable: st.ok(false) }),
      true,
    );
    expect(await state_inst.check(false)).toEqual(err("not writable"));
  });
  it("Number helper check and write fail when writable is false", async () => {
    const state_inst = st.rosw(
      st.n.help(ok(5), { min: st.ok(0), writable: st.ok(false) }),
      true,
    );
    expect(await state_inst.check(6)).toEqual(err("not writable"));
    expect(await state_inst.write(6)).toEqual(err("not writable"));
    expect(state_inst.ok()).toBe(5);
  });
  it("String helper check fails when writable is false", async () => {
    const state_inst = st.rosw(
      st.s.help(ok("a"), { writable: st.ok(false) }),
      true,
    );
    expect(await state_inst.check("b")).toEqual(err("not writable"));
  });
  it("Enum helper check fails when writable is false", async () => {
    const list = st.e.list<"a" | "b">({ a: { name: "A" }, b: { name: "B" } });
    const state_inst = st.rosw(
      st.e.help(ok<"a" | "b">("a"), {
        list: st.ok(list),
        writable: st.ok(false),
      }),
      true,
    );
    expect(await state_inst.check("b")).toEqual(err("not writable"));
  });
  it("Number helper limit rounds with only decimals", async () => {
    const state_inst = st.rosw(st.n.help(ok(5), { decimals: st.ok(2) }), true);
    expect(await state_inst.limit(5.126)).toEqual(ok(5.13));
  });
});

describe("Helper validation on write", async () => {
  const list = st.e.list<"a" | "b">({ a: { name: "A" }, b: { name: "B" } });
  it("Enum write with a value not in the list fails and keeps the value", async () => {
    const state_inst = st.rosw(
      st.e.help(ok<"a" | "b">("a"), { list: st.ok(list) }),
      true,
    );
    const result = await state_inst.write("zzz" as "a");
    expect(result.ok).toBe(false);
    expect(state_inst.ok()).toBe("a");
  });
  it("Enum write with a value in the list works", async () => {
    const state_inst = st.rosw(
      st.e.help(ok<"a" | "b">("a"), { list: st.ok(list) }),
      true,
    );
    expect(await state_inst.write("b")).toEqual(ok(undefined));
    expect(state_inst.ok()).toBe("b");
  });
});

/**Type tests, only type checked, never called
 * Enum keys are strings only, an object gives number keys back as strings*/
function enum_type_tests() {
  // @ts-expect-error Number keys are not allowed
  st.e.list<1 | 2>({ 1: { name: "One" }, 2: { name: "Two" } });
  st.e.list<"1" | "2">({ 1: { name: "One" }, 2: { name: "Two" } });
}
void enum_type_tests;

describe("Util await_value", async () => {
  it("Resolves true when the state already has the value", async () => {
    expect(await st.u.await_value(5, st.ok(5), 100)).toBe(true);
  });
  it("Resolves true when the state changes to the value", async () => {
    const state_inst = st.ok_w(1);
    const result = st.u.await_value(2, state_inst, 100);
    state_inst.set_ok(2);
    expect(await result).toBe(true);
  });
  it("Resolves false when the timeout is reached", async () => {
    expect(await st.u.await_value(2, st.ok(1), 20)).toBe(false);
  });
  it("Clears its timeout when the value arrives", async () => {
    vi.useFakeTimers();
    try {
      const state_inst = st.ok_w(1);
      const result = st.u.await_value(2, state_inst, 1000);
      state_inst.set_ok(2);
      expect(await result).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Custom helper", async () => {
  /**Helper written only to the public StateHelper interface*/
  const make_helper = () => ({
    related: () => none(),
    limit: (value: number) => sync_resolve(ok(value)),
    check: (value: number) =>
      sync_resolve(value < 0 ? err("negative") : ok(value)),
    on_change: vi.fn<(value: StateResult<number>) => void>(),
  });

  it("Works with a local state and gets every new value", async () => {
    const helper = make_helper();
    const state_inst = st.rosw([ok(1), helper], true);
    state_inst.set_ok(2);
    expect(await state_inst.write(3)).toEqual(ok(undefined));
    expect(await state_inst.write(-1)).toEqual(err("negative"));
    expect(state_inst.ok()).toBe(3);
    expect(helper.on_change.mock.calls.map(([value]) => value)).toEqual([
      ok(1),
      ok(2),
      ok(3),
    ]);
  });

  it("Must have on_change", async () => {
    //Only type checked, never called
    const check = () => {
      const { on_change: _, ...without_on_change } = make_helper();
      // @ts-expect-error a helper without on_change is not a helper
      st.rosw([ok(1), without_on_change], true);
    };
    expect(check).toBeTypeOf("function");
  });
});
