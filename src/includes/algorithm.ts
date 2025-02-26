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
      /* function pointerTypeTemplate(t: RandomIt): [string] {
          return [t.t?.type, t.t?.value, t.t?.eleType?.type, t.t?.eletype?.name];
      }
      function checkTypeTemplateEquality(a: [string], b: [string]): boolean {
          if (a.length !== b.length) {
              return false;
          }
          const len: number = a.length;
          for (i in len) {
              if (a[i] !== b[i]) {
                  return false;
              }
          }
          return true;
      }*/
      rt.regFunc(function(_rt: CRuntime, _this: Variable, first: RandomIt, last: RandomIt) {
          if (first?.t === undefined) {
              _rt.raiseException("sort(): parameter 'first' is undefined")
          }
          if (last?.t === undefined) {
              _rt.raiseException("sort(): parameter 'last' is undefined")
          }
          console.log(first);
          console.log(last);
          if (!(_.isEqual(first.t, last.t))) {
              _rt.raiseException("sort(): parameters 'first' and 'last' have different types");
          }
          _rt.raiseException("sort(): Not yet implemented")
      }, "global", "sort", ["?"], rt.voidTypeLiteral)
    }
};
