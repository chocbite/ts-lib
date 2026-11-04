const RESERVED_NAMES = new Set([
  "annotation-xml",
  "color-profile",
  "font-face",
  "font-face-src",
  "font-face-uri",
  "font-face-format",
  "font-face-name",
  "missing-glyph",
]);

const regex =
  /^[a-z](?:[\.0-9_a-z\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])*-(?:[\x2D\.0-9_a-z\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])*$/;

/**Gives more information about whats wrong with the given element name */
export const validate_element_name = (name: string) => {
  if (!name) return "Missing element name.";
  if (/[A-Z]/.test(name))
    return "Custom element names must not contain uppercase ASCII characters.";
  if (!name.includes("-"))
    return "Custom element names must contain a hyphen. Example: unicorn-cake";
  if (/^\d/i.test(name))
    return "Custom element names must not start with a digit.";
  if (/^-/i.test(name))
    return "Custom element names must not start with a hyphen.";
  // https://html.spec.whatwg.org/multipage/scripting.html#prod-potentialcustomelementname
  if (!regex.test(name)) return "Invalid element name.";
  if (RESERVED_NAMES.has(name))
    return "The supplied element name is reserved and can't be used.\nSee: https://html.spec.whatwg.org/multipage/scripting.html#valid-custom-element-name";
  return "Unknown fault";
};

let base_element_global_namespace = "";

export const set_base_element_global_namespace = (namespace: string) => {
  base_element_global_namespace = namespace + (namespace.length ? "-" : "");
};

interface ElementConstructor {
  element_name: () => string;
  element_name_space: () => string;
}

/**Generates the base name for a custom element */
export const base_element_name = (element: ElementConstructor): string => {
  const namespace = element.element_name_space();
  const check = element.element_name;
  let define_name = "";
  let runner = element;
  // @ts-expect-error Very dynamic stuff
  while (runner !== HTMLElement) {
    if (namespace !== runner.element_name_space()) break;
    const name = runner.element_name();
    runner = Object.getPrototypeOf(runner) as ElementConstructor;
    if (check === runner.element_name)
      throw new Error(
        "Element uses same name as ancestor, abstract classes should return '@abstract@'",
      );
    if (!name.length) throw new Error("Element doesn't define element name");
    if (name !== "@abstract@") define_name = "-" + name + define_name;
  }
  return base_element_global_namespace + namespace + define_name;
};

export const ELEMENT_LIST: Set<string> = new Set();

/**Defines elements inheriting from the base*/
export const define_element = (element: ElementConstructor) => {
  const namespace = element.element_name_space();
  const check = element.element_name;
  let define_name = "";
  let runner = element;
  // @ts-expect-error Very dynamic stuff
  while (runner !== HTMLElement) {
    if (namespace !== runner.element_name_space()) break;

    const name = runner.element_name();
    runner = Object.getPrototypeOf(runner) as ElementConstructor;
    if (check === runner.element_name)
      throw new Error(
        'Failed to define element "' +
          namespace +
          "-" +
          name +
          define_name +
          '" ' +
          "Element uses same name as ancestor, abstract classes should return '@abstract@'",
      );
    if (!name.length) throw new Error("Element doesn't define element name");
    if (name !== "@abstract@") define_name = "-" + name + define_name;
  }
  define_name = base_element_global_namespace + namespace + define_name;
  try {
    // @ts-expect-error Dynamic custom element definition
    customElements.define(define_name, element);
    ELEMENT_LIST.add(define_name);
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.includes("has already been used with this registry")
    ) {
      throw e;
    } else {
      throw new Error(
        'Failed to define element "' +
          define_name +
          '" ' +
          validate_element_name(define_name),
      );
    }
  }
};
