import state, { type State } from "@chocbite/ts-lib/state";

/**Kind of value a state holds, as far as it can be known at runtime*/
export type DepotStateKind = "number" | "string" | "boolean" | "enum";

/**Value of a sync state right now, undefined for async states and errors*/
export function now<V>(s: State<V> | undefined): V | undefined {
  return s && state.is.res(s) ? s.get().unwrap_or(undefined) : undefined;
}

/**Kind of a state, from its helper, or else from the current value of a sync state.
 * Undefined when it can not be known, like an async state without a helper*/
export function state_kind(s: State<unknown>): DepotStateKind | undefined {
  const related = s.related().unwrap_or(undefined);
  if (state.n.is_related(related)) return "number";
  if (state.e.is_related(related)) return "enum";
  if (state.s.is_related(related)) return "string";
  if (state.b.is_related(related)) return "boolean";
  const value = now(s);
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  return undefined;
}

/**Turns values of a state into text, using the unit and decimals of a number helper and the names of an enum helper.
 * Objects are shown as JSON, "(object)" when they can not be*/
export function state_format(s: State<unknown>): (value: unknown) => string {
  const related = s.related().unwrap_or(undefined);
  if (state.n.is_related(related)) {
    const unit = now(related.unit);
    const decimals = now(related.decimals);
    return (value) =>
      (typeof value === "number" && decimals !== undefined
        ? value.toFixed(decimals)
        : String(value)) + (unit ? " " + unit : "");
  }
  if (state.e.is_related(related)) {
    const list = now(related.list);
    return (value) =>
      (typeof value === "string" ? list?.[value]?.name : undefined) ??
      String(value);
  }
  return (value) => {
    if (typeof value !== "object" || value === null) return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return "(object)";
    }
  };
}
