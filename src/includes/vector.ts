import { InitializerListVariable } from "../initializer_list";
import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, ArithmeticVariable, PointerVariable, LValueIndexHolder } from "../variables";

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
        rt.include("cstddef");
        const vectorSig: string[] = "!ParamObject CLASS vector < ?0 >".split(" ");
        rt.defineStruct2("{global}", "vector", {
            numTemplateArgs: 1, factory: (dataItem: VectorType<ObjectType>) => {
                return [
                    {
                        name: "_ptr",
                        variable: variables.indexPointer<Variable>(variables.arrayMemory<Variable>(dataItem.templateSpec[0], []), 0, false, "SELF")
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
        }, ["_ptr", "_sz", "_cap"], {
            ["value_type"]: [{ src: vectorSig, dst: ["?0"] }],
            ["iterator"]: [{ src: vectorSig, dst: ["PTR", "?0"] }],
            ["const_iterator"]: [{ src: vectorSig, dst: ["PTR", "?0"] }],
            ["pointer"]: [{ src: vectorSig, dst: ["PTR", "?0"] }],
            ["reference"]: [{ src: vectorSig, dst: ["LREF", "?0"] }],
        });

        const ctorHandler1: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS vector < ?0 > ( CLASS initializer_list < ?0 > )",
            *default(rt: CRuntime, _templateTypes: [], list: InitializerListVariable<ArithmeticVariable>): Gen<VectorVariable<Variable>> {
                const thisType = variables.classType("vector", list.t.templateSpec, null);
                const vec = yield* rt.defaultValue2(thisType, "SELF") as Gen<VectorVariable<Variable>>;
                const listmem = list.v.members._values.v.pointee;
                const memory = variables.arrayMemory<Variable>(thisType.templateSpec[0], []);
                for (let i = 0; i < listmem.values.length; i++) {
                    memory.values.push(variables.clone(rt, rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable), { array: memory, index: i }, false, true).v);
                }
                vec.v.members._ptr.v.pointee = memory;
                vec.v.members._cap.v.value = listmem.values.length;
                vec.v.members._sz.v.value = listmem.values.length;
                return vec;
            }
        };

        const ctorHandler2: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS vector < ?0 > ( PTR ?0 PTR ?0 )",
            *default(rt: CRuntime, _templateTypes: ObjectType[], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<VectorVariable<Variable>> {
                const begin = variables.asInitIndexPointer(_begin) ?? rt.raiseException("vector constructor: expected valid begin iterator");
                const end = variables.asInitIndexPointer(_end) ?? rt.raiseException("vector constructor: expected valid end iterator");

                if (begin.v.pointee !== end.v.pointee) {
                    rt.raiseException("vector constructor: iterators must point to same memory region");
                }

                const elementType = begin.v.pointee.objectType;
                const thisType = variables.classType("vector", [elementType], null);
                const vec = yield* rt.defaultValue2(thisType, "SELF") as Gen<VectorVariable<Variable>>;

                const elementCount = end.v.index - begin.v.index;
                if (elementCount > 0) {
                    const memory = variables.arrayMemory<Variable>(elementType, []);

                    // Kopijuoti elementus iš iteratorių diapazono
                    for (let i = 0; i < elementCount; i++) {
                        const sourceElement = rt.unbound(variables.arrayMember(begin.v.pointee, begin.v.index + i) as MaybeUnboundVariable);
                        memory.values.push(variables.clone(rt, sourceElement, { array: memory, index: i }, false, true).v);
                    }

                    vec.v.members._ptr.v.pointee = memory;
                    vec.v.members._cap.v.value = elementCount;
                    vec.v.members._sz.v.value = elementCount;
                }

                return vec;
            }
        };

        rt.explicitListInitTable["vector"] = (vec: VectorType<ObjectType>) => vec.templateSpec[0];
        rt.regFunc(ctorHandler1.default, variables.classType("vector", [], null), ctorHandler1.op, rt.typeSignature(ctorHandler1.type), [-1]);
        rt.regFunc(ctorHandler2.default, variables.classType("vector", [], null), ctorHandler2.op, rt.typeSignature(ctorHandler2.type), [-1]);

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
                    newMemory.values.push(variables.clone(rt, rt.unbound(variables.arrayMember(vec.v.members._ptr.v.pointee, i) as MaybeUnboundVariable), { array: newMemory, index: i }, false, true).v);
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
        common.regOps(rt, [
            {
                op: "o(_[_])",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS vector < ?0 > I32 )",
                default(rt: CRuntime, _templateTypes: [], l: VectorVariable<Variable>, _idx: ArithmeticVariable): Variable {
                    const idx = rt.arithmeticValue(_idx);
                    if (idx < 0 || idx >= l.v.members._sz.v.value) {
                        rt.raiseException("vector::operator[]: index out of range error");
                    }
                    return variables.arrayMember(l.v.members._ptr.v.pointee, l.v.members._ptr.v.index + idx) as ArithmeticVariable;
                }
            },
        ]);
        common.regMemberFuncs(rt, "vector", [
            {
                op: "begin",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitIndexPointerVariable<Variable> {
                    return variables.indexPointer(vec.v.members._ptr.v.pointee, vec.v.members._ptr.v.index, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitIndexPointerVariable<Variable> {
                    return variables.indexPointer(vec.v.members._ptr.v.pointee, vec.v.members._ptr.v.index + vec.v.members._sz.v.value, false, null, false);
                }
            },
            {
                op: "push_back",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, tail: Variable): Gen<"VOID"> {
                    yield* _grow(rt, vec, 1);
                    const index = vec.v.members._ptr.v.index + vec.v.members._sz.v.value - 1;
                    vec.v.members._ptr.v.pointee.values[index] = variables.clone(rt, tail, { index, array: vec.v.members._ptr.v.pointee }, false, true).v;
                    return "VOID";
                }
            },
            {
                op: "resize",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > I32 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, _size: ArithmeticVariable, tail: Variable): Gen<"VOID"> {
                    const size = rt.arithmeticValue(_size);
                    const oldSize = vec.v.members._sz.v.value;
                    if (size <= oldSize) {
                        vec.v.members._sz.v.value = size;
                    } else {
                        yield* _grow(rt, vec, size - oldSize);
                        for (let index = oldSize; index < size; index++) {
                            vec.v.members._ptr.v.pointee.values[index] = variables.clone(rt, tail, { index, array: vec.v.members._ptr.v.pointee }, false, true).v;
                        }
                    }
                    return "VOID";
                }
            },
            {
                op: "pop_back",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): "VOID" {
                    if (vec.v.members._sz.v.value === 0) {
                        rt.raiseException("vector::pop_back(): vector is empty");
                    }
                    vec.v.members._sz.v.value--;
                    return "VOID";
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitArithmeticVariable {
                    return variables.arithmetic("I32", vec.v.members._sz.v.value, null, false);
                }
            },
            {
                op: "erase",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS vector < ?0 > PTR ?0 )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, _pos: PointerVariable<Variable>): InitIndexPointerVariable<Variable> {
                    const pos = variables.asInitIndexPointer(_pos) ?? rt.raiseException("vector::erase(): expected 'pos' to point to the vector element");
                    if (pos.v.pointee !== vec.v.members._ptr.v.pointee) {
                        rt.raiseException("vector::erase(): expected 'pos' to point to the vector element");
                    }
                    const _sz: number = --vec.v.members._sz.v.value;
                    for (let i = pos.v.index; i < _sz; i++) {
                        pos.v.pointee.values[i] = { lvHolder: pos.v.pointee.values[i], ...pos.v.pointee.values[i + 1] };
                    }
                    return pos;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS vector < ?0 > PTR ?0 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, _pos: PointerVariable<Variable>, tail: Variable): Gen<InitIndexPointerVariable<Variable>> {
                    const pos = variables.asInitIndexPointer(_pos) ?? rt.raiseException("vector::insert(): expected 'pos' to point to the vector element");
                    if (pos.v.pointee !== vec.v.members._ptr.v.pointee) {
                        rt.raiseException("vector::insert(): expected 'pos' to point to the vector element");
                    }
                    const oldptr = variables.indexPointer(vec.v.members._ptr.v.pointee, vec.v.members._ptr.v.index, false, null);
                    yield* _grow(rt, vec, 1);
                    const newpos = variables.indexPointer(vec.v.members._ptr.v.pointee, vec.v.members._ptr.v.index + (pos.v.index - oldptr.v.index), false, null);
                    const pointee = vec.v.members._ptr.v.pointee;
                    newpos.v.pointee = pointee;
                    const _sz: number = vec.v.members._sz.v.value;
                    for (let i = _sz - 2; i >= Math.max(newpos.v.index, 0); i--) {
                        pointee.values[i + 1] = pointee.values[i];
                        (pointee.values[i + 1] as any).lvHolder.index = i + 1;
                    }
                    pointee.values[newpos.v.index] = variables.clone(rt, tail, { index: newpos.v.index, array: pointee }, false, true).v;
                    /*pointee.values.forEach((x, i) => {
                        if (x.lvHolder !== null && x.lvHolder !== "SELF" && x.lvHolder.index !== i) {
                            rt.raiseException("vector::insert(): Bad indexing (internal error)");
                        }
                    })*/
                    return newpos;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS vector < ?0 > PTR ?0 CLREF CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, _pos: PointerVariable<Variable>, tail: InitializerListVariable<Variable>): Gen<InitIndexPointerVariable<Variable>> {
                    const pos = variables.asInitIndexPointer(_pos) ?? rt.raiseException("vector::insert(): expected 'pos' to point to the vector element");
                    if (pos.v.pointee !== vec.v.members._ptr.v.pointee) {
                        rt.raiseException("vector::insert(): expected 'pos' to point to the vector element");
                    }
                    const tailPointee = tail.v.members._values.v.pointee;
                    const tailSize = tailPointee.values.length;
                    yield* _grow(rt, vec, tailSize);
                    const pointee = vec.v.members._ptr.v.pointee;
                    pos.v.pointee = pointee;
                    const _sz: number = vec.v.members._sz.v.value;
                    for (let i = _sz - 1; i - tailSize >= Math.max(pos.v.index, 0); i--) {
                        pointee.values[i] = { lvHolder: pointee.values[i], ...pointee.values[i - tailSize] };
                    }
                    for (let i = 0; i < tailSize; i++) {
                        pointee.values[pos.v.index + i] = variables.clone(rt, rt.unbound(variables.arrayMember(tailPointee, i) as MaybeUnboundVariable), { index: pos.v.index + i, array: pointee }, false, true).v;
                    }
                    return pos;
                }
            },
            {
                op: "erase",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS vector < ?0 > PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, _first: PointerVariable<Variable>, _last: PointerVariable<Variable>): InitIndexPointerVariable<Variable> {
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("vector::erase(): expected 'first' to point to the vector element");
                    const last = variables.asInitIndexPointer(_last) ?? rt.raiseException("vector::erase(): expected 'last' to point to the vector element");
                    if (first.v.pointee !== vec.v.members._ptr.v.pointee) {
                        rt.raiseException("vector::erase(): expected 'first' to point to the vector element");
                    }
                    if (last.v.pointee !== vec.v.members._ptr.v.pointee) {
                        rt.raiseException("vector::erase(): expected 'last' to point to the vector element");
                    }
                    const diff = Math.max(0, last.v.index - first.v.index);
                    const _sz: number = (vec.v.members._sz.v.value -= diff);
                    for (let i = first.v.index; i < _sz; i++) {
                        first.v.pointee.values[i] = { lvHolder: first.v.pointee.values[i], ...first.v.pointee.values[i + diff] };
                    }
                    return first;
                }
            },
            {
                op: "clear",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): "VOID" {
                    vec.v.members._sz.v.value = 0;
                    return "VOID";
                }
            },
        ])
    }
};
