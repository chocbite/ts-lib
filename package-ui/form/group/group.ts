import { define_element, input_key } from "#base";
import type { Prettify } from "@chocbite/ts-lib/common";
import {
  err_nice,
  ok,
  type NiceError,
  type ResultNice,
  type ResultOk,
} from "@chocbite/ts-lib/result";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import {
  FormElement,
  FormValue,
  FormValueWrite,
  type FormValueCreateOptions,
} from "../base";
import { form_errors } from "../errors";
import { FormGroupBase, type FormGroupBaseOptions } from "./group_base";

export type GroupExtractVals<Arr extends any[]> = Arr extends [
  infer Head,
  ...infer Tail,
]
  ? //Only elements the user changes are collected by the group, like at runtime
    Head extends FormValueWrite<infer T, infer ID>
    ? [FormValue<T, ID>, ...GroupExtractVals<Tail>]
    : [...GroupExtractVals<Tail>]
  : [];

export type GroupToKeyVal<Arr extends FormValue<any, any>[]> = {
  [K in Arr[number] as K extends FormValue<any, infer ID>
    ? [ID] extends [string]
      ? ID
      : never
    : never]: K extends FormValue<infer T, any> ? T : never;
};

/**The value of a group with the elements, by the ids of the elements the user changes*/
export type GroupValueOf<Elements extends any[]> = Prettify<
  GroupToKeyVal<GroupExtractVals<Elements>>
>;

/**True when A and B are the same type*/
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**Elements that give the group the value RT, with the same ids and value types as it was created with
 * Others are an error, as the value of the group is decided at creation*/
export type GroupElementsFor<Elements extends any[], RT extends object> =
  Same<GroupValueOf<Elements>, RT> extends true
    ? unknown
    : {
        "the elements need the ids and value types the group was created with": never;
      };

/**The value elements of a group with the value RT by id, typed by their value,
 * as an element can be replaced by another with the same id and value type*/
export type GroupValueElements<RT extends object> = {
  [K in keyof RT & string]: FormValueWrite<RT[K], K>;
};

/**Inputs of the group*/
const GROUP = {
  /**Elements, loosely typed, the options check them against the value of the group*/
  elements: input_key<StateOrVal<FormElement[]>>(),
};
/**Options of a group with values RT
 * The value of a group is the values of its elements by id, a value given to the group is given to each element as its own*/
export type FormGroupOptions<T extends object> = FormGroupBaseOptions<
  Partial<T>
>;
/**Options of a group with the value T, given the elements L*/
export type FormGroupSetOptions<
  T extends object,
  L extends FormElement[],
> = FormGroupOptions<T> & {
  /**Elements of the group, in order, those with an id are its value elements
   * Given again, they must have the same ids and value types as the elements the group was created with, as those decide its value,
   * elements in both stay where they are, new ones get a value given in the same set*/
  elements?: StateOrVal<[...L]> & GroupElementsFor<L, T>;
};
export type FormGroupCreateOptions<
  L extends FormElement[],
  ID extends string | undefined,
  T extends object,
> = FormGroupOptions<T> &
  FormValueCreateOptions<ID> & {
    /**Elements of the group, in order, their ids and value types decide the value of the group*/
    elements?: StateOrVal<[...L]>;
  };

/**Group of form elements, laying them out in columns or rows, its value is the values of the elements by id*/
class FormGroup<
  RT extends object = object,
  ID extends string | undefined = string | undefined,
  //The elements it was created with, kept for code naming the type, the value elements are typed by RT
  _Elements extends FormElement[] = FormElement[],
> extends FormGroupBase<Partial<RT>, ID> {
  static element_name() {
    return "group";
  }
  static element_name_space(): string {
    return "form";
  }

  protected _value_elements: Map<string, FormValueWrite<any, any>> = new Map();

  set<L extends FormElement[]>(options: FormGroupSetOptions<RT, L>): this {
    //Before the value, so a value given with the elements is given to them
    this.set_input(GROUP.elements, options.elements, (elements) => {
      if (elements.ok) this.#apply_elements(elements.value);
    });
    super.set(options);
    return this;
  }

  /**Shows the elements, those with an id are the value elements, an id given twice is skipped*/
  #apply_elements(elements: readonly FormElement[]) {
    const values: Map<string, FormValueWrite<any, any>> = new Map();
    const list: FormElement[] = [];
    for (const element of elements) {
      const id: unknown =
        element instanceof FormValueWrite ? element.form_id : undefined;
      if (typeof id === "string") {
        if (values.has(id)) {
          console.error(
            "Form element with form id " + id + " already exists in group",
          );
          continue;
        }
        values.set(id, element as FormValueWrite<any, any>);
      }
      list.push(element);
    }
    this.place_elements(list);
    this._value_elements = values;
  }

  /**Returns form elements indexed by their form IDs*/
  get value_elements(): GroupValueElements<RT> {
    return Object.fromEntries(
      this._value_elements,
    ) as unknown as GroupValueElements<RT>;
  }

  /**Returns value of the group, returning err if any component has no value*/
  get get_value(): ResultNice<RT> {
    const result: RT = {} as RT;
    const failed: string[] = [];
    const errors: NiceError[] = [];
    for (const [key, comp] of this._value_elements) {
      const val = comp.get_value;
      if (val.err) {
        failed.push(key);
        errors.push(val.error);
      } else result[key as keyof RT] = val.value as RT[keyof RT];
    }
    //One error naming every element without a value, with the error of each inside
    if (failed.length)
      return err_nice(form_errors.INVALID, "Elements without a valid value: " + failed.join(", "), errors);
    return ok(result);
  }

  /**Returns partial value of the group, containing all values of components that have values*/
  get value_partial(): ResultOk<Partial<RT>> {
    return ok(this.#partial());
  }

  #partial(): Partial<RT> {
    const result: Partial<RT> = {};
    for (const [key, comp] of this._value_elements) {
      const val = comp.get_value;
      if (val.err) continue;
      result[key as keyof RT] = val.value as RT[keyof RT];
    }
    return result;
  }

  /**The change listener of the group gets the values of all components that have values*/
  protected child_changed(child: FormValueWrite<any, any>): void {
    if (this._value_elements.get(child.form_id as string) === child)
      this.call_change(this.#partial());
  }

  /**Returns partial value of the group, only containing values of components where value has changed*/
  get value_changed(): ResultOk<Partial<RT>> {
    const result: Partial<RT> = {};
    for (const [key, comp] of this._value_elements) {
      const val = comp.get_value;
      if (val.err) continue;
      if (comp.changed) result[key as keyof RT] = val.value as RT[keyof RT];
    }
    return ok(result);
  }

  /**Gives each element its value from the value of the group, as an initial value*/
  protected new_value(val: Partial<RT>): void {
    for (const key in val)
      this._value_elements.get(key)?.set({ value: val[key as keyof RT] });
  }

  protected clear_value(): void {
    for (const comp of this._value_elements.values()) comp.clear();
  }
}
define_element(FormGroup);

export type { FormGroup };

/**Creates a group of form elements, its value is typed by the ids of the elements*/
export function form_group<
  L extends FormElement[],
  ID extends string | undefined = undefined,
  T extends object = GroupValueOf<L>,
>(options: FormGroupCreateOptions<L, ID, T> = {}): FormGroup<T, ID, L> {
  return FormGroup.create(options) as FormGroup<T, ID, L>;
}
