import st, {
  STATE_ARRAY_READ_KEY,
  type StateArrayRead,
  type StateArrayReadTypes,
} from "@chocbite/ts-lib/state";
import { describe, expect, it, vi } from "vitest";
import state_ui, { state_ui as named } from ".";

const apply_array = state_ui.a.apply;

/**Array with change metadata, as array states give to subscribers*/
const changes = <T>(
  array: T[],
  read: StateArrayReadTypes<T>[],
): StateArrayRead<T> => Object.assign(array, { [STATE_ARRAY_READ_KEY]: read });

const span = (value: number) => {
  const element = document.createElement("span");
  element.textContent = String(value);
  return element;
};

/**Parent with nodes for the values, and the handlers used*/
const setup = (values: number[], with_update: boolean) => {
  const parent = document.createElement("div");
  const destroy = vi.fn<(node: HTMLSpanElement) => void>();
  const update = vi.fn((node: HTMLSpanElement, value: number) => {
    node.textContent = String(value);
  });
  const handlers = {
    create: span,
    destroy,
    update: with_update ? update : undefined,
  };
  apply_array(parent, values, handlers);
  const nodes = [...parent.childNodes];
  const apply = (array: readonly number[]) =>
    apply_array(parent, array, handlers);
  const texts = () => [...parent.childNodes].map((node) => node.textContent);
  return { parent, nodes, apply, texts, destroy, update };
};

describe("state_ui.a.apply", () => {
  it("is the same object as default and named export, a and array are the same", () => {
    expect(named).toBe(state_ui);
    expect(state_ui.array).toBe(state_ui.a);
  });

  for (const with_update of [false, true])
    describe(with_update ? "with update" : "without update", () => {
      it("creates a node per value", () => {
        expect(setup([1, 2, 3], with_update).texts()).toEqual(["1", "2", "3"]);
      });

      it("adds at the start, middle and end, keeping the other nodes", () => {
        const { parent, nodes, apply, texts } = setup([2, 5], with_update);
        apply(changes([1, 2, 5], [{ type: "added", index: 0, items: [1] }]));
        apply(changes([1, 2, 3, 4, 5], [{ type: "added", index: 2, items: [3, 4] }]));
        apply(changes([1, 2, 3, 4, 5, 6], [{ type: "added", index: 5, items: [6] }]));
        expect(texts()).toEqual(["1", "2", "3", "4", "5", "6"]);
        expect(parent.childNodes[1]).toBe(nodes[0]);
        expect(parent.childNodes[4]).toBe(nodes[1]);
      });

      it("removes and destroys nodes", () => {
        const { apply, texts, nodes, destroy } = setup([1, 2, 3, 4], with_update);
        apply(changes([1, 4], [{ type: "removed", index: 1, items: [2, 3] }]));
        expect(texts()).toEqual(["1", "4"]);
        expect(destroy.mock.calls.map(([node]) => node)).toEqual([nodes[1], nodes[2]]);
      });

      it("moves several nodes forward and backward, keeping them", () => {
        const { parent, nodes, apply, texts } = setup([1, 2, 3, 4, 5], with_update);
        apply(changes([3, 4, 1, 2, 5], [{ type: "moved", from_index: 2, to_index: 0, items: [3, 4] }]));
        expect(texts()).toEqual(["3", "4", "1", "2", "5"]);
        apply(changes([1, 2, 5, 3, 4], [{ type: "moved", from_index: 0, to_index: 3, items: [3, 4] }]));
        expect(texts()).toEqual(["1", "2", "5", "3", "4"]);
        expect(parent.childNodes[3]).toBe(nodes[2]);
        expect(parent.childNodes[4]).toBe(nodes[3]);
      });

      it("applies several changes in order", () => {
        const { apply, texts } = setup([1, 2, 3], with_update);
        apply(
          changes([0, 1, 3, 7], [
            { type: "added", index: 0, items: [0] },
            { type: "removed", index: 2, items: [2] },
            { type: "added", index: 3, items: [7] },
          ]),
        );
        expect(texts()).toEqual(["0", "1", "3", "7"]);
      });

      it("an empty plain array removes and destroys all nodes", () => {
        const { parent, apply, destroy } = setup([1, 2], with_update);
        apply([]);
        expect(parent.childNodes.length).toBe(0);
        expect(destroy).toHaveBeenCalledTimes(2);
      });
    });

  it("without update, changed values and a plain array replace and destroy the nodes", () => {
    const { parent, nodes, apply, texts, destroy } = setup([1, 2, 3], false);
    apply(changes([1, 8, 3], [{ type: "changed", index: 1, items: [8] }]));
    expect(texts()).toEqual(["1", "8", "3"]);
    expect(parent.childNodes[1]).not.toBe(nodes[1]);
    expect(destroy.mock.calls.map(([node]) => node)).toEqual([nodes[1]]);
    apply([4, 5]);
    expect(texts()).toEqual(["4", "5"]);
    expect(destroy).toHaveBeenCalledTimes(4);
  });

  it("with update, changed values update their node", () => {
    const { parent, nodes, apply, texts, update, destroy } = setup([1, 2, 3], true);
    apply(changes([1, 8, 9], [{ type: "changed", index: 1, items: [8, 9] }]));
    expect(texts()).toEqual(["1", "8", "9"]);
    expect([...parent.childNodes]).toEqual(nodes);
    expect(update.mock.calls.map(([node, value]) => [node, value])).toEqual([
      [nodes[1], 8],
      [nodes[2], 9],
    ]);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("with update, a plain array reuses nodes and adds or removes the difference", () => {
    const { parent, nodes, apply, texts, destroy } = setup([1, 2, 3], true);
    apply([7, 8]);
    expect(texts()).toEqual(["7", "8"]);
    expect(parent.childNodes[0]).toBe(nodes[0]);
    expect(parent.childNodes[1]).toBe(nodes[1]);
    expect(destroy.mock.calls.map(([node]) => node)).toEqual([nodes[2]]);
    apply([4, 5, 6, 7]);
    expect(texts()).toEqual(["4", "5", "6", "7"]);
    expect(parent.childNodes[0]).toBe(nodes[0]);
  });

  it("works with text nodes", () => {
    const parent = document.createElement("div");
    const create = (value: string) => document.createTextNode(value);
    apply_array(parent, ["a", "c"], { create });
    apply_array(
      parent,
      changes(["a", "b", "c"], [{ type: "added", index: 1, items: ["b"] }]),
      { create },
    );
    expect(parent.textContent).toBe("abc");
  });

  it("follows every change of an array state", () => {
    const parent = document.createElement("div");
    const numbers = st.ok_w([1, 2, 3]);
    numbers.sub((value) => {
      apply_array(parent, value.value, { create: span });
    }, true);
    const texts = () => [...parent.childNodes].map((node) => node.textContent);
    numbers.array.push(4);
    numbers.array.unshift(0);
    numbers.array.splice(2, 1);
    numbers.array.move(0, 3);
    expect(texts()).toEqual(numbers.ok().map(String));
    numbers.array.pop();
    numbers.array.shift();
    expect(texts()).toEqual(numbers.ok().map(String));
  });
});
