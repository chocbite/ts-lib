//Debug log: every LLM call of a round, with its prompt, thinking and reply.
import { ENGINE } from "#engine";
import type { Call } from "#game";
import { store_calls } from "#store";
import form from "@chocbite/ts-lib-ui/form";
import { el, panel } from "./common";

export function debug_panel() {
  const game = ENGINE.game.ok();
  if (!game) return;
  const p = panel("Debug log", true);
  const list = el("div", "debug-list");
  const show = async (round: number) => {
    const calls = await store_calls(game.id, round);
    list.replaceChildren();
    if (calls.err) return list.append(el("div", "error", calls.error));
    if (!calls.value.length) return list.append(el("p", "field-note", "No calls in this round."));
    list.append(...calls.value.sort((a, b) => a.started - b.started).map(call_view));
  };
  const rounds = ENGINE.rounds.ok().map((r) => ({ value: r.n, text: `Round ${r.n}` }));
  const current = ENGINE.rounds.ok().at(-1)?.n ?? 0;
  p.body.append(el("div", "row", form.dropdown<number, undefined>({ selections: rounds, value: current, change: show })), list);
  show(current);
}

function call_view(call: Call): HTMLElement {
  const who = call.character ? `${call.role} ${call.character}` : call.role;
  const tokens = call.prompt_tokens ? `, ${call.prompt_tokens} + ${call.reply_tokens} tokens` : "";
  const details = el("details", "call", el("summary", undefined, `${who}, ${call.model}, ${(call.ms / 1000).toFixed(1)} s${tokens}${call.error ? ", failed" : ""}`));
  details.append(
    ...call.messages.map((m) => el("div", undefined, el("h4", undefined, m.role), el("pre", undefined, m.content))),
    call.reasoning ? el("div", undefined, el("h4", undefined, "thinking"), el("pre", undefined, call.reasoning)) : "",
    el("div", undefined, el("h4", undefined, call.error ? "error" : "reply"), el("pre", undefined, call.error ?? call.reply)),
  );
  return details;
}
