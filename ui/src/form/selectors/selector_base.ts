import { some } from "@chocbite/ts-lib/result";
import state, { type StateEnumRelated } from "@chocbite/ts-lib/state";
import type { SVGFunc } from "#svg";
import { FormValueWrite, FormValueWriteOptions } from "../base";

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

export interface FormSelectorBaseOptions<
  T,
  ID extends string | undefined,
> extends FormValueWriteOptions<T, ID> {
  /**Options for selector*/
  selections?: FormSelections<T>;
}

/**Base for number elements elements*/
export abstract class FormSelectorBase<
  RT,
  ID extends string | undefined,
> extends FormValueWrite<RT, ID> {
  /**Sets the selection options for the selector */
  abstract set selections(selections: FormSelections<RT> | undefined);

  static apply_options<RT, ID extends string | undefined>(
    element: FormSelectorBase<RT, ID>,
    options: FormSelectorBaseOptions<RT, ID>,
  ) {
    if (options.selections) element.selections = options.selections;
    super.apply_options(element, options);
  }

  //True while the selections come from the list of the bound state
  #related_list = false;

  protected state_related(related: Partial<StateEnumRelated>): void {
    if (related.list) {
      this.attach_state_to_prop_map(
        "selections",
        related.list,
        () => some([]),
        (val) => {
          return some(
            state.e.map(val, (key, val) => {
              return {
                text: val.name,
                value: key as RT,
                icon: val.icon,
              };
            }),
          );
        },
      );
    } else if (this.#related_list)
      this.detach_state_from_prop("selections").selections = undefined;
    this.#related_list = !!related.list;
  }
}
