import form, { FormColors } from "@chocbite/ts-lib-ui/form";
import list from "@chocbite/ts-lib-ui/list";
import {
  FETCH_PARSE,
  make_fetch_parser,
  make_parser,
  type FetchFunction,
} from "@chocbite/ts-lib/parse";
import { ok } from "@chocbite/ts-lib/result";
import state, { type StateREA } from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

const WIDTH = { width: "16rem" };

/**Shows the current value of a state as text and follows it*/
function readout<T>(parent: HTMLElement, label: string, value: StateREA<T>) {
  const line = parent.appendChild(document.createElement("div"));
  line.style.fontFamily = "monospace";
  value.sub(
    (r) =>
      (line.textContent =
        label + ": " + (r.ok ? JSON.stringify(r.value) : "error, " + r.error)),
    true,
  );
  return line;
}

//      __  __          _  ________     _____        _____   _____ ______ _____
//     |  \/  |   /\   | |/ /  ____|   |  __ \ /\   |  __ \ / ____|  ____|  __ \
//     | \  / |  /  \  | ' /| |__      | |__) /  \  | |__) | (___ | |__  | |__) |
//     | |\/| | / /\ \ |  < |  __|     |  ___/ /\ \ |  _  / \___ \|  __| |  _  /
//     | |  | |/ ____ \| . \| |____    | |  / ____ \| | \ \ ____) | |____| | \ \
//     |_|  |_/_/    \_\_|\_\______|   |_| /_/    \_\_|  \_\_____/|______|_|  \_\
{
  const sec = section(
    "make_parser",
    "Edit the JSON or pick a preset, the result updates as you type. Look at the error messages, do they point at the right member. " +
      "Missing optional keys stay missing in the result, the default fills in retries, unknown keys are kept.",
  );
  const SCHEMA = {
    name: "s",
    age: "?n",
    role: "sl",
    tags: [0, "s"],
    position: [2, "n"],
    address: { street: "s", zip: "n" },
    retries: ["?", "n", () => 3],
    flags: ["{}", "b"],
  } as const;
  const parse = make_parser(SCHEMA);
  const PRESETS: { [name: string]: unknown } = {
    Valid: {
      name: "Ada",
      age: 36,
      role: "admin",
      tags: ["math", "engines"],
      position: [1, 2],
      address: { street: "Main st", zip: 1234 },
      flags: { beta: true },
    },
    "Missing optional, default, unknown key": {
      name: "Ada",
      role: null,
      tags: [],
      position: [0, 0],
      address: { street: "Main st", zip: 1234 },
      flags: {},
      extra: "kept",
    },
    "Wrong nested type": {
      name: "Ada",
      role: "admin",
      tags: ["math", 5],
      position: [1, 2],
      address: { street: "Main st", zip: 1234 },
      flags: {},
    },
    "Wrong tuple length": {
      name: "Ada",
      role: "admin",
      tags: [],
      position: [1],
      address: { street: "Main st", zip: 1234 },
      flags: {},
    },
    "Wrong record value": {
      name: "Ada",
      role: "admin",
      tags: [],
      position: [1, 2],
      address: { street: "Main st", zip: "1234" },
      flags: { beta: "yes" },
    },
  };

  const r = row(sec);
  const input_box = box(r, "input JSON", { width: "24rem" });
  const input = input_box.appendChild(document.createElement("textarea"));
  Object.assign(input.style, { width: "100%", height: "18rem", fontFamily: "monospace" });
  const schema_box = box(r, "schema", { width: "18rem" });
  schema_box.appendChild(document.createElement("pre")).textContent = JSON.stringify(
    SCHEMA,
    (_key, value: unknown) => (typeof value === "function" ? "() => 3" : value),
    2,
  );
  const output_box = box(r, "result", { width: "24rem" });
  const output = output_box.appendChild(document.createElement("pre"));
  output.style.whiteSpace = "pre-wrap";

  const run = () => {
    const result = parse(input.value);
    output.style.color = result.ok ? "" : "#d33";
    output.textContent = result.ok
      ? "ok\n" + JSON.stringify(result.value, null, 2)
      : "err\n" + result.error;
  };
  const show = (value: unknown) => {
    input.value = JSON.stringify(value, null, 2);
    run();
  };
  input.oninput = run;
  controls(sec, {
    ...Object.fromEntries(
      Object.entries(PRESETS).map(([name, value]) => [name, () => show(value)]),
    ),
    "Invalid JSON": () => {
      input.value = '{ "name": "Ada", ';
      run();
    },
  });
  show(PRESETS["Valid"]);
}

//      ______ ______ _______ _____ _    _     _____        _____   _____ ______ _____
//     |  ____|  ____|__   __/ ____| |  | |   |  __ \ /\   |  __ \ / ____|  ____|  __ \
//     | |__  | |__     | | | |    | |__| |   | |__) /  \  | |__) | (___ | |__  | |__) |
//     |  __| |  __|    | | | |    |  __  |   |  ___/ /\ \ |  _  / \___ \|  __| |  _  /
//     | |    | |____   | | | |____| |  | |   | |  / ____ \| | \ \ ____) | |____| | \ \
//     |_|    |______|  |_|  \_____|_|  |_|   |_| /_/    \_\_|  \_\_____/|______|_|  \_\
{
  /**Simulated network delay of every request*/
  const LATENCY_MS = 300;
  /**How often the fetch parser polls while something is subscribed*/
  const UPDATE_MS = 1000;
  /**The server rejects speeds above this, to see a failed write*/
  const MAX_SPEED = 90;

  const sec = section(
    "make_fetch_parser bound to form elements",
    `A fake device server answers fetches to /api/device after ${LATENCY_MS}ms, the parser polls it every ${UPDATE_MS}ms while any element is shown. ` +
      "Every element is bound directly to a member of the parsed result. Members marked w in the schema are writable, a change is sent as a partial object (see the request log), the next poll shows what the server kept. " +
      `The server rejects speeds above ${MAX_SPEED}, drag the slider to the end to see the failed write. ` +
      "Go offline to see how each element shows the failed fetch, and back online to see them recover. Change values on the server to see the elements follow on the next poll.",
  );

  //Fake server, deterministic so the page looks the same every load
  const MODES = [
    { value: 0, text: "Off" },
    { value: 1, text: "Auto" },
    { value: 2, text: "Hand" },
  ];
  const device: {
    name: string;
    running: boolean;
    speed: number;
    setpoint: number;
    mode: number;
    temperature: number;
    alarm: boolean;
    note?: string;
    outputs: boolean[];
    log: string[];
    pumps: { id: number; name: string; running: boolean; speed: number }[];
    zones: { name: string; setpoint: number }[];
    tags: string[];
  } = {
    name: "Pump 1",
    running: true,
    speed: 40,
    setpoint: 21.5,
    mode: 1,
    temperature: 20,
    alarm: false,
    outputs: [true, false, false, true],
    log: ["Started"],
    pumps: [
      { id: 1, name: "Pump A", running: true, speed: 30 },
      { id: 2, name: "Pump B", running: false, speed: 0 },
      { id: 3, name: "Pump C", running: true, speed: 75 },
    ],
    zones: [
      { name: "North", setpoint: 20 },
      { name: "South", setpoint: 22 },
    ],
    tags: ["alpha", "bravo"],
  };
  let next_pump_id = 4;
  let polls = 0;
  let offline = false;

  const log_box = box(sec, "request log", { width: "48rem" });
  const log = log_box.appendChild(document.createElement("pre"));
  Object.assign(log.style, {
    height: "8rem",
    overflow: "auto",
    margin: "0",
    fontSize: "0.8rem",
    border: "1px solid gray",
  });
  const start = performance.now();
  const write_log = (text: string, color = "") => {
    const line = log.appendChild(document.createElement("div"));
    line.textContent = `${((performance.now() - start) / 1000).toFixed(1).padStart(6)}s ${text}`;
    line.style.color = color;
    while (log.childElementCount > 200) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  };

  /**Merges a partial object from a write into the device, objects and arrays are merged by key*/
  const merge = (target: Record<string, unknown>, patch: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(patch)) {
      const current = target[key];
      if (Array.isArray(value)) target[key] = value;
      else if (value && typeof value === "object" && current && typeof current === "object")
        merge(current as Record<string, unknown>, value as Record<string, unknown>);
      else target[key] = value;
    }
  };

  const respond = (status: number, body: string) =>
    new Promise<Response>((resolve) =>
      setTimeout(() => resolve(new Response(body, { status })), LATENCY_MS),
    );

  const server = (init?: RequestInit): Promise<Response> => {
    if (offline) {
      write_log(`${init?.method ?? "GET"} failed, offline`, "#d33");
      return new Promise((_resolve, reject) =>
        setTimeout(() => reject(new TypeError("Failed to fetch")), LATENCY_MS),
      );
    }
    if (init?.method === "PATCH") {
      const patch = JSON.parse(String(init.body)) as Record<string, unknown>;
      if (typeof patch["speed"] === "number" && patch["speed"] > MAX_SPEED) {
        write_log(`PATCH ${String(init.body)} rejected`, "#d33");
        return respond(400, `Speed above ${MAX_SPEED} is not allowed`);
      }
      //Tags are written with the array encoder, as { index, tag }
      const tag = patch["tags"] as { index: number; tag: string } | undefined;
      if (tag && "index" in tag) {
        device.tags[tag.index] = tag.tag;
        delete patch["tags"];
      }
      merge(device, patch);
      write_log(`PATCH ${String(init.body)}`, "#e83");
      return respond(200, "");
    }
    //The temperature follows the setpoint while running, with a small deterministic wobble
    polls++;
    const target = device.running ? device.setpoint : 15;
    device.temperature =
      Math.round((device.temperature + (target - device.temperature) * 0.3 + Math.sin(polls) * 0.2) * 10) / 10;
    device.alarm = device.temperature > 25;
    write_log("GET /api/device", "#39e");
    return respond(200, JSON.stringify(device));
  };

  //The fake server is given to the parsers as their fetch, the global fetch is left alone
  const api_fetch: FetchFunction = (_url, init) => server(init);

  const parsed = make_fetch_parser(
    () => "/api/device",
    UPDATE_MS,
    {
      name: "sw",
      running: "bw",
      speed: "nw",
      setpoint: "nw",
      mode: "nw",
      temperature: "n",
      alarm: "b",
      note: "?s",
      outputs: [4, "bw"],
      log: [0, "s"],
      pumps: [0, { id: "n", name: "sw", running: "bw", speed: "nw" }],
      zones: [2, { name: "s", setpoint: "nw" }],
      tags: [0, "sw", { encode: (tag: string, index: number) => ({ index, tag }) }],
    },
    async (payload) => {
      const response = await api_fetch("/api/device", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
    },
    { fetch: api_fetch },
  );

  controls(sec, {
    "Go offline / online": () => {
      offline = !offline;
      write_log(offline ? "server offline" : "server online");
    },
    "Server renames device": () => (device.name = "Renamed on server"),
    "Server stops / starts": () => (device.running = !device.running),
    "Server adds log entry": () => device.log.push(`Entry ${device.log.length + 1}`),
    "Server sets / removes note": () => {
      if (device.note === undefined) device.note = "Serviced last week";
      else delete device.note;
    },
    "Clear log": () => log.replaceChildren(),
  });

  const writable = row(sec);
  writable.style.marginTop = "0.75rem";
  const name = box(writable, "name: sw, text input", WIDTH);
  name.appendChild(form.text_input().bind({ value: parsed.name }));
  const running = box(writable, "running: bw, switch and lamp", WIDTH);
  running.appendChild(form.switch().bind({ value: parsed.running }));
  running.appendChild(
    form.lamp({ text: "Running", colors: [FormColors.Red, FormColors.Green] }).bind({
      value: parsed.running,
    }),
  );
  const speed = box(writable, "speed: nw, slider and progress", WIDTH);
  speed.appendChild(form.slider({ min: 0, max: 100, unit: "%" }).bind({ value: parsed.speed }));
  speed.appendChild(form.progress({ unit: "%" }).bind({ value: parsed.speed }));
  const setpoint = box(writable, "setpoint: nw, number input and stepper", WIDTH);
  setpoint.appendChild(
    form.number_input({ min: 10, max: 30, decimals: 1, unit: "°C" }).bind({
      value: parsed.setpoint,
    }),
  );
  setpoint.appendChild(
    form.stepper({ min: 10, max: 30, step: 0.5, decimals: 1, unit: "°C" }).bind({
      value: parsed.setpoint,
    }),
  );
  const mode = box(writable, "mode: nw, toggle and dropdown", WIDTH);
  mode.appendChild(form.toggle_button({ selections: MODES }).bind({ value: parsed.mode }));
  mode.appendChild(form.dropdown({ selections: MODES }).bind({ value: parsed.mode }));

  const read_only = row(sec);
  read_only.style.marginTop = "0.75rem";
  const temperature = box(read_only, "temperature: n, read only", WIDTH);
  temperature.appendChild(
    form.progress({ min: 0, max: 40, decimals: 1, unit: "°C" }).bind({
      value: parsed.temperature,
    }),
  );
  temperature.appendChild(
    form.number_input({ decimals: 1, unit: "°C" }).bind({ value: parsed.temperature }),
  );
  const alarm = box(read_only, "alarm: b, read only, on above 25 °C", WIDTH);
  alarm.appendChild(
    form.lamp({ text: "Alarm", colors: [FormColors.None, FormColors.Red] }).bind({
      value: parsed.alarm,
    }),
  );
  const outputs = box(writable, "outputs: [4, bw], fixed array", WIDTH);
  for (const output of parsed.outputs)
    outputs.appendChild(form.switch().bind({ value: output[FETCH_PARSE] }));

  const rest = box(read_only, "note: ?s and log: [0, s]", { width: "24rem" });
  readout(rest, "note", parsed.note);
  //A dynamic array gives one state per item, each new item gets its own readout
  const log_items = rest.appendChild(document.createElement("div"));
  let shown_items = 0;
  parsed.log.sub((r) => {
    if (!r.ok) return;
    for (; shown_items < r.value.length; shown_items++)
      readout(log_items, `log[${shown_items}]`, r.value[shown_items]!);
  }, true);

  const root = box(sec, "root value, parsed[FETCH_PARSE]", { width: "48rem" });
  readout(root, "root", parsed[FETCH_PARSE]);

  //         _____  _____         __     _______
  //   /\   |  __ \|  __ \     /\\ \   / / ____|
  //  /  \  | |__) | |__) |   /  \\ \_/ / (___
  // / /\ \ |  _  /|  _  /   / /\ \\   / \___ \
  /// ____ \| | \ \| | \ \  / ____ \| |  ____) |
  //_/    \_\_|  \_\_|  \_\/_/    \_\_| |_____/
  const arr = section(
    "make_fetch_parser arrays",
    "Same fake server and request log as above. Purple log lines are the array changes the parser reports to subscribers. " +
      "The three pump lists show the same server pumps, each through its own parser. Each row shows the server id, insert, remove and swap pumps on the server and compare the purple change lines of the lists. " +
      "The first list has no key, rows follow positions, an insert at the start is reported as added at the end and every row changes pump, meant for arrays whose positions do not change. " +
      "The keyed lists report real inserts, removals and moves and each row keeps its pump, start typing in a row and let a poll insert a pump above it. " +
      "write single (default) sends only the changed value, addressed by index, a keyed item is looked up by id in the last received value. " +
      "write all sends the whole last received array with the change, it can also add, remove and move pumps from the client, a write before the next poll overwrites server changes since the last one. " +
      "Zones are a fixed array of objects, tags a dynamic array of strings written through { encode } as { index, tag }.",
  );
  controls(arr, {
    "Add pump at end": () => {
      const id = next_pump_id++;
      device.pumps.push({ id, name: `Pump ${id}`, running: false, speed: 10 });
    },
    "Insert pump at start": () => {
      const id = next_pump_id++;
      device.pumps.unshift({ id, name: `Pump ${id}`, running: true, speed: 50 });
    },
    "Remove first pump": () => device.pumps.shift(),
    "Remove last pump": () => device.pumps.pop(),
    "Swap first two pumps": () => {
      const [a, b] = device.pumps;
      if (a && b) device.pumps.splice(0, 2, b, a);
    },
    "Add tag": () => device.tags.push(`tag ${device.tags.length + 1}`),
    "Remove first tag": () => device.tags.shift(),
  });

  //Logs the array changes the parser reports, like a list would apply them
  const log_changes = (name: string) => (r: { ok: boolean; value?: unknown }) => {
    if (!r.ok) return;
    for (const change of state.a.read(r.value as unknown[])) {
      const where =
        change.type === "moved"
          ? `${change.from_index} to ${change.to_index}`
          : change.type === "fresh"
            ? ""
            : `at ${change.index}`;
      write_log(`${name}: ${change.type} ${where} (${change.items.length} items)`, "#93c");
    }
  };
  parsed.pumps.sub(log_changes("pumps"));
  parsed.tags.sub(log_changes("tags"));

  type Pumps = typeof parsed.pumps;
  type Pump = Pumps[number];
  const pump_list = (label: string, pumps: Pumps) =>
    box(arr, label, { width: "48rem", height: "14rem", display: "grid" }).appendChild(
      list.container(
        {
          id: list.column({
            title: "Server id",
            init_width: 6,
            field_gen: () => form.list_field(form.number_input()),
            field_apply: (field, v: Pump["id"]) => field.element.bind({ value: v }),
          }),
          name: list.column({
            title: "Name",
            init_width: 12,
            field_gen: () => form.list_field(form.text_input()),
            field_apply: (field, v: Pump["name"]) => field.element.bind({ value: v }),
          }),
          running: list.column({
            title: "Running",
            fixed_width: "min",
            field_gen: () => form.list_field(form.switch()),
            field_apply: (field, v: Pump["running"]) => field.element.bind({ value: v }),
          }),
          speed: list.column({
            title: "Speed",
            init_width: 12,
            field_gen: () => form.list_field(form.stepper({ min: 0, max: 100, unit: "%" })),
            field_apply: (field, v: Pump["speed"]) => field.element.bind({ value: v }),
          }),
        },
        (pump) =>
          ok({
            values: { id: pump.id, name: pump.name, running: pump.running, speed: pump.speed },
          }),
        pumps,
      ),
    );
  pump_list("pumps: [0, { id: n, name: sw, running: bw, speed: nw }], no key, write single", parsed.pumps);

  const patch_device = async (payload: unknown) => {
    const response = await api_fetch("/api/device", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await response.text());
  };
  //More parsers of the same server, with the other array options
  const parsed_keyed = make_fetch_parser(
    () => "/api/device",
    UPDATE_MS,
    { pumps: [0, { id: "n", name: "sw", running: "bw", speed: "nw" }, { key: "id" }] },
    patch_device,
    { fetch: api_fetch },
  );
  parsed_keyed.pumps.sub(log_changes("pumps keyed"));
  pump_list("pumps: [0, { … }, { key: id }], write single", parsed_keyed.pumps);

  const parsed_all = make_fetch_parser(
    () => "/api/device",
    UPDATE_MS,
    {
      pumps: [
        0,
        { id: "n", name: "sw", running: "bw", speed: "nw" },
        { write: "all", key: "id" },
      ],
    },
    patch_device,
    { fetch: api_fetch },
  );
  parsed_all.pumps.sub(log_changes("pumps keyed write all"));
  pump_list("pumps: [0, { … }, { write: all, key: id }]", parsed_all.pumps);
  let client_pump_id = 100;
  const report = (what: string) => (result: { ok: boolean; error?: unknown }) => {
    if (!result.ok) write_log(`${what} failed: ${String(result.error)}`, "#d33");
  };
  controls(arr, {
    "Client adds pump": () => {
      const id = client_pump_id++;
      void parsed_all.pumps
        .write(state.a.write.push({ id, name: `Client pump ${id}`, running: false, speed: 0 }))
        .then(report("add"));
    },
    "Client removes first pump": () =>
      void parsed_all.pumps.write(state.a.write.splice(0, 1)).then(report("remove")),
    "Client moves first pump to end": async () => {
      const pumps = await parsed_all.pumps;
      if (pumps.ok)
        void parsed_all.pumps
          .write(state.a.write.move(0, pumps.value.length - 1))
          .then(report("move"));
    },
  });

  const arrays = row(arr);
  arrays.style.marginTop = "0.75rem";
  const zones = box(arrays, "zones: [2, { name: s, setpoint: nw }]", { width: "20rem" });
  for (const zone of parsed.zones) {
    readout(zones, "name", zone.name);
    zones.appendChild(
      form.number_input({ min: 10, max: 30, decimals: 1, unit: "°C" }).bind({
        value: zone.setpoint,
      }),
    );
  }

  //Tags are rebuilt when the count changes, each input is bound to the state of its index
  const tags = box(arrays, "tags: [0, sw, { encode }]", { width: "20rem" });
  let shown_tags = -1;
  parsed.tags.sub((r) => {
    if (!r.ok || r.value.length === shown_tags) return;
    shown_tags = r.value.length;
    tags.replaceChildren(
      ...r.value.map((tag) => form.text_input().bind({ value: tag })),
    );
  }, true);
}
