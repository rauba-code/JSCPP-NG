import { InitializerListVariable } from "../initializer_list";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { PairVariable } from "../shared/utility";
import { Variable, variables, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, PointerVariable, InitArithmeticNumVariable, InitDirectPointerVariable, InitArithmeticBigVariable, LValueHolder } from "../variables";


interface MapNodeType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "map_node",
}

type MapNodeVariable<T extends Variable> = AbstractVariable<MapNodeType<T["t"]>, MapNodeValue<T>>;

interface MapNodeValue<T extends Variable> extends InitValue<MapNodeVariable<T>> {
    members: {
        "lhs": PointerVariable<MapNodeVariable<T>>,
        "rhs": PointerVariable<MapNodeVariable<T>>,
        "parent": PointerVariable<MapNodeVariable<T>>,
        "is_red": InitArithmeticNumVariable,
        "key": T,
    }
}

interface MapIteratorType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "map_iterator",
}

type MapIteratorVariable<T extends Variable> = AbstractVariable<MapIteratorType<T["t"]>, MapIteratorValue<T>>;

interface MapIteratorValue<T extends Variable> extends InitValue<MapIteratorVariable<T>> {
    members: {
        "node": PointerVariable<MapNodeVariable<T>>,
        "last": PointerVariable<MapNodeVariable<T>>,
    }
}

interface EmptyType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "empty",
}

type EmptyVariable<T extends Variable> = AbstractVariable<EmptyType<T["t"]>, EmptyValue<T>>;

interface EmptyValue<T extends Variable> extends InitValue<EmptyVariable<T>> {
    members: {}
}

interface MapType<TKey extends ObjectType, TT extends ObjectType> extends AbstractTemplatedClassType<null, [TKey, TT]> {
    readonly identifier: "map",
}

type MapVariable<TKey extends Variable, TT extends Variable> = AbstractVariable<MapType<TKey["t"], TT['t']>, MapValue<TKey, TT>>;

interface MapValue<TKey extends Variable, TT extends Variable> extends InitValue<MapVariable<TKey, TT>> {
    members: {
        "root": PointerVariable<MapNodeVariable<PairVariable<TKey, TT>>>,
        "_size": InitArithmeticBigVariable,
        // cache of common types to avoid constructing new ones
        "_t_pair": EmptyVariable<PairVariable<Variable, Variable>>,
        "_t_node": EmptyVariable<MapNodeVariable<PairVariable<Variable, Variable>>>,
        "_t_iter": EmptyVariable<MapIteratorVariable<PairVariable<Variable, Variable>>>
    }
}

export = {
    load(rt: CRuntime) {
        //rt.include("iterator")
        rt.include("cstddef");
        rt.include("utility"); // pair

        type __pair = PairVariable<Variable, Variable>;
        type __map = MapVariable<Variable, Variable>;
        type __node = MapNodeVariable<__pair>;
        type __map_iter = MapIteratorVariable<__pair>;
        type __dptr_node = InitDirectPointerVariable<__node>;

        const _createPairType: (templateSpec: [ObjectType, ObjectType]) => __pair['t'] = (templateSpec) => ({
            "sig": "CLASS",
            "identifier": "pair",
            "memberOf": null,
            templateSpec
        });

        const _createMapNodeType: (templateSpec: [__pair['t']]) => __node['t'] = (templateSpec) => ({
            "sig": "CLASS",
            "identifier": "map_node",
            "memberOf": null,
            templateSpec
        });

        const _createMapIterType: (templateSpec: [__pair['t']]) => __map_iter['t'] = (templateSpec) => ({
            "sig": "CLASS",
            "identifier": "map_iterator",
            "memberOf": null,
            templateSpec
        });

        // --
        // -- map_node
        // --

        function _createMapNodeMembers(mapIterType: __node['t'], key: __pair, is_red: boolean): __node['v']['members'] {
            const ptrType = { sig: "PTR" as "PTR", pointee: mapIterType, sizeConstraint: null };
            return {
                lhs: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                rhs: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                parent: { t: ptrType, v: { lvHolder: "SELF", state: "UNINIT", isConst: false } },
                is_red: { t: { sig: "BOOL" }, v: { lvHolder: "SELF", state: "INIT", value: (is_red) ? 1 : 0, isConst: false } },
                key
            };
        }

        function* _createMapNodeMembersDefault(mapIterType: __node['t']): Gen<__node['v']['members']> {
            const default_key = yield* rt.defaultValue2<__pair>(mapIterType.templateSpec[0], "SELF");
            (default_key.v.members.first.v as any).isConst = true;
            return _createMapNodeMembers(mapIterType, default_key, false);
        }

        function _createMapNodeVar(mapIterType: __node['t'], pair: __pair, is_red: boolean): __node {
            return {
                t: mapIterType,
                v: {
                    isConst: false,
                    state: "INIT",
                    lvHolder: "SELF",
                    members: _createMapNodeMembers(mapIterType, pair, is_red)
                }
            };
        }

        function _createEmptyVar<VElem extends Variable>(objectType: VElem['t']): EmptyVariable<VElem> {
            return {
                t: {
                    sig: "CLASS",
                    identifier: "empty",
                    memberOf: null,
                    templateSpec: [objectType],
                },
                v: {
                    isConst: false,
                    lvHolder: "SELF",
                    state: "INIT",
                    members: {}
                }
            }
        }

        rt.defineStruct2("{global}", "map_node", {
            numTemplateArgs: 1, factory: _createMapNodeMembersDefault
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

        function _leftmost_child(node: __node['v']): __node['v'] {
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

        function _rightmost_child(node: __node['v']): __node['v'] {
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
        // -- map_iterator
        // --

        function _createMapIterMembers(nodeType: __node['t'], node: __node['v'] | null, last: __node['v'] | null): __map_iter['v']['members'] {
            return {
                node: (node !== null) ? {
                    t: {
                        sig: "PTR",
                        sizeConstraint: null,
                        pointee: nodeType
                    },
                    v: {
                        lvHolder: "SELF",
                        state: "INIT",
                        subtype: "DIRECT",
                        isConst: false,
                        pointee: node
                    }
                } : variables.uninitPointer(nodeType, null, "SELF") as PointerVariable<__node>,
                last: (last !== null) ? {
                    t: {
                        sig: "PTR",
                        sizeConstraint: null,
                        pointee: nodeType
                    },
                    v: {
                        lvHolder: "SELF",
                        state: "INIT",
                        subtype: "DIRECT",
                        isConst: false,
                        pointee: last
                    }
                } : variables.uninitPointer(nodeType, null, "SELF") as PointerVariable<__node>,
            };
        }

        function _createMapIterVar(mapIterType: __map_iter['t'], mapNodeType: __node['t'], node: __node['v'] | null, last: __node['v'] | null): __map_iter {
            return {
                t: mapIterType,
                v: {
                    isConst: false,
                    state: "INIT",
                    lvHolder: "SELF",
                    members: _createMapIterMembers(mapNodeType, node, last)
                }
            };
        }

        // const mapIteratorSig = "!ParamObject CLASS map_iterator < ?0 >".split(" ");
        rt.defineStruct2("{global}", "map_iterator", {
            numTemplateArgs: 1, factory(iterType: __node['t']): __map_iter['v']['members'] {
                return _createMapIterMembers(_createMapNodeType(iterType.templateSpec), null, null);
            }
        }, ["node"], {
            // ["value_type"]: [{ src: mapIteratorSig, dst: ["?0"]}],
            // ["pointer"]: [{ src: mapIteratorSig, dst: ["PTR", "?0"]}],
            // ["reference"]: [{ src: mapIteratorSig, dst: ["LREF", "?0"]}],
        });

        function _iter_advance(thisVar: __map_iter, forward: boolean): "VOID" {
            let node: __dptr_node | null = variables.asInitDirectPointer2(thisVar.v.members.node);
            const into: "lhs" | "rhs" = (forward) ? "rhs" : "lhs";
            const from: "lhs" | "rhs" = (forward) ? "lhs" : "rhs";
            if (node === null) {
                const last = variables.asInitDirectPointerPointee(thisVar.v.members.last);
                if (last !== null) {
                    variables.directPointerAssignValue(rt, thisVar.v.members.node, last);
                } else {
                    // pass
                }
                return "VOID";
            }
            variables.directPointerAssignValue(rt, thisVar.v.members.last, node.v.pointee);
            let child: __node['v'] | null = variables.asInitDirectPointerPointee(node.v.pointee.members[into]);
            if (child !== null) {
                node.v.pointee = child;
                child = variables.asInitDirectPointerPointee(child.members[from]);
                while (child !== null) {
                    node.v.pointee = child;
                    child = variables.asInitDirectPointerPointee(child.members[from]);
                }
            } else {
                for (; ;) {
                    const parent: __node['v'] | null = variables.asInitDirectPointerPointee(node.v.pointee.members.parent);
                    if (parent === null) {
                        (node as any).v = { isConst: false, state: "UNINIT", lvHolder: "SELF" };
                        break;
                    }
                    if (parent.members[from].v.state === "INIT" &&
                        node.v.pointee === (parent.members[from] as __dptr_node).v.pointee) {
                        node.v.pointee = parent;
                        break;
                    }
                    node.v.pointee = parent;
                }
            }
            return "VOID";
        }

        common.regOps(rt, [
            {
                op: "o(*_)",
                type: "!ParamObject FUNCTION LREF ?0 ( CLREF CLASS map_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __map_iter): Variable {
                    if (thisVar.v.members.node.v.state === "INIT") {
                        return (thisVar.v.members.node as __dptr_node).v.pointee.members.key;
                    }
                    rt.raiseException("map_iterator::operator*(): Attempted dereference of a null-iterator");
                }
            },
            {
                op: "o(++_)",
                type: "!ParamObject FUNCTION LREF CLASS map_iterator < ?0 > ( LREF CLASS map_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], thisVar: __map_iter): __map_iter {
                    _iter_advance(thisVar, true);
                    return thisVar;
                }
            },
            {
                op: "o(_++)",
                type: "!ParamObject FUNCTION CLASS map_iterator < ?0 > ( LREF CLASS map_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __map_iter): __map_iter {
                    const thatVar = variables.clone(rt, thisVar, null, false);
                    _iter_advance(thisVar, true);
                    return thatVar;
                }
            },
            {
                op: "o(--_)",
                type: "!ParamObject FUNCTION LREF CLASS map_iterator < ?0 > ( LREF CLASS map_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], thisVar: __map_iter): __map_iter {
                    _iter_advance(thisVar, false);
                    return thisVar;
                }
            },
            {
                op: "o(_--)",
                type: "!ParamObject FUNCTION CLASS map_iterator < ?0 > ( LREF CLASS map_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __map_iter): __map_iter {
                    const thatVar = variables.clone(rt, thisVar, null, false);
                    _iter_advance(thisVar, false);
                    return thatVar;
                }
            },
            {
                op: "o(_==_)",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS map_iterator < ?0 > CLREF CLASS map_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], lhs: __map_iter, rhs: __map_iter): InitArithmeticNumVariable {
                    const isEq: boolean = (lhs.v.members.node.v.state === "UNINIT") ? (rhs.v.members.node.v.state === "UNINIT") : (lhs.v === rhs.v);
                    return variables.arithmeticNum("BOOL", isEq ? 1 : 0, null);
                }
            },
            {
                op: "o(_!=_)",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS map_iterator < ?0 > CLREF CLASS map_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: [], lhs: __map_iter, rhs: __map_iter): InitArithmeticNumVariable {
                    const isEq: boolean = (lhs.v.members.node.v.state === "UNINIT") ? (rhs.v.members.node.v.state === "UNINIT") : (lhs.v === rhs.v);
                    return variables.arithmeticNum("BOOL", isEq ? 0 : 1, null);
                }
            },

        ])

        // --
        // -- map
        // --

        /*function _createMapType(templateSpec: [ObjectType]): __map['t'] {
            return {
                sig: "CLASS",
                identifier: "map",
                memberOf: null,
                templateSpec
            };
        }*/

        function _createMapMembers(mapType: MapType<ObjectType, ObjectType>): __map['v']['members'] {
            const pairType = _createPairType(mapType.templateSpec);
            const iterType = _createMapIterType([pairType]);
            const nodeType = _createMapNodeType([pairType]);
            return {
                root: variables.uninitPointer(_createMapNodeType([pairType]), null, "SELF") as PointerVariable<__node>,
                _size: variables.arithmeticBig("U64", BigInt(0), "SELF"),
                _t_pair: _createEmptyVar(pairType),
                _t_iter: _createEmptyVar(iterType),
                _t_node: _createEmptyVar(nodeType),
            }
        }

        function _createMapVar(mapType: MapType<ObjectType, ObjectType>, lvHolder: LValueHolder<__map>): __map {
            return {
                t: mapType,
                v: {
                    isConst: false,
                    lvHolder,
                    state: "INIT",
                    members: _createMapMembers(mapType)
                }
            };
        }

        const mapSig = "!ParamObject CLASS map < ?0 ?1 >".split(" ");
        rt.defineStruct2("{global}", "map", { numTemplateArgs: 1, factory: _createMapMembers }, ["_data", "_sz", "_cap"], {
            ["key_type"]: [{ src: mapSig, dst: ["?0"] }],
            ["value_type"]: [{ src: mapSig, dst: ["?0"] }],
            ["iterator"]: [{ src: mapSig, dst: "CLASS map_iterator < CLASS pair < ?0 ?1 > >".split(' ') }], // implementation-dependent
            ["const_iterator"]: [{ src: mapSig, dst: "CLASS map_iterator < CLASS pair < ?0 ?1 > >".split(' ') }], // implementation-dependent
            ["pointer"]: [{ src: mapSig, dst: ["PTR", "?0"] }],
            ["reference"]: [{ src: mapSig, dst: ["LREF", "?0"] }],
            ["size_type"]: [{ src: mapSig, dst: ["U64"] }],
        });

        // Constructor from initializer_list
        const ctorHandler1: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject !ParamObject FUNCTION CLASS map < ?0 ?1 > ( CLASS initializer_list < CLASS pair < ?0 ?1 > > )",
            *default(rt: CRuntime, templateTypes: [__map['t']], list: InitializerListVariable<__pair>): Gen<__map> {
                const mapVar = _createMapVar(templateTypes[0], null);
                const listmem = list.v.members._values.v.pointee;

                for (let i = 0; i < listmem.values.length; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable) as __pair;
                    yield* _insert(rt, mapVar, currentValue);
                }

                return mapVar;
            }
        };

        const ctorHandler2: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject !ParamObject FUNCTION CLASS map < ?0 ?1 > ( PTR CLASS pair < ?0 ?1 > PTR CLASS pair < ?0 ?1 > )",
            *default(rt: CRuntime, templateTypes: [__map['t']], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<__map> {
                const begin = variables.asInitIndexPointer(_begin) ?? rt.raiseException("map constructor: expected valid begin iterator");
                const end = variables.asInitIndexPointer(_end) ?? rt.raiseException("map constructor: expected valid end iterator");

                if (begin.v.pointee !== end.v.pointee) {
                    rt.raiseException("map constructor: iterators must point to same memory region");
                }

                const mapVar = _createMapVar(templateTypes[0], null);

                for (let i = begin.v.index; i < end.v.index; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable) as __pair;
                    yield* _insert(rt, mapVar, currentValue);
                }

                return mapVar;
            }
        };

        rt.explicitListInitTable["map"] = (mapType: MapType<ObjectType, ObjectType>) => _createPairType(mapType.templateSpec);
        rt.regFunc(ctorHandler1.default, variables.classType("map", [], null), ctorHandler1.op, rt.typeSignature(ctorHandler1.type), [-1], null);
        rt.regFunc(ctorHandler2.default, variables.classType("map", [], null), ctorHandler2.op, rt.typeSignature(ctorHandler2.type), [-1], null);

        common.regOps(rt, [
            {
                op: "o(_=_)",
                type: "!ParamObject !ParamObject FUNCTION CLASS map < ?0 ?1 > ( LREF CLASS map < ?0 ?1 > CLREF CLASS map < ?0 ?1 > )",
                default(rt: CRuntime, _templateTypes: [], lmap: __map, rmap: __map): __map {
                    _clear(lmap);
                    const rr: __node['v'] | null = variables.asInitDirectPointerPointee(rmap.v.members.root);
                    if (rr === null) {
                        return lmap;
                    }
                    const nodeType = lmap.v.members._t_node.t.templateSpec[0];
                    function clone(rn: __node['v'], parent: __node['v'] | null): __node['v'] {
                        const nn: __node['v'] = {
                            isConst: false,
                            lvHolder: "SELF",
                            state: "INIT",
                            members:
                                _createMapNodeMembers(
                                    nodeType,
                                    variables.clone(rt, rn.members.key, "SELF", false, false),
                                    rn.members.is_red.v.value === 1
                                ),
                        };
                        if (parent) {
                            variables.directPointerAssignValue(rt, nn.members.parent, parent);
                        }
                        const rlhs = variables.asInitDirectPointerPointee(rn.members.lhs);
                        if (rlhs !== null) {
                            variables.directPointerAssignValue(rt, nn.members.lhs, clone(rlhs, nn));
                        }
                        const rrhs = variables.asInitDirectPointerPointee(rn.members.rhs);
                        if (rrhs !== null) {
                            variables.directPointerAssignValue(rt, nn.members.rhs, clone(rrhs, nn));
                        }
                        return nn;
                    }
                    variables.directPointerAssignValue(rt, lmap.v.members.root, clone(rr, null));
                    lmap.v.members._size.v.value = rmap.v.members._size.v.value;
                    return lmap;
                },
                isOverrideOf: "!Class FUNCTION ?0 ( LREF ?0 CLREF ?0 )",
            }
        ]);

        function _assert_parent(rt: CRuntime, node: __node['v']) {
            const parent = variables.asInitDirectPointer2(node.members.parent);
            const assertion = (parent === null) ||
                (parent.v.pointee.members.lhs.v.state === "INIT" && (parent.v.pointee.members.lhs as __dptr_node).v.pointee === node) ||
                (parent.v.pointee.members.rhs.v.state === "INIT" && (parent.v.pointee.members.rhs as __dptr_node).v.pointee === node);
            if (!assertion) {
                rt.raiseException("std::map<Key, T>: Parent rule assertion failed");
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
            // ; map_node<Key> *p = g->lhs;
            // ; map_node<Key> *n = p->lhs;      // opt
            // ; map_node<Key> *b = p->rhs;      // opt
            // ; map_node<Key> *ggp = g->parent; // opt

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
            // ; map_node<Key> *p = g->rhs;
            // ; map_node<Key> *n = p->rhs;      // opt
            // ; map_node<Key> *b = p->lhs;      // opt
            // ; map_node<Key> *ggp = g->parent; // opt

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

        function _begin(thisVar: __map): __map_iter {
            const root = variables.asInitDirectPointerPointee(thisVar.v.members.root);
            return _createMapIterVar(
                thisVar.v.members._t_iter.t.templateSpec[0],
                thisVar.v.members._t_node.t.templateSpec[0],
                root !== null ? _leftmost_child(root) : null,
                null);
        }

        function _end(thisVar: __map): __map_iter {
            const root = variables.asInitDirectPointerPointee(thisVar.v.members.root);
            return _createMapIterVar(
                thisVar.v.members._t_iter.t.templateSpec[0],
                thisVar.v.members._t_node.t.templateSpec[0],
                null,
                root !== null ? _rightmost_child(root) : null);
        }

        function* _find(rt: CRuntime, thisVar: __map, key: Variable): Gen<__map_iter> {
            const iterType = thisVar.v.members._t_iter.t.templateSpec[0];
            const nodeType = thisVar.v.members._t_node.t.templateSpec[0];
            const root_dptr = variables.asInitDirectPointerPointee(thisVar.v.members.root);
            if (root_dptr === null) {
                return _createMapIterVar(iterType, nodeType, null, null);
            }
            let result: __node['v'] = root_dptr;
            const ltInst = rt.getOpByParams("{global}", "o(_<_)", [key, key], []);
            const gtInst = rt.getOpByParams("{global}", "o(_>_)", [key, key], []);

            for (; ;) {
                const ltResult = yield* common.invokeCmp(rt, ltInst, result.members.key, key);
                if (ltResult) {
                    const node_rhs: __dptr_node | null = variables.asInitDirectPointer2(result.members.rhs);
                    if (node_rhs !== null) {
                        result = node_rhs.v.pointee;
                        continue;
                    } else {
                        return _end(thisVar);
                    }
                }
                const gtResult = yield* common.invokeCmp(rt, gtInst, result.members.key, key);
                if (gtResult) {
                    const node_lhs: __dptr_node | null = variables.asInitDirectPointer2(result.members.lhs);
                    if (node_lhs !== null) {
                        result = node_lhs.v.pointee;
                        continue;
                    } else {
                        return _end(thisVar);
                    }
                }
                return _createMapIterVar(iterType, nodeType, result, null);
            }
        }

        function* _insert(rt: CRuntime, thisVar: __map, value: __pair): Gen<[__map_iter, boolean]> {
            value = variables.clone(rt, value, "SELF");
            (value.v.members.first.v as any).isConst = true;
            const iterType = thisVar.v.members._t_iter.t.templateSpec[0];
            const nodeType = thisVar.v.members._t_node.t.templateSpec[0];
            const rootValue = variables.asInitDirectPointerPointee(thisVar.v.members.root);
            if (rootValue === null) {
                const rootNode = _createMapNodeVar(nodeType, value, false);
                variables.directPointerAssignValue(rt, thisVar.v.members.root, rootNode.v);
                thisVar.v.members._size.v.value++;
                return [_createMapIterVar(iterType, nodeType, rootNode.v, null), true];
            }
            let parentValue: __node['v'] = rootValue;
            let nodeValue: __node['v'] = _createMapNodeVar(nodeType, value, true).v;
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
                    return [_createMapIterVar(iterType, nodeType, parentValue, null), false];
                }
            }
            _assert_parent(rt, nodeValue);
            _assert_parent(rt, parentValue);
            thisVar.v.members._size.v.value++;
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


        function _erase(rt: CRuntime, thisVar: __map, pos: __map_iter): __map_iter {
            const node: __node['v'] | null = variables.asInitDirectPointerPointee(pos.v.members.node);
            if (node === null) {
                return _end(thisVar);
            }
            let next = variables.clone(rt, pos, "SELF", false, true);
            _iter_advance(next, true);
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

        function _clear(thisVar: __map): void {
            const root: __dptr_node | null = variables.asInitDirectPointer2(thisVar.v.members.root);
            if (root !== null) {
                // hotfix due to a dangling pointer in copied containers
                //_node_delete(root.v.pointee);
                delete (root.v as any).pointee;
                (root.v as any).state = "UNINIT";
                thisVar.v.members._size.v.value = BigInt(0);
            }

        }

        // debug function
        common.regGlobalFuncs(rt, [{
            op: "_print",
            type: "!ParamObject FUNCTION VOID ( CLREF CLASS map < I32 ?0 > )",
            default(rt: CRuntime, _templateTypes: ObjectType[], map: MapVariable<InitArithmeticNumVariable, Variable>): "VOID" {
                const stdio = rt.stdio();
                function _map_int_print_tree_inner(node: MapNodeValue<PairVariable<InitArithmeticNumVariable, Variable>>, shift: number): void {
                    const lhs = variables.asInitDirectPointerPointee(node.members.lhs);
                    if (lhs !== null) {
                        _map_int_print_tree_inner(lhs, shift + 1);
                    }
                    stdio.write(`${" ".repeat(shift)}${((node.members.is_red.v.value === 1) ? "R" : "B")}:${node.members.key.v.members.first.v.value}\n`);
                    const rhs = variables.asInitDirectPointerPointee(node.members.rhs);
                    if (rhs !== null) {
                        _map_int_print_tree_inner(rhs, shift + 1);
                    }
                }
                const root = variables.asInitDirectPointerPointee(map.v.members.root);
                if (root !== null) {
                    _map_int_print_tree_inner(root, 0);
                } else {
                    stdio.write("<empty map>");
                }
                stdio.write("\n");
                return "VOID";
            }
        }]);

        common.regMemberFuncs(rt, "map", [
            {
                op: "begin",
                type: "!ParamObject !ParamObject FUNCTION CLASS map_iterator < ?0 > ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map): __map_iter {
                    return _begin(thisVar);
                }
            },
            {
                op: "end",
                type: "!ParamObject !ParamObject FUNCTION CLASS map_iterator < ?0 > ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map): __map_iter {
                    return _end(thisVar);
                }
            },
            /*{
                op: "rbegin",
                type: "!ParamObject !ParamObject FUNCTION CLASS reverse_iterator < CLASS map_iterator < ?0 > > ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map): __map_iter {
                    return _begin(thisVar);
                }
            },
            {
                op: "rend",
                type: "!ParamObject !ParamObject FUNCTION CLASS reverse_iterator < CLASS map_iterator < ?0 > > ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map): __map_iter {
                    return _end(thisVar);
                }
            },*/
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION CLASS pair < CLASS map_iterator < CLASS pair < ?0 ?1 > > BOOL > ( LREF CLASS map < ?0 ?1 > CLREF CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map, value: __pair): Gen<PairVariable<__map_iter, InitArithmeticNumVariable>> {
                    const result = yield* _insert(rt, thisVar, value);
                    return {
                        t: {
                            sig: "CLASS",
                            identifier: "pair",
                            memberOf: null,
                            templateSpec: [
                                thisVar.v.members._t_iter.t.templateSpec[0],
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
                type: "!ParamObject !ParamObject FUNCTION CLASS pair < CLASS map_iterator < CLASS pair < ?0 ?1 > > BOOL > ( LREF CLASS map < ?0 ?1 > CLREF CLASS pair < ?0 ?1 > CLREF CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map, _pos: __map_iter, value: __pair): Gen<PairVariable<__map_iter, InitArithmeticNumVariable>> {
                    // same as above, ignoring the 'pos' argument, 
                    // returning iterator only
                    const result = yield* _insert(rt, thisVar, value);
                    return {
                        t: {
                            sig: "CLASS",
                            identifier: "pair",
                            memberOf: null,
                            templateSpec: [
                                thisVar.v.members._t_iter.t.templateSpec[0],
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
                type: "!ParamObject !ParamObject !ParamObject FUNCTION VOID ( LREF CLASS map < ?0 ?1 > ?2 ?2 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map, first: Variable, last: Variable): Gen<"VOID"> {
                    const eqFunc = rt.getOpByParams("{global}", "o(_==_)", [first, last], []);
                    const ppFunc = rt.getOpByParams("{global}", "o(_++)", [first], []);
                    const derefFunc = rt.getOpByParams("{global}", "o(*_)", [first], []);
                    const firstTypeString = rt.makeTypeString(first.t);
                    const valueType = thisVar.v.members._t_pair.t.templateSpec[0];
                    while (!(yield* common.invokeCmp(rt, eqFunc, first, last))) {
                        const derefObject = yield* common.invokeDeref(rt, firstTypeString, derefFunc, first);
                        if (!variables.typesEqual(derefObject.t, valueType)) {
                            const mapTypeString = rt.makeTypeString(thisVar.t);
                            const mapValueTypeString = rt.makeTypeString(valueType);
                            rt.raiseException(`${mapTypeString}::insert(): Expected type of (*first) to be ${mapValueTypeString}, got ${rt.makeTypeString(derefObject.t)}`);
                        }
                        yield* _insert(rt, thisVar, derefObject as __pair);
                        yield* common.invokePp(rt, firstTypeString, ppFunc, first);
                    }
                    return "VOID";
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION VOID ( LREF CLASS map < ?0 ?1 > CLASS initializer_list < CLASS pair < ?0 ?1 > > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map, list: InitializerListVariable<__pair>): Gen<"VOID"> {
                    const listmem = list.v.members._values.v.pointee;

                    let lastInserted: __map_iter | null = null;
                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable) as __pair;
                        const iterator = (yield* _insert(rt, thisVar, currentValue))[0];
                        lastInserted = iterator;
                    }

                    return "VOID";
                }
            },
            {
                op: "erase",
                type: "!ParamObject !ParamObject FUNCTION CLASS map_iterator < CLASS pair < ?0 ?1 > > ( LREF CLASS map < ?0 ?1 > CLASS map_iterator < CLASS pair < ?0 ?1 > > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map, pos: __map_iter): __map_iter {
                    return _erase(rt, thisVar, pos);
                }
            },
            {
                op: "erase",
                type: "!ParamObject !ParamObject FUNCTION CLASS map_iterator < CLASS pair < ?0 ?1 > > ( LREF CLASS map < ?0 ?1 > ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map, key: Variable): Gen<__map_iter> {
                    const pos = yield* _find(rt, thisVar, key);
                    return _erase(rt, thisVar, pos);
                }
            },
            {
                op: "find",
                type: "!ParamObject !ParamObject FUNCTION PTR ?0 ( CLREF CLASS map < ?0 ?1 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map, key: Variable): Gen<__map_iter> {
                    return yield* _find(rt, thisVar, key);
                }
            },
            {
                op: "count",
                type: "!ParamObject !ParamObject FUNCTION I32 ( CLREF CLASS map < ?0 ?1 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as __map;
                    const value = args[1];
                    const found = _find(rt, mapVar, value);
                    return variables.arithmeticNum("I32", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "contains",
                type: "!ParamObject !ParamOjbect FUNCTION BOOL ( CLREF CLASS map < ?0 ?1 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const mapVar = args[0] as __map;
                    const value = args[1];
                    const found = _find(rt, mapVar, value);
                    return variables.arithmeticNum("BOOL", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "size",
                type: "!ParamObject !ParamObject FUNCTION I64 ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map): InitArithmeticBigVariable {
                    return variables.arithmeticBig("I64", thisVar.v.members._size.v.value, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map): InitArithmeticNumVariable {
                    return variables.arithmeticNum("BOOL", (thisVar.v.members._size.v.value === BigInt(0)) ? 1 : 0, null, false);
                }
            },
            {
                op: "_assert_rb",
                type: "!ParamObject !ParamObject FUNCTION VOID ( CLREF CLASS map < ?0 ?1 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map): "VOID" {
                    const root = variables.asInitDirectPointer2(thisVar.v.members.root);
                    if (root !== null && !_assert_rb(rt, root)) {
                        rt.raiseException("std::map<Key>::_assert_rb(): Red-black tree integrity assertion failed");
                    }
                    return "VOID"
                }
            },
            {
                op: "clear",
                type: "!ParamObject !ParamObject FUNCTION VOID ( LREF CLASS map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __map): "VOID" {
                    _clear(thisVar);
                    return "VOID";
                }
            },
        ])
    }
};
