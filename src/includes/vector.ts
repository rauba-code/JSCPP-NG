import { InitializerListVariable } from "../initializer_list";
import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, ArithmeticVariable, PointerVariable, InitArithmeticNumVariable, ArithmeticNumVariable } from "../variables";

interface VectorType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "vector",
}

type VectorVariable<T extends Variable> = AbstractVariable<VectorType<T["t"]>, VectorValue<T>>;

interface VectorValue<T extends Variable> extends InitValue<VectorVariable<T>> {
    members: {
        "_ptr": InitIndexPointerVariable<T>,
        "_sz": InitArithmeticNumVariable,
        "_cap": InitArithmeticNumVariable,
    }
}

export = {
    load(rt: CRuntime) {
        rt.include("cstddef");
        rt.include("iterator");
        const vectorSig: string[] = "!ParamObject CLASS vector < ?0 >".split(" ");
        rt.defineStruct2("{global}", "vector", {
            numTemplateArgs: 1, factory: (dataItem: VectorType<ObjectType>) => {
                return {
                    _ptr: variables.indexPointer<Variable>(variables.arrayMemory<Variable>(dataItem.templateSpec[0], []), 0, false, "SELF"),
                    _sz: variables.arithmeticNum("I32", 0, "SELF"),
                    _cap: variables.arithmeticNum("I32", 0, "SELF"),
                }
            }
        }, ["_ptr", "_sz", "_cap"], {
            ["value_type"]: [{ src: vectorSig, dst: ["?0"] }],
            ["iterator"]: [{ src: vectorSig, dst: ["PTR", "?0"] }],
            ["const_iterator"]: [{ src: vectorSig, dst: ["PTR", "?0"] }],
            ["pointer"]: [{ src: vectorSig, dst: ["PTR", "?0"] }],
            ["reference"]: [{ src: vectorSig, dst: ["LREF", "?0"] }],
        });

        const ctorHandlers: common.OpHandler[] = [
            {
                op: "o(_ctor)",
                type: "!ParamObject FUNCTION CLASS vector < ?0 > ( CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, _templateTypes: [VectorType<ObjectType>], list: InitializerListVariable<ArithmeticVariable>): Gen<VectorVariable<Variable>> {
                    const thisType = variables.classType("vector", list.t.templateSpec, null) as VectorType<ObjectType>;
                    const vec = yield* rt.defaultValue2(thisType, "SELF");
                    const listmem = list.members._values.pointee;
                    const memory = variables.arrayMemory<Variable>(thisType.templateSpec[0], []);
                    for (let i = 0; i < listmem.values.length; i++) {
                        memory.values.push(variables.clone(rt, rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable), { array: memory, index: i }, false, true));
                    }
                    vec.members._ptr.pointee = memory;
                    vec.members._cap.value = listmem.values.length;
                    vec.members._sz.value = listmem.values.length;
                    return vec;
                }
            },
            {
                op: "o(_ctor)",
                type: "!ParamObject FUNCTION CLASS vector < ?0 > ( PTR ?0 PTR ?0 )",
                *default(rt: CRuntime, _templateTypes: [VectorType<ObjectType>], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<VectorVariable<Variable>> {
                    const begin = variables.asInitIndexPointer(_begin) ?? rt.raiseException("vector constructor: expected valid begin iterator");
                    const end = variables.asInitIndexPointer(_end) ?? rt.raiseException("vector constructor: expected valid end iterator");

                    if (begin.pointee !== end.pointee) {
                        rt.raiseException("vector constructor: iterators must point to same memory region");
                    }

                    const elementType = begin.pointee.objectType;
                    const thisType = variables.classType("vector", [elementType], null) as VectorType<ObjectType>;
                    const vec = yield* rt.defaultValue2(thisType, "SELF");

                    const elementCount = end.index - begin.index;
                    if (elementCount > 0) {
                        const memory = variables.arrayMemory<Variable>(elementType, []);

                        // Kopijuoti elementus iš iteratorių diapazono
                        for (let i = 0; i < elementCount; i++) {
                            const sourceElement = rt.unbound(variables.arrayMember(begin.pointee, begin.index + i) as MaybeUnboundVariable);
                            memory.values.push(variables.clone(rt, sourceElement, { array: memory, index: i }, false, true));
                        }

                        vec.members._ptr.pointee = memory;
                        vec.members._cap.value = elementCount;
                        vec.members._sz.value = elementCount;
                    }

                    return vec;
                }
            },
            {
                op: "o(_ctor)",
                type: "!ParamObject FUNCTION CLASS vector < ?0 > ( I32 )",
                *default(rt: CRuntime, templateTypes: [VectorType<ObjectType>], count: InitArithmeticNumVariable): Gen<VectorVariable<Variable>> {
                    // NOTE: This constructor is marked as explicit in standard C++
                    const thisType = variables.classType("vector", [templateTypes[0].templateSpec[0]], null) as VectorType<ObjectType>;
                    const vec = yield* rt.defaultValue2(thisType, "SELF");
                    yield* _grow(rt, vec, count.value);
                    // Proceed. _grow fills the array with default members already.
                    return vec;
                }
            },
            // TODO: Uncomment this when TypeCheck matching is fixed
            /*{
                op: "o(_ctor)",
                type: "!ParamObject FUNCTION CLASS vector < ?0 > ( I32 CLREF ?0 )",
                *default(rt: CRuntime, templateTypes: [VectorType<ObjectType>], count: InitArithmeticVariable, value: Variable): Gen<VectorVariable<Variable>> {
                    const thisType = variables.classType("vector", [templateTypes[0].templateSpec[0]], null);
                    const vec = yield* rt.defaultValue2(thisType, "SELF") as Gen<VectorVariable<Variable>>;
                    const amount = rt.arithmeticValue(count);
                    let newcap = Math.max(vec.members._cap.value * 2, 8);
                    while (amount > newcap) {
                        newcap *= 2;
                    }
                    const _pointeeType: ObjectType = vec.members._ptr.t.pointee;
                    const newMemory = variables.arrayMemory<Variable>(_pointeeType, []);
                    for (let i = 0; i < newcap; i++) {
                        const cell = variables.clone(rt, value, { array: newMemory, index: i });
                        newMemory.values.push(cell);
                    }
                    vec.members._ptr.pointee = newMemory;
                    vec.members._cap.value = newcap;
                    vec.members._sz.value += amount;
                    return vec;
                }
            }*/
        ];

        rt.explicitListInitTable["vector"] = (vec: VectorType<ObjectType>) => vec.templateSpec[0];
        for (const ctorHandler of ctorHandlers) {
            rt.regFunc(ctorHandler.default, variables.classType("vector", [], null), ctorHandler.op, rt.typeSignature(ctorHandler.type), [-1], null);
        }

        function* _grow(rt: CRuntime, vec: VectorVariable<Variable>, amount: number): Gen<void> {
            const _sz: number = vec.members._sz.value;
            const _cap: number = vec.members._cap.value;
            if (_sz + amount > _cap) {
                let newcap = Math.max(vec.members._cap.value * 2, 8);
                while (_sz + amount > newcap) {
                    newcap *= 2;
                }
                const _pointeeType: ObjectType = vec.members._ptr.t.pointee;
                const newMemory = variables.arrayMemory<Variable>(_pointeeType, []);
                for (let i = 0; i < _sz; i++) {
                    newMemory.values.push(variables.clone(rt, rt.unbound(variables.arrayMember(vec.members._ptr.pointee, i) as MaybeUnboundVariable), { array: newMemory, index: i }, false, true));
                }
                for (let i = _sz; i < newcap; i++) {
                    const defaultYield = rt.defaultValue2(_pointeeType, { array: newMemory, index: i });
                    const defaultVar = asResult(defaultYield) ?? (yield* defaultYield as Gen<Variable>);
                    newMemory.values.push(defaultVar);
                }
                vec.members._ptr.pointee = newMemory;
                vec.members._cap.value = newcap;
            }
            vec.members._sz.value += amount;

        }
        common.regOps(rt, [
            {
                op: "o(_[_])",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS vector < ?0 > I32 )",
                default(rt: CRuntime, _templateTypes: [], l: VectorVariable<Variable>, _idx: ArithmeticNumVariable): Variable {
                    const idx = rt.arithmeticValue(_idx) as number;
                    if (idx < 0 || idx >= l.members._sz.value) {
                        rt.raiseException("vector::operator[]: index out of range error");
                    }
                    return variables.arrayMember(l.members._ptr.pointee, l.members._ptr.index + idx) as ArithmeticVariable;
                }
            },
        ]);
        common.regMemberFuncs(rt, "vector", [
            {
                op: "begin",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitIndexPointerVariable<Variable> {
                    return variables.indexPointer(vec.members._ptr.pointee, vec.members._ptr.index, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitIndexPointerVariable<Variable> {
                    return variables.indexPointer(vec.members._ptr.pointee, vec.members._ptr.index + vec.members._sz.value, false, null, false);
                }
            },
            {
                op: "push_back",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, tail: Variable): Gen<"VOID"> {
                    yield* _grow(rt, vec, 1);
                    const index = vec.members._ptr.index + vec.members._sz.value - 1;
                    vec.members._ptr.pointee.values[index] = variables.clone(rt, tail, { index, array: vec.members._ptr.pointee }, false, true);
                    return "VOID";
                }
            },
            {
                op: "resize",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > I32 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, _size: ArithmeticNumVariable, tail: Variable): Gen<"VOID"> {
                    const size = rt.arithmeticValue(_size) as number;
                    const oldSize = vec.members._sz.value;
                    if (size <= oldSize) {
                        vec.members._sz.value = size;
                    } else {
                        yield* _grow(rt, vec, size - oldSize);
                        for (let index = oldSize; index < size; index++) {
                            vec.members._ptr.pointee.values[index] = variables.clone(rt, tail, { index, array: vec.members._ptr.pointee }, false, true);
                        }
                    }
                    return "VOID";
                }
            },
            {
                op: "pop_back",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): "VOID" {
                    if (vec.members._sz.value === 0) {
                        rt.raiseException("vector::pop_back(): vector is empty");
                    }
                    vec.members._sz.value--;
                    return "VOID";
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitArithmeticNumVariable {
                    return variables.arithmeticNum("I32", vec.members._sz.value, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): InitArithmeticVariable {
                    return variables.arithmeticNum("BOOL", (vec.members._sz.value === 0) ? 1 : 0, null, false);
                }
            },
            {
                op: "erase",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS vector < ?0 > PTR ?0 )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, _pos: PointerVariable<Variable>): InitIndexPointerVariable<Variable> {
                    const pos = variables.asInitIndexPointer(_pos) ?? rt.raiseException("vector::erase(): expected 'pos' to point to the vector element");
                    if (pos.pointee !== vec.members._ptr.pointee) {
                        rt.raiseException("vector::erase(): expected 'pos' to point to the vector element");
                    }
                    const _sz: number = --vec.members._sz.value;
                    for (let i = pos.index; i < _sz; i++) {
                        pos.pointee.values[i] = { lvHolder: pos.pointee.values[i], ...pos.pointee.values[i + 1] };
                    }
                    return pos;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS vector < ?0 > PTR ?0 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>, _pos: PointerVariable<Variable>, tail: Variable): Gen<InitIndexPointerVariable<Variable>> {
                    const pos = variables.asInitIndexPointer(_pos) ?? rt.raiseException("vector::insert(): expected 'pos' to point to the vector element");
                    if (pos.pointee !== vec.members._ptr.pointee) {
                        rt.raiseException("vector::insert(): expected 'pos' to point to the vector element");
                    }
                    const oldptr = variables.indexPointer(vec.members._ptr.pointee, vec.members._ptr.index, false, null);
                    yield* _grow(rt, vec, 1);
                    const newpos = variables.indexPointer(vec.members._ptr.pointee, vec.members._ptr.index + (pos.index - oldptr.index), false, null);
                    const pointee = vec.members._ptr.pointee;
                    newpos.pointee = pointee;
                    const _sz: number = vec.members._sz.value;
                    for (let i = _sz - 2; i >= Math.max(newpos.index, 0); i--) {
                        pointee.values[i + 1] = pointee.values[i];
                        (pointee.values[i + 1] as any).lvHolder.index = i + 1;
                    }
                    pointee.values[newpos.index] = variables.clone(rt, tail, { index: newpos.index, array: pointee }, false, true);
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
                    if (pos.pointee !== vec.members._ptr.pointee) {
                        rt.raiseException("vector::insert(): expected 'pos' to point to the vector element");
                    }
                    const tailPointee = tail.members._values.pointee;
                    const tailSize = tailPointee.values.length;
                    yield* _grow(rt, vec, tailSize);
                    const pointee = vec.members._ptr.pointee;
                    pos.pointee = pointee;
                    const _sz: number = vec.members._sz.value;
                    for (let i = _sz - 1; i - tailSize >= Math.max(pos.index, 0); i--) {
                        pointee.values[i] = { lvHolder: pointee.values[i], ...pointee.values[i - tailSize] };
                    }
                    for (let i = 0; i < tailSize; i++) {
                        pointee.values[pos.index + i] = variables.clone(rt, rt.unbound(variables.arrayMember(tailPointee, i) as MaybeUnboundVariable), { index: pos.index + i, array: pointee }, false, true);
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
                    if (first.pointee !== vec.members._ptr.pointee) {
                        rt.raiseException("vector::erase(): expected 'first' to point to the vector element");
                    }
                    if (last.pointee !== vec.members._ptr.pointee) {
                        rt.raiseException("vector::erase(): expected 'last' to point to the vector element");
                    }
                    const diff = Math.max(0, last.index - first.index);
                    const _sz: number = (vec.members._sz.value -= diff);
                    for (let i = first.index; i < _sz; i++) {
                        first.pointee.values[i] = { lvHolder: first.pointee.values[i], ...first.pointee.values[i + diff] };
                    }
                    return first;
                }
            },
            {
                op: "clear",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS vector < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): "VOID" {
                    vec.members._sz.value = 0;
                    return "VOID";
                }
            },
            {
                op: "back",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS vector < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): Variable {
                    const sz = vec.members._sz.value;
                    if (sz === 0) {
                        rt.raiseException("vector::back(): vector is empty");
                    }
                    return variables.arrayMember(vec.members._ptr.pointee, vec.members._ptr.index + sz - 1) as Variable;
                }
            },
            {
                op: "back",
                type: "!ParamObject FUNCTION LREF ?0 ( LREF CLASS vector < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): Variable {
                    const sz = vec.members._sz.value;
                    if (sz === 0) {
                        rt.raiseException("vector::back(): vector is empty");
                    }
                    return variables.arrayMember(vec.members._ptr.pointee, vec.members._ptr.index + sz - 1) as Variable;
                }
            },
            {
                op: "front",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS vector < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): Variable {
                    if (vec.members._sz.value === 0) {
                        rt.raiseException("vector::front(): vector is empty");
                    }
                    return variables.arrayMember(vec.members._ptr.pointee, vec.members._ptr.index) as Variable;
                }
            },
            {
                op: "front",
                type: "!ParamObject FUNCTION LREF ?0 ( LREF CLASS vector < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], vec: VectorVariable<Variable>): Variable {
                    if (vec.members._sz.value === 0) {
                        rt.raiseException("vector::front(): vector is empty");
                    }
                    return variables.arrayMember(vec.members._ptr.pointee, vec.members._ptr.index) as Variable;
                }
            },
        ])
    }
};
