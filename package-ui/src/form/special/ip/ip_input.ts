import { define_element } from "#base";
import { IPAddress, IPVersion, sleep } from "@chocbite/ts-lib/common";
import { get_cursor_position, set_cursor_end, set_selection_all } from "#selection";
import { err, ok, type Option, type Result } from "@chocbite/ts-lib/result";
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
  /**Amount of parts of the current type*/
  get #count() {
    return this.#type === IPVersion.V4 ? 4 : 8;
  }
  #parts: HTMLDivElement[] = Array.from({ length: 8 }, (_, i) => {
    const inp = this.appendChild(document.createElement("div"));
    if (i < 7) this.appendChild(document.createElement("span"));
    inp.contentEditable = "true";
    inp.onbeforeinput = async (ev) => {
      if (ev.inputType === "insertParagraph") ev.preventDefault();
      //Backspace
      else if (ev.inputType === "deleteContentBackward") {
        if (inp.textContent.length === 0 && i > 0) {
          set_cursor_end(this.#parts[i - 1]);
        }
        // Delete
      } else if (ev.inputType === "deleteContentForward") {
        if (inp.textContent.length === 0 && i < this.#count - 1) {
          await sleep(0);
          this.#parts[i + 1].focus();
        }
      } else if (ev.data) {
        //Check for . or :
        if (
          (ev.data === "." || ev.data === ":" || ev.data === ",") &&
          i < this.#count - 1
        ) {
          set_selection_all(this.#parts[i + 1]);
          ev.preventDefault();
        }
        //Check for valid characters
        else if (
          !ev.data.match(
            this.#type === IPVersion.V4 ? /^[\d]*$/ : /^[\dA-Fa-f]*$/,
          )
        )
          ev.preventDefault();
        else {
          //The text the part would have, typed text replaces the selection
          const [start, end] = this.#selection_in(inp);
          const potential =
            inp.textContent.slice(0, start) +
            ev.data +
            inp.textContent.slice(end);
          //Prevent too long values
          if (potential.length > (this.#type === IPVersion.V4 ? 3 : 4)) {
            ev.preventDefault();
            return;
          }
          //Prevent too big values
          const num =
            this.#type === IPVersion.V4
              ? parseInt(potential, 10)
              : parseInt(potential, 16);
          if (
            (this.#type === IPVersion.V4 && num > 255) ||
            (this.#type === IPVersion.V6 && num > 65535)
          ) {
            if (i < this.#count - 1) set_selection_all(this.#parts[i + 1]);
            else ev.preventDefault();
          }
        }
      }
    };
    inp.oninput = () => {
      if (
        inp.textContent.length === (this.#type === IPVersion.V4 ? 3 : 4) &&
        get_cursor_position(inp) === inp.textContent.length &&
        i < this.#count - 1
      ) {
        set_selection_all(this.#parts[i + 1]);
      }
    };
    inp.onkeydown = async (e) => {
      if (e.key === "ArrowUp") {
      } else if (e.key === "ArrowDown") {
      } else if (e.key === "ArrowLeft" && i > 0) {
        if (get_cursor_position(inp) === 0 || inp.textContent.length === 0)
          set_cursor_end(this.#parts[i - 1]);
        else return;
      } else if (e.key === "ArrowRight" && i < this.#count - 1) {
        if (
          get_cursor_position(inp) === inp.textContent.length ||
          inp.textContent.length === 0
        )
          this.#parts[i + 1].focus();
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
      this.#commit_typed();
    });
    this.onkeydown = (e) => {
      if (e.key === "Enter") this.#commit_typed();
      else if (e.key === "Escape") {
        if (this.buffer) this.new_value(this.buffer);
        else this.clear_value();
      }
    };
    this.oncopy = (e) => {
      e.preventDefault();
      const typed = this.#typed();
      if (typed.ok)
        e.clipboardData?.setData("text/plain", typed.value.to_string());
    };
    this.onpaste = (e) => {
      e.preventDefault();
      const paste = e.clipboardData?.getData("text/plain") || "";
      let new_ip: IPAddress;
      try {
        new_ip = new IPAddress(paste);
      } catch (error) {
        return this.warn(error instanceof Error ? error.message : String(error));
      }
      if (new_ip.version !== this.#type) return;
      this.#commit(new_ip);
    };
  }

  /**Start and end of the selection in a part, both the cursor position when nothing is selected*/
  #selection_in(part: HTMLElement): [number, number] {
    const selection = part.ownerDocument.getSelection();
    if (selection?.rangeCount && part.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const before = range.cloneRange();
      before.selectNodeContents(part);
      before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length;
      return [start, start + range.toString().length];
    }
    const position = get_cursor_position(part);
    return [position, position];
  }

  /**The typed address, or why the typed parts are not an address*/
  #typed(): Result<IPAddress, string> {
    if (this.#parts.slice(0, this.#count).some((part) => !part.textContent))
      return err("All parts of the address must be filled in");
    try {
      return ok(this.value_as_ip);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  }

  /**Commits the typed address, or warns why it is not an address*/
  #commit_typed() {
    const typed = this.#typed();
    if (typed.ok) this.#commit(typed.value);
    else this.warn(typed.error);
  }

  /**Commits an address, unless it is the current address, a new IPAddress object is never the same object as the current one*/
  #commit(ip: IPAddress) {
    if (this.buffer?.equals(ip)) return;
    this.set_value_check(ip);
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
        .slice(0, this.#count)
        .flatMap((v, i) =>
          i < this.#count - 1
            ? [v, document.createTextNode(val === IPVersion.V4 ? "." : ":")]
            : [v],
        ),
      //Kept, warnings are shown through it
      this.warn_input,
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
