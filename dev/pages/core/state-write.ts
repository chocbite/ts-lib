import { err_nice, ok } from "@chocbite/ts-lib/result";
import state, { type StateROSWS } from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

/**Adds a monospace log to the parent, returns a function writing a line to it*/
function log_box(parent: HTMLElement, label: string) {
  const log = box(parent, label, {
    width: "22rem",
    height: "12rem",
    overflow: "auto",
    border: "1px solid gray",
    padding: "0.4rem",
    fontFamily: "monospace",
    fontSize: "0.8rem",
    whiteSpace: "pre",
  });
  return (text: string) => {
    log.appendChild(document.createElement("div")).textContent = text;
    log.scrollTop = log.scrollHeight;
  };
}

//##################################################################################################################################################
{
  const sec = section(
    "Write gate",
    "Toggle the gate and write. While the gate is false, write and check give a not writable error and the value stays. The gate line follows write_enabled through a subscription, like a UI showing an input as disabled would",
  );
  const r = row(sec);
  const write_log = log_box(r, "log");
  const gate = state.ok_w(true);
  const value = state.rosw(state.n.help(ok(0), { max: state.ok(5) }), true);
  value.set_write_enabled(gate);
  value.write_enabled!.sub((g) => write_log(`gate ${String(g.ok && g.value)}`));
  value.sub((v) => write_log(`value ${v.value}`));
  let next = 1;
  controls(sec, {
    "toggle gate": () => gate.set_ok(!gate.ok()),
    "write next": async () => {
      const n = next++;
      const res = await value.write(n);
      write_log(`write ${n} -> ${res.ok ? "ok" : res.error}`);
    },
    "check 3": async () => {
      const res = await value.check(3);
      write_log(`check 3 -> ${res.ok ? "ok" : res.error}`);
    },
    "remove gate": () => {
      value.set_write_enabled(undefined);
      write_log("gate removed");
    },
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "Read only view",
    "Every line should say the view can not write, and the owner line should show the value changing through the view's subscription",
  );
  const r = row(sec);
  const write_log = log_box(r, "log");
  const owner = state.ok_w(0);
  const view = owner.read_only;
  write_log(`view === owner: ${String((view as unknown) === owner)}`);
  write_log(`same view twice: ${String(owner.read_only === view)}`);
  write_log(`view.writable: ${String(view.writable)}`);
  write_log(`"write" in view: ${String("write" in view)}`);
  write_log(`"set" in view: ${String("set" in view)}`);
  view.sub((v) => write_log(`view sees ${v.value}`));
  controls(sec, {
    "owner set +1": () => owner.set_ok(owner.ok() + 1),
    "write through narrowing": async () => {
      if (view.writable) write_log(`write -> ${String(await view.write(99))}`);
      else write_log("narrowing found view not writable");
      const any_view = view as unknown as { write?: (v: number) => unknown };
      write_log(`forced write exists: ${String(typeof any_view.write)}`);
    },
    "view.check(1)": async () => {
      const res = await view.check?.(1);
      write_log(`check -> ${res?.ok ? "ok" : res?.error}`);
    },
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "Sync writes",
    "Move items between two lists with write_sync, the right list takes at most 3. A refused move puts the item back. Each move logs two lines, total 4 from the subscriber of the first list, which runs between the two writes, then total 5, nothing else can run in between"
  );
  const r = row(sec);
  const write_log = log_box(r, "log");
  const FULL = Symbol("Full");
  const left = state.ok_w([1, 2, 3, 4, 5]);
  const right = state.rosws(ok<number[]>([]), (value, owner, old) => {
    const next = state.a.write_apply(value, [...(old?.value ?? [])])[0];
    if (next.length > 3) return err_nice(FULL, "the right list takes at most 3");
    owner.set_ok(next);
    return ok(undefined);
  });
  const show = () =>
    write_log(`left [${left.ok().join(",")}] right [${right.ok().join(",")}] total ${left.ok().length + right.ok().length}`);
  left.sub(show);
  right.sub(show);
  const move = (from: StateROSWS<number[], any, any>, to: StateROSWS<number[], any, any>, name: string) => {
    const list = from.ok();
    if (!list.length) return write_log(`${name}: nothing to move`);
    const item = list[0]!;
    const taken = from.write_sync(state.a.write.splice(0, 1));
    if (taken.err) return write_log(`${name}: ${String(taken.error)}`);
    const given = to.write_sync(state.a.write.push(item));
    if (given.err) {
      from.write_sync(state.a.write.splice(0, 0, item));
      write_log(`${name}: refused, ${String(given.error)}, put back`);
    }
  };
  controls(sec, {
    "move left to right": () => move(left, right, "left to right"),
    "move right to left": () => move(right, left, "right to left"),
  });
}

//##################################################################################################################################################
{
  const sec = section(
    "Sync writes through derived states",
    "Each button writes synchronously through a proxy, a collected state or a nested state, the log line after it must already show the new value. The wsync lines say which derived states write synchronously, the one with an async write form must say false",
  );
  const r = row(sec);
  const write_log = log_box(r, "log");
  const celsius = state.ok_w(20);
  const text = celsius.proxy_w_map((c) => `${c} °C`, {
    write_sync: (value: string, source) => source.write_sync(parseFloat(value)),
  });
  const text_async = celsius.proxy_w_map((c) => `${c} °C`, {
    write: (value: string, source) => source.write(parseFloat(value)),
  });
  const low = state.ok_w(1);
  const high = state.ok_w(5);
  const span = state.c.rosws(
    ([l, h]) => ok(h.value - l.value),
    { write_sync: (value: number, [l, h]) => h.write_sync(l.ok() + value) },
    low,
    high,
  );
  const rooms = [{ name: state.ok_w("Kitchen") }, { name: state.ok_w("Hall") }];
  const selected = state.ok_w(rooms[0]!);
  const name = selected.nested((room) => room.name);
  write_log(`wsync: proxy ${String(text.wsync)}, async form proxy ${String(text_async.wsync)}, collected ${String(span.wsync)}, nested ${String(name.wsync)}`);
  let n = 0;
  controls(sec, {
    "proxy write_sync": () => {
      const res = text.write_sync(`${++n * 5} °C`);
      write_log(`proxy -> ${res.ok ? "ok" : String(res.error)}, celsius ${celsius.ok()}`);
    },
    "collected write_sync": () => {
      const res = span.write_sync(++n);
      write_log(`span -> ${res.ok ? "ok" : String(res.error)}, low ${low.ok()} high ${high.ok()} span ${span.ok()}`);
    },
    "nested switch and write_sync": () => {
      selected.write_sync(rooms[++n % 2]!);
      const res = name.write_sync(`Room ${n}`);
      write_log(`nested -> ${res.ok ? "ok" : String(res.error)}, ${rooms.map((room) => room.name.ok()).join(", ")}`);
    },
  });
}
