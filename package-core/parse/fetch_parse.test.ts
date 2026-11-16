import { sleep } from "#common";
import { err, ok, type Result } from "#result";
import state, {
  type StateArrayReadTypes,
  type StateREA,
  type StateREAW,
  type StateResult,
} from "#state";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  FETCH_PARSE,
  fetch_result,
  make_fetch_parser,
  type FetchArrayOptions,
  type FetchFunction,
  type FetchSchema,
} from "./fetch_parse";

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

  it("resolves a one-shot read with a fetch error when the global fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const parsed = make_fetch_parser(() => "/user", 1_000, { name: "s" });

    const result = await parsed.name;

    expect(!result.ok && result.error).toBe("Fetch failed: offline");
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

    const result = await parsed.name;

    expect(!result.ok && result.error).toBe("Fetch failed: HTTP 500");
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

    const result = await parsed.name;

    expect(!result.ok && result.error).toBe("Unexpected error in request");
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

    const result = await user.name;

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
      fetch: async () => err("Timed out"),
    });

    const result = await user.name;

    expect(!result.ok && result.error).toBe("Timed out");
    expect(console_error).not.toHaveBeenCalled();
    console_error.mockRestore();
  });

  it("logs a throwing custom fetch and resolves a one-shot read with an error", async () => {
    const thrown = new TypeError("Cannot read properties of undefined (reading 'url')");
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "s" }, {
      fetch: () => Promise.reject(thrown),
    });

    const result = await user.name;

    expect(!result.ok && result.error).toBe("Unexpected error in fetch");
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

      const result = await user.name;

      expect(!result.ok && result.error).toBe("Unexpected error in fetch");
      expect(console_error.mock.calls[0]?.[0]).toContain(message);
      console_error.mockRestore();
    },
  );

  it("logs a custom fetch that does not return a result", async () => {
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "s" }, {
      fetch: async () => '{"name":"Ada"}' as unknown as Result<string, string>,
    });

    const result = await user.name;

    expect(!result.ok && result.error).toBe("Unexpected error in fetch");
    expect(console_error.mock.calls[0]?.[0]).toContain("must return a Result");
    console_error.mockRestore();
  });

  it("logs a write that does not return a result", async () => {
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "sw" }, {
      write: async () => undefined as unknown as Result<void, string>,
    });

    const result = await user.name.write("Ada");

    expect(!result.ok && result.error).toBe("Unexpected error in write");
    expect(console_error.mock.calls[0]?.[0]).toContain("must return a Result");
    console_error.mockRestore();
  });

  it("gives the error of write as the write result without logging", async () => {
    const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = make_fetch_parser(() => "/user", 1_000, { name: "sw" }, {
      write: async () => err("Rejected by server"),
    });

    const result = await user.name.write("Ada");

    expect(!result.ok && result.error).toBe("Rejected by server");
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

    expect(!result.ok && result.error).toBe("Unexpected error in write");
    expect(console_error).toHaveBeenCalledWith(expect.anything(), thrown);
    console_error.mockRestore();
  });

  it("gives network failures of fetch_result as an error result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await fetch_result("/user", {});

    expect(!result.ok && result.error).toBe("Fetch failed: Failed to fetch");
    vi.unstubAllGlobals();
  });

  it("gives the body text from fetch_result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"name":"Ada"}')));

    const result = await fetch_result("/user", {});

    expect(result.ok && result.value).toBe('{"name":"Ada"}');
    vi.unstubAllGlobals();
  });

  it("gives a failed http status from fetch_result as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    const result = await fetch_result("/user", {});

    expect(!result.ok && result.error).toBe("Fetch failed: HTTP 404");
    vi.unstubAllGlobals();
  });

  it("gives a body that fails to load in fetch_result as an error", async () => {
    const response = new Response("{}");
    vi.spyOn(response, "text").mockRejectedValue(new TypeError("connection reset"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetch_result("/user", {});

    expect(!result.ok && result.error).toBe("Fetch failed: connection reset");
    vi.unstubAllGlobals();
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

    expect(parsed.test.then.bind(parsed.test)).toBeTypeOf("function");
    expect(parsed.obj.test.then.bind(parsed.obj.test)).toBeTypeOf("function");
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
    const dynamic_value = await parsed.dynamic;

    expect(fixed_item).toBeDefined();
    expect(dynamic).toBeDefined();
    expect(dynamic_value.ok).toBe(true);
    if (dynamic_value.ok) {
      expect(dynamic_value.value[0]).toBeDefined();
    }
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
    const record_value = await record;
    expect(record_value.ok && record_value.value).toEqual({ alice: 1, bob: 2 });
    const alice_value = await alice;
    expect(alice_value.ok && alice_value.value).toBe(1);
    const name_value = await name;
    expect(name_value.ok && name_value.value).toBe("A");
    const missing = await parsed.scores.carol!;
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
    const flag_value = await flag;
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
    await parsed.pumps;
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
      const received = await parsed.pumps[1]!.speed;
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
      expect(!result.ok && result.error).toContain("no longer exists");
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
      const received = await parsed.pumps[0]!.name;
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
      await parsed.plant.lines;
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
    const name = await item.name;
    return name.ok ? name.value : "error: " + name.error;
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
      expect(!result.ok && result.error).toContain("no longer exists");
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
  const value_of = async (s: PromiseLike<StateResult<unknown>>) => {
    const r = await s;
    return r.ok ? r.value : "error: " + r.error;
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
