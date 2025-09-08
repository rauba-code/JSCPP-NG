// TODO: Validate and cleanup map

import { InitializerListVariable } from "../initializer_list";
import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { PairVariable } from "../shared/utility";
import { VectorVariable } from "../shared/vector";
import { InitIndexPointerVariable, Variable, variables, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, ArithmeticVariable, PointerVariable, ResultOrGen } from "../variables";

interface MapType<TKey extends ObjectType, TVal extends ObjectType> extends AbstractTemplatedClassType<null, [TKey, TVal]> {
    readonly identifier: "map",
}

type MapVariable<TKey extends Variable, TVal extends Variable> = AbstractVariable<MapType<TKey["t"], TVal["t"]>, MapValue<TKey, TVal>>;

interface MapValue<TKey extends Variable, TVal extends Variable> extends InitValue<MapVariable<TKey, TVal>> {
    members: {
        "_data": VectorVariable<PairVariable<TKey, TVal>>,
    }
}

export = {
    load(rt: CRuntime) {
        rt.include("vector"); // for internal functionality
        rt.include("utility");

        type __pair = PairVariable<Variable, Variable>;
        const mapSig = "!ParamObject !ParamObject CLASS map < ?0 ?1 >".split(" ");
        rt.defineStruct2("{global}", "map", {
            numTemplateArgs: 2,
            factory: function*(dataItem: MapType<ObjectType, ObjectType>) {
                const pairType: __pair["t"] = variables.classType("pair", dataItem.templateSpec, null) as __pair["t"];
                const vecType = variables.classType("vector", [pairType], null);
                const vec = yield* rt.defaultValue2(vecType, "SELF") as Gen<VectorVariable<Variable>>;
                return [
                    {
                        name: "_data",
                        variable: vec
                    },
                ]
            }
        }, ["_data"], {
            ["key_type"]: [{ src: mapSig, dst: ["?0"] }],
            ["value_type"]: [{ src: mapSig, dst: ["?0"] }],
            ["iterator"]: [{ src: mapSig, dst: ["PTR", "?0"] }], // implementation-dependent
            ["const_iterator"]: [{ src: mapSig, dst: ["PTR", "?0"] }], // implementation-dependent
            ["pointer"]: [{ src: mapSig, dst: ["PTR", "?0"] }],
            ["reference"]: [{ src: mapSig, dst: ["LREF", "?0"] }],
        });

        // Constructor from initializer_list
        const ctorHandler1: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject !ParamObject FUNCTION CLASS map < ?0 ?1 > ( CLASS initializer_list < CLASS pair < ?0 ?1 > > )",
            *default(rt: CRuntime, _templateTypes: [], list: InitializerListVariable<__pair>): Gen<MapVariable<Variable, Variable>> {
                const thisType = variables.classType("map", list.t.templateSpec, null);
                const mapVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<MapVariable<Variable, Variable>>;
                const listmem = list.v.members._values.v.pointee;

                for (let i = 0; i < listmem.values.length; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable) as __pair;
                    _insert(rt, mapVar, currentValue.v.members.first, currentValue.v.members.second);
                }

                return mapVar;
            }
        };

        const ctorHandler2: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS map < ?0 > ( PTR ?0 PTR ?0 )",
            *default(rt: CRuntime, _templateTypes: ObjectType[], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<MapVariable<Variable, Variable>> {
                const begin = variables.asInitIndexPointer(_begin) ?? rt.raiseException("map constructor: expected valid begin iterator");
                const end = variables.asInitIndexPointer(_end) ?? rt.raiseException("map constructor: expected valid end iterator");

                if (begin.v.pointee !== end.v.pointee) {
                    rt.raiseException("map constructor: iterators must point to same memory region");
                }

                const elementType = begin.v.pointee.objectType;
                const thisType = variables.classType("map", [elementType], null);
                const mapVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<MapVariable<Variable, Variable>>;

                for (let i = begin.v.index; i < end.v.index; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable) as __pair;
                    _insert(rt, mapVar, currentValue.v.members.first, currentValue.v.members.second);
                }

                return mapVar;
            }
        };

        //rt.explicitListInitTable["map"] = (mapType: MapType<ObjectType, ObjectType>) => mapType.templateSpec[0];
        rt.regFunc(ctorHandler1.default, variables.classType("map", [], null), ctorHandler1.op, rt.typeSignature(ctorHandler1.type), [-1]);
        rt.regFunc(ctorHandler2.default, variables.classType("map", [], null), ctorHandler2.op, rt.typeSignature(ctorHandler2.type), [-1]);

        function* _insert(rt: CRuntime, mapVar: MapVariable<Variable, Variable>, key: Variable, value: Variable): Gen<InitIndexPointerVariable<Variable>> {

            const dataPtr = mapVar.v.members._data;
            const dataArray = dataPtr.v.members._ptr.v.pointee;
            const sz = mapVar.v.members._data.v.members._size.v.value;

            let a = 0;
            let c = sz;

            const ltFunc = rt.getFuncByParams("{global}", "o(_<_)", [
                key,
                key, // because it is assured that 'mapVar->_data[i].first' type is same as 'key'
            ], []);

            while (a < c) {
                const b = (a + c) >> 1; // force integer division by 2
                const b_elem: __pair = rt.unbound(variables.arrayMember(dataArray, b) as MaybeUnboundVariable) as __pair;
                const cmpYield = rt.invokeCall(ltFunc, [], value, b_elem.v.members.first);
                const cmpResult = asResult(cmpYield) ?? (yield* cmpYield as Gen<"VOID" | MaybeUnboundVariable>);
                if (cmpResult === "VOID") {
                    rt.raiseException("map::insert(): Unexpected void in comparison result")
                }
                const cmpValue = rt.arithmeticValue(cmpResult);
                if (cmpValue !== 0) {
                    c = b;
                } else {
                    a = b + 1;
                }
            }
            const insertPair: __pair = {
                t: { sig: "CLASS", identifier: "pair", templateSpec: [key.t, value.t], memberOf: null },
                v: {
                    isConst: false, lvHolder: null, state: "INIT", members: {
                        first: variables.clone(rt, key, "SELF"),
                        second: variables.clone(rt, value, "SELF")
                    }
                }
            };
            const insertInst = rt.getFuncByParams(dataPtr.t, "insert", [dataPtr, insertPair], []);
            const insertYield = rt.invokeCall(insertInst, [], dataPtr, insertPair) as ResultOrGen<InitIndexPointerVariable<Variable>>;
            const insertResult = asResult(insertYield) ?? (yield* insertYield as Gen<InitIndexPointerVariable<Variable>>);
            return insertResult;
        }

        function _find(rt: CRuntime, mapVar: MapVariable<Variable, Variable>, value: Variable): InitIndexPointerVariable<Variable> | null {
            const dataPtr = mapVar.v.members._data;
            const dataArray = dataPtr.v.members._ptr.v.pointee;
            const sz = mapVar.v.members._data.v.members._size.v.value;

            for (let i = 0; i < sz; i++) {
                const existingValue = rt.unbound(variables.arrayMember(dataArray, i) as MaybeUnboundVariable);

                let isEqual = false;

                if (!existingValue || !existingValue.t || !value || !value.t) {
                    continue;
                }

                const eqFunc = rt.getFuncByParams("{global}", "o(_==_)", [
                    { t: existingValue.t, v: { isConst: true, lvHolder: "SELF" } },
                    { t: value.t, v: { isConst: true, lvHolder: "SELF" } }
                ], []);

                if (eqFunc) {
                    const result = rt.invokeCall(eqFunc, [], existingValue, value);
                    const r = asResult(result);
                    if (r && r !== "VOID") {
                        isEqual = rt.arithmeticValue(rt.unbound(r) as ArithmeticVariable) !== 0;
                    }
                }

                if (isEqual) {
                    return variables.indexPointer(dataArray, i, false, null, false);
                }
            }

            return null;
        }

        function _end(_rt: CRuntime, mapVar: MapVariable<Variable, Variable>): InitIndexPointerVariable<Variable> {
            const dataPtr = mapVar.v.members._data;
            const dataArray = dataPtr.v.members._ptr.v.pointee;
            const sz = mapVar.v.members._data.v.members._size.v.value;
            return variables.indexPointer(dataArray, sz, false, null, false);
        }

        function _erase(_rt: CRuntime, mapVar: MapVariable<Variable, Variable>, index: number): boolean {
            const dataPtr = mapVar.v.members._data;
            const dataArray = dataPtr.v.members._ptr.v.pointee;
            const sz = mapVar.v.members._data.v.members._size.v.value;

            if (index >= 0 && index < sz) {
                // Pastumti elementus kairėn
                for (let i = index; i < sz - 1; i++) {
                    dataArray.values[i] = dataArray.values[i + 1];
                }
                mapVar.v.members._data.v.members._size.v.value--;
                return true;
            }
            return false;
        }

        common.regMemberFuncs(rt, "map", [
            {
                op: "begin",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS map < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const dataPtr = mapVar.v.members._data;
                    const dataArray = dataPtr.v.members._ptr.v.pointee;
                    return variables.indexPointer(dataArray, 0, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS map < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    return _end(rt, mapVar);
                }
            },
            /*{
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS map < ?0 > CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const list = args[1] as InitializerListVariable<Variable>;
                    const listmem = list.v.members._values.v.pointee;

                    let lastInserted: InitIndexPointerVariable<Variable> | null = null;
                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                        const iterator = yield *_insert(rt, mapVar, currentValue);
                        lastInserted = iterator;
                    }

                    return lastInserted ?? _end(rt, mapVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS map < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[1];
                    const iterator = _insert(rt, mapVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS map < ?0 > PTR ?0 CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    // same as above, ignoring the iterator
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[2];
                    const [iterator, _inserted] = _insert(rt, mapVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS map < ?0 > PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const beginPtr = args[1] as PointerVariable<Variable>;
                    const endPtr = args[2] as PointerVariable<Variable>;

                    const begin = variables.asInitIndexPointer(beginPtr) ?? rt.raiseException("map::insert: expected valid begin iterator");
                    const end = variables.asInitIndexPointer(endPtr) ?? rt.raiseException("map::insert: expected valid end iterator");

                    if (begin.v.pointee !== end.v.pointee) {
                        rt.raiseException("map::insert: iterators must point to same memory region");
                    }

                    for (let i = begin.v.index; i < end.v.index; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable);
                        _insert(rt, mapVar, currentValue);
                    }

                    return "VOID";
                }
            },*/
            {
                op: "erase",
                type: "!ParamObject FUNCTION I32 ( LREF CLASS map < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[1];
                    const found = _find(rt, mapVar, value);
                    if (found !== null) {
                        const erased = _erase(rt, mapVar, found.v.index);
                        return variables.arithmetic("I32", erased ? 1 : 0, null, false);
                    }
                    return variables.arithmetic("I32", 0, null, false);
                }
            },
            {
                op: "find",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS map < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[1];
                    const found = _find(rt, mapVar, value);
                    if (found !== null) {
                        return found;
                    }
                    return _end(rt, mapVar);
                }
            },
            {
                op: "count",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS map < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[1];
                    const found = _find(rt, mapVar, value);
                    return variables.arithmetic("I32", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "contains",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS map < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[1];
                    const found = _find(rt, mapVar, value);
                    return variables.arithmetic("BOOL", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS map < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const sz = mapVar.v.members._data.v.members._size.v.value;
                    return variables.arithmetic("I32", sz, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS map < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const sz = mapVar.v.members._data.v.members._size.v.value;
                    return variables.arithmetic("BOOL", sz === 0 ? 1 : 0, null, false);
                }
            },
            {
                op: "clear",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS map < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    mapVar.v.members._data.v.members._size.v.value = 0;
                    return "VOID";
                }
            },
        ])
    }
};
