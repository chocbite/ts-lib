import { ok } from "#result";
import { describe, expect, it } from "vitest";
import { state as st } from "..";

type ReadItem<T> = {
  type: string;
  index?: number;
  from_index?: number;
  to_index?: number;
  items?: readonly T[];
};

//##################################################################################################################################################
//                _____  _____        __     __    __  __ ______ _______ _    _  ____  _____   _____
//          /\   |  __ \|  __ \     /\\ \   / /   |  \/  |  ____|__   __| |  | |/ __ \|  __ \ / ____|
//         /  \  | |__) | |__) |   /  \\ \_/ /    | \  / | |__     | |  | |__| | |  | | |  | | (___
//        / /\ \ |  _  /|  _  /   / /\ \\   /     | |\/| |  __|    | |  |  __  | |  | | |  | |\___ \
//       / ____ \| | \ \| | \ \  / ____ \| |      | |  | | |____   | |  | |  | | |__| | |__| |____) |
//      /_/    \_\_|  \_\_|  \_\/_/    \_\_|      |_|  |_|______|  |_|  |_|  |_|\____/|_____/|_____/
describe("Array Methods on Local State", async () => {
  it("get", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    expect(s.array.get).toEqual([1, 2, 3]);
  });

  it("push", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    const len = s.array.push(3);
    expect(len).to.equal(3);
    expect(s.ok()).toEqual([1, 2, 3]);
  });

  it("push multiple items", async () => {
    const s = st.rosw(ok<number[]>([1]));
    const len = s.array.push(2, 3, 4);
    expect(len).to.equal(4);
    expect(s.ok()).toEqual([1, 2, 3, 4]);
  });

  it("push no items returns current length", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    const len = s.array.push();
    expect(len).to.equal(2);
    expect(s.ok()).toEqual([1, 2]);
  });

  it("push notifies subscribers", async () => {
    const s = st.rosw(ok<number[]>([1]));
    let count = 0;
    s.sub(() => count++);
    s.array.push(2);
    expect(count).to.equal(1);
    expect(s.ok()).toEqual([1, 2]);
  });

  it("push tracks read metadata", async () => {
    const s = st.rosw(ok<number[]>([1]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.push(2, 3);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
    expect(reads![0]!.index).to.equal(1);
    expect(reads![0]!.items).toEqual([2, 3]);
  });

  it("unshift", async () => {
    const s = st.rosw(ok<number[]>([2, 3]));
    const len = s.array.unshift(1);
    expect(len).to.equal(3);
    expect(s.ok()).toEqual([1, 2, 3]);
  });

  it("unshift multiple items", async () => {
    const s = st.rosw(ok<number[]>([3]));
    const len = s.array.unshift(1, 2);
    expect(len).to.equal(3);
    expect(s.ok()).toEqual([1, 2, 3]);
  });

  it("unshift no items returns current length", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    const len = s.array.unshift();
    expect(len).to.equal(2);
    expect(s.ok()).toEqual([1, 2]);
  });

  it("unshift notifies subscribers", async () => {
    const s = st.rosw(ok<number[]>([2]));
    let count = 0;
    s.sub(() => count++);
    s.array.unshift(1);
    expect(count).to.equal(1);
  });

  it("unshift tracks read metadata", async () => {
    const s = st.rosw(ok<number[]>([2]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.unshift(0, 1);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
    expect(reads![0]!.index).to.equal(0);
    expect(reads![0]!.items).toEqual([0, 1]);
  });

  it("pop", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    const popped = s.array.pop();
    expect(popped).to.equal(3);
    expect(s.ok()).toEqual([1, 2]);
  });

  it("pop empty array returns undefined", async () => {
    const s = st.rosw(ok<number[]>([]));
    const popped = s.array.pop();
    expect(popped).to.equal(undefined);
  });

  it("pop notifies subscribers", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    let count = 0;
    s.sub(() => count++);
    s.array.pop();
    expect(count).to.equal(1);
  });

  it("pop tracks read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.pop();
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.index).to.equal(2);
    expect(reads![0]!.items).toEqual([3]);
  });

  it("shift", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    const shifted = s.array.shift();
    expect(shifted).to.equal(1);
    expect(s.ok()).toEqual([2, 3]);
  });

  it("shift empty array returns undefined", async () => {
    const s = st.rosw(ok<number[]>([]));
    const shifted = s.array.shift();
    expect(shifted).to.equal(undefined);
  });

  it("shift notifies subscribers", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    let count = 0;
    s.sub(() => count++);
    s.array.shift();
    expect(count).to.equal(1);
  });

  it("shift tracks read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.shift();
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.index).to.equal(0);
    expect(reads![0]!.items).toEqual([1]);
  });

  it("delete", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 2]));
    s.array.delete(2);
    expect(s.ok()).toEqual([1, 3]);
  });

  it("delete tracks read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 2]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.delete(2);
    expect(reads).toBeDefined();
    expect(reads!.length).to.equal(2);
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.items).toEqual([2]);
    expect(reads![1]!.type).to.equal("removed");
    expect(reads![1]!.items).toEqual([2]);
  });

  it("delete notifies subscribers", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let count = 0;
    s.sub(() => count++);
    s.array.delete(2);
    expect(count).to.equal(1);
  });

  it("change", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    s.array.change(1, 20);
    expect(s.ok()).toEqual([1, 20, 3]);
  });

  it("change multiple items", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    s.array.change(1, 20, 30);
    expect(s.ok()).toEqual([1, 20, 30, 4]);
  });

  it("change no items is no-op", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let count = 0;
    s.sub(() => count++);
    s.array.change(0);
    expect(count).to.equal(0);
    expect(s.ok()).toEqual([1, 2, 3]);
  });

  it("change with index beyond array are ok", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let count = 0;
    s.sub(() => count++);
    s.array.change(4, 99);
    expect(count).to.equal(1);
    expect(s.ok()).toEqual([1, 2, 3, undefined, 99]);
  });

  it("change extends array when necessary", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let count = 0;
    s.sub(() => count++);
    s.array.change(2, 30, 40);
    expect(count).to.equal(1);
    expect(s.ok()).toEqual([1, 2, 30, 40]);
  });

  it("change tracks read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.change(1, 20);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("changed");
    expect(reads![0]!.index).to.equal(1);
    expect(reads![0]!.items).toEqual([20]);
  });

  it("change tracks extended elements as added metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.change(2, 30, 40);
    expect(reads).toHaveLength(2);
    expect(reads![0]!).toMatchObject({
      type: "changed",
      index: 2,
      items: [30],
    });
    expect(reads![1]!).toMatchObject({
      type: "added",
      index: 3,
      items: [40],
    });
  });

  it("splice remove and insert", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    const removed = s.array.splice(1, 2, 20, 30);
    expect(removed).toEqual([2, 3]);
    expect(s.ok()).toEqual([1, 20, 30, 4]);
  });

  it("splice insert only", async () => {
    const s = st.rosw(ok<number[]>([1, 4]));
    const removed = s.array.splice(1, 0, 2, 3);
    expect(removed).toEqual([]);
    expect(s.ok()).toEqual([1, 2, 3, 4]);
  });

  it("splice remove only", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    const removed = s.array.splice(1, 2);
    expect(removed).toEqual([2, 3]);
    expect(s.ok()).toEqual([1, 4]);
  });

  it("splice tracks read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.splice(1, 1, 20, 30);
    expect(reads).toBeDefined();
    expect(reads!.length).to.equal(2);
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.items).toEqual([2]);
    expect(reads![1]!.type).to.equal("added");
    expect(reads![1]!.items).toEqual([20, 30]);
  });

  it("chaining delete and change", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    s.array.delete(2).change(0, 10);
    expect(s.ok()).toEqual([10, 3]);
  });

  it("move single item forward", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    s.array.move(0, 2);
    expect(s.ok()).toEqual([2, 3, 1, 4]);
  });

  it("move single item backward", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    s.array.move(3, 0);
    expect(s.ok()).toEqual([4, 1, 2, 3]);
  });

  it("move multiple items forward", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4, 5]));
    s.array.move(0, 3, 2);
    expect(s.ok()).toEqual([3, 4, 5, 1, 2]);
  });

  it("move multiple items backward", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4, 5]));
    s.array.move(3, 0, 2);
    expect(s.ok()).toEqual([4, 5, 1, 2, 3]);
  });

  it("move no-op with zero count", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    s.array.move(0, 2, 0);
    expect(s.ok()).toEqual([1, 2, 3]);
  });

  it("move no-op with negative from_index", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    s.array.move(-1, 0);
    expect(s.ok()).toEqual([1, 2, 3]);
  });

  it("move no-op with from_index beyond array", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    s.array.move(5, 0);
    expect(s.ok()).toEqual([1, 2, 3]);
  });

  it("move clamps count to available items", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    s.array.move(1, 0, 10);
    expect(s.ok()).toEqual([2, 3, 1]);
  });

  it("move notifies subscribers", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let count = 0;
    s.sub(() => count++);
    s.array.move(0, 2);
    expect(count).to.equal(1);
  });

  it("move tracks read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.array.read(val.value);
    });
    s.array.move(0, 2, 2);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("moved");
    expect(reads![0]!.from_index).to.equal(0);
    expect(reads![0]!.to_index).to.equal(2);
    expect(reads![0]!.items).toEqual([1, 2]);
  });

  it("move is chainable", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    s.array.move(0, 3).move(0, 2);
    expect(s.ok()).toEqual([3, 4, 2, 1]);
  });
});

//##################################################################################################################################################
//                _____  _____        __     __   _    _ ______ _      _____  ______ _____
//          /\   |  __ \|  __ \     /\\ \   / /  | |  | |  ____| |    |  __ \|  ____|  __ \
//         /  \  | |__) | |__) |   /  \\ \_/ /   | |__| | |__  | |    | |__) | |__  | |__) |
//        / /\ \ |  _  /|  _  /   / /\ \\   /    |  __  |  __| | |    |  ___/|  __| |  _  /
//       / ____ \| | \ \| | \ \  / ____ \| |     | |  | | |____| |____| |    | |____| | \ \
//      /_/    \_\_|  \_\_|  \_\/_/    \_\_|     |_|  |_|______|______|_|    |______|_|  \_\
describe("Array Helper", async () => {
  it("help creates helper", async () => {
    const s = st.rosw(st.a.help(ok<number[]>([1, 2, 3])), true);
    const related = s.related().unwrap();
    expect(related).toBeDefined();
  });

  it("helper tracks length on push", async () => {
    const s = st.rosw(st.a.help(ok<number[]>([1, 2])), true);
    expect(s.related().unwrap().length.ok()).to.equal(2);
    s.array.push(3);
    expect(s.related().unwrap().length.ok()).to.equal(3);
  });

  it("helper tracks length on pop", async () => {
    const s = st.rosw(st.a.help(ok<number[]>([1, 2, 3])), true);
    expect(s.related().unwrap().length.ok()).to.equal(3);
    s.array.pop();
    expect(s.related().unwrap().length.ok()).to.equal(2);
  });

  it("helper tracks length on shift", async () => {
    const s = st.rosw(st.a.help(ok<number[]>([1, 2, 3])), true);
    expect(s.related().unwrap().length.ok()).to.equal(3);
    s.array.shift();
    expect(s.related().unwrap().length.ok()).to.equal(2);
  });

  it("helper tracks length on splice", async () => {
    const s = st.rosw(st.a.help(ok<number[]>([1, 2, 3])), true);
    expect(s.related().unwrap().length.ok()).to.equal(3);
    s.array.splice(0, 1, 10, 20);
    expect(s.related().unwrap().length.ok()).to.equal(4);
  });

  it("is_related returns true for related helper", async () => {
    const s = st.rosw(st.a.help(ok<number[]>([1])), true);
    expect(st.a.is_related(s.related().unwrap())).to.equal(true);
  });

  it("is_helper returns true for helper", async () => {
    const s = st.rosw(st.a.help(ok<number[]>([1])), true);
    expect(st.a.is_helper(s.related().unwrap())).to.equal(true);
  });

  it("is_related returns false for non-related", async () => {
    expect(st.a.is_related(null)).to.equal(false);
    expect(st.a.is_related({})).to.equal(false);
  });

  it("is_helper returns false for non-helper", async () => {
    expect(st.a.is_helper(null)).to.equal(false);
    expect(st.a.is_helper({})).to.equal(false);
  });
});

//##################################################################################################################################################
//     __          _______  _____ _______ ______     ___   _____  _____  _  __     __
//     \ \        / /  __ \|_   _|__   __|  ____|   / / | |  __ \|  __ \| | \ \   / /
//      \ \  /\  / /| |__) | | |    | |  | |__     / /| | | |__) | |__) | |  \ \_/ /
//       \ \/  \/ / |  _  /  | |    | |  |  __|   / / | | |  ___/|  ___/| |   \   /
//        \  /\  /  | | \ \ _| |_   | |  | |____ / /  | | | |    | |    | |____| |
//         \/  \/   |_|  \_\_____|  |_|  |______/_/   |_| |_|    |_|    |______|_|
describe("Array Write / Apply", async () => {
  it("write.push creates write descriptor", async () => {
    const w = st.a.write.push(1, 2);
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write.unshift creates write descriptor", async () => {
    const w = st.a.write.unshift(1, 2);
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write.pop creates write descriptor", async () => {
    const w = st.a.write.pop<number>();
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write.shift creates write descriptor", async () => {
    const w = st.a.write.shift<number>();
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write.delete creates write descriptor", async () => {
    const w = st.a.write.delete(2);
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write.change creates write descriptor", async () => {
    const w = st.a.write.change(0, 10);
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write.splice creates write descriptor", async () => {
    const w = st.a.write.splice<number>(0, 1, 10);
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write.move creates write descriptor", async () => {
    const w = st.a.write.move<number>(0, 2, 1);
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write.fresh creates write descriptor", async () => {
    const w = st.a.write.fresh([10, 20]);
    expect(st.a.is_write(w)).to.equal(true);
  });

  it("write_apply push", async () => {
    const [result, reads] = st.a.write_apply(st.a.write.push(3, 4), [1, 2]);
    expect(result).toEqual([1, 2, 3, 4]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
    expect(reads![0]!).toHaveProperty("index", 2);
  });

  it("write_apply unshift", async () => {
    const [result, reads] = st.a.write_apply(st.a.write.unshift(0, 1), [2, 3]);
    expect(result).toEqual([0, 1, 2, 3]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
    expect(reads![0]!).toHaveProperty("index", 0);
  });

  it("write_apply pop", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.pop<number>(),
      [1, 2, 3],
    );
    expect(result).toEqual([1, 2]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!).toHaveProperty("index", 2);
  });

  it("write_apply pop on empty array", async () => {
    const [result, reads] = st.a.write_apply(st.a.write.pop<number>(), []);
    expect(result).toEqual([]);
    expect(reads).to.equal(undefined);
  });

  it("write_apply shift", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.shift<number>(),
      [1, 2, 3],
    );
    expect(result).toEqual([2, 3]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!).toHaveProperty("index", 0);
  });

  it("write_apply shift on empty array", async () => {
    const [result, reads] = st.a.write_apply(st.a.write.shift<number>(), []);
    expect(result).toEqual([]);
    expect(reads).to.equal(undefined);
  });

  it("write_apply delete", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.delete(2),
      [1, 2, 3, 2],
    );
    expect(result).toEqual([1, 3]);
    expect(reads).toBeDefined();
    expect(reads!.length).to.equal(2);
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![1]!.type).to.equal("removed");
  });

  it("write_apply change", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.change(1, 20, 30),
      [1, 2, 3, 4],
    );
    expect(result).toEqual([1, 20, 30, 4]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("changed");
    expect(reads![0]!).toHaveProperty("index", 1);
  });

  it("write_apply change with index beyond array length is no-op", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.change(10, 99),
      [1, 2, 3],
    );
    expect(result).toEqual([1, 2, 3]);
    expect(reads).to.equal(undefined);
  });

  it("write_apply change clamps items extending past array end", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.change(2, 30, 40),
      [1, 2, 3],
    );
    expect(result).toEqual([1, 2, 30]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("changed");
    expect(reads![0]!).toHaveProperty("index", 2);
  });

  it("write_apply splice", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.splice(1, 2, 20, 30),
      [1, 2, 3, 4],
    );
    expect(result).toEqual([1, 20, 30, 4]);
    expect(reads).toBeDefined();
    expect(reads!.length).to.equal(2);
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![1]!.type).to.equal("added");
  });

  it("write_apply move single item forward", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.move(0, 2),
      [1, 2, 3, 4],
    );
    expect(result).toEqual([2, 3, 1, 4]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("moved");
    if (reads![0]!.type === "moved") {
      expect(reads![0]!.from_index).to.equal(0);
      expect(reads![0]!.to_index).to.equal(2);
      expect(reads![0]!.items).toEqual([1]);
    }
  });

  it("write_apply move single item backward", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.move(3, 0),
      [1, 2, 3, 4],
    );
    expect(result).toEqual([4, 1, 2, 3]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("moved");
    if (reads![0]!.type === "moved") {
      expect(reads![0]!.from_index).to.equal(3);
      expect(reads![0]!.to_index).to.equal(0);
      expect(reads![0]!.items).toEqual([4]);
    }
  });

  it("write_apply move multiple items", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.move(0, 3, 2),
      [1, 2, 3, 4, 5],
    );
    expect(result).toEqual([3, 4, 5, 1, 2]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("moved");
    if (reads![0]!.type === "moved") {
      expect(reads![0]!.items).toEqual([1, 2]);
    }
  });

  it("write_apply move with zero count is no-op", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.move(0, 2, 0),
      [1, 2, 3],
    );
    expect(result).toEqual([1, 2, 3]);
    expect(reads).to.equal(undefined);
  });

  it("write_apply move with from_index beyond array is no-op", async () => {
    const [result, reads] = st.a.write_apply(st.a.write.move(10, 0), [1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
    expect(reads).to.equal(undefined);
  });

  it("write_apply move clamps count", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.move(1, 0, 10),
      [1, 2, 3],
    );
    expect(result).toEqual([2, 3, 1]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("moved");
    if (reads![0]!.type === "moved") {
      expect(reads![0]!.items).toEqual([2, 3]);
    }
  });

  it("write_apply fresh", async () => {
    const [result, reads] = st.a.write_apply(
      st.a.write.fresh([10, 20]),
      [1, 2, 3],
    );
    expect(result.length).to.equal(2);
    expect(result[0]!).to.equal(10);
    expect(result[1]!).to.equal(20);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("fresh");
  });

  it("write_apply without existing array defaults to empty", async () => {
    const [result, reads] = st.a.write_apply(st.a.write.push(1, 2));
    expect(result).toEqual([1, 2]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
  });

  // Bug: pop/shift in write_apply check `if (items[0])` which fails for falsy values like 0
  it.fails(
    "write_apply pop with falsy value (0) removes last element",
    async () => {
      const [result, reads] = st.a.write_apply(
        st.a.write.pop<number>(),
        [1, 2, 0],
      );
      expect(result).toEqual([1, 2]);
      expect(reads).toBeDefined();
      expect(reads![0]!.type).to.equal("removed");
    },
  );

  it.fails(
    "write_apply shift with falsy value (0) removes first element",
    async () => {
      const [result, reads] = st.a.write_apply(
        st.a.write.shift<number>(),
        [0, 1, 2],
      );
      expect(result).toEqual([1, 2]);
      expect(reads).toBeDefined();
      expect(reads![0]!.type).to.equal("removed");
    },
  );
});

//##################################################################################################################################################
//     __          _______  _____ _______ ______    _   _  ____    _    _ ______ _      _____  ______ _____
//     \ \        / /  __ \|_   _|__   __|  ____|  | \ | |/ __ \  | |  | |  ____| |    |  __ \|  ____|  __ \
//      \ \  /\  / /| |__) | | |    | |  | |__     |  \| | |  | | | |__| | |__  | |    | |__) | |__  | |__) |
//       \ \/  \/ / |  _  /  | |    | |  |  __|    | . ` | |  | | |  __  |  __| | |    |  ___/|  __| |  _  /
//        \  /\  /  | | \ \ _| |_   | |  | |____   | |\  | |__| | | |  | | |____| |____| |    | |____| | \ \
//         \/  \/   |_|  \_\_____|  |_|  |______|  |_| \_|\____/  |_|  |_|______|______|_|    |______|_|  \_\
describe("Array State Write Without Helper", async () => {
  it("write push updates state", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    await s.write(st.a.write.push(3, 4));
    expect(s.ok()).toEqual([1, 2, 3, 4]);
  });

  it("write push returns ok", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    const result = await s.write(st.a.write.push(3));
    expect(result).toEqual(ok(undefined));
  });

  it("write push notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.push(3));
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
    expect(reads![0]!.index).to.equal(2);
    expect(reads![0]!.items).toEqual([3]);
  });

  it("write unshift updates state", async () => {
    const s = st.rosw(ok<number[]>([2, 3]));
    await s.write(st.a.write.unshift(0, 1));
    expect(s.ok()).toEqual([0, 1, 2, 3]);
  });

  it("write unshift notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([2]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.unshift(0, 1));
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("added");
    expect(reads![0]!.index).to.equal(0);
    expect(reads![0]!.items).toEqual([0, 1]);
  });

  it("write pop updates state", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    await s.write(st.a.write.pop<number>());
    expect(s.ok()).toEqual([1, 2]);
  });

  it("write pop notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.pop<number>());
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.index).to.equal(2);
    expect(reads![0]!.items).toEqual([3]);
  });

  it("write shift updates state", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    await s.write(st.a.write.shift<number>());
    expect(s.ok()).toEqual([2, 3]);
  });

  it("write shift notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.shift<number>());
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.index).to.equal(0);
    expect(reads![0]!.items).toEqual([1]);
  });

  it("write delete updates state", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 2]));
    await s.write(st.a.write.delete(2));
    expect(s.ok()).toEqual([1, 3]);
  });

  it("write delete notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 2]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.delete(2));
    expect(reads).toBeDefined();
    expect(reads!.length).to.equal(2);
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.items).toEqual([2]);
    expect(reads![1]!.type).to.equal("removed");
    expect(reads![1]!.items).toEqual([2]);
  });

  it("write change updates state", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    await s.write(st.a.write.change(1, 20, 30));
    expect(s.ok()).toEqual([1, 20, 30, 4]);
  });

  it("write change notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.change(1, 20));
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("changed");
    expect(reads![0]!.index).to.equal(1);
    expect(reads![0]!.items).toEqual([20]);
  });

  it("write change with index beyond array length is no-op", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    await s.write(st.a.write.change(10, 99));
    expect(s.ok()).toEqual([1, 2, 3]);
  });

  it("write splice updates state", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    await s.write(st.a.write.splice(1, 2, 20, 30));
    expect(s.ok()).toEqual([1, 20, 30, 4]);
  });

  it("write splice notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.splice(1, 1, 20, 30));
    expect(reads).toBeDefined();
    expect(reads!.length).to.equal(2);
    expect(reads![0]!.type).to.equal("removed");
    expect(reads![0]!.items).toEqual([2]);
    expect(reads![1]!.type).to.equal("added");
    expect(reads![1]!.items).toEqual([20, 30]);
  });

  it("write move updates state", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    await s.write(st.a.write.move(0, 2));
    expect(s.ok()).toEqual([2, 3, 1, 4]);
  });

  it("write move notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.move(0, 2, 2));
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("moved");
    expect(reads![0]!.from_index).to.equal(0);
    expect(reads![0]!.to_index).to.equal(2);
    expect(reads![0]!.items).toEqual([1, 2]);
  });

  it("write fresh replaces entire state", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    await s.write(st.a.write.fresh([10, 20]));
    const val = s.ok();
    expect(val.length).to.equal(2);
    expect(val[0]).to.equal(10);
    expect(val[1]).to.equal(20);
  });

  it("write fresh notifies subscribers with read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write(st.a.write.fresh([10, 20]));
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("fresh");
  });

  it("write plain array replaces state without read metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let reads: ReadItem<number>[] | undefined = undefined;
    s.sub((val) => {
      if (val.ok) reads = st.a.read(val.value);
    });
    await s.write([10, 20]);
    expect(s.ok()).toEqual([10, 20]);
    expect(reads).toBeDefined();
    expect(reads![0]!.type).to.equal("fresh");
  });

  it("write sequential operations accumulate correctly", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    await s.write(st.a.write.push(3));
    await s.write(st.a.write.unshift(0));
    await s.write(st.a.write.pop<number>());
    expect(s.ok()).toEqual([0, 1, 2]);
  });

  it("write splice insert only", async () => {
    const s = st.rosw(ok<number[]>([1, 4]));
    await s.write(st.a.write.splice(1, 0, 2, 3));
    expect(s.ok()).toEqual([1, 2, 3, 4]);
  });

  it("write splice remove only", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    await s.write(st.a.write.splice(1, 2));
    expect(s.ok()).toEqual([1, 4]);
  });

  it("write move multiple items", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4, 5]));
    await s.write(st.a.write.move(0, 3, 2));
    expect(s.ok()).toEqual([3, 4, 5, 1, 2]);
  });

  it("write move backward", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    await s.write(st.a.write.move(3, 0));
    expect(s.ok()).toEqual([4, 1, 2, 3]);
  });

  it("write pop on empty state", async () => {
    const s = st.rosw(ok<number[]>([]));
    await s.write(st.a.write.pop<number>());
    expect(s.ok()).toEqual([]);
  });

  it("write shift on empty state", async () => {
    const s = st.rosw(ok<number[]>([]));
    await s.write(st.a.write.shift<number>());
    expect(s.ok()).toEqual([]);
  });
});

//##################################################################################################################################################
//      _____  ______          _____       ___   _____  _____  _  __     __
//     |  __ \|  ____|   /\   |  __ \     / / | |  __ \|  __ \| | \ \   / /
//     | |__) | |__     /  \  | |  | |   / /| | | |__) | |__) | |  \ \_/ /
//     |  _  /|  __|   / /\ \ | |  | |  / / | | |  ___/|  ___/| |   \   /
//     | | \ \| |____ / ____ \| |__| | / /  | | | |    | |    | |____| |
//     |_|  \_\______/_/    \_\_____/ /_/   |_| |_|    |_|    |______|_|
describe("Array Read / Apply", async () => {
  it("read_apply with added", async () => {
    const s = st.rosw(ok<number[]>([1]));
    let applied: number[] = [];
    s.sub((val) => {
      if (val.ok) applied = st.a.read_apply(val.value, applied);
    });
    s.array.push(2, 3);
    expect(applied).toEqual([2, 3]);
  });

  it("read_apply with removed via pop", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let applied: number[] = [1, 2, 3];
    s.sub((val) => {
      if (val.ok) applied = st.a.read_apply(val.value, applied);
    });
    s.array.pop();
    expect(applied).toEqual([1, 2]);
  });

  it("read_apply with removed via shift", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let applied: number[] = [1, 2, 3];
    s.sub((val) => {
      if (val.ok) applied = st.a.read_apply(val.value, applied);
    });
    s.array.shift();
    expect(applied).toEqual([2, 3]);
  });

  it("read_apply with changed", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let applied: number[] = [1, 2, 3];
    s.sub((val) => {
      if (val.ok) applied = st.a.read_apply(val.value, applied);
    });
    s.array.change(1, 20);
    expect(applied).toEqual([1, 20, 3]);
  });

  it("read_apply with moved forward", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    let applied: number[] = [1, 2, 3, 4];
    s.sub((val) => {
      if (val.ok) applied = st.a.read_apply(val.value, applied);
    });
    s.array.move(0, 2, 2);
    expect(applied).toEqual([3, 4, 1, 2]);
  });

  it("read_apply with moved backward", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3, 4]));
    let applied: number[] = [1, 2, 3, 4];
    s.sub((val) => {
      if (val.ok) applied = st.a.read_apply(val.value, applied);
    });
    s.array.move(2, 0, 2);
    expect(applied).toEqual([3, 4, 1, 2]);
  });

  it("read_apply with moved and transform", async () => {
    const s = st.rosw(ok<number[]>([1, 2, 3]));
    let applied: string[] = ["1", "2", "3"];
    s.sub((val) => {
      if (val.ok)
        applied = st.a.read_apply(val.value, applied, (n) => String(n));
    });
    s.array.move(0, 2);
    expect(applied).toEqual(["2", "3", "1"]);
  });

  it("read_apply with transform", async () => {
    const s = st.rosw(ok<number[]>([1]));
    let applied: string[] = [];
    s.sub((val) => {
      if (val.ok)
        applied = st.a.read_apply(val.value, applied, (n) => String(n));
    });
    s.array.push(2);
    expect(applied).toEqual(["2"]);
  });

  it("read_apply fresh without metadata returns array", async () => {
    const arr: number[] = [1, 2, 3];
    const result = st.a.read_apply(arr, []);
    expect(result).toBe(arr);
  });

  it("read_apply fresh with transform without metadata", async () => {
    const arr: number[] = [1, 2, 3];
    const result = st.a.read_apply(arr, [], (n) => String(n));
    expect(result).toEqual(["1", "2", "3"]);
  });

  it("is_read returns true for array with metadata", async () => {
    const s = st.rosw(ok<number[]>([1, 2]));
    let has_read = false;
    s.sub((val) => {
      if (val.ok) has_read = st.a.is_read(val.value);
    });
    s.array.push(3);
    expect(has_read).to.equal(true);
  });

  it("is_read returns false for plain array", async () => {
    expect(st.a.is_read([1, 2, 3])).to.equal(false);
  });

  it("read returns fresh for plain array without metadata", async () => {
    const reads = st.a.read([1, 2, 3]);
    expect(reads.length).to.equal(1);
    expect(reads[0]!.type).to.equal("fresh");
    expect(reads[0]!.items).toEqual([1, 2, 3]);
  });
});
