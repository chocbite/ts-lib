import { sleep } from "#common";
import { ok } from "#result";
import { describe, expect, it } from "vitest";
import { state as st } from "..";

describe("viewer", { timeout: 100 }, function () {
  describe("basic", function () {
    it("calls callback when a single state changes", async function () {
      const s = st.ok_w(1);
      let count = 0;
      const v = st.v.viewer(s, () => count++);
      s.set_ok(2);
      expect(count).toBe(1);
      s.set_ok(3);
      expect(count).toBe(2);
      v.unsub();
    });

    it("does not call callback on initial setup", async function () {
      const s = st.ok(1);
      let count = 0;
      const v = st.v.viewer(s, () => count++);
      expect(count).toBe(0);
      v.unsub();
    });

    it("no callback after unsub", async function () {
      const s = st.ok_w(1);
      let count = 0;
      const v = st.v.viewer(s, () => count++);
      v.unsub();
      s.set_ok(2);
      expect(count).toBe(0);
    });

    it("handles error state values", async function () {
      const s = st.from_w(1);
      let count = 0;
      const v = st.v.viewer(s, () => count++);
      s.set_err("bad");
      expect(count).toBe(1);
      v.unsub();
    });

    it("handles primitive values without crashing", async function () {
      const s = st.ok_w(42);
      let count = 0;
      const v = st.v.viewer(s, () => count++);
      s.set_ok(100);
      expect(count).toBe(1);
      v.unsub();
    });
  });

  describe("State<State> - single nested state", function () {
    it("calls callback when inner state changes", async function () {
      const inner = st.ok_w(1);
      const outer = st.ok<any>(inner.state);
      let count = 0;
      const v = st.v.viewer(outer, () => count++);
      inner.set_ok(2);
      expect(count).toBe(1);
      v.unsub();
    });

    it("follows when outer swaps to a different inner state", async function () {
      const inner1 = st.ok_w(1);
      const inner2 = st.ok_w(2);
      const outer = st.ok_w<any>(inner1.state);
      let count = 0;
      const v = st.v.viewer(outer, () => count++);

      // Swap to inner2
      outer.set_ok(inner2.state);
      expect(count).toBe(1);

      // inner2 should trigger
      inner2.set_ok(20);
      expect(count).toBe(2);

      // inner1 should no longer trigger
      inner1.set_ok(10);
      expect(count).toBe(2);
      v.unsub();
    });

    it("handles multiple swaps", async function () {
      const a = st.ok_w("a");
      const b = st.ok_w("b");
      const c = st.ok_w("c");
      const outer = st.ok_w<any>(a.state);
      let count = 0;
      const v = st.v.viewer(outer, () => count++);

      outer.set_ok(b.state);
      expect(count).toBe(1);
      outer.set_ok(c.state);
      expect(count).toBe(2);

      c.set_ok("c2");
      expect(count).toBe(3);

      a.set_ok("a2");
      b.set_ok("b2");
      expect(count).toBe(3);
      v.unsub();
    });

    it("State<State<State<T>>> three levels deep", async function () {
      const leaf = st.ok_w(1);
      const mid = st.ok_w<any>(leaf.state);
      const root = st.ok_w<any>(mid.state);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      leaf.set_ok(2);
      expect(count).toBe(1);

      // Swap mid's child
      const leaf2 = st.ok_w(99);
      mid.set_ok(leaf2.state);
      expect(count).toBe(2);

      leaf2.set_ok(100);
      expect(count).toBe(3);

      // Old leaf should not trigger
      leaf.set_ok(3);
      expect(count).toBe(3);
      v.unsub();
    });
  });

  describe("State<State[]> - array of states", function () {
    it("observes all initial array elements", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok<any[]>([a.state, b.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      a.set_ok(10);
      expect(count).toBe(1);
      b.set_ok(20);
      expect(count).toBe(2);
      v.unsub();
    });

    it("observes states added via push", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any[]>([a.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const b = st.ok_w(2);
      root.array.push(b.state);
      expect(count).toBe(1); // root changed

      b.set_ok(20);
      expect(count).toBe(2); // b triggers
      v.unsub();
    });

    it("stops observing states removed via splice", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const c = st.ok_w(3);
      const root = st.ok_w<any[]>([a.state, b.state, c.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      root.array.splice(1, 1); // remove b
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(1); // b should not trigger

      a.set_ok(10);
      expect(count).toBe(2); // a still works
      c.set_ok(30);
      expect(count).toBe(3); // c still works
      v.unsub();
    });

    it("handles array change operation", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<any[]>([a.state, b.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const c = st.ok_w(3);
      root.array.change(1, c.state);
      expect(count).toBe(1);

      c.set_ok(30);
      expect(count).toBe(2);

      // b should no longer trigger
      b.set_ok(20);
      expect(count).toBe(2);
      v.unsub();
    });

    it("handles array move without resubscribing", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const c = st.ok_w(3);
      const root = st.ok_w<any[]>([a.state, b.state, c.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      root.array.move(0, 2);
      expect(count).toBe(1); // root changed

      // All still functional after move
      a.set_ok(10);
      expect(count).toBe(2);
      b.set_ok(20);
      expect(count).toBe(3);
      c.set_ok(30);
      expect(count).toBe(4);
      v.unsub();
    });

    it("handles complete array replacement via set_ok", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const c = st.ok_w(3);
      const root = st.ok_w<any[]>([a.state, b.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      root.set_ok([c.state]);
      expect(count).toBe(1);

      c.set_ok(30);
      expect(count).toBe(2);

      a.set_ok(10);
      b.set_ok(20);
      expect(count).toBe(2); // old states should not trigger
      v.unsub();
    });

    it("skips non-state array elements", async function () {
      const a = st.ok_w(1);
      const root = st.ok<any[]>([42, a.state, "hello"]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      a.set_ok(10);
      expect(count).toBe(1);
      v.unsub();
    });
  });

  describe("State<{key:State}> - object of states", function () {
    it("observes all initial object values", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok<Record<string, any>>({ a: a.state, b: b.state });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      a.set_ok(10);
      expect(count).toBe(1);
      b.set_ok(20);
      expect(count).toBe(2);
      v.unsub();
    });

    it("observes states added via object.add", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<Record<string, any>>({ a: a.state });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const b = st.ok_w(2);
      root.object.add("b", b.state);
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);
      v.unsub();
    });

    it("stops observing states removed via object.remove", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<Record<string, any>>({ a: a.state, b: b.state });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      root.object.remove("b");
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(1); // b should not trigger

      a.set_ok(10);
      expect(count).toBe(2); // a still works
      v.unsub();
    });

    it("handles object.change", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<Record<string, any>>({ x: a.state });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      root.object.change("x", b.state);
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);

      a.set_ok(10);
      expect(count).toBe(2); // old state should not trigger
      v.unsub();
    });

    it("handles complete object replacement via set_ok", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<Record<string, any>>({ a: a.state });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      root.set_ok({ b: b.state });
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);

      a.set_ok(10);
      expect(count).toBe(2); // old state should not trigger
      v.unsub();
    });

    it("skips non-state object values", async function () {
      const a = st.ok_w(1);
      const root = st.ok<Record<string, any>>({ x: 42, y: a.state, z: "hi" });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      a.set_ok(10);
      expect(count).toBe(1);
      v.unsub();
    });
  });

  describe("complex nesting", function () {
    it("State<{key: State<State[]>}>", async function () {
      const item_a = st.ok_w(10);
      const item_b = st.ok_w(20);
      const list = st.ok_w<any[]>([item_a.state, item_b.state]);
      const root = st.ok<any>({ list: list.state });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      item_a.set_ok(11);
      expect(count).toBe(1);

      const item_c = st.ok_w(30);
      list.array.push(item_c.state);
      expect(count).toBe(2);

      item_c.set_ok(31);
      expect(count).toBe(3);
      v.unsub();
    });
  });

  describe("type transitions", function () {
    it("primitive → State<State>", async function () {
      const root = st.ok_w<any>(42);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const inner = st.ok_w(1);
      root.set_ok(inner.state);
      expect(count).toBe(1);

      inner.set_ok(2);
      expect(count).toBe(2);
      v.unsub();
    });

    it("State<State> → primitive", async function () {
      const inner = st.ok_w(1);
      const root = st.ok_w<any>(inner.state);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      root.set_ok(42);
      expect(count).toBe(1);

      inner.set_ok(2);
      expect(count).toBe(1); // inner should not trigger
      v.unsub();
    });

    it("array → State<State>", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>([a.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const b = st.ok_w(2);
      root.set_ok(b.state);
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);

      a.set_ok(10);
      expect(count).toBe(2); // old should not trigger
      v.unsub();
    });

    it("State<State> → array", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>(a.state);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const b = st.ok_w(2);
      root.set_ok([b.state]);
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);

      a.set_ok(10);
      expect(count).toBe(2); // old should not trigger
      v.unsub();
    });

    it("array → object", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>([a.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const b = st.ok_w(2);
      root.set_ok({ x: b.state });
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);

      a.set_ok(10);
      expect(count).toBe(2); // old should not trigger
      v.unsub();
    });

    it("object → array", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>({ x: a.state });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const b = st.ok_w(2);
      root.set_ok([b.state]);
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);

      a.set_ok(10);
      expect(count).toBe(2); // old should not trigger
      v.unsub();
    });

    it("State<State> → object", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>(a.state);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const b = st.ok_w(2);
      root.set_ok({ x: b.state });
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);

      a.set_ok(10);
      expect(count).toBe(2); // old should not trigger
      v.unsub();
    });

    it("object → State<State>", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>({ x: a.state });
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      const b = st.ok_w(2);
      root.set_ok(b.state);
      expect(count).toBe(1);

      b.set_ok(20);
      expect(count).toBe(2);

      a.set_ok(10);
      expect(count).toBe(2); // old should not trigger
      v.unsub();
    });

    it("value → error → value", async function () {
      const inner = st.ok_w(1);
      const root = st.from_w<any>(inner.state);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      root.set_err("oops");
      expect(count).toBe(1);

      inner.set_ok(2);
      expect(count).toBe(1); // inner unsubbed due to error

      const inner2 = st.ok_w(3);
      root.set_ok(inner2.state);
      expect(count).toBe(2);

      inner2.set_ok(30);
      expect(count).toBe(3);
      v.unsub();
    });
  });

  describe("subscriber leak prevention", function () {
    it("unsub removes subscription from root state", async function () {
      const root = st.ok_w(1);
      expect(root.amount()).toBe(0);

      const v = st.v.viewer(root, () => {});
      expect(root.amount()).toBe(1);

      v.unsub();
      expect(root.amount()).toBe(0);
    });

    it("unsub removes subscriptions from all nested states", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok<Record<string, any>>({ a: a.state, b: b.state });

      const v = st.v.viewer(root, () => {});
      expect(root.amount()).toBe(1);
      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(1);

      v.unsub();
      expect(root.amount()).toBe(0);
      expect(a.amount()).toBe(0);
      expect(b.amount()).toBe(0);
    });

    it("unsub cleans deeply nested tree", async function () {
      const leaf = st.ok_w(1);
      const mid = st.ok<any>(leaf.state);
      const root = st.ok<any>(mid.state);

      const v = st.v.viewer(root, () => {});
      expect(root.amount()).toBe(1);
      expect(mid.amount()).toBe(1);
      expect(leaf.amount()).toBe(1);

      v.unsub();
      expect(root.amount()).toBe(0);
      expect(mid.amount()).toBe(0);
      expect(leaf.amount()).toBe(0);
    });

    it("unsub cleans array children", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok<any[]>([a.state, b.state]);

      const v = st.v.viewer(root, () => {});
      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(1);

      v.unsub();
      expect(root.amount()).toBe(0);
      expect(a.amount()).toBe(0);
      expect(b.amount()).toBe(0);
    });

    it("unsub cleans object children", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok<Record<string, any>>({ a: a.state, b: b.state });

      const v = st.v.viewer(root, () => {});
      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(1);

      v.unsub();
      expect(a.amount()).toBe(0);
      expect(b.amount()).toBe(0);
    });

    it("State<State> swap unsubs old inner", async function () {
      const inner1 = st.ok_w(1);
      const inner2 = st.ok_w(2);
      const outer = st.ok_w<any>(inner1.state);

      const v = st.v.viewer(outer, () => {});
      expect(inner1.amount()).toBe(1);
      expect(inner2.amount()).toBe(0);

      outer.set_ok(inner2.state);
      expect(inner1.amount()).toBe(0);
      expect(inner2.amount()).toBe(1);

      v.unsub();
      expect(inner2.amount()).toBe(0);
      expect(outer.amount()).toBe(0);
    });

    it("array push does not resub existing states", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<any[]>([a.state, b.state]);

      const v = st.v.viewer(root, () => {});
      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(1);

      const c = st.ok_w(3);
      root.array.push(c.state);
      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(1);
      expect(c.amount()).toBe(1);

      v.unsub();
    });

    it("array splice removal unsubs removed states", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const c = st.ok_w(3);
      const root = st.ok_w<any[]>([a.state, b.state, c.state]);

      const v = st.v.viewer(root, () => {});
      root.array.splice(0, 2); // remove a and b

      expect(a.amount()).toBe(0);
      expect(b.amount()).toBe(0);
      expect(c.amount()).toBe(1);

      v.unsub();
    });

    it("array move does not leak subscribers", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const c = st.ok_w(3);
      const root = st.ok_w<any[]>([a.state, b.state, c.state]);

      const v = st.v.viewer(root, () => {});
      root.array.move(0, 2);

      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(1);
      expect(c.amount()).toBe(1);

      v.unsub();
      expect(a.amount()).toBe(0);
      expect(b.amount()).toBe(0);
      expect(c.amount()).toBe(0);
    });

    it("array change unsubs old state at changed index", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<any[]>([a.state, b.state]);

      const v = st.v.viewer(root, () => {});
      const c = st.ok_w(3);
      root.array.change(1, c.state);

      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(0); // old at index 1 should be unsubbed
      expect(c.amount()).toBe(1);

      v.unsub();
    });

    it("array full replacement unsubs all old states", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<any[]>([a.state, b.state]);

      const v = st.v.viewer(root, () => {});
      const c = st.ok_w(3);
      root.set_ok([c.state]);

      expect(a.amount()).toBe(0);
      expect(b.amount()).toBe(0);
      expect(c.amount()).toBe(1);

      v.unsub();
    });

    it("object add does not resub existing states", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<Record<string, any>>({ a: a.state });

      const v = st.v.viewer(root, () => {});
      expect(a.amount()).toBe(1);

      const b = st.ok_w(2);
      root.object.add("b", b.state);
      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(1);

      v.unsub();
    });

    it("object remove unsubs removed states", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<Record<string, any>>({ a: a.state, b: b.state });

      const v = st.v.viewer(root, () => {});
      root.object.remove("b");
      expect(a.amount()).toBe(1);
      expect(b.amount()).toBe(0);

      v.unsub();
    });

    it("object change unsubs old state at key", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<Record<string, any>>({ x: a.state });

      const v = st.v.viewer(root, () => {});
      root.object.change("x", b.state);
      expect(a.amount()).toBe(0);
      expect(b.amount()).toBe(1);

      v.unsub();
    });

    it("object full replacement unsubs all old states", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const root = st.ok_w<Record<string, any>>({ a: a.state });

      const v = st.v.viewer(root, () => {});
      root.set_ok({ b: b.state });

      expect(a.amount()).toBe(0);
      expect(b.amount()).toBe(1);

      v.unsub();
    });

    it("deeply nested removal cleans all levels", async function () {
      const leaf = st.ok_w(1);
      const mid = st.ok_w<any>(leaf.state);
      const root = st.ok_w<any>(mid.state);

      const v = st.v.viewer(root, () => {});
      expect(root.amount()).toBe(1);
      expect(mid.amount()).toBe(1);
      expect(leaf.amount()).toBe(1);

      root.set_ok(42);
      expect(mid.amount()).toBe(0);
      expect(leaf.amount()).toBe(0);
      expect(root.amount()).toBe(1);

      v.unsub();
      expect(root.amount()).toBe(0);
    });

    it("array→object transition unsubs old array children", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>([a.state]);

      const v = st.v.viewer(root, () => {});
      expect(a.amount()).toBe(1);

      const b = st.ok_w(2);
      root.set_ok({ x: b.state });

      expect(a.amount()).toBe(0); // old array child should be unsubbed
      expect(b.amount()).toBe(1);

      v.unsub();
    });

    it("object→array transition unsubs old object children", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>({ x: a.state });

      const v = st.v.viewer(root, () => {});
      expect(a.amount()).toBe(1);

      const b = st.ok_w(2);
      root.set_ok([b.state]);

      expect(a.amount()).toBe(0); // old object child should be unsubbed
      expect(b.amount()).toBe(1);

      v.unsub();
    });

    it("State<State>→object transition unsubs old child", async function () {
      const a = st.ok_w(1);
      const root = st.ok_w<any>(a.state);

      const v = st.v.viewer(root, () => {});
      expect(a.amount()).toBe(1);

      const b = st.ok_w(2);
      root.set_ok({ x: b.state });

      expect(a.amount()).toBe(0); // old single child should be unsubbed
      expect(b.amount()).toBe(1);

      v.unsub();
    });
  });

  describe("OVERRIDE_KEY", function () {
    it("uses override to discover sub-states", async function () {
      const inner = st.ok_w(1);
      const val = {
        data: 42,
        [st.v.OVERRIDE_KEY]: () => inner.state,
      };
      const root = st.ok<any>(val);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      inner.set_ok(2);
      expect(count).toBe(1);
      v.unsub();
    });

    it("override returning array of states", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const val = {
        [st.v.OVERRIDE_KEY]: () => [a.state, b.state],
      };
      const root = st.ok<any>(val);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      a.set_ok(10);
      expect(count).toBe(1);
      b.set_ok(20);
      expect(count).toBe(2);
      v.unsub();
    });

    it("override returning object of states", async function () {
      const a = st.ok_w(1);
      const b = st.ok_w(2);
      const val = {
        [st.v.OVERRIDE_KEY]: () => ({ a: a.state, b: b.state }),
      };
      const root = st.ok<any>(val);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      a.set_ok(10);
      expect(count).toBe(1);
      b.set_ok(20);
      expect(count).toBe(2);
      v.unsub();
    });
  });

  describe("async states", function () {
    it("subscribes to async state after it resolves", async function () {
      const root = st.roa<number>(() => sleep(1, ok(1)));
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      // Not resolved yet, no subscription
      expect(root.amount()).toBe(0);

      await sleep(5);
      expect(root.amount()).toBe(1);

      root.set_ok(2);
      expect(count).toBe(1);
      v.unsub();
    });

    it("subscribes to nested states inside async root after resolution", async function () {
      const inner = st.ok_w(1);
      const root = st.roa<any>(() => sleep(1, ok(inner.state)));
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      // inner not yet observed
      expect(inner.amount()).toBe(0);

      await sleep(5);
      expect(inner.amount()).toBe(1);

      inner.set_ok(10);
      expect(count).toBe(1);
      v.unsub();
    });

    it("unsub before resolution does not leak", async function () {
      const root = st.roa<number>(() => sleep(5, ok(1)));
      let count = 0;
      const v = st.v.viewer(root, () => count++);
      v.unsub();

      await sleep(10);
      expect(root.amount()).toBe(0);
      expect(count).toBe(0);
    });

    it("async inner state within sync root", async function () {
      const inner = st.roa<number>(() => sleep(1, ok(42)));
      const root = st.ok<any>(inner.state);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      // root is sync so viewer is set up, but inner hasn't resolved
      expect(root.amount()).toBe(1);
      expect(inner.amount()).toBe(0);

      await sleep(5);
      // inner should now be subscribed
      expect(inner.amount()).toBe(1);

      inner.set_ok(100);
      expect(count).toBe(1);
      v.unsub();
      expect(inner.amount()).toBe(0);
    });

    it("async state swapped before resolution does not leak", async function () {
      const slow = st.roa<number>(() => sleep(50, ok(1)));
      const fast = st.ok_w(2);
      const root = st.ok_w<any>(slow.state);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      // Swap to fast before slow resolves
      root.set_ok(fast.state);
      expect(count).toBe(1);

      fast.set_ok(20);
      expect(count).toBe(2);

      // After slow resolves, it should not be subscribed
      await sleep(55);
      expect(slow.amount()).toBe(0);
      v.unsub();
    });

    it("async array elements resolve and become observable", async function () {
      const a = st.roa<number>(() => sleep(1, ok(10)));
      const b = st.ok_w(20);
      const root = st.ok<any[]>([a.state, b.state]);
      let count = 0;
      const v = st.v.viewer(root, () => count++);

      // b is sync, immediately observable
      b.set_ok(21);
      expect(count).toBe(1);

      // a resolves async
      await sleep(5);
      expect(a.amount()).toBe(1);

      a.set_ok(11);
      expect(count).toBe(2);
      v.unsub();
    });

    it("cleans up async children on unsub", async function () {
      const inner = st.roa<number>(() => sleep(1, ok(1)));
      const root = st.ok<any>(inner.state);
      const v = st.v.viewer(root, () => {});

      await sleep(5);
      expect(inner.amount()).toBe(1);

      v.unsub();
      expect(inner.amount()).toBe(0);
      expect(root.amount()).toBe(0);
    });
  });
});
