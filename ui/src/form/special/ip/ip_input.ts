import { define_element } from "#base";
import { IPAddress, IPVersion, sleep } from "@chocbite/ts-lib/common";
import { get_cursor_position, set_cursor_end, set_selection_all } from "#selection";
import type { Option } from "@chocbite/ts-lib/result";
import { FormValueWrite, FormValueWriteOptions } from "../../base";
import "./ip_input.scss";

export interface FormIpOptions<
  ID extends string | undefined,
> extends FormValueWriteOptions<IPAddress, ID> {
  /**Ip address type, this is overwritten if supplied with an ipaddress with a different type*/
  type: IPVersion;
}

export class FormIp<ID extends string | undefined> extends FormValueWrite<
  IPAddress,
  ID
> {
  static element_name() {
    return "ipinput";
  }
  static element_name_space(): string {
    return "form";
  }

  #type: IPVersion;
  #parts: HTMLDivElement[] = Array.from({ length: 8 }, (_, i) => {
    const inp = this.appendChild(document.createElement("div"));
    if (i < 7) this.appendChild(document.createElement("span"));
    inp.contentEditable = "true";
    inp.onbeforeinput = async (ev) => {
      if (ev.inputType === "insertParagraph") ev.preventDefault();
      //Backspace
      else if (ev.inputType === "deleteContentBackward") {
        if (inp.textContent.length === 0 && i > 0) {
          set_cursor_end(inp.previousElementSibling as HTMLElement);
        }
        // Delete
      } else if (ev.inputType === "deleteContentForward") {
        if (inp.textContent.length === 0 && i < length - 1) {
          await sleep(0);
          (inp.nextElementSibling as HTMLElement)?.focus();
        }
      } else if (ev.data) {
        //Check for . or :
        if (
          (ev.data === "." || ev.data === ":" || ev.data === ",") &&
          i < length - 1
        ) {
          set_selection_all(inp.nextElementSibling as HTMLElement);
          ev.preventDefault();
        }
        //Check for valid characters
        else if (
          !ev.data.match(
            this.#type === IPVersion.V4 ? /^[\d]*$/ : /^[\dA-Fa-f]*$/,
          )
        )
          ev.preventDefault();
        //Prevent too long values
        else if (
          inp.textContent.length >= (this.#type === IPVersion.V4 ? 3 : 4)
        ) {
          ev.preventDefault();
          //Prevent too big values
        } else {
          const pos = get_cursor_position(inp);
          const potential =
            inp.textContent.slice(0, pos) +
            ev.data +
            inp.textContent.slice(pos);
          const num =
            this.#type === IPVersion.V4
              ? parseInt(potential, 10)
              : parseInt(potential, 16);
          if (
            (this.#type === IPVersion.V4 && num > 255) ||
            (this.#type === IPVersion.V6 && num > 65535)
          ) {
            if (i < this.#parts.length - 1)
              set_selection_all(inp.nextElementSibling as HTMLElement);
            else ev.preventDefault();
          }
        }
      }
    };
    inp.oninput = () => {
      if (
        inp.textContent.length === (this.#type === IPVersion.V4 ? 3 : 4) &&
        get_cursor_position(inp) === inp.textContent.length &&
        i < this.#parts.length - 1
      ) {
        set_selection_all(inp.nextElementSibling as HTMLElement);
      }
    };
    inp.onkeydown = async (e) => {
      if (e.key === "ArrowUp") {
      } else if (e.key === "ArrowDown") {
      } else if (e.key === "ArrowLeft" && i > 0) {
        if (get_cursor_position(inp) === 0 || inp.textContent.length === 0)
          set_cursor_end(inp.previousElementSibling as HTMLElement);
        else return;
      } else if (e.key === "ArrowRight" && i < this.#parts.length - 1) {
        if (
          get_cursor_position(inp) === inp.textContent.length ||
          inp.textContent.length === 0
        )
          (inp.nextElementSibling as HTMLElement)?.focus();
        else return;
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    return inp;
  });

  constructor(type: IPVersion, id?: ID) {
    super(id);
    this.type = type;
    this.#type = type;
    this.appendChild(this.warn_input);
    this.addEventListener("focusin", () => {
      this.selected = true;
    });
    this.addEventListener("focusout", () => {
      this.selected = false;
    });

    this.onpointerdown = (e) => {
      if (!this.#parts.includes(e.target as HTMLDivElement)) {
        e.preventDefault();
        set_cursor_end(this.#parts[this.#type === IPVersion.V4 ? 3 : 7]);
      }
    };
    this.ondblclick = (e) => {
      if (e.target !== this) return;
      e.preventDefault();
      set_selection_all(this.#parts[0]);
    };
    this.addEventListener("focusin", (e) => {
      e.preventDefault();
    });
    this.addEventListener("focusout", (e) => {
      if (e.relatedTarget && this.contains(e.relatedTarget as Node)) return;
      this.set_value_check(this.value_as_ip);
    });
    this.onkeydown = (e) => {
      if (e.key === "Enter") this.set_value_check(this.value_as_ip);
      else if (e.key === "Escape") {
        if (this.buffer) this.new_value(this.buffer);
        else this.clear_value();
      }
    };
    this.oncopy = (e) => {
      e.preventDefault();
      e.clipboardData?.setData("text/plain", this.value_as_ip.to_string());
    };
    this.onpaste = (e) => {
      e.preventDefault();
      const paste = e.clipboardData?.getData("text/plain") || "";
      const new_ip = new IPAddress(paste);
      if (new_ip.version !== this.#type) return;
      this.set_value_check(new_ip);
    };
  }

  focus(options?: FocusOptions): void {
    this.#parts[0].focus(options);
  }

  get value_as_ip(): IPAddress {
    return new IPAddress(
      this.#parts
        .slice(0, this.#type === IPVersion.V4 ? 4 : 8)
        .reduce((acc, part, i) => {
          acc += part.innerText;
          if (i < (this.#type === IPVersion.V4 ? 4 : 8) - 1)
            acc += this.#type === IPVersion.V4 ? "." : ":";
          return acc;
        }, ""),
    );
  }

  set type(val: IPVersion) {
    if (this.#type === val) return;
    this.#type = val;
    this.classList.toggle("ipv4", val === IPVersion.V4);
    this.classList.toggle("ipv6", val === IPVersion.V6);
    this.replaceChildren(
      ...this.#parts
        .slice(0, val === IPVersion.V4 ? 4 : 8)
        .flatMap((v, i) =>
          i < (val === IPVersion.V4 ? 4 : 8) - 1
            ? [v, document.createTextNode(val === IPVersion.V4 ? "." : ":")]
            : [v],
        ),
    );
  }

  protected new_value(val: IPAddress): void {
    this.type = val.version;
    val.as_array.forEach((part, i) => {
      this.#parts[i].textContent =
        val.version === IPVersion.V4 ? part.toString() : part.toString(16);
    });
  }

  protected clear_value(): void {
    this.#parts.forEach((part) => {
      part.textContent = "";
    });
  }

  protected new_error(_val: string): void {}

  protected clear_error(): void {}

  protected state_related(_related: Option<{}>): void {}
}
define_element(FormIp);

/**Creates an IP input form element */
export function form_ip<ID extends string | undefined>(
  options: FormIpOptions<ID>,
): FormIp<ID> {
  const input = new FormIp<ID>(options.type, options?.id);
  if (options) {
    FormValueWrite.apply_options(input, options);
  }
  return input;
}
