import { AbstractVariable, ClassType, InitArithmeticVariable, InitIndexPointerVariable, InitValue, ObjectType, Variable } from "../variables";

export interface VectorType<TType extends ObjectType> extends ClassType {
    readonly sig: "CLASS",
    readonly identifier: "vector",
    readonly templateSpec: [TType],
    readonly memberOf: null,
}

export type VectorVariable<TVar extends Variable> = AbstractVariable<VectorType<TVar["t"]>, VectorValue<TVar>>;

export interface VectorValue<TVar extends Variable> extends InitValue<VectorVariable<TVar>> {
    members: {
        "_ptr": InitIndexPointerVariable<TVar>
        "_size": InitArithmeticVariable,
    }
}
