import { afterEach, describe, expect, it } from "vitest";
import list, { ListField } from ".";
import { ListNodeField, ListNumberField, ListTextField } from "./field";
import { ok } from "@chocbite/ts-lib/result";
import { state, type StateOrVal } from "@chocbite/ts-lib/state";
import {
  Base,
  BaseIntersectObserver,
  define_element,
  input_key,
  type BaseOptions,
  type InputOptions,
} from "#base";

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
        transform: (item: number) =>
          ok({ values: { num: item, button: item } }),
      },
      {
        columns: {
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
        rows: [1, 2],
      },
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

//A pattern element that is not a list field, like a form element
const PROBE = {
  /**Text shown in the cell*/
  value: input_key<StateOrVal<string>>(),
};
class PatternProbe extends Base {
  static element_name() {
    return "patternprobe";
  }
  static element_name_space() {
    return "listtest";
  }
  set(options: BaseOptions & InputOptions<typeof PROBE>): this {
    super.set(options);
    this.set_input(PROBE.value, options.value, (value) => {
      this.textContent = value.ok ? value.value : "error";
    });
    return this;
  }
}
define_element(PatternProbe);

describe("List columns of any element", () => {
  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  it("takes an element following the pattern as field, without wrapping it", () => {
    const value = state.ok_w("Alpha");
    const container = list.container(
      {
        transform: (item: StateOrVal<string>) => ok({ values: { name: item } }),
      },
      {
        columns: {
          name: list.column({
            title: "Name",
            field_gen: () => PatternProbe.create({}),
            field_apply: (field, value: StateOrVal<string>) =>
              field.set({ value }),
          }),
        },
        rows: [value, "Beta"],
      },
    );
    document.body.append(container);
    const cells = [...container.querySelectorAll("listtest-patternprobe")];
    expect(cells.map((cell) => cell.textContent)).toEqual(["Alpha", "Beta"]);
    value.set_ok("Gamma");
    expect(cells[0].textContent).toBe("Gamma");
  });

  it("subscribes the states of a field only while it is visible with the observer of the list", async () => {
    const value = state.ok_w("Alpha");
    const root = document.body.appendChild(document.createElement("div"));
    root.style.cssText = "height:10px;overflow:hidden;";
    const observer = new BaseIntersectObserver({
      root,
      deffered_visible: 0,
      deffered_hidden: 0,
    });
    const container = list.container(
      {
        transform: (item: StateOrVal<string>) => ok({ values: { name: item } }),
        observer,
      },
      {
        columns: {
          name: list.column({
            title: "Name",
            field_gen: () => PatternProbe.create({}),
            field_apply: (field, value: StateOrVal<string>) =>
              field.set({ value }),
          }),
        },
        rows: [value],
      },
    );
    //Outside the root of the observer, so never seen
    container.style.cssText = "display:block;margin-top:100px;";
    document.body.append(container);
    await wait(50);
    expect(value.amount()).toBe(0);
  });
});
