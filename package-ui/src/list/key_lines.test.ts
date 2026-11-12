import { theme_init } from "#theme";
import { ok } from "@chocbite/ts-lib/result";
import { afterEach, describe, expect, it } from "vitest";
import list from ".";
import { ListKeyField, type ListKeyFieldOptions } from "./key_field";

//The lines are sized by theme variables
theme_init();

afterEach(() => {
  document.body.replaceChildren();
});

interface Item {
  name: string;
  tall?: boolean;
  sub?: Item[];
  key_field?: ListKeyFieldOptions;
}

/**List where a tall item gets a field far higher than the minimum row height */
function tree(items: Item[]) {
  const container = list.container(
    {
      name: list.column({
        title: "Name",
        field_gen: () => list.node_field(document.createElement("div")),
        field_apply: (field, item: Item) => {
          field.node.textContent = item.name;
          field.node.style.height = item.tall ? "6rem" : "";
        },
      }),
    },
    (item: Item) =>
      ok({
        openable: Boolean(item.sub),
        key_field: item.key_field,
        sub_rows: () => item.sub ?? [],
        values: { name: item },
      }),
    items,
    { sub_rows: true },
  );
  document.body.append(container);
  return container;
}

function key_fields(container: HTMLElement): ListKeyField<any>[] {
  return [
    ...container.querySelectorAll("list-keyfield"),
  ] as ListKeyField<any>[];
}

function opener(key: ListKeyField<any>): HTMLElement {
  return key.querySelector(":scope > span:not(.text)")!;
}

/**Distance from the top of the element to its horizontal line drawn by a bottom border of the pseudo element */
function line_y(element: Element, pseudo: "::after") {
  return parseFloat(getComputedStyle(element, pseudo).height);
}

describe("List key field lines", () => {
  it("centers the horizontal lines in a row taller than the minimum", () => {
    const container = tree([{ name: "a", tall: true }, { name: "b" }]);
    const [tall, normal] = key_fields(container);
    expect(tall.offsetHeight).toBeGreaterThan(normal.offsetHeight * 2);
    for (const key of [tall, normal]) {
      expect(line_y(key, "::after")).toBeCloseTo(key.clientHeight / 2, 0);
      expect(line_y(opener(key), "::after")).toBeCloseTo(
        opener(key).clientHeight / 2,
        0,
      );
    }
  });

  it("ends the vertical line of the last row in its middle", () => {
    const container = tree([{ name: "a" }, { name: "b", tall: true }]);
    const last = opener(key_fields(container)[1]);
    expect(parseFloat(getComputedStyle(last, "::before").height)).toBeCloseTo(
      last.clientHeight / 2,
      0,
    );
  });

  it("draws a line from an open row down to the line of its sub rows", () => {
    const container = tree([
      { name: "a", sub: [{ name: "a1", sub: [{ name: "a11" }] }] },
    ]);
    const [parent] = key_fields(container);
    expect(getComputedStyle(parent).backgroundImage).toBe("none");

    parent.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const child = key_fields(container)[1];
    child.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const grand_child = key_fields(container)[2];

    for (const [key, sub] of [
      [parent, child],
      [child, grand_child],
    ]) {
      const style = getComputedStyle(key);
      expect(style.backgroundImage).not.toBe("none");
      //The line covers the lower half
      expect(style.backgroundPositionY).toBe("100%");
      expect(style.backgroundSize).toBe("1px 50%");
      //At the vertical line of the sub row, the right border of its half wide opener line
      const sub_opener = opener(sub).getBoundingClientRect();
      const sub_line =
        sub_opener.left +
        parseFloat(getComputedStyle(opener(sub), "::before").width);
      const line =
        key.getBoundingClientRect().left +
        parseFloat(style.backgroundPositionX);
      expect(line).toBeCloseTo(sub_line, 0);
    }

    //Closing removes the line
    parent.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(getComputedStyle(parent).backgroundImage).toBe("none");
  });

  it("keeps the indent and opener sizes in a key column narrower than its content", () => {
    const container = tree([{ name: "a", sub: [{ name: "a1" }] }]);
    const [parent] = key_fields(container);
    parent.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const child = key_fields(container)[1];
    const width = opener(child).offsetWidth;
    (container.firstElementChild as HTMLElement).style.gridTemplateColumns =
      "1rem auto";
    expect(opener(child).offsetWidth).toBe(width);
  });

  it("covers the line down to the sub rows with the icon and text, and shows it below them in a tall row", () => {
    const icon = () => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      return svg;
    };
    const container = tree([
      {
        name: "a",
        tall: true,
        key_field: { icon, text: "Text" },
        sub: [{ name: "a1" }],
      },
    ]);
    const [parent] = key_fields(container);
    parent.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const background = getComputedStyle(parent).backgroundColor;
    for (const element of [
      parent.querySelector("svg")!,
      parent.querySelector(":scope > span.text")!,
    ]) {
      expect(getComputedStyle(element).backgroundColor).toBe(background);
      const rect = element.getBoundingClientRect();
      const key = parent.getBoundingClientRect();
      expect(rect.bottom).toBeLessThan(key.bottom - key.height / 4);
      expect(rect.top + rect.height / 2).toBeCloseTo(
        key.top + key.height / 2,
        0,
      );
    }
  });
});
