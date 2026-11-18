import { Base, define_element, input_key } from "#base";
import { DOCUMENT_HANDLER } from "#document";
import { state_ui } from "#state_ui";
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
  PANEL_PLACE,
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

  readonly #size = state_ui.size(this);

  constructor() {
    super();
    //Panels are placed again when the container changes size, a function can only be attached once per element, so one per state
    this.attach_state(this.#size.width, () => this.#layout());
    this.attach_state(this.#size.height, () => this.#layout());
    this.set_input(SCALE_KEY, SCALE, () => this.#layout());
  }

  /**Width in rem*/
  get width(): number {
    return this.size().width;
  }
  /**Height in rem*/
  get height(): number {
    return this.size().height;
  }
  /**Width and height in rem, from the observed size, measured when not observed yet*/
  size(): { width: number; height: number } {
    let width = this.#size.width.ok();
    let height = this.#size.height.ok();
    //The container covers the page, 0 means the observer has not measured it yet
    if (width === 0 || height === 0)
      ({ width, height } = this.getBoundingClientRect());
    return { width: px_to_rem(width), height: px_to_rem(height) };
  }
  /**Panel the user worked in last*/
  get active_panel(): Panel | undefined {
    return this.#active;
  }

  /**Creates a panel showing the content in this container
   * The title, icon, close button and minimum size come from the content, see content*/
  panel(content: ContentBase, options: PanelOptions = {}): Panel {
    const panel = Panel.create(options, content, this);
    this.#panels.add(panel);
    panel[PANEL_ADDED]();
    return panel;
  }

  #layout(): void {
    for (const panel of this.#panels) panel[PANEL_PLACE]();
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
