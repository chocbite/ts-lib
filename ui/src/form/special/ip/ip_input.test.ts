import { IPAddress, IPVersion } from "@chocbite/ts-lib/common";
import st from "@chocbite/ts-lib/state";
import { set_cursor_end, set_selection_all } from "#selection";
import { afterEach, describe, expect, it, vi } from "vitest";
import { form_ip } from "./ip_input";

const wait = (ms: number = 10) =>
  new Promise((resolve) => setTimeout(resolve, ms));

//The parts of an element always hold a complete address in these tests, an incomplete address makes the
//focusout handler throw (tested separately), which would show up as unhandled errors in other tests
const V4 = { type: IPVersion.V4, value: new IPAddress("1.1.1.1") };
const V6 = { type: IPVersion.V6, value: new IPAddress("1:1:1:1:1:1:1:1") };

const make = (options: Parameters<typeof form_ip>[0] = V4) => {
  const change = vi.fn();
  const element = form_ip({ change, ...options });
  document.body.appendChild(element);
  const parts = () =>
    Array.from(element.querySelectorAll<HTMLDivElement>(":scope > div"));
  const before_input = (part: HTMLElement, data: string) => {
    const event = new InputEvent("beforeinput", {
      data,
      inputType: "insertText",
      cancelable: true,
      bubbles: true,
    });
    part.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const key = (target: HTMLElement, key: string) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };
  /**Paste event with the text as clipboard data*/
  const paste_event = (text: string) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    return new ClipboardEvent("paste", {
      clipboardData: data,
      cancelable: true,
      bubbles: true,
    });
  };
  return { element, change, parts, before_input, key, paste_event };
};

describe("IP input display", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows 4 empty parts for IPv4 and 8 for IPv6", () => {
    const v4 = make({ type: IPVersion.V4 });
    expect(v4.parts().length).toBe(4);
    expect(v4.element.classList.contains("ipv4")).toBe(true);
    expect(v4.element.textContent).toBe("...");
    const v6 = make({ type: IPVersion.V6 });
    expect(v6.parts().length).toBe(8);
    expect(v6.element.classList.contains("ipv6")).toBe(true);
    expect(v6.element.textContent).toBe(":::::::");
  });

  it("shows the initial value", () => {
    const { element, parts } = make({
      type: IPVersion.V4,
      value: new IPAddress("192.168.1.20"),
    });
    expect(parts().map((part) => part.textContent)).toEqual([
      "192",
      "168",
      "1",
      "20",
    ]);
    expect(element.value_as_ip.to_string()).toBe("192.168.1.20");
    expect(element.get_value.unwrap().to_string()).toBe("192.168.1.20");
  });

  it("shows IPv6 parts as hex", () => {
    const { parts } = make({
      type: IPVersion.V6,
      value: new IPAddress("fe80::1:ab"),
    });
    expect(parts().map((part) => part.textContent)).toEqual([
      "fe80",
      "0",
      "0",
      "0",
      "0",
      "0",
      "1",
      "ab",
    ]);
  });

  it("switches type when given an address of the other version", () => {
    const { element, parts } = make();
    element.value = new IPAddress("::1");
    expect(element.classList.contains("ipv6")).toBe(true);
    expect(element.classList.contains("ipv4")).toBe(false);
    expect(parts().length).toBe(8);
    expect(element.value_as_ip.to_string()).toBe("0:0:0:0:0:0:0:1");
  });

  it("keeps its warning input after the type changes", () => {
    const { element } = make();
    expect(element.querySelector("input")).not.toBeNull();
    element.value = new IPAddress("::1");
    expect(element.querySelector("input")).not.toBeNull();
  });

  it("clear empties all parts", () => {
    const { element, parts } = make();
    element.clear();
    expect(parts().every((part) => part.textContent === "")).toBe(true);
    expect(element.buffer).toBeUndefined();
  });

  it("focus focuses the first part", () => {
    const { element, parts } = make();
    element.focus();
    expect(document.activeElement).toBe(parts()[0]);
  });
});

describe("IP input committing", () => {
  afterEach(() => document.body.replaceChildren());

  it("enter commits the typed parts", async () => {
    const { element, change, parts, key } = make();
    ["10", "1", "2", "3"].forEach((text, i) => (parts()[i].textContent = text));
    key(parts()[3], "Enter");
    await wait();
    expect(change).toHaveBeenCalledOnce();
    expect((change.mock.calls[0][0] as IPAddress).to_string()).toBe("10.1.2.3");
    expect(element.buffer?.to_string()).toBe("10.1.2.3");
    expect(element.changed).toBe(true);
  });

  it("an incomplete address warns instead of throwing", () => {
    const { element, change, parts } = make({ type: IPVersion.V4 });
    parts()[0].textContent = "10";
    const enter = new KeyboardEvent("keydown", { key: "Enter" });
    expect(() => {
      element.onkeydown!(enter);
    }).not.toThrow();
    expect(change).not.toHaveBeenCalled();
  });

  it("escape reverts the typed parts", () => {
    const { parts, key } = make({
      type: IPVersion.V4,
      value: new IPAddress("10.0.0.1"),
    });
    parts()[0].textContent = "99";
    key(parts()[0], "Escape");
    expect(parts()[0].textContent).toBe("10");
  });

  it("losing focus commits the typed parts", async () => {
    const { change, parts } = make();
    ["1", "2", "3", "4"].forEach((text, i) => (parts()[i].textContent = text));
    parts()[0].focus();
    parts()[0].blur();
    await wait();
    expect((change.mock.calls[0][0] as IPAddress).to_string()).toBe("1.2.3.4");
  });

  it("moving focus between parts does not commit", async () => {
    const { change, parts } = make();
    parts()[0].textContent = "2";
    parts()[0].focus();
    parts()[1].focus();
    await wait();
    expect(change).not.toHaveBeenCalled();
    parts()[1].blur();
  });

  it("losing focus without changes does not call change", async () => {
    const { change, parts } = make();
    parts()[0].focus();
    parts()[0].blur();
    await wait();
    expect(change).not.toHaveBeenCalled();
  });

  it("losing focus without changes does not write the bound state", async () => {
    const state = st.ok_w(new IPAddress("10.0.0.1"));
    const write = vi.spyOn(state, "write");
    const { element, parts } = make();
    element.bind({ value: state });
    parts()[0].focus();
    parts()[0].blur();
    await wait();
    expect(write).not.toHaveBeenCalled();
  });

  it("pasting an address commits it", async () => {
    const { element, change, paste_event } = make();
    const event = paste_event("172.16.0.5");
    element.dispatchEvent(event);
    await wait();
    expect(event.defaultPrevented).toBe(true);
    expect((change.mock.calls[0][0] as IPAddress).to_string()).toBe(
      "172.16.0.5",
    );
  });

  it("pasting an address of the other version is ignored", async () => {
    const { element, change, paste_event } = make();
    element.dispatchEvent(paste_event("::1"));
    await wait();
    expect(change).not.toHaveBeenCalled();
  });

  it("pasting text that is not an address does not throw", () => {
    const { element, change, paste_event } = make();
    expect(() => {
      element.onpaste!(paste_event("not an ip"));
    }).not.toThrow();
    expect(change).not.toHaveBeenCalled();
  });

  it("copying gives the address as text", () => {
    const { element } = make({
      type: IPVersion.V4,
      value: new IPAddress("8.8.4.4"),
    });
    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", {
      clipboardData: data,
      cancelable: true,
    });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(data.getData("text/plain")).toBe("8.8.4.4");
  });

  it("follows and writes a bound state", async () => {
    const state = st.ok_w(new IPAddress("10.0.0.1"));
    const { element, parts, key } = make();
    element.bind({ value: state });
    expect(element.value_as_ip.to_string()).toBe("10.0.0.1");
    parts()[3].textContent = "2";
    key(parts()[3], "Enter");
    await wait();
    expect(state.ok().to_string()).toBe("10.0.0.2");
    state.set_ok(new IPAddress("10.0.0.3"));
    await wait();
    expect(parts()[3].textContent).toBe("3");
  });
});

describe("IP input typing", () => {
  afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.replaceChildren();
  });

  it("blocks non digits in IPv4 and allows hex in IPv6", () => {
    const v4 = make(V4);
    expect(v4.before_input(v4.parts()[0], "a")).toBe(true);
    expect(v4.before_input(v4.parts()[0], "1")).toBe(false);
    const v6 = make(V6);
    expect(v6.before_input(v6.parts()[0], "a")).toBe(false);
    expect(v6.before_input(v6.parts()[0], "g")).toBe(true);
  });

  it("blocks a fourth digit in an IPv4 part", () => {
    const { parts, before_input } = make();
    parts()[0].textContent = "123";
    set_cursor_end(parts()[0]);
    expect(before_input(parts()[0], "4")).toBe(true);
  });

  it("moves to the next part when a part would exceed 255", () => {
    const { parts, before_input } = make();
    parts()[0].textContent = "26";
    set_cursor_end(parts()[0]);
    before_input(parts()[0], "0");
    expect(document.activeElement).toBe(parts()[1]);
  });

  it("blocks a value above 255 in the last IPv4 part", () => {
    const { parts, before_input } = make();
    parts()[3].textContent = "26";
    set_cursor_end(parts()[3]);
    expect(before_input(parts()[3], "0")).toBe(true);
  });

  it("allows typing over the selected text of a full part", () => {
    const { parts, before_input } = make({
      type: IPVersion.V4,
      value: new IPAddress("192.168.1.1"),
    });
    set_selection_all(parts()[1]);
    expect(before_input(parts()[1], "1")).toBe(false);
  });

  it("typing a dot moves to the next part", () => {
    const { parts, before_input } = make();
    parts()[0].textContent = "10";
    set_cursor_end(parts()[0]);
    expect(before_input(parts()[0], ".")).toBe(true);
    expect(document.activeElement).toBe(parts()[1]);
  });

  it("typing a colon moves to the next part in IPv6", () => {
    const { parts, before_input } = make(V6);
    parts()[0].textContent = "fe80";
    set_cursor_end(parts()[0]);
    expect(before_input(parts()[0], ":")).toBe(true);
    expect(document.activeElement).toBe(parts()[1]);
  });

  it("blocks new lines", () => {
    const { parts } = make();
    const event = new InputEvent("beforeinput", {
      inputType: "insertParagraph",
      cancelable: true,
    });
    parts()[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("arrow left at the start of a part moves to the previous part", () => {
    const { parts, key } = make();
    set_cursor_end(parts()[1]);
    window.getSelection()!.collapse(parts()[1].firstChild, 0);
    const event = key(parts()[1], "ArrowLeft");
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(parts()[0]);
  });

  it("arrow right at the end of a part moves to the next part", () => {
    const { parts, key } = make();
    set_cursor_end(parts()[0]);
    const event = key(parts()[0], "ArrowRight");
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(parts()[1]);
  });

  it("arrow right at the end of the last IPv4 part keeps the focus there", () => {
    const { parts, key } = make();
    set_cursor_end(parts()[3]);
    key(parts()[3], "ArrowRight");
    expect(document.activeElement).toBe(parts()[3]);
  });

  it("pressing outside the parts places the cursor in the last part", () => {
    const { element, parts } = make();
    const event = new PointerEvent("pointerdown", {
      cancelable: true,
      bubbles: true,
    });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(parts()[3]);
  });
});
