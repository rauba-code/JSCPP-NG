import { InitializerListVariable } from "../initializer_list";
import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { PairVariable } from "../shared/utility";
import { VectorVariable } from "../shared/vector";
import { InitIndexPointerVariable, Variable, variables, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, PointerVariable, ResultOrGen, InitArithmeticVariable } from "../variables";

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
        type __pair_iterator_bool = PairVariable<InitIndexPointerVariable<__pair>, InitArithmeticVariable>

        const mapSig = "!ParamObject !ParamObject CLASS map < ?0 ?1 >".split(" ");
        rt.defineStruct2("{global}", "map", {
            numTemplateArgs: 2,
            factory: function*(dataItem: MapType<ObjectType, ObjectType>) {
                const pairType: __pair["t"] = variables.classType("pair", dataItem.templateSpec, null) as __pair["t"];
                const vecType = variables.classType("vector", [pairType], null);
                const vec = yield* rt.defaultValue2(vecType, "SELF") as Gen<VectorVariable<Variable>>;
                (vec.v as any).lvHolder = "SELF";
                return {
                    _data: vec,
                }
            }
        }, ["_data"], {
            ["key_type"]: [{ src: mapSig, dst: ["?0"] }],
            ["value_type"]: [{ src: mapSig, dst: ["CLASS", "pair", "<", "?0", "?1", ">"] }],
            ["iterator"]: [{ src: mapSig, dst: ["PTR", "CLASS", "pair", "<", "?0", "?1", ">"] }], // implementation-dependent
            ["const_iterator"]: [{ src: mapSig, dst: ["PTR", "CLASS", "pair", "<", "?0", "?1", ">"] }], // implementation-dependent
            ["pointer"]: [{ src: mapSig, dst: ["PTR", "CLASS", "pair", "<", "?0", "?1", ">"] }],
            ["reference"]: [{ src: mapSig, dst: ["LREF", "CLASS", "pair", "<", "?0", "?1", ">"] }],
        });

        // Constructor from initializer_list
        const ctorHandler1: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject !ParamObject FUNCTION CLASS map < ?0 ?1 > ( CLASS initializer_list < CLASS pair < ?0 ?1 > > )",
            *default(rt: CRuntime, _templateTypes: [], list: InitializerListVariable<__pair>): Gen<MapVariable<Variable, Variable>> {
                const thisType = variables.classType("map", list.t.templateSpec[0].templateSpec, null);
                const mapVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<MapVariable<Variable, Variable>>;
                const listmem = list.v.members._values.v.pointee;

                for (let i = 0; i < listmem.values.length; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable) as __pair;
                    yield* _insert(rt, mapVar, currentValue);
                }

                return mapVar;
            }
        };
        rt.explicitListInitTable["map"] = (map: MapType<ObjectType, ObjectType>) => ({ sig: "CLASS", identifier: "pair", templateSpec: map.templateSpec, memberOf: null });

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
                    yield* _insert(rt, mapVar, currentValue);
                }

                return mapVar;
            }
        };

        rt.regFunc(ctorHandler1.default, variables.classType("map", [], null), ctorHandler1.op, rt.typeSignature(ctorHandler1.type), [-1]);
        rt.regFunc(ctorHandler2.default, variables.classType("map", [], null), ctorHandler2.op, rt.typeSignature(ctorHandler2.type), [-1]);

        function* _insert(rt: CRuntime, mapVar: MapVariable<Variable, Variable>, pair: __pair): Gen<__pair_iterator_bool> {

            const dataPtr = mapVar.v.members._data;
            const dataArray = dataPtr.v.members._ptr.v.pointee;
            const sz = mapVar.v.members._data.v.members._sz.v.value;

            let a = 0;
            let c = sz;

            const ltFunc = rt.getFuncByParams("{global}", "o(_<_)", [
                pair.v.members.first,
                pair.v.members.first, // because it is assured that 'mapVar->_data[i].first' type is same as 'key'
            ], []);

            while (a < c) {
                const b = (a + c) >> 1; // force integer division by 2
                const b_elem: __pair = rt.unbound(variables.arrayMember(dataArray, b) as MaybeUnboundVariable) as __pair;
                const cmpYield = rt.invokeCall(ltFunc, [], b_elem.v.members.first, pair.v.members.first);
                const cmpResult = asResult(cmpYield) ?? (yield* cmpYield as Gen<"VOID" | MaybeUnboundVariable>);
                if (cmpResult === "VOID") {
                    rt.raiseException("map::insert(): Unexpected void in comparison result")
                }
                const cmpValue = rt.arithmeticValue(cmpResult);
                if (cmpValue !== 0) {
                    a = b + 1;
                } else {
                    c = b;
                }
            }
            {
                let canInsert: boolean = true;
                if (a < sz) {
                    const a_elem: __pair = rt.unbound(variables.arrayMember(dataArray, a) as MaybeUnboundVariable) as __pair;
                    const cmpYield = rt.invokeCall(ltFunc, [], pair.v.members.first, a_elem.v.members.first);
                    const cmpResult = asResult(cmpYield) ?? (yield* cmpYield as Gen<"VOID" | MaybeUnboundVariable>);
                    if (cmpResult === "VOID") {
                        rt.raiseException("map::insert(): Unexpected void in comparison result")
                    }
                    canInsert = rt.arithmeticValue(cmpResult) !== 0;
                }
                const a_ref = variables.indexPointer(dataArray, dataPtr.v.members._ptr.v.index + a, false, null);
                if (canInsert) {
                    const insertInst = rt.getFuncByParams(dataPtr.t, "insert", [dataPtr, a_ref, pair], []);
                    const insertYield = rt.invokeCall(insertInst, [], dataPtr, a_ref, pair) as ResultOrGen<InitIndexPointerVariable<__pair>>;
                    const insertResult = asResult(insertYield) ?? (yield* insertYield as Gen<InitIndexPointerVariable<__pair>>);
                    const resultPair: __pair_iterator_bool = {
                        t: { sig: "CLASS", identifier: "pair", templateSpec: [insertResult.t, { sig: "BOOL" }], memberOf: null },
                        v: {
                            isConst: false, lvHolder: null, state: "INIT", members: {
                                first: insertResult,
                                second: variables.arithmetic("BOOL", 1, "SELF")
                            }
                        }
                    };
                    return resultPair;
                } else {
                    // equality
                    const resultPair: __pair_iterator_bool = {
                        t: { sig: "CLASS", identifier: "pair", templateSpec: [a_ref.t, { sig: "BOOL" }], memberOf: null },
                        v: {
                            isConst: false, lvHolder: null, state: "INIT", members: {
                                first: a_ref,
                                second: variables.arithmetic("BOOL", 0, "SELF")
                            }
                        }
                    };
                    return resultPair;
                }
            }
        }

        function* _find(rt: CRuntime, mapVar: MapVariable<Variable, Variable>, key: Variable): Gen<__pair | null> {
            const dataPtr = mapVar.v.members._data;
            const dataArray = dataPtr.v.members._ptr.v.pointee;
            const sz = mapVar.v.members._data.v.members._sz.v.value;

            let a = 0;
            let c = sz;


            while (a < c) {
                const b = (a + c) >> 1; // force integer division by 2
                const b_elem: __pair = rt.unbound(variables.arrayMember(dataArray, b) as MaybeUnboundVariable) as __pair;
                const ltFunc = rt.getFuncByParams("{global}", "o(_<_)", [
                    b_elem.v.members.first,
                    key,
                ], []);
                const cmpYield = rt.invokeCall(ltFunc, [], b_elem.v.members.first, key);
                const cmpResult = asResult(cmpYield) ?? (yield* cmpYield as Gen<"VOID" | MaybeUnboundVariable>);
                if (cmpResult === "VOID") {
                    rt.raiseException("map::insert(): Unexpected void in comparison result")
                }
                const cmpValue = rt.arithmeticValue(cmpResult);
                if (cmpValue !== 0) {
                    a = b + 1;
                } else {
                    c = b;
                }
            }
            {
                if (a < sz) {
                    const a_elem: __pair = rt.unbound(variables.arrayMember(dataArray, a) as MaybeUnboundVariable) as __pair;
                    const ltFunc = rt.getFuncByParams("{global}", "o(_<_)", [
                        a_elem.v.members.first,
                        key,
                    ], []);
                    const cmpYield = rt.invokeCall(ltFunc, [], key, a_elem.v.members.first);
                    const cmpResult = asResult(cmpYield) ?? (yield* cmpYield as Gen<"VOID" | MaybeUnboundVariable>);
                    if (cmpResult === "VOID") {
                        rt.raiseException("map::insert(): Unexpected void in comparison result")
                    }
                    if (rt.arithmeticValue(cmpResult) === 0) {
                        return a_elem;
                    }
                }
                return null;
            }
        }

        function _end(_rt: CRuntime, mapVar: MapVariable<Variable, Variable>): InitIndexPointerVariable<Variable> {
            const dataPtr = mapVar.v.members._data;
            const dataArray = dataPtr.v.members._ptr.v.pointee;
            const sz = mapVar.v.members._data.v.members._sz.v.value;
            return variables.indexPointer(dataArray, sz, false, null, false);
        }

        common.regOps(rt, [
            {
                op: "o(_[_])",
                type: "!ParamObject !ParamObject FUNCTION LREF ?1 ( CLREF CLASS map < ?0 ?1 > CLREF ?0 )",
                *default(_rt: CRuntime, _templateTypes: ObjectType[], mapVar: MapVariable<Variable, Variable>, index: Variable): Gen<Variable> {
                    const found = yield* _find(rt, mapVar, index);
                    if (found === null) {
                        const defaultMappedYield: ResultOrGen<Variable> = rt.defaultValue2(mapVar.t.templateSpec[1], "SELF");
                        const defaultMapped: Variable = asResult(defaultMappedYield) ?? (yield* defaultMappedYield as Gen<Variable>);
                        const insertPair: __pair = { t: { sig: "CLASS", identifier: 'pair', templateSpec: mapVar.t.templateSpec, memberOf: null }, v: { isConst: false, lvHolder: "SELF", state: "INIT", members: { first: index, second: defaultMapped } } };
                        const inserted = yield* _insert(rt, mapVar, insertPair);
                        return inserted.v.members.first.v.pointee.values[inserted.v.members.first.v.index].members.second;
                    }
                    return found.v.members.second;
                }
            }

        ]);

        common.regMemberFuncs(rt, "map", [
            {
                op: "begin",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const dataPtr = mapVar.v.members._data;
                    const dataArray = dataPtr.v.members._ptr.v.pointee;
                    return variables.indexPointer(dataArray, 0, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( CLREF CLASS map < ?0 ?1 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    return _end(rt, mapVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( LREF CLASS map < ?0 ?1 > CLASS initializer_list < CLASS pair < ?0 ?1 > > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<"VOID"> {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const list = args[1] as InitializerListVariable<__pair>;
                    const listmem = list.v.members._values.v.pointee;

                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable) as __pair;
                        yield* _insert(rt, mapVar, currentValue);
                    }

                    return "VOID";
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION PTR ?0 ( LREF CLASS map < ?0 ?1 > CLREF CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<__pair_iterator_bool> {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[1] as __pair;
                    const iterator = yield* _insert(rt, mapVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION PTR ?0 ( LREF CLASS map < ?0 ?1 > PTR CLASS pair < ?0 ?1 > CLREF CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<__pair_iterator_bool> {
                    // same as above, ignoring the iterator
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[2] as __pair;
                    const iterator = yield* _insert(rt, mapVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION VOID ( LREF CLASS map < ?0 ?1 > PTR CLASS pair < ?0 ?1 > PTR CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<"VOID"> {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const beginPtr = args[1] as PointerVariable<__pair>;
                    const endPtr = args[2] as PointerVariable<__pair>;

                    const begin = variables.asInitIndexPointer(beginPtr) ?? rt.raiseException("map::insert: expected valid begin iterator");
                    const end = variables.asInitIndexPointer(endPtr) ?? rt.raiseException("map::insert: expected valid end iterator");

                    if (begin.v.pointee !== end.v.pointee) {
                        rt.raiseException("map::insert: iterators must point to same memory region");
                    }

                    for (let i = begin.v.index; i < end.v.index; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable) as __pair;
                        yield* _insert(rt, mapVar, currentValue);
                    }

                    return "VOID";
                }
            },
            {
                op: "find",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( CLREF CLASS map < ?0 ?1 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const key = args[1];
                    const found = yield* _find(rt, mapVar, key);
                    if (found !== null) {
                        if (found.v.lvHolder === null || typeof (found.v.lvHolder) !== "object") {
                            rt.raiseException("map::find(): Expected an array member (internal error)")
                        }
                        return variables.indexPointer(found.v.lvHolder.array, found.v.lvHolder.index, false, null);
                    }
                    return _end(rt, mapVar);
                }
            },
            {
                op: "clear",
                type: "!ParamObject !ParamObject FUNCTION VOID ( LREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    mapVar.v.members._data.v.members._sz.v.value = 0;
                    return "VOID";
                }
            },
            {
                op: "size",
                type: "!ParamObject !ParamObject FUNCTION U64 ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const sz = mapVar.v.members._data.v.members._sz.v.value;
                    return variables.arithmetic("U64", sz, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const sz = mapVar.v.members._data.v.members._sz.v.value;
                    return variables.arithmetic("BOOL", sz === 0 ? 1 : 0, null, false);
                }
            },
            {
                op: "erase",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( LREF CLASS map < ?0 ?1 > PTR CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<InitIndexPointerVariable<__pair>> {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const value = args[1] as PointerVariable<__pair>;
                    const ptr = mapVar.v.members._data.v.members._ptr;
                    if (value.v.state !== "INIT" || value.v.subtype !== "INDEX" || ptr.v.pointee !== value.v.pointee) {
                        rt.raiseException("map::erase(): Expected an argument to be a member of the given map")
                    }
                    const eraseInst = rt.getFuncByParams(mapVar.v.members._data.t, "erase", [mapVar.v.members._data, value], []);
                    const eraseYield = rt.invokeCall(eraseInst, [], mapVar.v.members._data, value);
                    const eraseResult = asResult(eraseYield) ?? (yield* eraseYield as Gen<InitIndexPointerVariable<__pair>>);
                    return eraseResult as InitIndexPointerVariable<__pair>;
                }
            },
            {
                op: "erase",
                type: "!ParamObject !ParamObject FUNCTION U64 ( LREF CLASS map < ?0 ?1 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<InitArithmeticVariable> {
                    const mapVar = args[0] as MapVariable<Variable, Variable>;
                    const key = args[1] as Variable;
                    const found = yield* _find(rt, mapVar, key);
                    if (found !== null) {
                        if (found.v.lvHolder === null || typeof (found.v.lvHolder) !== "object") {
                            rt.raiseException("map::find(): Expected an array member (internal error)")
                        }
                        const pairPtr = variables.indexPointer(found.v.lvHolder.array, found.v.lvHolder.index, false, null);
                        const eraseInst = rt.getFuncByParams(mapVar.v.members._data.t, "erase", [mapVar.v.members._data, pairPtr], []);
                        const eraseYield = rt.invokeCall(eraseInst, [], mapVar.v.members._data, pairPtr);
                        asResult(eraseYield) ?? (yield* eraseYield as Gen<Variable>);
                        return variables.arithmetic("U64", 1, null);
                    }
                    return variables.arithmetic("U64", 0, null);
                }
            },
            /*{
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
            */
        ])
    }
};
