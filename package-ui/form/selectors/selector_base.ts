import { input_key } from "#base";
import state, {
  type State,
  type StateEnumRelated,
  type StateOrVal,
} from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import {
  FormSetting,
  FormValueWrite,
  type FormValueCreateOptions,
  type FormValueWriteOptions,
} from "../base";

export interface FormSelectorOption<RT> {
  /**Value to set when option is selected */
  value: RT;
  /**Text for selection */
  text: string;
  /**Icon to display for option*/
  icon?: SVGFunc;
}

/**Selection options for a form selector */
export type FormSelections<T> = FormSelectorOption<T>[];

/**Inputs of selectors, loosely typed as selectors are generic in their value*/
const SELECTOR = {
  selections: input_key<StateOrVal<FormSelections<any>>>(),
};
/**The list of an enum value state, followed while no selections are given*/
/**Value of the list state of an enum value state*/
type EnumList =
  StateEnumRelated["list"] extends State<infer L, any, any> ? L : never;
const SELECTOR_RELATED = {
  list: input_key<StateOrVal<EnumList | null>>(),
};

/**Options of a selector with selections of RT, and a value V, which is one of them unless the selector picks several*/
export interface FormSelectorOptions<RT, V = RT> extends FormValueWriteOptions<V> {
  /**Choices of the selector, not given the choices of an enum value state are used, an error shows none*/
  selections?: StateOrVal<FormSelections<RT>>;
}
export type FormSelectorCreateOptions<
  RT,
  ID extends string | undefined,
  V = RT,
> = FormSelectorOptions<RT, V> & FormValueCreateOptions<ID>;

/**Base for selectors, choosing a value from a list of selections of RT
 * The value V is one of them, or for a selector picking several, an array of them*/
export abstract class FormSelectorBase<
  RT,
  ID extends string | undefined = string | undefined,
  V = RT,
> extends FormValueWrite<V, ID> {
  #selections = new FormSetting<FormSelections<RT>>((selections) =>
    this.apply_selections(selections),
  );

  set(options: FormSelectorOptions<RT, V>): this {
    super.set(options);
    this.set_input(SELECTOR.selections, options.selections, (selections) =>
      this.#selections.input(selections.ok ? selections.value : undefined),
    );
    return this;
  }

  /**Shows the selections that count now, undefined for none*/
  protected abstract apply_selections(
    selections: FormSelections<RT> | undefined,
  ): void;

  protected state_related(related: Partial<StateEnumRelated>): void {
    this.follow_related(SELECTOR_RELATED.list, related.list, (list) =>
      this.#selections.related(
        list
          ? state.e.map(list, (key, val) => ({
              text: val.name,
              value: key as RT,
              icon: val.icon,
            }))
          : undefined,
      ),
    );
  }
}
