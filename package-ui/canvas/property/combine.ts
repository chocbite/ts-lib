import state, { type StateRES, type StateROS } from "@chocbite/ts-lib/state";
import type { OwnedProperty, PropertyOwner } from "./owner";

/**The properties all the lists have, with the same kind, in the order of the first, with the states of all of them,
 * without unique properties, as each owner has its own*/
function common_properties(
  lists: readonly (readonly OwnedProperty[])[],
): OwnedProperty[] {
  const [first, ...rest] = lists;
  const others = rest.map(
    (list) => new Map(list.map((owned) => [owned.key, owned])),
  );
  const common: OwnedProperty[] = [];
  for (const owned of first) {
    if (owned.property.unique) continue;
    const matches = others.map((other) => other.get(owned.key));
    if (!matches.every((match) => match?.property.kind === owned.property.kind))
      continue;
    common.push({
      key: owned.key,
      property: owned.property,
      states: [owned, ...(matches as OwnedProperty[])].flatMap(
        (match) => match.states,
      ),
    });
  }
  return common;
}

/**Several owners shown together, the properties all of them have, a change is written to all of them
 * The properties are an error while one of the owners has none
 * @param name the title of the owners together*/
export function combine_owners(
  owners: readonly PropertyOwner[],
  name: StateROS<string>,
): PropertyOwner {
  const lists = owners.map((owner) => owner.properties);
  const common = (values: unknown[]) =>
    common_properties(values as (readonly OwnedProperty[])[]);
  //Sync when every owner is, so the properties are there at once
  return {
    name,
    properties: lists.every((list) => list.rsync)
      ? state.c.res_map(common, ...(lists as StateRES<unknown>[]))
      : state.c.rea_map(common, ...lists),
  };
}
