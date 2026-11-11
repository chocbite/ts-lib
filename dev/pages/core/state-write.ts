import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
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
