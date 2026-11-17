import { err_nice } from "#result";

//Exported for index.ts only, the module gives it as state.errors so kinds stay namespaced
/**The kinds of the NiceErrors the state system makes, their descriptions are the nice texts*/
export const state_errors = Object.freeze({
  /**A write to a state that can not be written, a bug, the cause is an Error whose stack shows the caller*/
  NOT_WRITABLE: Symbol("Not writable"),
  /**A write while the write gate of the state is closed, like a device that is not connected*/
  WRITE_DISABLED: Symbol("Writing disabled"),
  /**A collected state without states to collect*/
  NO_STATES: Symbol("No data"),
  /**The init function of a lazy state threw, the cause is what it threw*/
  INIT_FAILED: Symbol("Failed to load value"),
  /**A remote state got no value within its timeout, not supposed to happen, the cause is an Error*/
  TIMED_OUT: Symbol("No response"),
  /**The write action of a remote state threw, the cause is what it threw*/
  WRITE_FAILED: Symbol("Write failed"),
  /**A number above the max of its state*/
  ABOVE_MAX: Symbol("Value too high"),
  /**A number below the min of its state*/
  BELOW_MIN: Symbol("Value too low"),
  /**A number that is not on the step of its state*/
  OFF_STEP: Symbol("Value not on a step"),
  /**A number with more decimals than its state allows*/
  TOO_MANY_DECIMALS: Symbol("Too many decimals"),
  /**A text longer than its state allows, in characters or bytes*/
  TEXT_TOO_LONG: Symbol("Text too long"),
  /**A value that is not in the list of its enum state*/
  NOT_IN_LIST: Symbol("Value not available"),
});

/**The error of a write, check or limit on a state that can not be written. It is a bug, so it has an Error,
 * made here so its stack shows the code that tried to write*/
export const not_writable = () =>
  err_nice(state_errors.NOT_WRITABLE, new Error("not writable"));
