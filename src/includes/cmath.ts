/* eslint-disable no-shadow */
import { CRuntime, DummyVariable, FloatVariable, OptionalArg, Variable, VariableType } from "../rt";

export = {
    load(rt: CRuntime) {
        const tDouble = rt.doubleTypeLiteral;
        const g = "global";

        const regFunc = function(f: (rt: CRuntime, _this: Variable, ...args: (Variable | DummyVariable)[]) => any, lt: VariableType | "global", name: string, args: (VariableType | "?")[], retType: VariableType, optionalArgs?: OptionalArg[]) {
            rt.regFunc(f, lt, name, args, retType, optionalArgs);
            rt.addToNamespace("std", name, rt.readVar(name));
        };

        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.cos(x.v))), g, "cos", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.sin(x.v))), g, "sin", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.tan(x.v))), g, "tan", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.acos(x.v))), g, "acos", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.asin(x.v))), g, "asin", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.atan(x.v))), g, "atan", [tDouble], tDouble);
        regFunc(((rt, _this, y: FloatVariable, x: FloatVariable) => rt.val(tDouble, Math.atan(y.v / x.v))), g, "atan2", [tDouble, tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.cosh(x.v))), g, "cosh", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.sinh(x.v))), g, "sinh", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.tanh(x.v))), g, "tanh", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.acosh(x.v))), g, "acosh", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.asinh(x.v))), g, "asinh", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.atanh(x.v))), g, "atanh", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.exp(x.v))), g, "exp", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.log(x.v))), g, "log", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.log10(x.v))), g, "log10", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable, y: FloatVariable) => rt.val(tDouble, Math.pow(x.v, y.v))), g, "pow", [tDouble, tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.sqrt(x.v))), g, "sqrt", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.ceil(x.v))), g, "ceil", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.floor(x.v))), g, "floor", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.abs(x.v))), g, "fabs", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.abs(x.v))), g, "abs", [tDouble], tDouble);
        regFunc(((rt, _this, x: FloatVariable) => rt.val(tDouble, Math.round(x.v))), g, "round", [tDouble], tDouble);
    }
};