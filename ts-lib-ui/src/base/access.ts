import { state } from "@chocbite/ts-lib/state";

/**Enum of possible access types for base element*/
export const AccessTypes = {
  Write: "w",
  Read: "r",
  None: "n",
} as const;
export type AccessTypes = (typeof AccessTypes)[keyof typeof AccessTypes];

/**List for access type*/
export const ACCESSTYPESINFO = state.e.list<AccessTypes>({
  [AccessTypes.Write]: {
    name: "Write",
    description: "Write access to element",
  },
  [AccessTypes.Read]: { name: "Read", description: "Read access to element" },
  [AccessTypes.None]: { name: "None", description: "No access to element" },
});
