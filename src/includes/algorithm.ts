import _ = require("lodash");
import { CRuntime, FunctionVariable, NormalPointerVariable, ArrayVariable, Variable, VariableType, VariableValue, DummyVariable } from "../rt";

export = {
    load(rt: CRuntime) {
        interface AlgorithmIterator {
            pointee_type: VariableType,
            first_pos: number,
            last_pos: number,
            array: any[]
        };
        function _panic(_rt: CRuntime, fnname: string, description: string): void {
            _rt.raiseException(fnname + "(): " + description);
        }
        type AlgorithmIterable = Variable | NormalPointerVariable | ArrayVariable;
        function createAlgorithmIterator(_rt: CRuntime, _first: AlgorithmIterable, _last: AlgorithmIterable, fnname: string): AlgorithmIterator {
            function checkForIterTargets(__rt: CRuntime, lhs: any, rhs: any, _fnname: string): void {
                if (lhs !== rhs) {
                    _panic(__rt, _fnname, "undefined behaviour caused by pointers 'first' and 'last' pointing to different arrays");
                }
            }
            if (_first?.t === undefined) {
                _panic(_rt, fnname, "parameter 'first' is undefined");
            }
            if (_last?.t === undefined) {
                _panic(_rt, fnname, "parameter 'last' is undefined");
            }
            if (!(_.isEqual(_first.t, _last.t))) {
                _panic(_rt, fnname, "parameters 'first' and 'last' have different types");
            }
            if (rt.isArrayType(_first) && rt.isArrayType(_last)) {
                const first = _first as ArrayVariable;
                const last = _last as ArrayVariable;
                checkForIterTargets(_rt, first.v.target, last.v.target, fnname);
                return {
                    pointee_type: first.t.eleType,
                    first_pos: first.v.position,
                    last_pos: last.v.position,
                    array: first.v.target,
                }
            } else if ((_first as any).vector !== undefined && (_last as any).vector !== undefined) {
                const first = _first as any;
                const last = _last as any;
                checkForIterTargets(_rt, first.vector, last.vector, fnname);
                return {
                    pointee_type: first.vector.dataType,
                    first_pos: first.index,
                    last_pos: last.index,
                    array: first.vector.elements
                }
            } else {
                _panic(_rt, fnname, "erroneous types of the parameters 'first' and/or 'last'");
            }
        }
        // this may be useful for using functions with parameters
        function invoke_arbitrary_function(_rt: CRuntime, fun: FunctionVariable, ...args: (Variable | DummyVariable)[]): VariableValue {
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
        }
        function sort_inner(_rt: CRuntime, _this: Variable, _first: AlgorithmIterable, _last: AlgorithmIterable, _comp: any): void {
            const it: AlgorithmIterator = createAlgorithmIterator(_rt, _first, _last, "sort");
            if (_comp !== undefined) {
                if (_comp.t?.type !== "function") {
                    _panic(_rt, "sort", "parameter 'comp' is not a function (passing structures with operator bool() overloads is not yet implemented)")
                }
                const comp = _comp as FunctionVariable;
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
        rt.regFunc(sort_inner, "global", "sort", ["?"], rt.voidTypeLiteral);
        // JavaScript Array.sort() is always stable
        rt.regFunc(sort_inner, "global", "stable_sort", ["?"], rt.voidTypeLiteral);

        // InputIt is just like RandomIt but not necessarilly ValueSwappable
        // template<typename InputIt, typename T> InputIt find(InputIt first, InputIt last, const T &value);
        rt.regFunc(function(_rt: CRuntime, _this: Variable, _first: AlgorithmIterable, _last: AlgorithmIterable, _value: NormalPointerVariable | ArrayVariable) {
            if (_value?.t === undefined) {
                _panic(_rt, "find", "parameter 'value' is undefined");
            }
            const it: AlgorithmIterator = createAlgorithmIterator(_rt, _first, _last, "find");
            // TODO: implement
            _panic(_rt, "find", "not yet implemented");
        }, "global", "find", ["?"], "?" as unknown as VariableType);

        // template<typename BidirIt> void reverse(BidirIt first, BidirIt last);
        // rt.regFunc(function(_rt: CRuntime, _this: Variable, _first: AlgorithmIterable, _last: AlgorithmIterable): void {
        //     const it: AlgorithmIterator = createAlgorithmIterator(_rt, _first, _last, "reverse");
        //     // TODO: implement
        //     _panic(_rt, "reverse", "not yet implemented");
        // }, "global", "reverse", ["?"], rt.voidTypeLiteral)

        rt.regFunc(function(rt: CRuntime, _this: Variable, first: AlgorithmIterable, last: AlgorithmIterable) {
            const firstIterator: any = first;
            const lastIterator: any = last;

            if (!(firstIterator.scope && lastIterator.scope)) {
                rt.raiseException("non iterator arguments are unnacceptable to use this method.");
            }

            const reversed = [];
            while (!_.isEqual(firstIterator, lastIterator)) {
                const result = firstIterator.next();
                if (result.value.v === 0) {
                    reversed.push(result.value);
                    break; 
                }
                reversed.unshift(result.value);
            }
            
            firstIterator.scope.v.target = reversed;            
        }, "global", "reverse", ["?"], rt.voidTypeLiteral);
        rt.addToNamespace("std", "reverse", rt.readVar("reverse"));  
    }
};
