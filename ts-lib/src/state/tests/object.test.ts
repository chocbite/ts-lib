import { ok } from "#result";
import { describe, expect, it } from "vitest";
import type { StateObjectReadTypes } from "..";
import { state as st } from "..";

//##################################################################################################################################################
//       ____  ____       _ ______ _____ _______  __  __ ______ _______ _    _  ____  _____   _____
//      / __ \|  _ \     | |  ____/ ____|__   __||  \/  |  ____|__   __| |  | |/ __ \|  __ \ / ____|
//     | |  | | |_) |    | | |__ | |      | |    | \  / | |__     | |  | |__| | |  | | |  | | (___
//     | |  | |  _ < _   | |  __|| |      | |    | |\/| |  __|    | |  |  __  | |  | | |  | |\___ \
//     | |__| | |_) | |__| | |___| |____  | |    | |  | | |____   | |  | |  | | |__| | |__| |____) |
//      \____/|____/ \____/|______\\_____||_|    |_|  |_|______|  |_|  |_|  |_|\____/|_____/|_____/
describe("Object Methods on Local State", async () => {
  it("get", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    expect(s.object.get).toEqual({ a: 1, b: 2 });
  });

  it("add", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1 }));
    s.object.add("b", 2);
    expect(s.ok()).toEqual({ a: 1, b: 2 });
  });

  it("add notifies subscribers", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1 }));
    let count = 0;
    s.sub(() => count++);
    s.object.add("b", 2);
    expect(count).to.equal(1);
    expect(s.ok()).toEqual({ a: 1, b: 2 });
  });

  it("add tracks read metadata", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1 }));
    let reads: StateObjectReadTypes<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.object.read(val.value);
    });
    s.object.add("b", 2);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
    expect(reads![0]!.items).toEqual({ b: 2 });
  });

  it("remove", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    s.object.remove("b");
    expect(s.ok()).toEqual({ a: 1 });
  });

  it("remove non-existing key is no-op", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1 }));
    let count = 0;
    s.sub(() => count++);
    s.object.remove("b");
    expect(count).to.equal(0);
    expect(s.ok()).toEqual({ a: 1 });
  });

  it("remove tracks read metadata", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    let reads: StateObjectReadTypes<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.object.read(val.value);
    });
    s.object.remove("b");
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.items).toEqual({ b: 2 });
  });

  it("change", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    s.object.change("b", 3);
    expect(s.ok()).toEqual({ a: 1, b: 3 });
  });

  it("change tracks read metadata", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    let reads: StateObjectReadTypes<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.object.read(val.value);
    });
    s.object.change("b", 3);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("changed");
    expect(reads![0]!.items).toEqual({ b: 3 });
  });

  it("remove notifies subscribers", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    let count = 0;
    s.sub(() => count++);
    s.object.remove("b");
    expect(count).to.equal(1);
    expect(s.ok()).toEqual({ a: 1 });
  });

  it("change notifies subscribers", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    let count = 0;
    s.sub(() => count++);
    s.object.change("b", 3);
    expect(count).to.equal(1);
    expect(s.ok()).toEqual({ a: 1, b: 3 });
  });

  it("chaining", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1 }));
    s.object.add("b", 2).add("c", 3);
    expect(s.ok()).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("chaining remove and change", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2, c: 3 }));
    s.object.remove("c").change("b", 20);
    expect(s.ok()).toEqual({ a: 1, b: 20 });
  });
});

//##################################################################################################################################################
//       ____  ____       _ ______ _____ _______  _    _ ______ _      _____  ______ _____
//      / __ \|  _ \     | |  ____/ ____|__   __|| |  | |  ____| |    |  __ \|  ____|  __ \
//     | |  | | |_) |    | | |__ | |      | |    | |__| | |__  | |    | |__) | |__  | |__) |
//     | |  | |  _ < _   | |  __|| |      | |    |  __  |  __| | |    |  ___/|  __| |  _  /
//     | |__| | |_) | |__| | |___| |____  | |    | |  | | |____| |____| |    | |____| | \ \
//      \____/|____/ \____/|______\\_____||_|    |_|  |_|______|______|_|    |______|_|  \_\
describe("Object Helper", async () => {
  it("help creates helper", async () => {
    const s = st.rosw(
      st.o.help(ok<Record<string, number>>({ a: 1, b: 2 })),
      true,
    );
    const related = s.related().unwrap();
    expect(related).toBeDefined();
  });

  it("helper tracks changes on add", async () => {
    const s = st.rosw(st.o.help(ok<Record<string, number>>({ a: 1 })), true);
    expect(s.ok()).toEqual({ a: 1 });
    s.object.add("b", 2);
    expect(s.ok()).toEqual({ a: 1, b: 2 });
  });

  it("helper tracks changes on remove", async () => {
    const s = st.rosw(
      st.o.help(ok<Record<string, number>>({ a: 1, b: 2 })),
      true,
    );
    expect(s.ok()).toEqual({ a: 1, b: 2 });
    s.object.remove("b");
    expect(s.ok()).toEqual({ a: 1 });
  });
});

//##################################################################################################################################################
//     __          _______  _____ _______ ______     ___   _____  _____  _  __     __
//     \ \        / /  __ \|_   _|__   __|  ____|   / / | |  __ \|  __ \| | \ \   / /
//      \ \  /\  / /| |__) | | |    | |  | |__     / /| | | |__) | |__) | |  \ \_/ /
//       \ \/  \/ / |  _  /  | |    | |  |  __|   / / | | |  ___/|  ___/| |   \   /
//        \  /\  /  | | \ \ _| |_   | |  | |____ / /  | | | |    | |    | |____| |
//         \/  \/   |_|  \_\_____|  |_|  |______/_/   |_| |_|    |_|    |______|_|
describe("Object Write / Apply", async () => {
  it("write.add creates write descriptor", async () => {
    const w = st.o.write.add<number>({ x: 10 });
    expect(st.o.is_write(w)).to.equal(true);
  });

  it("write.remove creates write descriptor", async () => {
    const w = st.o.write.remove<number>("x");
    expect(st.o.is_write(w)).to.equal(true);
  });

  it("write.change creates write descriptor", async () => {
    const w = st.o.write.change<number>({ x: 10 });
    expect(st.o.is_write(w)).to.equal(true);
  });

  it("write.fresh creates write descriptor", async () => {
    const w = st.o.write.fresh<number>({ x: 10, y: 20 });
    expect(st.o.is_write(w)).to.equal(true);
  });

  it("write_apply add", async () => {
    const [result, reads] = st.o.write_apply(st.o.write.add<number>({ b: 2 }), {
      a: 1,
    });
    expect(result).toEqual({ a: 1, b: 2 });
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
  });

  it("write_apply remove", async () => {
    const [result, reads] = st.o.write_apply(st.o.write.remove<number>("b"), {
      a: 1,
      b: 2,
    });
    expect(result).toEqual({ a: 1 });
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
  });

  it("write_apply change", async () => {
    const [result, reads] = st.o.write_apply(
      st.o.write.change<number>({ b: 3 }),
      { a: 1, b: 2 },
    );
    expect(result).toEqual({ a: 1, b: 3 });
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("changed");
  });

  it("write_apply fresh", async () => {
    const [result, reads] = st.o.write_apply(
      st.o.write.fresh<number>({ x: 10 }),
      { a: 1, b: 2 },
    );
    expect(result).toEqual({ x: 10 });
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("fresh");
  });
});

//##################################################################################################################################################
//      _____  ______          _____       ___   _____  _____  _  __     __
//     |  __ \|  ____|   /\   |  __ \     / / | |  __ \|  __ \| | \ \   / /
//     | |__) | |__     /  \  | |  | |   / /| | | |__) | |__) | |  \ \_/ /
//     |  _  /|  __|   / /\ \ | |  | |  / / | | |  ___/|  ___/| |   \   /
//     | | \ \| |____ / ____ \| |__| | / /  | | | |    | |    | |____| |
//     |_|  \_\______/_/    \_\_____/ /_/   |_| |_|    |_|    |______|_|
describe("Object Read / Apply", async () => {
  it("read_apply with added", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1 }));
    let applied: Record<PropertyKey, number> = {};
    s.sub((val) => {
      if (val.ok) applied = st.o.read_apply(val.value, applied);
    });
    s.object.add("b", 2);
    expect(applied).toEqual({ b: 2 });
  });

  it("read_apply with removed", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    let applied: Record<PropertyKey, number> = { a: 1, b: 2 };
    s.sub((val) => {
      if (val.ok) applied = st.o.read_apply(val.value, applied);
    });
    s.object.remove("b");
    expect(applied).toEqual({ a: 1 });
  });

  it("read_apply with changed", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1, b: 2 }));
    let applied: Record<PropertyKey, number> = { a: 1, b: 2 };
    s.sub((val) => {
      if (val.ok) applied = st.o.read_apply(val.value, applied);
    });
    s.object.change("b", 3);
    expect(applied).toEqual({ a: 1, b: 3 });
  });

  it("read_apply with transform", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1 }));
    let applied: Record<PropertyKey, string> = {};
    s.sub((val) => {
      if (val.ok)
        applied = st.o.read_apply(val.value, applied, (n) => String(n));
    });
    s.object.add("b", 2);
    expect(applied).toEqual({ b: "2" });
  });

  it("read_apply fresh without metadata returns object", async () => {
    const obj: Record<string, number> = { a: 1, b: 2 };
    const result = st.o.read_apply(obj, {});
    expect(result).toBe(obj);
  });

  it("read_apply fresh with transform without metadata", async () => {
    const obj: Record<string, number> = { a: 1, b: 2 };
    const result = st.o.read_apply(obj, {}, (n) => String(n));
    expect(result).toEqual({ a: "1", b: "2" });
  });

  it("read returns fresh for plain object without metadata", async () => {
    const reads = st.o.read({ a: 1, b: 2 });
    expect(reads.length).to.equal(1);
    expect(reads[0]!.type).to.equal("fresh");
    expect(reads[0]!.items).toEqual({ a: 1, b: 2 });
  });

  it("is_read returns true for object with metadata", async () => {
    const s = st.rosw(ok<Record<string, number>>({ a: 1 }));
    let has_read = false;
    s.sub((val) => {
      if (val.ok) has_read = st.o.is_read(val.value);
    });
    s.object.add("b", 2);
    expect(has_read).to.equal(true);
  });

  it("is_read returns false for plain object", async () => {
    expect(st.o.is_read({ a: 1 })).to.equal(false);
  });

  it("is_related returns true for related helper", async () => {
    const s = st.rosw(st.o.help(ok<Record<string, number>>({ a: 1 })), true);
    expect(st.o.is_related(s.related().unwrap())).to.equal(true);
  });

  it("is_related returns false for non-related", async () => {
    expect(st.o.is_related(null)).to.equal(false);
    expect(st.o.is_related({})).to.equal(false);
  });

  it("is_helper returns true for helper", async () => {
    const s = st.rosw(st.o.help(ok<Record<string, number>>({ a: 1 })), true);
    expect(st.o.is_helper(s.related().unwrap())).to.equal(true);
  });

  it("is_helper returns false for non-helper", async () => {
    expect(st.o.is_helper(null)).to.equal(false);
    expect(st.o.is_helper({})).to.equal(false);
  });

  it("write_apply remove non-existing key returns empty removed items", async () => {
    const [result, reads] = st.o.write_apply(st.o.write.remove<number>("z"), {
      a: 1,
      b: 2,
    });
    expect(result).toEqual({ a: 1, b: 2 });
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.items).toEqual({});
  });
});
