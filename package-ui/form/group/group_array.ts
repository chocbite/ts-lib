import { define_element, input_key } from "#base";
import {
  err_nice,
  ok,
  type NiceError,
  type ResultNice,
  type ResultOk,
} from "@chocbite/ts-lib/result";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import { FormValueWrite, type FormValueCreateOptions } from "../base";
import { form_errors } from "../errors";
import { FormGroupBase, type FormGroupBaseOptions } from "./group_base";

/**Inputs of the array group*/
const GROUP_ARRAY = {
  /**Items, loosely typed, the options type them*/
  elements: input_key<StateOrVal<FormValueWrite<any, any>[]>>(),
};
/**Options of an array group with items of the value T*/
export type FormGroupArrayOptions<T> = FormGroupBaseOptions<T[]> & {
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

  set(options: FormGroupArrayOptions<T>): this {
    //Before the value, so a value given with the items is given to them
    this.set_input(GROUP_ARRAY.elements, options.elements, (elements) => {
      if (elements.ok) this.#apply_items(elements.value);
    });
    super.set(options);
    return this;
  }

  /**Shows the items, an item given twice is shown once, at its first place*/
  #apply_items(items: readonly FormValueWrite<T, any>[]) {
    this.#has = new Set(items);
    this.#items = [...this.#has];
    this.place_elements(this.#items);
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
