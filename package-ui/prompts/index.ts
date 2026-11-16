import { prompt_buttons } from "./buttons";
import { prompt_form } from "./form";

/**Modal prompts in the middle of the page, each resolves with the answer of the user, or none when closed*/
export const prompts = {
  buttons: prompt_buttons,
  form: prompt_form,
};

export type { PromptButton } from "./buttons";
