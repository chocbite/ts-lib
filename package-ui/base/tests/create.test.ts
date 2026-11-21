import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it } from "vitest";
import { Base, CREATE, define_element, input_key, type BaseOptions, type InputOptions } from "..";

/**Something outside the UI an element needs from its start, like a device it shows*/
interface Device {
  name: string;
}

const PAGE = {
  /**Label in front of the name of the device*/
  label: input_key<StateOrVal<string>>(),
};

/**Element with a required reference, given to its constructor, so the field is never unset*/
class DevicePage extends Base {
  static element_name() {
    return "devicepage";
  }
  static element_name_space() {
    return "test";
  }
  /**The order things happened in, to see the constructor runs before the inputs*/
  log: string[] = [];
  readonly #device: Device;
  #label = this.appendChild(document.createElement("span"));
  #name = this.appendChild(document.createElement("span"));
  constructor(device: Device) {
    super();
    this.#device = device;
    this.#name.textContent = device.name;
    this.log.push("constructor " + device.name);
  }
  get device(): Device {
    return this.#device;
  }
  [CREATE](options: object): void {
    super[CREATE](options);
    this.log.push("create " + this.#device.name);
  }
  set(options: BaseOptions & InputOptions<typeof PAGE>): this {
    super.set(options);
    this.set_input(PAGE.label, options.label, (label) => {
      this.#label.textContent = label.ok ? label.value : "";
      this.log.push("label " + this.#device.name);
    });
    return this;
  }
}
define_element(DevicePage);

/**A subclass passing the reference on to its parent*/
class PumpPage extends DevicePage {
  static element_name() {
    return "pumppage";
  }
  constructor(device: Device, readonly pump: number) {
    super(device);
  }
}
define_element(PumpPage);

/**Element without constructor arguments, created like before*/
class PlainBox extends Base {
  static element_name() {
    return "plainbox";
  }
  static element_name_space() {
    return "test";
  }
  set(options: BaseOptions & InputOptions<typeof PAGE>): this {
    super.set(options);
    this.set_input(PAGE.label, options.label, (label) => {
      this.textContent = label.ok ? label.value : "";
    });
    return this;
  }
}
define_element(PlainBox);

afterEach(() => {
  document.body.replaceChildren();
});

describe("create with constructor arguments", () => {
  it("gives the arguments after the options to the constructor, before any input is applied", () => {
    const device = { name: "Pump 1" };

    const page = DevicePage.create({ label: "Device" }, device);

    expect(page.device).toBe(device);
    expect(page.textContent).toBe("DevicePump 1");
    expect(page.log).toEqual(["constructor Pump 1", "create Pump 1", "label Pump 1"]);
  });

  it("takes inputs that are states as usual", () => {
    const label = state.ok_w("Device");
    const page = document.body.appendChild(DevicePage.create({ label }, { name: "Pump 1" }));

    label.set_ok("Pump");

    expect(page.textContent).toBe("PumpPump 1");
  });

  it("gives a subclass its own arguments, which it passes on to its parent", () => {
    const page = PumpPage.create({}, { name: "Pump 2" }, 7);

    expect(page.device.name).toBe("Pump 2");
    expect(page.pump).toBe(7);
  });

  it("creates elements without constructor arguments like before", () => {
    expect(PlainBox.create({ label: "a" }).textContent).toBe("a");
    expect(PlainBox.create().textContent).toBe("");
  });

  it("checks the arguments by the constructor", () => {
    //Only type checked, a missing or wrong argument is a compile error
    const typed = () => {
      // @ts-expect-error The device is required
      DevicePage.create({});
      // @ts-expect-error The device has a name
      DevicePage.create({}, { title: "x" });
      // @ts-expect-error A class without constructor arguments takes none
      PlainBox.create({}, { name: "x" });
    };
    expect(typed).toBeTypeOf("function");
  });
});
