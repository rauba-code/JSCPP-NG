import { InitializerListVariable } from "../initializer_list";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { PairVariable } from "../shared/utility";
import { Variable, variables, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, PointerVariable, InitArithmeticNumVariable, InitDirectPointerVariable, InitArithmeticBigVariable, LValueHolder, TrueDirectPointerVariable } from "../variables";


interface SetNodeType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "set_node",
}

type SetNodeVariable<T extends Variable> = AbstractVariable<SetNodeType<T["t"]>, SetNodeValue<T>>;

interface SetNodeValue<T extends Variable> extends InitValue<SetNodeVariable<T>> {
    members: {
        "lhs": InitDirectPointerVariable<SetNodeVariable<T>>,
        "rhs": InitDirectPointerVariable<SetNodeVariable<T>>,
        "parent": InitDirectPointerVariable<SetNodeVariable<T>>,
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
        "node": InitDirectPointerVariable<SetNodeVariable<T>>,
        "last": InitDirectPointerVariable<SetNodeVariable<T>>,
    }
}


interface SetType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "set",
}

type SetVariable<T extends Variable> = AbstractVariable<SetType<T["t"]>, SetValue<T>>;

interface SetValue<T extends Variable> extends InitValue<SetVariable<T>> {
    members: {
        "root": InitDirectPointerVariable<SetNodeVariable<T>>,
        "_size": InitArithmeticBigVariable,
    }
}

export = {
    load(rt: CRuntime) {
        //rt.include("iterator")
        rt.include("cstddef");
        rt.include("utility"); // pair

        type __set = SetVariable<Variable>;
        type __node = SetNodeVariable<Variable>;
        type __set_iter = SetIteratorVariable<Variable>;
        type __ptr_node = InitDirectPointerVariable<__node>;
        type __tptr_node = TrueDirectPointerVariable<__node>;

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

        function _createSetNodeMembers(setIterType: __node['t'], key: Variable, is_red: boolean): __node['members'] {
            const ptrType = { sig: "PTR" as "PTR", pointee: setIterType, sizeConstraint: null };
            return {
                lhs: { t: ptrType, lvHolder: "SELF", state: "INIT", subtype: "DIRECT", pointee: null, isConst: false },
                rhs: { t: ptrType, lvHolder: "SELF", state: "INIT", subtype: "DIRECT", pointee: null, isConst: false },
                parent: { t: ptrType, lvHolder: "SELF", state: "INIT", subtype: "DIRECT", pointee: null, isConst: false },
                is_red: { t: { sig: "BOOL" }, lvHolder: "SELF", state: "INIT", value: (is_red) ? 1 : 0, isConst: false },
                key
            };
        }

        function* _createSetNodeMembersDefault(setIterType: __node['t']): Gen<__node['members']> {
            const default_key: Variable = yield* rt.defaultValue2(setIterType.templateSpec[0], "SELF");
            return _createSetNodeMembers(setIterType, default_key, false);
        }

        function _createSetNodeVar(setIterType: __node['t'], key: Variable, is_red: boolean): __node {
            return {
                t: setIterType,
                isConst: false,
                state: "INIT",
                lvHolder: "SELF",
                members: _createSetNodeMembers(setIterType, key, is_red)
            };
        }

        rt.defineStruct2("{global}", "set_node", {
            numTemplateArgs: 1, factory: _createSetNodeMembersDefault
        }, ["lhs", "rhs", "parent", "is_red", "key"], {});

        function _node_delete(thisVal: __node): void {
            if (thisVal.members.lhs.pointee === null) {
                _ptr_node_delete((thisVal.members.lhs as __tptr_node));
                (thisVal as any).lvHolder = "UNBOUND";
            }
            if (thisVal.members.rhs.pointee === null) {
                _ptr_node_delete((thisVal.members.rhs as __tptr_node));
                (thisVal as any).lvHolder = "UNBOUND";
            }
        }

        function _ptr_node_delete(thisVal: __tptr_node): void {
            _node_delete(thisVal.pointee);
            delete (thisVal as any).pointee;
            (thisVal as any).lvHolder = "UNBOUND";
        }

        function _leftmost_child(node: __node): __node {
            for (; ;) {
                const child = variables.asInitDirectPointerPointee(node.members.lhs);
                if (child !== null) {
                    node = child;
                } else {
                    break;
                }
            }
            return node;
        }

        function _rightmost_child(node: __node): __node {
            for (; ;) {
                const child = variables.asInitDirectPointerPointee(node.members.rhs);
                if (child !== null) {
                    node = child;
                } else {
                    break;
                }
            }
            return node;
        }

        // --
        // -- set_iterator
        // --

        function _createSetIterMembers(nodeType: __node['t'], node: __node | null, last: __node | null): __set_iter['members'] {
            return {
                node: (node !== null) ? {
                    t: {
                        sig: "PTR",
                        sizeConstraint: null,
                        pointee: nodeType
                    },
                    lvHolder: "SELF",
                    state: "INIT",
                    subtype: "DIRECT",
                    isConst: false,
                    pointee: node
                } : variables.uninitPointer(nodeType, null, "SELF") as __ptr_node,
                last: (last !== null) ? {
                    t: {
                        sig: "PTR",
                        sizeConstraint: null,
                        pointee: nodeType
                    },
                    lvHolder: "SELF",
                    state: "INIT",
                    subtype: "DIRECT",
                    isConst: false,
                    pointee: last
                } : variables.uninitPointer(nodeType, null, "SELF") as __ptr_node,
            };
        }

        function _createSetIterVar(setIterType: __set_iter['t'], setNodeType: __node['t'], node: __node | null, last: __node | null): __set_iter {
            return {
                t: setIterType,
                isConst: false,
                state: "INIT",
                lvHolder: "SELF",
                members: _createSetIterMembers(setNodeType, node, last)
            };
        }

        // const setIteratorSig = "!ParamObject CLASS set_iterator < ?0 >".split(" ");
        rt.defineStruct2("{global}", "set_iterator", {
            numTemplateArgs: 1, factory(iterType: __node['t']): __set_iter['members'] {
                return _createSetIterMembers(_createSetNodeType(iterType.templateSpec), null, null);
            }
        }, ["node"], {
            // ["value_type"]: [{ src: setIteratorSig, dst: ["?0"]}],
            // ["pointer"]: [{ src: setIteratorSig, dst: ["PTR", "?0"]}],
            // ["reference"]: [{ src: setIteratorSig, dst: ["LREF", "?0"]}],
        });

        function _iter_advance(thisVar: __set_iter, forward: boolean): "VOID" {
            let node: __ptr_node = thisVar.members.node;
            const into: "lhs" | "rhs" = (forward) ? "rhs" : "lhs";
            const from: "lhs" | "rhs" = (forward) ? "lhs" : "rhs";
            if (node.pointee === null) {
                const last = variables.asInitDirectPointerPointee(thisVar.members.last);
                if (last !== null) {
                    thisVar.members.node.pointee = last;
                } else {
                    // pass
                }
                return "VOID";
            }
            thisVar.members.last.pointee = node.pointee;
            let child: __node | null = variables.asInitDirectPointerPointee(node.pointee.members[into]);
            if (child !== null) {
                node.pointee = child;
                child = variables.asInitDirectPointerPointee(child.members[from]);
                while (child !== null) {
                    node.pointee = child;
                    child = variables.asInitDirectPointerPointee(child.members[from]);
                }
            } else {
                for (; ;) {
                    const parent: __node | null = variables.asInitDirectPointerPointee(node.pointee.members.parent);
                    if (parent === null) {
                        node = { t: node.t, isConst: false, state: "INIT", subtype: "DIRECT", pointee: null, lvHolder: "SELF" };
                        break;
                    }
                    if (parent.members[from].pointee !== null &&
                        node.pointee === (parent.members[from] as __tptr_node).pointee) {
                        node.pointee = parent;
                        break;
                    }
                    node.pointee = parent;
                }
            }
            return "VOID";
        }

        common.regOps(rt, [
            {
                op: "o(*_)",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS set_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __set_iter): Variable {
                    if (thisVar.members.node.pointee !== null) {
                        return (thisVar.members.node as __tptr_node).pointee.members.key;
                    }
                    rt.raiseException("set_iterator::operator*(): Attempted dereference of a null-iterator");
                }
            },
            {
                op: "o(++_)",
                type: "!ParamObject FUNCTION LREF CLASS set_iterator < ?0 > ( LREF CLASS set_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], thisVar: __set_iter): __set_iter {
                    _iter_advance(thisVar, true);
                    return thisVar;
                }
            },
            {
                op: "o(_++)",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __set_iter): __set_iter {
                    const thatVar = variables.clone(rt, thisVar, null, false);
                    _iter_advance(thisVar, true);
                    return thatVar;
                }
            },
            {
                op: "o(--_)",
                type: "!ParamObject FUNCTION LREF CLASS set_iterator < ?0 > ( LREF CLASS set_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], thisVar: __set_iter): __set_iter {
                    _iter_advance(thisVar, false);
                    return thisVar;
                }
            },
            {
                op: "o(_--)",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( LREF CLASS set_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __set_iter): __set_iter {
                    const thatVar = variables.clone(rt, thisVar, null, false);
                    _iter_advance(thisVar, false);
                    return thatVar;
                }
            },
            {
                op: "o(_==_)",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set_iterator < ?0 > CLREF CLASS set_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], lhs: __set_iter, rhs: __set_iter): InitArithmeticNumVariable {
                    const isEq: boolean = (lhs.members.node.pointee === null) ? (rhs.members.node.pointee === null) : (lhs === rhs);
                    return variables.arithmeticNum("BOOL", isEq ? 1 : 0, null);
                }
            },
            {
                op: "o(_!=_)",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set_iterator < ?0 > CLREF CLASS set_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], lhs: __set_iter, rhs: __set_iter): InitArithmeticNumVariable {
                    const isEq: boolean = (lhs.members.node.pointee === null) ? (rhs.members.node.pointee === null) : (lhs === rhs);
                    return variables.arithmeticNum("BOOL", isEq ? 0 : 1, null);
                }
            },

        ])

        // --
        // -- set
        // --

        /*function _createSetType(templateSpec: [ObjectType]): __set['t'] {
            return {
                sig: "CLASS",
                identifier: "set",
                memberOf: null,
                templateSpec
            };
        }*/

        function _createSetMembers(setType: SetType<ObjectType>): __set['members'] {
            return {
                root: variables.uninitPointer(_createSetNodeType(setType.templateSpec), null, "SELF") as __ptr_node,
                _size: variables.arithmeticBig("U64", BigInt(0), "SELF"),
            }
        }

        function _createSetVar(setType: SetType<ObjectType>, lvHolder: LValueHolder<__set>): __set {
            return {
                t: setType,
                isConst: false,
                lvHolder,
                state: "INIT",
                members: _createSetMembers(setType)
            };
        }

        const setSig = "!ParamObject CLASS set < ?0 >".split(" ");
        rt.defineStruct2("{global}", "set", { numTemplateArgs: 1, factory: _createSetMembers }, ["_data", "_sz", "_cap"], {
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
            *default(rt: CRuntime, templateTypes: [__set['t']], list: InitializerListVariable<Variable>): Gen<__set> {
                const setVar = _createSetVar(templateTypes[0], null);
                const listmem = list.members._values.pointee;

                for (let i = 0; i < listmem.values.length; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable);
                    yield* _insert(rt, setVar, currentValue);
                }

                return setVar;
            }
        };

        const ctorHandler2: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS set < ?0 > ( PTR ?0 PTR ?0 )",
            *default(rt: CRuntime, templateTypes: [__set['t']], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<__set> {
                const begin = variables.asTrueIndexPointer(_begin) ?? rt.raiseException("set constructor: expected valid begin iterator");
                const end = variables.asTrueIndexPointer(_end) ?? rt.raiseException("set constructor: expected valid end iterator");

                if (begin.pointee !== end.pointee) {
                    rt.raiseException("set constructor: iterators must point to same memory region");
                }

                const setVar = _createSetVar(templateTypes[0], null);

                for (let i = begin.index; i < end.index; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(begin.pointee, i) as MaybeUnboundVariable);
                    yield* _insert(rt, setVar, currentValue);
                }

                return setVar;
            }
        };

        rt.explicitListInitTable["set"] = (setType: SetType<ObjectType>) => setType.templateSpec[0];
        rt.regFunc(ctorHandler1.default, variables.classType("set", [], null), ctorHandler1.op, rt.typeSignature(ctorHandler1.type), [-1], null);
        rt.regFunc(ctorHandler2.default, variables.classType("set", [], null), ctorHandler2.op, rt.typeSignature(ctorHandler2.type), [-1], null);

        common.regOps(rt, [
            {
                op: "o(_=_)",
                type: "!ParamObject FUNCTION CLASS set < ?0 > ( LREF CLASS set < ?0 > CLREF CLASS set < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], lset: __set, rset: __set): __set {
                    _clear(lset);
                    const rr: __node | null = variables.asInitDirectPointerPointee(rset.members.root);
                    if (rr === null) {
                        return lset;
                    }
                    const nodeType: __node['t'] = _createSetNodeType(lset.t.templateSpec);
                    function clone(rn: __node, parent: __node | null): __node {
                        const nn: __node = {
                            t: nodeType,
                            isConst: false,
                            lvHolder: "SELF",
                            state: "INIT",
                            members:
                                _createSetNodeMembers(
                                    nodeType,
                                    variables.clone(rt, rn.members.key, "SELF", false, false),
                                    rn.members.is_red.value === 1
                                ),
                        };
                        if (parent) {
                            nn.members.parent.pointee = parent;
                        }
                        const rlhs = variables.asInitDirectPointerPointee(rn.members.lhs);
                        if (rlhs !== null) {
                            variables.directPointerAssign2(rt, nn.members.lhs, clone(rlhs, nn));
                        }
                        const rrhs = variables.asInitDirectPointerPointee(rn.members.rhs);
                        if (rrhs !== null) {
                            variables.directPointerAssign2(rt, nn.members.rhs, clone(rrhs, nn));
                        }
                        return nn;
                    }
                    variables.directPointerAssign2(rt, lset.members.root, clone(rr, null));
                    lset.members._size.value = rset.members._size.value;
                    return lset;
                },
                isOverrideOf: "!Class FUNCTION ?0 ( LREF ?0 CLREF ?0 )",
            }
        ]);

        function _assert_parent(rt: CRuntime, node: __node) {
            const parent = node.members.parent;
            const assertion = (parent.pointee === null) ||
                (parent.pointee.members.lhs.pointee !== null && (parent.pointee.members.lhs as __tptr_node).pointee === node) ||
                (parent.pointee.members.rhs.pointee !== null && (parent.pointee.members.rhs as __tptr_node).pointee === node);
            if (!assertion) {
                rt.raiseException("std::set<Key>: Parent rule assertion failed");
            }
        }

        function _assert_rb(rt: CRuntime, root: __tptr_node): boolean {
            function _assert_rb_inner(rt: CRuntime, node: __tptr_node): number {
                let depth_lhs = 1;
                let depth_rhs = 1;
                const lhs = node.pointee.members.lhs;
                const rhs = node.pointee.members.rhs;
                const is_red = node.pointee.members.is_red.value;
                if (lhs.pointee !== null) {
                    if (is_red && lhs.pointee.members.is_red.value) {
                        return -1;
                    }
                    depth_lhs = _assert_rb_inner(rt, lhs as __tptr_node);
                }
                if (rhs.pointee !== null) {
                    if (is_red && rhs.pointee.members.is_red.value) {
                        return -1;
                    }
                    depth_rhs = _assert_rb_inner(rt, rhs as __tptr_node);
                }
                if (depth_lhs !== depth_rhs || depth_lhs === -1) {
                    return -1;
                }
                return depth_lhs + ((is_red) ? 0 : 1);
            }
            return _assert_rb_inner(rt, root) !== -1;
        }

        function _rotate_right(rt: CRuntime, g: __node, g_ref: __ptr_node): void {
            // Case 6a.
            // [((n), p=R, [b?]), g=B, [u?]]
            // Rotate right.
            // ((n), p=R, [[b?], g=b, [u?]])
            // ; set_node<Key> *p = g->lhs;
            // ; set_node<Key> *n = p->lhs;      // opt
            // ; set_node<Key> *b = p->rhs;      // opt
            // ; set_node<Key> *ggp = g->parent; // opt

            const p = (g.members.lhs as __tptr_node).pointee;
            const b = variables.asInitDirectPointerPointee(p.members.rhs);
            const ggp = variables.asInitDirectPointerPointee(g.members.parent);
            // ; g->lhs = b;
            if (b === null) {
                g.members.lhs.pointee = null;
            } else {
                // because b_dptr is an init direct pointer
                (g.members.lhs as __tptr_node).pointee = b;
            }
            // ; if (b) {
            // ;   b->parent = g;
            // ; }
            if (b !== null) {
                b.members.parent.pointee = g;
            }
            // ((n), p=R, !)    [[b?], g=B, [u?]]
            // g->rhs and u?->parent do not change
            // p->lhs and n?->parent do not change
            // ; p->rhs = g;
            p.members.rhs.pointee = g;
            // ; g->parent = p;
            g.members.parent.pointee = p;
            // ; p->parent = ggp;
            if (ggp === null) {
                p.members.parent.pointee = null;
            } else {
                p.members.parent.pointee = ggp;
            }
            // ; *g_ref = p;
            variables.directPointerAssign2(rt, g_ref, p);
            _assert_parent(rt, p);
        }

        function _rotate_left(rt: CRuntime, g: __node, g_ref: __ptr_node): void {
            // Case 6b.
            // [[u?], g=B, ([b?], p=R, (n))]
            // Rotate left.
            // ([[u?], g=b, [b?]], p=R, (n))
            // ; set_node<Key> *p = g->rhs;
            // ; set_node<Key> *n = p->rhs;      // opt
            // ; set_node<Key> *b = p->lhs;      // opt
            // ; set_node<Key> *ggp = g->parent; // opt

            const p = (g.members.rhs as __tptr_node).pointee;
            const b = variables.asInitDirectPointerPointee(p.members.lhs);
            const ggp = variables.asInitDirectPointerPointee(g.members.parent);
            // ; g->rhs = b;
            if (b === null) {
                g.members.rhs.pointee = null;
            } else {
                // because g->rhs is init before the operation 
                (g.members.rhs as __tptr_node).pointee = b;
            }
            // ; if (b) {
            // ;   b->parent = g;
            // ; }
            if (b !== null) {
                b.members.parent.pointee = g;
            }
            // ((n), p=R, !)    [[b?], g=B, [u?]]
            // g->lhs and u?->parent do not change
            // p->rhs and n?->parent do not change
            // ; p->lhs = g;
            p.members.lhs.pointee = g;
            // ; g->parent = p;
            g.members.parent.pointee = p;
            // ; p->parent = ggp;
            if (ggp === null) {
                p.members.parent.pointee = null;
            } else {
                p.members.parent.pointee = ggp;
            }
            // ; *g_ref = p;
            variables.directPointerAssign2(rt, g_ref, p);
            _assert_parent(rt, p);
        }

        function _begin(thisVar: __set): __set_iter {
            const root = variables.asInitDirectPointerPointee(thisVar.members.root);
            return _createSetIterVar(_createSetIterType(thisVar.t.templateSpec), _createSetNodeType(thisVar.t.templateSpec), root !== null ? _leftmost_child(root) : null, null);
        }

        function _end(thisVar: __set): __set_iter {
            const root = variables.asInitDirectPointerPointee(thisVar.members.root);
            return _createSetIterVar(_createSetIterType(thisVar.t.templateSpec), _createSetNodeType(thisVar.t.templateSpec), null, root !== null ? _rightmost_child(root) : null);
        }

        function* _find(rt: CRuntime, thisVar: __set, key: Variable): Gen<__set_iter> {
            const setIterType = _createSetIterType(thisVar.t.templateSpec);
            const root_dptr = variables.asInitDirectPointerPointee(thisVar.members.root);
            if (root_dptr === null) {
                return _createSetIterVar(setIterType, _createSetNodeType(thisVar.t.templateSpec), null, null);
            }
            let result: __node = root_dptr;
            const ltInst = rt.getOpByParams("{global}", "o(_<_)", [key, key], []);
            const gtInst = rt.getOpByParams("{global}", "o(_>_)", [key, key], []);

            for (; ;) {
                const ltResult = yield* common.invokeCmp(rt, ltInst, result.members.key, key);
                if (ltResult) {
                    const node_rhs: __ptr_node = result.members.rhs;
                    if (node_rhs.pointee !== null) {
                        result = node_rhs.pointee;
                        continue;
                    } else {
                        return _end(thisVar);
                    }
                }
                const gtResult = yield* common.invokeCmp(rt, gtInst, result.members.key, key);
                if (gtResult) {
                    const node_lhs: __ptr_node = result.members.lhs;
                    if (node_lhs.pointee !== null) {
                        result = node_lhs.pointee;
                        continue;
                    } else {
                        return _end(thisVar);
                    }
                }
                return _createSetIterVar(setIterType, _createSetNodeType(thisVar.t.templateSpec), result, null);
            }
        }

        function* _insert(rt: CRuntime, thisVar: __set, value: Variable): Gen<[__set_iter, boolean]> {
            const iterType = _createSetIterType(thisVar.t.templateSpec);
            const nodeType = _createSetNodeType(thisVar.t.templateSpec);
            const rootValue = variables.asInitDirectPointerPointee(thisVar.members.root);
            if (rootValue === null) {
                const rootNode = _createSetNodeVar(nodeType, variables.clone(rt, value, "SELF"), false);
                thisVar.members.root.pointee = rootNode;
                thisVar.members._size.value++;
                return [_createSetIterVar(iterType, nodeType, rootNode, null), true];
            }
            let parentValue: __node = rootValue;
            let nodeValue: __node = _createSetNodeVar(nodeType, variables.clone(rt, value, "SELF"), true);
            const ltInst = rt.getOpByParams("{global}", "o(_<_)", [value, value], []);
            const gtInst = rt.getOpByParams("{global}", "o(_>_)", [value, value], []);
            for (; ;) {
                if (yield* common.invokeCmp(rt, ltInst, parentValue.members.key, value)) {
                    if (parentValue.members.rhs.pointee !== null) {
                        parentValue = (parentValue.members.rhs as __tptr_node).pointee;
                        continue;
                    } else {
                        parentValue.members.rhs.pointee = nodeValue;
                        nodeValue.members.parent.pointee = parentValue;
                        break;
                    }
                } else if (yield* common.invokeCmp(rt, gtInst, parentValue.members.key, value)) {
                    if (parentValue.members.lhs.pointee !== null) {
                        parentValue = (parentValue.members.lhs as __tptr_node).pointee;
                        continue;
                    } else {
                        parentValue.members.lhs.pointee = nodeValue;
                        nodeValue.members.parent.pointee = parentValue;
                        break;
                    }
                } else {
                    return [_createSetIterVar(iterType, nodeType, parentValue, null), false];
                }
            }
            _assert_parent(rt, nodeValue);
            _assert_parent(rt, parentValue);
            thisVar.members._size.value++;
            for (; ;) {
                if (parentValue.members.is_red.value === 0) {
                    // Case 1. Parent is black.
                    break;
                }
                // Grandparent is always black, if exists.
                const grandparentValue: __node | null = variables.asInitDirectPointerPointee(parentValue.members.parent);
                if (grandparentValue === null) {
                    // Case 4. Parent is red and parent is the root node.
                    parentValue.members.is_red.value = 0;
                    break;
                }
                _assert_parent(rt, grandparentValue);
                const glhs = variables.asInitDirectPointerPointee(grandparentValue.members.lhs);
                const grhs = variables.asInitDirectPointerPointee(grandparentValue.members.rhs);
                const uncle: __node | null = (glhs !== null && glhs === parentValue) ? grhs : glhs;
                if (uncle === null || uncle.members.is_red.value === 0) {
                    if (grandparentValue.members.lhs.pointee !== null &&
                        grandparentValue.members.lhs.pointee === parentValue) {
                        if (parentValue.members.rhs.pointee !== null &&
                            parentValue.members.rhs.pointee === nodeValue) {
                            // Case 5a. Parent is red, sibling of parent (uncle) is black or does
                            // not exist, parent->key < node->key < grandparent->key.
                            // [([b?], p=R, (n)), g=B, [u?]]
                            // Rotate left
                            // [(([b?], p=R, .), n=R, .), g=B, [u?]]
                            _rotate_left(rt, parentValue, grandparentValue.members.lhs);
                            nodeValue = parentValue;
                            parentValue = (grandparentValue.members.lhs as __tptr_node).pointee;
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
                                ((ggp.members.lhs.pointee !== null && ggp.members.lhs.pointee === grandparentValue) ?
                                    (ggp.members.lhs) :
                                    (ggp.members.rhs)
                                ) : (thisVar.members.root));
                        parentValue.members.is_red.value = 0;
                        _assert_parent(rt, parentValue);
                        grandparentValue.members.is_red.value = 1;
                        // [(n), p=B, ([b?], g=R, [u?])]
                    } else { /* if (grandparent->rhs == parent) */
                        if (parentValue.members.lhs.pointee !== null &&
                            parentValue.members.lhs.pointee === nodeValue) {
                            // Case 5b. Parent is red, sibling of parent (uncle) is black or does
                            // not exist, grandparent->key < node->key < parent->key.
                            _rotate_right(rt, parentValue, grandparentValue.members.rhs);
                            nodeValue = parentValue;
                            parentValue = (grandparentValue.members.rhs as __tptr_node).pointee;
                            _assert_parent(rt, parentValue);
                        }
                        // Case 6b. Parent is red, sibling of parent (uncle) is black or does
                        // not exist, grandparent->key < parent->key < node->key.
                        const ggp = variables.asInitDirectPointerPointee(grandparentValue.members.parent);
                        _rotate_left(
                            rt,
                            grandparentValue,
                            (ggp !== null) ?
                                ((ggp.members.lhs.pointee !== null && ggp.members.lhs.pointee === grandparentValue) ?
                                    (ggp.members.lhs) :
                                    (ggp.members.rhs)
                                ) : (thisVar.members.root));
                        parentValue.members.is_red.value = 0;
                        _assert_parent(rt, parentValue);
                        grandparentValue.members.is_red.value = 1;
                    }
                    break;
                }
                _assert_parent(rt, uncle);
                // Case 2. Parent is red, uncle is red.
                parentValue.members.is_red.value = 0;
                uncle.members.is_red.value = 0;
                grandparentValue.members.is_red.value = 1;
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


        function _erase(rt: CRuntime, thisVar: __set, pos: __set_iter): __set_iter {
            const node: __node | null = variables.asInitDirectPointerPointee(pos.members.node);
            if (node === null) {
                return _end(thisVar);
            }
            let next = variables.clone(rt, pos, "SELF", false, true);
            _iter_advance(next, true);
            let parent: __node | null = variables.asInitDirectPointerPointee(node.members.parent);
            const lhs: __node | null = variables.asInitDirectPointerPointee(node.members.lhs);
            const rhs: __node | null = variables.asInitDirectPointerPointee(node.members.rhs);
            node.members.lhs.pointee = null;
            node.members.rhs.pointee = null;
            if (lhs !== null && rhs !== null) {
                // if node->rhs exists, then the next node also exists.
                const nextNode: __tptr_node = next.members.node as __tptr_node;
                // swap
                // safe since the lvHolder of both variables are SELF
                const t = node.members.key;
                node.members.key = nextNode.pointee.members.key;
                nextNode.pointee.members.key = t;
                node.members.lhs.pointee = lhs;
                node.members.rhs.pointee = rhs;
                return _erase(rt, thisVar, next);
            } else if (lhs !== null && rhs === null) {
                if (parent === null) {
                    thisVar.members.root.pointee = lhs;
                    lhs.members.parent.pointee = null;
                } else {
                    parent.members.rhs.pointee = lhs;
                    lhs.members.parent.pointee = parent;
                }
                lhs.members.is_red.value = 0;
                thisVar.members._size.value--;
                _node_delete(node);
            } else if (lhs === null && rhs !== null) {
                if (parent === null) {
                    thisVar.members.root.pointee = rhs;
                    rhs.members.parent.pointee = null;
                } else {
                    parent.members.rhs.pointee = rhs;
                    rhs.members.parent.pointee = parent;
                }
                rhs.members.is_red.value = 0;
                thisVar.members._size.value--;
                _node_delete(node);
            } else if (parent === null) {
                thisVar.members.root.pointee = null;
                thisVar.members._size.value--;
                _node_delete(node);
            } else if (node.members.is_red.value === 1) {
                if (node === variables.asInitDirectPointerPointee(parent.members.lhs)) {
                    parent.members.lhs.pointee = null;
                } else {
                    parent.members.rhs.pointee = null;
                }
                thisVar.members._size.value--;
                _node_delete(node);
            } else {
                let dir_lhs: boolean = node === variables.asInitDirectPointerPointee(parent.members.lhs);
                if (dir_lhs) {
                    parent.members.lhs.pointee = null;
                } else {
                    parent.members.rhs.pointee = null;
                }
                thisVar.members._size.value--;
                _node_delete(node);
                // rebalance
                let c: number = 1;
                let sibling: __node;
                let close_nephew: __node | null;
                let distant_nephew: __node | null;
                for (; ;) {
                    if (dir_lhs) {
                        // I just assume at this point
                        sibling = (parent.members.rhs as __tptr_node).pointee;
                        close_nephew = variables.asInitDirectPointerPointee(sibling.members.lhs);
                        distant_nephew = variables.asInitDirectPointerPointee(sibling.members.rhs);
                    } else {
                        sibling = (parent.members.lhs as __tptr_node).pointee;
                        close_nephew = variables.asInitDirectPointerPointee(sibling.members.rhs);
                        distant_nephew = variables.asInitDirectPointerPointee(sibling.members.lhs);
                    }
                    if (sibling.members.is_red.value === 1) {
                        // Case 3.
                        const gp: __node | null = variables.asInitDirectPointerPointee(parent.members.parent);
                        const p_ref: __ptr_node =
                            (gp !== null) ? ((variables.asInitDirectPointerPointee(gp.members.lhs) === parent) ? gp.members.lhs : gp.members.rhs)
                                : thisVar.members.root;
                        if (dir_lhs) {
                            _rotate_left(rt, parent, p_ref);
                        } else {
                            _rotate_right(rt, parent, p_ref);
                        }
                        parent.members.is_red.value = 1;
                        sibling.members.is_red.value = 0;
                        // I assume here as well
                        sibling = close_nephew as __node;
                        distant_nephew = variables.asInitDirectPointerPointee((dir_lhs) ? sibling.members.rhs : sibling.members.lhs);
                        close_nephew = variables.asInitDirectPointerPointee((dir_lhs) ? sibling.members.lhs : sibling.members.rhs);
                        if (distant_nephew !== null && distant_nephew.members.is_red.value === 1) {
                            // Case 6.
                            c = 6;
                            break;
                        } else if (close_nephew !== null && close_nephew.members.is_red.value === 1) {
                            // Case 5.
                            c = 5;
                            break;
                        } else {
                            // Case 4.
                            c = 4;
                            break;
                        }
                    }
                    if (distant_nephew !== null && distant_nephew.members.is_red.value === 1) {
                        // Case 6.
                        c = 6;
                        break;
                    } else if (close_nephew !== null && close_nephew.members.is_red.value === 1) {
                        // Case 5.
                        c = 5;
                        break;
                    }
                    if (parent.members.is_red.value === 1) {
                        // Case 4.
                        c = 4;
                        break;
                    }
                    // Case 2.
                    sibling.members.is_red.value = 1;
                    const parent_parent: __node | null = variables.asInitDirectPointerPointee(parent.members.parent);
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
                        sibling.members.is_red.value = 1;
                        parent.members.is_red.value = 0;
                        break;
                    case 5:
                        if (dir_lhs) {
                            _rotate_right(rt, sibling, parent.members.rhs);
                        } else {
                            _rotate_left(rt, sibling, parent.members.lhs);
                        }
                        sibling.members.is_red.value = 1;
                        // close_nephew is non-null if triggered Case 5.;
                        (close_nephew as __node).members.is_red.value = 0;
                        distant_nephew = sibling;
                        sibling = (close_nephew as __node);
                        break;
                }
                if (c === 5 || c === 6) {
                    const gp: __node | null = variables.asInitDirectPointerPointee(parent.members.parent);
                    const p_ref: __ptr_node =
                        (gp !== null) ? ((variables.asInitDirectPointerPointee(gp.members.lhs) === parent) ? gp.members.lhs : gp.members.rhs)
                            : thisVar.members.root;
                    if (dir_lhs) {
                        _rotate_left(rt, parent, p_ref);
                    } else {
                        _rotate_right(rt, parent, p_ref);
                    }
                    sibling.members.is_red.value = parent.members.is_red.value;
                    parent.members.is_red.value = 0;
                    (distant_nephew as __node).members.is_red.value = 0;
                }
            }
            return next;
        }

        function _clear(thisVar: __set): void {
            const root: __ptr_node = thisVar.members.root;
            if (root.pointee !== null) {
                // hotfix due to a dangling pointer in copied containers
                _node_delete(root.pointee);
                delete (root as any).pointee;
                root.pointee = null;
                thisVar.members._size.value = BigInt(0);
            }

        }

        // debug function
        common.regGlobalFuncs(rt, [{
            op: "_print",
            type: "FUNCTION VOID ( CLREF CLASS set < I32 > )",
            default(rt: CRuntime, _templateTypes: ObjectType[], set: SetVariable<InitArithmeticNumVariable>): "VOID" {
                const stdio = rt.stdio();
                function _set_int_print_tree_inner(node: SetNodeValue<InitArithmeticNumVariable>, shift: number): void {
                    const lhs = variables.asInitDirectPointerPointee(node.members.lhs);
                    if (lhs !== null) {
                        _set_int_print_tree_inner(lhs, shift + 1);
                    }
                    stdio.write(`${" ".repeat(shift)}${((node.members.is_red.value === 1) ? "R" : "B")}:${node.members.key.value}\n`);
                    const rhs = variables.asInitDirectPointerPointee(node.members.rhs);
                    if (rhs !== null) {
                        _set_int_print_tree_inner(rhs, shift + 1);
                    }
                }
                const root = variables.asInitDirectPointerPointee(set.members.root);
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
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): __set_iter {
                    return _begin(thisVar);
                }
            },
            {
                op: "end",
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): __set_iter {
                    return _end(thisVar);
                }
            },
            /*{
                op: "rbegin",
                type: "!ParamObject FUNCTION CLASS reverse_iterator < CLASS set_iterator < ?0 > > ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): __set_iter {
                    return _begin(thisVar);
                }
            },
            {
                op: "rend",
                type: "!ParamObject FUNCTION CLASS reverse_iterator < CLASS set_iterator < ?0 > > ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): __set_iter {
                    return _end(thisVar);
                }
            },*/
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
                        isConst: false,
                        lvHolder: null,
                        state: "INIT",
                        members: {
                            first: result[0],
                            second: {
                                t: { sig: "BOOL" },
                                isConst: false,
                                lvHolder: null,
                                state: "INIT",
                                value: result[0] ? 1 : 0
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
                type: "!ParamObject !ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > ?1 ?1 )",
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
                        yield* common.invokePp(rt, firstTypeString, ppFunc, first);
                    }
                    return "VOID";
                }
            },
            {
                op: "insert",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > CLASS initializer_list < ?0 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, list: InitializerListVariable<Variable>): Gen<"VOID"> {
                    const listmem = list.members._values.pointee;

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
                type: "!ParamObject FUNCTION CLASS set_iterator < ?0 > ( CLREF CLASS set < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set, key: Variable): Gen<__set_iter> {
                    return yield* _find(rt, thisVar, key);
                }
            },
            {
                op: "count",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS set < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<InitArithmeticNumVariable> {
                    const setVar = args[0] as __set;
                    const value = args[1];
                    const found = yield* _find(rt, setVar, value);
                    return variables.arithmeticNum("I32", found.members.node.pointee !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "contains",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<InitArithmeticNumVariable>  {
                    const setVar = args[0] as __set;
                    const value = args[1];
                    const found = yield* _find(rt, setVar, value);
                    return variables.arithmeticNum("BOOL", found.members.node.pointee !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "size",
                type: "!ParamObject FUNCTION I64 ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): InitArithmeticBigVariable {
                    return variables.arithmeticBig("I64", thisVar.members._size.value, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): InitArithmeticNumVariable {
                    return variables.arithmeticNum("BOOL", (thisVar.members._size.value === BigInt(0)) ? 1 : 0, null, false);
                }
            },
            {
                op: "_assert_rb",
                type: "!ParamObject FUNCTION VOID ( CLREF CLASS set < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): "VOID" {
                    const root = thisVar.members.root;
                    if (root.pointee !== null && !_assert_rb(rt, root as __tptr_node)) {
                        rt.raiseException("std::set<Key>::_assert_rb(): Red-black tree integrity assertion failed");
                    }
                    return "VOID"
                }
            },
            {
                op: "clear",
                type: "!ParamObject FUNCTION VOID ( LREF CLASS set < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __set): "VOID" {
                    _clear(thisVar);
                    return "VOID";
                }
            },
        ])
    }
};
