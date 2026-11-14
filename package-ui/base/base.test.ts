import { none, some, type ResultOk } from "@chocbite/ts-lib/result";
import st, {
  type StateOrVal,
  type StateOrValROS,
  type StateOrValROSW,
  type StateResult,
} from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { ACCESSTYPESINFO, AccessTypes } from "./access";
import { Base } from "./base";
import { define_element } from "./define_element";
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
      new BaseIntersectObserver({ deffered_visible: 300, deffered_hidden: 300 }),
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

  it("bind returns the element and scope runs the function with it", () => {
    const element = new ProbeElement();
    const func = vi.fn();
    expect(element.scope(func)).toBe(element);
    expect(func).toHaveBeenCalledWith(element);
    expect(element.bind({})).toBe(element);
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
const BIND_WIDTH = Symbol();
const BIND_LABEL = Symbol();

interface BindProbeOptions {
  width?: StateOrVal<number>;
  label?: StateOrValROS<string>;
}

/**Element using bind, width keeps its last value on errors*/
class BindProbe extends Base {
  static element_name() {
    return "bindprobe";
  }
  static element_name_space() {
    return "basetest";
  }
  constructor() {
    super();
    this.style.width = "1px";
    this.textContent = "default";
  }
  bind(options: BindProbeOptions): this {
    this.bind_input(BIND_WIDTH, options.width, (width) => {
      if (width.ok) this.style.width = width.value + "px";
    });
    this.bind_input(BIND_LABEL, options.label, (label) => {
      this.textContent = this.format(label.value);
    });
    return this;
  }
  protected format(label: string): string {
    return label;
  }
}
define_element(BindProbe);

interface BindPrefixOptions extends BindProbeOptions {
  prefix?: string;
}

/**Subclass whose override reads its own private field*/
class BindPrefix extends BindProbe {
  static element_name() {
    return "bindprefix";
  }
  #prefix = "";
  bind(options: BindPrefixOptions): this {
    if (options.prefix !== undefined) this.#prefix = options.prefix;
    return super.bind(options);
  }
  protected format(label: string): string {
    return this.#prefix + label;
  }
}
define_element(BindPrefix);

describe("Base bind", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });
  const attach = <T extends HTMLElement>(element: T): T =>
    document.body.appendChild(element);

  it("applies fixed values right away", () => {
    const element = new BindProbe().bind({ width: 5, label: "a" });
    expect(element.style.width).toBe("5px");
    expect(element.textContent).toBe("a");
  });

  it("applies states while connected and follows them", () => {
    const width = st.ok_w(5);
    const element = new BindProbe().bind({ width });
    expect(element.style.width).toBe("1px");
    attach(element);
    expect(element.style.width).toBe("5px");
    width.set_ok(6);
    expect(element.style.width).toBe("6px");
    element.remove();
    expect(width.amount()).toBe(0);
  });

  it("leaves options that are not given unchanged", () => {
    const element = new BindProbe().bind({ width: 5, label: "a" });
    element.bind({ label: "b" });
    expect(element.style.width).toBe("5px");
    expect(element.textContent).toBe("b");
    element.bind({});
    expect(element.textContent).toBe("b");
  });

  it("binding a state again replaces the previous state", () => {
    const first = st.ok_w(5);
    const second = st.ok_w(6);
    const element = attach(new BindProbe().bind({ width: first }));
    element.bind({ width: second });
    expect(first.amount()).toBe(0);
    expect(second.amount()).toBe(1);
    first.set_ok(7);
    expect(element.style.width).toBe("6px");
  });

  it("binding a fixed value detaches the previous state, also after reconnecting", () => {
    const width = st.ok_w(5);
    const element = attach(new BindProbe().bind({ width }));
    element.bind({ width: 9 });
    expect(width.amount()).toBe(0);
    element.remove();
    attach(element);
    expect(width.amount()).toBe(0);
    expect(element.style.width).toBe("9px");
  });

  it("a rebind while disconnected subscribes only the new state on connect", () => {
    const first = st.ok_w(5);
    const second = st.ok_w(6);
    const element = attach(new BindProbe().bind({ width: first }));
    element.remove();
    element.bind({ width: second });
    attach(element);
    expect(first.amount()).toBe(0);
    expect(second.amount()).toBe(1);
    expect(element.style.width).toBe("6px");
  });

  it("a reused element follows only the state it was bound to last", () => {
    const states = [st.ok_w(1), st.ok_w(2), st.ok_w(3)];
    const element = attach(new BindProbe());
    for (const width of states) element.bind({ width });
    expect(states.map((s) => s.amount())).toEqual([0, 0, 1]);
  });

  it("the error is up to the element", () => {
    const width = st.from_w(5);
    const element = attach(new BindProbe().bind({ width }));
    width.set_err("gone");
    expect(element.style.width).toBe("5px");
  });

  it("an override can use fields of the subclass, with a fixed value or a state", () => {
    expect(new BindPrefix().bind({ prefix: "p", label: "a" }).textContent).toBe(
      "pa",
    );
    const element = attach(
      new BindPrefix().bind({ prefix: "p", label: st.ok("b") }),
    );
    expect(element.textContent).toBe("pb");
  });

  it("gives ok only inputs ok results and errorable inputs results", () => {
    const KEY = Symbol();
    class TypeProbe extends Base {
      static element_name() {
        return "bindtypeprobe";
      }
      static element_name_space() {
        return "basetest";
      }
      bind(options: {
        ok_only?: StateOrValROS<number>;
        writable?: StateOrValROSW<number>;
        errorable?: StateOrVal<number>;
      }): this {
        this.bind_input(KEY, 5, (value) => {
          expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
        });
        this.bind_input(KEY, options.ok_only, (value) => {
          expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
        });
        this.bind_input(KEY, options.writable, (value) => {
          expectTypeOf(value).toEqualTypeOf<ResultOk<number>>();
        });
        this.bind_input(KEY, options.errorable, (value) => {
          expectTypeOf(value).toEqualTypeOf<StateResult<number>>();
        });
        return this;
      }
    }
    define_element(TypeProbe);
    expect(
      new TypeProbe().bind({ ok_only: 1, writable: st.ok_w(2), errorable: 3 }),
    ).toBeInstanceOf(TypeProbe);
  });
});
