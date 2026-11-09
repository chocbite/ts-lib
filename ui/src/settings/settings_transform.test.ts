import { afterAll, describe, expect, it, vi } from "vitest";
import { settings_init, settings_set_name_transform } from ".";

//Every test file runs in its own browser context, so no settings group exists yet in this file,
//the transform must be set before the first group, which is what an app does in a module imported first
describe("Settings name transform", () => {
  const used_keys = new Set<string>();
  afterAll(() => {
    for (const key of used_keys) localStorage.removeItem(key);
  });

  it("set before any group, renames the storage path of every group without an error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      settings_set_name_transform((name) =>
        name.replace("@chocbite/ts-lib", "myapp").replace("_", ""),
      );
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
    const group = settings_init("@chocbite/ts-lib-test", "1.0.0", "T", "");
    group.set("value", 7);
    used_keys.add("myapp-test/value");
    expect(localStorage.getItem("myapp-test/value")).toBe("7");
    expect(localStorage.getItem("@chocbite/ts-lib-test/value")).toBeNull();
  });

  it("checks for a name used twice after the transform", () => {
    settings_init("@test/trans_formed", "1.0.0", "First", "");
    expect(() => settings_init("@test/transformed", "1.0.0", "Second", "")).toThrow(
      "already registered",
    );
  });

  it("set after a group was made, reports the groups that already use their name", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      settings_set_name_transform((name) => name);
      expect(error).toHaveBeenCalledOnce();
      expect(String(error.mock.calls[0][0])).toContain("myapp-test");
    } finally {
      error.mockRestore();
    }
  });
});
