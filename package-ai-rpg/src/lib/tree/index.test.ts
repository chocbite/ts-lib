import { describe, expect, it } from "vitest";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { Tree, type TreeNode } from "./index";

interface Node extends TreeNode {
  name: string;
}
const node = (id: string, parent: string, children: string[] = [], name = id): Node => ({ id, parent, children, name });

const make = () => {
  const moves: unknown[] = [];
  const tree = new Tree<Node>(
    async (...move) => {
      moves.push(["move", ...move]);
      return ok(undefined);
    },
    async (...insert) => {
      moves.push(["insert", ...insert]);
      return ok(undefined);
    },
  );
  tree.reset([node("a", "", ["b", "c"]), node("b", "a"), node("c", "a"), node("d", "")], ["a", "d"]);
  return { tree, moves };
};
const ids = (rows: { ok(): { ok(): Node }[] } | undefined) => rows?.ok().map((s) => s.ok().id);

describe("tree", () => {
  it("keeps the state of a node when it changes, and tells its parent's rows which index changed", () => {
    const { tree } = make();
    const rows = tree.children("a")!;
    const array = rows.ok();
    const c = tree.get("c")!;
    const seen: unknown[] = [];
    rows.sub((r) => seen.push(r.value));
    tree.put([node("c", "a", [], "See")]);
    expect(tree.get("c")).toBe(c);
    expect(c.ok().name).toBe("See");
    expect(rows.ok()).toBe(array);
    expect(seen).toHaveLength(1);
    expect(ids(rows)).toEqual(["b", "c"]);
  });

  it("moves, inserts and removes rows to match the new children", () => {
    const { tree } = make();
    const b = tree.get("b");
    tree.put([node("a", "", ["c"]), node("d", "", ["b", "e"]), node("b", "d"), node("e", "d")]);
    expect(ids(tree.children("a"))).toEqual(["c"]);
    expect(ids(tree.children("d"))).toEqual(["b", "e"]);
    expect(tree.children("d")!.ok()[0]).toBe(b);
    tree.put([node("d", "", ["e", "b"])], ["d", "a"]);
    expect(ids(tree.children("d"))).toEqual(["e", "b"]);
    expect(ids(tree.roots)).toEqual(["d", "a"]);
  });

  it("hands moves and inserts written to the rows to the owner, and rejects other writes", async () => {
    const { tree, moves } = make();
    const b = tree.get("b")!;
    expect((await tree.children("a")!.write(state.a.write.move(1, 0, 1))).ok).toBe(true);
    expect((await tree.roots.write(state.a.write.move(0, 1, 1))).ok).toBe(true);
    expect((await tree.roots.write(state.a.write.splice(1, 0, b))).ok).toBe(true);
    expect((await tree.children("d")!.write(state.a.write.push(b))).ok).toBe(true);
    expect(moves).toEqual([
      ["move", "a", 1, 0, 1],
      ["move", "", 0, 1, 1],
      ["insert", "", 1, ["b"]],
      ["insert", "d", 0, ["b"]],
    ]);
    expect((await tree.roots.write(state.a.write.splice(0, 1))).err).toBe(true);
    expect((await tree.roots.write(state.a.write.fresh([b]))).err).toBe(true);
    //Nothing moves until the owner gives the new values
    expect(ids(tree.children("a"))).toEqual(["b", "c"]);
  });
});
