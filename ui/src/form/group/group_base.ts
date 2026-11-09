import { AccessTypes } from "#base";
import { err, ok, Option, Result } from "@chocbite/ts-lib/result";
import { FormElement, FormValue, FormValueWrite } from "../base";
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
  ? Head extends FormValue<infer T, infer ID>
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

  /**This places the group at an absolute position in one of the corners of the container*/
  set border(border: FormGroupBorderStyle | undefined) {
    this.classList.remove(
      FormGroupBorderStyle.Inset,
      FormGroupBorderStyle.Outset,
      FormGroupBorderStyle.Line,
    );
    if (border && border !== FormGroupBorderStyle.None)
      this.classList.add(border);
  }

  set max_height(height: number | undefined) {
    this.style.setProperty("--max_height", height ? height + "rem" : "none");
    if (height) this.classList.add("max_height");
    else this.classList.remove("max_height");
  }

  set embed(embed: boolean) {
    if (embed) this.classList.add("embed");
    else this.classList.remove("embed");
  }

  set value(val: Partial<RT>) {
    super.value = val;
  }

  /**Returns value of the group, returning err if any component has no value*/
  get get_value(): Result<RT, string> {
    if (this._state) return err("State based component");
    const result: RT = {} as RT;
    for (const [key, comp] of this._value_elements) {
      const val = comp.get_value;
      if (val.err) return err("Component with id " + key + " has no value");
      result[key as keyof RT] = val.value as RT[keyof RT];
    }
    return ok(result);
  }

  /**Returns partial value of the group, containing all values of components that have values*/
  get value_partial(): Result<Partial<RT>, string> {
    if (this._state) return err("State based component");
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
  get value_changed(): Result<Partial<RT>, string> {
    if (this._state) return err("State based component");
    const result: Partial<RT> = {};
    for (const [key, comp] of this._value_elements) {
      const val = comp.get_value;
      if (val.err) continue;
      if (comp.changed) result[key as keyof RT] = val.value as RT[keyof RT];
    }
    return ok(result);
  }

  protected new_value(val: RT): void {
    for (const key in val)
      if (this._value_elements.has(key))
        this._value_elements.get(key)!.value = val[key as keyof RT];
  }

  protected clear_value(): void {
    for (const comp of this._value_elements.values()) comp.clear();
  }

  protected new_error(err: string): void {
    console.error(err);
  }

  protected clear_error(): void {}

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
