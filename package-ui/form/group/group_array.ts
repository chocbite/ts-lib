import { define_element, input_key, type InputOptions } from "#base";
import {
  material_chevron_left_rounded,
  material_chevron_right_rounded,
  material_unfold_less_rounded,
  material_unfold_more_rounded,
} from "#icons";
import {
  err_nice,
  ok,
  type NiceError,
  type ResultNice,
  type ResultOk,
} from "@chocbite/ts-lib/result";
import type { StateOrVal, StateOrValROS } from "@chocbite/ts-lib/state";
import { FormValueWrite, type FormValueCreateOptions } from "../base";
import { form_errors } from "../errors";
import { FormGroupBase, type FormGroupBaseOptions } from "./group_base";
import "./group_array.scss";

/**Inputs of the array group*/
const GROUP_ARRAY = {
  /**Items, loosely typed, the options type them*/
  elements: input_key<StateOrVal<FormValueWrite<any, any>[]>>(),
  /**Shows a bar over the items, with which the user shows one item at a time or all of them, false by default*/
  foldable: input_key<StateOrVal<boolean>>(),
  /**One item at a time when foldable, true by default, the user changes it with the bar
   * An initial value is how it starts, a writable state is written, a read only state locks it*/
  folded: input_key<StateOrValROS<boolean>>(),
  /**Index of the item shown while folded, 0 by default, the user changes it with the bar, past the end the last is shown
   * An initial value is where it starts, a writable state is written, a read only state locks it,
   * it follows the shown item when items are put in or taken out before it*/
  index: input_key<StateOrValROS<number>>(),
};
/**Options of an array group with items of the value T*/
export type FormGroupArrayOptions<T> = FormGroupBaseOptions<T[]> &
  InputOptions<Omit<typeof GROUP_ARRAY, "elements">> & {
  /**Items of the group in order, value elements of T, its value is their values
   * The instances are kept, items in the old and the new list stay where they are,
   * so a field the user is typing in keeps the focus, new items get a value given in the same set*/
  elements?: StateOrVal<FormValueWrite<T, any>[]>;
};
export type FormGroupArrayCreateOptions<
  T,
  ID extends string | undefined,
> = FormGroupArrayOptions<T> & FormValueCreateOptions<ID>;

/**Group of items laid out in columns or rows, its value is the values of the items in order
 * The items are value elements of one value type, given by the user of the group, which keeps the instances*/
class FormGroupArray<
  T,
  ID extends string | undefined = string | undefined,
> extends FormGroupBase<T[], ID> {
  static element_name() {
    return "grouparray";
  }
  static element_name_space(): string {
    return "form";
  }

  #items: FormValueWrite<T, any>[] = [];
  #has: Set<FormValueWrite<T, any>> = new Set();

  #foldable: boolean = false;
  #folded: boolean = true;
  /**Index of the item shown while folded, as given, it can be past the end*/
  #index: number = 0;
  /**The item shown while folded, the index follows it when items change*/
  #shown?: FormValueWrite<T, any>;
  /**The item the focus was last in while unfolded, folding shows it*/
  #focused?: FormValueWrite<T, any>;
  #bar: HTMLDivElement = document.createElement("div");
  /**One field paging the items, like a stepper, the arrows at its ends and the place of the shown item between them*/
  #pager: HTMLDivElement = this.#bar.appendChild(document.createElement("div"));
  #prev: SVGSVGElement = this.#pager.appendChild(
    material_chevron_left_rounded(),
  );
  #count: HTMLSpanElement = this.#pager.appendChild(
    document.createElement("span"),
  );
  #place: HTMLSpanElement = this.#count.appendChild(
    document.createElement("span"),
  );
  #of: HTMLSpanElement = this.#count.appendChild(document.createElement("span"));
  #next: SVGSVGElement = this.#pager.appendChild(
    material_chevron_right_rounded(),
  );
  /**How many items there are, in place of the pager while unfolded*/
  #label: HTMLDivElement = this.#bar.appendChild(document.createElement("div"));
  #toggle: HTMLSpanElement = this.#bar.appendChild(
    document.createElement("span"),
  );
  /**What the toggle shows now, its icon is only made again when it changes*/
  #toggle_folded?: boolean;

  constructor() {
    super();
    this.#bar.className = "fold-bar";
    this.#pager.className = "fold-pager";
    this.#pager.tabIndex = 0;
    this.#prev.classList.add("fold-prev");
    this.#next.classList.add("fold-next");
    this.#count.className = "fold-count";
    this.#label.className = "fold-label";
    this.#toggle.className = "fold-toggle";
    this.#toggle.tabIndex = 0;
    this.#prev.onclick = () => this.#page(-1);
    this.#next.onclick = () => this.#page(1);
    this.#pager.onkeydown = (e) => {
      if (e.key === "ArrowLeft") this.#page(-1);
      else if (e.key === "ArrowRight") this.#page(1);
      else if (e.key === "Home") this.#page(-Infinity);
      else if (e.key === "End") this.#page(Infinity);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    this.#toggle.onclick = () => this.#user_fold(!this.#folded);
    this.#toggle.onkeydown = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      this.#user_fold(!this.#folded);
    };
    //Folding shows the item the focus was last in
    this.addEventListener("focusin", (e) => {
      if (!this.#foldable || this.#folded) return;
      let node = e.target as Node | null;
      while (node && node.parentNode !== this) node = node.parentNode;
      if (this.#has.has(node as FormValueWrite<T, any>))
        this.#focused = node as FormValueWrite<T, any>;
    });
  }

  set(options: FormGroupArrayOptions<T>): this {
    //Before the items, so they are shown the way they should at once
    this.set_input(GROUP_ARRAY.foldable, options.foldable, (foldable) => {
      this.#foldable = foldable.ok && foldable.value;
      this.#render();
    });
    this.set_input(GROUP_ARRAY.folded, options.folded, (folded) => {
      this.#folded = folded.value;
      this.#render();
    });
    this.set_input(GROUP_ARRAY.index, options.index, (index) => {
      this.#index = index.value;
      this.#render();
    });
    //Before the value, so a value given with the items is given to them
    this.set_input(GROUP_ARRAY.elements, options.elements, (elements) => {
      if (elements.ok) this.#apply_items(elements.value);
    });
    super.set(options);
    //Only a read only state can not be changed by the user
    const folded = this.input_state(GROUP_ARRAY.folded);
    this.#toggle.classList.toggle("disabled", !!folded && !folded.writable);
    this.#render();
    return this;
  }

  /**Shows the items, an item given twice is shown once, at its first place
   * The index follows the shown item, so the user stays at the same item*/
  #apply_items(items: readonly FormValueWrite<T, any>[]) {
    this.#has = new Set(items);
    this.#items = [...this.#has];
    const shown = this.#shown;
    if (shown && this.#has.has(shown)) {
      const index = this.#items.indexOf(shown);
      if (index !== this.#clamped()) this.#follow_index(index);
    }
    this.#render();
  }

  /**The index of the shown item, within the items*/
  #clamped(): number {
    const last = Math.max(0, this.#items.length - 1);
    return Math.min(last, Math.max(0, Math.round(this.#index) || 0));
  }

  /**Moves the index with the item it shows, written to a writable state, a read only state keeps its index*/
  #follow_index(index: number) {
    const state = this.input_state(GROUP_ARRAY.index);
    if (state && !state.writable) return;
    this.#index = index;
    void state?.write?.(index);
  }

  /**The user shows another item, written to a writable state, kept for an initial value, nothing for a read only state*/
  #user_index(index: number) {
    const state = this.input_state(GROUP_ARRAY.index);
    if (!state) {
      this.#index = index;
      this.#render();
    } else if (state.writable) void state.write?.(index);
  }

  /**Pages by the step, stopping at the first and the last item, an infinite step goes to the end*/
  #page(step: number) {
    if (!this.#folded || this.#items.length === 0) return;
    const from = this.#clamped();
    const index = Math.min(this.#items.length - 1, Math.max(0, from + step));
    if (index !== from) this.#user_index(index);
  }

  /**The user folds or unfolds, folding shows the item the focus was last in*/
  #user_fold(folded: boolean) {
    const state = this.input_state(GROUP_ARRAY.folded);
    if (state && !state.writable) return;
    const focused = this.#focused;
    this.#focused = undefined;
    if (folded && focused && this.#has.has(focused))
      this.#user_index(this.#items.indexOf(focused));
    if (!state) {
      this.#folded = folded;
      this.#render();
    } else void state.write?.(folded);
  }

  /**Shows the bar and the items that are shown, while folded the others are out of the document, so they cost nothing*/
  #render() {
    const items = this.#items;
    const index = this.#clamped();
    this.#shown = items[index];
    if (!this.#foldable) {
      this.#bar.remove();
      this.place_elements(items);
      return;
    }
    if (this.#bar.parentNode !== this)
      this.insertBefore(this.#bar, this.firstChild);
    const folded = this.#folded;
    this.place_elements(
      folded ? (this.#shown ? [this.#shown] : []) : items,
      this.#bar,
    );
    this.classList.toggle("folded", folded);
    const count = items.length;
    //Paging while folded, the number of items while unfolded or without items
    const paging = folded && count > 0;
    this.#pager.hidden = !paging;
    this.#label.hidden = paging;
    if (paging) {
      this.#place.textContent = String(index + 1);
      this.#of.textContent = " / " + count;
    } else
      this.#label.textContent =
        count === 0 ? "No entries" : count === 1 ? "1 entry" : count + " entries";
    const index_state = this.input_state(GROUP_ARRAY.index);
    const locked = !!index_state && !index_state.writable;
    this.#prev.classList.toggle("disabled", locked || index === 0);
    this.#next.classList.toggle("disabled", locked || index >= count - 1);
    //Nothing to fold without items
    this.#toggle.hidden = count === 0;
    if (this.#toggle_folded !== folded) {
      this.#toggle_folded = folded;
      this.#toggle.title = folded ? "Show all" : "Show one at a time";
      this.#toggle.replaceChildren(
        folded ? material_unfold_more_rounded() : material_unfold_less_rounded(),
      );
    }
  }

  /**The items of the group, in order*/
  get elements(): FormValueWrite<T, any>[] {
    return [...this.#items];
  }

  /**The values of the items in order, an error naming the indexes of the items without a value, with the error of each inside*/
  get get_value(): ResultNice<T[]> {
    const values: T[] = [];
    const failed: number[] = [];
    const errors: NiceError[] = [];
    for (let index = 0; index < this.#items.length; index++) {
      const value = this.#items[index].get_value;
      if (value.ok) values.push(value.value);
      else {
        failed.push(index);
        errors.push(value.error);
      }
    }
    if (failed.length)
      return err_nice(
        form_errors.INVALID,
        "Items without a valid value at index " + failed.join(", "),
        errors,
      );
    return ok(values);
  }

  /**The values of the items that have one, in order, without gaps for those that have none*/
  get value_partial(): ResultOk<T[]> {
    return ok(this.#partial());
  }

  #partial(): T[] {
    const values: T[] = [];
    for (const item of this.#items) {
      const value = item.get_value;
      if (value.ok) values.push(value.value);
    }
    return values;
  }

  /**The change listener of the group gets the values of the items that have one*/
  protected child_changed(child: FormValueWrite<any, any>): void {
    if (this.#has.has(child as FormValueWrite<T, any>))
      this.call_change(this.#partial());
  }

  /**Gives each item its value by position, as an initial value, values without an item are left out*/
  protected new_value(value: T[]): void {
    const count = Math.min(value.length, this.#items.length);
    for (let index = 0; index < count; index++)
      this.#items[index].set({ value: value[index] });
  }

  protected clear_value(): void {
    for (const item of this.#items) item.clear();
  }
}
define_element(FormGroupArray);

export type { FormGroupArray };

/**Creates an array group, its value is the values of its items in order, typed by the items or by T
 * The items are given by the user of the group with set({ elements }), which keeps the instances*/
export function form_group_array<T, ID extends string | undefined = undefined>(
  options: FormGroupArrayCreateOptions<T, ID> = {},
): FormGroupArray<T, ID> {
  //create can not carry the value type of a generic class, the options are checked by this function
  return FormGroupArray.create(options as never) as FormGroupArray<T, ID>;
}
