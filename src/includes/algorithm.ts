import _ = require("lodash");
import { CRuntime, NormalPointerVariable, ArrayVariable, Variable } from "../rt";

export = {
    load(rt: CRuntime) {
        // template<typename RandomIt> void sort(RandomIt first, RandomIt last)
        // C++ Reference does not define RandomIt.
        // It can be any value (here: 'val') that satisfies these conditions:
        // 1) RandomIt is MoveConstructible:
        // 1.1) RandomIt val = <literal or newly computed result>; // creates a value
        // 1.2) RandomIt val(<literal or newly computed result>); // creates a value
        // 2) RandomIt is CopyConstructible:
        //    RandomIt other_val = <some value>;
        //    RandomIt val(other_val); // creates an identical copy
        // 3) RandomIt is CopyAssignable:
        //    RandomIt val = <some value>; // constructor
        //    RandomIt other_val = <other value>; // constructor
        //    RandomIt val = other_val; // copy-assignment
        // 4) RandomIt is Destructible.
        // 5) RandomIt is Swappable.
        //    RandomIt val1 = <some value>;
        //    RandomIt val2 = <other value>;
        //    std::swap(val1, val2); // is possible
        // 6) RandomIt is ValueSwappable.
        //    RandomIt val1 = <some value>;
        //    RandomIt val2 = <other value>;
        //    std::swap(*val1, *val2); // is possible
        // 7) (*RandomIt) is MoveConstructible
        // 8) (*RandomIt) is MoveAssignable
        // 9 unwritten) Exists (*val1 < *val2).
        // 10 unwritten) Exists (val1 - val2).
        type RandomIt = Variable | NormalPointerVariable | ArrayVariable;
        rt.regFunc(function(_rt: CRuntime, _this: Variable, _first: RandomIt, _last: RandomIt) {
            if (_first?.t === undefined) {
                _rt.raiseException("sort(): parameter 'first' is undefined")
            }
            if (_last?.t === undefined) {
                _rt.raiseException("sort(): parameter 'last' is undefined")
            }
            // console.log(_first);
            // console.log(_last);
            if (!(_.isEqual(_first.t, _last.t))) {
                _rt.raiseException("sort(): parameters 'first' and 'last' have different types");
            }
            if (rt.isArrayType(_first) && rt.isArrayType(_last)) {
                const first = _first as ArrayVariable;
                const last = _last as ArrayVariable;
                if (first.v.target !== last.v.target) {
                    _rt.raiseException("sort(): undefined behaviour caused by pointers 'first' and 'last' pointing to different arrays");
                }
                if (first.t.eleType?.type !== "primitive") {
                    _rt.raiseException("sort(): behaviour for arrays of non-primitive types is not yet implemented");
                }
                const first_pos = first.v.position;
                const last_pos = last.v.position;
                if (first_pos > last_pos || first_pos < 0 || last_pos > first.t.size) {
                    _rt.raiseException("sort(): undefined behaviour caused by invalid pointer positions");
                }
                const value_array = new Array();
                for (let i = first_pos; i < last_pos; i++) {
                    value_array.push(first.v.target[i].v);
                }
                value_array.sort();
                for (let i = first_pos; i < last_pos; i++) {
                    first.v.target[i].v = value_array[i - first_pos];
                }
            } else if ((_first as any).scope !== undefined && (_last as any).scope !== undefined) {
                const first = _first as any;
                const last = _last as any;
                if (first.scope !== last.scope) {
                    _rt.raiseException("sort(): undefined behaviour caused by pointers 'first' and 'last' pointing to different vectors");
                }
                // TODO: check vector elements' value
                // TODO: merge vector and static array behaviour into a single function
                const first_pos = first.index;
                const last_pos = last.index;
                if (first_pos > last_pos || first_pos < 0 || last_pos > first.scope.elements.length) {
                    _rt.raiseException("sort(): undefined behaviour caused by invalid pointer positions");
                }
                const value_array = new Array();
                for (let i = first_pos; i < last_pos; i++) {
                    value_array.push(first.scope.elements[i].v);
                }
                value_array.sort();
                for (let i = first_pos; i < last_pos; i++) {
                    first.scope.elements[i].v = value_array[i - first_pos];
                }

            } else {
                _rt.raiseException("sort(): not yet implemented")
            }
        }, "global", "sort", ["?"], rt.voidTypeLiteral)

        rt.regFunc(function(rt: CRuntime, _this: Variable, first: Variable, last: Variable) {
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
