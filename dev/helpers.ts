import { NiceError } from "@chocbite/ts-lib/result";
//Small plain DOM helpers for laying out pages, they must not use the libraries

/**Adds a titled section to the page and returns it to be filled
 * @param note what to look for in this section*/
export function section(title: string, note?: string): HTMLElement {
  const section = document.body.appendChild(document.createElement("section"));
  section.className = "dev-section";
  section.appendChild(document.createElement("h2")).textContent = title;
  if (note) section.appendChild(document.createElement("p")).textContent = note;
  return section;
}

/**Adds a row to the parent that wraps its children side by side, for comparing variations*/
export function row(parent: HTMLElement): HTMLElement {
  const row = parent.appendChild(document.createElement("div"));
  row.className = "dev-row";
  return row;
}

/**Adds a labeled box to the parent and returns it to be filled
 * @param style css for the box, like a fixed size to see how content fits*/
export function box(
  parent: HTMLElement,
  label: string,
  style: Partial<CSSStyleDeclaration> = {},
): HTMLElement {
  const wrap = parent.appendChild(document.createElement("div"));
  wrap.className = "dev-box";
  wrap.appendChild(document.createElement("span")).textContent = label;
  const box = wrap.appendChild(document.createElement("div"));
  Object.assign(box.style, style);
  return box;
}

/**Adds a row of plain buttons to the parent, for poking at what is being trialed*/
export function controls(
  parent: HTMLElement,
  buttons: { [text: string]: () => void },
): HTMLElement {
  const controls = parent.appendChild(document.createElement("div"));
  controls.className = "dev-controls";
  for (const [text, action] of Object.entries(buttons)) {
    const button = controls.appendChild(document.createElement("button"));
    button.textContent = text;
    button.onclick = action;
  }
  return controls;
}

/**An error for showing on a page, with its own kind, the nice text is what elements show, the message the details*/
export const demo_error = (nice: string, message: string = nice) => new NiceError(Symbol(nice), message);

/**Adds a folded block with parts of the source of the page, so the code of what a section shows is next to it
 * A part is the lines between `//#region name` and `//#endregion`, regions inside it are shown without their marker lines
 * @param source the source of the page, imported with ?raw, like `import source from "./sort.ts?raw"`
 * @param regions names of the parts, shown one after the other, like the code of the section and then the helpers it calls*/
export function code(
  parent: HTMLElement,
  source: string,
  ...regions: string[]
): HTMLElement {
  const details = parent.appendChild(document.createElement("details"));
  details.className = "dev-code";
  details.appendChild(document.createElement("summary")).textContent = "Code";
  details.appendChild(document.createElement("pre")).textContent = regions
    .map((name) => region(source, name))
    .join("\n\n");
  return details;
}

/**The lines of a region of the source, without the indent they share */
function region(source: string, name: string): string {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `//#region ${name}`);
  if (start < 0)
    throw new Error(`No //#region ${name} in the source of the page`);
  const found: string[] = [];
  let depth = 1;
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//#region")) depth++;
    else if (trimmed.startsWith("//#endregion")) depth--;
    else found.push(line);
    if (depth === 0) break;
  }
  const indent = Math.min(
    ...found
      .filter((line) => line.trim())
      .map((line) => line.length - line.trimStart().length),
  );
  return found
    .map((line) => line.slice(indent))
    .join("\n")
    .trim();
}
