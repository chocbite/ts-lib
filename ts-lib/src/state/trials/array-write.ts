import { type StateArrayWrite } from "../helpers/array";
import { type StateWriteType } from "../types";

type TupleWrite = StateWriteType<readonly [1, 2]>;

const tuple: TupleWrite = [1, 2];

// @ts-expect-error Array writes for a tuple must retain its length and literals.
const WidenedTuple: TupleWrite = [1, 2, 2];

void tuple;
void WidenedTuple;

const BooleanWrite = undefined as unknown as StateArrayWrite<boolean>;
const first = BooleanWrite[0];
const mapped = BooleanWrite.map(Boolean);

void first;
void mapped;
