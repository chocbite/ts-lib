import { sleep } from "#common";
import { err, err_nice, NiceError, ok, type Option, type Result } from "#result";
import safe, { fetch_status_safe, fetch_text_safe } from "#safe";
import state, {
  type State,
  type StateArrayReadTypes,
  type StateREA,
  type StateREAW,
  type StateResult,
} from "#state";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  FETCH_PARSE,
  make_fetch_parser,
  type FetchArrayOptions,
  type FetchFunction,
  type FetchParsed,
  type FetchSchema,
  type FetchWrite,
} from "../fetch_parse";
import parse from "../index";

const errors = parse.fetch.errors;
/**Kind of the errors tests make themselves*/
const TEST_ERROR = Symbol("Test error");

/**Value type of a readable state*/
type StateRV<S> = S extends StateREA<infer V> ? V : never;

describe("make_fetch_parser", () => {
  it("maps read-only and writable leaves to their state types", () => {
    const parsed = make_fetch_parser(
      () => "/user",
      1_000,
      { id: "n", name: "sw" },
      { write: async () => ok(undefined) },
    );

    const read_only: StateREA<number> = parsed.id;
    const writable: StateREAW<string> = parsed.name;
    expect(read_only).toBeDefined();
    expect(writable).toBeDefined();
    const root: StateREA<{ id: number; name: string }> = parsed[FETCH_PARSE];
    expect(root).toBeDefined();
  });

  it("makes keys optional in state values when their spec accepts a missing value", () => {
    const parsed = make_fetch_parser(
      () => "/user",
      1_000,
      { id: "n", age: "?nw", nick: ["?", "s"], count: ["?", "n", () => 0], address: { zip: "?n" } },
      { write: async () => ok(undefined) },
    );

    expectTypeOf<StateRV<(typeof parsed)[typeof FETCH_PARSE]>>().toEqualTypeOf<{
      id: number;
      age?: number | undefined;
      nick?: string | undefined;
      count: number;
      address: { zip?: number | undefined };
    }>();
    expectTypeOf<StateRV<(typeof parsed)["address"][typeof FETCH_PARSE]>>().toEqualTypeOf<{
      zip?: number | undefined;
    }>();
    const age: StateREAW<number | undefined> = parsed.age;
    expect(age).toBeDefined();
  });

  it("resolves the parsed type of the generic schema type", () => {
    //Lint rules ask for the constraint of FetchParsed<S> in generic code, which is FetchParsed<FetchSchema>.
    //The schema union contains itself, so this failed as excessively deep and poisoned the types checked after it
    expectTypeOf<FetchParsed<FetchSchema>>().not.toBeNever();
  });

  it("resolves a one-shot read with a fetch error when the global fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const parsed = make_fetch_parser(() => "/user", 1_000, { name: "s" });

    const result = await parsed.name.read();

    expect(!result.ok && result.error.kind).toBe(safe.fetch.errors.CONNECTION_FAILED);
    expect(!result.ok && result.error.message).toBe("offline");
    expect(!result.ok && result.error.cause).toBeInstanceOf(TypeError);
    expect(console_error).not.toHaveBeenCalled();
    console_error.mockRestore();
    vi.unstubAllGlobals();
  });

  it("resolves a one-shot read with an error on a failed http status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 500 })),
    );
    const parsed = make_fetch_parser(() => "/user", 1_000, { name: "s" });

    const result = await parsed.name.read();

    expect(!result.ok && result.error.kind).toBe(safe.fetch.errors.REJECTED);
    expect(!result.ok && result.error.message).toBe("HTTP 500");
    vi.unstubAllGlobals();
  });

  it("logs a throwing request factory and resolves a one-shot read with an error", async () => {
    const thrown = new Error("no url");
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const parsed = make_fetch_parser(
      () => {
        throw thrown;
      },
      1_000,
      { name: "s" },
    );

    const result = await parsed.name.read();

    expect(!result.ok && result.error).toEqual(new NiceError(errors.UNEXPECTED, thrown));
    expect(console_error).toHaveBeenCalledWith(expect.anything(), thrown);
    console_error.mockRestore();
  });

  it("fetches once for a leaf subscription and projects its value", async () => {
    const fetch_mock = vi
      .fn()
      .mockResolvedValue(new Response('{"name":"Ada"}'));
    vi.stubGlobal("fetch", fetch_mock);
    const user = make_fetch_parser(() => "/user", 60_000, { name: "s" });
    const update = vi.fn<(result: StateResult<string>) => void>();

    user.name.sub(update);
    await vi.waitFor(() => expect(update).toHaveBeenCalled());

    expect(fetch_mock).toHaveBeenCalledWith("/user", expect.any(Object));
    const first_result = update.mock.calls[0]?.[0];
    expect(first_result?.ok && first_result.value).toBe("Ada");
    user.name.unsub(update);
    vi.unstubAllGlobals();
  });

  it("fetches through a custom fetch function instead of the global fetch", async () => {
    const global_fetch = vi.fn();
    vi.stubGlobal("fetch", global_fetch);
    const custom_fetch = vi.fn<FetchFunction>(async () => ok('{"name":"Ada"}'));
    const user = make_fetch_parser(
      () => ["/user", { headers: { auth: "x" } }],
      60_000,
      { name: "s" },
      { fetch: custom_fetch },
    );

    const result = await user.name.read();

    expect(result.ok && result.value).toBe("Ada");
    expect(global_fetch).not.toHaveBeenCalled();
    expect(custom_fetch).toHaveBeenCalledWith(
      "/user",
      expect.objectContaining({ headers: { auth: "x" } }),
    );
    vi.unstubAllGlobals();
  });

  it("gives a custom fetch the signal that aborts when the last subscriber leaves", async () => {
    let signal: AbortSignal | undefined;
    const custom_fetch: FetchFunction = (_url, init) => {
      signal = init.signal ?? undefined;
      return new Promise(() => {});
    };
    const user = make_fetch_parser(() => "/user", 60_000, { name: "s" }, {
      fetch: custom_fetch,
    });
    const update = () => {};

    user.name.sub(update);
    await vi.waitFor(() => expect(signal).toBeDefined());
    expect(signal?.aborted).toBe(false);
    user.name.unsub(update);

    expect(signal?.aborted).toBe(true);
  });

  it("gives the error of a custom fetch as the read error without logging", async () => {
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "s" }, {
      fetch: async () => err_nice(TEST_ERROR, "Timed out"),
    });

    const result = await user.name.read();

    expect(!result.ok && result.error).toEqual(new NiceError(TEST_ERROR, "Timed out"));
    expect(console_error).not.toHaveBeenCalled();
    console_error.mockRestore();
  });

  it("logs a throwing custom fetch and resolves a one-shot read with an error", async () => {
    const thrown = new TypeError("Cannot read properties of undefined (reading 'url')");
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "s" }, {
      fetch: () => Promise.reject(thrown),
    });

    const result = await user.name.read();

    expect(!result.ok && result.error).toEqual(new NiceError(errors.UNEXPECTED, thrown));
    expect(console_error).toHaveBeenCalledWith(expect.anything(), thrown);
    console_error.mockRestore();
  });

  it.each([
    ["a Response", () => new Response("{}"), "returned a Response"],
    ["an unawaited promise", () => Promise.resolve("{}"), "returned a promise"],
    ["a number", () => 5, "must give the body as a string"],
  ])(
    "logs a custom fetch that gives %s instead of the body text",
    async (_name, value, message) => {
      const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
      const user = make_fetch_parser(() => "/user", 1_000, { name: "s" }, {
        fetch: async () => ok(value() as unknown as string),
      });

      const result = await user.name.read();

      expect(!result.ok && result.error.kind).toBe(errors.UNEXPECTED);
      expect(console_error.mock.calls[0]?.[0]).toContain(message);
      console_error.mockRestore();
    },
  );

  it("logs a custom fetch that does not return a result", async () => {
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "s" }, {
      fetch: async () => '{"name":"Ada"}' as unknown as Result<string, NiceError>,
    });

    const result = await user.name.read();

    expect(!result.ok && result.error.kind).toBe(errors.UNEXPECTED);
    expect(console_error.mock.calls[0]?.[0]).toContain("must return a Result");
    console_error.mockRestore();
  });

  it("logs a write that does not return a result", async () => {
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "sw" }, {
      write: async () => undefined as unknown as Result<void, NiceError>,
    });

    const result = await user.name.write("Ada");

    expect(!result.ok && result.error.kind).toBe(errors.UNEXPECTED);
    expect(console_error.mock.calls[0]?.[0]).toContain("must return a Result");
    console_error.mockRestore();
  });

  it("gives the error of write as the write result without logging", async () => {
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "sw" }, {
      write: async () => err_nice(TEST_ERROR, "Rejected by server"),
    });

    const result = await user.name.write("Ada");

    expect(!result.ok && result.error).toEqual(new NiceError(TEST_ERROR, "Rejected by server"));
    expect(console_error).not.toHaveBeenCalled();
    console_error.mockRestore();
  });

  it("logs a throwing write and gives an error result", async () => {
    const thrown = new Error("bug");
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "sw" }, {
      write: () => Promise.reject(thrown),
    });

    const result = await user.name.write("Ada");

    expect(!result.ok && result.error).toEqual(new NiceError(errors.UNEXPECTED, thrown));
    expect(console_error).toHaveBeenCalledWith(expect.anything(), thrown);
    console_error.mockRestore();
  });

  it("keeps schema keys separate from the root state API", () => {
    const parsed = make_fetch_parser(() => "/user", 1_000, { then: "n" });

    const value: StateREA<number> = parsed.then;
    const root: StateREA<{ then: number }> = parsed[FETCH_PARSE];

    expect(value).toBeDefined();
    expect(root).toBeDefined();
  });

  it("exposes primitive member states directly", () => {
    const parsed = make_fetch_parser(() => "/user", 1_000, {
      test: "?b",
      obj: { test: "?b" },
    });

    expect(parsed.test.read.bind(parsed.test)).toBeTypeOf("function");
    expect(parsed.obj.test.read.bind(parsed.obj.test)).toBeTypeOf("function");
  });

  it("sends nested writable values as a partial object", async () => {
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const user = make_fetch_parser(
      () => "/user",
      1_000,
      { settings: { newsletter: "bw" } },
      { write: send },
    );

    const result = await user.settings.newsletter.write(true);

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ settings: { newsletter: true } });
  });

  it("uses an array write encoder for indexed writable values", async () => {
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const user = make_fetch_parser(
      () => "/user",
      1_000,
      {
        aliases: [0, "sw", (alias: string) => ({ num: 1, alias })] as const,
      },
      { write: send },
    );

    const result = await user.aliases[5]!.write("joe");

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ aliases: { num: 1, alias: "joe" } });
  });

  it("limits and checks writable leaves like plain states, for form elements", async () => {
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const user = make_fetch_parser(
      () => "/user",
      1_000,
      {
        settings: { volume: "nw" },
        aliases: [0, "sw", (alias: string) => ({ num: 1, alias })] as const,
      },
      { write: send },
    );

    const limited = await user.settings.volume.limit(5);
    expect(limited.ok && limited.value).toBe(5);
    const checked = await user.settings.volume.check(6);
    expect(checked.ok && checked.value).toBe(6);
    const alias = await user.aliases[2]!.limit("joe");
    expect(alias.ok && alias.value).toBe("joe");
  });

  it("maps fixed and dynamic array items to hidden state containers", async () => {
    const parsed = make_fetch_parser(() => "/user", 1_000, {
      fixed: [2, "n"],
      dynamic: [0, "n"],
    });
    const fixed_item: StateREA<number> = parsed.fixed[1][FETCH_PARSE];
    const dynamic: StateREA<StateREA<number>[]> = parsed.dynamic;
    const fetch_mock = vi
      .fn()
      .mockResolvedValue(new Response('{"fixed":[1,2],"dynamic":[3]}'));
    vi.stubGlobal("fetch", fetch_mock);
    const dynamic_value = await parsed.dynamic.read();

    expect(fixed_item).toBeDefined();
    expect(dynamic).toBeDefined();
    expect(dynamic_value.ok).toBe(true);
    if (dynamic_value.ok) {
      expect(dynamic_value.value[0]).toBeDefined();
    }
    vi.unstubAllGlobals();
  });

  it("gives the whole value of a fixed array under FETCH_PARSE, like other containers", async () => {
    const parsed = make_fetch_parser(() => "/user", 1_000, {
      fixed: [2, "n"],
      nested: { pairs: [2, { a: "s" }] },
    });
    const fixed = parsed.fixed[FETCH_PARSE];
    expectTypeOf<StateRV<(typeof parsed.fixed)[typeof FETCH_PARSE]>>().toEqualTypeOf<
      [number, number]
    >();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response('{"fixed":[1,2],"nested":{"pairs":[{"a":"x"},{"a":"y"}]}}'),
          ),
        ),
    );

    expect(await fixed.read()).toMatchObject({ ok: true, value: [1, 2] });
    expect(await parsed.nested.pairs[FETCH_PARSE].read()).toMatchObject({
      ok: true,
      value: [{ a: "x" }, { a: "y" }],
    });
    expect(Array.isArray(parsed.fixed)).toBe(true);
    expect(parsed.fixed).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it("emits added and removed events for dynamic array length changes", async () => {
    const fetch_mock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"items":[1,2]}'))
      .mockResolvedValue(new Response('{"items":[1]}'));
    vi.stubGlobal("fetch", fetch_mock);
    const parsed = make_fetch_parser(() => "/items", 10, { items: [0, "n"] });
    const events: string[] = [];
    const subscriber = parsed.items.sub((result) => {
      if (result.ok) events.push(...state.a.read(result.value).map((event) => event.type));
    });

    await vi.waitFor(() => expect(events).toEqual(["added", "removed"]));

    expect(events).not.toContain("fresh");
    parsed.items.unsub(subscriber);
    vi.unstubAllGlobals();
  });

  it("projects record members by key", async () => {
    const fetch_mock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            '{"scores":{"alice":1,"bob":2},"users":{"a":{"name":"A"}}}',
          ),
        ),
      );
    vi.stubGlobal("fetch", fetch_mock);
    const parsed = make_fetch_parser(() => "/scores", 1_000, {
      scores: ["{}", "n"],
      users: ["{}", { name: "s" }],
    });

    const record: StateREA<Record<string, number>> = parsed.scores[FETCH_PARSE];
    const alice: StateREA<number> = parsed.scores.alice!;
    const name: StateREA<string> = parsed.users.a!.name;

    expect(parsed.scores.alice).toBe(alice);
    const record_value = await record.read();
    expect(record_value.ok && record_value.value).toEqual({ alice: 1, bob: 2 });
    const alice_value = await alice.read();
    expect(alice_value.ok && alice_value.value).toBe(1);
    const name_value = await name.read();
    expect(name_value.ok && name_value.value).toBe("A");
    const missing = await parsed.scores.carol!.read();
    expect(missing.ok).toBe(false);
    vi.unstubAllGlobals();
  });

  it("supports records at the root", async () => {
    const fetch_mock = vi.fn().mockResolvedValue(new Response('{"a":true}'));
    vi.stubGlobal("fetch", fetch_mock);
    const parsed = make_fetch_parser(() => "/flags", 1_000, ["{}", "b"]);

    const root: StateREA<Record<string, boolean>> = parsed[FETCH_PARSE];
    const flag: StateREA<boolean> = parsed.a!;

    expect(root).toBeDefined();
    const flag_value = await flag.read();
    expect(flag_value.ok && flag_value.value).toBe(true);
    vi.unstubAllGlobals();
  });

  it("sends writable record values as a partial object", async () => {
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const parsed = make_fetch_parser(
      () => "/scores",
      1_000,
      { scores: ["{}", "nw"] },
      { write: send },
    );

    const result = await parsed.scores.alice!.write(5);

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ scores: { alice: 5 } });
  });
});

describe("make_fetch_parser resubscribe while fetching", () => {
  /**Fetch mock where the first n fetches never answer until aborted*/
  const fetch_hanging_first = (hanging: number, signals: AbortSignal[]) =>
    vi.fn((_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      signals.push(signal);
      if (signals.length <= hanging)
        return new Promise<Response>((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted"))),
        );
      return Promise.resolve(new Response('{"name":"Ada"}'));
    });

  it("does not report the aborted fetch or start a second polling loop", async () => {
    vi.useFakeTimers();
    const fetch_mock = fetch_hanging_first(1, []);
    vi.stubGlobal("fetch", fetch_mock);
    try {
      const user = make_fetch_parser(() => "/user", 100, { name: "s" });
      const first = () => {};
      user.name.sub(first);
      user.name.unsub(first);
      const results: StateResult<string>[] = [];
      const second = (result: StateResult<string>) => results.push(result);
      user.name.sub(second);
      await vi.advanceTimersByTimeAsync(1000);
      expect(results.filter((result) => !result.ok)).toEqual([]);
      //Two initial fetches, then one every 100ms from a single polling loop
      expect(fetch_mock.mock.calls.length).toBeLessThanOrEqual(12);
      user.name.unsub(second);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("unsubscribing aborts the running fetch after a resubscribe", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", fetch_hanging_first(2, signals));
    try {
      const user = make_fetch_parser(() => "/user", 100, { name: "s" });
      const sub = () => {};
      user.name.sub(sub);
      user.name.unsub(sub);
      user.name.sub(sub);
      await sleep(5);
      user.name.unsub(sub);
      expect(signals.length).toBe(2);
      expect(signals[1]?.aborted).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("make_fetch_parser array write options", () => {
  const PUMPS = {
    pumps: [
      { id: 1, name: "A", speed: 10 },
      { id: 2, name: "B", speed: 20 },
    ],
  };
  /**Parser for the pumps above with the given array options, the first read has already been received*/
  const pumps_parser = async <const O extends FetchArrayOptions>(options: O) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(PUMPS)))),
    );
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const parsed = make_fetch_parser(
      () => "/pumps",
      60_000,
      { pumps: [0, { id: "n", name: "sw", speed: "nw" }, options] },
      { write: send },
    );
    //The type of pumps depends on O, which is not known in here, so its members are not either
    await (parsed.pumps as State<unknown>).read();
    return { parsed, send };
  };

  it("write single sends only the written value by index, like the encoder shorthand", async () => {
    try {
      const { parsed, send } = await pumps_parser({ write: "single" });
      expect((await parsed.pumps[1]!.name.write("Renamed")).ok).toBe(true);
      expect(send).toHaveBeenCalledWith({ pumps: { 1: { name: "Renamed" } } });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("write single uses the encode option for primitive items", async () => {
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const parsed = make_fetch_parser(
      () => "/tags",
      60_000,
      { tags: [0, "sw", { encode: (tag: string, index: number) => ({ index, tag }) }] },
      { write: send },
    );
    expect((await parsed.tags[3]!.write("x")).ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ tags: { index: 3, tag: "x" } });
  });

  it("write all sends the whole array with the change, based on the last received value", async () => {
    try {
      const { parsed, send } = await pumps_parser({ write: "all" });
      expect((await parsed.pumps[1]!.speed.write(55)).ok).toBe(true);
      expect(send).toHaveBeenCalledWith({
        pumps: [
          { id: 1, name: "A", speed: 10 },
          { id: 2, name: "B", speed: 55 },
        ],
      });
      //The received value is copied, not changed
      const received = await parsed.pumps[1]!.speed.read();
      expect(received.ok && received.value).toBe(20);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("write all limits like a plain state, for form elements", async () => {
    try {
      const { parsed } = await pumps_parser({ write: "all" });
      const limited = await parsed.pumps[0]!.speed.limit(30);
      expect(limited.ok && limited.value).toBe(30);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("write all refuses a write before any value is received, without calling write", async () => {
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const parsed = make_fetch_parser(
      () => "/pumps",
      60_000,
      { pumps: [0, { speed: "nw" }, { write: "all" }] },
      { write: send },
    );
    const result = await parsed.pumps[0]!.speed.write(5);
    expect(result.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("write all refuses a write to an item the last received value does not have", async () => {
    try {
      const { parsed, send } = await pumps_parser({ write: "all" });
      const result = await parsed.pumps[5]!.speed.write(5);
      expect(!result.ok && result.error.kind).toBe(errors.ITEM_GONE);
      if (!result.ok) expect_created_here(result.error);
      expect(send).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("write all makes the array state writable with plain item values", async () => {
    try {
      const { parsed, send } = await pumps_parser({ write: "all" });
      const result = await parsed.pumps.write([{ id: 3, name: "C", speed: 0 }]);
      expect(result.ok).toBe(true);
      expect(send).toHaveBeenCalledWith({ pumps: [{ id: 3, name: "C", speed: 0 }] });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("write all applies state array write instructions to the last received array", async () => {
    try {
      const { parsed, send } = await pumps_parser({ write: "all" });
      await parsed.pumps.write(state.a.write.push({ id: 3, name: "C", speed: 0 }));
      expect(send).toHaveBeenLastCalledWith({
        pumps: [...PUMPS.pumps, { id: 3, name: "C", speed: 0 }],
      });
      await parsed.pumps.write(state.a.write.splice(0, 1));
      expect(send).toHaveBeenLastCalledWith({ pumps: [PUMPS.pumps[1]] });
      await parsed.pumps.write(state.a.write.move(0, 1));
      expect(send).toHaveBeenLastCalledWith({
        pumps: [PUMPS.pumps[1], PUMPS.pumps[0]],
      });
      //The received value is never changed by an instruction
      const received = await parsed.pumps[0]!.name.read();
      expect(received.ok && received.value).toBe("A");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("write all wraps the whole array in its path, and nested arrays send the outer array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ plant: { lines: [{ valves: [true, false] }] } })),
        ),
      ),
    );
    try {
      const send = vi.fn().mockResolvedValue(ok(undefined));
      const parsed = make_fetch_parser(
        () => "/plant",
        60_000,
        { plant: { lines: [0, { valves: [0, "bw"] }, { write: "all" }] } },
        { write: send },
      );
      await parsed.plant.lines.read();
      await parsed.plant.lines[0]!.valves[1]!.write(true);
      expect(send).toHaveBeenCalledWith({
        plant: { lines: [{ valves: [true, true] }] },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("types the write all array state as writable with plain item values, write single as read only", () => {
    const parsed = make_fetch_parser(
      () => "/pumps",
      60_000,
      {
        all: [0, { id: "n", name: "sw" }, { write: "all" }],
        single: [0, { id: "n", name: "sw" }, { write: "single" }],
      },
      { write: async () => ok(undefined) },
    );
    expectTypeOf<Parameters<typeof parsed.all.write>[0]>().toEqualTypeOf<
      { id: number; name: string }[]
    >();
    expectTypeOf(parsed.all.writable).toEqualTypeOf<true>();
    // @ts-expect-error a write single array state is read only, its write may not exist
    void parsed.single.write([]);
    const name: StateREAW<string> = parsed.all[0]!.name;
    expect(name).toBeDefined();
  });
});

describe("make_fetch_parser keyed arrays", () => {
  type Pump = { id: number; name: string };
  const A = { id: 1, name: "A" };
  const B = { id: 2, name: "B" };
  const C = { id: 3, name: "C" };
  const D = { id: 4, name: "D" };

  /**Polls a server whose pumps the test changes, collects the item states and array changes each poll gives*/
  const keyed = async (options: FetchArrayOptions, pumps: Pump[]) => {
    vi.useFakeTimers();
    const server = { pumps: [...pumps] };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(server)))),
    );
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const parsed = make_fetch_parser(
      () => "/pumps",
      100,
      { pumps: [0, { id: "n", name: "sw" }, options] },
      { write: send },
    );
    let items: (typeof parsed.pumps)[number][] = [];
    let changes: StateArrayReadTypes<unknown>[] = [];
    const sub = (r: StateResult<typeof items>) => {
      if (!r.ok) return;
      items = r.value;
      changes = state.a.read(r.value);
    };
    parsed.pumps.sub(sub);
    await vi.advanceTimersByTimeAsync(0);
    return {
      parsed,
      send,
      items: () => [...items],
      /**The list as received, carrying the array changes*/
      read: () => items,
      changes: () => changes,
      /**Changes the server pumps and waits for the next poll*/
      poll: async (next: Pump[]) => {
        server.pumps = next;
        await vi.advanceTimersByTimeAsync(100);
      },
      done: () => {
        parsed.pumps.unsub(sub);
        vi.useRealTimers();
        vi.unstubAllGlobals();
      },
    };
  };
  const name_of = async (item: { name: StateREA<string> }) => {
    const name = await item.name.read();
    return name.ok ? name.value : "error: " + name.error.message;
  };

  it("without a key, item states follow positions and an insert at the start is reported at the end", async () => {
    const t = await keyed({}, [A, B, C]);
    try {
      const first = t.items()[0]!;
      await t.poll([D, A, B, C]);
      expect(t.changes()).toEqual([{ type: "added", index: 3, items: [t.items()[3]] }]);
      expect(t.items()[0]).toBe(first);
      expect(await name_of(first)).toBe("D");
    } finally {
      t.done();
    }
  });

  it("with a key, an insert at the start is reported at the start and item states follow their item", async () => {
    const t = await keyed({ key: "id" }, [A, B, C]);
    try {
      const [a, b, c] = t.items();
      await t.poll([D, A, B, C]);
      const [d] = t.items();
      expect(t.changes()).toEqual([{ type: "added", index: 0, items: [d] }]);
      expect(t.items()).toEqual([d, a, b, c]);
      expect(await name_of(a!)).toBe("A");
      expect(await name_of(d!)).toBe("D");
    } finally {
      t.done();
    }
  });

  it("with a key, removals and moves are reported where they happen", async () => {
    const t = await keyed({ key: "id" }, [A, B, C]);
    try {
      const [a, b, c] = t.items();
      await t.poll([B, C]);
      expect(t.changes()).toEqual([{ type: "removed", index: 0, items: [a] }]);
      await t.poll([C, B]);
      expect(t.changes()).toEqual([{ type: "moved", from_index: 1, to_index: 0, items: [c] }]);
      expect(t.items()).toEqual([c, b]);
      //The removed item reads as an error, its states are not reused for another item
      expect(await name_of(a!)).toContain("missing item with id 1");
    } finally {
      t.done();
    }
  });

  it("with a key, applying the reported changes to the previous list gives the new list", async () => {
    const t = await keyed({ key: "id" }, [A, B, C, D]);
    try {
      for (const next of [[D, B, A], [B], [C, B, A, D], [A, D, C, B], []]) {
        const before = [...t.items()];
        await t.poll(next);
        expect(t.changes().length).toBeGreaterThan(0);
        expect(state.a.read_apply(t.read(), before)).toEqual(t.items());
        expect(await Promise.all(t.items().map(name_of))).toEqual(next.map((p) => p.name));
      }
    } finally {
      t.done();
    }
  });

  it("with a key, items with the same key are told apart by order", async () => {
    const t = await keyed({ key: "id" }, [A, { id: 1, name: "A2" }]);
    try {
      const [first, second] = t.items();
      expect(await name_of(first!)).toBe("A");
      expect(await name_of(second!)).toBe("A2");
      await t.poll([B, A, { id: 1, name: "A2" }]);
      expect(t.items().slice(1)).toEqual([first, second]);
    } finally {
      t.done();
    }
  });

  it("with a key and write single, a write finds the item by key in the last received value", async () => {
    const t = await keyed({ key: "id" }, [A, B]);
    try {
      const [a] = t.items();
      await t.poll([D, B, A]);
      expect((await a!.name.write("Renamed")).ok).toBe(true);
      expect(t.send).toHaveBeenCalledWith({ pumps: { 2: { name: "Renamed" } } });
    } finally {
      t.done();
    }
  });

  it("with a key and write all, a write changes the item with that key", async () => {
    const t = await keyed({ key: "id", write: "all" }, [A, B]);
    try {
      const [a] = t.items();
      await t.poll([B, D, A]);
      expect((await a!.name.write("Renamed")).ok).toBe(true);
      expect(t.send).toHaveBeenCalledWith({
        pumps: [B, D, { id: 1, name: "Renamed" }],
      });
    } finally {
      t.done();
    }
  });

  it("with a key, a write to an item the server removed is refused without calling write", async () => {
    const t = await keyed({ key: "id" }, [A, B]);
    try {
      const [a] = t.items();
      await t.poll([B]);
      const result = await a!.name.write("Renamed");
      expect(!result.ok && result.error.kind).toBe(errors.ITEM_GONE);
      if (!result.ok) expect_created_here(result.error);
      expect(t.send).not.toHaveBeenCalled();
    } finally {
      t.done();
    }
  });

  it("with a key, index access gives the item at that position of the last received value", async () => {
    const send = vi.fn().mockResolvedValue(ok(undefined));
    const parsed = make_fetch_parser(
      () => "/pumps",
      60_000,
      { pumps: [0, { id: "n", name: "s" }, { key: "id" }] },
      { write: send },
    );
    expect(parsed.pumps[0]).toBeUndefined();
    const t = await keyed({ key: "id" }, [A, B]);
    try {
      expect(t.parsed.pumps[1]).toBe(t.items()[1]);
      await t.poll([B, A]);
      expect(t.parsed.pumps[1]).toBe(t.items()[1]);
      expect(await name_of(t.parsed.pumps[1]!)).toBe("A");
    } finally {
      t.done();
    }
  });
});

describe("make_fetch_parser optional members", () => {
  /**Parser of a fixed response, read once*/
  const parser_of = <const S extends FetchSchema>(schema: S, response: unknown) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(response)))),
    );
    const send = vi.fn().mockResolvedValue(ok(undefined));
    return { parsed: make_fetch_parser(() => "/x", 60_000, schema, { write: send }), send };
  };
  const value_of = async (s: { read(): PromiseLike<StateResult<unknown>> }) => {
    const r = await s.read();
    return r.ok ? r.value : "error: " + r.error.message;
  };

  it("reads a missing optional leaf as undefined", async () => {
    try {
      const { parsed } = parser_of({ name: "s", age: "?n", nick: "?sw" }, { name: "Ada" });
      expect(await value_of(parsed.age)).toBeUndefined();
      expect(await value_of(parsed.nick)).toBeUndefined();
      expect(await value_of(parsed.name)).toBe("Ada");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("gives the members of an optional object their own states", async () => {
    try {
      const { parsed, send } = parser_of(
        { opt: ["?", { a: "n", b: "sw" }] },
        { opt: { a: 1, b: "x" } },
      );
      expect(await value_of(parsed.opt.a)).toBe(1);
      expect(await value_of(parsed.opt[FETCH_PARSE])).toEqual({ a: 1, b: "x" });
      expect((await parsed.opt.b.write("y")).ok).toBe(true);
      expect(send).toHaveBeenCalledWith({ opt: { b: "y" } });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reads everything in a missing optional object as undefined", async () => {
    try {
      const { parsed } = parser_of({ opt: ["?", { a: "n", list: [2, "n"] }] }, {});
      expect(await value_of(parsed.opt[FETCH_PARSE])).toBeUndefined();
      expect(await value_of(parsed.opt.a)).toBeUndefined();
      expect(await value_of(parsed.opt.list[1][FETCH_PARSE])).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("gives the members of an optional object with a default their own states, filled by the default", async () => {
    try {
      const { parsed } = parser_of({ def: ["?", { b: "n" }, () => ({ b: 7 })] }, {});
      expect(await value_of(parsed.def.b)).toBe(7);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("types members of an optional object as possibly undefined, with a default as present", () => {
    const { parsed } = parser_of(
      { opt: ["?", { a: "n" }], def: ["?", { b: "n" }, () => ({ b: 0 })] },
      {},
    );
    expectTypeOf<StateRV<typeof parsed.opt.a>>().toEqualTypeOf<number | undefined>();
    expectTypeOf<StateRV<(typeof parsed.opt)[typeof FETCH_PARSE]>>().toEqualTypeOf<
      { a: number } | undefined
    >();
    expectTypeOf<StateRV<typeof parsed.def.b>>().toEqualTypeOf<number>();
    vi.unstubAllGlobals();
  });

  it("keeps a missing required member an error", async () => {
    try {
      //The record gives a state for any key, a key the server does not have is not optional
      const { parsed } = parser_of({ rec: ["{}", "n"] }, { rec: { a: 1 } });
      expect(await value_of(parsed.rec.b!)).toContain("missing member b");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("make_fetch_parser retry_rate", () => {
  /**A fetch that gives the results in order, the last one from then on*/
  const fetch_giving = (...results: Result<string, NiceError>[]) =>
    vi.fn<FetchFunction>(async () => results.length > 1 ? results.shift()! : results[0]!);

  /**Subscribes, runs the timers for each step in ms and gives the number of fetches after each step*/
  const fetches_after = async (
    fetch: ReturnType<typeof fetch_giving>,
    options: { retry_rate?: number },
    steps: number[],
  ): Promise<number[]> => {
    vi.useFakeTimers();
    try {
      const user = make_fetch_parser(() => "/user", 100, { name: "s" }, { fetch, ...options });
      const update = () => {};
      user.name.sub(update);
      await vi.advanceTimersByTimeAsync(0);
      const counts = [fetch.mock.calls.length];
      for (const step of steps) {
        await vi.advanceTimersByTimeAsync(step);
        counts.push(fetch.mock.calls.length);
      }
      user.name.unsub(update);
      return counts;
    } finally {
      vi.useRealTimers();
    }
  };

  it("waits retry_rate after a failed fetch and update_rate again after a success", async () => {
    const fetch = fetch_giving(err_nice(TEST_ERROR, "offline"), err_nice(TEST_ERROR, "offline"), ok('{"name":"Ada"}'));

    //Fails at 0 and 1000, succeeds at 2000, then polls every 100
    expect(await fetches_after(fetch, { retry_rate: 1000 }, [999, 1, 999, 1, 99, 1])).toEqual([
      1, 1, 2, 2, 3, 3, 4,
    ]);
  });

  it("waits update_rate after a failed fetch without retry_rate", async () => {
    const fetch = fetch_giving(err_nice(TEST_ERROR, "offline"));

    expect(await fetches_after(fetch, {}, [99, 1, 100])).toEqual([1, 1, 2, 3]);
  });

  it("counts a response that fails to parse as a failed fetch", async () => {
    const fetch = fetch_giving(ok("not json"));

    expect(await fetches_after(fetch, { retry_rate: 1000 }, [100, 900])).toEqual([1, 1, 2]);
  });
});

describe("make_fetch_parser array_start", () => {
  /**A parser with array_start 1 whose fetch gives body, and its write mock*/
  const parser_from = <const S extends FetchSchema>(schema: S, body: unknown = {}) => {
    const send = vi.fn<FetchWrite>(async () => ok(undefined));
    const parsed = make_fetch_parser(() => "/x", 60_000, schema, {
      write: send,
      fetch: async () => ok(JSON.stringify(body)),
      array_start: 1,
    });
    return { parsed, send };
  };

  it("adds array_start to the index of a dynamic array item in the payload", async () => {
    const { parsed, send } = parser_from({ pumps: [0, { name: "sw" }] });

    await parsed.pumps[0]!.name.write("A");

    expect(send).toHaveBeenCalledWith({ pumps: { 1: { name: "A" } } });
  });

  it("adds array_start to the index a keyed item has in the last received value", async () => {
    const { parsed, send } = parser_from(
      { pumps: [0, { id: "n", name: "sw" }, { key: "id" }] },
      { pumps: [{ id: 7, name: "a" }, { id: 9, name: "b" }] },
    );
    //The type of pumps depends on O, which is not known in here, so its members are not either
    await (parsed.pumps as State<unknown>).read();

    await parsed.pumps[1]!.name.write("B");

    expect(send).toHaveBeenCalledWith({ pumps: { 2: { name: "B" } } });
  });

  it("adds array_start to the index of a fixed array item in the payload", async () => {
    const { parsed, send } = parser_from({ outputs: [4, "bw"], zones: [2, { setpoint: "nw" }] });

    await parsed.outputs[2][FETCH_PARSE].write(true);
    await parsed.zones[0].setpoint.write(21);

    expect(send).toHaveBeenNthCalledWith(1, { outputs: { 3: true } });
    expect(send).toHaveBeenNthCalledWith(2, { zones: { 1: { setpoint: 21 } } });
  });

  it("gives an encoder the index with array_start added", async () => {
    const { parsed, send } = parser_from({
      tags: [0, "sw", { encode: (tag: string, index: number) => ({ index, tag }) }],
    });

    await parsed.tags[0]!.write("x");

    expect(send).toHaveBeenCalledWith({ tags: { index: 1, tag: "x" } });
  });

  it("adds array_start to the indexes outside a write all array, not to the array sent", async () => {
    const { parsed, send } = parser_from(
      { groups: [2, { items: [0, "sw", { write: "all" }] }] },
      { groups: [{ items: ["a"] }, { items: ["b", "c"] }] },
    );
    await parsed[FETCH_PARSE].read();

    await parsed.groups[1].items[0]!.write("B");

    expect(send).toHaveBeenCalledWith({ groups: { 2: { items: ["B", "c"] } } });
  });
  it("uses the start of a dynamic array in place of array_start, other arrays keep array_start", async () => {
    const { parsed, send } = parser_from({
      pumps: [0, { name: "sw" }, { start: 0 }],
      valves: [0, { name: "sw" }],
    });

    await parsed.pumps[0]!.name.write("A");
    await parsed.valves[0]!.name.write("B");

    expect(send).toHaveBeenNthCalledWith(1, { pumps: { 0: { name: "A" } } });
    expect(send).toHaveBeenNthCalledWith(2, { valves: { 1: { name: "B" } } });
  });

  it("uses the start of a fixed array", async () => {
    const { parsed, send } = parser_from({ outputs: [4, "bw", { start: 10 }], zones: [2, { setpoint: "nw" }, { start: 0 }] });

    await parsed.outputs[2][FETCH_PARSE].write(true);
    await parsed.zones[1].setpoint.write(21);

    expect(send).toHaveBeenNthCalledWith(1, { outputs: { 12: true } });
    expect(send).toHaveBeenNthCalledWith(2, { zones: { 1: { setpoint: 21 } } });
  });

  it("shifts each position of nested arrays by the start of its own array", async () => {
    const { parsed, send } = parser_from({
      groups: [2, { items: [0, { name: "sw" }, { start: 5 }], outputs: [2, "bw"] }, { start: 0 }],
    });

    await parsed.groups[1].items[0]!.name.write("A");
    await parsed.groups[1].outputs[1][FETCH_PARSE].write(true);

    expect(send).toHaveBeenNthCalledWith(1, { groups: { 1: { items: { 5: { name: "A" } } } } });
    expect(send).toHaveBeenNthCalledWith(2, { groups: { 1: { outputs: { 2: true } } } });
  });

  it("uses the start of the array of a keyed item and of an encoder", async () => {
    const { parsed, send } = parser_from(
      {
        pumps: [0, { id: "n", name: "sw" }, { key: "id", start: 100 }],
        tags: [0, "sw", { encode: (tag: string, index: number) => ({ index, tag }), start: 0 }],
      },
      { pumps: [{ id: 7, name: "a" }, { id: 9, name: "b" }], tags: [] },
    );
    await (parsed.pumps as State<unknown>).read();

    await parsed.pumps[1]!.name.write("B");
    await parsed.tags[3]!.write("x");

    expect(send).toHaveBeenNthCalledWith(1, { pumps: { 101: { name: "B" } } });
    expect(send).toHaveBeenNthCalledWith(2, { tags: { index: 3, tag: "x" } });
  });

  it("uses the start of the arrays outside a write all array", async () => {
    const { parsed, send } = parser_from(
      { groups: [2, { items: [0, "sw", { write: "all", start: 7 }] }, { start: 0 }] },
      { groups: [{ items: ["a"] }, { items: ["b", "c"] }] },
    );
    await parsed[FETCH_PARSE].read();

    await parsed.groups[1].items[0]!.write("B");

    expect(send).toHaveBeenCalledWith({ groups: { 1: { items: ["B", "c"] } } });
  });

  it("uses the start of a fixed array of write only items, and reads arrays from 0", async () => {
    const { parsed, send } = parser_from(
      { codes: [3, "swo", { start: 0 }], levels: [2, "n", { start: 5 }] },
      { levels: [4, 6] },
    );

    await parsed.codes[2][FETCH_PARSE].write("1234");

    expect(send).toHaveBeenCalledWith({ codes: { 2: "1234" } });
    expect(await parsed.levels[1][FETCH_PARSE].read()).toEqual(ok(6));
    expect(await parsed[FETCH_PARSE].read()).toEqual(ok({ levels: [4, 6] }));
  });
});

describe("make_fetch_parser tuples", () => {
  const parser_from = <const S extends FetchSchema>(schema: S, body: unknown) => {
    const send = vi.fn<FetchWrite>(async () => ok(undefined));
    const parsed = make_fetch_parser(() => "/x", 60_000, schema, {
      write: send,
      fetch: async () => ok(JSON.stringify(body)),
    });
    return { parsed, send };
  };

  it("gives a state per position and the whole tuple under FETCH_PARSE", async () => {
    const { parsed } = parser_from({ point: ["n", "s"] }, { point: [1, "a"] });

    expect((await parsed.point[0].read()).unwrap()).toBe(1);
    expect((await parsed.point[1].read()).unwrap()).toBe("a");
    expect((await parsed.point[FETCH_PARSE].read()).unwrap()).toEqual([1, "a"]);
  });

  it("types the positions as states of their values", () => {
    const { parsed } = parser_from({ point: ["nw", "s"] }, { point: [1, "a"] });

    expectTypeOf(parsed.point[0]).toEqualTypeOf<StateREAW<number, Option<{}>, number>>();
    expectTypeOf(parsed.point[1]).toEqualTypeOf<StateREA<string, Option<{}>, string>>();
  });

  it("writes a writable position addressed by index", async () => {
    const { parsed, send } = parser_from({ point: ["nw", "s"] }, { point: [1, "a"] });

    await parsed.point[0].write(5);

    expect(send).toHaveBeenCalledWith({ point: { 0: 5 } });
  });
});

describe("make_fetch_parser write_debounce", () => {
  /**A parser with write_debounce 50 whose fetch gives body, and its write mock*/
  const parser_from = <const S extends FetchSchema>(
    schema: S,
    body: unknown = {},
    result: Result<unknown, NiceError> = ok(undefined),
  ) => {
    const send = vi.fn<FetchWrite>(async () => result);
    const parsed = make_fetch_parser(() => "/x", 60_000, schema, {
      write: send,
      fetch: async () => ok(JSON.stringify(body)),
      write_debounce: 50,
    });
    return { parsed, send };
  };

  /**Runs fn with fake timers, then lets the batch go out*/
  const with_timers = async (fn: () => Promise<void>) => {
    vi.useFakeTimers();
    try {
      await fn();
    } finally {
      vi.useRealTimers();
    }
  };

  it("sends the writes of different members within write_debounce as one merged payload", () =>
    with_timers(async () => {
      const { parsed, send } = parser_from({ name: "sw", settings: { eco: "bw" } });

      const first = parsed.name.write("A");
      const second = parsed.settings.eco.write(true);
      await vi.advanceTimersByTimeAsync(49);
      expect(send).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({ name: "A", settings: { eco: true } });
      expect((await first).ok).toBe(true);
      expect((await second).ok).toBe(true);
    }));

  it("sends only the last value of a member written twice", () =>
    with_timers(async () => {
      const { parsed, send } = parser_from({ name: "sw" });

      void parsed.name.write("A");
      void parsed.name.write("B");
      await vi.advanceTimersByTimeAsync(50);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({ name: "B" });
    }));

  it("gives every write of the batch the result of the write call", () =>
    with_timers(async () => {
      const { parsed } = parser_from({ name: "sw", speed: "nw" }, {}, err_nice(TEST_ERROR, "Rejected"));

      const first = parsed.name.write("A");
      const second = parsed.speed.write(5);
      await vi.advanceTimersByTimeAsync(50);

      const [first_result, second_result] = [await first, await second];
      expect(!first_result.ok && first_result.error.message).toBe("Rejected");
      expect(!second_result.ok && second_result.error.message).toBe("Rejected");
    }));

  it("sends the batch first when an encoded write of another item would overwrite it", () =>
    with_timers(async () => {
      const { parsed, send } = parser_from({
        tags: [0, "sw", { encode: (tag: string, index: number) => ({ index, tag }) }],
      });

      void parsed.tags[1]!.write("a");
      void parsed.tags[3]!.write("b");
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenNthCalledWith(1, { tags: { index: 1, tag: "a" } });
      await vi.advanceTimersByTimeAsync(50);

      expect(send).toHaveBeenCalledTimes(2);
      expect(send).toHaveBeenNthCalledWith(2, { tags: { index: 3, tag: "b" } });
    }));

  it("builds a write all array on the writes before it in the batch", async () => {
    const { parsed, send } = parser_from(
      { list: [0, "sw", { write: "all" }] },
      { list: ["a", "b", "c"] },
    );
    //Received with real timers, the batch is what this is about
    await parsed[FETCH_PARSE].read();
    await with_timers(async () => {

      const writes = [
        parsed.list[0]!.write("A"),
        parsed.list[2]!.write("C"),
        parsed.list.write(state.a.write.push("d")),
      ];
      await vi.advanceTimersByTimeAsync(50);
      expect((await Promise.all(writes)).map((r) => (r.ok ? "ok" : r.error))).toEqual(["ok", "ok", "ok"]);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({ list: ["A", "b", "C", "d"] });
    });
  });
});

/**The error is not supposed to happen, so it has an Error, whose cause is where make_fetch_parser was called, this test file*/
const expect_created_here = (error: NiceError) => {
  expect(error.cause).toBeInstanceOf(Error);
  expect((error.cause?.cause as Error | undefined)?.stack).toContain("fetch_parse.test");
};

describe("make_fetch_parser NiceErrors", () => {
  it("gives a write without write function as not writable, with where the parser was made", async () => {
    const parsed = make_fetch_parser(() => "/x", 60_000, { name: "s" }, { fetch: async () => ok('{"name":"a"}') });

    const result = await (parsed[FETCH_PARSE] as unknown as StateREAW<unknown>).write({ name: "b" });

    expect(!result.ok && result.error.kind).toBe(state.errors.NOT_WRITABLE);
    if (!result.ok) expect_created_here(result.error);
  });

  const parser_with = <const S extends FetchSchema>(schema: S, body: string) =>
    make_fetch_parser(() => "/x", 60_000, schema, {
      fetch: async () => ok(body),
      write: async () => ok(undefined),
    });

  it("gives a body that fails to parse as invalid data, with the parser message", async () => {
    const parsed = parser_with({ name: "s" }, "not json");

    const result = await parsed.name.read();

    expect(!result.ok && result.error.kind).toBe(errors.INVALID_DATA);
    expect(!result.ok && result.error.message).toBe("Failed to parse valid json");
    if (!result.ok) expect_created_here(result.error);
  });

  it("gives a missing record member as member missing", async () => {
    const parsed = parser_with(["{}", "n"], '{"a":1}');

    const result = await parsed["b"]!.read();

    expect(!result.ok && result.error.kind).toBe(errors.MEMBER_MISSING);
    if (!result.ok) expect_created_here(result.error);
  });

  it("refuses a write all array write before a value is received as no value", async () => {
    const send = vi.fn<FetchWrite>(async () => ok(undefined));
    const parsed = make_fetch_parser(() => "/x", 60_000, { list: [0, "sw", { write: "all" }] }, {
      fetch: () => new Promise(() => {}),
      write: send,
    });

    const result = await parsed.list.write(state.a.write.push("x"));

    expect(!result.ok && result.error.kind).toBe(errors.NO_VALUE);
    //Normal use, nothing is received yet after start up, so only a message
    expect(!result.ok && result.error.cause).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it("gives the result of write as ok without its value", async () => {
    const parsed = make_fetch_parser(() => "/x", 60_000, { name: "sw" }, {
      fetch: async () => ok('{"name":"a"}'),
      write: async () => ok(204),
    });

    expect(await parsed.name.write("b")).toEqual(ok(undefined));
  });

  it("logs a fetch from plain javascript that gives a string error as a bug", async () => {
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const parsed = make_fetch_parser(() => "/x", 60_000, { name: "s" }, {
      fetch: async () => err("offline") as unknown as Result<string, NiceError>,
    });

    const result = await parsed.name.read();

    expect(!result.ok && result.error.kind).toBe(errors.UNEXPECTED);
    if (!result.ok) expect_created_here(result.error);
    console_error.mockRestore();
  });

  it("takes the text and response of fetch_text_safe as fetch, the text is parsed", async () => {
    const parsed = make_fetch_parser(() => "/x", 60_000, { name: "s" }, {
      fetch: async () => ok(['{"name":"Ada"}', new Response(null, { status: 200 })] as const),
    });

    expect((await parsed.name.read()).unwrap()).toBe("Ada");
  });

  it("takes fetch_text_safe as fetch without mapping", () => {
    const parsed = make_fetch_parser(() => "/x", 60_000, { name: "s" }, { fetch: fetch_text_safe });

    expect(parsed.name).toBeDefined();
  });

  it("takes fetch_status_safe as write without mapping", () => {
    const parsed = make_fetch_parser(() => "/x", 60_000, { name: "sw" }, {
      write: (payload) => fetch_status_safe("/x", { method: "PATCH", body: JSON.stringify(payload) }),
    });

    expect(parsed.name).toBeDefined();
  });
});

/**Fake timers with the clock past 0, like in a page. At 0 an empty remote state reads as valid, its validity starts at 0*/
const fake_timers = () => {
  vi.useFakeTimers();
  vi.advanceTimersByTime(1);
};

describe("make_fetch_parser reads while polling", () => {
  /**A fetch whose answers the test gives, each call waits for the next answer*/
  const fetch_answered = () => {
    const answers: ((result: Result<string, NiceError>) => void)[] = [];
    const fetch = vi.fn<FetchFunction>(
      () => new Promise((resolve) => answers.push(resolve)),
    );
    return { fetch, answer: (result: Result<string, NiceError>) => answers.shift()!(result) };
  };
  const user_of = (fetch: FetchFunction) =>
    make_fetch_parser(() => "/user", 100, { name: "s", age: "n" }, { fetch });
  const ADA = ok('{"name":"Ada","age":36}');

  it("gives an await the last polled value, without a request", async () => {
    fake_timers();
    try {
      const { fetch, answer } = fetch_answered();
      const user = user_of(fetch);
      const update = () => {};
      user.name.sub(update);
      answer(ADA);
      //Time passes after the poll, the clock of fake timers only moves when told to
      await vi.advanceTimersByTimeAsync(1);

      expect(await user.age.read()).toMatchObject({ ok: true, value: 36 });
      expect(await user[FETCH_PARSE].read()).toMatchObject({ ok: true, value: { name: "Ada", age: 36 } });
      expect(fetch).toHaveBeenCalledTimes(1);
      user.name.unsub(update);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives a new subscriber the last polled value, without a request", async () => {
    fake_timers();
    try {
      const { fetch, answer } = fetch_answered();
      const user = user_of(fetch);
      const update = () => {};
      user.name.sub(update);
      answer(ADA);
      //Time passes after the poll, the clock of fake timers only moves when told to
      await vi.advanceTimersByTimeAsync(1);
      const ages: unknown[] = [];
      const on_age = (age: StateResult<number>) => ages.push(age.ok && age.value);

      user.age.sub(on_age, true);
      await vi.advanceTimersByTimeAsync(0);

      expect(ages).toEqual([36]);
      expect(fetch).toHaveBeenCalledTimes(1);
      user.age.unsub(on_age);
      user.name.unsub(update);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives an await the error of the last poll until the next poll", async () => {
    fake_timers();
    try {
      const { fetch, answer } = fetch_answered();
      const user = user_of(fetch);
      const update = () => {};
      user.name.sub(update);
      answer(err_nice(TEST_ERROR, "offline"));
      await vi.advanceTimersByTimeAsync(1);

      const age = await user.age.read();
      expect(!age.ok && age.error.kind).toBe(TEST_ERROR);
      expect(fetch).toHaveBeenCalledTimes(1);
      user.name.unsub(update);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets an await before the first poll answers wait for that poll", async () => {
    fake_timers();
    try {
      const { fetch, answer } = fetch_answered();
      const user = user_of(fetch);
      const update = () => {};
      user.name.sub(update);
      const age = user.age.read().then((result) => result);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(1);

      answer(ADA);

      expect(await age).toMatchObject({ ok: true, value: 36 });
      expect(fetch).toHaveBeenCalledTimes(1);
      user.name.unsub(update);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fetches for an await that waited for a poll, when the subscription ends before the poll answers", async () => {
    fake_timers();
    try {
      const { fetch, answer } = fetch_answered();
      const user = user_of(fetch);
      const update = () => {};
      user.name.sub(update);
      const age = user.age.read().then((result) => result);
      await vi.advanceTimersByTimeAsync(0);

      user.name.unsub(update);
      expect(fetch).toHaveBeenCalledTimes(2);
      answer(err_nice(TEST_ERROR, "aborted poll, ignored"));
      answer(ADA);

      expect(await age).toMatchObject({ ok: true, value: 36 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fetches for every await without a subscription, and after polling stopped", async () => {
    const fetch = vi.fn<FetchFunction>(() => Promise.resolve(ADA));
    const user = user_of(fetch);

    await user.age.read();
    await user.age.read();
    expect(fetch).toHaveBeenCalledTimes(2);

    const update = () => {};
    user.name.sub(update);
    await sleep(0);
    user.name.unsub(update);
    expect(fetch).toHaveBeenCalledTimes(3);
    await user.age.read();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});

describe("make_fetch_parser timeout", () => {
  const hanging = () => vi.fn<FetchFunction>(() => new Promise(() => {}));
  const is_timed_out = (result: StateResult<unknown>) =>
    !result.ok && result.error.kind === safe.fetch.errors.TIMED_OUT;

  it("gives TIMED_OUT when a poll gets no answer within 5000 ms, and polls again after retry_rate", async () => {
    fake_timers();
    try {
      const fetch = hanging();
      const user = make_fetch_parser(() => "/user", 100, { name: "s" }, { fetch, retry_rate: 1000 });
      const names: StateResult<string>[] = [];
      const on_name = (name: StateResult<string>) => names.push(name);
      user.name.sub(on_name);

      await vi.advanceTimersByTimeAsync(4999);
      expect(names).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(names.length).toBe(1);
      expect(is_timed_out(names[0]!)).toBe(true);
      expect(is_timed_out(await user.name.read())).toBe(true);

      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetch).toHaveBeenCalledTimes(2);
      user.name.unsub(on_name);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the request at the timeout, with a TimeoutError", async () => {
    fake_timers();
    try {
      let signal: AbortSignal | undefined;
      const fetch = vi.fn<FetchFunction>((_url, init) => {
        signal = init.signal ?? undefined;
        return new Promise(() => {});
      });
      const user = make_fetch_parser(() => "/user", 100, { name: "s" }, { fetch, timeout: 300 });
      const age = user.name.read().then((result) => result);

      await vi.advanceTimersByTimeAsync(300);

      expect(signal?.aborted).toBe(true);
      expect((signal?.reason as Error).name).toBe("TimeoutError");
      expect(is_timed_out(await age)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives an await without a subscription the TIMED_OUT of the fetch, not a timeout of the state", async () => {
    fake_timers();
    try {
      const user = make_fetch_parser(() => "/user", 100, { name: "s" }, { fetch: hanging(), timeout: 2000 });
      const name = user.name.read().then((result) => result);

      await vi.advanceTimersByTimeAsync(2000);

      expect(is_timed_out(await name)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("make_fetch_parser write only members", () => {
  /**A parser whose fetch gives body, and its fetch and write mocks, write answers with the results given in order, then ok*/
  const parser_from = <const S extends FetchSchema>(
    schema: S,
    body: unknown = {},
    ...results: Result<unknown, NiceError>[]
  ) => {
    const fetch = vi.fn<FetchFunction>(async () => ok(JSON.stringify(body)));
    const send = vi.fn<FetchWrite>(async () => results.shift() ?? ok(undefined));
    const parsed = make_fetch_parser(() => "/x", 60_000, schema, { write: send, fetch });
    return { parsed, send, fetch };
  };
  /**A write whose answers the test gives, answer answers the latest write*/
  const held_write = () => {
    let answer: (result: Result<unknown, NiceError>) => void = () => {};
    const send = vi.fn<FetchWrite>(
      () => new Promise((resolve) => (answer = resolve)),
    );
    return { send, answer: () => answer };
  };

  it("types the member by its write type, reading undefined without a default and the type with one", () => {
    const { parsed } = parser_from({
      id: "n",
      reboot: "bwo",
      setpoint: ["?", "nwo", () => 0],
      password: ["?", "swo", () => "", { reset: true }],
    });
    expectTypeOf(parsed.reboot.ok()).toEqualTypeOf<undefined>();
    expectTypeOf<Parameters<typeof parsed.reboot.write>[0]>().toEqualTypeOf<boolean>();
    expectTypeOf(parsed.setpoint.ok()).toEqualTypeOf<number>();
    expectTypeOf<Parameters<typeof parsed.setpoint.write>[0]>().toEqualTypeOf<number>();
    expectTypeOf(parsed.password.ok()).toEqualTypeOf<string>();
    //The server does not send them, so they are not in the value of their container
    expectTypeOf<StateRV<(typeof parsed)[typeof FETCH_PARSE]>>().toEqualTypeOf<{ id: number }>();
  });

  it("parses a response without the member, and ignores it when the server sends it anyway", async () => {
    const without = parser_from({ id: "n", command: "nwo" }, { id: 1 });
    expect(await without.parsed[FETCH_PARSE].read()).toEqual(ok({ id: 1 }));
    const with_it = parser_from({ id: "n", command: "nwo" }, { id: 1, command: "not a number" });
    expect((await with_it.parsed.id.read()).ok).toBe(true);
  });

  it("sends a partial object like a writable member, without reading", async () => {
    const { parsed, send, fetch } = parser_from({ settings: { reboot: "bwo" } });
    expect(await parsed.settings.reboot.write(true)).toEqual(ok(undefined));
    expect(send).toHaveBeenCalledWith({ settings: { reboot: true } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not poll while subscribed", async () => {
    const { parsed, fetch } = parser_from({ command: "nwo" });
    const unsubscribe = parsed.command.sub(() => {});
    await sleep(5);
    expect(fetch).not.toHaveBeenCalled();
    parsed.command.unsub(unsubscribe);
  });

  it("reads undefined, also after a write, without a default", async () => {
    const { parsed } = parser_from({ command: "nwo" });
    expect(parsed.command.get()).toEqual(ok(undefined));
    await parsed.command.write(5);
    expect(parsed.command.get()).toEqual(ok(undefined));
  });

  it("reads the default, then the written value at once, and keeps it when the write succeeds", async () => {
    const { send, answer } = held_write();
    const parsed = make_fetch_parser(() => "/x", 60_000, { setpoint: ["?", "nwo", () => 20] }, { write: send });
    expect(parsed.setpoint.ok()).toBe(20);
    const writing = parsed.setpoint.write(25);
    expect(parsed.setpoint.ok()).toBe(25);
    await sleep(0);
    answer()(ok(undefined));
    expect((await writing).ok).toBe(true);
    expect(parsed.setpoint.ok()).toBe(25);
  });

  it("goes back to the last value written successfully when a write fails", async () => {
    const failed = err_nice(TEST_ERROR, "Rejected");
    const { parsed } = parser_from({ setpoint: ["?", "nwo", () => 20] }, {}, ok(undefined), failed);
    await parsed.setpoint.write(25);
    expect(await parsed.setpoint.write(30)).toBe(failed);
    expect(parsed.setpoint.ok()).toBe(25);
  });

  it("settles on the last write when writes overlap", async () => {
    const { send, answer } = held_write();
    const parsed = make_fetch_parser(() => "/x", 60_000, { setpoint: ["?", "nwo", () => 20] }, { write: send });
    const first = parsed.setpoint.write(25);
    await sleep(0);
    const answer_first = answer();
    const second = parsed.setpoint.write(30);
    await sleep(0);
    answer()(err_nice(TEST_ERROR, "Rejected"));
    await second;
    //The first write is still running, so the last value written successfully is the default
    expect(parsed.setpoint.ok()).toBe(20);
    answer_first(ok(undefined));
    await first;
    //Only the last write settles what is read
    expect(parsed.setpoint.ok()).toBe(20);
  });

  it("goes back to the default after every write with reset, whether it succeeded or failed", async () => {
    const { send, answer } = held_write();
    const parsed = make_fetch_parser(
      () => "/x",
      60_000,
      { password: ["?", "swo", () => "", { reset: true }] },
      { write: send },
    );
    const writing = parsed.password.write("secret");
    expect(parsed.password.ok()).toBe("secret");
    await sleep(0);
    answer()(ok(undefined));
    await writing;
    expect(parsed.password.ok()).toBe("");
    const failing = parsed.password.write("wrong");
    await sleep(0);
    answer()(err_nice(TEST_ERROR, "Rejected"));
    await failing;
    expect(parsed.password.ok()).toBe("");
  });

  it("writes inside the items of a dynamic array, found by key and shifted by array_start", async () => {
    const send = vi.fn<FetchWrite>(async () => ok(undefined));
    const parsed = make_fetch_parser(
      () => "/x",
      60_000,
      { pumps: [0, { id: "n", start: "bwo" }, { key: "id" }] },
      {
        write: send,
        array_start: 1,
        fetch: async () => ok(JSON.stringify({ pumps: [{ id: 7 }, { id: 9 }] })),
      },
    );
    //The type of pumps depends on O, which is not known in here, so its members are not either
    await (parsed.pumps as State<unknown>).read();
    expect((await parsed.pumps[1]!.start.write(true)).ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ pumps: { 2: { start: true } } });
  });

  it("is merged with other writes by write_debounce", async () => {
    vi.useFakeTimers();
    try {
      const send = vi.fn<FetchWrite>(async () => ok(undefined));
      const parsed = make_fetch_parser(
        () => "/x",
        60_000,
        { name: "sw", reboot: "bwo" },
        { write: send, write_debounce: 50 },
      );
      void parsed.name.write("A");
      void parsed.reboot.write(true);
      await vi.advanceTimersByTimeAsync(50);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({ name: "A", reboot: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("needs the write option", () => {
    expect(() => make_fetch_parser(() => "/x", 1_000, { reboot: "bwo" })).toThrow(
      "A write function is required",
    );
  });

  it("throws when the member is not a member of an object, or is inside a write all array", () => {
    const write = async () => ok(undefined);
    const made = (schema: FetchSchema) => () => make_fetch_parser(() => "/x", 1_000, schema, { write });
    expect(made({ point: ["n", "nwo"] })).toThrow("write only");
    expect(made({ list: [0, "nwo"] })).toThrow("write only");
    expect(made({ items: [0, { cmd: "nwo" }, { write: "all" }] })).toThrow("write only");
    expect(made({ outer: [0, { inner: { cmd: "nwo" } }, { write: "all" }] })).toThrow("write only");
    //An optional prefix means nothing for a member that is never received
    expect(made({ cmd: "?nwo" as "nwo" })).toThrow("write only");
  });
});

describe("make_fetch_parser write only containers", () => {
  const MAX_ACCESS_LEVELS = 3;
  const MAX_ACCESS = 2;
  const SCHEMA = {
    access: [MAX_ACCESS_LEVELS, [MAX_ACCESS, "bw"]],
    passcode: [MAX_ACCESS_LEVELS, "swo"],
    save: ["?", "bwo", () => false, { reset: true }],
  } as const satisfies FetchSchema;
  const ACCESS = [
    [true, false],
    [false, false],
    [true, true],
  ];
  /**A parser of the schema whose fetch gives body, and its write mock*/
  const parser_from = <const S extends FetchSchema>(schema: S, body: unknown) => {
    const send = vi.fn<FetchWrite>(async () => ok(undefined));
    const parsed = make_fetch_parser(() => "/x", 60_000, schema, {
      write: send,
      fetch: async () => ok(JSON.stringify(body)),
    });
    return { parsed, send };
  };

  it("makes a parser of a fixed array of write only items, the server does not send it", async () => {
    const { parsed, send } = parser_from(SCHEMA, { access: ACCESS });
    expect(await parsed[FETCH_PARSE].read()).toEqual(ok({ access: ACCESS }));
    expect((await parsed.passcode[2][FETCH_PARSE].write("1234")).ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ passcode: { 2: "1234" } });
    expect((await parsed.access[1][0][FETCH_PARSE].write(true)).ok).toBe(true);
    expect(send).toHaveBeenLastCalledWith({ access: { 1: { 0: true } } });
  });

  it("types the items of a write only fixed array, with no state of the whole array", () => {
    const { parsed } = parser_from(SCHEMA, {});
    expectTypeOf<Parameters<(typeof parsed.passcode)[0][typeof FETCH_PARSE]["write"]>[0]>().toEqualTypeOf<string>();
    expectTypeOf(parsed.passcode[0][FETCH_PARSE].ok()).toEqualTypeOf<undefined>();
    expectTypeOf<typeof FETCH_PARSE extends keyof typeof parsed.passcode ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<StateRV<(typeof parsed)[typeof FETCH_PARSE]>>().toEqualTypeOf<{
      access: [[boolean, boolean], [boolean, boolean], [boolean, boolean]];
    }>();
    expect(FETCH_PARSE in parsed.passcode).toBe(false);
  });

  it("reads the default, then goes back to it after a write with reset", async () => {
    const { parsed, send } = parser_from(SCHEMA, {});
    expect(parsed.save.ok()).toBe(false);
    expectTypeOf(parsed.save.ok()).toEqualTypeOf<boolean>();
    expectTypeOf<Parameters<typeof parsed.save.write>[0]>().toEqualTypeOf<boolean>();
    expect((await parsed.save.write(true)).ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ save: true });
    expect(parsed.save.ok()).toBe(false);
  });

  it("leaves out an object, a record and a tuple of only write only members", async () => {
    const { parsed, send } = parser_from(
      {
        id: "n",
        settings: { reboot: "bwo", pin: "swo" },
        users: ["{}", { password: "swo" }],
        point: ["nwo", "nwo"],
      },
      { id: 1 },
    );
    expect(await parsed[FETCH_PARSE].read()).toEqual(ok({ id: 1 }));
    expectTypeOf<StateRV<(typeof parsed)[typeof FETCH_PARSE]>>().toEqualTypeOf<{ id: number }>();
    await parsed.settings.reboot.write(true);
    expect(send).toHaveBeenLastCalledWith({ settings: { reboot: true } });
    await parsed.users["anna"]!.password.write("secret");
    expect(send).toHaveBeenLastCalledWith({ users: { anna: { password: "secret" } } });
    await parsed.point[1].write(4);
    expect(send).toHaveBeenLastCalledWith({ point: { 1: 4 } });
  });

  it("still throws for a write only member mixed into a list that is received", () => {
    const write = async () => ok(undefined);
    const made = (schema: FetchSchema) => () => make_fetch_parser(() => "/x", 1_000, schema, { write });
    expect(made({ point: ["n", "nwo"] })).toThrow("write only");
    expect(made({ fixed: [2, ["n", "nwo"]] })).toThrow("write only");
    expect(made({ list: [0, "nwo"] })).toThrow("write only");
    expect(made({ items: [0, { cmd: [2, "nwo"] }, { write: "all" }] })).toThrow("write only");
  });
});

describe("make_fetch_parser defaults", () => {
  const write = async () => ok(undefined);

  it("refuses a default of another type than its type string, also with satisfies", () => {
    // @ts-expect-error false is not a string
    const write_only = { new: ["?", "swo", () => false, { reset: true }] } as const satisfies FetchSchema;
    // @ts-expect-error false is not a string
    const read = { name: ["?", "s", () => false] } as const satisfies FetchSchema;
    // @ts-expect-error a string is not a number
    const writable = { speed: ["?", "nw", () => "fast"] } as const satisfies FetchSchema;
    expect([write_only, read, writable]).toHaveLength(3);
  });

  it("accepts defaults of the type of their spec", () => {
    const schema = {
      name: ["?", "s", () => "none"],
      speed: ["?", "nw", () => 0],
      mode: ["?", "nsl", () => null],
      save: ["?", "bwo", () => false, { reset: true }],
      pin: ["?", "swo", () => ""],
      settings: ["?", { eco: "b", level: "n" }, () => ({ eco: false, level: 1 })],
      tags: ["?", [0, "s"], () => []],
    } as const satisfies FetchSchema;
    expect(() => make_fetch_parser(() => "/x", 1_000, schema, { write })).not.toThrow();
  });

  it("refuses a default of a container that does not match it, with the path in the error", () => {
    const compile_only = () => {
      make_fetch_parser(
        () => "/x",
        1_000,
        // @ts-expect-error level is a number
        { device: { settings: ["?", { eco: "b", level: "n" }, () => ({ eco: false, level: "high" })] } },
      );
      make_fetch_parser(
        () => "/x",
        1_000,
        // @ts-expect-error the items are strings
        { tags: ["?", [0, "s"], () => [1, 2]] },
      );
    };
    expect(compile_only).toBeTypeOf("function");
    type Errors = Parameters<
      typeof make_fetch_parser<{ readonly device: { readonly settings: readonly ["?", { readonly level: "n" }, () => { level: string }] } }>
    >[2];
    expectTypeOf<Errors>().toHaveProperty("Wrong default");
    expectTypeOf<Errors["Wrong default"]>().toEqualTypeOf<"device.settings: the default gives a value the spec does not allow">();
  });

  it("throws for a write only default of another type, as nothing parses it", () => {
    const made = (schema: unknown) => () =>
      make_fetch_parser(() => "/x", 1_000, schema as FetchSchema, { write });
    expect(made({ new: ["?", "swo", () => false, { reset: true }] })).toThrow("default");
    expect(made({ count: ["?", "nwo", () => "1"] })).toThrow("default");
    expect(made({ mode: ["?", "nlwo", () => null] })).not.toThrow();
  });
});
