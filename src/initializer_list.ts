import { CRuntime } from "./rt";
import { AbstractVariable, ClassType, InitIndexPointerVariable, InitValue, ObjectType, Variable } from "./variables";

export interface InitializerListType<T extends ObjectType> extends ClassType {
    readonly sig: "CLASS",
    readonly identifier: "initializer_list",
    readonly templateSpec: [T],
    readonly memberOf: null,
}

export type InitializerListVariable<T extends Variable> = AbstractVariable<InitializerListType<T["t"]>, InitializerListValue<T>>;

export interface InitializerListValue<T extends Variable> extends InitValue<InitializerListVariable<T>> {
    members: {
        "_values": InitIndexPointerVariable<T>
    }
}

export function initializerListInit(rt: CRuntime): void {
    
}
