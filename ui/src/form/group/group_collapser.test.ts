import {
  material_unfold_less_rounded,
  material_unfold_more_rounded,
} from "#icons";
import { ANIMATION_LEVEL, ANIMATION_SPEED, AnimationLevels } from "#theme";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { form_text_input } from "../text/input/text_input";
import { form_group } from "./group";
import { form_group_collapser } from "./group_collapser";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**Name of the icon shown in the element*/
const icon = (element: Element) =>
  element.querySelector("svg")!.getAttribute("icon");
const icon_name = (func: () => SVGSVGElement) => func().getAttribute("icon");

describe("Group collapser", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("reopening during the collapse animation leaves it open", async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.All);
    const collapser = form_group_collapser(
      form_group({ elements: [form_text_input()] }),
    );
    document.body.appendChild(collapser);
    collapser.collapsed = true;
    collapser.collapsed = false;
    await wait(600);
    expect(collapser.collapsed).toBe(false);
    expect(collapser.classList.contains("collapsed")).toBe(false);
  });
});

/**Collapser around a group, attached to the document*/
const make = (options?: Parameters<typeof form_group_collapser>[1]) => {
  const group = form_group({ elements: [form_text_input()] });
  const collapser = form_group_collapser(group, options);
  document.body.appendChild(collapser);
  const button = collapser.querySelector(":scope > span") as HTMLSpanElement;
  return { group, collapser, button };
};

describe("Group collapser without animation", () => {
  beforeEach(async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.None);
  });
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("starts open with the collapse text", () => {
    const { collapser, button, group } = make();
    expect(collapser.collapsed).toBe(false);
    expect(collapser.classList.contains("collapsed")).toBe(false);
    expect(button.textContent).toBe("Collapse");
    expect(collapser.group).toBe(group);
  });

  it("starts collapsed with the expand text when asked", () => {
    const { collapser, button } = make({ collapsed: true });
    expect(collapser.collapsed).toBe(true);
    expect(collapser.classList.contains("collapsed")).toBe(true);
    expect(button.textContent).toBe("Expand");
  });

  it("toggles when the button is clicked", () => {
    const { collapser, button } = make();
    button.click();
    expect(collapser.collapsed).toBe(true);
    expect(collapser.classList.contains("collapsed")).toBe(true);
    expect(button.textContent).toBe("Expand");
    button.click();
    expect(collapser.collapsed).toBe(false);
    expect(collapser.classList.contains("collapsed")).toBe(false);
    expect(button.textContent).toBe("Collapse");
  });

  it("toggles on Enter and Space, not on other keys", () => {
    const { collapser, button } = make();
    const press = (key: string) => {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      button.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press("Enter")).toBe(true);
    expect(collapser.collapsed).toBe(true);
    expect(press(" ")).toBe(true);
    expect(collapser.collapsed).toBe(false);
    expect(press("a")).toBe(false);
    expect(collapser.collapsed).toBe(false);
  });

  it("uses custom texts", () => {
    const { collapser, button } = make({
      opened_text: "Less",
      closed_text: "More",
    });
    expect(button.textContent).toBe("Less");
    collapser.collapsed = true;
    expect(button.textContent).toBe("More");
  });

  it("setting the same state again changes nothing", () => {
    const { collapser, button } = make();
    collapser.collapsed = false;
    expect(button.textContent).toBe("Collapse");
    collapser.collapsed = true;
    collapser.collapsed = true;
    expect(collapser.classList.contains("collapsed")).toBe(true);
    expect(button.textContent).toBe("Expand");
  });

  it("shows the expand icon when starting collapsed", () => {
    const { button } = make({ collapsed: true });
    expect(icon(button)).toBe(icon_name(material_unfold_more_rounded));
  });

  it("shows the matching icon after toggling", () => {
    const { collapser, button } = make();
    expect(icon(button)).toBe(icon_name(material_unfold_less_rounded));
    collapser.collapsed = true;
    expect(icon(button)).toBe(icon_name(material_unfold_more_rounded));
    collapser.collapsed = false;
    expect(icon(button)).toBe(icon_name(material_unfold_less_rounded));
  });

  it("replaces the group", () => {
    const { collapser, group } = make();
    const other = form_group();
    collapser.group = other;
    expect(collapser.group).toBe(other);
    expect(group.parentElement).toBeNull();
    expect(collapser.firstElementChild).toBe(other);
  });
});

describe("Group collapser with animation", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("adds the collapsed class when the collapse animation ends", async () => {
    await ANIMATION_LEVEL.write(AnimationLevels.All);
    await ANIMATION_SPEED.write(100);
    const { collapser } = make();
    collapser.collapsed = true;
    expect(collapser.collapsed).toBe(true);
    expect(collapser.classList.contains("collapsed")).toBe(false);
    await wait(300);
    expect(collapser.classList.contains("collapsed")).toBe(true);
    collapser.collapsed = false;
    expect(collapser.classList.contains("collapsed")).toBe(false);
  });
});
