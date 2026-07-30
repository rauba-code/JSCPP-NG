import { CRuntime } from "../../rt";
import { ArithmeticBigSig, ArithmeticBigVariable, ArithmeticNumSig, ArithmeticNumVariable, InitArithmeticBigVariable, InitArithmeticNumVariable, variables } from "../../variables";
import * as common from "../../shared/common";

export = {
    load(rt: CRuntime) {
        function commonUnaryNum(fn: (l: number) => number, sig: ArithmeticNumSig | null): (rt: CRuntime, _templateTypes: [], l: ArithmeticNumVariable) => InitArithmeticNumVariable {
            return function(rt: CRuntime, _templateTypes: [], _l: ArithmeticNumVariable): InitArithmeticNumVariable {
                const l = rt.arithmeticNumValue(_l);
                const retv = variables.arithmeticNum(sig ?? _l.t.sig, fn(l), null, false);
                rt.adjustArithmeticNumValue(retv);
                return retv;
            }
        }
        function commonUnaryBig(fn: (l: bigint) => bigint, sig: ArithmeticBigSig | null): (rt: CRuntime, _templateTypes: [], l: ArithmeticBigVariable) => InitArithmeticBigVariable {
            return function(rt: CRuntime, _templateTypes: [], _l: ArithmeticBigVariable): InitArithmeticBigVariable {
                const l = rt.arithmeticValue(_l) as bigint;
                const retv = variables.arithmeticBig(sig ?? _l.t.sig, fn(l), null, false);
                rt.adjustArithmeticBigValue(retv);
                return retv;
            }
        }
        common.regGlobalFuncs(rt, [
                { type: "FUNCTION I32 ( I32 )", op: "abs", default: commonUnaryNum(Math.abs, null) },
                { type: "FUNCTION I64 ( I64 )", op: "abs", default: commonUnaryBig((x) => (x >= 0) ? x : -x, null) },
                { type: "FUNCTION F32 ( F32 )", op: "abs", default: commonUnaryNum(Math.abs, null) },
                { type: "FUNCTION F64 ( F64 )", op: "abs", default: commonUnaryNum(Math.abs, null) },

        ]);
    }
}
