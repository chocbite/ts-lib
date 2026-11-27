import { define_element } from "#base";
import { ListField } from "#list";
import type { DepotChild } from "@chocbite/ts-lib/depot";
import state, { type StateResult } from "@chocbite/ts-lib/state";

import "./value.scss";
import { state_format } from "./kind";

const VALUE = Symbol("value");

/**List field showing the live value of the state of an entry, nothing for groups.
 * The state is only subscribed while the field is in the document*/
export class DepotValueField extends ListField {
  static element_name() {
    return "value";
  }
  static element_name_space(): string {
    return "depot";
  }

  set child(child: DepotChild<unknown>) {
    if (child.kind !== "entry") {
      this.detach_state_from_symbol(VALUE);
      this.textContent = "";
      this.classList.remove("error");
      return;
    }
    const value = state.as_state(child.value);
    const format = state_format(value);
    this.attach_state_to_symbol(
      VALUE,
      value,
      (result: StateResult<unknown>) => {
        this.classList.toggle("error", !result.ok);
        this.textContent = result.ok ? format(result.value) : result.error.nice;
      },
    );
  }
}
define_element(DepotValueField);
