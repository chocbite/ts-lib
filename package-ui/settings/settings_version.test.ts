import { beforeAll, describe, expect, it } from "vitest";
import type { SettingsGroup } from ".";

const VERSIONS_KEY = "settings/packageVersions";
const VALUE_KEY = "@test/migrate/value";
const ONCE_KEY = "@test/migrate/once";
const SUB_KEY = "@test/migrate/sub/value";

//The stored package versions are read when the settings module loads, so they are set up before the import,
//every test file runs in its own browser context, so the settings module loads fresh here
localStorage.setItem(VERSIONS_KEY, JSON.stringify({ "@test/migrate": "0.9.0" }));
localStorage.setItem(VALUE_KEY, JSON.stringify({ old: 5 }));
localStorage.setItem(ONCE_KEY, JSON.stringify(1));
localStorage.setItem(SUB_KEY, JSON.stringify("a"));

const cleanup = () => {
  for (const k of [VERSIONS_KEY, VALUE_KEY, ONCE_KEY, SUB_KEY])
    localStorage.removeItem(k);
};

describe("Settings version change", () => {
  //A package initialises its settings once, a second init sees the version already updated
  let group: SettingsGroup;
  beforeAll(async () => {
    const { settings_init } = await import(".");
    group = settings_init("@test/migrate", "1.0.0", "Migrate", "");
  });

  it("gives the old version to the group and migrates stored values", () => {
    expect(group.version_changed).toBe("0.9.0");
    const calls: [string, string][] = [];
    const value = group.get("value", { new: 0 }, undefined, (existing, old) => {
      calls.push([existing, old]);
      return { new: (JSON.parse(existing) as { old: number }).old * 2 };
    });
    expect(calls).toEqual([['{"old":5}', "0.9.0"]]);
    expect(value.value).toEqual({ new: 10 });
    expect(localStorage.getItem(VALUE_KEY)).toBe('{"new":10}');
  });

  it("gives the old version to sub groups", () => {
    const sub = group.make_sub_group("sub", "Sub", "");
    expect(sub.version_changed).toBe("0.9.0");
    expect(
      sub.get("value", "", undefined, (existing) => existing + "-migrated").value,
    ).toBe('"a"-migrated');
  });

  it("migrates a stored value only once per version change", () => {
    const migrate = (existing: string) => Number(existing) + 10;
    expect(group.get("once", 0, undefined, migrate).value).toBe(11);
    //Reading the setting again, the value is already in the new format and must not be migrated again
    expect(group.get("once", 0, undefined, migrate).value).toBe(11);
  });

  it("stores the new version of the package", async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const versions = JSON.parse(
        localStorage.getItem(VERSIONS_KEY) ?? "{}",
      ) as { [key: string]: string };
      expect(versions["@test/migrate"]).toBe("1.0.0");
    } finally {
      cleanup();
    }
  });
});
