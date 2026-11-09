import {
  AccessTypes,
  Base,
  BaseSVG,
  base_loop,
  define_element,
  type BaseIntersectObserverOptions,
} from "@chocbite/ts-lib-ui/base";
import { array_from_length } from "@chocbite/ts-lib/common";
import { some } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

/**Adds a line of text to the parent, for showing counts that change*/
const status_line = (parent: HTMLElement): HTMLElement => {
  const line = parent.appendChild(document.createElement("div"));
  line.style.fontFamily = "monospace";
  line.style.margin = "0.25rem 0";
  return line;
};

//Every section gets its own ticking state, so its subscriber count only counts its own elements.
//One ticker steps them all, the buttons in every section control the same ticker
const ticks: ReturnType<typeof state.ok<number>>[] = [];
const make_tick = () => {
  const tick = state.ok(0);
  ticks.push(tick);
  return tick;
};
const status_updaters: (() => void)[] = [];
const update_status = () => status_updaters.forEach((update) => update());
const step = () => {
  for (const tick of ticks) tick.set_ok(tick.ok() + 1);
  update_status();
};
let ticker: number | undefined;
const toggle_ticking = () => {
  if (ticker === undefined) ticker = window.setInterval(step, 100);
  else {
    window.clearInterval(ticker);
    ticker = undefined;
  }
};

//      _____ _______    _______ ______
//     / ____|__   __|/\|__   __|  ____|
//    | (___    | |  /  \  | |  | |__
//     \___ \   | | / /\ \ | |  |  __|
//     ____) |  | |/ ____ \| |  | |____
//    |_____/   |_/_/    \_\_|  |______|
{
  class DevCounter extends Base {
    static element_name() {
      return "counter";
    }
    static element_name_space() {
      return "dev";
    }
    constructor() {
      super();
      this.style.display = "block";
      this.style.padding = "0.5rem";
      this.style.border = "1px solid #8888";
      this.style.minWidth = "10rem";
      this.textContent = "never set";
    }
    set value(value: number) {
      this.textContent = "value " + value;
    }
    set label(label: string) {
      this.textContent = label;
    }
  }
  define_element(DevCounter);

  const sec = section(
    "Attach state",
    "Elements subscribe to the state only while in the document. Remove them and the subscriber count drops, insert them and they catch up to the current value at once",
  );
  const status = status_line(sec);
  const tick = make_tick();
  const counters = row(sec);
  const a = new DevCounter();
  const b = new DevCounter();
  const c = new DevCounter();
  a.attach_state(tick, (v) => (a.value = v.value));
  b.opts({ value: tick });
  c.attach_state_ROA_to_prop_map("label", tick, (v) =>
    v % 2 ? some("odd " + v) : some("even " + v),
  );
  const holders = [
    box(counters, "attach_state"),
    box(counters, "opts({ value: state })"),
    box(counters, "attach_state_ROA_to_prop_map"),
  ];
  [a, b, c].forEach((e, i) => holders[i].appendChild(e));
  const update = () =>
    (status.textContent = `tick ${tick.ok()}, subscribers ${tick.amount()}, connected ${[a, b, c].filter((e) => e.is_connected).length} of 3`);
  status_updaters.push(update);
  update();
  controls(sec, {
    "+1": step,
    "Start / stop ticking": toggle_ticking,
    "Remove elements": () => {
      [a, b, c].forEach((e) => e.remove());
      update_status();
    },
    "Insert elements": () => {
      [a, b, c].forEach((e, i) => holders[i].appendChild(e));
      update_status();
    },
    "Detach state from second": () => {
      b.detach_state_from_prop("value");
      update_status();
    },
  });
}

//     __      _______  _____ _____ ____  _      ______
//     \ \    / /_   _|/ ____|_   _|  _ \| |    |  ____|
//      \ \  / /  | | | (___   | | | |_) | |    | |__
//       \ \/ /   | |  \___ \  | | |  _ <| |    |  __|
//        \  /   _| |_ ____) |_| |_| |_) | |____| |____
//         \/   |_____|_____/|_____|____/|______|______|
{
  class DevVisibleRow extends Base {
    static element_name() {
      return "visible-row";
    }
    static element_name_space() {
      return "dev";
    }
    #index: number;
    #on_change: () => void;
    constructor(
      index: number,
      tick: ReturnType<typeof make_tick>,
      on_change: () => void,
    ) {
      super();
      this.#index = index;
      this.#on_change = on_change;
      this.style.display = "block";
      this.style.padding = "0.125rem 0.25rem";
      this.style.borderBottom = "1px solid #8884";
      this.style.background = "#c6282855";
      this.textContent = `row ${index}, never updated`;
      this.attach_state(
        tick,
        (v) => (this.textContent = `row ${this.#index}, tick ${v.value}`),
        true,
      );
    }
    protected on_visible(is: boolean): void {
      this.style.background = is ? "#2e7d3255" : "#c6282855";
      this.#on_change();
    }
  }
  define_element(DevVisibleRow);

  class DevScroller extends Base {
    static element_name() {
      return "scroller";
    }
    static element_name_space() {
      return "dev";
    }
    readonly rows: DevVisibleRow[];
    constructor(
      options: Omit<BaseIntersectObserverOptions, "root"> | undefined,
      tick: ReturnType<typeof make_tick>,
      on_change: () => void,
    ) {
      super();
      this.style.display = "block";
      this.style.width = "14rem";
      this.style.height = "14rem";
      this.style.overflow = "auto";
      this.style.border = "1px solid #8888";
      const observer = options
        ? this.intersect_observer({ root: this, ...options })
        : this.intersect_observer();
      this.rows = array_from_length(100, (i) =>
        this.appendChild(
          new DevVisibleRow(i, tick, on_change).attach_to_intersect_observer(
            observer,
          ),
        ),
      );
    }
  }
  define_element(DevScroller);

  const sec = section(
    "Visible only",
    "Rows subscribe to the tick only while visible inside their scroll box (green), the subscriber count should match the visible count. Scroll and watch, hidden rows stop updating. The default observer waits 250 ms before showing and 1000 ms before hiding, the right one is instant",
  );
  controls(sec, { "+1": step, "Start / stop ticking": toggle_ticking });
  const boxes = row(sec);
  const variants: [string, Omit<BaseIntersectObserverOptions, "root"> | undefined][] = [
    ["intersect_observer() defaults", undefined],
    [
      "deffered_visible 0, deffered_hidden 0",
      { threshold: 0, deffered_visible: 0, deffered_hidden: 0 },
    ],
  ];
  for (const [label, options] of variants) {
    const holder = box(boxes, label);
    const status = status_line(holder);
    const tick = make_tick();
    const rows: DevVisibleRow[] = [];
    const update = () =>
      (status.textContent = `visible ${rows.filter((r) => r.is_visible).length} of 100, subscribed ${tick.amount()}`);
    status_updaters.push(update);
    rows.push(
      ...holder.appendChild(new DevScroller(options, tick, update)).rows,
    );
    update();
  }
}

//     _____  ______  _____ _____ ____________
//    |  __ \|  ____|/ ____|_   _|___  /  ____|
//    | |__) | |__  | (___   | |    / /| |__
//    |  _  /|  __|  \___ \  | |   / / |  __|
//    | | \ \| |____ ____) |_| |_ / /__| |____
//    |_|  \_\______|_____/|_____/_____|______|
{
  class DevResizable extends Base {
    static element_name() {
      return "resizable";
    }
    static element_name_space() {
      return "dev";
    }
    #calls = 0;
    constructor() {
      super();
      this.style.display = "block";
      this.style.width = "12rem";
      this.style.height = "4rem";
      this.style.overflow = "auto";
      this.style.resize = "both";
      this.style.border = "1px solid #8888";
      this.style.padding = "0.25rem";
      this.style.boxSizing = "border-box";
      this.textContent = "not observed, drag the corner";
    }
    protected on_resize(rect: { width: number; height: number }): void {
      this.#calls++;
      this.textContent = `${rect.width.toFixed(0)} x ${rect.height.toFixed(0)}, on_resize calls ${this.#calls}`;
    }
  }
  define_element(DevResizable);

  const sec = section(
    "Resize observer",
    "Drag the bottom right corners. Attached elements report their content size on every change, detached ones stop. Read actual_size shows the observed size, or getBoundingClientRect when detached",
  );
  const elements = array_from_length(3, () => new DevResizable());
  controls(sec, {
    Attach: () => elements.forEach((e) => e.attach_to_resize_observer()),
    Detach: () =>
      elements.forEach((e) => {
        e.detach_from_resize_observer();
        e.textContent = "detached";
      }),
    "Read actual_size": () =>
      elements.forEach(
        (e) =>
          (e.textContent = `actual_size ${e.actual_size.width.toFixed(1)} x ${e.actual_size.height.toFixed(1)}`),
      ),
  });
  const items = row(sec);
  elements.forEach((e, i) => box(items, "element " + i).appendChild(e));
}

//                _____ _____ ______  _____ _____
//          /\   / ____/ ____|  ____|/ ____/ ____|
//         /  \ | |   | |    | |__  | (___| (___
//        / /\ \| |   | |    |  __|  \___ \\___ \
//       / ____ \ |___| |____| |____ ____) |___) |
//      /_/    \_\_____\_____|______|_____/_____/
{
  class DevAccess extends Base {
    static element_name() {
      return "access";
    }
    static element_name_space() {
      return "dev";
    }
    constructor() {
      super();
      //Layout on an inner div, an inline display on the element would override the display none of access none
      const inner = this.appendChild(document.createElement("div"));
      inner.style.display = "flex";
      inner.style.gap = "0.5rem";
      inner.style.padding = "0.5rem";
      inner.style.border = "1px solid #8888";
      const button = inner.appendChild(document.createElement("button"));
      button.textContent = "Click me";
      let clicks = 0;
      button.onclick = () => (button.textContent = "Clicked " + ++clicks);
      inner.appendChild(document.createElement("input")).placeholder =
        "Type here";
    }
  }
  define_element(DevAccess);

  const sec = section(
    "Access",
    "Write is normal, read sets inert so nothing can be clicked or focused, none hides the element (the empty box). Does read look different enough from write?",
  );
  const items = row(sec);
  for (const access of Object.values(AccessTypes))
    box(items, "access " + access).appendChild(new DevAccess()).access = access;
  const changing = new DevAccess();
  const holder = box(items, "changing, access w");
  holder.appendChild(changing);
  const label = holder.parentElement!.querySelector("span")!;
  const set = (access: AccessTypes) => {
    changing.access = access;
    label.textContent = "changing, access " + changing.access;
  };
  controls(sec, {
    "Changing: write": () => set(AccessTypes.Write),
    "Changing: read": () => set(AccessTypes.Read),
    "Changing: none": () => set(AccessTypes.None),
  });
}

//      _      ____   ____  _____
//     | |    / __ \ / __ \|  __ \
//     | |   | |  | | |  | | |__) |
//     | |   | |  | | |  | |  ___/
//     | |___| |__| | |__| | |
//     |______\____/ \____/|_|
{
  const sec = section(
    "Loop",
    "Both loops follow the same array state. Every node shows the serial it got when created, so you can see which nodes were reused and which were recreated. The left one has a change handler and reuses nodes for changed values",
  );
  const array = state.ok<number[]>([1, 2, 3, 4, 5]);
  let next_value = 6;
  const status = status_line(sec);
  let created = 0;
  let destroyed = 0;
  const update = () =>
    (status.textContent = `[${array.ok().join(", ")}], nodes created ${created}, destroyed ${destroyed}`);
  const node = (value: number) => {
    const el = document.createElement("div");
    el.dataset.serial = String(++created);
    el.textContent = `${value} (node ${el.dataset.serial})`;
    el.style.padding = "0.125rem 0.25rem";
    el.style.borderBottom = "1px solid #8884";
    return el;
  };
  controls(sec, {
    Push: () => array.array.push(next_value++),
    Unshift: () => array.array.unshift(next_value++),
    Pop: () => array.array.pop(),
    Shift: () => array.array.shift(),
    "Change index 1": () => array.array.change(1, next_value++),
    "Move first to end": () =>
      array.array.move(0, Math.max(0, array.ok().length - 1)),
    "Splice 2 at 1 with 1 new": () =>
      array.array.splice(1, 2, next_value++),
    "Sort descending": () => array.array.sort((a, b) => b - a),
    "Fresh array": () =>
      array.set_ok(array_from_length(5, (i) => next_value + i * 2)),
    Empty: () => array.set_ok([]),
  });
  const loops = row(sec);
  const with_change = base_loop(node, {
    change: (el, value) =>
      (el.textContent = `${value} (node ${el.dataset.serial}, changed)`),
    destructor: () => destroyed++,
  });
  const without_change = base_loop(node, { destructor: () => destroyed++ });
  for (const [label, loop] of [
    ["with change", with_change],
    ["without change", without_change],
  ] as const) {
    loop.style.display = "block";
    loop.style.width = "14rem";
    loop.style.border = "1px solid #8888";
    loop.attach_state_ROA_to_prop("array", array);
    box(loops, label).appendChild(loop);
  }
  array.sub(() => queueMicrotask(update), true);
}

//      ____           _____ ______    _______      _______
//     |  _ \   /\    / ____|  ____|  / ____\ \    / / ____|
//     | |_) | /  \  | (___ | |__    | (___  \ \  / / |  __
//     |  _ < / /\ \  \___ \|  __|    \___ \  \ \/ /| | |_ |
//     | |_) / ____ \ ____) | |____   ____) |  \  / | |__| |
//     |____/_/    \_\_____/|______| |_____/    \/   \_____|
{
  const tick = make_tick();
  class DevGauge extends BaseSVG {
    static element_name() {
      return "gauge";
    }
    static element_name_space() {
      return "dev";
    }
    protected default_canvas(): SVGSVGElement {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "120");
      svg.setAttribute("height", "120");
      svg.setAttribute("viewBox", "0 0 120 120");
      return svg;
    }
    #circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    #text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    constructor() {
      super();
      this.#circle.setAttribute("cx", "60");
      this.#circle.setAttribute("cy", "60");
      this.#circle.setAttribute("fill", "#1e88e5");
      this.#text.setAttribute("x", "60");
      this.#text.setAttribute("y", "115");
      this.#text.setAttribute("text-anchor", "middle");
      this.#text.setAttribute("fill", "currentColor");
      this.canvas.append(this.#circle, this.#text);
      this.attach_state(tick, (v) => {
        this.#circle.setAttribute("r", String(10 + (v.value % 40)));
        this.#text.textContent = "tick " + v.value;
      });
    }
  }
  define_element(DevGauge);

  const sec = section(
    "BaseSVG",
    "The element lives inside its own svg canvas, inserting the canvas connects the element and subscribes it to the tick. The canvas has the class of the element name",
  );
  const gauge = new DevGauge();
  const status = status_line(sec);
  const update = () =>
    (status.textContent = `connected ${gauge.is_connected}, canvas class "${gauge.canvas.getAttribute("class")}", subscribers to tick ${tick.amount()}`);
  status_updaters.push(update);
  controls(sec, {
    "+1": step,
    "Start / stop ticking": toggle_ticking,
    "Remove canvas": () => {
      gauge.canvas.remove();
      update_status();
    },
    "Insert canvas": () => {
      holder.appendChild(gauge.canvas);
      update_status();
    },
  });
  const holder = box(row(sec), "120 x 120 canvas", {
    width: "120px",
    height: "120px",
  });
  holder.appendChild(gauge.canvas);
  update();
}
