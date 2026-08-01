import { InitializerListVariable } from "../initializer_list";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
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

        function _createSetNodeMembers(setIterType: __set_node['t'], key: Variable, is_red: boolean): __set_node['v']['members'] {
            const ptrType = { sig: "PTR" as "PTR", pointee: setIterType, sizeConstraint: null };
            return {
                lhs: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                rhs: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                parent: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                is_red: { t: { sig: "BOOL" }, v: { lvHolder: "SELF", state: "INIT", value: (is_red) ? 1 : 0, isConst: false } },
                key
            };
        }

        function* _createSetNodeMembersDefault(setIterType: __set_node['t']): Gen<__set_node['v']['members']> {
            const default_key: Variable = yield* rt.defaultValue2(setIterType.templateSpec[0], "SELF");
            return _createSetNodeMembers(setIterType, default_key, false);
        }

        function _createSetNodeVar(setIterType: __set_node['t'], key: Variable, is_red: boolean): __set_node {
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

        function _node_delete(thisVal: __set_node['v']): void {
            if (thisVal.members.lhs.v.state !== "UNINIT") {
                _node_delete((thisVal.members.lhs as __dptr_node).v.pointee);
                delete (thisVal.members.lhs.v as any).pointee;
                (thisVal.members.lhs.v as any).lvHolder = "UNBOUND";
                delete (thisVal.members as any).lhs;
                (thisVal as any).lvHolder = "UNBOUND";
            }
            if (thisVal.members.rhs.v.state !== "UNINIT") {
                _node_delete((thisVal.members.rhs as __dptr_node).v.pointee);
                delete (thisVal.members.lhs.v as any).pointee;
                (thisVal.members.lhs.v as any).lvHolder = "UNBOUND";
                delete (thisVal.members as any).rhs;
                (thisVal as any).lvHolder = "UNBOUND";
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
            let node: __dptr_node | null = variables.asInitDirectPointer2(thisVar.v.members.node);
            if (node === null) {
                return "VOID";
            }
            const rhs: __dptr_node | null = variables.asInitDirectPointer2(node.v.pointee.members.rhs);
            if (rhs !== null) {
                node.v = rhs.v;
                let lhs: __dptr_node | null = variables.asInitDirectPointer2(node.v.pointee.members.lhs);
                while (lhs !== null) {
                    node.v = lhs.v;
                    lhs = variables.asInitDirectPointer2(node.v.pointee.members.lhs);
                }
            } else {
                for (; ;) {
                    const parent: __dptr_node | null = variables.asInitDirectPointer2(node.v.pointee.members.parent);
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

        function _assert_parent(rt: CRuntime, node: __set_node['v']) {
            const parent = variables.asInitDirectPointer2(node.members.parent);
            const assertion = (parent === null) ||
                (parent.v.pointee.members.lhs.v.state === "INIT" && (parent.v.pointee.members.lhs as __dptr_node).v.pointee === node) ||
                (parent.v.pointee.members.rhs.v.state === "INIT" && (parent.v.pointee.members.rhs as __dptr_node).v.pointee === node);
            if (!assertion) {
                rt.raiseException("std::set<Key>: Parent rule assertion failed");
            }
        }

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
            const b_dptr = variables.asInitDirectPointer2(b);
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
            variables.directPointerAssignValue(rt, g.v.pointee.members.parent, p.v.pointee);
            // ; p->parent = ggp;
            const ggp_dptr = variables.asInitDirectPointer2(ggp);
            if (ggp_dptr === null) {
                p.v.pointee.members.parent.v.state = "UNINIT";
            } else {
                variables.directPointerAssignValue(rt, p.v.pointee.members.parent, ggp_dptr.v.pointee);
            }
            // ; *g_ref = p;
            variables.directPointerAssignValue(rt, g_ref, p.v.pointee);
            _assert_parent(rt, p.v.pointee);
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
            const b_dptr = variables.asInitDirectPointer2(b);
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
            variables.directPointerAssignValue(rt, g.v.pointee.members.parent, p.v.pointee);
            // ; p->parent = ggp;
            const ggp_dptr = variables.asInitDirectPointer2(ggp);
            if (ggp_dptr === null) {
                p.v.pointee.members.parent.v.state = "UNINIT";
            } else {
                variables.directPointerAssignValue(rt, p.v.pointee.members.parent, ggp_dptr.v.pointee);
            }
            // ; *g_ref = p;
            variables.directPointerAssignValue(rt, g_ref, p.v.pointee);
            _assert_parent(rt, p.v.pointee);
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

        function* _insert(rt: CRuntime, thisVar: __set, value: Variable): Gen<__set_iter> {
            const nodeType = _createSetNodeType(thisVar.t.templateSpec);
            if (thisVar.v.members.root.v.state === "UNINIT") {
                const iterType = _createSetIterType(thisVar.t.templateSpec);
                const rootNode = _createSetNodeVar(nodeType, variables.clone(rt, value, "SELF"), false);
                variables.directPointerAssignValue(rt, thisVar.v.members.root, rootNode.v);
                thisVar.v.members._size.v.value++;
                return _createSetIterVarFromRoot(iterType, thisVar.v.members.root);
            }
            let parent: __dptr_node = thisVar.v.members.root as __dptr_node;
            let node = variables.directPointer(_createSetNodeVar(nodeType, variables.clone(rt, value, "SELF"), true), "SELF", false);
            const ltInst = rt.getOpByParams("{global}", "o(_<_)", [value, value], []);
            for (; ;) {
                if (yield* common.invokeCmp(rt, ltInst, parent.v.pointee.members.key, value)) {
                    if (parent.v.pointee.members.rhs.v.state === "INIT") {
                        parent = parent.v.pointee.members.rhs as __dptr_node;
                        continue;
                    } else {
                        variables.directPointerAssignValue(rt, parent.v.pointee.members.rhs, node.v.pointee);
                        variables.directPointerAssignValue(rt, node.v.pointee.members.parent, parent.v.pointee);
                        break;
                    }
                } else {
                    if (parent.v.pointee.members.lhs.v.state === "INIT") {
                        parent = parent.v.pointee.members.lhs as __dptr_node;
                        continue;
                    } else {
                        variables.directPointerAssignValue(rt, parent.v.pointee.members.lhs, node.v.pointee);
                        variables.directPointerAssignValue(rt, node.v.pointee.members.parent, parent.v.pointee);
                        break;
                    }
                }
            }
            _assert_parent(rt, node.v.pointee);
            _assert_parent(rt, parent.v.pointee);
            thisVar.v.members._size.v.value++;
            // ...
            for (; ;) {
                if (parent.v.pointee.members.is_red.v.value === 0) {
                    // Case 1. Parent is black.
                    break;
                }
                // Grandparent is always black, if exists.
                const grandparent: __dptr_node | null = variables.asInitDirectPointer2(parent.v.pointee.members.parent);
                if (grandparent === null) {
                    // Case 4. Parent is red and parent is the root node.
                    parent.v.pointee.members.is_red.v.value = 0;
                    break;
                }
                _assert_parent(rt, grandparent.v.pointee);
                const glhs = variables.asInitDirectPointer2(grandparent.v.pointee.members.lhs);
                const grhs = variables.asInitDirectPointer2(grandparent.v.pointee.members.rhs);
                const uncle: __dptr_node | null = (glhs !== null && glhs.v.pointee === parent.v.pointee) ? grhs : glhs;
                if (uncle === null || uncle.v.pointee.members.is_red.v.value === 0) {
                    if (grandparent.v.pointee.members.lhs.v.state === "INIT" &&
                        grandparent.v.pointee.members.lhs.v.pointee === parent.v.pointee) {
                        if (parent.v.pointee.members.rhs.v.state === "INIT" &&
                            parent.v.pointee.members.rhs.v.pointee === node.v.pointee) {
                            // Case 5a. Parent is red, sibling of parent (uncle) is black or does
                            // not exist, parent->key < node->key < grandparent->key.
                            // [([b?], p=R, (n)), g=B, [u?]]
                            // Rotate left
                            // [(([b?], p=R, .), n=R, .), g=B, [u?]]
                            _rotate_left(rt, parent, grandparent.v.pointee.members.lhs);
                            node = parent;
                            parent = grandparent.v.pointee.members.lhs as __dptr_node;
                            _assert_parent(rt, parent.v.pointee);
                            // [(([b?], n=R, .), p=R, .), g=B, [u?]]
                        }
                        // Case 6a. Parent is red, sibling of parent (uncle) is black or does
                        // not exist, node->key < parent->key < grandparent->key.
                        // [((n), p=R, [b?]), g=B, [u?]]
                        // Rotate right
                        // ((n), p=R, [[b?], g=B, [u?]])
                        // Recolour
                        const ggp = variables.asInitDirectPointer2(grandparent.v.pointee.members.parent);
                        _rotate_right(
                            rt,
                            grandparent,
                            (ggp !== null) ?
                                ((ggp.v.pointee.members.lhs.v.state === "INIT" && ggp.v.pointee.members.lhs.v.pointee === grandparent.v.pointee) ?
                                    (ggp.v.pointee.members.lhs) :
                                    (ggp.v.pointee.members.rhs)
                                ) : (thisVar.v.members.root));
                        parent.v.pointee.members.is_red.v.value = 0;
                        _assert_parent(rt, parent.v.pointee);
                        grandparent.v.pointee.members.is_red.v.value = 1;
                        // [(n), p=B, ([b?], g=R, [u?])]
                    } else { /* if (grandparent->rhs == parent) */
                        if (parent.v.pointee.members.lhs.v.state === "INIT" &&
                            parent.v.pointee.members.lhs.v.pointee === node.v.pointee) {
                            // Case 5b. Parent is red, sibling of parent (uncle) is black or does
                            // not exist, grandparent->key < node->key < parent->key.
                            _rotate_right(rt, parent, grandparent.v.pointee.members.rhs);
                            node = parent;
                            parent = grandparent.v.pointee.members.rhs as __dptr_node;
                            _assert_parent(rt, parent.v.pointee);
                        }
                        // Case 6b. Parent is red, sibling of parent (uncle) is black or does
                        // not exist, grandparent->key < parent->key < node->key.
                        const ggp = variables.asInitDirectPointer2(grandparent.v.pointee.members.parent);
                        _rotate_left(
                            rt,
                            grandparent,
                            (ggp !== null) ?
                                ((ggp.v.pointee.members.lhs.v.state === "INIT" && ggp.v.pointee.members.lhs.v.pointee === grandparent.v.pointee) ?
                                    (ggp.v.pointee.members.lhs) :
                                    (ggp.v.pointee.members.rhs)
                                ) : (thisVar.v.members.root));
                        parent.v.pointee.members.is_red.v.value = 0;
                        _assert_parent(rt, parent.v.pointee);
                        grandparent.v.pointee.members.is_red.v.value = 1;
                    }
                    break;
                }
                _assert_parent(rt, uncle.v.pointee);
                // Case 2. Parent is red, uncle is red.
                parent.v.pointee.members.is_red.v.value = 0;
                uncle.v.pointee.members.is_red.v.value = 0;
                grandparent.v.pointee.members.is_red.v.value = 1;
                node = grandparent;
                _assert_parent(rt, node.v.pointee);
                const node_parent = variables.asInitDirectPointer2(node.v.pointee.members.parent);
                if (node_parent === null) {
                    // Case 3. Grandparent of the last iteration (now node) is the root node.
                    break;
                } else {
                    parent = node_parent;
                    _assert_parent(rt, parent.v.pointee);
                }
            }
            return yield* _find(rt, thisVar, value);
        }

        function _begin(thisVar: __set): __set_iter {
            return _createSetIterVarFromRoot(_createSetIterType(thisVar.t.templateSpec), thisVar.v.members.root);
        }

        function _end(thisVar: __set): __set_iter {
            return _createSetIterVar(_createSetIterType(thisVar.t.templateSpec));
        }

        function _erase(rt: CRuntime, _setVar: __set, _pos: __set_iter): __set_iter {
            rt.raiseException("std::set<Key>::erase(): Not yet implemented");
        }

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
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set < ?0 > CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, list: InitializerListVariable<Variable>): Gen<__set_iter> {
                    const listmem = list.v.members._values.v.pointee;

                    let lastInserted: __set_iter | null = null;
                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                        const iterator = yield* _insert(rt, thisVar, currentValue);
                        lastInserted = iterator;
                    }

                    return (lastInserted !== null) ? lastInserted : _end(thisVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, value: Variable): Gen<__set_iter> {
                    return yield* _insert(rt, thisVar, value);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set < ?0 > CLASS set_iterator < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, _pos: __set_iter, value: Variable) {
                    // same as above, ignoring the iterator
                    return yield* _insert(rt, thisVar, value);
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set < ?0 > CLASS set_iterator < ?0 > CLASS set_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], _thisVar: __set, _begin: __set_iter, _end: __set_iter): "VOID" {
                    rt.raiseException("std::set<Key>::insert(): Not yet implemented");
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
                op: "find",
                type: "!ParamObject FUNCTION PTR ?0 ( CLREF CLASS set < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const setVar = args[0] as __set;
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
