import form from "#form";
import { ok } from "@chocbite/ts-lib/result";
import { afterEach, describe, expect, it } from "vitest";
import list from ".";
import type { ListColumnAlign } from "./types";

const justify = (element: Element) => getComputedStyle(element).justifyContent;
const text_align = (element: Element) => getComputedStyle(element).textAlign;

function text_list(align?: ListColumnAlign) {
  const container = list.container(
    { col: list.column_string("Column", { align }) },
    (item: number) => ok({ values: { col: item.toString() } }),
    [1],
  );
  document.body.append(container);
  return {
    container,
    field: container.querySelector("list-textfield")!,
    title: container.querySelector("list-headerfield > div > span")!,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("List column alignment", () => {
  it("centers fields and titles by default without adding a class", () => {
    const { field, title } = text_list();
    expect(field.classList.length).toBe(0);
    expect(justify(field)).toBe("center");
    expect(text_align(field)).toBe("center");
    expect(justify(title)).toBe("center");
  });

  it("adds no class for an explicit center", () => {
    const { field } = text_list("center");
    expect(field.classList.length).toBe(0);
  });

  it("aligns the field and title left", () => {
    const { field, title } = text_list("left");
    expect(justify(field)).toBe("flex-start");
    expect(text_align(field)).toBe("left");
    expect(justify(title)).toBe("flex-start");
  });

  it("aligns the field and title right", () => {
    const { field, title } = text_list("right");
    expect(justify(field)).toBe("flex-end");
    expect(text_align(field)).toBe("right");
    expect(justify(title)).toBe("flex-end");
    expect(text_align(title)).toBe("right");
  });

  it("follows new columns on existing rows and header", () => {
    const { container } = text_list();
    container.columns = { col: list.column_string("New", { align: "right" }) };
    expect(justify(container.querySelector("list-textfield")!)).toBe("flex-end");
    expect(
      justify(container.querySelector("list-headerfield > div > span")!),
    ).toBe("flex-end");
  });

  it("is followed by number and node fields", () => {
    const container = list.container(
      {
        number: list.column({
          title: "Number",
          align: "right",
          field_gen: () => list.number_field(),
          field_apply: (field, value: number) => (field.number = value),
        }),
        node: list.column({
          title: "Node",
          align: "right",
          field_gen: () => list.node_field(document.createElement("button")),
          field_apply: (field, value: string) =>
            (field.node.textContent = value),
        }),
      },
      () => ok({ values: { number: 1, node: "Press" } }),
      [1],
    );
    document.body.append(container);
    expect(justify(container.querySelector("list-numberfield")!)).toBe(
      "flex-end",
    );
    expect(justify(container.querySelector("list-nodefield")!)).toBe(
      "flex-end",
    );
  });

  it("is not followed by form fields", () => {
    const column = (align?: ListColumnAlign) =>
      list.column({
        title: "Form",
        align,
        field_gen: () => form.list_field(form.switch()),
        field_apply: () => undefined,
      });
    const styles = [undefined, "right" as const].map((align) => {
      const container = list.container(
        { col: column(align) },
        () => ok({ values: { col: undefined } }),
        [1],
      );
      document.body.append(container);
      return justify(container.querySelector("form-listfield")!);
    });
    expect(styles[1]).toBe(styles[0]);
  });
});
