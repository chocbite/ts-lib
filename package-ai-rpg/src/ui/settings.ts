//Settings panel: the AI server, models and thinking per role, and cowriter mode.
import { LlmThinking } from "#lib/llm";
import { COWRITER, MODELS, models_refresh, ROLE_NAMES, ROLES, Roles, SERVER_KEY, SERVER_URL } from "#options";
import form from "@chocbite/ts-lib-ui/form";
import { el, field, panel } from "./common";

const THINKING = [
  { value: LlmThinking.Off, text: "Off" },
  { value: LlmThinking.Low, text: "Low" },
  { value: LlmThinking.Medium, text: "Medium" },
  { value: LlmThinking.High, text: "High" },
];

/**Dropdown of the models the server offers, the chosen model is kept as a choice when the server does not list it*/
function model_dropdown(role: Roles) {
  const model = ROLES[role].model;
  const dropdown = form.dropdown<string, undefined>({ default: "Choose a model" }).bind({ value: model });
  const update = () => {
    const listed = MODELS.get();
    const models = listed.ok ? listed.value : [];
    const chosen = model.ok();
    dropdown.selections = [
      ...models.map((m) => ({ value: m, text: m })),
      ...(chosen && !models.includes(chosen) ? [{ value: chosen, text: `${chosen} (not on the server)` }] : []),
    ];
  };
  dropdown.attach_state(MODELS, () => update());
  dropdown.attach_state(model, () => update());
  return dropdown;
}

export function settings_panel() {
  const p = panel("Settings");
  models_refresh();
  const connection = form.text({ text: "" });
  connection.attach_state(MODELS, (models) => {
    connection.text = models.ok ? `Connected, the server has ${models.value.length} models` : models.error;
  });
  p.body.append(
    el("h3", undefined, "AI server"),
    field("Address", form.text_input({ placeholder: "http://host:4000/v1" }).bind({ value: SERVER_URL }), "OpenAI compatible, including /v1"),
    field("Key", form.password().bind({ value: SERVER_KEY }), "Stored in this browser, empty when the server needs none"),
    el("div", "row", connection, form.button({ text: "Test connection", on_click: () => models_refresh() })),
    el("h3", undefined, "Play"),
    field("Cowriter mode", form.switch().bind({ value: COWRITER }), "Shows what the AI characters decide, and stops after the storyteller and the scribes so their work can be edited"),
    el("h3", undefined, "Models"),
    ...Object.values(Roles).map((role) =>
      field(
        ROLE_NAMES[role],
        el("div", "row", model_dropdown(role), form.dropdown({ selections: THINKING }).bind({ value: ROLES[role].thinking })),
        "Model and how much it may think",
      ),
    ),
  );
}
