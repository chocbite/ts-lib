import { AccessTypes, input_key, type InputOptions } from "#base";
import {
  err_nice,
  ok,
  type NiceError,
  type Option,
  type ResultNice,
  type ResultOk,
} from "@chocbite/ts-lib/result";
import { form_errors } from "../errors";
import type { StateOrVal } from "@chocbite/ts-lib/state";
import {
  FormElement,
  FormValue,
  FormValueWrite,
  type FormValueWriteOptions,
} from "../base";
import "./group_base.scss";

/**Different border styles for the component group*/
export const FormGroupBorderStyle = {
  None: "none",
  Inset: "inset",
  Outset: "outset",
  Line: "line",
} as const;
export type FormGroupBorderStyle =
  (typeof FormGroupBorderStyle)[keyof typeof FormGroupBorderStyle];

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

export type GroupValueElements<Elements extends FormElement[]> = {
  [Element in Elements[number] as Element extends FormValueWrite<any, infer ID>
    ? [ID] extends [string]
      ? ID
      : never
    : never]: Element;
};

/**Inputs of groups*/
const GROUP_BASE = {
  /**Border around the group, none by default*/
  border: input_key<StateOrVal<FormGroupBorderStyle>>(),
  /**Removes the padding, so groups in groups do not build up padding*/
  embed: input_key<StateOrVal<boolean>>(),
  /**Highest height in rem, it scrolls beyond, 0 for no limit*/
  max_height: input_key<StateOrVal<number>>(),
};
/**Options of a group with values RT
 * The value of a group is the values of its elements by id, a value given to the group is given to each element as its own*/
export type FormGroupBaseOptions<RT extends object> = FormValueWriteOptions<
  Partial<RT>
> &
  InputOptions<typeof GROUP_BASE>;

export abstract class FormGroupBase<
  RT extends object,
  ID extends string | undefined,
  Elements extends FormElement[] = FormElement[],
> extends FormValueWrite<Partial<RT>, ID> {
  static element_name() {
    return "@abstract@";
  }
  static element_name_space(): string {
    return "form";
  }

  protected _value_elements: Map<string, FormValueWrite<any, any>> = new Map();

  /**Returns form elements indexed by their form IDs*/
  get value_elements(): GroupValueElements<Elements> {
    return Object.fromEntries(
      this._value_elements,
    ) as unknown as GroupValueElements<Elements>;
  }

  set(options: FormGroupBaseOptions<RT>): this {
    super.set(options);
    this.set_input(GROUP_BASE.border, options.border, (border) => {
      this.classList.remove(
        FormGroupBorderStyle.Inset,
        FormGroupBorderStyle.Outset,
        FormGroupBorderStyle.Line,
      );
      if (border.ok && border.value !== FormGroupBorderStyle.None)
        this.classList.add(border.value);
    });
    this.set_input(GROUP_BASE.max_height, options.max_height, (height) => {
      const max = height.ok ? height.value : 0;
      this.style.setProperty("--max_height", max ? max + "rem" : "none");
      this.classList.toggle("max_height", max > 0);
    });
    this.set_input(GROUP_BASE.embed, options.embed, (embed) => {
      this.classList.toggle("embed", embed.ok && embed.value);
    });
    return this;
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

  /**Gives each element its value from the value of the group, as a fixed value it starts from*/
  protected new_value(val: RT): void {
    for (const key in val)
      this._value_elements.get(key)?.set({ value: val[key as keyof RT] });
  }

  protected clear_value(): void {
    for (const comp of this._value_elements.values()) comp.clear();
  }

  protected state_related(_related: Option<{}>): void {}

  protected on_access(access: AccessTypes): void {
    switch (access) {
      case AccessTypes.Read: {
        this.tabIndex = 0;
        this.onfocus = () => document.body.focus();
        break;
      }
      case AccessTypes.Write: {
        this.removeAttribute("tabIndex");
        this.onfocus = null;
        break;
      }
    }
  }
}
