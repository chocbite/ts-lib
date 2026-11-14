//Game builder: a chat with an LLM that proposes a world, which can also be edited by hand, then started as a game.
import { ENGINE } from "#engine";
import { id_random } from "#lib/ids";
import { llm_chat, llm_json } from "#lib/llm";
import { ROLES, Roles, SERVER_KEY, SERVER_URL } from "#options";
import { PROMPT_BUILDER, schema_builder, story_text, type BuilderReply } from "#prompts";
import { schema_check } from "#lib/schema";
import { store_builds, store_delete_build, store_put_build, type Build } from "#store";
import { world_apply, world_chunks_ids, world_empty } from "#world";
import form from "@chocbite/ts-lib-ui/form";
import { material_send_rounded } from "@chocbite/ts-lib-ui/icons";
import { el, panel, spin, text_nodes, toast } from "./common";

const new_build = (): Build => ({ id: id_random(), created: Date.now(), updated: Date.now(), messages: [] });

/**Message to show for a chat message, assistant messages are JSON replies*/
function shown(content: string, role: string): string {
  if (role !== "assistant") return content;
  const json = llm_json(content);
  return json.ok && typeof (json.value as BuilderReply).message === "string" ? (json.value as BuilderReply).message : content;
}

export async function builder_panel() {
  const builds = await store_builds();
  let build = (builds.ok ? builds.value.sort((a, b) => b.updated - a.updated)[0] : undefined) ?? new_build();
  let controller: AbortController | undefined;
  const p = panel("New game", true, () => controller?.abort());

  const chat = el("div", "chat");
  const input = el("textarea", "chat-input");
  input.placeholder = build.messages.length ? "What should change?" : "Describe the game you want to play: the setting, who you play, the mood…";
  input.rows = 3;
  const working = el("div", "status");
  const proposal_view = el("div", "proposal");
  p.body.append(el("div", "builder", el("div", "builder-chat", chat, working, el("div", "row", input, form.button({ icon: material_send_rounded, on_click: () => send() }))), proposal_view));

  const save = () => {
    build.updated = Date.now();
    store_put_build(build);
  };

  const render_chat = () => {
    chat.replaceChildren(...build.messages.map((m) => el("div", "chat-message " + m.role, shown(m.content, m.role))));
    chat.scrollTop = chat.scrollHeight;
  };

  const render_proposal = () => {
    proposal_view.replaceChildren();
    const proposal = build.proposal;
    if (!proposal) return proposal_view.append(el("p", "field-note", "The proposed world shows up here."));
    const applied = world_apply(world_empty(), proposal.changes);
    const world = applied.world;
    const problems = applied.problems.filter((x) => x !== undefined);
    proposal_view.append(
      el("h3", undefined, proposal.name || "Untitled"),
      world.time ? el("p", "field-note", world.time) : "",
      el("h4", undefined, "Locations"),
      ...Object.values(world.locations).map((l) => el("p", undefined, el("b", undefined, l.name), " ", text_nodes(l.description))),
      el("h4", undefined, "Characters"),
      ...Object.values(world.characters).map((c) =>
        el(
          "p",
          undefined,
          el("b", undefined, c.name),
          c.controller === "player" ? el("span", "badge", "you") : "",
          ` at ${world.locations[c.location]?.name ?? "?"}: `,
          text_nodes(c.description),
        ),
      ),
      el("h4", undefined, "Opening"),
      el("p", "opening", text_nodes(story_text(world, world_chunks_ids(proposal.opening, applied.ids)))),
      problems.length ? el("div", "error", "Problems, these parts are skipped: " + problems.join("; ")) : "",
    );
    const json = form.text_multiline({
      value: JSON.stringify(proposal, null, 1),
      change: (v) => {
        const parsed = (() => {
          try {
            return schema_check<BuilderReply>(schema_builder(), JSON.parse(v));
          } catch (e) {
            return { ok: false as const, error: String(e) };
          }
        })();
        if (!parsed.ok) return json.warn(parsed.error);
        build.proposal = parsed.value;
        save();
        render_proposal();
      },
    });
    const editor = el("details", "proposal-json", el("summary", undefined, "Edit by hand (JSON)"), json);
    proposal_view.append(editor);
  };

  const start = async () => {
    if (!build.proposal) return;
    const premise = build.messages.find((m) => m.role === "user")?.content ?? "";
    const created = await ENGINE.create(build.proposal, premise);
    if (created.err) return toast(created.error);
    await store_delete_build(build.id);
    p.close();
  };
  const start_over = async () => {
    controller?.abort();
    await store_delete_build(build.id);
    build = new_build();
    render_chat();
    render_proposal();
  };
  p.footer.append(form.button({ text: "Start over", on_click: start_over }), form.button({ text: "Start the game", on_click: start }));

  async function send() {
    const text = input.value.trim();
    if (!text || controller) return;
    input.value = "";
    build.messages.push({ role: "user", content: text });
    save();
    render_chat();
    controller = new AbortController();
    working.replaceChildren(spin(), el("span", undefined, "The builder is thinking…"));
    const schema = schema_builder();
    const reply = await llm_chat(
      { url: SERVER_URL.ok(), key: SERVER_KEY.ok() },
      {
        model: ROLES[Roles.Builder].model.ok(),
        thinking: ROLES[Roles.Builder].thinking.ok(),
        messages: [{ role: "system", content: PROMPT_BUILDER }, ...build.messages],
        schema: { name: "world", schema },
        signal: controller.signal,
        on_text: (t, r) => (working.lastElementChild!.textContent = t ? `The builder is writing… (${t.length} characters)` : r ? "The builder is thinking…" : "Waiting for the server…"),
      },
    );
    controller = undefined;
    working.replaceChildren();
    if (reply.err) {
      if (reply.error !== "cancelled") working.append(el("span", "error", reply.error));
      //The message stays in the chat, sending again retries it
      build.messages.pop();
      input.value = text;
      save();
      return render_chat();
    }
    const json = llm_json(reply.value.text);
    const parsed = json.ok ? schema_check<BuilderReply>(schema, json.value) : json;
    if (parsed.err) working.append(el("span", "error", "The reply did not fit: " + parsed.error));
    else build.proposal = parsed.value;
    build.messages.push({ role: "assistant", content: reply.value.text });
    save();
    render_chat();
    render_proposal();
  }
  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  render_chat();
  render_proposal();
  input.focus();
}
