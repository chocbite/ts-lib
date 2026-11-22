import { ok } from "@chocbite/ts-lib/result";
import state, { type StateROSW } from "@chocbite/ts-lib/state";
import {
  example_box,
  example_editor,
  example_group,
  example_label_box,
  example_override_box,
  example_slider,
  example_watcher,
  type ExampleBox,
  type ExampleGroup,
} from "@chocbite/ts-lib-ui/pattern_example";
import { Base, define_element } from "@chocbite/ts-lib-ui/base";
import { box, controls, row, section, demo_error } from "../../helpers";

/**The box written in the older style, with setters and getters, only for the cost comparison, not part of the example*/
class SetterBox extends Base {
  static element_name() {
    return "setterbox";
  }
  static element_name_space() {
    return "devpage";
  }

  #width: number = 100;
  #height: number = 32;
  #label: string = "";
  #text = this.appendChild(document.createElement("span"));

  constructor() {
    super();
    this.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;width:100px;height:32px;background:#2980b9;color:white;font:12px sans-serif";
  }

  set width(width: number) {
    this.#width = width;
    this.style.width = width + "px";
  }
  get width(): number {
    return this.#width;
  }

  set height(height: number) {
    this.#height = height;
    this.style.height = height + "px";
  }
  get height(): number {
    return this.#height;
  }

  set label(label: string) {
    this.#label = label;
    this.#text.textContent = label;
  }
  get label(): string {
    return this.#label;
  }
}
define_element(SetterBox);

const output = (parent: HTMLElement): HTMLPreElement => {
  const pre = parent.appendChild(document.createElement("pre"));
  pre.style.margin = "0.5rem 0";
  return pre;
};

//      __  __ _______   ________ _____
//     |  \/  |_   _\ \ / /  ____|  __ \
//     | \  / | | |  \ V /| |__  | |  | |
//     | |\/| | | |   > < |  __| | |  | |
//     | |  | |_| |_ / . \| |____| |__| |
//     |_|  |_|_____/_/ \_\______|_____/
{
  const sec = section(
    "Mixed inputs and errors",
    "Initial values and states use the same options. Buttons change the states, only boxes bound to them should react. On an error the width keeps its last value, the label shows the error and the color turns grey",
  );
  const width = state.from_w(120);
  const label = state.from_w("state label");
  const color = state.from_w("#8e44ad");
  const boxes = row(sec);
  box(boxes, "All initial").appendChild(
    example_box({ width: 120, height: 40, label: "initial" }),
  );
  box(boxes, "Width state").appendChild(
    example_box({ width, height: 40, label: "width state" }),
  );
  box(boxes, "Label state").appendChild(
    example_box({ width: 120, height: 40, label }),
  );
  box(boxes, "Color state").appendChild(
    example_box({ width: 120, height: 40, label: "color state", color }),
  );
  let count = 0;
  let wide = false;
  let purple = true;
  controls(sec, {
    "Width 120 / 200": () => width.set_ok((wide = !wide) ? 200 : 120),
    "Change label": () => label.set_ok(`label ${++count}`),
    "Purple / green": () =>
      color.set_ok((purple = !purple) ? "#8e44ad" : "#27ae60"),
    "Error all": () => {
      width.set_err(demo_error("no width"));
      label.set_err(demo_error("no label"));
      color.set_err(demo_error("no color"));
    },
  });
}

//      _      _____ _   _ _  __
//     | |    |_   _| \ | | |/ /
//     | |      | | |  \| | ' /
//     | |      | | | . ` |  <
//     | |____ _| |_| |\  | . \
//     |______|_____|_| \_|_|\_\
{
  const sec = section(
    "Linked values",
    "The main goal: both sliders and the box share one writable state, and the label is derived from it. Moving either slider should move everything. A slider with an initial value keeps it itself and moves alone, one with a read only state of the width follows it but can not be moved",
  );
  const width = state.ok_w(150);
  const label = width.proxy_map((value) => `${value}px`);
  const boxes = row(sec);
  box(boxes, "Sliders").append(
    example_slider({ value: width, min: 40, max: 300 }),
    example_slider({ value: width, min: 40, max: 300 }),
  );
  box(boxes, "Initial value, its own").appendChild(
    example_slider({ value: 150, min: 40, max: 300 }),
  );
  box(boxes, "Read only state, disabled").appendChild(
    example_slider({ value: width.read_only, min: 40, max: 300 }),
  );
  box(boxes, "Box", { width: "20rem" }).appendChild(
    example_box({ width, height: 40, label }),
  );
}

//       _____ _    _ ____   _____ _                _____ _____
//      / ____| |  | |  _ \ / ____| |        /\    / ____/ ____|
//     | (___ | |  | | |_) | |    | |       /  \  | (___| (___
//      \___ \| |  | |  _ <| |    | |      / /\ \  \___ \\___ \
//      ____) | |__| | |_) | |____| |____ / ____ \ ____) |___) |
//     |_____/ \____/|____/ \_____|______/_/    \_\_____/_____/
{
  const sec = section(
    "Subclasses",
    "A subclass adds its inputs by overriding set. The override box reads a private field of the subclass from an overridden method, which works for both an initial value and a state, as set runs after every constructor has finished",
  );
  const boxes = row(sec);
  box(boxes, "Own input").appendChild(
    example_label_box({
      width: 140,
      height: 40,
      label: "label",
      badge: "B",
    }),
  );
  box(boxes, "Override, label is a state").appendChild(
    example_override_box({
      width: 140,
      height: 40,
      prefix: "prefix ",
      label: state.ok("label"),
    }),
  );
  box(boxes, "Override, initial label").appendChild(
    example_override_box({
      width: 140,
      height: 40,
      prefix: "prefix ",
      label: "label",
    }),
  );
}

//      _   _ ______  _____ _______ ______ _____
//     | \ | |  ____|/ ____|__   __|  ____|  __ \
//     |  \| | |__  | (___    | |  | |__  | |  | |
//     | . ` |  __|  \___ \   | |  |  __| | |  | |
//     | |\  | |____ ____) |  | |  | |____| |__| |
//     |_| \_|______|_____/   |_|  |______|_____/
{
  const sec = section(
    "Nested subscriptions",
    "The watcher follows the items of whichever group it is given, like a viewport following the widgets of its page. The items are given at creation, so the watcher never follows a list the group dropped, while the gap can be set again. The subscriber counts should be 1 on the watched group, 1 more for a group on screen, and 0 on a list nobody uses",
  );
  const gap = state.ok_w(4);
  const make = (name: string, color: string) => {
    const items = state.ok_w<ExampleBox[]>([]);
    const add = () =>
      items.set_ok([
        ...items.ok(),
        example_box({
          width: 48,
          height: 32,
          label: String(items.ok().length),
          color: state.ok(color),
        }),
      ]);
    add();
    return { name, items, group: example_group({ items, gap }), add };
  };
  const a = make("A", "#2980b9");
  const b = make("B", "#c0392b");
  const current = state.ok_w<ExampleGroup | null>(a.group);
  const watcher = example_watcher({ group: current });

  const boxes = row(sec);
  box(boxes, "Group A", { width: "16rem", minHeight: "2rem" }).appendChild(
    a.group,
  );
  box(boxes, "Group B", { width: "16rem", minHeight: "2rem" }).appendChild(
    b.group,
  );
  const initial = example_group({
    items: [example_box({ width: 48, height: 32, label: "F" })],
  });
  box(boxes, "Group F, initial list", {
    width: "8rem",
    minHeight: "2rem",
  }).appendChild(initial);
  const watcher_box = box(boxes, "Watcher", {
    width: "10rem",
    minHeight: "2rem",
  });
  watcher_box.appendChild(watcher);

  const status = output(sec);
  const update = () => {
    status.textContent =
      `items A subscribers ${a.items.amount()}, items B subscribers ${b.items.amount()}, ` +
      `group state subscribers ${current.amount()}, watcher connected ${watcher.isConnected}`;
  };
  const then = (action: () => void) => () => {
    action();
    update();
  };
  controls(sec, {
    "Add to A": then(a.add),
    "Add to B": then(b.add),
    "Watch A": then(() => current.set_ok(a.group)),
    "Watch B": then(() => current.set_ok(b.group)),
    "Watch F": then(() => current.set_ok(initial)),
    "Watch nothing": then(() => current.set_ok(null)),
    "Gap 4 / 12 on A and B": () => gap.set_ok(gap.ok() === 4 ? 12 : 4),
    "Detach / attach watcher": then(() => {
      if (watcher.isConnected) watcher.remove();
      else watcher_box.appendChild(watcher);
    }),
  });
  update();
}

//Writing through input_state
{
  const sec = section(
    "Writing to the input state",
    "The slider keeps no reference to its value state, its input handler writes to whatever state the value key has now through input_state. Switch the slider between the A and B states and drag it: only the box of the state it has moves. With an initial value the slider keeps the value itself and writes nothing",
  );
  const a = state.ok_w(60);
  const b = state.ok_w(140);
  const boxes = row(sec);
  box(boxes, "State A", { width: "14rem" }).appendChild(
    example_box({ width: a, label: "A", color: "#2980b9" }),
  );
  box(boxes, "State B", { width: "14rem" }).appendChild(
    example_box({ width: b, label: "B", color: "#c0392b" }),
  );
  const slider = example_slider({ min: 20, max: 200, value: a });
  box(boxes, "Slider", { width: "14rem" }).appendChild(slider);
  const label = output(sec);
  label.textContent = "slider writes to A";
  controls(sec, {
    "Slider on A": () => {
      slider.set({ value: a });
      label.textContent = "slider writes to A";
    },
    "Slider on B": () => {
      slider.set({ value: b });
      label.textContent = "slider writes to B";
    },
    "Slider initial 100": () => {
      slider.set({ value: 100 });
      label.textContent =
        "slider keeps an initial value itself, writes nothing";
    },
  });
}

//      ______ _____ _____ _______ ____  _____
//     |  ____|  __ \_   _|__   __/ __ \|  __ \
//     | |__  | |  | || |    | | | |  | | |__) |
//     |  __| | |  | || |    | | | |  | |  _  /
//     | |____| |__| || |_   | | | |__| | | \ \
//     |______|_____/_____|  |_|  \____/|_|  \_\
{
  const sec = section(
    "Editor",
    "The editor passes its scale on to a view and a slider unchanged, and uses as_state to derive the label and to hand the scale out. The scale is given at creation as it is handed out, the slider limits are passed on through set and can change. An initial scale becomes a state the editor keeps, so its slider still moves its view. The outside readout subscribes to the scale the editor hands out",
  );
  const shared = state.ok_w(1);
  const boxes = row(sec);
  const editors: ReturnType<typeof example_editor>[] = [];
  for (const [name, scale] of [
    ["Initial 1.5", 1.5],
    ["State", shared],
    ["Same state", shared],
  ] as const) {
    const editor = example_editor({ scale });
    const readout = example_box({
      width: 160,
      height: 24,
      color: "#16a085",
      label: editor.scale.proxy_map((v) => `outside ${v}`),
    });
    box(boxes, name).append(editor, readout);
    editors.push(editor);
  }
  let max = 3;
  controls(sec, {
    "Reset shared to 1": () => shared.set_ok(1),
    "Max 3 / 5": () => {
      max = max === 3 ? 5 : 3;
      for (const editor of editors) editor.set({ max });
    },
  });
}

//      _____  ______ _    _  _____ ______ _____
//     |  __ \|  ____| |  | |/ ____|  ____|  __ \
//     | |__) | |__  | |  | | (___ | |__  | |  | |
//     |  _  /|  __| | |  | |\___ \|  __| | |  | |
//     | | \ \| |____| |__| |____) | |____| |__| |
//     |_|  \_\______|\____/|_____/|______|_____/
{
  const ROWS = 4;
  const sec = section(
    "Reused rows",
    `${ROWS} boxes are rebound to a window of 20 data states, like a list reusing its rows when scrolling. Every other entry is an initial value. Only the ${ROWS} shown states should have a subscriber, the "Change all" button proves the hidden ones are released`,
  );
  const colors = ["#2980b9", "#27ae60", "#8e44ad", "#c0392b", "#d35400"];
  const data: {
    label: string | StateROSW<string>;
    color: string | StateROSW<string>;
  }[] = Array.from({ length: 20 }, (_, i) =>
    i % 2
      ? { label: `initial ${i}`, color: colors[i % 5] }
      : { label: state.ok_w(`state ${i}`), color: state.ok_w(colors[i % 5]) },
  );
  const rows = Array.from({ length: ROWS }, () =>
    example_box({ width: 120, height: 32 }),
  );
  const boxes = row(sec);
  for (const r of rows) boxes.appendChild(r);
  const status = output(sec);
  let offset = 0;
  let changes = 0;
  const show = () => {
    rows.forEach((r, i) => r.set(data[(offset + i) % data.length]));
    const subscribed = data
      .map((d, i) =>
        typeof d.label === "string" || d.label.amount() === 0 ? "" : i,
      )
      .filter((i) => i !== "");
    status.textContent = `showing ${offset} to ${offset + ROWS - 1}, data with subscribers: ${subscribed.join(", ")}`;
  };
  controls(sec, {
    "Scroll by 1": () => {
      offset = (offset + 1) % data.length;
      show();
    },
    "Scroll by 3": () => {
      offset = (offset + 3) % data.length;
      show();
    },
    "Change all states": () => {
      changes++;
      data.forEach((d, i) => {
        if (typeof d.label !== "string")
          void d.label.write(`state ${i} #${changes}`);
      });
      show();
    },
  });
  show();
}

//      _______ _____ __  __ _____ _   _  _____
//     |__   __|_   _|  \/  |_   _| \ | |/ ____|
//        | |    | | | \  / | | | |  \| | |  __
//        | |    | | | |\/| | | | | . ` | | |_ |
//        | |   _| |_| |  | |_| |_| |\  | |__| |
//        |_|  |_____|_|  |_|_____|_| \_|\_____|
{
  const sec = section(
    "When values arrive",
    "Initial values are applied by the factory, states only after the element is connected, and an async state later still. Does anything feel wrong because of this",
  );
  const status = output(sec);
  const initial = example_box({ width: 120, height: 32, label: "initial" });
  const bound = example_box({
    width: state.ok(120),
    height: 32,
    label: "state",
  });
  const before = `before connect: initial width "${initial.style.width}", state width "${bound.style.width}"`;
  const boxes = row(sec);
  box(boxes, "Initial").appendChild(initial);
  box(boxes, "State").appendChild(bound);
  status.textContent = `${before}\nafter connect: initial width "${initial.style.width}", state width "${bound.style.width}"`;
  const delayed = box(boxes, "Async state", { minWidth: "8rem" });
  controls(sec, {
    "Add box with a width arriving after 1 second": () => {
      delayed.appendChild(
        example_box({
          width: state.roa(async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return ok(120);
          }),
          height: 32,
          label: "async",
        }),
      );
    },
  });
}

//       _____ ____  _____  _______
//      / ____/ __ \|  __ \|__   __|
//     | |   | |  | | |__) |  | |
//     | |   | |  | |  ___/   | |
//     | |___| |__| | |      | |
//      \_____\____/|_|      |_|
{
  const AMOUNT = 5000;
  const RUNS = 7;
  const sec = section(
    "Cost",
    `Creates, connects and removes ${AMOUNT} boxes with 3 inputs each, the variants take turns for ${RUNS} runs and the median is shown in milliseconds. Connect does not include layout`,
  );
  const variants: [string, (i: number) => HTMLElement][] = [
    [
      "Initial values",
      (i) =>
        example_box({
          width: 40 + (i % 8),
          height: 24,
          label: String(i),
        }),
    ],
    [
      "States",
      (i) =>
        example_box({
          width: state.ok(40 + (i % 8)),
          height: state.ok(24),
          label: state.ok(String(i)),
        }),
    ],
    [
      "Setters + opts",
      (i) =>
        new SetterBox().opts({
          width: 40 + (i % 8),
          height: 24,
          label: String(i),
        }),
    ],
  ];
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const status = output(sec);
  status.textContent = "Not run yet";
  const host = box(sec, "Host", { height: "6rem", overflow: "hidden" });
  controls(sec, {
    "Run comparison": () => {
      const times = variants.map(() => ({
        create: [] as number[],
        connect: [] as number[],
        remove: [] as number[],
      }));
      for (let run = 0; run < RUNS; run++) {
        variants.forEach(([, make], v) => {
          const start = performance.now();
          const elements: HTMLElement[] = [];
          for (let i = 0; i < AMOUNT; i++) elements.push(make(i));
          const created = performance.now();
          host.append(...elements);
          const connected = performance.now();
          host.replaceChildren();
          const removed = performance.now();
          times[v].create.push(created - start);
          times[v].connect.push(connected - created);
          times[v].remove.push(removed - connected);
        });
      }
      status.textContent = variants
        .map(
          ([name], v) =>
            `${name.padEnd(16)} create ${median(times[v].create).toFixed(1).padStart(7)}   ` +
            `connect ${median(times[v].connect).toFixed(1).padStart(7)}   ` +
            `remove ${median(times[v].remove).toFixed(1).padStart(7)}`,
        )
        .join("\n");
    },
  });
}
