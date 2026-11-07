import { err, ok } from "#result";
import { describe, expect, it } from "vitest";
import { state as st } from "..";

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
