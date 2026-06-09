import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { ArithmeticBigSig, ArithmeticBigVariable, ArithmeticNumSig, ArithmeticNumVariable, InitArithmeticBigVariable, InitArithmeticNumVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.defVar("INFINITY", variables.arithmeticNum("F32", Number.POSITIVE_INFINITY, null, true), false, true);
        rt.defVar("NAN", variables.arithmeticNum("F32", Number.NaN, null, true), false, true);
        function commonUnaryNum(fn: (l: number) => number, sig: ArithmeticNumSig | null): (rt: CRuntime, _templateTypes: [], l: ArithmeticNumVariable) => InitArithmeticNumVariable {
            return function(rt: CRuntime, _templateTypes: [], _l: ArithmeticNumVariable): InitArithmeticNumVariable {
                const l = rt.arithmeticValue(_l) as number;
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
        function commonBinaryNum(fn: (l: number, r: number) => number, sig: ArithmeticNumSig): (rt: CRuntime, _templateTypes: [], l: ArithmeticNumVariable, r: ArithmeticNumVariable) => InitArithmeticNumVariable {
            return function(rt: CRuntime, _templateTypes: [], _l: ArithmeticNumVariable, _r: ArithmeticNumVariable): InitArithmeticNumVariable {
                const l = rt.arithmeticValue(_l) as number;
                const r = rt.arithmeticValue(_r) as number;
                const retv = variables.arithmeticNum(sig, fn(l, r), null, false);
                rt.adjustArithmeticNumValue(retv);
                return retv;
            }
        }
        /*function commonBinaryBig(fn: (l: bigint, r: bigint) => bigint, sig: ArithmeticBigSig): (rt: CRuntime, _templateTypes: [], l: ArithmeticBigVariable, r: ArithmeticBigVariable) => InitArithmeticBigVariable {
            return function(rt: CRuntime, _templateTypes: [], _l: ArithmeticBigVariable, _r: ArithmeticBigVariable): InitArithmeticBigVariable {
                const l = rt.arithmeticValue(_l) as bigint;
                const r = rt.arithmeticValue(_r) as bigint;
                const retv = variables.arithmeticBig(sig, fn(l, r), null, false);
                rt.adjustArithmeticBigValue(retv);
                return retv;
            }
        }*/
        function commonUnaryOverloads(name: string, fn: (l: number) => number): common.FunHandler[] {
            return Object.entries(variables.arithmeticProperties)
                .filter(([_k, v], _i) => (!v.isBig))
                .map(([k, v], _i) => ({ type: `FUNCTION ${v.isFloat ? k : "F64"} ( ${k} )`, op: name, default: commonUnaryNum(fn, v.isFloat ? k as ArithmeticNumSig : "F64") }));
        }
        function commonBinaryOverloads(name: string, fn: (l: number, r: number) => number): common.FunHandler[] {
            return Object.entries(variables.arithmeticProperties)
                .filter(([_k, v], _i) => (!v.isBig))
                .map(([k, v], _i) => ({ type: `FUNCTION ${v.isFloat ? k : "F64"} ( ${k} ${k} )`, op: name, default: commonBinaryNum(fn, v.isFloat ? k as ArithmeticNumSig : "F64") }));
        }
        common.regGlobalFuncs(rt, [
            [
                { type: "FUNCTION I32 ( I32 )", op: "abs", default: commonUnaryNum(Math.abs, null) },
                { type: "FUNCTION I64 ( I64 )", op: "abs", default: commonUnaryBig((x) => (x >= 0) ? x : -x, null) },
                { type: "FUNCTION F32 ( F32 )", op: "abs", default: commonUnaryNum(Math.abs, null) },
                { type: "FUNCTION F64 ( F64 )", op: "abs", default: commonUnaryNum(Math.abs, null) },
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
            [
                { type: "FUNCTION F32 ( F32 F32 )", op: "pow", default: commonBinaryNum(Math.pow, "F32") },
                { type: "FUNCTION F64 ( F64 F64 )", op: "pow", default: commonBinaryNum(Math.pow, "F64") },
                { type: "FUNCTION F32 ( F32 F32 )", op: "powf", default: commonBinaryNum(Math.pow, "F32") },
                { type: "FUNCTION F64 ( F64 F64 )", op: "powl", default: commonBinaryNum(Math.pow, "F64") },
            ],
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


