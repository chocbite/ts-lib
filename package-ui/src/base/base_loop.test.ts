import st, {
  STATE_ARRAY_READ_KEY,
  type StateArrayRead,
  type StateArrayReadTypes,
} from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { base_loop } from "./base_loop";

const make_loop = (destructor?: (element: HTMLSpanElement) => void) =>
  base_loop(
    (value: number) => {
      const element = document.createElement("span");
      element.textContent = String(value);
      return element;
    },
    { destructor },
  );

const texts = (loop: HTMLElement) =>
  [...loop.childNodes].map((node) => node.textContent);

describe("Base loop", () => {
  it("adds each batched change once", () => {
    const loop = make_loop();
    loop.array = [1];
    loop.array = Object.assign([1, 2, 3], {
      [STATE_ARRAY_READ_KEY]: [
        { type: "added", index: 1, items: [2] },
        { type: "added", index: 2, items: [3] },
      ],
    });
    expect(texts(loop)).toEqual(["1", "2", "3"]);
  });

  it("calls the destructor for the children a fresh array replaces", () => {
    const destructor = vi.fn();
    const loop = make_loop(destructor);
    loop.array = [1, 2];
    loop.array = [3];
    expect(texts(loop)).toEqual(["3"]);
    expect(destructor).toHaveBeenCalledTimes(2);
  });
});

/**Array with change metadata, as states give to subscribers*/
const changes = <T>(
  array: T[],
  read: StateArrayReadTypes<T>[],
): StateArrayRead<T> => Object.assign(array, { [STATE_ARRAY_READ_KEY]: read });

/**Loop with the given values, returning the loop and its initial child nodes*/
const loop_with = (
  values: number[],
  options?: {
    destructor?: (element: HTMLSpanElement) => void;
    change?: (element: HTMLSpanElement, value: number) => void;
  },
) => {
  const loop = base_loop((value: number) => {
    const element = document.createElement("span");
    element.textContent = String(value);
    return element;
  }, options);
  loop.array = values;
  return { loop, nodes: [...loop.childNodes] };
};

/**Expects the same nodes by identity, toEqual compares nodes by their content*/
const expect_same = (actual: Node[], expected: Node[]) => {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) expect(actual[i]).toBe(expected[i]);
};

describe("Base loop array changes", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("generates a child for every value of a plain array", () => {
    const { loop } = loop_with([1, 2, 3]);
    expect(texts(loop)).toEqual(["1", "2", "3"]);
  });

  it("an empty array removes all children", () => {
    const destructor = vi.fn();
    const { loop } = loop_with([1, 2], { destructor });
    loop.array = [];
    expect(loop.childNodes.length).toBe(0);
    expect(destructor).toHaveBeenCalledTimes(2);
  });

  it("adds items at the start", () => {
    const { loop, nodes } = loop_with([3, 4]);
    loop.array = changes([1, 2, 3, 4], [{ type: "added", index: 0, items: [1, 2] }]);
    expect(texts(loop)).toEqual(["1", "2", "3", "4"]);
    expect(loop.childNodes[2]).toBe(nodes[0]);
  });

  it("adds items in the middle in order", () => {
    const { loop, nodes } = loop_with([1, 4]);
    loop.array = changes([1, 2, 3, 4], [{ type: "added", index: 1, items: [2, 3] }]);
    expect(texts(loop)).toEqual(["1", "2", "3", "4"]);
    expect(loop.childNodes[0]).toBe(nodes[0]);
    expect(loop.childNodes[3]).toBe(nodes[1]);
  });

  it("adds items at the end", () => {
    const { loop } = loop_with([1]);
    loop.array = changes([1, 2, 3], [{ type: "added", index: 1, items: [2, 3] }]);
    expect(texts(loop)).toEqual(["1", "2", "3"]);
  });

  it("removes items from the middle and calls the destructor for each", () => {
    const destructor = vi.fn();
    const { loop, nodes } = loop_with([1, 2, 3, 4], { destructor });
    loop.array = changes([1, 4], [{ type: "removed", index: 1, items: [2, 3] }]);
    expect(texts(loop)).toEqual(["1", "4"]);
    expect_same(
      destructor.mock.calls.map(([node]) => node as Node),
      [nodes[1], nodes[2]],
    );
  });

  it("removes the last item", () => {
    const { loop } = loop_with([1, 2, 3]);
    loop.array = changes([1, 2], [{ type: "removed", index: 2, items: [3] }]);
    expect(texts(loop)).toEqual(["1", "2"]);
  });

  it("changed without a change option replaces the nodes and destroys the old ones", () => {
    const destructor = vi.fn();
    const { loop, nodes } = loop_with([1, 2, 3], { destructor });
    loop.array = changes([1, 8, 9], [{ type: "changed", index: 1, items: [8, 9] }]);
    expect(texts(loop)).toEqual(["1", "8", "9"]);
    expect(loop.childNodes[0]).toBe(nodes[0]);
    expect(loop.childNodes[1]).not.toBe(nodes[1]);
    expect_same(
      destructor.mock.calls.map(([node]) => node as Node),
      [nodes[1], nodes[2]],
    );
  });

  it("changed with a change option updates the existing nodes", () => {
    const destructor = vi.fn();
    const change = vi.fn((element: HTMLSpanElement, value: number) => {
      element.textContent = "c" + value;
    });
    const { loop, nodes } = loop_with([1, 2, 3], { destructor, change });
    loop.array = changes([1, 8, 9], [{ type: "changed", index: 1, items: [8, 9] }]);
    expect(texts(loop)).toEqual(["1", "c8", "c9"]);
    expect_same([...loop.childNodes], nodes);
    expect_same(
      change.mock.calls.map(([node]) => node),
      [nodes[1], nodes[2]],
    );
    expect(change.mock.calls.map(([, value]) => value)).toEqual([8, 9]);
    expect(destructor).not.toHaveBeenCalled();
  });

  it("moves an item forward", () => {
    const { loop, nodes } = loop_with([1, 2, 3, 4]);
    loop.array = changes([2, 3, 1, 4], [
      { type: "moved", from_index: 0, to_index: 2, items: [1] },
    ]);
    expect(texts(loop)).toEqual(["2", "3", "1", "4"]);
    expect(loop.childNodes[2]).toBe(nodes[0]);
  });

  it("moves several items backward", () => {
    const { loop, nodes } = loop_with([1, 2, 3, 4, 5]);
    loop.array = changes([3, 4, 1, 2, 5], [
      { type: "moved", from_index: 2, to_index: 0, items: [3, 4] },
    ]);
    expect(texts(loop)).toEqual(["3", "4", "1", "2", "5"]);
    expect(loop.childNodes[0]).toBe(nodes[2]);
    expect(loop.childNodes[1]).toBe(nodes[3]);
  });

  it("moves items to the end", () => {
    const { loop } = loop_with([1, 2, 3, 4]);
    loop.array = changes([3, 4, 1, 2], [
      { type: "moved", from_index: 0, to_index: 2, items: [1, 2] },
    ]);
    expect(texts(loop)).toEqual(["3", "4", "1", "2"]);
  });

  it("applies several changes in order", () => {
    const { loop } = loop_with([1, 2, 3]);
    loop.array = changes([0, 1, 3, 7], [
      { type: "added", index: 0, items: [0] },
      { type: "removed", index: 2, items: [2] },
      { type: "added", index: 3, items: [7] },
    ]);
    expect(texts(loop)).toEqual(["0", "1", "3", "7"]);
  });

  it("does nothing for an empty change list", () => {
    const { loop, nodes } = loop_with([1, 2]);
    loop.array = changes([1, 2], []);
    expect_same([...loop.childNodes], nodes);
  });

  it("error replaces the children with the error node", () => {
    const { loop } = loop_with([1, 2]);
    const error = document.createElement("b");
    loop.error = error;
    expect([...loop.childNodes]).toEqual([error]);
    loop.array = [5];
    expect(texts(loop)).toEqual(["5"]);
  });
});

describe("Base loop with a state", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**Connected loop following an array state*/
  const state_loop = (
    values: number[],
    options?: { change?: (element: HTMLSpanElement, value: number) => void },
  ) => {
    const state = st.ok_w(values);
    const { loop } = loop_with([], options);
    loop.attach_state_ROA_to_prop("array", state);
    document.body.appendChild(loop);
    return { state, loop, nodes: [...loop.childNodes] };
  };

  it("follows push, unshift, pop and shift", () => {
    const { state, loop } = state_loop([2, 3]);
    expect(texts(loop)).toEqual(["2", "3"]);
    state.array.push(4, 5);
    state.array.unshift(0, 1);
    expect(texts(loop)).toEqual(["0", "1", "2", "3", "4", "5"]);
    state.array.pop();
    state.array.shift();
    expect(texts(loop)).toEqual(["1", "2", "3", "4"]);
  });

  it("follows splice in the middle and keeps the other nodes", () => {
    const { state, loop, nodes } = state_loop([1, 2, 3, 4]);
    state.array.splice(1, 2, 8, 9, 10);
    expect(texts(loop)).toEqual(["1", "8", "9", "10", "4"]);
    expect(loop.childNodes[0]).toBe(nodes[0]);
    expect(loop.childNodes[4]).toBe(nodes[3]);
  });

  it("follows change past the end, which changes and adds", () => {
    const { state, loop } = state_loop([1, 2]);
    state.array.change(1, 7, 8, 9);
    expect(texts(loop)).toEqual(["1", "7", "8", "9"]);
  });

  it("follows change with a change option", () => {
    const change = vi.fn((element: HTMLSpanElement, value: number) => {
      element.textContent = "c" + value;
    });
    const { state, loop, nodes } = state_loop([1, 2, 3], { change });
    state.array.change(0, 5);
    expect(texts(loop)).toEqual(["c5", "2", "3"]);
    expect(loop.childNodes[0]).toBe(nodes[0]);
  });

  it("follows delete of repeated values", () => {
    const { state, loop } = state_loop([4, 1, 4, 2, 4]);
    state.array.delete(4);
    expect(texts(loop)).toEqual(["1", "2"]);
  });

  it("follows move forward and backward", () => {
    const { state, loop, nodes } = state_loop([1, 2, 3, 4, 5]);
    state.array.move(0, 3);
    expect(texts(loop)).toEqual(["2", "3", "4", "1", "5"]);
    expect(loop.childNodes[3]).toBe(nodes[0]);
    state.array.move(3, 0, 2);
    expect(texts(loop)).toEqual(["1", "5", "2", "3", "4"]);
  });

  it("follows move to past the end", () => {
    const { state, loop } = state_loop([1, 2, 3]);
    state.array.move(0, 10);
    expect(texts(loop)).toEqual(["2", "3", "1"]);
  });

  it("follows sort and set", () => {
    const { state, loop } = state_loop([3, 1, 2]);
    state.array.sort((a, b) => a - b);
    expect(texts(loop)).toEqual(["1", "2", "3"]);
    state.set_ok([9]);
    expect(texts(loop)).toEqual(["9"]);
  });
});
