import { describe, expect, it } from "vitest";
import { state as st } from "..";

//While a state tells its subscribers of an array or object change, the change list is on the value,
//a subscriber added in that time is given the whole value, and is not told the change again

describe("A subscriber added while subscribers are told", function () {
  it("gets the whole array once", function () {
    const list = st.ok_w<number[]>([1, 2]);
    const seen: unknown[] = [];
    let added = false;
    list.sub(() => {
      if (added) return;
      added = true;
      list.sub((value) => {
        seen.push(st.a.read(value.value));
      }, true);
    });
    list.array.push(3);
    expect(seen).toEqual([[{ type: "fresh", items: [1, 2, 3] }]]);
  });
  it("gets the whole object once", function () {
    const obj = st.ok_w<Record<string, number>>({ a: 1 });
    const seen: unknown[] = [];
    obj.sub(() => {
      obj.sub((value) => {
        seen.push(st.o.read(value.value));
      }, true);
    });
    obj.object.add("b", 2);
    expect(seen).toEqual([[{ type: "fresh", items: { a: 1, b: 2 } }]]);
  });
  it("is not told the change it was added during, without an initial value", function () {
    const list = st.ok_w<number[]>([1]);
    let calls = 0;
    list.sub(() => {
      if (calls === 0) list.sub(() => calls++);
    });
    list.array.push(2);
    expect(calls).toBe(0);
    list.array.push(3);
    expect(calls).toBe(1);
  });
  it("is not told a plain value change it was added during", function () {
    const value = st.ok_w(1);
    const seen: number[] = [];
    let added = false;
    value.sub(() => {
      if (added) return;
      added = true;
      value.sub((v) => seen.push(v.value), true);
    });
    value.write(2);
    expect(seen).toEqual([2]);
    value.write(3);
    expect(seen).toEqual([2, 3]);
  });
  it("of a proxy gets the whole array once", function () {
    const list = st.ok_w<number[]>([1, 2]);
    const proxy = list.proxy_map((v) => v);
    const seen: unknown[] = [];
    proxy.sub(() => {
      proxy.sub((value) => {
        seen.push(st.a.read(value.value));
      }, true);
    });
    list.array.push(3);
    expect(seen).toEqual([[{ type: "fresh", items: [1, 2, 3] }]]);
  });
  it("leaves the change list for the subscribers still to be told", function () {
    const list = st.ok_w<number[]>([1, 2]);
    const seen: unknown[] = [];
    list.sub(() => list.sub(() => {}, true));
    list.sub((value) => seen.push(st.a.read(value.value)));
    list.array.push(3);
    expect(seen).toEqual([[{ type: "added", index: 2, items: [3] }]]);
  });
});

describe("Subscribers removed while subscribers are told", function () {
  it("are not told when removed before their turn, and the last removed ends the use", function () {
    const list = st.ok_w<number[]>([1]);
    let second = 0;
    const b = () => second++;
    const a = () => {
      list.unsub(a);
      list.unsub(b);
    };
    list.sub(a);
    list.sub(b);
    list.array.push(2);
    expect(second).toBe(0);
    expect(list.amount()).toBe(0);
    expect(list.in_use()).toBeUndefined();
  });
  it("a subscriber removed and added again in its turn is not told twice", function () {
    const list = st.ok_w<number[]>([1]);
    let calls = 0;
    const a = () => {
      //Capped, told again it would be told forever
      if (++calls > 2) return;
      list.unsub(a);
      list.sub(a);
    };
    list.sub(a);
    list.sub(() => {});
    list.array.push(2);
    expect(calls).toBe(1);
  });
});

describe("The change list after the subscribers are told", function () {
  it("is gone from the value", function () {
    const list = st.ok_w<number[]>([1]);
    list.sub(() => {});
    list.array.push(2);
    expect(st.a.read(list.ok())).toEqual([{ type: "fresh", items: [1, 2] }]);
  });
  it("is gone from the value also when a subscriber throws", function () {
    const list = st.ok_w<number[]>([1]);
    const error = console.error;
    console.error = () => {};
    list.sub(() => {
      throw new Error("subscriber");
    });
    list.array.push(2);
    console.error = error;
    expect(st.a.read(list.ok())).toEqual([{ type: "fresh", items: [1, 2] }]);
  });
});
