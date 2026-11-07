import st from "@chocbite/ts-lib/state";
import { describe, expect, it } from "vitest";
import type { SettingsGroup } from ".";

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
});
