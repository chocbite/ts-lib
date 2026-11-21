import { afterEach, describe, expect, it } from "vitest";
import { keyboard_open, KeyboardType } from "../index";

const root = document.documentElement;

/**The open keyboard*/
const keyboard = () =>
  document.querySelector<HTMLElement>("onscreen-keyboard-keyboard-keys")!;

/**Whether the element is on the screen above the keyboard, and the keyboard at the bottom of the screen*/
function shown(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const keys = keyboard().getBoundingClientRect();
  expect(rect.top, "top of the element").toBeGreaterThanOrEqual(-0.5);
  expect(rect.bottom, "bottom of the element").toBeLessThanOrEqual(
    keys.top + 0.5,
  );
  expect(keys.bottom, "bottom of the keyboard").toBeCloseTo(
    root.clientHeight,
    0,
  );
}

/**Lines of text making the parent taller than the screen*/
function lines(parent: HTMLElement): void {
  for (let i = 0; i < 100; i++)
    parent.appendChild(document.createElement("div")).textContent = `Line ${i}`;
}

/**A layer covering the screen, like the content of an app or a prompt*/
function layer(parent: HTMLElement, overflow: string): HTMLElement {
  const element = parent.appendChild(document.createElement("div"));
  Object.assign(element.style, {
    position: "fixed",
    inset: "0",
    overflow,
  });
  return element;
}

/**An app filling the screen without scrolling, with a field at its bottom, not in a fixed layer*/
function app_footer(): HTMLInputElement {
  root.style.height = "100%";
  Object.assign(document.body.style, {
    height: "100%",
    margin: "0",
    overflow: "hidden",
    position: "relative",
  });
  const input = document.body.appendChild(document.createElement("input"));
  Object.assign(input.style, { position: "absolute", bottom: "0px" });
  return input;
}

describe("Keyboard page shift", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.querySelectorAll("body ~ *").forEach((e) => e.remove());
    root.removeAttribute("style");
    document.body.removeAttribute("style");
    scrollTo(0, 0);
  });

  it("shows the last element of a scroll container scrolled to its end", () => {
    const list = layer(document.body, "auto");
    lines(list);
    const input = list.appendChild(document.createElement("input"));
    list.scrollTop = list.scrollHeight;
    const close = keyboard_open(input, KeyboardType.Text);
    shown(input);
    close();
  });

  it("shows an element at the bottom of a layout that does not scroll", () => {
    const input = app_footer();
    const close = keyboard_open(input, KeyboardType.Text);
    shown(input);
    expect(root.style.transform).toContain("translateY(");
    close();
  });

  it("shows an element of a layer outside the body, like a prompt", () => {
    const prompt = layer(root, "hidden");
    const input = prompt.appendChild(document.createElement("input"));
    Object.assign(input.style, { position: "absolute", bottom: "0px" });
    const close = keyboard_open(input, KeyboardType.Text);
    shown(input);
    close();
  });

  it("shows an element of a layer outside the body on a page that scrolls", () => {
    lines(document.body);
    scrollTo(0, 1e6);
    const prompt = layer(root, "hidden");
    const input = prompt.appendChild(document.createElement("input"));
    Object.assign(input.style, { position: "absolute", bottom: "0px" });
    const close = keyboard_open(input, KeyboardType.Text);
    shown(input);
    close();
    expect(prompt.style.transform).toBe("");
  });

  it("shows the last element of a page that scrolls, scrolled to its end", () => {
    lines(document.body);
    const input = document.body.appendChild(document.createElement("input"));
    scrollTo(0, 1e6);
    const close = keyboard_open(input, KeyboardType.Text);
    shown(input);
    close();
  });

  it("shows the last element of a body that scrolls and fills the screen, scrolled to its end", () => {
    //Like the dev pages, html and body as high as the screen and the body scrolling, which the browser gives to the window
    Object.assign(root.style, { height: "100%" });
    Object.assign(document.body.style, { height: "100%", overflow: "auto" });
    lines(document.body);
    const input = document.body.appendChild(document.createElement("input"));
    scrollTo(0, 1e6);
    document.body.scrollTop = 1e6;
    const close = keyboard_open(input, KeyboardType.Text);
    shown(input);
    close();
  });

  it("puts back the page's own transform when closing", () => {
    root.style.transform = "scale(1)";
    const input = app_footer();
    const close = keyboard_open(input, KeyboardType.Text);
    expect(root.style.transform).toContain("translateY(");
    close();
    expect(root.style.transform).toBe("scale(1)");
  });

  it("removes the room added at the end of a page when closing", () => {
    lines(document.body);
    const input = document.body.appendChild(document.createElement("input"));
    const height = document.documentElement.scrollHeight;
    scrollTo(0, 1e6);
    const close = keyboard_open(input, KeyboardType.Text);
    expect(document.documentElement.scrollHeight).toBeGreaterThan(height);
    close();
    expect(document.documentElement.scrollHeight).toBe(height);
  });

  it("makes room again when the keyboard gets higher", async () => {
    const app = layer(document.body, "hidden");
    const input = app.appendChild(document.createElement("input"));
    Object.assign(input.style, { position: "absolute", bottom: "40vh" });
    const close = keyboard_open(input, KeyboardType.Text);
    shown(input);
    keyboard().style.height = "70vh";
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    shown(input);
    close();
  });

  it("does not move the top of a tall element off the screen", () => {
    //Element filling the screen, the keyboard covers its bottom part
    const input = document.body.appendChild(document.createElement("textarea"));
    input.style.position = "fixed";
    input.style.top = "0px";
    input.style.height = "100vh";
    const close = keyboard_open(input, KeyboardType.Text);
    expect(input.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    close();
  });
});
