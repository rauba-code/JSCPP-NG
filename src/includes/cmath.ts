import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { ArithmeticSig, ArithmeticVariable, InitArithmeticVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.defVar("INFINITY", variables.arithmetic("F32", Number.POSITIVE_INFINITY, null, true));
        rt.defVar("NAN", variables.arithmetic("F32", Number.NaN, null, true));
        function commonUnary(fn: (l: number) => number, sig: ArithmeticSig | null): (rt: CRuntime, l: ArithmeticVariable) => InitArithmeticVariable {
            return function(rt: CRuntime, _l: ArithmeticVariable): InitArithmeticVariable {
                const l = rt.arithmeticValue(_l);
                const retv = variables.arithmetic(sig ?? _l.t.sig, fn(l), null, false);
                rt.adjustArithmeticValue(retv);
                return retv;
            }
        }
        function commonBinary(fn: (l: number, r: number) => number, sig: ArithmeticSig): (rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable) => InitArithmeticVariable {
            return function(rt: CRuntime, _l: ArithmeticVariable, _r: ArithmeticVariable): InitArithmeticVariable {
                const l = rt.arithmeticValue(_l);
                const r = rt.arithmeticValue(_r);
                const retv = variables.arithmetic(sig, fn(l, r), null, false);
                rt.adjustArithmeticValue(retv);
                return retv;
            }
        }
        function commonUnaryOverloads(name: string, fn: (l: number) => number): common.FunHandler[] {
            return Object.entries(variables.arithmeticProperties)
                .map(([k, v], _i) => ({ type: `FUNCTION ${v.isFloat ? k : "F64"} ( ${k} )`, op: name, default: commonUnary(fn, v.isFloat ? k as ArithmeticSig : "F64") }));
        }
        function commonBinaryOverloads(name: string, fn: (l: number, r: number) => number): common.FunHandler[] {
            return Object.entries(variables.arithmeticProperties)
                .map(([k, v], _i) => ({ type: `FUNCTION ${v.isFloat ? k : "F64"} ( ${k} ${k} )`, op: name, default: commonBinary(fn, v.isFloat ? k as ArithmeticSig : "F64") }));
        }
        common.regGlobalFuncs(rt, [
            [
                { type: "FUNCTION F32 ( F32 )", op: "abs", default: commonUnary(Math.abs, null) },
                { type: "FUNCTION F64 ( F64 )", op: "abs", default: commonUnary(Math.abs, null) },
            ],
            commonUnaryOverloads("fabs", Math.abs),
            commonBinaryOverloads("fmod", (l, r) => l % r),
            commonUnaryOverloads("exp", Math.exp),
            commonUnaryOverloads("exp2", (l) => Math.exp(l * Math.LN2)),
            commonUnaryOverloads("expm1", Math.expm1),
            commonUnaryOverloads("log", Math.log),
            commonUnaryOverloads("log10", Math.log10),
            commonUnaryOverloads("log2", Math.log2),
            commonUnaryOverloads("log1p", Math.log1p),
            commonBinaryOverloads("pow", Math.pow),
            commonUnaryOverloads("sqrt", Math.sqrt),
            commonUnaryOverloads("cbrt", Math.cbrt),
            commonUnaryOverloads("hypot", Math.hypot),
            commonUnaryOverloads("sin", Math.sin),
            commonUnaryOverloads("cos", Math.cos),
            commonUnaryOverloads("tan", Math.tan),
            commonUnaryOverloads("asin", Math.asin),
            commonUnaryOverloads("acos", Math.acos),
            commonUnaryOverloads("atan", Math.atan),
            commonBinaryOverloads("atan2", Math.atan2),
            commonUnaryOverloads("sinh", Math.sinh),
            commonUnaryOverloads("cosh", Math.cosh),
            commonUnaryOverloads("tanh", Math.tanh),
            commonUnaryOverloads("asinh", Math.asinh),
            commonUnaryOverloads("acosh", Math.acosh),
            commonUnaryOverloads("atanh", Math.atanh),
            commonUnaryOverloads("ceil", Math.ceil),
            commonUnaryOverloads("floor", Math.floor),
            commonUnaryOverloads("trunc", Math.trunc),
            commonUnaryOverloads("round", Math.round),
        ].flat());

    }
}


