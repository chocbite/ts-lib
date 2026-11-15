//What a character can mention in its action: only what it knows, the same as what its LLM is told.
//What is with it, what it carries, the places it can go to, and the people it knows, under the names it knows.
import { ENGINE } from "#engine";
import type { MentionCandidate } from "#lib/mention_input";
import { Kind, world_known_as, world_subtree, world_visible, type Id, type ThingKind } from "#world";

export interface Mentionable extends MentionCandidate {
  kind: ThingKind;
  /**Where it is to the character, tells look alikes apart*/
  detail: string;
}

export function mentionable(viewer: Id): Mentionable[] {
  const world = ENGINE.world;
  const me = world.character(viewer);
  if (!me) return [];
  const found = new Map<Id, Mentionable>();
  const add = (id: Id, detail: string) => {
    const t = world.thing(id);
    if (!t || t.gone || found.has(id) || id === viewer) return;
    const name = t.kind === Kind.Character ? world_known_as(world, viewer, id) : t.name;
    found.set(id, { id, name, kind: t.kind, detail });
  };
  for (const t of world_visible(world, viewer)) add(t.id, t.kind === Kind.Location ? "a way to go" : "here");
  for (const t of world_subtree(world, viewer)) add(t.id, "carried");
  for (const id of Object.keys(me.relationships)) add(id, "known");
  return [...found.values()];
}
