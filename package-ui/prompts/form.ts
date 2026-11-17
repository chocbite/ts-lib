import { sleep, type Prettify } from "@chocbite/ts-lib/common";
import form, {
  FormElement,
  FormValue,
  FormValueWrite,
  type FormGroup,
} from "#form";
import { none, some, type Option } from "@chocbite/ts-lib/result";
import { open_prompt } from "./shared";

interface PromptFormOptions {
  /**Columns for form, true is everything in one columns, just a number will make repeating columns of minimum that rem width, an array will make exactly that many colums with specified rem widths */
  form_column?: true | string | string[];
  /**Rows for form, true is everything in one row, just a number will make repeating rows of minimum that rem height, an array will make exactly that many rows with specified rem heights */
  form_row?: true | string | string[];
  /**Columns for submit buttons, true is everything in one columns, just a number will make repeating columns of minimum that rem width, an array will make exactly that many colums with specified rem widths */
  submit_column?: true | string | string[];
  /**Rows for submit buttons, true is everything in one row, just a number will make repeating rows of minimum that rem height, an array will make exactly that many rows with specified rem heights */
  submit_row?: true | string | string[];
}

type GroupExtractVals<Arr extends any[]> = Arr extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends FormValue<infer T, infer ID>
    ? [FormValue<T, ID>, ...GroupExtractVals<Tail>]
    : [...GroupExtractVals<Tail>]
  : [];
export type GroupToKeyVal<Arr extends FormValue<any, any>[]> = {
  [
    K in Arr[number] as K extends FormValue<any, infer ID>
      ? [ID] extends [string]
        ? ID
        : never
      : never
  ]: K extends FormValue<infer T, any> ? T : never;
};

/**Values of a submitted form prompt, read the one that fits
 * get_value: all values, an error when an element has no value
 * value_partial: the values of the elements that have one
 * value_changed: only the values the user changed in the prompt
 *
 * An element whose value is a writable state is live, it writes to its state while the prompt is open,
 * and its value is in the answer like any other, in value_changed when the user changed it*/
export type PromptFormValues<T extends object> = Pick<
  FormGroup<T, undefined>,
  "get_value" | "value_partial" | "value_changed"
>;

export interface PromptFormSubmit<T extends object, L extends FormElement[]> {
  text: string;
  /**Called when the button is pressed, or by Enter for the last button
   * @param group the form group of the elements, to check and warn them
   * @param close closes the prompt, true resolves it with the values, false with none
   * @returns true to keep the prompt open, then it closes when close is called*/
  click?: (
    group: FormGroup<T, undefined, L>,
    close: (submit: boolean) => void,
  ) => boolean | void;
}

/**Opens a prompt with form elements and one or more submit buttons
 * Resolves with the values of the form when submitted, typed by the ids of the elements, or none when closed
 * Enter submits with the last button*/
export function prompt_form<
  L extends FormElement[],
  T extends object = Prettify<GroupToKeyVal<GroupExtractVals<L>>>,
>(
  text: string,
  elements: [...L],
  submit: PromptFormSubmit<T, L> | PromptFormSubmit<T, L>[],
  options?: PromptFormOptions,
): Promise<Option<PromptFormValues<T>>> {
  const group = form.group<L, undefined, T>({
    elements,
    embed: true,
    column: options?.form_column ?? true,
    row: options?.form_row,
  });
  const sub = Array.isArray(submit) ? submit : [submit];
  return open_prompt<PromptFormValues<T>>(
    text,
    (close_prompt) => {
      const close = (submit: boolean) =>
        close_prompt(submit ? some(group) : none());
      const submit_with = (s: PromptFormSubmit<T, L>) => {
        if (!s.click?.(group, close)) close(true);
      };
      return {
        element: form.group({
          elements: [
            group,
            form.group({
              embed: true,
              column: options?.submit_column ?? true,
              row: options?.submit_row,
              elements: sub.map((s) =>
                form.button({
                  text: s.text,
                  on_click: () => submit_with(s),
                  center: true,
                }),
              ),
            }),
          ],
        }),
        key: (e) => {
          //Waits for the element in focus to take the value of the enter first
          if (e.key === "Enter")
            void sleep(0).then(() => submit_with(sub.at(-1)!));
        },
        //The first element the user can change, labels before it can not take the focus
        focus:
          elements.find((element) => element instanceof FormValueWrite) ??
          elements[0],
      };
    },
    20,
  );
}
