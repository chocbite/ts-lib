import {
  STATE_KEY,
  type State,
  type StateREA,
  type StateREAW,
  type StateRES,
  type StateRESW,
  type StateROA,
  type StateROAW,
  type StateROS,
  type StateROSW,
} from "../types";

export const IS = {
  state(s: any): s is State<any, any> {
    return Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]);
  },
  rea(s: any): s is StateREA<any> {
    return Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]);
  },
  roa(s: any): s is StateROA<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).rok
    );
  },
  res(s: any): s is StateRES<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).rsync
    );
  },
  ros(s: any): s is StateROS<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).rsync &&
      (s as State<any>).rok
    );
  },
  reaw(s: any): s is StateREAW<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).writable
    );
  },
  roaw(s: any): s is StateROAW<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).writable &&
      (s as State<any>).rok
    );
  },
  resw(s: any): s is StateRESW<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).writable &&
      (s as State<any>).rsync
    );
  },
  rosw(s: any): s is StateROSW<any> {
    return (
      Boolean(s && (s as { [STATE_KEY]: boolean })[STATE_KEY]) &&
      (s as State<any>).writable &&
      (s as State<any>).rsync &&
      (s as State<any>).rok
    );
  },
};
