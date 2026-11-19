import form from "@chocbite/ts-lib-ui/form";
import { box, controls, row, section } from "../../../helpers";

const WIDTH = { width: "14rem" };

//No value next to a value, for every element with a look for it
{
  const sec = section(
    "No value",
    "Each element without a value, on the left, next to the same element with a value. Text and number inputs show a short grey line where the value would be, hidden while you type in it, dropdowns already ask to select something. The color input shows a muted rainbow, the switch has its knob in the middle on a lighter track. Enter a value to see the look go, Clear takes the values the elements keep themselves away again. The canvas properties editor uses this where several selected widgets have different values",
  );
  const pairs: [string, () => HTMLElement, () => HTMLElement][] = [
    [
      "Text input",
      () => form.text_input(),
      () => form.text_input({ value: "Text" }),
    ],
    [
      "Number input",
      () => form.number_input(),
      () => form.number_input({ value: 42 }),
    ],
    [
      "Dropdown",
      () =>
        form.dropdown({
          selections: [
            { value: "a", text: "Apple" },
            { value: "b", text: "Banana" },
          ],
        }),
      () =>
        form.dropdown({
          value: "a",
          selections: [
            { value: "a", text: "Apple" },
            { value: "b", text: "Banana" },
          ],
        }),
    ],
    ["Color", () => form.color(), () => form.color({ value: "#2980b9" })],
    ["Switch", () => form.switch(), () => form.switch({ value: true })],
  ];
  const empty: HTMLElement[] = [];
  for (const [name, without, with_value] of pairs) {
    const r = row(sec);
    empty.push(box(r, name + ", no value", WIDTH).appendChild(without()));
    box(r, name + ", a value", WIDTH).appendChild(with_value());
  }
  controls(sec, {
    Clear: () => {
      for (const element of empty)
        (element as HTMLElement & { clear(): void }).clear();
    },
  });
}
