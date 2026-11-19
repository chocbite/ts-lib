import depot, { type DepotEntry, type DepotNode } from "@chocbite/ts-lib/depot";
import {
  err_nice,
  none,
  ok,
  some,
  type Option,
  type ResultNice,
} from "@chocbite/ts-lib/result";
import state, {
  type State,
  type StateOrVal,
  type StateREAW,
} from "@chocbite/ts-lib/state";

/**The kinds of the NiceErrors of links*/
export const link_errors = Object.freeze({
  /**The option holds a link, only seen for an instant while a viewport switches the widget over to the linked state*/
  LINKED: Symbol("Linked"),
  /**The path of a link is registered, but not in the states type of the depot*/
  NOT_A_STATE: Symbol("Not a state"),
  /**A transform of a link can not transform the value, like linear for a value that gives no number*/
  TRANSFORM: Symbol("Value can not be transformed"),
  /**A linked value can not be converted to the type of the option, like the text "abc" for a number*/
  CONVERT: Symbol("Value can not be converted"),
});

//      _______ _____            _   _  _____ ______ ____  _____  __  __  _____
//     |__   __|  __ \     /\   | \ | |/ ____|  ____/ __ \|  __ \|  \/  |/ ____|
//        | |  | |__) |   /  \  |  \| | (___ | |__ | |  | | |__) | \  / | (___
//        | |  |  _  /   / /\ \ | . ` |\___ \|  __|| |  | |  _  /| |\/| |\___ \
//        | |  | | \ \  / ____ \| |\  |____) | |   | |__| | | \ \| |  | |____) |
//        |_|  |_|  \_\/_/    \_\_| \_|_____/|_|    \____/|_|  \_\_|  |_|_____/

/**Maps a number linearly from one range to another, like 50 to 100 becoming 150 to 200
 * Values outside the from range are extrapolated, writing maps back from the to range*/
export interface LinearTransform {
  readonly kind: "linear";
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

/**A change of the value between the linked state and the widget, every kind is saved with the link
 * Add a kind by adding it to this union and to TRANSFORMS*/
export type LinkTransform = LinearTransform;

/**What canvas does for a kind of transform*/
interface TransformKind<T extends LinkTransform> {
  /**From the value of the linked state to the value the widget gets*/
  read(transform: T, value: unknown): ResultNice<unknown>;
  /**From a value the widget writes back to a value for the linked state,
   * undefined when the transform can not be reversed, the option is then read only*/
  reverse(transform: T): ((value: unknown) => unknown) | undefined;
  /**Checks a saved transform of the kind*/
  valid(json: Readonly<Record<string, unknown>>): boolean;
}

const is_pair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n));

const TRANSFORMS: {
  readonly [K in LinkTransform["kind"]]: TransformKind<
    Extract<LinkTransform, { kind: K }>
  >;
} = {
  linear: {
    //Any value giving a number with Number works, so a boolean maps 0 and 1
    read: ({ from: [a, b], to: [c, d] }, value) => {
      const number = Number(value);
      if (Number.isNaN(number))
        return err_nice(
          link_errors.TRANSFORM,
          "Linear transform of a value that is not a number",
        );
      if (a === b)
        return err_nice(
          link_errors.TRANSFORM,
          "Linear transform from an empty range",
        );
      return ok(c + ((number - a) * (d - c)) / (b - a));
    },
    reverse: ({ from: [a, b], to: [c, d] }) =>
      a === b || c === d
        ? undefined
        : (value) => a + (((value as number) - c) * (b - a)) / (d - c),
    valid: (json) => is_pair(json.from) && is_pair(json.to),
  },
};

/**What canvas does for the kind of the transform, undefined for a kind it does not know, like one saved by a newer version*/
const transform_kind = (transform: { kind: string }) =>
  (TRANSFORMS as Record<string, TransformKind<LinkTransform> | undefined>)[
    transform.kind
  ];

/**A linear transform, maps the range from of the linked state to the range to of the widget*/
export function linear_transform(
  from: readonly [number, number],
  to: readonly [number, number],
): LinearTransform {
  return { kind: "linear", from, to };
}

//      _      _____ _   _ _  __
//     | |    |_   _| \ | | |/ /
//     | |      | | |  \| | ' /
//     | |      | | | . ` |  <
//     | |____ _| |_| |\  | . \
//     |______|_____|_| \_|_|\_\

declare const LINKED: unique symbol;

export interface CanvasLinkOptions {
  /**Applied in order to the value of the linked state, in reverse to a value written by the widget*/
  readonly transforms?: readonly LinkTransform[];
}

/**A link from an option of a widget to a state registered in the states type of the depot, like "/states/machine/speed"
 * The state of an option holds a link in place of a value, each viewport looks the path up and gives the widget the registered state
 * through the transforms of the link, so a writable state is written by the user and a read only state locks the option
 * Saved as { "$link": { "kind": "depot", "path": "/states/machine/speed", "transforms": [...] } }*/
export class CanvasLink<T = unknown> {
  /**Only for typing, the type of the value the widget gets*/
  declare readonly [LINKED]?: T;
  /**What is linked to, only states of the depot for now*/
  readonly kind = "depot";
  /**Path of the state in the depot*/
  readonly path: string;
  readonly transforms: readonly LinkTransform[];
  constructor(path: string, options: CanvasLinkOptions = {}) {
    this.path = path;
    this.transforms = options.transforms ?? [];
  }
  /**What a link is saved as, a single $link key, so it is never mistaken for a value*/
  toJSON(): { $link: Record<string, unknown> } {
    return {
      $link: {
        kind: this.kind,
        path: this.path,
        ...(this.transforms.length ? { transforms: this.transforms } : {}),
      },
    };
  }
}

/**Whether two links link to the same state with the same transforms*/
export function same_link(a: CanvasLink, b: CanvasLink): boolean {
  return (
    a === b ||
    (a.kind === b.kind &&
      a.path === b.path &&
      JSON.stringify(a.transforms) === JSON.stringify(b.transforms))
  );
}

/**A link to a state of the depot, for an option of a widget
 * Fits any option, the linked state is only known once the page is shown, give the value type to check it against the option,
 * canvas.link<number>("/states/machine/speed")
 * @param target path of the state, like "/states/machine/speed", or its entry*/
export function canvas_link<T = never>(
  target: string | DepotEntry<unknown>,
  options?: CanvasLinkOptions,
): CanvasLink<T> {
  return new CanvasLink<T>(
    typeof target === "string" ? target : target.path,
    options,
  );
}

const is_record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**Whether a saved value is a link, an object with only a $link key*/
export const is_link_json = (value: unknown): value is { $link: unknown } =>
  is_record(value) && "$link" in value && Object.keys(value).length === 1;

/**A link from what it is saved as, none when the saved link is broken
 * A transform of a kind canvas does not know is kept, it shows as an error on the option*/
export function link_from_json(json: { $link: unknown }): Option<CanvasLink> {
  const link = json.$link;
  if (!is_record(link) || link.kind !== "depot") return none();
  if (typeof link.path !== "string") return none();
  const transforms = link.transforms ?? [];
  if (!Array.isArray(transforms)) return none();
  for (const transform of transforms as unknown[]) {
    if (!is_record(transform) || typeof transform.kind !== "string")
      return none();
    const kind = transform_kind(transform as { kind: string });
    if (kind && !kind.valid(transform)) return none();
  }
  return some(
    new CanvasLink(link.path, {
      transforms: transforms as LinkTransform[],
    }),
  );
}

//      _____ _______    _______ ______  _____
//     / ____|__   __|/\|__   __|  ____|/ ____|
//    | (___    | |  /  \  | |  | |__  | (___
//     \___ \   | | / /\ \ | |  |  __|  \___ \
//     ____) |  | |/ ____ \| |  | |____ ____) |
//    |_____/   |_/_/    \_\_|  |______|_____/

/**The value type of an option, the option of the type StateOrVal<T>, or undefined*/
type ValueOf<V> = [Exclude<V, undefined>] extends [State<infer T, any, any>]
  ? T
  : Exclude<V, undefined | State<any, any, any>>;

/**State of an option of a widget on a page, holding a value or a link*/
export type OptionState<T> = State<T | CanvasLink<T>, any, any>;

/**The options of a widget on a page, a state for every option, holding a value or a link of the value type of the option*/
export type WidgetOptionStates<O> = {
  readonly [K in keyof O]?: OptionState<ValueOf<O[K]>>;
};

/**Options given to canvas.widget, initial values and links are made writable states*/
export type WidgetOptionsInput<O> = {
  readonly [K in keyof O]?: StateOrVal<
    ValueOf<O[K]> | CanvasLink<ValueOf<O[K]>>
  >;
};

/**The option as the widget gets it while the option holds a value, a link is an error,
 * only seen for an instant while the viewport switches the widget to the linked state*/
export function option_value_state(
  option: OptionState<unknown>,
): State<unknown, any, any> {
  const read = (result: ResultNice<unknown>) =>
    result.ok && result.value instanceof CanvasLink
      ? err_nice(link_errors.LINKED, `Linked to ${result.value.path}`)
      : result;
  return option.writable
    ? state.proxy.reaw(option as StateREAW<unknown>, read)
    : state.proxy.rea(option, read);
}

/**Converts a value to the type an option needs*/
export type OptionConvert = (value: unknown) => ResultNice<unknown>;

/**Converts a value written back to the type of the value read from the linked state, so a boolean state stays boolean*/
function like(read: unknown, value: unknown): unknown {
  switch (typeof read) {
    case "number":
      return Number(value);
    case "boolean":
      return Boolean(value);
    case "string":
      return typeof value === "string" ? value : JSON.stringify(value);
    default:
      return value;
  }
}

/**The state the widget gets for a link, the linked state through the transforms of the link,
 * then converted to the type of the option, a value written back goes in reverse and gets the type of the linked value
 * Writable when the linked state is and every transform can be reversed*/
export function linked_state(
  link: CanvasLink,
  linked: State<unknown, any, any>,
  convert?: OptionConvert,
): State<unknown, any, any> {
  if (!link.transforms.length && !convert) return linked;
  const steps: [TransformKind<LinkTransform>, LinkTransform][] = [];
  for (const transform of link.transforms) {
    const kind = transform_kind(transform);
    if (!kind)
      return state.err(
        err_nice(link_errors.TRANSFORM, `Unknown transform "${transform.kind}"`)
          .error,
      );
    steps.push([kind, transform]);
  }
  /**The latest value of the linked state, to give a value written back its type*/
  let raw: unknown;
  const read = (result: ResultNice<unknown>): ResultNice<unknown> => {
    if (result.ok) raw = result.value;
    for (const [kind, transform] of steps) {
      if (!result.ok) return result;
      result = kind.read(transform, result.value);
    }
    if (!result.ok || !convert) return result;
    return convert(result.value);
  };
  const reverses = steps.map(([kind, transform]) => kind.reverse(transform));
  if (!linked.writable || !reverses.every((reverse) => reverse))
    return state.proxy.rea(linked, read);
  const to_linked = (value: unknown) =>
    like(
      raw,
      reverses.reduceRight<unknown>((v, reverse) => reverse!(v), value),
    );
  const from_linked = (value: unknown) => {
    const result = read(ok(value));
    return result.ok ? result.value : value;
  };
  return state.proxy.reaw(linked as StateREAW<unknown>, read, {
    write: (value: unknown, source) => source.write(to_linked(value)),
    check: (value, source) =>
      source
        .check(to_linked(value))
        .then((checked) => checked.map(from_linked)),
    limit: (value, source) =>
      source
        .limit(to_linked(value))
        .then((limited) => limited.map(from_linked)),
  });
}

/**The state the widget gets for a link, from the node the depot gives for its path,
 * an error state while the path is not registered as a state*/
export function link_node_state(
  link: CanvasLink,
  node: ResultNice<DepotNode>,
  convert?: OptionConvert,
): State<unknown, any, any> {
  if (!node.ok) return state.err(node.error);
  if (node.value.kind !== "entry" || node.value.type !== depot.states)
    return state.err(
      err_nice(link_errors.NOT_A_STATE, `"${link.path}" is not a state`).error,
    );
  return linked_state(link, node.value.value, convert);
}

/**The value a link gives now, through its transforms and converted, an error when the state is not registered*/
export async function link_value(
  link: CanvasLink,
  convert?: OptionConvert,
): Promise<ResultNice<unknown>> {
  const node = await depot.get(link.path);
  return await link_node_state(link, node, convert);
}
