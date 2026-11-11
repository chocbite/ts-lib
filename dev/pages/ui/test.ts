import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import {
  TestBox,
  TestGroup,
  TestLabelBox,
  TestOverrideBox,
  TestSetterBox,
  TestSlider,
  TestWatcher,
} from "@chocbite/ts-lib-ui/test";
import { box, controls, row, section } from "../../helpers";

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
    "Mixed inputs",
    "Fixed values and states use the same options, the color is state only. Buttons change the states, only boxes bound to them should react",
  );
  const width = state.ok_w(120);
  const label = state.ok_w("state label");
  const color = state.ok_w("#8e44ad");
  const boxes = row(sec);
  box(boxes, "All fixed").appendChild(
    new TestBox({ width: 120, height: 40, label: "fixed" }),
  );
  box(boxes, "Width state").appendChild(
    new TestBox({ width, height: 40, label: "width state" }),
  );
  box(boxes, "Label state").appendChild(
    new TestBox({ width: 120, height: 40, label }),
  );
  box(boxes, "Color state").appendChild(
    new TestBox({ width: 120, height: 40, label: "color state", color }),
  );
  let count = 0;
  controls(sec, {
    "Width 120 / 200": () => width.set_ok(width.ok() === 120 ? 200 : 120),
    "Change label": () => label.set_ok(`label ${++count}`),
    "Purple / green": () =>
      color.set_ok(color.ok() === "#8e44ad" ? "#27ae60" : "#8e44ad"),
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
    "The main goal: both sliders and the box share one writable state, and the label is derived from it. Moving either slider should move everything",
  );
  const width = state.ok_w(150);
  const label = state.p.ros(width, (value) => ok(`${value.value}px`));
  const boxes = row(sec);
  box(boxes, "Sliders").append(
    new TestSlider({ value: width, min: 40, max: 300 }),
    new TestSlider({ value: width, min: 40, max: 300 }),
  );
  box(boxes, "Box", { width: "20rem" }).appendChild(
    new TestBox({ width, height: 40, label }),
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
    "A subclass adding inputs after super is fine. A subclass overriding a method used by an input breaks with a fixed value, as the value is applied in the base constructor before the fields of the subclass exist",
  );
  const boxes = row(sec);
  box(boxes, "Own input after super").appendChild(
    new TestLabelBox({ width: 140, height: 40, label: "label", badge: "B" }),
  );
  box(boxes, "Override, label is a state").appendChild(
    new TestOverrideBox({
      width: 140,
      height: 40,
      prefix: "prefix ",
      label: state.ok("label"),
    }),
  );
  const fixed = box(boxes, "Override, label is fixed");
  try {
    fixed.appendChild(
      new TestOverrideBox({
        width: 140,
        height: 40,
        prefix: "prefix ",
        label: "label",
      }),
    );
  } catch (error) {
    fixed.textContent = String(error);
  }
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
    "The watcher follows the items of whichever group it is given, like a viewport following the widgets of its page. The subscriber counts should be 1 on the watched group, 1 more for a group on screen, and 0 on a list nobody uses",
  );
  const make = (name: string, color: string) => {
    const items = state.ok_w<TestBox[]>([]);
    const add = () =>
      items.set_ok([
        ...items.ok(),
        new TestBox({
          width: 48,
          height: 32,
          label: String(items.ok().length),
          color: state.ok(color),
        }),
      ]);
    add();
    return { name, items, group: new TestGroup({ items }), add };
  };
  const a = make("A", "#2980b9");
  const b = make("B", "#c0392b");
  const current = state.ok_w<TestGroup | undefined>(a.group);
  const watcher = new TestWatcher({ group: current });

  const boxes = row(sec);
  box(boxes, "Group A", { width: "16rem", minHeight: "2rem" }).appendChild(
    a.group,
  );
  box(boxes, "Group B", { width: "16rem", minHeight: "2rem" }).appendChild(
    b.group,
  );
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
    "Watch nothing": then(() => current.set_ok(undefined)),
    "Detach / attach watcher": then(() => {
      if (watcher.isConnected) watcher.remove();
      else watcher_box.appendChild(watcher);
    }),
  });
  update();
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
    "Fixed values exist right after new, states only after the element is connected, and an async state later still. Does anything feel wrong because of this",
  );
  const status = output(sec);
  const fixed = new TestBox({ width: 120, height: 32, label: "fixed" });
  const bound = new TestBox({
    width: state.ok(120),
    height: 32,
    label: "state",
  });
  const before = `before connect: fixed width "${fixed.style.width}", state width "${bound.style.width}"`;
  const boxes = row(sec);
  box(boxes, "Fixed").appendChild(fixed);
  box(boxes, "State").appendChild(bound);
  status.textContent = `${before}\nafter connect: fixed width "${fixed.style.width}", state width "${bound.style.width}"`;
  const delayed = box(boxes, "Async state", { minWidth: "8rem" });
  controls(sec, {
    "Add box with a width arriving after 1 second": () => {
      delayed.appendChild(
        new TestBox({
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
      "Fixed values",
      (i) => new TestBox({ width: 40 + (i % 8), height: 24, label: String(i) }),
    ],
    [
      "States",
      (i) =>
        new TestBox({
          width: state.ok(40 + (i % 8)),
          height: state.ok(24),
          label: state.ok(String(i)),
        }),
    ],
    [
      "Setters + opts",
      (i) =>
        new TestSetterBox().opts({
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
