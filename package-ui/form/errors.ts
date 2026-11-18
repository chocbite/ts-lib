//Exported for index.ts only, the module gives it as form.errors so kinds stay namespaced
/**The kinds of the NiceErrors the form elements make, their descriptions are the nice texts*/
export const form_errors = Object.freeze({
  /**A change to an element bound to a read only state, normal use, the element only shows the value*/
  READ_ONLY: Symbol("Read only"),
  /**An element without a value yet, normal use, like a field the user has not filled in*/
  NO_VALUE: Symbol("No value"),
  /**A group with elements without a valid value, the message names them, the errors of the elements are its inner errors*/
  INVALID: Symbol("Invalid values"),
});
