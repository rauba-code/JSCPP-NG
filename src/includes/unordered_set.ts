// TODO: Validate and cleanup unordered_set
// First make set work

import { InitializerListVariable } from "../initializer_list";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, ArithmeticVariable, PointerVariable } from "../variables";

interface UnorderedSetType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "unordered_set",
}

type UnorderedSetVariable<T extends Variable> = AbstractVariable<UnorderedSetType<T["t"]>, UnorderedSetValue<T>>;

interface UnorderedSetValue<T extends Variable> extends InitValue<UnorderedSetVariable<T>> {
    members: {
        "_data": InitIndexPointerVariable<T>,
        "_sz": InitArithmeticVariable,
        "_cap": InitArithmeticVariable,
    }
}

export = {
    load(rt: CRuntime) {
        rt.defineStruct2("{global}", "unordered_set", {
            numTemplateArgs: 1, factory: (dataItem: UnorderedSetType<ObjectType>) => {
                return [
                    {
                        name: "_data",
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
        }, ["_data", "_sz", "_cap"], {});

        // Constructor from initializer_list
        const ctorHandler1: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS unordered_set < ?0 > ( CLASS initializer_list < ?0 > )",
            *default(rt: CRuntime, _templateTypes: [], list: InitializerListVariable<ArithmeticVariable>): Gen<UnorderedSetVariable<Variable>> {
                const thisType = variables.classType("unordered_set", list.t.templateSpec, null);
                const usetVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<UnorderedSetVariable<Variable>>;
                const listmem = list.v.members._values.v.pointee;
                
                // Add all elements with duplicate removal (no sorting needed for unordered_set)
                for (let i = 0; i < listmem.values.length; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                    _insert(rt, usetVar, currentValue);
                }
                
                return usetVar;
            }
        };

        // Constructor from iterators (begin, end)
        const ctorHandler2: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS unordered_set < ?0 > ( PTR ?0 PTR ?0 )",
            *default(rt: CRuntime, _templateTypes: ObjectType[], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<Variable> {
                const begin = variables.asInitIndexPointer(_begin) ?? rt.raiseException("unordered_set constructor: expected valid begin iterator");
                const end = variables.asInitIndexPointer(_end) ?? rt.raiseException("unordered_set constructor: expected valid end iterator");
                
                if (begin.v.pointee !== end.v.pointee) {
                    rt.raiseException("unordered_set constructor: iterators must point to same memory region");
                }
                
                const elementType = begin.v.pointee.objectType;
                const thisType = variables.classType("unordered_set", [elementType], null);
                const usetVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<UnorderedSetVariable<Variable>>;
                
                // Add elements with duplicate removal
                for (let i = begin.v.index; i < end.v.index; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable);
                    _insert(rt, usetVar, currentValue);
                }
                
                return usetVar;
            }
        };

        rt.explicitListInitTable["unordered_set"] = (usetType: UnorderedSetType<ObjectType>) => usetType.templateSpec[0];
        rt.regFunc(ctorHandler1.default, variables.classType("unordered_set", [], null), ctorHandler1.op, rt.typeSignature(ctorHandler1.type), [-1]);
        rt.regFunc(ctorHandler2.default, variables.classType("unordered_set", [], null), ctorHandler2.op, rt.typeSignature(ctorHandler2.type), [-1]);

        function _insert(rt: CRuntime, usetVar: UnorderedSetVariable<Variable>, value: Variable): [InitIndexPointerVariable<Variable>, boolean] {
            const dataPtr = usetVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            
            // Check if element already exists
            for (let i = 0; i < dataArray.values.length; i++) {
                const existingValue = rt.unbound(variables.arrayMember(dataArray, i) as MaybeUnboundVariable);
                if (rt.arithmeticValue(existingValue as ArithmeticVariable) === rt.arithmeticValue(value as ArithmeticVariable)) {
                    // Element already exists, return iterator to existing element
                    return [variables.indexPointer(dataArray, i, false, null, false), false];
                }
            }
            
            // Element doesn't exist, add it
            const newIndex = dataArray.values.length;
            dataArray.values.push(variables.clone(rt, value, { array: dataArray, index: newIndex }, false, true).v);
            usetVar.v.members._sz.v.value++;
            
            return [variables.indexPointer(dataArray, newIndex, false, null, false), true];
        }

        function _find(rt: CRuntime, usetVar: UnorderedSetVariable<Variable>, value: Variable): InitIndexPointerVariable<Variable> | null {
            const dataPtr = usetVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            
            // Linear search (unordered)
            const valueNum = rt.arithmeticValue(value as ArithmeticVariable);
            for (let i = 0; i < dataArray.values.length; i++) {
                const existingValue = rt.unbound(variables.arrayMember(dataArray, i) as MaybeUnboundVariable);
                const existingNum = rt.arithmeticValue(existingValue as ArithmeticVariable);
                
                if (existingNum === valueNum) {
                    return variables.indexPointer(dataArray, i, false, null, false);
                }
            }
            
            return null;
        }

        function _end(rt: CRuntime, usetVar: UnorderedSetVariable<Variable>): InitIndexPointerVariable<Variable> {
            const dataPtr = usetVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            return variables.indexPointer(dataArray, usetVar.v.members._sz.v.value, false, null, false);
        }

        function _erase(rt: CRuntime, usetVar: UnorderedSetVariable<Variable>, index: number): boolean {
            const dataPtr = usetVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            const size = usetVar.v.members._sz.v.value;
            
            if (index >= 0 && index < size) {
                // For unordered_set, we can just move the last element to this position
                if (index < size - 1) {
                    dataArray.values[index] = dataArray.values[size - 1];
                }
                usetVar.v.members._sz.v.value--;
                return true;
            }
            return false;
        }

        common.regMemberFuncs(rt, "unordered_set", [
            {
                op: "begin",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS unordered_set < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    const dataPtr = usetVar.v.members._data;
                    const dataArray = dataPtr.v.pointee;
                    return variables.indexPointer(dataArray, 0, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS unordered_set < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    return _end(rt, usetVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS unordered_set < ?0 > CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, templateTypes: ObjectType[], ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    const list = args[1] as InitializerListVariable<Variable>;
                    const listmem = list.v.members._values.v.pointee;
                    
                    let lastInserted: InitIndexPointerVariable<Variable> | null = null;
                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                        const [iterator, _inserted] = _insert(rt, usetVar, currentValue);
                        lastInserted = iterator;
                    }
                    
                    return lastInserted ?? _end(rt, usetVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS unordered_set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    const value = args[1];
                    const [iterator, _inserted] = _insert(rt, usetVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS unordered_set < ?0 > PTR ?0 PTR ?0 )",
                default(rt: CRuntime, templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    const beginPtr = args[1] as PointerVariable<Variable>;
                    const endPtr = args[2] as PointerVariable<Variable>;
                    
                    const begin = variables.asInitIndexPointer(beginPtr) ?? rt.raiseException("unordered_set::insert: expected valid begin iterator");
                    const end = variables.asInitIndexPointer(endPtr) ?? rt.raiseException("unordered_set::insert: expected valid end iterator");
                    
                    if (begin.v.pointee !== end.v.pointee) {
                        rt.raiseException("unordered_set::insert: iterators must point to same memory region");
                    }
                    
                    for (let i = begin.v.index; i < end.v.index; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable);
                        _insert(rt, usetVar, currentValue);
                    }
                    
                    return "VOID";
                }
            },
            {
                op: "erase",
                type: "!ParamObject FUNCTION I32 ( LREF CLASS unordered_set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, usetVar, value);
                    if (found !== null) {
                        const erased = _erase(rt, usetVar, found.v.index);
                        return variables.arithmetic("I32", erased ? 1 : 0, null, false);
                    }
                    return variables.arithmetic("I32", 0, null, false);
                }
            },
            {
                op: "find",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS unordered_set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, usetVar, value);
                    if (found !== null) {
                        return found;
                    }
                    return _end(rt, usetVar);
                }
            },
            {
                op: "count",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS unordered_set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, usetVar, value);
                    return variables.arithmetic("I32", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "contains",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS unordered_set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, usetVar, value);
                    return variables.arithmetic("BOOL", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS unordered_set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    return variables.arithmetic("I32", usetVar.v.members._sz.v.value, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS unordered_set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    return variables.arithmetic("BOOL", usetVar.v.members._sz.v.value === 0 ? 1 : 0, null, false);
                }
            },
            {
                op: "clear",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS unordered_set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
                    const usetVar = args[0] as UnorderedSetVariable<Variable>;
                    usetVar.v.members._sz.v.value = 0;
                    return "VOID";
                }
            },
        ])
    }
};
