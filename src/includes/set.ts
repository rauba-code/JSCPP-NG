import { InitializerListVariable } from "../initializer_list";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { PairVariable } from "../shared/utility";
import { Variable, variables, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, PointerVariable, InitArithmeticNumVariable, InitDirectPointerVariable, InitArithmeticBigVariable } from "../variables";


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
        rt.include("utility"); // pair

        type __set = SetVariable<Variable>;
        type __node = SetNodeVariable<Variable>;
        type __set_iter = SetIteratorVariable<Variable>;
        type __dptr_node = InitDirectPointerVariable<__node>;

        const _createSetNodeType: (templateSpec: [ObjectType]) => __node['t'] = (templateSpec) => ({
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

        function _createSetNodeMembers(setIterType: __node['t'], key: Variable, is_red: boolean): __node['v']['members'] {
            const ptrType = { sig: "PTR" as "PTR", pointee: setIterType, sizeConstraint: null };
            return {
                lhs: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                rhs: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                parent: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                is_red: { t: { sig: "BOOL" }, v: { lvHolder: "SELF", state: "INIT", value: (is_red) ? 1 : 0, isConst: false } },
                key
            };
        }

        function* _createSetNodeMembersDefault(setIterType: __node['t']): Gen<__node['v']['members']> {
            const default_key: Variable = yield* rt.defaultValue2(setIterType.templateSpec[0], "SELF");
            return _createSetNodeMembers(setIterType, default_key, false);
        }

        function _createSetNodeVar(setIterType: __node['t'], key: Variable, is_red: boolean): __node {
            return {
                t: setIterType,
                v: {
                    isConst: false,
                    state: "INIT",
                    lvHolder: "SELF",
                    members: _createSetNodeMembers(setIterType, key, is_red)
                }
            };
        }

        rt.defineStruct2("{global}", "set_node", {
            numTemplateArgs: 1, factory: _createSetNodeMembersDefault
        }, ["lhs", "rhs", "parent", "is_red", "key"], {});

        function _node_delete(thisVal: __node['v']): void {
            if (thisVal.members.lhs.v.state !== "UNINIT") {
                _ptr_node_delete((thisVal.members.lhs as __dptr_node).v);
                (thisVal as any).lvHolder = "UNBOUND";
            }
            if (thisVal.members.rhs.v.state !== "UNINIT") {
                _ptr_node_delete((thisVal.members.rhs as __dptr_node).v);
                (thisVal as any).lvHolder = "UNBOUND";
            }
        }

        function _ptr_node_delete(thisVal: __dptr_node['v']): void {
            _node_delete(thisVal.pointee);
            delete (thisVal as any).pointee;
            (thisVal as any).lvHolder = "UNBOUND";
        }

        // --
        // -- set_iterator
        // --

        function _createSetIterMembers(setIterType: __set_iter['t']): __set_iter['v']['members'] {
            return {
                node: variables.uninitPointer(setIterType, null, "SELF") as PointerVariable<__node>,
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
            let node: __dptr_node | null = variables.asInitDirectPointer2(thisVar.v.members.node);
            if (node === null) {
                // UB?
                return "VOID";
            }
            const rhs: __dptr_node | null = variables.asInitDirectPointer2(node.v.pointee.members.rhs);
            if (rhs !== null) {
                node.v.pointee = rhs.v.pointee;
                let lhs: __dptr_node | null = variables.asInitDirectPointer2(node.v.pointee.members.lhs);
                while (lhs !== null) {
                    node.v.pointee = lhs.v.pointee;
                    lhs = variables.asInitDirectPointer2(node.v.pointee.members.lhs);
                }
            } else {
                for (; ;) {
                    const parent: __dptr_node | null = variables.asInitDirectPointer2(node.v.pointee.members.parent);
                    if (parent === null) {
                        (node as any).v = { isConst: false, state: "UNINIT", lvHolder: "SELF" };
                        break;
                    }
                    if (parent.v.pointee.members.lhs.v.state === "INIT" &&
                        node.v.pointee === parent.v.pointee.members.lhs.v.pointee) {
                        node.v.pointee = parent.v.pointee;
                        break;
                    }
                    node.v.pointee = parent.v.pointee;
                }
            }
            return "VOID";
        }

        function _createSetIterVarFromRoot(setIterType: __set_iter['t'], _top: PointerVariable<__node>): __set_iter {
            const result: __set_iter = _createSetIterVar(setIterType);
            const topOrNull: __dptr_node | null = variables.asInitDirectPointer2(_top);
            if (topOrNull === null) {
                return result;
            }
            let top: __dptr_node = topOrNull;
            let lhs: __dptr_node | null = variables.asInitDirectPointer2(top.v.pointee.members.lhs);
            while (lhs !== null) {
                top = lhs;
                lhs = variables.asInitDirectPointer2(top.v.pointee.members.lhs);
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
            *default(rt: CRuntime, _templateTypes: [], list: InitializerListVariable<Variable>): Gen<__set> {
                const thisType = variables.classType("set", list.t.templateSpec, null);
                const setVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<__set>;
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
            *default(rt: CRuntime, _templateTypes: ObjectType[], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<__set> {
                const begin = variables.asInitIndexPointer(_begin) ?? rt.raiseException("set constructor: expected valid begin iterator");
                const end = variables.asInitIndexPointer(_end) ?? rt.raiseException("set constructor: expected valid end iterator");

                if (begin.v.pointee !== end.v.pointee) {
                    rt.raiseException("set constructor: iterators must point to same memory region");
                }

                const elementType = begin.v.pointee.objectType;
                const thisType = variables.classType("set", [elementType], null);
                const setVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<__set>;

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

        function _assert_parent(rt: CRuntime, node: __node['v']) {
            const parent = variables.asInitDirectPointer2(node.members.parent);
            const assertion = (parent === null) ||
                (parent.v.pointee.members.lhs.v.state === "INIT" && (parent.v.pointee.members.lhs as __dptr_node).v.pointee === node) ||
                (parent.v.pointee.members.rhs.v.state === "INIT" && (parent.v.pointee.members.rhs as __dptr_node).v.pointee === node);
            if (!assertion) {
                rt.raiseException("std::set<Key>: Parent rule assertion failed");
            }
        }

        function _assert_rb(rt: CRuntime, root: __dptr_node): boolean {
            function _assert_rb_inner(rt: CRuntime, node: __dptr_node): number {
                let depth_lhs = 1;
                let depth_rhs = 1;
                const lhs = variables.asInitDirectPointer2(node.v.pointee.members.lhs);
                const rhs = variables.asInitDirectPointer2(node.v.pointee.members.rhs);
                const is_red = node.v.pointee.members.is_red.v.value;
                if (lhs !== null) {
                    if (is_red && lhs.v.pointee.members.is_red.v.value) {
                        return -1;
                    }
                    depth_lhs = _assert_rb_inner(rt, lhs);
                }
                if (rhs !== null) {
                    if (is_red && rhs.v.pointee.members.is_red.v.value) {
                        return -1;
                    }
                    depth_rhs = _assert_rb_inner(rt, rhs);
                }
                if (depth_lhs !== depth_rhs || depth_lhs === -1) {
                    return -1;
                }
                return depth_lhs + ((is_red) ? 0 : 1);
            }
            return _assert_rb_inner(rt, root) !== -1;
        }

        function _rotate_right(rt: CRuntime, g: __node['v'], g_ref: PointerVariable<__node>): void {
            // Case 6a.
            // [((n), p=R, [b?]), g=B, [u?]]
            // Rotate right.
            // ((n), p=R, [[b?], g=b, [u?]])
            // ; set_node<Key> *p = g->lhs;
            // ; set_node<Key> *n = p->lhs;      // opt
            // ; set_node<Key> *b = p->rhs;      // opt
            // ; set_node<Key> *ggp = g->parent; // opt

            const p = (g.members.lhs as __dptr_node).v.pointee;
            const b = variables.asInitDirectPointerPointee(p.members.rhs);
            const ggp = variables.asInitDirectPointerPointee(g.members.parent);
            // ; g->lhs = b;
            if (b === null) {
                g.members.lhs.v.state = "UNINIT";
            } else {
                // because b_dptr is an init direct pointer
                (g.members.lhs as __dptr_node).v.pointee = b;
            }
            // ; if (b) {
            // ;   b->parent = g;
            // ; }
            if (b !== null) {
                variables.directPointerAssignValue(rt, b.members.parent, g);
            }
            // ((n), p=R, !)    [[b?], g=B, [u?]]
            // g->rhs and u?->parent do not change
            // p->lhs and n?->parent do not change
            // ; p->rhs = g;
            variables.directPointerAssignValue(rt, p.members.rhs, g);
            // ; g->parent = p;
            variables.directPointerAssignValue(rt, g.members.parent, p);
            // ; p->parent = ggp;
            if (ggp === null) {
                p.members.parent.v.state = "UNINIT";
            } else {
                variables.directPointerAssignValue(rt, p.members.parent, ggp);
            }
            // ; *g_ref = p;
            variables.directPointerAssignValue(rt, g_ref, p);
            _assert_parent(rt, p);
        }

        function _rotate_left(rt: CRuntime, g: __node['v'], g_ref: PointerVariable<__node>): void {
            // Case 6b.
            // [[u?], g=B, ([b?], p=R, (n))]
            // Rotate left.
            // ([[u?], g=b, [b?]], p=R, (n))
            // ; set_node<Key> *p = g->rhs;
            // ; set_node<Key> *n = p->rhs;      // opt
            // ; set_node<Key> *b = p->lhs;      // opt
            // ; set_node<Key> *ggp = g->parent; // opt

            const p = (g.members.rhs as __dptr_node).v.pointee;
            const b = variables.asInitDirectPointerPointee(p.members.lhs);
            const ggp = variables.asInitDirectPointerPointee(g.members.parent);
            // ; g->rhs = b;
            if (b === null) {
                g.members.rhs.v.state = "UNINIT";
            } else {
                // because g->rhs is init before the operation 
                (g.members.rhs as __dptr_node).v.pointee = b;
            }
            // ; if (b) {
            // ;   b->parent = g;
            // ; }
            if (b !== null) {
                variables.directPointerAssignValue(rt, b.members.parent, g);
            }
            // ((n), p=R, !)    [[b?], g=B, [u?]]
            // g->lhs and u?->parent do not change
            // p->rhs and n?->parent do not change
            // ; p->lhs = g;
            variables.directPointerAssignValue(rt, p.members.lhs, g);
            // ; g->parent = p;
            variables.directPointerAssignValue(rt, g.members.parent, p);
            // ; p->parent = ggp;
            if (ggp === null) {
                p.members.parent.v.state = "UNINIT";
            } else {
                variables.directPointerAssignValue(rt, p.members.parent, ggp);
            }
            // ; *g_ref = p;
            variables.directPointerAssignValue(rt, g_ref, p);
            _assert_parent(rt, p);
        }

        function* _find(rt: CRuntime, thisVar: __set, key: Variable): Gen<__set_iter> {
            const result: __set_iter = _createSetIterVar(_createSetIterType(thisVar.t.templateSpec));
            const root_dptr = variables.asInitDirectPointer2(thisVar.v.members.root);
            if (root_dptr === null) {
                return result;
            }
            variables.directPointerAssignValue(rt, result.v.members.node, root_dptr.v.pointee);
            const ltInst = rt.getOpByParams("{global}", "o(_<_)", [key, key], []);
            const gtInst = rt.getOpByParams("{global}", "o(_>_)", [key, key], []);

            for (; ;) {
                const node: __dptr_node = result.v.members.node as __dptr_node;
                const ltResult = yield* common.invokeCmp(rt, ltInst, node.v.pointee.members.key, key);
                if (ltResult) {
                    const node_rhs: __dptr_node | null = variables.asInitDirectPointer2(node.v.pointee.members.rhs);
                    if (node_rhs !== null) {
                        node.v.pointee = node_rhs.v.pointee;
                        continue;
                    } else {
                        return _createSetIterVar(_createSetIterType(thisVar.t.templateSpec));
                    }
                }
                const gtResult = yield* common.invokeCmp(rt, gtInst, node.v.pointee.members.key, key);
                if (gtResult) {
                    const node_lhs: __dptr_node | null = variables.asInitDirectPointer2(node.v.pointee.members.lhs);
                    if (node_lhs !== null) {
                        node.v.pointee = node_lhs.v.pointee;
                        continue;
                    } else {
                        return _createSetIterVar(_createSetIterType(thisVar.t.templateSpec));
                    }
                }
                return result;
            }
        }

        function* _insert(rt: CRuntime, thisVar: __set, value: Variable): Gen<[__set_iter, boolean]> {
            const nodeType = _createSetNodeType(thisVar.t.templateSpec);
            const rootValue = variables.asInitDirectPointerPointee(thisVar.v.members.root);
            if (rootValue === null) {
                const iterType = _createSetIterType(thisVar.t.templateSpec);
                const rootNode = _createSetNodeVar(nodeType, variables.clone(rt, value, "SELF"), false);
                variables.directPointerAssignValue(rt, thisVar.v.members.root, rootNode.v);
                thisVar.v.members._size.v.value++;
                return [_createSetIterVarFromRoot(iterType, thisVar.v.members.root), true];
            }
            let parentValue: __node['v'] = rootValue;
            let nodeValue: __node['v'] = _createSetNodeVar(nodeType, variables.clone(rt, value, "SELF"), true).v;
            const ltInst = rt.getOpByParams("{global}", "o(_<_)", [value, value], []);
            const gtInst = rt.getOpByParams("{global}", "o(_>_)", [value, value], []);
            for (; ;) {
                if (yield* common.invokeCmp(rt, ltInst, parentValue.members.key, value)) {
                    if (parentValue.members.rhs.v.state === "INIT") {
                        parentValue = (parentValue.members.rhs as __dptr_node).v.pointee;
                        continue;
                    } else {
                        variables.directPointerAssignValue(rt, parentValue.members.rhs, nodeValue);
                        variables.directPointerAssignValue(rt, nodeValue.members.parent, parentValue);
                        break;
                    }
                } else if (yield* common.invokeCmp(rt, gtInst, parentValue.members.key, value)) {
                    if (parentValue.members.lhs.v.state === "INIT") {
                        parentValue = (parentValue.members.lhs as __dptr_node).v.pointee;
                        continue;
                    } else {
                        variables.directPointerAssignValue(rt, parentValue.members.lhs, nodeValue);
                        variables.directPointerAssignValue(rt, nodeValue.members.parent, parentValue);
                        break;
                    }
                } else {
                    const iter = _createSetIterVar(_createSetIterType(thisVar.t.templateSpec));
                    variables.directPointerAssignValue(rt, iter.v.members.node, parentValue);
                    return [iter, false];
                }
            }
            _assert_parent(rt, nodeValue);
            _assert_parent(rt, parentValue);
            thisVar.v.members._size.v.value++;
            // ...
            for (; ;) {
                if (parentValue.members.is_red.v.value === 0) {
                    // Case 1. Parent is black.
                    break;
                }
                // Grandparent is always black, if exists.
                const grandparentValue: __node['v'] | null = variables.asInitDirectPointerPointee(parentValue.members.parent);
                if (grandparentValue === null) {
                    // Case 4. Parent is red and parent is the root node.
                    parentValue.members.is_red.v.value = 0;
                    break;
                }
                _assert_parent(rt, grandparentValue);
                const glhs = variables.asInitDirectPointerPointee(grandparentValue.members.lhs);
                const grhs = variables.asInitDirectPointerPointee(grandparentValue.members.rhs);
                const uncle: __node['v'] | null = (glhs !== null && glhs === parentValue) ? grhs : glhs;
                if (uncle === null || uncle.members.is_red.v.value === 0) {
                    if (grandparentValue.members.lhs.v.state === "INIT" &&
                        grandparentValue.members.lhs.v.pointee === parentValue) {
                        if (parentValue.members.rhs.v.state === "INIT" &&
                            parentValue.members.rhs.v.pointee === nodeValue) {
                            // Case 5a. Parent is red, sibling of parent (uncle) is black or does
                            // not exist, parent->key < node->key < grandparent->key.
                            // [([b?], p=R, (n)), g=B, [u?]]
                            // Rotate left
                            // [(([b?], p=R, .), n=R, .), g=B, [u?]]
                            _rotate_left(rt, parentValue, grandparentValue.members.lhs);
                            nodeValue = parentValue;
                            parentValue = (grandparentValue.members.lhs as __dptr_node).v.pointee;
                            _assert_parent(rt, parentValue);
                            // [(([b?], n=R, .), p=R, .), g=B, [u?]]
                        }
                        // Case 6a. Parent is red, sibling of parent (uncle) is black or does
                        // not exist, node->key < parent->key < grandparent->key.
                        // [((n), p=R, [b?]), g=B, [u?]]
                        // Rotate right
                        // ((n), p=R, [[b?], g=B, [u?]])
                        // Recolour
                        const ggp = variables.asInitDirectPointerPointee(grandparentValue.members.parent);
                        _rotate_right(
                            rt,
                            grandparentValue,
                            (ggp !== null) ?
                                ((ggp.members.lhs.v.state === "INIT" && ggp.members.lhs.v.pointee === grandparentValue) ?
                                    (ggp.members.lhs) :
                                    (ggp.members.rhs)
                                ) : (thisVar.v.members.root));
                        parentValue.members.is_red.v.value = 0;
                        _assert_parent(rt, parentValue);
                        grandparentValue.members.is_red.v.value = 1;
                        // [(n), p=B, ([b?], g=R, [u?])]
                    } else { /* if (grandparent->rhs == parent) */
                        if (parentValue.members.lhs.v.state === "INIT" &&
                            parentValue.members.lhs.v.pointee === nodeValue) {
                            // Case 5b. Parent is red, sibling of parent (uncle) is black or does
                            // not exist, grandparent->key < node->key < parent->key.
                            _rotate_right(rt, parentValue, grandparentValue.members.rhs);
                            nodeValue = parentValue;
                            parentValue = (grandparentValue.members.rhs as __dptr_node).v.pointee;
                            _assert_parent(rt, parentValue);
                        }
                        // Case 6b. Parent is red, sibling of parent (uncle) is black or does
                        // not exist, grandparent->key < parent->key < node->key.
                        const ggp = variables.asInitDirectPointerPointee(grandparentValue.members.parent);
                        _rotate_left(
                            rt,
                            grandparentValue,
                            (ggp !== null) ?
                                ((ggp.members.lhs.v.state === "INIT" && ggp.members.lhs.v.pointee === grandparentValue) ?
                                    (ggp.members.lhs) :
                                    (ggp.members.rhs)
                                ) : (thisVar.v.members.root));
                        parentValue.members.is_red.v.value = 0;
                        _assert_parent(rt, parentValue);
                        grandparentValue.members.is_red.v.value = 1;
                    }
                    break;
                }
                _assert_parent(rt, uncle);
                // Case 2. Parent is red, uncle is red.
                parentValue.members.is_red.v.value = 0;
                uncle.members.is_red.v.value = 0;
                grandparentValue.members.is_red.v.value = 1;
                nodeValue = grandparentValue;
                _assert_parent(rt, nodeValue);
                const node_parent = variables.asInitDirectPointerPointee(nodeValue.members.parent);
                if (node_parent === null) {
                    // Case 3. Grandparent of the last iteration (now node) is the root node.
                    break;
                } else {
                    parentValue = node_parent;
                    _assert_parent(rt, parentValue);
                }
            }
            return [yield* _find(rt, thisVar, value), true];
        }

        function _begin(thisVar: __set): __set_iter {
            return _createSetIterVarFromRoot(_createSetIterType(thisVar.t.templateSpec), thisVar.v.members.root);
        }

        function _end(thisVar: __set): __set_iter {
            return _createSetIterVar(_createSetIterType(thisVar.t.templateSpec));
        }

        function _erase(rt: CRuntime, thisVar: __set, pos: __set_iter): __set_iter {
            const node: __node['v'] | null = variables.asInitDirectPointerPointee(pos.v.members.node);
            if (node === null) {
                return _end(thisVar);
            }
            let next = variables.clone(rt, pos, "SELF", false, true);
            _iter_next(next);
            let parent: __node['v'] | null = variables.asInitDirectPointerPointee(node.members.parent);
            const lhs: __node['v'] | null = variables.asInitDirectPointerPointee(node.members.lhs);
            const rhs: __node['v'] | null = variables.asInitDirectPointerPointee(node.members.rhs);
            node.members.lhs.v.state = "UNINIT";
            node.members.rhs.v.state = "UNINIT";
            if (lhs !== null && rhs !== null) {
                // if node->rhs exists, then the next node also exists.
                const nextNode: __dptr_node = next.v.members.node as __dptr_node;
                // swap
                // safe since the lvHolder of both variables are SELF
                const t = node.members.key;
                node.members.key = nextNode.v.pointee.members.key;
                nextNode.v.pointee.members.key = t;
                variables.directPointerAssignValue(rt, node.members.lhs, lhs);
                variables.directPointerAssignValue(rt, node.members.rhs, rhs);
                return _erase(rt, thisVar, next);
            } else if (lhs !== null && rhs === null) {
                if (parent === null) {
                    variables.directPointerAssignValue(rt, thisVar.v.members.root, lhs);
                    lhs.members.parent.v.state = "UNINIT";
                } else if (node === variables.asInitDirectPointerPointee(parent.members.lhs)) {
                    variables.directPointerAssignValue(rt, parent.members.lhs, lhs);
                    variables.directPointerAssignValue(rt, lhs.members.parent, parent);
                } else {
                    variables.directPointerAssignValue(rt, parent.members.rhs, lhs);
                    variables.directPointerAssignValue(rt, lhs.members.parent, parent);
                }
                lhs.members.is_red.v.value = 0;
                thisVar.v.members._size.v.value--;
                _node_delete(node);
            } else if (lhs === null && rhs !== null) {
                if (parent === null) {
                    variables.directPointerAssignValue(rt, thisVar.v.members.root, rhs);
                    rhs.members.parent.v.state = "UNINIT";
                } else if (node === variables.asInitDirectPointerPointee(parent.members.lhs)) {
                    variables.directPointerAssignValue(rt, parent.members.lhs, rhs);
                    variables.directPointerAssignValue(rt, rhs.members.parent, parent);
                } else {
                    variables.directPointerAssignValue(rt, parent.members.rhs, rhs);
                    variables.directPointerAssignValue(rt, rhs.members.parent, parent);
                }
                rhs.members.is_red.v.value = 0;
                thisVar.v.members._size.v.value--;
                _node_delete(node);
            } else if (parent === null) {
                thisVar.v.members.root.v.state = "UNINIT";
                thisVar.v.members._size.v.value--;
                _node_delete(node);
            } else if (node.members.is_red.v.value === 1) {
                if (node === variables.asInitDirectPointerPointee(parent.members.lhs)) {
                    parent.members.lhs.v.state = "UNINIT";
                } else {
                    parent.members.rhs.v.state = "UNINIT";
                }
                thisVar.v.members._size.v.value--;
                _node_delete(node);
            } else {
                let dir_lhs: boolean = node === variables.asInitDirectPointerPointee(parent.members.lhs);
                if (dir_lhs) {
                    parent.members.lhs.v.state = "UNINIT";
                } else {
                    parent.members.rhs.v.state = "UNINIT";
                }
                thisVar.v.members._size.v.value--;
                _node_delete(node);
                // rebalance
                let c: number = 1;
                let sibling: __node['v'];
                let close_nephew: __node['v'] | null;
                let distant_nephew: __node['v'] | null;
                for (; ;) {
                    if (dir_lhs) {
                        // I just assume at this point
                        sibling = (parent.members.rhs as __dptr_node).v.pointee;
                        close_nephew = variables.asInitDirectPointerPointee(sibling.members.lhs);
                        distant_nephew = variables.asInitDirectPointerPointee(sibling.members.rhs);
                    } else {
                        sibling = (parent.members.lhs as __dptr_node).v.pointee;
                        close_nephew = variables.asInitDirectPointerPointee(sibling.members.rhs);
                        distant_nephew = variables.asInitDirectPointerPointee(sibling.members.lhs);
                    }
                    if (sibling.members.is_red.v.value === 1) {
                        // Case 3.
                        const gp: __node['v'] | null = variables.asInitDirectPointerPointee(parent.members.parent);
                        const p_ref: PointerVariable<__node> =
                            (gp !== null) ? ((variables.asInitDirectPointerPointee(gp.members.lhs) === parent) ? gp.members.lhs : gp.members.rhs)
                                : thisVar.v.members.root;
                        if (dir_lhs) {
                            _rotate_left(rt, parent, p_ref);
                        } else {
                            _rotate_right(rt, parent, p_ref);
                        }
                        parent.members.is_red.v.value = 1;
                        sibling.members.is_red.v.value = 0;
                        // I assume here as well
                        sibling = close_nephew as __node['v'];
                        distant_nephew = variables.asInitDirectPointerPointee((dir_lhs) ? sibling.members.rhs : sibling.members.lhs);
                        close_nephew = variables.asInitDirectPointerPointee((dir_lhs) ? sibling.members.lhs : sibling.members.rhs);
                        if (distant_nephew !== null && distant_nephew.members.is_red.v.value === 1) {
                            // Case 6.
                            c = 6;
                            break;
                        } else if (close_nephew !== null && close_nephew.members.is_red.v.value === 1) {
                            // Case 5.
                            c = 5;
                            break;
                        } else {
                            // Case 4.
                            c = 4;
                            break;
                        }
                    }
                    if (distant_nephew !== null && distant_nephew.members.is_red.v.value === 1) {
                        // Case 6.
                        c = 6;
                        break;
                    } else if (close_nephew !== null && close_nephew.members.is_red.v.value === 1) {
                        // Case 5.
                        c = 5;
                        break;
                    }
                    if (parent.members.is_red.v.value === 1) {
                        // Case 4.
                        c = 4;
                        break;
                    }
                    // Case 2.
                    sibling.members.is_red.v.value = 1;
                    const parent_parent: __node['v'] | null = variables.asInitDirectPointerPointee(parent.members.parent);
                    if (parent_parent === null) {
                        break;
                    } else {
                        dir_lhs = parent === variables.asInitDirectPointerPointee(parent_parent.members.lhs);
                        parent = parent_parent;
                    }
                }
                switch (c) {
                    case 1:
                        // pass
                        break;
                    case 4:
                        sibling.members.is_red.v.value = 1;
                        parent.members.is_red.v.value = 0;
                        break;
                    case 5:
                        if (dir_lhs) {
                            _rotate_right(rt, sibling, parent.members.rhs);
                        } else {
                            _rotate_left(rt, sibling, parent.members.lhs);
                        }
                        sibling.members.is_red.v.value = 1;
                        // close_nephew is non-null if triggered Case 5.;
                        (close_nephew as __node['v']).members.is_red.v.value = 0;
                        distant_nephew = sibling;
                        sibling = (close_nephew as __node['v']);
                        break;
                }
                if (c === 5 || c === 6) {
                    const gp: __node['v'] | null = variables.asInitDirectPointerPointee(parent.members.parent);
                    const p_ref: PointerVariable<__node> =
                        (gp !== null) ? ((variables.asInitDirectPointerPointee(gp.members.lhs) === parent) ? gp.members.lhs : gp.members.rhs)
                            : thisVar.v.members.root;
                    if (dir_lhs) {
                        _rotate_left(rt, parent, p_ref);
                    } else {
                        _rotate_right(rt, parent, p_ref);
                    }
                    sibling.members.is_red.v.value = parent.members.is_red.v.value;
                    parent.members.is_red.v.value = 0;
                    (distant_nephew as __node['v']).members.is_red.v.value = 0;
                }
            }
            return next;
        }

        // debug function
        common.regGlobalFuncs(rt, [{
            op: "_set_int_print_tree",
            type: "FUNCTION VOID ( CLREF CLASS set < I32 > )",
            default(rt: CRuntime, _templateTypes: ObjectType[], set: SetVariable<InitArithmeticNumVariable>): "VOID" {
                const stdio = rt.stdio();
                function _set_int_print_tree_inner(node: SetNodeValue<InitArithmeticNumVariable>, shift: number): void {
                    const lhs = variables.asInitDirectPointerPointee(node.members.lhs);
                    if (lhs !== null) {
                        _set_int_print_tree_inner(lhs, shift + 1);
                    }
                    stdio.write(`${" ".repeat(shift)}${((node.members.is_red.v.value === 1) ? "R" : "B")}:${node.members.key.v.value}\n`);
                    const rhs = variables.asInitDirectPointerPointee(node.members.rhs);
                    if (rhs !== null) {
                        _set_int_print_tree_inner(rhs, shift + 1);
                    }
                }
                const root = variables.asInitDirectPointerPointee(set.v.members.root);
                if (root !== null) {
                    _set_int_print_tree_inner(root, 0);
                } else {
                    stdio.write("<empty set>");
                }
                stdio.write("\n");
                return "VOID";
            }
        }]);

        common.regMemberFuncs(rt, "set", [
            {
                op: "begin",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set) {
                    return _begin(thisVar);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set) {
                    return _end(thisVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION CLASS pair < CLASS set_iterator < ?0 > BOOL > ( LREF CLASS set < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, value: Variable): Gen<PairVariable<__set_iter, InitArithmeticNumVariable>> {
                    const result = yield* _insert(rt, thisVar, value);
                    return {
                        t: {
                            sig: "CLASS",
                            identifier: "pair",
                            memberOf: null,
                            templateSpec: [
                                _createSetIterType(thisVar.t.templateSpec),
                                { sig: "BOOL" }
                            ]
                        },
                        v: {
                            isConst: false,
                            lvHolder: null,
                            state: "INIT",
                            members: {
                                first: result[0],
                                second: {
                                    t: { sig: "BOOL" },
                                    v: {
                                        isConst: false,
                                        lvHolder: null,
                                        state: "INIT",
                                        value: result[0] ? 1 : 0
                                    }
                                }
                            }
                        }
                    };
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set < ?0 > CLASS set_iterator < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, _pos: __set_iter, value: Variable) {
                    // same as above, ignoring the 'pos' argument, 
                    // returning iterator only
                    return (yield* _insert(rt, thisVar, value))[0];
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > CLASS set_iterator < ?0 > ?1 ?1 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, first: Variable, last: Variable): Gen<"VOID"> {
                    const eqFunc = rt.getOpByParams("{global}", "o(_==_)", [first, last], []);
                    const ppFunc = rt.getOpByParams("{global}", "o(_++)", [first], []);
                    const derefFunc = rt.getOpByParams("{global}", "o(*_)", [first], []);
                    const firstTypeString = rt.makeTypeString(first.t);
                    const setValueTypeString = rt.makeTypeString(thisVar.t.templateSpec[0]);
                    while (!(yield* common.invokeCmp(rt, eqFunc, first, last))) {
                        const derefObject = yield* common.invokeDeref(rt, firstTypeString, derefFunc, first);
                        if (!variables.typesEqual(derefObject.t, thisVar.t.templateSpec[0])) {
                            rt.raiseException(`set<${setValueTypeString}>::insert(): Expected type of (*first) to be ${setValueTypeString}, got ${rt.makeTypeString(derefObject.t)}`);
                        }
                        yield* _insert(rt, thisVar, derefObject);
                        common.invokePp(rt, firstTypeString, ppFunc, first);
                    }
                    return "VOID";
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, list: InitializerListVariable<Variable>): Gen<"VOID"> {
                    const listmem = list.v.members._values.v.pointee;

                    let lastInserted: __set_iter | null = null;
                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                        const iterator = (yield* _insert(rt, thisVar, currentValue))[0];
                        lastInserted = iterator;
                    }

                    return "VOID";
                }
            },
            {
                op: "erase",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set < ?0 > CLASS set_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, pos: __set_iter): __set_iter {
                    return _erase(rt, thisVar, pos);
                }
            },
            {
                op: "erase",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set < ?0 > ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, key: Variable): Gen<__set_iter> {
                    const pos = yield* _find(rt, thisVar, key);
                    return _erase(rt, thisVar, pos);
                }
            },
            {
                op: "find",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS set < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, key: Variable): Gen<__set_iter> {
                    return yield* _find(rt, thisVar, key);
                }
            },
            {
                op: "count",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as __set;
                    const value = args[1];
                    const found = _find(rt, setVar, value);
                    return variables.arithmeticNum("I32", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "contains",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as __set;
                    const value = args[1];
                    const found = _find(rt, setVar, value);
                    return variables.arithmeticNum("BOOL", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I64 ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): InitArithmeticBigVariable {
                    return variables.arithmeticBig("I64", thisVar.v.members._size.v.value, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): InitArithmeticNumVariable {
                    return variables.arithmeticNum("BOOL", (thisVar.v.members._size.v.value === BigInt(0)) ? 1 : 0, null, false);
                }
            },
            {
                op: "_assert_rb",
                type: "!ParamObject FUNCTION VOID ( CLREF CLASS set < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): "VOID" {
                    const root = variables.asInitDirectPointer2(thisVar.v.members.root);
                    if (root !== null && !_assert_rb(rt, root)) {
                        rt.raiseException("std::set<Key>::_assert_rb(): Red-black tree integrity assertion failed");
                    }
                    return "VOID"
                }
            },
            {
                op: "clear",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): "VOID" {
                    const root: __dptr_node | null = variables.asInitDirectPointer2(thisVar.v.members.root);
                    if (root !== null) {
                        _node_delete(root.v.pointee);
                        delete (root.v as any).pointee;
                        (root.v as any).state = "UNINIT";
                        thisVar.v.members._size.v.value = BigInt(0);
                    }
                    return "VOID";
                }
            },
        ])
    }
};
