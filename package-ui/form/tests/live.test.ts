import state, { type StateOrVal } from "@chocbite/ts-lib/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import form from "..";

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const show = <E extends HTMLElement>(element: E) =>
  document.body.appendChild(element);

afterEach(() => {
  document.body.replaceChildren();
});

interface LiveOptions {
  value: ReturnType<typeof state.ok_w<string>>;
  live: StateOrVal<boolean>;
  change: (value: string) => void;
}
/**The text fields with live, how to make one and the field the user types in*/
const fields = [
  ["text input", (options: LiveOptions) => form.text_input(options), "input"],
  [
    "multi line text",
    (options: LiveOptions) => form.text_multiline(options),
    "textarea",
  ],
  ["password", (options: LiveOptions) => form.password(options), "input"],
] as const;

for (const [name, make, field] of fields)
  describe(`Live ${name}`, () => {
    const setup = (live: StateOrVal<boolean>) => {
      const value = state.ok_w("");
      const change = vi.fn();
      const element = show(make({ value, live, change }));
      const input = element.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >(field)!;
      return { value, change, input };
    };
    const changes = (change: ReturnType<typeof vi.fn>) =>
      change.mock.calls.map(([value]) => value as string);

    it("writes every typed change, before the field is left", async () => {
      const { value, change, input } = setup(true);
      await userEvent.click(input);
      await userEvent.keyboard("abc");
      await tick();
      expect(changes(change)).toEqual(["a", "ab", "abc"]);
      expect(value.ok()).toBe("abc");
      expect(document.activeElement).toBe(input);
    });

    it("writes only when the field is left, without live", async () => {
      const { value, change, input } = setup(false);
      await userEvent.click(input);
      await userEvent.keyboard("abc");
      await tick();
      expect(change).not.toHaveBeenCalled();
      expect(value.ok()).toBe("");
      input.blur();
      await tick();
      expect(value.ok()).toBe("abc");
    });

    it("keeps the caret where the user types", async () => {
      const { value, input } = setup(true);
      await userEvent.click(input);
      await userEvent.keyboard("ac{ArrowLeft}bx");
      await tick();
      expect(input.value).toBe("abxc");
      expect(value.ok()).toBe("abxc");
    });

    it("leaves Escape to parents after typing, what was typed is written", async () => {
      const { value, input } = setup(true);
      const keys: string[] = [];
      const listening = new AbortController();
      document.addEventListener("keydown", (e) => keys.push(e.key), {
        signal: listening.signal,
      });
      await userEvent.click(input);
      await userEvent.keyboard("abc{Escape}");
      await tick();
      listening.abort();
      expect(keys).toContain("Escape");
      expect(input.value).toBe("abc");
      expect(value.ok()).toBe("abc");
    });

    it("follows live given as a state", async () => {
      const live = state.ok_w(false);
      const { value, input } = setup(live);
      await userEvent.click(input);
      await userEvent.keyboard("a");
      await tick();
      expect(value.ok()).toBe("");
      live.set_ok(true);
      await userEvent.keyboard("b");
      await tick();
      expect(value.ok()).toBe("ab");
    });
  });

describe("Live password", () => {
  it("does not write the field emptied by focusing, leaving it without typing shows the password again", async () => {
    const value = state.ok_w("secret");
    const change = vi.fn();
    const element = show(form.password({ value, live: true, change }));
    const input = element.querySelector("input")!;
    await userEvent.click(input);
    await tick();
    expect(input.value).toBe("");
    expect(value.ok()).toBe("secret");
    input.blur();
    await tick();
    expect(input.value).toBe("secret");
    expect(change).not.toHaveBeenCalled();
  });
});
