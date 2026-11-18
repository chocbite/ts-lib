//Exported for index.ts only, the module gives it as list.errors so kinds stay namespaced
/**The kinds of the NiceErrors the list makes, their descriptions are the nice texts*/
export const list_errors = Object.freeze({
  /**A row the user tried to select that can not be selected, normal use*/
  NOT_SELECTABLE: Symbol("Not selectable"),
  /**A change of the selection by the user, refused as the selected input is a read only state, normal use*/
  SELECTION_READ_ONLY: Symbol("Selection read only"),
});
