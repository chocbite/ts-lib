import {
  material_unfold_less_rounded,
  material_unfold_more_rounded,
} from "#icons";
import { ANIMATION_LEVEL, ANIMATION_SPEED, AnimationLevels } from "#theme";
import st from "@chocbite/ts-lib/state";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { form_text_input } from "../text/input/text_input";
import { form_group } from "./group";
import { form_group_collapser } from "./group_collapser";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**Name of the icon shown in the element*/
const icon = (element: Element) =>
  element.querySelector("svg")!.getAttribute("icon");
const icon_name = (func: () => SVGSVGElement) => func().getAttribute("icon");

/**Collapser around a group, attached to the document*/
const make = (options?: Parameters<typeof form_group_collapser>[1]) => {
  const group = form_group({ elements: [form_text_input()] });
  const collapser = form_group_collapser(group, options);
  document.body.appendChild(collapser);
  const button = collapser.querySelector(":scope > span") as HTMLSpanElement;
  const collapsed = () => collapser.classList.contains("collapsed");
  return { group, collapser, button, collapsed };
};

describe("Group collapser", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("reopening during the collapse animation leaves it open", async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.All);
    const { collapser, button, collapsed } = make();
    collapser.set({ collapsed: true });
    collapser.set({ collapsed: false });
    await wait(600);
    expect(collapsed()).toBe(false);
    expect(button.textContent).toBe("Collapse");
  });
});

describe("Group collapser without animation", () => {
  beforeEach(async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.None);
  });
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("starts open with the collapse text, holding the group", () => {
    const { collapser, button, group, collapsed } = make();
    expect(collapsed()).toBe(false);
    expect(button.textContent).toBe("Collapse");
    expect(collapser.firstElementChild).toBe(group);
  });

  it("starts collapsed with the expand text when asked", () => {
    const { button, collapsed } = make({ collapsed: true });
    expect(collapsed()).toBe(true);
    expect(button.textContent).toBe("Expand");
  });

  it("toggles itself when the button is clicked, starting from an initial value", () => {
    const { button, collapsed } = make({ collapsed: false });
    button.click();
    expect(collapsed()).toBe(true);
    expect(button.textContent).toBe("Expand");
    button.click();
    expect(collapsed()).toBe(false);
    expect(button.textContent).toBe("Collapse");
  });

  it("writes a writable state when the button is clicked, and follows it", () => {
    const state = st.ok_w(false);
    const { button, collapsed } = make({ collapsed: state });
    button.click();
    expect(state.ok()).toBe(true);
    expect(collapsed()).toBe(true);
    state.set_ok(false);
    expect(collapsed()).toBe(false);
  });

  it("can not be toggled with a read only state", () => {
    const { button, collapsed } = make({ collapsed: st.ok(true) });
    button.click();
    expect(collapsed()).toBe(true);
  });

  it("toggles on Enter and Space, not on other keys", () => {
    const { button, collapsed } = make();
    const press = (key: string) => {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      button.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press("Enter")).toBe(true);
    expect(collapsed()).toBe(true);
    expect(press(" ")).toBe(true);
    expect(collapsed()).toBe(false);
    expect(press("a")).toBe(false);
    expect(collapsed()).toBe(false);
  });

  it("uses custom texts, also from states", () => {
    const closed_text = st.ok_w("More");
    const { collapser, button } = make({ opened_text: "Less", closed_text });
    expect(button.textContent).toBe("Less");
    collapser.set({ collapsed: true });
    expect(button.textContent).toBe("More");
    closed_text.set_ok("Show");
    expect(button.textContent).toBe("Show");
  });

  it("setting the same state again changes nothing", () => {
    const { collapser, button, collapsed } = make();
    collapser.set({ collapsed: false });
    expect(button.textContent).toBe("Collapse");
    collapser.set({ collapsed: true });
    collapser.set({ collapsed: true });
    expect(collapsed()).toBe(true);
    expect(button.textContent).toBe("Expand");
  });

  it("shows the expand icon when starting collapsed", () => {
    const { button } = make({ collapsed: true });
    expect(icon(button)).toBe(icon_name(material_unfold_more_rounded));
  });

  it("shows the matching icon after toggling", () => {
    const { collapser, button } = make();
    expect(icon(button)).toBe(icon_name(material_unfold_less_rounded));
    collapser.set({ collapsed: true });
    expect(icon(button)).toBe(icon_name(material_unfold_more_rounded));
    collapser.set({ collapsed: false });
    expect(icon(button)).toBe(icon_name(material_unfold_less_rounded));
  });
});

describe("Group collapser with animation", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("adds the collapsed class when the collapse animation ends", async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.All);
    await ANIMATION_SPEED.write(100);
    const { collapser, button, collapsed } = make();
    collapser.set({ collapsed: true });
    expect(button.textContent).toBe("Expand");
    expect(collapsed()).toBe(false);
    await wait(300);
    expect(collapsed()).toBe(true);
    collapser.set({ collapsed: false });
    expect(collapsed()).toBe(false);
  });
});
