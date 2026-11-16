import { sleep, type Prettify } from "@chocbite/ts-lib/common";
import form, {
  FormElement,
  FormValue,
  FormValueWrite,
  type FormGroup,
} from "#form";
import { type Option } from "@chocbite/ts-lib/result";
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

interface Submit<T extends object, L extends FormElement[]> {
  text: string;
  /**Callback function for submit button
   * @param group The form group containing the form elements
   * @param close Function to close the prompt with provided result
   * @returns Return true if the form should not close automatically */
  click?: (
    group: FormGroup<T, undefined, L>,
    close: (result: Option<Partial<T>>) => void,
  ) => boolean | void;
}

/**Opens a prompt with form elements and one or more submit buttons
 * Executes the last submit button's click handler when the Enter key is pressed.
 * */
export function prompt_form<
  L extends FormElement[],
  T extends object = Prettify<GroupToKeyVal<GroupExtractVals<L>>>,
>(
  text: string,
  elements: [...L],
  submit: Submit<T, L> | Submit<T, L>[],
  options?: PromptFormOptions,
): Promise<Option<Partial<T>>> {
  const group = form.group<L, undefined, T>({
    elements,
    embed: true,
    column: options?.form_column ?? true,
    row: options?.form_row,
  });
  const sub = Array.isArray(submit) ? submit : [submit];
  return open_prompt<Partial<T>>(
    text,
    (close) => {
      const submit_with = (s: Submit<T, L>) => {
        if (!s.click?.(group, close)) close(group.value_changed.to_option());
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
