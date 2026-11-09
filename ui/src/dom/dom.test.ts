import { afterEach, describe, expect, it } from "vitest";
import { node_clone } from ".";

afterEach(() => {
  document.body.replaceChildren();
});

describe("node_clone", () => {
  it("deep clones an element with attributes and children", () => {
    const element = document.createElement("div");
    element.id = "root";
    element.className = "a b";
    element.innerHTML = "<span data-x='1'>Hi <b>there</b></span>text";
    const clone = node_clone(element);
    expect(clone).not.toBe(element);
    expect(clone).toBeInstanceOf(HTMLDivElement);
    expect(clone.outerHTML).toBe(element.outerHTML);
    expect(clone.isEqualNode(element)).toBe(true);
    expect(clone.querySelector("b")).not.toBe(element.querySelector("b"));
  });

  it("returns a detached clone that is independent of the original", () => {
    const element = document.body.appendChild(document.createElement("p"));
    element.textContent = "One";
    const clone = node_clone(element);
    expect(clone.isConnected).toBe(false);
    expect(clone.parentNode).toBeNull();
    clone.textContent = "Two";
    expect(element.textContent).toBe("One");
  });

  it("clones text nodes, svg elements and fragments", () => {
    const text = node_clone(document.createTextNode("Hello"));
    expect(text).toBeInstanceOf(Text);
    expect(text.data).toBe("Hello");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.appendChild(
      document.createElementNS("http://www.w3.org/2000/svg", "path"),
    );
    const svg_clone = node_clone(svg);
    expect(svg_clone).toBeInstanceOf(SVGSVGElement);
    expect(svg_clone.firstChild).toBeInstanceOf(SVGPathElement);

    const fragment = document.createDocumentFragment();
    fragment.append(document.createElement("i"), "x");
    const fragment_clone = node_clone(fragment);
    expect(fragment_clone).toBeInstanceOf(DocumentFragment);
    expect(fragment_clone.childNodes).toHaveLength(2);
    expect(fragment.childNodes).toHaveLength(2);
  });

  it("keeps the live value of inputs", () => {
    const input = document.createElement("input");
    input.setAttribute("value", "attr");
    input.value = "live";
    expect(node_clone(input).value).toBe("live");
  });
});
