import type { ResultOk } from "@chocbite/ts-lib/result";
import type { State, StateResult, StateROA } from "@chocbite/ts-lib/state";

declare const INPUT_TYPE: unique symbol;

/**Key identifying an input of an element, carrying the type of the input, a StateOrVal variant or a plain value type
 * Made with input_key, the type property only exists for the types, so a plain symbol is not a key*/
export type InputKey<S> = symbol & { readonly [INPUT_TYPE]: S };

/**Makes a key for an input, one per input, as a property of a module constant object of the keys of an element
 * @example
 * const SLIDER = {
 *   value: input_key<StateOrValROSW<number>>(),
 *   step: input_key<number>(),
 * };
 * export type SliderOptions = InputOptions<typeof SLIDER>;*/
export function input_key<S>(): InputKey<S> {
  return Symbol() as InputKey<S>;
}

/**Input type of a key, the StateOrVal variant or plain value type it was made with
 * For building an options interface by hand, like options passed on to a child: scale?: InputOf<typeof VIEW.scale>*/
export type InputOf<K> = K extends InputKey<infer S> ? S : never;

/**Options of an element from an object of its keys, every option is optional, see Base.set
 * The doc comments of the keys show on the options*/
export type InputOptions<K extends Record<string, InputKey<any>>> = {
  [P in keyof K]?: InputOf<K[P]>;
};

/**State part of an input type, never for plain values*/
export type InputState<S> = Extract<S, State<any, any, any>>;

/**Value part of an input type*/
export type InputValue<S> = Exclude<S, State<any, any, any>>;

/**Result an input gives, ok results when the input can not be an error*/
export type InputResult<S> = [InputState<S>] extends [never]
  ? ResultOk<InputValue<S>>
  : [InputState<S>] extends [StateROA<any, any, any>]
    ? ResultOk<InputValue<S>>
    : StateResult<InputValue<S>>;
