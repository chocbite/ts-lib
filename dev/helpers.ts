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
