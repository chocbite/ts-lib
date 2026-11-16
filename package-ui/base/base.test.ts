import { none, some, type ResultOk } from "@chocbite/ts-lib/result";
import st, {
  type StateOrVal,
  type StateOrValROS,
  type StateOrValROSW,
  type StateResult,
  type StateROSW,
} from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { ACCESSTYPESINFO, AccessTypes } from "./access";
import { Base } from "./base";
import { define_element } from "./define_element";
import { CREATE, input_key, type InputOf, type InputOptions } from "./input";
import "./index.scss";
import { BaseIntersectObserver } from "./intersect_observer";

class TestElement extends Base {
  static element_name() {
    return "element";
  }
  static element_name_space() {
    return "basetest";
  }
}
define_element(TestElement);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**Element with a state subscribed only while visible, sized so an intersection observer sees it*/
const make_element = (observer?: BaseIntersectObserver) => {
  const state = st.ok_w(1);
  const element = new TestElement();
  element.style.display = "block";
  element.style.height = "10px";
  if (observer) element.attach_to_intersect_observer(observer);
  element.attach_state(state, () => {}, true);
  return { state, element };
};

describe("Base element lifecycle", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("subscribes connected states while connected", () => {
    const state = st.ok_w(1);
    const element = new TestElement();
    element.attach_state(state, () => {});
    document.body.appendChild(element);
    expect(state.amount()).toBe(1);
    element.remove();
    expect(state.amount()).toBe(0);
  });

  it("unsubscribes visible states on disconnect without an intersection observer", () => {
    const { state, element } = make_element();
    document.body.appendChild(element);
    expect(element.is_visible).toBe(true);
    expect(state.amount()).toBe(1);
    element.remove();
    expect(element.is_visible).toBe(false);
    expect(state.amount()).toBe(0);
  });

  it("does not subscribe visible states when the observer is removed while disconnected", () => {
    const { state, element } = make_element(new BaseIntersectObserver({}));
    element.attach_to_intersect_observer();
    expect(element.is_visible).toBe(false);
    expect(state.amount()).toBe(0);
  });

  it("becomes visible when the observer is removed while connected", async () => {
    const { state, element } = make_element(
      new BaseIntersectObserver({ deffered_visible: 5000, deffered_hidden: 0 }),
    );
    document.body.appendChild(element);
    element.attach_to_intersect_observer();
    expect(element.is_visible).toBe(true);
    expect(state.amount()).toBe(1);
  });
});

describe("Base intersect observer", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("becomes visible after the visible deferral", async () => {
    const { state, element } = make_element(
      new BaseIntersectObserver({ deffered_visible: 200, deffered_hidden: 0 }),
    );
    document.body.appendChild(element);
    await wait(100);
    expect(element.is_visible).toBe(false);
    await wait(300);
    expect(element.is_visible).toBe(true);
    expect(state.amount()).toBe(1);
  });

  it("does not become visible from a pending deferred update after disconnect", async () => {
    const { state, element } = make_element(
      new BaseIntersectObserver({ deffered_visible: 200, deffered_hidden: 0 }),
    );
    document.body.appendChild(element);
    await wait(100);
    element.remove();
    await wait(300);
    expect(element.is_visible).toBe(false);
    expect(state.amount()).toBe(0);
  });

  it("defers when visible and hidden deferrals are equal", async () => {
    const { element } = make_element(
      new BaseIntersectObserver({
        deffered_visible: 300,
        deffered_hidden: 300,
      }),
    );
    document.body.appendChild(element);
    await wait(100);
    expect(element.is_visible).toBe(false);
    await wait(400);
    expect(element.is_visible).toBe(true);
  });

  it("defers by the default 250ms without deferral options", async () => {
    const { element } = make_element(new BaseIntersectObserver({}));
    document.body.appendChild(element);
    await wait(100);
    expect(element.is_visible).toBe(false);
    await wait(400);
    expect(element.is_visible).toBe(true);
  });
});

describe("Base attribute states", () => {
  it("detaching an attribute twice or attaching again does not log an error", () => {
    const element = new TestElement();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      element.attach_state_ROA_to_attribute("data-x", st.ok("a"));
      element.detach_state_from_attribute("data-x");
      element.detach_state_from_attribute("data-x");
      element.attach_state_ROA_to_attribute("data-x", st.ok("b"));
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});

/**Element with data properties and hooks that record their calls*/
class ProbeElement extends Base {
  static element_name() {
    return "probe";
  }
  static element_name_space() {
    return "basetest";
  }
  value: number = 0;
  label: string = "";
  visible_calls: [boolean, boolean][] = [];
  access_calls: AccessTypes[] = [];
  resize_calls: { width: number; height: number }[] = [];
  protected on_visible(is: boolean): void {
    this.visible_calls.push([is, this.is_connected]);
  }
  protected on_access(access: AccessTypes): void {
    this.access_calls.push(access);
  }
  protected on_resize(rect: { width: number; height: number }): void {
    this.resize_calls.push({ width: rect.width, height: rect.height });
  }
}
define_element(ProbeElement);

/**Runs the function with console.error silenced, returning the spy*/
const silent_error = (run: () => void) => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    run();
    return error.mock.calls.length;
  } finally {
    error.mockRestore();
  }
};

/**Observer that never reports the element visible, the element is kept outside its root*/
const hidden_observer = () => {
  const root = document.body.appendChild(document.createElement("div"));
  root.style.cssText = "height:10px;overflow:hidden;";
  return new BaseIntersectObserver({
    root,
    deffered_visible: 0,
    deffered_hidden: 0,
  });
};

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

describe("Base attach_state", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not subscribe before the element is connected", () => {
    const state = st.ok_w(1);
    const func = vi.fn();
    new ProbeElement().attach_state(state, func);
    expect(state.amount()).toBe(0);
    expect(func).not.toHaveBeenCalled();
  });

  it("subscribes and runs the function with the current value when attached while connected", () => {
    const state = st.ok_w(4);
    const func = vi.fn();
    const element = document.body.appendChild(new ProbeElement());
    expect(element.attach_state(state, func)).toBe(func);
    expect(state.amount()).toBe(1);
    expect(func).toHaveBeenCalledTimes(1);
    expect(func.mock.calls[0][0]).toMatchObject({ ok: true, value: 4 });
    state.set_ok(5);
    expect(func).toHaveBeenCalledTimes(2);
  });

  it("runs the function with the current value on connect", () => {
    const state = st.ok_w(3);
    const func = vi.fn();
    const element = new ProbeElement();
    element.attach_state(state, func);
    document.body.appendChild(element);
    expect(func).toHaveBeenCalledTimes(1);
    expect(func.mock.calls[0][0]).toMatchObject({ value: 3 });
  });

  it("keeps a single subscription when the element is moved in the document", () => {
    const state = st.ok_w(1);
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state(state, () => {});
    const other = document.body.appendChild(document.createElement("div"));
    other.appendChild(element);
    expect(state.amount()).toBe(1);
    element.remove();
    expect(state.amount()).toBe(0);
  });

  it("logs an error and does not subscribe twice when the same function is attached twice", () => {
    const state = st.ok_w(1);
    const element = document.body.appendChild(new ProbeElement());
    const func = () => {};
    element.attach_state(state, func);
    expect(silent_error(() => element.attach_state(state, func))).toBe(1);
    expect(state.amount()).toBe(1);
  });

  it("detach_state unsubscribes a connected function", () => {
    const state = st.ok_w(1);
    const func = vi.fn();
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state(state, func);
    element.detach_state(func);
    expect(state.amount()).toBe(0);
    state.set_ok(2);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it("detach_state of a disconnected element stops it subscribing on connect", () => {
    const state = st.ok_w(1);
    const func = () => {};
    const element = new ProbeElement();
    element.attach_state(state, func);
    element.detach_state(func);
    document.body.appendChild(element);
    expect(state.amount()).toBe(0);
  });

  it("detach_state logs an error for a function that is not attached", () => {
    const element = new ProbeElement();
    expect(silent_error(() => element.detach_state(() => {}))).toBe(1);
  });

  it("a visible state is not subscribed while the observer reports the element hidden", async () => {
    const state = st.ok_w(1);
    const element = new ProbeElement();
    element.style.cssText = "display:block;height:10px;margin-top:100px;";
    const observer = hidden_observer();
    element.attach_to_intersect_observer(observer);
    element.attach_state(state, () => {}, true);
    document.body.appendChild(element);
    await wait(50);
    expect(element.is_connected).toBe(true);
    expect(element.is_visible).toBe(false);
    expect(state.amount()).toBe(0);
  });

  it("a connected state is subscribed even while the element is hidden", async () => {
    const state = st.ok_w(1);
    const element = new ProbeElement();
    element.style.cssText = "display:block;height:10px;margin-top:100px;";
    element.attach_to_intersect_observer(hidden_observer());
    element.attach_state(state, () => {});
    document.body.appendChild(element);
    await wait(50);
    expect(state.amount()).toBe(1);
  });

  it("a visible state subscribes once the observer reports the element visible", async () => {
    const state = st.ok_w(1);
    const element = new ProbeElement();
    element.style.cssText = "display:block;height:10px;";
    element.attach_to_intersect_observer(
      new BaseIntersectObserver({ deffered_visible: 0, deffered_hidden: 0 }),
    );
    element.attach_state(state, () => {}, true);
    document.body.appendChild(element);
    expect(state.amount()).toBe(0);
    await wait(100);
    expect(element.is_visible).toBe(true);
    expect(state.amount()).toBe(1);
  });

  it("detach_state unsubscribes a visible function", () => {
    const state = st.ok_w(1);
    const func = () => {};
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state(state, func, true);
    expect(state.amount()).toBe(1);
    element.detach_state(func);
    expect(state.amount()).toBe(0);
  });
});

describe("Base visibility and connection", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("calls on_visible on connect and disconnect without an observer", () => {
    const element = new ProbeElement();
    document.body.appendChild(element);
    element.remove();
    expect(element.visible_calls.map(([is]) => is)).toEqual([true, false]);
  });

  it("does not call on_visible again when visibility does not change", () => {
    const element = document.body.appendChild(new ProbeElement());
    element.attach_to_intersect_observer();
    expect(element.visible_calls.length).toBe(1);
  });

  it("is_connected is true when on_visible runs on connect", () => {
    const element = document.body.appendChild(new ProbeElement());
    expect(element.visible_calls).toEqual([[true, true]]);
  });

  it("a state attached from on_visible while connecting is subscribed", () => {
    const state = st.ok_w(1);
    class Attacher extends ProbeElement {
      static element_name() {
        return "attacher";
      }
      protected on_visible(is: boolean): void {
        if (is) this.attach_state(state, () => {});
      }
    }
    define_element(Attacher);
    document.body.appendChild(new Attacher());
    expect(state.amount()).toBe(1);
  });

  it("intersect_observer returns the same observer every time", () => {
    const element = new ProbeElement();
    const observer = element.intersect_observer();
    expect(observer).toBeInstanceOf(BaseIntersectObserver);
    expect(element.intersect_observer()).toBe(observer);
    expect(observer.root).toBe(element);
  });

  it("switching observers while connected keeps visibility working", async () => {
    const state = st.ok_w(1);
    const element = new ProbeElement();
    element.style.cssText = "display:block;height:10px;";
    element.attach_to_intersect_observer(hidden_observer());
    element.attach_state(state, () => {}, true);
    document.body.appendChild(element);
    await wait(50);
    expect(element.is_visible).toBe(false);
    element.attach_to_intersect_observer(
      new BaseIntersectObserver({ deffered_visible: 0, deffered_hidden: 0 }),
    );
    await wait(100);
    expect(element.is_visible).toBe(true);
    expect(state.amount()).toBe(1);
  });
});

describe("Base intersect observer deferral", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("hides only after the full hidden deferral when scrolled out of the root", async () => {
    const root = document.body.appendChild(document.createElement("div"));
    root.style.cssText = "height:20px;overflow:auto;";
    const element = new ProbeElement();
    element.style.cssText = "display:block;height:10px;";
    const spacer = document.createElement("div");
    spacer.style.height = "200px";
    element.attach_to_intersect_observer(
      new BaseIntersectObserver({
        root,
        deffered_visible: 0,
        deffered_hidden: 300,
      }),
    );
    root.append(element, spacer);
    //The first observer report also starts the hidden timer, which runs out at about 300ms
    await wait(200);
    expect(element.is_visible).toBe(true);
    root.scrollTop = 100;
    //Past the first timer, but only half the hidden deferral after scrolling out
    await wait(150);
    expect(element.is_visible).toBe(true);
    await wait(300);
    expect(element.is_visible).toBe(false);
  });

  it("stays visible when hidden and shown again within the hidden deferral", async () => {
    const root = document.body.appendChild(document.createElement("div"));
    root.style.cssText = "height:20px;overflow:auto;";
    const element = new ProbeElement();
    element.style.cssText = "display:block;height:10px;";
    const spacer = document.createElement("div");
    spacer.style.height = "200px";
    element.attach_to_intersect_observer(
      new BaseIntersectObserver({
        root,
        deffered_visible: 0,
        deffered_hidden: 300,
      }),
    );
    root.append(element, spacer);
    await wait(100);
    expect(element.is_visible).toBe(true);
    root.scrollTop = 100;
    await wait(60);
    root.scrollTop = 0;
    await wait(400);
    expect(element.is_visible).toBe(true);
    expect(element.visible_calls.map(([is]) => is)).toEqual([true]);
  });
});

describe("Base opts", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("sets plain values and returns the element", () => {
    const element = new ProbeElement();
    expect(element.opts({ value: 5, label: "a" })).toBe(element);
    expect(element.value).toBe(5);
    expect(element.label).toBe("a");
  });

  it("attaches states to properties", () => {
    const state = st.ok_w(2);
    const element = document.body.appendChild(new ProbeElement());
    element.opts({ value: state });
    expect(element.value).toBe(2);
    state.set_ok(3);
    expect(element.value).toBe(3);
  });

  it("applies state values once the element connects", () => {
    const state = st.ok_w(2);
    const element = new ProbeElement().opts({ value: state });
    expect(element.value).toBe(0);
    document.body.appendChild(element);
    expect(element.value).toBe(2);
  });

  it("a later state replaces an earlier state for the same property", () => {
    const first = st.ok_w(1);
    const second = st.ok_w(10);
    const element = document.body.appendChild(new ProbeElement());
    element.opts({ value: first });
    element.opts({ value: second });
    expect(first.amount()).toBe(0);
    first.set_ok(2);
    expect(element.value).toBe(10);
  });

  it("a plain value replaces a state attached by an earlier opts call", () => {
    const state = st.ok_w(1);
    const element = document.body.appendChild(new ProbeElement());
    element.opts({ value: state });
    element.opts({ value: 7 });
    state.set_ok(2);
    expect(element.value).toBe(7);
  });

  it("set returns the element and scope runs the function with it", () => {
    const element = new ProbeElement();
    const func = vi.fn();
    expect(element.scope(func)).toBe(element);
    expect(func).toHaveBeenCalledWith(element);
    expect(element.set({})).toBe(element);
  });
});

describe("Base state to property", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("attach_state_ROA_to_prop updates the property and detach stops it", () => {
    const state = st.ok_w(1);
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_ROA_to_prop("value", state);
    expect(element.value).toBe(1);
    state.set_ok(2);
    expect(element.value).toBe(2);
    element.detach_state_from_prop("value");
    expect(state.amount()).toBe(0);
    state.set_ok(3);
    expect(element.value).toBe(2);
  });

  it("attach_state_ROA_to_prop with visible only updates while visible", async () => {
    const state = st.ok_w(1);
    const element = new ProbeElement();
    element.style.cssText = "display:block;height:10px;margin-top:100px;";
    element.attach_to_intersect_observer(hidden_observer());
    element.attach_state_ROA_to_prop("value", state, true);
    document.body.appendChild(element);
    await wait(50);
    expect(element.value).toBe(0);
  });

  it("attach_state_ROA_to_prop_map maps values and skips none", () => {
    const state = st.ok_w(1);
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_ROA_to_prop_map("label", state, (v: number) =>
      v > 0 ? some("n" + v) : none(),
    );
    expect(element.label).toBe("n1");
    state.set_ok(-1);
    expect(element.label).toBe("n1");
    state.set_ok(2);
    expect(element.label).toBe("n2");
  });

  it("attach_state_to_prop sets ok values and uses map_err for errors", () => {
    const state = st.from_w(1);
    const element = document.body.appendChild(new ProbeElement());
    const map_err = vi.fn((e: string) => (e === "skip" ? none() : some(-1)));
    element.attach_state_to_prop("value", state, map_err);
    expect(element.value).toBe(1);
    state.set_err("bad");
    expect(map_err).toHaveBeenCalledWith("bad");
    expect(element.value).toBe(-1);
    state.set_ok(4);
    expect(element.value).toBe(4);
    state.set_err("skip");
    expect(element.value).toBe(4);
  });

  it("attach_state_to_prop_map maps ok values and errors separately", () => {
    const state = st.from_w(2);
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_to_prop_map(
      "label",
      state,
      (e) => some("err " + e),
      (v: number) => (v === 0 ? none() : some("ok " + v)),
    );
    expect(element.label).toBe("ok 2");
    state.set_ok(0);
    expect(element.label).toBe("ok 2");
    state.set_err("x");
    expect(element.label).toBe("err x");
  });

  it("attaching a second state to the same property detaches the first", () => {
    const first = st.ok_w(1);
    const second = st.from_w(2);
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_ROA_to_prop("value", first);
    element.attach_state_to_prop("value", second, () => none());
    expect(first.amount()).toBe(0);
    expect(second.amount()).toBe(1);
    first.set_ok(5);
    expect(element.value).toBe(2);
  });

  it("detach_state_from_prop without an attached state does nothing", () => {
    const element = new ProbeElement();
    expect(silent_error(() => element.detach_state_from_prop("value"))).toBe(0);
  });

  it("property states subscribe and unsubscribe with connection", () => {
    const state = st.ok_w(1);
    const element = new ProbeElement();
    element.attach_state_ROA_to_prop("value", state);
    document.body.appendChild(element);
    expect(state.amount()).toBe(1);
    element.remove();
    expect(state.amount()).toBe(0);
    state.set_ok(9);
    expect(element.value).toBe(1);
  });
});

describe("Base state to attribute", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("attach_state_ROA_to_attribute sets the attribute and detach stops it", () => {
    const state = st.ok_w("a");
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_ROA_to_attribute("data-x", state);
    expect(element.getAttribute("data-x")).toBe("a");
    state.set_ok("b");
    expect(element.getAttribute("data-x")).toBe("b");
    element.detach_state_from_attribute("data-x");
    expect(state.amount()).toBe(0);
    state.set_ok("c");
    expect(element.getAttribute("data-x")).toBe("b");
  });

  it("attach_state_ROA_to_attribute_map maps values and skips none", () => {
    const state = st.ok_w(1);
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_ROA_to_attribute_map("data-x", state, (v) =>
      v > 0 ? some(String(v * 2)) : none(),
    );
    expect(element.getAttribute("data-x")).toBe("2");
    state.set_ok(0);
    expect(element.getAttribute("data-x")).toBe("2");
  });

  it("attach_state_to_attribute uses map_err for errors", () => {
    const state = st.from_w("a");
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_to_attribute("data-x", state, (e) =>
      e === "skip" ? none() : some("error " + e),
    );
    expect(element.getAttribute("data-x")).toBe("a");
    state.set_err("bad");
    expect(element.getAttribute("data-x")).toBe("error bad");
    state.set_err("skip");
    expect(element.getAttribute("data-x")).toBe("error bad");
  });

  it("attach_state_to_attribute_map maps ok values and errors", () => {
    const state = st.from_w(1);
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_to_attribute_map(
      "data-x",
      state,
      () => some("err"),
      (v) => some("v" + v),
    );
    expect(element.getAttribute("data-x")).toBe("v1");
    state.set_err("x");
    expect(element.getAttribute("data-x")).toBe("err");
  });

  it("attributes and properties with the same name do not replace each other", () => {
    const prop_state = st.ok_w(1);
    const attr_state = st.ok_w("a");
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_ROA_to_prop("label", attr_state);
    element.attach_state_ROA_to_attribute("label", attr_state);
    element.attach_state_ROA_to_prop("value", prop_state);
    expect(attr_state.amount()).toBe(2);
    element.detach_state_from_attribute("label");
    expect(attr_state.amount()).toBe(1);
  });
});

describe("Base state to symbol", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("attach_state_to_symbol subscribes the function and replaces an earlier one", () => {
    const symbol = Symbol("test");
    const first = st.ok_w(1);
    const second = st.ok_w(2);
    const func_first = vi.fn();
    const func_second = vi.fn();
    const element = document.body.appendChild(new ProbeElement());
    expect(element.attach_state_to_symbol(symbol, first, func_first)).toBe(
      element,
    );
    expect(func_first).toHaveBeenCalledTimes(1);
    element.attach_state_to_symbol(symbol, second, func_second);
    expect(first.amount()).toBe(0);
    expect(second.amount()).toBe(1);
    element.detach_state_from_symbol(symbol);
    expect(second.amount()).toBe(0);
  });

  it("different symbols are independent", () => {
    const state = st.ok_w(1);
    const element = document.body.appendChild(new ProbeElement());
    element.attach_state_to_symbol(Symbol("a"), state, () => {});
    element.attach_state_to_symbol(Symbol("a"), state, () => {});
    expect(state.amount()).toBe(2);
  });
});

describe("Base access", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("defaults to write access", () => {
    const element = new ProbeElement();
    expect(element.access).toBe(AccessTypes.Write);
    expect(element.inert).toBe(false);
  });

  it("read makes the element inert, none hides it", () => {
    const element = document.body.appendChild(new ProbeElement());
    element.access = AccessTypes.Read;
    expect(element.access).toBe(AccessTypes.Read);
    expect(element.inert).toBe(true);
    expect(getComputedStyle(element).display).not.toBe("none");
    element.access = AccessTypes.None;
    expect(element.access).toBe(AccessTypes.None);
    expect(element.getAttribute("inert")).toBe("none");
    expect(getComputedStyle(element).display).toBe("none");
  });

  it("none then read shows the element again but keeps it inert", () => {
    const element = document.body.appendChild(new ProbeElement());
    element.access = AccessTypes.None;
    element.access = AccessTypes.Read;
    expect(element.inert).toBe(true);
    expect(getComputedStyle(element).display).not.toBe("none");
  });

  it("write after none removes the inert attribute", () => {
    const element = document.body.appendChild(new ProbeElement());
    element.access = AccessTypes.None;
    element.access = AccessTypes.Write;
    expect(element.hasAttribute("inert")).toBe(false);
  });

  it("on_access runs once per change", () => {
    const element = new ProbeElement();
    element.access = AccessTypes.Read;
    element.access = AccessTypes.Read;
    element.access = AccessTypes.Write;
    expect(element.access_calls).toEqual([AccessTypes.Read, AccessTypes.Write]);
  });

  it("access can be driven by a state through opts", () => {
    const state = st.ok_w<AccessTypes>(AccessTypes.Read);
    const element = document.body.appendChild(new ProbeElement());
    element.opts({ access: state });
    expect(element.inert).toBe(true);
    state.set_ok(AccessTypes.Write);
    expect(element.inert).toBe(false);
  });

  it("the access type list has an entry for every access type", () => {
    const list = ACCESSTYPESINFO as unknown as Record<string, { name: string }>;
    for (const type of Object.values(AccessTypes))
      expect(JSON.stringify(list)).toContain(type);
  });
});

describe("Base resize observer", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("reports the size of a visible element", async () => {
    const element = new ProbeElement();
    element.style.cssText = "display:block;width:40px;height:30px;";
    document.body.appendChild(element);
    element.attach_to_resize_observer();
    await frame();
    await frame();
    expect(element.resize_calls.at(-1)).toEqual({ width: 40, height: 30 });
    expect(element.actual_size.width).toBe(40);
    element.style.width = "50px";
    await frame();
    await frame();
    expect(element.resize_calls.at(-1)).toEqual({ width: 50, height: 30 });
  });

  it("starts observing when an element attached while disconnected connects", async () => {
    const element = new ProbeElement().attach_to_resize_observer();
    element.style.cssText = "display:block;width:20px;height:10px;";
    await frame();
    expect(element.resize_calls.length).toBe(0);
    document.body.appendChild(element);
    await frame();
    await frame();
    expect(element.resize_calls.at(-1)).toEqual({ width: 20, height: 10 });
  });

  it("stops reporting after detach and falls back to the bounding box", async () => {
    const element = new ProbeElement();
    element.style.cssText = "display:block;width:40px;height:30px;";
    document.body.appendChild(element);
    element.attach_to_resize_observer();
    await frame();
    await frame();
    const calls = element.resize_calls.length;
    element.detach_from_resize_observer();
    element.style.width = "60px";
    await frame();
    await frame();
    expect(element.resize_calls.length).toBe(calls);
    expect(element.actual_size.width).toBe(60);
  });

  it("stops reporting while disconnected", async () => {
    const element = new ProbeElement();
    element.style.cssText = "display:block;width:40px;height:30px;";
    document.body.appendChild(element);
    element.attach_to_resize_observer();
    await frame();
    await frame();
    element.remove();
    const calls = element.resize_calls.length;
    element.style.width = "60px";
    await frame();
    await frame();
    expect(element.resize_calls.length).toBe(calls);
  });
});

//      ____ _____ _   _ _____
//     |  _ \_   _| \ | |  __ \
//     | |_) || | |  \| | |  | |
//     |  _ < | | | . ` | |  | |
//     | |_) || |_| |\  | |__| |
//     |____/_____|_| \_|_____/
const SET_PROBE = {
  /**Width in px, keeps the last good value on errors*/
  width: input_key<StateOrVal<number>>(),
  label: input_key<StateOrValROS<string>>(),
};
type SetProbeOptions = InputOptions<typeof SET_PROBE>;

/**Element using set, width keeps its last value on errors*/
class SetProbe extends Base {
  static element_name() {
    return "setprobe";
  }
  static element_name_space() {
    return "basetest";
  }
  constructor() {
    super();
    this.style.width = "1px";
    this.textContent = "default";
  }
  set(options: SetProbeOptions): this {
    this.set_input(SET_PROBE.width, options.width, (width) => {
      if (width.ok) this.style.width = width.value + "px";
    });
    this.set_input(SET_PROBE.label, options.label, (label) => {
      this.textContent = this.format(label.value);
    });
    return this;
  }
  protected format(label: string): string {
    return label;
  }
}
define_element(SetProbe);

const SET_PREFIX = {
  prefix: input_key<string>(),
};
type SetPrefixOptions = SetProbeOptions & InputOptions<typeof SET_PREFIX>;

/**Subclass whose override reads its own private field*/
class SetPrefix extends SetProbe {
  static element_name() {
    return "setprefix";
  }
  #prefix = "";
  set(options: SetPrefixOptions): this {
    this.set_input(SET_PREFIX.prefix, options.prefix, (prefix) => {
      this.#prefix = prefix.value;
    });
    return super.set(options);
  }
  protected format(label: string): string {
    return this.#prefix + label;
  }
}
define_element(SetPrefix);

const CREATE_PROBE = {
  /**Handed out, so given at creation*/
  items: input_key<StateOrVal<string[]>>(),
};
type CreateProbeCreateOptions = SetProbeOptions &
  InputOptions<typeof CREATE_PROBE>;

/**Element with an input given at creation, which it hands out*/
class CreateProbe extends SetProbe {
  static element_name() {
    return "createprobe";
  }
  #items: StateOrVal<string[]> = [];
  #creates = 0;
  get items() {
    return this.#items;
  }
  get creates() {
    return this.#creates;
  }
  [CREATE](options: CreateProbeCreateOptions) {
    super[CREATE](options);
    this.#creates++;
    if (options.items === undefined) return;
    this.#items = options.items;
    this.set_input(CREATE_PROBE.items, options.items, (items) => {
      this.dataset.items = items.ok ? items.value.join(",") : "error";
    });
  }
}
define_element(CreateProbe);

const CREATE_SUB = {
  /**Also given at creation, added by the subclass*/
  extra: input_key<string>(),
};
type CreateSubCreateOptions = CreateProbeCreateOptions &
  InputOptions<typeof CREATE_SUB>;

/**Subclass adding a creation input, it reads a private field of its own*/
class CreateSub extends CreateProbe {
  static element_name() {
    return "createsub";
  }
  #extra = "none";
  get extra() {
    return this.#extra;
  }
  [CREATE](options: CreateSubCreateOptions) {
    super[CREATE](options);
    this.set_input(CREATE_SUB.extra, options.extra, (extra) => {
      this.#extra = extra.value;
    });
  }
}
define_element(CreateSub);

abstract class CreateAbstract extends Base {}

describe("Base create", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });
  const attach = <T extends HTMLElement>(element: T): T =>
    document.body.appendChild(element);

  it("creates the class it is called on, with the set options applied", () => {
    const element = SetProbe.create({ width: 5, label: "a" });
    expect(element).toBeInstanceOf(SetProbe);
    expect(element.style.width).toBe("5px");
    expect(element.textContent).toBe("a");
    expect(SetProbe.create().textContent).toBe("default");
  });

  it("applies the creation inputs once, and the set options with them", () => {
    const items = st.ok_w(["a"]);
    const element = attach(CreateProbe.create({ items, width: 3 }));
    expect(element.creates).toBe(1);
    expect(element.items).toBe(items);
    expect(element.dataset.items).toBe("a");
    expect(element.style.width).toBe("3px");
    items.set_ok(["a", "b"]);
    expect(element.dataset.items).toBe("a,b");
    element.remove();
    expect(items.amount()).toBe(0);
  });

  it("set can not replace a creation input", () => {
    const items = st.ok_w(["a"]);
    const element = CreateProbe.create({ items });
    // @ts-expect-error items are given at creation, set does not take them
    element.set({ items: [] });
    expect(element.items).toBe(items);
  });

  it("a subclass adds creation inputs and can use its own fields in them", () => {
    const element = CreateSub.create({ items: ["x"], extra: "e", label: "l" });
    expect(element).toBeInstanceOf(CreateSub);
    expect(element.extra).toBe("e");
    expect(element.dataset.items).toBe("x");
    expect(element.textContent).toBe("l");
    expect(element.creates).toBe(1);
  });

  it("types the options from [CREATE] and set of the class", () => {
    const options: CreateSubCreateOptions = { items: [], extra: "e", width: 1 };
    expectTypeOf(CreateSub.create(options)).toEqualTypeOf<CreateSub>();
    //Only compiled, these would throw at runtime
    const compile_only = () => {
      // @ts-expect-error an option neither [CREATE] nor set takes
      SetProbe.create({ nope: 1 });
      // @ts-expect-error an option of the subclass on the parent
      CreateProbe.create({ extra: "e" });
      // @ts-expect-error an abstract class can not be created
      CreateAbstract.create();
    };
    expect(compile_only).toBeTypeOf("function");
  });
});

describe("Base set", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });
  const attach = <T extends HTMLElement>(element: T): T =>
    document.body.appendChild(element);

  it("applies fixed values right away", () => {
    const element = new SetProbe().set({ width: 5, label: "a" });
    expect(element.style.width).toBe("5px");
    expect(element.textContent).toBe("a");
  });

  it("applies states while connected and follows them", () => {
    const width = st.ok_w(5);
    const element = new SetProbe().set({ width });
    expect(element.style.width).toBe("1px");
    attach(element);
    expect(element.style.width).toBe("5px");
    width.set_ok(6);
    expect(element.style.width).toBe("6px");
    element.remove();
    expect(width.amount()).toBe(0);
  });

  it("leaves options that are not given unchanged", () => {
    const element = new SetProbe().set({ width: 5, label: "a" });
    element.set({ label: "b" });
    expect(element.style.width).toBe("5px");
    expect(element.textContent).toBe("b");
    element.set({});
    expect(element.textContent).toBe("b");
  });

  it("setting a state again replaces the previous state", () => {
    const first = st.ok_w(5);
    const second = st.ok_w(6);
    const element = attach(new SetProbe().set({ width: first }));
    element.set({ width: second });
    expect(first.amount()).toBe(0);
    expect(second.amount()).toBe(1);
    first.set_ok(7);
    expect(element.style.width).toBe("6px");
  });

  it("setting a fixed value detaches the previous state, also after reconnecting", () => {
    const width = st.ok_w(5);
    const element = attach(new SetProbe().set({ width }));
    element.set({ width: 9 });
    expect(width.amount()).toBe(0);
    element.remove();
    attach(element);
    expect(width.amount()).toBe(0);
    expect(element.style.width).toBe("9px");
  });

  it("a set again while disconnected subscribes only the new state on connect", () => {
    const first = st.ok_w(5);
    const second = st.ok_w(6);
    const element = attach(new SetProbe().set({ width: first }));
    element.remove();
    element.set({ width: second });
    attach(element);
    expect(first.amount()).toBe(0);
    expect(second.amount()).toBe(1);
    expect(element.style.width).toBe("6px");
  });

  it("a reused element follows only the state it was bound to last", () => {
    const states = [st.ok_w(1), st.ok_w(2), st.ok_w(3)];
    const element = attach(new SetProbe());
    for (const width of states) element.set({ width });
    expect(states.map((s) => s.amount())).toEqual([0, 0, 1]);
  });

  it("the error is up to the element", () => {
    const width = st.from_w(5);
    const element = attach(new SetProbe().set({ width }));
    width.set_err("gone");
    expect(element.style.width).toBe("5px");
  });

  it("an override can use fields of the subclass, with a fixed value or a state", () => {
    expect(new SetPrefix().set({ prefix: "p", label: "a" }).textContent).toBe(
      "pa",
    );
    const element = attach(
      new SetPrefix().set({ prefix: "p", label: st.ok("b") }),
    );
    expect(element.textContent).toBe("pb");
  });

  it("types inputs and results by the key", () => {
    const KEYS = {
      plain: input_key<number>(),
      ok_only: input_key<StateOrValROS<number>>(),
      writable: input_key<StateOrValROSW<number>>(),
      errorable: input_key<StateOrVal<number>>(),
    };
    class TypeProbe extends Base {
      static element_name() {
        return "settypeprobe";
      }
      static element_name_space() {
        return "basetest";
      }
      set(options: InputOptions<typeof KEYS>): this {
        this.set_input(KEYS.plain, options.plain, (value) => {
          expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
        });
        this.set_input(KEYS.ok_only, options.ok_only, (value) => {
          expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
        });
        this.set_input(KEYS.writable, options.writable, (value) => {
          expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
        });
        this.set_input(KEYS.errorable, options.errorable, (value) => {
          expectTypeOf(value).toEqualTypeOf<StateResult<number>>();
        });
        return this;
      }
      /**Only compiled, checks what the keys reject and what input_state gives*/
      key_types(): void {
        // @ts-expect-error a string input for a number key
        this.set_input(KEYS.ok_only, "a", () => {});
        // @ts-expect-error a state that can be an error for an ok only key
        this.set_input(KEYS.ok_only, st.err<number>("e"), () => {});
        // @ts-expect-error a read only state for a writable key
        this.set_input(KEYS.writable, st.ok(1), () => {});
        // @ts-expect-error a plain symbol is not a key
        this.set_input(Symbol(), 1, () => {});
        expectTypeOf(this.input_state(KEYS.writable)).toEqualTypeOf<
          StateROSW<number> | undefined
        >();
        expectTypeOf(this.input_state(KEYS.plain)).toEqualTypeOf<undefined>();
      }
      writable_state() {
        return this.input_state(KEYS.writable);
      }
    }
    expectTypeOf<InputOptions<typeof KEYS>>().toEqualTypeOf<{
      plain?: number;
      ok_only?: StateOrValROS<number>;
      writable?: StateOrValROSW<number>;
      errorable?: StateOrVal<number>;
    }>();
    expectTypeOf<InputOf<typeof KEYS.writable>>().toEqualTypeOf<
      StateOrValROSW<number>
    >();
    define_element(TypeProbe);
    expect(
      new TypeProbe().set({ ok_only: 1, writable: st.ok_w(2), errorable: 3 }),
    ).toBeInstanceOf(TypeProbe);

    //input_state gives the state the input has now, also while not connected
    const probe = new TypeProbe();
    expect(probe.writable_state()).toBeUndefined();
    const writable = st.ok_w(2);
    probe.set({ writable });
    expect(probe.writable_state()).toBe(writable);
    probe.set({ writable: 3 });
    expect(probe.writable_state()).toBeUndefined();
  });
});
