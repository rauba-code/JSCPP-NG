import { asResult } from "../interpreter";
import { CRuntime, FunctionCallInstance, OpSignature } from "../rt";
import * as common from "../shared/common";
import { PairVariable } from "../shared/utility";
import { InitIndexPointerVariable, PointeeVariable, PointerVariable, Function, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ResultOrGen, MaybeLeftCV, ObjectType, InitDirectPointerVariable, ArithmeticVariable, PointerType } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.include("utility");

        function yieldBlocking(x: ResultOrGen<MaybeUnboundVariable | "VOID">): InitArithmeticVariable {
            if (asResult(x)) {
                if (x === "VOID") {
                    rt.raiseException("sort: expected arithmetic result, got VOID");
                }
                return variables.asInitArithmetic(rt.unbound(x as MaybeUnboundVariable)) ?? rt.raiseException("sort: expected arithmetic result");
            } else {
                const call = x as Gen<MaybeUnboundVariable | "VOID">;
                for (let i: number = 0; i < 100_000; i++) {
                    const _retv = call.next();
                    if (_retv.done === true) {
                        if (_retv.value === "VOID") {
                            rt.raiseException("sort: expected arithmetic result, got VOID");
                        }
                        return variables.asInitArithmetic(rt.unbound(_retv.value)) ?? rt.raiseException("sort: expected arithmetic result");
                    }
                }
            }
            rt.raiseException("<internal>: failed to invoke a given function (runtime limit exceeded)");
        }

        function sort_inner2(rt: CRuntime, _l: PointerVariable<PointeeVariable>, _r: PointerVariable<PointeeVariable>, _cmp: PointerVariable<Function> | null = null): "VOID" {
            if (_l.t.pointee.sig === "FUNCTION" || _r.t.pointee.sig === "FUNCTION") {
                rt.raiseException("sort: invalid argument")
            }
            const l: InitIndexPointerVariable<Variable> = variables.asInitIndexPointer(_l) ?? rt.raiseException("sort: expected a pointer to a memory region for the parameter 'first'");
            const r: InitIndexPointerVariable<Variable> = variables.asInitIndexPointer(_r) ?? rt.raiseException("sort: expected a pointer to a memory region for the parameter 'last'");
            if (l.v.pointee !== r.v.pointee) {
                rt.raiseException("sort: expected parameters 'first' and 'last' to point to a same memory region");
            }
            // alt. variant: variables.arrayMember(...)
            const region = l.v.pointee.values.slice(l.v.index, r.v.index - l.v.index).map(v => ({ t: l.v.pointee.objectType, v })) as Variable[];
            if (region.length === 0) {
                return "VOID";
            }
            let indexRegion: number[] = [];
            for (let i = 0; i < region.length; i++) {
                indexRegion.push(i);
            }
            const clref_t: MaybeLeftCV<ObjectType> = { t: l.v.pointee.objectType, v: { isConst: true, lvHolder: "SELF" } };
            const cmpFun = (_cmp !== null) ? (variables.asInitDirectPointer(_cmp) as InitDirectPointerVariable<Function> ?? rt.raiseException("sort: Parameter 'cmp' does not point to a function")) : null;
            const ltFun = (cmpFun === null) ? rt.getFuncByParams("{global}", "o(_<_)", [clref_t, clref_t], []) : null;
            function sortCmp(li: number, ri: number): number {
                // JavaScript specifically wants a symmetrical comparator, so we compare both sides
                // these return 0.0 or 1.0
                const lhs = region[li];
                const rhs = region[ri];
                const a_lt_b = yieldBlocking(cmpFun !== null ? rt.invokeCallFromVariable({ t: cmpFun.t.pointee, v: cmpFun.v.pointee }, lhs, rhs) : rt.invokeCall(ltFun as FunctionCallInstance, [], lhs, rhs)).v.value;
                const b_lt_a = yieldBlocking(cmpFun !== null ? rt.invokeCallFromVariable({ t: cmpFun.t.pointee, v: cmpFun.v.pointee }, rhs, lhs) : rt.invokeCall(ltFun as FunctionCallInstance, [], rhs, lhs)).v.value;
                // return -2.0, 0.0, or 2.0
                return b_lt_a - a_lt_b;

            }
            indexRegion.sort(sortCmp);
            indexRegion.forEach((ri, ci) => {
                l.v.pointee.values[l.v.index + ci] = { lvHolder: { array: l.v.pointee.values, index: l.v.index + ci }, ...region[ri].v }
            });
            return "VOID";
        }
        function* extreme_element(rt: CRuntime, _first: PointerVariable<PointeeVariable>, _last: PointerVariable<PointeeVariable>, fnname: string, op: OpSignature): Gen<InitIndexPointerVariable<Variable>> {
            const first = variables.asInitIndexPointer(_first) ?? rt.raiseException(fnname + "(): Expected 'first' to point to an element");
            const last = variables.asInitIndexPointer(_last) ?? rt.raiseException(fnname + "(): Expected 'last' to point to an element");
            if (first.v.pointee !== last.v.pointee) {
                rt.raiseException(fnname + "(): Expected 'first' and 'last' to point to an element of the same memory region");
            }
            const mini = variables.indexPointer(first.v.pointee, first.v.index++, false, null);
            const cmpInst = rt.getOpByParams("{global}", op, [rt.unbound(variables.deref(first) as MaybeUnboundVariable), rt.unbound(variables.deref(mini) as MaybeUnboundVariable)], []);
            for (; first.v.index < last.v.index; first.v.index++) {
                const cmpYield = rt.invokeCall(cmpInst, [], rt.unbound(variables.deref(first) as MaybeUnboundVariable), rt.unbound(variables.deref(mini) as MaybeUnboundVariable)) as ResultOrGen<ArithmeticVariable>;
                const cmpResult = rt.arithmeticValue(asResult(cmpYield) ?? (yield* cmpYield as Gen<ArithmeticVariable>))
                if (cmpResult !== 0) {
                    mini.v.index = first.v.index;
                }
            }
            return mini;
        }

        // template<typename RandomIt> void sort(RandomIt first, RandomIt last)
        // C++ Reference does not define RandomIt.
        // It can be any value (here: 'val') that satisfies these conditions:
        // 1) RandomIt is MoveConstructible (can be constructed from computed value)
        // 2) RandomIt is CopyConstructible (exists a copy constructor)
        // 3) RandomIt is CopyAssignable (copy-assignment through operator=())
        // 4) RandomIt is Destructible.
        // 5) RandomIt is Swappable (std::swap(a, b) is possible)
        // 6) RandomIt is ValueSwappable ((*RandomIt) is Swappable).
        // 7) (*RandomIt) is MoveConstructible
        // 8) (*RandomIt) is MoveAssignable
        // 9 unwritten) Exists (*val1 < *val2).
        // 10 unwritten) Exists (val1 - val2).
        //rt.regFunc(sort_inner, "global", "sort", ["?"], rt.voidTypeLiteral);
        // JavaScript Array.sort() is always stable
        //rt.regFunc(sort_inner, "global", "stable_sort", ["?"], rt.voidTypeLiteral);
        common.regGlobalFuncs(rt, [
            {
                op: "sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes: [], lhs: PointerVariable<PointeeVariable>, rhs: PointerVariable<PointeeVariable>): "VOID" { return sort_inner2(rt, lhs, rhs); }
            },
            {
                op: "sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 PTR FUNCTION BOOL ( CLREF ?0 CLREF ?0 ) )",
                default(rt: CRuntime, _templateTypes: [], lhs: PointerVariable<PointeeVariable>, rhs: PointerVariable<PointeeVariable>, cmp: PointerVariable<Function>): "VOID" { return sort_inner2(rt, lhs, rhs, cmp); }
            },
            {
                op: "stable_sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes: [], lhs: PointerVariable<PointeeVariable>, rhs: PointerVariable<PointeeVariable>): "VOID" { return sort_inner2(rt, lhs, rhs); }
            },
            {
                op: "stable_sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 PTR FUNCTION BOOL ( CLREF ?0 CLREF ?0 ) )",
                default(rt: CRuntime, _templateTypes: [], lhs: PointerVariable<PointeeVariable>, rhs: PointerVariable<PointeeVariable>, cmp: PointerVariable<Function>): "VOID" { return sort_inner2(rt, lhs, rhs, cmp); }
            },
            {
                op: "reverse",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes: [], lhs: PointerVariable<PointeeVariable>, rhs: PointerVariable<PointeeVariable>): "VOID" {
                    const l: InitIndexPointerVariable<Variable> = variables.asInitIndexPointer(lhs) ?? rt.raiseException("sort: expected a pointer to a memory region for the parameter 'first'");
                    const r: InitIndexPointerVariable<Variable> = variables.asInitIndexPointer(rhs) ?? rt.raiseException("sort: expected a pointer to a memory region for the parameter 'last'");
                    if (l.v.pointee !== r.v.pointee) {
                        rt.raiseException("sort: expected parameters 'first' and 'last' to point to a same memory region");
                    }
                    const region = l.v.pointee.values.slice(l.v.index, r.v.index - l.v.index).map(v => ({ t: l.v.pointee.objectType, v })) as Variable[];
                    if (region.length === 0) {
                        return "VOID";
                    }
                    for (let i = 0; i < region.length; i++) {
                        l.v.pointee.values[l.v.index + i] = { lvHolder: { array: l.v.pointee.values, index: l.v.index + i }, ...region[(region.length - 1) - i].v }
                    }
                    return "VOID";
                }
            },
            {
                op: "min_element",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 )",
                *default(rt: CRuntime, _templateTypes: [], _first: PointerVariable<PointeeVariable>, _last: PointerVariable<PointeeVariable>): Gen<InitIndexPointerVariable<Variable>> {
                    return yield* extreme_element(rt, _first, _last, "min_element", "o(_<_)");
                }
            },
            {
                op: "max_element",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 )",
                *default(rt: CRuntime, _templateTypes: [], _first: PointerVariable<PointeeVariable>, _last: PointerVariable<PointeeVariable>): Gen<InitIndexPointerVariable<Variable>> {
                    return yield* extreme_element(rt, _first, _last, "max_element", "o(_>_)");
                }
            },
            {
                op: "minmax_element",
                type: "!ParamObject FUNCTION CLASS pair < PTR ?0 PTR ?0 > ( PTR ?0 PTR ?0 )",
                *default(rt: CRuntime, _templateTypes: [], _first: PointerVariable<PointeeVariable>, _last: PointerVariable<PointeeVariable>): Gen<PairVariable<InitIndexPointerVariable<Variable>, InitIndexPointerVariable<Variable>>> {
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("minmax_element(): Expected 'first' to point to an element");
                    const mini = yield* extreme_element(rt, variables.indexPointer(first.v.pointee, first.v.index, false, null), _last, "minmax_element", "o(_<_)");
                    const maxi = yield* extreme_element(rt, variables.indexPointer(first.v.pointee, first.v.index, false, null), _last, "minmax_element", "o(_>_)");
                    return {
                        t: {
                            sig: "CLASS",
                            identifier: "pair",
                            memberOf: null,
                            templateSpec: [_first.t as PointerType<ObjectType>, _first.t as PointerType<ObjectType>]
                        },
                        v: {
                            isConst: false,
                            lvHolder: null,
                            state: "INIT",
                            members: {
                                first: variables.indexPointer(mini.v.pointee, mini.v.index, false, "SELF"),
                                second: variables.indexPointer(maxi.v.pointee, maxi.v.index, false, "SELF"),
                            }
                        }
                    };
                }
            },
            {
                op: "find",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: [], _first: PointerVariable<PointeeVariable>, _last: PointerVariable<PointeeVariable>, value: Variable): Gen<InitIndexPointerVariable<Variable>> {
                    if (_first.t.pointee.sig === "FUNCTION" || _last.t.pointee.sig === "FUNCTION") {
                        rt.raiseException("find(): Expected a pointer to an object variable");
                    }
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("find(): Expected 'first' to point to an element");
                    const last = variables.asInitIndexPointer(_last) ?? rt.raiseException("find(): Expected 'last' to point to an element");
                    if (first.v.pointee !== last.v.pointee) {
                        rt.raiseException("find(): Expected 'first' and 'last' to point to an element of the same memory region");
                    }
                    const eqInst = rt.getOpByParams("{global}", "o(_==_)", [rt.unbound(variables.deref(first) as MaybeUnboundVariable), value], []);
                    for (; first.v.index < last.v.index; first.v.index++) {
                        const eqYield = rt.invokeCall(eqInst, [], rt.unbound(variables.deref(first) as MaybeUnboundVariable), value) as ResultOrGen<ArithmeticVariable>;
                        const eqResult = rt.arithmeticValue(asResult(eqYield) ?? (yield* eqYield as Gen<ArithmeticVariable>))
                        if (eqResult !== 0) {
                            return first;
                        }
                    }
                    return first;
                }
            },
            {
                op: "distance",
                type: "!ParamObject FUNCTION I32 ( PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes: [], _first: PointerVariable<PointeeVariable>, _last: PointerVariable<PointeeVariable>): InitArithmeticVariable {
                    if (_first.t.pointee.sig === "FUNCTION" || _last.t.pointee.sig === "FUNCTION") {
                        rt.raiseException("find(): Expected a pointer to an object variable");
                    }
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("find(): Expected 'first' to point to an element");
                    const last = variables.asInitIndexPointer(_last) ?? rt.raiseException("find(): Expected 'last' to point to an element");
                    if (first.v.pointee !== last.v.pointee) {
                        rt.raiseException("find(): Expected 'first' and 'last' to point to an element of the same memory region");
                    }
                    return variables.arithmetic("I32", last.v.index - first.v.index, null);
                }
            },
            {
                op: "fill_n",
                type: "!ParamObject !Arithmetic !ParamObject FUNCTION ?0 ( ?0 ?1 CLREF ?2 )",
                *default(rt: CRuntime, _templateTypes: [], first: Variable, count: ArithmeticVariable, value: Variable): Gen<Variable> {
                    //let first = variables.asInitIndexPointer(_first) ?? rt.raiseException("fill_n(): Expected 'first' to point to an element");
                    const c = rt.arithmeticValue(count);
                    const ppInst = rt.getOpByParams("{global}", "o(_++)", [first], []);
                    for (let i = 0; i !== c; i++) {
                        const ppYield = rt.invokeCall(ppInst, [], first);
                        const ppResultOrVoid = asResult(ppYield) ?? (yield* ppYield as Gen<MaybeUnboundVariable | "VOID">);
                        if (ppResultOrVoid === "VOID") {
                            const typeOfFirst = rt.makeTypeStringOfVar(first);
                            rt.raiseException(`fill_n(): expected '${typeOfFirst}::operator++' to return an object, got void`);
                        }
                        const ppResult: Variable = rt.unbound(ppResultOrVoid);
                        const derefInst = rt.getOpByParams("{global}", "o(*_)", [ppResult], []);
                        const derefYield = rt.invokeCall(derefInst, [], ppResult);
                        const derefResultOrVoid = asResult(derefYield) ?? (yield* derefYield as Gen<MaybeUnboundVariable | "VOID">);
                        if (derefResultOrVoid === "VOID") {
                            const typeOfPpResult = rt.makeTypeStringOfVar(ppResult);
                            rt.raiseException(`fill_n(): expected '${typeOfPpResult}::operator*' to return an object, got void`);
                        }
                        const derefResult: Variable = rt.unbound(derefResultOrVoid);
                        const setInst = rt.getOpByParams("{global}", "o(_=_)", [derefResult, value], []);
                        const setYield = rt.invokeCall(setInst, [], derefResult, value);
                        const setResultOrVoid = asResult(setYield) ?? (yield* setYield as Gen<MaybeUnboundVariable | "VOID">);
                        if (setResultOrVoid === "VOID") {
                            const typeOfDerefResult = rt.makeTypeStringOfVar(derefResult);
                            rt.raiseException(`fill_n(): expected '${typeOfDerefResult}::operator*' to return an object, got void`);
                        }
                    }
                    return first;
                }
            },
            // TODO: Validate and cleanup set_intersection
            {
                op: "set_intersection",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 PTR ?0 PTR ?0 ParamObject )",
                *default(rt: CRuntime, _templateTypes: ObjectType[],
                    first1: PointerVariable<PointeeVariable>, last1: PointerVariable<PointeeVariable>,
                    first2: PointerVariable<PointeeVariable>, last2: PointerVariable<PointeeVariable>,
                    d_first: Variable): Gen<Variable> {

                    const ppInst = rt.getOpByParams("{global}", "o(_++)", [d_first], []);

                    const f1 = variables.asInitIndexPointer(first1) ?? rt.raiseException("set_intersection: expected valid first1 iterator");
                    const l1 = variables.asInitIndexPointer(last1) ?? rt.raiseException("set_intersection: expected valid last1 iterator");
                    const f2 = variables.asInitIndexPointer(first2) ?? rt.raiseException("set_intersection: expected valid first2 iterator");
                    const l2 = variables.asInitIndexPointer(last2) ?? rt.raiseException("set_intersection: expected valid last2 iterator");

                    if (f1.v.pointee !== l1.v.pointee) {
                        rt.raiseException("set_intersection: first1 and last1 must point to same memory region");
                    }
                    if (f2.v.pointee !== l2.v.pointee) {
                        rt.raiseException("set_intersection: first2 and last2 must point to same memory region");
                    }

                    const clref_t: MaybeLeftCV<ObjectType> = { t: f1.v.pointee.objectType, v: { isConst: true, lvHolder: "SELF" } };
                    const ltFun = rt.getFuncByParams("{global}", "o(_<_)", [clref_t, clref_t], []);

                    let i1 = f1.v.index;
                    let i2 = f2.v.index;

                    while (i1 < l1.v.index && i2 < l2.v.index) {
                        const elem1 = rt.unbound(variables.arrayMember(f1.v.pointee, i1) as MaybeUnboundVariable);
                        const elem2 = rt.unbound(variables.arrayMember(f2.v.pointee, i2) as MaybeUnboundVariable);

                        const cmp1Yield = rt.invokeCall(ltFun, [], elem1, elem2) as ResultOrGen<ArithmeticVariable>;
                        const cmp1Result = rt.arithmeticValue(asResult(cmp1Yield) ?? (yield* cmp1Yield as Gen<ArithmeticVariable>));

                        if (cmp1Result !== 0) {
                            f1.v.index++;
                            i1 = f1.v.index;
                        } else {
                            const cmp2Yield = rt.invokeCall(ltFun, [], elem2, elem1) as ResultOrGen<ArithmeticVariable>;
                            const cmp2Result = rt.arithmeticValue(asResult(cmp2Yield) ?? (yield* cmp2Yield as Gen<ArithmeticVariable>));

                            if (cmp2Result === 0) {
                                const ppYield = rt.invokeCall(ppInst, [], d_first);
                                const ppResultOrVoid = asResult(ppYield) ?? (yield* ppYield as Gen<MaybeUnboundVariable | "VOID">);
                                if (ppResultOrVoid === "VOID") {
                                    const typeOfFirst = rt.makeTypeStringOfVar(d_first);
                                    rt.raiseException(`set_intersection(): expected '${typeOfFirst}::operator++' to return an object, got void`);
                                }
                                const ppResult: Variable = rt.unbound(ppResultOrVoid);
                                const derefInst = rt.getOpByParams("{global}", "o(*_)", [ppResult], []);
                                const derefYield = rt.invokeCall(derefInst, [], ppResult);
                                const derefResultOrVoid = asResult(derefYield) ?? (yield* derefYield as Gen<MaybeUnboundVariable | "VOID">);
                                if (derefResultOrVoid === "VOID") {
                                    const typeOfPpResult = rt.makeTypeStringOfVar(ppResult);
                                    rt.raiseException(`set_intersection(): expected '${typeOfPpResult}::operator*' to return an object, got void`);
                                }
                                const derefResult: Variable = rt.unbound(derefResultOrVoid);
                                f1.v.index++;
                                i1 = f1.v.index;
                                const setInst = rt.getOpByParams("{global}", "o(_=_)", [derefResult, elem1], []);
                                const setYield = rt.invokeCall(setInst, [], derefResult, elem1);
                                const setResultOrVoid = asResult(setYield) ?? (yield* setYield as Gen<MaybeUnboundVariable | "VOID">);
                                if (setResultOrVoid === "VOID") {
                                    const typeOfDerefResult = rt.makeTypeStringOfVar(derefResult);
                                    rt.raiseException(`set_intersection(): expected '${typeOfDerefResult}::operator*' to return an object, got void`);
                                }

                            }
                            f2.v.index++;
                            i2 = f2.v.index;
                        }
                    }

                    return d_first;
                }
            },
            // TODO: Validate and cleanup set_intersection
            {
                op: "set_intersection",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 PTR ?0 PTR ?0 PTR ?0 PTR FUNCTION BOOL ( CLREF ?0 CLREF ?0 ) )",
                *default(rt: CRuntime, _templateTypes: ObjectType[],
                    first1: PointerVariable<PointeeVariable>, last1: PointerVariable<PointeeVariable>,
                    first2: PointerVariable<PointeeVariable>, last2: PointerVariable<PointeeVariable>,
                    result: PointerVariable<PointeeVariable>, comp: PointerVariable<Function>): Gen<InitIndexPointerVariable<Variable>> {

                    const f1 = variables.asInitIndexPointer(first1) ?? rt.raiseException("set_intersection: expected valid first1 iterator");
                    const l1 = variables.asInitIndexPointer(last1) ?? rt.raiseException("set_intersection: expected valid last1 iterator");
                    const f2 = variables.asInitIndexPointer(first2) ?? rt.raiseException("set_intersection: expected valid first2 iterator");
                    const l2 = variables.asInitIndexPointer(last2) ?? rt.raiseException("set_intersection: expected valid last2 iterator");
                    const res = variables.asInitIndexPointer(result) ?? rt.raiseException("set_intersection: expected valid result iterator");
                    const cmpFun = variables.asInitDirectPointer(comp) as InitDirectPointerVariable<Function> ?? rt.raiseException("set_intersection: expected valid comparator function");

                    if (f1.v.pointee !== l1.v.pointee) {
                        rt.raiseException("set_intersection: first1 and last1 must point to same memory region");
                    }
                    if (f2.v.pointee !== l2.v.pointee) {
                        rt.raiseException("set_intersection: first2 and last2 must point to same memory region");
                    }

                    let i1 = f1.v.index;
                    let i2 = f2.v.index;
                    let resIndex = res.v.index;

                    while (i1 < l1.v.index && i2 < l2.v.index) {
                        const elem1 = rt.unbound(variables.arrayMember(f1.v.pointee, i1) as MaybeUnboundVariable);
                        const elem2 = rt.unbound(variables.arrayMember(f2.v.pointee, i2) as MaybeUnboundVariable);

                        const cmp1Yield = rt.invokeCallFromVariable({ t: cmpFun.t.pointee, v: cmpFun.v.pointee }, elem1, elem2) as ResultOrGen<ArithmeticVariable>;
                        const cmp1Result = rt.arithmeticValue(asResult(cmp1Yield) ?? (yield* cmp1Yield as Gen<ArithmeticVariable>));

                        if (cmp1Result !== 0) {
                            i1++;
                        } else {
                            // Check if elem2 < elem1
                            const cmp2Yield = rt.invokeCallFromVariable({ t: cmpFun.t.pointee, v: cmpFun.v.pointee }, elem2, elem1) as ResultOrGen<ArithmeticVariable>;
                            const cmp2Result = rt.arithmeticValue(asResult(cmp2Yield) ?? (yield* cmp2Yield as Gen<ArithmeticVariable>));

                            if (cmp2Result !== 0) {
                                i2++;
                            } else {
                                if (res.v.pointee.values.length <= resIndex) {
                                    while (res.v.pointee.values.length <= resIndex) {
                                        const defaultVar = rt.defaultValue(f1.v.pointee.objectType, { array: res.v.pointee, index: res.v.pointee.values.length });
                                        const defaultValue = asResult(defaultVar) ?? rt.raiseException("set_intersection: failed to create default value");
                                        res.v.pointee.values.push(defaultValue.v);
                                    }
                                }

                                const resultElement = variables.clone(rt, elem1, { array: res.v.pointee, index: resIndex }, false, true);
                                res.v.pointee.values[resIndex] = resultElement.v;

                                i1++;
                                i2++;
                                resIndex++;
                            }
                        }
                    }

                    return variables.indexPointer(res.v.pointee, resIndex, false, null);
                }
            }
        ]);
    }
};
