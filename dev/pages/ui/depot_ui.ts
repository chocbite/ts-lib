import depot, { type DepotEntry } from "@chocbite/ts-lib/depot";
import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import depot_ui from "@chocbite/ts-lib-ui/depot_ui";
import {
  material_category_rounded,
  material_circle_rounded,
  material_folder_rounded,
  material_settings_rounded,
  material_speed_rounded,
  material_square_rounded,
  material_thermostat_rounded,
} from "@chocbite/ts-lib-ui/icons";
import { box, controls, row, section, demo_error } from "../../helpers";

//Deterministic sample data
const shapes = depot.type<{ sides: number }>(
  "shapes",
  "Shapes",
  "Sample widgets",
  material_category_rounded,
);
const basic = shapes.group(
  "basic",
  "Basic",
  "Basic shapes",
  material_folder_rounded,
);
const rect = basic.add(
  "rectangle",
  "Rectangle",
  "Four sides",
  { sides: 4 },
  material_square_rounded,
);
basic.add(
  "circle",
  "Circle",
  "No corners",
  { sides: 0 },
  material_circle_rounded,
);
basic.add("triangle", "Triangle", "Three sides", { sides: 3 });
const polygons = shapes.group("polygons", "Polygons", "Many sides");
for (let i = 5; i <= 12; i++)
  polygons.add(`p${i}`, `${i}-gon`, `${i} sides`, { sides: i });
shapes.group("empty", "Empty group", "Never shown, nothing below it");

const machine = depot.states.group(
  "machine",
  "Machine",
  "Values from the machine",
  material_settings_rounded,
);
const speed = state.rosw(
  state.n.help(ok(1200), {
    unit: state.ok("rpm"),
    decimals: state.ok(1),
  }),
  true,
);
//Changes every second, so the value column can be seen following it
setInterval(() => speed.set_ok(1200 + Math.round(Math.random() * 100)), 1000);
machine.add(
  "speed",
  "Speed",
  "Writable number with unit and decimals",
  speed,
  material_speed_rounded,
);
machine.add(
  "temperature",
  "Temperature",
  "Read only, °C",
  state.ok(21),
  material_thermostat_rounded,
);
machine.add("name", "Name", "Writable text", state.ok_w("Press 4"));
machine.add("on", "On", "Writable boolean", state.ok_w(true));
machine.add(
  "mode",
  "Mode",
  "Writable enum, shows the name",
  state.rosw(
    state.e.help(ok<"auto" | "manual">("auto"), {
      list: state.ok({
        auto: { name: "Automatic" },
        manual: { name: "Manual" },
      }),
    }),
    true,
  ),
);
machine.add(
  "offline",
  "Offline",
  "Read only, in error",
  state.err(demo_error("No connection")),
);
const limits = machine.group("limits", "Limits", "");
limits.add("max_speed", "Max speed", "Read only", state.ok(3000));
limits.add("min_speed", "Min speed", "Writable", state.ok_w(10));

function result_box(parent: HTMLElement) {
  const out = box(parent, "result", {
    width: "24rem",
    minHeight: "3rem",
    border: "1px solid gray",
    padding: "0.4rem",
    fontFamily: "monospace",
    fontSize: "0.8rem",
    whiteSpace: "pre",
  });
  return (entries: DepotEntry<unknown>[]) =>
    (out.textContent = entries.length
      ? entries.map((e) => e.path).join("\n")
      : "(nothing, cancelled)");
}

//##################################################################################################################################################
{
  const sec = section(
    "Select",
    "Opens the selector in a modal panel. Look at icons, indent and sizes, that the empty group is never shown, and that search filters while typing and opens the groups. Select gives the selection, Cancel, the close button and Escape give nothing. In single mode a double click on an entry picks it. Move and size the panel",
  );
  const show = result_box(row(sec));
  let last: DepotEntry<{ sides: number }>[] = [rect];
  controls(sec, {
    single: async () => {
      last = await depot_ui.select(shapes, { selected: last.slice(0, 1) });
      show(last);
    },
    multi: async () => {
      last = await depot_ui.select(shapes, { mode: "multi", selected: last });
      show(last);
    },
    "only polygons": async () =>
      show(
        await depot_ui.select(shapes, {
          mode: "multi",
          filter: (e) => e.parent === polygons,
          title: "Polygons only",
        }),
      ),
    "a group only": async () => show(await depot_ui.select(polygons)),
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "States",
    "The state selector with live values. Speed changes every second while open, look that the value follows, the unit and decimals of Speed, the enum name of Mode and the dimmed error of Offline. Writable hides Temperature, Max speed and Offline, number shows only number states, the machine group only shows below machine",
  );
  const show = result_box(row(sec));
  controls(sec, {
    "any state": async () => show(await depot_ui.select_state()),
    writable: async () =>
      show(
        await depot_ui.select_state({
          mode: "multi",
          writable: true,
          title: "Writable states",
        }),
      ),
    number: async () =>
      show(await depot_ui.select_state({ kind: "number", title: "Numbers" })),
    "writable enum or boolean": async () =>
      show(
        await depot_ui.select_state({
          kind: ["enum", "boolean"],
          writable: true,
        }),
      ),
    "machine group": async () =>
      show(await depot_ui.select_state({ from: machine, mode: "multi" })),
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "Changes while open",
    "Opens the selector, registers a new group with an entry after 1 second and removes it again after 3 seconds. The selector should follow both changes",
  );
  const show = result_box(row(sec));
  controls(sec, {
    open: async () => {
      const result = depot_ui.select(shapes, { mode: "multi" });
      setTimeout(() => {
        const group = shapes.group(
          "late",
          "Late group",
          "Registered while open",
        );
        group.add("late", "Late entry", "", { sides: 1 });
        setTimeout(() => group.remove(), 2000);
      }, 1000);
      show(await result);
    },
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "Cost",
    "Registers 50 groups of 200 entries (10000) in a separate type and opens the selector for them. Watch how long it takes to open, open groups and search",
  );
  let made = false;
  const many = depot.type<number>("many", "Many", "10000 entries");
  controls(sec, {
    "open 10000": async () => {
      if (!made) {
        made = true;
        for (let g = 0; g < 50; g++) {
          const group = many.group(`g${g}`, `Group ${g}`, "");
          for (let e = 0; e < 200; e++)
            group.add(`e${e}`, `Entry ${g}.${e}`, `Value ${e}`, e);
        }
      }
      const start = performance.now();
      const result = depot_ui.select(many, { mode: "multi" });
      requestAnimationFrame(() =>
        console.log(`opened in ${(performance.now() - start).toFixed(1)}ms`),
      );
      await result;
    },
  });
}
