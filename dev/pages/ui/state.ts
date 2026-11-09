import state_ui from "@chocbite/ts-lib-ui/state";
import { array_from_length } from "@chocbite/ts-lib/common";
import state from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];
const word = (i: number) => WORDS[i % WORDS.length];

/**Flashes a node, so it is visible which nodes were touched*/
function flash(node: HTMLElement, color: string) {
  node.animate([{ background: color }, { background: "transparent" }], 800);
}

/**Node for a value, showing how often it was made and updated*/
let created = 0;
function value_node(value: string): HTMLElement {
  const node = document.createElement("div");
  node.dataset.id = String(++created);
  node.dataset.updates = "0";
  Object.assign(node.style, {
    padding: "0.1rem 0.4rem",
    borderBottom: "1px solid #8884",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
  });
  node.textContent = `${value}  (node #${node.dataset.id}, 0 updates)`;
  flash(node, "#3c3");
  return node;
}

/**Adds a list box applying the array of the state to its children and a log of destroyed nodes*/
function applied_list(
  parent: HTMLElement,
  label: string,
  values: ReturnType<typeof state.ok_w<string[]>>,
  with_update: boolean,
) {
  const list = box(parent, label, {
    width: "26rem",
    minHeight: "12rem",
    border: "1px solid gray",
  });
  const log = parent.lastElementChild!.appendChild(
    document.createElement("code"),
  );
  let destroyed = 0;
  values.sub((v) => {
    state_ui.a.apply(list, v.ok ? v.value : [], {
      create: value_node,
      update: with_update
        ? (node, value) => {
            node.dataset.updates = String(Number(node.dataset.updates) + 1);
            node.textContent = `${value}  (node #${node.dataset.id}, ${node.dataset.updates} updates)`;
            flash(node, "#fc3");
          }
        : undefined,
      destroy: () => (log.textContent = `destroyed ${++destroyed} nodes`),
    });
  }, true);
  log.textContent = "destroyed 0 nodes";
}

//                _____  _____            __     __
//         /\    |  __ \|  __ \     /\    \ \   / /
//        /  \   | |__) | |__) |   /  \    \ \_/ /
//       / /\ \  |  _  /|  _  /   / /\ \    \   /
//      / ____ \ | | \ \| | \ \  / ____ \    | |
//     /_/    \_\|_|  \_\_|  \_\/_/    \_\   |_|
{
  const sec = section(
    "state_ui.a.apply",
    "Both lists show the same array state. Green flash is a created node, yellow an updated node. Node numbers show which nodes were kept. Left reuses nodes through update, right replaces nodes of changed values. Only the changed nodes should flash",
  );
  let next = 5;
  const values = state.ok_w(array_from_length(5, (i) => word(i) + " " + i));
  const label = () => {
    const i = next++;
    return word(i) + " " + i;
  };
  controls(sec, {
    Push: () => values.array.push(label()),
    Unshift: () => values.array.unshift(label()),
    "Insert at 2": () => values.array.splice(2, 0, label()),
    "Insert 3 at 1": () => values.array.splice(1, 0, label(), label(), label()),
    Pop: () => values.array.pop(),
    Shift: () => values.array.shift(),
    "Remove at 1": () => values.array.splice(1, 1),
    "Change at 0": () => values.array.change(0, label()),
    "Change 0 and 1": () => values.array.change(0, label(), label()),
    "Move first to end": () =>
      values.array.move(0, values.array.get.length - 1),
    "Move last 2 to start": () =>
      values.array.move(Math.max(values.array.get.length - 2, 0), 0, 2),
    Sort: () => values.array.sort((a, b) => a.localeCompare(b)),
    "Fresh, 3 values": () =>
      values.set_ok(array_from_length(3, () => label())),
    "Fresh, 8 values": () =>
      values.set_ok(array_from_length(8, () => label())),
    Empty: () => values.set_ok([]),
  });
  const lists = row(sec);
  applied_list(lists, "With update", values, true);
  applied_list(lists, "Without update", values, false);
}

//     _____  _              _____ _   _
//    |  __ \| |        /\  |_   _| \ | |
//    | |__) | |       /  \   | | |  \| |
//    |  ___/| |      / /\ \  | | | . ` |
//    | |    | |____ / ____ \_| |_| |\  |
//    |_|    |______/_/    \_\_____|_| \_|
{
  const sec = section(
    "Plain arrays",
    "A plain array carries no changes, so it is applied as a whole. With update the existing nodes are reused and only the difference is added or removed, without update every node is replaced",
  );
  const lists = row(sec);
  const with_update = box(lists, "With update", {
    width: "26rem",
    minHeight: "6rem",
    border: "1px solid gray",
  });
  const without_update = box(lists, "Without update", {
    width: "26rem",
    minHeight: "6rem",
    border: "1px solid gray",
  });
  let round = 0;
  const apply = (length: number) => {
    round++;
    const array = array_from_length(length, (i) => `round ${round} value ${i}`);
    state_ui.a.apply(with_update, array, {
      create: value_node,
      update: (node, value) => {
        node.dataset.updates = String(Number(node.dataset.updates) + 1);
        node.textContent = `${value}  (node #${node.dataset.id}, ${node.dataset.updates} updates)`;
        flash(node, "#fc3");
      },
    });
    state_ui.a.apply(without_update, array, { create: value_node });
  };
  controls(sec, {
    "Apply 2": () => apply(2),
    "Apply 4": () => apply(4),
    "Apply 6": () => apply(6),
    "Apply 0": () => apply(0),
  });
  apply(4);
}

//     __  __          _   ___     __
//    |  \/  |   /\   | \ | \ \   / /
//    | \  / |  /  \  |  \| |\ \_/ /
//    | |\/| | / /\ \ | . ` | \   /
//    | |  | |/ ____ \| |\  |  | |
//    |_|  |_/_/    \_\_| \_|  |_|
{
  const sec = section(
    "Many values",
    "5000 values in a scrolling box, the buttons should feel instant since only changed nodes are touched",
  );
  const values = state.ok_w(array_from_length(5000, (i) => i));
  const list = box(sec, "5000 values", {
    height: "12rem",
    width: "26rem",
    overflow: "auto",
    border: "1px solid gray",
    fontFamily: "monospace",
  });
  const timing = sec.appendChild(document.createElement("code"));
  values.sub((v) => {
    const start = performance.now();
    state_ui.a.apply(list, v.ok ? v.value : [], {
      create: (value) => {
        const node = document.createElement("div");
        node.textContent = String(value);
        return node;
      },
      update: (node, value) => (node.textContent = String(value)),
    });
    timing.textContent = `apply took ${(performance.now() - start).toFixed(1)} ms for ${v.ok ? v.value.length : 0} values`;
  }, true);
  let next = 5000;
  controls(sec, {
    "Push 1": () => values.array.push(next++),
    "Unshift 1": () => values.array.unshift(next++),
    "Remove at 100": () => values.array.splice(100, 1),
    "Change at 0": () => values.array.change(0, next++),
    "Reverse (fresh)": () => values.set_ok([...values.array.get].reverse()),
  });
}
