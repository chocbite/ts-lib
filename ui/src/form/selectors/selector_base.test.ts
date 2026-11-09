import { material_close_rounded } from "#icons";
import { ok } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { form_dropdown } from "./drop_down/drop_down";
import { form_toggle_button } from "./toggle_button/toggle_button";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type Fruit = "apple" | "pear";

/**Writable enum state with its list state*/
const make_enum = () => {
  const list = st.ok_w(
    st.e.list<Fruit>({
      apple: { name: "Apple", icon: material_close_rounded },
      pear: { name: "Pear" },
    }),
  );
  const state = st.rosw(st.e.help(ok<Fruit>("pear"), { list }), true);
  return { list, state };
};

/**Texts of the toggle button options*/
const texts = (element: HTMLElement) =>
  Array.from(element.querySelectorAll(":scope > div"))
    .filter((_div, index) => index % 2 === 0)
    .map((div) =>
      div.textContent === ""
        ? div.nextElementSibling!.textContent
        : div.textContent,
    );

const selected = (element: HTMLElement) =>
  Array.from(element.querySelectorAll(":scope > div"))
    .filter((_div, index) => index % 2 === 0)
    .findIndex((div) => div.classList.contains("selected"));

describe("Selector state list", () => {
  afterEach(() => document.body.replaceChildren());

  it("takes the selections from the enum list of the state", () => {
    const { state } = make_enum();
    const element = form_toggle_button<Fruit, undefined>();
    document.body.appendChild(element);
    element.bind({ value: state });
    expect(texts(element)).toEqual(["Apple", "Pear"]);
    expect(element.querySelector("svg")).not.toBeNull();
    expect(selected(element)).toBe(1);
  });

  it("follows changes of the enum list", async () => {
    const { state, list } = make_enum();
    const element = form_toggle_button<Fruit, undefined>();
    document.body.appendChild(element);
    element.bind({ value: state });
    list.set_ok({ apple: { name: "Green apple" }, pear: { name: "Pear" } });
    await wait();
    expect(texts(element)).toEqual(["Green apple", "Pear"]);
    expect(selected(element)).toBe(1);
  });

  it("writes a selected option to the enum state", async () => {
    const { state } = make_enum();
    const element = form_toggle_button<Fruit, undefined>();
    document.body.appendChild(element);
    element.bind({ value: state });
    (element.querySelector(":scope > div") as HTMLElement).click();
    await wait();
    expect(state.ok()).toBe("apple");
  });

  it("works for a dropdown too", () => {
    const { state } = make_enum();
    const element = form_dropdown<Fruit, undefined>();
    document.body.appendChild(element);
    element.bind({ value: state });
    expect(element.textContent).toContain("Pear");
  });

  it("selects and writes string keys that look like numbers as strings", async () => {
    const list = st.ok(
      st.e.list<"1" | "2">({ 1: { name: "One" }, 2: { name: "Two" } }),
    );
    const state = st.rosw(st.e.help(ok<"1" | "2">("2"), { list }), true);
    const element = form_toggle_button<"1" | "2", undefined>();
    document.body.appendChild(element);
    element.bind({ value: state });
    expect(texts(element)).toEqual(["One", "Two"]);
    expect(selected(element)).toBe(1);
    (element.querySelector(":scope > div") as HTMLElement).click();
    await wait();
    expect(state.ok()).toBe("1");
  });

  it("stops following the list of a previously bound state", async () => {
    const { state, list } = make_enum();
    const element = form_toggle_button<Fruit, undefined>();
    document.body.appendChild(element);
    element.bind({ value: state });
    element.bind({ value: st.ok_w<Fruit>("apple") });
    list.set_ok({ apple: { name: "Old list" }, pear: { name: "Pear" } });
    await wait();
    expect(texts(element)).not.toContain("Old list");
  });
});
