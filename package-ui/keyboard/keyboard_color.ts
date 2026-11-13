import { define_element } from "#base";
import { KeyboardBase } from "./base";
import "./keyboard_color.scss";

type HSV = { hue: number; saturation: number; value: number };
type RGB = { red: number; green: number; blue: number };

function hex_to_rgb(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    red: (value >> 16) & 255,
    green: (value >> 8) & 255,
    blue: value & 255,
  };
}

function rgb_to_hex({ red, green, blue }: RGB): string {
  const channel = (value: number) => value.toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function rgb_to_hsv({ red, green, blue }: RGB): HSV {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  const hue =
    delta === 0
      ? 0
      : ((maximum === r
          ? (g - b) / delta
          : maximum === g
            ? (b - r) / delta + 2
            : (r - g) / delta + 4) *
          60 +
          360) %
        360;
  return {
    hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  };
}

function hsv_to_rgb({ hue, saturation, value }: HSV): RGB {
  const chroma = value * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;
  const [red, green, blue] =
    hue < 60
      ? [chroma, second, 0]
      : hue < 120
        ? [second, chroma, 0]
        : hue < 180
          ? [0, chroma, second]
          : hue < 240
            ? [0, second, chroma]
            : hue < 300
              ? [second, 0, chroma]
              : [chroma, 0, second];
  return {
    red: Math.round((red + match) * 255),
    green: Math.round((green + match) * 255),
    blue: Math.round((blue + match) * 255),
  };
}

export class Keyboard_Color extends KeyboardBase {
  static element_name(): string {
    return "keyboard-color";
  }

  #input?: HTMLInputElement;
  #hex: HTMLInputElement;
  #square: HTMLDivElement;
  #marker: HTMLDivElement;
  #preview: HTMLOutputElement;
  #sliders: Record<"hue" | keyof RGB, HTMLInputElement>;
  #hsv: HSV = { hue: 0, saturation: 0, value: 0 };
  #rgb: RGB = { red: 0, green: 0, blue: 0 };
  /**Set while the keyboard dispatches input, so its own writes are not read back, a grey would lose the hue*/
  #writing = false;
  /**Values were written since the last change event*/
  #uncommitted = false;
  #on_input = () => {
    if (!this.#writing) this.#sync_from_input();
  };

  constructor() {
    super();
    const container = this.appendChild(document.createElement("div"));
    container.className = "keyboard-color-content";
    const picker = container.appendChild(document.createElement("div"));
    picker.className = "keyboard-color-picker";
    this.#square = picker.appendChild(document.createElement("div"));
    this.#square.className = "keyboard-color-square";
    this.#marker = this.#square.appendChild(document.createElement("div"));
    this.#marker.className = "keyboard-color-marker";

    const sliders = picker.appendChild(document.createElement("div"));
    sliders.className = "keyboard-color-sliders";
    this.#sliders = {
      hue: this.#make_slider(sliders, "Hue", 359),
      red: this.#make_slider(sliders, "Red", 255),
      green: this.#make_slider(sliders, "Green", 255),
      blue: this.#make_slider(sliders, "Blue", 255),
    };

    const controls = container.appendChild(document.createElement("div"));
    controls.className = "keyboard-color-controls";
    this.#preview = controls.appendChild(document.createElement("output"));
    this.#preview.className = "keyboard-color-preview";
    this.#preview.ariaLabel = "Selected color";
    this.#hex = controls.appendChild(document.createElement("input"));
    this.#hex.type = "text";
    this.#hex.ariaLabel = "Hex color";
    this.#hex.dataset.keyboardManual = "true";
    this.#hex.inert = true;

    this.#square.addEventListener("pointerdown", (event) => {
      this.#square.setPointerCapture(event.pointerId);
      this.#set_square(event);
    });
    this.#square.addEventListener("pointermove", (event) => {
      if (this.#square.hasPointerCapture(event.pointerId))
        this.#set_square(event);
    });
    this.#square.addEventListener("pointerup", (event) => {
      if (this.#square.hasPointerCapture(event.pointerId)) {
        this.#square.releasePointerCapture(event.pointerId);
        this.#write_color(true);
      }
    });
  }

  #make_slider(
    parent: HTMLElement,
    label: string,
    max: number,
  ): HTMLInputElement {
    const container = parent.appendChild(document.createElement("label"));
    container.title = label;
    container.textContent = label[0];
    const slider = container.appendChild(document.createElement("input"));
    slider.type = "range";
    slider.min = "0";
    slider.max = max.toString();
    slider.ariaLabel = label;
    slider.addEventListener("input", () => {
      if (label === "Hue") this.#hsv.hue = Number(slider.value);
      else {
        this.#rgb[label.toLowerCase() as keyof RGB] = Number(slider.value);
        this.#hsv = rgb_to_hsv(this.#rgb);
      }
      this.#write_color();
    });
    slider.addEventListener("change", () => this.#write_color(true));
    return slider;
  }

  open(element: HTMLElement): void {
    if (!(element instanceof HTMLInputElement) || element.type !== "color")
      return;
    if (element !== this.#input) this.#commit();
    this.#input?.removeEventListener("input", this.#on_input);
    this.#input = element;
    this.#input.addEventListener("input", this.#on_input);
    this.#sync_from_input();
    super.open(element);
  }

  close(): void {
    this.#commit();
    this.#input?.removeEventListener("input", this.#on_input);
    this.#input = undefined;
    super.close();
  }

  #set_square(event: PointerEvent): void {
    const bounds = this.#square.getBoundingClientRect();
    this.#hsv.saturation = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width),
    );
    this.#hsv.value = Math.min(
      1,
      Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height),
    );
    this.#write_color();
  }

  #write_color(commit = false): void {
    const input = this.#input;
    if (!input) return;
    this.#rgb = hsv_to_rgb(this.#hsv);
    const color = rgb_to_hex(this.#rgb);
    const changed = input.value !== color;
    input.value = color;
    this.#sync_controls(color);
    if (changed) {
      this.#uncommitted = true;
      this.#writing = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      this.#writing = false;
    }
    if (commit) this.#commit();
  }

  /**Emits change when values were written since the last change*/
  #commit(): void {
    if (this.#input && this.#uncommitted)
      this.#input.dispatchEvent(new Event("change", { bubbles: true }));
    this.#uncommitted = false;
  }

  #sync_from_input(): void {
    if (!this.#input) return;
    this.#rgb = hex_to_rgb(this.#input.value);
    this.#hsv = rgb_to_hsv(this.#rgb);
    this.#sync_controls(this.#input.value);
  }

  #sync_controls(color: string): void {
    this.#square.style.setProperty(
      "--keyboard-color-hue",
      `hsl(${this.#hsv.hue} 100% 50%)`,
    );
    this.#marker.style.left = `${this.#hsv.saturation * 100}%`;
    this.#marker.style.top = `${(1 - this.#hsv.value) * 100}%`;
    this.#sliders.hue.value = Math.round(this.#hsv.hue).toString();
    this.#sliders.red.value = this.#rgb.red.toString();
    this.#sliders.green.value = this.#rgb.green.toString();
    this.#sliders.blue.value = this.#rgb.blue.toString();
    this.#hex.value = color;
    this.#preview.style.backgroundColor = color;
  }
}
define_element(Keyboard_Color);
