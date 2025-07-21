import { asResult } from "../interpreter";
import { CRuntime, FunctionCallInstance } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, PointeeVariable, PointerVariable, Function, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ResultOrGen, MaybeLeftCV, ObjectType, InitDirectPointerVariable, ClassType, InitValue, AbstractVariable, AbstractTemplatedClassType, InitClassVariable, ClassValue } from "../variables";

interface VectorType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "vector",
}

type VectorVariable<T extends Variable> = AbstractVariable<VectorType<T["t"]>, VectorValue<T>>;

interface VectorValue<T extends Variable> extends InitValue<VectorVariable<T>> {
    members: {
        "_ptr": InitIndexPointerVariable<T>,
        "_sz": InitArithmeticVariable,
        "_cap": InitArithmeticVariable,
    }
}

export = {
    load(rt: CRuntime) {
        rt.defineStruct2("{global}", "vector", {
            numTemplateArgs: 1, factory: (dataItem: ObjectType) => {
                return [
                    {
                        name: "_ptr",
                        variable: variables.indexPointer<Variable>(variables.arrayMemory<Variable>(dataItem, []), 0, false, "SELF")
                    },
                    {
                        name: "_sz",
                        variable: variables.arithmetic("I32", 0, "SELF")
                    },
                    {
                        name: "_cap",
                        variable: variables.arithmetic("I32", 0, "SELF")
                    }
                ]
            }
        });
        function* _grow(rt: CRuntime, vec: VectorVariable<Variable>, amount: number): Gen<void> {
            const _sz: number = vec.v.members._sz.v.value;
            const _cap: number = vec.v.members._cap.v.value;
            if (_sz + amount > _cap) {
                let newcap = Math.max(vec.v.members._cap.v.value * 2, 8);
                while (_sz + amount > newcap) {
                    newcap *= 2;
                }
                const _pointeeType: ObjectType = vec.v.members._ptr.t.pointee;
                const newMemory = variables.arrayMemory<Variable>(_pointeeType, []);
                for (let i = 0; i < _sz; i++) {
                    newMemory.values.push(variables.clone(rt.unbound(variables.arrayMember(vec.v.members._ptr.v.pointee, i) as MaybeUnboundVariable), { array: newMemory, index: i }, false, rt.raiseException, true).v);
                }
                for (let i = _sz; i < newcap; i++) {
                    const defaultYield = rt.defaultValue2(_pointeeType, { array: newMemory, index: i });
                    const defaultVar = asResult(defaultYield) ?? (yield* defaultYield as Gen<Variable>);
                    newMemory.values.push(defaultVar.v);
                }
                vec.v.members._ptr.v.pointee = newMemory;
                vec.v.members._cap.v.value = newcap;
            }
            vec.v.members._sz.v.value += amount;

        }
        common.regMemberFuncs(rt, "vector", [
            {
                op: "begin",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitIndexPointerVariable<Variable> {
                    return variables.indexPointer(vec.v.members._ptr.v.pointee, vec.v.members._ptr.v.index, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitIndexPointerVariable<Variable> {
                    return variables.indexPointer(vec.v.members._ptr.v.pointee, vec.v.members._ptr.v.index + vec.v.members._sz.v.value, false, null, false);
                }
            },
            {
                op: "push_back",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, tail: Variable): Gen<"VOID"> {
                    yield* _grow(rt, vec, 1);
                    vec.v.members._ptr.v.pointee.values[vec.v.members._ptr.v.index + vec.v.members._sz.v.value] = tail.v;
                    return "VOID";
                }
            },
            {
                op: "pop_back",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): Gen<"VOID"> {
                    if (vec.v.members._sz.v.value === 0) {
                        rt.raiseException("pop_back(): vector is empty");
                    }
                    vec.v.members._sz.v.value--;
                    return "VOID";
                }
            },
        ])


    }
};
