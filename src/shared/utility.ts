import { AbstractTemplatedClassType, AbstractVariable, InitValue, ObjectType, Variable } from "../variables";

export interface PairType<T1 extends ObjectType, T2 extends ObjectType> extends AbstractTemplatedClassType<null, [T1, T2]> {
    readonly identifier: "pair",
}

export type PairVariable<T1 extends Variable, T2 extends Variable> = AbstractVariable<PairType<T1["t"], T2["t"]>, PairValue<T1, T2>>;

export interface PairValue<T1 extends Variable, T2 extends Variable> extends InitValue<PairVariable<T1, T2>> {
    members: {
        "first": T1,
        "second": T2,
    }
}
