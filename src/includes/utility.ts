import _ = require("lodash");
import { CRuntime, Variable } from "../rt";

export = {
    load(rt: CRuntime) {
        function _panic(_rt: CRuntime, fnname: string, description: string): void {
            _rt.raiseException(fnname + "(): " + description);
        }

        // template <typename T> void sort(T &a, T &b);
        // !Object FUNCTION VOID ( LREF ?0 LREF ?0 )
        rt.regFunc(function(_rt: CRuntime, _this: Variable, _a: Variable, _b: Variable) {
            if (_a?.t === undefined) {
                _panic(_rt, "swap", "parameter 'a' is undefined");
            }
            if (_b?.t === undefined) {
                _panic(_rt, "swap", "parameter 'b' is undefined");
            }
            if (!(_.isEqual(_a.t, _b.t))) {
                _panic(_rt, "swap", "parameters 'a' and 'b' have different types");
            }
            if (!_a.left || !_b.left) {
                _panic(_rt, "swap", "parameters 'a' and/or 'b' are not lvalues");
            }
            // because of nasty hacks done, variables can have parameters
            //   other than t, v (see: iterators). We must make sure all
            //   parameters are swapped.
            let a = _a as any;
            let b = _b as any;
            let keys: { [key: string]: null } = {};
            Object.keys(a).concat(...Object.keys(b)).forEach((key: string) => {
                keys[key] = null;
            })
            for (const key in keys) {
                const t = a[key];
                a[key] = b[key];
                b[key] = t;
            }
        }, "global", "swap", ["?"], rt.voidTypeLiteral);
    }
}
