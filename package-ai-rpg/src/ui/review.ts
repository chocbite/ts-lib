//Cowriter reviews: changing the rolls, the storyteller's story, and the scribes' changes, before going on.
import { ENGINE } from "#engine";
import { Difficulty, Phase, type Roll } from "#game";
import { rules_roll, rules_roll_word } from "#rules";
import { world_change_text, type Change, type Chunk } from "#world";
import form from "@chocbite/ts-lib-ui/form";
import { material_add_rounded, material_casino_rounded, material_delete_rounded } from "@chocbite/ts-lib-ui/icons";
import { rules_d100 } from "#rules";
import { el, field, panel } from "./common";

/**Opens the review for the phase of the current round, does nothing outside a review*/
export function review_panel() {
  const round = ENGINE.round.ok();
  if (round?.phase === Phase.RollsReview) rolls_review();
  else if (round?.phase === Phase.StoryReview) story_review();
  else if (round?.phase === Phase.ChangesReview) changes_review();
}

function footer(p: ReturnType<typeof panel>, redo: string, next: string) {
  p.footer.append(
    form.button({ text: redo, on_click: () => (ENGINE.redo(), p.close()) }),
    form.button({ text: next, on_click: () => (ENGINE.next(), p.close()) }),
  );
}

const DIFFICULTIES = Object.values(Difficulty).map((d) => ({ value: d, text: d[0].toUpperCase() + d.slice(1) }));

function rolls_review() {
  const p = panel("Review the rolls");
  const rolls: Roll[] = structuredClone(ENGINE.round.ok()!.rolls ?? []);
  const world = ENGINE.world;
  const list = p.body.appendChild(el("div", "review-list"));
  const save = () => {
    ENGINE.edit_rolls(rolls);
    render();
  };
  const render = (): void => {
    list.replaceChildren(
      ...rolls.map((roll, i) => {
        const result = rules_roll(world, roll);
        const skill = result.skill ? `${world.skill(result.skill)?.name} ${result.total}` : "no skill";
        return el(
          "div",
          "review-item",
          el(
            "div",
            "row",
            el("span", "review-summary", `${world.character(roll.character)?.name ?? roll.character}: ${roll.check}`),
            form.button({ icon: material_delete_rounded, on_click: () => (rolls.splice(i, 1), save()) }),
          ),
          el(
            "div",
            "row",
            field("Difficulty", form.dropdown({ selections: DIFFICULTIES, value: roll.difficulty, change: (v) => ((roll.difficulty = v), save()) })),
            field("Roll", form.number_input({ value: roll.roll, min: 1, max: 100, change: (v) => ((roll.roll = Math.round(v)), save()) })),
            form.button({ icon: material_casino_rounded, text: "Roll again", on_click: () => ((roll.roll = rules_d100()), save()) }),
          ),
          form.text({ text: `${skill}, chance ${result.chance}: ${rules_roll_word(result)}` }),
        );
      }),
    );
    if (!rolls.length) list.append(el("p", "field-note", "No action needed a roll."));
  };
  render();
  footer(p, "Decide the checks again", "Next phase");
}

function story_review() {
  const p = panel("Review the story");
  const round = ENGINE.round.ok()!;
  let story: Chunk[] = structuredClone(round.story);
  const speakers = [
    { value: "", text: "Narration" },
    ...round.cast.map((id) => ({ value: id, text: ENGINE.world.character(id)?.name ?? id })),
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
    el("div", "row", form.button({ text: "Add chunk", icon: material_add_rounded, on_click: () => ((story = [...story, { speaker: "", text: "" }]), save(), render()) })),
    el("p", "field-note", "Mentions are written as [Name](char:id). Edits are saved as you go."),
  );
  footer(p, "Write it again", "Next phase");
}

/**Name of the scribe a change came from*/
const source_name = (source: string) =>
  source === "time" ? "Time" : source === "world" ? "World" : source === "you" ? "Added by you" : (ENGINE.world.character(source)?.name ?? source);

function changes_review() {
  const p = panel("Review the changes");
  const round = ENGINE.round.ok()!;
  let changes: Change[] = structuredClone(round.changes);
  let sources: string[] = changes.map((_, i) => round.sources?.[i] ?? "you");
  const list = p.body.appendChild(el("div", "review-list"));
  const save = () => {
    ENGINE.edit_changes(changes, sources);
    render();
  };
  const remove = (i: number) => {
    changes.splice(i, 1);
    sources.splice(i, 1);
    save();
  };
  const render = () => {
    const problems = ENGINE.round.ok()?.problems ?? [];
    list.replaceChildren();
    //Grouped by scribe, in the order the scribes ran
    for (const source of [...new Set(sources)]) {
      list.append(el("h4", undefined, source_name(source)));
      changes.forEach((change, i) => {
        if (sources[i] !== source) return;
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
        list.append(
          el(
            "div",
            "review-item",
            el("div", "row", el("span", "review-summary", world_change_text(ENGINE.world, change)), form.button({ icon: material_delete_rounded, on_click: () => remove(i) })),
            problems[i] ? el("div", "error", "Will be skipped: " + problems[i]) : undefined,
            json,
          ),
        );
      });
    }
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
        on_click: () => {
          changes = [...changes, { op: "add_memory", character: "", memory: "" }];
          sources = [...sources, "you"];
          save();
        },
      }),
    ),
    el("p", "field-note", "Each change is JSON, with the same ops the scribes use."),
  );
  footer(p, "Record it again", "Apply and next round");
}
