import { asResult } from "../interpreter";
import { CRuntime, FunctionCallInstance } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, PointeeVariable, PointerVariable, Function, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ResultOrGen, MaybeLeftCV, ObjectType, InitDirectPointerVariable } from "../variables";

export = {
    load(rt: CRuntime) {
        // this may be useful for using functions with parameters
        /*function invoke_arbitrary_function(_rt: CRuntime, fun: Function, ...args: Variable[]): Variable {
            let invocation = fun?.v?.target(_rt, fun, ...args);
            if (invocation === undefined) {
                _panic(_rt, "<internal>", "failed to invoke a given function (function is unknown)");
            }
            for (let i: number = 0; i < 100_000_000; i++) {
                const retv = invocation.next();
                if (retv.done === true) {
                    return retv.value;
                }
            }
            _panic(_rt, "<internal>", "failed to invoke a given function (runtime limit exceeded)");
        }*/
        /*function sort_inner(_rt: CRuntime, _this: Variable, _first: AlgorithmIterable, _last: AlgorithmIterable, _comp: any): void {
            const it: AlgorithmIterator = createAlgorithmIterator(_rt, _first, _last, "sort");
            if (_comp !== undefined) {
                if (_comp.t?.type !== "function") {
                    _panic(_rt, "sort", "parameter 'comp' is not a function (passing structures with operator bool() overloads is not yet implemented)")
                }
                if (_comp.t.retType?.type !== "primitive"
                || _comp.t.retType.name !== "bool"
                || _comp.t.signature?.length !== 2
                || _comp.t.signature[0].type !== "reference"
                || !(_.isEqual(_comp.t.signature[0].targetType, it.pointee_type))
                || _comp.t.signature[1].type !== "reference"
                || !(_.isEqual(_comp.t.signature[1].targetType, it.pointee_type))
                ) {
                    _panic(_rt, "sort", "comparison function does not have a signature of type 'bool ()(const T&, const T&)'")
                }

            }
            if (it.first_pos > it.last_pos || it.first_pos < 0 || it.last_pos > it.array.length) {
                _panic(_rt, "sort", "undefined behaviour caused by invalid pointer positions")
            }
            let lt_fun: any;
            if (_comp === undefined) {
                const o_lt : string = _rt.makeOperatorFuncName("<");
                const pointee_type_sig : string = _rt.getTypeSignature(it.pointee_type);
                if (pointee_type_sig === undefined) {
                    _panic(_rt, "sort", "operator < is not supported for the specified type")
                }
                lt_fun = _rt.types[pointee_type_sig]?.handlers[o_lt]?.default;
                if (lt_fun === undefined) {
                    _panic(_rt, "sort", "operator < is not supported for the specified type")
                }
            } else {
                lt_fun = function(__rt: CRuntime, lhs: any, rhs: any): any { 
                    return invoke_arbitrary_function(__rt, _comp, lhs, rhs); 
                };
            }
            const sort_comparator = function(lhs: any, rhs: any): number {
                // JavaScript specifically wants a symmetrical comparator, so we compare both sides
                // these return 0.0 or 1.0
                const a_lt_b = lt_fun(_rt, lhs, rhs).v;
                const b_lt_a = lt_fun(_rt, rhs, lhs).v;
                // return -2.0, 0.0, or 2.0
                return b_lt_a - a_lt_b;
            }
            const value_array = new Array();
            for (let i = it.first_pos; i < it.last_pos; i++) {
                value_array.push(it.array[i]);
            }
            value_array.sort(sort_comparator);
            for (let i = it.first_pos; i < it.last_pos; i++) {
                it.array[i] = value_array[i - it.first_pos];
            }
        }*/

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
            const clref_t : MaybeLeftCV<ObjectType> = { t: l.v.pointee.objectType, v: { isConst: true, lvHolder: "SELF" } };
            const cmpFun = (_cmp !== null) ? (variables.asInitDirectPointer(_cmp) as InitDirectPointerVariable<Function> ?? rt.raiseException("sort: Parameter 'cmp' does not point to a function")) : null;
            const ltFun = (cmpFun === null) ? rt.getFuncByParams("{global}", "o(_<_)", [clref_t, clref_t], []) : null;
            function sortCmp(li: number, ri: number): number {
                // JavaScript specifically wants a symmetrical comparator, so we compare both sides
                // these return 0.0 or 1.0
                const lhs = region[li];
                const rhs = region[ri];
                const a_lt_b = yieldBlocking(cmpFun !== null ? rt.invokeCallFromVariable({t: cmpFun.t.pointee, v: cmpFun.v.pointee}, lhs, rhs) : rt.invokeCall(ltFun as FunctionCallInstance, [], lhs, rhs)).v.value;
                const b_lt_a = yieldBlocking(cmpFun !== null ? rt.invokeCallFromVariable({t: cmpFun.t.pointee, v: cmpFun.v.pointee}, rhs, lhs) : rt.invokeCall(ltFun as FunctionCallInstance, [], rhs, lhs)).v.value;
                // return -2.0, 0.0, or 2.0
                return b_lt_a - a_lt_b;

            }
            indexRegion.sort(sortCmp);
            indexRegion.forEach((ri, ci) => {
                l.v.pointee.values[l.v.index + ci] = region[ri].v;
            });
            return "VOID";
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
            }
        ]);
        // InputIt is just like RandomIt but not necessarilly ValueSwappable
        // template<typename InputIt, typename T> InputIt find(InputIt first, InputIt last, const T &value);
        /*rt.regFunc(function(_rt: CRuntime, _this: Variable, _first: AlgorithmIterable, _last: AlgorithmIterable, _value: NormalPointerVariable | ArrayVariable) {
            if (_value?.t === undefined) {
                _panic(_rt, "find", "parameter 'value' is undefined");
            }
            const it: AlgorithmIterator = createAlgorithmIterator(_rt, _first, _last, "find");
            // TODO: implement
            _panic(_rt, "find", "not yet implemented");
        }, "global", "find", ["?"], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: Variable, first: AlgorithmIterable, last: AlgorithmIterable) {
            const it: AlgorithmIterator = createAlgorithmIterator(rt, first, last, "reverse");

            for (let i: number = 0; i * 2 < it.last_pos - it.first_pos; i++) {
                const p = it.first_pos + i;
                const q = ((it.last_pos - 1) - i);
                const t = it.array[q];
                const u = it.array[p];
                it.array[q] = u;
                it.array[p] = t;
            }
        }, "global", "reverse", ["?"], rt.voidTypeLiteral);
        rt.addToNamespace("std", "reverse", rt.readVar("reverse"));*/
    }
};
