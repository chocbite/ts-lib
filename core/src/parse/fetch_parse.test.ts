import state, {
  type StateREA,
  type StateREAW,
  type StateResult,
} from "#state";
import { describe, expect, it, vi } from "vitest";
import { FETCH_PARSE, make_fetch_parser } from "./fetch_parse";

describe("make_fetch_parser", () => {
  it("maps read-only and writable leaves to their state types", () => {
    const parsed = make_fetch_parser(
      () => "/user",
      1_000,
      { id: "n", name: "sw" },
      async () => {},
    );

    const read_only: StateREA<number> = parsed.id;
    const writable: StateREAW<string> = parsed.name;
    expect(read_only).toBeDefined();
    expect(writable).toBeDefined();
    const root: StateREA<{ id: number; name: string }> = parsed[FETCH_PARSE];
    expect(root).toBeDefined();
  });

  it("resolves a one-shot read with an error when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const parsed = make_fetch_parser(() => "/user", 1_000, { name: "s" });

    const result = await parsed.name;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("offline");
    vi.unstubAllGlobals();
  });

  it("resolves a one-shot read with an error on a failed http status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 500 })),
    );
    const parsed = make_fetch_parser(() => "/user", 1_000, { name: "s" });

    const result = await parsed.name;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Fetch failed: HTTP 500");
    vi.unstubAllGlobals();
  });

  it("resolves a one-shot read with an error when the request factory fails", async () => {
    const parsed = make_fetch_parser(
      () => {
        throw new Error("no url");
      },
      1_000,
      { name: "s" },
    );

    const result = await parsed.name;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("no url");
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
    const send = vi.fn().mockResolvedValue(undefined);
    const user = make_fetch_parser(
      () => "/user",
      1_000,
      { settings: { newsletter: "bw" } },
      send,
    );

    const result = await user.settings.newsletter.write(true);

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ settings: { newsletter: true } });
  });

  it("uses an array write encoder for indexed writable values", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const user = make_fetch_parser(
      () => "/user",
      1_000,
      {
        aliases: [0, "sw", (alias: string) => ({ num: 1, alias })] as const,
      },
      send,
    );

    const result = await user.aliases[5]!.write("joe");

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ aliases: { num: 1, alias: "joe" } });
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
    const send = vi.fn().mockResolvedValue(undefined);
    const parsed = make_fetch_parser(
      () => "/scores",
      1_000,
      { scores: ["{}", "nw"] },
      send,
    );

    const result = await parsed.scores.alice!.write(5);

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ scores: { alice: 5 } });
  });
});
