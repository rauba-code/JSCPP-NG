import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { ArithmeticNumSig, ArithmeticNumVariable, CFunction2, InitArithmeticNumVariable, Variable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.include("bits/abs.h");
        rt.defVar("INFINITY", variables.arithmeticNum("F32", Number.POSITIVE_INFINITY, null, true), false, true);
        rt.defVar("NAN", variables.arithmeticNum("F32", Number.NaN, null, true), false, true);
        function commonUnaryNum(fn: (l: number) => number, sig: ArithmeticNumSig | null): CFunction2 {
            return function(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                const l = rt.arithmeticNumValue(args[0] as ArithmeticNumVariable);
                const retv = variables.arithmeticNum(sig ?? (args[0] as ArithmeticNumVariable).t.sig, fn(l), null, false);
                rt.adjustArithmeticNumValue(retv);
                return retv;
            }
        }
        function commonBinaryNum(fn: (l: number, r: number) => number, sig: ArithmeticNumSig): CFunction2 {
            return function(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                const l = rt.arithmeticNumValue(args[0] as ArithmeticNumVariable);
                const r = rt.arithmeticNumValue(args[1] as ArithmeticNumVariable);
                const retv = variables.arithmeticNum(sig, fn(l, r), null, false);
                rt.adjustArithmeticNumValue(retv);
                return retv;
            }
        }
        /*function commonBinaryBig(fn: (l: bigint, r: bigint) => bigint, sig: ArithmeticBigSig): CFunction {
            return function(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticBigVariable {
                const l = rt.arithmeticValue(args[0] as ArithmeticBigVariable) as bigint;
                const r = rt.arithmeticValue(args[1] as ArithmeticBigVariable) as bigint;
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


