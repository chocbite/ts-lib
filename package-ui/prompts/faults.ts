import form from "#form";
import { px_to_rem } from "#theme";
import { none, type NiceError } from "@chocbite/ts-lib/result";
import "./faults.scss";
import { open_prompt } from "./shared";

/**The faults by kind, in the order the kinds first appear, each message once.
 * An outage gives every input the same error, and a fetch parser gives each missing member its own message of one kind*/
const by_kind = (faults: readonly NiceError[]): NiceError[][] => {
  const groups = new Map<symbol, NiceError[]>();
  for (const fault of faults) {
    let group = groups.get(fault.kind);
    if (!group) groups.set(fault.kind, (group = []));
    if (!group.some((seen) => seen.message === fault.message)) group.push(fault);
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

/**The faults of one kind, its nice text once, then each message, with its stack and causes behind details when it has an Error*/
const kind_section = (faults: readonly NiceError[]): HTMLElement => {
  const section = document.createElement("section");
  section.appendChild(document.createElement("h3")).textContent = faults[0].nice;
  for (const fault of faults) add_fault(section, fault);
  return section;
};

/**The message of a fault, and its stack with causes behind details when it has an Error*/
const add_fault = (section: HTMLElement, fault: NiceError): void => {
  section.appendChild(document.createElement("p")).textContent = fault.message;
  const cause = fault.cause;
  if (cause) {
    const details = section.appendChild(document.createElement("details"));
    details.appendChild(document.createElement("summary")).textContent = "Details";
    const pre = details.appendChild(document.createElement("pre"));
    //Formatting a stack is the expensive part, done only when someone looks
    details.addEventListener("toggle", () => {
      if (details.open && !pre.textContent) pre.textContent = stack_chain(cause);
    });
  }
};

/**Opens a prompt listing the faults of an element, the problems behind its fault icon
 * Each fault shows its nice text and message, an error with an Error also its stack and causes, formatted when opened
 * Faults of one kind are grouped under its nice text, each message once. Resolves when the prompt is closed*/
export async function prompt_faults(faults: readonly NiceError[]): Promise<void> {
  //60% of the page, but never wider than the page on small screens
  const width = Math.min(
    Math.max(px_to_rem(window.innerWidth * 0.6), 20),
    px_to_rem(window.innerWidth * 0.95),
  );
  await open_prompt<never>(
    "Problems",
    (close) => {
      const element = document.createElement("div");
      element.className = "prompts-faults";
      //Only the list scrolls, so the close button stays in view
      const list = element.appendChild(document.createElement("div"));
      list.className = "list";
      for (const group of by_kind(faults)) list.appendChild(kind_section(group));
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
  );
}
