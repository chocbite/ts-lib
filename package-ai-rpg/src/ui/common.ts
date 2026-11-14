//Small pieces shared by the views.
import { el } from "#lib/dom";
import { mention_parse } from "#lib/mention";
import form from "@chocbite/ts-lib-ui/form";
import { material_close_rounded } from "@chocbite/ts-lib-ui/icons";
import { Spinner } from "@chocbite/ts-lib-ui/spinner";
import type { SVGFunc } from "@chocbite/ts-lib-ui/svg";

export { el };

/**Story text with mentions shown as names*/
export function text_nodes(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const part of mention_parse(text)) {
    if (part.id) {
      const mention = fragment.appendChild(el("span", "mention", part.text));
      mention.title = part.id;
    } else fragment.append(part.text);
  }
  return fragment;
}

/**A plain round button with an icon, for the game screen, form elements are only used in forms*/
export function icon_button(icon: SVGFunc, title: string, on_click: () => void): HTMLButtonElement {
  const button = el("button", "icon-button", icon());
  button.title = title;
  button.onclick = on_click;
  return button;
}

/**A plain button with text, for the game screen*/
export function text_button(text: string, on_click: () => void): HTMLButtonElement {
  const button = el("button", "text-button", text);
  button.onclick = on_click;
  return button;
}

/**A small spinner for status lines*/
export const spin = () => el("span", "spin", new Spinner());

/**Initials of a name, for character icons*/
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

/**Hue from a string, so each location and character keeps its color*/
export function hue(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

const LAYER = document.body.appendChild(el("div", "panel-layer"));
let open_panel: { close: () => void } | undefined;

/**Opens a panel over the scene, only one panel is open at a time
 * @param wide for panels with two columns, like the game builder*/
export function panel(title: string, wide = false, on_close?: () => void) {
  open_panel?.close();
  const body = el("div", "panel-body");
  const footer = el("div", "panel-footer");
  const close_button = icon_button(material_close_rounded, "Close", () => handle.close());
  //Buttons of the panel, before the close button
  const actions = el("div", "panel-actions");
  const box = el("div", "panel" + (wide ? " wide" : ""), el("div", "panel-header", actions, el("h2", undefined, title), close_button), body, footer);
  LAYER.replaceChildren(box);
  LAYER.classList.add("open");
  const handle = {
    actions,
    body,
    footer,
    close: () => {
      if (open_panel !== handle) return;
      open_panel = undefined;
      LAYER.classList.remove("open");
      LAYER.replaceChildren();
      on_close?.();
    },
  };
  open_panel = handle;
  return handle;
}

/**Closes the open panel*/
export const panel_close = () => open_panel?.close();

/**A form element with a text above it and an optional note below, in a panel*/
export const field = (label: string, input: Node, note?: string) =>
  el("div", "field", form.text({ text: label }), input, note ? form.text({ text: note, size: 0.8 }) : undefined);

const TOASTS = document.body.appendChild(el("div", "toasts"));
/**Shows a message for a while at the top of the page*/
export function toast(message: string, error = true) {
  const t = TOASTS.appendChild(el("div", "toast" + (error ? " error" : ""), message));
  t.onclick = () => t.remove();
  setTimeout(() => t.remove(), error ? 12000 : 4000);
}
