import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import form from "..";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  document.body.replaceChildren();
});

//Like a tab view with one page per value, each with its own element on the same state.
//The view subscribes before the elements are in the document, so it is told first,
//and takes the element the user changed out of the document before that element is told
describe("An element its own write takes out of the document", () => {
  it("shows the value of the state when it is shown again, a switch", async () => {
    const value = st.ok_w(false);
    const host = document.body.appendChild(document.createElement("div"));
    const a = form.switch({ value });
    const b = form.switch({ value });
    value.sub((v) => host.replaceChildren(v.value ? b : a), true);
    const shown = () => {
      const element = host.firstElementChild as typeof a;
      return element.querySelector(":scope > .on") !== null;
    };
    for (let click = 0; click < 4; click++) {
      (host.firstElementChild as HTMLElement).click();
      await wait();
      expect(shown(), "after click " + (click + 1)).toBe(value.ok());
    }
  });

  it("shows the value of the state when it is shown again, a dropdown", async () => {
    const value = st.ok_w(1);
    const selections = [
      { value: 1, text: "PTO 1" },
      { value: 2, text: "PTO 2" },
    ];
    const host = document.body.appendChild(document.createElement("div"));
    const one = form.dropdown({ value, selections });
    const two = form.dropdown({ value, selections });
    value.sub((v) => host.replaceChildren(v.value === 1 ? one : two), true);
    const text = () => host.firstElementChild!.textContent;
    //Arrow down selects the next option without opening the popup
    const key = (key: string) =>
      host.firstElementChild!.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
    key("ArrowDown");
    await wait();
    expect(value.ok()).toBe(2);
    expect(text()).toBe("PTO 2");
    key("ArrowUp");
    await wait();
    expect(value.ok()).toBe(1);
    expect(text()).toBe("PTO 1");
    key("ArrowDown");
    await wait();
    expect(value.ok()).toBe(2);
    expect(text()).toBe("PTO 2");
  });
});
