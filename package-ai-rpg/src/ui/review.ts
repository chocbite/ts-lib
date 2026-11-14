//Cowriter reviews: editing the storyteller's story, and the scribes' changes, before going on.
import { ENGINE } from "#engine";
import { Phase } from "#game";
import { world_change_text, type Change, type Chunk } from "#world";
import form from "@chocbite/ts-lib-ui/form";
import { material_add_rounded, material_delete_rounded } from "@chocbite/ts-lib-ui/icons";
import { el, panel } from "./common";

/**Opens the review for the phase of the current round, does nothing outside a review*/
export function review_panel() {
  const round = ENGINE.rounds.ok().at(-1);
  if (round?.phase === Phase.StoryReview) story_review();
  else if (round?.phase === Phase.ChangesReview) changes_review();
}

function footer(p: ReturnType<typeof panel>, redo: string, next: string) {
  p.footer.append(
    form.button({ text: redo, on_click: () => (ENGINE.redo(), p.close()) }),
    form.button({ text: next, on_click: () => (ENGINE.next(), p.close()) }),
  );
}

function story_review() {
  const p = panel("Review the story");
  const game = ENGINE.game.ok()!;
  const round = ENGINE.rounds.ok().at(-1)!;
  let story: Chunk[] = structuredClone(round.story);
  const speakers = [
    { value: "", text: "Narration" },
    ...round.cast.map((id) => ({ value: id, text: game.world.characters[id]?.name ?? id })),
  ];
  const list = p.body.appendChild(el("div", "review-list"));
  const save = () => ENGINE.edit_story(story);
  const render = (): void =>
    list.replaceChildren(
      ...story.map(
        (chunk, i): HTMLElement =>
        el(
          "div",
          "review-item",
          el(
            "div",
            "row",
            form.dropdown<string, undefined>({ selections: speakers, value: chunk.speaker, change: (v) => ((chunk.speaker = v), save()) }),
            form.button({ icon: material_delete_rounded, on_click: () => (story.splice(i, 1), save(), render()) }),
          ),
          form.text_multiline({ value: chunk.text, change: (v) => ((chunk.text = v), save()) }),
        ),
      ),
    );
  render();
  p.body.append(
    el("div", "row", form.button({ text: "Add chunk", icon: material_add_rounded, on_click: () => (story = [...story, { speaker: "", text: "" }], save(), render()) })),
    el("p", "field-note", "Mentions are written as [Name](char:id). Edits are saved as you go."),
  );
  footer(p, "Write it again", "Next phase");
}

function changes_review() {
  const p = panel("Review the changes");
  const game = ENGINE.game.ok()!;
  let changes: Change[] = structuredClone(ENGINE.rounds.ok().at(-1)!.changes);
  const list = p.body.appendChild(el("div", "review-list"));
  const save = () => {
    ENGINE.edit_changes(changes);
    render();
  };
  const render = () => {
    const problems = ENGINE.rounds.ok().at(-1)?.problems ?? [];
    list.replaceChildren(
      ...changes.map((change, i) => {
        const json = form.text_multiline({
          value: JSON.stringify(change, null, 1),
          change: (v) => {
            try {
              changes[i] = JSON.parse(v) as Change;
              save();
            } catch (e) {
              json.warn("Not valid JSON: " + String(e));
            }
          },
        });
        return el(
          "div",
          "review-item",
          el("div", "row", el("span", "review-summary", world_change_text(game.world, change)), form.button({ icon: material_delete_rounded, on_click: () => (changes.splice(i, 1), save()) })),
          problems[i] ? el("div", "error", "Will be skipped: " + problems[i]) : undefined,
          json,
        );
      }),
    );
    if (!changes.length) list.append(el("p", "field-note", "The scribes found nothing to change."));
  };
  render();
  p.body.append(
    el(
      "div",
      "row",
      form.button({
        text: "Add change",
        icon: material_add_rounded,
        on_click: () => ((changes = [...changes, { op: "add_memory", character: "", memory: "" }]), save()),
      }),
    ),
    el("p", "field-note", "Each change is JSON, the ops are add_location, add_character, update_character, move_character, remove_character, add_memory, set_relationship, update_location and set_time."),
  );
  footer(p, "Record it again", "Apply and next round");
}
