import { afterEach, describe, expect, it, vi } from "vitest";
import { Base } from "./base";
import {
  base_element_name,
  define_element,
  ELEMENT_LIST,
  set_base_element_global_namespace,
  validate_element_name,
} from "./define_element";

describe("define_element", () => {
  it("reports a name used twice clearly, whatever the browser's error message", () => {
    class First extends Base {
      static element_name() {
        return "twice";
      }
      static element_name_space() {
        return "definetest";
      }
    }
    define_element(First);
    class Second extends Base {
      static element_name() {
        return "twice";
      }
      static element_name_space() {
        return "definetest";
      }
    }
    //Firefox wording, Chromium wording is different
    const define = vi
      .spyOn(customElements, "define")
      .mockImplementation(() => {
        throw new DOMException(
          "CustomElementRegistry.define: 'definetest-twice' has already been defined as a custom element",
          "NotSupportedError",
        );
      });
    try {
      expect(() => define_element(Second)).toThrow(/already/);
    } finally {
      define.mockRestore();
    }
  });
});

abstract class Abstract extends Base {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space() {
    return "nametest";
  }
}

class Leaf extends Abstract {
  static element_name() {
    return "leaf";
  }
}

describe("Element names", () => {
  afterEach(() => {
    set_base_element_global_namespace("");
  });

  it("joins the namespace and element names, skipping abstract classes", () => {
    class Child extends Leaf {
      static element_name() {
        return "child";
      }
    }
    expect(base_element_name(Leaf)).toBe("nametest-leaf");
    expect(base_element_name(Child)).toBe("nametest-leaf-child");
  });

  it("a new namespace restarts the name", () => {
    class Other extends Leaf {
      static element_name() {
        return "other";
      }
      static element_name_space() {
        return "othertest";
      }
    }
    expect(base_element_name(Other)).toBe("othertest-other");
  });

  it("defines the element under the generated name and lists it", () => {
    class Defined extends Abstract {
      static element_name() {
        return "defined";
      }
    }
    define_element(Defined);
    expect(customElements.get("nametest-defined")).toBe(Defined);
    expect(ELEMENT_LIST.has("nametest-defined")).toBe(true);
    expect(document.createElement("nametest-defined")).toBeInstanceOf(Defined);
  });

  it("prefixes the global namespace", () => {
    set_base_element_global_namespace("app");
    class Prefixed extends Abstract {
      static element_name() {
        return "prefixed";
      }
    }
    expect(base_element_name(Prefixed)).toBe("app-nametest-prefixed");
    define_element(Prefixed);
    expect(customElements.get("app-nametest-prefixed")).toBe(Prefixed);
  });

  it("an empty global namespace adds no prefix", () => {
    set_base_element_global_namespace("app");
    set_base_element_global_namespace("");
    expect(base_element_name(Leaf)).toBe("nametest-leaf");
  });

  it("throws when a class does not override the name of its parent", () => {
    class Same extends Leaf {}
    expect(() => base_element_name(Same)).toThrow(/same name as ancestor/);
    expect(() => define_element(Same)).toThrow(/same name as ancestor/);
  });

  it("throws when a class has an empty name", () => {
    class Empty extends Abstract {
      static element_name() {
        return "";
      }
    }
    expect(() => define_element(Empty)).toThrow(/doesn't define element name/);
  });

  it("throws when the same class is defined twice under another name", () => {
    class Twice extends Abstract {
      static element_name() {
        return "classtwice";
      }
    }
    define_element(Twice);
    set_base_element_global_namespace("again");
    expect(() => define_element(Twice)).toThrow(/already defined as/);
  });

  it("explains an invalid name", () => {
    class Upper extends Abstract {
      static element_name() {
        return "Upper";
      }
    }
    expect(() => define_element(Upper)).toThrow(/uppercase/);
  });
});

describe("validate_element_name", () => {
  it("names the problem with an invalid name", () => {
    expect(validate_element_name("")).toMatch(/Missing/);
    expect(validate_element_name("aB-c")).toMatch(/uppercase/);
    expect(validate_element_name("abc")).toMatch(/hyphen/);
    expect(validate_element_name("1a-b")).toMatch(/digit/);
    expect(validate_element_name("-ab")).toMatch(/start with a hyphen/);
    expect(validate_element_name("a-b c")).toMatch(/Invalid/);
    expect(validate_element_name("font-face")).toMatch(/reserved/);
  });
});
