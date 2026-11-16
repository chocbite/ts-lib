import form from "#form";
import type { SVGFunc } from "#svg";
import { some, type Option } from "@chocbite/ts-lib/result";
import { open_prompt } from "./shared";

export interface PromptButton<T> {
  /**Text of the button*/
  text: string;
  /**Value the prompt resolves with when the button is clicked*/
  value: T;
  /**Called after the prompt closes from the button*/
  click?: () => void;
  icon?: SVGFunc;
}

/**Opens a prompt with a row of buttons
 * Resolves with the value of the clicked button, or none when the user closes the prompt*/
export function prompt_buttons<T>(
  text: string,
  buttons: PromptButton<T>[],
): Promise<Option<T>> {
  return open_prompt<T>(text, (close) => ({
    element: form.group({
      elements: [
        form.spacer({ space: 0.5 }),
        form.group({
          embed: true,
          column: "10rem",
          elements: buttons.map((button) =>
            form.button({
              text: button.text,
              icon: button.icon,
              on_click: () => {
                close(some(button.value));
                button.click?.();
              },
            }),
          ),
        }),
      ],
    }),
  }));
}
