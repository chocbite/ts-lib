import { ok } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";
import { box, controls, row, section } from "../../helpers";

/**Simulated network delay of a fetch*/
const FETCH_MS = 300;

/**Adds a box with a remote state that counts fetches, setups and teardowns,
 * with buttons to subscribe and unsubscribe like a list row being unfolded and folded*/
function remote_box(
  parent: HTMLElement,
  label: string,
  times: { validity?: number | true; retention?: number },
) {
  const wrap = box(parent, label, {
    width: "19rem",
    border: "1px solid gray",
    padding: "0.4rem",
    fontFamily: "monospace",
  });
  const status = wrap.appendChild(document.createElement("div"));
  const shown = wrap.appendChild(document.createElement("div"));
  const log = wrap.appendChild(document.createElement("pre"));
  Object.assign(log.style, {
    height: "12rem",
    overflow: "auto",
    margin: "0.4rem 0 0",
    fontSize: "0.8rem",
  });

  const count = { fetch: 0, setup: 0, teardown: 0 };
  let connected = false;
  let subscribed = false;
  const start = performance.now();
  const write_log = (text: string, color = "") => {
    const line = log.appendChild(document.createElement("div"));
    line.textContent = `${((performance.now() - start) / 1000).toFixed(1).padStart(5)}s ${text}`;
    line.style.color = color;
    log.scrollTop = log.scrollHeight;
  };
  const render = () => {
    status.textContent = `fetch ${count.fetch}  setup ${count.setup}  teardown ${count.teardown}`;
    shown.textContent = subscribed
      ? "unfolded"
      : connected
        ? "folded, retaining connection"
        : "folded, torn down";
  };

  const remote = state.r.rea.from<string>(
    (s) => {
      const n = ++count.fetch;
      write_log(`fetch #${n} sent`, "#e83");
      render();
      setTimeout(() => s.update_single(ok(`value from fetch #${n}`), true), FETCH_MS);
    },
    () => {
      connected = true;
      count.setup++;
      write_log("setup");
      render();
    },
    () => {
      connected = false;
      count.teardown++;
      write_log("teardown");
      render();
    },
    times,
  );

  const sub = (v: Awaited<typeof remote>) => {
    write_log(`shown: ${v.ok ? v.value : v.error}`, "#3a3");
  };
  const unfold = () => {
    if (subscribed) return;
    subscribed = true;
    write_log("unfold (subscribe)");
    remote.sub(sub, true);
    render();
  };
  const fold = () => {
    if (!subscribed) return;
    subscribed = false;
    write_log("fold (unsubscribe)");
    remote.unsub(sub);
    render();
  };
  controls(wrap, {
    Unfold: unfold,
    Fold: fold,
    "Fold, unfold after 1s": () => {
      fold();
      setTimeout(unfold, 1000);
    },
    "Await once": async () => {
      write_log("await");
      const v = await remote;
      write_log(`await got: ${v.ok ? v.value : v.error}`, "#39e");
    },
    "Clear log": () => log.replaceChildren(),
  });
  render();
}

const sec = section(
  "Remote state validity and retention",
  `Each box is a remote state whose fetch takes ${FETCH_MS}ms, orange log lines are fetches. ` +
    "Unfold, then fold and unfold again within the retention time. " +
    "With validity true the buffered value is reused until teardown, so no new fetch is sent. " +
    "With validity 0 every unfold fetches, even while the connection is retained. " +
    "Numeric validity expires on time regardless of retention. " +
    "Wait past the retention after folding to see teardown, the next unfold fetches again.",
);
const r = row(sec);
remote_box(r, "validity true, retention 3000", { validity: true, retention: 3000 });
remote_box(r, "validity 0, retention 3000", { validity: 0, retention: 3000 });
remote_box(r, "validity 2000, retention 5000", { validity: 2000, retention: 5000 });
remote_box(r, "validity true, retention 0", { validity: true, retention: 0 });
