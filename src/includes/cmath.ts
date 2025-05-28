import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { ArithmeticSig, ArithmeticVariable, InitArithmeticVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.defVar("INFINITY", variables.arithmetic("F32", Number.MAX_SAFE_INTEGER, null, true));
        rt.defVar("NAN", variables.arithmetic("F32", Number.NaN, null, true));
        function commonAbs(explicitReturnSig: ArithmeticSig | null): (rt: CRuntime, l: ArithmeticVariable) => InitArithmeticVariable {
            return function(rt: CRuntime, l: ArithmeticVariable): InitArithmeticVariable {
                const retv = variables.arithmetic(explicitReturnSig ?? l.t.sig, Math.abs(rt.arithmeticValue(l)), null, false);
                rt.adjustArithmeticValue(retv);
                return retv;
            }
        }
        function commonMod(explicitReturnSig: ArithmeticSig | null): (rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable) => InitArithmeticVariable {
            return function(rt: CRuntime, _l: ArithmeticVariable, _r: ArithmeticVariable): InitArithmeticVariable {
                const l = rt.arithmeticValue(_l);
                const r = rt.arithmeticValue(_r);
                const retv = variables.arithmetic(explicitReturnSig ?? _l.t.sig, l % r, null, false);
                rt.adjustArithmeticValue(retv);
                return retv;
            }
        }
        common.regGlobalFuncs(rt, [{
            type: "!Arithmetic FUNCTION ?0 ( ?0 )",
            op: "abs",
            default: commonAbs(null)
        }, {
            type: "FUNCTION F64 ( Arithmetic )",
            op: "fabs",
            default: commonAbs("F64") 
        }, {
            type: "FUNCTION F32 ( F32 )",
            op: "fabsf",
            default: commonAbs("F32")
        },{
            type: "FUNCTION F64 ( F64 )",
            op: "fabsl",
            default: commonAbs("F64"),
        }, {
            type: "FUNCTION F64 ( Arithmetic )",
            op: "fmod",
            default: commonMod("F64") 
        }]);

    }
}


