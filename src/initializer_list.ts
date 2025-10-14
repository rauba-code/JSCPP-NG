import { CRuntime } from "./rt";
import { AbstractVariable, ClassType, InitIndexPointerVariable, InitValue, ObjectType, Variable, variables } from "./variables";

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
    rt.defineStruct2("{global}", "initializer_list", {
        numTemplateArgs: 1, factory: (dataItem: InitializerListType<ObjectType>) => {
            return {
                _values: variables.indexPointer<Variable>(variables.arrayMemory<Variable>(dataItem.templateSpec[0], []), 0, false, "SELF"),
            }
        },
    }, [], {});
}

export function createInitializerList<T extends Variable>(type: T["t"], values: T["v"][]): InitializerListVariable<T> {
    return {
        t: {
            sig: "CLASS",
            identifier: "initializer_list",
            templateSpec: [ type ],
            memberOf: null
        },
        v: {
            isConst: false,
            lvHolder: null,
            state: "INIT",
            members: {
                _values: variables.indexPointer(variables.arrayMemory<T>(type, values), 0, false, "SELF")
            }
        }
    }
}
