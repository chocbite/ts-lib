import { Base, define_element } from "#base";
import { sync_resolve } from "@chocbite/ts-lib/common";
import { ok } from "@chocbite/ts-lib/result";
import type { State, StateInferSub } from "@chocbite/ts-lib/state";
import { state } from "@chocbite/ts-lib/state";
import state_ui from "#state";
import { svg } from "#svg";
import "./viewport.scss";
import type { ViewportElement } from "./viewport_element";
import { ViewportMover } from "./viewport_mover";

export class Viewport extends Base {
  static element_name(): string {
    return "viewport";
  }
  static element_name_space(): string {
    return "editor";
  }

  #viewport_width: number = 0;
  #viewport_width_half: number = 0;
  #viewport_height: number = 0;
  #viewport_height_half: number = 0;
  #resize_observer = new ResizeObserver((a) => {
    this.#viewport_width = a[0].contentRect.width;
    this.#viewport_width_half = this.#viewport_width / 2;
    this.#viewport_height = a[0].contentRect.height;
    this.#viewport_height_half = this.#viewport_height / 2;
    //The pan is relative to the center, so the canvas stays centered
    this.#pan_coordinates(this.#pan_x.ok(), this.#pan_y.ok());
    this.#root.setAttribute(
      "viewBox",
      `0 0 ${this.#viewport_width} ${this.#viewport_height}`,
    );
  });
  #root = this.appendChild(svg.create("svg").elem);
  #panner;
  #zoomer;

  /**Detaches the mover when clicking outside the viewport*/
  #outside_pointerdown = (e: PointerEvent) => {
    if (!this.contains(e.target as Node)) this.#detach_mover();
  };
  /**Detaches the mover when the browser window loses focus*/
  #window_blur = () => this.#detach_mover();
  /**Document the listeners are attached to, while connected*/
  #listening_document?: Document;

  protected connectedCallback() {
    super.connectedCallback();
    this.#listening_document = this.ownerDocument;
    this.#listening_document.addEventListener(
      "pointerdown",
      this.#outside_pointerdown,
    );
    this.#listening_document.defaultView?.addEventListener(
      "blur",
      this.#window_blur,
    );
  }

  protected disconnectedCallback() {
    super.disconnectedCallback();
    this.#listening_document?.removeEventListener(
      "pointerdown",
      this.#outside_pointerdown,
    );
    this.#listening_document?.defaultView?.removeEventListener(
      "blur",
      this.#window_blur,
    );
    this.#listening_document = undefined;
  }

  constructor(
    canvas_width: number,
    canvas_height: number,
    infinite_canvas: boolean = false,
  ) {
    super();
    this.#resize_observer.observe(this);
    this.#canvas_width = canvas_width;
    this.#canvas_height = canvas_height;
    //Panning
    this.#panner = this.#root.appendChild(
      svg
        .create("svg")
        .a("width", canvas_width.toString())
        .a("height", canvas_height.toString()).elem,
    );
    //Zoomer
    this.#zoomer = this.#panner.appendChild(
      svg
        .create("svg")
        .a("x", "-50%")
        .a("y", "-50%")
        .a("width", canvas_width.toString())
        .a("height", canvas_height.toString()).elem,
    );
    //Background
    (infinite_canvas ? this.#root : this.#zoomer).prepend(
      svg
        .create("rect")
        .attribute("x", "0")
        .attribute("y", "0")
        .attribute("width", "100%")
        .attribute("height", "100%")
        .fill("white").elem,
    );
    //Canvas
    this.#canvas = this.#zoomer.appendChild(
      svg.svg(
        canvas_width,
        canvas_height,
        `0 0 ${canvas_width} ${canvas_height}`,
      ).elem,
    );
    this.#canvas_elements = this.#canvas.appendChild(svg.create("g").elem);

    //      _____ _   _ _______ ______ _____            _____ _______ _____ ____  _   _
    //     |_   _| \ | |__   __|  ____|  __ \     /\   / ____|__   __|_   _/ __ \| \ | |
    //       | | |  \| |  | |  | |__  | |__) |   /  \ | |       | |    | || |  | |  \| |
    //       | | | . ` |  | |  |  __| |  _  /   / /\ \| |       | |    | || |  | | . ` |
    //      _| |_| |\  |  | |  | |____| | \ \  / ____ \ |____   | |   _| || |__| | |\  |
    //     |_____|_| \_|  |_|  |______|_|  \_\/_/    \_\_____|  |_|  |_____\____/|_| \_|

    let count = 0;
    let mover_x = 0;
    let mover_y = 0;
    let initial_x = 0;
    let initial_y = 0;
    let initial_id = 0;
    // let second_initial_x = 0;
    // let second_initial_y = 0;
    let second_initial_id = 0;

    //Middle Mouse
    let double_click = 0;
    this.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || e.pointerType === "touch") {
        e.preventDefault();
        e.stopPropagation();

        // Element selection: detect clicks on the mover or viewport elements
        const target = e.target as Element;
        if (target.closest(".viewport-mover")) return;
        const elementCanvas = target.closest(".viewport-element");
        if (elementCanvas) {
          const element = this.#elements.find(
            (el) => el.canvas === elementCanvas,
          );
          if (element) {
            this.attach_mover(element);
            return;
          }
        }
        this.#detach_mover();

        //Double Click Reset Position
        const now = performance.now();
        if (now - double_click < 300) {
          this.#pan_coordinates(0, 0);
          this.#zoom_coordinates(
            Math.min(
              this.#viewport_height / this.#canvas_height,
              this.#viewport_width / this.#canvas_width,
            ),
            0,
            0,
          );
          return;
        }
        double_click = now;
        //Dragging
        this.setPointerCapture(e.pointerId);
        if (count === 0) {
          mover_x = this.#pan_x.ok();
          mover_y = this.#pan_y.ok();
          initial_x = e.offsetX;
          initial_y = e.offsetY;
          initial_id = e.pointerId;
        } else if (count === 1) {
          // second_initial_x = e.offsetX;
          // second_initial_y = e.offsetY;
          second_initial_id = e.pointerId;
        }
        count++;
      }
    });
    this.onpointermove = (ev) => {
      if (count === 0) return;
      if (ev.pointerId === initial_id) {
        this.#pan_coordinates(
          mover_x + (ev.offsetX - initial_x) / count,
          mover_y + (ev.offsetY - initial_y) / count,
        );
      } else if (ev.pointerId === second_initial_id) {
        if (count < 2) return;
        this.#pan_coordinates(
          mover_x + (ev.offsetX - initial_x) / count,
          mover_y + (ev.offsetY - initial_y) / count,
        );
      }
    };
    this.onpointerup = (ev) => {
      if (this.hasPointerCapture(ev.pointerId)) {
        this.releasePointerCapture(ev.pointerId);
        count--;
      }
    };
    //The browser can take over a touch, for example for a system gesture, which ends it without pointerup
    this.onpointercancel = this.onpointerup;
    //Wheel
    this.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const move_scale = e.shiftKey
          ? e.altKey
            ? 0.01
            : 0.05
          : e.altKey
            ? 2
            : 0.5;
        if (e.ctrlKey) {
          this.#pan_coordinates(
            undefined,
            this.#pan_y.ok() - e.deltaY * move_scale,
          );
        } else {
          const scale_scale = e.shiftKey
            ? e.altKey
              ? 0.00005
              : 0.0001
            : e.altKey
              ? 0.005
              : 0.001;
          const scale = this.#zoom.ok() * (1 - e.deltaY * scale_scale);
          this.#zoom_coordinates(
            scale,
            e.offsetX - this.#viewport_width / 2,
            e.offsetY - this.#viewport_height / 2,
          );
        }
        this.#pan_coordinates(
          this.#pan_x.ok() - e.deltaX * move_scale,
          undefined,
        );
      },
      { capture: true },
    );
  }

  #pan_coordinates(x?: number, y?: number) {
    if (x !== undefined) {
      this.#panner.setAttribute(
        "x",
        (this.#viewport_width_half + x).toFixed(0),
      );
      this.#pan_x.set_ok(x);
    }
    if (y !== undefined) {
      this.#panner.setAttribute(
        "y",
        (this.#viewport_height_half + y).toFixed(0),
      );
      this.#pan_y.set_ok(y);
    }
  }

  /**Zooms coordinate aware to offset canvas position so hover position stays
   * coordinates are relative to the center */
  #zoom_coordinates(scale: number, x: number, y: number) {
    scale = Math.max(0.001, Math.min(10000, scale));
    const zoom_factor = scale / this.#zoom.ok();
    this.#pan_coordinates(
      this.#pan_x.ok() * zoom_factor + x * (1 - zoom_factor),
      this.#pan_y.ok() * zoom_factor + y * (1 - zoom_factor),
    );
    this.#zoomer.style.scale = scale.toString();
    this.#zoom.set_ok(scale);
  }

  //       _____          _   ___      __      _____
  //      / ____|   /\   | \ | \ \    / /\    / ____|
  //     | |       /  \  |  \| |\ \  / /  \  | (___
  //     | |      / /\ \ | . ` | \ \/ / /\ \  \___ \
  //     | |____ / ____ \| |\  |  \  / ____ \ ____) |
  //      \_____/_/    \_\_| \_|   \/_/    \_\_____/
  #canvas;
  #canvas_width;
  #canvas_height;
  #canvas_elements;

  set canvas_width(value: number) {
    this.#canvas.setAttribute("width", value.toString());
    this.#canvas.setAttribute("viewBox", `0 0 ${value} ${this.#canvas_height}`);
    this.#zoomer.setAttribute("width", value.toString());
    this.#canvas_width = value;
  }
  get canvas_width(): number {
    return this.#canvas_width;
  }
  set canvas_height(value: number) {
    this.#canvas.setAttribute("height", value.toString());
    this.#canvas.setAttribute("viewBox", `0 0 ${this.#canvas_width} ${value}`);
    this.#zoomer.setAttribute("height", value.toString());
    this.#canvas_height = value;
  }
  get canvas_height(): number {
    return this.#canvas_height;
  }

  #pan_x = state.rosw(ok(0), (value) => {
    return sync_resolve(ok(this.#pan_coordinates(value, undefined)));
  });
  readonly pan_x = this.#pan_x.read_write;

  #pan_y = state.rosw(ok(0), (value) => {
    return sync_resolve(ok(this.#pan_coordinates(undefined, value)));
  });
  readonly pan_y = this.#pan_y.read_write;

  #zoom = state.rosw(ok(1), (value) =>
    sync_resolve(ok(this.#zoom_coordinates(value, 0, 0))),
  );
  readonly zoom = this.#zoom.read_write;

  //       _____ _____  _____ _____
  //      / ____|  __ \|_   _|  __ \
  //     | |  __| |__) | | | | |  | |
  //     | | |_ |  _  /  | | | |  | |
  //     | |__| | | \ \ _| |_| |__| |
  //      \_____|_|  \_\_____|_____/
  #grid_x = state.rosw(ok(10), (value) => {
    this.#grid_x.set_ok(value);
    return sync_resolve(ok(undefined));
  });
  readonly grid_x = this.#grid_x.read_write;

  #grid_y = state.rosw(ok(10), (value) => {
    this.#grid_y.set_ok(value);
    return sync_resolve(ok(undefined));
  });
  readonly grid_y = this.#grid_y.read_write;

  #grid_rotate = state.rosw(ok(15), (value) => {
    this.#grid_rotate.set_ok(value);
    return sync_resolve(ok(undefined));
  });
  readonly grid_rotate = this.#grid_rotate.read_write;

  //      ______ _      ______ __  __ ______ _   _ _______ _____
  //     |  ____| |    |  ____|  \/  |  ____| \ | |__   __/ ____|
  //     | |__  | |    | |__  | \  / | |__  |  \| |  | | | (___
  //     |  __| | |    |  __| | |\/| |  __| | . ` |  | |  \___ \
  //     | |____| |____| |____| |  | | |____| |\  |  | |  ____) |
  //     |______|______|______|_|  |_|______|_| \_|  |_| |_____/
  #elements: readonly ViewportElement[] = [];
  #state_sub?: StateInferSub<State<ViewportElement[]>>;

  set elements(elements: ViewportElement[] | State<ViewportElement[]>) {
    if (this.#state_sub) {
      this.detach_state(this.#state_sub);
      this.#state_sub = undefined;
    }
    if (state.is.state(elements)) {
      this.#state_sub = this.attach_state(elements, (r) =>
        this.#update_rows(r.ok ? r.value : []),
      );
    } else this.#update_rows(elements);
  }

  #update_rows(rows: readonly ViewportElement[]) {
    this.#elements = rows;
    //Each element owns its canvas node, so changed elements replace their node
    state_ui.a.apply(this.#canvas_elements, rows, {
      create: (element) => element.canvas,
    });
    const moved = this.#mover?.element;
    if (moved && !rows.includes(moved)) this.#detach_mover();
  }

  //      __  __  ______      ________ _____
  //     |  \/  |/ __ \ \    / /  ____|  __ \
  //     | \  / | |  | \ \  / /| |__  | |__) |
  //     | |\/| | |  | |\ \/ / |  __| |  _  /
  //     | |  | | |__| | \  /  | |____| | \ \
  //     |_|  |_|\____/   \/   |______|_|  \_\
  #mover?: ViewportMover;

  attach_mover(move: ViewportElement) {
    (this.#mover ??= new ViewportMover(
      this.#zoom,
      this.#grid_x,
      this.#grid_y,
      this.#grid_rotate,
    )).attach_to_element(move, this.#canvas);
  }

  #detach_mover() {
    this.#mover?.detach_from_element();
  }
}
define_element(Viewport);

export function create_viewport(
  canvas_width: number,
  canvas_height: number,
  infinite_canvas: boolean = false,
): Viewport {
  return new Viewport(canvas_width, canvas_height, infinite_canvas);
}
