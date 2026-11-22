import { sleep } from "#common";
import { err_nice, ok } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import { state as st } from "..";

const FAILED = Symbol("Failed");
const failed = () => err_nice(FAILED, "failed");

describe("Number collectors", function () {
  describe("sum", function () {
    it("ros sums ok states and follows them", async function () {
      const a = st.ok_w(1);
      const sum = st.n.c.sum.ros(a, st.ok(2), st.ok(3));
      expectTypeOf(sum.ok()).toEqualTypeOf<number>();
      expect(sum.ok()).toBe(6);
      const seen: number[] = [];
      sum.sub((v) => seen.push(v.value));
      a.set_ok(10);
      await sleep(0);
      expect(seen).toEqual([15]);
    });
    it("res passes the first error on as it is", function () {
      const error = failed();
      const sum = st.n.c.sum.res(st.from(1), st.res<number>(error), st.res<number>(failed()));
      expect(sum.get()).toBe(error);
      expect(st.n.c.sum.res(st.from(1), st.from(2)).get()).toEqual(ok(3));
    });
    it("roa and rea sum async states", async function () {
      expect(await st.n.c.sum.roa(st.roa(() => sleep(1, ok(1))), st.ok(2)).read()).toEqual(ok(3));
      expect(await st.n.c.sum.rea(st.rea(() => sleep(1, ok(4))), st.from(5)).read()).toEqual(ok(9));
    });
  });
  describe("percentage", function () {
    it("ros gives how many percent the second is of the first", function () {
      const total = st.ok_w(200);
      const part = st.ok(50);
      const percent = st.n.c.percentage.ros(total, part);
      expect(percent.ok()).toBe(25);
      total.set_ok(0);
      //A total of 0 is taken as 1
      expect(percent.ok()).toBe(5000);
    });
    it("res passes the first error on as it is", function () {
      const error = failed();
      expect(st.n.c.percentage.res(st.res<number>(error), st.from(1)).get()).toBe(error);
      expect(st.n.c.percentage.res(st.from(4), st.res<number>(error)).get()).toBe(error);
      expect(st.n.c.percentage.res(st.from(4), st.from(1)).get()).toEqual(ok(25));
    });
    it("roa and rea work with async states", async function () {
      expect(await st.n.c.percentage.roa(st.roa(() => sleep(1, ok(10))), st.ok(5)).read()).toEqual(ok(50));
      expect(await st.n.c.percentage.rea(st.from(10), st.rea(() => sleep(1, ok(1)))).read()).toEqual(ok(10));
    });
  });
});

describe("String collectors", function () {
  describe("concat", function () {
    it("ros joins ok states without a separator and follows them", async function () {
      const name = st.ok_w("Ada");
      const text = st.s.c.concat.ros(st.ok("Hello "), name, st.ok("!"));
      expectTypeOf(text.ok()).toEqualTypeOf<string>();
      expect(text.ok()).toBe("Hello Ada!");
      const seen: string[] = [];
      text.sub((v) => seen.push(v.value));
      name.set_ok("Bob");
      await sleep(0);
      expect(seen).toEqual(["Hello Bob!"]);
    });
    it("res passes the first error on as it is", function () {
      const error = failed();
      expect(st.s.c.concat.res(st.from("a"), st.res<string>(error)).get()).toBe(error);
      expect(st.s.c.concat.res(st.from("a"), st.from("b")).get()).toEqual(ok("ab"));
    });
    it("roa and rea join async states", async function () {
      expect(await st.s.c.concat.roa(st.roa(() => sleep(1, ok("a"))), st.ok("b")).read()).toEqual(ok("ab"));
      expect(await st.s.c.concat.rea(st.rea(() => sleep(1, ok("c"))), st.from("d")).read()).toEqual(ok("cd"));
    });
    it("only takes string states", function () {
      const compile_only = () => {
        // @ts-expect-error concat joins strings
        st.s.c.concat.ros(st.ok("a"), st.ok(1));
      };
      expect(compile_only).toBeTypeOf("function");
    });
  });
});
