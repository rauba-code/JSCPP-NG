import { InitializerListVariable } from "../initializer_list";
import { asResult } from "../interpreter";
import { CRuntime, MemberMap } from "../rt";
import * as common from "../shared/common";
import { PairVariable } from "../shared/utility";
import { InitIndexPointerVariable, Variable, variables, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, PointerVariable, InitArithmeticVariable, InitDirectPointerVariable, PointerValue } from "../variables";

// unordered_map

interface UMapType<TKey extends ObjectType, TVal extends ObjectType> extends AbstractTemplatedClassType<null, [TKey, TVal]> {
    readonly identifier: "unordered_map",
}

type UMapVariable<TKey extends Variable, TVal extends Variable> = AbstractVariable<UMapType<TKey["t"], TVal["t"]>, UMapValue<TKey, TVal>>;

interface UMapValue<TKey extends Variable, TVal extends Variable> extends InitValue<UMapVariable<TKey, TVal>> {
    members: {
        "tree": UMapBranchVariable<TKey, TVal>,
    }
}

// unordered_map_iterator

interface UMapIteratorType<TKey extends ObjectType, TVal extends ObjectType> extends AbstractTemplatedClassType<null, [TKey, TVal]> {
    readonly identifier: "unordered_map_iterator",
}

type UMapIteratorVariable<TKey extends Variable, TVal extends Variable> = AbstractVariable<UMapIteratorType<TKey["t"], TVal["t"]>, UMapIteratorValue<TKey, TVal>>;

interface UMapIteratorValue<TKey extends Variable, TVal extends Variable> extends InitValue<UMapIteratorVariable<TKey, TVal>> {
    members: {
        "bstack": InitIndexPointerVariable<PointerVariable<UMapBranchVariable<TKey, TVal>>>,
        "istack": InitIndexPointerVariable<InitArithmeticVariable>,
        "slen": InitArithmeticVariable,
        "link": PointerVariable<UMapLinkVariable<TKey, TVal>>,
    }
}

// unordered_map_branch_node

interface UMapBranchType<TKey extends ObjectType, TVal extends ObjectType> extends AbstractTemplatedClassType<null, [TKey, TVal]> {
    readonly identifier: "unordered_map_branch_node",
}

type UMapBranchVariable<TKey extends Variable, TVal extends Variable> = AbstractVariable<UMapBranchType<TKey["t"], TVal["t"]>, UMapBranchValue<TKey, TVal>>;

interface UMapBranchValue<TKey extends Variable, TVal extends Variable> extends InitValue<UMapBranchVariable<TKey, TVal>> {
    members: {
        "branches": InitIndexPointerVariable<PointerVariable<UMapBranchVariable<TKey, TVal>>>,
        "leaves": InitIndexPointerVariable<PointerVariable<UMapLinkVariable<TKey, TVal>>>,
        "size": InitArithmeticVariable,
    }
}

// unordered_map_link_node

interface UMapLinkType<TKey extends ObjectType, TVal extends ObjectType> extends AbstractTemplatedClassType<null, [TKey, TVal]> {
    readonly identifier: "unordered_map_link_node",
}

type UMapLinkVariable<TKey extends Variable, TVal extends Variable> = AbstractVariable<UMapLinkType<TKey["t"], TVal["t"]>, UMapLinkValue<TKey, TVal>>;

interface UMapLinkValue<TKey extends Variable, TVal extends Variable> extends InitValue<UMapLinkVariable<TKey, TVal>> {
    members: {
        "child": PairVariable<TKey, TVal>,
        "next": PointerVariable<UMapLinkVariable<TKey, TVal>>,
    }
}

export = {
    load(rt: CRuntime) {
        rt.include("functional");
        rt.include("iterator");
        rt.include("utility");

        const BITS_HASH: number = 16;
        const BITS_BRANCH: number = 4;
        const STACK_SIZE: number = ((BITS_HASH + BITS_BRANCH - 1) / BITS_BRANCH) & 0xffffffff;

        type __pair = PairVariable<Variable, Variable>;
        type __umap = UMapVariable<Variable, Variable>;
        type __umap_iter = UMapIteratorVariable<Variable, Variable>;
        type __branch = UMapBranchVariable<Variable, Variable>;
        type __dptr_branch = InitDirectPointerVariable<__branch>;
        type __link = UMapLinkVariable<Variable, Variable>;
        type __dptr_link = InitDirectPointerVariable<__link>;
        type __pair_iterator_bool = PairVariable<__umap_iter, InitArithmeticVariable>

        const _createUMapBranchType: (templateSpec: [ObjectType, ObjectType]) => __branch['t'] = (templateSpec) => ({
            "sig": "CLASS",
            "identifier": "unordered_map_branch_node",
            "memberOf": null,
            templateSpec
        });

        const _createUMapLinkType: (templateSpec: [ObjectType, ObjectType]) => __link['t'] = (templateSpec) => ({
            "sig": "CLASS",
            "identifier": "unordered_map_link_node",
            "memberOf": null,
            templateSpec
        });

        const _createUMapIterType: (templateSpec: [ObjectType, ObjectType]) => __umap_iter['t'] = (templateSpec) => ({
            "sig": "CLASS",
            "identifier": "unordered_map_iterator",
            "memberOf": null,
            templateSpec
        });

        // ---
        // --- unordered_map_iterator
        // ---

        //const umapIteratorSig = "!ParamObject !ParamObject CLASS unordered_map_iterator < ?0 ?1 >".split(" ");

        const _iteratorFactory: (dataItem: __umap_iter['t']) => __umap_iter['v']['members'] = (dataItem: __umap_iter['t']) => {
            const umapBranchType = _createUMapBranchType(dataItem.templateSpec);
            const umapLinkType = _createUMapLinkType(dataItem.templateSpec);
            let bmem = variables.arrayMemory<PointerVariable<__branch>>(variables.pointerType(umapBranchType, null), []);
            for (let i = 0; i < STACK_SIZE; i++) {
                bmem.values.push((variables.uninitPointer(bmem.objectType.pointee, null, { array: bmem, index: i }) as PointerVariable<__branch>).v);
            }
            let imem = variables.arrayMemory<InitArithmeticVariable>(variables.arithmeticType("I64"), []);
            for (let i = 0; i < STACK_SIZE; i++) {
                imem.values.push((variables.arithmetic("I64", 0, { array: imem, index: i })).v);
            }
            return {
                bstack: variables.indexPointer(bmem, 0, true, "SELF"),
                istack: variables.indexPointer(imem, 0, true, "SELF"),
                slen: variables.arithmetic("I64", 0, "SELF"),
                link: variables.uninitPointer(umapLinkType, null, "SELF"),
            } as __umap_iter['v']['members'];
        };

        const _createUMapIterVar: (umapIterType: __umap_iter['t']) => __umap_iter = (umapIterType) => ({
            t: umapIterType,
            v: {
                isConst: false,
                state: "INIT",
                lvHolder: "SELF",
                members: _iteratorFactory(umapIterType)
            }
        });

        // satisfies LegacyForwardIterator
        rt.defineStruct2("{global}", "unordered_map_iterator", {
            numTemplateArgs: 2,
            factory: _iteratorFactory
        }, ["bstack", "istack", "slen", "link"], {});

        function _iter_next(thisVar: __umap_iter): "VOID" {
            if (thisVar.v.members.link.v.state === "INIT") {
                let link = thisVar.v.members.link as __dptr_link;
                if (link.v.pointee.members.next.v.state === "INIT") {
                    link.v.pointee = (link.v.pointee.members.next as __dptr_link).v.pointee;
                    return "VOID";
                }
            }
            const slen = thisVar.v.members.slen;
            const istackArr = thisVar.v.members.istack.v.pointee.values;
            const bstackArr = thisVar.v.members.bstack.v.pointee.values;
            while (true) {
                if (slen.v.value < STACK_SIZE) {
                    let is_any: boolean = false;
                    for (let i = istackArr[slen.v.value - 1].value; i < (1 << BITS_BRANCH); i++) {
                        if ((bstackArr[slen.v.value - 1] as __dptr_branch['v']).pointee.members.branches.v.pointee.values[i].state === "INIT") {
                            istackArr[slen.v.value - 1].value = i + 1;
                            istackArr[slen.v.value].value = 0;
                            bstackArr[slen.v.value].state = "INIT";
                            (bstackArr[slen.v.value] as __dptr_branch['v']).subtype = "DIRECT";
                            (bstackArr[slen.v.value] as __dptr_branch['v']).pointee = ((bstackArr[slen.v.value - 1] as __dptr_branch['v']).pointee.members.branches.v.pointee.values[i] as __dptr_branch['v']).pointee;
                            slen.v.value++;
                            is_any = true;
                            break;
                        }
                        istackArr[slen.v.value - 1].value++;
                    }
                    if (!is_any) {
                        slen.v.value--;
                        if (slen.v.value == 0) {
                            thisVar.v.members.link.v.state = "UNINIT";
                            return "VOID";
                        }
                    }
                } else {
                    for (let i = istackArr[slen.v.value - 1].value; i < (1 << BITS_BRANCH); i++) {
                        if ((bstackArr[slen.v.value - 1] as __dptr_branch['v']).pointee.members.leaves.v.pointee.values[i].state === "INIT") {
                            istackArr[slen.v.value - 1].value = i + 1;
                            thisVar.v.members.link.v.state = "INIT";
                            (thisVar.v.members.link as __dptr_link).v.subtype = "DIRECT";
                            (thisVar.v.members.link as __dptr_link).v.pointee = ((bstackArr[slen.v.value - 1] as __dptr_branch['v']).pointee.members.leaves.v.pointee.values[i] as __dptr_link['v']).pointee;
                            return "VOID";
                        }
                    }
                    slen.v.value--;
                }
            }
        }

        const umapIteratorCtorList: common.OpHandler[] = [
            {
                op: "o(_ctor)",
                type: "!ParamObject !ParamObject FUNCTION CLASS unordered_map_iterator < ?0 ?1 > ( )",
                default(_rt: CRuntime, templateTypes: [__umap_iter['t']]): __umap_iter {
                    const thisType = templateTypes[0];
                    const thisVar: __umap_iter = _createUMapIterVar(thisType);

                    return thisVar;
                }
            },
            {
                op: "o(_ctor)",
                type: "!ParamObject !ParamObject FUNCTION CLASS unordered_map_iterator < ?0 ?1 > ( CLREF CLASS unordered_map_iterator < ?0 ?1 > )",
                default(rt: CRuntime, templateTypes: [__umap_iter['t']], x: __umap_iter): __umap_iter {
                    const thisType = templateTypes[0];
                    const thisVar: __umap_iter = _createUMapIterVar(thisType);
                    thisVar.v.members.slen.v.value = x.v.members.slen.v.value;
                    variables.directPointerAssign(rt, thisVar.v.members.link, x.v.members.link);
                    for (let i = 0; i < STACK_SIZE; i++) {
                        if (x.v.members.bstack.v.pointee.values[i].state === "INIT") {
                            thisVar.v.members.bstack.v.pointee.values[i].state = "INIT";
                            (thisVar.v.members.bstack.v.pointee.values[i] as any).subtype = "DIRECT";
                            (thisVar.v.members.bstack.v.pointee.values[i] as any).pointee = (x.v.members.bstack.v.pointee.values[i] as __dptr_branch['v']).pointee;
                        }
                        thisVar.v.members.istack.v.pointee.values[i].value = x.v.members.istack.v.pointee.values[i].value;
                    }

                    return thisVar;
                }
            },
            {
                op: "o(_ctor)",
                type: "!ParamObject !ParamObject FUNCTION CLASS unordered_map_iterator < ?0 ?1 > ( PTR CLASS unordered_map_branch_node < ?0 ?1 > )",
                default(_rt: CRuntime, templateTypes: [__umap_iter['t']], top: __dptr_branch): __umap_iter {
                    const thisType = templateTypes[0];
                    const thisVar: __umap_iter = _createUMapIterVar(thisType);
                    thisVar.v.members.slen.v.value = 1;
                    thisVar.v.members.bstack.v.pointee.values[0].state = "INIT";
                    (thisVar.v.members.bstack.v.pointee.values[0] as __dptr_branch['v']).subtype = "DIRECT";
                    (thisVar.v.members.bstack.v.pointee.values[0] as __dptr_branch['v']).pointee = top.v.pointee;
                    _iter_next(thisVar);

                    return thisVar;
                }
            },
            {
                op: "o(_ctor)",
                type: "!ParamObject !ParamObject FUNCTION CLASS unordered_map_iterator < ?0 ?1 > ( PTR PTR CLASS unordered_map_branch_node < ?0 ?1 > PTR I32 PTR CLASS unordered_map_link_node < ?0 ?1 > )",
                default(_rt: CRuntime, templateTypes: [__umap_iter['t']], bstack: InitIndexPointerVariable<PointerVariable<__branch>>, istack: InitIndexPointerVariable<InitArithmeticVariable>, link: PointerVariable<__link>): __umap_iter {
                    const thisType = templateTypes[0];
                    const thisVar: __umap_iter = _createUMapIterVar(thisType);
                    thisVar.v.members.slen.v.value = STACK_SIZE;
                    thisVar.v.members.bstack.v.pointee.values[0].state = "INIT";
                    for (let i = 0; i < STACK_SIZE; i++) {
                        if (bstack.v.pointee.values[i].state === "INIT") {
                            thisVar.v.members.bstack.v.pointee.values[i].state = "INIT";
                            (thisVar.v.members.bstack.v.pointee.values[i] as __dptr_branch['v']).subtype = "DIRECT";
                            (thisVar.v.members.bstack.v.pointee.values[i] as __dptr_branch['v']).pointee = (bstack.v.pointee.values[i] as __dptr_branch['v']).pointee;
                        }
                        thisVar.v.members.istack.v.pointee.values[i].value = istack.v.pointee.values[i].value;
                    }
                    if (link.v.state === "INIT") {
                        thisVar.v.members.link.v.state = "INIT";
                        (thisVar.v.members.link.v as any).subtype = "DIRECT";
                        (thisVar.v.members.link.v as any).pointee = link.v.pointee;
                    }

                    return thisVar;
                }
            }
        ];
        for (const umapIteratorCtor of umapIteratorCtorList) {
            rt.regFunc(umapIteratorCtor.default, variables.classType("unordered_map_iterator", [], null), umapIteratorCtor.op, rt.typeSignature(umapIteratorCtor.type), [-1]);
        }
        common.regOps(rt, [
            {
                op: "o(*_)",
                type: "!ParamObject !ParamObject FUNCTION LREF CLASS pair < ?0 ?1 > ( LREF CLASS unordered_map_iterator < ?0 ?1 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __umap_iter): __pair {
                    if (thisVar.v.members.link.v.state === "INIT") {
                        return (thisVar.v.members.link as __dptr_link).v.pointee.members.child;
                    }
                    rt.raiseException("unordered_map_iterator::operator*(): Attempted dereference of a null-iterator");
                }

            },
            {
                op: "o(++_)",
                type: "!ParamObject !ParamObject FUNCTION LREF CLASS unordered_map_iterator < ?0 ?1 > ( LREF CLASS unordered_map_iterator < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: [], thisVar: __umap_iter): __umap_iter {
                    _iter_next(thisVar);
                    return thisVar;
                }
            },
            {
                op: "o(_++)",
                type: "!ParamObject !ParamObject FUNCTION LREF CLASS unordered_map_iterator < ?0 ?1 > ( LREF CLASS unordered_map_iterator < ?0 ?1 > )",
                default(rt: CRuntime, _templateTypes: [], thisVar: __umap_iter): __umap_iter {
                    const thatVar = variables.clone(rt, thisVar, null, false);
                    _iter_next(thisVar);
                    return thatVar;
                }
            },
            {
                op: "o(_==_)",
                type: "!ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS unordered_map_iterator < ?0 ?1 > CLREF CLASS unordered_map_iterator < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: [], lhs: __umap_iter, rhs: __umap_iter): InitArithmeticVariable {
                    if (lhs.v.members.link.v.state === "UNINIT" || rhs.v.members.link.v.state === "UNINIT") {
                        return variables.arithmetic("BOOL", lhs.v.members.link.v.state === rhs.v.members.link.v.state ? 1 : 0, null);
                    }
                    return variables.arithmetic("BOOL", lhs.v.members.link.v.pointee === rhs.v.members.link.v.pointee ? 1 : 0, null);
                }
            },
            {
                op: "o(_!=_)",
                type: "!ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS unordered_map_iterator < ?0 ?1 > CLREF CLASS unordered_map_iterator < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: [], lhs: __umap_iter, rhs: __umap_iter): InitArithmeticVariable {
                    if (lhs.v.members.link.v.state === "UNINIT" || rhs.v.members.link.v.state === "UNINIT") {
                        return variables.arithmetic("BOOL", (lhs.v.members.link.v.state !== rhs.v.members.link.v.state) ? 1 : 0, null);
                    }
                    return variables.arithmetic("BOOL", (lhs.v.members.link.v.pointee !== rhs.v.members.link.v.pointee) ? 1 : 0, null);
                }
            },
        ]);

        // ---
        // --- unordered_map_branch_node
        // ---

        rt.defineStruct2("{global}", "unordered_map_branch_node", {
            numTemplateArgs: 2,
            factory: function(dataItem: __branch['t']): MemberMap {
                const umapBranchType = dataItem;
                const umapLinkType = _createUMapLinkType(dataItem.templateSpec);
                let bmem = variables.arrayMemory<PointerVariable<__branch>>(variables.pointerType(umapBranchType, null), []);
                for (let i = 0; i < (1 << BITS_BRANCH); i++) {
                    bmem.values.push((variables.uninitPointer(bmem.objectType.pointee, null, { array: bmem, index: i }) as PointerVariable<__branch>).v);
                }
                let lmem = variables.arrayMemory<PointerVariable<__link>>(variables.pointerType(umapLinkType, null), []);
                for (let i = 0; i < (1 << BITS_BRANCH); i++) {
                    lmem.values.push((variables.uninitPointer(lmem.objectType.pointee, null, { array: lmem, index: i }) as PointerVariable<__link>).v);
                }
                return {
                    branches: variables.indexPointer(bmem, 0, true, "SELF"),
                    leaves: variables.indexPointer(lmem, 0, true, "SELF"),
                    size: variables.arithmetic("I64", 0, "SELF"),
                };
            }
        }, ["branches", "leaves", "size"], {});

        function _branch_clear(thisVal: __branch['v']): void {
            for (let i = 0; i < (1 << BITS_BRANCH); i++) {
                if (thisVal.members.branches.v.pointee.values[i].state === "INIT") {
                    _branch_clear((thisVal.members.branches.v.pointee.values[i] as __dptr_branch['v']).pointee);
                    ((thisVal.members.branches.v.pointee.values[i] as __dptr_branch['v']).pointee as any).lvHolder = "UNBOUND";
                    delete (thisVal.members.branches.v.pointee.values[i] as any).pointee;
                    thisVal.members.branches.v.pointee.values[i].state = "UNINIT";
                }
                if (thisVal.members.leaves.v.pointee.values[i].state === "INIT") {
                    // no destructor for __link
                    ((thisVal.members.leaves.v.pointee.values[i] as __dptr_link['v']).pointee as any).lvHolder = "UNBOUND";
                    delete (thisVal.members.leaves.v.pointee.values[i] as any).pointee;
                    thisVal.members.leaves.v.pointee.values[i].state = "UNINIT";
                }
            }
            thisVal.members.size.v.value = 0;
        }

        const umapBranchCtorList: common.OpHandler[] = [
            {
                op: "o(_ctor)",
                type: "!ParamObject !ParamObject FUNCTION CLASS unordered_map_branch_node < ?0 ?1 > ( )",
                *default(rt: CRuntime, templateTypes: [__branch['t']]): Gen<__branch> {
                    const thisType = templateTypes[0];
                    const thisVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<__branch>;

                    return thisVar;
                }
            },
        ];
        for (const umapBranchCtor of umapBranchCtorList) {
            rt.regFunc(umapBranchCtor.default, variables.classType("unordered_map_branch_node", [], null), umapBranchCtor.op, rt.typeSignature(umapBranchCtor.type), [-1]);
        }

        // ---
        // --- unordered_map_link_node
        // ---

        rt.defineStruct2("{global}", "unordered_map_link_node", {
            numTemplateArgs: 2,
            factory: function*(dataItem: __link['t']): Gen<MemberMap> {
                const tkey = dataItem.templateSpec[0];
                const tval = dataItem.templateSpec[1];
                const next = variables.uninitPointer(dataItem, null, "SELF") as PointerVariable<__link>;
                const childType: __pair['t'] = {
                    "identifier": "pair",
                    "sig": "CLASS",
                    "memberOf": null,
                    "templateSpec": [tkey, tval]
                };
                const child = (yield* rt.defaultValue2(childType, "SELF")) as __pair;
                return {
                    child,
                    next,
                };
            }
        }, ["child", "next"], {});

        const umapLinkCtorList: common.OpHandler[] = [
            {
                op: "o(_ctor)",
                type: "!ParamObject !ParamObject FUNCTION CLASS unordered_map_link_node < ?0 ?1 > ( )",
                *default(rt: CRuntime, templateTypes: [__link['t']]): Gen<__link> {
                    const thisType = templateTypes[0];
                    const thisVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<__link>;

                    return thisVar;
                }
            },
        ];
        for (const umapLinkCtor of umapLinkCtorList) {
            rt.regFunc(umapLinkCtor.default, variables.classType("unordered_map_link_node", [], null), umapLinkCtor.op, rt.typeSignature(umapLinkCtor.type), [-1]);
        }

        // ---
        // --- unordered_map
        // ---

        const umapSig = "!ParamObject !ParamObject CLASS unordered_map < ?0 ?1 >".split(" ");
        rt.defineStruct2("{global}", "unordered_map", {
            numTemplateArgs: 2,
            factory: function*(dataItem: __umap['t']): Gen<MemberMap> {
                const branchType: __branch['t'] = {
                    "identifier": "unordered_map_branch_node",
                    "sig": "CLASS",
                    "memberOf": null,
                    "templateSpec": dataItem.templateSpec
                }
                const branchVar = yield* rt.defaultValue2(branchType, "SELF") as Gen<__branch>;
                return {
                    tree: branchVar,
                }
            }
        }, ["tree"], {
            ["key_type"]: [{ src: umapSig, dst: ["?0"] }],
            ["mapped_type"]: [{ src: umapSig, dst: ["?1"] }],
            ["value_type"]: [{ src: umapSig, dst: ["CLASS", "pair", "<", "?0", "?1", ">"] }],
            ["iterator"]: [{ src: umapSig, dst: ["CLASS", "unordered_map_iterator", "<", "?0", "?1", ">"] }], // implementation-dependent
            ["pointer"]: [{ src: umapSig, dst: ["PTR", "CLASS", "pair", "<", "?0", "?1", ">"] }],
            ["reference"]: [{ src: umapSig, dst: ["LREF", "CLASS", "pair", "<", "?0", "?1", ">"] }],
            ["const_reference"]: [{ src: umapSig, dst: ["CLREF", "CLASS", "pair", "<", "?0", "?1", ">"] }],
        });

        rt.explicitListInitTable["unordered_map"] = (umap: __umap['t']) => ({ sig: "CLASS", identifier: "pair", templateSpec: umap.templateSpec, memberOf: null });

        const umapCtorList: common.OpHandler[] = [
            {
                op: "o(_ctor)",
                type: "!ParamObject !ParamObject FUNCTION CLASS unordered_map < ?0 ?1 > ( )",
                *default(rt: CRuntime, templateTypes: [__umap['t']]): Gen<__umap> {
                    const thisType = templateTypes[0];
                    const thisVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<__umap>;

                    return thisVar;
                }
            },
            {
                op: "o(_ctor)",
                type: "!ParamObject !ParamObject FUNCTION CLASS unordered_map < ?0 ?1 > ( CLASS initializer_list < CLASS pair < ?0 ?1 > > )",
                *default(rt: CRuntime, _templateTypes: [__umap['t']], list: InitializerListVariable<__pair>): Gen<__umap> {
                    const thisType = variables.classType("unordered_map", list.t.templateSpec[0].templateSpec, null);
                    const thisVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<__umap>;
                    const listmem = list.v.members._values.v.pointee;

                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable) as __pair;
                        yield* _insert(rt, thisVar, currentValue);
                    }

                    return thisVar;
                }
            }
        ];
        for (const umapCtor of umapCtorList) {
            rt.regFunc(umapCtor.default, variables.classType("unordered_map", [], null), umapCtor.op, rt.typeSignature(umapCtor.type), [-1]);
        }

        /*const ctorHandler2: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS unordered_map < ?0 > ( PTR ?0 PTR ?0 )",
            *default(rt: CRuntime, _templateTypes: ObjectType[], _begin: PointerVariable<Variable>, _end: PointerVariable<Variable>): Gen<__umap> {
                const begin = variables.asInitIndexPointer(_begin) ?? rt.raiseException("unordered_map constructor: expected valid begin iterator");
                const end = variables.asInitIndexPointer(_end) ?? rt.raiseException("unordered_map constructor: expected valid end iterator");

                if (begin.v.pointee !== end.v.pointee) {
                    rt.raiseException("unordered_map constructor: iterators must point to same memory region");
                }

                const elementType = begin.v.pointee.objectType;
                const thisType = variables.classType("unordered_map", [elementType], null);
                const thisVar = yield* rt.defaultValue2(thisType, "SELF") as Gen<__umap>;

                for (let i = begin.v.index; i < end.v.index; i++) {
                    const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable) as __pair;
                    yield* _insert(rt, thisVar, currentValue);
                }

                return thisVar;
            }
        };*/

        function _createIterDirectly(bstack: __branch[], istack: number[], linkType: __link['t'], linkPointeeVal: __link['v']): __umap_iter {
            const link: __dptr_link = {
                t: variables.pointerType(linkType, null),
                v: {
                    lvHolder: "SELF",
                    isConst: false,
                    state: "INIT",
                    subtype: "DIRECT",
                    pointee: linkPointeeVal
                }
            }

            const bstackMemory = variables.arrayMemory<__dptr_branch>(variables.pointerType(bstack[0].t, null), []);
            for (let i = 0; i < STACK_SIZE; i++) {
                bstackMemory.values.push({ isConst: false, lvHolder: { array: bstackMemory, index: i }, state: "INIT", subtype: "DIRECT", pointee: bstack[i].v });
            }

            const bstackVar: InitIndexPointerVariable<__dptr_branch> = variables.indexPointer(bstackMemory, 0, true, "SELF");
            const istackMemory = variables.arrayMemory<InitArithmeticVariable>({ sig: "I64" }, []);
            for (let i = 0; i < STACK_SIZE; i++) {
                istackMemory.values.push({ isConst: false, lvHolder: { array: istackMemory, index: i }, state: "INIT", value: istack[i] });
            }
            const istackVar: InitIndexPointerVariable<InitArithmeticVariable> = variables.indexPointer(istackMemory, 0, true, "SELF");

            const iterType: __umap_iter['t'] = _createUMapIterType(linkType.templateSpec);
            const iter: __umap_iter = {
                t: iterType,
                v: {
                    isConst: false,
                    state: "INIT",
                    lvHolder: "SELF",
                    members: {
                        bstack: bstackVar,
                        istack: istackVar,
                        link,
                        slen: variables.arithmetic("I64", STACK_SIZE, "SELF")
                    }
                }
            };
            return iter;

        }

        function* _insert(rt: CRuntime, thisVar: __umap, pair: __pair): Gen<__pair_iterator_bool> {
            let bstack = new Array<__branch>(STACK_SIZE);
            let istack = new Array<number>(STACK_SIZE);
            bstack[0] = thisVar.v.members.tree;
            {
                const hashFunc = rt.getFuncByParams("{global}", "__hash", [
                    pair.v.members.first,
                ], []);
                const hashYield = rt.invokeCall(hashFunc, [], pair.v.members.first);
                const hashOrVoid = asResult(hashYield) ?? (yield* hashYield as Gen<MaybeUnboundVariable | "VOID">);
                if (hashOrVoid === "VOID") {
                    rt.raiseException("unordered_map::insert(): call to __hash() unexpectedly returned void");
                }
                let h = rt.arithmeticValue(hashOrVoid);
                h &= (1 << BITS_HASH) - 1;
                for (let i = BITS_BRANCH; i < BITS_HASH; i += BITS_BRANCH) {
                    istack[(i / BITS_BRANCH) - 1] = h & ((1 << BITS_BRANCH) - 1);
                    h >>= BITS_BRANCH;
                }
                istack[STACK_SIZE - 1] = h;
            }
            for (let i = 1; i < STACK_SIZE; i++) {
                const child = bstack[i - 1].v.members.branches.v.pointee.values[istack[i - 1]];
                if (child.state === "UNINIT") {
                    const newChild: __branch = yield* rt.defaultValue2(bstack[i - 1].t, "SELF") as Gen<__branch>;
                    (child as any).state = "INIT";
                    (child as any).subtype = "DIRECT";
                    (child as any).pointee = newChild.v;
                }
                bstack[i] = { "t": bstack[i - 1].t, "v": (child as __dptr_branch['v']).pointee };
            }
            const ilast = istack[STACK_SIZE - 1];
            const blast = bstack[STACK_SIZE - 1];
            const linkType = _createUMapLinkType(pair.t.templateSpec);

            function create_result(linkPointeeVal: __link['v'], second: boolean): __pair_iterator_bool {
                const iterType: __umap_iter['t'] = _createUMapIterType(thisVar.t.templateSpec);
                const ipair: __pair_iterator_bool = {
                    t: {
                        sig: "CLASS",
                        identifier: "pair",
                        memberOf: null,
                        templateSpec: [iterType, { sig: "BOOL" }]
                    },
                    v: {
                        isConst: false,
                        lvHolder: null,
                        state: "INIT",
                        members: {
                            first: _createIterDirectly(bstack, istack, linkType, linkPointeeVal),
                            second: variables.arithmetic("BOOL", second ? 1 : 0, "SELF")
                        }
                    }
                };
                return ipair;
            }

            if (blast.v.members.leaves.v.pointee.values[ilast].state === "UNINIT") {
                const newLink: __link['v'] = {
                    isConst: false,
                    state: "INIT",
                    lvHolder: "SELF",
                    members: {
                        child: { "t": pair.t, "v": { ...pair.v } },
                        next: { "t": { "sig": "PTR", pointee: linkType, sizeConstraint: null }, "v": { state: "UNINIT", isConst: false, lvHolder: "SELF" } }
                    }
                };
                blast.v.members.leaves.v.pointee.values[ilast].state = "INIT";
                (blast.v.members.leaves.v.pointee.values[ilast] as __dptr_link['v']).subtype = "DIRECT";
                (blast.v.members.leaves.v.pointee.values[ilast] as __dptr_link['v']).pointee = newLink;
                for (const branch of bstack) {
                    branch.v.members.size.v.value++;
                }

                return create_result((blast.v.members.leaves.v.pointee.values[ilast] as __dptr_link['v']).pointee, true);
                // return {iterator(bstack, istack, blast->leaves[ilast]), true};
            }
            let link: __dptr_link['v'] = blast.v.members.leaves.v.pointee.values[ilast] as __dptr_link['v'];
            const eqFunc = rt.getOpByParams("{global}", "o(_==_)", [link.pointee.members.child.v.members.first, pair.v.members.first], []);

            while (true) {
                const eqYield = rt.invokeCall(eqFunc, [], link.pointee.members.child.v.members.first, pair.v.members.first);
                const eqOrVoid = asResult(eqYield) ?? (yield* eqYield as Gen<MaybeUnboundVariable | "VOID">);
                if (eqOrVoid === "VOID") {
                    rt.raiseException("unordered_map::insert(): Unexpected void when calling operator==()");
                }
                const eq = rt.arithmeticValue(eqOrVoid);
                if (eq !== 0) {
                    return create_result(link.pointee, false);
                    // return {iterator(bstack, istack, link), false};
                }
                if (link.pointee.members.next.v.state === "UNINIT") {
                    const newLink: __link['v'] = {
                        isConst: false,
                        state: "INIT",
                        lvHolder: "SELF",
                        members: {
                            child: { "t": pair.t, "v": { ...pair.v } },
                            next: { "t": { "sig": "PTR", pointee: linkType, sizeConstraint: null }, "v": { state: "UNINIT", isConst: false, lvHolder: "SELF" } }
                        }
                    };
                    (link.pointee.members.next as __dptr_link).v.state = "INIT";
                    (link.pointee.members.next as __dptr_link).v.subtype = "DIRECT";
                    (link.pointee.members.next as __dptr_link).v.pointee = newLink;
                    for (const branch of bstack) {
                        branch.v.members.size.v.value++;
                    }
                    return create_result(newLink, true);
                    // return {iterator(bstack, istack, link->next), true};
                }
                link = link.pointee.members.next.v as __dptr_link['v'];
            }
        }

        function* _find(rt: CRuntime, thisVar: __umap, key: Variable): Gen<__umap_iter> {
            let bstack = new Array<__branch>(STACK_SIZE);
            let istack = new Array<number>(STACK_SIZE);
            bstack[0] = thisVar.v.members.tree;
            {
                const hashFunc = rt.getFuncByParams("{global}", "__hash", [
                    key,
                ], []);
                const hashYield = rt.invokeCall(hashFunc, [], key);
                const hashOrVoid = asResult(hashYield) ?? (yield* hashYield as Gen<MaybeUnboundVariable | "VOID">);
                if (hashOrVoid === "VOID") {
                    rt.raiseException("unordered_map::insert(): call to __hash() unexpectedly returned void");
                }
                let h = rt.arithmeticValue(hashOrVoid);
                h &= (1 << BITS_HASH) - 1;
                for (let i = BITS_BRANCH; i < BITS_HASH; i += BITS_BRANCH) {
                    istack[(i / BITS_BRANCH) - 1] = h & ((1 << BITS_BRANCH) - 1);
                    h >>= BITS_BRANCH;
                }
                istack[STACK_SIZE - 1] = h;
            }
            for (let i = 1; i < STACK_SIZE; i++) {
                const child = bstack[i - 1].v.members.branches.v.pointee.values[istack[i - 1]];
                if (child.state === "UNINIT") {
                    return _end(thisVar);
                }
                bstack[i] = { "t": bstack[i - 1].t, "v": (child as __dptr_branch['v']).pointee };
            }
            const ilast = istack[STACK_SIZE - 1];
            const blast = bstack[STACK_SIZE - 1];
            const linkType = _createUMapLinkType(thisVar.t.templateSpec);

            if (blast.v.members.leaves.v.pointee.values[ilast].state === "UNINIT") {
                return _end(thisVar);
                // return {iterator(bstack, istack, blast->leaves[ilast]), true};
            }
            let link: __dptr_link['v'] = blast.v.members.leaves.v.pointee.values[ilast] as __dptr_link['v'];
            const eqFunc = rt.getOpByParams("{global}", "o(_==_)", [link.pointee.members.child.v.members.first, key], []);

            while (true) {
                const eqYield = rt.invokeCall(eqFunc, [], link.pointee.members.child.v.members.first, key);
                const eqOrVoid = asResult(eqYield) ?? (yield* eqYield as Gen<MaybeUnboundVariable | "VOID">);
                if (eqOrVoid === "VOID") {
                    rt.raiseException("unordered_map::insert(): Unexpected void when calling operator==()");
                }
                const eq = rt.arithmeticValue(eqOrVoid);
                if (eq !== 0) {
                    return _createIterDirectly(bstack, istack, linkType, link.pointee);
                    // return {iterator(bstack, istack, link), false};
                }
                if (link.pointee.members.next.v.state === "UNINIT") {
                    return _end(thisVar);
                    // return {iterator(bstack, istack, link->next), true};
                }
                link = link.pointee.members.next.v as __dptr_link['v'];
            }
        }

        function _begin(_rt: CRuntime, thisVar: __umap): __umap_iter {
            const iter = _createUMapIterVar(_createUMapIterType(thisVar.t.templateSpec));
            iter.v.members.slen.v.value = 1;
            iter.v.members.bstack.v.pointee.values[0].state = "INIT";
            (iter.v.members.bstack.v.pointee.values[0] as __dptr_branch['v']).subtype = "DIRECT";
            (iter.v.members.bstack.v.pointee.values[0] as __dptr_branch['v']).pointee = thisVar.v.members.tree.v;
            _iter_next(iter);
            return iter;

        }

        function _end(thisVar: __umap): __umap_iter {
            return _createUMapIterVar(_createUMapIterType(thisVar.t.templateSpec));
        }

        common.regOps(rt, [
            {
                op: "o(_[_])",
                type: "!ParamObject !ParamObject FUNCTION LREF ?1 ( CLREF CLASS unordered_map < ?0 ?1 > CLREF ?0 )",
                *default(_rt: CRuntime, _templateTypes: ObjectType[], thisVar: __umap, index: Variable): Gen<Variable> {
                    const found = yield* _insert(rt, thisVar, {
                        t: {
                            sig: "CLASS",
                            identifier: "pair",
                            memberOf: null,
                            templateSpec: thisVar.t.templateSpec
                        },
                        v: {
                            state: "INIT",
                            lvHolder: "SELF",
                            isConst: false,
                            members: {
                                first: index,
                                second: yield* rt.defaultValue2(thisVar.t.templateSpec[1], "SELF")
                            }
                        }
                    });
                    return (found.v.members.first.v.members.link as __dptr_link).v.pointee.members.child.v.members.second;
                }
            }

        ]);

        common.regMemberFuncs(rt, "unordered_map", [
            {
                op: "begin",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( CLREF CLASS unordered_map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const thisVar = args[0] as __umap;
                    return _begin(rt, thisVar);
                }
            },
            {
                op: "end",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( CLREF CLASS unordered_map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const thisVar = args[0] as __umap;
                    return _end(thisVar);
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( LREF CLASS unordered_map < ?0 ?1 > CLASS initializer_list < CLASS pair < ?0 ?1 > > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<"VOID"> {
                    const thisVar = args[0] as __umap;
                    const list = args[1] as InitializerListVariable<__pair>;
                    const listmem = list.v.members._values.v.pointee;

                    for (let i = 0; i < listmem.values.length; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(listmem, i) as MaybeUnboundVariable) as __pair;
                        yield* _insert(rt, thisVar, currentValue);
                    }

                    return "VOID";
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION PTR ?0 ( LREF CLASS unordered_map < ?0 ?1 > CLREF CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<__pair_iterator_bool> {
                    const thisVar = args[0] as __umap;
                    const value = args[1] as __pair;
                    const iterator = yield* _insert(rt, thisVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION PTR ?0 ( LREF CLASS unordered_map < ?0 ?1 > PTR CLASS pair < ?0 ?1 > CLREF CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<__pair_iterator_bool> {
                    // same as above, ignoring the iterator
                    const thisVar = args[0] as __umap;
                    const value = args[2] as __pair;
                    const iterator = yield* _insert(rt, thisVar, value);
                    return iterator;
                }
            },
            {
                op: "insert",
                type: "!ParamObject !ParamObject FUNCTION VOID ( LREF CLASS unordered_map < ?0 ?1 > PTR CLASS pair < ?0 ?1 > PTR CLASS pair < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<"VOID"> {
                    const thisVar = args[0] as __umap;
                    const beginPtr = args[1] as PointerVariable<__pair>;
                    const endPtr = args[2] as PointerVariable<__pair>;

                    const begin = variables.asInitIndexPointer(beginPtr) ?? rt.raiseException("unordered_map::insert: expected valid begin iterator");
                    const end = variables.asInitIndexPointer(endPtr) ?? rt.raiseException("unordered_map::insert: expected valid end iterator");

                    if (begin.v.pointee !== end.v.pointee) {
                        rt.raiseException("unordered_map::insert: iterators must point to same memory region");
                    }

                    for (let i = begin.v.index; i < end.v.index; i++) {
                        const currentValue = rt.unbound(variables.arrayMember(begin.v.pointee, i) as MaybeUnboundVariable) as __pair;
                        yield* _insert(rt, thisVar, currentValue);
                    }

                    return "VOID";
                }
            },
            {
                op: "find",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( CLREF CLASS unordered_map < ?0 ?1 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<__umap_iter> {
                    const thisVar = args[0] as __umap;
                    const key = args[1];
                    return yield* _find(rt, thisVar, key);
                }
            },
            {
                op: "at",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( CLREF CLASS unordered_map < ?0 ?1 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): Gen<Variable> {
                    const thisVar = args[0] as __umap;
                    const key = args[1];
                    const found = yield* _find(rt, thisVar, key);
                    if (found.v.members.link.v.state === "UNINIT") {
                        rt.raiseException("unordered_map::at(): No such element (out_of_range)");
                    }
                    return (found.v.members.link as __dptr_link).v.pointee.members.child.v.members.second;
                }
            },
            {
                op: "clear",
                type: "!ParamObject !ParamObject FUNCTION VOID ( LREF CLASS unordered_map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]): "VOID" {
                    const thisVar = args[0] as __umap;
                    _branch_clear(thisVar.v.members.tree.v);
                    return "VOID";
                }
            },
            {
                op: "size",
                type: "!ParamObject !ParamObject FUNCTION I64 ( CLREF CLASS unordered_map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const thisVar = args[0] as __umap;
                    const sz = thisVar.v.members.tree.v.members.size.v.value;
                    return variables.arithmetic("I64", sz, null, false);
                }
            },
            {
                op: "empty",
                type: "!ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS unordered_map < ?0 ?1 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const thisVar = args[0] as __umap;
                    const sz = thisVar.v.members.tree.v.members.size.v.value;
                    return variables.arithmetic("BOOL", sz === 0 ? 1 : 0, null, false);
                }
            },
            {
                op: "erase",
                type: "!ParamObject !ParamObject FUNCTION PTR CLASS pair < ?0 ?1 > ( LREF CLASS unordered_map < ?0 ?1 > CLASS unordered_map_iterator < ?0 ?1 > )",
                *default(rt: CRuntime, _templateTypes: [], _thisVar: __umap, pos: __umap_iter): Gen<__umap_iter> {
                    if (pos.v.members.link.v.state === "UNINIT") {
                        rt.raiseException("unordered_map::erase(): Argument error (expected an iterator pointing to a member of a map");
                    }
                    const eit = variables.clone(rt, pos, null, false);
                    const eit_link = eit.v.members.link as __dptr_link;
                    _iter_next(pos);
                    let link: __dptr_link['v'] = (eit.v.members.bstack.v.pointee.values[STACK_SIZE - 1] as __dptr_branch['v']).pointee.members.leaves.v.pointee.values[eit.v.members.istack.v.pointee.values[STACK_SIZE - 1].value] as __dptr_link['v'];
                    if (link.pointee === eit_link.v.pointee) {
                        const tail = link.pointee.members.next;
                        (link.pointee as any).lvHolder = "UNBOUND";
                        delete (link as any).pointee;
                        if (tail.v.state === "UNINIT") {
                            (link as PointerValue<__link>).state = "UNINIT";
                        } else {
                            link.state = "INIT";
                            link.subtype = "DIRECT";
                            link.pointee = (tail as __dptr_link).v.pointee;
                        }
                    } else {
                        while (true) {
                            if ((link.pointee.members.next as __dptr_link).v.pointee === eit_link.v.pointee) {
                                const tail = (link.pointee.members.next as __dptr_link).v.pointee.members.next;
                                (link.pointee as any).lvHolder = "UNBOUND";
                                delete (link.pointee.members.next.v as any).pointee;
                                if (tail.v.state === "UNINIT") {
                                    link.pointee.members.next.v.state = "UNINIT";
                                } else {
                                    link.pointee.members.next.v.state = "INIT";
                                    (link.pointee.members.next as __dptr_link).v.subtype = "DIRECT";
                                    (link.pointee.members.next as __dptr_link).v.pointee = (tail as __dptr_link).v.pointee;
                                }
                                break;
                            }
                            link = link.pointee.members.next.v as __dptr_link['v'];
                        }
                    }
                    for (let i = STACK_SIZE - 1; i > 0; i--) {
                        (eit.v.members.bstack.v.pointee.values[i] as __dptr_branch['v']).pointee.members.size.v.value--;
                        if (i > 0 && (eit.v.members.bstack.v.pointee.values[i] as __dptr_branch['v']).pointee.members.size.v.value === 0) {
                            const parent_branch = (eit.v.members.bstack.v.pointee.values[i - 1] as __dptr_branch['v']).pointee.members.branches.v.pointee.values[eit.v.members.istack.v.pointee.values[i - 1].value];
                            ((parent_branch as __dptr_branch['v']).pointee as any).lvHolder = "UNBOUND";
                            delete (parent_branch as any).pointee;
                            parent_branch.state = "UNINIT";
                        }
                    }
                    (eit.v.members.bstack.v.pointee.values[0] as __dptr_branch['v']).pointee.members.size.v.value--;
                    return pos;
                }
            },
            {
                op: "erase",
                type: "!ParamObject !ParamObject FUNCTION U64 ( LREF CLASS unordered_map < ?0 ?1 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], ..._args: Variable[]): Gen<InitArithmeticVariable> {
                    rt.raiseException("unordered_map::erase(): Not yet implemented");
                    /*const thisVar = args[0] as __umap;
                    const key = args[1] as Variable;
                    const found = yield* _find(rt, thisVar, key);
                    if (found !== null) {
                        if (found.v.lvHolder === null || typeof (found.v.lvHolder) !== "object") {
                            rt.raiseException("unordered_map::find(): Expected an array member (internal error)")
                        }
                        const pairPtr = variables.indexPointer(found.v.lvHolder.array, found.v.lvHolder.index, false, null);
                        const eraseInst = rt.getFuncByParams(thisVar.v.members._data.t, "erase", [thisVar.v.members._data, pairPtr], []);
                        const eraseYield = rt.invokeCall(eraseInst, [], thisVar.v.members._data, pairPtr);
                        asResult(eraseYield) ?? (yield* eraseYield as Gen<Variable>);
                        return variables.arithmetic("U64", 1, null);
                    }
                    return variables.arithmetic("U64", 0, null);*/
                }
            },
            /*{
                op: "count",
                type: "!ParamObject FUNCTION I32 ( CLREF CLASS unordered_map < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const thisVar = args[0] as __umap;
                    const value = args[1];
                    const found = _find(rt, thisVar, value);
                    return variables.arithmetic("I32", found !== null ? 1 : 0, null, false);
                }
            },
            {
                op: "contains",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS unordered_map < ?0 > CLREF ?0 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], ...args: Variable[]) {
                    const thisVar = args[0] as __umap;
                    const value = args[1];
                    const found = _find(rt, thisVar, value);
                    return variables.arithmetic("BOOL", found !== null ? 1 : 0, null, false);
                }
            },
            */
        ])
    }
};

