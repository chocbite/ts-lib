import form, { type FormElement } from "#form";
import { px_to_rem } from "#theme";
import { none, type NiceError } from "@chocbite/ts-lib/result";
import st from "@chocbite/ts-lib/state";
import "./faults.scss";
import { open_prompt, type PromptOptions } from "./shared";

/**The faults by kind, in the order the kinds first appear, each message once.
 * An outage gives every input the same error, and a fetch parser gives each missing member its own message of one kind*/
const by_kind = (faults: readonly NiceError[]): NiceError[][] => {
  const groups = new Map<symbol, NiceError[]>();
  for (const fault of faults) {
    let group = groups.get(fault.kind);
    if (!group) groups.set(fault.kind, (group = []));
    if (!group.some((seen) => seen === fault || seen.equals(fault))) group.push(fault);
  }
  return [...groups.values()];
};

/**The stack of an error and of each error in its cause chain*/
const stack_chain = (error: Error): string => {
  const parts: string[] = [];
  let current: unknown = error;
  //A cause chain can loop, a few levels are enough to find the source
  for (let depth = 0; current instanceof Error && depth < 8; depth++) {
    parts.push((depth ? "Caused by: " : "") + (current.stack ?? `${current.name}: ${current.message}`));
    current = current.cause;
  }
  return parts.join("\n\n");
};

/**Inner errors nested deeper than this are left out, an error made of itself would never end*/
const MAX_DEPTH = 4;

/**The faults of one kind, its nice text once, then each message, with its stack and causes behind a collapser when it has an Error.
 * Inner errors are nested under their error in a group with a line, folded until opened, grouped by kind again*/
const kind_group = (faults: readonly NiceError[], depth: number): FormElement => {
  const heading = form.text({ text: faults[0].nice });
  heading.classList.add("heading");
  const elements: FormElement[] = [heading];
  for (const fault of faults) elements.push(...fault_elements(fault, depth));
  const group = form.group({ embed: true, elements });
  group.classList.add("kind");
  return group;
};

/**The message of a fault, its stack with causes behind a collapser when it has an Error, and its inner errors behind another*/
const fault_elements = (fault: NiceError, depth: number): FormElement[] => {
  const message = form.text({ text: fault.message });
  message.classList.add("message");
  const elements: FormElement[] = [message];
  const cause = fault.cause;
  if (cause) {
    const stack = form.text();
    stack.classList.add("stack");
    const collapsed = st.ok_w(true);
    //Formatting a stack is the expensive part, done only when someone looks
    collapsed.sub((result) => {
      if (result.ok && !result.value && !stack.textContent) stack.set({ text: stack_chain(cause) });
    });
    const details = form.group_collapser(form.group({ border: "inset", elements: [stack] }), {
      collapsed,
      closed_text: "Details",
      opened_text: "Hide details",
    });
    details.classList.add("details");
    elements.push(details);
  }
  if (fault.errors.length && depth < MAX_DEPTH) {
    const inner = form.group({ border: "line", elements: by_kind(fault.errors).map((group) => kind_group(group, depth + 1)) });
    inner.classList.add("inner");
    const sub_errors = form.group_collapser(inner, {
      collapsed: true,
      closed_text: "Sub error details",
      opened_text: "Hide sub error details",
    });
    sub_errors.classList.add("sub_errors");
    elements.push(sub_errors);
  }
  return elements;
};

/**Opens a prompt listing the faults of an element, the problems behind its fault icon
 * Built from form elements, so it follows the theme. Each fault shows its nice text and message, an error with an Error also its stack and causes, formatted when opened
 * Faults of one kind are grouped under its nice text, each message once. Resolves when the prompt is closed*/
export async function prompt_faults(faults: readonly NiceError[], options?: PromptOptions): Promise<void> {
  //60% of the page of the owner, but never wider than the page on small screens
  const page = (options?.owner?.ownerDocument.defaultView ?? window).innerWidth;
  const width = Math.min(Math.max(px_to_rem(page * 0.6), 20), px_to_rem(page * 0.95));
  await open_prompt<never>(
    "Problems",
    (close) => {
      const element = document.createElement("div");
      element.className = "prompts-faults";
      //Only the list scrolls, so the close button stays in view
      const list = element.appendChild(document.createElement("div"));
      list.className = "list";
      for (const group of by_kind(faults)) list.appendChild(kind_group(group, 0));
      element.appendChild(
        form.group({
          embed: true,
          column: "10rem",
          elements: [form.button({ text: "Close", on_click: () => close(none()) })],
        }),
      );
      return { element };
    },
    width,
    options,
  );
}
