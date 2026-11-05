import { define_element } from "#base";
import {
  FormSelectorBase,
  type FormSelectorBaseOptions,
  type FormSelectorOption,
} from "../selector_base";
import "./toggle_button.scss";

export interface FormToggleButtonSelection {
  top: HTMLDivElement;
  bot: HTMLDivElement;
}

/**Toggle buttons, displays all options in a multi toggler*/
export class FormToggleButton<
  RT,
  ID extends string | undefined,
> extends FormSelectorBase<RT, ID> {
  /**Returns the name used to define the element*/
  static element_name() {
    return "togglebutton";
  }
  static element_name_space(): string {
    return "form";
  }

  #map: Map<RT, FormToggleButtonSelection> = new Map();
  #values: RT[] = [];
  #selected: number = -1;

  focus(options?: FocusOptions): void {
    (this.firstElementChild as HTMLElement | null)?.focus(options);
  }

  set selections(selections: FormSelectorOption<RT>[] | undefined) {
    if (this.#map.size > 0) {
      this.#map.clear();
      this.#values = [];
      this.#selected = -1;
      this.replaceChildren();
    }
    for (let i = 0; selections && i < selections.length; i++) {
      const { value } = selections[i];
      this.#map.set(value, this.#add_selection(selections[i]));
      this.#values.push(selections[i].value);
    }
    if (this.buffer !== undefined) this.new_value(this.buffer);
  }

  #add_selection(selection: FormSelectorOption<RT>) {
    const top = this.appendChild(document.createElement("div"));
    top.tabIndex = 0;
    const bot = this.appendChild(document.createElement("div"));
    if (selection.icon) {
      top.appendChild(selection.icon());
      bot.textContent = selection.text;
    } else top.textContent = selection.text;
    const click = () => {
      top.appendChild(this.warn_input);
      this.set_value_check(selection.value);
    };
    top.onclick = click;
    bot.onclick = click;
    top.onkeydown = (e) => {
      if (e.key === " " || e.key === "Enter") click();
      else if (e.key === "ArrowRight") this.#select_adjacent(true);
      else if (e.key === "ArrowLeft") this.#select_adjacent(false);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    return { top, bot };
  }

  /**Selects the previous or next selection in the element
   * @param dir false is next true is previous*/
  #select_adjacent(dir: boolean) {
    const sel = this.#map.get(this.#values[this.#selected]);
    if (sel) sel.top.appendChild(this.warn_input);
    const y = Math.min(
      this.#values.length - 1,
      Math.max(0, dir ? this.#selected + 1 : this.#selected - 1),
    );
    if (y !== this.#selected) this.set_value_check(this.#values[y]);
  }

  protected new_value(value: RT): void {
    const prev = this.#map.get(this.#values[this.#selected]);
    if (prev) {
      prev.top.classList.remove("selected");
      prev.bot.classList.remove("selected");
    }
    const opt = this.#map.get(value)!;
    if (opt) {
      opt.top.classList.add("selected");
      opt.bot.classList.add("selected");
      this.#selected = this.#values.indexOf(value);
      if (this.contains(document.activeElement)) {
        opt.top.focus();
      }
    }
  }

  protected clear_value(): void {
    const prev = this.#map.get(this.#values[this.#selected]);
    if (prev) {
      prev.top.classList.remove("selected");
      prev.bot.classList.remove("selected");
    }
  }

  protected new_error(_val: string): void {}

  protected clear_error(): void {}
}
define_element(FormToggleButton);

/**Creates a toggle button form element */
export function form_toggle_button<RT, ID extends string | undefined>(
  options?: FormSelectorBaseOptions<RT, ID>,
): FormToggleButton<RT, ID> {
  const togg = new FormToggleButton<RT, ID>(options?.id);
  if (options) FormSelectorBase.apply_options(togg, options);
  return togg;
}
