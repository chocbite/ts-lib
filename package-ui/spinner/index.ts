import { Base, define_element, type BaseOptions } from "#base";
import { GREY } from "@chocbite/ts-lib/colors";
import { theme_init_variable_root } from "#theme";
import "./index.scss";

const variables = theme_init_variable_root(
  "spinners",
  "Spinner",
  "Spinner used as a placeholder for data with and unknown arrival time",
);
variables.make_variable(
  "color",
  "Dot color",
  "Color of dots in spinner",
  GREY["700"],
  GREY["300"],
  "Color",
  undefined,
);

/**Ring of twelve dots, each on an arm rotated into place, cloned for every spinner*/
const RING = document.createElement("div");
for (let i = 0; i < 12; i++)
  RING.appendChild(document.createElement("div")).appendChild(
    document.createElement("div"),
  );

/**Placeholder for data with an unknown arrival time, dots going round*/
class Spinner extends Base {
  /**Returns the name used to define the element */
  static element_name() {
    return "spinner";
  }
  /**Returns the namespace override for the element*/
  static element_name_space() {
    return "spinner";
  }

  constructor() {
    super();
    this.appendChild(RING.cloneNode(true));
  }
}

define_element(Spinner);

export type { Spinner };

/**Creates a spinner, a placeholder for data with an unknown arrival time*/
export function spinner(options: BaseOptions = {}): Spinner {
  return Spinner.create(options);
}
