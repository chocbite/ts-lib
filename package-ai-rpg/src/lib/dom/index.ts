//Plain DOM helpers.

/**Makes an element with a class and children*/
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  class_name?: string,
  ...children: (Node | string | undefined)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (class_name) element.className = class_name;
  for (const child of children) if (child !== undefined) element.append(child);
  return element;
}
