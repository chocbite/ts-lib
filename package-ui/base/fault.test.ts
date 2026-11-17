import { NiceError } from "@chocbite/ts-lib/result";
import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Base, define_element, input_key, type BaseOptions, type InputOptions } from ".";

const BOX = {
  label: input_key<StateOrVal<string>>(),
  width: input_key<StateOrVal<number>>(),
};

class FaultBox extends Base {
  static element_name() {
    return "faultbox";
  }
  static element_name_space() {
    return "test";
  }
  inner = this.appendChild(document.createElement("div"));
  set(options: BaseOptions & InputOptions<typeof BOX>): this {
    super.set(options);
    this.set_input(BOX.label, options.label, () => {});
    this.set_input(BOX.width, options.width, () => {});
    return this;
  }
  /**Reports a fault that is not an input*/
  report(key: symbol, error: NiceError | undefined) {
    this.fault(key, error);
  }
}
define_element(FaultBox);

class AnchoredBox extends FaultBox {
  static element_name() {
    return "anchoredbox";
  }
  protected fault_anchor(): Element {
    return this.inner;
  }
}
define_element(AnchoredBox);

/**Writes its label as its text, which removes every child, like many elements do*/
class TextBox extends Base {
  static element_name() {
    return "textbox";
  }
  static element_name_space() {
    return "test";
  }
  set(options: BaseOptions & InputOptions<typeof BOX>): this {
    super.set(options);
    this.set_input(BOX.label, options.label, (label) => {
      this.textContent = label.ok ? label.value : "-";
    });
    this.set_input(BOX.width, options.width, () => {
      this.textContent = "width changed";
    });
    return this;
  }
}
define_element(TextBox);

const OFFLINE = Symbol("Connection failed");
const box = (options: InputOptions<typeof BOX> = {}) =>
  document.body.appendChild(FaultBox.create(options));
const icon_of = (element: Element) => element.querySelector("base-fault");

afterEach(() => {
  document.body.replaceChildren();
});

describe("Fault icon", () => {
  it("has no icon and no faults while the inputs are ok", () => {
    const element = box({ label: state.from_w("a") });

    expect(icon_of(element)).toBeNull();
    expect(element.faults).toEqual([]);
  });

  it("shows an icon while an input state is an error, and removes it when the state is ok", () => {
    const label = state.from_w("a");
    const element = box({ label });
    const error = new NiceError(OFFLINE, "Failed to fetch");

    label.set_err(error);
    expect(icon_of(element)).not.toBeNull();
    expect(element.faults).toEqual([error]);

    label.set_ok("b");
    expect(icon_of(element)).toBeNull();
    expect(element.faults).toEqual([]);
  });

  it("shows one icon for errors of several inputs, and keeps it while one is left", () => {
    const label = state.from_w("a");
    const width = state.from_w(1);
    const element = box({ label, width });

    label.set_err(new NiceError(OFFLINE, "label"));
    width.set_err(new NiceError(OFFLINE, "width"));
    expect(element.querySelectorAll("base-fault").length).toBe(1);
    expect(element.faults.length).toBe(2);

    label.set_ok("b");
    expect(icon_of(element)).not.toBeNull();
    expect(element.faults.map((fault) => fault.message)).toEqual(["width"]);
  });

  it("clears the fault of an input given a fixed value", () => {
    const label = state.from_w("a");
    const element = box({ label });
    label.set_err(new NiceError(OFFLINE, "label"));

    element.set({ label: "fixed" });

    expect(icon_of(element)).toBeNull();
  });

  it("shows faults the element reports itself, that are not inputs", () => {
    const element = box();
    const key = Symbol("own");

    element.report(key, new NiceError(OFFLINE, "own"));
    expect(icon_of(element)).not.toBeNull();
    element.report(key, undefined);
    expect(icon_of(element)).toBeNull();
  });

  it("keeps the icon when the element rewrites its text while applying an error", () => {
    const label = state.from_w("a");
    const element = document.body.appendChild(TextBox.create({ label }));

    label.set_err(new NiceError(OFFLINE, "label"));

    expect(icon_of(element)).not.toBeNull();
  });

  it("brings the icon back when another input rewrites the text while a fault is left", () => {
    const label = state.from_w("a");
    const width = state.from_w(1);
    const element = document.body.appendChild(TextBox.create({ label, width }));
    label.set_err(new NiceError(OFFLINE, "label"));

    width.set_ok(2);

    expect(icon_of(element)).not.toBeNull();
  });

  it("puts the icon where the element says", () => {
    const label = state.from_w("a");
    const element = document.body.appendChild(AnchoredBox.create({ label }));

    label.set_err(new NiceError(OFFLINE, "label"));

    expect(element.inner.querySelector(":scope > base-fault")).not.toBeNull();
  });

  it("makes a host that is not positioned the box of the icon, and leaves a positioned host as it is", () => {
    const label = state.from_w("a");
    const plain = box({ label });
    const placed = box({ label });
    placed.style.position = "absolute";

    label.set_err(new NiceError(OFFLINE, "label"));

    expect(getComputedStyle(plain).position).toBe("relative");
    expect(getComputedStyle(placed).position).toBe("absolute");
  });
});

describe("Fault prompt", () => {
  afterEach(() => {
    for (const panel of document.querySelectorAll("composition-panel")) (panel as HTMLElement & { close(): void }).close();
  });

  it("opens the faults prompt on a click of the icon, with the faults of the element, the click does not reach the element", async () => {
    const label = state.from_w("a");
    const width = state.from_w(1);
    const element = box({ label, width });
    const clicked = vi.fn();
    element.addEventListener("click", clicked);
    label.set_err(new NiceError(OFFLINE, "Failed to fetch"));
    width.set_err(new NiceError(Symbol("Invalid data from server"), "Expected number"));

    icon_of(element)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    //The prompt is loaded when first needed
    await vi.waitFor(() => expect(document.querySelector("composition-panel")).not.toBeNull());
    const text = document.querySelector("composition-panel")!.textContent;
    expect(text).toContain("Connection failed");
    expect(text).toContain("Invalid data from server");
    expect(clicked).not.toHaveBeenCalled();
  });

  it("keeps a pointer down on the icon from the element, so pressing it does not act on the element", () => {
    const label = state.from_w("a");
    const element = box({ label });
    const pressed = vi.fn();
    element.addEventListener("pointerdown", pressed);
    label.set_err(new NiceError(OFFLINE, "label"));

    icon_of(element)!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(pressed).not.toHaveBeenCalled();
  });
});
