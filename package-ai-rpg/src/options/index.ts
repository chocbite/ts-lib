//User settings of the game, stored in local storage.
import { llm_models, LlmThinking } from "#lib/llm";
import { settings_init } from "@chocbite/ts-lib-ui/settings";
import { err, none, some, type Option } from "@chocbite/ts-lib/result";
import state from "@chocbite/ts-lib/state";

const SETTINGS = settings_init("ai-rpg", "1", "AI RPG", "Settings of the game");

const is_string = (v: unknown): Option<string> => (typeof v === "string" ? some(v) : none());
const is_boolean = (v: unknown): Option<boolean> => (typeof v === "boolean" ? some(v) : none());
const is_thinking = (v: unknown): Option<LlmThinking> =>
  Object.values(LlmThinking).includes(v as LlmThinking) ? some(v as LlmThinking) : none();

const text = (id: string, name: string, description: string, fallback: string) =>
  SETTINGS.register(id, name, description, state.rosw(SETTINGS.get(id, fallback, is_string), true));

export const SERVER_URL = text("server_url", "Server", "Address of the AI server, including /v1", "");
export const SERVER_KEY = text("server_key", "Key", "Key for the AI server, empty when it needs none", "");
const PRIVATE_MODELS = state.res<string[]>(err("Not asked yet"));
/**Models the server offers, or why they could not be listed*/
export const MODELS = PRIVATE_MODELS.read_only;

let asking = 0;
/**Asks the server for its models again*/
export async function models_refresh() {
  const ask = ++asking;
  const list = await llm_models({ url: SERVER_URL.ok(), key: SERVER_KEY.ok() });
  //A newer ask, after the address or key changed, wins
  if (ask !== asking) return;
  if (list.ok) PRIVATE_MODELS.set_ok(list.value);
  else PRIVATE_MODELS.set_err(list.error);
}
SERVER_URL.sub(() => models_refresh());
SERVER_KEY.sub(() => models_refresh());

export const COWRITER = SETTINGS.register(
  "cowriter",
  "Cowriter mode",
  "Shows what the AI characters decide, and stops after the storyteller and scribes so their work can be edited",
  state.rosw(SETTINGS.get("cowriter", false, is_boolean), true),
);

export const Roles = {
  Builder: "builder",
  Character: "character",
  Storyteller: "storyteller",
  Scribes: "scribes",
} as const;
export type Roles = (typeof Roles)[keyof typeof Roles];

export const ROLE_NAMES: { [R in Roles]: string } = {
  builder: "Game builder",
  character: "Characters",
  storyteller: "Storyteller",
  scribes: "Scribes",
};

const DEFAULT_THINKING: { [R in Roles]: LlmThinking } = {
  builder: LlmThinking.Low,
  character: LlmThinking.Off,
  storyteller: LlmThinking.Low,
  scribes: LlmThinking.Off,
};

const role_settings = (role: Roles) => ({
  model: text(role + "_model", ROLE_NAMES[role] + " model", "Model used by the " + ROLE_NAMES[role].toLowerCase(), "qwen3.8-27b"),
  thinking: SETTINGS.register(
    role + "_thinking",
    ROLE_NAMES[role] + " thinking",
    "How much the model may think before answering",
    state.rosw(SETTINGS.get<LlmThinking>(role + "_thinking", DEFAULT_THINKING[role], is_thinking), true),
  ),
});

/**Model and thinking per role*/
export const ROLES = Object.fromEntries(Object.values(Roles).map((role) => [role, role_settings(role)])) as {
  [R in Roles]: ReturnType<typeof role_settings>;
};
