// TODO: Validate and cleanup set

import { InitializerListVariable } from "../initializer_list";
import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, ArithmeticVariable, PointerVariable } from "../variables";

interface SetType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "set",
}

type SetVariable<T extends Variable> = AbstractVariable<SetType<T["t"]>, SetValue<T>>;

interface SetValue<T extends Variable> extends InitValue<SetVariable<T>> {
    members: {
        "_data": InitIndexPointerVariable<T>,
        "_sz": InitArithmeticVariable,
        "_cap": InitArithmeticVariable,
    }
}

export = {
    load(rt: CRuntime) {
        rt.defineStruct2("{global}", "set", {
            numTemplateArgs: 1, factory: (dataItem: SetType<ObjectType>) => {
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
        });

        // Constructor from initializer_list
        const ctorHandler1: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS set < ?0 > ( CLASS initializer_list < ?0 > )",
            *default(rt: CRuntime, _templateTypes: [], list: InitializerListVariable<Variable>): Gen<SetVariable<Variable>> {
                const thisType = variables.classType("set", list.t.templateSpec, null);
                const setVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<SetVariable<Variable>>;
                const listmem = list.v.members._values.v.pointee;
                
                for (let i = 0; i < listmem.values.length; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                    _insert(rt, setVar, currentValue);
                }
                
                return setVar;
            }
        };

        const ctorHandler2: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS set < ?0 > ( PTR ?0 PTR ?0 )",
            *default(rt: CRuntime, _templateTypes: ObjectType[], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<SetVariable<Variable>> {
                const begin = variables.asInitIndexPointer(_begin) ?? rt.raiseException("set constructor: expected valid begin iterator");
                const end = variables.asInitIndexPointer(_end) ?? rt.raiseException("set constructor: expected valid end iterator");
                
                if (begin.v.pointee !== end.v.pointee) {
                    rt.raiseException("set constructor: iterators must point to same memory region");
                }
                
                const elementType = begin.v.pointee.objectType;
                const thisType = variables.classType("set", [elementType], null);
                const setVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<SetVariable<Variable>>;
                
                for (let i = begin.v.index; i < end.v.index; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable);
                    _insert(rt, setVar, currentValue);
                }
                
                return setVar;
            }
        };

        rt.explicitListInitTable["set"] = (setType: SetType<ObjectType>) => setType.templateSpec[0];
        rt.regFunc(ctorHandler1.default, variables.classType("set", [], null), ctorHandler1.op, rt.typeSignature(ctorHandler1.type), [-1]);
        rt.regFunc(ctorHandler2.default, variables.classType("set", [], null), ctorHandler2.op, rt.typeSignature(ctorHandler2.type), [-1]);

        function _ensureCapacity(setVar: SetVariable<Variable>, requiredCapacity: number): void {
            const currentCapacity = setVar.v.members._data.v.pointee.values.length;
            if (currentCapacity < requiredCapacity) {
                let newCapacity = Math.max(currentCapacity * 2, 8);
                while (newCapacity < requiredCapacity) {
                    newCapacity *= 2;
                }
                
                const currentArray = setVar.v.members._data.v.pointee;
                const elementType = currentArray.objectType;
                const newArray = variables.arrayMemory<Variable>(elementType, []);
                
                for (let i = 0; i < currentArray.values.length; i++) {
                    if (i < setVar.v.members._sz.v.value) {
                        newArray.values[i] = currentArray.values[i];
                    }
                }
                
                for (let i = currentArray.values.length; i < newCapacity; i++) {
                    const defaultVal = asResult(rt.defaultValue(elementType, { array: newArray, index: i }));
                    if (defaultVal) {
                        newArray.values[i] = defaultVal.v;
                    }
                }
                
                setVar.v.members._data.v.pointee = newArray;
                setVar.v.members._cap.v.value = newCapacity;
            }
        }

        function _compareStrings(rt: CRuntime, str1: any, str2: any): number {
            try {
                // Bandyti gauti string pointer ir size
                const str1Ptr = variables.asInitIndexPointerOfElem(str1.v.members._ptr, variables.uninitArithmetic("I8", null));
                const str2Ptr = variables.asInitIndexPointerOfElem(str2.v.members._ptr, variables.uninitArithmetic("I8", null));
                
                if (!str1Ptr || !str2Ptr) {
                    throw new Error("Invalid string pointers");
                }
                
                const str1Size = str1.v.members._size.v.value;
                const str2Size = str2.v.members._size.v.value;
                
                const minSize = Math.min(str1Size, str2Size);
                for (let i = 0; i < minSize; i++) {
                    const char1 = rt.arithmeticValue(variables.arrayMember(str1Ptr.v.pointee, str1Ptr.v.index + i));
                    const char2 = rt.arithmeticValue(variables.arrayMember(str2Ptr.v.pointee, str2Ptr.v.index + i));
                    
                    if (char1 < char2) return -1;
                    if (char1 > char2) return 1;
                }
                
                if (str1Size < str2Size) return -1;
                if (str1Size > str2Size) return 1;
                return 0;
            } catch (e) {
                throw new Error("Failed to compare strings: " + e);
            }
        }

        function _insert(rt: CRuntime, setVar: SetVariable<Variable>, value: Variable): [InitIndexPointerVariable<Variable>, boolean] {
            const dataPtr = setVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            const sz = setVar.v.members._sz.v.value;
            
            let insertPos = sz; // Pagal nutylėjimą įterpsime gale
            
            for (let i = 0; i < sz; i++) {
                const existingValue = rt.unbound(variables.arrayMember(dataArray, i) as MaybeUnboundVariable);
                
                let comparison = 0;
                
                if (!existingValue || !existingValue.t) {
                    continue;
                }
                
                if (!value || !value.t) {
                    rt.raiseException("set: Invalid value provided for insertion");
                }
                
                if (value.t.sig === "CLASS" && (value.t as any).identifier === "string" &&
                    existingValue.t.sig === "CLASS" && (existingValue.t as any).identifier === "string") {
                    try {
                        comparison = _compareStrings(rt, existingValue, value);
                    } catch (e) {
                        rt.raiseException("set: Failed to compare string values: " + e.message);
                    }
                }
                else if (variables.asArithmetic(value) && variables.asArithmetic(existingValue)) {
                    const existingNum = rt.arithmeticValue(existingValue as ArithmeticVariable);
                    const valueNum = rt.arithmeticValue(value as ArithmeticVariable);
                    
                    if (existingNum === valueNum) {
                        comparison = 0;
                    } else if (existingNum < valueNum) {
                        comparison = -1;
                    } else {
                        comparison = 1;
                    }
                } else {
                    try {
                        const ltFunc = rt.getFuncByParams("{global}", "o(_<_)", [
                            { t: existingValue.t, v: { isConst: true, lvHolder: "SELF" } },
                            { t: value.t, v: { isConst: true, lvHolder: "SELF" } }
                        ], []);
                        
                        if (ltFunc) {
                            const result1 = rt.invokeCall(ltFunc, [], existingValue, value);
                            const result2 = rt.invokeCall(ltFunc, [], value, existingValue);
                            
                            const r1 = asResult(result1);
                            const r2 = asResult(result2);
                            
                            if (r1 && r1 !== "VOID" && r2 && r2 !== "VOID") {
                                const val1 = rt.arithmeticValue(rt.unbound(r1) as ArithmeticVariable);
                                const val2 = rt.arithmeticValue(rt.unbound(r2) as ArithmeticVariable);
                                
                                if (val1 && !val2) comparison = -1;
                                else if (!val1 && val2) comparison = 1;
                                else comparison = 0;
                            } else {
                                rt.raiseException("set: Cannot compare elements - comparison function failed");
                            }
                        } else {
                            rt.raiseException("set: Cannot compare elements - no comparison operator found");
                        }
                    } catch (e) {
                        rt.raiseException("set: Cannot compare elements of this type: " + e);
                    }
                }
                
                if (comparison === 0) {
                    return [variables.indexPointer(dataArray, i, false, null, false), false];
                }
                
                if (comparison > 0) {
                    insertPos = i;
                    break;
                }
            }
            
            _ensureCapacity(setVar, sz + 1);
            const updatedArray = setVar.v.members._data.v.pointee;
            
            for (let i = sz; i > insertPos; i--) {
                updatedArray.values[i] = updatedArray.values[i - 1];
            }
            
            updatedArray.values[insertPos] = variables.clone(value, { array: updatedArray, index: insertPos }, false, rt.raiseException, true).v;
            setVar.v.members._sz.v.value++;
            
            return [variables.indexPointer(updatedArray, insertPos, false, null, false), true];
        }

        function _find(rt: CRuntime, setVar: SetVariable<Variable>, value: Variable): InitIndexPointerVariable<Variable> | null {
            const dataPtr = setVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            const sz = setVar.v.members._sz.v.value;
            
            for (let i = 0; i < sz; i++) {
                const existingValue = rt.unbound(variables.arrayMember(dataArray, i) as MaybeUnboundVariable);
                
                let isEqual = false;
                
                if (!existingValue || !existingValue.t || !value || !value.t) {
                    continue;
                }
                
                if (value.t.sig === "CLASS" && (value.t as any).identifier === "string" &&
                    existingValue.t.sig === "CLASS" && (existingValue.t as any).identifier === "string") {
                    try {
                        isEqual = _compareStrings(rt, existingValue, value) === 0;
                    } catch (e) {
                        continue;
                    }
                }
                else if (variables.asArithmetic(value) && variables.asArithmetic(existingValue)) {
                    const existingNum = rt.arithmeticValue(existingValue as ArithmeticVariable);
                    const valueNum = rt.arithmeticValue(value as ArithmeticVariable);
                    isEqual = existingNum === valueNum;
                } else {
                    try {
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
                    } catch (e) {
                        continue;
                    }
                }
                
                if (isEqual) {
                    return variables.indexPointer(dataArray, i, false, null, false);
                }
            }
            
            return null;
        }

        function _end(rt: CRuntime, setVar: SetVariable<Variable>): InitIndexPointerVariable<Variable> {
            const dataPtr = setVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            return variables.indexPointer(dataArray, setVar.v.members._sz.v.value, false, null, false);
        }

        function _erase(rt: CRuntime, setVar: SetVariable<Variable>, index: number): boolean {
            const dataPtr = setVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            const size = setVar.v.members._sz.v.value;
            
            if (index >= 0 && index < size) {
                // Pastumti elementus kairėn
                for (let i = index; i < size - 1; i++) {
                    dataArray.values[i] = dataArray.values[i + 1];
                }
                setVar.v.members._sz.v.value--;
                return true;
            }
            return false;
        }

        common.regMemberFuncs(rt, "set", [
            {
                op: "begin",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS set < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const dataPtr = setVar.v.members._data;
                    const dataArray = dataPtr.v.pointee;
                    return variables.indexPointer(dataArray, 0, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS set < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    return _end(rt, setVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS set < ?0 > CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, templateTypes: ObjectType[], ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {
                    const setVar = args[0] as SetVariable<Variable>;
                    const list = args[1] as InitializerListVariable<Variable>;
                    const listmem = list.v.members._values.v.pointee;
                    
                    let lastInserted: InitIndexPointerVariable<Variable> | null = null;
                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                        const [iterator, _inserted] = _insert(rt, setVar, currentValue);
                        lastInserted = iterator;
                    }
                    
                    return lastInserted ?? _end(rt, setVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[1];
                    const [iterator, _inserted] = _insert(rt, setVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > PTR ?0 PTR ?0 )",
                default(rt: CRuntime, templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
                    const setVar = args[0] as SetVariable<Variable>;
                    const beginPtr = args[1] as PointerVariable<Variable>;
                    const endPtr = args[2] as PointerVariable<Variable>;
                    
                    const begin = variables.asInitIndexPointer(beginPtr) ?? rt.raiseException("set::insert: expected valid begin iterator");
                    const end = variables.asInitIndexPointer(endPtr) ?? rt.raiseException("set::insert: expected valid end iterator");
                    
                    if (begin.v.pointee !== end.v.pointee) {
                        rt.raiseException("set::insert: iterators must point to same memory region");
                    }
                    
                    for (let i = begin.v.index; i < end.v.index; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable);
                        _insert(rt, setVar, currentValue);
                    }
                    
                    return "VOID";
                }
            },
            {
                op: "erase",
                type: "!ParamObject FUNCTION I32 ( LREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, setVar, value);
                    if (found !== null) {
                        const erased = _erase(rt, setVar, found.v.index);
                        return variables.arithmetic("I32", erased ? 1 : 0, null, false);
                    }
                    return variables.arithmetic("I32", 0, null, false);
                }
            },
            {
                op: "find",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, setVar, value);
                    if (found !== null) {
                        return found;
                    }
                    return _end(rt, setVar);
                }
            },
            {
                op: "count",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, setVar, value);
                    return variables.arithmetic("I32", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "contains",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, setVar, value);
                    return variables.arithmetic("BOOL", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    return variables.arithmetic("I32", setVar.v.members._sz.v.value, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    return variables.arithmetic("BOOL", setVar.v.members._sz.v.value === 0 ? 1 : 0, null, false);
                }
            },
            {
                op: "clear",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
                    const setVar = args[0] as SetVariable<Variable>;
                    setVar.v.members._sz.v.value = 0;
                    return "VOID";
                }
            },
        ])
    }
};