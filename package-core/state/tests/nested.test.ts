import { sleep } from "#common";
import { err_nice, NiceError, ok, type ResultOk } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  state as st,
  type State,
  type StateREA,
  type StateREAW,
  type StateRES,
  type StateROA,
  type StateROS,
  type StateROSW,
} from "..";

const NO_NICKNAME = Symbol("No nickname");
const BROKEN = Symbol("Broken");
const no_nickname = () => new NiceError(NO_NICKNAME, "has no nickname");

/**A person holding states, the shape nested is made for*/
const person = (name: string, nickname?: string) => ({
  name: st.ok_w(name),
  nickname: nickname === undefined ? undefined : st.ok(nickname),
  label: `#${name}`,
});

describe("nested reads the state in the value of a state", function () {
  it("gives the inner state without subscribers", function () {
    const selected = st.ok_w(person("Ada"));
    const name = selected.nested((p) => p.name);
    expectTypeOf(name.ok()).toEqualTypeOf<string>();
    expect(name.ok()).toBe("Ada");
    selected.get().value.name.set_ok("Ada L");
    expect(name.ok()).toBe("Ada L");
    selected.set_ok(person("Bob"));
    expect(name.get()).toEqual(ok("Bob"));
  });
  it("tells its subscribers when the inner state changes", function () {
    const selected = st.ok_w(person("Ada"));
    const name = selected.nested((p) => p.name);
    const seen: string[] = [];
    name.sub((v) => seen.push(v.value));
    selected.get().value.name.set_ok("Ada L");
    expect(seen).toEqual(["Ada L"]);
  });
  it("moves to the new inner state when the outer state changes, and leaves the old one", function () {
    const ada = person("Ada");
    const bob = person("Bob");
    const selected = st.ok_w(ada);
    const name = selected.nested((p) => p.name);
    const seen: string[] = [];
    name.sub((v) => seen.push(v.value));
    selected.set_ok(bob);
    expect(seen).toEqual(["Bob"]);
    ada.name.set_ok("Ada L");
    expect(seen).toEqual(["Bob"]);
    expect(ada.name.amount()).toBe(0);
    bob.name.set_ok("Bobby");
    expect(seen).toEqual(["Bob", "Bobby"]);
    expect(name.ok()).toBe("Bobby");
  });
  it("does not tell when the new inner state has the same value", function () {
    const selected = st.ok_w(person("Ada"));
    const name = selected.nested((p) => p.name);
    const seen: string[] = [];
    name.sub((v) => seen.push(v.value));
    selected.set_ok(person("Ada"));
    expect(seen).toEqual([]);
  });
  it("lets go of both states when the last subscriber leaves", function () {
    const ada = person("Ada");
    const selected = st.ok_w(ada);
    const name = selected.nested((p) => p.name);
    const sub = name.sub(() => {});
    expect(selected.amount()).toBe(1);
    expect(ada.name.amount()).toBe(1);
    name.unsub(sub);
    expect(selected.amount()).toBe(0);
    expect(ada.name.amount()).toBe(0);
  });
  it("works on State<State<T>>", function () {
    const first = st.ok_w("a");
    const outer = st.ok_w<StateROSW<string>>(first);
    const inner = outer.nested((s) => s);
    expectTypeOf(inner.ok()).toEqualTypeOf<string>();
    const seen: string[] = [];
    inner.sub((v) => seen.push(v.value));
    outer.set_ok(st.ok_w("b"));
    first.set_ok("c");
    expect(seen).toEqual(["b"]);
  });
  it("chains for deeper nesting", function () {
    const city = st.ok_w("Paris");
    const address = st.ok({ city });
    const selected = st.ok({ address });
    const shown = selected.nested((p) => p.address).nested((a) => a.city);
    expectTypeOf(shown.ok()).toEqualTypeOf<string>();
    const seen: string[] = [];
    shown.sub((v) => seen.push(v.value));
    city.set_ok("Rome");
    expect(seen).toEqual(["Rome"]);
  });
});

describe("nested with plain values", function () {
  it("gives a plain value as an ok value", function () {
    const selected = st.ok_w(person("Ada"));
    const label = selected.nested((p) => p.label);
    expectTypeOf(label).toMatchTypeOf<StateROS<string>>();
    expect(label.ok()).toBe("#Ada");
    const seen: string[] = [];
    label.sub((v) => seen.push(v.value));
    selected.set_ok(person("Bob"));
    expect(seen).toEqual(["#Bob"]);
  });
  it("mixes states and plain values", function () {
    const selected = st.ok_w(person("Ada"));
    const nickname = selected.nested((p) => p.nickname ?? "none");
    expectTypeOf(nickname.ok()).toEqualTypeOf<string>();
    expect(nickname.ok()).toBe("none");
    selected.set_ok(person("Bob", "B"));
    expect(nickname.ok()).toBe("B");
  });
});

describe("nested when there is no inner state", function () {
  it("gives the error it was given", function () {
    const error = no_nickname();
    const selected = st.ok_w(person("Ada"));
    const nickname = selected.nested((p) => p.nickname, error);
    expectTypeOf(nickname).toMatchTypeOf<StateRES<string>>();
    expect(nickname.rok).toBe(false);
    const result = nickname.get();
    expect(result.err && result.error).toBe(error);
    selected.set_ok(person("Bob", "B"));
    expect(nickname.get()).toEqual(ok("B"));
  });
  it("needs the error only when the inner state can be missing", function () {
    const selected = st.ok_w(person("Ada"));
    const compile_only = () => {
      // @ts-expect-error nickname can be missing, so an error is needed
      selected.nested((p) => p.nickname);
      // @ts-expect-error name is always there, there is no error to give
      selected.nested((p) => p.name, no_nickname());
    };
    expect(compile_only).toBeTypeOf("function");
  });
});

describe("nested passes errors on", function () {
  it("gives the error of the outer state as it is", function () {
    const error = err_nice(BROKEN, "no person");
    const selected = st.res<ReturnType<typeof person>>(error);
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).toMatchTypeOf<StateRES<string>>();
    expect(name.get()).toBe(error);
  });
  it("gives the error of the inner state as it is", function () {
    const error = err_nice(BROKEN, "no name");
    const selected = st.ok({ name: st.res<string>(error) });
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).toMatchTypeOf<StateRES<string>>();
    expect(name.get()).toBe(error);
  });
});

describe("nested with async states", function () {
  it("reads an async inner state", async function () {
    const selected = st.ok({ name: st.roa(async () => ok("Ada")) });
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).toMatchTypeOf<StateROA<string>>();
    expect(name.rsync).toBe(false);
    expect(await name.read()).toEqual(ok("Ada"));
  });
  it("reads an async outer state", async function () {
    const selected = st.rea(() => sleep(1, ok({ name: st.ok("Ada") })));
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).toMatchTypeOf<StateREA<string>>();
    expect(await name.read()).toEqual(ok("Ada"));
  });
  it("tells the value of an async inner state when subscribed", async function () {
    const selected = st.ok_w({ name: st.roa(() => sleep(1, ok("Ada"))) });
    const name = selected.nested((p) => p.name);
    const seen: string[] = [];
    name.sub((v) => seen.push(v.value), true);
    await sleep(5);
    expect(seen).toEqual(["Ada"]);
    selected.set_ok({ name: st.roa(() => sleep(1, ok("Bob"))) });
    await sleep(5);
    expect(seen).toEqual(["Ada", "Bob"]);
  });
});

describe("nested writes to the inner state", function () {
  it("is writable when the inner state is", async function () {
    const ada = person("Ada");
    const bob = person("Bob");
    const selected = st.ok_w(ada);
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).toMatchTypeOf<StateROSW<string, any, string>>();
    expect(name.writable).toBe(true);
    expect(await name.write("Ada L")).toEqual(ok(undefined));
    expect(ada.name.ok()).toBe("Ada L");
    selected.set_ok(bob);
    await name.write("Bobby");
    expect(bob.name.ok()).toBe("Bobby");
    expect(ada.name.ok()).toBe("Ada L");
  });
  it("is not writable when the value can be plain or missing", async function () {
    const selected = st.ok_w(person("Ada"));
    const label = selected.nested((p) => p.label);
    expect(label.writable).toBe(false);
    const compile_only = () => {
      // @ts-expect-error a plain value can not be written
      void label.write("x");
    };
    expect(compile_only).toBeTypeOf("function");
    const nickname = selected.nested((p) => p.nickname ?? "none");
    expect(nickname.writable).toBe(false);
  });
  it("uses the write gate of the inner state", async function () {
    const gate = st.ok_w(false);
    const ada = person("Ada");
    ada.name.set_write_enabled(gate);
    const name = st.ok(ada).nested((p) => p.name);
    expect(name.write_enabled).toBe(gate);
    expect((await name.write("x")).err).toBe(true);
    gate.set_ok(true);
    expect((await name.write("x")).ok).toBe(true);
  });
});

describe("nested reads are current", function () {
  it("in a subscriber of the outer state added before the nested state subscribed", function () {
    const selected = st.ok_w(person("Ada"));
    const made: { name?: StateROS<string> } = {};
    const seen: string[] = [];
    selected.sub(() => seen.push(made.name!.ok()));
    const name = selected.nested((p) => p.name);
    made.name = name;
    name.sub(() => {});
    selected.set_ok(person("Bob"));
    expect(seen).toEqual(["Bob"]);
  });
  it("when the inner state is a collected state between its change and its microtask", function () {
    const a = st.ok_w(1);
    const sum = st.c.ros(([x]) => ok(x.value * 10), a);
    const selected = st.ok({ sum });
    const shown = selected.nested((p) => p.sum);
    shown.sub(() => {});
    a.set_ok(2);
    expect(shown.ok()).toBe(20);
  });
});

describe("nested on any state", function () {
  it("can be called on the union types", async function () {
    const selected: StateREA<{ name: State<string> }> = st.ok({
      name: st.ok("Ada"),
    });
    const name = selected.nested((p) => p.name);
    expectTypeOf(name).toMatchTypeOf<StateREA<string>>();
    expect(await name.read()).toEqual(ok("Ada"));
    const writable: StateREAW<{ name: StateROSW<string> }> = st.ok_w({
      name: st.ok_w("Ada"),
    });
    expect(await writable.nested((p) => p.name).read()).toEqual(ok("Ada"));
  });
  it("is on read only views, proxies and collected states", function () {
    const selected = st.ok_w(person("Ada"));
    expect(selected.read_only.nested((p) => p.name).ok()).toBe("Ada");
    expect(
      selected
        .proxy_map((p) => p)
        .nested((p) => p.name)
        .ok(),
    ).toBe("Ada");
    expect(
      st.c
        .ros(([p]) => p, selected)
        .nested((p) => p.name)
        .ok(),
    ).toBe("Ada");
  });
  it("gives its subscribers the result type of its kind", function () {
    const name = st.ok_w(person("Ada")).nested((p) => p.name);
    name.sub((v) => expectTypeOf(v).toEqualTypeOf<ResultOk<string>>());
  });
});

describe("nested between a change of a collected outer state and its microtask", function () {
  const pick = () => {
    const ada = person("Ada");
    const bob = person("Bob");
    const which = st.ok_w(0);
    const selected = st.c.ros(([i]) => ok(i.value === 0 ? ada : bob), which);
    const name = selected.nested((p) => p.name);
    name.sub(() => {});
    return { ada, bob, which, name };
  };
  it("writes to the new inner state", async function () {
    const { ada, bob, which, name } = pick();
    which.set_ok(1);
    expect(await name.write("Bobby")).toEqual(ok(undefined));
    expect(bob.name.ok()).toBe("Bobby");
    expect(ada.name.ok()).toBe("Ada");
  });
  it("gives the write gate of the new inner state", function () {
    const { bob, which, name } = pick();
    const gate = st.ok(true);
    bob.name.set_write_enabled(gate);
    which.set_ok(1);
    expect(name.write_enabled).toBe(gate);
  });
});
