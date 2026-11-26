import { err_nice, ok } from "#result";
import { describe, expect, expectTypeOf, it } from "vitest";
import { state as st, type StateEnumMultiRelated } from "..";

const Color = {
  Red: "red",
  Green: "green",
  Blue: "blue",
} as const;
type Color = (typeof Color)[keyof typeof Color];

const LIST = st.e.list<Color>({
  [Color.Red]: { name: "Red" },
  [Color.Green]: { name: "Green" },
  [Color.Blue]: { name: "Blue" },
});

const colors = (init: Color[], options: { min?: number; max?: number } = {}) =>
  st.rosw(
    st.e.help_multi(ok<Color[]>(init), {
      list: st.ok(LIST),
      min: options.min === undefined ? undefined : st.ok(options.min),
      max: options.max === undefined ? undefined : st.ok(options.max),
    }),
    true,
  );

describe("Enum multi helper check", () => {
  it("writes values in the list, in the order given", async () => {
    const state = colors([]);
    expect(await state.write([Color.Blue, Color.Red])).toEqual(ok(undefined));
    expect(state.ok()).toEqual([Color.Blue, Color.Red]);
    expect(await state.write([])).toEqual(ok(undefined));
    expect(state.ok()).toEqual([]);
  });

  it("refuses a value not in the list and keeps the value", async () => {
    const state = colors([Color.Red]);
    expect(await state.write([Color.Green, "pink" as Color])).toEqual(
      err_nice(st.errors.NOT_IN_LIST, "pink is not in list"),
    );
    expect(state.ok()).toEqual([Color.Red]);
  });

  it("only takes the keys of the list itself, not those every object has", async () => {
    const state = colors([]);
    expect(await state.write(["toString" as Color])).toEqual(
      err_nice(st.errors.NOT_IN_LIST, "toString is not in list"),
    );
  });

  it("refuses a value given twice", async () => {
    const state = colors([]);
    expect(await state.write([Color.Red, Color.Blue, Color.Red])).toEqual(
      err_nice(st.errors.DUPLICATE_VALUE, "red is given twice"),
    );
    expect(state.ok()).toEqual([]);
  });

  it("refuses more values than max and fewer than min", async () => {
    const state = colors([Color.Red], { min: 1, max: 2 });
    expect(await state.write([Color.Red, Color.Green, Color.Blue])).toEqual(
      err_nice(
        st.errors.TOO_MANY_VALUES,
        "3 values are more than the limit of 2",
      ),
    );
    expect(await state.write([])).toEqual(
      err_nice(
        st.errors.TOO_FEW_VALUES,
        "0 values are fewer than the limit of 1",
      ),
    );
    expect(state.ok()).toEqual([Color.Red]);
    expect(await state.write([Color.Green, Color.Blue])).toEqual(ok(undefined));
  });

  it("counts one value in the singular", async () => {
    const state = colors([], { max: 0 });
    expect(await state.write([Color.Red])).toEqual(
      err_nice(
        st.errors.TOO_MANY_VALUES,
        "1 value is more than the limit of 0",
      ),
    );
  });

  it("gives the error of the list while the list is in error", async () => {
    const list_error = err_nice(st.errors.TIMED_OUT, "list did not load");
    const state = st.rosw(
      st.e.help_multi(ok<Color[]>([]), {
        list: st.err<typeof LIST>(list_error.error),
      }),
      true,
    );
    expect(await state.write([Color.Red])).toEqual(list_error);
  });
});

describe("Enum multi helper limit", () => {
  it("drops values not in the list and values given twice", async () => {
    const state = colors([]);
    expect(
      await state.limit([Color.Red, "pink" as Color, Color.Blue, Color.Red]),
    ).toEqual(ok([Color.Red, Color.Blue]));
  });

  it("keeps the first values up to max", async () => {
    const state = colors([], { max: 2 });
    expect(await state.limit([Color.Blue, Color.Green, Color.Red])).toEqual(
      ok([Color.Blue, Color.Green]),
    );
  });

  it("gives the same array when nothing is dropped", async () => {
    const state = colors([], { max: 2 });
    const value = [Color.Green, Color.Red];
    expect((await state.limit(value)).unwrap()).toBe(value);
  });

  it("can not add values up to min, too few stay too few", async () => {
    const state = colors([], { min: 2 });
    expect(await state.limit([Color.Red])).toEqual(ok([Color.Red]));
  });
});

describe("Enum multi helper related", () => {
  it("gives the list, min and max", async () => {
    const state = colors([], { min: 1, max: 2 });
    const related = state.related().unwrap();
    expect((await related.list.read()).unwrap()).toBe(LIST);
    expect((await related.min!.read()).unwrap()).toBe(1);
    expect((await related.max!.read()).unwrap()).toBe(2);
    expectTypeOf(related).toEqualTypeOf<StateEnumMultiRelated<typeof LIST>>();
  });

  it("is told apart from the related of a single enum", () => {
    const multi = colors([]).related().unwrap();
    const single = st
      .rosw(st.e.help(ok<Color>(Color.Red), { list: st.ok(LIST) }), true)
      .related()
      .unwrap();
    expect(st.e.is_multi_related(multi)).toBe(true);
    expect(st.e.is_related(multi)).toBe(false);
    expect(st.e.is_multi_related(single)).toBe(false);
  });

  it("is told apart as a helper", () => {
    const [, multi] = st.e.help_multi(ok<Color[]>([]), { list: st.ok(LIST) });
    const [, single] = st.e.help(ok<Color>(Color.Red), { list: st.ok(LIST) });
    expect(st.e.is_multi_helper(multi)).toBe(true);
    expect(st.e.is_helper(multi)).toBe(false);
    expect(st.e.is_multi_helper(single)).toBe(false);
  });
});

describe("Enum multi helper sync", () => {
  it("checks synchronously when the list, min and max are sync states", () => {
    const state = st.rosws(
      st.e.help_multi(ok<Color[]>([]), { list: st.ok(LIST), max: st.ok(1) }),
    );
    expect(state.write_sync([Color.Red])).toEqual(ok(undefined));
    expect(state.write_sync([Color.Red, Color.Blue]).err).toBe(true);
    expect(state.limit_sync([Color.Blue, Color.Red])).toEqual(ok([Color.Blue]));
    expect(state.ok()).toEqual([Color.Red]);
  });

  it("can not be the helper of a sync state with an async list or limit", () => {
    const compile_only = () => {
      st.rosws(
        // @ts-expect-error the list can not be read synchronously
        st.e.help_multi(ok<Color[]>([]), {
          list: st.roa(async () => ok(LIST)),
        }),
      );
      st.rosws(
        // @ts-expect-error max can not be read synchronously
        st.e.help_multi(ok<Color[]>([]), {
          list: st.ok(LIST),
          max: st.roa(async () => ok(2)),
        }),
      );
    };
    expect(compile_only).toBeTypeOf("function");
  });
});

/**Type tests, only type checked, never called*/
function enum_multi_type_tests() {
  //The value is an array of the keys of the list
  const state = st.rosw(
    st.e.help_multi(ok<Color[]>([]), { list: st.ok(LIST) }),
    true,
  );
  expectTypeOf(state.ok()).toEqualTypeOf<Color[]>();
  // @ts-expect-error pink is not a color
  void state.write(["pink"]);
}
void enum_multi_type_tests;
