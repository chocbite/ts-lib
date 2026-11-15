//A whole round against a mocked AI server, to check the phases and the sub scribes work together.
//The replies are fixed per call, the real prompts are only checked for what each call must see.
import { afterEach, describe, expect, it, vi } from "vitest";
import { Phase } from "#game";
import { COWRITER, SERVER_URL } from "#options";
import { QUICK_GAME } from "#quick";
import { store_delete_game } from "#store";
import { world_time_text } from "#world";
import { ENGINE } from "./index";

interface Body {
  messages: { role: string; content: string }[];
  response_format?: { json_schema: { name: string } };
}

/**Reply of the mocked server for a request*/
function answer(body: Body): unknown {
  const system = body.messages[0].content;
  switch (body.response_format?.json_schema.name) {
    case undefined:
      return "I look around carefully.";
    case "checks":
      return { checks: [{ character: "char:tamsin-vell", check: "spot the hidden ledger", skills: ["skill:perception"], difficulty: "normal" }] };
    case "story":
      return { story: [{ speaker: "", text: "[Tamsin Vell](char:tamsin-vell) notices a folded note under a mug." }] };
    case "time":
      return { amount: 20, unit: "minutes" };
    case "changes": {
      if (system.includes("world scribe"))
        return { changes: [{ op: "add_item", id: "new:note", name: "Folded note", description: "A note under a mug", in: "loc:the-wayward-goose" }] };
      const id = /\((char:[a-z0-9-]+)\)/.exec(system)![1];
      return {
        changes: [
          { op: "add_memory", character: id, memory: "A quiet evening." },
          //The character scribe sees what the world scribe added, by its real id
          ...(id === "char:tamsin-vell"
            ? [
                { op: "move", thing: "item:folded-note", in: id },
                { op: "award_exp", character: id, amount: "large", reason: "found the note" },
              ]
            : []),
        ],
      };
    }
    default:
      throw new Error("Unexpected call " + body.response_format?.json_schema.name);
  }
}

/**A streamed chat completion with the content in one chunk*/
function stream(content: string) {
  const sse = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`;
  return new Response(new Blob([sse]).stream(), { headers: { "Content-Type": "text/event-stream" } });
}

const calls: Body[] = [];
afterEach(() => vi.unstubAllGlobals());

describe("a round", () => {
  it("runs the characters, skillcheck, storyteller and sub scribes, then levels up", async () => {
    await SERVER_URL.write("http://mock/v1");
    await COWRITER.write(false);
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Body;
      calls.push(body);
      const reply = answer(body);
      return stream(typeof reply === "string" ? reply : JSON.stringify(reply));
    });

    const id = (await ENGINE.create(QUICK_GAME, "test")).unwrap();
    const round = () => ENGINE.round.ok()!;
    expect(round().phase).toBe(Phase.Characters);
    expect(round().cast).toEqual(["char:tamsin-vell", "char:edric", "char:wren"]);
    ENGINE.submit("char:tamsin-vell", "I look for the ledger.");
    await vi.waitFor(() => expect(round().n).toBe(2), { timeout: 5000 });

    const done = ENGINE.history.ok().at(-1)!;
    expect(done.rolls).toHaveLength(1);
    expect(done.rolls![0].roll).toBeGreaterThanOrEqual(1);
    //The storyteller got the result of the roll
    expect(calls.find((c) => c.response_format?.json_schema.name === "story")!.messages[1].content).toContain("spot the hidden ledger: Perception 45");
    expect(done.sources).toEqual(["time", "world", "char:tamsin-vell", "char:tamsin-vell", "char:tamsin-vell", "char:edric", "char:wren"]);
    expect(done.problems?.every((p) => p === undefined)).toBe(true);

    const world = ENGINE.world;
    expect(world_time_text(world.time)).toBe("Day 1, 19:50");
    expect(world.thing("item:folded-note")?.parent).toBe("char:tamsin-vell");
    expect(world.memories("char:wren")).toEqual(["A quiet evening."]);
    const tamsin = world.character("char:tamsin-vell")!;
    expect([tamsin.level, tamsin.skill_points]).toEqual([2, 5]);

    //Tamsin has points, so the next round starts with the level up phase, the player spends and is done
    expect(round().phase).toBe(Phase.LevelUp);
    expect(round().leveling).toEqual(["char:tamsin-vell"]);
    (await ENGINE.spend("char:tamsin-vell", "skill:perception", 5)).unwrap();
    ENGINE.level_done("char:tamsin-vell");
    expect(round().phase).toBe(Phase.Characters);
    expect(world.character("char:tamsin-vell")?.skills.find((s) => s.skill === "skill:perception")?.value).toBe(50);

    ENGINE.close();
    await store_delete_game(id);
  });
});
