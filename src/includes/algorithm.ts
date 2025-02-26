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
              const first_pos = first.v.position;
              const last_pos = last.v.position;
              const value_array = new Array();
              for (let i = first_pos; i < last_pos; i++) {
                  value_array.push(first.v.target[i].v);
              }
              value_array.sort();
              for (let i = first_pos; i < last_pos; i++) {
                  first.v.target[i].v = value_array[i - first_pos];
              }
          } else {
              _rt.raiseException("sort(): not yet implemented")
          }
      }, "global", "sort", ["?"], rt.voidTypeLiteral)
    }
};
