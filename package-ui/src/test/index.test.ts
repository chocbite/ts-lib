import state from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import {
  TestBox,
  TestGroup,
  TestLabelBox,
  TestOverrideBox,
  TestSlider,
  TestWatcher,
} from ".";

const attach = <T extends HTMLElement>(element: T): T =>
  document.body.appendChild(element);

describe("inputs", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("applies fixed values in the constructor", () => {
    const box = new TestBox({ width: 120, label: "a" });
    expect(box.style.width).toBe("120px");
    expect(box.textContent).toBe("a");
  });

  it("applies states on connect and follows them", () => {
    const width = state.ok_w(120);
    const box = new TestBox({ width });
    expect(box.style.width).toBe("");
    attach(box);
    expect(box.style.width).toBe("120px");
    width.set_ok(80);
    expect(box.style.width).toBe("80px");
  });

  it("only holds subscriptions while connected", () => {
    const width = state.ok_w(120);
    const box = attach(new TestBox({ width }));
    expect(width.amount()).toBe(1);
    box.remove();
    expect(width.amount()).toBe(0);
    attach(box);
    expect(width.amount()).toBe(1);
  });

  it("keeps the last good value when a state gives an error", () => {
    const width = state.from_w<number>(120);
    const box = attach(new TestBox({ width }));
    width.set_err("gone");
    expect(box.style.width).toBe("120px");
  });

  it("hands inputs out unchanged", () => {
    const width = state.ok(1);
    expect(new TestBox({ width }).width).toBe(width);
    expect(new TestBox({ height: 5 }).height).toBe(5);
  });

  it("applies inputs of a subclass", () => {
    const box = new TestLabelBox({ label: "a", badge: "b" });
    expect(box.textContent).toBe("ba");
  });

  it("throws when a fixed value reaches an override before its fields exist", () => {
    expect(() => new TestOverrideBox({ prefix: "p", label: "a" })).toThrow(
      TypeError,
    );
  });

  it("reaches the override with a state, which applies on connect", () => {
    const box = attach(
      new TestOverrideBox({ prefix: "p", label: state.ok("a") }),
    );
    expect(box.textContent).toBe("pa");
  });

  it("links a slider and a box through a shared state", async () => {
    const width = state.ok_w(50);
    const box = attach(new TestBox({ width }));
    const slider = attach(new TestSlider({ value: width, max: 200 }));
    const input = slider.querySelector("input")!;
    expect(input.value).toBe("50");
    input.value = "150";
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(box.style.width).toBe("150px");
  });
});

describe("nested subscriptions", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const setup = () => {
    const items_a = state.ok_w<TestBox[]>([new TestBox()]);
    const items_b = state.ok_w<TestBox[]>([new TestBox(), new TestBox()]);
    const a = new TestGroup({ items: items_a });
    const b = new TestGroup({ items: items_b });
    const group = state.ok_w<TestGroup | undefined>(a);
    const watcher = new TestWatcher({ group });
    return { items_a, items_b, a, b, group, watcher };
  };

  it("follows the list of the group", () => {
    const { items_a, watcher } = setup();
    attach(watcher);
    expect(watcher.textContent).toBe("1 items");
    items_a.set_ok([]);
    expect(watcher.textContent).toBe("0 items");
  });

  it("moves its subscription when the group is swapped", () => {
    const { items_a, items_b, b, group, watcher } = setup();
    attach(watcher);
    expect(items_a.amount()).toBe(1);
    group.set_ok(b);
    expect(items_a.amount()).toBe(0);
    expect(items_b.amount()).toBe(1);
    expect(watcher.textContent).toBe("2 items");
    group.set_ok(undefined);
    expect(items_b.amount()).toBe(0);
    expect(watcher.textContent).toBe("no group");
  });

  it("holds no subscriptions while disconnected and subscribes once on reconnect", () => {
    const { items_a, group, watcher } = setup();
    attach(watcher);
    watcher.remove();
    expect(items_a.amount()).toBe(0);
    expect(group.amount()).toBe(0);
    attach(watcher);
    expect(items_a.amount()).toBe(1);
    expect(group.amount()).toBe(1);
  });

  it("picks up a swap made while disconnected", () => {
    const { items_a, items_b, b, group, watcher } = setup();
    attach(watcher);
    watcher.remove();
    group.set_ok(b);
    attach(watcher);
    expect(items_a.amount()).toBe(0);
    expect(items_b.amount()).toBe(1);
    expect(watcher.textContent).toBe("2 items");
  });
});
