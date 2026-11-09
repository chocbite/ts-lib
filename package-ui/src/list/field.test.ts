import { afterEach, describe, expect, it } from "vitest";
import list, { ListField } from ".";
import { ListNodeField, ListNumberField, ListTextField } from "./field";

afterEach(() => {
  document.body.replaceChildren();
});

describe("List fields", () => {
  it("text field shows the given text", () => {
    const field = list.text_field();
    expect(field).toBeInstanceOf(ListTextField);
    expect(field).toBeInstanceOf(ListField);
    field.text = "Hello";
    expect(field.textContent).toBe("Hello");
    field.text = "";
    expect(field.textContent).toBe("");
  });

  it("number field shows the given number", () => {
    const field = list.number_field();
    expect(field).toBeInstanceOf(ListNumberField);
    field.number = 0;
    expect(field.textContent).toBe("0");
    field.number = -1.5;
    expect(field.textContent).toBe("-1.5");
    field.number = NaN;
    expect(field.textContent).toBe("NaN");
  });

  it("node field holds and replaces its node", () => {
    const button = document.createElement("button");
    const field = list.node_field(button);
    expect(field).toBeInstanceOf(ListNodeField);
    expect(field.node).toBe(button);
    expect(field.childNodes).toHaveLength(1);
    const other = document.createElement("button");
    field.node = other;
    expect(field.node).toBe(other);
    expect(field.childNodes).toHaveLength(1);
    expect(button.isConnected).toBe(false);
  });
});

describe("List column helpers", () => {
  it("column returns the given options", () => {
    const options = {
      title: "Title",
      init_width: 4,
      field_gen: () => list.text_field(),
      field_apply: (field: ListTextField, value: string) =>
        (field.text = value),
    };
    expect(list.column(options)).toBe(options);
  });

  it("column_string generates a new text field per call and applies text", () => {
    const column = list.column_string("Title");
    expect(column.title).toBe("Title");
    const field = column.field_gen();
    expect(field).toBeInstanceOf(ListTextField);
    expect(column.field_gen()).not.toBe(field);
    column.field_apply(field, "Value");
    expect(field.textContent).toBe("Value");
  });

  it("renders number and node columns in a container", () => {
    const clicked: number[] = [];
    const container = list.container(
      {
        num: list.column({
          title: "Number",
          field_gen: () => list.number_field(),
          field_apply: (field, value: number) => (field.number = value),
        }),
        button: list.column({
          title: "Button",
          field_gen: () => list.node_field(document.createElement("button")),
          field_apply: (field, value: number) => {
            field.node.textContent = "Press " + value;
            field.node.onclick = () => clicked.push(value);
          },
        }),
      },
      (item: number) => ({ values: { num: item, button: item } }),
      [1, 2],
    );
    document.body.append(container);
    const numbers = [...container.querySelectorAll("*")].filter(
      (e) => e instanceof ListNumberField,
    );
    expect(numbers.map((e) => e.textContent)).toEqual(["1", "2"]);
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[1].textContent).toBe("Press 2");
    buttons[1].click();
    buttons[0].click();
    expect(clicked).toEqual([2, 1]);
  });
});
