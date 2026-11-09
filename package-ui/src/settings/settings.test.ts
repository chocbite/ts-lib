import { none, some } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { settings_init, type SettingsGroup } from ".";

describe("Settings register types", function () {
  it("Only accepts JSON compatible states without a transform", function () {
    //Only type checked, never called
    const check = (group: SettingsGroup) => {
      group.register("number", "Number", "Description", st.ok_w(5));
      group.register("object", "Object", "Description", st.ok_w({ a: [1] }));
      // @ts-expect-error a Map can not be stored as JSON
      group.register("map", "Map", "Description", st.ok_w(new Map<string, number>()));
      group.register(
        "map",
        "Map",
        "Description",
        st.ok_w(new Map<string, number>()),
        async (state) => JSON.stringify([...(await state).value]),
      );
    };
    expect(check).toBeTypeOf("function");
  });

  it("set only accepts JSON compatible values, like register", function () {
    //Only type checked, never called
    const check = (group: SettingsGroup) => {
      group.set("number", 5);
      // @ts-expect-error a Map can not be stored as JSON, it would be stored as {}
      group.set("map", new Map<string, number>());
    };
    expect(check).toBeTypeOf("function");
  });
});

/**Keys written by the tests, removed after each test*/
const used_keys = new Set<string>();
const key = (path: string) => {
  used_keys.add(path);
  return path;
};
const store = (path: string, value: unknown) =>
  localStorage.setItem(key(path), JSON.stringify(value));
/**Lets async storing by registered settings finish*/
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const k of used_keys) localStorage.removeItem(k);
  used_keys.clear();
});

describe("settings_init", () => {
  it("returns a group with the given name and description", () => {
    const group = settings_init("@test/init", "1.0.0", "Init", "Init group");
    expect(group.name).toBe("Init");
    expect(group.description).toBe("Init group");
  });

  it("has no changed version for a package seen the first time", () => {
    const group = settings_init("@test/first", "1.0.0", "First", "");
    expect(group.version_changed).toBeUndefined();
  });

  it("stores the package version a moment later", async () => {
    settings_init("@test/stored_version", "2.3.4", "Stored", "");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const versions = JSON.parse(
      localStorage.getItem(key("settings/packageVersions")) ?? "{}",
    ) as { [key: string]: string };
    expect(versions["@test/stored_version"]).toBe("2.3.4");
  });

  it("throws for a package name used twice", () => {
    settings_init("@test/twice", "1.0.0", "First", "");
    expect(() => settings_init("@test/twice", "1.0.0", "Second", "")).toThrow(
      "already registered",
    );
  });
});

describe("SettingsGroup get", () => {
  const group = settings_init("@test/get", "1.0.0", "Get", "");

  it("returns the fallback when nothing is stored", () => {
    expect(group.get("missing", 42).value).toBe(42);
  });

  it("returns the stored value", () => {
    store("@test/get/number", 12);
    store("@test/get/object", { a: [1, 2] });
    expect(group.get("number", 0).value).toBe(12);
    expect(group.get("object", { a: [] as number[] }).value).toEqual({
      a: [1, 2],
    });
  });

  it("returns the fallback when the stored value is not JSON", () => {
    localStorage.setItem(key("@test/get/broken"), "{not json");
    expect(group.get("broken", "fallback").value).toBe("fallback");
  });

  it("uses the check to accept or reject the stored value", () => {
    const is_number = (v: unknown) =>
      typeof v === "number" ? some(v) : none();
    store("@test/get/good", 3);
    store("@test/get/bad", "three");
    expect(group.get("good", 1, is_number).value).toBe(3);
    expect(group.get("bad", 1, is_number).value).toBe(1);
  });

  it("does not call the version migration when the version is unchanged", () => {
    store("@test/get/unchanged", 5);
    let called = false;
    const value = group.get("unchanged", 0, undefined, () => {
      called = true;
      return 100;
    });
    expect(called).toBe(false);
    expect(value.value).toBe(5);
  });
});

describe("SettingsGroup set", () => {
  const group = settings_init("@test/set", "1.0.0", "Set", "");

  it("stores the value as JSON, readable with get", () => {
    group.set("value", { b: "x" });
    used_keys.add("@test/set/value");
    expect(localStorage.getItem("@test/set/value")).toBe('{"b":"x"}');
    expect(group.get("value", {}).value).toEqual({ b: "x" });
  });

  it("throws for a setting registered to a state", () => {
    group.register("registered", "R", "", st.ok_w(1));
    expect(() => group.set("registered", 2)).toThrow("registered");
  });
});

describe("SettingsGroup register", () => {
  const group = settings_init("@test/register", "1.0.0", "Register", "");

  it("returns the state", () => {
    const state = st.ok_w(1);
    expect(group.register("returned", "R", "", state)).toBe(state);
  });

  it("does not store the initial value, only changes", async () => {
    const state = st.ok_w(5);
    group.register("changes", "Changes", "", state);
    key("@test/register/changes");
    await settle();
    expect(localStorage.getItem("@test/register/changes")).toBeNull();
    await state.write(6);
    await settle();
    expect(localStorage.getItem("@test/register/changes")).toBe("6");
    expect(group.get("changes", 0).value).toBe(6);
  });

  it("stores objects and arrays as JSON", async () => {
    const state = st.ok_w({ list: [1, 2] });
    group.register("object", "Object", "", state);
    key("@test/register/object");
    await state.write({ list: [3] });
    await settle();
    expect(
      JSON.parse(localStorage.getItem("@test/register/object") ?? "null"),
    ).toEqual({ list: [3] });
  });

  it("stores through the transform", async () => {
    const state = st.ok_w(new Map<string, number>([["a", 1]]));
    group.register("map", "Map", "", state, async (s) =>
      JSON.stringify([...(await s).value]),
    );
    key("@test/register/map");
    await state.write(new Map([["b", 2]]));
    await settle();
    expect(localStorage.getItem("@test/register/map")).toBe('[["b",2]]');
  });

  it("throws when an id is registered twice", () => {
    group.register("twice", "Twice", "", st.ok_w(1));
    expect(() => group.register("twice", "Twice", "", st.ok_w(2))).toThrow(
      "already registered",
    );
  });
});

describe("SettingsGroup sub groups", () => {
  const group = settings_init("@test/sub", "1.0.0", "Sub", "");

  it("stores under the path of the parent group", () => {
    const sub = group.make_sub_group("child", "Child", "Child group");
    expect(sub.name).toBe("Child");
    expect(sub.description).toBe("Child group");
    sub.set("value", 3);
    used_keys.add("@test/sub/child/value");
    expect(localStorage.getItem("@test/sub/child/value")).toBe("3");
    const subsub = sub.make_sub_group("grand", "Grand", "");
    subsub.set("value", 4);
    used_keys.add("@test/sub/child/grand/value");
    expect(localStorage.getItem("@test/sub/child/grand/value")).toBe("4");
  });

  it("throws when a sub group id is used twice", () => {
    group.make_sub_group("dup", "Dup", "");
    expect(() => group.make_sub_group("dup", "Dup", "")).toThrow(
      "already registered",
    );
  });
});
