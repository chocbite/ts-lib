import { NiceError } from "@chocbite/ts-lib/result";
import {
  AccessTypes,
  define_element,
  input_key,
  type BaseOptions,
  type InputOf,
} from "#base";
import type { ResultOk } from "@chocbite/ts-lib/result";
import state, {
  type StateOrVal,
  type StateOrValROS,
  type StateOrValROSW,
  type StateResult,
  type StateROS,
  type StateROSW,
} from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import {
  ExampleBase,
  type ExampleEditorCreateOptions,
  type ExampleEditorOptions,
  type ExampleGroupCreateOptions,
  type ExampleGroupOptions,
  type ExampleLabelBoxOptions,
  type ExampleSliderOptions,
  example_box,
  example_editor,
  example_group,
  example_label_box,
  example_override_box,
  example_slider,
  example_view,
  example_watcher,
  type ExampleBox,
  type ExampleEditor,
  type ExampleGroup,
} from "..";

/**A test error whose nice text is its message, so shown texts read as before*/
const nice_err = (text: string) => new NiceError(Symbol(text), text);

const attach = <T extends HTMLElement>(element: T): T =>
  document.body.appendChild(element);

afterEach(() => {
  document.body.replaceChildren();
});

describe("set", () => {
  it("the factory applies its options like set", () => {
    const width = state.ok_w(120);
    const from_factory = attach(example_box({ width, label: "a" }));
    const from_set = attach(example_box().set({ width, label: "a" }));
    expect(from_factory.style.width).toBe(from_set.style.width);
    expect(from_factory.textContent).toBe(from_set.textContent);
    expect(width.amount()).toBe(2);
  });

  it("shows the constructor defaults before set", () => {
    const box = example_box();
    expect(box.style.width).toBe("100px");
    expect(box.style.height).toBe("32px");
  });

  it("applies initial values right away", () => {
    const box = example_box({ width: 120, label: "a" });
    expect(box.style.width).toBe("120px");
    expect(box.textContent).toBe("a");
  });

  it("applies states on connect and follows them", () => {
    const width = state.ok_w(120);
    const box = example_box({ width });
    expect(box.style.width).toBe("100px");
    attach(box);
    expect(box.style.width).toBe("120px");
    width.set_ok(80);
    expect(box.style.width).toBe("80px");
  });

  it("only holds subscriptions while connected", () => {
    const width = state.ok_w(120);
    const box = attach(example_box({ width }));
    expect(width.amount()).toBe(1);
    box.remove();
    expect(width.amount()).toBe(0);
    attach(box);
    expect(width.amount()).toBe(1);
  });

  it("leaves options that are not given unchanged", () => {
    const box = example_box({ width: 120, label: "a" });
    box.set({ label: "b" });
    expect(box.style.width).toBe("120px");
    expect(box.textContent).toBe("b");
  });

  it("setting a state again replaces the previous state", () => {
    const first = state.ok_w(120);
    const second = state.ok_w(80);
    const box = attach(example_box({ width: first }));
    box.set({ width: second });
    expect(first.amount()).toBe(0);
    expect(second.amount()).toBe(1);
    expect(box.style.width).toBe("80px");
    first.set_ok(10);
    expect(box.style.width).toBe("80px");
  });

  it("setting an initial value detaches the previous state", () => {
    const width = state.ok_w(120);
    const box = attach(example_box({ width }));
    box.set({ width: 60 });
    expect(width.amount()).toBe(0);
    width.set_ok(10);
    expect(box.style.width).toBe("60px");
    box.remove();
    attach(box);
    expect(width.amount()).toBe(0);
  });

  it("a reused row follows only the data it was bound to last", () => {
    const rows = [state.ok_w("a"), state.ok_w("b"), state.ok_w("c")];
    const row = attach(example_box());
    for (const label of rows) row.set({ label, width: 50 });
    expect(rows.map((r) => r.amount())).toEqual([0, 0, 1]);
    expect(row.textContent).toBe("c");
    rows[0].set_ok("x");
    expect(row.textContent).toBe("c");
  });

  it("a set again while disconnected subscribes only the new state on connect", () => {
    const first = state.ok_w("a");
    const second = state.ok_w("b");
    const box = attach(example_box({ label: first }));
    box.remove();
    box.set({ label: second });
    attach(box);
    expect(first.amount()).toBe(0);
    expect(second.amount()).toBe(1);
    expect(box.textContent).toBe("b");
  });

  it("applies inputs of a subclass", () => {
    const box = example_label_box({ label: "a", badge: "b" });
    expect(box.textContent).toBe("ba");
  });

  it("an override can use fields of the subclass with an initial value", () => {
    const box = example_override_box({ prefix: "p", label: "a" });
    expect(box.textContent).toBe("pa");
  });

  it("an override can use fields of the subclass with a state", () => {
    const box = attach(
      example_override_box({ prefix: "p", label: state.ok("a") }),
    );
    expect(box.textContent).toBe("pa");
  });

  it("links a slider and a box through a shared state", async () => {
    const width = state.ok_w(50);
    const box = attach(example_box({ width }));
    const slider = attach(example_slider({ value: width, max: 200 }));
    const input = slider.querySelector("input")!;
    expect(input.value).toBe("50");
    input.value = "150";
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(box.style.width).toBe("150px");
  });
});

const PLAIN = input_key<number>();
const OK_ONLY = input_key<StateOrValROS<number>>();
const WRITABLE = input_key<StateOrValROSW<number>>();
const ERRORABLE = input_key<StateOrVal<number>>();

/**Checks the types set_input and input_state take from the key*/
class TypeProbe extends ExampleBase {
  static element_name() {
    return "typeprobe";
  }
  set(
    options: BaseOptions & {
      ok_only?: StateOrValROS<number>;
      writable?: StateOrValROSW<number>;
      errorable?: StateOrVal<number>;
    },
  ): this {
    super.set(options);
    this.set_input(PLAIN, 5, (value) => {
      expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
    });
    this.set_input(OK_ONLY, options.ok_only, (value) => {
      expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
    });
    this.set_input(WRITABLE, options.writable, (value) => {
      expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
    });
    this.set_input(ERRORABLE, options.errorable, (value) => {
      expectTypeOf(value).toEqualTypeOf<StateResult<number>>();
    });
    this.set_input(ERRORABLE, state.from(1), (value) => {
      expectTypeOf(value).toEqualTypeOf<StateResult<number>>();
    });
    return this;
  }

  /**Only compiled, checks what the keys reject and what input_state gives*/
  key_types(): void {
    // @ts-expect-error a string input for a number key
    this.set_input(OK_ONLY, "a", () => {});
    // @ts-expect-error a state that can be an error for an ok only key
    this.set_input(OK_ONLY, state.err<number>("e"), () => {});
    // @ts-expect-error a plain symbol is not a key
    this.set_input(Symbol(), 1, () => {});
    // @ts-expect-error a read only state for a writable key
    this.set_input(WRITABLE, state.ok(1), () => {});
    expectTypeOf(this.input_state(WRITABLE)).toEqualTypeOf<
      StateROSW<number> | undefined
    >();
    expectTypeOf(this.input_state(OK_ONLY)).toEqualTypeOf<
      StateROS<number> | undefined
    >();
    expectTypeOf(this.input_state(PLAIN)).toEqualTypeOf<undefined>();
  }

  /**input_state for the runtime tests*/
  state_of_writable() {
    return this.input_state(WRITABLE);
  }
}
define_element(TypeProbe);

describe("options from keys", () => {
  it("derives the options from the keys, every option optional", () => {
    expectTypeOf<ExampleSliderOptions>().toEqualTypeOf<
      BaseOptions & {
        value?: StateOrValROS<number>;
        min?: StateOrVal<number>;
        max?: StateOrVal<number>;
        step?: number;
      }
    >();
    expectTypeOf<ExampleLabelBoxOptions>().toMatchTypeOf<{
      width?: StateOrVal<number>;
      badge?: StateOrVal<string>;
    }>();
  });

  it("gives the input type of a key for options built by hand", () => {
    const key = input_key<StateOrValROSW<number>>();
    expectTypeOf<InputOf<typeof key>>().toEqualTypeOf<StateOrValROSW<number>>();
    expectTypeOf<InputOf<string>>().toBeNever();
    expectTypeOf<ExampleEditorOptions>().toEqualTypeOf<{
      access?: StateOrVal<AccessTypes>;
      min?: StateOrVal<number>;
      max?: StateOrVal<number>;
    }>();
    expectTypeOf<ExampleEditorCreateOptions["scale"]>().toEqualTypeOf<
      StateOrValROS<number> | undefined
    >();
  });

  it("applies plain value options through their keys", () => {
    const slider = example_slider({ step: 5 });
    expect(slider.querySelector("input")!.step).toBe("5");
    expect(example_override_box({ prefix: "> ", label: "a" }).textContent).toBe(
      "> a",
    );
  });
});

describe("input_state", () => {
  it("gives the state of an input, undefined for an initial value", () => {
    const probe = new TypeProbe();
    expect(probe.state_of_writable()).toBeUndefined();
    const first = state.ok_w(1);
    probe.set({ writable: first });
    expect(probe.state_of_writable()).toBe(first);
    probe.set({ writable: 2 });
    expect(probe.state_of_writable()).toBeUndefined();
  });

  it("gives the state also while the element is not in the document", () => {
    const value = state.ok_w(1);
    expect(new TypeProbe().set({ writable: value }).state_of_writable()).toBe(
      value,
    );
  });

  it("lets the slider write to the state it has now", async () => {
    const first = state.ok_w(10);
    const second = state.ok_w(20);
    const slider = attach(example_slider({ value: first, max: 100 }));
    const input = slider.querySelector("input")!;
    slider.set({ value: second });
    input.value = "70";
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(second.ok()).toBe(70);
    expect(first.ok()).toBe(10);
    //An initial value after a state is kept by the slider, nothing is written
    slider.set({ value: 5 });
    input.value = "80";
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(input.disabled).toBe(false);
    expect(second.ok()).toBe(70);
  });
});

describe("errors", () => {
  it("gives ok only inputs ok results and errorable inputs results", () => {
    const probe = new TypeProbe().set({
      ok_only: 1,
      writable: state.ok_w(2),
      errorable: state.err(nice_err("e")),
    });
    expect(probe).toBeInstanceOf(TypeProbe);
  });

  it("keeps the last good width when a state gives an error", () => {
    const width = state.from_w<number>(120);
    const box = attach(example_box({ width }));
    width.set_err(nice_err("gone"));
    expect(box.style.width).toBe("120px");
  });

  it("each input of the box handles errors its own way", () => {
    const label = state.from_w("a");
    const color = state.from_w("red");
    const box = attach(example_box({ label, color }));
    expect(box.textContent).toBe("a");
    label.set_err(nice_err("gone"));
    expect(box.textContent).toBe("⚠ gone");
    color.set_err(nice_err("gone"));
    expect(box.style.background).toBe("rgb(127, 140, 141)");
    label.set_ok("b");
    color.set_ok("red");
    expect(box.textContent).toBe("b");
    expect(box.style.background).toBe("red");
  });
});

describe("values the user changes", () => {
  it("an initial slider value is kept by the slider, the user changes it", () => {
    const slider = attach(example_slider({ value: 30, max: 100 }));
    const input = slider.querySelector("input")!;
    expect(input.disabled).toBe(false);
    expect(input.value).toBe("30");
    input.value = "60";
    input.dispatchEvent(new Event("input"));
    expect(input.value).toBe("60");
  });

  it("only a read only state disables the slider", () => {
    const slider = attach(example_slider({ value: state.ok(30) }));
    const input = slider.querySelector("input")!;
    expect(input.disabled).toBe(true);
    slider.set({ value: state.ok_w(40) });
    expect(input.disabled).toBe(false);
    slider.set({ value: 50 });
    expect(input.disabled).toBe(false);
  });

  it("a watcher shows an initial list of a group", () => {
    const group = example_group({
      items: [example_box(), example_box()],
    });
    const watcher = attach(example_watcher({ group }));
    expect(watcher.textContent).toBe("2 items, initial list");
  });
});

describe("nested subscriptions", () => {
  const setup = () => {
    const items_a = state.ok_w<ExampleBox[]>([example_box()]);
    const items_b = state.ok_w<ExampleBox[]>([example_box(), example_box()]);
    const a = example_group({ items: items_a });
    const b = example_group({ items: items_b });
    const group = state.ok_w<ExampleGroup | null>(a);
    const watcher = example_watcher({ group });
    return { items_a, items_b, a, b, group, watcher };
  };

  it("hands out the items it was given", () => {
    const { a, items_a } = setup();
    expect(a.items).toBe(items_a);
  });

  it("takes the items only at creation, other inputs can be set again", () => {
    const { a, items_a, watcher } = setup();
    attach(watcher);
    // @ts-expect-error the items are handed out, so set can not replace them
    a.set({ items: [] });
    a.set({ gap: 12 });
    expect(a.items).toBe(items_a);
    expect(a.style.gap).toBe("12px");
    expect(watcher.textContent).toBe("1 items");
  });

  it("applies the set options given to the factory with the creation inputs", () => {
    const gap = state.ok_w(6);
    const group = attach(example_group({ items: [example_box()], gap }));
    expect(group.children.length).toBe(1);
    expect(group.style.gap).toBe("6px");
    gap.set_ok(2);
    expect(group.style.gap).toBe("2px");
  });

  it("derives the options of set without the creation inputs", () => {
    expectTypeOf<ExampleGroupOptions>().toEqualTypeOf<
      BaseOptions & {
        gap?: StateOrVal<number>;
      }
    >();
    expectTypeOf<ExampleGroupCreateOptions>().toMatchTypeOf<{
      gap?: StateOrVal<number>;
      items?: StateOrVal<ExampleBox[]>;
    }>();
  });

  it("follows the list of the group", () => {
    const { items_a, watcher } = setup();
    attach(watcher);
    expect(watcher.textContent).toBe("1 items");
    items_a.set_ok([]);
    expect(watcher.textContent).toBe("0 items");
  });

  it("moves its subscription when the group is swapped", () => {
    const { items_a, items_b, b, group, watcher } = setup();
    attach(watcher);
    expect(items_a.amount()).toBe(1);
    group.set_ok(b);
    expect(items_a.amount()).toBe(0);
    expect(items_b.amount()).toBe(1);
    expect(watcher.textContent).toBe("2 items");
    group.set_ok(null);
    expect(items_b.amount()).toBe(0);
    expect(watcher.textContent).toBe("no group");
  });

  it("drops the inner subscription for a group with an initial list", () => {
    const { items_a, group, watcher } = setup();
    attach(watcher);
    group.set_ok(example_group({ items: [example_box()] }));
    expect(items_a.amount()).toBe(0);
    expect(watcher.textContent).toBe("1 items, initial list");
  });

  it("drops both subscriptions when bound to an initial group", () => {
    const { items_a, b, group, watcher } = setup();
    attach(watcher);
    watcher.set({ group: b });
    expect(group.amount()).toBe(0);
    expect(items_a.amount()).toBe(0);
    expect(watcher.textContent).toBe("2 items");
  });

  it("holds no subscriptions while disconnected and subscribes once on reconnect", () => {
    const { items_a, group, watcher } = setup();
    attach(watcher);
    watcher.remove();
    expect(items_a.amount()).toBe(0);
    expect(group.amount()).toBe(0);
    attach(watcher);
    expect(items_a.amount()).toBe(1);
    expect(group.amount()).toBe(1);
  });

  it("picks up a swap made while disconnected", () => {
    const { items_a, items_b, b, group, watcher } = setup();
    attach(watcher);
    watcher.remove();
    group.set_ok(b);
    attach(watcher);
    expect(items_a.amount()).toBe(0);
    expect(items_b.amount()).toBe(1);
    expect(watcher.textContent).toBe("2 items");
  });
});

describe("editor", () => {
  const parts = (editor: ExampleEditor) => ({
    square: editor.querySelector("example-view > div") as HTMLElement,
    input: editor.querySelector("example-slider input") as HTMLInputElement,
    label: editor.querySelector("example-box") as HTMLElement,
  });

  it("builds its children in the constructor, the slider changes the view from the start", async () => {
    const editor = attach(example_editor());
    const { square, input, label } = parts(editor);
    expect(square.style.transform).toBe("scale(1)");
    expect(input.disabled).toBe(false);
    expect(label.textContent).toBe("scale 1.00");
    input.value = "2";
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(editor.scale.ok()).toBe(2);
    expect(square.style.transform).toBe("scale(2)");
  });

  it("hands out an initial scale as a state the slider changes", async () => {
    const editor = attach(example_editor({ scale: 2 }));
    expect(editor.scale.ok()).toBe(2);
    const { square, input, label } = parts(editor);
    expect(square.style.transform).toBe("scale(2)");
    expect(input.disabled).toBe(false);
    expect(label.textContent).toBe("scale 2.00");
    input.value = "1.5";
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(editor.scale.ok()).toBe(1.5);
    expect(label.textContent).toBe("scale 1.50");
  });

  it("hands out a given state and passes it on unchanged", async () => {
    const scale = state.ok_w(1);
    const editor = attach(example_editor({ scale }));
    expect(editor.scale).toBe(scale);
    const { square, input, label } = parts(editor);
    input.value = "1.5";
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(scale.ok()).toBe(1.5);
    expect(square.style.transform).toBe("scale(1.5)");
    expect(label.textContent).toBe("scale 1.50");
  });

  it("takes the scale only at creation, the limits can be set again", () => {
    const scale = state.ok_w(1);
    const editor = attach(example_editor({ scale, max: 2 }));
    const { input } = parts(editor);
    expect(input.max).toBe("2");
    // @ts-expect-error the scale is handed out, so set can not replace it
    editor.set({ scale: 2 });
    editor.set({ max: 4 });
    expect(input.max).toBe("4");
    expect(editor.scale).toBe(scale);
    expect(parts(editor).square.style.transform).toBe("scale(1)");
  });

  it("holds no subscriptions on the scale while disconnected", () => {
    const scale = state.ok_w(1);
    const editor = attach(example_editor({ scale }));
    editor.remove();
    expect(scale.amount()).toBe(0);
  });

  it("a view without a scale uses 1", () => {
    const view = attach(example_view());
    expect((view.firstChild as HTMLElement).style.transform).toBe("scale(1)");
  });
});
