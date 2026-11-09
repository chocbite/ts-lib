import ctm from "#context-menu";
import list from "#list";
import { afterEach, describe, expect, it } from "vitest";
import { SVGAnchorPoint } from "./svg/util/anchorPoint";
import { multi_line_text, text } from "./svg/primitives/text";
import { ok } from "@chocbite/ts-lib/result";

//Labels and values are shown as plain text, markup in them is not turned into elements
const markup = '<b>bold</b><img src="x">';

describe("Labels are text, not markup", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("context menu line", () => {
    const line = ctm.line(markup, () => {}, undefined, markup) as unknown as Element;
    expect(line.querySelector("b, img")).toBeNull();
    expect(line.textContent).toContain(markup);
  });

  it("context menu sub menu", () => {
    const sub = ctm.sub(markup, ctm.menu([])) as unknown as Element;
    expect(sub.querySelector("b, img")).toBeNull();
    expect(sub.textContent).toContain(markup);
  });

  it("list header and field values", () => {
    const container = list.container(
      { col: list.column_string(markup) },
      (item: string) => ok({ values: { col: item } }),
      [markup],
    );
    document.body.append(container);
    expect(container.querySelector("b, img")).toBeNull();
    expect(container.textContent).toContain(markup);
  });

  it("svg text", () => {
    const element = text(0, 0, markup, 10, SVGAnchorPoint.middleLeft).elem;
    expect(element.querySelector("b, img")).toBeNull();
    expect(element.textContent).toBe(markup);
  });

  it("svg multi line text", () => {
    const element = multi_line_text(0, 0, 10, 10, markup, 10, SVGAnchorPoint.topLeft).elem;
    expect(element.querySelector("b, img")).toBeNull();
    expect(element.textContent).toBe(markup);
  });
});
