/**Symbol used to identify Result objects, can be used to create result compliant objects */
export const RESULT_KEY = Symbol("result_key");
/**Symbol used to identify Option objects, can be used to create option compliant objects */
export const OPTION_KEY = Symbol("option_key");

//###########################################################################################################################################################
//       ____  _____ _______ _____ ____  _   _
//      / __ \|  __ \__   __|_   _/ __ \| \ | |
//     | |  | | |__) | | |    | || |  | |  \| |
//     | |  | |  ___/  | |    | || |  | | . ` |
//     | |__| | |      | |   _| || |__| | |\  |
//      \____/|_|      |_|  |_____\____/|_| \_|
//###########################################################################################################################################################
interface OptionBase<T> {
  /**Unique symbol to identify Option objects */
  readonly [OPTION_KEY]: true;

  /**Is true when a value is available*/
  readonly some: boolean;
  /**Is true when no value is available*/
  readonly none: boolean;
  /**The value*/
  readonly value?: T;

  /**Returns the contained value, if exists. Throws an error if not.
   * @param msg the message to throw if no value exists.*/
  expect(msg: string): T;

  /**Returns the contained value, if exists. Throws an error if not.*/
  unwrap(): T;

  /**Returns the contained value or a provided default.
   * @param value value to use as default*/
  unwrap_or<T2>(value: T2): T | T2;

  /**Calls mapper if the Option is `Some`, otherwise returns `None`.
   * This function can be used for control flow based on `Optional` values.*/
  and_then<T2>(mapper: (value: T) => OptionSome<T2>): Option<T2>;
  and_then(mapper: (value: T) => OptionNone): Option<T>;
  and_then<T2>(mapper: (value: T) => Option<T2>): Option<T2>;

  /**Calls mapper if the Option is `None`, otherwise returns `Some`.
   * This function can be used for control flow based on `Optional` values.*/
  or_else<T2>(mapper: () => OptionSome<T2>): Option<T2>;
  or_else(mapper: () => OptionNone): Option<T>;
  or_else<T2>(mapper: () => Option<T2>): Option<T2>;

  /**Maps an `Optional<T>` to `Optional<U>` by applying a function to a contained `Some` value, leaving a `None` value untouched.
   * This function can be used to compose the Options of two functions.*/
  map<U>(mapper: (value: T) => U): Option<U>;

  /**Compares two `Optional<T>` values for equality.
   * @returns true if equal, false otherwise. */
  compare(other: Option<T>): boolean;

  /**Maps an `Optional<T>` to a `Result<T, E>`.*/
  to_result<E>(error: E): Result<T, E>;
}

export class OptionSome<T> implements OptionBase<T> {
  get [OPTION_KEY](): true {
    return true;
  }

  readonly value: T;

  constructor(value: T) {
    this.value = value;
  }
  get some(): true {
    return true;
  }
  get none(): false {
    return false;
  }

  expect(): T {
    return this.value;
  }

  unwrap(): T {
    return this.value;
  }

  unwrap_or(): T {
    return this.value;
  }

  and_then<T2>(mapper: (value: T) => OptionSome<T2>): OptionSome<T2>;
  and_then(mapper: (value: T) => OptionNone): OptionNone;
  and_then<T2>(mapper: (value: T) => Option<T2>): Option<T2>;
  and_then<T2>(mapper: (value: T) => Option<T2>) {
    return mapper(this.value);
  }

  or_else(): OptionSome<T> {
    return this;
  }

  map<U>(mapper: (value: T) => U): OptionSome<U> {
    return new OptionSome(mapper(this.value));
  }

  compare(other: Option<T>): boolean {
    return other.some && this.value === other.value;
  }

  to_result(): ResultOk<T> {
    return new ResultOk(this.value);
  }
}

export class OptionNone implements OptionBase<never> {
  get [OPTION_KEY](): true {
    return true;
  }

  get some(): false {
    return false;
  }
  get none(): true {
    return true;
  }

  expect(msg: string): never {
    throw new Error(msg);
  }

  unwrap(): never {
    throw new Error(`Tried to unwrap None`);
  }

  unwrap_or<T2>(val: T2): T2 {
    return val;
  }

  and_then(): OptionNone {
    return this;
  }

  or_else<T2>(mapper: () => OptionSome<T2>): OptionSome<T2>;
  or_else(mapper: () => OptionNone): OptionNone;
  or_else<T2>(mapper: () => Option<T2>): Option<T2>;
  or_else<T2>(mapper: () => Option<T2>) {
    return mapper();
  }

  map(): OptionNone {
    return this;
  }

  compare(other: Option<never>): boolean {
    return other.none;
  }

  to_result<E>(error: E): ResultErr<E> {
    return new ResultErr(error);
  }
}

//###########################################################################################################################################################
//      _____                 _ _
//     |  __ \               | | |
//     | |__) |___  ___ _   _| | |_
//     |  _  // _ \/ __| | | | | __|
//     | | \ \  __/\__ \ |_| | | |_
//     |_|  \_\___||___/\__,_|_|\__|
//###########################################################################################################################################################

interface ResultBase<T, E> {
  /**Unique symbol to identify Result objects */
  readonly [RESULT_KEY]: true;

  /**Is true when the result is valid and false when it is invalid*/
  readonly ok: boolean;
  /**Is false when the result is valid and true when it is invalid*/
  readonly err: boolean;
  /**The value for the result, only exists when it is valid*/
  readonly value?: T;
  /**The error for the result, only exists when it is invalid*/
  readonly error?: E;

  /**Returns the contained valid value, if exists. Throws an error if not.
   * @param msg the message to throw if the value is invalid.*/
  expect(msg: string): T;

  /**Returns the contained valid value, if does not exist. Throws an error if it does.
   * @param msg the message to throw if the value is valid.*/
  expect_err(msg: string): E;

  /**Returns the contained valid value.
   * Throws if the value is invalid, with a message provided by the error's value.*/
  unwrap(): T;

  /**Returns the contained valid value or a provided default.*/
  unwrap_or<T2>(value: T2): T | T2;

  /**Returns the contained error value.
   * Throws if the value is valid, with the value.*/
  unwrap_err(): E;

  /* Returns the contained error value or a provided default.*/
  unwrap_err_or<E2>(error: E2): E | E2;

  /**Calls mapper function if the result is valid, otherwise returns the error value of self.
   * This function can be used for control flow based on `Result` values.*/
  and_then<T2>(mapper: (value: T) => ResultOk<T2>): Result<T2, E>;
  and_then<E2>(mapper: (value: T) => ResultErr<E2>): Result<T, E2>;
  and_then<T2, E2>(mapper: (value: T) => Result<T2, E2>): Result<T2, E2>;

  /**Calls mapper function if the result is an error, otherwise returns the value self.
   * This function can be used for control flow based on `Result` values.*/
  or_else<T2>(mapper: (error: E) => ResultOk<T2>): Result<T2, E>;
  or_else<E2>(mapper: (error: E) => ResultErr<E2>): Result<T, E2>;
  or_else<T2, E2>(mapper: (error: E) => Result<T2, E2>): Result<T2, E2>;

  /**Maps a `Result<T, E>` to `Result<U, E>` by applying a function to a contained valid value, leaving an error value untouched.
   * This function can be used to compose the results of two functions.*/
  map<U>(mapper: (value: T) => U): Result<U, E>;

  /**Maps a `Result<T, E>` to `Result<T, F>` by applying a function to a contained error value, leaving a valid value untouched.
   * This function can be used to pass through a successful result while handling an error.*/
  map_err<F>(mapper: (error: E) => F): Result<T, F>;

  /**Compares two `Result<T, E>` values for equality.
   * @returns true if equal, false otherwise. */
  compare(other: Result<T, E>): boolean;

  /**Converts from `Result<T, E>` to `Optional<T>`, discarding the error if any*/
  to_option(): Option<T>;
}

export class ResultOk<T> implements ResultBase<T, never> {
  get [RESULT_KEY](): true {
    return true;
  }

  readonly value: T;

  constructor(value: T) {
    this.value = value;
  }
  get ok(): true {
    return true;
  }
  get err(): false {
    return false;
  }

  expect(): T {
    return this.value;
  }

  expect_err(msg: string): never {
    throw new Error(msg);
  }

  unwrap(): T {
    return this.value;
  }

  unwrap_or(): T {
    return this.value;
  }

  unwrap_err(): never {
    throw new Error("Tried to unwrap_err on ResultOk with value " + this.value);
  }

  unwrap_err_or<E2>(error: E2): E2 {
    return error;
  }

  and_then<T2>(mapper: (value: T) => ResultOk<T2>): ResultOk<T2>;
  and_then<E2>(mapper: (value: T) => ResultErr<E2>): ResultErr<E2>;
  and_then<T2, E2>(mapper: (value: T) => Result<T2, E2>): Result<T2, E2>;
  and_then<T2, E2>(mapper: (value: T) => Result<T2, E2>) {
    return mapper(this.value);
  }

  or_else(): ResultOk<T> {
    return this;
  }

  map<U>(func: (value: T) => U): ResultOk<U> {
    return new ResultOk(func(this.value));
  }

  map_err(): ResultOk<T> {
    return this;
  }

  compare(other: Result<T, any>): boolean {
    return other.ok && this.value === other.value;
  }

  to_option(): OptionSome<T> {
    return new OptionSome(this.value);
  }
}

export class ResultErr<E> implements ResultBase<never, E> {
  get [RESULT_KEY](): true {
    return true;
  }

  readonly error: E;

  constructor(error: E) {
    this.error = error;
  }

  get valid(): false {
    return false;
  }
  get ok(): false {
    return false;
  }
  get err(): true {
    return true;
  }

  expect(msg: string): never {
    throw new Error(msg + "\nOriginal " + this.error);
  }

  expect_err(): E {
    return this.error;
  }

  unwrap(): never {
    throw new Error("Tried to unwrap Error\nOriginal " + this.error);
  }

  unwrap_or<T2>(val: T2): T2 {
    return val;
  }

  unwrap_err(): E {
    return this.error;
  }

  unwrap_err_or(): E {
    return this.error;
  }

  and_then(): ResultErr<E> {
    return this;
  }

  or_else<T2>(mapper: (error: E) => ResultOk<T2>): ResultOk<T2>;
  or_else<E2>(mapper: (error: E) => ResultErr<E2>): ResultErr<E2>;
  or_else<T2, E2>(mapper: (error: E) => Result<T2, E2>): Result<T2, E2>;
  or_else<T2, E2>(mapper: (error: E) => Result<T2, E2>) {
    return mapper(this.error);
  }

  map(): ResultErr<E> {
    return this;
  }

  map_err<F>(mapper: (error: E) => F): ResultErr<F> {
    return new ResultErr(mapper(this.error));
  }

  compare(other: Result<any, E>): boolean {
    return other.err && this.error === other.error;
  }

  to_option(): OptionNone {
    return new OptionNone();
  }
}

//###########################################################################################################################################################
//      ______                       _
//     |  ____|                     | |
//     | |__  __  ___ __   ___  _ __| |_
//     |  __| \ \/ / '_ \ / _ \| '__| __|
//     | |____ >  <| |_) | (_) | |  | |_
//     |______/_/\_\ .__/ \___/|_|   \__|
//                 | |
//                 |_|
//###########################################################################################################################################################

export type Result<T, E> = ResultOk<T> | ResultErr<E>;
export type Option<T> = OptionSome<T> | OptionNone;

export type ResultInferOk<T extends Result<any, string>> =
  T extends ResultOk<infer RT> ? RT : never;

export type ResultInferErr<T extends Result<string, any>> =
  T extends ResultErr<infer RE> ? RE : never;

export type OptionInfer<T extends Option<any>> =
  T extends OptionSome<infer OT> ? OT : never;

/**Creates an ok result with the given value */
export function ok<T>(value: T) {
  return new ResultOk<T>(value);
}
/**Creates an error result with the given error */
export function err<E>(error: E) {
  return new ResultErr<E>(error);
}
/**Creates a some option with the given value */
export function some<T>(value: T) {
  return new OptionSome<T>(value);
}
/**Creates a none option */
export function none() {
  return new OptionNone();
}

export const result = {
  ok,
  err,
  some,
  none,
  RESULT_KEY,
  OPTION_KEY,
  is_result(r: any): r is Result<any, any> {
    return Boolean(r && (r as { [RESULT_KEY]: boolean })[RESULT_KEY]);
  },
  is_option(r: any): r is Option<any> {
    return Boolean(r && (r as { [OPTION_KEY]: boolean })[OPTION_KEY]);
  },
};

export default result;
