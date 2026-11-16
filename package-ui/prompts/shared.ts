import { define_element } from "#base";
import { comp, ContentBase } from "#composition";
import { none, type Option } from "@chocbite/ts-lib/result";

/**Content of a prompt, the prompt functions fill it*/
class Prompt extends ContentBase {
  static element_name() {
    return "prompt";
  }
  static element_name_space() {
    return "prompts";
  }
}
define_element(Prompt);

/**What a prompt shows, built with the close function of the prompt*/
export interface PromptBody {
  /**Element shown in the prompt*/
  element: HTMLElement;
  /**Keys pressed in the prompt, other than Escape, which closes it*/
  key?: (e: KeyboardEvent) => void;
  /**Element focused when the prompt opens, the prompt itself by default*/
  focus?: HTMLElement;
}

/**Opens a modal prompt in the middle of the main document
 * Resolves with the result given to close, or none when the user closes the prompt
 * @param width width in rem, not given the prompt fits its content*/
export function open_prompt<T>(
  title: string,
  build: (close: (result: Option<T>) => void) => PromptBody,
  width?: number,
): Promise<Option<T>> {
  return new Promise<Option<T>>((resolve) => {
    const prompt = Prompt.create({ title, closable: true });
    let done = false;
    const close = (result: Option<T>) => {
      if (done) return;
      done = true;
      resolve(result);
      prompt.content_close();
    };
    const { element, key, focus } = build(close);
    prompt.appendChild(element);
    prompt.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close(none());
      else key?.(e);
    });
    const panel = comp.panel(prompt, { sizeable: false, modal: true, width });
    void panel.on_close().then(() => close(none()));
    (focus ?? prompt).focus();
  });
}
