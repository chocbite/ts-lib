import { Base, define_element, input_key } from "#base";
import { DOCUMENT_HANDLER } from "#document";
import { px_to_rem, SCALE } from "#theme";
import type { StateOrValROS } from "@chocbite/ts-lib/state";
import type { ContentBase } from "./content";
import "./container.scss";
import {
  HOST_LAYER,
  HOST_RAISE,
  HOST_REMOVE,
  Panel,
  PANEL_ADDED,
  PANEL_LAYOUT,
  type PanelHost,
  type PanelOptions,
} from "./panel";

/**Internal input, the scale changes the size of the container in rem*/
const SCALE_KEY = input_key<StateOrValROS<number>>();

/**Layer over the whole page that panels float in, one per document*/
class PanelContainer extends Base implements PanelHost {
  static element_name() {
    return "panelcontainer";
  }
  static element_name_space() {
    return "composition";
  }

  #layers = new Map<number, HTMLDivElement>();
  #panels = new Set<Panel>();
  #raised = 0;
  #active?: Panel;

  constructor() {
    super();
    this.attach_to_resize_observer();
    this.set_input(SCALE_KEY, SCALE, () => this.#layout());
  }

  /**Width in rem*/
  get width(): number {
    return px_to_rem(this.actual_size.width);
  }
  /**Height in rem*/
  get height(): number {
    return px_to_rem(this.actual_size.height);
  }
  /**Panel the user worked in last*/
  get active_panel(): Panel | undefined {
    return this.#active;
  }

  /**Creates a panel showing the content in this container
   * The title, icon, close button and minimum size come from the content, see content*/
  panel(content: ContentBase, options: PanelOptions = {}): Panel {
    const panel = Panel.create({ ...options, content });
    this.#panels.add(panel);
    panel[PANEL_ADDED](this);
    return panel;
  }

  protected on_resize(): void {
    this.#layout();
  }

  #layout(): void {
    for (const panel of this.#panels) panel[PANEL_LAYOUT]();
  }

  [HOST_LAYER](panel: Panel, layer: number): void {
    let box = this.#layers.get(layer);
    if (!box) {
      box = document.createElement("div");
      box.style.zIndex = String(layer);
      this.#layers.set(layer, box);
      //Layers in order, so the DOM order matches what is shown
      const above = [...this.#layers].filter(([l]) => l > layer);
      const next = above.sort(([a], [b]) => a - b)[0]?.[1];
      this.insertBefore(box, next ?? null);
    }
    //Moving an element reconnects it, which applies its states again
    if (panel.parentElement !== box) box.appendChild(panel);
  }

  [HOST_RAISE](panel: Panel): void {
    this.#active = panel;
    panel.style.zIndex = String(++this.#raised);
  }

  [HOST_REMOVE](panel: Panel): void {
    this.#panels.delete(panel);
    if (this.#active === panel) this.#active = undefined;
  }
}
define_element(PanelContainer);

export type { PanelContainer };

const CONTAINERS = new WeakMap<Document, PanelContainer>();
DOCUMENT_HANDLER.events.on("removed", (e) => {
  CONTAINERS.get(e.data)?.remove();
  CONTAINERS.delete(e.data);
});

/**The panel container of the document the given node is in, the main document by default
 * The container is made the first time it is asked for*/
export function panel_container(
  owner: Node = DOCUMENT_HANDLER.main,
): PanelContainer {
  const doc = owner.ownerDocument ?? (owner as Document);
  let container = CONTAINERS.get(doc);
  if (!container) {
    container = PanelContainer.create();
    doc.documentElement.appendChild(container);
    CONTAINERS.set(doc, container);
  }
  return container;
}

/**Creates a panel showing the content, in the main document
 * Use panel_container(element).panel for another document*/
export function panel(content: ContentBase, options: PanelOptions = {}): Panel {
  return panel_container().panel(content, options);
}
