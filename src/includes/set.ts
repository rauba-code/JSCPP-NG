// TODO: Validate and cleanup set

import { InitializerListVariable } from "../initializer_list";
import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, Variable, variables, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, PointerVariable, InitArithmeticNumVariable, ArithmeticBigVariable, ArithmeticNumVariable, InitDirectPointerVariable, InitArithmeticBigValue, InitArithmeticBigVariable } from "../variables";


interface SetNodeType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "set_node",
}

type SetNodeVariable<T extends Variable> = AbstractVariable<SetNodeType<T["t"]>, SetNodeValue<T>>;

interface SetNodeValue<T extends Variable> extends InitValue<SetNodeVariable<T>> {
    members: {
        "lhs": PointerVariable<SetNodeVariable<T>>,
        "rhs": PointerVariable<SetNodeVariable<T>>,
        "parent": PointerVariable<SetNodeVariable<T>>,
        "is_red": InitArithmeticNumVariable,
        "key": T,
    }
}

interface SetIteratorType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "set_iterator",
}

type SetIteratorVariable<T extends Variable> = AbstractVariable<SetIteratorType<T["t"]>, SetIteratorValue<T>>;

interface SetIteratorValue<T extends Variable> extends InitValue<SetIteratorVariable<T>> {
    members: {
        "node": PointerVariable<SetNodeVariable<T>>,
    }
}


interface SetType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "set",
}

type SetVariable<T extends Variable> = AbstractVariable<SetType<T["t"]>, SetValue<T>>;

interface SetValue<T extends Variable> extends InitValue<SetVariable<T>> {
    members: {
        "root": PointerVariable<SetNodeVariable<T>>,
        "_size": InitArithmeticBigVariable,
    }
}

export = {
    load(rt: CRuntime) {
        rt.include("cstddef");

        type __set = SetVariable<Variable>;
        type __set_node = SetNodeVariable<Variable>;
        type __set_iter = SetIteratorVariable<Variable>;
        type __dptr_node = InitDirectPointerVariable<__set_node>;

        const _createSetNodeType: (templateSpec: [ObjectType]) => __set_node['t'] = (templateSpec) => ({
            "sig": "CLASS",
            "identifier": "set_node",
            "memberOf": null,
            templateSpec
        });

        const _createSetIterType: (templateSpec: [ObjectType]) => __set_iter['t'] = (templateSpec) => ({
            "sig": "CLASS",
            "identifier": "set_iterator",
            "memberOf": null,
            templateSpec
        });

        // --
        // -- set_node
        // --

        rt.defineStruct2("{global}", "set_node", {
            numTemplateArgs: 1, *factory(dataItem: __set_node['t']) {
                const default_key: Variable = yield* rt.defaultValue2(dataItem.templateSpec[0], "SELF");
                return {
                    lhs: variables.uninitPointer(dataItem, null, "SELF"),
                    rhs: variables.uninitPointer(dataItem, null, "SELF"),
                    parent: variables.uninitPointer(dataItem, null, "SELF"),
                    is_red: variables.arithmeticNum("BOOL", 0, "SELF"),
                    key: default_key

                };
            }
        }, ["lhs", "rhs", "parent", "is_red", "key"], {});

        function _node_delete(thisVal: __set_node['v']): void {
            if (thisVal.members.lhs.v.state !== "UNINIT") {
                _node_delete((thisVal.members.lhs as __dptr_node).v.pointee);
                delete (thisVal.members as any).lhs;
            }
            if (thisVal.members.rhs.v.state !== "UNINIT") {
                _node_delete((thisVal.members.rhs as __dptr_node).v.pointee);
                delete (thisVal.members as any).rhs;
            }
        }

        // --
        // -- set_iterator
        // --

        function _createSetIterMembers(setIterType: __set_iter['t']): __set_iter['v']['members'] {
            return {
                node: variables.uninitPointer(setIterType, null, "SELF") as PointerVariable<__set_node>,
            };
        }

        function _createSetIterVar(setIterType: __set_iter['t']): __set_iter {
            return {
                t: setIterType,
                v: {
                    isConst: false,
                    state: "INIT",
                    lvHolder: "SELF",
                    members: _createSetIterMembers(setIterType)
                }
            };
        }

        // const setIteratorSig = "!ParamObject CLASS set_iterator < ?0 >".split(" ");
        rt.defineStruct2("{global}", "set_iterator", {
            numTemplateArgs: 1, factory: _createSetIterMembers
        }, ["node"], {
            // ["value_type"]: [{ src: setIteratorSig, dst: ["?0"]}],
            // ["pointer"]: [{ src: setIteratorSig, dst: ["PTR", "?0"]}],
            // ["reference"]: [{ src: setIteratorSig, dst: ["LREF", "?0"]}],
        });

        function _iter_next(thisVar: __set_iter): "VOID" {
            let node: __dptr_node | null = variables.asInitDirectPointer(thisVar) as __dptr_node | null;
            if (node === null) {
                return "VOID";
            }
            const rhs: __dptr_node | null = variables.asInitDirectPointer(node.v.pointee.members.rhs) as __dptr_node | null;
            if (rhs !== null) {
                node.v = rhs.v;
                let lhs: __dptr_node | null = variables.asInitDirectPointer(node.v.pointee.members.lhs) as __dptr_node | null;
                while (lhs !== null) {
                    node.v = lhs.v;
                    lhs = variables.asInitDirectPointer(node.v.pointee.members.lhs) as __dptr_node | null;
                }
            } else {
                for (; ;) {
                    const parent: __dptr_node | null = variables.asInitDirectPointer(node.v.pointee.members.parent) as __dptr_node | null;
                    if (parent === null) {
                        (node as any).v = { isConst: false, state: "UNINIT", lvHolder: "SELF" };
                        break;
                    }
                    if (node.v === parent.v.pointee.members.lhs.v) {
                        node.v = parent.v;
                        break;
                    }
                    node.v = parent.v;
                }
            }
            return "VOID";
        }

        function _createSetIterVarFromRoot(setIterType: __set_iter['t'], _top: PointerVariable<__set_node>): __set_iter {
            const result: __set_iter = _createSetIterVar(setIterType);
            const topOrNull: __dptr_node | null = variables.asInitDirectPointer(_top) as __dptr_node | null;
            if (topOrNull === null) {
                return result;
            }
            let top: __dptr_node = topOrNull;
            let lhs: __dptr_node | null = variables.asInitDirectPointer(top.v.pointee.members.lhs) as __dptr_node | null;
            while (lhs !== null) {
                top = lhs;
                lhs = variables.asInitDirectPointer(top.v.pointee.members.lhs) as __dptr_node | null;
            }
            variables.directPointerAssignValue(rt, result.v.members.node, top.v.pointee);
            return result;
        }

        common.regOps(rt, [
            {
                op: "o(*_)",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS set_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __set_iter): Variable {
                    if (thisVar.v.members.node.v.state === "INIT") {
                        return (thisVar.v.members.node as __dptr_node).v.pointee.members.key;
                    }
                    rt.raiseException("set_iterator::operator*(): Attempted dereference of a null-iterator");
                }
            },
            {
                op: "o(++_)",
                type: "!ParamObject FUNCTION LREF CLASS set_iterator < ?0 > ( LREF CLASS set_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], thisVar: __set_iter): __set_iter {
                    _iter_next(thisVar);
                    return thisVar;
                }
            },
            {
                op: "o(_++)",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __set_iter): __set_iter {
                    const thatVar = variables.clone(rt, thisVar, null, false);
                    _iter_next(thisVar);
                    return thatVar;
                }
            },
            {
                op: "o(_==_)",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set_iterator < ?0 > CLREF CLASS set_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], lhs: __set_iter, rhs: __set_iter): InitArithmeticNumVariable {
                    const isEq: boolean = (lhs.v.members.node.v.state === "UNINIT") ? (rhs.v.members.node.v.state === "UNINIT") : (lhs.v === rhs.v);
                    return variables.arithmeticNum("BOOL", isEq ? 1 : 0, null);
                }
            },
            {
                op: "o(_!=_)",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set_iterator < ?0 > CLREF CLASS set_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], lhs: __set_iter, rhs: __set_iter): InitArithmeticNumVariable {
                    const isEq: boolean = (lhs.v.members.node.v.state === "UNINIT") ? (rhs.v.members.node.v.state === "UNINIT") : (lhs.v === rhs.v);
                    return variables.arithmeticNum("BOOL", isEq ? 0 : 1, null);
                }
            },

        ])

        // --
        // -- set
        // --

        const setSig = "!ParamObject CLASS set < ?0 >".split(" ");
        rt.defineStruct2("{global}", "set", {
            numTemplateArgs: 1, factory: (dataItem: SetType<ObjectType>) => {
                return {
                    root: variables.uninitPointer(_createSetNodeType(dataItem.templateSpec), null, "SELF"),
                    _size: variables.arithmeticBig("U64", BigInt(0), "SELF"),
                }
            }
        }, ["_data", "_sz", "_cap"], {
            ["key_type"]: [{ src: setSig, dst: ["?0"] }],
            ["value_type"]: [{ src: setSig, dst: ["?0"] }],
            ["iterator"]: [{ src: setSig, dst: ["CLASS", "set_iterator", "<", "?0", ">"] }], // implementation-dependent
            ["const_iterator"]: [{ src: setSig, dst: ["CLASS", "set_iterator", "<", "?0", ">"] }], // implementation-dependent
            ["pointer"]: [{ src: setSig, dst: ["PTR", "?0"] }],
            ["reference"]: [{ src: setSig, dst: ["LREF", "?0"] }],
            ["size_type"]: [{ src: setSig, dst: ["U64"] }],
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

        function _rotate_right(rt: CRuntime, g: __dptr_node, g_ref: PointerVariable<__set_node>): void {
            // Case 6a.
            // [((n), p=R, [b?]), g=B, [u?]]
            // Rotate right.
            // ((n), p=R, [[b?], g=b, [u?]])
            // ; set_node<Key> *p = g->lhs;
            // ; set_node<Key> *n = p->lhs;      // opt
            // ; set_node<Key> *b = p->rhs;      // opt
            // ; set_node<Key> *ggp = g->parent; // opt
            const p = variables.clone(rt, g.v.pointee.members.lhs, null, false, true) as __dptr_node;
            //const n = variables.clone(rt, p.v.pointee.members.lhs, null, false, true) as PointerVariable<__set_node>;
            const b = variables.clone(rt, p.v.pointee.members.rhs, null, false, true) as PointerVariable<__set_node>;
            const ggp = variables.clone(rt, g.v.pointee.members.parent, null, false, true) as PointerVariable<__set_node>;
            // ; g->lhs = b;
            const b_dptr = variables.asInitDirectPointer(b) as __dptr_node | null;
            if (b_dptr === null) {
                g.v.pointee.members.lhs.v.state = "UNINIT";
            } else {
                // because b_dptr is an init direct pointer
                (g.v.pointee.members.lhs as __dptr_node).v.pointee = b_dptr.v.pointee;
            }
            // ; if (b) {
            // ;   b->parent = g;
            // ; }
            if (b_dptr !== null) {
                variables.directPointerAssignValue(rt, b_dptr.v.pointee.members.parent, g.v.pointee);
            }
            // ((n), p=R, !)    [[b?], g=B, [u?]]
            // g->rhs and u?->parent do not change
            // p->lhs and n?->parent do not change
            // ; p->rhs = g;
            variables.directPointerAssignValue(rt, p.v.pointee.members.rhs, g.v.pointee);
            // ; g->parent = p;
            variables.directPointerAssignValue(rt, g.v.pointee.members.parent, g.v.pointee);
            // ; p->parent = ggp;
            const ggp_dptr = variables.asInitDirectPointer(ggp) as __dptr_node | null;
            if (ggp_dptr === null) {
                p.v.pointee.members.parent.v.state = "UNINIT";
            } else {
                variables.directPointerAssignValue(rt, p.v.pointee.members.parent, ggp_dptr.v.pointee);
            }
            // ; *g_ref = p;
            variables.directPointerAssignValue(rt, g_ref, p.v.pointee);
        }

        function _rotate_left(rt: CRuntime, g: __dptr_node, g_ref: PointerVariable<__set_node>): void {
            // Case 6b.
            // [[u?], g=B, ([b?], p=R, (n))]
            // Rotate left.
            // ([[u?], g=b, [b?]], p=R, (n))
            // ; set_node<Key> *p = g->rhs;
            // ; set_node<Key> *n = p->rhs;      // opt
            // ; set_node<Key> *b = p->lhs;      // opt
            // ; set_node<Key> *ggp = g->parent; // opt

            const p = variables.clone(rt, g.v.pointee.members.rhs, null, false, true) as __dptr_node;
            //const n = variables.clone(rt, p.v.pointee.members.rhs, null, false, true) as PointerVariable<__set_node>;
            const b = variables.clone(rt, p.v.pointee.members.lhs, null, false, true) as PointerVariable<__set_node>;
            const ggp = variables.clone(rt, g.v.pointee.members.parent, null, false, true) as PointerVariable<__set_node>;
            // ; g->rhs = b;
            const b_dptr = variables.asInitDirectPointer(b) as __dptr_node | null;
            if (b_dptr === null) {
                g.v.pointee.members.rhs.v.state = "UNINIT";
            } else {
                // because b_dptr is an init direct pointer
                (g.v.pointee.members.rhs as __dptr_node).v.pointee = b_dptr.v.pointee;
            }
            // ; if (b) {
            // ;   b->parent = g;
            // ; }
            if (b_dptr !== null) {
                variables.directPointerAssignValue(rt, b_dptr.v.pointee.members.parent, g.v.pointee);
            }
            // ((n), p=R, !)    [[b?], g=B, [u?]]
            // g->lhs and u?->parent do not change
            // p->rhs and n?->parent do not change
            // ; p->lhs = g;
            variables.directPointerAssignValue(rt, p.v.pointee.members.lhs, g.v.pointee);
            // ; g->parent = p;
            variables.directPointerAssignValue(rt, g.v.pointee.members.parent, g.v.pointee);
            // ; p->parent = ggp;
            const ggp_dptr = variables.asInitDirectPointer(ggp) as __dptr_node | null;
            if (ggp_dptr === null) {
                p.v.pointee.members.parent.v.state = "UNINIT";
            } else {
                variables.directPointerAssignValue(rt, p.v.pointee.members.parent, ggp_dptr.v.pointee);
            }
            // ; *g_ref = p;
            variables.directPointerAssignValue(rt, g_ref, p.v.pointee);
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
                    const existingNum = rt.arithmeticValue(existingValue as ArithmeticNumVariable);
                    const valueNum = rt.arithmeticValue(value as ArithmeticNumVariable);
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
                                isEqual = rt.arithmeticValue(rt.unbound(r) as ArithmeticNumVariable) !== 0;
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
                    const existingNum = rt.arithmeticValue(existingValue as ArithmeticNumVariable | ArithmeticBigVariable);
                    const valueNum = rt.arithmeticValue(value as ArithmeticNumVariable | ArithmeticBigVariable);

                    if (existingNum == valueNum) {
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
                                const val1 = rt.arithmeticValue(rt.unbound(r1) as ArithmeticNumVariable);
                                const val2 = rt.arithmeticValue(rt.unbound(r2) as ArithmeticNumVariable);

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

            updatedArray.values[insertPos] = variables.clone(rt, value, { array: updatedArray, index: insertPos }, false, true).v;
            setVar.v.members._sz.v.value++;

            return [variables.indexPointer(updatedArray, insertPos, false, null, false), true];
        }


        function _end(setVar: SetVariable<Variable>): InitIndexPointerVariable<Variable> {
            const dataPtr = setVar.v.members._data;
            const dataArray = dataPtr.v.pointee;
            return variables.indexPointer(dataArray, setVar.v.members._sz.v.value, false, null, false);
        }

        function _erase(setVar: SetVariable<Variable>, index: number): boolean {
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
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const dataPtr = setVar.v.members._data;
                    const dataArray = dataPtr.v.pointee;
                    return variables.indexPointer(dataArray, 0, false, null, false);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    return _end(setVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS set < ?0 > CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {
                    const setVar = args[0] as SetVariable<Variable>;
                    const list = args[1] as InitializerListVariable<Variable>;
                    const listmem = list.v.members._values.v.pointee;

                    let lastInserted: InitIndexPointerVariable<Variable> | null = null;
                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                        const [iterator] = _insert(rt, setVar, currentValue);
                        lastInserted = iterator;
                    }

                    return lastInserted ?? _end(setVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[1];
                    const [iterator] = _insert(rt, setVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION PTR ?0 ( LREF CLASS set < ?0 > PTR ?0 CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    // same as above, ignoring the iterator
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[2];
                    const [iterator] = _insert(rt, setVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
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
                        const erased = _erase(setVar, found.v.index);
                        return variables.arithmeticNum("I32", erased ? 1 : 0, null, false);
                    }
                    return variables.arithmeticNum("I32", 0, null, false);
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
                    return _end(setVar);
                }
            },
            {
                op: "count",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, setVar, value);
                    return variables.arithmeticNum("I32", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "contains",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    const value = args[1];
                    const found = _find(rt, setVar, value);
                    return variables.arithmeticNum("BOOL", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    return variables.arithmeticNum("I32", setVar.v.members._sz.v.value, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as SetVariable<Variable>;
                    return variables.arithmeticNum("BOOL", setVar.v.members._sz.v.value === 0 ? 1 : 0, null, false);
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
