//The play screen: the scene image, the story read chunk by chunk, the status line and the prompt bar.
import { ENGINE } from "#engine";
import { Phase, type Game, type Round } from "#game";
import { local_get, local_set } from "#lib/local";
import { COWRITER, Roles } from "#options";
import { Controller, type Character, type Id } from "#world";
import ctm from "@chocbite/ts-lib-ui/context-menu";
import { material_menu_rounded, material_refresh_rounded, material_send_rounded } from "@chocbite/ts-lib-ui/icons";
import { el, hue, icon_button, initials, spin, text_button, text_nodes } from "./common";

export interface PlayHandlers {
  menu: (button: HTMLElement) => void;
  review: () => void;
}

const read_key = (game: string) => `ai-rpg/read/${game}`;
const draft_key = (game: string, character: Id) => `ai-rpg/draft/${game}/${character}`;
const storage = { get: local_get, set: local_set };

export function play_view(handlers: PlayHandlers) {
  const scene = document.body.appendChild(el("div", "scene"));
  const place = document.body.appendChild(el("div", "place"));
  const stage = document.body.appendChild(el("div", "stage"));
  const story = stage.appendChild(el("div", "story"));
  const more = stage.appendChild(el("div", "more", "▼"));
  const status = stage.appendChild(el("div", "status"));
  const bar = stage.appendChild(el("div", "bar"));

  const tab = bar.appendChild(el("button", "tab"));
  const input = bar.appendChild(el("textarea", "prompt"));
  input.rows = 1;
  const send = icon_button(material_send_rounded, "Send (Enter)", () => submit());
  const redecide = icon_button(material_refresh_rounded, "Let the character decide again", () => selected && ENGINE.redecide(selected));
  const menu_button = icon_button(material_menu_rounded, "Menu", () => handlers.menu(menu_button));
  menu_button.classList.add("menu-button");
  bar.append(send, redecide, menu_button);

  let game: Game | undefined;
  let round: Round | undefined;
  let selected: Id | undefined;

  //       _____ _______ ____  _______     __
  //      / ____|__   __/ __ \|  __ \ \   / /
  //     | (___    | | | |  | | |__) \ \_/ /
  //      \___ \   | | | |  | |  _  / \   /
  //      ____) |  | | | |__| | | \ \  | |
  //     |_____/   |_|  \____/|_|  \_\ |_|
  //The story of the newest round that has one, read chunk by chunk, the reading position is kept per game
  let shown: Round | undefined;
  let read = 0;

  const story_round = () => [...ENGINE.rounds.ok()].reverse().find((r) => r.story.length);

  function render_story() {
    if (!game || !shown) {
      story.replaceChildren();
      more.hidden = true;
      return;
    }
    const world = game.world;
    story.replaceChildren(
      ...shown.story.slice(0, read + 1).map((chunk, i) => {
        const line = el("p", "chunk" + (chunk.speaker ? " said" : "") + (i === read ? " current" : ""));
        if (chunk.speaker) {
          const speaker = world.characters[chunk.speaker];
          const name = line.appendChild(el("span", "speaker", speaker?.name ?? chunk.speaker));
          name.style.setProperty("--hue", String(hue(chunk.speaker)));
        }
        line.append(text_nodes(chunk.text));
        return line;
      }),
    );
    more.hidden = read >= shown.story.length - 1;
    story.scrollTop = story.scrollHeight;
  }

  function update_story() {
    const next = story_round();
    if (!game || !next) {
      shown = undefined;
      return render_story();
    }
    if (shown?.n !== next.n || shown.game !== next.game) {
      const saved = JSON.parse(storage.get(read_key(game.id)) ?? "null") as { n: number; chunk: number } | null;
      read = saved?.n === next.n ? saved.chunk : 0;
    }
    shown = next;
    read = Math.min(read, next.story.length - 1);
    render_story();
  }

  function advance() {
    if (!game || !shown || read >= shown.story.length - 1) return;
    read++;
    storage.set(read_key(game.id), JSON.stringify({ n: shown.n, chunk: read }));
    render_story();
  }
  story.onclick = advance;
  more.onclick = advance;
  document.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && e.target === document.body) {
      e.preventDefault();
      advance();
    }
  });

  //      ____          _____
  //     |  _ \   /\   |  __ \
  //     | |_) | /  \  | |__) |
  //     |  _ < / /\ \ |  _  /
  //     | |_) / ____ \| | \ \
  //     |____/_/    \_\_|  \_\
  /**Characters the prompt can be for, player characters first, AI characters in cowriter mode*/
  const choices = (): Character[] => {
    if (!game || !round) return [];
    const cast = round.cast.map((id) => game!.world.characters[id]).filter((c): c is Character => !!c);
    const players = cast.filter((c) => c.controller === Controller.Player);
    return COWRITER.ok() ? [...players, ...cast.filter((c) => c.controller === Controller.Ai)] : players;
  };

  const is_ai = () => !!selected && game?.world.characters[selected]?.controller === Controller.Ai;

  function select(id: Id | undefined) {
    if (game && selected && !is_ai()) storage.set(draft_key(game.id, selected), input.value || undefined);
    selected = id;
    input.value = "";
    update_bar(true);
  }

  tab.onclick = () => {
    const list = choices();
    if (list.length < 2) return;
    ctm.summon(
      //The description tells characters with the same name apart
      ctm.menu(
        list.map((c) =>
          ctm.line(`${c.name}${c.controller === Controller.Ai ? " (AI)" : ""}, ${c.description}`, () => select(c.id), undefined, undefined, c.id === selected),
        ),
      ),
      tab,
      undefined,
      undefined,
      true,
    );
  };

  /**Shows the selected character's action or draft, the text is only replaced when asked or not being typed in*/
  function update_bar(replace = false) {
    const list = choices();
    if (!list.some((c) => c.id === selected)) {
      selected = list[0]?.id;
      replace = true;
    }
    const character = selected ? game?.world.characters[selected] : undefined;
    tab.replaceChildren();
    if (character) {
      const icon = tab.appendChild(el("span", "icon", initials(character.name)));
      icon.style.setProperty("--hue", String(hue(character.id)));
      tab.append(el("span", "name", character.name));
      if (list.length > 1) tab.append(el("span", "switch", "▾"));
    } else tab.append(el("span", "icon", "?"), el("span", "name", game ? "Nobody" : "No game"));
    const phase = round?.phase;
    const action = selected ? round?.actions[selected] : undefined;
    const ai = is_ai();
    const running = selected ? ENGINE.running.ok()["char:" + selected] : undefined;
    const can_act = phase === Phase.Characters && !!character;
    input.disabled = !can_act || (ai && !!running);
    input.classList.toggle("submitted", !!action && !ai);
    send.hidden = ai;
    redecide.hidden = !ai || !can_act;
    send.disabled = !can_act;
    if (ai) {
      const text = running ? running.text || "Deciding…" : (action?.text ?? "");
      if (replace || document.activeElement !== input) input.value = text;
      input.placeholder = can_act ? "What the character does" : "";
    } else {
      if (replace && game && selected) input.value = action?.text ?? storage.get(draft_key(game.id, selected)) ?? "";
      if (!game) input.value = "";
      input.placeholder = !game ? "No game, start one from the menu" : can_act ? "What do you do?" : "Wait for the story to go on…";
    }
    fit();
  }

  function submit() {
    if (!game || !selected || is_ai()) return;
    const text = input.value.trim();
    if (!text) return;
    ENGINE.submit(selected, text);
    storage.set(draft_key(game.id, selected), undefined);
    //The next player character that has not acted yet
    const waiting = choices().find((c) => c.controller === Controller.Player && !ENGINE.rounds.ok().at(-1)?.actions[c.id]);
    if (waiting) select(waiting.id);
  }

  const fit = () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.3) + "px";
  };

  input.oninput = () => {
    fit();
    if (!game || !selected) return;
    if (is_ai()) ENGINE.set_action(selected, input.value);
    else storage.set(draft_key(game.id, selected), input.value || undefined);
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !is_ai()) {
      e.preventDefault();
      submit();
    }
  };

  //       _____ _______    _______ _    _  _____
  //      / ____|__   __|/\|__   __| |  | |/ ____|
  //     | (___    | |  /  \  | |  | |  | | (___
  //      \___ \   | | / /\ \ | |  | |  | |\___ \
  //      ____) |  | |/ ____ \| |  | |__| |____) |
  //     |_____/   |_/_/    \_\_|   \____/|_____/
  function update_status() {
    status.replaceChildren();
    if (!game || !round) return;
    const running = Object.values(ENGINE.running.ok());
    const busy = (text: string) => status.append(spin(), el("span", undefined, text));
    if (round.error) {
      status.append(el("span", "error", round.error), text_button("Retry", () => ENGINE.retry()));
      return;
    }
    switch (round.phase) {
      case Phase.Characters: {
        const waiting_players = round.cast.filter((id) => game!.world.characters[id]?.controller === Controller.Player && !round!.actions[id]);
        const deciding = running.filter((r) => r.role === Roles.Character);
        if (waiting_players.length) {
          if (deciding.length && COWRITER.ok()) busy(`${deciding.length} character${deciding.length > 1 ? "s" : ""} deciding`);
        } else if (deciding.length)
          busy(`Waiting for ${deciding.map((r) => game!.world.characters[r.character!]?.name ?? "?").join(", ")} to decide`);
        return;
      }
      case Phase.Storyteller: {
        const teller = running.find((r) => r.role === Roles.Storyteller);
        busy(teller?.reasoning && !teller.text ? "The storyteller is thinking…" : "The storyteller is writing…");
        return;
      }
      case Phase.StoryReview:
        status.append(text_button("Review the story", handlers.review));
        return;
      case Phase.Scribes:
        busy("The scribes are recording what happened");
        return;
      case Phase.ChangesReview:
        status.append(text_button("Review the changes", handlers.review));
        return;
    }
  }

  //       _____  _____ ______ _   _ ______
  //      / ____|/ ____|  ____| \ | |  ____|
  //     | (___ | |    | |__  |  \| | |__
  //      \___ \| |    |  __| | . ` |  __|
  //      ____) | |____| |____| |\  | |____
  //     |_____/ \_____|______|_| \_|______|
  //A placeholder for the scene image until images are generated, colored by the location
  function update_scene() {
    const player = game && Object.values(game.world.characters).find((c) => c.controller === Controller.Player && !c.gone);
    const location = player ? game!.world.locations[player.location] : undefined;
    scene.style.setProperty("--hue", String(location ? hue(location.id) : 230));
    place.replaceChildren();
    if (game && location) place.append(el("span", "place-name", location.name), game.world.time ? el("span", "place-time", game.world.time) : "");
    else if (!game)
      place.append(el("span", "place-name", "AI RPG"), el("span", "place-time", "Open the menu to start or load a game"));
  }

  ENGINE.game.sub((g) => {
    const changed = g.value?.id !== game?.id;
    game = g.value;
    if (changed) {
      selected = undefined;
      shown = undefined;
    }
    update_scene();
    update_story();
    update_bar(changed);
    update_status();
  }, true);
  ENGINE.rounds.sub((rounds) => {
    const changed = rounds.value.at(-1)?.n !== round?.n;
    round = rounds.value.at(-1);
    update_story();
    update_bar(changed);
    update_status();
  }, true);
  ENGINE.running.sub(() => {
    update_bar();
    update_status();
  });
  COWRITER.sub(() => update_bar(true));
}
