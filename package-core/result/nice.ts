//Imports from ./index, which imports this file too, both only use the other inside functions, so the cycle is safe
import { ResultErr, type Result } from "./index";

/**An error with a nice text for the user, and the details for whoever has to fix it.
 * It wraps an Error instead of extending it, creating an Error captures a stack trace,
 * which costs about a microsecond, the stack of a wrapped Error is where the failure happened.
 * The kind identifies the error and its description is the nice text, use Symbol("…"), not Symbol.for,
 * so each module's kinds are its own.*/
export class NiceError {
  readonly #detail: string | Error;

  constructor(
    /**What went wrong, its description is the nice text, like Symbol("Connection lost")*/
    readonly kind: symbol,
    /**A message, or the Error that caused this, the message is then its message*/
    detail: string | Error,
  ) {
    this.#detail = detail;
  }

  /**The text for the user, the description of the kind*/
  get nice(): string {
    return this.kind.description ?? "Unknown error";
  }

  /**The details, the message given or the message of the Error*/
  get message(): string {
    return typeof this.#detail === "string" ? this.#detail : this.#detail.message;
  }

  /**The Error this wraps, with its stack, undefined when made from a message*/
  get cause(): Error | undefined {
    return typeof this.#detail === "string" ? undefined : this.#detail;
  }

  /**Same kind and message, two failures that look the same to the user and in the details*/
  equals(other: NiceError): boolean {
    return this.kind === other.kind && this.message === other.message;
  }

  toString(): string {
    return `${this.nice}: ${this.message}`;
  }
}

/**A result whose error is a NiceError*/
export type ResultNice<T> = Result<T, NiceError>;

/**Creates an error result with a NiceError of the kind, from a message or wrapping an Error*/
export function err_nice(kind: symbol, detail: string | Error) {
  return new ResultErr<NiceError>(new NiceError(kind, detail));
}
