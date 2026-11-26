import type { StateREA, StateROS } from "@chocbite/ts-lib/state";
import type { OptionState } from "../link";
import type { WidgetProperty } from "./properties";

/**A property of an owner with the states of its value, a row of the properties editor*/
export interface OwnedProperty {
  /**Unique among the properties of the owner*/
  readonly key: string;
  /**How the value is shown and edited*/
  readonly property: WidgetProperty;
  /**The states the value is in, a state holds the value or a link, undefined for one without a state, which shows the default read only
   * One for an owner of its own, several for owners shown together, see combine_owners, a change is written to all of them*/
  readonly states: readonly (OptionState<unknown> | undefined)[];
}

/**Something the properties editor shows, it gives the editor everything it shows*/
export interface PropertyOwner {
  /**The title of the editor*/
  readonly name: StateROS<string>;
  /**The properties, in the order they are shown, an error tells why there are none, like a widget whose definition is not registered*/
  readonly properties: StateREA<readonly OwnedProperty[]>;
}
