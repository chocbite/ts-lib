import {
  CompAnchor,
  comp,
  type Panel,
  type PanelOptions,
} from "@chocbite/ts-lib-ui/composition";
import { material_settings_rounded } from "@chocbite/ts-lib-ui/icons";
import { px_to_rem } from "@chocbite/ts-lib-ui/theme";
import state from "@chocbite/ts-lib/state";
import { controls, section } from "../../../helpers";

const open: Panel[] = [];
/**Opens a panel with a text explaining what to try*/
const show = (title: string, text: string, options: PanelOptions) => {
  const c = comp.content({
    title,
    icon: material_settings_rounded,
    closable: true,
  });
  c.style.padding = "1rem";
  c.textContent = text;
  const panel = comp.panel(c, options);
  open.push(panel);
  return panel;
};
const close_all = () => {
  for (const panel of open.splice(0)) if (panel.isConnected) panel.close();
};

//      _____   ____   _____ _____ _______ _____ ____  _   _
//     |  __ \ / __ \ / ____|_   _|__   __|_   _/ __ \| \ | |
//     | |__) | |  | | (___   | |    | |    | || |  | |  \| |
//     |  ___/| |  | |\___ \  | |    | |    | || |  | | . ` |
//     | |    | |__| |____) |_| |_   | |   _| || |__| | |\  |
//     |_|     \____/|_____/_____|  |_|  |_____\____/|_| \_|
{
  const sec = section(
    "Position",
    "Drag the title bar, or focus it and use the arrow keys (shift for 5rem, ctrl for 0.1rem). Without a position the panel starts centered and moves freely. An initial position is where it starts, it moves freely from there. Locked x is a read only state, it only moves up and down. The bound panel writes its states, the info line follows, and Reset puts it back. Make the window narrow, panels stay reachable and come back when it grows",
  );
  const x = state.ok_w(30);
  const y = state.ok_w(12);
  const info = sec.appendChild(document.createElement("div"));
  const show_info = () =>
    (info.textContent = `Bound panel x ${x.ok().toFixed(1)}, y ${y.ok().toFixed(1)}`);
  x.sub(show_info, true);
  y.sub(show_info);
  controls(sec, {
    Centered: () =>
      show("Centered", "No position given, moves freely", { width: 18 }),
    "Initial position": () =>
      show("Initial position", "Starts at x 4, y 14, moves freely", {
        x: 4,
        y: 14,
        width: 18,
      }),
    "Locked x": () =>
      show("Locked x", "x is a read only state, only moves up and down", {
        x: state.ok(4),
        y: 20,
        width: 18,
      }),
    Bound: () =>
      show("Bound", "Writes the x and y states", { x, y, width: 18 }),
    Reset: () => {
      x.set_ok(30);
      y.set_ok(12);
    },
    "Close all": close_all,
  });
}

//                _   _  _____ _    _  ____  _____
//          /\   | \ | |/ ____| |  | |/ __ \|  __ \
//         /  \  |  \| | |    | |__| | |  | | |__) |
//        / /\ \ | . ` | |    |  __  | |  | |  _  /
//       / ____ \| |\  | |____| |  | | |__| | | \ \
//      /_/    \_\_| \_|\_____|_|  |_|\____/|_|  \_\
{
  const sec = section(
    "Anchor",
    "All five panels have the same x and y, the middle of the page, each anchored at another point. The dot marks the position",
  );
  controls(sec, {
    "Open anchors": () => {
      const x = document.documentElement.clientWidth / 2;
      const y = document.documentElement.clientHeight / 2;
      const dot = document.body.appendChild(document.createElement("div"));
      Object.assign(dot.style, {
        position: "fixed",
        left: x - 4 + "px",
        top: y - 4 + "px",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: "red",
        zIndex: "2000",
        pointerEvents: "none",
      });
      for (const anchor of Object.values(CompAnchor)) {
        const panel = show(anchor, anchor, {
          x: state.ok_w(px_to_rem(x)),
          y: state.ok_w(px_to_rem(y)),
          anchor,
          width: 10,
        });
        void panel.on_close().then(() => dot.remove());
      }
    },
    "Close all": close_all,
  });
}

//       _____ _____ ___________ _   _  _____
//      / ____|_   _|___  /_   _| \ | |/ ____|
//     | (___   | |    / /  | | |  \| | |  __
//      \___ \  | |   / /   | | | . ` | | |_ |
//      ____) |_| |_ / /__ _| |_| |\  | |__| |
//     |_____/|_____/_____|_____|_| \_|\_____|
{
  const sec = section(
    "Sizing",
    "Drag the edges and corners, the opposite edge stays put. Switch the input mode to touch in the shell to see the sizers. An initial width is where it starts, a read only width can only change height, not sizeable has no sizers. The bound one writes its width and height, the minimum is 4rem",
  );
  const width = state.ok_w(20);
  const height = state.ok_w(10);
  const info = sec.appendChild(document.createElement("div"));
  const show_info = () =>
    (info.textContent = `Bound panel ${width.ok().toFixed(1)} x ${height.ok().toFixed(1)} rem`);
  width.sub(show_info, true);
  height.sub(show_info);
  controls(sec, {
    "Fits content": () =>
      show("Fits content", "Starts at the size of its content", {}),
    "Initial width": () =>
      show("Initial width", "Starts 16rem wide, sizes freely", { width: 16 }),
    "Locked width": () =>
      show("Locked width", "Only the height changes", { width: state.ok(16) }),
    "Not sizeable": () =>
      show("Not sizeable", "No sizers", { width: 16, sizeable: false }),
    Bound: () => show("Bound", "Writes width and height", { width, height }),
    "Close all": close_all,
  });
}

//      _           __     ________ _____   _____
//     | |        /\\ \   / /  ____|  __ \ / ____|
//     | |       /  \\ \_/ /| |__  | |__) | (___
//     | |      / /\ \\   / |  __| |  _  / \___ \
//     | |____ / ____ \| |  | |____| | \ \ ____) |
//     |______/_/    \_\_|  |______|_|  \_\_____/
{
  const sec = section(
    "Layers",
    "Click a panel to bring it to the front of its layer. The layer 1 panel stays above the layer 0 ones whatever you click. Swap layer moves the switching panel between layer 0 and 2",
  );
  const layer = state.ok_w(0);
  controls(sec, {
    "Two in layer 0": () => {
      show("Layer 0 a", "Click to raise", { x: 10, y: 14, width: 16 });
      show("Layer 0 b", "Click to raise", { x: 14, y: 17, width: 16 });
    },
    "One in layer 1": () =>
      show("Layer 1", "Always above layer 0", {
        x: 18,
        y: 20,
        width: 16,
        layer: 1,
      }),
    "Switching panel": () =>
      show("Switching", "Layer follows a state", {
        x: 22,
        y: 23,
        width: 16,
        layer,
      }),
    "Swap layer": () => layer.set_ok(layer.ok() === 0 ? 2 : 0),
    "Close all": close_all,
  });
}

//      _    _ _____ _____ _____ _   _  _____
//     | |  | |_   _|  __ \_   _| \ | |/ ____|
//     | |__| | | | | |  | || | |  \| | |  __
//     |  __  | | | | |  | || | | . ` | | |_ |
//     | |  | |_| |_| |__| || |_| |\  | |__| |
//     |_|  |_|_____|_____/_____|_| \_|\_____|
{
  const sec = section(
    "Hiding and modal",
    "Auto hide hides the panel when you press outside it, Show brings it back. Auto close closes it instead. The modal one darkens the page, pressing the dark part hides it, tab stays inside it. No title bar can not be moved",
  );
  const hidden = state.ok_w(true);
  let auto_hide: Panel | undefined;
  controls(sec, {
    "Auto hide": () => {
      if (!auto_hide?.isConnected)
        auto_hide = show("Auto hide", "Press outside to hide", {
          hidden,
          auto_hide: true,
          width: 18,
        });
      hidden.set_ok(false);
    },
    Show: () => hidden.set_ok(false),
    "Auto close": () =>
      show("Auto close", "Press outside to close", {
        auto_close: true,
        width: 18,
      }),
    Modal: () =>
      show("Modal", "Press the dark part to hide", {
        modal: true,
        auto_hide: true,
        width: 18,
      }),
    "No title bar": () =>
      show("No title bar", "Press outside to close", {
        titlebar: false,
        auto_close: true,
        width: 18,
      }),
    "Close all": close_all,
  });
}
