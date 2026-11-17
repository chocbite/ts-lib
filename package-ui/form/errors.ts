//Exported for index.ts only, the module gives it as form.errors so kinds stay namespaced
/**The kinds of the NiceErrors the form elements make, their descriptions are the nice texts*/
export const form_errors = Object.freeze({
  /**A change to an element bound to a read only state, normal use, the element only shows the value*/
  READ_ONLY: Symbol("Read only"),
});
