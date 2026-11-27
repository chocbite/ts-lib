import { err_nice, NiceError, type ResultNice } from "#result";

/**The kinds of the NiceErrors of the depot, their descriptions are the nice texts, given as depot.errors*/
export const depot_errors = Object.freeze({
  /**The type of a path was removed, not supposed to happen, the cause is an Error*/
  TYPE_REMOVED: Symbol("Data type removed"),
  /**Nothing is registered at a path, normal use, a path can be held before it is registered*/
  NOT_REGISTERED: Symbol("Data not available"),
  /**A path that is not a valid depot path, like one with an empty segment, a bug, the cause is an Error whose stack shows the caller*/
  INVALID_PATH: Symbol("Invalid data path"),
});

/**The result of a lookup of a path where nothing is registered*/
export const not_registered = (path: string): ResultNice<never> =>
  err_nice(
    depot_errors.NOT_REGISTERED,
    `Depot path "${path}" is not registered`,
  );

/**The error of a lookup in a removed type*/
export const type_removed = (id: string): ResultNice<never> =>
  err_nice(
    depot_errors.TYPE_REMOVED,
    new Error(`Depot type "${id}" is removed`),
  );

/**The error of a path that is not valid*/
export const invalid_path = (path: string): NiceError =>
  new NiceError(
    depot_errors.INVALID_PATH,
    new Error(`Depot path "${path}" is invalid`),
  );
