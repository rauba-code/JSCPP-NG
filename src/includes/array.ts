// TODO: Implement array
// Probably needs changing the parser

import { InitializerListVariable } from "../initializer_list";
import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, ArithmeticVariable } from "../variables";

interface ArrayType<T extends ObjectType, N extends number> extends AbstractTemplatedClassType<null, [T, ObjectType]> {
    readonly identifier: "array",
    readonly size: N
}

type ArrayVariable<T extends Variable, N extends number> = AbstractVariable<ArrayType<T["t"], N>, ArrayValue<T, N>>;

interface ArrayValue<T extends Variable, N extends number> extends InitValue<ArrayVariable<T, N>> {
    members: {
        "_data": InitIndexPointerVariable<T>,
        "_size": InitArithmeticVariable,
    }
}

export = {
    load(rt: CRuntime) {
        rt.defineStruct2("{global}", "array", {
            numTemplateArgs: 2, factory: function*(dataItem: ArrayType<ObjectType, number>) {
                const size = dataItem.templateSpec[1] as any;
                const sizeValue = typeof size === 'number' ? size : 0;
                const memory = variables.arrayMemory<Variable>(dataItem.templateSpec[0], []);

                for (let i = 0; i < sizeValue; i++) {
                    const defaultYield = rt.defaultValue2(dataItem.templateSpec[0], { array: memory, index: i });
                    const defaultVar = asResult(defaultYield) ?? (yield* defaultYield as Gen<Variable>);
                    memory.values.push(defaultVar.v);
                }

                return [
                    {
                        name: "_data",
                        variable: variables.indexPointer<Variable>(memory, 0, false, "SELF")
                    },
                    {
                        name: "_size",
                        variable: variables.arithmetic("I32", sizeValue, "SELF")
                    }
                ]
            }
        });

        const ctorHandler: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS array < ?0 ?1 > ( CLASS initializer_list < ?0 > )",
            *default(rt: CRuntime, _templateTypes: [], list: InitializerListVariable<ArithmeticVariable>): Gen<ArrayVariable<Variable, number>> {
                const thisType = variables.classType("array", list.t.templateSpec, null);
                const arr = yield* rt.defaultValue2(thisType, "SELF") as Gen<ArrayVariable<Variable, number>>;
                const listmem = list.v.members._values.v.pointee;
                const arraySize = arr.v.members._size.v.value;

                const copyCount = Math.min(listmem.values.length, arraySize);
                for (let i = 0; i < copyCount; i++) {
                    arr.v.members._data.v.pointee.values[i] = variables.clone(rt, rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable), { array: arr.v.members._data.v.pointee, index: i }, false, true).v;
                }

                return arr;
            }
        };

        rt.explicitListInitTable["array"] = (arr: ArrayType<ObjectType, number>) => arr.templateSpec[0];
        rt.regFunc(ctorHandler.default, variables.classType("array", [], null), ctorHandler.op, rt.typeSignature(ctorHandler.type), [-1]);

        common.regOps(rt, [
            {
                op: "o(_[_])",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS array < ?0 ?1 > I32 )",
                default(rt: CRuntime, _templateTypes: [], l: ArrayVariable<Variable, number>, _idx: ArithmeticVariable): Variable {
                    const idx = rt.arithmeticValue(_idx);
                    if (idx < 0 || idx >= l.v.members._size.v.value) {
                        rt.raiseException("array::operator[]: index out of range error");
                    }
                    return variables.arrayMember(l.v.members._data.v.pointee, l.v.members._data.v.index + idx) as ArithmeticVariable;
                }
            },
        ]);

        common.regMemberFuncs(rt, "array", [
            {
                op: "begin",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS array < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>): InitIndexPointerVariable<Variable> {
                    return variables.indexPointer(arr.v.members._data.v.pointee, arr.v.members._data.v.index, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS array < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>): InitIndexPointerVariable<Variable> {
                    return variables.indexPointer(arr.v.members._data.v.pointee, arr.v.members._data.v.index + arr.v.members._size.v.value, false, null, false);
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS array < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>): InitArithmeticVariable {
                    return variables.arithmetic("I32", arr.v.members._size.v.value, null, false);
                }
            },
            {
                op: "at",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS array < ?0 ?1 > I32 )",
                default(rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>, _idx: ArithmeticVariable): Variable {
                    const idx = rt.arithmeticValue(_idx);
                    if (idx < 0 || idx >= arr.v.members._size.v.value) {
                        rt.raiseException("array::at(): index out of range error");
                    }
                    return variables.arrayMember(arr.v.members._data.v.pointee, arr.v.members._data.v.index + idx) as ArithmeticVariable;
                }
            },
            {
                op: "front",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS array < ?0 ?1 > )",
                default(rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>): Variable {
                    if (arr.v.members._size.v.value === 0) {
                        rt.raiseException("array::front(): array is empty");
                    }
                    return variables.arrayMember(arr.v.members._data.v.pointee, arr.v.members._data.v.index) as ArithmeticVariable;
                }
            },
            {
                op: "back",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS array < ?0 ?1 > )",
                default(rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>): Variable {
                    if (arr.v.members._size.v.value === 0) {
                        rt.raiseException("array::back(): array is empty");
                    }
                    return variables.arrayMember(arr.v.members._data.v.pointee, arr.v.members._data.v.index + arr.v.members._size.v.value - 1) as ArithmeticVariable;
                }
            },
            {
                op: "empty",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS array < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>): InitArithmeticVariable {
                    return variables.arithmetic("BOOL", arr.v.members._size.v.value === 0 ? 1 : 0, null, false);
                }
            },
            {
                op: "max_size",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS array < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>): InitArithmeticVariable {
                    return variables.arithmetic("I32", arr.v.members._size.v.value, null, false);
                }
            },
            {
                op: "fill",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS array < ?0 ?1 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: [], arr: ArrayVariable<Variable, number>, value: Variable): "VOID" {
                    const size = arr.v.members._size.v.value;
                    for (let i = 0; i < size; i++) {
                        arr.v.members._data.v.pointee.values[i] = variables.clone(rt, value, { index: i, array: arr.v.members._data.v.pointee }, false, true).v;
                    }
                    return "VOID";
                }
            },
            {
                op: "swap",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS array < ?0 ?1 > LREF CLASS array < ?0 ?1 > )",
                default(rt: CRuntime, _templateTypes: [], arr1: ArrayVariable<Variable, number>, arr2: ArrayVariable<Variable, number>): "VOID" {
                    if (arr1.v.members._size.v.value !== arr2.v.members._size.v.value) {
                        rt.raiseException("array::swap(): arrays must have the same size");
                    }

                    const size = arr1.v.members._size.v.value;
                    for (let i = 0; i < size; i++) {
                        const temp = arr1.v.members._data.v.pointee.values[i];
                        arr1.v.members._data.v.pointee.values[i] = arr2.v.members._data.v.pointee.values[i];
                        arr2.v.members._data.v.pointee.values[i] = temp;
                    }
                    return "VOID";
                }
            },
        ])
    }
};
