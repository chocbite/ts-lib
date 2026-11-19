import { afterEach, describe, expect, it, vi } from "vitest";
import { state_ui } from "..";

/**Waits for the browser to lay out and deliver resize observations, which comes before the next paint*/
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const box = (width: number, height: number) => {
  const element = document.body.appendChild(document.createElement("div"));
  element.style.cssText = `width:${width}px;height:${height}px;padding:5px`;
  return element;
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("state_ui.size", () => {
  it("follows the size of the content box of the element while subscribed", async () => {
    const element = box(120, 80);
    const { width, height } = state_ui.size(element);
    const seen: number[] = [];
    width.sub((value) => seen.push(value.value));
    height.sub(() => {});
    await frame();

    expect(width.ok()).toBe(120);
    expect(height.ok()).toBe(80);

    element.style.width = "200px";
    await frame();

    expect(width.ok()).toBe(200);
    expect(seen.at(-1)).toBe(200);
  });

  it("has both sizes updated before any subscriber is told, so a width subscriber reads the new height", async () => {
    const element = box(100, 50);
    const { width, height } = state_ui.size(element);
    width.sub(() => {});
    height.sub(() => {});
    await frame();
    const heights: number[] = [];
    width.sub(() => heights.push(height.ok()));

    element.style.cssText = "width:150px;height:90px;padding:5px";
    await frame();

    expect(heights).toEqual([90]);
  });

  it("tells a function subscribed to both when only one changes", async () => {
    const element = box(100, 50);
    const { width, height } = state_ui.size(element);
    const sizes: string[] = [];
    const draw = () => sizes.push(`${width.ok()}x${height.ok()}`);
    width.sub(draw);
    height.sub(draw);
    await frame();
    sizes.length = 0;

    element.style.height = "70px";
    await frame();

    expect(sizes).toEqual(["100x70"]);
  });

  it("is 0 until the element is measured", () => {
    const { width, height } = state_ui.size(box(50, 50));

    expect(width.ok()).toBe(0);
    expect(height.ok()).toBe(0);
  });

  it("observes the element only while something is subscribed, once for width and height together", async () => {
    const observe = vi.spyOn(ResizeObserver.prototype, "observe");
    const unobserve = vi.spyOn(ResizeObserver.prototype, "unobserve");
    const element = box(50, 50);
    const { width, height } = state_ui.size(element);
    expect(observe).not.toHaveBeenCalled();

    const on_width = width.sub(() => {});
    const on_height = height.sub(() => {});
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(element);

    width.unsub(on_width);
    expect(unobserve).not.toHaveBeenCalled();
    height.unsub(on_height);
    expect(unobserve).toHaveBeenCalledWith(element);
  });

  it("gives the same states for the same element", () => {
    const element = box(50, 50);

    expect(state_ui.size(element)).toBe(state_ui.size(element));
  });

  it("is read only", async () => {
    const { width } = state_ui.size(box(50, 50));

    expect(width.writable).toBe(false);
    expect((await width.check!(5)).err).toBe(true);
  });
});
